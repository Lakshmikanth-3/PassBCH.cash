import React from 'react';

const short = (t) => `${t.slice(0, 8)}…${t.slice(-6)}`;

function Step({ label, txid, explorer, note, pending }) {
  return (
    <li className={`step ${pending ? 'pending' : 'done'}`}>
      <span className="dot" aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        {txid
          ? <a className="mono" href={explorer(txid)} target="_blank" rel="noreferrer">{short(txid)}</a>
          : <span className="muted mono">not yet sealed</span>}
        {note && <p className="muted small">{note}</p>}
      </div>
    </li>
  );
}

/** Ticket → START → RESULT for one sealed run, each linked to its explorer page. */
export default function RunChain({ run, network, explorer, refund }) {
  const sealed = Boolean(run.result);
  return (
    <div className="card">
      {sealed && (
        <p className={`verdict ${run.pass ? 'pass' : 'fail'}`}>
          {run.pass ? '✅ PASS' : '❌ FAIL'} <span className="mono">{run.slug}</span>
          <span className="muted small"> · exercise #{run.taskIdx} · {run.passed}/{run.total} tests · {run.model} · {run.durationS}s</span>
        </p>
      )}
      <ol className="chain">
        <Step label="Ticket" txid={run.ticket} explorer={explorer} note="Your txid + block hash picked this exercise." />
        <Step label="START" txid={run.start} explorer={explorer}
          note={`Spends the ticket. The covenant only allows this if START names the ticket.${run.startLatencyS ? ` ${run.startLatencyS.toFixed(1)} s after the ticket was seen.` : ''}`} />
        <Step label="RESULT" txid={run.result} explorer={explorer} pending={!sealed} note={sealed ? 'Spends START: the three transactions are linked on-chain.' : 'Not sealed yet. If it never is, this run counts as FAIL.'} />
      </ol>
      {refund && (
        <p className="small muted">
          Refund path also tested: a payer reclaimed a ticket alone after 6 blocks →{' '}
          <a className="mono" href={explorer(refund)} target="_blank" rel="noreferrer">{short(refund)}</a>
        </p>
      )}
      <p className="small"><span className="pill">{network}</span> real transactions, not a mock-up.</p>
    </div>
  );
}
