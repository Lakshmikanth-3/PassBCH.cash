// BCH/USD 1-minute candles from public exchange APIs. Anyone can re-check a round on Coinbase.
const timed = (ms) => AbortSignal.timeout(ms);

/** { open, close, source } for the minute starting at roundStart (unix s), or null if not published yet. */
export async function getCandle(roundStart) {
  try {
    const url = `https://api.exchange.coinbase.com/products/BCH-USD/candles?granularity=60&start=${new Date(roundStart * 1000).toISOString()}&end=${new Date((roundStart + 60) * 1000).toISOString()}`;
    const rows = await (await fetch(url, { signal: timed(5000), headers: { 'user-agent': 'passbch-cash' } })).json();
    const c = Array.isArray(rows) && rows.find((r) => r[0] === roundStart); // [time, low, high, open, close, volume]
    if (c) return { open: c[3], close: c[4], source: 'coinbase' };
  } catch { /* fall through */ }
  try {
    const j = await (await fetch(`https://api.kraken.com/0/public/OHLC?pair=BCHUSD&interval=1&since=${roundStart - 60}`, { signal: timed(5000) })).json();
    const rows = Object.values(j.result ?? {}).find(Array.isArray) ?? [];
    const c = rows.find((r) => r[0] === roundStart); // [time, open, high, low, close, ...]
    if (c) return { open: Number(c[1]), close: Number(c[4]), source: 'kraken' };
  } catch { /* not available */ }
  return null;
}

/** Latest traded price, for display only (never used to settle). */
export async function spot() {
  try {
    const j = await (await fetch('https://api.exchange.coinbase.com/products/BCH-USD/ticker', { signal: timed(4000), headers: { 'user-agent': 'passbch-cash' } })).json();
    if (j.price) return { price: Number(j.price), source: 'coinbase' };
  } catch { /* fall through */ }
  const j = await (await fetch('https://api.kraken.com/0/public/Ticker?pair=BCHUSD', { signal: timed(4000) })).json();
  const t = Object.values(j.result ?? {})[0];
  return { price: Number(t.c[0]), source: 'kraken' };
}

/** Closes of the last `n` finished 1-minute candles (oldest first), for the 3D chart. Display only. */
export async function recentCloses(n = 12) {
  try {
    const rows = await (await fetch('https://api.exchange.coinbase.com/products/BCH-USD/candles?granularity=60', { signal: timed(4000), headers: { 'user-agent': 'passbch-cash' } })).json();
    if (Array.isArray(rows)) return rows.slice(0, n).reverse().map((r) => r[4]);
  } catch { /* none */ }
  return [];
}
