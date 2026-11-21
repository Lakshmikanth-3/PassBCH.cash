# Satoshi Duel ✊✋✌️

**Rock-paper-scissors for real Bitcoin Cash.** Get free sats, challenge a friend with a link (or the House Bot), and every finished duel is written to the BCH chain.

▶ **Play:** https://passrate-cash.vercel.app &nbsp;·&nbsp; ⌨️ **Terminal:** `irm https://passrate-cash.vercel.app/play.ps1 | iex` (PowerShell) or `curl -fsSL https://passrate-cash.vercel.app/play.sh | sh`

Built from scratch for **BCH BLAZE 2026** (Mainnet Track). Network: **chipnet** while testing; mainnet at final submission.

---

## 1 minute: what it is
1. Pick a name → **10,000 free sats** (20,000 if a friend invited you).
2. Pick ✊ ✋ or ✌️ and a stake → **play the House Bot** or **send a challenge link** to a friend.
3. Win the pot. Watch the **live leaderboard**: who played whom, who won, how much, with a link to each on-chain record.
4. Deposit with **WizardConnect** (one approval in your wallet) or any wallet by QR. Withdraw winnings any time (5% platform fee).

## 5 minutes: why it's fair
| Risk | How it's handled |
|---|---|
| Opponent sees your move | You send only `sha256(move:salt)`. The salt never leaves your device until you reveal. |
| You change your move after seeing theirs | The reveal must match the commitment, or it's rejected. |
| Creator refuses to reveal when losing | 2-minute reveal deadline → the opponent wins. |
| The bot cheats | Its move is fixed by a secret seed per duel before you reveal (`botSeedCommit` is stored with the duel). |
| Hidden results | Every settled duel is an `OP_RETURN` record (`SDL1` + duel id + result + stake + both moves + commitment) on BCH. |
| Bonus farming | 100 bonuses platform-wide, 3 per network address; bonus is play-only and becomes withdrawable only by winning. |
| Double withdrawal | Each withdrawal's txid is saved before broadcast; a slow broadcast is never refunded. |

**Trust model (honest):** balances are custodial — the platform holds the pot, like a card room. The chain is the public scoreboard and payment rail, not an escrow.

## 30 minutes: how it's built
| Part | File |
|---|---|
| Game rules (pure, tested) | [duel/lib/engine.mjs](duel/lib/engine.mjs) |
| Balances, duels, referrals in Postgres transactions | [duel/lib/service.mjs](duel/lib/service.mjs), [duel/lib/db.mjs](duel/lib/db.mjs) |
| House wallet: on-chain records + withdrawals | [duel/lib/chain.mjs](duel/lib/chain.mjs) |
| API (one Vercel function) | [api/duel.mjs](api/duel.mjs) |
| Web app (React) | [packages/web/src/App.jsx](packages/web/src/App.jsx), [packages/web/src/duel/](packages/web/src/duel/) |
| WizardConnect deposit | [packages/web/src/duel/wizard.js](packages/web/src/duel/wizard.js), [WalletConnect.jsx](packages/web/src/duel/WalletConnect.jsx) |
| Terminal client (zero dependencies) | [packages/web/public/duel.mjs](packages/web/public/duel.mjs) |

Stack: Vite + React, Vercel serverless, Neon Postgres, CashScript `TransactionBuilder` + libauth, Electrum (Fulcrum) servers, WizardConnect (`@wizardconnect/react`).

## 1 hour: run and test it
```bash
npm ci
npx vitest run duel/test                 # 14 game-rule tests
npm test -w @passrate/web                # 33 web tests (incl. 6 WizardConnect deposit tests)
# full flow against a live API + chipnet (signup, referral, bot + friend duel, cheat attempt, on-chain record, withdrawal):
BASE=https://passrate-cash.vercel.app node duel/scripts-e2e.mjs
```
Local API: set `DATABASE_URL`, `HOUSE_SK`, `HOUSE_SECRET`, then `node duel/dev-server.mjs`.

## Proof (chipnet)
| What | Transaction |
|---|---|
| Friend duel recorded on chain | [0654235d…6fc54](https://chipnet.imaginary.cash/tx/0654235de2ff2ca8e1f06a6dd0af7989ed18f045b422386d68d9bdd2bdb6fc54) |
| Withdrawal (5,000 → 4,600 after fee) | [c5a7bb4b…fb0ee](https://chipnet.imaginary.cash/tx/c5a7bb4bee94602b575a288ee73ddc71a004e18df3186ebfdd27b7ecfb5fb0ee) |
| Terminal bot duel record | [d369ace9…9254d](https://chipnet.imaginary.cash/tx/d369ace9ba9bc416b71834cbdca888fbbb234b9233c7c45310f1d18287f9254d) |

## Business
Revenue = 5% fee on withdrawals. Bonuses are the marketing budget (capped). Next: tournaments, streamer challenge links, Telegram bot, PUSD stakes.

## Eligibility (BLAZE)
- Deck: _link pending_ · Repo: this repo · EMBER2026: `bitcoincash:zrcvv9gjvgeeh6gesa2t3q0z40n3uzxwhua3m6rsyf`
- No pre-hackathon code: first commit 17 Nov 2026. An earlier BLAZE experiment in this repo (PassRate.cash, on-chain AI exams) is kept in [docs/passrate/](docs/passrate/) and `packages/`.
- Wallet connection: WizardConnect.
