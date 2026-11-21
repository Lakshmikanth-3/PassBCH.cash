import { VerifiedCard } from './VerifiedCard.jsx';
import { StakePicker } from './StakePicker.jsx';
import { TermInvite } from './TermInvite.jsx';
import LowBalance from './LowBalance.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { api, sats } from './api.js';
import { show } from '../three/show.js';
import { Swords, Agents } from '../icons.jsx';

const EXAMPLES = [
  'Always try to leave the total so that (target − total) is a multiple of (max step + 1). If you cannot, add 1.',
  'Count backwards from the target in steps of (max step + 1) and always move onto one of those numbers.',
  'Play aggressively: add the maximum allowed unless that lets the opponent reach the target next turn.',
];

/** Create a fight: write the strategy prompt your agent will follow, pick a stake, then fight the House or a friend. */
export function NewFight({ rules, player, onCreated }) {
  const [prompt, setPrompt] = useState(''); const [stake, setStake] = useState(rules.stakes[0]);
  const [busy, setBusy] = useState(null); const [err, setErr] = useState(null);
  const total = player.bonus + player.cash;
  const start = async (vsBot) => {
    setBusy(vsBot ? 'Your agent is fighting…' : 'Creating…'); setErr(null);
    try { const { id } = await api('pfcreate', { body: { stake, prompt, vsBot } }); onCreated(id); }
    catch (e) { setErr(e.message); } finally { setBusy(null); }
  };
  return (
    <div className="card">
      <h2>1. Train your agent</h2>
      <p className="muted small">Your agent plays <b>Race to N</b>: both agents take turns adding a small number to a shared total. Whoever lands exactly on the target wins. The target and the step size are drawn when the fight starts. Your prompt is hidden from the opponent until the fight is over.</p>
      <textarea className="prompt" value={prompt} maxLength={400} onChange={(e) => setPrompt(e.target.value)} placeholder="Tell your agent how to play…" aria-label="Strategy prompt" />
      <div className="row between small muted"><span>{prompt.length}/400</span><span>Try an example:</span></div>
      <div className="examples">{EXAMPLES.map((x, i) => <button key={i} type="button" className="chip" onClick={() => setPrompt(x)}>Strategy {i + 1}</button>)}</div>
      <h2>2. Pick your stake</h2>
      <StakePicker rules={rules} stake={stake} setStake={setStake} total={total} />
      <div className="row gap">
        <button className="primary big" disabled={!!busy || prompt.trim().length < 5 || stake > total} onClick={() => start(true)}><Agents size={20} /> {busy ?? 'Fight the House Agent'}</button>
        <button className="secondary big" disabled={!!busy || prompt.trim().length < 5 || stake > total} onClick={() => start(false)}><Swords size={20} /> Challenge a friend</button>
      </div>
      <LowBalance player={player} rules={rules} />
      {prompt.trim().length < 5 && <p className="hint">Write a strategy prompt first (at least 5 characters).</p>}
      <p className="rulesline">Winner takes the pot · 5% fee only when you withdraw · free bonus must be played 2× before withdrawing · <a href="/rules">Rules</a></p>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

/** One fight: lobby (share link / join with your own prompt), then the live replay and the revealed prompts. */
export function FightView({ id, me, explorer, network, onClose, onChange }) {
  const [m, setM] = useState(null); const [err, setErr] = useState(null);
  const [prompt, setPrompt] = useState(''); const [busy, setBusy] = useState(false); const [copied, setCopied] = useState(false);
  const shown = useRef(false); const m0 = useRef(null);
  const [revealed, setRevealed] = useState(false);
  const link = `${location.origin}/fight/${id}`;
  const load = async () => {
    try {
      const x = await api('pf', { q: `&id=${id}` }); setM(x); m0.current = x;
      if (x.status === 'done' && !shown.current) {
        shown.current = true;
        setTimeout(() => setRevealed(true), 1600 + Math.max(0.6, Math.min(1.3, 24 / Math.max(1, x.turns.length))) * x.turns.length * 1000 + 600);
        document.querySelector('.stage3d')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        show({ kind: 'pf', turns: x.turns, target: x.target, maxStep: x.maxStep, winner: x.winner, aName: x.aName, bName: x.bName });
        onChange?.();
      } else if (x.status === 'open') show({ kind: 'pf', waiting: x.aPlayer === me?.id ? 'Waiting for a challenger…' : `${x.aName} is waiting for you` });
    } catch (e) { setErr(e.message); if (/no such match/.test(e.message)) shown.current = true; }
  };
  useEffect(() => { load(); const t = setInterval(() => { if (!shown.current || m0.current?.status === 'done' && !m0.current?.recordTxid) load(); }, 2500); return () => clearInterval(t); }, [id]);
  if (!m && /no such match/.test(err ?? '')) return <div className="card"><h2>This fight doesn't exist</h2><p className="muted">The link may be mistyped or the fight was removed.</p><button className="primary" onClick={onClose}>Start a new fight</button></div>;
  if (!m) return <div className="card"><p className="muted">Loading fight…</p>{err && <p className="err">{err}</p>}</div>;
  const mine = m.aPlayer === me?.id ? 'a' : m.bPlayer === me?.id ? 'b' : null;
  const join = async () => { setBusy(true); setErr(null); try { await api('pfjoin', { body: { id, prompt } }); await load(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: 'Prompt Fight', text: `${m.aName} challenges your AI agent for ${sats(m.stake)}`, url: link }); else { await navigator.clipboard.writeText(link); setCopied(true); } } catch { /* cancelled */ } };
  return (
    <div className="card">
      <div className="row between"><h2>Prompt Fight for {sats(m.stake)}</h2><button className="link" onClick={onClose}>close</button></div>
      <p className="muted">{m.aName} <b className="vs">vs</b> {m.bName ?? 'waiting for a challenger'}</p>
      {m.status === 'open' && mine === 'a' && (
        <div className="share"><p>Send this link to a friend. They write their own prompt and the fight starts instantly.</p>
          <div className="row gap"><code className="linkbox">{link}</code><button className="primary" onClick={share}>{copied ? 'Copied' : 'Share'}</button></div>
          <p className="muted small" style={{ margin: '10px 0 4px' }}>Friend coding in a terminal? They paste one line and play there:</p>
          <TermInvite link={link} /></div>
      )}
      {m.status === 'open' && mine !== 'a' && me && (
        <div><p>Write the strategy your agent will follow, then fight:</p>
          <textarea className="prompt" value={prompt} maxLength={400} onChange={(e) => setPrompt(e.target.value)} placeholder="Tell your agent how to play…" />
          <button className="primary big" disabled={busy || prompt.trim().length < 5} onClick={join}>{busy ? 'Agents are fighting…' : `Fight for ${sats(m.stake)}`}</button></div>
      )}
      {m.status === 'fighting' && <p className="center coding">The agents are fighting…</p>}
      {m.status === 'done' && !revealed && <p className="center coding">Watch the fight on the stage…</p>}
      {m.status === 'done' && revealed && (
        <>
          <div className={`verdict ${mine ? (m.winner === mine ? 'win' : 'lose') : ''}`}>{mine ? (m.winner === mine ? `You win ${sats(2 * m.stake)}!` : `You lose ${sats(m.stake)}`) : `${m.winner === 'a' ? m.aName : m.bName} wins`}</div>
          <p className="muted small center">Race to {m.target} · add 1 to {m.maxStep} · {m.first === 'a' ? m.aName : m.bName} moved first · {m.turns.length} moves</p>
          <div className="turns">{m.turns.map((t, i) => <span key={i} className={`turn ${t.side}`} title={t.auto ? 'agent gave no valid number: smallest move played' : t.said}>+{t.add}{t.auto ? '*' : ''}<small>{t.total}</small></span>)}</div>
          <div className="prompts">
            <div><b className="a">{m.aName}</b><p>{m.aPrompt}</p></div>
            <div><b className="b">{m.bName}</b><p>{m.bPrompt}</p></div>
          </div>
          <p className="muted small">Rules are enforced by code, not by an AI judge.</p>
          <VerifiedCard txid={m.recordTxid} explorer={explorer} network={network} />
        </>
      )}
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export function FightLobby({ onOpen }) {
  const [open, setOpen] = useState([]);
  useEffect(() => { let stop = false; const t = () => api('pfopen').then((o) => !stop && setOpen(o)).catch(() => {}); t(); const i = setInterval(t, 5000); return () => { stop = true; clearInterval(i); }; }, []);
  return (
    <div className="card">
      <h2>Open fights</h2>
      {open.length === 0 ? <p className="muted small">No open fights. Create one and share the link.</p>
        : open.slice(0, 8).map((o) => <button key={o.id} className="openrow" onClick={() => onOpen(o.id)}><span>{o.name} wants a fight</span><span><b>{sats(o.stake)}</b><span className="accept">Accept</span></span></button>)}
    </div>
  );
}
