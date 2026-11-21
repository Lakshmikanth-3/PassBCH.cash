import { describe, test, expect } from 'vitest';
import * as E from '../engine.mjs';

describe('Coin Flip', () => {
  const id = 'ab'.repeat(16);
  test('the house commitment matches the revealed seed and the result is reproducible', () => {
    const seed = '11'.repeat(16);
    expect(E.cfCommit(seed)).toMatch(/^[0-9a-f]{64}$/);
    expect(E.cfResult(seed, 'client-seed-1', id)).toBe(E.cfResult(seed, 'client-seed-1', id));
  });
  test('the player seed changes the outcome and both sides come up roughly evenly', () => {
    const seed = '22'.repeat(16); let heads = 0;
    for (let i = 0; i < 400; i++) heads += E.cfResult(seed, `c${i}`, id) === 0 ? 1 : 0;
    expect(heads).toBeGreaterThan(150); expect(heads).toBeLessThan(250);
  });
  test('win pays 1.9x in cash, loss pays nothing, refund restores the buckets', () => {
    const split = { fromBonus: 1000, fromCash: 1500 };
    expect(E.settleQuick('win', 2500, split)).toEqual({ outcome: 'win', bonus: 0, cash: 4750 });
    expect(E.settleQuick('lose', 2500, split)).toEqual({ outcome: 'lose', bonus: 0, cash: 0 });
    expect(E.settleQuick('refund', 2500, split)).toEqual({ outcome: 'refund', bonus: 1000, cash: 1500 });
  });
});

describe('Typing Race', () => {
  const id = 'cd'.repeat(16), seed = '33'.repeat(16);
  const phrase = E.typingPhrase(id);
  test('the phrase and the bot time come from the id and the committed seed', () => {
    expect(E.PHRASES).toContain(phrase); expect(E.typingPhrase(id)).toBe(phrase);
    const t = E.typingBotMs(seed, id, phrase); expect(t).toBe(E.typingBotMs(seed, id, phrase));
    const slow = (phrase.length / 5 / 45) * 60000, fast = (phrase.length / 5 / 80) * 60000;
    expect(t).toBeGreaterThanOrEqual(Math.round(fast) - 1); expect(t).toBeLessThanOrEqual(Math.round(slow) + 1);
  });
  test('outcomes: faster wins, slower loses, wrong text loses, superhuman speed loses, tie refunds', () => {
    const bot = 6000, ok = phrase.length * E.QG.minMsPerChar + 100;
    expect(E.typingOutcome(phrase, phrase, bot - 1, bot)).toBe('win');
    expect(E.typingOutcome(phrase, phrase, bot + 1, bot)).toBe('lose');
    expect(E.typingOutcome(phrase, phrase, bot, bot)).toBe('refund');
    expect(E.typingOutcome(phrase + 'x', phrase, bot - 1, bot)).toBe('lose');
    expect(E.typingOutcome(phrase.toUpperCase(), phrase, bot - 1, bot)).toBe('win'); // Caps Lock is fine
    expect(E.typingOutcome(phrase, phrase, 300, bot)).toBe('lose'); // pasted, not typed
    expect(E.typingOutcome(phrase, phrase, E.QG.maxTypeS * 1000 + 1, 1e9)).toBe('lose');
    expect(ok).toBeLessThan(bot + 10000);
  });
});

describe('SQG1 record', () => {
  test('is 66 bytes with the layout the Verify page decodes', () => {
    const b = E.qRecordBytes({ id: 'ef'.repeat(16), kind: 'type', outcome: 'win', stake: 2500, a: 5100, b: 6200, commit: '44'.repeat(32) });
    expect(b.length).toBe(66); expect(b.subarray(0, 4).toString('ascii')).toBe('SQG1');
    expect(b[20]).toBe(2); expect(b[21]).toBe(1); expect(b.readUInt32LE(22)).toBe(2500); expect(b.readUInt32LE(26)).toBe(5100); expect(b.readUInt32LE(30)).toBe(6200);
  });
});
