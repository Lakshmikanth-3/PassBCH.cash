import React, { Suspense, lazy, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api, sats, EMOJI } from './api.js';
const WalletConnect = lazy(() => import('./WalletConnect.jsx')); // WizardConnect + crypto load only when needed

export function Wallet({ player, rules, explorer, network, onChange }) {
  const [dep, setDep] = useState(null); const [qr, setQr] = useState(null);
  const [addr, setAddr] = useState(''); const [amt, setAmt] = useState('');
  const [msg, setMsg] = useState(null); const [err, setErr] = useState(null); const [copied, setCopied] = useState(false);
  const invite = `${location.origin}/?ref=${player.refCode}`;
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
      <div className="bal">
        <div><span className="muted small">Bonus (play only)</span><b>{sats(player.bonus)}</b></div>
        <div><span className="muted small">Withdrawable</span><b className="green">{sats(player.cash)}</b></div>
        <div><span className="muted small">Record</span><b>{player.wins}W {player.losses}L {player.draws}D</b></div>
      </div>
      <div className="invite">
        <b>Invite a friend → you both get {sats(rules.referralBonus)}</b>
        <div className="row gap"><code className="linkbox">{invite}</code><button className="secondary" onClick={copyInvite}>{copied ? 'Copied ✓' : 'Copy'}</button></div>
      </div>
      <Suspense fallback={<div className="wc muted small">Loading wallet connect…</div>}><WalletConnect network={network} onDeposited={onChange} onAddress={(a) => { if (!addr) setAddr(a); }} /></Suspense>
      <details onToggle={(e) => e.target.open && !dep && showDeposit()}>
        <summary>Deposit by QR (any wallet)</summary>
        {dep && <div className="deposit">{qr && <img src={qr} alt="Deposit address QR" width="180" height="180" />}<code>{dep.address}</code><button className="link" onClick={showDeposit}>I sent it — check now</button></div>}
      </details>
      <details>
        <summary>Withdraw winnings</summary>
        <form onSubmit={withdraw} className="withdraw">
          <input placeholder="Your BCH address" value={addr} onChange={(e) => setAddr(e.target.value)} required />
          <input placeholder={`Amount (min ${rules.minWithdraw})`} inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ''))} required />
          <button className="primary">Withdraw</button>
          <p className="muted small">Platform fee {rules.withdrawFeePct}% (min {sats(rules.networkFee)}). Only winnings and deposits can be withdrawn — bonus is for playing.</p>
        </form>
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
          {open.slice(0, 6).map((o) => <button key={o.id} className="openrow" onClick={() => onOpen(o.id)}><span>⚔️ {o.name}</span><b>{sats(o.stake)}</b></button>)}
        </div>
      )}
      <div className="card">
        <div className="row between"><h2>🏆 Leaderboard</h2><span className="muted small">{lb.stats.duels} duels · {sats(lb.stats.volumeSats)} played</span></div>
        <table className="lb"><thead><tr><th>#</th><th>Player</th><th>Won</th><th>W-L-D</th></tr></thead>
          <tbody>{lb.top.map((t, i) => <tr key={t.name}><td>{i + 1}</td><td>{t.name}</td><td className="green">+{sats(t.won_sats)}</td><td>{t.wins}-{t.losses}-{t.draws}</td></tr>)}</tbody></table>
      </div>
      <div className="card">
        <h2><span className="live" /> Live duels</h2>
        <ul className="feed">
          {lb.feed.map((f) => (
            <li key={f.id}>
              <span>{f.a_name} {EMOJI[f.a_move] ?? '⌛'} <span className="muted">vs</span> {EMOJI[f.b_move]} {f.b_name}</span>
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
  const cmds = [['PowerShell', `irm ${location.origin}/play.ps1 | iex`], ['bash / zsh / VS Code', `curl -fsSL ${location.origin}/play.sh | sh`]];
  const [c, setC] = useState(null);
  return (
    <div className="card term">
      <h2>⌨️ Play from your terminal</h2>
      <p className="muted small">Waiting on a build or on Claude? Duel without leaving the terminal. Same account rules, same leaderboard.</p>
      {cmds.map(([k, v]) => (
        <div key={k} className="cmd"><span className="muted small">{k}</span>
          <button className="codebtn" onClick={async () => { try { await navigator.clipboard.writeText(v); setC(k); setTimeout(() => setC(null), 1500); } catch { /* blocked */ } }}><code>{v}</code><span>{c === k ? '✓' : '⧉'}</span></button>
        </div>
      ))}
    </div>
  );
}
