// T7 (server half): two public Fulcrum wss servers must return identical block-header hashes.
// The browser/origin half must be run from the deployed origin (Node cannot test browser CORS/origin policy).
import { sha256 } from '@noble/hashes/sha256';
import WebSocket from 'ws';

const args = process.argv.slice(2);
const servers = args.length ? args : [
  'wss://bch.imaginary.cash:50004',
  'wss://electroncash.de:60002',
  'wss://bch.loping.net:50004',
  'wss://fulcrum.greyh.at:50004',
];
const hex = (u) => Buffer.from(u).toString('hex');
const blockHash = (h) => hex(Buffer.from(sha256(sha256(Buffer.from(h, 'hex')))).reverse());

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { handshakeTimeout: 8000 });
    let id = 0;
    const pend = new Map();
    ws.on('message', (m) => {
      for (const l of String(m).split('\n').filter(Boolean)) {
        const j = JSON.parse(l);
        pend.get(j.id)?.(j);
      }
    });
    ws.on('error', reject);
    ws.on('open', () => resolve({
      call: (method, ...params) => new Promise((res, rej) => {
        const i = ++id;
        pend.set(i, (j) => (j.error ? rej(new Error(JSON.stringify(j.error))) : res(j.result)));
        ws.send(JSON.stringify({ id: i, method, params }) + '\n');
        setTimeout(() => rej(new Error('timeout ' + method)), 10000);
      }),
      close: () => ws.close(),
    }));
  });
}

// Fixed heights well below any tip, so both servers are queried for the same blocks.
const HEIGHTS = Array.from({ length: 20 }, (_, i) => 800000 + i * 1237);
const results = {};
for (const url of servers) {
  try {
    const c = await connect(url);
    const v = await c.call('server.version', 'passrate-t7', '1.4');
    const tip = (await c.call('blockchain.headers.subscribe')).height;
    const hs = {};
    for (const h of HEIGHTS) hs[h] = blockHash(await c.call('blockchain.block.header', h));
    results[url] = { ok: true, server: v[0], tip, hs };
    c.close();
  } catch (e) {
    results[url] = { ok: false, err: e.message };
  }
}
for (const [u, r] of Object.entries(results)) console.log(u, r.ok ? `OK ${r.server} tip=${r.tip}` : `FAIL ${r.err}`);
const good = Object.entries(results).filter(([, r]) => r.ok);
if (good.length >= 2) {
  const [[ua, a], [ub, b]] = good;
  const same = HEIGHTS.filter((h) => a.hs[h] === b.hs[h]).length;
  console.log(`${ua} vs ${ub}: ${same}/${HEIGHTS.length} header hashes identical`);
} else {
  console.log('fewer than 2 reachable servers');
}
