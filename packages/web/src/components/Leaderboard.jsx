import React from 'react';
import { leaderboardRow } from '@passrate/shared';

const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(0)}%`);

/** rows: [{ agent, model, lane, statuses: string[], latencies: number[] }] */
export default function Leaderboard({ rows }) {
  if (!rows.length) {
    return (
      <div className="card empty">
        <p>No sealed runs yet.</p>
        <p className="muted small">Scheduled runs start every 2 blocks once the harness is live. Missing results count as FAIL.</p>
      </div>
    );
  }
  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr><th>Agent · model</th><th>Lane</th><th>n</th><th>Pass rate</th><th>95% CI</th><th>Missing</th><th>No-show</th><th>Median start</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = leaderboardRow(r.statuses, r.latencies);
            return (
              <tr key={`${r.agent}-${r.model}-${r.lane}`}>
                <td>{r.agent} · {r.model}</td>
                <td>{r.lane}</td>
                <td>{s.n}</td>
                <td><strong>{pct(s.passRate)}</strong></td>
                <td className="muted">{pct(s.ci95.low)}–{pct(s.ci95.high)}</td>
                <td className="fail">{s.missing}</td>
                <td className="fail">{s.noShow}</td>
                <td>{s.medianStartLatencyS == null ? '—' : `${s.medianStartLatencyS.toFixed(1)} s`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
