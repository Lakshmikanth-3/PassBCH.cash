#!/usr/bin/env node
// PassBCH.cash in your terminal. No install, no dependencies: needs Node 18+.
//   PowerShell:  irm https://passbch.vercel.app | iex
//   bash/zsh:    curl -sL passbch.vercel.app | sh
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import readline from 'node:readline';

const BASE = process.env.DUEL_URL ?? 'https://passbch-cash.vercel.app';
const CFG = path.join(os.homedir(), '.passbch.json');
const TTY = !!process.stdout.isTTY && !process.env.NO_COLOR;
const esc = (n) => (s) => (TTY ? `\x1b[${n}m${s}\x1b[0m` : String(s));
const bold = esc(1), dim = esc(2), cyan = esc('38;5;51'), mag = esc('38;5;207'), lime = esc('38;5;154'), red = esc('38;5;204'), gold = esc('38;5;220'), white = esc('97');
const W = () => Math.max(48, Math.min(process.stdout.columns || 80, 92));
const strip = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '');
const width = (s) => [...strip(s)].reduce((n, ch) => n + (/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(ch) ? 2 : ch === '\uFE0F' ? 0 : 1), 0);
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - width(s)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sats = (n) => `${(Number(n ?? 0) / 1e8).toFixed(8).replace(/0+$/, '').replace(/\.$/, '')} BCH`;
export const VERSION = '2026.11.22-5'; // must match CLIENT_VERSION in api/duel.mjs
let NETWORK = 'chipnet';
const CUR = { USD: '$', INR: '₹', JPY: '¥', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$', IDR: 'Rp ', PHP: '₱', NGN: '₦', BRL: 'R$' };
let fxCache = null;
async function rates() { if (fxCache && Date.now() - fxCache.at < 60000) return fxCache.r; const r = await api('rates'); fxCache = { at: Date.now(), r }; return r; }
const ccy = () => cfg.currency || (/IN$/.test(Intl.DateTimeFormat().resolvedOptions().locale) ? 'INR' : 'USD');
function money(n, fx) {
  const c = ccy(); if (!fx?.[c]) return '';
  const v = (Number(n) / 1e8) * fx[c];
  return `≈ ${CUR[c] ?? ''}${v.toLocaleString(undefined, { maximumFractionDigits: v < 1 ? 3 : 2 })}${NETWORK !== 'mainnet' ? ' at mainnet value' : ''}`;
}
const rulesLine = () => dim('Win = the pot · 5% fee only when you withdraw · free bonus must be played 2× before withdrawing · [r] rules');

// ---------- input (works for people typing and for piped input) ----------
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const lines = [], waiters = [];
rl.on('line', (l) => (waiters.length ? waiters.shift()(l) : lines.push(l)));
rl.on('close', () => { while (waiters.length) waiters.shift()('q'); lines.push('q'); });
const ask = (q) => { process.stdout.write(q); return lines.length ? Promise.resolve(lines.shift()) : new Promise((r) => waiters.push(r)); };

// ---------- account ----------
const load = () => { try { return JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch { return {}; } };
const save = (o) => { fs.mkdirSync(path.dirname(CFG), { recursive: true }); fs.writeFileSync(CFG, JSON.stringify(o, null, 2), { mode: 0o600 }); };
let cfg = load();
async function api(a, { body, q = '' } = {}) {
  const r = await fetch(`${BASE}/api/duel?a=${a}${q}`, { method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(cfg.token ? { authorization: `Bearer ${cfg.token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok || j.error) throw new Error(j.error ?? 'request failed'); return j;
}

// ---------- drawing ----------
function box(title, rows, color = cyan) {
  const w = W() - 4;
  const top = color(`╔${'═'.repeat(w + 2)}╗`), bot = color(`╚${'═'.repeat(w + 2)}╝`);
  const t = title ? color('║ ') + bold(pad(title, w)) + color(' ║') : null;
  const sep = color(`╟${'─'.repeat(w + 2)}╢`);
  // Long rows wrap onto the next line (word by word) instead of being cut off.
  const wrap = (r) => {
    if (width(r) <= w) return [r];
    const out = []; let line = '';
    for (const word of strip(r).split(' ')) {
      if (width(line ? line + ' ' + word : word) > w) { if (line) out.push(line); line = word; while (width(line) > w) { out.push(line.slice(0, w)); line = line.slice(w); } }
      else line = line ? line + ' ' + word : word;
    }
    if (line) out.push(line); return out;
  };
  const body = rows.flatMap(wrap).map((r) => color('║ ') + pad(r, w) + color(' ║'));
  console.log([top, ...(t ? [t, sep] : []), ...body, bot].join('\n'));
}
function logo() {
  const art = [
    '██████   █████  ███████ ███████ ██████   ██████ ██   ██',
    '██   ██ ██   ██ ██      ██      ██   ██ ██      ██   ██',
    '██████  ███████ ███████ ███████ ██████  ██      ███████',
    '██      ██   ██      ██      ██ ██   ██ ██      ██   ██',
    '██      ██   ██ ███████ ███████ ██████   ██████ ██   ██',
  ];
  const cols = [cyan, cyan, mag, mag, gold];
  if (W() >= 60) art.forEach((l, i) => console.log('  ' + cols[i](l) + (i === 4 ? dim('  .cash') : '')));
  else console.log('  ' + bold(cyan('◆ PassBCH')) + dim('.cash'));
  console.log(dim('  play while your AI thinks · Bitcoin Cash · every result on chain\n'));
}
/** Redraw a block of lines in place (animation). */
let drawn = 0;
function frame(linesOut) { if (TTY && drawn) process.stdout.write(`\x1b[${drawn}A\x1b[0J`); console.log(linesOut.join('\n')); drawn = linesOut.length; }
const endFrame = () => { drawn = 0; };
const onAir = (cam) => `${red('●')} ${bold('LIVE')} ${dim('│')} ${gold(cam)}`;

// ASCII hands, 5 rows each, drawn facing each other
const HANDS = {
  rock: ['    ____  ', '---(____) ', '  (_____) ', '  (_____) ', '---(___)  '],
  paper: ['    _______ ', '---(_______)', '    ________)', '    ________)', '---(______) '],
  scissors: ['    _______ ', '---(_______)', '    ________)', '   (_____)  ', '---(___)    '],
};
const mirror = (rows) => rows.map((r) => [...r].reverse().join('').replace(/[()]/g, (c) => (c === '(' ? ')' : '(')));

// ---------- screens ----------
async function welcome() {
  console.clear?.(); logo();
  box('Welcome', [
    `${bold('[1]')} ${lime('New player')}   ${dim('— pick a name, get 25,000 free sats')}`,
    `${bold('[2]')} ${cyan('Log in')}       ${dim('— paste the login code from the website Wallet page')}`,
    `${bold('[q]')} Quit`,
  ]);
  const c = (await ask('  > ')).trim().toLowerCase();
  if (c === '1') {
    const name = (await ask('  Player name: ')).trim();
    const ref = (process.argv.find((a) => a.startsWith('--ref='))?.slice(6) ?? (await ask(`  Referral code ${dim('(Enter to skip)')}: `)).trim()) || undefined;
    const r = await api('signup', { body: { name, ref } });
    cfg = { token: r.token, name: r.player.name }; save(cfg);
    box('Account created', [`${lime('✓')} Welcome ${bold(r.player.name)}! Free bonus: ${gold(sats(r.bonusGiven))}${r.referrer ? dim(` (invited by ${r.referrer})`) : ''}`,
      `${dim('Login code (works on the website too):')} ${white(r.token)}`, dim(`Saved in ${CFG} — keep it private.`)], lime);
    return true;
  }
  if (c === '2') {
    const code = (await ask('  Login code: ')).trim();
    cfg = { token: code }; const r = await api('login', { body: { code } }).catch((e) => { cfg = {}; throw new Error(/unknown|not signed/.test(e.message) ? 'that login code is not valid' : e.message); });
    cfg.name = r.player.name; save(cfg);
    box('Logged in', [`${lime('✓')} Welcome back ${bold(r.player.name)} · balance ${gold(sats(r.player.bonus + r.player.cash))}`], lime);
    return true;
  }
  return false;
}

async function home() {
  const [{ player }, fx] = await Promise.all([api('me'), rates().catch(() => null)]);
  console.log('');
  box(`${player.name}   ${gold(sats(player.bonus + player.cash))} ${dim(money(player.bonus + player.cash, fx))}`, [
    dim(`bonus ${sats(player.bonus)} · withdrawable ${sats(player.cash)} · ${NETWORK === 'mainnet' ? 'mainnet' : 'test BCH on chipnet'}`),
    '',
    `${bold(gold('[1]'))} ${bold('Rock · Paper · Scissors')}      ${dim('table with a host · House Bot, friend or open challenges')}`,
    `${bold(cyan('[2]'))} ${bold('Up or Down')}                  ${dim('1-minute BCH price call · pays 1.9×')}`,
    `${bold(lime('[3]'))} ${bold('Prompt Fight')}                ${dim('your prompt trains an AI agent · it fights live')}`,
    `${bold(gold('[4]'))} ${bold('Coin Flip')}                   ${dim('heads or tails · house seed locked first · pays 1.9×')}`,
    `${bold(cyan('[5]'))} ${bold('Typing Race')}                ${dim('type a phrase faster than the House Bot · pays 1.9×')}`,
    `${bold(mag('[6]'))} ${dim('Upcoming BCH games — coming soon')}`,
    '',
    `${bold('[w]')} Vault   ${bold('[l]')} Winners worldwide   ${bold('[p]')} Player profile   ${bold('[v]')} Verify a result`,
    `${bold('[r]')} Rules & fees   ${bold('[o]')} Log out   ${bold('[q]')} Quit`,
  ]);
  return (await ask('  > ')).trim().toLowerCase();
}

async function pickStake(rules) {
  const s = (await ask(`  Stake ${dim(rules.stakes.map((x, i) => `[${i + 1}] ${sats(x)}`).join('  '))} ${dim(`or type an amount in BCH (min ${sats(rules.minStake)}, max ${sats(rules.maxStake)})`)}: `)).trim();
  if (/^[1-9]$/.test(s) && rules.stakes[Number(s) - 1]) return rules.stakes[Number(s) - 1];
  const custom = Math.round(Number(s.replace(/bch/i, '')) * 1e8);
  if (Number.isFinite(custom) && custom >= rules.minStake && custom <= rules.maxStake) return custom;
  console.log(dim(`  using ${sats(rules.stakes[0])}`)); return rules.stakes[0];
}
async function pickMove() {
  for (;;) {
    const m = (await ask(`  Your move ${dim('[r]ock ✊  [p]aper ✋  [s]cissors ✌️')}: `)).trim().toLowerCase();
    const mv = ['rock', 'paper', 'scissors'].find((x) => x[0] === m[0]); if (mv) return mv;
  }
}

/** The table show: host counts, hands shake, cameras cut, winner revealed. */
async function tableShow(meName, them, myMove, theirMove, result) {
  const cams = ['CAM 1 · WIDE', 'CAM 2 · HANDS', 'CAM 3 · HOST'];
  const call = ['ROCK…', 'PAPER…', 'SCISSORS…'];
  for (let i = 0; i < 6 && TTY; i++) {
    const up = i % 2 === 0; const L = HANDS.rock, R = mirror(HANDS.rock);
    frame(['', `  ${onAir(cams[Math.floor(i / 2) % 3])}`, `            ${gold('🎩 Host:')} ${bold(call[Math.floor(i / 2)])}`, up ? '' : '\n',
      ...L.map((l, k) => `   ${cyan(pad(l, 14))}            ${mag(R[k])}`), up ? '\n' : '', `   ${cyan(pad(meName, 14))}            ${mag(them)}`]);
    await sleep(260);
  }
  const L = HANDS[myMove], R = mirror(HANDS[theirMove]);
  const verdict = result === 0 ? gold('🤝 DRAW — stakes returned') : result === 1 ? lime(bold('🏆 YOU WIN!')) : red('💀 YOU LOSE');
  frame(['', `  ${onAir(result === 1 ? 'CAM 2 · YOU' : result === 2 ? 'CAM 2 · OPPONENT' : 'CAM 1 · WIDE')}`, `            ${gold('🎩 Host:')} ${bold('SHOOT!')}`, '',
    ...L.map((l, k) => `   ${cyan(pad(l, 14))}            ${mag(R[k])}`), '', `   ${cyan(pad(`${meName}: ${myMove}`, 22))}    ${mag(`${them}: ${theirMove}`)}`, '', `   ${verdict}`]);
  endFrame();
  if (result === 1 && TTY) { for (let i = 0; i < 3; i++) { process.stdout.write('   ' + ['✨', '🎉', '💰'].map((x) => x.repeat(4)).join(' ') + '\r'); await sleep(250); process.stdout.write(' '.repeat(40) + '\r'); await sleep(120); } console.log('   🎉🎉🎉 confetti! 🎉🎉🎉'); }
}

async function rps(rules) {
  const open = await api('open').catch(() => []);
  box('Rock · Paper · Scissors', [`${bold('[1]')} Play the House Bot   ${bold('[2]')} Challenge a friend (share link)   ${bold('[3]')} Join by link or id`,
    `${bold('[4]')} Accept an open challenge ${dim(`(${open.length} waiting)`)}`,
    dim('Your move is locked as a hash before anyone plays. Not revealing in 2 min = you lose.'), rulesLine()], gold);
  const c = (await ask('  > ')).trim();
  if (c === '3') return join((await ask('  Duel link or id: ')).trim().split(/duel[=/]/).pop());
  if (c === '4') {
    if (!open.length) return console.log(dim('  No open challenges right now — create one with [2].'));
    box('Open challenges', open.slice(0, 9).map((o, i) => `${bold(`[${i + 1}]`)} ${o.name} challenges anyone · ${gold(sats(o.stake))}`), gold);
    const pick = open[Number((await ask('  Accept which? ')).trim()) - 1];
    return pick ? join(pick.id) : undefined;
  }
  if (c !== '1' && c !== '2') return;
  const move = await pickMove(); const stake = await pickStake(rules);
  const salt = randomBytes(16).toString('hex'); const commit = createHash('sha256').update(`${move}:${salt}`).digest('hex');
  const { id } = await api('create', { body: { stake, commit, vsBot: c === '1' } });
  if (c === '2') box('Challenge created', [`Send this link: ${bold(cyan(`${BASE}/duel/${id}`))}`, dim('Friend in a terminal? Copy one of the lines below (they sit outside the box).')], cyan);
  if (c === '2') console.log(`
  Windows PowerShell:

irm ${BASE}/duel/${id} | iex

  Mac / Linux:

curl -sL ${BASE}/duel/${id} | sh
`);
  let spin = 0;
  for (;;) {
    const d = await api('duel', { q: `&id=${id}` });
    if (d.status === 'awaiting_reveal') {
      const r = await api('reveal', { body: { id, move, salt } }); endFrame();
      await tableShow(cfg.name ?? 'You', d.bName, move, d.bMove, r.result);
      for (let k = 0; k < 15; k++) { const f = await api('duel', { q: `&id=${id}` }); if (f.recordTxid) { console.log(dim(`   on-chain record: ${f.recordTxid}`)); break; } await sleep(2000); }
      return;
    }
    if (d.status === 'settled' || d.status === 'expired') { endFrame(); console.log(`  duel ${d.status}: ${d.settleReason}`); return; }
    frame([`  ${dim('waiting for an opponent')} ${'⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'[spin++ % 10]}`]); await sleep(1500);
  }
}

async function join(id) {
  const d = await api('duel', { q: `&id=${id}` });
  if (d.status !== 'open') return console.log(red(`  That duel is ${d.status}.`));
  box(`${d.aName} challenges you for ${sats(d.stake)}`, [`Their move is locked: ${dim(d.aCommit.slice(0, 16) + '…')}`], mag);
  const move = await pickMove(); await api('join', { body: { id, move } });
  let spin = 0;
  for (;;) {
    const f = await api('duel', { q: `&id=${id}` });
    if (f.status === 'settled') { endFrame(); await tableShow(cfg.name ?? 'You', d.aName, move, f.aMove ?? 'rock', f.result === 0 ? 0 : f.result === 2 ? 1 : 2); return; }
    frame([`  ${dim(`waiting for ${d.aName} to reveal`)} ${'⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'[spin++ % 10]}`]); await sleep(1500);
  }
}

const SPARK = '▁▂▃▄▅▆▇█';
const spark = (xs) => { const lo = Math.min(...xs), hi = Math.max(...xs), s = Math.max(1e-9, hi - lo); return xs.map((x, i) => { const ch = SPARK[Math.round(((x - lo) / s) * 7)]; return i && x < xs[i - 1] ? red(ch) : lime(ch); }).join(''); };

async function updown(rules) {
  const p = await api('price', { q: '&history=1' });
  const hist = [...(p.history ?? []), p.price];
  const round = rules.updownRoundS ?? 60;
  box('Up or Down · BCH/USD', [
    `${bold(white('$' + p.price.toFixed(2)))}   ${spark(hist)}   ${dim('last 12 min')}`,
    `tap UP or DOWN · result in exactly ${bold(gold('1 minute'))} · a right call pays ${lime('1.9×')} · same price = refund`,
    dim('Entry = price when you confirm. Exit = public Coinbase trade price 60 s later.'),
  ], cyan);
  const side = (await ask(`  ${lime(bold('[u] ▲ UP'))}    ${red(bold('[d] ▼ DOWN'))}   ${dim('[Enter] back')}: `)).trim().toLowerCase()[0];
  if (side !== 'u' && side !== 'd') return;
  const stake = await pickStake(rules);
  const ok = (await ask(`  Confirm ${side === 'u' ? lime('▲ UP') : red('▼ DOWN')} for ${gold(sats(stake))}? ${dim('[y/N]')} `)).trim().toLowerCase();
  if (ok !== 'y') return console.log(dim('  cancelled'));
  const b = await api('bet', { body: { side: side === 'u' ? 'up' : 'down', stake } });
  const entry = Number(b.entryPrice); const pts = [entry];
  for (;;) {
    const m = (await api('bets')).mine.find((x) => x.id === b.id);
    if (m?.outcome) {
      endFrame();
      box(m.outcome === 'win' ? 'YOU WIN' : m.outcome === 'lose' ? 'YOU LOSE' : 'SAME PRICE — REFUND', [
        `entry $${Number(m.open_price).toFixed(2)} → exit $${Number(m.close_price).toFixed(2)}  ${m.result === 'up' ? lime('▲ UP') : m.result === 'down' ? red('▼ DOWN') : 'flat'}`,
        m.outcome === 'win' ? lime(`+${sats(m.payout)}`) : m.outcome === 'lose' ? red(`-${sats(stake)}`) : 'stake refunded'], m.outcome === 'win' ? lime : m.outcome === 'lose' ? red : gold);
      return;
    }
    const q = await api('price').catch(() => null); if (q) pts.push(q.price); if (pts.length > 40) pts.shift();
    const nowS = Math.floor(Date.now() / 1000); const left = b.roundEnd - nowS; const cur = pts[pts.length - 1];
    const winning = side === 'u' ? cur > entry : cur < entry;
    const bar = '█'.repeat(Math.max(0, Math.round(((round - Math.max(0, left)) / round) * 30))).padEnd(30, '░');
    frame([
      `  ${side === 'u' ? lime('▲ UP') : red('▼ DOWN')} ${sats(stake)} · entry ${bold('$' + entry.toFixed(2))} · now ${bold('$' + cur.toFixed(2))} ${cur === entry ? gold('level') : winning ? lime('winning') : red('losing')}`,
      `  ${gold(bar)} ${left > 0 ? bold(`${left}s`) : dim('settling…')}`,
      `  ${spark(pts)}`,
    ]);
    await sleep(2000);
  }
}

// two robots trading punches
const BOT = { idle: [' [o_o] ', ' /|_|\\ ', '  / \\  '], punch: [' [o_o] ', ' /|_|==●', '  / \\  '], hit: [' [x_x] ', ' \\|_|/ ', '  / \\  '], win: [' \\[^_^]/', '   |_|  ', '  / \\  '], down: ['        ', '        ', ' _[x_x]_'] };
const flipBot = (rows) => rows.map((r) => [...r].reverse().join('').replace(/[\\/[\]()]/g, (c) => ({ '\\': '/', '/': '\\', '[': ']', ']': '[' }[c] ?? c)));

const EXAMPLES = [
  'Always leave the total so that (target - total) is a multiple of (max step + 1). If you cannot, add 1.',
  'Count backwards from the target in steps of (max step + 1) and always land on one of those numbers.',
];

/** Replay a finished fight as a live ring-side show: a counter, punches, then the winner. */
async function fightShow(m) {
  const A = (m.aName ?? 'Agent A').slice(0, 12), B = (m.bName ?? 'Agent B').slice(0, 12);
  box(`Prompt Fight · Race to ${m.target} · add 1 to ${m.maxStep}`, [`${cyan(A)} vs ${mag(B)} · ${(m.first === 'a' ? A : B)} moves first`], lime);
  for (const t of m.turns) {
    const att = t.side === 'a' ? BOT.punch : BOT.idle, def = t.side === 'a' ? flipBot(BOT.hit) : flipBot(BOT.punch);
    const L = t.side === 'a' ? att : BOT.hit, R = t.side === 'a' ? def : flipBot(BOT.punch);
    const bar = '█'.repeat(Math.round((t.total / m.target) * 24)).padEnd(24, '░');
    frame(['', `  ${onAir(t.side === 'a' ? 'CAM A' : 'CAM B')}   ${bold(`${t.total} / ${m.target}`)}  ${gold(bar)}`,
      ...L.map((l, k) => `      ${cyan(pad(l, 12))}  ${t.side === 'a' ? cyan(bold(`+${t.add}`)) : '  '}  ${t.side === 'b' ? mag(bold(`+${t.add}`)) : '  '}  ${mag(R[k])}`),
      `      ${cyan(pad(A, 12))}          ${mag(B)}`]);
    await sleep(TTY ? 650 : 1);
  }
  const W = m.winner === 'a' ? BOT.win : BOT.down, Lr = flipBot(m.winner === 'a' ? BOT.down : BOT.win);
  frame(['', `  ${onAir(m.winner === 'a' ? 'CAM A' : 'CAM B')}   ${bold(`${m.target} / ${m.target}`)}  ${gold('█'.repeat(24))}`,
    ...W.map((l, k) => `      ${cyan(pad(l, 12))}          ${mag(Lr[k])}`), `      ${cyan(pad(A, 12))}          ${mag(B)}`, '',
    lime(bold(`  ${m.winner === 'a' ? A : B} wins the pot!`))]);
  endFrame();
  box('Prompts (revealed after the fight)', [`${cyan(A)}: ${dim(m.aPrompt ?? '')}`, `${mag(B)}: ${dim(m.bPrompt ?? '')}`], gold);
}

async function writePrompt() {
  console.log(dim('  Your agent plays Race to N: agents take turns adding 1..k to a shared total; exactly N wins.'));
  console.log(dim(`  Examples: [1] ${EXAMPLES[0]}\n            [2] ${EXAMPLES[1]}`));
  const t = (await ask('  Your strategy prompt (or 1 / 2 for an example): ')).trim();
  return t === '1' || t === '2' ? EXAMPLES[Number(t) - 1] : t;
}

async function pfJoin(id) {
  const m = await api('pf', { q: `&id=${id}` });
  if (m.status !== 'open') return console.log(red(`  That fight is ${m.status}.`));
  box(`${m.aName} challenges your agent for ${sats(m.stake)}`, [dim('Their prompt is hidden until the fight ends.')], mag);
  const prompt = await writePrompt();
  console.log(dim('  the agents are fighting…'));
  await api('pfjoin', { body: { id, prompt } });
  const done = await api('pf', { q: `&id=${id}` });
  await fightShow(done);
  console.log(done.winner === 'b' ? lime(bold(`  You win ${sats(2 * done.stake)}!`)) : red(`  You lose ${sats(done.stake)}`));
}

async function proofLine(id) {
  for (let k = 0; k < 15; k++) {
    const g = await api('qgame', { q: `&id=${id}` });
    if (g.recordTxid) { console.log(`  ${lime('Verified on Bitcoin Cash ✓')} ${dim(g.recordTxid)}\n  ${dim(`check it: ${BASE}/verify/${g.recordTxid}`)}`); return; }
    if (k === 0) console.log(dim('  writing the proof to Bitcoin Cash…'));
    await sleep(2000);
  }
}

async function coinFlip(rules) {
  const { player } = await api('me');
  const round = await api('cfcommit');
  box('Coin Flip', [`The house locked its secret seed: ${dim(round.commit.slice(0, 32) + '…')}`, dim('You add your own random seed; the flip comes from both. Pays 1.9×.'), rulesLine()], gold);
  const pick = (await ask(`  ${bold('[h]')} Heads  ${bold('[t]')} Tails > `)).trim().toLowerCase();
  if (pick !== 'h' && pick !== 't') return console.log(dim('  cancelled'));
  const stake = await pickStake(rules);
  if (stake > player.bonus + player.cash) return console.log(red('  Not enough balance — add funds in the vault [w].'));
  const r = await api('cfplay', { body: { id: round.id, pick: pick === 'h' ? 0 : 1, stake, clientSeed: randomBytes(16).toString('hex') } });
  if (TTY) for (let i = 0; i < 8; i++) { process.stdout.write(`\r   ${['(  H  )', '( ... )', '(  T  )', '( ... )'][i % 4]} flipping`); await sleep(160); }
  process.stdout.write('\r' + ' '.repeat(40) + '\r');
  console.log(`   landed ${bold(r.result === 0 ? 'HEADS' : 'TAILS')}`);
  console.log(r.outcome === 'win' ? lime(bold(`  You win ${sats(r.payout)}!`)) : red(`  You lose ${sats(stake)}`));
  console.log(dim(`  house seed revealed: ${r.seed}`));
  await proofLine(r.id);
}

async function raceFlow(rules, joinId) {
  const { player } = await api('me');
  let id = joinId;
  if (!id) {
    box('Typing Race: challenge a friend', ['Same phrase for both of you, shared start time, first to finish wins the pot.', rulesLine()], cyan);
    const stake = await pickStake(rules);
    if (stake > player.bonus + player.cash) return console.log(red('  Not enough balance — add funds in the vault [w].'));
    id = (await api('prcreate', { body: { stake } })).id;
    console.log(`\n  Send this to your friend (terminal commands on their own lines, or the browser link):\n\n  Windows PowerShell:\n\nirm ${BASE}/race/${id} | iex\n\n  Mac / Linux:\n\ncurl -sL ${BASE}/race/${id} | sh\n\n  Browser: ${BASE}/race/${id}\n`);
  } else {
    const o = await api('prstate', { q: `&id=${id}` });
    if (o.status !== 'open') return console.log(red(`  That race is ${o.status}.`));
    box(`${o.aName} challenges you to a typing race for ${sats(o.stake)} each`, ['Same phrase, shared start, first to finish wins.'], mag);
    await api('prjoin', { body: { id } });
  }
  let spin = 0, st;
  for (;;) {
    st = await api('prstate', { q: `&id=${id}` });
    if (st.status === 'racing' || st.status === 'done' || st.status === 'cancelled') break;
    frame([`  ${dim('waiting for your friend to join (the challenge expires after 10 minutes)')} ${'⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'[spin++ % 10]}`]); await sleep(1000);
  }
  endFrame();
  if (st.status === 'racing') {
    const wait = () => st.startMs - (Date.now() + (st.now - st.fetchedAt));
    st.fetchedAt = Date.now();
    for (let left = Math.ceil(wait() / 1000); left > 0; left = Math.ceil(wait() / 1000)) { console.log(`  ${bold(String(left))}…`); await sleep(Math.min(1000, Math.max(50, wait()))); }
    for (let k = 0; k < 20 && !st.phrase; k++) { st = await api('prstate', { q: `&id=${id}` }); if (!st.phrase) await sleep(150); }
    console.log(`\n  ${bold(lime(st.phrase ?? ''))}\n`);
    const text = (await ask('  type it > ')).replace(/\r?\n$/, '');
    st = await api('prfinish', { body: { id, text } });
  }
  for (let k = 0; k < 12 && st.status === 'racing'; k++) { await sleep(500); st = await api('prstate', { q: `&id=${id}` }); }
  if (st.status === 'cancelled') return console.log(dim(`  race cancelled: ${st.reason}`));
  const me = st.role, won = st.winner === me;
  const ms = st.winner === 'a' ? st.aMs : st.bMs;
  console.log(st.winner === 'draw' ? gold('  Nobody finished: stakes back') : won ? lime(bold(`  You win ${sats(2 * st.stake)}!`)) : red(`  ${st.winner === 'a' ? st.aName : st.bName} wins. You lose ${sats(st.stake)}`));
  if (ms) console.log(dim(`  winner's time ${(ms / 1000).toFixed(2)}s, measured by the server`));
  for (let k = 0; k < 15; k++) { const g = await api('prstate', { q: `&id=${id}` }); if (g.recordTxid) { console.log(`  ${lime('Verified on Bitcoin Cash ✓')} ${dim(g.recordTxid)}\n  ${dim(`check it: ${BASE}/verify/${g.recordTxid}`)}`); return; } if (k === 0) console.log(dim('  writing the proof to Bitcoin Cash…')); await sleep(2000); }
}

async function typingRace(rules) {
  const { player } = await api('me');
  const mode = (await ask(`  ${bold('[1]')} vs the House Bot   ${bold('[2]')} challenge a friend   ${bold('[3]')} join a friend's race > `)).trim();
  if (mode === '2') return raceFlow(rules);
  if (mode === '3') { const id = (await ask('  Race link or id: ')).trim().split(/race[=/]/).pop(); return raceFlow(rules, id); }
  box('Typing Race', ['Type the phrase exactly and press Enter before the House Bot finishes (45 to 80 wpm, locked by a hash).', dim('The server times you from the moment the phrase appears. Pays 1.9×.'), rulesLine()], cyan);
  const stake = await pickStake(rules);
  if (stake > player.bonus + player.cash) return console.log(red('  Not enough balance — add funds in the vault [w].'));
  const r = await api('trstart', { body: { stake } });
  console.log(`\n  ${bold(lime(r.phrase))}\n`);
  const text = (await ask('  type it > ')).replace(/\r?\n$/, '');
  const f = await api('trfinish', { body: { id: r.id, text } });
  console.log(`  you ${bold((f.playerMs / 1000).toFixed(2) + 's')} · House Bot ${bold((f.botMs / 1000).toFixed(2) + 's')}${f.note ? dim(` · ${f.note}`) : ''}`);
  console.log(f.outcome === 'win' ? lime(bold(`  You beat the bot! You win ${sats(f.payout)}`)) : f.outcome === 'refund' ? gold('  Dead heat: stake back') : red(`  The bot wins. You lose ${sats(stake)}`));
  console.log(dim(`  bot seed revealed: ${f.seed}`));
  await proofLine(f.id);
}

async function promptFight(rules) {
  const openF = await api('pfopen').catch(() => []);
  box('Prompt Fight', [`${bold('[1]')} Fight the House Agent   ${bold('[2]')} Challenge a friend (share link)   ${bold('[3]')} Join by link or id`,
    `${bold('[4]')} Accept an open fight ${dim(`(${openF.length} waiting)`)}`,
    dim('Race to N: agents add 1..k in turn; landing exactly on N wins. Code enforces the rules — no AI judge.'), rulesLine()], lime);
  let c = (await ask('  > ')).trim(); let picked = null;
  if (c === '4') {
    if (!openF.length) return console.log(dim('  No open fights right now — create one with [2].'));
    box('Open fights', openF.slice(0, 9).map((o, i) => `${bold(`[${i + 1}]`)} ${o.name} wants a fight · ${gold(sats(o.stake))}`), lime);
    picked = openF[Number((await ask('  Accept which? ')).trim()) - 1]; if (!picked) return; c = '3';
  }
  if (c === '3') return pfJoin(picked ? picked.id : (await ask('  Fight link or id: ')).trim().split(/fight[=/]/).pop());
  if (c !== '1' && c !== '2') return;
  const prompt = await writePrompt(); const stake = await pickStake(rules);
  if (c === '1') console.log(dim('  the agents are fighting…'));
  const { id } = await api('pfcreate', { body: { stake, prompt, vsBot: c === '1' } });
  if (c === '2') box('Fight created', [`Send this link: ${bold(cyan(`${BASE}/fight/${id}`))}`, dim('Friend in a terminal? Copy one of the lines below (they sit outside the box).')], cyan);
  if (c === '2') console.log(`
  Windows PowerShell:

irm ${BASE}/fight/${id} | iex

  Mac / Linux:

curl -sL ${BASE}/fight/${id} | sh
`);
  let spin = 0;
  for (;;) {
    const m = await api('pf', { q: `&id=${id}` });
    if (m.status === 'done') { endFrame(); await fightShow(m); console.log(m.winner === 'a' ? lime(bold(`  You win ${sats(2 * m.stake)}!`)) : red(`  You lose ${sats(m.stake)}`)); if (m.recordTxid) console.log(dim(`  on-chain record: ${m.recordTxid}`)); return; }
    frame([`  ${dim(m.status === 'open' ? 'waiting for a challenger' : 'the agents are fighting')} ${'⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'[spin++ % 10]}`]); await sleep(2000);
  }
}

const GAME = { rps: 'Rock·Paper·Scissors', updown: 'Up or Down', pf: 'Prompt Fight' };
const ago = (t) => { const x = Math.max(1, Math.floor((Date.now() - new Date(t).getTime()) / 1000)); return x < 60 ? `${x}s` : x < 3600 ? `${Math.floor(x / 60)}m` : x < 86400 ? `${Math.floor(x / 3600)}h` : `${Math.floor(x / 86400)}d`; };

async function winners() {
  let game = 'all', period = 'all';
  for (;;) {
    const [w, fx] = await Promise.all([api('winners', { q: `&game=${game}&period=${period}` }), rates().catch(() => null)]);
    const t = w.totals;
    box(`Worldwide winners · ${game === 'all' ? 'all games' : GAME[game]} · ${{ all: 'all time', week: '7 days', today: 'today' }[period]}`, [
      `${gold(sats(t.paid))} paid to ${bold(t.winners)} ${t.winners === 1 ? 'winner' : 'winners'} ${dim(money(t.paid, fx))} · ${t.duels + t.bets + t.fights} games · ${t.players} players`,
      '', bold('Top winners'),
      ...(w.top.length ? w.top.slice(0, 8).map((x, i) => `${pad(`${i + 1}. ${x.name}`, 26)} ${pad(`${x.wins} ${x.wins === 1 ? 'win' : 'wins'}`, 10)} ${lime(sats(x.won))}`) : [dim('No wins in this period yet — be the first.')]),
      '', bold('Latest wins'),
      ...(w.latest.length ? w.latest.slice(0, 6).map((x) => `${pad(x.name, 16)} ${pad(GAME[x.game], 22)} ${lime(pad(sats(x.amount), 16))} ${dim(`${ago(x.at)} ago`)} ${x.tx ? dim(x.tx.slice(0, 10) + '…') : ''}`) : [dim('Nothing yet.')]),
      '', `${dim('game:')} [a]ll [1] RPS [2] Up/Down [3] Prompt Fight   ${dim('period:')} [t]oday [7] days [e]ver   ${dim('[Enter] back')}`,
    ], gold);
    const k = (await ask('  > ')).trim().toLowerCase();
    if (!k) return;
    game = { a: 'all', 1: 'rps', 2: 'updown', 3: 'pf' }[k] ?? game; period = { t: 'today', 7: 'week', e: 'all' }[k] ?? period;
  }
}

async function profile(name) {
  name = name || (await ask('  Player name: ')).trim(); if (!name) return;
  const p = await api('player', { q: `&name=${encodeURIComponent(name)}` });
  const s2 = p.stats;
  box(`Player · ${p.name}`, [
    `net ${s2.net >= 0 ? lime('+' + sats(s2.net)) : red(sats(s2.net))} · win rate ${bold(Math.round(s2.winRate * 100) + '%')} (${s2.wins}W ${s2.losses}L) · ${s2.games} games · ${s2.verified}/${s2.games} on chain`,
    '',
    ...(p.history.length ? p.history.slice(0, 12).map((h) => `${pad(GAME[h.game], 21)} ${pad(String(h.opponent ?? ''), 14)} ${pad(sats(h.stake), 14)} ${h.outcome === 'win' ? lime(pad('win', 6)) : h.outcome === 'lose' ? red(pad('lose', 6)) : pad(h.outcome, 6)} ${h.tx ? dim(h.tx.slice(0, 12) + '…') : dim('recording')}`) : [dim('No finished games yet.')]),
    '', dim('Verify any game with [v] and its transaction id.'),
  ], cyan);
}

// Decode the on-chain record and recompute the result locally (same checks as the website's Verify page).
function decodeRecord(raw) {
  const m = raw.match(/6a(?:4c[0-9a-f]{2}|[0-9a-f]{2})((?:53444c31|53554431|53504631)[0-9a-f]+)/); if (!m) return null;
  const b = Buffer.from(m[1], 'hex'); const kind = b.toString('ascii', 0, 4); const id = b.subarray(4, 20).toString('hex'); const MV = ['rock', 'paper', 'scissors'];
  if (kind === 'SDL1') return { kind, id, result: b[20], stake: b.readUInt32LE(21), moveA: MV[b[25]] ?? null, moveB: MV[b[26]], commit: b.subarray(27, 59).toString('hex') };
  if (kind === 'SUD1') return { kind, id, side: ['flat', 'up', 'down'][b[20]], result: ['flat', 'up', 'down'][b[21]], stake: b.readUInt32LE(22), open: b.readUInt32LE(30) / 1e4, close: b.readUInt32LE(34) / 1e4 };
  if (kind === 'SPF1') return { kind, id, winner: b[20] === 1 ? 'a' : 'b', target: b[21], maxStep: b[22], stake: b.readUInt32LE(23), turnsHash: b.subarray(27, 59).toString('hex') };
  return null;
}
async function verify() {
  const txid = (await ask('  Transaction id: ')).trim().split('/').pop(); if (!txid) return;
  const r = await api('verify', { q: `&txid=${txid}` });
  const rec = decodeRecord(r.raw); const m = r.match;
  if (!rec) return box('Verify', [red('This transaction has no PassBCH game record.')], red);
  const sha = (x) => createHash('sha256').update(x).digest('hex'); const out = [];
  const chk = (ok, t) => out.push(`${ok === null ? gold('ⓘ') : ok ? lime('✓') : red('✗')} ${t}`);
  chk(!!m && rec.id === m.id, 'record id matches the game'); chk(!!m && rec.stake === m.stake, `stake ${sats(rec.stake)} matches`);
  if (m && rec.kind === 'SDL1') {
    chk(rec.commit === m.commit, 'commitment on chain = the one locked before the opponent played');
    if (m.aSalt && rec.moveA) chk(sha(`${rec.moveA}:${m.aSalt}`) === rec.commit, `sha256("${rec.moveA}:salt") = commitment`); else if (rec.moveA) chk(null, 'salt check not available for this older duel');
    const MV = ['rock', 'paper', 'scissors']; const o = rec.moveA ? (rec.moveA === rec.moveB ? 0 : (MV.indexOf(rec.moveA) - MV.indexOf(rec.moveB) + 3) % 3 === 1 ? 1 : 2) : 2;
    chk(o === rec.result, `recomputed: ${rec.moveA ?? '(no reveal)'} vs ${rec.moveB}`); chk(rec.result === m.result, 'result on chain = result paid out');
  }
  if (m && rec.kind === 'SUD1') { const rr = rec.close > rec.open ? 'up' : rec.close < rec.open ? 'down' : 'flat'; chk(rr === rec.result, `recomputed: $${rec.open} → $${rec.close} = ${rr.toUpperCase()}`); chk((rec.side === rec.result) === (m.outcome === 'win'), `bet ${rec.side.toUpperCase()} → ${m.outcome}`); }
  if (m && rec.kind === 'SPF1') {
    const t = m.turns ?? []; chk(sha(JSON.stringify(t.map((x) => [x.side, x.add]))) === rec.turnsHash, 'sha256 of every move = hash on chain');
    let total = 0, ok = true; t.forEach((x, i) => { if (x.add < 1 || x.add > rec.maxStep || (i && x.side === t[i - 1].side)) ok = false; total += x.add; });
    chk(ok, `every move 1–${rec.maxStep}, players alternated`); chk(total === rec.target && t.at(-1)?.side === rec.winner, `recomputed: total reaches ${rec.target} on the winner's move`);
  }
  const allOk = out.every((x) => !strip(x).startsWith('✗'));
  box(allOk ? 'VERIFIED ✓' : 'MISMATCH', [`${{ SDL1: 'Rock·Paper·Scissors', SUD1: 'Up or Down', SPF1: 'Prompt Fight' }[rec.kind]} · ${r.network} · ${dim(r.explorer + r.txid)}`, '', ...out], allOk ? lime : red);
}

function rulesScreen(r) {
  box('Rules, fairness & fees', [
    bold('Rock · Paper · Scissors'), dim('Your move is sent as sha256(move:salt) and revealed after the opponent plays. No reveal in 2 min = you lose. Winner takes the pot; draw = stakes back.'),
    bold('Up or Down'), dim(`Entry = Coinbase BCH-USD last trade when you confirm; exit = last trade exactly 60 s later. Higher = UP, lower = DOWN, same = stake back. Pays ${(r.updownPayoutPct ?? 190) / 100}×.`),
    bold('Prompt Fight'), dim('Your prompt guides an AI agent in Race to N (N 15–24, steps 1–k). Code enforces every move; each agent sees only its own prompt.'),
    bold('Proof'), dim('Every result is an OP_RETURN record on Bitcoin Cash (SDL1 / SUD1 / SPF1). Use [v] to recompute any of them.'),
    bold('Fees & bonus'), dim(`Withdrawal fee ${r.withdrawFeePct}% (min ${sats(r.networkFee)}). Free bonus must be played 2× before withdrawing; won bonus in friend duels stays bonus.`),
    bold('Responsible play'), dim('18+. Test BCH on chipnet during the hackathon. Real-money games are regulated in many countries — check your local law.'),
  ], cyan);
}

async function vault(rules) {
  for (;;) {
    const [{ player, withdraw }, fx] = await Promise.all([api('me'), rates().catch(() => null)]);
    box(`Vault · ${player.name}`, [
      `total ${gold(sats(player.bonus + player.cash))} ${dim(money(player.bonus + player.cash, fx))}`,
      `withdrawable ${lime(sats(player.cash))} ${dim(money(player.cash, fx))} · bonus ${sats(player.bonus)} (play only)`,
      withdraw && !withdraw.ok ? gold(`withdrawals unlock after you play ${sats(withdraw.left)} more (bonus must be played 2×)`) : lime('withdrawals unlocked'),
      `invite: ${cyan(`https://passbch.vercel.app/?ref=${player.refCode}`)} ${dim('(you both get a bonus)')}`,
      '', `${bold('[a]')} Add funds   ${bold('[w]')} Withdraw   ${bold('[h]')} History   ${bold('[c]')} Currency (${ccy()})   ${bold('[k]')} Login code   ${dim('[Enter] back')}`,
    ], gold);
    const a = (await ask('  > ')).trim().toLowerCase();
    if (!a) return;
    if (a === 'k') box('Login code', [white(cfg.token), dim('Use it on the website (Log in) or another terminal. Keep it private.')], mag);
    if (a === 'c') { const c = (await ask(`  Currency ${dim(Object.keys(CUR).join(' '))}: `)).trim().toUpperCase(); if (CUR[c]) { cfg.currency = c; save(cfg); } }
    if (a === 'h') {
      const h = await api('activity');
      box('History', [bold('Games'), ...(h.games.slice(0, 8).map((g) => `${pad(GAME[g.game], 21)} ${g.outcome === 'win' ? lime(pad('+' + sats(g.paid - g.stake), 16)) : g.outcome === 'lose' ? red(pad('-' + sats(g.stake), 16)) : pad('refund', 16)} ${dim(`${ago(g.at)} ago`)}`)),
        '', bold('Money'), ...(h.money.slice(0, 8).map((x) => `${pad(x.kind, 11)} ${x.amount >= 0 ? lime(pad('+' + sats(x.amount), 16)) : red(pad(sats(x.amount), 16))} ${dim(x.note ?? '')}`)), ...(h.games.length + h.money.length ? [] : [dim('Nothing yet.')])], cyan);
    }
    if (a === 'a') {
      const t = (await ask(`  Add with ${bold('[1]')} BCH  ${bold('[2]')} other crypto  ${bold('[3]')} bank · card · UPI: `)).trim();
      if (t === '1') { const d = await api('deposit'); box('Add BCH', [`send BCH to ${bold(d.address)}`, d.added ? lime(`credited ${sats(d.added)}`) : dim('open [a] again after sending to credit it'), dim('or use WizardConnect on the website')], cyan); }
      if (t === '2') {
        const coin = (await ask(`  Coin ${dim('usdt-ethereum usdt-tron usdc-ethereum btc eth sol ltc doge')}: `)).trim() || 'usdt-ethereum';
        const amt = Number((await ask('  Amount to send: ')).trim()) || 20; const q = await api('swapquote', { q: `&coin=${coin}&dir=in` });
        box('Add other crypto', [`${amt} ${q.from} → ${lime((amt * q.rate).toFixed(8) + ' BCH')} into your vault`, dim(`SideShift rate ${q.rate} (includes their fee) · min ${q.min} ${q.from}`), NETWORK === 'mainnet' ? '' : gold('Swaps run on mainnet; during testing use BCH.')], cyan);
      }
      if (t === '3') {
        const c = ccy(); const amt = Number((await ask(`  Amount in ${c}: `)).trim()) || 500; const r = fx?.[c];
        box('Add with bank · card · UPI', [`${CUR[c] ?? ''}${amt} → ${lime(r ? (amt / r).toFixed(8) + ' BCH' : '?')} into your vault`, dim(`1 BCH = ${CUR[c] ?? ''}${r?.toLocaleString(undefined, { maximumFractionDigits: 2 })} (live) · partner fees not included`), NETWORK === 'mainnet' ? '' : gold('Licensed on-ramp partner switches on with mainnet.')], cyan);
      }
    }
    if (a === 'w') {
      const t = (await ask(`  Withdraw to ${bold('[1]')} BCH  ${bold('[2]')} other crypto  ${bold('[3]')} bank · UPI: `)).trim();
      if (t === '1') {
        const address = (await ask(`  Your BCH address ${dim(NETWORK === 'mainnet' ? '(bitcoincash:…)' : '(bchtest:…)')}: `)).trim();
        const bch = Number((await ask(`  Amount in BCH (min ${rules.minWithdraw / 1e8}, fee ${rules.withdrawFeePct}%): `)).trim());
        const w = await api('withdraw', { body: { address, amount: Math.round(bch * 1e8) } });
        box('Withdrawal sent', [`${lime(sats(w.send))} sent (fee ${sats(w.fee)})`, dim(`tx ${w.txid}`)], lime);
      } else if (t === '2' || t === '3') {
        const bch = Number((await ask('  Amount in BCH: ')).trim()) || 0.01;
        if (t === '2') { const q = await api('swapquote', { q: '&coin=usdt-ethereum&dir=out' }); box('Withdraw to other crypto', [`${bch} BCH → ${lime((bch * q.rate).toFixed(2) + ' ' + q.to)} ${dim('(SideShift quote)')}`, NETWORK === 'mainnet' ? '' : gold('Swaps run on mainnet; during testing withdraw BCH.')], cyan); }
        else { const c = ccy(); box('Withdraw to bank · UPI', [`${bch} BCH → ${lime(`${CUR[c] ?? ''}${(bch * (fx?.[c] ?? 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`)}`, NETWORK === 'mainnet' ? '' : gold('Off-ramp partner switches on with mainnet.')], cyan); }
      }
    }
  }
}

async function selfUpdate(latest) {
  if (!latest || latest === VERSION || process.env.PASSBCH_NO_UPDATE) return false;
  console.log(dim(`  updating terminal client ${VERSION} → ${latest}…`));
  const r = await fetch(`${BASE}/duel.mjs?v=${encodeURIComponent(latest)}`, { cache: 'no-store' });
  if (!r.ok) return false;
  const file = path.join(os.tmpdir(), `passbch-${latest}.mjs`);
  fs.writeFileSync(file, await r.text());
  rl.close(); process.stdin.pause();
  const { spawn } = await import('node:child_process');
  const child = spawn(process.execPath, [file, ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, PASSBCH_NO_UPDATE: '1' } });
  await new Promise((done) => child.on('exit', done));
  return true;
}

async function main() {
  const cfgSrv = await api('config'); const { rules, network, clientVersion } = cfgSrv;
  NETWORK = network;
  if (await selfUpdate(clientVersion)) return;
  if (!cfg.token) { if (!(await welcome())) return; }
  else { console.clear?.(); logo(); }
  console.log(dim(`  network: ${network} · ${BASE} · client ${VERSION}`));
  console.log(dim(`  Built during BCH BLAZE 2026 · GitHub https://github.com/Lakshmikanth-3/PassBCH.cash${cfgSrv.deckUrl ? ` · Deck ${cfgSrv.deckUrl}` : ''}
  Vote with EMBER2026: ${cfgSrv.emberAddress ?? ''}`));
  const [cmd, arg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (cmd === 'join' && arg) { try { await join(arg); } catch (e) { console.log(red(`  ✗ ${e.message}`)); } }
  if (cmd === 'race' && arg) { try { await raceFlow(cfgSrv.rules, arg); } catch (e) { console.log(red(`  ✗ ${e.message}`)); } }
  if (cmd === 'fight' && arg) { try { await pfJoin(arg); } catch (e) { console.log(red(`  ✗ ${e.message}`)); } }
  for (;;) {
    let c;
    try { c = await home(); } catch (e) { if (/unknown player|not signed/.test(e.message)) { cfg = {}; save(cfg); if (!(await welcome())) return; continue; } throw e; }
    try {
      if (c === '1') await rps(rules);
      else if (c === '2') await updown(rules);
      else if (c === '3') await promptFight(rules);
      else if (c === '4') await coinFlip(rules);
      else if (c === '5') await typingRace(rules);
      else if (c === '6') box('Upcoming BCH games', ['Tournaments · lucky draws · team battles · more', dim('Coming soon — stay tuned!')], mag);
      else if (c === 'w') await vault(rules);
      else if (c === 'l') await winners();
      else if (c === 'p') await profile();
      else if (c === 'v') await verify();
      else if (c === 'r') rulesScreen(rules);
      else if (c === 'o') { cfg = {}; save(cfg); console.log(dim('  logged out')); if (!(await welcome())) return; }
      else if (c === 'q') return;
    } catch (e) { endFrame(); console.log(red(`  ✗ ${e.message}`)); }
  }
}
main().catch((e) => console.log(red(`  ✗ ${e.message}`))).finally(() => { rl.close(); process.exit(0); });
