import { useState } from 'react';
import { sats } from './api.js';

/** Quick-pick chips plus a "Custom" box: any amount in BCH between the minimum and maximum stake. */
export function StakePicker({ rules, stake, setStake, total }) {
  const [custom, setCustom] = useState(false); const [txt, setTxt] = useState('');
  const min = rules.minStake ?? Math.min(...rules.stakes), max = Math.min(rules.maxStake ?? 100000, Math.max(total, min));
  const set = (v) => { setTxt(v); const n = Math.round(Number(v) * 1e8); if (Number.isFinite(n) && n >= min && n <= (rules.maxStake ?? 1e5)) setStake(n); };
  const n = Math.round(Number(txt) * 1e8);
  const bad = custom && txt !== '' && !(n >= min && n <= (rules.maxStake ?? 1e5));
  return (
    <>
      <div className="chips">
        {rules.stakes.map((s) => <button key={s} type="button" className={`chip ${!custom && stake === s ? 'on' : ''}`} disabled={s > total} title={s > total ? 'Not enough balance — add funds in the Vault' : undefined} onClick={() => { setCustom(false); setStake(s); }}>{sats(s)}</button>)}
        <button type="button" className={`chip ${custom ? 'on' : ''}`} onClick={() => { setCustom(true); if (txt) set(txt); }}>Custom amount</button>
      </div>
      {custom && (
        <div className="customstake">
          <input inputMode="decimal" placeholder={`BCH, e.g. ${(min / 1e8).toFixed(5)}`} value={txt} onChange={(e) => set(e.target.value)} aria-label="Custom stake in BCH" />
          <p className={bad || n > total ? 'hint' : 'muted small'}>{bad ? `Between ${sats(min)} and ${sats(rules.maxStake)}` : n > total ? 'More than your balance — add funds in the Vault' : txt ? `Stake: ${sats(n)}` : `Between ${sats(min)} and ${sats(rules.maxStake)}`}</p>
        </div>
      )}
    </>
  );
}
