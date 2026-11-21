import { describe, test, expect } from 'vitest';
import * as E from '../lib/engine.mjs';

describe('rock paper scissors', () => {
  test('all 9 outcomes', () => {
    const t = { rock: { rock: 0, paper: 2, scissors: 1 }, paper: { rock: 1, paper: 0, scissors: 2 }, scissors: { rock: 2, paper: 1, scissors: 0 } };
    for (const a of E.MOVES) for (const b of E.MOVES) expect(E.outcome(a, b)).toBe(t[a][b]);
  });
  test('bad moves throw', () => { expect(() => E.outcome('lizard', 'rock')).toThrow(); });
});

describe('commit / reveal', () => {
  const salt = 'ab'.repeat(16);
  test('a commitment opens only with the same move and salt', () => {
    const c = E.commitMove('rock', salt);
    expect(E.checkReveal(c, 'rock', salt)).toBe(true);
    expect(E.checkReveal(c, 'paper', salt)).toBe(false);
    expect(E.checkReveal(c, 'rock', 'cd'.repeat(16))).toBe(false);
  });
  test('short salts are rejected (no brute force of 3 moves)', () => expect(E.checkReveal(E.commitMove('rock', 'x'), 'rock', 'x')).toBe(false));
  test('commit hides the move: all three commits differ', () => {
    expect(new Set(E.MOVES.map((m) => E.commitMove(m, salt))).size).toBe(3);
  });
  test('house bot move is deterministic per duel and roughly uniform', () => {
    expect(E.botMove('s', 'd1')).toBe(E.botMove('s', 'd1'));
    const n = { rock: 0, paper: 0, scissors: 0 };
    for (let i = 0; i < 3000; i++) n[E.botMove('secret', `d${i}`)]++;
    for (const m of E.MOVES) expect(n[m]).toBeGreaterThan(850);
  });
});

describe('money', () => {
  test('stake uses bonus first', () => {
    expect(E.takeStake({ bonus: 700, cash: 5000 }, 1000)).toEqual({ fromBonus: 700, fromCash: 300 });
    expect(E.takeStake({ bonus: 5000, cash: 0 }, 1000)).toEqual({ fromBonus: 1000, fromCash: 0 });
  });
  test('cannot stake more than the balance or an odd amount', () => {
    expect(() => E.takeStake({ bonus: 400, cash: 0 }, 1000)).toThrow(/insufficient/);
    expect(() => E.takeStake({ bonus: 9999, cash: 0 }, 777)).toThrow(/not allowed/);
  });
  test('winner takes the whole pot as cash; money is conserved', () => {
    const a = { fromBonus: 1000, fromCash: 0 }, b = { fromBonus: 200, fromCash: 800 };
    expect(E.settle(2, 1000, a, b)).toEqual([{ side: 'b', bonus: 0, cash: 2000 }]);
    const d = E.settle(0, 1000, a, b);
    expect(d.reduce((s, c) => s + c.bonus + c.cash, 0)).toBe(2000);
    expect(d[0]).toEqual({ side: 'a', bonus: 1000, cash: 0 });
  });
  test('withdrawal fee is 5% with a floor that covers the network fee', () => {
    expect(E.withdrawQuote(100000, 20000)).toEqual({ amount: 20000, fee: 1000, send: 19000 });
    expect(E.withdrawQuote(100000, 5000)).toEqual({ amount: 5000, fee: 400, send: 4600 });
    expect(() => E.withdrawQuote(4000, 5000)).toThrow(/more than/);
    expect(() => E.withdrawQuote(99999, 100)).toThrow(/minimum/);
  });
  test('signup bonus, referral bonus to both sides, global cap', () => {
    expect(E.signupGrants({ hasReferrer: false, grantsSoFar: 0 })).toEqual([{ to: 'self', sats: 10000 }]);
    expect(E.signupGrants({ hasReferrer: true, grantsSoFar: 0 })).toEqual([{ to: 'self', sats: 20000 }, { to: 'referrer', sats: 10000 }]);
    expect(E.signupGrants({ hasReferrer: true, grantsSoFar: 99 })).toEqual([{ to: 'self', sats: 20000 }]);
    expect(E.signupGrants({ hasReferrer: true, grantsSoFar: 100 })).toEqual([]);
  });
});

describe('names, statuses, records', () => {
  test('names are cleaned', () => {
    expect(E.cleanName('  Priya <script>  ')).toBe('Priya script');
    expect(E.cleanName('x')).toBeNull();
    expect(E.cleanName('a'.repeat(50))).toHaveLength(20);
  });
  test('duel lifecycle', () => {
    expect(E.duelStatus({ created_s: 0 }, 10)).toBe('open');
    expect(E.duelStatus({ created_s: 0 }, 90000)).toBe('expired');
    expect(E.duelStatus({ b_player: 1, joined_s: 100 }, 150)).toBe('awaiting_reveal');
    expect(E.duelStatus({ b_player: 1, joined_s: 100 }, 221)).toBe('reveal_timeout');
    expect(E.duelStatus({ settled_at: 1 }, 1e9)).toBe('settled');
  });
  test('on-chain record round trip (59 bytes, fits OP_RETURN)', () => {
    const r = { id: '0f'.repeat(16), result: 2, stake: 5000, moveA: 'rock', moveB: 'paper', commit: 'aa'.repeat(32) };
    const b = E.recordBytes(r);
    expect(b.length).toBe(59);
    expect(E.parseRecord(b)).toEqual(r);
    expect(E.parseRecord(E.recordBytes({ ...r, moveA: null })).moveA).toBeNull();
    expect(E.parseRecord(Buffer.from('nope'))).toBeNull();
  });
});
