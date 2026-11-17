// Browser-side ticket session: deposit key, ticket broadcast, START/RESULT tracking, refund.
// Pure logic; storage and provider are injected so this also runs (and is tested) in Node.
import { secp256k1, binToHex, hexToBin, hash160, encodeCashAddress, CashAddressType, decodeTransaction } from '@bitauth/libauth';
import { fromOpReturn, drawTicketTask } from '@passrate/shared';
import { buildTicket, buildRefund, SignatureTemplate, DEPOSIT_SATS, REFUND_AGE } from '@passrate/shared/tickettx';

export const STORAGE_KEY = 'passrate.ticket.v1';

export function keyFromHex(skHex, prefix = 'bchtest') {
  const sk = hexToBin(skHex);
  const pk = secp256k1.derivePublicKeyCompressed(sk);
  const address = encodeCashAddress({ prefix, type: CashAddressType.p2pkh, payload: hash160(pk) }).address;
  return { skHex, pkHex: binToHex(pk), address, sig: new SignatureTemplate(sk) };
}

export function newSession({ agentIdx, network = 'chipnet', random = (n) => crypto.getRandomValues(new Uint8Array(n)) }) {
  let sk;
  do { sk = random(32); } while (!secp256k1.validatePrivateKey(sk));
  return { v: 1, network, agentIdx, skHex: binToHex(sk), createdAt: Date.now(), stage: 'deposit' };
}

/** BIP21 URI for the deposit. Amount in BCH, 8 decimals. */
export function depositUri(address, sats = DEPOSIT_SATS) {
  const bch = (Number(sats) / 1e8).toFixed(8);
  return `${address}?amount=${bch}&message=PassRate%20ticket`;
}

export const save = (storage, s) => { try { storage?.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* storage blocked */ } };
export const load = (storage) => { try { return JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null'); } catch { return null; } };
export const clear = (storage) => { try { storage?.removeItem(STORAGE_KEY); } catch { /* ignore */ } };

export async function depositBalance(provider, address) {
  const utxos = (await provider.getUtxos(address)).filter((u) => !u.token);
  return { utxos, total: utxos.reduce((s, u) => s + BigInt(u.satoshis), 0n) };
}

export async function getTip(provider) {
  const { height, hex } = await provider.performRequest('blockchain.headers.get_tip');
  const { hash256 } = await import('@bitauth/libauth');
  return { height, hash: binToHex(hash256(hexToBin(hex)).reverse()) };
}

/** Build + broadcast the ticket from the deposit. Returns ticket facts incl. the drawn exercise. */
export async function payTicket({ provider, session, manifest, op }) {
  const key = keyFromHex(session.skHex);
  const { utxos, total } = await depositBalance(provider, key.address);
  if (total < DEPOSIT_SATS) throw new Error(`deposit ${total} < ${DEPOSIT_SATS}`);
  const tip = await getTip(provider);
  const { builder, covenantAddress } = buildTicket({ provider, utxos, payer: key, operatorPkHex: op.pkHex, operatorInbox: op.inbox,
    taskRoot: manifest.taskRoot, tipHeight: tip.height, tipHash: tip.hash, agentIdx: session.agentIdx });
  const { txid } = await builder.send();
  const taskIdx = drawTicketTask(txid, tip.hash, manifest.tasks.length);
  return { txid, covenantAddress, tipHeight: tip.height, tipHash: tip.hash, taskIdx, slug: manifest.tasks[taskIdx].slug, paidAt: Date.now() };
}

async function decode(provider, txid) {
  const tx = decodeTransaction(hexToBin(await provider.getRawTransaction(txid)));
  if (typeof tx === 'string') throw new Error(tx);
  return tx;
}
const record = (tx) => { try { return fromOpReturn(tx.outputs[0].lockingBytecode); } catch { return null; } };

/** START = the tx that spends the ticket (found in the covenant address history) and names it. */
export async function findStart(provider, ticket) {
  const hist = await provider.performRequest('blockchain.address.get_history', ticket.covenantAddress);
  for (const { tx_hash: h } of hist) {
    if (h === ticket.txid) continue;
    const tx = await decode(provider, h);
    const r = record(tx);
    if (r?.type === 'S' && r.ref === ticket.txid) return { txid: h, taskIdx: r.taskIdx, deadlineUnix: r.deadlineUnix };
    return { txid: h, refund: true }; // spent by something else: the payer's refund
  }
  return null;
}

/** RESULT = the tx that spends START output 1 (operator inbox history) and names START. */
export async function findResult(provider, start, opInbox) {
  const hist = await provider.performRequest('blockchain.address.get_history', opInbox);
  for (const { tx_hash: h } of hist.slice(-25).reverse()) {
    if (h === start.txid) continue;
    const tx = await decode(provider, h);
    const r = record(tx);
    if (r?.type === 'R' && r.startTxid === start.txid) return { txid: h, pass: r.exit === 0 && r.total > 0 && r.passed === r.total, passed: r.passed, total: r.total, durationS: r.durationS };
  }
  return null;
}

/** Blocks until refund is allowed (null if the ticket is unconfirmed). */
export function refundBlocksLeft(ticketHeight, tipHeight) {
  if (!ticketHeight || ticketHeight <= 0) return null;
  return Math.max(0, REFUND_AGE - (tipHeight - ticketHeight + 1));
}

export async function refund({ provider, session, ticket, manifest, op, to }) {
  const key = keyFromHex(session.skHex);
  const u = (await provider.getUtxos(ticket.covenantAddress)).find((x) => x.txid === ticket.txid && x.vout === 1);
  if (!u) throw new Error('ticket already spent (START or refund)');
  return buildRefund({ provider, ticketUtxo: u, payer: key, operatorPkHex: op.pkHex, taskRoot: manifest.taskRoot, to }).send();
}
