import { readFileSync } from 'node:fs';
import { hexToBin, binToHex, decodeTransaction, createVirtualMachineBch, stringify } from '@bitauth/libauth';
const tx = decodeTransaction(hexToBin(readFileSync(process.argv[2], 'utf8').trim()));
console.log('locktime', tx.locktime, 'sequence', tx.inputs.map((i) => i.sequenceNumber), 'outputs', tx.outputs.map((o) => Number(o.valueSatoshis)));
const parentHex = process.argv[3]; const parent = decodeTransaction(hexToBin(parentHex));
const sourceOutputs = tx.inputs.map((i) => parent.outputs[i.outpointIndex]);
const vm = createVirtualMachineBch(true);
const r = vm.verify({ sourceOutputs, transaction: tx });
console.log('VM verify:', r === true ? 'OK' : r);
