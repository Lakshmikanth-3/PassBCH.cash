import React, { Suspense, lazy, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api, sats } from './api.js';
import { useFx, fiat, CURRENCIES, setCurrency } from './money.js';

const WalletConnect = lazy(() => import('./WalletConnect.jsx'));
const COINS = [
  ['usdt-ethereum', 'USDT (Ethereum)', 'USDT'], ['usdt-tron', 'USDT (Tron)', 'USDT'], ['usdc-ethereum', 'USDC (Ethereum)', 'USDC'],
  ['btc', 'Bitcoin', 'BTC'], ['eth', 'Ethereum', 'ETH'], ['sol', 'Solana', 'SOL'], ['ltc', 'Litecoin', 'LTC'], ['doge', 'Dogecoin', 'DOGE'],
];
const FIATS = ['INR', 'JPY', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'IDR', 'PHP', 'NGN', 'BRL'];
const bchOf = (n) => `${Number(n).toFixed(8).replace(/0+$/, '').replace(/\.$/, '')} BCH`;

function Tabs({ tab, setTab, network }) {
  if (network === 'mainnet') return null; // swaps / bank rails are not live on mainnet: BCH only
  return (
    <div className="seg three">
      {[['bch', 'BCH'], ['crypto', 'Other crypto'], ['fiat', 'Bank · Card · UPI']].map(([k, l]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
    </div>
  );
}

/** Live SideShift quote: what lands in (or leaves) the vault. Swaps execute on mainnet only. */
function CryptoQuote({ dir, network }) {
  const [coin, setCoin] = useState(COINS[0][0]); const [amt, setAmt] = useState(dir === 'in' ? '20' : '0.01');
  const [q, setQ] = useState(null); const [err, setErr] = useState(null);
  useEffect(() => { let stop = false; setErr(null); api('swapquote', { q: `&coin=${coin}&dir=${dir}` }).then((r) => !stop && setQ(r)).catch((e) => !stop && setErr(e.message)); return () => { stop = true; }; }, [coin, dir]);
  const sym = COINS.find((c) => c[0] === coin)[2];
  const out = q ? Number(amt || 0) * q.rate : 0;
  return (
    <div>
      <label className="small muted">{dir === 'in' ? 'You send' : 'You receive in'}</label>
      <div className="row gap"><select value={coin} onChange={(e) => setCoin(e.target.value)}>{COINS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Amount" /><span className="unit">{dir === 'in' ? sym : 'BCH'}</span></div>
      {q && <div className="quote"><span className="muted small">{dir === 'in' ? 'Lands in your vault' : 'You get'}</span><b>{dir === 'in' ? bchOf(out) : `${out.toFixed(4)} ${sym}`}</b><span className="muted small">rate 1 {q.from} = {q.rate} {q.to} · min {q.min} {q.from} · SideShift's rate (includes their fee, so it differs from the market price)</span></div>}
      {err && <p className="err">{err}</p>}
      <button className="primary big" disabled={network !== 'mainnet'}>{dir === 'in' ? `Get ${sym} deposit address` : `Withdraw to ${sym}`}</button>
      {network !== 'mainnet' && <p className="muted small">Swaps with other coins run through SideShift.ai on <b>mainnet</b>. During testing (chipnet) use the BCH tab — the quote above is live.</p>}
    </div>
  );
}

function FiatQuote({ dir, network }) {
  const { rates, ccy } = useFx();
  const [cur, setCur] = useState(FIATS.includes(ccy) ? ccy : 'USD'); const [amt, setAmt] = useState(dir === 'in' ? '500' : '0.01');
  const r = rates?.[cur];
  const bch = dir === 'in' ? Number(amt || 0) / (r || Infinity) : Number(amt || 0);
  const money = dir === 'in' ? Number(amt || 0) : Number(amt || 0) * (r || 0);
  return (
    <div>
      <label className="small muted">{dir === 'in' ? 'You pay' : 'You withdraw'}</label>
      <div className="row gap"><select value={cur} onChange={(e) => { setCur(e.target.value); setCurrency(e.target.value); }}>{FIATS.map((f) => <option key={f}>{f}</option>)}</select>
        <input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Amount" /><span className="unit">{dir === 'in' ? cur : 'BCH'}</span></div>
      <div className="quote"><span className="muted small">{dir === 'in' ? 'Lands in your vault' : 'Paid to your bank'}</span>
        <b>{dir === 'in' ? bchOf(bch) : `${CURRENCIES[cur] ?? ''}${money.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</b>
        <span className="muted small">{r ? `1 BCH = ${CURRENCIES[cur] ?? ''}${r.toLocaleString(undefined, { maximumFractionDigits: 2 })} (live)` : 'loading rate…'} · partner fees not included</span></div>
      <button className="primary big" disabled={network !== 'mainnet'}>{dir === 'in' ? `Pay with ${cur === 'INR' ? 'UPI / card' : 'card / bank'}` : 'Withdraw to bank'}</button>
      <p className="muted small">Bank, card and UPI payments go through a licensed on/off-ramp partner and are switched on with <b>mainnet</b>. Your money is converted to BCH before it reaches your vault — every game is played in BCH.</p>
    </div>
  );
}

export function AddFunds({ network, onChange }) {
  const [tab, setTab] = useState('bch'); const [dep, setDep] = useState(null); const [qr, setQr] = useState(null); const [msg, setMsg] = useState(null);
  const loadDep = async () => { try { const d = await api('deposit'); setDep(d); setQr(await QRCode.toDataURL(d.address, { margin: 1, width: 220 })); if (d.added) { setMsg(`Credited ${sats(d.added)}`); onChange?.(); } } catch (e) { setMsg(e.message); } };
  useEffect(() => { if (tab === 'bch' && !dep) loadDep(); }, [tab]);
  return (
    <div className="card">
      <h2>Add funds to your vault</h2>
      <p className="muted small">Everything you add becomes BCH in your PassBCH vault. Games are played in BCH only.</p>
      <Tabs tab={tab} setTab={setTab} network={network} />
      {tab === 'bch' && (
        <div>
          <Suspense fallback={<p className="muted small">Loading wallet connect…</p>}><WalletConnect network={network} onDeposited={onChange} /></Suspense>
          <details open><summary>Or send BCH to your vault address (any wallet)</summary>
            {dep && <div className="deposit">{qr && <img src={qr} alt="Vault deposit address QR" width="180" height="180" />}<code>{dep.address}</code><button className="link" onClick={loadDep}>I sent it — check now</button></div>}
          </details>
        </div>
      )}
      {tab === 'crypto' && <CryptoQuote dir="in" network={network} />}
      {tab === 'fiat' && <FiatQuote dir="in" network={network} />}
      {msg && <p className="ok">{msg}</p>}
    </div>
  );
}

export function Withdraw({ player, rules, explorer, network, onChange }) {
  const [tab, setTab] = useState('bch'); const [addr, setAddr] = useState(''); const [amt, setAmt] = useState('');
  const [rule, setRule] = useState(null); const [msg, setMsg] = useState(null); const [err, setErr] = useState(null);
  useEffect(() => { api('me').then((m) => setRule(m.withdraw)).catch(() => {}); }, [player.cash]);
  const withdraw = async (e) => {
    e.preventDefault(); setErr(null); setMsg(null);
    try { const sat = Math.round(Number(amt) * 1e8); const w = await api('withdraw', { body: { address: addr.trim(), amount: sat } }); setMsg(<>Sent {sats(w.send)} (fee {sats(w.fee)}) · <a href={`${explorer}${w.txid}`} target="_blank" rel="noreferrer">transaction ↗</a></>); onChange?.(); }
    catch (x) { setErr(x.message); }
  };
  return (
    <div className="card">
      <h2>Withdraw from your vault</h2>
      <p className="muted small">Withdrawable: <b className="green">{sats(player.cash)}</b> · bonus credit is for playing only · platform fee {rules.withdrawFeePct}%</p>
      {player.cash < rules.minWithdraw && <p className="warnbox">You can't withdraw yet: the minimum is <b>{sats(rules.minWithdraw)}</b> and you have <b>{sats(player.cash)}</b> of withdrawable cash. Free bonus credit is play-only. Add funds (Vault, Add funds) or win cash first.</p>}
      {rule && !rule.ok && <p className="warnbox">Free bonus must be played 2× before withdrawing: play <b>{sats(rule.left)}</b> more.</p>}
      <Tabs tab={tab} setTab={setTab} network={network} />
      {tab === 'bch' && (
        <form onSubmit={withdraw}>
          <input placeholder={network === 'mainnet' ? 'bitcoincash:…' : 'bchtest:… (chipnet address)'} value={addr} onChange={(e) => setAddr(e.target.value)} required />
          <div className="row gap"><input inputMode="decimal" placeholder={`Amount in BCH (min ${rules.minWithdraw / 1e8})`} value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} required /><span className="unit">BCH</span></div>
          {err && <p className="warnbox" role="alert" style={{ color: 'var(--red)', borderColor: '#e4a29d', background: '#fdecea', fontWeight: 600 }}>{err}</p>}
          <button className="primary big">Withdraw BCH</button>
        </form>
      )}
      {tab === 'crypto' && <CryptoQuote dir="out" network={network} />}
      {tab === 'fiat' && <FiatQuote dir="out" network={network} />}
      {msg && <p className="ok">{msg}</p>}{err && <p className="err">{err}</p>}
    </div>
  );
}

/** Vault overview: balances in BCH (+ local currency), quick links to add funds / withdraw. */
export function Vault({ player, go }) {
  const { rates, ccy } = useFx();
  return (
    <div className="card vault">
      <div className="row between"><h2>Your vault</h2>
        <select value={ccy} onChange={(e) => setCurrency(e.target.value)} aria-label="Display currency">{Object.keys(CURRENCIES).map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="bal">
        <div><span className="muted small">Total</span><b>{sats(player.bonus + player.cash)}</b><span className="muted small">{fiat(player.bonus + player.cash, rates, ccy)}</span></div>
        <div><span className="muted small">Withdrawable</span><b className="green">{sats(player.cash)}</b><span className="muted small">{fiat(player.cash, rates, ccy)}</span></div>
        <div><span className="muted small">Bonus (play only)</span><b>{sats(player.bonus)}</b><span className="muted small">{fiat(player.bonus, rates, ccy)}</span></div>
      </div>
      <div className="row gap"><button className="primary big" onClick={() => go('add')}>Add funds</button><button className="secondary big" onClick={() => go('withdraw')}>Withdraw</button></div>
    </div>
  );
}

const GAME = { rps: 'Rock · Paper · Scissors', updown: 'Up or Down', pf: 'Prompt Fight', coin: 'Coin Flip', type: 'Typing Race', race: 'Friend Typing Race' };
/** Your deposits, withdrawals, bonuses and games, each with its proof link. */
export function Activity({ explorer }) {
  const [a, setA] = useState(null); const [tab, setTab] = useState('games');
  useEffect(() => { api('activity').then(setA).catch(() => setA({ money: [], games: [] })); }, []);
  if (!a) return <div className="card"><p className="muted">Loading history…</p></div>;
  const rows = tab === 'games' ? a.games : a.money;
  const csv = () => {
    const lines = tab === 'games' ? [['time', 'game', 'stake_sats', 'outcome', 'paid_sats', 'txid'], ...a.games.map((g) => [g.at, g.game, g.stake, g.outcome, g.paid, g.tx ?? ''])]
      : [['time', 'kind', 'amount_sats', 'note', 'txid'], ...a.money.map((m) => [m.at, m.kind, m.amount, m.note ?? '', m.tx ?? ''])];
    const url = URL.createObjectURL(new Blob([lines.map((l) => l.join(',')).join('\n')], { type: 'text/csv' }));
    const el = document.createElement('a'); el.href = url; el.download = `passbch-${tab}.csv`; el.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="card">
      <div className="row between"><h2>History</h2><button className="link" onClick={csv} disabled={!rows.length}>Export CSV</button></div>
      <div className="seg"><button className={tab === 'games' ? 'on' : ''} onClick={() => setTab('games')}>Games</button><button className={tab === 'money' ? 'on' : ''} onClick={() => setTab('money')}>Deposits · withdrawals · bonus</button></div>
      {rows.length === 0 ? <p className="muted small">Nothing here yet.</p> : (
        <ul className="feed">{tab === 'games'
          ? a.games.map((g) => <li key={g.game + g.id}><span>{GAME[g.game]} <span className="muted small">{new Date(g.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span><b className={g.outcome === 'win' ? 'green' : g.outcome === 'lose' ? 'red' : ''}>{g.outcome === 'win' ? `+${sats(g.paid - g.stake)}` : g.outcome === 'lose' ? `-${sats(g.stake)}` : 'refund'}</b>{g.tx ? <a href={`/verify/${g.tx}`}>Verify ✓</a> : <span className="muted small">…</span>}</li>)
          : a.money.map((m, i) => <li key={i}><span>{m.kind} <span className="muted small">{new Date(m.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}{m.note ? ` · ${m.note}` : ''}</span></span><b className={m.amount >= 0 ? 'green' : 'red'}>{m.amount >= 0 ? '+' : ''}{sats(m.amount)}</b>{m.tx ? <a href={`${explorer}${m.tx}`} target="_blank" rel="noreferrer">tx ↗</a> : <span />}</li>)}
        </ul>)}
    </div>
  );
}

/** Settings stored on this device: low-power mode turns the 3D stages off. */
export function Settings() {
  const read = (k) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
  const [low, setLow] = useState(() => read('pb.lowpower'));
  const toggle = () => { const v = !low; setLow(v); try { localStorage.setItem('pb.lowpower', v ? '1' : '0'); } catch { /* blocked */ } window.dispatchEvent(new Event('pb:lowpower')); };
  return (
    <div className="card">
      <h2>Settings</h2>
      <label className="toggle"><input type="checkbox" checked={low} onChange={toggle} /> <span><b>Low-power mode</b> <span className="muted small">— turn off the 3D stages (saves battery on phones). Games work the same.</span></span></label>
    </div>
  );
}
