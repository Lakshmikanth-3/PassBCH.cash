#!/usr/bin/env node
// Background feed: polls chipnet every few seconds and writes ~/.passrate/round.json for the status line.
// Usage: node bin/feed.mjs [--once]
import fs from 'node:fs';
import { ElectrumNetworkProvider } from '@passrate/shared/tickettx';
import { buildState } from '../src/feed.js';
import { writeJson } from '../src/store.js';

const NETWORK = 'chipnet'; // mainnet only at final submission
const HOSTS = ['chipnet.bch.ninja', 'chipnet.imaginary.cash'];
const INBOX = 'bchtest:qzmuv37ealgxg3cm3t9vqawusm6q4t5wysv50yfxkn'; // operator inbox (public)
const manifest = JSON.parse(fs.readFileSync(new URL('../../web/public/manifest.json', import.meta.url), 'utf8'));
const slugs = manifest.tasks.map((t) => t.slug);
const once = process.argv.includes('--once');

let h = 0, provider = null;
const fresh = () => new ElectrumNetworkProvider(NETWORK, { hostname: HOSTS[h++ % HOSTS.length] });
const cache = new Map();
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

for (;;) {
  try {
    provider ??= fresh();
    const state = await withTimeout(buildState(provider, { inbox: INBOX, slugs, network: NETWORK }, { cache }), 90000);
    writeJson('round.json', state);
    const r = state.rounds[0];
    console.log(`${new Date().toISOString()} ${state.rounds.length} rounds; latest ${r ? `${r.model} #${r.taskIdx} ${r.result ? (r.result.pass ? 'PASS' : 'FAIL') : 'LIVE'}` : '-'}`);
  } catch (e) {
    console.log(`feed: ${e.message}; switching server`);
    provider = null;
  }
  if (once) process.exit(0);
  await new Promise((r) => setTimeout(r, 4000));
}
