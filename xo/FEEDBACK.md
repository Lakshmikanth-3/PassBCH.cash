# Feedback on the XO developer experience

> **Write this section yourself (about 500 words).** The bounty rejects AI-written feedback. Use your own experience and words; the facts list below is only a reminder of what happened while building this template. Delete the facts list before submitting.

_(your feedback here)_

---

## Facts from building this template (reminder only — delete before submitting)

- Packages used: `@xo-cash/engine@0.1.1-next.18230317763`, `@xo-cash/templates@0.0.12`, `@xo-cash/utils@0.0.12`, `@xo-cash/types@0.0.9`. The getting-started guide pins `0.1.1-next.18029697917`; the bounty page says "latest `0.1.0-next.xxx`"; npm's `next` tag was `0.1.1-next.18230317763`. `npm install @xo-cash/state@next` failed (`notarget`): only `engine` has a `next` tag.
- Two `Engine` instances in one Node process fail: "Cannot configure storage for cache after it has been initialized." Testing a two-player action therefore needs one process per player (invitations passed as files).
- `importTemplate` validation: `balance: { satoshis: false }` → "Invalid input" without saying a bigint (`0n`) is expected.
- Template constants could not be referenced inside `scripts` (`Unknown identifier "halfFee"`), so the fee limits were written as numbers.
- `appendOwnOutputResolutions` for a locking script that uses both players' keys failed until every other variable was present ("no public or private keys for creatorKey were provided"). This chicken-and-egg led to a keyless design: each player gives a payout locking script instead of a key.
- The follow-up action (`creatorWins`) failed with "Missing required variable: stakeSatoshis" until the pot's state variables were passed again in the new invitation, although they are listed in `lockingScripts.duelLockingScript.state.variables`.
- A failed invitation keeps its input reserved (`UnspentOutputReservationExternalConflictError`); archiving old invitations fixed it.
- `getChainStatus()` returns `currentHeight`, `verifiedHeight`, `verifiedPercent`. The log printed many "header … ahead of the current checkpoint" warnings while syncing.
- Broadcast errors from the engine say only "rejected by network rules"; the node's reason (`bad-txns-nonfinal`) was only visible by broadcasting the same hex through another client.
- Things that worked well: `listMissingRequirements` made each step obvious; `serializeInvitation`/`deserializeInvitation` made the two-player flow easy; the debug tool imported the template, and **Inspect** stepped the reveal transaction's redeem script on chipnet (SUCCESS); CashASM composition (`revealPath` built from smaller named scripts) kept the contract readable; the wrapped-cash and multisig templates were the most useful references.
