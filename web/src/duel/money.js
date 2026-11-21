// Money display: games are played in BCH; the player's own currency is shown beside it for reference.
import { useEffect, useState } from 'react';
import { api } from './api.js';

export const CURRENCIES = { USD: '$', INR: '₹', JPY: '¥', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$', IDR: 'Rp ', PHP: '₱', NGN: '₦', BRL: 'R$' };
const guess = () => {
  try { const l = navigator.language || ''; if (/-IN$|^hi|^ta|^te/.test(l)) return 'INR'; if (/^ja/.test(l)) return 'JPY'; if (/-GB$/.test(l)) return 'GBP'; if (/^(de|fr|es|it|nl|pt-PT)/.test(l)) return 'EUR'; } catch { /* default */ }
  return 'USD';
};
export const getCurrency = () => { try { return localStorage.getItem('pb.ccy') || guess(); } catch { return guess(); } };
export const setCurrency = (c) => { try { localStorage.setItem('pb.ccy', c); } catch { /* blocked */ } window.dispatchEvent(new Event('pb:ccy')); };

let cache = null, inflight = null;
async function loadRates() {
  if (cache && Date.now() - cache.at < 60000) return cache.rates;
  inflight ??= api('rates').then((r) => { cache = { at: Date.now(), rates: r }; return r; }).finally(() => { inflight = null; });
  return inflight;
}
/** { rates, ccy } — refreshes every minute and when the player changes currency. */
export function useFx() {
  const [rates, setRates] = useState(cache?.rates ?? null); const [ccy, setCcy] = useState(getCurrency);
  useEffect(() => {
    let stop = false; const get = () => loadRates().then((r) => !stop && setRates(r)).catch(() => {});
    get(); const t = setInterval(get, 60000); const f = () => setCcy(getCurrency());
    window.addEventListener('pb:ccy', f); return () => { stop = true; clearInterval(t); window.removeEventListener('pb:ccy', f); };
  }, []);
  return { rates, ccy };
}
export function fiat(sats, rates, ccy) {
  if (!rates?.[ccy]) return '';
  const v = (Number(sats) / 1e8) * rates[ccy];
  const digits = ccy === 'JPY' || ccy === 'IDR' || ccy === 'NGN' ? 0 : v < 1 ? 3 : 2;
  return `≈ ${CURRENCIES[ccy] ?? ''}${v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}${window.__pbTestnet ? ' at mainnet value' : ''}`;
}
