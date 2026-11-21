#!/usr/bin/env node
// PassBCH.cash in your terminal. No install, no dependencies: needs Node 18+.
//   PowerShell:  irm https://passbch-cash.vercel.app/play.ps1 | iex
//   bash/zsh:    curl -fsSL https://passbch-cash.vercel.app/play.sh | sh
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
const sats = (n) => `${Number(n ?? 0).toLocaleString()} sats`;

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
  const body = rows.map((r) => color('║ ') + pad(r, w) + color(' ║'));
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
  console.log(dim('  play while your AI thinks · real Bitcoin Cash · every result on chain\n'));
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
  const { player } = await api('me');
  console.log('');
  box(`🎮 ${player.name}   ${gold('💰 ' + sats(player.bonus + player.cash))}  ${dim(`(bonus ${sats(player.bonus)} · withdrawable ${sats(player.cash)})`)}`, [
    `${bold(gold('[1]'))} ✊ ${bold('Rock · Paper · Scissors')}   ${dim('table with a host · vs House Bot or a friend')}`,
    `${bold(cyan('[2]'))} 📈 ${bold('Up or Down')}               ${dim('next minute of BCH · pays 1.9×')}`,
    `${bold(lime('[3]'))} 🤖 ${bold('AI Fight')}                 ${dim('bet PASS / FAIL on a live AI coding exam')}`,
    `${bold(mag('[4]'))} ⏳ ${dim('Upcoming BCH games — coming soon')}`,
    '',
    `${bold('[w]')} Wallet & login code   ${bold('[l]')} Leaderboard   ${bold('[o]')} Log out   ${bold('[q]')} Quit`,
  ]);
  return (await ask('  > ')).trim().toLowerCase();
}

