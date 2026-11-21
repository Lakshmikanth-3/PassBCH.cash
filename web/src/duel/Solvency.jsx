import { useEffect, useState } from 'react';
import { api, sats } from './api.js';

/** Live solvency line: house wallet balance (read from the chain) vs the cash players could withdraw (database). */
export function Solvency({ explorer }) {
  const [s, setS] = useState(null);
  useEffect(() => { api('solvency').then(setS).catch(() => {}); }, []);
  if (!s) return null;
  return (
    <p className={`solvency ${s.covered === false ? 'bad' : ''}`}>
      <b>House solvency:</b> house wallet {s.houseSats == null ? 'balance unavailable' : sats(s.houseSats)} vs player cash {sats(s.playerCashSats)}
      {s.covered === true && <> · <b className="green">covered</b></>}{s.covered === false && <> · <b className="red">not fully covered</b></>}
      <span className="muted small"> · {s.network} · bonus credit is play-only and not counted · {s.address.slice(0, 18)}…</span>
    </p>
  );
}
