import { describe, test, expect } from 'vitest';
import { decodeRecord } from '../src/duel/Proof.jsx';
import { recordBytes, betRecordBytes } from '../../server/engine.mjs';
import { pfRecordBytes } from '../../server/promptfight.mjs';

// Wrap a record like the house wallet does: OP_RETURN <push> <bytes>, inside some surrounding tx hex.
const inTx = (buf) => `0200000001${'ab'.repeat(36)}00ffffffff02000000000000000040${'6a'}${buf.length.toString(16).padStart(2, '0')}${buf.toString('hex')}00000000`;

describe('browser decoder matches what the server writes on chain', () => {
  test('duel (SDL1)', () => {
    const r = { id: '0f'.repeat(16), result: 2, stake: 5000, moveA: 'rock', moveB: 'paper', commit: 'aa'.repeat(32) };
    expect(decodeRecord(inTx(recordBytes(r)))).toEqual({ kind: 'SDL1', ...r });
  });
  test('duel without reveal decodes moveA as null', () => {
    expect(decodeRecord(inTx(recordBytes({ id: '0f'.repeat(16), result: 2, stake: 2500, moveA: null, moveB: 'rock', commit: 'bb'.repeat(32) }))).moveA).toBeNull();
  });
  test('up/down bet (SUD1)', () => {
    const r = { id: 'ab'.repeat(16), side: 'down', result: 'up', stake: 25000, roundStart: 1795259760, open: 194.7, close: 194.95 };
    expect(decodeRecord(inTx(betRecordBytes(r)))).toEqual({ kind: 'SUD1', ...r });
  });
  test('prompt fight (SPF1)', () => {
    const d = decodeRecord(inTx(pfRecordBytes({ id: 'cd'.repeat(16), winner: 'b', target: 19, maxStep: 3, stake: 10000, turns: [{ side: 'a', add: 2 }] })));
    expect(d).toMatchObject({ kind: 'SPF1', id: 'cd'.repeat(16), winner: 'b', target: 19, maxStep: 3, stake: 10000 });
    expect(d.turnsHash).toMatch(/^[0-9a-f]{64}$/);
  });
  test('transactions without a PassBCH record decode to null', () => {
    expect(decodeRecord('0200000001' + 'ff'.repeat(60))).toBeNull();
  });
});
