import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';

const RANGES = [['15m', 15], ['1h', 60], ['5h', 300]];
const usd = (v) => `$${Number(v).toFixed(2)}`;
const hhmm = (t) => new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * A plain, fixed market dashboard (no 3D, no camera moves): live BCH/USD price, change over the
 * chosen range, a line + area chart of real Coinbase 1-minute closes, your entry line and a live dot.
 */
export function MarketChart({ price, dir, livePts, entry, status }) {
  const [range, setRange] = useState(60);
  const [data, setData] = useState([]);
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  useEffect(() => {
    let stop = false;
    const load = () => api('price', { q: `&chart=${range}` }).then((p) => { if (!stop) setData(p.chart ?? []); }).catch(() => {});
    load(); const t = setInterval(load, 30000);
    return () => { stop = true; clearInterval(t); };
  }, [range]);

  // Closed candles + the live ticks since the last close, so the line moves every 2 seconds.
  const series = useMemo(() => {
    const s = [...data];
    const lastT = s.length ? s.at(-1)[0] : 0;
    for (const [t, p] of livePts) if (t > lastT + 1) s.push([t, p]);
    return s;
  }, [data, livePts]);

  const head = (
    <span className="muted small">BCH / USD · live · Coinbase last trade</span>
  );
  if (series.length < 2) {
    return (
      <div className="market">
        <div className="mhead"><div>{head}<div className="mprice">{price ? usd(price) : '—'}</div></div></div>
        {status && <div className="mstatus">{status}</div>}
        <div className="mempty muted">Loading real market data from Coinbase…</div>
      </div>
    );
  }

  const W = 720, H = 300, L = 8, R = 64, T = 14, B = 26;
  const ys = series.map((s) => s[1]).concat(entry ? [entry] : []);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = Math.max((hi - lo) * 0.12, hi * 0.0004); lo -= pad; hi += pad; // never a flat line: at least ±0.04 %
  const t0 = series[0][0], t1 = series.at(-1)[0];
  const x = (t) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = series.map(([t, v], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const area = `${line}L${x(t1)},${H - B}L${x(t0)},${H - B}Z`;
  const first = series[0][1], last = price ?? series.at(-1)[1];
  const ch = last - first, pct = (ch / first) * 100, up = ch >= 0;
  const col = up ? '#14b874' : '#e4544b';
  const ticks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * (i + 0.5)) / 4);
  const xt = [0, 1, 2, 3].map((i) => t0 + ((t1 - t0) * i) / 3);
  const onMove = (e) => {
    const r = box.current.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W;
    const t = t0 + ((px - L) / (W - L - R)) * (t1 - t0);
    let best = series[0]; for (const s of series) if (Math.abs(s[0] - t) < Math.abs(best[0] - t)) best = s;
    setHover(best);
  };

  return (
    <div className="market">
      <div className="mhead">
        <div>
          {head}
          <div className="mprice">{usd(last)} <span className={`mdir ${dir > 0 ? 'up' : dir < 0 ? 'down' : ''}`}>{dir > 0 ? '▲' : dir < 0 ? '▼' : ''}</span></div>
          <div className={up ? 'mchg up' : 'mchg down'}>{up ? '+' : ''}{ch.toFixed(2)} ({up ? '+' : ''}{pct.toFixed(2)}%) {up ? '↑' : '↓'} <span className="muted">last {RANGES.find((r) => r[1] === range)[0]}</span></div>
        </div>
        <div className="mranges" role="tablist">{RANGES.map(([k, n]) => <button key={k} className={range === n ? 'on' : ''} onClick={() => setRange(n)}>{k}</button>)}</div>
      </div>
      {status && <div className="mstatus">{status}</div>}
      <div className="mwrap">
        <svg ref={box} className="mchart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={`BCH price chart, last ${range} minutes`}>
          <defs><linearGradient id="mfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={col} stopOpacity=".2" /><stop offset="1" stopColor={col} stopOpacity="0" /></linearGradient></defs>
          {ticks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="mgrid" /><text x={W - R + 6} y={y(v) + 4} className="maxis">{v.toFixed(2)}</text></g>)}
          {xt.map((t, i) => <text key={i} x={Math.min(W - R - 40, Math.max(L, x(t) - 18))} y={H - 6} className="maxis">{hhmm(t)}</text>)}
          <path d={area} fill="url(#mfill)" />
          <path d={line} fill="none" stroke={col} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {entry && <g><line x1={L} x2={W - R} y1={y(entry)} y2={y(entry)} className="mentry" /><text x={W - R + 6} y={y(entry) + 4} className="maxis mentrylbl">entry</text></g>}
          <circle cx={x(t1)} cy={y(series.at(-1)[1])} r="4" fill={col} />
          {hover && <g><line x1={x(hover[0])} x2={x(hover[0])} y1={T} y2={H - B} className="mhover" /><circle cx={x(hover[0])} cy={y(hover[1])} r="4" fill={col} /></g>}
        </svg>
        {hover && <div className="mtip">{usd(hover[1])} · {hhmm(hover[0])}</div>}
      </div>
      <p className="muted small mnote">Real 1-minute closes from Coinbase BCH-USD, plus live trades every 2 s. Anyone can check them on coinbase.com.</p>
    </div>
  );
}
