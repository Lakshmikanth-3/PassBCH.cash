import React, { useEffect, useRef, useState } from 'react';
import { api } from '../duel/api.js';
import { show } from './show.js';

/** React wrapper: lazy-creates the three.js arena, follows the selected game tab. Falls back quietly without WebGL. */
export default function Arena3D({ game }) {
  const canvas = useRef(null); const arena = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    import('./arena.js').then(({ createArena }) => {
      if (!alive || !canvas.current) return;
      try { arena.current = createArena(canvas.current, { reducedMotion: reduced }); arena.current.setGame(game); } catch { setFailed(true); }
    }).catch(() => setFailed(true));
    return () => { alive = false; arena.current?.dispose(); arena.current = null; };
  }, []);
  useEffect(() => { arena.current?.setGame(game); }, [game]);
  // The arena feeds itself live data, so it works before sign-up too.
  useEffect(() => {
    let stop = false; let seeded = false;
    const tick = async () => {
      try {
        if (game === 'updown') { const p = await api('price', { q: seeded ? '' : '&history=1' }); seeded = true; if (!stop) show({ kind: 'price', price: p.price, history: p.history }); }
        if (game === 'ai') {
          const s = await api('ai'); if (stop) return;
          const c = s.current ?? s.recent[0];
          if (c) show({ kind: 'ai', status: s.current ? (s.current.status === 'open' && s.now < Number(s.current.bet_close_s) ? 'open' : 'running') : c.status, model: c.model.replace('openai/', ''), slug: c.slug, pass: c.pass, passed: c.passed, total: c.total });
        }
      } catch { /* offline: keep the last frame */ }
    };
    tick(); const t = setInterval(tick, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [game]);
  if (failed) return null;
  return (
    <div className="arena3d">
      <canvas ref={canvas} aria-label="3D arena: animated view of the selected game" role="img" />
      <div className="arena3d-hint">drag to look around</div>
    </div>
  );
}

export { show } from './show.js';
