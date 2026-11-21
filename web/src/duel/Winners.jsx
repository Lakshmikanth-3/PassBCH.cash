import { Solvency } from './Solvency.jsx';
import React, { useEffect, useState } from 'react';
import { api, sats } from './api.js';
import { useFx, fiat } from './money.js';
import { Trophy } from '../icons.jsx';

const GAME_NAME = { rps: 'Rock · Paper · Scissors', updown: 'Up or Down', pf: 'Prompt Fight', coin: 'Coin Flip', type: 'Typing Race' };
const ago = (t) => { const s = Math.max(1, Math.floor((Date.now() - new Date(t).getTime()) / 1000)); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`; };

/** Worldwide winners across every game: totals, top winners, biggest and latest wins (each with its on-chain record). */
export function Winners({ explorer, go }) {
  const [game, setGame] = useState('all'); const [period, setPeriod] = useState('all');
  const [w, setW] = useState(null); const [err, setErr] = useState(null);
  const { rates, ccy } = useFx();
  useEffect(() => {
    let stop = false;
    const load = () => api('winners', { q: `&game=${game}&period=${period}` }).then((x) => !stop && setW(x)).catch((e) => !stop && setErr(e.message));
    load(); const t = setInterval(load, 8000); return () => { stop = true; clearInterval(t); };
  }, [game, period]);
  const tx = (t) => (t ? <a href={`/verify/${t}`}>Verify ✓</a> : <span className="muted small">recording…</span>);
  const who = (n) => <a href={`/u/${encodeURIComponent(n)}`}>{n}</a>;
  return (
    <main className="wrap">
      <h2 className="screen-title"><Trophy size={26} /> Worldwide winners</h2>
      <p className="muted">Every win in every game, from every player — each one backed by a public record on Bitcoin Cash.</p>
      <div className="row gap filters">
        <div className="seg four">{[['all', 'All games'], ['rps', 'Rock · Paper · Scissors'], ['updown', 'Up or Down'], ['pf', 'Prompt Fight'], ['coin', 'Coin Flip'], ['type', 'Typing Race']].map(([k, l]) => <button key={k} className={game === k ? 'on' : ''} onClick={() => setGame(k)}>{l}</button>)}</div>
        <div className="seg three slim">{[['today', 'Today'], ['week', '7 days'], ['all', 'All time']].map(([k, l]) => <button key={k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>)}</div>
      </div>
      {err && <p className="err">{err}</p>}
      {!w ? <div className="card"><p className="muted">Loading…</p></div> : (
        <>
          <Solvency />
          <div className="stats4">
            <div className="card stat"><span className="muted small">Paid to winners</span><b>{sats(w.totals.paid)}</b><span className="muted small">{fiat(w.totals.paid, rates, ccy)}</span></div>
            <div className="card stat"><span className="muted small">Wins</span><b>{w.totals.wins}</b><span className="muted small">{w.totals.winners} {w.totals.winners === 1 ? 'winner' : 'different winners'}</span></div>
            <div className="card stat"><span className="muted small">Games played</span><b>{w.totals.duels + w.totals.bets + w.totals.fights}</b><span className="muted small">{w.totals.duels} duels · {w.totals.bets} predictions · {w.totals.fights} fights</span></div>
            <div className="card stat"><span className="muted small">Players</span><b>{w.totals.players}</b><span className="muted small">worldwide</span></div>
          </div>
          <div className="grid">
            <div className="card">
              <h2>Top winners <span className="muted small">ranked by net profit = winnings minus stakes</span></h2>
              {w.top.length === 0 ? <p className="muted">No wins in this period yet — be the first.</p> : (
                <table className="lb"><thead><tr><th>#</th><th>Player</th><th>Wins</th><th>Net profit</th><th>Gross won</th></tr></thead>
                  <tbody>{w.top.map((t, i) => <tr key={t.name}><td className={i < 3 ? 'medal m' + i : ''}>{i + 1}</td><td>{who(t.name)}</td><td>{t.wins}</td><td className="green"><b>{sats(t.net)}</b><div className="muted small">{fiat(t.net, rates, ccy)}</div></td><td className="muted">{sats(t.won)}</td></tr>)}</tbody></table>
              )}
            </div>
            <div className="col">
              <div className="card">
                <h2>Biggest wins</h2>
                {w.biggest.length === 0 ? <p className="muted">Nothing yet.</p> : <ul className="feed">{w.biggest.map((x, i) => <li key={i}><span><b>{who(x.name)}</b> <span className="muted small">{GAME_NAME[x.game]}</span></span><b className="green">{sats(x.amount)}</b>{tx(x.tx)}</li>)}</ul>}
              </div>
              <div className="card">
                <h2><span className="live" /> Latest wins</h2>
                {w.latest.length === 0 ? <p className="muted">Nothing yet.</p> : <ul className="feed">{w.latest.map((x, i) => <li key={i}><span><b>{who(x.name)}</b> <span className="muted small">{GAME_NAME[x.game]} · {ago(x.at)}</span></span><b className="green">{sats(x.amount)}</b>{tx(x.tx)}</li>)}</ul>}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

/** Compact strip for the landing page. */
export function WinnersStrip({ onOpen }) {
  const [w, setW] = useState(null);
  useEffect(() => { api('winners').then(setW).catch(() => {}); }, []);
  if (!w) return null;
  return (
    <button className="card winstrip" onClick={onOpen}>
      <span><Trophy size={20} /> <b>{sats(w.totals.paid)}</b> paid to <b>{w.totals.winners}</b> {w.totals.winners === 1 ? 'winner' : 'winners'} · <b>{w.totals.duels + w.totals.bets + w.totals.fights}</b> games played</span>
      <span className="muted small">{w.latest[0] ? `Latest: ${w.latest[0].name} won ${sats(w.latest[0].amount)}` : 'Be the first winner'} · See all winners →</span>
    </button>
  );
}
