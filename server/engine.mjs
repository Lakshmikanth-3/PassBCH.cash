// PassBCH.cash: game rules. Pure functions, no I/O, so every rule is unit-tested.
import { createHash, randomBytes } from 'node:crypto';

export const MOVES = ['rock', 'paper', 'scissors'];
export const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };
export const RULES = {
  stakes: [2500, 5000, 10000, 25000], // sats per side
  signupBonus: 25000,                // ≈ 5 US cents at ~$190/BCH
  referralBonus: 25000,              // to BOTH the inviter and the new player
  bonusCap: 100,                     // total bonus grants, platform-wide (abuse limit)
  withdrawFeePct: 5,                 // platform fee, taken only on withdrawal
  minWithdraw: 10000,
  networkFee: 400,                   // paid by the platform out of the fee
  revealTimeoutS: 120,               // creator must reveal within 2 min of a join, or loses
  openTimeoutS: 24 * 3600,           // unjoined duels refund after 24 h
};

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const isMove = (m) => MOVES.includes(m);
export const newSalt = () => randomBytes(16).toString('hex');
export const newToken = () => randomBytes(24).toString('base64url');
export const tokenHash = (t) => sha256(`tok:${t}`);
/** Commitment to a move: hides it until reveal, binds the player to it. */
export const commitMove = (move, salt) => sha256(`${move}:${salt}`);
export const checkReveal = (commit, move, salt) => isMove(move) && typeof salt === 'string' && salt.length >= 16 && commitMove(move, salt) === commit;

/** 0 = draw, 1 = a wins, 2 = b wins. */
export function outcome(a, b) {
  if (!isMove(a) || !isMove(b)) throw new Error('bad move');
  if (a === b) return 0;
  return (MOVES.indexOf(a) - MOVES.indexOf(b) + 3) % 3 === 1 ? 1 : 2;
}

/** House bot move: fixed by a secret seed before the player reveals; provable after. */
export const botMove = (houseSecret, duelId) => MOVES[parseInt(sha256(`bot:${houseSecret}:${duelId}`).slice(0, 8), 16) % 3];
export const botSeedCommit = (houseSecret, duelId) => sha256(`seed:${sha256(`bot:${houseSecret}:${duelId}`)}`);

/** Stake split: bonus credit is spent first. Throws if the player can't cover it. */
export function takeStake({ bonus, cash }, stake) {
  if (!RULES.stakes.includes(stake)) throw new Error('stake not allowed');
  if (bonus + cash < stake) throw new Error('insufficient balance');
  const fromBonus = Math.min(bonus, stake);
  return { fromBonus, fromCash: stake - fromBonus };
}

/**
 * Settlement: winner gets the whole pot as withdrawable cash (that is how bonus credit becomes real).
 * Draw: each side gets back exactly what it put in, in the same buckets.
 * Returns credits: [{ side: 'a'|'b', bonus, cash }]
 */
export function settle(result, stake, a, b) {
  if (result === 0) return [{ side: 'a', bonus: a.fromBonus, cash: a.fromCash }, { side: 'b', bonus: b.fromBonus, cash: b.fromCash }];
  // The winner takes the pot *in the same buckets it was staked in*: won bonus stays bonus (play-only).
  // So two accounts of one person dueling each other can never turn free bonus into withdrawable cash.
  return [{ side: result === 1 ? 'a' : 'b', bonus: a.fromBonus + b.fromBonus, cash: a.fromCash + b.fromCash }];
}

/** Wagering rule: before any withdrawal, a player must have staked at least 2x the bonus they received. */
export const WAGER_MULTIPLE = 2;
export function withdrawAllowed({ wagered, bonusReceived }) {
  const need = WAGER_MULTIPLE * bonusReceived;
  return { ok: wagered >= need, need, left: Math.max(0, need - wagered) };
}

/** Withdrawal: only cash (won or deposited) can leave; platform fee is the company's revenue. */
export function withdrawQuote(cash, amount) {
  if (!Number.isInteger(amount) || amount < RULES.minWithdraw) throw new Error(`minimum withdrawal is ${RULES.minWithdraw} sats`);
  if (amount > cash) throw new Error('more than your withdrawable balance');
  const fee = Math.max(RULES.networkFee, Math.ceil((amount * RULES.withdrawFeePct) / 100));
  return { amount, fee, send: amount - fee };
}

/** Bonus grants for a signup, respecting the global cap. */
export function signupGrants({ hasReferrer, grantsSoFar }) {
  const left = Math.max(0, RULES.bonusCap - grantsSoFar);
  const want = hasReferrer ? [['self', RULES.signupBonus + RULES.referralBonus], ['referrer', RULES.referralBonus]] : [['self', RULES.signupBonus]];
  return want.slice(0, left).map(([to, sats]) => ({ to, sats }));
}

export function cleanName(name) {
  const n = String(name ?? '').normalize('NFKC').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 20);
  return n.length >= 2 ? n : null;
}

/** Status of a duel from its fields and the clock. */
export function duelStatus(d, nowS) {
  if (d.settled_at) return 'settled';
  if (!d.b_player) return nowS - d.created_s > RULES.openTimeoutS ? 'expired' : 'open';
  return nowS - d.joined_s > RULES.revealTimeoutS ? 'reveal_timeout' : 'awaiting_reveal';
}

