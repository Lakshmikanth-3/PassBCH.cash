import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileFile } from 'cashc';
import { Contract, MockNetworkProvider, SignatureTemplate, TransactionBuilder, randomUtxo } from 'cashscript';
import { secp256k1, hexToBin, binToHex, encodeLockingBytecodeP2sh32, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { encodePayload, payloadSize } from '@passrate/shared';
import { toOpReturn as encodeOpReturn } from '@passrate/shared';

const art = compileFile(fileURLToPath(new URL('../contracts/RunTicket.cash', import.meta.url)));
const mk = () => { const sk = new Uint8Array(32).map(() => Math.floor(Math.random() * 255) + 1); return { sk, pk: secp256k1.derivePublicKeyCompressed(sk) }; };
const op = mk(), payer = mk();
const taskRoot = 'ab'.repeat(32);

function setup() {
  const provider = new MockNetworkProvider();
  const c = new Contract(art, [binToHex(op.pk), binToHex(payer.pk), taskRoot], { provider });
  const utxo = randomUtxo({ satoshis: 20000n });
  provider.addUtxo(c.address, utxo);
  return { provider, c, utxo };
}
const displayTxid = (utxo) => utxo.txid; // cashscript txid is display order
const startScript = (ref, root = taskRoot, over = {}) => encodeOpReturn(encodePayload('S', {
  mode: 0, ref, refHeight: 900000, taskRoot: root, taskIdx: 3, agentIdx: 0, modelIdx: 0, lane: 0,
  harnessDigest: 'cd'.repeat(32), deadlineUnix: 1800000000, attemptPolicy: 0, ...over }));


const OPDATA = (ref, root, over) => startScript(ref, root, over);
function startTx({ provider, c, utxo }, script, { sig = op.sk, outIdx0 = true } = {}) {
  const b = new TransactionBuilder({ provider }).addInput(utxo, c.unlock.start(new SignatureTemplate(sig)));
  const opret = { to: script, amount: 0n };
  const pay = { to: c.address, amount: 19000n };
  b.addOutputs(outIdx0 ? [opret, pay] : [pay, opret]);
  return b;
}
const ok = (b) => assert.doesNotThrow(() => b.debug());
const bad = (b, re) => assert.throws(() => b.debug(), re);

test('redeem script size is small', () => {
  const { c } = setup();
  console.log('redeem script bytes:', c.bytecode.length / 2, 'address', c.address);
  assert.ok(c.bytecode.length / 2 < 250);
});

test('start: correct START passes', () => {
  const s = setup();
  ok(startTx(s, OPDATA(displayTxid(s.utxo))));
});
test('start: wrong ticket txid fails', () => {
  const s = setup();
  bad(startTx(s, OPDATA('11'.repeat(32))), /ticketTxid\.reverse|slice\(9, 41\)/);
});
test('start: internal-order txid (not reversed) fails', () => {
  const s = setup();
  const rev = binToHex(hexToBin(displayTxid(s.utxo)).reverse());
  bad(startTx(s, OPDATA(rev)), /slice\(9, 41\)/);
});
test('start: wrong taskRoot fails', () => {
  const s = setup();
  bad(startTx(s, OPDATA(displayTxid(s.utxo), 'cd'.repeat(32))), /slice\(45, 77\)/);
});
test('start: mode=1 (scheduled) rejected', () => {
  const s = setup();
  bad(startTx(s, OPDATA(displayTxid(s.utxo), taskRoot, { mode: 1 })), /slice\(0, 9\)/);
});
test('start: START not at output 0 fails', () => {
  const s = setup();
  bad(startTx(s, OPDATA(displayTxid(s.utxo)), { outIdx0: false }), /require/);
});
test('start: wrong operator signature fails', () => {
  const s = setup();
  bad(startTx(s, OPDATA(displayTxid(s.utxo)), { sig: payer.sk }), /checkSig/);
});
test('start: operator cannot just take the money (no OP_RETURN)', () => {
  const s = setup();
  const b = new TransactionBuilder({ provider: s.provider })
    .addInput(s.utxo, s.c.unlock.start(new SignatureTemplate(op.sk)))
    .addOutput({ to: s.c.address, amount: 19000n });
  bad(b);
});
test('refund: before 6 blocks fails, at 6 passes, wrong key fails', () => {
  const s = setup();
  const mkRefund = (seq, sk) => new TransactionBuilder({ provider: s.provider })
    .addInput(s.utxo, s.c.unlock.refund(new SignatureTemplate(sk)), { sequence: seq })
    .addOutput({ to: s.c.address, amount: 19000n });
  bad(mkRefund(5, payer.sk));
  ok(mkRefund(6, payer.sk));
  bad(mkRefund(6, op.sk));
});
