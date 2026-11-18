// Turn on-chain START/RESULT records into "rounds" for the panel. Pure functions, no I/O.
export const ROSTER = ['gpt-oss-20b', 'gpt-oss-120b']; // agentIdx -> model, same as the operator roster

/**
 * records: [{ txid, rec }] where rec is a decoded PR2 payload (S or R), any order.
 * Returns rounds newest first: { startTxid, ticket, taskIdx, model, deadlineUnix, result|null }.
 */
export function roundsFromRecords(records) {
  const results = new Map();
  for (const { txid, rec } of records) if (rec?.type === 'R') results.set(rec.startTxid, { txid, ...pickResult(rec) });
  const rounds = [];
  for (const { txid, rec, height } of records) {
    if (rec?.type !== 'S') continue;
    rounds.push({ startTxid: txid, ticket: rec.ref, taskIdx: rec.taskIdx, model: ROSTER[rec.agentIdx] ?? `agent ${rec.agentIdx}`,
      deadlineUnix: rec.deadlineUnix, height: height ?? 0, result: results.get(txid) ?? null });
  }
  // Unconfirmed (height <= 0) are the newest; then by height descending; deadline breaks ties.
  const key = (r) => (r.height > 0 ? r.height : Number.MAX_SAFE_INTEGER);
  return rounds.sort((a, b) => key(b) - key(a) || b.deadlineUnix - a.deadlineUnix);
}

const pickResult = (r) => ({ pass: r.exit === 0 && r.total > 0 && r.passed === r.total, passed: r.passed, total: r.total, durationS: r.durationS });

/** LIVE while waiting for RESULT before the deadline, then PASS / FAIL / TIMEOUT (a missing RESULT is a FAIL). */
export function roundStatus(round, nowUnix) {
  if (round.result) return round.result.pass ? 'PASS' : 'FAIL';
  return nowUnix > round.deadlineUnix ? 'TIMEOUT' : 'LIVE';
}

/** Per-model record from settled rounds (TIMEOUT counts as a fail). */
export function modelRecord(rounds, model, nowUnix) {
  let pass = 0, n = 0;
  for (const r of rounds) {
    if (r.model !== model) continue;
    const s = roundStatus(r, nowUnix);
    if (s === 'LIVE') continue;
    n++; if (s === 'PASS') pass++;
  }
  return { pass, n };
}

/**
 * Pari-mutuel style odds shown before any pool exists: implied probability from the model's
 * record with a +1/+2 prior (so 0 runs = 50/50), decimal payout = 1/p, capped at 20x.
 */
export function odds({ pass, n }) {
  const p = (pass + 1) / (n + 2);
  const cap = (x) => Math.min(20, Math.round(x * 10) / 10);
  return { pPass: p, pass: cap(1 / p), fail: cap(1 / (1 - p)) };
}
