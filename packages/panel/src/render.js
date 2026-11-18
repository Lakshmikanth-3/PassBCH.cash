// One- or two-line status line for Claude Code. Pure: everything comes in as arguments.
import { roundStatus, modelRecord, odds } from './rounds.js';

const C = { dim: '\x1b[2m', bold: '\x1b[1m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' };
const fmtS = (s) => (s < 60 ? `${Math.max(0, Math.floor(s))}s` : `${Math.floor(s / 60)}m${String(Math.floor(s % 60)).padStart(2, '0')}s`);

/**
 * state: { rounds, slugs[], updatedUnix, network }  (from the feed cache; may be null)
 * thinking: { sinceUnix } | null  (set by the UserPromptSubmit hook, cleared by Stop)
 */
export function renderPanel({ state, thinking, nowUnix, color = true, url = 'passrate-cash.vercel.app' }) {
  const c = color ? C : Object.fromEntries(Object.keys(C).map((k) => [k, '']));
  if (!state || !state.rounds?.length) return `${c.dim}🎲 PassRate: no rounds yet (run passrate-feed)${c.reset}`;
  const stale = nowUnix - state.updatedUnix > 120;
  const r = state.rounds[0];
  const slug = state.slugs?.[r.taskIdx] ?? `#${r.taskIdx}`;
  const s = roundStatus(r, nowUnix);
  const rec = modelRecord(state.rounds, r.model, nowUnix);
  const o = odds(rec);
  const net = state.network && state.network !== 'mainnet' ? ` ${c.dim}[${state.network}]${c.reset}` : '';

  let line;
  if (s === 'LIVE') {
    const left = r.deadlineUnix - nowUnix;
    line = `🎲 ${c.bold}${r.model}${c.reset} vs ${c.cyan}"${slug}"${c.reset} ${c.yellow}● LIVE${c.reset} ${fmtS(left)} left · `
      + `PASS ${c.green}${o.pass}x${c.reset} | FAIL ${c.red}${o.fail}x${c.reset}`;
  } else {
    const tag = s === 'PASS' ? `${c.green}✅ PASS${c.reset}` : s === 'FAIL' ? `${c.red}❌ FAIL${c.reset}` : `${c.red}⌛ TIMEOUT = FAIL${c.reset}`;
    const score = r.result ? ` ${r.result.passed}/${r.result.total}` : '';
    line = `🎲 ${c.bold}${r.model}${c.reset} vs ${c.cyan}"${slug}"${c.reset} ${tag}${score} · record ${rec.pass}/${rec.n} · next PASS ${o.pass}x | FAIL ${o.fail}x`;
  }
  if (stale) line += ` ${c.dim}(feed offline)${c.reset}`;
  line += net;
  if (!thinking) return line;
  // While Claude is cogitating, add the call to action.
  const waited = fmtS(nowUnix - thinking.sinceUnix);
  return `${line}\n${c.dim}✻ Claude thinking ${waited} · back a side on your phone →${c.reset} ${c.bold}${url}${c.reset}`;
}
