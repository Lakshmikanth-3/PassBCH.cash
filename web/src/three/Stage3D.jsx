import React, { useEffect, useRef, useState } from 'react';
import { api } from '../duel/api.js';
import { show } from './show.js';

/** One game's 3D TV-show stage, with a LIVE badge and the current camera name like a broadcast. */
export default function Stage3D({ game, height, children }) {
  const canvas = useRef(null);
  const [shot, setShot] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true, stage = null;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    import('./stage.js').then(({ createStage }) => {
      if (!alive || !canvas.current) return;
      try { stage = createStage(canvas.current, { game, reducedMotion: reduced, onShot: setShot }); } catch { setFailed(true); }
    }).catch(() => setFailed(true));
    return () => { alive = false; stage?.dispose(); };
  }, [game]);
  // Feed live data so the stage is alive even before you play.
  useEffect(() => {
    let stop = false, seeded = false;
    const tick = async () => {
      try {
        if (game === 'updown') { const p = await api('price', { q: seeded ? '' : '&history=1' }); seeded = true; if (!stop) show({ kind: 'price', price: p.price, history: p.history }); }
        if (game === 'ai') {
          const s = await api('ai'); if (stop) return;
          const c = s.current ?? s.recent[0];
          if (c) show({ kind: 'ai', status: s.current ? (s.current.status === 'open' && s.now < Number(s.current.bet_close_s) ? 'open' : 'running') : c.status, model: c.model.replace('openai/', ''), slug: c.slug, pass: c.pass, passed: c.passed, total: c.total });
        }
      } catch { /* keep last frame */ }
    };
    if (game !== 'rps') { tick(); const t = setInterval(tick, game === 'updown' ? 4000 : 4000); return () => { stop = true; clearInterval(t); }; }
    return () => { stop = true; };
  }, [game]);
  return (
    <div className="stage3d" style={height ? { height } : undefined}>
      {!failed && <canvas ref={canvas} role="img" aria-label={`3D ${game} stage`} />}
      {failed && <div className="stage-fallback">3D view not available on this device</div>}
      <div className="onair"><span className="dot" /> LIVE{shot && <span className="cam">{shot}</span>}</div>
      {children && <div className="stage-overlay">{children}</div>}
    </div>
  );
}
