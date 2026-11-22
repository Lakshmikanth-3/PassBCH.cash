import { open } from './wallets.mjs';
import duelTemplate from './passbch-duel.template.mjs';
const { engine } = await open(process.argv[2] ?? 'A');
try { const r = await engine.importTemplate(duelTemplate); console.log('imported', r.templateIdentifier); } catch (e) { console.log('IMPORT ERROR', e.name, e.message, JSON.stringify(e.issues ?? e.cause ?? '', null, 1)?.slice(0, 2500)); }
await engine.stop(); process.exit(0);
