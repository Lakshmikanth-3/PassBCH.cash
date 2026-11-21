// Satoshi Duel HTTP API (one Vercel function). Routes: /api/duel?a=<action>
import * as S from '../server/service.mjs';
import { RULES, sha256 } from '../server/engine.mjs';
import { db } from '../server/db.mjs';
import * as chain from '../server/chain.mjs';
import { spot } from '../server/price.mjs';
import { nextRound, UPDOWN } from '../server/engine.mjs';

const json = (res, status, body) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)); };
const tokenOf = (req) => (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '') || null;
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let s = ''; for await (const ch of req) s += ch; try { return JSON.parse(s || '{}'); } catch { return {}; }
}

const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
const timed = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} timed out`)), ms))]);

/** Write pending duel results to the chain, one at a time platform-wide (advisory lock). Budgeted: never blocks a response for long. */
const recordSoon = () => within(recordPending().catch((e) => console.error('recordPending', e.message)), 7000);
async function recordPending() {
  const c = await (await db()).connect();
  try {
    const { rows: [{ ok }] } = await c.query('select pg_try_advisory_lock(42) ok');
    if (!ok) return;
    try {
      for (const d of await S.unrecorded(5)) {
        try { await timed(chain.recordDuel(d, (t) => S.setRecordTx(d.id, t)), 6000, 'record'); } catch (e) { await S.markRecordTry(d.id); console.error('record', d.id, e.message); break; }
      }
      for (const b of await S.unrecordedBets(5)) {
        try { await timed(chain.recordBet(b, (t) => S.setBetRecord(b.id, t)), 6000, 'bet record'); } catch (e) { await S.markBetRecordTry(b.id); console.error('bet record', b.id, e.message); break; }
      }
    } finally { await c.query('select pg_advisory_unlock(42)'); }
  } finally { c.release(); }
}

const routes = {
  async config() { return { rules: { ...RULES, updownPayoutPct: UPDOWN.payoutPct }, network: chain.NETWORK, explorer: chain.EXPLORER }; },
  async signup(req, b) {
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
    return S.createPlayer({ name: b.name, ref: b.ref, ipHash: ip ? sha256(`ip:${process.env.HOUSE_SECRET}:${ip}`) : null });
  },
  async me(req) { await S.sweep(); return S.me(tokenOf(req)); },
  async create(req, b) { return S.createDuel(tokenOf(req), b); },
  async join(req, b) { return S.joinDuel(tokenOf(req), b); },
  async reveal(req, b) { const r = await S.reveal(tokenOf(req), b); await recordSoon(); return r; },
  async duel(req, b, q) { await S.sweep(); return S.getDuel(q.get('id')); },
  async open() { await S.sweep(); return S.openDuels(); },
  async leaderboard() { await S.sweep(); await recordSoon(); return S.leaderboard(); },
  async deposit(req) {
    const id = await S.playerId(tokenOf(req));
    const address = chain.depositKey(id).address;
    const utxos = await timed(chain.depositUtxos(id), 10000, 'deposit lookup');
    const { added } = await S.creditDeposits(tokenOf(req), utxos);
    return { address, added };
  },
  /** Coins of a WizardConnect wallet (public addresses only), so the browser can build the deposit for the wallet to sign. */
  async price() { const now = Math.floor(Date.now() / 1000); return { ...(await timed(spot(), 6000, 'price')), now, nextRound: nextRound(now), payoutPct: UPDOWN.payoutPct }; },
  async bet(req, b) { return S.placeBet(tokenOf(req), b); },
  async bets(req) { await within(S.settleBets(), 8000); await recordSoon(); return { mine: tokenOf(req) ? await S.myBets(tokenOf(req)) : [], feed: await S.betFeed() }; },
  async walletutxos(req, b) {
    const addrs = Array.isArray(b.addresses) ? b.addresses.slice(0, 40).filter((a) => /^(bchtest|bitcoincash):q[0-9a-z]{40,}$/.test(a)) : [];
    const p = chain.provider();
    const out = {};
    await timed(Promise.all(addrs.map(async (a) => { out[a] = (await p.getUtxos(a)).filter((u) => !u.token).map((u) => ({ txid: u.txid, vout: u.vout, satoshis: Number(u.satoshis) })); })), 15000, 'wallet lookup');
    return out;
  },
  async broadcast(req, b) {
    if (!/^[0-9a-f]{100,200000}$/i.test(b.hex ?? '')) throw new S.UserError('bad transaction');
    try { return { txid: await timed(chain.provider().sendRawTransaction(b.hex), 15000, 'broadcast') }; }
    catch (e) { if (/already|known|txn-mempool-conflict/i.test(e.message)) return { already: true }; throw new S.UserError(`broadcast failed: ${e.message}`); }
  },
  async withdraw(req, b) {
    const q = await S.requestWithdrawal(tokenOf(req), b);
    let signed = null;
    try {
      const txid = await timed(chain.payWithdrawal(q.address, q.send, async (t) => { signed = t; await S.markWithdrawal(q.withdrawalId, { txid: t, status: 'broadcasting' }); }), 15000, 'withdrawal broadcast');
      await S.markWithdrawal(q.withdrawalId, { txid, status: 'sent' });
      return { ...q, txid };
    } catch (e) {
      if (signed) return { ...q, txid: signed, note: 'broadcast is slow; check the explorer in a minute' }; // may already be on chain: never refund
      await S.refundWithdrawal(q.withdrawalId);
      throw new S.UserError(`withdrawal failed, balance restored: ${e.message}`, 502);
    }
  },
};

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  const fn = routes[q.get('a')];
  if (!fn) return json(res, 404, { error: 'unknown action' });
  try {
    json(res, 200, await fn(req, req.method === 'POST' ? await body(req) : {}, q));
  } catch (e) {
    if (!(e instanceof S.UserError)) console.error(e);
    json(res, e.status ?? 500, { error: e instanceof S.UserError ? e.message : 'server error' });
  }
}
