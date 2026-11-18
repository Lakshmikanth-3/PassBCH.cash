#!/usr/bin/env node
// Claude Code statusLine command. Claude Code pipes session JSON on stdin; we only need the clock.
// Must be fast and must never crash: it reads two small cache files and prints.
import { readJson } from '../src/store.js';
import { renderPanel } from '../src/render.js';

process.stdin.resume(); process.stdin.on('data', () => {}); // drain stdin; content unused
try {
  const nowUnix = Math.floor(Date.now() / 1000);
  const color = !process.env.NO_COLOR;
  process.stdout.write(renderPanel({ state: readJson('round.json'), thinking: readJson('thinking.json'), nowUnix, color }));
} catch (e) {
  process.stdout.write(`🎲 PassRate panel error: ${e.message}`);
}
process.exit(0);
