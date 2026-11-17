// Chipnet end-to-end test of the browser ticket code (src/chain/session.js) run from Node.
// A test wallet pays the deposit (what a phone does after scanning the QR); everything after that is the browser code.
import fs from 'node:fs';
import { ElectrumNetworkProvider, TransactionBuilder } from '@passrate/shared/tickettx';
import { DEPOSIT_SATS } from '@passrate/shared/tickettx';
import * as S from '../src/chain/session.js';
import { CONFIG } from '../src/config.js';

const t0 = Date.now(), el = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
const log = (m) => console.log(`[${el()}] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const provider = new ElectrumNetworkProvider('chipnet');
const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'));
const agentIdx = Number(process.argv[2] ?? 1);

// "Phone wallet": the chipnet test-payer key from keys/ (never shipped to the browser).
const keys = JSON.parse(fs.readFileSync(new URL('../../../keys/t1-keys.json', import.meta.url), 'utf8'));
const wallet = S.keyFromHex(keys.payer);

const mem = new Map(); const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
const session = S.newSession({ agentIdx }); S.save(storage, session);
const dep = S.keyFromHex(session.skHex);
log(`deposit QR: ${S.depositUri(dep.address)}`);

const src = (await provider.getUtxos(wallet.address)).sort((a, b) => Number(b.satoshis - a.satoshis))[0];
if (!src || src.satoshis < DEPOSIT_SATS + 1000n) throw new Error(`fund test wallet ${wallet.address}`);
const pay = await new TransactionBuilder({ provider }).addInput(src, wallet.sig.unlockP2PKH())
  .addOutput({ to: dep.address, amount: DEPOSIT_SATS }).addOutput({ to: wallet.address, amount: src.satoshis - DEPOSIT_SATS - 400n }).send();
log(`wallet paid deposit ${pay.txid}`);

for (;;) { const { total } = await S.depositBalance(provider, dep.address); if (total >= DEPOSIT_SATS) break; await sleep(1500); }
log('deposit detected -> QR closes');
const ticket = await S.payTicket({ provider, session: S.load(storage), manifest, op: CONFIG.operator });
log(`TICKET ${ticket.txid} -> exercise #${ticket.taskIdx} ${ticket.slug}`);
const tTicket = Date.now();

let start = null; while (!start) { start = await S.findStart(provider, ticket); if (!start) await sleep(2000); }
const startLatency = (Date.now() - tTicket) / 1000;
log(`START ${start.txid} seen by browser ${startLatency.toFixed(1)} s after ticket`);
let result = null; const deadline = Date.now() + 300000;
while (!result && Date.now() < deadline) { result = await S.findResult(provider, start, CONFIG.operator.inbox); if (!result) await sleep(3000); }
log(result ? `RESULT ${result.txid}: ${result.pass ? 'PASS' : 'FAIL'} ${result.passed}/${result.total}` : 'no RESULT within 5 min');
console.log(JSON.stringify({ deposit: pay.txid, ticket: ticket.txid, slug: ticket.slug, taskIdx: ticket.taskIdx, start: start.txid, startLatencyBrowserS: startLatency, result, totalS: (Date.now() - t0) / 1000 }));
process.exit(result ? 0 : 1);
