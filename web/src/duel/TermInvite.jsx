import { useState } from 'react';

/** One-line terminal commands that open the same duel / fight link inside a friend's terminal. */
export function TermInvite({ link, bare }) {
  const [c, setC] = useState(null);
  const m = String(link).match(/\/(race|duel|fight)\/([0-9a-f]{32})/); const sub = m ? ` ${{ race: 'race', duel: 'join', fight: 'fight' }[m[1]]} ${m[2]}` : '';
  const cmds = bare ? [['Any OS (Node)', 'npx passbch'], ['PowerShell', 'irm https://passbch.vercel.app | iex'], ['Mac · Linux', 'curl -sL passbch.vercel.app | sh']] : [['Any OS (Node)', `npx passbch${sub}`], ['PowerShell', `irm ${link} | iex`], ['Mac · Linux', `curl -sL ${link} | sh`]];
  const copy = (t, i) => navigator.clipboard?.writeText(t).then(() => { setC(i); setTimeout(() => setC(null), 1500); }).catch(() => {});
  return cmds.map(([k, t], i) => (
    <button key={k} className="codebtn" onClick={() => copy(t, i)} title="Copy">
      <code><span className="muted">{k}</span>  {t}</code><span className="small">{c === i ? 'Copied' : 'Copy'}</span>
    </button>
  ));
}
