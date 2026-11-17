// Ticket / refund transaction building, shared by the browser (payer) and the operator (tests, CLI).
// Separate entry point (@passrate/shared/tickettx) so pure-protocol users don't pull in cashscript.
import { Contract, TransactionBuilder } from 'cashscript';
import { encodePayload, toOpReturn } from './payloads.js';
import artifact from '../artifacts/RunTicket.json' with { type: 'json' };

export const RUN_TICKET_ARTIFACT = artifact;
export const TICKET_SATS = 20000n;
export const NOTIFY_SATS = 546n;
export const TICKET_FEE = 800n;
export const REFUND_FEE = 600n;
export const REFUND_AGE = 6;
/** What the payer must deposit for one ticket (any extra comes back as change). */
export const DEPOSIT_SATS = TICKET_SATS + NOTIFY_SATS + TICKET_FEE;

export function runTicketContract(operatorPkHex, payerPkHex, taskRoot, provider) {
  return new Contract(artifact, [operatorPkHex, payerPkHex, taskRoot], { provider, addressType: 'p2sh32' });
}

/**
 * Ticket tx: [0] OP_RETURN TICKET, [1] covenant 20,000 sats, [2] 546-sat notify to the operator inbox,
 * [3] change to the payer (omitted when it would be dust).
 * payer: { pkHex, address, sig: SignatureTemplate }; utxos: payer's coins (all are spent).
 */
export function buildTicket({ provider, utxos, payer, operatorPkHex, operatorInbox, taskRoot, tipHeight, tipHash, agentIdx }) {
  const list = Array.isArray(utxos) ? utxos : [utxos];
  const total = list.reduce((s, u) => s + BigInt(u.satoshis), 0n);
  const change = total - DEPOSIT_SATS;
  if (change < 0n) throw new Error(`need ${DEPOSIT_SATS} sats, have ${total}`);
  const c = runTicketContract(operatorPkHex, payer.pkHex, taskRoot, provider);
  const rec = toOpReturn(encodePayload('T', { tipHeight, tipHash, agentIdx, payerPk: payer.pkHex }));
  const b = new TransactionBuilder({ provider });
  for (const u of list) b.addInput(u, payer.sig.unlockP2PKH());
  b.addOutput({ to: rec, amount: 0n })
    .addOutput({ to: c.address, amount: TICKET_SATS })
    .addOutput({ to: operatorInbox, amount: NOTIFY_SATS });
  if (change >= 546n) b.addOutput({ to: payer.address, amount: change });
  return { builder: b, covenantAddress: c.address };
}

/** Refund after 6 blocks: payer alone reclaims the ticket to any address. */
export function buildRefund({ provider, ticketUtxo, payer, operatorPkHex, taskRoot, to }) {
  const c = runTicketContract(operatorPkHex, payer.pkHex, taskRoot, provider);
  return new TransactionBuilder({ provider })
    .addInput(ticketUtxo, c.unlock.refund(payer.sig), { sequence: REFUND_AGE })
    .addOutput({ to, amount: BigInt(ticketUtxo.satoshis) - REFUND_FEE });
}

// Single cashscript instance for every package (Windows can load one file twice under C:\ and c:\,
// which breaks cashscript's instanceof checks). Import cashscript classes from here, not directly.
export { SignatureTemplate, TransactionBuilder, ElectrumNetworkProvider, MockNetworkProvider, randomUtxo } from 'cashscript';
