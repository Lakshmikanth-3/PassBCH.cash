// Task draw: seed -> task index. Same code runs in server and browser.
import { bytes32, bytesToHex, concat, hexToBytes, sha256, utf8 } from './bytes.js';

// Txids and block hashes are handled in their usual display (RPC/explorer) hex order.
export function ticketSeed(ticketTxidHex, tipHashHex) {
  return sha256(concat(bytes32(ticketTxidHex, 'ticketTxid'), bytes32(tipHashHex, 'tipHash')));
}

export function scheduledSeed(blockHashHex) {
  return sha256(concat(bytes32(blockHashHex, 'blockHash'), utf8('S')));
}

/** Uniform-enough index: 256-bit seed mod n (bias < 2^-240 for n < 65536). */
export function seedToIndex(seed, n) {
  if (!Number.isInteger(n) || n <= 0 || n > 0xffff) throw new Error('task count must be 1..65535');
  const hex = typeof seed === 'string' ? seed : bytesToHex(seed);
  return Number(BigInt('0x' + hex) % BigInt(n));
}

export const drawTicketTask = (txid, tipHash, n) => seedToIndex(ticketSeed(txid, tipHash), n);
export const drawScheduledTask = (blockHash, n) => seedToIndex(scheduledSeed(blockHash), n);

/** Scheduled heights rule: h % every === 0. */
export const isScheduledHeight = (h, every) => h % every === 0;

/** A ticket's committed tip must be fresh: at most maxAge blocks below the height it was first seen at. */
export function isTipFresh(tipHeight, seenAtTipHeight, maxAge = 2) {
  return tipHeight <= seenAtTipHeight && seenAtTipHeight - tipHeight <= maxAge;
}

export { hexToBytes };
