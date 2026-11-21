import { describe, test, expect } from 'vitest';
import * as E from '../engine.mjs';

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
    expect(E.takeStake({ bonus: 700, cash: 5000 }, 2500)).toEqual({ fromBonus: 700, fromCash: 1800 });
    expect(E.takeStake({ bonus: 9000, cash: 0 }, 5000)).toEqual({ fromBonus: 5000, fromCash: 0 });
  });
  test('cannot stake more than the balance or an odd amount', () => {
    expect(() => E.takeStake({ bonus: 400, cash: 0 }, 2500)).toThrow(/insufficient/);
    expect(() => E.takeStake({ bonus: 9999, cash: 0 }, 777)).toThrow(/not allowed/);
  });
  test('winner takes the whole pot in the staked buckets; money is conserved', () => {
    const a = { fromBonus: 1000, fromCash: 0 }, b = { fromBonus: 200, fromCash: 800 };
    expect(E.settle(2, 1000, a, b)).toEqual([{ side: 'b', bonus: 1200, cash: 800 }]);
    const d = E.settle(0, 1000, a, b);
    expect(d.reduce((s, c) => s + c.bonus + c.cash, 0)).toBe(2000);
    expect(d[0]).toEqual({ side: 'a', bonus: 1000, cash: 0 });
  });
  test('withdrawal fee is 5% with a floor that covers the network fee', () => {
    expect(E.withdrawQuote(100000, 20000)).toEqual({ amount: 20000, fee: 1000, send: 19000 });
    expect(E.withdrawQuote(100000, 10000)).toEqual({ amount: 10000, fee: 500, send: 9500 });
    expect(() => E.withdrawQuote(9000, 10000)).toThrow(/more than/);
    expect(() => E.withdrawQuote(99999, 100)).toThrow(/minimum/);
  });
  test('signup bonus, referral bonus to both sides, global cap', () => {
    expect(E.signupGrants({ hasReferrer: false, grantsSoFar: 0 })).toEqual([{ to: 'self', sats: 25000 }]);
    expect(E.signupGrants({ hasReferrer: true, grantsSoFar: 0 })).toEqual([{ to: 'self', sats: 50000 }, { to: 'referrer', sats: 25000 }]);
    expect(E.signupGrants({ hasReferrer: true, grantsSoFar: 99 })).toEqual([{ to: 'self', sats: 50000 }]);
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

describe('up / down', () => {
  test('rolling one-minute bets: ends exactly 60 s after entry, settles 3 s later', () => {
    expect(E.betEnds(1000)).toBe(1060);
    expect(E.betCanSettle(1000, 1062)).toBe(false);
    expect(E.betCanSettle(1000, 1063)).toBe(true);
  });
  test('candle decides', () => {
    expect(E.candleResult(190, 190.5)).toBe('up');
    expect(E.candleResult(190, 189.9)).toBe('down');
    expect(E.candleResult(190, 190)).toBe('flat');
    expect(() => E.candleResult(0, 1)).toThrow();
  });
  test('payouts: win 1.9x, loss 0, flat refunds the same buckets', () => {
    const split = { fromBonus: 3000, fromCash: 2000 };
    expect(E.settleBet('up', 'up', 5000, split)).toEqual({ outcome: 'win', bonus: 0, cash: 9500 });
    expect(E.settleBet('up', 'down', 5000, split)).toEqual({ outcome: 'lose', bonus: 0, cash: 0 });
    expect(E.settleBet('down', 'flat', 5000, split)).toEqual({ outcome: 'refund', bonus: 3000, cash: 2000 });
  });
  test('on-chain bet record round trip (38 bytes)', () => {
    const r = { id: 'ab'.repeat(16), side: 'down', result: 'up', stake: 25000, roundStart: 1795259760, open: 190.01, close: 190.06 };
    const b = E.betRecordBytes(r);
    expect(b.length).toBe(38);
    expect(E.parseBetRecord(b)).toEqual(r);
  });
});

describe('AI pass or fail', () => {
  test('exercise draw is deterministic, in range and changes with the block', () => {
    expect(E.drawTask('r1', 'aa', 141)).toBe(E.drawTask('r1', 'aa', 141));
    const seen = new Set(); for (let i = 0; i < 300; i++) { const t = E.drawTask('r1', `b${i}`, 141); expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThan(141); seen.add(t); }
    expect(seen.size).toBeGreaterThan(80);
  });
  test('odds follow the model record with a 5% edge and limits', () => {
    expect(E.aiOdds({ pass: 0, n: 0 })).toMatchObject({ passPct: 190, failPct: 190 });
    const strong = E.aiOdds({ pass: 9, n: 10 });
    expect(strong.passPct).toBeLessThan(120); expect(strong.failPct).toBeGreaterThan(500 - 1);
    expect(E.aiOdds({ pass: 1000, n: 1000 }).passPct).toBe(110);
  });
  test('settlement', () => {
    expect(E.settleAiBet('pass', true, 5000, 150)).toEqual({ outcome: 'win', cash: 7500 });
    expect(E.settleAiBet('fail', true, 5000, 300)).toEqual({ outcome: 'lose', cash: 0 });
    expect(E.settleAiBet('fail', false, 2500, 300)).toEqual({ outcome: 'win', cash: 7500 });
  });
  test('on-chain record is 60 bytes', () => {
    expect(E.aiRecordBytes({ id: 'ab'.repeat(16), pass: true, passed: 14, total: 14, taskIdx: 78, modelIdx: 0, transcriptHash: 'cd'.repeat(32) }).length).toBe(60);
  });
});

describe('anti-abuse', () => {
  test('two bonus-only accounts dueling each other produce no withdrawable cash', () => {
    const a = { fromBonus: 25000, fromCash: 0 }, b = { fromBonus: 25000, fromCash: 0 };
    for (const r of [1, 2]) expect(E.settle(r, 25000, a, b)[0].cash).toBe(0);
  });
  test('beating the House Bot still pays its cash stake', () => {
    expect(E.settle(1, 5000, { fromBonus: 5000, fromCash: 0 }, { fromBonus: 0, fromCash: 5000 })).toEqual([{ side: 'a', bonus: 5000, cash: 5000 }]);
  });
  test('wagering rule: 2x bonus must be staked before withdrawing', () => {
    expect(E.withdrawAllowed({ wagered: 0, bonusReceived: 25000 })).toEqual({ ok: false, need: 50000, left: 50000 });
    expect(E.withdrawAllowed({ wagered: 50000, bonusReceived: 25000 }).ok).toBe(true);
    expect(E.withdrawAllowed({ wagered: 0, bonusReceived: 0 }).ok).toBe(true); // depositors without bonus can always withdraw
  });
});
