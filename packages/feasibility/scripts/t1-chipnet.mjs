// T1 on chipnet. Stages: addr | ticket | start | refund-ticket | refund
// State in ../../keys/t1-state.json (gitignored). Keys are throwaway chipnet keys in ../../keys/t1-keys.json.
import fs from 'node:fs';
import { compileFile } from 'cashc';
import { Contract, ElectrumNetworkProvider, SignatureTemplate, TransactionBuilder } from 'cashscript';
import { secp256k1, binToHex, hexToBin, hash160, encodeCashAddress, CashAddressType } from '@bitauth/libauth';
import { encodePayload, toOpReturn } from '@passrate/shared';

const KF = '../../keys/t1-keys.json', SF = '../../keys/t1-state.json';
const rnd = () => crypto.getRandomValues(new Uint8Array(32));
if (!fs.existsSync(KF)) fs.writeFileSync(KF, JSON.stringify({ op: binToHex(rnd()), payer: binToHex(rnd()) }));
const k = JSON.parse(fs.readFileSync(KF, 'utf8'));
const st = fs.existsSync(SF) ? JSON.parse(fs.readFileSync(SF, 'utf8')) : {};
const save = () => fs.writeFileSync(SF, JSON.stringify(st, null, 1));
const op = hexToBin(k.op), payer = hexToBin(k.payer);
const opPk = secp256k1.derivePublicKeyCompressed(op), payerPk = secp256k1.derivePublicKeyCompressed(payer);
const provider = new ElectrumNetworkProvider('chipnet');
const addrOf = (pk) => encodeCashAddress({ prefix: 'bchtest', type: CashAddressType.p2pkh, payload: hash160(pk) }).address;
const wallet = addrOf(opPk);
const root = 'ab'.repeat(32);
const art = compileFile('contracts/RunTicket.cash');
const contract = (payerHex) => new Contract(art, [binToHex(opPk), payerHex, root], { provider });
const opSig = new SignatureTemplate(op);
const stage = process.argv[2] ?? 'addr';

async function makeTicket(tag) {
  const c = contract(binToHex(payerPk));
  const utxos = (await provider.getUtxos(wallet)).filter((u) => !u.token).sort((a, b) => Number(b.satoshis - a.satoshis));
  if (!utxos.length) throw new Error('wallet has no coins: fund ' + wallet);
  const u = utxos[0];
  const tip = await provider.getBlockHeight();
  const rec = toOpReturn(encodePayload('T', { tipHeight: tip, tipHash: 'cc'.repeat(32), agentIdx: 0, payerPk: binToHex(payerPk) }));
  const tx = await new TransactionBuilder({ provider }).addInput(u, opSig.unlockP2PKH())
    .addOutput({ to: rec, amount: 0n }).addOutput({ to: c.address, amount: 20000n })
    .addOutput({ to: wallet, amount: u.satoshis - 20000n - 700n }).send();
  st[tag] = { txid: tx.txid, vout: 1, addr: c.address, height: tip }; save();
  console.log(tag, 'ticket txid', tx.txid, 'covenant', c.address);
}
async function ticketUtxo(tag) {
  const t = st[tag]; const c = contract(binToHex(payerPk));
  const u = (await provider.getUtxos(c.address)).find((x) => x.txid === t.txid && x.vout === t.vout);
  if (!u) throw new Error('ticket utxo not found / already spent');
  return { c, u };
}

if (stage === 'addr') console.log('Fund this chipnet address:', wallet);
else if (stage === 'ticket') await makeTicket('startTicket');
else if (stage === 'start') {
  const { c, u } = await ticketUtxo('startTicket');
  const rec = toOpReturn(encodePayload('S', { mode: 0, ref: u.txid, refHeight: st.startTicket.height, taskRoot: root, taskIdx: 5, agentIdx: 0, modelIdx: 0, lane: 0, harnessDigest: 'cd'.repeat(32), deadlineUnix: Math.floor(Date.now() / 1000) + 600, attemptPolicy: 0 }));
  const tx = await new TransactionBuilder({ provider }).addInput(u, c.unlock.start(opSig))
    .addOutput({ to: rec, amount: 0n }).addOutput({ to: wallet, amount: u.satoshis - 600n }).send();
  console.log('START broadcast OK', tx.txid);
} else if (stage === 'refund-ticket') await makeTicket('refundTicket');
else if (stage === 'refund') {
  const { c, u } = await ticketUtxo('refundTicket');
  const tx = await new TransactionBuilder({ provider }).addInput(u, c.unlock.refund(new SignatureTemplate(payer)), { sequence: 6 })
    .addOutput({ to: addrOf(payerPk), amount: u.satoshis - 500n }).send();
  console.log('REFUND broadcast OK', tx.txid);
}
