// Creates (once) two chipnet XO accounts: player A (creator) and player B (challenger). Mnemonics stay in .secrets.json (git-ignored).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { generateBip39Mnemonic, lockingBytecodeToCashAddress, hexToBin } from '@bitauth/libauth';
import { Engine, XO_SUPPORTED_NETWORKS } from '@xo-cash/engine';
import { p2pkhTemplate } from '@xo-cash/templates';
export const NET = XO_SUPPORTED_NETWORKS.chipnet;
export function secrets() {
  if (!existsSync('.secrets.json')) writeFileSync('.secrets.json', JSON.stringify({ A: generateBip39Mnemonic(), B: generateBip39Mnemonic() }, null, 2));
  return JSON.parse(readFileSync('.secrets.json', 'utf8'));
}
export async function open(name) {
  mkdirSync('data', { recursive: true });
  const engine = await Engine.create(secrets()[name], { network: NET, databasePath: 'data', databaseFilename: `player-${name}.db` });
  const { templateIdentifier } = await engine.importTemplate(p2pkhTemplate);
  await engine.setDefaultPolicies({ change: { templateIdentifier }, receive: { templateIdentifier }, address: { templateIdentifier } });
  return { engine, p2pkhId: templateIdentifier };
}
export async function address(engine) {
  const lb = await engine.generateLockingBytecodeFromDefaultPolicy('receive');
  const r = lockingBytecodeToCashAddress({ bytecode: hexToBin(lb), prefix: 'bchtest' });
  return typeof r === 'string' ? r : r.address;
}
if (process.argv[1].endsWith('wallets.mjs')) {
  const n = process.argv[2] ?? 'A'; const { engine } = await open(n); console.log(n, await address(engine), 'utxos', JSON.stringify((await engine.listSpendableUnspentOutputs().catch((e) => e.message)))?.slice(0, 300)); await engine.stop();
  process.exit(0);
}
