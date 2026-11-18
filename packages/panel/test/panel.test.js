import { describe, test, expect, beforeEach } from 'vitest';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { encodePayload, toOpReturn } from '@passrate/shared';
import { roundsFromRecords, roundStatus, modelRecord, odds } from '../src/rounds.js';
import { renderPanel } from '../src/render.js';
import { fetchRecords } from '../src/feed.js';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin');
const H = (b) => b.repeat(32);
const S = (ref, agentIdx, deadlineUnix, taskIdx = 3) => ({ type: 'S', mode: 0, ref, refHeight: 1, taskRoot: H('ab'), taskIdx, agentIdx, modelIdx: agentIdx, lane: 0, harnessDigest: H('cd'), deadlineUnix, attemptPolicy: 2 });
const R = (startTxid, passed, total, exit = 0) => ({ type: 'R', startTxid, exit, passed, total, testOutHash: H('01'), transcriptHash: H('02'), solutionHash: H('03'), durationS: 5, costMilliUSD: 0 });
const NOW = 1_800_000_000;
const ESC = String.fromCharCode(27);

describe('rounds', () => {
  const recs = [
    { txid: H('a1'), height: 10, rec: S(H('11'), 1, NOW - 100) }, { txid: H('b1'), height: 10, rec: R(H('a1'), 5, 5) },
    { txid: H('a2'), height: 12, rec: S(H('12'), 1, NOW - 50) }, { txid: H('b2'), height: 12, rec: R(H('a2'), 3, 6) },
    { txid: H('a3'), height: 8, rec: S(H('13'), 0, NOW - 999) }, // no RESULT, deadline passed
    { txid: H('a4'), height: 0, rec: S(H('14'), 1, NOW + 300) }, // unconfirmed, live
  ];
  const rounds = roundsFromRecords(recs);
  test('pairs START with its RESULT, newest first (mempool first)', () => {
    expect(rounds.map((r) => r.startTxid)).toEqual([H('a4'), H('a2'), H('a1'), H('a3')]);
    expect(rounds[2].result).toMatchObject({ pass: true, passed: 5, total: 5, txid: H('b1') });
  });
  test('statuses: live, partial = fail, pass, missing = timeout', () => {
    expect(rounds.map((r) => roundStatus(r, NOW))).toEqual(['LIVE', 'FAIL', 'PASS', 'TIMEOUT']);
  });
  test('a live round past its deadline flips to TIMEOUT', () => expect(roundStatus(rounds[0], NOW + 301)).toBe('TIMEOUT'));
  test('nonzero exit with all tests passed is still a FAIL', () => {
    expect(roundsFromRecords([{ txid: H('c1'), rec: S(H('15'), 0, NOW) }, { txid: H('c2'), rec: R(H('c1'), 4, 4, 1) }])[0].result.pass).toBe(false);
  });
  test('model record excludes live rounds and counts timeouts as fails', () => {
    expect(modelRecord(rounds, 'gpt-oss-120b', NOW)).toEqual({ pass: 1, n: 2 });
    expect(modelRecord(rounds, 'gpt-oss-20b', NOW)).toEqual({ pass: 0, n: 1 });
  });
  test('RESULT without a known START and junk records are ignored', () => {
    expect(roundsFromRecords([{ txid: H('d1'), rec: R(H('ee'), 1, 1) }, { txid: H('d2'), rec: null }])).toEqual([]);
  });
  test('unknown agent index gets a readable label', () => {
    expect(roundsFromRecords([{ txid: H('e1'), rec: S(H('16'), 7, NOW) }])[0].model).toBe('agent 7');
  });
});

describe('odds', () => {
  test('no history is 50/50 = 2x both sides', () => expect(odds({ pass: 0, n: 0 })).toMatchObject({ pass: 2, fail: 2 }));
  test('strong record makes PASS cheap and FAIL expensive', () => {
    const o = odds({ pass: 9, n: 10 }); expect(o.pass).toBeLessThan(1.3); expect(o.fail).toBeGreaterThan(5);
  });
  test('payouts are capped at 20x', () => expect(odds({ pass: 1000, n: 1000 }).fail).toBe(20));
  test('implied probability uses the +1/+2 prior', () => expect(odds({ pass: 3, n: 7 }).pPass).toBeCloseTo(4 / 9));
});

