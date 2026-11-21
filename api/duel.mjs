// Satoshi Duel HTTP API (one Vercel function). Routes: /api/duel?a=<action>
import * as S from '../duel/lib/service.mjs';
import { RULES, sha256 } from '../duel/lib/engine.mjs';
import { db } from '../duel/lib/db.mjs';
import * as chain from '../duel/lib/chain.mjs';

const json = (res, status, body) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)); };
const tokenOf = (req) => (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '') || null;
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let s = ''; for await (const ch of req) s += ch; try { return JSON.parse(s || '{}'); } catch { return {}; }
}

/** Write pending duel results to the chain, one at a time platform-wide (advisory lock). */
async function recordPending() {
  const c = await (await db()).connect();
  try {
    const { rows: [{ ok }] } = await c.query('select pg_try_advisory_lock(42) ok');
    if (!ok) return;
    try {
      for (const d of await S.unrecorded(5)) {
        try { await S.setRecordTx(d.id, await chain.recordDuel(d)); } catch (e) { console.error('record', d.id, e.message); break; }
      }
    } finally { await c.query('select pg_advisory_unlock(42)'); }
  } finally { c.release(); }
}

const routes = {
  async config() { return { rules: RULES, network: chain.NETWORK, explorer: chain.EXPLORER }; },
  async signup(req, b) {
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
    return S.createPlayer({ name: b.name, ref: b.ref, ipHash: ip ? sha256(`ip:${process.env.HOUSE_SECRET}:${ip}`) : null });
  },
  async me(req) { await S.sweep(); return S.me(tokenOf(req)); },
  async create(req, b) { return S.createDuel(tokenOf(req), b); },
  async join(req, b) { return S.joinDuel(tokenOf(req), b); },
  async reveal(req, b) { const r = await S.reveal(tokenOf(req), b); await recordPending(); return r; },
  async duel(req, b, q) { await S.sweep(); return S.getDuel(q.get('id')); },
  async open() { await S.sweep(); return S.openDuels(); },
  async leaderboard() { await S.sweep(); recordPending().catch(() => {}); return S.leaderboard(); },
  async deposit(req) {
    const id = await S.playerId(tokenOf(req));
    const address = chain.depositKey(id).address;
    const utxos = await chain.depositUtxos(id);
    const { added } = await S.creditDeposits(tokenOf(req), utxos);
    return { address, added };
  },
  async withdraw(req, b) {
    const q = await S.requestWithdrawal(tokenOf(req), b);
    try {
      const txid = await chain.payWithdrawal(q.address, q.send);
      await S.markWithdrawal(q.withdrawalId, { txid, status: 'sent' });
      return { ...q, txid };
    } catch (e) {
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
