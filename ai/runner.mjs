// AI Pass or Fail runner. Runs on the operator's machine (needs Docker + a Groq key in .ENV).
// Loop: open a round (exercise drawn from the latest BCH block hash) -> betting window -> AI solves it in a
// sealed Docker sandbox (no network) -> report PASS/FAIL + transcript hash -> server settles bets and records on chain.
// Usage: AI_RUNNER_KEY=... node ai/runner.mjs   (BASE defaults to the live site)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'https://passbch-cash.vercel.app';
const KEY = process.env.AI_RUNNER_KEY;
if (!KEY) { console.error('set AI_RUNNER_KEY'); process.exit(1); }
const tasks = JSON.parse(fs.readFileSync(path.join(here, 'manifest.json'), 'utf8')).tasks.map((t) => t.slug);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log(`${new Date().toISOString().slice(11, 19)} ${m}`);

async function call(body) {
  const r = await fetch(`${BASE}/api/duel?a=airunner`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-runner-key': KEY }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j;
}

function solve(slug, model) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.join(here, '.cache', 'runs'), { recursive: true });
    const out = path.join(here, '.cache', 'runs', `${Date.now()}-${slug}.json`);
    const p = spawn('python', ['-u', 'run_one.py', slug, model, out], { cwd: here });
    let buf = '';
    p.stdout.on('data', (d) => { buf += d; });
    p.stderr.on('data', (d) => process.stderr.write(`    ${d}`));
    p.on('close', (code) => { try { resolve(JSON.parse(buf.trim().split('\n').pop())); } catch { reject(new Error(`harness exit ${code}`)); } });
  });
}

const once = process.argv.includes('--once');
for (;;) {
  try {
    const job = (await call({ op: 'next' })).job;
    if (job) {
      log(`betting closed → ${job.model} solving "${job.slug}"`);
      const r = await solve(job.slug, job.model);
      await call({ op: 'result', id: job.id, pass: r.pass, passed: r.passed, total: r.total, durationS: r.durationS, transcriptHash: r.transcriptHash });
      log(`RESULT ${r.pass ? 'PASS' : 'FAIL'} ${r.passed}/${r.total} in ${r.durationS}s`);
      if (once) process.exit(0);
      await sleep(15000); // short break between rounds
      continue;
    }
    const o = await call({ op: 'open', tasks });
    if (o.id) log(`round opened: ${o.model} vs "${o.slug}" (#${o.taskIdx}) — betting open 75 s`);
  } catch (e) { log(`runner: ${e.message}`); }
  await sleep(5000);
}
