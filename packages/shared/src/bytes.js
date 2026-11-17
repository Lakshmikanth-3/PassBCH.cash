// Isomorphic byte helpers (Node + browser). No Buffer dependency.
import { sha256 as nobleSha256 } from '@noble/hashes/sha256';

export const sha256 = (bytes) => nobleSha256(bytes);

export function hexToBytes(hex) {
  if (typeof hex !== 'string' || hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) {
    throw new Error(`invalid hex: ${hex}`);
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(bytes) {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

export function concat(...parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export const utf8 = (s) => new TextEncoder().encode(s);

export function equal(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Fixed-size 32-byte value from hex or bytes. */
export function bytes32(v, name = 'value') {
  const b = typeof v === 'string' ? hexToBytes(v) : v;
  if (!(b instanceof Uint8Array) || b.length !== 32) throw new Error(`${name} must be 32 bytes`);
  return b;
}

export function uintLE(value, size) {
  const n = BigInt(value);
  if (n < 0n || n >= 1n << BigInt(size * 8)) throw new Error(`uint${size * 8} out of range: ${value}`);
  const out = new Uint8Array(size);
  let x = n;
  for (let i = 0; i < size; i++) { out[i] = Number(x & 0xffn); x >>= 8n; }
  return out;
}

export function readUintLE(bytes, offset, size) {
  if (offset + size > bytes.length) throw new Error('read past end');
  let n = 0n;
  for (let i = size - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[offset + i]);
  return Number(n);
}
