// Operator configuration. Network stays 'chipnet' until final submission (team rule).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(PKG, '..', '..');
export const NETWORK = process.env.PASSRATE_NETWORK || 'chipnet';
if (NETWORK !== 'chipnet') throw new Error('mainnet is locked until final submission');

export const TICKET_SATS = 20000n;
export const NOTIFY_SATS = 546n;           // dust output to the operator inbox: makes tickets discoverable on-chain
export const DOUBLE_SPEND_WAIT_MS = 2500;  // PRD §20 #3
export const RUN_DEADLINE_S = 600;         // START + 10 min
export const ATTEMPT_POLICY = 2;           // 1 attempt + 1 retry
export const TIP_MAX_AGE = 2;              // ticket tip must be within 2 blocks of the tip when first seen
export const FEE = { ticket: 800n, start: 700n, result: 600n, manifest: 500n };

// Leaderboard rows: agentIdx in TICKET selects a row; row fixes the model.
export const ROSTER = [
  { agentIdx: 0, agent: 'passrate-agent', model: 'openai/gpt-oss-20b', modelIdx: 0 },
  { agentIdx: 1, agent: 'passrate-agent', model: 'openai/gpt-oss-120b', modelIdx: 1 },
];

export const PATHS = {
  keys: path.join(REPO, 'keys', 't1-keys.json'),     // chipnet operator + test-payer keys (gitignored)
  state: path.join(REPO, 'keys', 'operator-state.json'),
  runs: path.join(REPO, 'packages', 'operator', 'runs'),
  contract: path.join(REPO, 'packages', 'feasibility', 'contracts', 'RunTicket.cash'),
  t3: path.join(REPO, 'test-reports', 't3-docker.json'),
  exercises: path.join(REPO, 'packages', 'harness', '.cache', 'exercism-python', 'exercises', 'practice'),
  harness: path.join(REPO, 'packages', 'harness'),
  webPublic: path.join(REPO, 'packages', 'web', 'public'),
};

export function loadState() {
  try { return JSON.parse(fs.readFileSync(PATHS.state, 'utf8')); } catch { return { runs: {} }; }
}
export function saveState(s) { fs.writeFileSync(PATHS.state, JSON.stringify(s, null, 1)); }
