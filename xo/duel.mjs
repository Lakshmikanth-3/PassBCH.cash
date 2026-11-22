// Run a real PassBCH escrow duel on chipnet with two XO accounts (one process per step, invitations passed as files):
//   node duel.mjs open        player A (creator): commits to a hidden move, adds stake input + own change
//   node duel.mjs join        player B (challenger): answers with a move, adds stake input + own change + the pot, signs
//   node duel.mjs execute     player A: merges B's commits, signs, broadcasts the open transaction
//   node duel.mjs reveal      player A: reveals move + salt; the contract pays the winner (follow-up action)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { hexToBin, binToHex } from '@bitauth/libauth';
import { serializeInvitation, deserializeInvitation } from '@xo-cash/utils';
import { open } from './wallets.mjs';
import duelTemplate from './passbch-duel.template.mjs';

const STAKE = 10000n, FEE_SHARE = 700n, MOVES = { 1: 'rock', 2: 'paper', 3: 'scissors' };
const RUN = process.env.RUN ?? 'run'; mkdirSync(RUN, { recursive: true });
const save = (f, inv) => writeFileSync(`${RUN}/${f}`, serializeInvitation(inv));
const load = (f) => deserializeInvitation(readFileSync(`${RUN}/${f}`, 'utf8'));
const log = (...a) => console.log(...a);
const step = process.argv[2];
// The pot's state (commitment, stake, deadline, moves, payout scripts) as committed in the open invitation; a follow-up
// spend needs it to rebuild the pot's locking script.
const stateVars = (role = 'creator') => {
  const inv = load('3-open-final.txt'); const keep = ['creatorCommitment', 'stakeSatoshis', 'revealDeadline', 'challengerMove', 'creatorPayoutLockingBytecode', 'challengerPayoutLockingBytecode'];
  const out = []; for (const c of inv.commits) for (const v of c.data?.variables ?? []) if (keep.includes(v.variableIdentifier) && !out.some((o) => o.variableIdentifier === v.variableIdentifier)) out.push({ variableIdentifier: v.variableIdentifier, value: v.value, roleIdentifier: role });
  return out;
};
const player = step === 'join' || step === 'timeout' ? 'B' : 'A';
const { engine } = await open(player);
const { templateIdentifier } = await engine.importTemplate(duelTemplate);
const show = async (id) => { const m = await engine.listMissingRequirements(id); log('missing:', JSON.stringify(m, (k, v) => (typeof v === 'bigint' ? v.toString() : v))); return m; };
const pickUtxo = async () => (await engine.listSpendableUnspentOutputs()).filter((u) => BigInt(u.valueSatoshis ?? u.satoshis ?? 0) >= STAKE + 2000n).sort((a, b) => Number(BigInt(b.valueSatoshis) - BigInt(a.valueSatoshis)))[0];
const changeOut = async (utxo) => ({ lockingBytecode: hexToBin(await engine.generateLockingBytecodeFromDefaultPolicy('change')), valueSatoshis: BigInt(utxo.valueSatoshis) - STAKE - FEE_SHARE });

