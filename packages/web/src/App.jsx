import React from 'react';
import Banner from './components/Banner.jsx';
import Hero from './components/Hero.jsx';
import RunChain from './components/RunChain.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import HowItWorks from './components/HowItWorks.jsx';
import { CONFIG, T1_CHAIN } from './config.js';
import DATA from './runs.json';

/** Group sealed ticket runs into one row per model. */
export function rowsFrom(runs) {
  const by = new Map();
  for (const r of runs) {
    const k = r.model;
    if (!by.has(k)) by.set(k, { agent: 'passrate-agent', model: k.replace('openai/', ''), lane: 'public', statuses: [], latencies: [] });
    const row = by.get(k);
    row.statuses.push(r.pass ? 'PASS' : 'FAIL');
    if (r.startLatencyS != null) row.latencies.push(r.startLatencyS);
  }
  return [...by.values()];
}

export default function App({ data = DATA }) {
  const latest = data.runs.at(-1);
  const explorer = CONFIG.explorerTx[data.network];
  return (
    <>
      <Banner config={CONFIG} />
      <main className="wrap">
        <Hero network={CONFIG.network} ticketSats={CONFIG.ticketSats} />
        <section aria-labelledby="chain-h" className="section">
          <h2 id="chain-h">Latest real run chain</h2>
          {latest
            ? <RunChain run={latest} network={data.network} explorer={explorer} refund={T1_CHAIN.refund} />
            : <div className="card empty"><p>No sealed runs yet.</p></div>}
          <p className="small muted">
            Exam list committed on-chain in MANIFEST{' '}
            <a className="mono" href={explorer(data.manifestTxid)} target="_blank" rel="noreferrer">{data.manifestTxid.slice(0, 8)}…</a>
            {' '}({data.taskCount} exercises, root <span className="mono">{data.taskRoot.slice(0, 10)}…</span>)
          </p>
        </section>
        <section aria-labelledby="lb-h" className="section">
          <h2 id="lb-h">Leaderboard</h2>
          <p className="small muted">Ticket runs so far. The official board uses scheduled runs every {CONFIG.scheduleEvery} blocks (coming next).</p>
          <Leaderboard rows={rowsFrom(data.runs)} />
        </section>
        <HowItWorks />
      </main>
      <footer className="wrap foot">
        Independent; not affiliated with any AI vendor or Exercism. Exercises: exercism/python (MIT).
      </footer>
    </>
  );
}
