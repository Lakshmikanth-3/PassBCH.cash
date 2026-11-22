import { useEffect, useRef, useState } from 'react';
import { api, sats } from './api.js';
import Stage3D from '../three/Stage3D.jsx';
import { show } from '../three/show.js';
import { TermInvite } from './TermInvite.jsx';
import { VerifiedCard } from './VerifiedCard.jsx';
import { Signup } from './Play.jsx';

/** Live friend race: same phrase, shared start time, first valid finish wins the pot. The 3D scene shows both runners. */
export function RaceView({ id, me, explorer, network, onClose, onChange, refCode, onSignedUp }) {
  const [s, setS] = useState(null); const [err, setErr] = useState(null); const [text, setText] = useState('');
  const [skew, setSkew] = useState(0); const [tick, setTick] = useState(0); const [copied, setCopied] = useState(false);
  const sent = useRef({ p: 0, at: 0 }); const done = useRef(false); const started = useRef(false); const resShown = useRef(false);
  const link = `${location.origin}/race/${id}`;

  useEffect(() => {
    let stop = false;
    const load = async () => { try { const x = await api('prstate', { q: `&id=${id}` }); if (stop) return; setSkew(x.now - Date.now()); setS(x); } catch (e) { setErr(e.message); } };
    load(); const i = setInterval(load, 500);
    const t = setInterval(() => setTick((n) => n + 1), 100);
    show({ kind: 'typingreset' });
    return () => { stop = true; clearInterval(i); clearInterval(t); };
  }, [id, me?.id]);

  const now = Date.now() + skew;
  const mine = s?.role;
  const oppP = s ? (mine === 'a' ? s.bP : s.aP) : 0;
  const oppName = s ? (mine === 'a' ? s.bName : s.aName) : null;
  const racing = s?.status === 'racing', live = racing && s.startMs != null && now >= s.startMs;

  // 3D: name the opponent and set the banner for each stage of the race
  useEffect(() => {
    if (!s) return;
    show({ kind: 'typingopp', p: 0, name: oppName ?? 'Your friend' });
    if (s.status === 'open') show({ kind: 'typingcount', text: mine === 'a' ? 'Waiting for your friend to join…' : `${s.aName} challenges you` });
  }, [s?.status, oppName]);

  // 3D: countdown banner, start, opponent runner
  useEffect(() => {
    if (!s || !racing || !mine) return;
    if (now < s.startMs) show({ kind: 'typingcount', text: `Get ready… ${Math.ceil((s.startMs - now) / 1000)}` });
    else if (!started.current) { started.current = true; show({ kind: 'typingstart' }); }
    if (started.current) show({ kind: 'typingopp', p: oppP, name: oppName });
  }, [tick]);

  // progress to the server (about twice a second, only when it changed)
  const correct = s?.phrase ? [...text.toLowerCase()].filter((c, i) => c === s.phrase[i]).length : 0;
  const prog = s?.phrase ? correct / s.phrase.length : 0;
  useEffect(() => {
    if (!live || done.current) return;
    if (prog > sent.current.p && Date.now() - sent.current.at > 450) { sent.current = { p: prog, at: Date.now() }; api('prprogress', { body: { id, p: prog } }).catch(() => {}); }
  }, [tick]);

  // result in 3D, once
  useEffect(() => {
    if (!s || s.status !== 'done' || !mine || resShown.current) return;
    resShown.current = true; onChange?.();
    const winMs = s.winner === 'a' ? s.aMs : s.bMs; const iWon = s.winner === mine;
    if (s.winner === 'draw') return;
    show({ kind: 'typingresult', playerMs: iWon ? winMs : winMs * 1.25, botMs: iWon ? winMs * 1.25 : winMs, outcome: iWon ? 'win' : 'lose' });
  }, [s?.status]);

  const finish = async (v) => { if (done.current) return; done.current = true; try { await api('prfinish', { body: { id, text: v } }); onChange?.(); } catch (e) { setErr(e.message); done.current = false; } };
  const onType = (v) => { setText(v); if (s?.phrase && v.toLowerCase() === s.phrase) finish(v); };
  const join = async () => { try { await api('prjoin', { body: { id } }); onChange?.(); } catch (e) { setErr(e.message); } };
  const cancel = async () => { try { await api('prcancel', { body: { id } }); onChange?.(); onClose?.(); } catch (e) { setErr(e.message); } };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { /* blocked */ } };

  if (!s) return <div className="card"><p className="muted">Loading race…</p>{err && <p className="err">{err}</p>}</div>;
  const left = s.startMs ? Math.max(0, s.startMs - now) : 0;
  const winnerName = s.winner === 'a' ? s.aName : s.winner === 'b' ? s.bName : null;
  const iWon = s.winner && s.winner === mine;
  return (
    <div className="gamelayout">
      <div className="stagecol">
        <Stage3D game="typing" height="clamp(260px, 40vw, 420px)" live={racing} />
      </div>
      <div className="col">
        <div className="card typing">
          <div className="row between"><h2>Typing Race: {s.aName}{s.bName ? ` vs ${s.bName}` : ''}</h2><span className="mono">{sats(s.stake)} each</span></div>

          {s.status === 'open' && mine === 'a' && (
            <>
              <p className="muted">Send this link to a friend. When they join, a 4-second countdown starts and you both type the same phrase. First to finish wins the pot. Unjoined races refund after 10 minutes.</p>
              <div className="row gap"><code className="linkbox">{link}</code><button className="primary" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button></div>
              <p className="muted small" style={{ margin: '10px 0 4px' }}>Friend coding in a terminal? They paste one line and race there:</p>
              <TermInvite link={link} />
              <button className="secondary" style={{ marginTop: 10 }} onClick={cancel}>Cancel and refund</button>
            </>
          )}
          {s.status === 'open' && mine !== 'a' && (
            me ? (<><p><b>{s.aName}</b> challenges you to a typing race for {sats(s.stake)} each. Same phrase, first to finish wins {sats(2 * s.stake)}.</p><button className="primary big" onClick={join}>Join the race for {sats(s.stake)}</button></>)
              : <><p><b>{s.aName}</b> challenges you to a typing race. Pick a name to join (free bonus covers the stake).</p><Signup refCode={refCode} onDone={onSignedUp} /></>
          )}

          {racing && !live && <div className="verdict" style={{ fontSize: 40 }}>{Math.ceil(left / 1000)}</div>}
          {racing && !live && <p className="muted center">Get ready. The phrase appears at zero.</p>}
          {racing && live && mine && s.phrase && (
            <>
              <p className="phrase" aria-label="Type this phrase">{[...s.phrase].map((c, i) => <span key={i} className={i < text.length ? (text[i].toLowerCase() === c ? 'ok' : 'bad') : ''}>{c}</span>)}</p>
              <input autoFocus value={text} onChange={(e) => onType(e.target.value)} onPaste={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Type here, fast" aria-label="Your typing" />
              <div className="progressbar"><div style={{ width: `${prog * 100}%` }} /></div>
              <div className="progressbar opp"><div style={{ width: `${oppP * 100}%` }} /></div>
              <p className="muted small">You: {Math.round(prog * 100)}% · {oppName}: {Math.round(oppP * 100)}% · first to finish wins</p>
            </>
          )}
          {racing && live && !mine && <p className="muted">Watching live: {s.aName} {Math.round(s.aP * 100)}% · {s.bName} {Math.round(s.bP * 100)}%</p>}

          {s.status === 'done' && (
            <>
              <div className={`verdict ${s.winner === 'draw' ? 'draw' : mine ? (iWon ? 'win' : 'lose') : ''}`}>
                {s.winner === 'draw' ? 'Nobody finished in time: stakes back' : mine ? (iWon ? `You win ${sats(2 * s.stake)}!` : `${winnerName} wins. You lose ${sats(s.stake)}`) : `${winnerName} wins ${sats(2 * s.stake)}`}
              </div>
              <p className="small">{s.reason}{winnerName ? ` · winner's time ${((s.winner === 'a' ? s.aMs : s.bMs) / 1000).toFixed(2)}s (measured by the server from the shared start)` : ''}</p>
              <VerifiedCard txid={s.recordTxid} explorer={explorer} network={network} />
              <button className="secondary" style={{ marginTop: 10 }} onClick={onClose}>Back to Typing Race</button>
            </>
          )}
          {s.status === 'cancelled' && <><div className="verdict draw">Race cancelled: {s.reason}</div><button className="secondary" onClick={onClose}>Back</button></>}
          {err && <p className="warnbox" role="alert" style={{ color: 'var(--red)' }}>{err}</p>}
        </div>
      </div>
    </div>
  );
}
