// PassBCH.cash Rock · Paper · Scissors escrow, as an XO template.
//
// Migrated from https://passbch.vercel.app (custodial RPS with an off-chain commit-reveal) to a trustless contract:
//  - openDuel: the creator and the challenger each put their stake into one pot from their own wallets. The pot's
//    locking script holds the creator's commitment sha256(move || salt), the challenger's (open) move, a reveal
//    deadline and both players' payout locking bytecodes.
//  - creatorWins / challengerWins / draw: the creator reveals move + salt. The script checks the commitment, recomputes
//    the winner on chain and only lets the pot go to the winner's payout script (or 50/50 on a draw).
//  - claimTimeout: if the creator never reveals, after the deadline the pot can only go to the challenger.
// The pot needs no signature at all: every spend path fixes where the money goes, so no one can redirect it.
// Moves: 1 = rock, 2 = paper, 3 = scissors. result = (creatorMove - challengerMove + 3) % 3 -> 0 draw, 1 creator, 2 challenger.
export const duelTemplate = {
  $schema: 'https://libauth.org/schemas/wallet-template-v0.schema.json',
  name: 'PassBCH Rock Paper Scissors Escrow',
  description: 'Two players lock equal stakes. The creator commits to a hidden move, the challenger answers in the open, and the contract pays the winner when the creator reveals. If the creator never reveals, the pot goes to the challenger after a deadline.',
  icon: 'duel',
  version: '1',
  supported: ['BCH_2023_05', 'BCH_2024_05', 'BCH_2025_05', 'BCH_2026_05'],
  resources: [{ name: 'PassBCH.cash', description: 'The original custodial game this template moves on chain.', url: 'https://passbch.vercel.app' }],
  roles: {
    creator: { name: 'Creator', description: 'Opens the duel with a hidden move and later reveals it.', icon: 'player' },
    challenger: { name: 'Challenger', description: 'Answers the duel with an open move.', icon: 'player' },
  },
  start: [{ action: 'openDuel', role: 'creator' }],
  actions: {
    openDuel: {
      name: 'Open duel',
      description: 'Both players lock $(<stakeSatoshis>) satoshis each into the duel pot.',
      icon: 'duel',
      roles: {
        creator: {
          name: 'Commit a hidden move',
          description: 'Commit to sha256(move || salt) without revealing the move, and set the stake and deadline.',
          icon: 'player',
          requirements: { variables: ['creatorCommitment', 'stakeSatoshis', 'revealDeadline', 'creatorPayoutLockingBytecode'] },
        },
        challenger: {
          name: 'Answer with a move',
          description: 'Choose rock (1), paper (2) or scissors (3) and where winnings are paid.',
          icon: 'player',
          requirements: { variables: ['challengerMove', 'challengerPayoutLockingBytecode'] },
        },
      },
      requirements: { participants: [{ role: 'creator', slots: { min: 1, max: 1 } }, { role: 'challenger', slots: { min: 1, max: 1 } }] },
      transaction: 'openTransaction',
    },
    creatorWins: {
      name: 'Reveal: creator wins', description: 'Reveal the hidden move; the pot pays the creator.', icon: 'win',
      roles: { creator: { requirements: { variables: ['creatorMove', 'creatorSalt'] } } },
      requirements: { participants: [{ role: 'creator', slots: { min: 1, max: 1 } }] },
      transaction: 'creatorWinsTransaction',
    },
    challengerWins: {
      name: 'Reveal: challenger wins', description: 'Reveal the hidden move; the pot pays the challenger.', icon: 'win',
      roles: { creator: { requirements: { variables: ['creatorMove', 'creatorSalt'] } } },
      requirements: { participants: [{ role: 'creator', slots: { min: 1, max: 1 } }] },
      transaction: 'challengerWinsTransaction',
    },
    draw: {
      name: 'Reveal: draw', description: 'Reveal the hidden move; the pot is split between both players.', icon: 'draw',
      roles: { creator: { requirements: { variables: ['creatorMove', 'creatorSalt'] } } },
      requirements: { participants: [{ role: 'creator', slots: { min: 1, max: 1 } }] },
      transaction: 'drawTransaction',
    },
    claimTimeout: {
      name: 'Claim after timeout', description: 'The creator did not reveal before block $(<revealDeadline>); the pot goes to the challenger.', icon: 'timeout',
      roles: { challenger: {} },
      requirements: { participants: [{ role: 'challenger', slots: { min: 1, max: 1 } }] },
      transaction: 'timeoutTransaction',
    },
  },
  transactions: {
    openTransaction: { name: 'Duel opened', description: 'Both stakes were locked into the duel pot.', icon: 'duel', inputs: [], outputs: [{ output: 'duelOutput', outputIndex: 0 }], version: 2, locktime: 0, composable: true },
    creatorWinsTransaction: { name: 'Creator won', description: 'The creator revealed and won the pot.', icon: 'win', inputs: [{ input: 'revealInput', inputIndex: 0 }], outputs: [{ output: 'creatorPotOutput', outputIndex: 0 }], version: 2, locktime: 0 },
    challengerWinsTransaction: { name: 'Challenger won', description: 'The creator revealed and the challenger won the pot.', icon: 'win', inputs: [{ input: 'revealInput', inputIndex: 0 }], outputs: [{ output: 'challengerPotOutput', outputIndex: 0 }], version: 2, locktime: 0 },
    drawTransaction: { name: 'Draw', description: 'The creator revealed; the pot was split.', icon: 'draw', inputs: [{ input: 'revealInput', inputIndex: 0 }], outputs: [{ output: 'creatorHalfOutput', outputIndex: 0 }, { output: 'challengerHalfOutput', outputIndex: 1 }], version: 2, locktime: 0 },
    timeoutTransaction: { name: 'Timeout claimed', description: 'The pot went to the challenger after the reveal deadline.', icon: 'timeout', inputs: [{ input: 'timeoutInput', inputIndex: 0 }], outputs: [{ output: 'challengerPotOutput', outputIndex: 0 }], version: 2, locktime: '$(<revealDeadline>)' },
  },
  inputs: {
    revealInput: { name: 'Duel pot', description: 'The pot, unlocked by revealing the committed move.', icon: 'duel', valueSatoshis: '$(potSatoshis)', unlockingScript: 'revealUnlock' },
    timeoutInput: { name: 'Duel pot', description: 'The pot, unlocked after the deadline.', icon: 'duel', valueSatoshis: '$(potSatoshis)', unlockingScript: 'timeoutUnlock', sequenceNumber: 0 },
  },
  outputs: {
    duelOutput: { name: 'Duel pot', description: 'Both stakes, locked to the duel rules.', icon: 'duel', lockingScript: 'duelLockingScript', valueSatoshis: '$(potSatoshis)', token: null },
    creatorPotOutput: { name: 'Creator winnings', description: 'The pot, minus the network fee, to the creator.', icon: 'win', lockingScript: '$(<creatorPayoutLockingBytecode>)', valueSatoshis: '$(winnerSatoshis)', token: null },
    challengerPotOutput: { name: 'Challenger winnings', description: 'The pot, minus the network fee, to the challenger.', icon: 'win', lockingScript: '$(<challengerPayoutLockingBytecode>)', valueSatoshis: '$(winnerSatoshis)', token: null },
    creatorHalfOutput: { name: 'Creator half', description: 'Half the pot back to the creator.', icon: 'draw', lockingScript: '$(<creatorPayoutLockingBytecode>)', valueSatoshis: '$(halfSatoshis)', token: null },
    challengerHalfOutput: { name: 'Challenger half', description: 'Half the pot back to the challenger.', icon: 'draw', lockingScript: '$(<challengerPayoutLockingBytecode>)', valueSatoshis: '$(halfSatoshis)', token: null },
  },
  lockingScripts: {
    duelLockingScript: {
      name: 'Duel pot', description: 'Pays the winner after a valid reveal, or the challenger after the deadline.', icon: 'duel',
      lockingType: 'p2sh',
      lockingBytecode: 'duelLockingBytecode',
      state: { variables: ['creatorCommitment', 'stakeSatoshis', 'revealDeadline', 'challengerMove', 'creatorPayoutLockingBytecode', 'challengerPayoutLockingBytecode'] },
      actions: [],
      roles: {
        creator: { actions: [{ action: 'creatorWins', role: 'creator' }, { action: 'challengerWins', role: 'creator' }, { action: 'draw', role: 'creator' }], balance: { satoshis: 0n, fungibleTokens: 0n }, selectable: false },
        challenger: { actions: [{ action: 'claimTimeout', role: 'challenger' }], balance: { satoshis: 0n, fungibleTokens: 0n }, selectable: false },
      },
    },
  },
  scripts: {
    potSatoshis: '<stakeSatoshis> OP_DUP OP_ADD',
    winnerSatoshis: 'potSatoshis <2000> OP_SUB',
    halfSatoshis: '<stakeSatoshis> <1000> OP_SUB',
    // Reveal path. Unlocking stack: move, salt (the path selector on top was consumed by OP_IF).
    checkCommitment: 'OP_OVER OP_SWAP OP_CAT OP_SHA256 <creatorCommitment> OP_EQUALVERIFY',
    checkMoves: 'OP_DUP OP_1 OP_4 OP_WITHIN OP_VERIFY <challengerMove> OP_1 OP_4 OP_WITHIN OP_VERIFY',
    computeResult: '<challengerMove> OP_SUB OP_3 OP_ADD OP_3 OP_MOD',
    payDraw: 'OP_DROP OP_0 OP_OUTPUTBYTECODE <creatorPayoutLockingBytecode> OP_EQUALVERIFY OP_1 OP_OUTPUTBYTECODE <challengerPayoutLockingBytecode> OP_EQUALVERIFY OP_0 OP_OUTPUTVALUE OP_INPUTINDEX OP_UTXOVALUE OP_2 OP_DIV <1000> OP_SUB OP_GREATERTHANOREQUAL OP_VERIFY OP_1 OP_OUTPUTVALUE OP_INPUTINDEX OP_UTXOVALUE OP_2 OP_DIV <1000> OP_SUB OP_GREATERTHANOREQUAL',
    payWinner: 'OP_1 OP_NUMEQUAL OP_IF <creatorPayoutLockingBytecode> OP_ELSE <challengerPayoutLockingBytecode> OP_ENDIF OP_0 OP_OUTPUTBYTECODE OP_EQUALVERIFY OP_0 OP_OUTPUTVALUE OP_INPUTINDEX OP_UTXOVALUE <2000> OP_SUB OP_GREATERTHANOREQUAL',
    revealPath: 'checkCommitment checkMoves computeResult OP_DUP OP_0 OP_NUMEQUAL OP_IF payDraw OP_ELSE payWinner OP_ENDIF',
    timeoutPath: '<revealDeadline> OP_CHECKLOCKTIMEVERIFY OP_DROP OP_0 OP_OUTPUTBYTECODE <challengerPayoutLockingBytecode> OP_EQUALVERIFY OP_0 OP_OUTPUTVALUE OP_INPUTINDEX OP_UTXOVALUE <2000> OP_SUB OP_GREATERTHANOREQUAL',
    duelLockingBytecode: 'OP_IF revealPath OP_ELSE timeoutPath OP_ENDIF',
    revealUnlock: '<creatorMove> <creatorSalt> OP_1',
    timeoutUnlock: 'OP_0',
  },
  variables: {
    creatorCommitment: { name: 'Hidden move commitment', description: 'sha256(move || salt), where move is one byte: 1 rock, 2 paper, 3 scissors.', type: 'bytes' },
    creatorMove: { name: 'Creator move', description: 'The revealed move: 1 rock, 2 paper, 3 scissors.', type: 'integer' },
    creatorSalt: { name: 'Creator salt', description: 'The random salt used in the commitment.', type: 'bytes' },
    challengerMove: { name: 'Challenger move', description: '1 rock, 2 paper, 3 scissors.', type: 'integer' },
    stakeSatoshis: { name: 'Stake', description: 'Satoshis each player puts into the pot.', type: 'satoshis' },
    revealDeadline: { name: 'Reveal deadline', description: 'Block height after which the pot goes to the challenger.', type: 'integer' },
    creatorPayoutLockingBytecode: { name: 'Creator payout', description: 'Where the creator is paid.', type: 'locking_script' },
    challengerPayoutLockingBytecode: { name: 'Challenger payout', description: 'Where the challenger is paid.', type: 'locking_script' },
  },
  icons: ['duel', 'player', 'win', 'draw', 'timeout'].map((name) => ({ name, hash: '0000000000000000000000' })),
};
export default duelTemplate;
