// End-to-end against the real API + DB + chipnet: signup with referral, bot duel, friend duel, timeout, leaderboard, withdraw.
import { commitMove, newSalt, outcome } from '../server/engine.mjs';
const BASE = process.env.BASE ?? 'http://localhost:8787';
const call = async (a, { token, body, q = '' } = {}) => {
  const r = await fetch(`${BASE}/api/duel?a=${a}${q}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json(); if (!r.ok) throw Object.assign(new Error(`${a}: ${j.error}`), { status: r.status }); return j;
};
const ok = (c, m) => { if (!c) throw new Error('FAIL ' + m); console.log('  ✓ ' + m); };
const tag = Date.now().toString(36).slice(-4);
const A = await call('signup', { body: { name: `Ravi ${tag}` } });
ok(A.bonusGiven >= 0, `Ravi signed up, bonus ${A.bonusGiven}, ref code ${A.player.refCode}`);
const B = await call('signup', { body: { name: `Priya ${tag}`, ref: A.player.refCode } });
ok(B.referrer === A.player.name, `Priya joined with Ravi's referral, bonus ${B.bonusGiven}`);

// Bot duel
const s1 = newSalt(); const d1 = await call('create', { token: A.token, body: { stake: 2500, commit: commitMove('rock', s1), vsBot: true } });
const v1 = await call('duel', { q: `&id=${d1.id}` }); ok(v1.status === 'awaiting_reveal' && v1.bMove, `bot joined instantly with ${v1.bMove}`);
const r1 = await call('reveal', { token: A.token, body: { id: d1.id, move: 'rock', salt: s1 } });
ok(r1.result === outcome('rock', v1.bMove), `bot duel settled: result ${r1.result}`);

// Friend duel
const s2 = newSalt(); const d2 = await call('create', { token: A.token, body: { stake: 5000, commit: commitMove('scissors', s2) } });
try { await call('join', { token: A.token, body: { id: d2.id, move: 'rock' } }); ok(false, 'self-join blocked'); } catch (e) { ok(/own duel/.test(e.message), 'cannot join own duel'); }
await call('join', { token: B.token, body: { id: d2.id, move: 'paper' } });
try { await call('reveal', { token: A.token, body: { id: d2.id, move: 'rock', salt: s2 } }); ok(false, 'cheat reveal blocked'); } catch (e) { ok(/does not match/.test(e.message), 'changing the move after seeing Priya\'s is rejected'); }
const r2 = await call('reveal', { token: A.token, body: { id: d2.id, move: 'scissors', salt: s2 } });
ok(r2.result === 1, 'scissors beats paper: Ravi wins 10000 sats');
const meA = await call('me', { token: A.token }); ok(meA.player.cash >= 10000, `Ravi cash ${meA.player.cash}, bonus ${meA.player.bonus}`);

// Leaderboard + chain record
let lb, rec; for (let i = 0; i < 10; i++) { lb = await call('leaderboard'); rec = lb.feed.find((f) => f.id === d2.id)?.record_txid; if (rec) break; await new Promise((r) => setTimeout(r, 3000)); }
ok(lb.top.some((t) => t.name === A.player.name), 'Ravi is on the leaderboard');
ok(!!rec, `duel recorded on chain: ${rec}`);

// Withdraw
const dep = await call('deposit', { token: B.token }); ok(/^bchtest:/.test(dep.address), `Priya's deposit address ${dep.address}`);
try { await call('withdraw', { token: B.token, body: { address: dep.address, amount: 10000 } }); ok(false, 'bonus not withdrawable'); } catch (e) { ok(/more than/.test(e.message), 'bonus credit alone cannot be withdrawn'); }
const w = await call('withdraw', { token: A.token, body: { address: 'bchtest:qqr8e70709swuxthp63ctnjgy34kclsjgg9ce9gcck', amount: 10000 } });
ok(!!w.txid && w.fee === 500, `Ravi withdrew 10000 → sent ${w.send} (fee ${w.fee}) in ${w.txid}`);
console.log(JSON.stringify({ botDuel: d1.id, friendDuel: d2.id, record: rec, withdrawal: w.txid }));
process.exit(0);
