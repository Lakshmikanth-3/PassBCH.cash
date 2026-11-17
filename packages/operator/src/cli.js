// PassRate operator CLI (chipnet).
//   manifest        build task list, publish MANIFEST, write web/public/tasks.json
//   ticket [agent]  pay a test ticket from the test-payer key (simulates a judge)
//   process <txid>  run the pipeline for one ticket
//   watch           watch the inbox and process tickets as they arrive
//   e2e [agent]     ticket -> watcher pickup -> START -> AI run -> RESULT, timed
import fs from 'node:fs';
import path from 'node:path';
import { ElectrumNetworkProvider, TransactionBuilder } from '@passrate/shared/tickettx';
import { merkleRoot } from '@passrate/shared';
import { NETWORK, PATHS, loadState, saveState } from './config.js';
import { loadKeys } from './keys.js';
import { buildTasks, manifestPayload, harnessDigest, rosterHash, containerDigest } from './manifest.js';
import { buildTicket, buildManifest } from './txs.js';
import { processTicket, watch, getTip } from './pipeline.js';

const provider = new ElectrumNetworkProvider(NETWORK);
const { operator, payer } = loadKeys();
const [cmd = 'help', arg] = process.argv.slice(2);
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

function loadManifest() {
  const s = loadState();
  if (!s.manifest) throw new Error('no manifest yet: run `manifest` first');
  return s.manifest;
}
const biggest = async (addr) => (await provider.getUtxos(addr)).filter((u) => !u.token).sort((a, b) => Number(b.satoshis - a.satoshis))[0];

async function cmdManifest() {
  const tasks = buildTasks();
  const m = { taskRoot: merkleRoot(tasks.map((t) => t.leaf)), harnessDigest: harnessDigest(), rosterHash: rosterHash(), containerDigest: containerDigest(), tasks };
  const utxo = await biggest(operator.address);
  if (!utxo) throw new Error(`fund operator ${operator.address}`);
  const tx = await buildManifest({ provider, utxo, operator, payload: manifestPayload(tasks, { hDigest: m.harnessDigest, rHash: m.rosterHash }) }).send();
  m.txid = tx.txid; m.publishedAt = new Date().toISOString();
  const s = loadState(); s.manifest = m; saveState(s);
  fs.mkdirSync(PATHS.webPublic, { recursive: true });
  fs.writeFileSync(path.join(PATHS.webPublic, 'manifest.json'), JSON.stringify({ network: NETWORK, ...m }, null, 1));
  log(`MANIFEST ${tx.txid} root ${m.taskRoot} (${tasks.length} tasks)`);
}

async function cmdTicket(agentIdx = 1) {
  const m = loadManifest();
  // The test payer is funded from the operator wallet on first use.
  let fundUtxo = await biggest(payer.address);
  if (!fundUtxo || fundUtxo.satoshis < 30000n) {

    const src = await biggest(operator.address);
    const tx = await new TransactionBuilder({ provider }).addInput(src, operator.sig.unlockP2PKH())
      .addOutput({ to: payer.address, amount: 100000n }).addOutput({ to: operator.address, amount: src.satoshis - 100000n - 400n }).send();
    log(`funded test payer ${payer.address} (${tx.txid})`);
    fundUtxo = { txid: tx.txid, vout: 0, satoshis: 100000n };
  }
  const tip = await getTip(provider);
  const tx = await buildTicket({ provider, utxo: fundUtxo, payer, operatorPkHex: operator.pkHex, operatorInbox: operator.address,
    taskRoot: m.taskRoot, tipHeight: tip.height, tipHash: tip.hash, agentIdx: Number(agentIdx) }).send();
  log(`TICKET ${tx.txid} (tip ${tip.height})`);
  return tx.txid;
}

const ctx = () => ({ provider, operator, manifest: loadManifest(), log });

async function cmdE2E(agentIdx) {
  const t0 = Date.now();
  const txid = await cmdTicket(agentIdx);
  const run = await processTicket(txid, ctx());
  const report = { ...run, wallClockS: (Date.now() - t0) / 1000, network: NETWORK, manifestTxid: loadManifest().txid };
  console.log(JSON.stringify(report, null, 1));
}

try {
  if (cmd === 'manifest') await cmdManifest();
  else if (cmd === 'ticket') await cmdTicket(arg);
  else if (cmd === 'process') console.log(JSON.stringify(await processTicket(arg, ctx()), null, 1));
  else if (cmd === 'watch') await watch(ctx());
  else if (cmd === 'e2e') await cmdE2E(arg);
  else console.log('commands: manifest | ticket [agentIdx] | process <txid> | watch | e2e [agentIdx]');
} finally {
  if (cmd !== 'watch') await provider.disconnect?.().catch(() => {});
}
if (cmd !== 'watch') process.exit(0);
