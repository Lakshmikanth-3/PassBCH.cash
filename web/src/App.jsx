import React, { useCallback, useEffect, useState } from 'react';
import Banner from './components/Banner.jsx';
import { CONFIG } from './config.js';
import { api, session, sats } from './duel/api.js';
import { Signup, NewDuel, DuelView } from './duel/Play.jsx';
import { Wallet, Leaderboard, Terminal } from './duel/Side.jsx';
import { UpDown, UpDownFeed } from './duel/UpDown.jsx';
import { AiGame } from './duel/AiGame.jsx';
import Stage3D from './three/Stage3D.jsx';

const ROUTES = ['', 'login', 'games', 'rps', 'predict', 'ai', 'wallet'];
const readRoute = () => {
  if (typeof location === 'undefined') return { route: '' };
  const q = new URLSearchParams(location.search);
  if (q.get('duel')) return { route: 'rps', duel: q.get('duel') };
  const r = location.hash.replace(/^#\/?/, '');
  return { route: ROUTES.includes(r) ? r : '' };
};

export const GAMES = [
  { id: 'rps', icon: '✊', title: 'Rock · Paper · Scissors', line: 'Sit at the table. Beat a friend or the House Bot. Winner takes the pot.', tag: 'PvP · 2 min', color: 'gold' },
  { id: 'predict', icon: '📈', title: 'Up or Down', line: 'Will BCH close the next minute higher or lower? Two buttons. Pays 1.9×.', tag: 'Prediction · 1 min', color: 'cyan' },
  { id: 'ai', icon: '🤖', title: 'AI Fight', line: 'An AI agent fights a live coding exam. Bet PASS or FAIL before it starts.', tag: 'AI · ~2 min', color: 'lime' },
  { id: 'soon', icon: '⏳', title: 'Upcoming BCH games', line: 'Tournaments, lucky draws, team battles and more — coming soon.', tag: 'Coming soon', color: 'magenta', soon: true },
];

function TopBar({ me, go }) {
  return (
    <header className="topbar">
      <div className="wrap row between">
        <button className="brand" onClick={() => go(me ? 'games' : '')}><span className="brand-mark">◆</span> PassBCH<span className="dim">.cash</span></button>
        {me ? (
          <nav className="row gap">
            <button className="chipbtn" onClick={() => go('games')}>🎮 Games</button>
            <button className="chipbtn balchip" onClick={() => go('wallet')} title="Bonus + withdrawable">💰 {sats(me.bonus + me.cash)}</button>
          </nav>
        ) : <button className="primary" onClick={() => go('login')}>Play now</button>}
      </div>
    </header>
  );
}

function Landing({ go, me }) {
  return (
    <main className="landing">
      <section className="wrap hero">
        <p className="kicker">⚡ Bitcoin Cash game show</p>
        <h1>Play while your <span className="hl">AI thinks</span>.</h1>
        <p className="tag">Claude is cogitating? Jump into a 1-minute round: rock-paper-scissors at a live table, bet on the BCH price, or watch an AI fight its coding exam. Real BCH, every result on chain.</p>
        <div className="row gap center-row">
          <button className="primary big" onClick={() => go(me ? 'games' : 'login')}>{me ? 'Go to games →' : 'Play free — get 25,000 sats →'}</button>
          <a className="secondary big" href="#how">How it works</a>
        </div>
      </section>
      <section className="wrap"><Stage3D game="rps" height="clamp(300px, 48vw, 520px)" /></section>
      <section className="wrap cards4">
        {GAMES.map((g) => (
          <div key={g.id} className={`gcard ${g.color} ${g.soon ? 'soon' : ''}`}><div className="gicon">{g.icon}</div><b>{g.title}</b><span className="muted small">{g.tag}</span></div>
        ))}
      </section>
      <section id="how" className="wrap how3">
        {[['1', 'Pick a name', '25,000 free sats land instantly. Invite a friend and you both get more.'], ['2', 'Pick a game', 'Each round takes a minute or two — perfect while your AI is thinking.'], ['3', 'Win & withdraw', 'Winnings go to your BCH wallet (WizardConnect or QR). Every result is public on chain.']].map(([n, t, d]) => (
          <div key={n} className="card step"><span className="num">{n}</span><b>{t}</b><p className="muted">{d}</p></div>
        ))}
      </section>
      <section className="wrap"><Terminal /></section>
    </main>
  );
}

function GameSelect({ go }) {
  return (
    <main className="wrap">
      <h2 className="screen-title">Choose your game</h2>
      <div className="cards4 big">
        {GAMES.map((g) => (
          <button key={g.id} className={`gcard ${g.color} ${g.soon ? 'soon' : ''}`} disabled={g.soon} onClick={() => !g.soon && go(g.id)}>
            <div className="gicon">{g.icon}</div>
            <b>{g.title}</b>
            <p>{g.line}</p>
            <span className="gtag">{g.tag}</span>
            <span className="gplay">{g.soon ? 'Stay tuned' : 'Play →'}</span>
          </button>
        ))}
      </div>
    </main>
  );
}

export default function App() {
  const [cfg, setCfg] = useState(null);
  const [me, setMe] = useState(null);
  const [{ route, duel }, setNav] = useState(readRoute);
  const [err, setErr] = useState(null);
  const ref = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('ref');

  const refresh = useCallback(async () => {
    if (!session.get()?.token) return setMe(null);
    try { setMe((await api('me')).player); } catch (e) { if (/unknown player|not signed/.test(e.message)) session.clear(); setMe(null); }
  }, []);
  useEffect(() => { api('config').then(setCfg).catch((e) => setErr(e.message)); refresh(); }, [refresh]);
  useEffect(() => { const t = setInterval(refresh, 6000); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { const f = () => setNav(readRoute()); window.addEventListener('hashchange', f); window.addEventListener('popstate', f); return () => { window.removeEventListener('hashchange', f); window.removeEventListener('popstate', f); }; }, []);

  const go = (r, d) => {
    try { history.pushState(null, '', d ? `/?duel=${d}` : `/${r ? `#/${r}` : ''}`); } catch { /* sandboxed */ }
    setNav({ route: r, duel: d }); window.scrollTo?.({ top: 0 });
  };
  // Signed-out players go to login for anything but the landing page (a shared duel link still opens).
  const needLogin = !me && cfg && route && route !== 'login' && !(route === 'rps' && duel);
  const screen = needLogin ? 'login' : route === 'login' && me ? 'games' : route;

  return (
    <>
      <Banner config={{ ...CONFIG, network: cfg?.network ?? CONFIG.network }} />
      <TopBar me={me} go={go} />
      {err && <div className="wrap"><div className="card err">Can't reach the game server: {err}</div></div>}
      {screen === '' && <Landing go={go} me={me} />}
      {screen === 'login' && cfg && (
        <main className="wrap narrow"><Signup refCode={ref} onDone={async () => { await refresh(); go(duel ? 'rps' : 'games', duel); }} /></main>
      )}
      {screen === 'games' && me && <GameSelect go={go} />}
      {screen === 'rps' && cfg && (
        <main className="wrap game">
          <button className="back" onClick={() => go('games')}>← All games</button>
          <Stage3D game="rps" />
          <div className="grid">
            <section className="col">
              {duel ? <DuelView id={duel} me={me} explorer={cfg.explorer} onClose={() => go('rps')} onChange={refresh} />
                : me && <NewDuel rules={cfg.rules} player={me} onCreated={(id) => go('rps', id)} />}
              {!me && duel && <Signup refCode={ref} onDone={refresh} />}
            </section>
            <aside className="col"><Leaderboard explorer={cfg.explorer} onOpen={(id) => go('rps', id)} /></aside>
          </div>
        </main>
      )}
      {screen === 'predict' && cfg && me && (
        <main className="wrap game">
          <button className="back" onClick={() => go('games')}>← All games</button>
          <UpDown rules={cfg.rules} player={me} explorer={cfg.explorer} onChange={refresh} />
          <UpDownFeed explorer={cfg.explorer} />
        </main>
      )}
      {screen === 'ai' && cfg && me && (
        <main className="wrap game">
          <button className="back" onClick={() => go('games')}>← All games</button>
          <Stage3D game="ai" />
          <AiGame rules={cfg.rules} player={me} explorer={cfg.explorer} onChange={refresh} />
        </main>
      )}
      {screen === 'wallet' && cfg && me && (
        <main className="wrap narrow">
          <button className="back" onClick={() => go('games')}>← All games</button>
          <Wallet player={me} rules={cfg.rules} explorer={cfg.explorer} network={cfg.network} onChange={refresh} />
          <Leaderboard explorer={cfg.explorer} onOpen={(id) => go('rps', id)} />
          <Terminal />
        </main>
      )}
      <footer className="wrap foot">PassBCH.cash · built from scratch for BCH BLAZE 2026 · <a href={CONFIG.repoUrl}>source</a> · {cfg?.network ?? 'chipnet'}</footer>
    </>
  );
}
