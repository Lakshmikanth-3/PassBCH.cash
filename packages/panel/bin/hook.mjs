#!/usr/bin/env node
// Claude Code hook: `hook.mjs prompt` on UserPromptSubmit, `hook.mjs stop` on Stop.
// Marks when Claude starts and stops thinking so the panel can show the call to action.
import { writeJson, remove } from '../src/store.js';

process.stdin.resume(); process.stdin.on('data', () => {});
const what = process.argv[2];
try {
  if (what === 'prompt') writeJson('thinking.json', { sinceUnix: Math.floor(Date.now() / 1000) });
  else if (what === 'stop') remove('thinking.json');
} catch { /* a hook must never block Claude */ }
process.exit(0);
