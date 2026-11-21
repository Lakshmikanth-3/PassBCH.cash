import { Solvency } from './Solvency.jsx';
import React, { useEffect, useState } from 'react';
import { api, sats } from './api.js';

const hexToBytes = (h) => Uint8Array.from(h.match(/../g).map((b) => parseInt(b, 16)));
const toHex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const u32 = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] * 16777216);
const sha256hex = async (s) => toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
const MOVES = ['rock', 'paper', 'scissors'];
const GAME = { rps: 'Rock · Paper · Scissors', updown: 'Up or Down', pf: 'Prompt Fight' };

/** Decode our OP_RETURN record straight from the raw transaction bytes (no server interpretation). */
export function decodeRecord(raw) {
  const m = raw.match(/6a(?:4c[0-9a-f]{2}|[0-9a-f]{2})((?:53444c31|53554431|53504631)[0-9a-f]+)/);
  if (!m) return null;
  const b = hexToBytes(m[1]); const kind = String.fromCharCode(...b.slice(0, 4)); const id = toHex(b.slice(4, 20));
  if (kind === 'SDL1') return { kind, id, result: b[20], stake: u32(b, 21), moveA: MOVES[b[25]] ?? null, moveB: MOVES[b[26]], commit: toHex(b.slice(27, 59)) };
  if (kind === 'SUD1') return { kind, id, side: ['flat', 'up', 'down'][b[20]], result: ['flat', 'up', 'down'][b[21]], stake: u32(b, 22), roundStart: u32(b, 26), open: u32(b, 30) / 1e4, close: u32(b, 34) / 1e4 };
  if (kind === 'SPF1') return { kind, id, winner: b[20] === 1 ? 'a' : 'b', target: b[21], maxStep: b[22], stake: u32(b, 23), turnsHash: toHex(b.slice(27, 59)) };
  return null;
}
const outcome = (a, b) => (a === b ? 0 : (MOVES.indexOf(a) - MOVES.indexOf(b) + 3) % 3 === 1 ? 1 : 2);

/** Every check runs in this browser from the chain record; the server's copy is only compared, never trusted. */
async function checks(rec, m) {
  const out = []; const add = (ok, text) => out.push({ ok, text });
  if (!m) { add(false, 'No game with this id in the PassBCH database'); return out; }
  add(rec.id === m.id, 'Record id matches the game');
  add(rec.stake === m.stake, `Stake on chain ${sats(rec.stake)} matches`);
  if (rec.kind === 'SDL1') {
    add(rec.commit === m.commit, 'Commitment on chain matches the one locked before the opponent played');
    if (m.aSalt && rec.moveA) add((await sha256hex(`${rec.moveA}:${m.aSalt}`)) === rec.commit, `sha256("${rec.moveA}:salt") equals the commitment, so the creator could not change their move`);
    else if (rec.moveA) out.push({ ok: null, text: 'Salt check not available: this duel was played before reveal salts were published' });
    else add(true, 'Creator never revealed in time: forfeit to the joiner');
    if (rec.moveA) add(outcome(rec.moveA, rec.moveB) === rec.result, `Recomputed: ${rec.moveA} vs ${rec.moveB} → ${['draw', 'creator wins', 'joiner wins'][outcome(rec.moveA, rec.moveB)]}`);
    add(rec.result === m.result, 'Result on chain matches the result paid out');
  }
  if (rec.kind === 'SUD1') {
    const r = rec.close > rec.open ? 'up' : rec.close < rec.open ? 'down' : 'flat';
    add(r === rec.result, `Recomputed: $${rec.open} → $${rec.close} = ${r.toUpperCase()}`);
    add(Math.abs(rec.open - m.open) < 0.0001 && Math.abs(rec.close - m.close) < 0.0001, 'Entry and exit prices on chain match the settled bet');
    add((rec.side === rec.result) === (m.outcome === 'win'), `Bet ${rec.side.toUpperCase()} → ${m.outcome}`);
  }
  if (rec.kind === 'SPF1') {
    const t = m.turns ?? [];
    add((await sha256hex(JSON.stringify(t.map((x) => [x.side, x.add])))) === rec.turnsHash, 'sha256 of every move equals the hash on chain');
    let total = 0, ok = true; t.forEach((x, i) => { if (x.add < 1 || x.add > rec.maxStep || (i && x.side === t[i - 1].side)) ok = false; total += x.add; });
    add(ok, `Every move was 1–${rec.maxStep} and players alternated`);
    add(total === rec.target && t.at(-1)?.side === rec.winner, `Recomputed: total reaches exactly ${rec.target} on the winner's move`);
  }
  return out;
}

