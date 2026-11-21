import React, { useEffect, useRef, useState } from 'react';
import { api, sats } from './api.js';
import Stage3D from '../three/Stage3D.jsx';

const fmt = (p) => (p ? `$${Number(p).toFixed(2)}` : '—');
const clock = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/** Up or Down: one big live box, then only two buttons. A tap asks to confirm before the bet is placed. */
export function UpDown({ rules, player, explorer, onChange }) {
  const [px, setPx] = useState(null); const [dir, setDir] = useState(0);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [stake, setStake] = useState(rules.stakes[0]);
  const [pending, setPending] = useState(null); // 'up' | 'down' awaiting confirm
  const [mine, setMine] = useState([]); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const skew = useRef(0); const last = useRef(null);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try { const p = await api('price'); if (stop) return; skew.current = p.now - Math.floor(Date.now() / 1000); if (last.current) setDir(Math.sign(p.price - last.current) || 0); last.current = p.price; setPx(p); } catch { /* keep */ }
      try { const b = await api('bets'); if (!stop) setMine((old) => { if (b.mine.some((x, i) => x.outcome && !old[i]?.outcome)) onChange?.(); return b.mine; }); } catch { /* ignore */ }
    };
    poll(); const a = setInterval(poll, 4000);
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000) + skew.current), 250);
    return () => { stop = true; clearInterval(a); clearInterval(t); };
  }, []);

  const next = Math.floor(now / 60) * 60 + 60;
  const total = player.bonus + player.cash;
  const confirm = async () => {
    setBusy(true); setErr(null);
    try { await api('bet', { body: { side: pending, stake } }); setPending(null); onChange?.(); setMine((await api('bets')).mine); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const live = mine.find((b) => !b.outcome);

  return (
    <div className="predict">
      <div className="mainbox">
        <Stage3D game="updown" height="clamp(280px, 42vw, 460px)">
          <div className="pricehud">
            <span className="muted small">BCH / USD · live</span>
            <span className={`bigprice ${dir > 0 ? 'up' : dir < 0 ? 'down' : ''}`}>{fmt(px?.price)} {dir > 0 ? '▲' : dir < 0 ? '▼' : ''}</span>
            <span className="small">next round in <b className="mono">{clock(next - now)}</b></span>
          </div>
        </Stage3D>
      </div>
      <div className="chips center-row">
        {rules.stakes.map((s) => <button key={s} type="button" className={`chip ${stake === s ? 'on' : ''}`} disabled={s > total} onClick={() => setStake(s)}>{sats(s)}</button>)}
      </div>
      <div className="udbtns">
        <button className="upbtn" disabled={busy || stake > total} onClick={() => setPending('up')}>▲ UP<small>pays {sats(Math.floor((stake * (rules.updownPayoutPct ?? 190)) / 100))}</small></button>
        <button className="downbtn" disabled={busy || stake > total} onClick={() => setPending('down')}>▼ DOWN<small>pays {sats(Math.floor((stake * (rules.updownPayoutPct ?? 190)) / 100))}</small></button>
      </div>
      {pending && (
        <div className="confirm" role="dialog" aria-modal="true" aria-label="Confirm your bet">
          <div className="card">
            <h2>{pending === 'up' ? '▲ UP' : '▼ DOWN'} for {sats(stake)}?</h2>
            <p className="muted">Your bet joins the round starting at {new Date(next * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (in {clock(next - now)}). If BCH closes that minute {pending === 'up' ? 'higher' : 'lower'} than it opened, you get {sats(Math.floor((stake * (rules.updownPayoutPct ?? 190)) / 100))}.</p>
            <div className="row gap"><button className={pending === 'up' ? 'upbtn slim' : 'downbtn slim'} disabled={busy} onClick={confirm}>{busy ? 'Placing…' : 'Confirm'}</button><button className="secondary" onClick={() => setPending(null)}>Cancel</button></div>
            {err && <p className="err">{err}</p>}
          </div>
        </div>
      )}
      {live && <p className="center livebet">Your bet: {live.side === 'up' ? '▲ UP' : '▼ DOWN'} {sats(live.stake)} · {now < Number(live.round_start) ? `starts in ${clock(Number(live.round_start) - now)}` : now < Number(live.round_start) + 60 ? `LIVE · ${clock(Number(live.round_start) + 60 - now)} left` : 'settling…'}</p>}
      {mine.length > 0 && (
        <div className="card">
          <h2>Your bets</h2>
          <ul className="mybets">
            {mine.map((b) => (
              <li key={b.id} className={b.outcome ?? ''}>
                <span>{b.side === 'up' ? '▲' : '▼'} {sats(b.stake)}</span>
                <span className="muted small">{b.open_price ? `${fmt(b.open_price)} → ${fmt(b.close_price)}` : new Date(Number(b.round_start) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <b>{b.outcome === 'win' ? `+${sats(b.payout)}` : b.outcome === 'lose' ? 'lost' : b.outcome === 'refund' ? 'refunded' : 'open'}</b>
                {b.record_txid ? <a href={`${explorer}${b.record_txid}`} target="_blank" rel="noreferrer">tx ↗</a> : <span />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Public feed of Up/Down bets. */
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
      <h2><span className="live" /> Live predictions</h2>
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
