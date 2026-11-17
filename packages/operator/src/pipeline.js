import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { hexToBin, hash256, binToHex, hashTransaction, decodeTransaction } from '@bitauth/libauth';
import { fromOpReturn } from '@passrate/shared';
import { PATHS, DOUBLE_SPEND_WAIT_MS, loadState, saveState } from './config.js';
import { validateTicket, buildStart, buildResult } from './txs.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// OP_RETURN, push 75 bytes, "PR2", version 1, 'T'
export const TICKET_SCRIPT_PREFIX = '6a4b' + '505232' + '01' + '54';

/**
 * Run one network step against the *current* ctx.provider with a timeout. On failure, swap to a fresh
 * provider (if ctx.makeProvider is set) and retry. Never holds on to a dead connection.
 */
export async function netCall(ctx, fn, what, { tries = 4, timeoutMs = 15000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await withTimeout(fn(ctx.provider), timeoutMs, what); } catch (e) {
      last = e;
      if (ctx.makeProvider) ctx.provider = ctx.makeProvider();
      (ctx.log ?? console.log)(`${what}: ${e.message}; attempt ${i + 1}/${tries} failed${ctx.provider?.hostname ? ` via ${ctx.provider.hostname}` : ''}`);
      await sleep(1500);
    }
  }
  throw last;
}

/**
 * Broadcast with a txid computed before sending. If the send fails or hangs, check whether the
 * network already has the tx before retrying, so a dropped connection can't cause a false failure.
 */
export async function broadcast(ctx, hex, what) {
  const txid = hashTransaction(hexToBin(hex));
  await netCall(ctx, async (p) => {
    try { await p.sendRawTransaction(hex); } catch (e) {
      if (/already|known|txn-mempool-conflict/i.test(e.message) && await p.getRawTransaction(txid).catch(() => null)) return;
      if (await p.getRawTransaction(txid).catch(() => null)) return; // it made it after all
      throw e;
    }
  }, `broadcast ${what}`);
  return txid;
}

/** Our own START spending this ticket, if one is on chain (resume after an operator crash). */
async function findOwnStart(ctx, ticket) {
  const hist = await netCall(ctx, (p) => p.performRequest('blockchain.address.get_history', ticket.covenant), 'covenant history');
  for (const { tx_hash: h } of hist) {
    if (h === ticket.txid) continue;
    const raw = await netCall(ctx, (p) => p.getRawTransaction(h), 'spender');
    const tx = decodeTransaction(hexToBin(raw));
    let rec = null; try { rec = fromOpReturn(tx.outputs[0].lockingBytecode); } catch { /* not a record */ }
    if (rec?.type === 'S' && rec.ref === ticket.txid) return h; // a refund has no START record
  }
  return null;
}

/** Reject if a network step hangs; a hang must become a failover, not a silent stall. */
export function withTimeout(promise, ms, what = 'request') {
  let timer;
  return Promise.race([promise, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`${what} timed out after ${ms} ms`)), ms); })])
    .finally(() => clearTimeout(timer));
}

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
/**
 * opts.confirmedHeight: block height the ticket confirmed in (>0), from address history.
 * Tip freshness is judged against that height, so an operator outage never makes an honest ticket "stale".
 */
export async function processTicket(txid, ctx, { confirmedHeight = 0 } = {}) {
  const { operator, manifest, log = console.log } = ctx;
  const net = (fn, what) => netCall(ctx, fn, what);
  const state = loadState();
  if (state.runs[txid]?.resultTxid) { log(`already processed ${txid}`); return state.runs[txid]; }
  const t0 = Date.now();
  const tip = await net((p) => getTip(p), 'tip');
  const raw = await net((p) => p.getRawTransaction(txid), 'ticket tx');
  const v = validateTicket(raw, { operatorPkHex: operator.pkHex, taskRoot: manifest.taskRoot, seenAtHeight: confirmedHeight > 0 ? Math.min(confirmedHeight, tip.height) : tip.height, taskCount: manifest.tasks.length, txid });
  if (!v.ok) { log(`reject ${txid}: ${v.reason}`); state.runs[txid] = { txid, rejected: v.reason }; saveState(state); return state.runs[txid]; }
  const ticket = v.ticket;
  const task = manifest.tasks[ticket.taskIdx];
  log(`ticket ${txid} -> task #${ticket.taskIdx} ${task.slug}, row ${ticket.row.model}`);

  // Double-spend guard: wait, then confirm the ticket output is still unspent before committing.
  await sleep(DOUBLE_SPEND_WAIT_MS);
  const still = (await net((p) => p.getUtxos(ticket.covenant), 'ticket utxo')).some((u) => u.txid === txid && u.vout === 1);
  let start, startLatencyS = null;
  if (!still) {
    // Spent already: either our own earlier START (operator crashed mid-run: resume), or a refund / double-spend.
    const own = await findOwnStart(ctx, ticket);
    if (!own) { log(`ticket ${txid} no longer unspent (double-spend or refund)`); state.runs[txid] = { txid, rejected: 'spent before START' }; saveState(state); return state.runs[txid]; }
    start = { txid: own }; log(`resuming: START ${own} already on chain`);
  } else {
    const hex = buildStart({ provider: ctx.provider, ticket, operator, taskRoot: manifest.taskRoot, harnessDigest: manifest.harnessDigest, refHeight: ticket.tipHeight }).build();
    start = { txid: await broadcast(ctx, hex, 'START') };
    startLatencyS = (Date.now() - t0) / 1000;
    log(`START ${start.txid} (${startLatencyS.toFixed(1)} s after ticket seen)`);
  }
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
  const resHex = buildResult({ provider: ctx.provider, startTxid: start.txid, startValue, operator, result }).build();
  const res = { txid: await broadcast(ctx, resHex, 'RESULT') };
  Object.assign(run, { resultTxid: res.txid, pass: result.pass, passed: result.passed, total: result.total, durationS: result.durationS,
    attempts: result.attempts, hashes: { transcript: result.transcriptHash, solution: result.solutionHash, testOut: result.testOutHash } });
  saveState(state);
  log(`RESULT ${res.txid}: ${result.pass ? 'PASS' : 'FAIL'} ${result.passed}/${result.total} in ${result.durationS}s`);
  return run;
}

/** Watcher: poll the operator inbox history; any new tx with a TICKET record is processed. */
export async function watch(ctx, { intervalMs = 2000, once = false, makeProvider } = {}) {
  const { operator, log = console.log } = ctx;
  const seen = new Set(Object.keys(loadState().runs));
  for (;;) {
    const provider = ctx.provider;
    try {
      const hist = await withTimeout(provider.performRequest('blockchain.address.get_history', operator.address), 15000, 'history');
      for (const { tx_hash: txid, height } of hist) {
        if (seen.has(txid)) continue;
        const raw = await withTimeout(provider.getRawTransaction(txid), 15000, 'getRawTransaction');
        seen.add(txid); // only after we could read it, so a dropped connection retries this tx
        if (!raw.includes(TICKET_SCRIPT_PREFIX)) continue; // not a ticket (e.g. our own START/RESULT change)
        processTicket(txid, ctx, { confirmedHeight: height }).catch((e) => log(`error on ${txid}: ${e.message}`));
      }
    } catch (e) {
      // Public Electrum servers drop connections; never let that stop the watcher.
      if (!makeProvider) throw e;
      ctx.provider = makeProvider(); // in-flight pipelines read ctx.provider on their next call
      log(`watch: ${e.message}; switched to ${ctx.provider.hostname}`);
    }
    if (once) return;
    await sleep(intervalMs);
  }
}
