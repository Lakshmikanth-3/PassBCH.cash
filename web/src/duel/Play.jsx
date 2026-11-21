import React, { useEffect, useRef, useState } from 'react';
import { api, commitMove, session, MOVES, sats } from './api.js';
import { MoveIcon, Agents, Swords } from '../icons.jsx';
import { show } from '../three/show.js';

export function Signup({ onDone, refCode }) {
  const [mode, setMode] = useState('new');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [ref, setRef] = useState(refCode ?? '');
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await api('signup', { body: { name, ref: ref || undefined } }); session.set({ token: r.token }); onDone(r); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const logIn = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const t = code.trim(); await api('login', { body: { code: t } }); session.set({ token: t }); onDone(); }
    catch (x) { setErr(/unknown|not signed/.test(x.message) ? 'That login code is not valid.' : x.message); } finally { setBusy(false); }
  };
  if (mode === 'code') return (
    <form className="card signup" onSubmit={logIn}>
      <div className="seg"><button type="button" onClick={() => setMode('new')}>New player</button><button type="button" className="on">Log in</button></div>
      <h2>Welcome back</h2>
      <p className="muted">Paste the login code from your Wallet page (or from the terminal game) to continue on this device.</p>
      <input aria-label="Login code" placeholder="Your login code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" required />
      <button className="primary big" disabled={busy}>{busy ? 'Checking…' : 'Log in'}</button>
      {err && <p className="err">{err}</p>}
    </form>
  );
  return (
    <form className="card signup" onSubmit={go}>
      <div className="seg"><button type="button" className="on">New player</button><button type="button" onClick={() => setMode('code')}>Log in</button></div>
      <h2>Get {refCode ? '50,000' : '25,000'} free sats and play</h2>
      <p className="muted">No wallet needed to start. Pick a name; your bonus is ready instantly.</p>
      <input aria-label="Player name" placeholder="Your player name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} required />
      <input aria-label="Referral code" placeholder="Referral code (optional)" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} maxLength={6} />
      <button className="primary big" disabled={busy}>{busy ? 'Creating…' : 'Start playing'}</button>
      {err && <p className="err">{err}</p>}
    </form>
  );
}

export function MovePicker({ value, onChange }) {
  return (
    <div className="moves" role="radiogroup" aria-label="Your move">
      {MOVES.map((m) => (
        <button key={m} type="button" role="radio" aria-checked={value === m} className={`move ${value === m ? 'on' : ''}`} onClick={() => onChange(m)}>
          <span className="emoji"><MoveIcon move={m} size={40} /></span><span>{m}</span>
        </button>
      ))}
    </div>
  );
}

