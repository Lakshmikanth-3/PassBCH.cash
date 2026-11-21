// Satoshi Duel: game rules. Pure functions, no I/O, so every rule is unit-tested.
import { createHash, randomBytes } from 'node:crypto';

export const MOVES = ['rock', 'paper', 'scissors'];
export const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };
export const RULES = {
  stakes: [1000, 2500, 5000, 10000], // sats per side
  signupBonus: 10000,                // ≈ 5 US cents at ~$450/BCH
  referralBonus: 10000,              // to BOTH the inviter and the new player
  bonusCap: 100,                     // total bonus grants, platform-wide (abuse limit)
  withdrawFeePct: 5,                 // platform fee, taken only on withdrawal
  minWithdraw: 5000,
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
  return [{ side: result === 1 ? 'a' : 'b', bonus: 0, cash: 2 * stake }];
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