try {
  if (step === 'open') {
    for (const i of await engine.listInvitations()) await engine.archiveInvitation(i.invitation.invitationIdentifier).catch(() => {});
    const status = await engine.getChainStatus(); log('chain status', JSON.stringify(status, (k, v) => (typeof v === 'bigint' ? v.toString() : v)).slice(0, 300));
    const height = Number(process.env.HEIGHT ?? status.currentHeight ?? status.height ?? status.blockHeight ?? status.tipHeight ?? status.chainTip?.height ?? status.tip?.height);
    if (!(height > 300000)) throw new Error('could not read the chain height');
    const move = Number(process.env.MOVE ?? 2), salt = randomBytes(16);
    const commitment = createHash('sha256').update(Buffer.concat([Buffer.from([move]), salt])).digest('hex');
    writeFileSync(`${RUN}/creator-secret.json`, JSON.stringify({ move, salt: salt.toString('hex'), commitment, height }));
    const utxo = await pickUtxo(); if (!utxo) throw new Error('player A has no spendable coin');
    const created = await engine.createInvitation({
      templateIdentifier, actionIdentifier: 'openDuel', roleIdentifier: 'creator',
      variables: [
        { variableIdentifier: 'creatorCommitment', roleIdentifier: 'creator', value: commitment },
        { variableIdentifier: 'stakeSatoshis', roleIdentifier: 'creator', value: STAKE },
        { variableIdentifier: 'revealDeadline', roleIdentifier: 'creator', value: BigInt(height + 3) },
        { variableIdentifier: 'creatorPayoutLockingBytecode', roleIdentifier: 'creator', value: await engine.generateLockingBytecodeFromDefaultPolicy('receive') },
      ],
      inputs: [{ outpointTransactionHash: hexToBin(utxo.outpointTransactionHash), outpointIndex: utxo.outpointIndex }],
      outputs: [await changeOut(utxo)],
    });
    const id = created.invitation.invitationIdentifier; log('invitation', id, 'chain height', height, 'A stakes', STAKE, 'with a hidden move');
    await show(id); save('1-open.txt', (await engine.getInvitation(id)).invitation);
  }
  if (step === 'join') {
    const inv = load('1-open.txt');
    const accepted = await engine.acceptInvitation(inv, { roleIdentifier: 'challenger' });
    const id = accepted.invitation.invitationIdentifier;
    const utxo = await pickUtxo(); if (!utxo) throw new Error('player B has no spendable coin');
    await engine.appendInvitation(id, { templateIdentifier, actionIdentifier: 'openDuel', roleIdentifier: 'challenger', variables: [{ variableIdentifier: 'challengerMove', roleIdentifier: 'challenger', value: 1n }, { variableIdentifier: 'challengerPayoutLockingBytecode', roleIdentifier: 'challenger', value: await engine.generateLockingBytecodeFromDefaultPolicy('receive') }] });
    await engine.appendInvitation(id, {
      templateIdentifier, actionIdentifier: 'openDuel', roleIdentifier: 'challenger',
      inputs: [{ outpointTransactionHash: hexToBin(utxo.outpointTransactionHash), outpointIndex: utxo.outpointIndex }],
      outputs: [await changeOut(utxo), { outputIdentifier: 'duelOutput' }],
    });
    log('B answered: rock, staked', STAKE);
    const m = await show(id);
    for (const i of await engine.listOwnInputIndexes(id)) { await engine.signInvitation(id, i); log('B signed input', i); }
    save('2-join.txt', (await engine.getInvitation(id)).invitation);
  }
  if (step === 'execute') {
    const inv = load('2-join.txt');
    const st = await engine.updateInvitation(inv); const id = st.invitation.invitationIdentifier;
    for (const i of await engine.listOwnInputIndexes(id)) { await engine.signInvitation(id, i); log('A signed input', i); }
    await show(id);
    const r = await engine.executeAction(id, { broadcastTransaction: true });
    log('OPEN TX', r.builtTransaction.transactionHash, 'fee est', r.builtTransaction.estimatedFeeSatoshis);
    save('3-open-final.txt', r.storedInvitation.invitation);
    writeFileSync(`${RUN}/open-tx.txt`, r.builtTransaction.transactionHash);
  }
  if (step === 'reveal') {
    const sec = JSON.parse(readFileSync(`${RUN}/creator-secret.json`, 'utf8'));
    const openTx = readFileSync(`${RUN}/open-tx.txt`, 'utf8').trim();
    const result = (sec.move - 1 + 3) % 3; // challenger played rock (1)
    const action = result === 0 ? 'draw' : result === 1 ? 'creatorWins' : 'challengerWins';
    const outputs = action === 'draw' ? [{ outputIdentifier: 'creatorHalfOutput' }, { outputIdentifier: 'challengerHalfOutput' }] : [{ outputIdentifier: action === 'creatorWins' ? 'creatorPotOutput' : 'challengerPotOutput' }];
    for (const i of await engine.listInvitations()) if (i.invitation.actionIdentifier !== 'openDuel') await engine.archiveInvitation(i.invitation.invitationIdentifier).catch(() => {});
    log(`A reveals ${MOVES[sec.move]} vs rock -> ${action}`);
    const created = await engine.createInvitation({
      templateIdentifier, actionIdentifier: action, roleIdentifier: 'creator',
      variables: [...stateVars(), { variableIdentifier: 'creatorMove', roleIdentifier: 'creator', value: BigInt(sec.move) }, { variableIdentifier: 'creatorSalt', roleIdentifier: 'creator', value: sec.salt }],
      inputs: [{ inputIdentifier: 'revealInput', outpointTransactionHash: hexToBin(openTx), outpointIndex: 0 }],
      outputs,
    });
    const id = created.invitation.invitationIdentifier;
    await show(id);
    for (const i of await engine.listOwnInputIndexes(id)) { await engine.signInvitation(id, i); log('A completed input', i); }
    const r = await engine.executeAction(id, { broadcastTransaction: true });
    log('REVEAL TX', r.builtTransaction.transactionHash);
    save('4-reveal-final.txt', r.storedInvitation.invitation);
    writeFileSync(`${RUN}/reveal-tx.txt`, r.builtTransaction.transactionHash);
  }
  if (step === 'timeout') {
    const openTx = readFileSync(`${RUN}/open-tx.txt`, 'utf8').trim();
    for (const i of await engine.listInvitations()) if (i.invitation.actionIdentifier !== 'openDuel') await engine.archiveInvitation(i.invitation.invitationIdentifier).catch(() => {});
    const vars = stateVars('challenger'); const deadline = Number(vars.find((v) => v.variableIdentifier === 'revealDeadline').value);
    const { currentHeight } = await engine.getChainStatus(); log('deadline', deadline, 'chain height', currentHeight);
    if (currentHeight < deadline) throw new Error(`too early: wait until block ${deadline}`);
    const created = await engine.createInvitation({
      templateIdentifier, actionIdentifier: 'claimTimeout', roleIdentifier: 'challenger', transactionLocktime: deadline,
      variables: vars, inputs: [{ inputIdentifier: 'timeoutInput', outpointTransactionHash: hexToBin(openTx), outpointIndex: 0, sequenceNumber: 0 }],
      outputs: [{ outputIdentifier: 'challengerPotOutput' }],
    });
    const id = created.invitation.invitationIdentifier; await show(id);
    for (const i of await engine.listOwnInputIndexes(id)) { await engine.signInvitation(id, i); log('B completed input', i); }
    if (process.env.DRY) {
      const bt = await engine.buildInvitationTransactionFromMergedCommit(id); writeFileSync(`${RUN}/timeout-dry.hex`, bt.serializedTransaction); log('built (not sent)', bt.transactionHash); throw new Error('dry run');
    }
    const r = await engine.executeAction(id, { broadcastTransaction: true });
    log('TIMEOUT TX', r.builtTransaction.transactionHash);
    save('4-timeout-final.txt', r.storedInvitation.invitation); writeFileSync(`${RUN}/timeout-tx.txt`, r.builtTransaction.transactionHash);
  }
} catch (e) {
  console.log('ERROR', e.name, e.message);
  if (e.issues) console.log(JSON.stringify(e.issues, null, 1).slice(0, 3000));
}
await engine.stop(); process.exit(0);
