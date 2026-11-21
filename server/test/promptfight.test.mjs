import { describe, test, expect } from 'vitest';
import * as P from '../promptfight.mjs';

describe('prompt fight rules', () => {
  test('setup is drawn from the match id, within range', () => {
    expect(P.drawSetup('ab'.repeat(16))).toEqual(P.drawSetup('ab'.repeat(16)));
    for (let i = 0; i < 200; i++) {
      const s = P.drawSetup(i.toString(16).padStart(32, '0'));
      expect(s.target).toBeGreaterThanOrEqual(15); expect(s.target).toBeLessThanOrEqual(24);
      expect(s.maxStep).toBeGreaterThanOrEqual(2); expect(s.maxStep).toBeLessThanOrEqual(4);
      expect(['a', 'b']).toContain(s.first);
    }
  });
  test('legal moves never overshoot the target', () => {
    expect(P.legalMoves(0, { target: 20, maxStep: 3 })).toEqual([1, 2, 3]);
    expect(P.legalMoves(19, { target: 20, maxStep: 3 })).toEqual([1]);
  });
  test('parses the first legal number, ignores illegal ones', () => {
    expect(P.parseMove('I will add 3', [1, 2, 3])).toBe(3);
    expect(P.parseMove('7 is too much, so 2', [1, 2, 3])).toBe(2);
    expect(P.parseMove('no idea', [1, 2])).toBeNull();
  });
  test('prompts are trimmed and limited', () => {
    expect(() => P.cleanPrompt('hi')).toThrow();
    expect(P.cleanPrompt('  always   aim for multiples  ')).toBe('always aim for multiples');
    expect(P.cleanPrompt('x'.repeat(900))).toHaveLength(P.PF.promptMax);
  });
  test('each agent only ever sees its own prompt', () => {
    const m = P.messagesFor('SECRET-A', { target: 20, maxStep: 3 }, 5, [{ side: 'b', add: 2 }], 'a');
    const all = JSON.stringify(m);
    expect(all).toContain('SECRET-A'); expect(all).not.toContain('SECRET-B');
  });
  test('a strategic prompt beats a random one (fake model that follows the prompt)', async () => {
    // fake model: if its prompt says "optimal", it plays the winning remainder; otherwise always +1
    const ask = async (msgs) => {
      const sys = msgs[0].content; const total = Number(msgs[1].content.match(/Total is (\d+)/)[1]);
      const target = Number(sys.match(/Race to (\d+)/)[1]); const k = Number(sys.match(/from 1 to (\d+)/)[1]);
      if (sys.includes('optimal')) { const r = (target - total) % (k + 1); return String(r || 1); }
      return '1';
    };
    let wins = 0;
    for (let i = 0; i < 30; i++) { const r = await P.playMatch({ id: i.toString(16).padStart(32, '0'), promptA: 'play optimal', promptB: 'just add one', ask }); if (r.winner === 'a') wins++; }
    expect(wins).toBeGreaterThan(20);
  });
  test('a broken model still finishes the match (auto moves are marked)', async () => {
    const r = await P.playMatch({ id: 'cd'.repeat(16), promptA: 'aaaaa', promptB: 'bbbbb', ask: async () => { throw new Error('down'); } });
    expect(r.turns.at(-1).total).toBe(r.target); expect(r.turns.every((t) => t.auto)).toBe(true);
  });
  test('on-chain record is 59 bytes', () => {
    expect(P.pfRecordBytes({ id: 'ab'.repeat(16), winner: 'a', target: 20, maxStep: 3, stake: 5000, turns: [{ side: 'a', add: 3 }] }).length).toBe(59);
  });

  test('parses a JSON reply and ignores illegal numbers inside it', () => {
    expect(P.parseMove('{"add": 2}', [1, 2, 3])).toBe(2);
    expect(P.parseMove('{"add": 9} then 1', [1, 2, 3])).toBe(1);
    expect(P.parseMove('{"add": 3} extra', [1, 2, 3])).toBe(3);
  });
  test('an invalid reply is retried once before an automatic move is used', async () => {
    let calls = 0;
    const ask = async () => { calls++; return calls % 2 === 1 ? 'no idea' : '{"add": 1}'; };
    const r = await P.playMatch({ id: 'cd'.repeat(16), promptA: 'x', promptB: 'y', ask });
    expect(r.turns.every((t) => !t.auto)).toBe(true); // every first reply was invalid, every retry valid
    expect(calls).toBe(r.turns.length * 2);
  });
  test('first mover comes from a committed seed: the commitment matches and the flip is reproducible', async () => {
    const seed = 'ab'.repeat(16), id = 'ef'.repeat(16);
    expect(P.firstCommit(seed)).toMatch(/^[0-9a-f]{64}$/);
    expect(P.firstFromSeed(seed, id)).toBe(P.firstFromSeed(seed, id));
    const r = await P.playMatch({ id, promptA: 'x', promptB: 'y', ask: async () => '{"add": 1}', seed });
    expect(r.first).toBe(P.firstFromSeed(seed, id));
    const sides = new Set(Array.from({ length: 40 }, (_, i) => P.firstFromSeed(i.toString(16).padStart(32, '0'), id)));
    expect(sides.size).toBe(2); // both players can get the first move
  });
});
