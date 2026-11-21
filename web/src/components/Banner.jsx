import React, { useState } from 'react';

/**
 * BLAZE eligibility banner (home page): deck, GitHub, EMBER2026 CashTokens address, and the build-window statement.
 * The deck link and EMBER address come from the API (env DECK_URL / EMBER_ADDRESS); config.js holds the fallbacks.
 */
export default function Banner({ config }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(config.emberAddress); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  const firstCommitUrl = `${config.repoUrl}/commit/${config.firstCommit}`;
  return (
    <div className="banner" role="banner">
      <div className="wrap banner-row">
        {config.deckUrl
          ? <a href={config.deckUrl} target="_blank" rel="noreferrer">Deck</a>
          : <span className="muted">Deck</span>}
        <a href={config.repoUrl} target="_blank" rel="noreferrer">GitHub</a>
        <button className="ember" onClick={copy} title="CashTokens address for EMBER2026 votes">
          Vote with EMBER2026: <code>{config.emberAddress.slice(12, 20)}…{config.emberAddress.slice(-6)}</code>
          <span aria-live="polite">{copied ? ' copied' : ' copy'}</span>
        </button>
        <span className="muted">
          Built during BCH BLAZE 2026 (all code written during BLAZE, from 17 Nov;{' '}
          <a href={firstCommitUrl} target="_blank" rel="noreferrer">first commit</a>)
        </span>
        {config.network !== 'mainnet' && <span className="pill warn">{config.network}</span>}
      </div>
    </div>
  );
}