describe('render', () => {
  const state = (rounds) => ({ rounds, slugs: ['a', 'b', 'c', 'perfect-numbers'], updatedUnix: NOW, network: 'chipnet' });
  const live = roundsFromRecords([{ txid: H('a1'), rec: S(H('11'), 1, NOW + 125) }]);
  const done = roundsFromRecords([{ txid: H('a1'), rec: S(H('11'), 1, NOW - 5) }, { txid: H('b1'), rec: R(H('a1'), 14, 14) }]);
  test('empty state tells you to start the feed', () => expect(renderPanel({ state: null, nowUnix: NOW, color: false })).toMatch(/run passrate-feed/));
  test('live round shows model, exercise, countdown and both odds', () => {
    expect(renderPanel({ state: state(live), nowUnix: NOW, color: false })).toBe('🎲 gpt-oss-120b vs "perfect-numbers" ● LIVE 2m05s left · PASS 2x | FAIL 2x [chipnet]');
  });
  test('settled round shows the verdict and score', () => {
    expect(renderPanel({ state: state(done), nowUnix: NOW, color: false })).toMatch(/✅ PASS 14\/14 · record 1\/1/);
  });
  test('timeout is labelled as a fail', () => {
    const t = roundsFromRecords([{ txid: H('a1'), rec: S(H('11'), 1, NOW - 1) }]);
    expect(renderPanel({ state: state(t), nowUnix: NOW, color: false })).toMatch(/TIMEOUT = FAIL/);
  });
  test('while Claude thinks a second line invites a bet', () => {
    const out = renderPanel({ state: state(live), thinking: { sinceUnix: NOW - 23 }, nowUnix: NOW, color: false });
    expect(out.split('\n')).toHaveLength(2); expect(out).toMatch(/Claude thinking 23s/);
  });
  test('stale feed is flagged, mainnet has no network tag', () => {
    const out = renderPanel({ state: { ...state(done), updatedUnix: NOW - 500, network: 'mainnet' }, nowUnix: NOW, color: false });
    expect(out).toMatch(/feed offline/); expect(out).not.toMatch(/\[mainnet\]/);
  });
  test('color off emits no ANSI escapes; color on does', () => {
    expect(renderPanel({ state: state(live), nowUnix: NOW, color: false }).includes(ESC)).toBe(false);
    expect(renderPanel({ state: state(live), nowUnix: NOW }).includes(ESC)).toBe(true);
  });
});

describe('feed (mock Electrum)', () => {
  const start = toOpReturn(encodePayload('S', S(H('11'), 1, NOW)));
  const hex = (b) => Buffer.from(b).toString('hex');
  // version 2, one dummy input, one zero-value output with the given script, locktime 0
  const fakeTx = (script) => '02000000' + '01' + '00'.repeat(32) + 'ffffffff' + '00' + 'ffffffff'
    + '01' + '0000000000000000' + hex([script.length]) + hex(script) + '00000000';
  test('decodes START records, skips non-records and caches raw txs', async () => {
    let calls = 0;
    const p = { performRequest: async () => [{ tx_hash: H('a1'), height: 5 }, { tx_hash: H('a2'), height: 6 }],
      getRawTransaction: async (t) => { calls++; return fakeTx(t === H('a1') ? start : new Uint8Array([0x51])); } };
    const cache = new Map();
    const recs = await fetchRecords(p, 'x', { cache });
    expect(recs).toHaveLength(1); expect(recs[0]).toMatchObject({ txid: H('a1'), height: 5 }); expect(recs[0].rec.type).toBe('S');
    await fetchRecords(p, 'x', { cache }); expect(calls).toBe(2);
  });
});

describe('CLI: hooks + status line', () => {
  let dir;
  const run = (bin, args = []) => execFileSync(process.execPath, [path.join(BIN, bin), ...args],
    { env: { ...process.env, PASSRATE_HOME: dir, NO_COLOR: '1' }, input: '{}' }).toString();
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prh-')); });
  test('status line works with no files at all', () => expect(run('statusline.mjs')).toMatch(/no rounds yet/));
  test('status line survives a corrupt cache file', () => {
    fs.writeFileSync(path.join(dir, 'round.json'), '{not json'); expect(run('statusline.mjs')).toMatch(/no rounds yet/);
  });
  test('prompt hook adds the thinking line; stop hook removes it', () => {
    const now = Math.floor(Date.now() / 1000);
    fs.writeFileSync(path.join(dir, 'round.json'), JSON.stringify({ rounds: roundsFromRecords([{ txid: H('a1'), rec: S(H('11'), 1, now + 60) }]), slugs: [], updatedUnix: now, network: 'chipnet' }));
    run('hook.mjs', ['prompt']); expect(run('statusline.mjs')).toMatch(/Claude thinking/);
    run('hook.mjs', ['stop']); expect(run('statusline.mjs')).not.toMatch(/Claude thinking/);
  });
  test('stop hook with nothing to remove still exits 0', () => expect(() => run('hook.mjs', ['stop'])).not.toThrow());
});
