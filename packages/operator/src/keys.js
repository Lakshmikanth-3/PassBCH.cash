import fs from 'node:fs';
import { secp256k1, hexToBin, binToHex, hash160, encodeCashAddress, CashAddressType } from '@bitauth/libauth';
import { SignatureTemplate } from '@passrate/shared/tickettx';
import { PATHS } from './config.js';

export function keyPair(skHex) {
  const sk = hexToBin(skHex);
  const pk = secp256k1.derivePublicKeyCompressed(sk);
  if (typeof pk === 'string') throw new Error(pk);
  return { sk, pk, pkHex: binToHex(pk), sig: new SignatureTemplate(sk), address: p2pkhAddress(pk) };
}

export function p2pkhAddress(pk, prefix = 'bchtest') {
  return encodeCashAddress({ prefix, type: CashAddressType.p2pkh, payload: hash160(pk) }).address;
}

/** Operator key and a chipnet test-payer key (simulates a judge's wallet for automated tests). */
export function loadKeys() {
  const k = JSON.parse(fs.readFileSync(PATHS.keys, 'utf8'));
  return { operator: keyPair(k.op), payer: keyPair(k.payer) };
}
