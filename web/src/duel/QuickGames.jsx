import { useEffect, useRef, useState } from 'react';
import { api, sats } from './api.js';
import Stage3D from '../three/Stage3D.jsx';
import { show } from '../three/show.js';
import { StakePicker } from './StakePicker.jsx';
import { VerifiedCard } from './VerifiedCard.jsx';
import LowBalance from './LowBalance.jsx';

const randomHex = (n = 16) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Coin Flip: the house locks a seed (hash shown), you pick a side, the flip follows from both seeds. */
export function CoinFlip({ rules, player, explorer, network, onChange }) {
  const [round, setRound] = useState(null); const [pick, setPick] = useState(null);
  const [stake, setStake] = useState(rules.stakes[0]); const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [mine, setMine] = useState([]);
  const total = player.bonus + player.cash;
  const fresh = async () => { setRes(null); setPick(null); try { setRound(await api('cfcommit')); } catch (e) { setErr(e.message); } };
  useEffect(() => { fresh(); api('qmine', { q: '&kind=coin' }).then(setMine).catch(() => {}); }, []);
  const flip = async () => {
    setBusy(true); setErr(null);
    try { const r = await api('cfplay', { body: { id: round.id, pick, stake, clientSeed: randomHex() } }); show({ kind: 'coinflip', result: r.result, outcome: r.outcome }); setRes({ spinning: true }); setTimeout(() => { setRes(r); setBusy(false); onChange?.(); api('qmine', { q: '&kind=coin' }).then(setMine).catch(() => {}); }, 3000); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  const [txid, setTxid] = useState(null);
  useEffect(() => {
    if (!res?.id) { setTxid(null); return; }
    let stop = false; const t = async () => { try { const g = await api('qgame', { q: `&id=${res.id}` }); if (!stop && g.recordTxid) { setTxid(g.recordTxid); return true; } } catch { /* retry */ } return false; };
    const i = setInterval(async () => { if (await t()) clearInterval(i); }, 2500); t();
    return () => { stop = true; clearInterval(i); };
  }, [res?.id]);
  const face = res?.spinning ? 'spin' : res ? (res.result === 0 ? 'heads' : 'tails') : '';
  return (
    <div className="gamelayout">
      <div className="stagecol">
        <Stage3D game="coin" height="clamp(300px, 48vw, 520px)" live={!!busy || (res && !res.spinning)} />
      </div>
      <div className="col">
        <div className="card">
          <h2>Coin Flip</h2>
          <p className="muted small">The house locks its secret seed before you pick. Your browser adds its own random seed. The flip comes from both, so neither side can steer it. The seed is revealed after and the Verify page recomputes it. Pays 1.9×.</p>
          <ol className="how">
            <li>Choose <b>Heads</b> or <b>Tails</b>.</li>
            <li>Pick a stake (or a custom amount) and press <b>Flip</b>.</li>
            <li>The coin flies in the 3D studio. Right side wins <b>1.9×</b> your stake.</li>
            <li>Press Verify afterwards: the house seed is revealed and the flip is recomputed in your browser.</li>
          </ol>
          {round && <p className="mono small" style={{ wordBreak: 'break-all' }}>House seed locked: {round.commit.slice(0, 24)}…</p>}
          <div className="row gap" style={{ margin: '10px 0' }}>
            {[['Heads', 0], ['Tails', 1]].map(([l, v]) => <button key={l} type="button" className={`chip ${pick === v ? 'on' : ''}`} style={{ flex: 1, padding: '14px' }} onClick={() => setPick(v)}>{l}</button>)}
          </div>
          <h2>Pick your stake</h2>
          <StakePicker rules={rules} stake={stake} setStake={setStake} total={total} />
          <LowBalance player={player} rules={rules} />
          <button className="primary big" style={{ width: '100%' }} disabled={busy || pick == null || !round || stake > total} onClick={flip}>{busy ? 'Flipping…' : `Flip for ${sats(stake)}`}</button>
          {pick == null && <p className="hint">Pick heads or tails first.</p>}
          {err && <p className="warnbox" role="alert" style={{ color: 'var(--red)' }}>{err}</p>}
          {res && !res.spinning && (
            <>
              <div className={`verdict ${res.outcome === 'win' ? 'win' : 'lose'}`} style={{ marginTop: 12 }}>{res.outcome === 'win' ? `You win ${sats(res.payout)}!` : `You lose ${sats(stake)}`}</div>
              <p className="muted small">House seed revealed: <code style={{ wordBreak: 'break-all' }}>{res.seed}</code></p>
              <VerifiedCard txid={txid} explorer={explorer} network={network} />
              <button className="secondary" style={{ marginTop: 10 }} onClick={fresh}>Flip again</button>
            </>
          )}
        </div>
        {mine.length > 0 && <div className="card"><h2>Your flips</h2><ul className="mybets">{mine.map((m) => <li key={m.id} className={m.outcome}><span>{m.pick === 0 ? 'Heads' : 'Tails'} {sats(m.stake)}</span><span className="muted small">landed {m.result === 0 ? 'heads' : 'tails'}</span><b>{m.outcome === 'win' ? `+${sats(m.payout)}` : 'lost'}</b>{m.record_txid ? <a href={`/verify/${m.record_txid}`}>Verify</a> : <span />}</li>)}</ul></div>}
      </div>
    </div>
  );
}

/** Typing Race: type the phrase before the House Bot. The server times you; paste is blocked and impossible speeds lose. */
export function TypingRace({ rules, player, explorer, network, onChange }) {
  const [stake, setStake] = useState(rules.stakes[0]); const [race, setRace] = useState(null); const [text, setText] = useState('');
  const [res, setRes] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [ms, setMs] = useState(0);
  const [txid, setTxid] = useState(null); const t0 = useRef(0); const done = useRef(false);
  const total = player.bonus + player.cash;
  useEffect(() => { if (!race || res) return; const i = setInterval(() => setMs(Date.now() - t0.current), 100); return () => clearInterval(i); }, [race, res]);
  useEffect(() => {
    if (!res?.id) { setTxid(null); return; }
    let stop = false; const t = async () => { try { const g = await api('qgame', { q: `&id=${res.id}` }); if (!stop && g.recordTxid) { setTxid(g.recordTxid); return true; } } catch { /* retry */ } return false; };
    const i = setInterval(async () => { if (await t()) clearInterval(i); }, 2500); t();
    return () => { stop = true; clearInterval(i); };
  }, [res?.id]);
  const start = async () => {
    setBusy(true); setErr(null); setRes(null); setText(''); done.current = false;
    try { const r = await api('trstart', { body: { stake } }); t0.current = Date.now(); setMs(0); setRace(r); show({ kind: 'typingstart' }); onChange?.(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const finish = async (value) => {
    if (done.current) return; done.current = true;
    try { const r = await api('trfinish', { body: { id: race.id, text: value } }); setRes(r); show({ kind: 'typingresult', playerMs: r.playerMs, botMs: r.botMs, outcome: r.outcome }); onChange?.(); } catch (e) { setErr(e.message); done.current = false; }
  };
  const onType = (v) => { setText(v); show({ kind: 'typingprogress', p: [...v.toLowerCase()].filter((c, i) => c === race.phrase[i]).length / race.phrase.length }); if (v.toLowerCase() === race.phrase) finish(v); };
  const correct = race ? [...text.toLowerCase()].filter((c, i) => c === race.phrase[i]).length : 0;
  const [caps, setCaps] = useState(false);
  return (
    <div className="gamelayout">
      <div className="stagecol">
        <Stage3D game="typing" height="clamp(260px, 40vw, 420px)" live={!!race && !res} />
        <div className="card typing" style={{ marginTop: 16 }}>
          <div className="row between"><h2>Typing Race</h2><span className="mono">{(ms / 1000).toFixed(1)}s</span></div>
          {!race && <p className="muted">Type a short phrase faster than the House Bot (45 to 80 words per minute, locked by a hash before you start). Winner takes 1.9× the stake. Same phrase for everyone in the same game, drawn from the game id.</p>}
          {!race && (
            <ol className="how">
              <li>Pick a stake on the right and press <b>Start the race</b>.</li>
              <li>A short phrase appears and the clock starts. <b>Type it exactly</b> in the box (capitals don't matter, punctuation is not used).</li>
              <li>It finishes by itself on the last letter. Pasting is blocked.</li>
              <li>Faster than the House Bot? You win <b>1.9×</b> your stake. Slower? You lose it. The result is written to Bitcoin Cash and you can verify it.</li>
            </ol>
          )}
          {race && (
            <>
              <p className="phrase" aria-label="Type this phrase">{[...race.phrase].map((c, i) => <span key={i} className={i < text.length ? (text[i].toLowerCase() === c ? 'ok' : 'bad') : ''}>{c}</span>)}</p>
              <input autoFocus disabled={!!res} value={text} onChange={(e) => onType(e.target.value)} onKeyUp={(e) => setCaps(!!e.getModifierState?.('CapsLock'))} onPaste={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Start typing here" aria-label="Your typing" />
              {caps && <p className="hint">Caps Lock is on. It still works (capitals don't matter), but typing is easier with it off.</p>}
              <div className="progressbar"><div style={{ width: `${(correct / race.phrase.length) * 100}%` }} /></div>
              {!res && <button className="link" type="button" onClick={() => finish('')}>Give up (you lose the stake)</button>}
              <p className="muted small">Time is measured by the server from the moment the phrase appears. Pasting is blocked and speeds above human typing count as a loss.</p>
            </>
          )}
          {res && (
            <>
              <div className={`verdict ${res.outcome === 'win' ? 'win' : res.outcome === 'refund' ? 'draw' : 'lose'}`}>{res.outcome === 'win' ? `You beat the bot! You win ${sats(res.payout)}` : res.outcome === 'refund' ? 'Dead heat: stake back' : `The bot wins. You lose ${sats(race.stake ?? stake)}`}</div>
              <p className="small">You: <b>{(res.playerMs / 1000).toFixed(2)}s</b> · House Bot: <b>{(res.botMs / 1000).toFixed(2)}s</b>{res.note ? ` · ${res.note}` : ''}</p>
              <p className="muted small">Bot seed revealed: <code style={{ wordBreak: 'break-all' }}>{res.seed}</code></p>
              <VerifiedCard txid={txid} explorer={explorer} network={network} />
            </>
          )}
        </div>
      </div>
      <div className="col">
        <div className="card">
          <h2>Pick your stake</h2>
          <StakePicker rules={rules} stake={stake} setStake={setStake} total={total} />
          <LowBalance player={player} rules={rules} />
          <button className="primary big" style={{ width: '100%' }} disabled={busy || stake > total || (race && !res)} onClick={start}>{busy ? 'Starting…' : race && !res ? 'Race in progress' : race ? `Race again for ${sats(stake)}` : `Start the race for ${sats(stake)}`}</button>
          {err && <p className="warnbox" role="alert" style={{ color: 'var(--red)' }}>{err}</p>}
          <p className="muted small">Also playable in the terminal: <code>irm https://passbch.vercel.app | iex</code>, then the Typing Race entry.</p>
        </div>
      </div>
    </div>
  );
}
