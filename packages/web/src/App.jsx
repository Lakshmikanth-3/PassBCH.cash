import React from 'react';
import Banner from './components/Banner.jsx';
import Hero from './components/Hero.jsx';
import RunChain from './components/RunChain.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import HowItWorks from './components/HowItWorks.jsx';
import { CONFIG, T1_CHAIN } from './config.js';

export default function App() {
  return (
    <>
      <Banner config={CONFIG} />
      <main className="wrap">
        <Hero network={CONFIG.network} ticketSats={CONFIG.ticketSats} />
        <section aria-labelledby="chain-h" className="section">
          <h2 id="chain-h">Latest real run chain</h2>
          <RunChain chain={T1_CHAIN} explorer={CONFIG.explorerTx[T1_CHAIN.network]} />
        </section>
        <section aria-labelledby="lb-h" className="section">
          <h2 id="lb-h">Leaderboard</h2>
          <Leaderboard rows={[]} />
        </section>
        <HowItWorks />
      </main>
      <footer className="wrap foot">
        Independent; not affiliated with any AI vendor or Exercism. Exercises: exercism/python (MIT).
      </footer>
    </>
  );
}
