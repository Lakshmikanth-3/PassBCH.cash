import { describe, test, expect, beforeAll } from 'vitest';

let render;
beforeAll(async () => { process.env.NO_COLOR = '1'; ({ render } = await import('./panel.mjs')); });
const T = 1_800_000_000;
const rec = { 'openai/gpt-oss-120b': { pass: 3, n: 4, passPct: 142, failPct: 316 } };

describe('Claude Code panel', () => {
  test('no feed yet tells you how to start it', () => expect(render(null, null, T)).toMatch(/start the feed/));
  test('betting round shows model, exercise, countdown and odds', () => {
    const s = { updated: T, ai: { records: rec, current: { model: 'openai/gpt-oss-120b', slug: 'book-store', status: 'open', bet_close_s: T + 65 } }, price: { price: 190.06 } };
    expect(render(s, null, T)).toBe('🤖 gpt-oss-120b vs "book-store" ● BETTING 1:05 · PASS 1.42x | FAIL 3.16x  │ 📈 BCH $190.06');
  });
  test('running round says the AI is coding', () => {
    const s = { updated: T, ai: { records: rec, current: { model: 'openai/gpt-oss-120b', slug: 'zipper', status: 'running', bet_close_s: T - 5 } } };
    expect(render(s, null, T)).toMatch(/is coding "zipper"/);
  });
  test('last result when no round is live', () => {
    const s = { updated: T, ai: { recent: [{ model: 'openai/gpt-oss-20b', slug: 'sieve', status: 'done', pass: false, passed: 3, total: 5 }] } };
    expect(render(s, null, T)).toMatch(/❌ FAIL 3\/5/);
  });
  test('while Claude thinks, a second line invites you to play', () => {
    const s = { updated: T, ai: { recent: [] } };
    const out = render(s, { since: T - 42 }, T);
    expect(out.split('\n')).toHaveLength(2);
    expect(out).toMatch(/Claude thinking 0:42 · play now/);
  });
  test('stale feed is flagged', () => expect(render({ updated: T - 500, ai: {} }, null, T)).toMatch(/feed offline/));
});
