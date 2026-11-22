#!/usr/bin/env node
// PassBCH.cash launcher: `npx passbch` (play), `npx passbch race <id>` / `join <id>` / `fight <id>` (join a friend).
// It always runs the latest game client from the live site, so the npm package never goes stale.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BASE = process.env.DUEL_URL ?? 'https://passbch-cash.vercel.app';
const file = path.join(tmpdir(), 'passbch.mjs');
try {
  const r = await fetch(`${BASE}/duel.mjs?t=${Date.now()}`, { headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  writeFileSync(file, await r.text());
} catch (e) { console.error(`PassBCH.cash: could not download the game client (${e.message}). Check your internet connection.`); process.exit(1); }
const args = process.argv.slice(2).map((a) => a.replace(/^https?:\/\/[^/]+\/(race|duel|fight)\//, '')); // a pasted link works too
const child = spawn(process.execPath, [file, ...args], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
