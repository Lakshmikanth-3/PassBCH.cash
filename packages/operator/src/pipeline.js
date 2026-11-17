import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { hexToBin, hash256, binToHex } from '@bitauth/libauth';
import { PATHS, DOUBLE_SPEND_WAIT_MS, loadState, saveState } from './config.js';
import { validateTicket, buildStart, buildResult } from './txs.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// OP_RETURN, push 75 bytes, "PR2", version 1, 'T'
export const TICKET_SCRIPT_PREFIX = '6a4b' + '505232' + '01' + '54';

/** Tip height + block hash (display order) from the Electrum server. */
export async function getTip(provider) {
  const { height, hex } = await provider.performRequest('blockchain.headers.get_tip');
  return { height, hash: binToHex(hash256(hexToBin(hex)).reverse()) };
}

export function runHarness(slug, model, transcriptPath, log = console.log) {
  return new Promise((resolve, reject) => {
    const p = spawn('python', ['-u', 'run_one.py', slug, model, transcriptPath], { cwd: PATHS.harness });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => log(String(d).trimEnd()));
    p.on('close', (code) => {
      const last = out.trim().split('\n').pop();
      try { resolve(JSON.parse(last)); } catch { reject(new Error(`harness exit ${code}: ${out.slice(-300)}`)); }
    });
  });
}

/**
 * Full operator pipeline for one ticket. Every step is timed; the run record is saved for the web app.
 * ctx: { provider, operator, manifest: { taskRoot, harnessDigest, tasks }, log }
 */
export async function processTicket(txid, ctx) {
  const { provider, operator, manifest, log = console.log } = ctx;
  const state = loadState();
  if (state.runs[txid]?.result) { log(`already processed ${txid}`); return state.runs[txid]; }
  const t0 = Date.now();
  const tip = await getTip(provider);
  const raw = await provider.getRawTransaction(txid);
  const v = validateTicket(raw, { operatorPkHex: operator.pkHex, taskRoot: manifest.taskRoot, seenAtHeight: tip.height, taskCount: manifest.tasks.length, txid });
  if (!v.ok) { log(`reject ${txid}: ${v.reason}`); state.runs[txid] = { txid, rejected: v.reason }; saveState(state); return state.runs[txid]; }
  const ticket = v.ticket;
  const task = manifest.tasks[ticket.taskIdx];
  log(`ticket ${txid} -> task #${ticket.taskIdx} ${task.slug}, row ${ticket.row.model}`);

  // Double-spend guard: wait, then confirm the ticket output is still unspent before committing.
  await sleep(DOUBLE_SPEND_WAIT_MS);
  const still = (await provider.getUtxos(ticket.covenant)).some((u) => u.txid === txid && u.vout === 1);
  if (!still) { log(`ticket ${txid} no longer unspent (double-spend or refund)`); state.runs[txid] = { txid, rejected: 'spent before START' }; saveState(state); return state.runs[txid]; }

  const start = await buildStart({ provider, ticket, operator, taskRoot: manifest.taskRoot, harnessDigest: manifest.harnessDigest, refHeight: ticket.tipHeight }).send();
  const startLatencyS = (Date.now() - t0) / 1000;
  log(`START ${start.txid} (${startLatencyS.toFixed(1)} s after ticket seen)`);
  const run = { txid, startTxid: start.txid, startLatencyS, taskIdx: ticket.taskIdx, slug: task.slug, model: ticket.row.model, agentIdx: ticket.row.agentIdx, startedAt: new Date().toISOString() };
  state.runs[txid] = run; saveState(state);

  fs.mkdirSync(PATHS.runs, { recursive: true });
  const transcriptPath = path.join(PATHS.runs, `${start.txid}.json`);
  let result;
  try {
    result = await runHarness(task.slug, ticket.row.model, transcriptPath, log);
  } catch (e) {
    // No RESULT is sealed: the chain will show this run as FAIL_TIMEOUT after its deadline. That's the point.
    log(`harness failed: ${e.message}`); run.harnessError = e.message; saveState(state); return run;
  }
  const startValue = ticket.satoshis - 700n;
  const res = await buildResult({ provider, startTxid: start.txid, startValue, operator, result }).send();
  Object.assign(run, { resultTxid: res.txid, pass: result.pass, passed: result.passed, total: result.total, durationS: result.durationS,
    attempts: result.attempts, hashes: { transcript: result.transcriptHash, solution: result.solutionHash, testOut: result.testOutHash } });
  saveState(state);
  log(`RESULT ${res.txid}: ${result.pass ? 'PASS' : 'FAIL'} ${result.passed}/${result.total} in ${result.durationS}s`);
  return run;
}

/** Watcher: poll the operator inbox history; any new tx with a TICKET record is processed. */
export async function watch(ctx, { intervalMs = 2000, once = false } = {}) {
  const { provider, operator, log = console.log } = ctx;
  const seen = new Set(Object.keys(loadState().runs));
  for (;;) {
    const hist = await provider.performRequest('blockchain.address.get_history', operator.address);
    for (const { tx_hash: txid } of hist) {
      if (seen.has(txid)) continue;
      seen.add(txid);
      const raw = await provider.getRawTransaction(txid);
      if (!raw.includes(TICKET_SCRIPT_PREFIX)) continue; // not a ticket (e.g. our own START/RESULT change)
      processTicket(txid, ctx).catch((e) => log(`error on ${txid}: ${e.message}`));
    }
    if (once) return;
    await sleep(intervalMs);
  }
}
