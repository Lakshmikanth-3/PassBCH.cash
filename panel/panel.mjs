#!/usr/bin/env node
// PassBCH.cash panel for Claude Code: "play while your AI thinks".
//   node panel/panel.mjs feed         background: polls passbch-cash.vercel.app, writes ~/.passbch/panel.json
//   node panel/panel.mjs statusline   Claude Code statusLine command (fast, never throws)
//   node panel/panel.mjs hook prompt  UserPromptSubmit hook  (Claude started thinking)
//   node panel/panel.mjs hook stop    Stop hook               (Claude finished)
//   node panel/panel.mjs install [dir] registers all of the above in <dir>/.claude/settings.local.json
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.PASSBCH_URL ?? 'https://passbch-cash.vercel.app';
const HOME = process.env.PASSBCH_HOME ?? path.join(os.homedir(), '.passbch');
const read = (n) => { try { return JSON.parse(fs.readFileSync(path.join(HOME, n), 'utf8')); } catch { return null; } };
const write = (n, v) => { fs.mkdirSync(HOME, { recursive: true }); const t = path.join(HOME, `${n}.${process.pid}`); fs.writeFileSync(t, JSON.stringify(v)); fs.renameSync(t, path.join(HOME, n)); };
const now = () => Math.floor(Date.now() / 1000);
const C = (n) => (s) => (process.env.NO_COLOR ? s : `\x1b[${n}m${s}\x1b[0m`);
const bold = C(1), dim = C(2), green = C(32), red = C(31), yellow = C(33), cyan = C(36);
const short = (m) => String(m ?? '').replace('openai/', '');
const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/** One or two lines for the status bar. Pure: takes the cached state, the thinking flag and the clock. */
export function render(state, thinking, t = now()) {
  if (!state) return dim('🎲 PassBCH.cash: start the feed → node panel/panel.mjs feed');
  const { ai, price } = state;
  let line;
  const cur = ai?.current;
  if (cur) {
    const rec = ai.records?.[cur.model] ?? { passPct: 190, failPct: 190 };
    const left = Number(cur.bet_close_s) - (t + (state.skew ?? 0));
    line = cur.status === 'open' && left > 0
      ? `🤖 ${bold(short(cur.model))} vs ${cyan(`"${cur.slug}"`)} ${yellow('● BETTING')} ${mmss(left)} · PASS ${green((rec.passPct / 100).toFixed(2) + 'x')} | FAIL ${red((rec.failPct / 100).toFixed(2) + 'x')}`
      : `🤖 ${bold(short(cur.model))} is coding ${cyan(`"${cur.slug}"`)} ${yellow('✻ live')}`;
  } else if (ai?.recent?.[0]) {
    const r = ai.recent[0];
    line = `🤖 ${bold(short(r.model))} vs ${cyan(`"${r.slug}"`)} ${r.status === 'void' ? dim('void') : r.pass ? green(`✅ PASS ${r.passed}/${r.total}`) : red(`❌ FAIL ${r.passed}/${r.total}`)} ${dim('· next exam soon')}`;
  } else line = dim('🤖 AI arena warming up');
  if (price?.price) line += `  ${dim('│')} 📈 BCH $${price.price.toFixed(2)}`;
  if (t - state.updated > 120) line += dim(' (feed offline)');
  if (!thinking) return line;
  return `${line}\n${dim(`✻ Claude thinking ${mmss(t - thinking.since)} · play now →`)} ${bold(BASE.replace('https://', ''))} ${dim('or')} ${bold('irm ' + BASE.replace('https://', '') + '/play.ps1 | iex')}`;
}

async function feed() {
  console.log(`PassBCH.cash panel feed → ${HOME}/panel.json (Ctrl+C to stop)`);
  for (;;) {
    try {
      const [ai, price] = await Promise.all([fetch(`${BASE}/api/duel?a=ai`).then((r) => r.json()), fetch(`${BASE}/api/duel?a=price`).then((r) => r.json()).catch(() => null)]);
      write('panel.json', { ai, price, updated: now(), skew: (ai.now ?? now()) - now() });
    } catch (e) { console.log(`feed: ${e.message}`); }
    await new Promise((r) => setTimeout(r, 4000));
  }
}

function install(dir) {
  const self = fileURLToPath(import.meta.url).replace(/\\/g, '/');
  const node = process.execPath.replace(/\\/g, '/');
  const cmd = (a) => `"${node}" "${self}" ${a}`;
  const file = path.join(path.resolve(dir ?? process.cwd()), '.claude', 'settings.local.json');
  let s = {}; try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* new */ }
  const mine = (h) => JSON.stringify(h).includes('panel.mjs') || JSON.stringify(h).includes('/panel/bin/');
  s.statusLine = { type: 'command', command: cmd('statusline'), padding: 0 };
  s.hooks ??= {};
  for (const [ev, arg] of [['UserPromptSubmit', 'hook prompt'], ['Stop', 'hook stop']]) {
    s.hooks[ev] = [...(s.hooks[ev] ?? []).filter((h) => !mine(h)), { hooks: [{ type: 'command', command: cmd(arg), timeout: 5 }] }];
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
  console.log(`Installed in ${file}\nNext: run "node ${self} feed" in another terminal, then restart Claude Code.`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'statusline') {
  process.stdin.resume(); process.stdin.on('data', () => {});
  try { process.stdout.write(render(read('panel.json'), read('thinking.json'))); } catch (e) { process.stdout.write(`🎲 PassBCH.cash panel: ${e.message}`); }
  process.exit(0);
} else if (cmd === 'hook') {
  process.stdin.resume(); process.stdin.on('data', () => {});
  try { if (arg === 'prompt') write('thinking.json', { since: now() }); else fs.rmSync(path.join(HOME, 'thinking.json'), { force: true }); } catch { /* never block Claude */ }
  process.exit(0);
} else if (cmd === 'feed') feed();
else if (cmd === 'install') install(arg);
else if (cmd) { console.log('usage: panel.mjs feed | statusline | hook prompt|stop | install [dir]'); }
