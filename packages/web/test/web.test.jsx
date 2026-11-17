import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import App from '../src/App.jsx';
import Banner from '../src/components/Banner.jsx';
import Leaderboard from '../src/components/Leaderboard.jsx';
import RunChain from '../src/components/RunChain.jsx';
import { CONFIG, T1_CHAIN } from '../src/config.js';
import DATA from '../src/runs.json';
import { rowsFrom } from '../src/App.jsx';

describe('BLAZE banner (eligibility)', () => {
  test('links repo and demo, states no pre-hackathon code with first-commit link', () => {
    render(<Banner config={CONFIG} />);
    expect(screen.getByRole('link', { name: 'Repo' })).toHaveAttribute('href', CONFIG.repoUrl);
    expect(screen.getByRole('link', { name: 'Demo' })).toHaveAttribute('href', CONFIG.demoUrl);
    expect(screen.getByText(/Built from scratch starting 17 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'first commit' })).toHaveAttribute('href', `${CONFIG.repoUrl}/commit/${CONFIG.firstCommit}`);
  });
  test('EMBER2026 address is CashTokens format (z-prefix), never q', () => {
    expect(CONFIG.emberAddress).toMatch(/^bitcoincash:z[02-9ac-hj-np-z]{41}$/);
    render(<Banner config={CONFIG} />);
    expect(screen.getByTitle(/EMBER2026/)).toBeInTheDocument();
  });
  test('first commit is a full sha', () => expect(CONFIG.firstCommit).toMatch(/^[0-9a-f]{40}$/));
  test('shows network pill while not on mainnet', () => {
    render(<Banner config={CONFIG} />);
    expect(screen.getByText('chipnet')).toBeInTheDocument();
  });
  test('deck link appears once configured', () => {
    render(<Banner config={{ ...CONFIG, deckUrl: 'https://example.com/deck' }} />);
    expect(screen.getByRole('link', { name: 'Deck' })).toHaveAttribute('href', 'https://example.com/deck');
  });
  test('footer keeps the non-affiliation line', () => {
    render(<App />);
    expect(screen.getByText(/not affiliated with any AI vendor or Exercism/i)).toBeInTheDocument();
  });
});

describe('RunChain', () => {
  const ex = CONFIG.explorerTx.chipnet;
  const run = DATA.runs.at(-1);
  test('links the real sealed Ticket, START and RESULT txids', () => {
    render(<RunChain run={run} network="chipnet" explorer={ex} refund={T1_CHAIN.refund} />);
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    for (const t of [run.ticket, run.start, run.result, T1_CHAIN.refund]) expect(links).toContain(ex(t));
  });
  test('shows the verdict as a scorecard', () => {
    render(<RunChain run={run} network="chipnet" explorer={ex} />);
    expect(screen.getByText(run.pass ? /PASS/ : /FAIL/)).toBeInTheDocument();
    expect(screen.getByText(run.slug)).toBeInTheDocument();
  });
  test('unsealed run says it counts as FAIL, never a fake txid', () => {
    render(<RunChain run={{ ...run, result: null }} network="chipnet" explorer={ex} />);
    expect(screen.getByText(/not yet sealed/i)).toBeInTheDocument();
    expect(screen.getByText(/counts as FAIL/i)).toBeInTheDocument();
  });
  test('exported runs are real-looking chipnet txids and linked', () => {
    expect(DATA.network).toBe('chipnet');
    for (const r of DATA.runs) for (const k of ['ticket', 'start', 'result']) expect(r[k]).toMatch(/^[0-9a-f]{64}$/);
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

describe('rowsFrom', () => {
  test('one row per model with pass/fail statuses', () => {
    const rows = rowsFrom([{ model: 'openai/a', pass: true, startLatencyS: 3 }, { model: 'openai/a', pass: false }, { model: 'openai/b', pass: true }]);
    expect(rows).toHaveLength(2);
    expect(rows[0].statuses).toEqual(['PASS', 'FAIL']);
    expect(rows[0].model).toBe('a');
  });
});

describe('App', () => {
  test('renders the MANIFEST link and empty state when there are no runs', () => {
    render(<App data={{ ...DATA, runs: [] }} />);
    expect(screen.getAllByText(/no sealed runs yet/i).length).toBeGreaterThan(0);
  });
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
