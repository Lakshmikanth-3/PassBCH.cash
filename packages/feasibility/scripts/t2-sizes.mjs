// T2: build the 4 tx types (mock UTXOs, real signing) and report byte size, fee at 1 sat/B, standardness.
import { compileFile } from 'cashc';
import { Contract, MockNetworkProvider, SignatureTemplate, TransactionBuilder, randomUtxo } from 'cashscript';
import { secp256k1, binToHex, hash160, encodeCashAddress, CashAddressType } from '@bitauth/libauth';
import { encodePayload, toOpReturn, MAX_OP_RETURN } from '@passrate/shared';

const rnd = () => new Uint8Array(32).map(() => Math.floor(Math.random() * 255) + 1);
const op = { sk: rnd() }; op.pk = secp256k1.derivePublicKeyCompressed(op.sk);
const payer = { sk: rnd() }; payer.pk = secp256k1.derivePublicKeyCompressed(payer.sk);
const art = compileFile('contracts/RunTicket.cash');
const provider = new MockNetworkProvider();
const H = (c) => c.repeat(32);
const root = H('ab');
const c = new Contract(art, [binToHex(op.pk), binToHex(payer.pk), root], { provider });
const p2pkh = encodeCashAddress({ prefix: 'bchtest', type: CashAddressType.p2pkh, payload: hash160(op.pk) }).address;
const sig = new SignatureTemplate(op.sk);
const rows = [];
const report = (name, b, extra = '') => { const hex = b.build(); const size = hex.length / 2; rows.push({ tx: name, bytes: size, feeSats1perB: size, ok: size < 600 }); };

// wallet input unlocker: P2PKH owned by operator key
const wUtxo = () => { const u = randomUtxo({ satoshis: 100000n }); provider.addUtxo(p2pkh, u); return u; };
const wUnlock = () => sig.unlockP2PKH();
const opret = (type, f) => ({ to: toOpReturn(encodePayload(type, f)), amount: 0n });

const mk = () => new TransactionBuilder({ provider });
report('MANIFEST', mk().addInput(wUtxo(), wUnlock())
  .addOutput(opret('M', { day: 1, lane: 0, taskCount: 120, taskRoot: root, harnessDigest: H('cd'), rosterHash: H('ef'), ruleVersion: 1 }))
  .addOutput({ to: p2pkh, amount: 99000n }));
report('TICKET', mk().addInput(wUtxo(), wUnlock())
  .addOutput(opret('T', { tipHeight: 977729, tipHash: H('12'), agentIdx: 0, payerPk: binToHex(payer.pk) }))
  .addOutput({ to: c.address, amount: 20000n }).addOutput({ to: p2pkh, amount: 78000n }));
const tu = randomUtxo({ satoshis: 20000n }); provider.addUtxo(c.address, tu);
report('START (spends covenant)', mk().addInput(tu, c.unlock.start(sig))
  .addOutput(opret('S', { mode: 0, ref: tu.txid, refHeight: 977729, taskRoot: root, taskIdx: 5, agentIdx: 0, modelIdx: 0, lane: 0, harnessDigest: H('cd'), deadlineUnix: 1800000000, attemptPolicy: 0 }))
  .addOutput({ to: p2pkh, amount: 19000n }));
report('RESULT', mk().addInput(wUtxo(), wUnlock())
  .addOutput(opret('R', { startTxid: H('34'), exit: 0, passed: 8, total: 8, testOutHash: H('56'), transcriptHash: H('78'), solutionHash: H('9a'), durationS: 45, costMilliUSD: 12 }))
  .addOutput({ to: p2pkh, amount: 99000n }));
const tr = randomUtxo({ satoshis: 20000n }); provider.addUtxo(c.address, tr);
report('REFUND (spends covenant)', mk().addInput(tr, c.unlock.refund(new SignatureTemplate(payer.sk)), { sequence: 6 })
  .addOutput({ to: p2pkh, amount: 19000n }));

console.table(rows);
console.log('max OP_RETURN script', MAX_OP_RETURN, '(limit); redeem script', c.bytecode.length / 2, 'B');
console.log('All < 600 sats and standard:', rows.every((r) => r.ok));
