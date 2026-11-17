// Transaction builders and ticket validation. Pure where possible so they run against MockNetworkProvider.
import fs from 'node:fs';
import { compileFile } from 'cashc';
import { Contract, TransactionBuilder } from 'cashscript';
import { decodeTransaction, hexToBin, binToHex, cashAddressToLockingBytecode } from '@bitauth/libauth';
import { encodePayload, toOpReturn, fromOpReturn, drawTicketTask, isTipFresh } from '@passrate/shared';
import { PATHS, TICKET_SATS, NOTIFY_SATS, FEE, ROSTER, RUN_DEADLINE_S, ATTEMPT_POLICY, TIP_MAX_AGE } from './config.js';

let artifact;
export const getArtifact = () => (artifact ??= compileFile(PATHS.contract));

export function runTicketContract(operatorPkHex, payerPkHex, taskRoot, provider) {
  return new Contract(getArtifact(), [operatorPkHex, payerPkHex, taskRoot], { provider, addressType: 'p2sh32' });
}

const lockOf = (address) => {
  const r = cashAddressToLockingBytecode(address);
  if (typeof r === 'string') throw new Error(r);
  return binToHex(r.bytecode);
};

/** Payer side: ticket tx = [0] OP_RETURN T, [1] covenant 20,000 sats, [2] 546-sat notify to operator inbox, [3] change. */
export function buildTicket({ provider, utxo, payer, operatorPkHex, operatorInbox, taskRoot, tipHeight, tipHash, agentIdx }) {
  const c = runTicketContract(operatorPkHex, payer.pkHex, taskRoot, provider);
  const rec = toOpReturn(encodePayload('T', { tipHeight, tipHash, agentIdx, payerPk: payer.pkHex }));
  const change = utxo.satoshis - TICKET_SATS - NOTIFY_SATS - FEE.ticket;
  if (change < 546n) throw new Error('insufficient funds for ticket');
  return new TransactionBuilder({ provider }).addInput(utxo, payer.sig.unlockP2PKH())
    .addOutput({ to: rec, amount: 0n })
    .addOutput({ to: c.address, amount: TICKET_SATS })
    .addOutput({ to: operatorInbox, amount: NOTIFY_SATS })
    .addOutput({ to: payer.address, amount: change });
}

/**
 * Operator side: decode and validate a ticket tx. Returns { ok, reason?, ticket? }.
 * Checks: TICKET record at output 0, covenant output 1 matches the payerPk in the record with >= 20,000 sats,
 * known agent row, tip freshness against the tip when first seen.
 */
export function validateTicket(rawHex, { operatorPkHex, taskRoot, seenAtHeight, taskCount, txid }) {
  const tx = decodeTransaction(hexToBin(rawHex));
  if (typeof tx === 'string') return { ok: false, reason: `undecodable: ${tx}` };
  let rec;
  try { rec = fromOpReturn(tx.outputs[0]?.lockingBytecode ?? new Uint8Array()); } catch (e) { return { ok: false, reason: `no ticket record: ${e.message}` }; }
  if (rec.type !== 'T') return { ok: false, reason: `record type ${rec.type}` };
  const row = ROSTER.find((r) => r.agentIdx === rec.agentIdx);
  if (!row) return { ok: false, reason: `unknown agentIdx ${rec.agentIdx}` };
  const c = runTicketContract(operatorPkHex, rec.payerPk, taskRoot);
  const out = tx.outputs[1];
  if (!out || binToHex(out.lockingBytecode) !== lockOf(c.address)) return { ok: false, reason: 'output 1 is not this ticket\'s covenant' };
  if (out.valueSatoshis < TICKET_SATS) return { ok: false, reason: `ticket value ${out.valueSatoshis} < ${TICKET_SATS}` };
  if (!isTipFresh(rec.tipHeight, seenAtHeight, TIP_MAX_AGE)) return { ok: false, reason: `stale tip ${rec.tipHeight} vs ${seenAtHeight}` };
  const taskIdx = drawTicketTask(txid, rec.tipHash, taskCount);
  return { ok: true, ticket: { txid, vout: 1, satoshis: out.valueSatoshis, covenant: c.address, ...rec, row, taskIdx } };
}

/** START: spends the ticket via covenant. [0] OP_RETURN S naming the ticket, [1] change to operator (spent by RESULT). */
export function buildStart({ provider, ticket, operator, taskRoot, harnessDigest, nowUnix = Math.floor(Date.now() / 1000), refHeight }) {
  const c = runTicketContract(operator.pkHex, ticket.payerPk, taskRoot, provider);
  const rec = toOpReturn(encodePayload('S', {
    mode: 0, ref: ticket.txid, refHeight, taskRoot, taskIdx: ticket.taskIdx,
    agentIdx: ticket.row.agentIdx, modelIdx: ticket.row.modelIdx, lane: 0, harnessDigest,
    deadlineUnix: nowUnix + RUN_DEADLINE_S, attemptPolicy: ATTEMPT_POLICY,
  }));
  const utxo = { txid: ticket.txid, vout: ticket.vout, satoshis: ticket.satoshis };
  return new TransactionBuilder({ provider }).addInput(utxo, c.unlock.start(operator.sig))
    .addOutput({ to: rec, amount: 0n })
    .addOutput({ to: operator.address, amount: ticket.satoshis - FEE.start });
}

/** RESULT: spends START's output 1, so Ticket -> START -> RESULT are linked UTXO-to-UTXO. */
export function buildResult({ provider, startTxid, startValue, operator, result }) {
  const rec = toOpReturn(encodePayload('R', {
    startTxid, exit: result.pass ? 0 : 1, passed: result.passed, total: result.total,
    testOutHash: result.testOutHash, transcriptHash: result.transcriptHash, solutionHash: result.solutionHash,
    durationS: Math.min(65535, Math.round(result.durationS ?? 0)), costMilliUSD: 0,
  }));
  return new TransactionBuilder({ provider })
    .addInput({ txid: startTxid, vout: 1, satoshis: startValue }, operator.sig.unlockP2PKH())
    .addOutput({ to: rec, amount: 0n })
    .addOutput({ to: operator.address, amount: startValue - FEE.result });
}

export function buildManifest({ provider, utxo, operator, payload }) {
  return new TransactionBuilder({ provider }).addInput(utxo, operator.sig.unlockP2PKH())
    .addOutput({ to: toOpReturn(payload), amount: 0n })
    .addOutput({ to: operator.address, amount: utxo.satoshis - FEE.manifest });
}

export { fs };
