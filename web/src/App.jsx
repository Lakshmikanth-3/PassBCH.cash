import React, { useCallback, useEffect, useState } from 'react';
import Banner from './components/Banner.jsx';
import { CONFIG } from './config.js';
import { api, session } from './duel/api.js';
import { Signup, NewDuel, DuelView } from './duel/Play.jsx';
import { Wallet, Leaderboard, Terminal } from './duel/Side.jsx';
import { UpDown, UpDownFeed } from './duel/UpDown.jsx';
import { AiGame } from './duel/AiGame.jsx';

const params = () => new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export default function App() {
  const [cfg, setCfg] = useState(null);
  const [me, setMe] = useState(null);
  const [duelId, setDuelId] = useState(params().get('duel'));
  const [err, setErr] = useState(null);
  const [game, setGame] = useState(['updown', 'ai'].includes(params().get('game')) ? params().get('game') : 'duel');
  const ref = params().get('ref');

  const refresh = useCallback(async () => {
    if (!session.get()?.token) return setMe(null);
    try { setMe((await api('me')).player); } catch (e) { if (/unknown player|not signed/.test(e.message)) session.clear(); setMe(null); }
  }, []);
  useEffect(() => { api('config').then(setCfg).catch((e) => setErr(e.message)); refresh(); }, [refresh]);
  useEffect(() => { const t = setInterval(refresh, 5000); return () => clearInterval(t); }, [refresh]);

  const openDuel = (id) => {
    setDuelId(id);
    try { history.replaceState(null, '', id ? `/?duel=${id}` : '/'); } catch { /* sandboxed */ }
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <Banner config={{ ...CONFIG, network: cfg?.network ?? CONFIG.network }} />
      <header className="wrap hero">
        <div className="logo" aria-hidden>🤖 📈 ✊</div>
        <h1>PassBCH.cash</h1>
        <p className="tag">Play while your AI thinks. Bet on an AI passing its coding exam, on the next minute of BCH, or duel a friend — for real Bitcoin Cash. Every result on chain.</p>
      </header>
      <main className="wrap grid">
        <section className="col">
          {err && <div className="card err">Can't reach the game server: {err}</div>}
          {cfg && !me && <Signup refCode={ref} onDone={() => refresh()} />}
          {cfg && duelId && <DuelView id={duelId} me={me} explorer={cfg.explorer} onClose={() => openDuel(null)} onChange={refresh} />}
          {cfg && me && !duelId && (
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={game === 'duel'} className={game === 'duel' ? 'on' : ''} onClick={() => setGame('duel')}>✊ Duel</button>
              <button role="tab" aria-selected={game === 'updown'} className={game === 'updown' ? 'on' : ''} onClick={() => setGame('updown')}>📈 Up or Down</button>
              <button role="tab" aria-selected={game === 'ai'} className={game === 'ai' ? 'on' : ''} onClick={() => setGame('ai')}>🤖 AI Pass/Fail</button>
            </div>
          )}
          {cfg && me && !duelId && game === 'duel' && <NewDuel rules={cfg.rules} player={me} onCreated={(id) => openDuel(id)} />}
          {cfg && me && !duelId && game === 'updown' && <UpDown rules={cfg.rules} player={me} explorer={cfg.explorer} onChange={refresh} />}
          {cfg && me && !duelId && game === 'ai' && <AiGame rules={cfg.rules} player={me} explorer={cfg.explorer} onChange={refresh} />}
          {cfg && me && <Wallet player={me} rules={cfg.rules} explorer={cfg.explorer} network={cfg.network} onChange={refresh} />}
          <Terminal />
          <div className="card how">
            <h2>Why you can trust it</h2>
            <ol>
              <li><b>Your move is locked first.</b> The app sends only <code>sha256(move:salt)</code>. Nobody can see your move until you reveal.</li>
              <li><b>The bot can't peek.</b> Its move is fixed by a secret seed committed before you reveal; changing your move after seeing it is rejected.</li>
              <li><b>Quitting doesn't help.</b> If the creator doesn't reveal within 2 minutes, the opponent wins.</li>
              <li><b>Every result is public.</b> Each finished duel is written to Bitcoin Cash in an OP_RETURN record you can open in the explorer.</li>
            </ol>
          </div>
        </section>
        <aside className="col">{cfg && <Leaderboard explorer={cfg.explorer} onOpen={openDuel} />}{cfg && <UpDownFeed explorer={cfg.explorer} />}</aside>
      </main>
      <footer className="wrap muted small foot">PassBCH.cash · built from scratch for BCH BLAZE 2026 · <a href={CONFIG.repoUrl}>source</a> · {cfg?.network ?? 'chipnet'}</footer>
    </>
  );
}
