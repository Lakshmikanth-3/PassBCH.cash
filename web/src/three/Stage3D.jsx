import React, { useEffect, useRef, useState } from 'react';
import { api } from '../duel/api.js';
import { show } from './show.js';

/** One game's 3D TV-show stage, with a LIVE badge and the current camera name like a broadcast. */
export default function Stage3D({ game, height, children, live = false }) {
  const canvas = useRef(null);
  const [shot, setShot] = useState('');
  const [failed, setFailed] = useState(false);
  const [low, setLow] = useState(() => { try { return localStorage.getItem('pb.lowpower') === '1'; } catch { return false; } });
  useEffect(() => { const f = () => { try { setLow(localStorage.getItem('pb.lowpower') === '1'); } catch { /* blocked */ } }; window.addEventListener('pb:lowpower', f); return () => window.removeEventListener('pb:lowpower', f); }, []);
  useEffect(() => {
    let alive = true, stage = null;
    if (low) return () => {};
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    import('./stage.js').then(({ createStage }) => {
      if (!alive || !canvas.current) return;
      try { stage = createStage(canvas.current, { game, reducedMotion: reduced, onShot: setShot }); } catch { setFailed(true); }
    }).catch(() => {
      try { if (!sessionStorage.getItem('pb.reloaded')) { sessionStorage.setItem('pb.reloaded', '1'); location.reload(); return; } } catch { /* storage blocked */ }
      setFailed(true);
    });
    return () => { alive = false; stage?.dispose(); };
  }, [game, low]);
  // Feed live data so the stage is alive even before you play.
  useEffect(() => {
    let stop = false, seeded = false;
    const tick = async () => {
      try {
        if (game === 'updown') { const p = await api('price', { q: seeded ? '' : '&history=1' }); seeded = true; if (!stop) show({ kind: 'price', price: p.price, history: p.history }); }
      } catch { /* keep last frame */ }
    };
    if (game === 'updown') { let busy = false; const safe = async () => { if (busy) return; busy = true; try { await tick(); } finally { busy = false; } }; safe(); const t = setInterval(safe, 4000); return () => { stop = true; clearInterval(t); }; }
    return () => { stop = true; };
  }, [game]);
  return (
    <div className="stage3d" style={height ? { height } : undefined}>
      {!failed && !low && <canvas ref={canvas} role="img" aria-label={`3D ${game} stage`} />}
      {low && <div className="stage-fallback">Low-power mode: 3D is off (turn it on in Vault → Settings)</div>}
      {failed && <div className="stage-fallback">3D view not available on this device</div>}
      <div className={`onair ${live ? 'live' : ''}`}><span className="dot" /> {live ? 'LIVE' : 'STUDIO'}{shot && <span className="cam">{shot}</span>}</div>
      {children && <div className="stage-overlay">{children}</div>}
    </div>
  );
}
