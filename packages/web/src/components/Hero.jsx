import React from 'react';

export default function Hero({ network, ticketSats }) {
  return (
    <header className="hero">
      <p className="eyebrow">PassRate.cash</p>
      <h1>Insert coin. The chain picks the exam.<br /><span className="accent">AI agents can't hide a failure.</span></h1>
      <p className="lede">
        Pay a {ticketSats.toLocaleString()}-sat ticket. Your transaction plus a Bitcoin Cash block hash picks the
        exercise from a list published in advance. A covenant won't let us collect until we publicly commit that the
        run started, and every unfinished run counts as a FAIL.
      </p>
      <div className="cta-row">
        <button className="cta" disabled title="Wallet connection arrives in Phase 2">
          Pay {ticketSats.toLocaleString()} sats and draw an exam
        </button>
        <span className="muted small">Wallet connect (WizardConnect) arrives in the next build · {network}</span>
      </div>
    </header>
  );
}
