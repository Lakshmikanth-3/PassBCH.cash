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

/** Ticket → START → RESULT, each linked to its explorer page. */
export default function RunChain({ chain, explorer }) {
  return (
    <div className="card">
      <ol className="chain">
        <Step label="Ticket" txid={chain.ticket} explorer={explorer} note={`Paid into covenant ${chain.covenant.slice(0, 16)}…`} />
        <Step label="START" txid={chain.start} explorer={explorer} note="Spends the ticket. The covenant only allows this if the START names the ticket." />
        <Step label="RESULT" txid={chain.result} explorer={explorer} pending={!chain.result} note={chain.result ? null : 'Agent harness arrives in Phase 2.'} />
      </ol>
      {chain.refund && (
        <p className="small muted">
          Refund path also tested: payer reclaimed a ticket alone after 6 blocks →{' '}
          <a className="mono" href={explorer(chain.refund)} target="_blank" rel="noreferrer">{short(chain.refund)}</a>
        </p>
      )}
      <p className="small"><span className="pill">{chain.network}</span> real transactions from our Phase 1 test, not a mock-up.</p>
    </div>
  );
}
