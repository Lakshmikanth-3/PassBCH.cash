import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MockNetworkProvider, randomUtxo } from 'cashscript';
import { binToHex, hashTransaction, hexToBin, decodeTransaction } from '@bitauth/libauth';
import { drawTicketTask, fromOpReturn, merkleRoot, merkleProof, verifyMerkleProof, hexToBytes } from '@passrate/shared';
import { keyPair } from '../src/keys.js';
import { buildTicket, validateTicket, buildStart, buildResult, buildManifest } from '../src/txs.js';
import { buildTasks, manifestPayload } from '../src/manifest.js';
import { TICKET_SCRIPT_PREFIX } from '../src/pipeline.js';
import { TICKET_SATS, NOTIFY_SATS } from '../src/config.js';

const rndKey = () => binToHex(crypto.getRandomValues(new Uint8Array(32)));
const operator = keyPair(rndKey()), payer = keyPair(rndKey()), stranger = keyPair(rndKey());
const ROOT = 'ab'.repeat(32), TIP = '00'.repeat(4) + 'cd'.repeat(28), H = 'ef'.repeat(32);

function makeTicket({ agentIdx = 1, tipHeight = 1000, opPk = operator.pkHex } = {}) {
  const provider = new MockNetworkProvider();
  const utxo = randomUtxo({ satoshis: 100000n });
  const b = buildTicket({ provider, utxo, payer, operatorPkHex: opPk, operatorInbox: operator.address, taskRoot: ROOT, tipHeight, tipHash: TIP, agentIdx });
  const hex = b.build();
  return { provider, hex, txid: hashTransaction(hexToBin(hex)) };
}
const v = (t, over = {}) => validateTicket(t.hex, { operatorPkHex: operator.pkHex, taskRoot: ROOT, seenAtHeight: 1000, taskCount: 141, txid: t.txid, ...over });

describe('ticket', () => {
  test('layout: OP_RETURN T, covenant 20,000, notify 546, change', () => {
    const tx = decodeTransaction(hexToBin(makeTicket().hex));
    assert.equal(tx.outputs.length, 4);
    assert.equal(fromOpReturn(tx.outputs[0].lockingBytecode).type, 'T');
    assert.equal(tx.outputs[1].valueSatoshis, TICKET_SATS);
    assert.equal(tx.outputs[2].valueSatoshis, NOTIFY_SATS);
  });
  test('watcher prefix matches a real ticket', () => assert.ok(makeTicket().hex.includes(TICKET_SCRIPT_PREFIX)));
  test('valid ticket is accepted and the draw matches shared code', () => {
    const t = makeTicket(), r = v(t);
    assert.ok(r.ok, r.reason);
    assert.equal(r.ticket.taskIdx, drawTicketTask(t.txid, TIP, 141));
    assert.equal(r.ticket.row.model, 'openai/gpt-oss-120b');
    assert.equal(r.ticket.payerPk, payer.pkHex);
  });
  test('rejects a covenant built for another operator', () => {
    const r = v(makeTicket({ opPk: stranger.pkHex }));
    assert.equal(r.ok, false); assert.match(r.reason, /covenant/);
  });
  test('rejects an unknown agent row', () => assert.match(v(makeTicket({ agentIdx: 9 })).reason, /agentIdx/));
  test('rejects a stale or future tip', () => {
    assert.match(v(makeTicket({ tipHeight: 990 })).reason, /stale/);
    assert.match(v(makeTicket({ tipHeight: 1005 })).reason, /stale/);
    assert.ok(v(makeTicket({ tipHeight: 998 })).ok);
  });
  test('rejects a non-ticket transaction', () => {
    const provider = new MockNetworkProvider();
    const hex = buildManifest({ provider, utxo: randomUtxo({ satoshis: 10000n }), operator, payload: manifestPayload([{ leaf: H }], { hDigest: H, rHash: H }) }).build();
    assert.match(validateTicket(hex, { operatorPkHex: operator.pkHex, taskRoot: ROOT, seenAtHeight: 1, taskCount: 1, txid: '00'.repeat(32) }).reason, /record type M/);
  });
  test('rejects garbage', () => assert.equal(v({ hex: 'deadbeef', txid: H }).ok, false));
});

