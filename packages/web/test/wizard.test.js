import { describe, test, expect } from 'vitest';
import { secp256k1, hexToBin, encodeTransaction, decodeTransaction, binToHex } from '@bitauth/libauth';
import { walletKeys, buildDeposit, toWire } from '../src/duel/wizard.js';

// Fake WizardConnect manager: deterministic pubkeys per (child, index).
const manager = { getPubkey: (c, i) => secp256k1.derivePublicKeyCompressed(hexToBin((c * 100 + Number(i) + 1).toString(16).padStart(64, '0'))) };
const keys = walletKeys(manager, 'bchtest', 3);
const TO = 'bchtest:qqr8e70709swuxthp63ctnjgy34kclsjgg9ce9gcck';

describe('WizardConnect deposit', () => {
  test('derives receive + change addresses from xpub pubkeys', () => {
    expect(keys).toHaveLength(6);
    expect(keys[0]).toMatchObject({ path: 'receive', index: 0 });
    expect(keys[3]).toMatchObject({ path: 'change', index: 0 });
    expect(keys.every((k) => k.address.startsWith('bchtest:q'))).toBe(true);
  });
  test('skips indexes the wallet has not shared', () => {
    expect(walletKeys({ getPubkey: () => undefined })).toEqual([]);
  });
  const utxos = [{ txid: 'aa'.repeat(32), vout: 0, satoshis: 30000, key: keys[1] }, { txid: 'bb'.repeat(32), vout: 1, satoshis: 5000, key: keys[4] }];
  test('pays the deposit address, change goes to the change path, inputPaths match', () => {
    const r = buildDeposit({ utxos, to: TO, amount: 10000, changeKey: keys[3] });
    expect(r.transaction.inputs).toHaveLength(1); // largest coin covers it
    expect(r.inputPaths).toEqual([[0, 'receive', 1]]);
    expect(r.transaction.outputs[0].valueSatoshis).toBe(10000n);
    expect(r.transaction.outputs[1].lockingBytecode).toEqual(keys[3].locking);
    expect(r.fee).toBeGreaterThan(0n); expect(r.fee).toBeLessThan(1000n);
    const sum = r.transaction.outputs.reduce((s, o) => s + o.valueSatoshis, 0n) + r.fee;
    expect(sum).toBe(30000n);
  });
  test('unsigned tx encodes and decodes (valid structure for the wallet)', () => {
    const r = buildDeposit({ utxos, to: TO, amount: 32000, changeKey: keys[3] });
    expect(r.inputPaths).toEqual([[0, 'receive', 1], [1, 'change', 1]]);
    const hex = binToHex(encodeTransaction(r.transaction));
    expect(typeof decodeTransaction(hexToBin(hex))).toBe('object');
  });
  test('refuses when the wallet is short', () => {
    expect(() => buildDeposit({ utxos, to: TO, amount: 40000, changeKey: keys[3] })).toThrow(/wallet has/);
  });
  test('wire format survives JSON (bigint + bytes encoded)', () => {
    const r = buildDeposit({ utxos, to: TO, amount: 10000, changeKey: keys[3] });
    const w = toWire({ sourceOutputs: r.sourceOutputs });
    expect(() => JSON.stringify(w)).not.toThrow();
    expect(JSON.stringify(w)).toMatch(/<bigint: 30000n>/);
    expect(JSON.stringify(w)).toMatch(/<Uint8Array: 0x/);
  });
});
