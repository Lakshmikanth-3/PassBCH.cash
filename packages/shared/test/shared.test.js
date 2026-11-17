import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/index.js';

const GENESIS = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f'; // real block 0 hash
const H = (c) => c.repeat(64);
const PK = '02' + '11'.repeat(32);

describe('bytes', () => {
  test('sha256 NIST vector "abc"', () => {
    assert.equal(S.bytesToHex(S.sha256(S.utf8('abc'))),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  test('hex round trip', () => assert.equal(S.bytesToHex(S.hexToBytes(GENESIS)), GENESIS));
  test('rejects bad hex', () => {
    assert.throws(() => S.hexToBytes('abc'));
    assert.throws(() => S.hexToBytes('zz'));
  });
  test('uintLE little-endian + range', () => {
    assert.deepEqual([...S.uintLE(0x01020304, 4)], [4, 3, 2, 1]);
    assert.throws(() => S.uintLE(256, 1));
    assert.throws(() => S.uintLE(-1, 2));
    assert.equal(S.readUintLE(S.uintLE(4294967295, 4), 0, 4), 4294967295);
  });
  test('bytes32 enforces size', () => assert.throws(() => S.bytes32('00')));
});

const samples = {
  M: { day: 20409, lane: 0, taskCount: 120, taskRoot: H('a'), harnessDigest: H('b'), rosterHash: H('c'), ruleVersion: 1 },
  T: { tipHeight: 925000, tipHash: GENESIS, agentIdx: 1, payerPk: PK },
  S: { mode: 0, ref: H('d'), refHeight: 925000, taskRoot: H('a'), taskIdx: 37, agentIdx: 1, modelIdx: 0, lane: 0,
       harnessDigest: H('b'), deadlineUnix: 1795000000, attemptPolicy: 2 },
  R: { startTxid: H('e'), exit: 0, passed: 9, total: 9, testOutHash: H('1'), transcriptHash: H('2'),
       solutionHash: H('3'), durationS: 61, costMilliUSD: 12 },
};

describe('payloads', () => {
  for (const [t, f] of Object.entries(samples)) {
    test(`${t} round trip via OP_RETURN`, () => {
      const script = S.toOpReturn(S.encodePayload(t, f));
      const d = S.fromOpReturn(script);
      assert.equal(d.type, t);
      for (const k of Object.keys(f)) assert.equal(String(d[k]), String(f[k]), k);
    });
    test(`${t} fits standard OP_RETURN (≤223 B)`, () => {
      assert.ok(S.toOpReturn(S.encodePayload(t, f)).length <= S.MAX_OP_RETURN);
    });
  }
  test('sizes are as documented', () => {
    assert.deepEqual(['M', 'T', 'S', 'R'].map(S.payloadSize), [109, 75, 116, 144]);
  });
  test('payload starts with PR2 + version + type (covenant prefix)', () => {
    const p = S.encodePayload('S', samples.S);
    assert.equal(new TextDecoder().decode(p.slice(0, 3)), 'PR2');
    assert.equal(p[3], 1); assert.equal(String.fromCharCode(p[4]), 'S');
  });
  test('rejects missing field', () => assert.throws(() => S.encodePayload('T', { ...samples.T, agentIdx: undefined })));
  test('rejects uncompressed / bad pubkey', () => assert.throws(() => S.encodePayload('T', { ...samples.T, payerPk: '04' + '11'.repeat(32) })));
  test('rejects passed > total', () => assert.throws(() => S.encodePayload('R', { ...samples.R, passed: 10 })));
  test('rejects bad lane / mode / zero tasks', () => {
    assert.throws(() => S.encodePayload('S', { ...samples.S, lane: 7 }));
    assert.throws(() => S.encodePayload('S', { ...samples.S, mode: 9 }));
    assert.throws(() => S.encodePayload('M', { ...samples.M, taskCount: 0 }));
  });
  test('rejects overflow (taskIdx > uint16)', () => assert.throws(() => S.encodePayload('S', { ...samples.S, taskIdx: 70000 })));
  test('decode rejects bad magic, version, type, length', () => {
    const p = S.encodePayload('T', samples.T);
    const mut = (i, v) => { const c = p.slice(); c[i] = v; return c; };
    assert.throws(() => S.decodePayload(mut(0, 0x58)), /magic/);
    assert.throws(() => S.decodePayload(mut(3, 2)), /version/);
    assert.throws(() => S.decodePayload(mut(4, 0x5a)), /type/);
    assert.throws(() => S.decodePayload(p.slice(0, -1)), /length/);
  });
  test('fromOpReturn rejects non-OP_RETURN and trailing bytes', () => {
    const s = S.toOpReturn(S.encodePayload('T', samples.T));
    assert.throws(() => S.fromOpReturn(S.concat(new Uint8Array([0x51]), s.slice(1))));
    assert.throws(() => S.fromOpReturn(S.concat(s, new Uint8Array([0]))));
  });
  test('short payload uses direct push, long uses PUSHDATA1', () => {
    assert.equal(S.toOpReturn(S.encodePayload('T', samples.T))[1], 75);
    assert.equal(S.toOpReturn(S.encodePayload('R', samples.R))[1], 0x4c);
  });
});

describe('draw', () => {
  test('deterministic and in range', () => {
    const a = S.drawTicketTask(H('d'), GENESIS, 120);
    assert.equal(a, S.drawTicketTask(H('d'), GENESIS, 120));
    assert.ok(a >= 0 && a < 120);
  });
  test('seed is order-sensitive (txid ‖ tip)', () => {
    assert.notEqual(S.bytesToHex(S.ticketSeed(H('d'), GENESIS)), S.bytesToHex(S.ticketSeed(GENESIS, H('d'))));
  });
  test('golden vector: seed = sha256(txid‖tip)', () => {
    const seed = S.ticketSeed(H('0'), H('0'));
    assert.equal(S.bytesToHex(seed), S.bytesToHex(S.sha256(new Uint8Array(64))));
    assert.equal(S.bytesToHex(seed), 'f5a5fd42d16a20302798ef6ed309979b43003d2320d9f0e8ea9831a92759fb4b');
  });
  test('scheduled seed differs from ticket seed for same hash', () => {
    assert.notEqual(S.drawScheduledTask(GENESIS, 65535), S.seedToIndex(S.sha256(S.hexToBytes(GENESIS)), 65535));
  });
  test('roughly uniform over 12,000 draws into 120 buckets (chi-square)', () => {
    const n = 120, N = 12000, counts = new Array(n).fill(0);
    for (let i = 0; i < N; i++) counts[S.drawTicketTask(S.bytesToHex(S.sha256(S.uintLE(i, 4))), GENESIS, n)]++;
    const e = N / n, chi = counts.reduce((s, c) => s + (c - e) ** 2 / e, 0);
    assert.ok(chi < 170, `chi2=${chi.toFixed(1)} (df=119, p≈0.001 cutoff ≈ 170)`);
  });
  test('rejects bad task count', () => {
    assert.throws(() => S.seedToIndex(H('1'), 0));
    assert.throws(() => S.seedToIndex(H('1'), 70000));
  });
  test('scheduled height rule', () => {
    assert.ok(S.isScheduledHeight(925002, 2));
    assert.ok(!S.isScheduledHeight(925001, 2));
  });
  test('tip freshness', () => {
    assert.ok(S.isTipFresh(100, 100));
    assert.ok(S.isTipFresh(98, 100));
    assert.ok(!S.isTipFresh(97, 100));
    assert.ok(!S.isTipFresh(101, 100));
  });
});

describe('merkle', () => {
  const task = (i) => ({ slug: `ex-${i}`, instructionsHash: H('1'), stubHash: H('2'), testsHash: H('3'), containerDigest: H('4') });
  const leaves = (n) => Array.from({ length: n }, (_, i) => S.taskLeaf(task(i)));

  test('single leaf root is the leaf', () => {
    const l = leaves(1); assert.equal(S.merkleRoot(l), S.bytesToHex(l[0]));
  });
  test('two-leaf root = H(0x01‖l0‖l1)', () => {
    const l = leaves(2);
    assert.equal(S.merkleRoot(l), S.bytesToHex(S.sha256(S.concat(new Uint8Array([1]), l[0], l[1]))));
  });
  for (const n of [1, 2, 3, 5, 7, 8, 13, 120]) {
    test(`every proof verifies, n=${n}`, () => {
      const l = leaves(n), root = S.merkleRoot(l);
      for (let i = 0; i < n; i++) assert.ok(S.verifyMerkleProof(l[i], i, S.merkleProof(l, i), root, n), `i=${i}`);
    });
  }
  test('proof fails for wrong leaf, wrong index, wrong root, tampered proof', () => {
    const l = leaves(13), root = S.merkleRoot(l), p = S.merkleProof(l, 5);
    assert.ok(!S.verifyMerkleProof(l[6], 5, p, root, 13));
    assert.ok(!S.verifyMerkleProof(l[5], 4, p, root, 13));
    assert.ok(!S.verifyMerkleProof(l[5], 5, p, H('f'), 13));
    assert.ok(!S.verifyMerkleProof(l[5], 5, [{ ...p[0], hash: H('0') }, ...p.slice(1)], root, 13));
    assert.ok(!S.verifyMerkleProof(l[5], 5, p.slice(1), root, 13));
  });
  test('no duplicate-last-leaf ambiguity: [a,b,c] ≠ [a,b,c,c]', () => {
    const l = leaves(3);
    assert.notEqual(S.merkleRoot(l), S.merkleRoot([...l, l[2]]));
  });
  test('leaf changes when any component changes', () => {
    const base = S.bytesToHex(S.taskLeaf(task(0)));
    assert.notEqual(base, S.bytesToHex(S.taskLeaf({ ...task(0), testsHash: H('9') })));
    assert.notEqual(base, S.bytesToHex(S.taskLeaf({ ...task(0), slug: 'ex-00' })));
  });
  test('rejects empty tree and bad slug', () => {
    assert.throws(() => S.merkleRoot([]));
    assert.throws(() => S.taskLeaf({ ...task(0), slug: '' }));
  });
});

describe('stats', () => {
  test('wilson 8/10 matches reference (0.4902, 0.9433)', () => {
    const { low, high } = S.wilson(8, 10);
    assert.ok(Math.abs(low - 0.4902) < 1e-4 && Math.abs(high - 0.9433) < 1e-4);
  });
  test('wilson edge cases', () => {
    assert.deepEqual(S.wilson(0, 0), { low: 0, high: 1 });
    assert.equal(S.wilson(0, 10).low, 0);
    assert.ok(S.wilson(10, 10).high <= 1);
    assert.throws(() => S.wilson(11, 10));
  });
  const start = { deadlineUnix: 1000 };
  test('runStatus covers every outcome', () => {
    assert.equal(S.runStatus({ refunded: true }), 'REFUNDED_NO_SHOW');
    assert.equal(S.runStatus({ mode: 'scheduled', scheduledHeight: 10, tipHeight: 12 }), 'FAIL_NO_SHOW');
    assert.equal(S.runStatus({ mode: 'scheduled', scheduledHeight: 10, tipHeight: 11 }), 'PENDING');
    assert.equal(S.runStatus({ mode: 'ticket', tipHeight: 99 }), 'PENDING');
    assert.equal(S.runStatus({ start, nowUnix: 1001 }), 'FAIL_TIMEOUT');
    assert.equal(S.runStatus({ start, nowUnix: 999 }), 'PENDING');
    assert.equal(S.runStatus({ start, result: { timeUnix: 900, exit: 0, passed: 5, total: 5 } }), 'PASS');
    assert.equal(S.runStatus({ start, result: { timeUnix: 900, exit: 0, passed: 4, total: 5 } }), 'FAIL');
    assert.equal(S.runStatus({ start, result: { timeUnix: 900, exit: 1, passed: 5, total: 5 } }), 'FAIL');
    assert.equal(S.runStatus({ start, result: { timeUnix: 900, exit: 0, passed: 0, total: 0 } }), 'FAIL');
    assert.equal(S.runStatus({ start, result: { timeUnix: 1001, exit: 0, passed: 5, total: 5 } }), 'FAIL_TIMEOUT');
  });
  test('leaderboardRow counts missing as FAIL and excludes pending', () => {
    const r = S.leaderboardRow(['PASS', 'PASS', 'FAIL', 'FAIL_TIMEOUT', 'FAIL_NO_SHOW', 'PENDING', 'REFUNDED_NO_SHOW'], [3, 9, 5, 7]);
    assert.equal(r.n, 5); assert.equal(r.passes, 2); assert.equal(r.passRate, 0.4);
    assert.equal(r.missing, 1); assert.equal(r.noShow, 2); assert.equal(r.medianStartLatencyS, 6);
  });
  test('empty row', () => assert.equal(S.leaderboardRow([]).passRate, null));
});
