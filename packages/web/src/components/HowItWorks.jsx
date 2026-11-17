import React from 'react';

export default function HowItWorks() {
  return (
    <section aria-labelledby="how-h" className="section grid2">
      <div className="card">
        <h2 id="how-h">What the chain proves</h2>
        <ul>
          <li>Which exam was chosen, and that it came from a list committed beforehand.</li>
          <li>That we committed the START before being paid and before the result.</li>
          <li>That every started run has a sealed result or counts as a FAIL.</li>
        </ul>
      </div>
      <div className="card">
        <h2>What it does NOT prove</h2>
        <ul>
          <li>That the transcript is genuine.</li>
          <li>That no hidden parallel attempt ran after START. Ticket→START latency is shown so you can judge.</li>
        </ul>
      </div>
    </section>
  );
}
