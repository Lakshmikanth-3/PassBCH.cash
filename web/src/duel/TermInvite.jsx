import { useState } from 'react';

/** One-line terminal commands that open the same duel / fight link inside a friend's terminal. */
export function TermInvite({ link }) {
  const [c, setC] = useState(null);
  const cmds = [['PowerShell', `irm ${link} | iex`], ['Mac · Linux', `curl -sL ${link} | sh`]];
  const copy = (t, i) => navigator.clipboard?.writeText(t).then(() => { setC(i); setTimeout(() => setC(null), 1500); }).catch(() => {});
  return cmds.map(([k, t], i) => (
    <button key={k} className="codebtn" onClick={() => copy(t, i)} title="Copy">
      <code><span className="muted">{k}</span>  {t}</code><span className="small">{c === i ? 'Copied' : 'Copy'}</span>
    </button>
  ));
}
