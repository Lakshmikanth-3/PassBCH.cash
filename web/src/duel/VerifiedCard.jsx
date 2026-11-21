import { TermInvite } from './TermInvite.jsx';

/** After a game: proof that the result is on Bitcoin Cash, then the next step (terminal + Claude Code panel). */
export function VerifiedCard({ txid, explorer, network }) {
  const test = network && network !== 'mainnet';
  return (
    <div className="verifiedcard">
      {txid ? (
        <>
          <b className="green">Verified on Bitcoin Cash ✓</b>
          <p className="small" style={{ margin: '4px 0' }}>This result is a public {test ? 'chipnet ' : ''}transaction anyone can check.</p>
          <p className="mono small" style={{ wordBreak: 'break-all', margin: '4px 0' }}>{txid}</p>
          <p className="small" style={{ margin: '4px 0 10px' }}><a href={`${explorer}${txid}`} target="_blank" rel="noreferrer">Open in explorer ↗</a> · <a href={`/verify/${txid}`}>Re-check it yourself on /verify</a></p>
          <p className="muted small" style={{ margin: '0 0 4px' }}>Next: play from your terminal while Claude Code is thinking</p>
          <TermInvite link="https://passbch.vercel.app" bare />
          <p className="muted small" style={{ margin: '8px 0 4px' }}>Show the live round in the Claude Code status line:</p>
          <p className="mono small" style={{ margin: 0 }}>node panel/panel.mjs install</p>
        </>
      ) : <p className="muted small" style={{ margin: 0 }}><span className="spinner">◌</span> Writing the proof to Bitcoin Cash… this takes about 10 seconds and updates by itself.</p>}
    </div>
  );
}