/** OP_RETURN record of a settled duel: "SDL1" | duelId(16) | result(1) | stake(4 LE) | moveA(1) | moveB(1) | commit(32) */
export function recordBytes({ id, result, stake, moveA, moveB, commit }) {
  const buf = Buffer.alloc(4 + 16 + 1 + 4 + 1 + 1 + 32);
  buf.write('SDL1', 0, 'ascii');
  Buffer.from(id, 'hex').copy(buf, 4);
  buf[20] = result; buf.writeUInt32LE(stake, 21);
  buf[25] = moveA ? MOVES.indexOf(moveA) : 255; buf[26] = MOVES.indexOf(moveB);
  Buffer.from(commit, 'hex').copy(buf, 27);
  return buf;
}
export function parseRecord(buf) {
  if (buf.length !== 59 || buf.toString('ascii', 0, 4) !== 'SDL1') return null;
  return { id: buf.subarray(4, 20).toString('hex'), result: buf[20], stake: buf.readUInt32LE(21),
    moveA: MOVES[buf[25]] ?? null, moveB: MOVES[buf[26]], commit: buf.subarray(27).toString('hex') };
}

// ---------- Up / Down: bet on the next 1-minute BCH/USD candle ----------
export const UPDOWN = { roundS: 60, payoutPct: 190, settleDelayS: 5 };

/** Bets placed now go into the round that starts at the next full minute (betting closes when it starts). */
export const nextRound = (nowS) => Math.floor(nowS / 60) * 60 + 60;
export const roundEnds = (roundStart) => roundStart + UPDOWN.roundS;
export const canSettle = (roundStart, nowS) => nowS >= roundEnds(roundStart) + UPDOWN.settleDelayS;
/** The candle decides: close above open = up, below = down, equal = flat (refund). */
export function candleResult(open, close) {
  if (!(open > 0) || !(close > 0)) throw new Error('bad candle');
  return close > open ? 'up' : close < open ? 'down' : 'flat';
}
/** Win pays 1.9x (the 0.1 is the platform edge); flat refunds in the same buckets; loss pays nothing. */
export function settleBet(side, result, stake, split) {
  if (result === 'flat') return { outcome: 'refund', bonus: split.fromBonus, cash: split.fromCash };
  if (side === result) return { outcome: 'win', bonus: 0, cash: Math.floor((stake * UPDOWN.payoutPct) / 100) };
  return { outcome: 'lose', bonus: 0, cash: 0 };
}
/** OP_RETURN record: "SUD1" | betId(16) | side(1) | result(1) | stake(4) | roundStart(4) | open*1e4(4) | close*1e4(4) = 38 bytes */
export function betRecordBytes({ id, side, result, stake, roundStart, open, close }) {
  const b = Buffer.alloc(38); const code = { up: 1, down: 2, flat: 0 };
  b.write('SUD1', 0, 'ascii'); Buffer.from(id, 'hex').copy(b, 4);
  b[20] = code[side]; b[21] = code[result]; b.writeUInt32LE(stake, 22); b.writeUInt32LE(roundStart, 26);
  b.writeUInt32LE(Math.round(open * 1e4), 30); b.writeUInt32LE(Math.round(close * 1e4), 34);
  return b;
}
export function parseBetRecord(b) {
  if (b.length !== 38 || b.toString('ascii', 0, 4) !== 'SUD1') return null;
  const name = ['flat', 'up', 'down'];
  return { id: b.subarray(4, 20).toString('hex'), side: name[b[20]], result: name[b[21]], stake: b.readUInt32LE(22), roundStart: b.readUInt32LE(26), open: b.readUInt32LE(30) / 1e4, close: b.readUInt32LE(34) / 1e4 };
}

// ---------- AI Pass or Fail: bet on whether an AI agent's code passes a chain-drawn exercise ----------
export const AI = { betWindowS: 75, voidAfterS: 15 * 60, models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'], edgePct: 95, minPct: 110, maxPct: 500 };

/** Exercise index drawn from a block hash the operator can't choose: sha256(roundId || blockHash) mod n. */
export const drawTask = (roundId, blockHash, n) => Number(BigInt(`0x${sha256(`${roundId}:${blockHash}`)}`) % BigInt(n));

/** Odds from the model's public record (+1/+2 prior): payout % for PASS and FAIL, with a 5% platform edge. */
export function aiOdds({ pass, n }) {
  const p = (pass + 1) / (n + 2);
  const clamp = (x) => Math.max(AI.minPct, Math.min(AI.maxPct, Math.floor(x)));
  return { pPass: p, passPct: clamp(AI.edgePct / p), failPct: clamp(AI.edgePct / (1 - p)) };
}
export function settleAiBet(side, passed, stake, oddsPct) {
  const won = (side === 'pass') === passed;
  return won ? { outcome: 'win', cash: Math.floor((stake * oddsPct) / 100) } : { outcome: 'lose', cash: 0 };
}
/** OP_RETURN record: "SAI1" | roundId(16) | pass(1) | passed(2) | total(2) | taskIdx(2) | modelIdx(1) | transcriptHash(32) = 60 bytes */
export function aiRecordBytes({ id, pass, passed, total, taskIdx, modelIdx, transcriptHash }) {
  const b = Buffer.alloc(60);
  b.write('SAI1', 0, 'ascii'); Buffer.from(id, 'hex').copy(b, 4);
  b[20] = pass ? 1 : 0; b.writeUInt16LE(passed, 21); b.writeUInt16LE(total, 23); b.writeUInt16LE(taskIdx, 25); b[27] = modelIdx;
  Buffer.from(transcriptHash, 'hex').copy(b, 28);
  return b;
}
