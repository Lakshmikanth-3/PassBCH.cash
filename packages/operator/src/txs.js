// Transaction builders and ticket validation. Pure where possible so they run against MockNetworkProvider.
import fs from 'node:fs';
import { compileFile } from 'cashc';
import { TransactionBuilder } from '@passrate/shared/tickettx';
import { decodeTransaction, hexToBin, binToHex, cashAddressToLockingBytecode } from '@bitauth/libauth';
import { encodePayload, toOpReturn, fromOpReturn, drawTicketTask, isTipFresh } from '@passrate/shared';
import { NETWORK, PATHS, TICKET_SATS, NOTIFY_SATS, FEE, ROSTER, RUN_DEADLINE_S, ATTEMPT_POLICY, TIP_MAX_AGE } from './config.js';

import { runTicketContract, buildTicket as sharedBuildTicket, RUN_TICKET_ARTIFACT } from '@passrate/shared/tickettx';
export { runTicketContract };

/** The committed artifact must match a fresh compile of RunTicket.cash (guards against drift). */
export function artifactMatchesSource() {
  return compileFile(PATHS.contract).bytecode === RUN_TICKET_ARTIFACT.bytecode;
}

const lockOf = (address) => {
  const r = cashAddressToLockingBytecode(address);
  if (typeof r === 'string') throw new Error(r);
  return binToHex(r.bytecode);
};

/** Payer side (same code as the browser): returns a TransactionBuilder for one funding utxo. */
export function buildTicket({ utxo, ...rest }) {
  return sharedBuildTicket({ utxos: [utxo], ...rest }).builder;
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
  const c = runTicketContract(operatorPkHex, rec.payerPk, taskRoot, { network: NETWORK }); // network sets the address prefix
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
