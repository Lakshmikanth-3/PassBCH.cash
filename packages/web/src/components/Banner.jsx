import React, { useState } from 'react';

/** BLAZE-required top banner: deck, repo, EMBER2026 CashTokens address, non-affiliation. */
export default function Banner({ config }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(config.emberAddress); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="banner" role="banner">
      <div className="wrap banner-row">
        {config.deckUrl
          ? <a href={config.deckUrl} target="_blank" rel="noreferrer">Deck</a>
          : <span className="muted">Deck: coming soon</span>}
        <a href={config.repoUrl} target="_blank" rel="noreferrer">Source on GitHub</a>
        <button className="ember" onClick={copy} title="CashTokens address for EMBER2026 votes">
          EMBER2026: <code>{config.emberAddress.slice(12, 20)}…{config.emberAddress.slice(-6)}</code>
          <span aria-live="polite">{copied ? ' ✓ copied' : ' copy'}</span>
        </button>
        <span className="muted hide-sm">Independent; not affiliated with any AI vendor or Exercism</span>
        {config.network !== 'mainnet' && <span className="pill warn">{config.network}</span>}
      </div>
    </div>
  );
}
