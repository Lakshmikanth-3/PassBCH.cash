// Read the operator's recent START/RESULT records from the chain (Electrum) and build panel state.
import { hexToBin, decodeTransaction } from '@bitauth/libauth';
import { fromOpReturn } from '@passrate/shared';
import { roundsFromRecords } from './rounds.js';

const record = (tx) => { try { return fromOpReturn(tx.outputs[0].lockingBytecode); } catch { return null; } };

/** Decoded records for the last `limit` txs of the operator inbox. Raw txs are cached by txid (immutable). */
export async function fetchRecords(provider, inbox, { limit = 60, cache = new Map() } = {}) {
  const hist = await provider.performRequest('blockchain.address.get_history', inbox);
  const out = [];
  for (const { tx_hash: txid, height } of hist.slice(-limit)) {
    let rec = cache.get(txid);
    if (rec === undefined) {
      const tx = decodeTransaction(hexToBin(await provider.getRawTransaction(txid)));
      rec = typeof tx === 'string' ? null : record(tx);
      if (rec && rec.type !== 'S' && rec.type !== 'R') rec = null;
      cache.set(txid, rec);
    }
    if (rec) out.push({ txid, height, rec });
  }
  return out;
}

export async function buildState(provider, { inbox, slugs, network }, opts) {
  const rounds = roundsFromRecords(await fetchRecords(provider, inbox, opts));
  return { v: 1, network, inbox, slugs, rounds: rounds.slice(0, 30), updatedUnix: Math.floor(Date.now() / 1000) };
}
