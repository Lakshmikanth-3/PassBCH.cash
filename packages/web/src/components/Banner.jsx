import React, { useState } from 'react';

/**
 * BLAZE eligibility banner (always visible): deck, new + old repo, new + old demo, EMBER2026 CashTokens address.
 * We have no pre-hackathon code or demo, so "old" links say so and point at the first commit.
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
          : <span className="muted">Deck: not linked yet</span>}
        <a href={config.repoUrl} target="_blank" rel="noreferrer">Repo</a>
        <a href={config.demoUrl}>Demo</a>
        <span className="muted">
          Old repo / old demo: none. Built from scratch starting 17 Nov 2026 (
          <a href={firstCommitUrl} target="_blank" rel="noreferrer">first commit</a>)
        </span>
        <button className="ember" onClick={copy} title="CashTokens address for EMBER2026 votes">
          EMBER2026: <code>{config.emberAddress.slice(12, 20)}…{config.emberAddress.slice(-6)}</code>
          <span aria-live="polite">{copied ? ' copied' : ' copy'}</span>
        </button>
        {config.network !== 'mainnet' && <span className="pill warn">{config.network}</span>}
      </div>
    </div>
  );
}
