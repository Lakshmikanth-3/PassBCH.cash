import React, { useEffect, useRef, useState } from 'react';
import Stage3D from './Stage3D.jsx';
import { show } from './show.js';
import { api } from '../duel/api.js';
import { Rock, Chart, Agents, Coin, Keyboard } from '../icons.jsx';

const STAGES = [['rps', 'Rock · Paper · Scissors', Rock], ['updown', 'Up or Down', Chart], ['pf', 'Prompt Fight', Agents], ['coin', 'Coin Flip', Coin], ['typing', 'Typing Race', Keyboard]];

/** Landing showcase: the three 3D studios behind tabs. Rotates on its own until you pick one. */
export default function Showcase({ onPlay }) {
  const [i, setI] = useState(0); const [pinned, setPinned] = useState(false); const [hover, setHover] = useState(false); const replayed = useRef(false);
  useEffect(() => { if (pinned || hover) return undefined; const t = setInterval(() => setI((x) => (x + 1) % STAGES.length), 20000); return () => clearInterval(t); }, [pinned, hover]);
  const game = STAGES[i][0];
  useEffect(() => {
    if (game !== 'pf') return undefined;
    // replay the most recent real fight (real prompts, real moves) once the ring has loaded
    const t = setTimeout(async () => {
      try { const m = await api('pflatest'); if (m?.turns) show({ kind: 'pf', turns: m.turns, target: m.target, maxStep: m.maxStep, winner: m.winner, aName: m.aName, bName: m.bName }); } catch { /* idle ring */ }
    }, 1800);
    return () => clearTimeout(t);
  }, [game, i]);
  // Coin Flip and Typing Race tabs: replay the latest REAL finished game on a loop, like a working show
  useEffect(() => {
    if (game !== 'coin' && game !== 'typing') return undefined;
    let stop = false; let timer = 0;
    const play = async () => {
      try {
        const g = await api('qlatest', { q: `&kind=${game === 'coin' ? 'coin' : 'type'}` });
        if (stop) return;
        if (game === 'coin') show(g ? { kind: 'coinflip', result: g.result, outcome: g.outcome } : { kind: 'coinflip', result: Math.round(Math.random()), outcome: 'win' });
        else { show({ kind: 'typingstart' }); const pm = g?.playerMs ?? 6500, bm = g?.botMs ?? 9000; setTimeout(() => !stop && show({ kind: 'typingresult', playerMs: pm, botMs: bm, outcome: g?.outcome ?? 'win' }), 1800); }
      } catch { /* idle scene */ }
      if (!stop) timer = setTimeout(play, game === 'coin' ? 9500 : 13000);
    };
    timer = setTimeout(play, 2200);
    return () => { stop = true; clearTimeout(timer); };
  }, [game, i]);
  return (
    <div className="showcase" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="seg five">{STAGES.map(([k, l, I], n) => <button key={k} className={n === i ? 'on' : ''} onClick={() => { setI(n); setPinned(true); }}><I size={16} /> {l}</button>)}</div>
      <Stage3D key={game} game={game} height="clamp(300px, 48vw, 520px)">
        {game === 'pf' && <span className="replaytag">Replay of the latest real fight</span>}
        {(game === 'coin' || game === 'typing') && <span className="replaytag">Replay of the latest real game</span>}
      </Stage3D>
      <div className="row center-row"><button className="primary" onClick={() => onPlay(game)}>Play {STAGES[i][1]} →</button></div>
    </div>
  );
}
