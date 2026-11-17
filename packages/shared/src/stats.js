// Leaderboard statistics and FAIL-on-missing rules (PRD §8.4, §8.6).

/** Wilson score interval, 95% by default. Returns {low, high} in [0,1]. */
export function wilson(passes, n, z = 1.959963984540054) {
  if (n === 0) return { low: 0, high: 1 };
  if (passes < 0 || passes > n) throw new Error('passes out of range');
  const p = passes / n, z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

/**
 * Status of one run from chain facts alone.
 * run: { mode, scheduledHeight?, startHeight?, start?, result?, refunded?, nowUnix, tipHeight }
 * Returns 'PASS' | 'FAIL' | 'FAIL_NO_SHOW' | 'FAIL_TIMEOUT' | 'PENDING' | 'REFUNDED_NO_SHOW'
 */
export function runStatus(run, rules = { scheduledStartWithin: 1 }) {
  if (run.refunded) return 'REFUNDED_NO_SHOW';
  if (!run.start) {
    if (run.mode === 'scheduled' && run.tipHeight > run.scheduledHeight + rules.scheduledStartWithin) return 'FAIL_NO_SHOW';
    return 'PENDING';
  }
  if (run.result) {
    if (run.result.timeUnix > run.start.deadlineUnix) return 'FAIL_TIMEOUT';
    return run.result.exit === 0 && run.result.total > 0 && run.result.passed === run.result.total ? 'PASS' : 'FAIL';
  }
  return run.nowUnix > run.start.deadlineUnix ? 'FAIL_TIMEOUT' : 'PENDING';
}

/** Aggregate a leaderboard row. Pending runs are excluded; every FAIL_* counts in n. */
export function leaderboardRow(statuses, latenciesS = []) {
  const done = statuses.filter((s) => s !== 'PENDING');
  const counted = done.filter((s) => s !== 'REFUNDED_NO_SHOW');
  const passes = counted.filter((s) => s === 'PASS').length;
  const sorted = [...latenciesS].sort((a, b) => a - b);
  const median = sorted.length === 0 ? null
    : sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return {
    n: counted.length,
    passes,
    passRate: counted.length ? passes / counted.length : null,
    ci95: wilson(passes, counted.length),
    missing: counted.filter((s) => s === 'FAIL_TIMEOUT').length,
    noShow: done.filter((s) => s === 'FAIL_NO_SHOW' || s === 'REFUNDED_NO_SHOW').length,
    medianStartLatencyS: median,
  };
}
