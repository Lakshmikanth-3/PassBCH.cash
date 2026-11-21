import React, { useEffect, useRef, useState } from 'react';
import { api, sats } from './api.js';
import { show } from '../three/show.js';

const fmt = (p) => (p ? `$${Number(p).toFixed(2)}` : '—');
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/** Up / Down: bet on the next 1-minute BCH/USD candle. Two buttons, one minute, public price. */
export function UpDown({ rules, player, explorer, onChange }) {
  const [px, setPx] = useState(null); const [prev, setPrev] = useState(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [stake, setStake] = useState(rules.stakes[0]);
  const [mine, setMine] = useState([]); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const skew = useRef(0);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try { const p = await api('price'); if (stop) return; skew.current = p.now - Math.floor(Date.now() / 1000); show({ kind: 'price', price: p.price }); setPx((old) => { setPrev(old?.price ?? null); return p; }); } catch { /* keep last */ }
      try { const b = await api('bets'); if (!stop) { setMine((old) => { if (b.mine.some((x, i) => x.outcome && !old[i]?.outcome)) onChange?.(); return b.mine; }); } } catch { /* ignore */ }
    };
    poll(); const a = setInterval(poll, 5000);
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000) + skew.current), 250);
    return () => { stop = true; clearInterval(a); clearInterval(t); };
  }, []);

  const next = Math.floor(now / 60) * 60 + 60;
  const total = player.bonus + player.cash;
  const bet = async (side) => {
    setBusy(true); setErr(null);
    try { await api('bet', { body: { side, stake } }); onChange?.(); const b = await api('bets'); setMine(b.mine); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const dir = px && prev ? Math.sign(px.price - prev) : 0;

  return (
    <div className="card updown">
      <div className="row between"><h2>📈 Up or Down</h2><span className="muted small">BCH/USD · 1-minute round · win pays {(rules.updownPayoutPct ?? 190) / 100}×</span></div>
      <div className="ticker">
        <span className={`price ${dir > 0 ? 'up' : dir < 0 ? 'down' : ''}`}>{fmt(px?.price)}</span>
        <span className="muted small">next round starts in <b className="mono">{clock(next - now)}</b></span>
      </div>
      <div className="chips">
        {rules.stakes.map((s) => <button key={s} type="button" className={`chip ${stake === s ? 'on' : ''}`} disabled={s > total} onClick={() => setStake(s)}>{sats(s)}</button>)}
      </div>
      <div className="udbtns">
        <button className="upbtn" disabled={busy || stake > total} onClick={() => bet('up')}>▲ UP</button>
        <button className="downbtn" disabled={busy || stake > total} onClick={() => bet('down')}>▼ DOWN</button>
      </div>
      <p className="muted small">Your bet joins the round that starts at the next full minute. When it ends, the public Coinbase BCH-USD candle decides: close above open = UP, below = DOWN, unchanged = refund.</p>
      {err && <p className="err">{err}</p>}
      {mine.length > 0 && (
        <ul className="mybets">
          {mine.map((b) => {
            const rs = Number(b.round_start);
            const state = b.outcome ? b.outcome : now < rs ? `starts in ${clock(rs - now)}` : now < rs + 60 ? `live · ${clock(rs + 60 - now)} left` : 'settling…';
            return (
              <li key={b.id} className={b.outcome ?? ''}>
                <span>{b.side === 'up' ? '▲' : '▼'} {sats(b.stake)}</span>
                <span className="muted small">{b.open_price ? `${fmt(b.open_price)} → ${fmt(b.close_price)}` : new Date(rs * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <b>{b.outcome === 'win' ? `+${sats(b.payout)}` : b.outcome === 'lose' ? 'lost' : b.outcome === 'refund' ? 'refunded' : state}</b>
                {b.record_txid ? <a href={`${explorer}${b.record_txid}`} target="_blank" rel="noreferrer">tx ↗</a> : <span />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Public feed of Up/Down bets for the leaderboard column. */
export function UpDownFeed({ explorer }) {
  const [feed, setFeed] = useState([]);
  useEffect(() => {
    let stop = false;
    const tick = () => api('bets').then((b) => !stop && setFeed(b.feed)).catch(() => {});
    tick(); const t = setInterval(tick, 6000); return () => { stop = true; clearInterval(t); };
  }, []);
  if (!feed.length) return null;
  return (
    <div className="card">
      <h2><span className="live" /> Up/Down bets</h2>
      <ul className="feed">
        {feed.slice(0, 12).map((b) => (
          <li key={b.id}>
            <span>{b.name} {b.side === 'up' ? <b className="green">▲</b> : <b className="red">▼</b>} {sats(b.stake)}</span>
            <span>{b.outcome === 'win' ? <b className="green">+{sats(b.payout)}</b> : b.outcome === 'lose' ? <span className="muted">lost</span> : b.outcome === 'refund' ? <span className="muted">refund</span> : <span className="muted">open</span>}</span>
            {b.record_txid ? <a href={`${explorer}${b.record_txid}`} target="_blank" rel="noreferrer">tx ↗</a> : <span className="muted small">…</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
