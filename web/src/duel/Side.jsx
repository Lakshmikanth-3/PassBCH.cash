import React, { Suspense, lazy, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api, sats } from './api.js';
import { MoveIcon, Key, Trophy, Terminal as TermIcon } from '../icons.jsx';
const WalletConnect = lazy(() => import('./WalletConnect.jsx')); // WizardConnect + crypto load only when needed

export function Wallet({ player, rules, explorer, network, onChange }) {
  const [dep, setDep] = useState(null); const [qr, setQr] = useState(null);
  const [addr, setAddr] = useState(''); const [amt, setAmt] = useState('');
  const [msg, setMsg] = useState(null); const [err, setErr] = useState(null); const [copied, setCopied] = useState(false);
  const invite = `${location.origin}/?ref=${player.refCode}`;
  const [showCode, setShowCode] = useState(false); const [codeCopied, setCodeCopied] = useState(false);
  const [rule, setRule] = useState(null);
  useEffect(() => { api('me').then((m) => setRule(m.withdraw)).catch(() => {}); }, [player.cash, player.bonus]);
  const token = (() => { try { return JSON.parse(localStorage.getItem('sd.session'))?.token; } catch { return null; } })();
  const showDeposit = async () => {
    setErr(null);
    try { const d = await api('deposit'); setDep(d); setQr(await QRCode.toDataURL(d.address, { margin: 1, width: 220 })); if (d.added) { setMsg(`Credited ${sats(d.added)}`); onChange(); } }
    catch (e) { setErr(e.message); }
  };
  const withdraw = async (e) => {
    e.preventDefault(); setErr(null); setMsg(null);
    try { const w = await api('withdraw', { body: { address: addr.trim(), amount: Number(amt) } }); setMsg(<>Sent {sats(w.send)} (fee {sats(w.fee)}) · <a href={`${explorer}${w.txid}`} target="_blank" rel="noreferrer">tx ↗</a></>); onChange(); }
    catch (x) { setErr(x.message); }
  };
  const copyInvite = async () => { try { await navigator.clipboard.writeText(invite); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ } };
  return (
    <div className="card">
      <h2>{player.name}</h2>
      <div className="bal" hidden>
        <div><span className="muted small">Bonus (play only)</span><b>{sats(player.bonus)}</b></div>
        <div><span className="muted small">Withdrawable</span><b className="green">{sats(player.cash)}</b></div>
        <div><span className="muted small">Record</span><b>{player.wins}W {player.losses}L {player.draws}D</b></div>
      </div>
      <div className="invite">
        <b>Invite a friend → you both get {sats(rules.referralBonus)}</b>
        <div className="row gap"><code className="linkbox">{invite}</code><button className="secondary" onClick={copyInvite}>{copied ? 'Copied ✓' : 'Copy'}</button></div>
      </div>
      <details>
        <summary><Key size={16} /> Login code (use it on another device or in the terminal)</summary>
        <p className="muted small">Anyone with this code controls your balance. Keep it private.</p>
        <div className="row gap"><code className="linkbox">{showCode ? token : '•'.repeat(24)}</code>
          <button className="secondary" type="button" onClick={() => setShowCode((v) => !v)}>{showCode ? 'Hide' : 'Show'}</button>
          <button className="secondary" type="button" onClick={async () => { try { await navigator.clipboard.writeText(token); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 1500); } catch { /* blocked */ } }}>{codeCopied ? 'Copied ✓' : 'Copy'}</button></div>
      </details>
      {msg && <p className="ok">{msg}</p>}{err && <p className="err">{err}</p>}
    </div>
  );
}

export function Leaderboard({ explorer, onOpen }) {
  const [lb, setLb] = useState(null); const [open, setOpen] = useState([]);
  useEffect(() => {
    let stop = false;
    const tick = () => Promise.all([api('leaderboard'), api('open')]).then(([l, o]) => { if (!stop) { setLb(l); setOpen(o); } }).catch(() => {});
    tick(); const t = setInterval(tick, 4000); return () => { stop = true; clearInterval(t); };
  }, []);
  if (!lb) return <div className="card"><p className="muted">Loading leaderboard…</p></div>;
  return (
    <>
      {open.length > 0 && (
        <div className="card">
          <h2>Open challenges</h2>
          {open.slice(0, 6).map((o) => <button key={o.id} className="openrow" onClick={() => onOpen(o.id)}><span>{o.name} challenges anyone</span><span><b>{sats(o.stake)}</b><span className="accept">Accept</span></span></button>)}
        </div>
      )}
      <div className="card">
        <div className="row between"><h2><Trophy size={20} /> Leaderboard</h2><span className="muted small">{lb.stats.duels} duels · {sats(lb.stats.volumeSats)} played</span></div>
        <table className="lb"><thead><tr><th>#</th><th>Player</th><th>Won</th><th>W-L-D</th></tr></thead>
          <tbody>{lb.top.map((t, i) => <tr key={t.name}><td>{i + 1}</td><td>{t.name}</td><td className="green">+{sats(t.won_sats)}</td><td>{t.wins}-{t.losses}-{t.draws}</td></tr>)}</tbody></table>
      </div>
      <div className="card">
        <h2><span className="live" /> Live duels</h2>
        <ul className="feed">
          {lb.feed.map((f) => (
            <li key={f.id}>
              <span className="vsrow">{f.a_name} {f.a_move ? <MoveIcon move={f.a_move} size={16} /> : null} <span className="muted">vs</span> <MoveIcon move={f.b_move} size={16} /> {f.b_name}</span>
              <span>{f.winner_name ? <b className="green">{f.winner_name} +{sats(2 * f.stake)}</b> : <span className="muted">draw</span>}</span>
              {f.record_txid ? <a href={`${explorer}${f.record_txid}`} target="_blank" rel="noreferrer" title="On-chain record">tx ↗</a> : <span className="muted small">…</span>}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function Terminal() {
  const cmds = [['Windows · PowerShell', 'irm https://passbch.vercel.app | iex'], ['Mac · Linux · VS Code', 'curl -sL passbch.vercel.app | sh']];
  const [c, setC] = useState(null);
  return (
    <div className="card term">
      <h2><TermIcon size={20} /> Play from your terminal</h2>
      <p className="muted small">Waiting on a build or on Claude? Duel without leaving the terminal. Same account rules, same leaderboard.</p>
      {cmds.map(([k, v]) => (
        <div key={k} className="cmd"><span className="muted small">{k}</span>
          <button className="codebtn" onClick={async () => { try { await navigator.clipboard.writeText(v); setC(k); setTimeout(() => setC(null), 1500); } catch { /* blocked */ } }}><code>{v}</code><span>{c === k ? '✓' : '⧉'}</span></button>
        </div>
      ))}
    </div>
  );
}