export function NewDuel({ rules, player, onCreated }) {
  const [move, setMove] = useState(null);
  const [stake, setStake] = useState(rules.stakes[0]);
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const total = player.bonus + player.cash;
  const start = async (vsBot) => {
    setBusy(true); setErr(null);
    try {
      const { salt, commit } = await commitMove(move);
      const { id } = await api('create', { body: { stake, commit, vsBot } });
      session.saveSalt(id, { move, salt });
      onCreated(id, vsBot);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="card">
      <h2>1. Pick your move</h2>
      <MovePicker value={move} onChange={setMove} />
      <h2>2. Pick your stake</h2>
      <div className="chips">
        {rules.stakes.map((s) => <button key={s} type="button" className={`chip ${stake === s ? 'on' : ''}`} disabled={s > total} onClick={() => setStake(s)}>{sats(s)}</button>)}
      </div>
      <div className="row gap">
        <button className="primary big" disabled={!move || busy || stake > total} onClick={() => start(true)}><Agents size={20} /> Play the House Bot</button>
        <button className="secondary big" disabled={!move || busy || stake > total} onClick={() => start(false)}><Swords size={20} /> Challenge a friend</button>
      </div>
      <p className="muted small">Your move is locked as a hash before anyone plays against it. Nobody — not us, not the bot — can see it until you reveal.</p>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

/** One duel: share link while open, auto-reveal for the creator, result animation, on-chain record link. */
export function DuelView({ id, me, explorer, onClose, onChange }) {
  const [d, setD] = useState(null); const [err, setErr] = useState(null);
  const [move, setMove] = useState(null); const [copied, setCopied] = useState(false);
  const revealing = useRef(false);
  const shown = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const mine = session.salt(id);
  const link = `${location.origin}/duel/${id}`;

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const x = await api('duel', { q: `&id=${id}` });
        if (stop) return;
        setD(x);
        if (x.status === 'settled' && x.aMove && x.bMove && !shown.current) {
          // The 3D table always seats "You" on the left: flip the view if you were the joiner.
          shown.current = true;
          setTimeout(() => setRevealed(true), 5200);
          const flip = x.bPlayer === me?.id;
          document.querySelector('.stage3d')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          show({ game: 'duel', kind: 'duel', aMove: flip ? x.bMove : x.aMove, bMove: flip ? x.aMove : x.bMove, result: flip ? ({ 1: 2, 2: 1 }[x.result] ?? 0) : x.result,
            names: flip ? [x.bName ?? 'You', x.aName] : [x.aName, x.bName ?? 'Opponent'] });
        } else if (x.status === 'open' && !shown.current) {
          show({ kind: 'duel', waiting: x.aPlayer === me?.id ? 'Waiting for your opponent…' : `${x.aName} is waiting for you` });
        }
        if (x.status === 'awaiting_reveal' && mine && x.aPlayer === me?.id && !revealing.current) {
          revealing.current = true;
          await api('reveal', { body: { id, ...mine } }).catch((e) => setErr(e.message));
          onChange?.();
        }
      } catch (e) { setErr(e.message); }
    };
    tick(); const t = setInterval(tick, 1500);
    return () => { stop = true; clearInterval(t); };
  }, [id, me?.id]);

  if (!d) return <div className="card"><p className="muted">Loading duel…</p>{err && <p className="err">{err}</p>}</div>;
  const iAmA = d.aPlayer === me?.id, iAmB = d.bPlayer === me?.id;
  const join = async () => { try { await api('join', { body: { id, move } }); onChange?.(); } catch (e) { setErr(e.message); } };
  const share = async () => {
    try { if (navigator.share) await navigator.share({ title: 'PassBCH.cash', text: `${d.aName} challenges you to rock-paper-scissors for ${sats(d.stake)}`, url: link }); else { await navigator.clipboard.writeText(link); setCopied(true); } } catch { /* cancelled */ }
  };
  let verdict = null;
  if (d.status === 'settled' && d.bPlayer && !revealed) verdict = <div className="verdict">The host is calling it… watch the table</div>;
  else if (d.status === 'settled' && d.bPlayer) {
    const meWon = (d.result === 1 && iAmA) || (d.result === 2 && iAmB);
    verdict = d.result === 0 ? <div className="verdict draw">Draw — stakes returned</div>
      : (iAmA || iAmB) ? <div className={`verdict ${meWon ? 'win' : 'lose'}`}>{meWon ? `You win ${sats(2 * d.stake)}!` : `You lose ${sats(d.stake)}`}</div>
      : <div className="verdict">{d.result === 1 ? d.aName : d.bName} wins {sats(2 * d.stake)}</div>;
  }
  return (
    <div className="card duel">
      <div className="row between"><h2>Duel for {sats(d.stake)}</h2><button className="link" onClick={onClose}>close</button></div>
      <div className="arena">
        <div className="fighter"><div className="who">{d.aName}</div><div className={`hand ${d.aMove ? 'shown' : 'hidden'}`}>{d.aMove && (revealed || d.status !== 'settled') ? <MoveIcon move={d.aMove} size={56} /> : <span className="lock">?</span>}</div></div>
        <div className="vs">VS</div>
        <div className="fighter"><div className="who">{d.bName ?? 'waiting…'}</div><div className={`hand ${d.bMove ? 'shown' : 'hidden'}`}>{d.bMove && (revealed || d.status !== 'settled') ? <MoveIcon move={d.bMove} size={56} /> : <span className="lock">?</span>}</div></div>
      </div>
      {verdict}
      {d.status === 'open' && iAmA && (
        <div className="share">
          <p>Send this link to a friend. Their bonus covers the stake.</p>
          <div className="row gap"><code className="linkbox">{link}</code><button className="primary" onClick={share}>{copied ? 'Copied ✓' : 'Share'}</button></div>
        </div>
      )}
      {d.status === 'open' && !iAmA && me && (
        <div><p><b>{d.aName}</b> has locked a move. Pick yours:</p><MovePicker value={move} onChange={setMove} />
          <button className="primary big" disabled={!move} onClick={join}>Play for {sats(d.stake)}</button></div>
      )}
      {d.status === 'awaiting_reveal' && <p className="muted">Revealing {d.aName}'s locked move… (auto, max 2 min or {d.aName} forfeits)</p>}
      {d.status === 'settled' && (
        <p className="muted small">
          {d.settleReason === 'reveal timeout' ? 'Creator did not reveal in time → forfeit. ' : ''}
          Commitment <code>{d.aCommit.slice(0, 16)}…</code> = sha256(move:salt).{' '}
          {d.recordTxid ? <a href={`${explorer}${d.recordTxid}`} target="_blank" rel="noreferrer">On-chain record ↗</a> : 'Writing on-chain record…'}
        </p>
      )}
      {err && <p className="err">{err}</p>}
    </div>
  );
}