async function pickStake(rules) {
  const s = (await ask(`  Stake ${dim(rules.stakes.map((x, i) => `[${i + 1}] ${x.toLocaleString()}`).join('  '))} ${dim('sats')}: `)).trim();
  return rules.stakes[Number(s) - 1] ?? (rules.stakes.includes(Number(s)) ? Number(s) : rules.stakes[0]);
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
  box('✊ Rock · Paper · Scissors', [`${bold('[1]')} Play the House Bot   ${bold('[2]')} Challenge a friend (share link)   ${bold('[3]')} Join a friend's duel`, dim('Your move is locked as a hash before anyone plays. Not revealing in 2 min = you lose.')], gold);
  const c = (await ask('  > ')).trim();
  if (c === '3') return join((await ask('  Duel link or id: ')).trim().split(/duel[=/]/).pop());
  if (c !== '1' && c !== '2') return;
  const move = await pickMove(); const stake = await pickStake(rules);
  const salt = randomBytes(16).toString('hex'); const commit = createHash('sha256').update(`${move}:${salt}`).digest('hex');
  const { id } = await api('create', { body: { stake, commit, vsBot: c === '1' } });
  if (c === '2') box('Challenge created', [`Send this link: ${bold(cyan(`${BASE}/duel/${id}`))}`, dim(`or in their terminal: menu [1] → [3] → ${id}`)], cyan);
  let spin = 0;
  for (;;) {
    const d = await api('duel', { q: `&id=${id}` });
    if (d.status === 'awaiting_reveal') {
      const r = await api('reveal', { body: { id, move, salt } }); endFrame();
      await tableShow(cfg.name ?? 'You', d.bName, move, d.bMove, r.result);
      for (let k = 0; k < 5; k++) { const f = await api('duel', { q: `&id=${id}` }); if (f.recordTxid) { console.log(dim(`   on-chain record: ${f.recordTxid}`)); break; } await sleep(2000); }
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
  box('📈 Up or Down · BCH/USD', [
    `${bold(white('$' + p.price.toFixed(2)))}   ${spark(hist)}   ${dim('last 12 min')}`,
    `next round starts in ${bold(gold(`${p.nextRound - p.now}s`))} · a right call pays ${lime('1.9×')} · unchanged = refund`,
    dim('Settled by the public Coinbase BCH-USD 1-minute candle.'),
  ], cyan);
  const side = (await ask(`  ${lime(bold('[u] ▲ UP'))}    ${red(bold('[d] ▼ DOWN'))}   ${dim('[Enter] back')}: `)).trim().toLowerCase()[0];
  if (side !== 'u' && side !== 'd') return;
  const stake = await pickStake(rules);
  const ok = (await ask(`  Confirm ${side === 'u' ? lime('▲ UP') : red('▼ DOWN')} for ${gold(sats(stake))}? ${dim('[y/N]')} `)).trim().toLowerCase();
  if (ok !== 'y') return console.log(dim('  cancelled'));
  const b = await api('bet', { body: { side: side === 'u' ? 'up' : 'down', stake } });
  const pts = [p.price];
  for (;;) {
    await sleep(4000);
    const m = (await api('bets')).mine.find((x) => x.id === b.id);
    if (m?.outcome) {
      endFrame();
      box(m.outcome === 'win' ? '🏆 YOU WIN' : m.outcome === 'lose' ? '💀 YOU LOSE' : '🤝 FLAT', [`$${Number(m.open_price).toFixed(2)} → $${Number(m.close_price).toFixed(2)}  ${m.result === 'up' ? lime('▲ UP') : m.result === 'down' ? red('▼ DOWN') : 'flat'}`,
        m.outcome === 'win' ? lime(`+${sats(m.payout)}`) : m.outcome === 'lose' ? red(`-${sats(stake)}`) : 'stake refunded'], m.outcome === 'win' ? lime : m.outcome === 'lose' ? red : gold);
      return;
    }
    const q = await api('price').catch(() => null); if (q) pts.push(q.price); if (pts.length > 30) pts.shift();
    const now = Math.floor(Date.now() / 1000); const st = b.roundStart > now ? `starts in ${b.roundStart - now}s` : b.roundEnd > now ? `${red('●')} LIVE · ${b.roundEnd - now}s left` : 'settling…';
    frame([`  ${side === 'u' ? lime('▲ UP') : red('▼ DOWN')} ${sats(stake)} · ${st}`, `  ${bold('$' + pts[pts.length - 1].toFixed(2))}  ${spark(pts)}`]);
  }
}

// two robots trading punches
const BOT = { idle: [' [o_o] ', ' /|_|\\ ', '  / \\  '], punch: [' [o_o] ', ' /|_|==●', '  / \\  '], hit: [' [x_x] ', ' \\|_|/ ', '  / \\  '], win: [' \\[^_^]/', '   |_|  ', '  / \\  '], down: ['        ', '        ', ' _[x_x]_'] };
const flipBot = (rows) => rows.map((r) => [...r].reverse().join('').replace(/[\\/[\]()]/g, (c) => ({ '\\': '/', '/': '\\', '[': ']', ']': '[' }[c] ?? c)));

async function aiFight(rules) {
  let st = await api('ai');
  const cur = st.current;
  if (!cur) { box('🤖 AI Fight', [dim('No exam is live right now. A new round opens about every 2 minutes while the exam machine is online.')], lime); return; }
  const rec = st.records[cur.model]; const model = cur.model.replace('openai/', '');
  const open = cur.status === 'open' && st.now < Number(cur.bet_close_s);
  box(`🤖 AI Fight · ${model} vs "${cur.slug}"`, [
    `exercise #${cur.task_idx} drawn from BCH block ${cur.block_height} · AI record ${rec.pass}/${rec.n}`,
    open ? `PASS pays ${lime((rec.passPct / 100).toFixed(2) + '×')} · FAIL pays ${red((rec.failPct / 100).toFixed(2) + '×')} · bets close in ${gold(`${Number(cur.bet_close_s) - st.now}s`)}` : `${gold('⚔')} the fight is on — betting closed`,
  ], lime);
  let bet = null;
  if (open) {
    const side = (await ask(`  ${lime(bold('[p] ✅ PASS'))}   ${red(bold('[f] ❌ FAIL'))}   ${dim('[Enter] just watch')}: `)).trim().toLowerCase()[0];
    if (side === 'p' || side === 'f') {
      const stake = await pickStake(rules);
      if ((await ask(`  Confirm ${side === 'p' ? 'PASS' : 'FAIL'} for ${gold(sats(stake))}? ${dim('[y/N]')} `)).trim().toLowerCase() === 'y') bet = await api('aibet', { body: { roundId: cur.id, side: side === 'p' ? 'pass' : 'fail', stake } });
    }
  }
  for (let t = 0; ; t++) {
    st = await api('ai');
    const r = st.recent.find((x) => x.id === cur.id);
    if (r && (r.status === 'done' || r.status === 'void')) {
      const A = r.pass ? BOT.win : BOT.down, B = flipBot(r.pass ? BOT.down : BOT.win);
      frame(['', `  ${onAir(r.pass ? 'CAM AI' : 'CAM TESTS')}`, ...A.map((l, k) => `      ${cyan(pad(l, 12))}      ${mag(B[k])}`), `      ${cyan(pad('AI agent', 12))}      ${mag('unit tests')}`, '',
        r.status === 'void' ? gold('  round void — stakes refunded') : r.pass ? lime(bold(`  ✅ AI PASSED ${r.passed}/${r.total} — the AI wins`)) : red(bold(`  ❌ AI FAILED ${r.passed}/${r.total} — the tests win`))]);
      endFrame();
      const m = bet && st.mine.find((x) => x.id === bet.id);
      if (m?.outcome === 'win') console.log(lime(bold(`  🏆 You win ${sats(m.payout)}!`))); else if (m?.outcome === 'lose') console.log(red('  💀 You lose your stake'));
      if (r.record_txid) console.log(dim(`  on-chain record: ${r.record_txid}`));
      return;
    }
    for (let k = 0; k < 8; k++) {
      const a = (t * 8 + k) % 4; const A = a === 1 ? BOT.punch : a === 3 ? BOT.hit : BOT.idle; const B = flipBot(a === 3 ? BOT.punch : a === 1 ? BOT.hit : BOT.idle);
      frame(['', `  ${onAir(['CAM 1 · RINGSIDE', 'CAM 2 · AI', 'CAM 3 · TESTS', 'CAM 4 · OVERHEAD'][Math.floor((t * 8 + k) / 6) % 4])}   ${dim(`${model} is coding "${cur.slug}"…`)}`,
        ...A.map((l, i) => `      ${cyan(pad(l, 12))}      ${mag(B[i])}`), `      ${cyan(pad('AI agent', 12))}      ${mag('unit tests')}`]);
      await sleep(TTY ? 500 : 1);
    }
  }
}

async function board() {
  const { top, feed, stats } = await api('leaderboard');
  box(`🏆 Leaderboard · ${stats.duels} duels · ${sats(stats.volumeSats)} played`, [
    ...top.slice(0, 10).map((t, i) => `${pad(`${['🥇', '🥈', '🥉'][i] ?? ` ${i + 1}.`} ${t.name}`, 26)} ${lime(pad(`+${sats(t.won_sats)}`, 18))} ${t.wins}W ${t.losses}L ${t.draws}D`),
    ...(top.length ? [] : [dim('No games yet — be the first!')]),
    '', bold('Live duels'),
    ...feed.slice(0, 6).map((f) => `${f.a_name} vs ${f.b_name} → ${f.winner_name ? lime(`${f.winner_name} +${sats(2 * f.stake)}`) : gold('draw')}`),
  ], gold);
}

async function wallet(rules) {
  const { player, withdraw } = await api('me');
  box(`💰 Wallet · ${player.name}`, [
    `bonus ${gold(sats(player.bonus))} (play only)   withdrawable ${lime(sats(player.cash))}   record ${player.wins}W ${player.losses}L`,
    withdraw && !withdraw.ok ? gold(`withdrawals unlock after you play ${sats(withdraw.left)} more (bonus must be played 2×)`) : lime('withdrawals unlocked'),
    `invite friends: ${cyan(`${BASE}/?ref=${player.refCode}`)} ${dim('(you both get 25,000)')}`,
    '', `${bold('[d]')} deposit   ${bold('[w]')} withdraw   ${bold('[c]')} show login code   ${dim('[Enter] back')}`,
  ], gold);
  const a = (await ask('  > ')).trim().toLowerCase();
  if (a === 'c') box('🔑 Login code', [white(cfg.token), dim('Use it on the website (Log in) or another terminal. Keep it private.')], mag);
  if (a === 'd') { const d = await api('deposit'); box('Deposit', [`send BCH to ${bold(d.address)}`, d.added ? lime(`credited ${sats(d.added)}`) : dim('open the wallet again after sending to credit it')], cyan); }
  if (a === 'w') {
    const address = (await ask('  Your BCH address: ')).trim();
    const amount = Number((await ask(`  Amount (min ${rules.minWithdraw}, fee ${rules.withdrawFeePct}%): `)).trim());
    const w = await api('withdraw', { body: { address, amount } });
    box('Withdrawal sent', [`${lime(sats(w.send))} sent (fee ${sats(w.fee)})`, dim(`tx ${w.txid}`)], lime);
  }
}

async function main() {
  const { rules, network } = await api('config');
  if (!cfg.token) { if (!(await welcome())) return; }
  else { console.clear?.(); logo(); }
  console.log(dim(`  network: ${network} · ${BASE}`));
  const [cmd, arg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (cmd === 'join' && arg) { await join(arg); return; }
  for (;;) {
    let c;
    try { c = await home(); } catch (e) { if (/unknown player|not signed/.test(e.message)) { cfg = {}; save(cfg); if (!(await welcome())) return; continue; } throw e; }
    try {
      if (c === '1') await rps(rules);
      else if (c === '2') await updown(rules);
      else if (c === '3') await aiFight(rules);
      else if (c === '4') box('⏳ Upcoming BCH games', ['Tournaments · lucky draws · team battles · more', dim('Coming soon — stay tuned!')], mag);
      else if (c === 'w') await wallet(rules);
      else if (c === 'l') await board();
      else if (c === 'o') { cfg = {}; save(cfg); console.log(dim('  logged out')); if (!(await welcome())) return; }
      else if (c === 'q') return;
    } catch (e) { endFrame(); console.log(red(`  ✗ ${e.message}`)); }
  }
}
main().catch((e) => console.log(red(`  ✗ ${e.message}`))).finally(() => { rl.close(); process.exit(0); });
