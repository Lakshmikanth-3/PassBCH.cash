#!/usr/bin/env node
// PassBCH.cash in your terminal. No install, no dependencies: needs Node 18+.
//   PowerShell:  irm https://passbch-cash.vercel.app/play.ps1 | iex
//   bash/zsh:    curl -fsSL https://passbch-cash.vercel.app/play.sh | sh
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import readline from 'node:readline';

const BASE = process.env.DUEL_URL ?? 'https://passbch-cash.vercel.app';
const CFG = path.join(os.homedir(), '.passbch.json');
const MOVES = ['rock', 'paper', 'scissors'], EMOJI = { rock: '✊', paper: '✋', scissors: '✌️ ' };
const c = (n) => (s) => (process.stdout.isTTY ? `\x1b[${n}m${s}\x1b[0m` : s);
const bold = c(1), dim = c(2), green = c(32), red = c(31), yellow = c(33), cyan = c(36);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
// Line queue: works both for a person typing and for piped input.
const lines = [], waiters = [];
rl.on('line', (l) => (waiters.length ? waiters.shift()(l) : lines.push(l)));
rl.on('close', () => { while (waiters.length) waiters.shift()('q'); lines.push('q'); });
const ask = (q) => { process.stdout.write(q); return lines.length ? Promise.resolve(lines.shift()) : new Promise((r) => waiters.push(r)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const load = () => { try { return JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch { return {}; } };
const save = (o) => fs.mkdirSync(path.dirname(CFG), { recursive: true }) ?? fs.writeFileSync(CFG, JSON.stringify(o, null, 2), { mode: 0o600 });
let cfg = load();

async function api(a, { body, q = '' } = {}) {
  const r = await fetch(`${BASE}/api/duel?a=${a}${q}`, { method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(cfg.token ? { authorization: `Bearer ${cfg.token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok) throw new Error(j.error); return j;
}
const sats = (n) => `${Number(n).toLocaleString()} sats`;

async function pickMove() {
  for (;;) {
    const m = (await ask(`  Your move ${dim('[r]ock [p]aper [s]cissors')}: `)).trim().toLowerCase();
    const move = MOVES.find((x) => x[0] === m[0]);
    if (move) return move;
  }
}
async function pickStake(rules) {
  const s = (await ask(`  Stake ${dim(rules.stakes.join(' / '))} sats [${rules.stakes[0]}]: `)).trim();
  return rules.stakes.includes(Number(s)) ? Number(s) : rules.stakes[0];
}

async function signup() {
  console.log(bold('\n  Welcome to PassBCH.cash 🎲  rock-paper-scissors for real BCH\n'));
  const name = (await ask('  Pick a player name: ')).trim();
  const ref = (process.argv.find((a) => a.startsWith('--ref='))?.slice(6) ?? (await ask(`  Referral code ${dim('(optional, Enter to skip)')}: `)).trim()) || undefined;
  const r = await api('signup', { body: { name, ref } });
  cfg = { token: r.token, name: r.player.name, refCode: r.player.refCode }; save(cfg);
  console.log(green(`\n  ✓ Welcome ${r.player.name}! Free bonus: ${sats(r.bonusGiven)}${r.referrer ? ` (invited by ${r.referrer})` : ''}`));
  console.log(dim(`    Your referral code: ${r.player.refCode} — you both get a bonus when a friend joins with it.`));
}

async function settleAndShow(id, move, salt) {
  process.stdout.write(dim('  waiting for opponent'));
  for (let i = 0; ; i++) {
    const d = await api('duel', { q: `&id=${id}` });
    if (d.status === 'awaiting_reveal') {
      const r = await api('reveal', { body: { id, move, salt } });
      process.stdout.write('\n');
      const them = d.bMove;
      console.log(`\n  You ${EMOJI[move]} ${move}   vs   ${d.bName} ${EMOJI[them]} ${them}`);
      const res = r.result;
      console.log(res === 0 ? yellow(`  🤝 Draw — stake returned`) : res === 1 ? green(bold(`  🏆 You win ${sats(2 * d.stake)}!`)) : red(`  💀 You lose ${sats(d.stake)}`));
      for (let k = 0; k < 6; k++) { const f = await api('duel', { q: `&id=${id}` }); if (f.recordTxid) { console.log(dim(`  on-chain record: ${f.recordTxid}`)); break; } await sleep(2000); }
      return;
    }
    if (d.status === 'settled' || d.status === 'expired') { console.log(`\n  duel ${d.status}: ${d.settleReason}`); return; }
    if (i % 3 === 0) process.stdout.write('.');
    await sleep(2000);
  }
}

async function play({ vsBot, rules }) {
  const move = await pickMove(); const stake = await pickStake(rules); const salt = randomBytes(16).toString('hex');
  const commit = createHash('sha256').update(`${move}:${salt}`).digest('hex');
  const { id } = await api('create', { body: { stake, commit, vsBot } });
  if (!vsBot) {
    console.log(cyan(`\n  Challenge created! Send this to a friend:\n  ${bold(`${BASE}/?duel=${id}`)}`));
    console.log(dim(`  or in their terminal:  node duel.mjs join ${id}`));
  }
  await settleAndShow(id, move, salt);
}

async function join(id) {
  const d = await api('duel', { q: `&id=${id}` });
  if (d.status !== 'open') return console.log(red(`  That duel is ${d.status}.`));
  console.log(`\n  ${bold(d.aName)} challenges you for ${sats(d.stake)}. Their move is locked (hash ${d.aCommit.slice(0, 12)}…).`);
  const move = await pickMove();
  await api('join', { body: { id, move } });
  process.stdout.write(dim(`  You played ${EMOJI[move]}. Waiting for ${d.aName} to reveal`));
  for (;;) {
    const f = await api('duel', { q: `&id=${id}` });
    if (f.status === 'settled') {
      console.log(`\n\n  ${d.aName} ${EMOJI[f.aMove] ?? '⌛'} ${f.aMove ?? '(no reveal)'}   vs   You ${EMOJI[move]} ${move}`);
      console.log(f.result === 0 ? yellow('  🤝 Draw') : f.result === 2 ? green(bold(`  🏆 You win ${sats(2 * d.stake)}!`)) : red(`  💀 You lose ${sats(d.stake)}`));
      return;
    }
    process.stdout.write('.'); await sleep(2000);
  }
}

async function board() {
  const { top, feed, stats } = await api('leaderboard');
  console.log(bold(`\n  🏆 Leaderboard  ${dim(`${stats.duels} duels · ${sats(stats.volumeSats)} played`)}`));
  top.slice(0, 10).forEach((t, i) => console.log(`  ${String(i + 1).padStart(2)}. ${t.name.padEnd(20)} ${green(`+${sats(t.won_sats)}`).padEnd(24)} ${t.wins}W ${t.losses}L ${t.draws}D`));
  console.log(bold('\n  Live duels'));
  feed.slice(0, 8).forEach((f) => console.log(`  ${f.a_name} ${EMOJI[f.a_move] ?? '⌛'} vs ${EMOJI[f.b_move]} ${f.b_name} → ${f.winner_name ? green(f.winner_name + ' won ' + sats(2 * f.stake)) : yellow('draw')} ${dim(f.record_txid ? 'tx ' + f.record_txid.slice(0, 10) + '…' : '')}`));
}

async function updown(rules) {
  const p = await api('price');
  console.log(bold('\n  📈 Up or Down') + `  BCH/USD ${bold('$' + p.price.toFixed(2))}  ${dim(`next round in ${p.nextRound - p.now}s · win pays 1.9x`)}`);
  const side = (await ask('  [u]p or [d]own? ')).trim().toLowerCase()[0];
  if (side !== 'u' && side !== 'd') return;
  const stake = await pickStake(rules);
  const b = await api('bet', { body: { side: side === 'u' ? 'up' : 'down', stake } });
  process.stdout.write(dim(`  ${side === 'u' ? '▲ UP' : '▼ DOWN'} ${sats(stake)} on the minute starting ${new Date(b.roundStart * 1000).toLocaleTimeString()} `));
  for (;;) {
    await sleep(5000);
    const m = (await api('bets')).mine.find((x) => x.id === b.id);
    if (m?.outcome) {
      console.log(`\n  $${Number(m.open_price).toFixed(2)} → $${Number(m.close_price).toFixed(2)}  ${m.result.toUpperCase()}`);
      console.log(m.outcome === 'win' ? green(bold(`  🏆 You win ${sats(m.payout)}!`)) : m.outcome === 'lose' ? red(`  💀 You lose ${sats(stake)}`) : yellow('  🤝 Flat — refunded'));
      return;
    }
    process.stdout.write(dim('.'));
  }
}

async function wallet(rules) {
  const { player } = await api('me');
  console.log(`\n  ${bold(player.name)}  bonus ${yellow(sats(player.bonus))} · withdrawable ${green(sats(player.cash))} · ${player.wins}W ${player.losses}L`);
  console.log(dim(`  Invite friends: ${BASE}/?ref=${player.refCode}  (both of you get a bonus)`));
  const a = (await ask(`  [d]eposit  [w]ithdraw  [Enter] back: `)).trim().toLowerCase();
  if (a === 'd') {
    const d = await api('deposit');
    console.log(`  Send BCH to: ${bold(d.address)}\n  ${dim('Then open this menu again to credit it.')}${d.added ? green(`  ✓ credited ${sats(d.added)}`) : ''}`);
  } else if (a === 'w') {
    const address = (await ask('  Your BCH address: ')).trim();
    const amount = Number((await ask(`  Amount (min ${rules.minWithdraw}, fee ${rules.withdrawFeePct}%): `)).trim());
    const w = await api('withdraw', { body: { address, amount } });
    console.log(green(`  ✓ Sent ${sats(w.send)} (fee ${sats(w.fee)}) — tx ${w.txid}`));
  }
}

async function main() {
  const { rules, network } = await api('config');
  if (!cfg.token) await signup();
  const [cmd, arg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (cmd === 'join' && arg) { await join(arg); return; }
  for (;;) {
    console.log(bold(`\n  🎲 PassBCH.cash`) + dim(`  ${cfg.name} · ${network}`));
    const choice = (await ask(`  [1] Play the House Bot  [2] Challenge a friend  [3] Join a duel  [4] Leaderboard  [5] Wallet  [6] Up or Down  [q] Quit\n  > `)).trim();
    try {
      if (choice === '1') await play({ vsBot: true, rules });
      else if (choice === '2') await play({ vsBot: false, rules });
      else if (choice === '3') await join((await ask('  Duel link or id: ')).trim().split('duel=').pop());
      else if (choice === '4') await board();
      else if (choice === '5') await wallet(rules);
      else if (choice === '6') await updown(rules);
      else if (choice === 'q') break;
    } catch (e) { console.log(red(`  ✗ ${e.message}`)); }
  }
}
main().catch((e) => console.log(red(`  ✗ ${e.message}`))).finally(() => { rl.close(); process.exit(0); });
