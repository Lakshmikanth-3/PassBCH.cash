// WizardConnect deposit: the connected wallet signs a payment to the player's deposit address.
// We only see the wallet's public keys (xpubs); the wallet keeps its private keys and approves on the phone.
import { hash160, encodeCashAddress, CashAddressType, hexToBin, stringify, cashAddressToLockingBytecode } from '@bitauth/libauth';

export const PATHS = [[0, 'receive'], [1, 'change']];
const p2pkhLocking = (h160) => Uint8Array.from([0x76, 0xa9, 0x14, ...h160, 0x88, 0xac]);

/** Wallet addresses we can see from its xpubs (first `n` on each path). */
export function walletKeys(manager, prefix = 'bchtest', n = 20) {
  const out = [];
  for (const [child, name] of PATHS) for (let i = 0; i < n; i++) {
    const pk = manager.getPubkey(child, BigInt(i));
    if (!pk) continue;
    const h = hash160(pk);
    out.push({ path: name, index: i, address: encodeCashAddress({ prefix, type: CashAddressType.p2pkh, payload: h }).address, locking: p2pkhLocking(h) });
  }
  return out;
}

/**
 * Unsigned deposit tx: wallet UTXOs -> deposit address (+ change back to the wallet's change path).
 * utxos: [{ txid, vout, satoshis, key }] where key is an entry of walletKeys().
 */
export function buildDeposit({ utxos, to, amount, changeKey, feePerByte = 2 }) {
  amount = BigInt(amount);
  const sorted = [...utxos].sort((a, b) => Number(BigInt(b.satoshis) - BigInt(a.satoshis)));
  const picked = []; let total = 0n;
  const fee = (nIn, nOut) => BigInt((10 + 148 * nIn + 34 * nOut) * feePerByte);
  for (const u of sorted) { picked.push(u); total += BigInt(u.satoshis); if (total >= amount + fee(picked.length, 2)) break; }
  if (total < amount + fee(picked.length, 1)) throw new Error(`wallet has ${total} sats, needs ${amount + fee(picked.length, 1)}`);
  const toLock = cashAddressToLockingBytecode(to);
  if (typeof toLock === 'string') throw new Error(toLock);
  const outputs = [{ lockingBytecode: toLock.bytecode, valueSatoshis: amount }];
  const change = total - amount - fee(picked.length, 2);
  if (change >= 546n) outputs.push({ lockingBytecode: changeKey.locking, valueSatoshis: change });
  const inputs = picked.map((u) => ({ outpointIndex: u.vout, outpointTransactionHash: hexToBin(u.txid), sequenceNumber: 0xffffffff, unlockingBytecode: new Uint8Array() }));
  const transaction = { version: 2, locktime: 0, inputs, outputs };
  const sourceOutputs = picked.map((u, i) => ({ ...inputs[i], lockingBytecode: u.key.locking, valueSatoshis: BigInt(u.satoshis) }));
  const inputPaths = picked.map((u, i) => [i, u.key.path, u.key.index]);
  return { transaction, sourceOutputs, inputPaths, fee: total - amount - (change >= 546n ? change : 0n) };
}

/** The relay sends JSON; libauth's stringify encodes Uint8Array/bigint in the extended format the wallet parses. */
export const toWire = (o) => JSON.parse(stringify(o));
