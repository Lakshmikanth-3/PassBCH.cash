import React, { useEffect, useRef, useState } from 'react';
import { api, sats } from './api.js';
import { show } from '../three/show.js';

const short = (m) => m?.replace('openai/', '') ?? '';
const x = (pct) => `${(pct / 100).toFixed(2)}×`;
const clock = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/** AI Pass or Fail: a live AI coding exam drawn from a BCH block. Bet PASS or FAIL before it starts. */
export function AiGame({ rules, player, explorer, onChange }) {
  const [st, setSt] = useState(null); const [stake, setStake] = useState(rules.stakes[0]);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const skew = useRef(0); const lastDone = useRef(null);

  const load = async () => {
    try {
      const s = await api('ai');
      skew.current = s.now - Math.floor(Date.now() / 1000);
      const doneId = s.recent[0]?.id;
      if (lastDone.current && doneId !== lastDone.current) onChange?.();
      lastDone.current = doneId; setSt(s);
      const c = s.current ?? s.recent[0];
      if (c) show({ kind: 'ai', status: s.current ? (s.current.status === 'open' && s.now < Number(s.current.bet_close_s) ? 'open' : 'running') : c.status, model: c.model.replace('openai/', ''), slug: c.slug, pass: c.pass, passed: c.passed, total: c.total });
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => {
    load(); const a = setInterval(load, 4000);
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000) + skew.current), 250);
    return () => { clearInterval(a); clearInterval(t); };
  }, []);

  if (!st) return <div className="card"><p className="muted">Loading AI arena…</p></div>;
  const cur = st.current; const rec = cur ? st.records[cur.model] : null;
  const open = cur?.status === 'open' && now < Number(cur.bet_close_s);
  const total = player.bonus + player.cash;
  const bet = async (side) => {
    setBusy(true); setErr(null);
    try { await api('aibet', { body: { roundId: cur.id, side, stake } }); onChange?.(); await load(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="card ai">
      <div className="row between"><h2>🤖 AI Pass or Fail</h2><span className="muted small">A live AI coding exam, drawn from a BCH block</span></div>
      {!cur && (
        <div className="aiwait">
          {st.runnerOnline ? <p>Next exam is being drawn… <span className="muted small">(a new round opens every ~2 min)</span></p>
            : <p className="muted">The AI arena is resting right now. Rounds run while the exam machine is online — try ✊ Duel or 📈 Up/Down meanwhile.</p>}
        </div>
      )}
      {cur && (
        <>
          <div className="aimatch">
            <div><span className="muted small">AI agent</span><b>{short(cur.model)}</b><span className="muted small">record {rec.pass}/{rec.n}</span></div>
            <div className="vs">VS</div>
            <div><span className="muted small">Exercise #{cur.task_idx}</span><b>{cur.slug}</b><span className="muted small">block {cur.block_height}</span></div>
          </div>
          {open ? (
            <>
              <p className="center">Betting closes in <b className="mono">{clock(Number(cur.bet_close_s) - now)}</b> · {cur.bets} bets · pot {sats(cur.pot)}</p>
              <div className="chips">{rules.stakes.map((s) => <button key={s} type="button" className={`chip ${stake === s ? 'on' : ''}`} disabled={s > total} onClick={() => setStake(s)}>{sats(s)}</button>)}</div>
              <div className="udbtns">
                <button className="upbtn" disabled={busy || stake > total} onClick={() => bet('pass')}>✅ PASS <small>{x(rec.passPct)}</small></button>
                <button className="downbtn" disabled={busy || stake > total} onClick={() => bet('fail')}>❌ FAIL <small>{x(rec.failPct)}</small></button>
              </div>
            </>
          ) : (
            <p className="center coding"><span className="spinner" aria-hidden>✻</span> {short(cur.model)} is coding… <span className="muted small">(sealed sandbox, no internet, real tests)</span></p>
          )}
        </>
      )}
      <p className="muted small">The exercise is picked by <code>sha256(round ‖ latest BCH block hash)</code> from 141 public Exercism tasks. The AI gets one try plus one retry, then the real tests decide. Odds come from each AI's public record. Every result is written on chain.</p>
      {err && <p className="err">{err}</p>}
      {st.mine.length > 0 && (
        <ul className="mybets">
          {st.mine.map((b) => (
            <li key={b.id} className={b.outcome ?? ''}>
              <span>{b.side === 'pass' ? '✅' : '❌'} {sats(b.stake)} @ {x(b.odds_pct)}</span>
              <span className="muted small">{short(b.model)} · {b.slug}</span>
              <b>{b.outcome === 'win' ? `+${sats(b.payout)}` : b.outcome === 'lose' ? 'lost' : b.outcome === 'refund' ? 'refunded' : 'waiting'}</b><span />
            </li>
          ))}
        </ul>
      )}
      {st.recent.length > 0 && (
        <>
          <h3 className="sub">Recent exams</h3>
          <ul className="feed">
            {st.recent.slice(0, 6).map((r) => (
              <li key={r.id}>
                <span>{short(r.model)} · {r.slug}</span>
                <span>{r.status === 'void' ? <span className="muted">void (refunded)</span> : r.pass ? <b className="green">PASS {r.passed}/{r.total}</b> : <b className="red">FAIL {r.passed}/{r.total}</b>}</span>
                {r.record_txid ? <a href={`${explorer}${r.record_txid}`} target="_blank" rel="noreferrer">tx ↗</a> : <span className="muted small">…</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
