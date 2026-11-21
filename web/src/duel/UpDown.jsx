import { StakePicker } from './StakePicker.jsx';
import LowBalance from './LowBalance.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { api, sats } from './api.js';
import { MarketChart } from './MarketChart.jsx';
import { show } from '../three/show.js';

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
  const [pts, setPts] = useState([]);
  const [hist, setHist] = useState([]);
  const [result, setResult] = useState(null); // last settled bet, shown on the dashboard for 15 s
  useEffect(() => { api('price', { q: '&history=1' }).then((p) => setHist(p.history ?? [])).catch(() => {}); const t = setInterval(() => api('price', { q: '&history=1' }).then((p) => setHist(p.history ?? [])).catch(() => {}), 60000); return () => clearInterval(t); }, []);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try { const p = await api('price'); if (stop) return; show({ kind: 'price', price: p.price }); skew.current = p.now - Math.floor(Date.now() / 1000); if (last.current) setDir(Math.sign(p.price - last.current) || 0); last.current = p.price; setPx(p); setPts((a) => [...a.slice(-149), [p.now, p.price]]); } catch { /* keep */ }
      try {
        const b = await api('bets'); if (stop) return;
        setMine((old) => {
          const fresh = b.mine.find((x) => x.outcome && old.some((o) => o.id === x.id && !o.outcome));
          if (fresh) { onChange?.(); setResult(fresh); setTimeout(() => setResult(null), 15000); show({ kind: 'udresult', outcome: fresh.outcome, open: Number(fresh.open_price).toFixed(2), close: Number(fresh.close_price).toFixed(2) }); }
          return b.mine;
        });
      } catch { /* ignore */ }
    };
    let busy = false; const safe = async () => { if (busy) return; busy = true; try { await poll(); } finally { busy = false; } }; // never pile up requests
    safe(); const a = setInterval(safe, 2000);
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000) + skew.current), 250);
    return () => { stop = true; clearInterval(a); clearInterval(t); };
  }, []);

  const ROUND = rules.updownRoundS ?? 60;
  const total = player.bonus + player.cash;
  const confirm = async () => {
    setBusy(true); setErr(null);
    try { const b = await api('bet', { body: { side: pending, stake } }); show({ kind: 'udbet', side: pending, entry: b.entryPrice }); setPending(null); onChange?.(); setMine((await api('bets')).mine); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const live = mine.find((b) => !b.outcome);

  return (
    <div className="predict gamelayout">
      <div className="mainbox stagecol">
        <MarketChart price={px?.price} dir={dir} livePts={pts} entry={live ? Number(live.open_price) : null}
          status={live ? (now < Number(live.round_start) + ROUND
            ? <>Your bet: <b>{live.side === 'up' ? '▲ UP' : '▼ DOWN'}</b> from {fmt(live.open_price)} · <b className="mono">{clock(Number(live.round_start) + ROUND - now)}</b> left · {px && ((live.side === 'up') === (px.price > Number(live.open_price)) ? <b className="green">winning</b> : px.price === Number(live.open_price) ? <b>level</b> : <b className="red">losing</b>)}</>
            : 'Settling your bet…') : result ? <b className={result.outcome === 'win' ? 'green' : result.outcome === 'lose' ? 'red' : ''}>{result.outcome === 'win' ? `You won ${sats(result.payout)}` : result.outcome === 'lose' ? 'You lost this round' : 'Same price: stake refunded'} · {fmt(result.open_price)} → {fmt(result.close_price)}</b> : <>Tap UP or DOWN · result in exactly <b>1 minute</b> · same price = stake back</>} />
      </div>
      <div className="col">
      <div className="card">
      <Trend hist={hist} now={px?.price} />
      <h2>Pick your stake</h2>
      <StakePicker rules={rules} stake={stake} setStake={setStake} total={total} />
      <LowBalance player={player} rules={rules} />
      <div className="udbtns">
        <button className="upbtn" disabled={busy || stake > total || !!live} onClick={() => setPending('up')}>▲ UP<small>pays {sats(Math.floor((stake * (rules.updownPayoutPct ?? 190)) / 100))}</small></button>
        <button className="downbtn" disabled={busy || stake > total || !!live} onClick={() => setPending('down')}>▼ DOWN<small>pays {sats(Math.floor((stake * (rules.updownPayoutPct ?? 190)) / 100))}</small></button>
      </div>
      {pending && (
        <div className="confirm" role="dialog" aria-modal="true" aria-label="Confirm your bet">
          <div className="card">
            <h2>{pending === 'up' ? '▲ UP' : '▼ DOWN'} for {sats(stake)}?</h2>
            <p className="muted">Your entry is the BCH price at the moment you confirm. Exactly 60 seconds later, if the price is {pending === 'up' ? 'higher' : 'lower'}, you get {sats(Math.floor((stake * (rules.updownPayoutPct ?? 190)) / 100))}. Same price = stake back.</p>
            <div className="row gap"><button className={pending === 'up' ? 'upbtn slim' : 'downbtn slim'} disabled={busy} onClick={confirm}>{busy ? 'Placing…' : 'Confirm'}</button><button className="secondary" onClick={() => setPending(null)}>Cancel</button></div>
            {err && <p className="err">{err}</p>}
          </div>
        </div>
      )}
      </div>

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
    </div>
  );
}

/** Plain-language read of the last minutes to help decide (not advice: the next minute is a coin flip). */
function Trend({ hist, now }) {
  if (!hist?.length || !now) return null;
  const closes = [...hist, now];
  const pct = (a, b) => ((b - a) / a) * 100;
  const last5 = closes.slice(-6), last1 = closes.slice(-2);
  const ch5 = pct(last5[0], last5.at(-1)), ch1 = pct(last1[0], last1.at(-1));
  let ups = 0; for (let i = 1; i < last5.length; i++) if (last5[i] > last5[i - 1]) ups++;
  const fmtp = (v) => `${v >= 0 ? '▲ +' : '▼ '}${v.toFixed(2)}%`;
  const lean = ups >= 4 ? 'mostly up' : ups <= 1 ? 'mostly down' : 'mixed';
  return (
    <div className="trend">
      <div><span className="muted small">Last 5 min</span><b className={ch5 >= 0 ? 'green' : 'red'}>{fmtp(ch5)}</b></div>
      <div><span className="muted small">Last minute</span><b className={ch1 >= 0 ? 'green' : 'red'}>{fmtp(ch1)}</b></div>
      <div><span className="muted small">Candles</span><b>{ups} of {last5.length - 1} up · {lean}</b></div>
      <p className="muted small">The chart shows recent moves to help you read the market. Past minutes don't decide the next one.</p>
    </div>
  );
}

/** Tiny 2D price line (last ~2 minutes); dashed line = your entry price. */
function Spark({ pts, entry }) {
  if (pts.length < 2) return null;
  const all = entry ? [...pts, entry] : pts; const lo = Math.min(...all), hi = Math.max(...all), span = Math.max(0.01, hi - lo);
  const W = 220, H = 40, y = (v) => H - ((v - lo) / span) * (H - 4) - 2;
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * W).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const up = pts.at(-1) >= pts[0];
  return (<svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-label="Recent BCH price">
    {entry && <line x1="0" x2={W} y1={y(entry)} y2={y(entry)} stroke="#ffc23d" strokeDasharray="4 3" strokeWidth="1" />}
    <path d={d} fill="none" stroke={up ? '#b6ff3b' : '#ff4d6d'} strokeWidth="2" /></svg>);
}
/** Countdown ring for the running minute. */
function Ring({ left, total }) {
  const r = 18, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, left / total));
  return (<svg className="ring" width="48" height="48" viewBox="0 0 48 48" aria-label={`${Math.max(0, left)} seconds left`}>
    <circle cx="24" cy="24" r={r} stroke="#2a2e66" strokeWidth="4" fill="none" />
    <circle cx="24" cy="24" r={r} stroke="#00e5ff" strokeWidth="4" fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - f)} transform="rotate(-90 24 24)" strokeLinecap="round" />
    <text x="24" y="28" textAnchor="middle" fill="#eef0ff" fontSize="12" fontWeight="700">{Math.max(0, left)}</text></svg>);
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
