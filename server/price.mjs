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

const CB = 'https://api.exchange.coinbase.com/products/BCH-USD';
const cbGet = async (path, ms = 5000) => (await fetch(CB + path, { signal: timed(ms), headers: { 'user-agent': 'passbch-cash' } })).json();
/** Candles [time, close] (oldest first) between from..to (unix s), in chunks of 300 (Coinbase limit). */
async function candles(gran, from, to) {
  const out = [];
  for (let a = from; a < to; a += gran * 300) {
    const b = Math.min(to, a + gran * 300);
    const rows = await cbGet(`/candles?granularity=${gran}&start=${new Date(a * 1000).toISOString()}&end=${new Date(b * 1000).toISOString()}`, 6000);
    if (Array.isArray(rows)) out.push(...rows.map((r) => [r[0], r[4]]));
  }
  return [...new Map(out.map((r) => [r[0], r])).values()].sort((x, y) => x[0] - y[0]);
}
const RANGE = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '5h': 18000, '1y': 365 * 86400, '5y': 5 * 365 * 86400 };
const chartCache = new Map();
/**
 * Real BCH/USD series for the dashboard chart (display only), [time, price] oldest first.
 * 1m / 5m: individual Coinbase trades. 15m–5h: 1-minute candles. 1y / 5y: daily candles (cached 1 h).
 */
export async function chartSeries(range = '1h') {
  if (!RANGE[range]) range = { 15: '15m', 60: '1h', 300: '5h' }[range] ?? '1h';
  const now = Math.floor(Date.now() / 1000), span = RANGE[range];
  const ttl = span >= 86400 * 300 ? 3600e3 : span >= 900 ? 20e3 : 3e3;
  const hit = chartCache.get(range); if (hit && Date.now() - hit.at < ttl) return hit.data;
  let data = [];
  try {
    if (span <= 300) {
      const rows = await cbGet('/trades?limit=1000');
      if (Array.isArray(rows)) data = rows.map((t) => [Date.parse(t.time) / 1000, Number(t.price)]).filter((r) => r[0] >= now - span).reverse();
      if (data.length < 2) data = await candles(60, now - Math.max(span, 600), now);
    } else if (span <= 18000) data = await candles(60, now - span, now);
    else data = await candles(86400, now - span, now);
  } catch { /* none */ }
  if (data.length) chartCache.set(range, { at: Date.now(), data });
  return data;
}

/**
 * BCH/USD price at an exact second: the last public trade at or before `ts` (Coinbase, Kraken fallback).
 * Anyone can re-check it from the exchange's trade history. Returns { price, tradeTime, source } or null.
 */
export async function priceAt(ts) {
  try {
    const rows = await (await fetch('https://api.exchange.coinbase.com/products/BCH-USD/trades?limit=1000', { signal: timed(5000), headers: { 'user-agent': 'passbch-cash' } })).json();
    if (Array.isArray(rows) && rows.length) {
      const oldest = Date.parse(rows.at(-1).time) / 1000;
      const hit = rows.find((t) => Date.parse(t.time) / 1000 <= ts);
      if (hit && ts >= oldest) return { price: Number(hit.price), tradeTime: hit.time, source: 'coinbase' };
    }
  } catch { /* fall through */ }
  try {
    const j = await (await fetch(`https://api.kraken.com/0/public/Trades?pair=BCHUSD&since=${(ts - 300) * 1e9}`, { signal: timed(5000) })).json();
    const rows = Object.values(j.result ?? {}).find(Array.isArray) ?? [];
    let hit = null; for (const t of rows) { if (Number(t[2]) <= ts) hit = t; else break; }
    if (hit) return { price: Number(hit[0]), tradeTime: new Date(Number(hit[2]) * 1000).toISOString(), source: 'kraken' };
  } catch { /* none */ }
  return null;
}

let ratesCache = null;
/** 1 BCH in other currencies (fiat + crypto), cached 60 s. */
export async function rates() {
  if (ratesCache && Date.now() - ratesCache.at < 60000) return ratesCache.data;
  // Single source of truth: the BCH/USD spot price (same feed as Up/Down) times plain USD FX rates.
  const [{ price }, fx] = await Promise.all([spot(), fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD', { signal: timed(5000) }).then((r) => r.json())]);
  const keep = ['USD', 'INR', 'JPY', 'EUR', 'GBP', 'AED', 'SGD', 'IDR', 'PHP', 'NGN', 'BRL', 'USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'LTC', 'DOGE'];
  const data = Object.fromEntries(keep.filter((k) => fx.data?.rates?.[k]).map((k) => [k, price * Number(fx.data.rates[k])]));
  data.USD = price; data.source = 'Coinbase BCH-USD';
  ratesCache = { at: Date.now(), data };
  return data;
}

/** SideShift.ai public quote for a crypto <-> BCH swap (rate, min, max). Used for previews; swaps run on mainnet. */
export async function swapQuote(coin, dir) {
  const ok = /^[a-z0-9]+(-[a-z0-9]+)?$/.test(coin); if (!ok) throw new Error('bad coin');
  const pair = dir === 'out' ? `bch/${coin}` : `${coin}/bch`;
  const j = await (await fetch(`https://sideshift.ai/api/v2/pair/${pair}`, { signal: timed(6000) })).json();
  if (j.error) throw new Error(j.error.message ?? 'no quote');
  return { rate: Number(j.rate), min: Number(j.min), max: Number(j.max), from: j.depositCoin, to: j.settleCoin, network: dir === 'out' ? j.settleNetwork : j.depositNetwork };
}
