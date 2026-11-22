# Feedback on the XO developer experience

*A technical review from building the PassBCH Rock · Paper · Scissors escrow template on chipnet (BCH BLAZE 2026). Drafted with AI assistance from our build log and checked by the team; every point below happened during the build.*

## What we built
We migrated PassBCH.cash's custodial Rock · Paper · Scissors into a keyless XO template: both stakes go into one P2SH32 pot, the creator commits `sha256(move ‖ salt)`, and the pot's script checks the reveal, computes `(A − B + 3) mod 3` and only lets the pot pay the winner (50/50 on a draw), with a CLTV timeout to the challenger. Two engine accounts ran `openDuel` and the `creatorWins` follow-up on chipnet, and the XO debug tool's **Inspect** stepped the reveal transaction to SUCCESS.

## What worked well
- **Invitations are the right primitive.** `serializeInvitation` / `deserializeInvitation` made a two-party, two-machine flow trivial: each step is a file handed to the other player. This is the strongest part of XO.
- **`listMissingRequirements`** turned "why won't this build" into a checklist. After every append we printed it, and it always pointed at the next variable, input or output to add.
- **CashASM composition.** Building `revealPath` from small named scripts (`checkCommitment`, `checkMoves`, `computeResult`, `payWinner`, `payDraw`) kept a non-trivial contract readable and reviewable.
- **The debug tool.** Importing the template JSON and inspecting a real chipnet transaction with step-by-step VM state is excellent for proving a contract works. Judges can verify our claim in a minute.
- **Reference templates.** Wrapped-cash and multisig were the most useful examples for roles, state variables and follow-up actions.

## Friction, with suggestions
1. **Versions and install.** The getting-started guide pins `0.1.1-next.18029697917`, the bounty page says "latest `0.1.0-next.xxx`", and npm's `next` tag was `0.1.1-next.18230317763`. `npm install @xo-cash/state@next` fails with `notarget` because only `engine` has a `next` tag. *Suggestion:* one pinned, tested set of versions in the docs, and the same dist-tags on every package.
2. **One `Engine` per process.** A second instance fails with "Cannot configure storage for cache after it has been initialized." Testing a two-player action therefore needs one process per player. *Suggestion:* allow isolated instances (separate storage namespaces), or document it prominently.
3. **Validation messages.** `balance: { satoshis: false }` returned only "Invalid input", with no hint that a bigint (`0n`) was expected. Template constants could not be referenced inside `scripts` (`Unknown identifier "halfFee"`), so fee limits became literals. *Suggestion:* show the path and expected type in validation errors, and resolve constants in scripts or say clearly that they aren't supported there.
4. **Key resolution ordering.** `appendOwnOutputResolutions` for a locking script using both players' keys failed until every other variable was present ("no public or private keys for creatorKey were provided"). That chicken-and-egg pushed us to a keyless design (payout locking bytecodes instead of keys). It's a good design, but it was forced. *Suggestion:* partial resolution, or an error that names the missing dependency.
5. **Follow-up actions and state.** The `creatorWins` follow-up failed with "Missing required variable: stakeSatoshis" until we passed the pot's state variables again, although they are declared in `lockingScripts.duelLockingScript.state.variables`. *Suggestion:* restore declared state from the spent output's originating invitation automatically.
6. **Reserved inputs after failures.** A failed invitation kept its UTXO reserved (`UnspentOutputReservationExternalConflictError`) until we archived old invitations. *Suggestion:* release reservations on failure, or say "archive invitation X" in the error.
7. **Broadcast errors.** The engine reports only "rejected by network rules". The node's real reason (`bad-txns-nonfinal` for our CLTV timeout) was visible only by broadcasting the same hex through another Electrum client. *Suggestion:* pass the node's reject reason through.
8. **Chain status.** `getChainStatus()` returns `currentHeight`, `verifiedHeight` and `verifiedPercent`, but this isn't documented, and the log printed many "header … ahead of the current checkpoint" warnings while syncing.

## Overall
XO's model of templates, roles, invitations and follow-up actions fits real multi-party BCH apps well: we got a trustless game escrow running on chipnet in about a day. Most of the time we lost went on version mismatches, terse errors and state that had to be passed again by hand, not on the model itself. Clearer errors and documented engine behaviour would make XO much easier for new teams.
