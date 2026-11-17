import { describe, test, expect } from 'vitest';
import { hexToBin, decodeTransaction, hashTransaction } from '@bitauth/libauth';
import { MockNetworkProvider, randomUtxo, DEPOSIT_SATS, buildTicket } from '@passrate/shared/tickettx';
import { fromOpReturn, encodePayload, toOpReturn } from '@passrate/shared';
import * as S from '../src/chain/session.js';
import { CONFIG } from '../src/config.js';

const fixedRandom = (b) => () => new Uint8Array(32).fill(b);
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

describe('session', () => {
  test('new session holds a valid key and chipnet deposit address', () => {
    const s = S.newSession({ agentIdx: 1, random: fixedRandom(7) });
    const k = S.keyFromHex(s.skHex);
    expect(k.address).toMatch(/^bchtest:q/);
    expect(k.pkHex).toMatch(/^0[23][0-9a-f]{64}$/);
    expect(s.stage).toBe('deposit');
  });
  test('rejects an invalid private key (all zero) by drawing again', () => {
    let n = 0; const rnd = () => (n++ === 0 ? new Uint8Array(32) : new Uint8Array(32).fill(9));
    expect(S.newSession({ agentIdx: 0, random: rnd }).skHex).toBe('09'.repeat(32));
  });
  test('deposit URI is BIP21 with the exact deposit amount', () => {
    expect(S.depositUri('bchtest:qabc')).toBe('bchtest:qabc?amount=0.00021346&message=PassRate%20ticket');
    expect(DEPOSIT_SATS).toBe(21346n);
  });
  test('save / load / clear round trip and survive blocked storage', () => {
    const st = mem(); const s = S.newSession({ agentIdx: 0, random: fixedRandom(3) });
    S.save(st, s); expect(S.load(st)).toEqual(s);
    S.clear(st); expect(S.load(st)).toBeNull();
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(() => S.save(broken, s)).not.toThrow();
    expect(S.load(broken)).toBeNull();
  });
  test('refund countdown', () => {
    expect(S.refundBlocksLeft(0, 100)).toBeNull();
    expect(S.refundBlocksLeft(100, 100)).toBe(5);
    expect(S.refundBlocksLeft(100, 105)).toBe(0);
    expect(S.refundBlocksLeft(100, 200)).toBe(0);
  });
});

describe('ticket from a deposit (shared builder)', () => {
  const s = S.newSession({ agentIdx: 1, random: fixedRandom(5) });
  const key = S.keyFromHex(s.skHex);
  const ROOT = 'ab'.repeat(32), TIP = 'cd'.repeat(32);
  const build = (sats) => buildTicket({ provider: new MockNetworkProvider(), utxos: [randomUtxo({ satoshis: sats })], payer: key,
    operatorPkHex: CONFIG.operator.pkHex, operatorInbox: CONFIG.operator.inbox, taskRoot: ROOT, tipHeight: 10, tipHash: TIP, agentIdx: 1 });
  test('exact deposit: no change output, payerPk = session key', () => {
    const tx = decodeTransaction(hexToBin(build(DEPOSIT_SATS).builder.build()));
    expect(tx.outputs).toHaveLength(3);
    const r = fromOpReturn(tx.outputs[0].lockingBytecode);
    expect(r.payerPk).toBe(key.pkHex); expect(r.agentIdx).toBe(1);
  });
  test('overpayment returns change to the deposit key', () => {
    expect(decodeTransaction(hexToBin(build(DEPOSIT_SATS + 5000n).builder.build())).outputs).toHaveLength(4);
  });
  test('underpayment is refused before anything is signed', () => {
    expect(() => build(DEPOSIT_SATS - 1n)).toThrow(/need/);
  });
});

describe('finding START and RESULT from chain history', () => {
  const ticket = { txid: 'aa'.repeat(32), covenantAddress: 'bchtest:pcov' };
  const startHex = (ref) =>
    toOpReturn(encodePayload('S', { mode: 0, ref, refHeight: 1, taskRoot: 'ab'.repeat(32), taskIdx: 4, agentIdx: 1, modelIdx: 1, lane: 0, harnessDigest: 'cd'.repeat(32), deadlineUnix: 2e9, attemptPolicy: 2 }));
  test('START script names the ticket (what findStart matches on)', () => {
    expect(fromOpReturn(startHex(ticket.txid)).ref).toBe(ticket.txid);
  });
  test('findStart returns null while the ticket is unspent', async () => {
    const provider = { performRequest: async () => [{ tx_hash: ticket.txid }], getRawTransaction: async () => { throw new Error('unused'); } };
    expect(await S.findStart(provider, ticket)).toBeNull();
  });
  test('findStart flags a non-START spend as a refund', async () => {
    const k = S.keyFromHex('22'.repeat(32));
    const { builder } = buildTicket({ provider: new MockNetworkProvider(), utxos: [randomUtxo({ satoshis: DEPOSIT_SATS })], payer: k,
      operatorPkHex: CONFIG.operator.pkHex, operatorInbox: CONFIG.operator.inbox, taskRoot: 'ab'.repeat(32), tipHeight: 1, tipHash: 'cd'.repeat(32), agentIdx: 0 });
    const hex = builder.build();
    const other = hashTransaction(hexToBin(hex));
    const provider = { performRequest: async () => [{ tx_hash: ticket.txid }, { tx_hash: other }], getRawTransaction: async () => hex };
    expect(await S.findStart(provider, ticket)).toEqual({ txid: other, refund: true });
  });
});