describe('START / RESULT chain', () => {
  const ticketCtx = () => { const t = makeTicket(); return { t, ticket: v(t).ticket }; };
  test('START satisfies the covenant (VM-evaluated)', () => {
    const { t, ticket } = ticketCtx();
    const b = buildStart({ provider: t.provider, ticket, operator, taskRoot: ROOT, harnessDigest: H, refHeight: 1000 });
    assert.doesNotThrow(() => b.debug());
  });
  test('START names the ticket and commits the drawn task', () => {
    const { t, ticket } = ticketCtx();
    const tx = decodeTransaction(hexToBin(buildStart({ provider: t.provider, ticket, operator, taskRoot: ROOT, harnessDigest: H, refHeight: 1000 }).build()));
    const s = fromOpReturn(tx.outputs[0].lockingBytecode);
    assert.equal(s.ref, t.txid); assert.equal(s.taskIdx, ticket.taskIdx); assert.equal(s.taskRoot, ROOT);
    assert.equal(s.modelIdx, 1); assert.equal(s.attemptPolicy, 2);
  });
  test('a non-operator key cannot START', () => {
    const { t, ticket } = ticketCtx();
    assert.throws(() => buildStart({ provider: t.provider, ticket, operator: { ...stranger, pkHex: operator.pkHex }, taskRoot: ROOT, harnessDigest: H, refHeight: 1000 }).debug());
  });
  test('RESULT spends START output 1 and records the outcome', () => {
    const { t, ticket } = ticketCtx();
    const startHex = buildStart({ provider: t.provider, ticket, operator, taskRoot: ROOT, harnessDigest: H, refHeight: 1000 }).build();
    const startTxid = hashTransaction(hexToBin(startHex));
    const b = buildResult({ provider: t.provider, startTxid, startValue: 19300n, operator,
      result: { pass: false, passed: 3, total: 31, testOutHash: H, transcriptHash: H, solutionHash: H, durationS: 54.6 } });
    assert.doesNotThrow(() => b.debug());
    const tx = decodeTransaction(hexToBin(b.build()));
    assert.equal(binToHex(tx.inputs[0].outpointTransactionHash), startTxid);
    assert.equal(tx.inputs[0].outpointIndex, 1);
    const r = fromOpReturn(tx.outputs[0].lockingBytecode);
    assert.deepEqual([r.type, r.exit, r.passed, r.total, r.durationS], ['R', 1, 3, 31, 55]);
  });
});

describe('manifest', () => {
  const tasks = buildTasks({ digest: 'aa'.repeat(32) });
  test('141 tasks from the Docker-verified T3 set', () => assert.equal(tasks.length, 141));
  test('root is reproducible', () => assert.equal(merkleRoot(tasks.map((t) => t.leaf)), merkleRoot(buildTasks({ digest: 'aa'.repeat(32) }).map((t) => t.leaf))));
  test('container digest is committed in every leaf', () => assert.notEqual(merkleRoot(tasks.map((t) => t.leaf)), merkleRoot(buildTasks({ digest: 'bb'.repeat(32) }).map((t) => t.leaf))));
  test('every task has a valid inclusion proof', () => {
    const leaves = tasks.map((t) => hexToBytes(t.leaf)), root = merkleRoot(leaves);
    for (const i of [0, 37, 140]) assert.ok(verifyMerkleProof(leaves[i], i, merkleProof(leaves, i), root, leaves.length));
  });
  test('MANIFEST payload commits count and root', () => {
    const p = manifestPayload(tasks, { hDigest: H, rHash: H, day: 20409 });
    const provider = new MockNetworkProvider();
    const tx = decodeTransaction(hexToBin(buildManifest({ provider, utxo: randomUtxo({ satoshis: 10000n }), operator, payload: p }).build()));
    const m = fromOpReturn(tx.outputs[0].lockingBytecode);
    assert.equal(m.taskCount, 141); assert.equal(m.taskRoot, merkleRoot(tasks.map((t) => t.leaf)));
  });
});

