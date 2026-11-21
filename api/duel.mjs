// PassBCH.cash HTTP API (one Vercel function). Routes: /api/duel?a=<action>
import * as S from '../server/service.mjs';
import { RULES, sha256 } from '../server/engine.mjs';
import { db } from '../server/db.mjs';
import * as chain from '../server/chain.mjs';
import { spot, recentCloses, rates, swapQuote } from '../server/price.mjs';
import { nextRound, UPDOWN } from '../server/engine.mjs';

// Bump when web/public/duel.mjs changes: old terminal clients update themselves.
export const CLIENT_VERSION = '2026.11.21-3';

const json = (res, status, body) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)); };
const tokenOf = (req) => (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '') || null;
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let s = ''; for await (const ch of req) s += ch; try { return JSON.parse(s || '{}'); } catch { return {}; }
}

const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
const timed = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} timed out`)), ms))]);

/** Write pending results (duels, AI rounds, Up/Down bets) to the chain. Budgeted: never blocks a response for long. */
const recordSoon = () => within(recordPending().catch((e) => console.error('recordPending', e.message)), 7000);
async function recordPending() {
  const jobs = [
    ['pf_matches', (m) => chain.recordPf(m, (t) => S.setPfRecord(m.id, t))],
    ['duels', (d) => chain.recordDuel(d, (t) => S.setRecordTx(d.id, t))],
    ['ai_rounds', (r) => chain.recordAi(r, (t) => S.setAiRecord(r.id, t))],
    ['bets', (b) => chain.recordBet(b, (t) => S.setBetRecord(b.id, t))],
  ];
  for (const [table, send] of jobs) {
    for (const row of await S.claimUnrecorded(table, 3)) {
      try { await timed(send(row), 6000, `${table} record`); } catch (e) {
        if (!/timed out/.test(e.message)) await S.clearRecordTx(table, row.id); // definite failure: retry later; a timeout may still land
        console.error('record', table, row.id, e.message); return;
      }
    }
  }
}

const routes = {
  async config() { return { rules: { ...RULES, updownPayoutPct: UPDOWN.payoutPct, updownRoundS: UPDOWN.roundS }, network: chain.NETWORK, explorer: chain.EXPLORER, clientVersion: CLIENT_VERSION }; },
  async rates() { return timed(rates(), 7000, 'rates'); },
  async swapquote(req, b, q) { try { return await timed(swapQuote(q.get('coin'), q.get('dir')), 8000, 'quote'); } catch (e) { throw new S.UserError(e.message); } },
  async signup(req, b) {
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
    return S.createPlayer({ name: b.name, ref: b.ref, ipHash: ip ? sha256(`ip:${process.env.HOUSE_SECRET}:${ip}`) : null });
  },
  async me(req) { await S.sweep(); return S.me(tokenOf(req)); },
  async login(req, b) { return S.login(b.code); },
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
  async price(req, b, q) {
    const now = Math.floor(Date.now() / 1000);
    const [p, history] = await Promise.all([timed(spot(), 6000, 'price'), q.get('history') ? recentCloses(12) : []]);
    return { ...p, now, nextRound: nextRound(now), payoutPct: UPDOWN.payoutPct, history };
  },
  async bet(req, b) { return S.placeBet(tokenOf(req), b); },
  async bets(req) { await within(S.settleBets(), 8000); await recordSoon(); return { mine: tokenOf(req) ? await S.myBets(tokenOf(req)) : [], feed: await S.betFeed() }; },
  async ai(req) { const st = await S.aiState(tokenOf(req)); await recordSoon(); return st; },
  async aibet(req, b) { return S.aiBet(tokenOf(req), b); },
  // Runner-only routes (the AI sandbox runs on the operator's machine), protected by a shared secret header.
  async airunner(req, b) {
    if (!process.env.AI_RUNNER_KEY || req.headers['x-runner-key'] !== process.env.AI_RUNNER_KEY) throw new S.UserError('forbidden', 403);
    if (b.op === 'open') return S.aiOpenRound({ tasks: b.tasks, tip: await timed(chain.tip(), 10000, 'tip') });
    if (b.op === 'next') return { job: await S.aiNextJob() };
    if (b.op === 'result') return S.aiResult(b);
    throw new S.UserError('bad op');
  },
  async pfcreate(req, b) { const r = await S.pfCreate(tokenOf(req), b); return r; },
  async pfjoin(req, b) { const r = await S.pfJoin(tokenOf(req), b); await recordSoon(); return r; },
  async pf(req, b, q) { const r = await S.pfGet(q.get('id'), tokenOf(req)); if (r.status === 'done' && !r.recordTxid) await recordSoon(); return r; },
  async pfopen() { return S.pfOpen(); },
  async player(req, b, q) { return S.player(q.get('name')); },
  /** Raw transaction + the DB view of the game it records. The browser decodes and recomputes everything itself. */
  async verify(req, b, q) {
    const txid = q.get('txid') ?? '';
    if (!/^[0-9a-f]{64}$/.test(txid)) throw new S.UserError('enter a 64-character transaction id');
    const raw = await timed(chain.provider().getRawTransaction(txid), 10000, 'transaction lookup').catch(() => null);
    if (!raw) throw new S.UserError('transaction not found on ' + chain.NETWORK, 404);
    const kinds = { '53444c31': 'SDL1', '53554431': 'SUD1', '53504631': 'SPF1', '53414931': 'SAI1' };
    const m = raw.match(/6a(?:4c[0-9a-f]{2}|[0-9a-f]{2})(53444c31|53554431|53504631|53414931)([0-9a-f]{32})/);
    const kind = m ? kinds[m[1]] : null;
    return { txid, raw, network: chain.NETWORK, explorer: chain.EXPLORER, kind, match: kind ? await S.matchById(kind, m[2]) : null };
  },
  async winners(req, b, q) { await S.sweep(); return S.winners({ game: q.get('game') ?? 'all', period: q.get('period') ?? 'all' }); },
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
