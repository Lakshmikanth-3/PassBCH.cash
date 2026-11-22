// House wallet on BCH: writes duel records (OP_RETURN) and pays withdrawals. Chipnet until final submission.
import { secp256k1, hexToBin, binToHex, hash160, sha256, encodeCashAddress, CashAddressType, utf8ToBin } from '@bitauth/libauth';
import { ElectrumNetworkProvider, TransactionBuilder, SignatureTemplate } from 'cashscript';
import { recordBytes, betRecordBytes, aiRecordBytes, qRecordBytes, racePhraseHash } from './engine.mjs';
import { pfRecordBytes } from './promptfight.mjs';

export const NETWORK = (process.env.BCH_NETWORK ?? process.env.DUEL_NETWORK) === 'mainnet' ? 'mainnet' : 'chipnet';
const PREFIX = NETWORK === 'mainnet' ? 'bitcoincash' : 'bchtest';
const HOSTS = { chipnet: ['chipnet.bch.ninja', 'chipnet.imaginary.cash'], mainnet: ['bch.imaginary.cash', 'electroncash.dk', 'bch.loping.net'] };
export const EXPLORER = NETWORK === 'mainnet' ? 'https://blockchair.com/bitcoin-cash/transaction/' : 'https://chipnet.imaginary.cash/tx/';
const FEE_PER_BYTE = 1n;

export function keyOf(skBin) {
  const pk = secp256k1.derivePublicKeyCompressed(skBin);
  return { sk: skBin, pk, address: encodeCashAddress({ prefix: PREFIX, type: CashAddressType.p2pkh, payload: hash160(pk) }).address, sig: new SignatureTemplate(skBin) };
}
export function houseKey() {
  const hex = process.env.HOUSE_SK;
  if (!/^[0-9a-f]{64}$/.test(hex ?? '')) throw new Error('HOUSE_SK not set');
  return keyOf(hexToBin(hex));
}
/** Each player gets their own deposit address, derived from the house key (only the house can spend it). */
export function depositKey(playerId) {
  return keyOf(sha256.hash(utf8ToBin(`deposit:${process.env.HOUSE_SK}:${playerId}`)));
}

let h = 0;
export function provider() { return new ElectrumNetworkProvider(NETWORK, { hostname: HOSTS[NETWORK][h++ % HOSTS[NETWORK].length] }); }

const plain = (u) => !u.token;
async function spendable(p, address) { return (await p.getUtxos(address)).filter(plain).sort((a, b) => Number(b.satoshis - a.satoshis)); }

/** Build, sign and send a tx from the house wallet: optional OP_RETURN, optional payment, change back. */
export async function houseSend({ p = provider(), opReturn, to, sats = 0n, beforeSend }) {
  const house = houseKey();
  const utxos = await spendable(p, house.address);
  const need = BigInt(sats) + 1000n;
  const picked = []; let total = 0n;
  for (const u of utxos) { picked.push(u); total += u.satoshis; if (total >= need) break; }
  if (total < need) throw new Error(`house wallet low: has ${total} sats`);
  const build = (fee) => {
    const b = new TransactionBuilder({ provider: p });
    for (const u of picked) b.addInput(u, house.sig.unlockP2PKH());
    if (opReturn) b.addOpReturnOutput(['0x' + binToHex(opReturn)]);
    if (sats > 0n) b.addOutput({ to, amount: BigInt(sats) });
    const change = total - BigInt(sats) - fee;
    if (change >= 546n) b.addOutput({ to: house.address, amount: change });
    return b;
  };
  const size = BigInt(build(1000n).build().length / 2);
  const hex = build(size * FEE_PER_BYTE + 10n).build();
  const txid = binToHex(sha256.hash(sha256.hash(hexToBin(hex))).reverse());
  await beforeSend?.(txid); // persist the txid first: a timeout after broadcast must never cause a refund
  await p.sendRawTransaction(hex);
  return txid;
}

export const houseAddress = () => houseKey().address;
/** Spendable BCH (sats) in the house wallet, read from chain. */
export async function houseBalance(p = provider()) { return Number((await p.getUtxos(houseKey().address)).filter(plain).reduce((a, u) => a + u.satoshis, 0n)); }

export const recordDuel = (d, beforeSend) => houseSend({ beforeSend, opReturn: recordBytes({ id: d.id, result: d.result, stake: d.stake, moveA: d.a_move, moveB: d.b_move, commit: d.a_commit }) });
export const payWithdrawal = (to, sats, beforeSend, p) => houseSend({ p, to, sats: BigInt(sats), beforeSend });
export async function depositUtxos(playerId, p = provider()) { return spendable(p, depositKey(playerId).address); }
export const recordBet = (b, beforeSend) => houseSend({ beforeSend, opReturn: betRecordBytes({ id: b.id, side: b.side, result: b.result, stake: b.stake,
  roundStart: Number(b.round_start), open: Number(b.open_price), close: Number(b.close_price) }) });
export const recordAi = (r, beforeSend) => houseSend({ beforeSend, opReturn: aiRecordBytes({ id: r.id, pass: r.pass, passed: r.passed, total: r.total, taskIdx: r.task_idx, modelIdx: r.model_idx, transcriptHash: r.transcript_hash }) });

/** Latest block (height + hash): the AI exercise draw uses a block nobody can predict. */
export async function tip(p = provider()) {
  const { height, hex } = await p.performRequest('blockchain.headers.get_tip');
  return { height, hash: binToHex(sha256.hash(sha256.hash(hexToBin(hex))).reverse()) };
}
export const recordQ = (q, beforeSend) => houseSend({ beforeSend, opReturn: qRecordBytes({ id: q.id, kind: q.kind, outcome: q.outcome, stake: q.stake,
  a: q.kind === 'coin' ? q.pick : q.player_ms, b: q.kind === 'coin' ? q.result : q.bot_ms, commit: q.commit }) });
/** Friend race record (SQG1, kind 3): a = player A's ms, b = player B's ms (0 = did not finish), commit = sha256("race:"+phrase). */
export const recordRace = (r, beforeSend) => houseSend({ beforeSend, opReturn: qRecordBytes({ id: r.id, kind: 'race', outcome: r.winner === 'a' ? 'win' : r.winner === 'b' ? 'lose' : 'refund', stake: r.stake,
  a: r.a_ms ?? 0, b: r.b_ms ?? 0, commit: racePhraseHash(r.phrase) }) });
export const recordPf = (m, beforeSend) => houseSend({ beforeSend, opReturn: pfRecordBytes({ id: m.id, winner: m.winner, target: m.target, maxStep: m.max_step, stake: m.stake, turns: m.turns }) });
