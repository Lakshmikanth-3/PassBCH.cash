// Browser client for the PassBCH.cash API. Token and per-duel salts live in localStorage (wrapped: storage can be blocked).
export const MOVES = ['rock', 'paper', 'scissors'];

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* blocked */ } },
};
export const session = {
  get: () => store.get('sd.session'),
  set: (s) => store.set('sd.session', s),
  clear: () => { try { localStorage.removeItem('sd.session'); } catch { /* blocked */ } },
  salt: (id) => store.get(`sd.salt.${id}`),
  saveSalt: (id, v) => store.set(`sd.salt.${id}`, v),
};

export async function api(a, { body, q = '' } = {}) {
  const tok = session.get()?.token;
  const r = await fetch(`/api/duel?a=${a}${q}`, { method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok || j.error) throw new Error(j.error ?? 'request failed');
  return j;
}

export async function commitMove(move) {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${move}:${salt}`));
  return { salt, commit: [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('') };
}

/** Every amount is shown in BCH (1 BCH = 100,000,000 sats). */
export const sats = (n) => `${(Number(n ?? 0) / 1e8).toFixed(8).replace(/0+$/, '').replace(/\.$/, '')} BCH`;

/** Message shown under game buttons when the player can't cover the smallest stake (never leave buttons silently grey). */
export const lowBalance = (player, rules) => player.bonus + player.cash < Math.min(...rules.stakes);