export function Verify({ txid: initial, go }) {
  const [txid, setTxid] = useState(initial ?? ''); const [res, setRes] = useState(null); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const run = async (t) => {
    setBusy(true); setErr(null); setRes(null);
    try {
      const r = await api('verify', { q: `&txid=${t.trim()}` });
      const rec = decodeRecord(r.raw);
      setRes({ ...r, rec, checks: rec ? await checks(rec, r.match) : [] });
      if (location.pathname !== `/verify/${t.trim()}`) history.replaceState(null, '', `/verify/${t.trim()}`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  useEffect(() => { if (initial) run(initial); }, [initial]);
  const allOk = res?.checks.length && res.checks.every((c) => c.ok !== false);
  return (
    <main className="wrap narrow">
      <div className="card">
        <h2>Verify a result</h2>
        <p className="muted small">Paste any PassBCH transaction id. Your browser reads the record from the Bitcoin Cash transaction and recomputes the result itself — you don't have to trust our server.</p>
        <form className="row gap" onSubmit={(e) => { e.preventDefault(); run(txid); }}>
          <input value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="transaction id (64 hex characters)" aria-label="Transaction id" />
          <button className="primary" disabled={busy || txid.trim().length !== 64}>{busy ? 'Checking…' : 'Verify'}</button>
        </form>
        {err && <p className="err">{err}</p>}
      </div>
      {res && (
        <div className="card">
          {!res.rec ? <p className="err">This transaction has no PassBCH game record.</p> : (
            <>
              <div className={`verdict ${allOk ? 'win' : 'lose'}`}>{allOk ? 'Verified ✓' : 'Mismatch — see the failed checks'}</div>
              <p className="muted small center">{GAME[res.match?.game] ?? res.rec.kind} · {res.network} · <a href={`${res.explorer}${res.txid}`} target="_blank" rel="noreferrer">open in explorer ↗</a></p>
              {res.match?.game === 'rps' && <p className="center">{res.match.aName} {res.rec.moveA ?? '(no reveal)'} vs {res.rec.moveB} {res.match.bName}</p>}
              {res.match?.game === 'updown' && <p className="center">{res.match.name} bet {res.rec.side.toUpperCase()} · ${res.rec.open} → ${res.rec.close}</p>}
              {res.match?.game === 'pf' && <p className="center">{res.match.aName} vs {res.match.bName} · Race to {res.rec.target} · {res.rec.winner === 'a' ? res.match.aName : res.match.bName} won</p>}
              <ul className="checks">{res.checks.map((c, i) => <li key={i} className={c.ok === null ? 'info' : c.ok ? 'ok' : 'bad'}><span>{c.ok === null ? 'ⓘ' : c.ok ? '✓' : '✗'}</span>{c.text}</li>)}</ul>
              <details><summary>Raw record decoded from the chain</summary><pre className="raw">{JSON.stringify(res.rec, null, 2)}</pre></details>
            </>
          )}
        </div>
      )}
    </main>
  );
}

export function Profile({ name, go, explorer }) {
  const [p, setP] = useState(null); const [err, setErr] = useState(null);
  useEffect(() => { api('player', { q: `&name=${encodeURIComponent(name)}` }).then(setP).catch((e) => setErr(e.message)); }, [name]);
  if (err) return <main className="wrap narrow"><div className="card"><h2>Player not found</h2><p className="muted">{err}</p><button className="primary" onClick={() => go('winners')}>Back to winners</button></div></main>;
  if (!p) return <main className="wrap narrow"><div className="card"><p className="muted">Loading player…</p></div></main>;
  const s = p.stats;
  return (
    <main className="wrap">
      <h2 className="screen-title">{p.name}</h2>
      <p className="muted">Playing since {new Date(p.since).toLocaleDateString()} · {s.verified}/{s.games} games recorded on chain</p>
      <div className="stats4">
        <div className="card stat"><span className="muted small">Net</span><b className={s.net >= 0 ? 'green' : 'red'}>{s.net >= 0 ? '+' : ''}{sats(s.net)}</b></div>
        <div className="card stat"><span className="muted small">Win rate</span><b>{Math.round(s.winRate * 100)}%</b><span className="muted small">{s.wins}W · {s.losses}L</span></div>
        <div className="card stat"><span className="muted small">Games</span><b>{s.games}</b></div>
        <div className="card stat"><span className="muted small">Total staked</span><b>{sats(s.staked)}</b></div>
      </div>
      <div className="card">
        <h2>History</h2>
        {p.history.length === 0 ? <p className="muted">No finished games yet.</p> : (
          <table className="lb"><thead><tr><th>When</th><th>Game</th><th>Against / side</th><th>Stake</th><th>Result</th><th>Proof</th></tr></thead>
            <tbody>{p.history.map((h) => (
              <tr key={h.game + h.id}><td>{new Date(h.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td><td>{GAME[h.game]}</td><td>{h.opponent}</td><td>{sats(h.stake)}</td>
                <td className={h.outcome === 'win' ? 'green' : h.outcome === 'lose' ? 'red' : ''}>{h.outcome}{h.outcome === 'win' ? ` +${sats(h.paid - h.stake)}` : ''}</td>
                <td>{h.tx ? <a href={`/verify/${h.tx}`} onClick={(e) => { e.preventDefault(); go('verify', h.tx); }}>Verify ✓</a> : <span className="muted small">recording…</span>}</td></tr>))}</tbody></table>
        )}
      </div>
    </main>
  );
}

export function Rules({ rules }) {
  const r = rules ?? {};
  return (
    <main className="wrap narrow rules">
      <div className="card">
        <h2>How PassBCH.cash works</h2>
        <Solvency />
        <p className="muted">Three short games played with Bitcoin Cash. During the BLAZE hackathon everything runs on <b>chipnet (test BCH with no real value)</b>; mainnet only after full testing.</p>
      </div>
      <div className="card"><h2>Rock · Paper · Scissors</h2><ul>
        <li>Your move is sent only as <code>sha256(move:salt)</code>. The opponent plays without seeing it; then your browser reveals the move and salt.</li>
        <li>The reveal must match the commitment — you cannot change your move. Not revealing within 2 minutes = you lose.</li>
        <li>Winner takes the whole pot; draw = both stakes back. The House Bot's move is fixed by a secret seed before you reveal.</li></ul></div>
      <div className="card"><h2>Up or Down</h2><ul>
        <li>Entry = Coinbase BCH-USD last trade price at the second you confirm. Exit = the last trade price exactly 60 seconds later.</li>
        <li>Price higher = UP wins, lower = DOWN wins, <b>exactly the same = your stake comes back</b>. A right call pays {(r.updownPayoutPct ?? 190) / 100}×.</li></ul></div>
      <div className="card"><h2>Prompt Fight</h2><ul>
        <li>Each player writes a strategy prompt for an AI agent (Groq gpt-oss-20b). The agents play <b>Race to N</b>: take turns adding 1…k; whoever reaches N exactly wins.</li>
        <li>N (15–24) and k (2–4) are drawn from the match id. <b>Who moves first is a commit-reveal coin flip:</b> the server publishes sha256(seed) when the match is created and reveals the seed after the fight. Code enforces every move; there is no AI judge to trick.</li>
        <li>Race to N is a solved game: for each N and k there is a winning line. A good prompt is one that makes your agent find and follow it (for example, keep the total at a multiple of k+1 when you can).</li>
        <li>Each agent sees only its own prompt. Prompts are revealed after the fight. A reply without a valid number plays the smallest move (marked *).</li></ul></div>
      <div className="card"><h2>Fairness and proof</h2><ul>
        <li>Every finished game is written to Bitcoin Cash as an OP_RETURN record (<code>SDL1</code> duel, <code>SUD1</code> Up/Down, <code>SPF1</code> Prompt Fight).</li>
        <li>Open <a href="/verify">Verify</a> and paste any transaction id: your browser decodes the record and recomputes the result.</li>
        <li>Balances are held by the platform (custodial), like a card room. The chain is the public scoreboard.</li></ul></div>
      <div className="card"><h2>Fees, bonus and limits</h2><ul>
        <li>Free starting credit: {((r.signupBonus ?? 25000) / 1e8).toFixed(5)} BCH; invite a friend and you both get more. Max 3 bonuses per network, 100 in total.</li>
        <li>Bonus is for playing; it must be played 2× before any withdrawal. Won bonus from a friend duel stays bonus.</li>
        <li>Withdrawal fee {r.withdrawFeePct ?? 5}% (min {((r.networkFee ?? 400) / 1e8).toFixed(6)} BCH). Up/Down and Prompt Fight have no extra fee; the House edge in Up/Down is 5% (pays 1.9×, not 2×).</li></ul></div>
      <div className="card"><h2>Responsible play</h2><ul>
        <li>18+ only. Play for fun with amounts you can afford to lose. Real-money games are regulated or restricted in many countries — check your local law.</li>
        <li>Take breaks. If you want to stop, log out and delete your login code; ask us to close your account at any time.</li></ul></div>
      <div className="card"><h2>FAQ</h2>
        <p><b>Do I need a wallet?</b> Not to start: pick a name and play with free credit. To add or withdraw BCH use WizardConnect or any BCH wallet.</p>
        <p><b>I lost my login code.</b> The code is your account key. Keep it private; without it the account can't be recovered.</p>
        <p><b>Why chipnet?</b> So judges and players can test everything safely before real money is involved.</p>
        <p><b>Privacy.</b> We store your player name, a hash of your network address (abuse limits) and your game history. No email, no tracking cookies.</p></div>
    </main>
  );
}
