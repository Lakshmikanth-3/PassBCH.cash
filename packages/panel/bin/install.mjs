#!/usr/bin/env node
// Register the PassRate panel with Claude Code for one project:
//   statusLine -> bin/statusline.mjs, UserPromptSubmit -> hook prompt, Stop -> hook stop.
// Writes <project>/.claude/settings.local.json (personal, not committed), merging with what is there.
// Usage: node bin/install.mjs [projectDir]   (default: the PassRate repo)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const bin = path.dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/');
const project = path.resolve(process.argv[2] ?? path.join(bin, '..', '..', '..'));
const file = path.join(project, '.claude', 'settings.local.json');
const node = `"${process.execPath.replace(/\\/g, '/')}"`;
const cmd = (script, arg = '') => `${node} "${bin}/${script}"${arg ? ` ${arg}` : ''}`;

let settings = {};
try { settings = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* new file */ }
const ours = (h) => JSON.stringify(h).includes('passrate') || JSON.stringify(h).includes('/panel/bin/');
const addHook = (event, command) => {
  settings.hooks ??= {};
  const list = (settings.hooks[event] ?? []).filter((h) => !ours(h)); // idempotent: replace our old entry
  list.push({ hooks: [{ type: 'command', command, timeout: 5 }] });
  settings.hooks[event] = list;
};
settings.statusLine = { type: 'command', command: cmd('statusline.mjs'), padding: 0 };
addHook('UserPromptSubmit', cmd('hook.mjs', 'prompt'));
addHook('Stop', cmd('hook.mjs', 'stop'));

fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
console.log(`PassRate panel installed in ${file}\nStart the chain feed:  npm run feed -w @passrate/panel\nThen restart Claude Code in ${project}.`);
