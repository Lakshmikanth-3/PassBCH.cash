import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import App from '../src/App.jsx';
import Banner from '../src/components/Banner.jsx';
import Leaderboard from '../src/components/Leaderboard.jsx';
import RunChain from '../src/components/RunChain.jsx';
import { CONFIG, T1_CHAIN } from '../src/config.js';

describe('BLAZE banner (compliance)', () => {
  test('has repo link, EMBER2026 token address and non-affiliation note', () => {
    render(<Banner config={CONFIG} />);
    expect(screen.getByRole('link', { name: /github/i })).toHaveAttribute('href', CONFIG.repoUrl);
    expect(screen.getByTitle(/EMBER2026/)).toBeInTheDocument();
    expect(screen.getByText(/not affiliated/i)).toBeInTheDocument();
  });
  test('EMBER address is token-aware (z-prefix)', () => {
    expect(CONFIG.emberAddress).toMatch(/^bitcoincash:z[02-9ac-hj-np-z]{41}$/);
  });
  test('shows network pill while not on mainnet', () => {
    render(<Banner config={CONFIG} />);
    expect(screen.getByText('chipnet')).toBeInTheDocument();
  });
  test('deck link appears once configured', () => {
    render(<Banner config={{ ...CONFIG, deckUrl: 'https://example.com/deck' }} />);
    expect(screen.getByRole('link', { name: 'Deck' })).toHaveAttribute('href', 'https://example.com/deck');
  });
});

describe('RunChain', () => {
  const ex = CONFIG.explorerTx.chipnet;
  test('links real T1 ticket and START txids to explorer', () => {
    render(<RunChain chain={T1_CHAIN} explorer={ex} />);
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links).toContain(ex(T1_CHAIN.ticket));
    expect(links).toContain(ex(T1_CHAIN.start));
    expect(links).toContain(ex(T1_CHAIN.refund));
  });
  test('RESULT shows as not yet sealed, never as a fake txid', () => {
    render(<RunChain chain={T1_CHAIN} explorer={ex} />);
    expect(screen.getByText(/not yet sealed/i)).toBeInTheDocument();
  });
  test('all txids are 64 hex', () => {
    for (const k of ['ticket', 'start', 'refundTicket', 'refund']) expect(T1_CHAIN[k]).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('Leaderboard', () => {
  test('empty state when no runs', () => {
    render(<Leaderboard rows={[]} />);
    expect(screen.getByText(/no sealed runs yet/i)).toBeInTheDocument();
  });
  test('computes pass rate, CI and counts missing as FAIL', () => {
    render(<Leaderboard rows={[{ agent: 'aider', model: 'llama-3.1-8b', lane: 'public',
      statuses: ['PASS', 'PASS', 'FAIL', 'FAIL_TIMEOUT', 'PENDING'], latencies: [4, 6] }]} />);
    const row = screen.getAllByRole('row')[1];
    const cells = within(row).getAllByRole('cell').map((c) => c.textContent);
    expect(cells[2]).toBe('4');      // n excludes pending
    expect(cells[3]).toBe('50%');    // 2 / 4
    expect(cells[5]).toBe('1');      // missing
    expect(cells[7]).toBe('5.0 s');  // median latency
  });
});

describe('App', () => {
  test('renders hero, chain, leaderboard and honesty sections', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/chain picks the exam/i);
    expect(screen.getByRole('heading', { name: /latest real run chain/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /leaderboard/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /does NOT prove/i })).toBeInTheDocument();
  });
  test('pay button is disabled until wallet connect exists (no dead click)', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /pay 20,000 sats/i })).toBeDisabled();
  });
});
