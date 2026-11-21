import React, { useCallback, useEffect, useState } from 'react';
import Banner from './components/Banner.jsx';
import { CONFIG } from './config.js';
import { api, session, sats } from './duel/api.js';
import { Signup, NewDuel, DuelView } from './duel/Play.jsx';
import { Wallet, Leaderboard, Terminal } from './duel/Side.jsx';
import { Vault, AddFunds, Withdraw } from './duel/Funds.jsx';
import { Winners, WinnersStrip } from './duel/Winners.jsx';
import { Trophy } from './icons.jsx';
import { useFx, fiat } from './duel/money.js';
import { UpDown, UpDownFeed } from './duel/UpDown.jsx';
import { NewFight, FightView, FightLobby } from './duel/PromptFight.jsx';
import { Rock, Chart, Agents, Hourglass, Grid, Wallet as WalletIcon, Logout } from './icons.jsx';
import Stage3D from './three/Stage3D.jsx';

// Real pages: /  /login  /games  /games/rps  /games/predict  /games/ai  /wallet  /duel/<id>
const PATHS = { '': '/', login: '/login', games: '/games', rps: '/games/rps', predict: '/games/predict', pf: '/games/prompt-fight', wallet: '/wallet', add: '/wallet/add', withdraw: '/wallet/withdraw', winners: '/winners' };
const readRoute = () => {
  if (typeof location === 'undefined') return { route: '' };
  const q = new URLSearchParams(location.search);
  if (q.get('duel')) return { route: 'rps', duel: q.get('duel') }; // old share links
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const m = path.match(/^\/duel\/([0-9a-f]{32})$/);
  if (m) return { route: 'rps', duel: m[1] };
  const f = path.match(/^\/fight\/([0-9a-f]{32})$/);
  if (f) return { route: 'pf', fight: f[1] };
  const legacy = location.hash.replace(/^#\/?/, ''); // old #/games links
  if (legacy && PATHS[legacy]) return { route: legacy };
  const route = Object.keys(PATHS).find((k) => PATHS[k] === path);
  return { route: route ?? (path === '/' ? '' : 'notfound') };
};
const TITLES = { '': 'PassBCH.cash — play while your AI thinks', login: 'Log in · PassBCH.cash', games: 'Games · PassBCH.cash', rps: 'Rock Paper Scissors · PassBCH.cash', predict: 'Up or Down · PassBCH.cash', pf: 'Prompt Fight · PassBCH.cash', wallet: 'Vault · PassBCH.cash', add: 'Add funds · PassBCH.cash', withdraw: 'Withdraw · PassBCH.cash', winners: 'Worldwide winners · PassBCH.cash', notfound: 'Page not found · PassBCH.cash' };

export const GAMES = [
  { id: 'rps', Icon: Rock, title: 'Rock · Paper · Scissors', line: 'Sit at the table with the host. Beat a friend or the House Bot. Winner takes the pot.', tag: 'PvP · 2 min', color: 'gold' },
  { id: 'predict', Icon: Chart, title: 'Up or Down', line: 'Will BCH close the next minute higher or lower? Two buttons. Pays 1.9×.', tag: 'Prediction · 1 min', color: 'cyan' },
  { id: 'pf', Icon: Agents, title: 'Prompt Fight', line: 'Write a strategy prompt. Your AI agent fights another one live. Winner takes the pot.', tag: 'AI vs AI · 30 s', color: 'lime' },
  { id: 'soon', Icon: Hourglass, title: 'Upcoming BCH games', line: 'Tournaments, lucky draws, team battles and more — coming soon.', tag: 'Coming soon', color: 'magenta', soon: true },
];

function TopBar({ me, go, logout }) {
  const { rates, ccy } = useFx();
  return (
    <header className="topbar">
      <div className="wrap row between">
        <button className="brand" onClick={() => go('')} aria-label="PassBCH.cash home"><span className="brand-mark">◆</span> PassBCH<span className="dim">.cash</span></button>
        {me ? (
          <nav className="row gap">
            <button className="chipbtn" onClick={() => go('games')}><Grid size={16} /> Games</button>
            <button className="chipbtn hide-sm" onClick={() => go('winners')}><Trophy size={16} /> Winners</button>
            <button className="chipbtn balchip" onClick={() => go('wallet')} title="Bonus + withdrawable"><WalletIcon size={16} /> {sats(me.bonus + me.cash)} <span className="fiatsm">{fiat(me.bonus + me.cash, rates, ccy)}</span></button>
            <button className="chipbtn" onClick={logout} title={`Log out ${me.name}`} aria-label="Log out"><Logout size={16} /></button>
          </nav>
        ) : <div className="row gap"><button className="chipbtn hide-sm" onClick={() => go('winners')}><Trophy size={16} /> Winners</button><button className="chipbtn" onClick={() => go('login')}>Log in</button><button className="primary" onClick={() => go('login')}>Play now</button></div>}
      </div>
    </header>
  );
}

function Landing({ go, me }) {
  return (
    <main className="landing">
      <section className="wrap hero">
        <p className="kicker">Bitcoin Cash game show</p>
        <h1>Play while your <span className="hl">AI thinks</span>.</h1>
        <p className="tag">Claude is cogitating? Jump into a one-minute round: rock-paper-scissors at a live TV table, call BCH up or down, or write a prompt and watch your AI agent fight another one. Real BCH, every result on chain.</p>
        <div className="row gap center-row">
          <button className="primary big" onClick={() => go(me ? 'games' : 'login')}>{me ? 'Go to games →' : 'Play free — get 25,000 sats →'}</button>
          <a className="secondary big" href="#how">How it works</a>
        </div>
      </section>
      <section className="wrap"><WinnersStrip onOpen={() => go('winners')} /></section>
      <section className="wrap"><Stage3D game="rps" height="clamp(300px, 48vw, 520px)" /></section>
      <section className="wrap cards4">
        {GAMES.map((g) => (
          <button key={g.id} className={`gcard ${g.color} ${g.soon ? 'soon' : ''}`} disabled={g.soon} onClick={() => !g.soon && go(g.id)}><div className="gicon"><g.Icon size={36} /></div><b>{g.title}</b><p>{g.line}</p><span className="gtag">{g.tag}</span></button>
        ))}
      </section>
      <section id="how" className="wrap how3">
        {[['1', 'Pick a name', 'Free starting credit lands instantly (0.00025 BCH). Invite a friend and you both get more.'], ['2', 'Pick a game', 'Every round takes about a minute — perfect while your AI is thinking.'], ['3', 'Win & withdraw', 'Add funds or withdraw in BCH (WizardConnect or QR). Every result is public on chain.']].map(([n, t, d]) => (
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
            <div className="gicon"><g.Icon size={46} /></div>
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
  const [{ route, duel, fight }, setNav] = useState(readRoute);
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
    const keep = new URLSearchParams(location.search).get('ref');
    const url = (d ? (r === 'pf' ? `/fight/${d}` : `/duel/${d}`) : PATHS[r] ?? '/') + (keep && (r === 'login' || r === '') ? `?ref=${keep}` : '');
    try { history.pushState(null, '', url); } catch { /* sandboxed */ }
    setNav(r === 'pf' ? { route: r, fight: d } : { route: r, duel: d }); window.scrollTo?.({ top: 0 });
  };
  const logout = () => { session.clear(); setMe(null); go(''); };
  // Signed-out players go to login for anything but the landing page (a shared duel link still opens).
  const needLogin = !me && cfg && ['wallet', 'add', 'withdraw', 'games'].includes(route);
  const screen = needLogin ? 'login' : route === 'login' && me ? 'games' : route;
  useEffect(() => { document.title = TITLES[screen] ?? TITLES['']; }, [screen]);

  return (
    <>
      <Banner config={{ ...CONFIG, network: cfg?.network ?? CONFIG.network }} />
      <TopBar me={me} go={go} logout={logout} />
      {err && <div className="wrap"><div className="card err">Can't reach the game server: {err}</div></div>}
      {screen === '' && <Landing go={go} me={me} />}
      {screen === 'login' && cfg && (
        <main className="wrap narrow"><Signup refCode={ref} onDone={async () => { await refresh(); go(duel ? 'rps' : 'games', duel); }} /></main>
      )}
      {screen === 'games' && me && <GameSelect go={go} />}
      {screen === 'rps' && cfg && (
        <main className="wrap game">
          <button className="back" onClick={() => go('games')}>← All games</button>
          <div className="gamelayout">
            <div className="stagecol"><Stage3D game="rps" /></div>
            <section className="col">
              {duel ? <DuelView id={duel} me={me} explorer={cfg.explorer} onClose={() => go('rps')} onChange={refresh} />
                : me ? <NewDuel rules={cfg.rules} player={me} onCreated={(id) => go('rps', id)} /> : null}
              {!me && <Signup refCode={ref} onDone={refresh} />}
            </section>
          </div>
          <Leaderboard explorer={cfg.explorer} onOpen={(id) => go('rps', id)} />
        </main>
      )}
      {screen === 'predict' && cfg && (
        <main className="wrap game">
          <button className="back" onClick={() => go('games')}>← All games</button>
          {me ? <UpDown rules={cfg.rules} player={me} explorer={cfg.explorer} onChange={refresh} />
            : <div className="gamelayout"><div className="stagecol"><Stage3D game="updown" /></div><Signup refCode={ref} onDone={refresh} /></div>}
          <UpDownFeed explorer={cfg.explorer} />
        </main>
      )}
      {screen === 'pf' && cfg && (
        <main className="wrap game">
          <button className="back" onClick={() => go('games')}>← All games</button>
          <div className="gamelayout">
            <div className="stagecol"><Stage3D game="pf" /></div>
            <section className="col">
              {fight ? <FightView id={fight} me={me} explorer={cfg.explorer} onClose={() => go('pf')} onChange={refresh} />
                : me ? <NewFight rules={cfg.rules} player={me} onCreated={(id) => go('pf', id)} /> : null}
              {!me && <Signup refCode={ref} onDone={refresh} />}
            </section>
          </div>
          {!fight && <FightLobby onOpen={(id) => go('pf', id)} />}
        </main>
      )}
      {screen === 'wallet' && cfg && me && (
        <main className="wrap narrow">
          <button className="back" onClick={() => go('games')}>← All games</button>
          <Vault player={me} go={go} />
          <Wallet player={me} rules={cfg.rules} explorer={cfg.explorer} network={cfg.network} onChange={refresh} />
          <Leaderboard explorer={cfg.explorer} onOpen={(id) => go('rps', id)} />
          <Terminal />
        </main>
      )}
      {screen === 'add' && cfg && me && (
        <main className="wrap narrow"><button className="back" onClick={() => go('wallet')}>← Vault</button><AddFunds network={cfg.network} onChange={refresh} /></main>
      )}
      {screen === 'withdraw' && cfg && me && (
        <main className="wrap narrow"><button className="back" onClick={() => go('wallet')}>← Vault</button><Withdraw player={me} rules={cfg.rules} explorer={cfg.explorer} network={cfg.network} onChange={refresh} /></main>
      )}
      {screen === 'winners' && cfg && <Winners explorer={cfg.explorer} />}
      {screen === 'notfound' && (
        <main className="wrap narrow"><div className="card center"><h2>Page not found</h2><p className="muted">This address doesn't exist on PassBCH.cash.</p>
          <div className="row gap center-row"><button className="primary" onClick={() => go('')}>Home</button><button className="secondary" onClick={() => go('games')}>Games</button></div></div></main>
      )}
      <footer className="wrap foot">PassBCH.cash · built from scratch for BCH BLAZE 2026 · <a href={CONFIG.repoUrl}>source</a> · {cfg?.network ?? 'chipnet'}</footer>
    </>
  );
}
