# Satoshi Duel ✊✋✌️📈

**Two quick games for real Bitcoin Cash:** rock-paper-scissors against a friend or the House Bot, and **Up or Down** on the next minute of the BCH price. Free sats to start, and every result is written on chain.

▶ **Play:** https://satoshi-duel.vercel.app

⌨️ **Terminal**, PowerShell:
```
irm https://satoshi-duel.vercel.app/play.ps1 | iex
```
bash, zsh or VS Code:
```
curl -fsSL https://satoshi-duel.vercel.app/play.sh | sh
```

Built from scratch for **BCH BLAZE 2026** (Mainnet Track). Network: **chipnet** while testing; mainnet at final submission.

---

## 1 minute: what it is
1. Pick a name and get **25,000 free sats** (≈5¢). If a friend invited you, you both get 25,000 more.
2. **✊ Duel:** pick a move and a stake, then play the **House Bot** or send a **challenge link** to a friend. The winner takes the pot.
3. **📈 Up or Down:** tap **▲ UP** or **▼ DOWN** for the next 1-minute BCH/USD candle. A right call pays **1.9×**.
4. The **live leaderboard** shows who played whom, who won and how much, with a link to every on-chain record.
5. Deposit with **WizardConnect** (one approval in your wallet) or with any wallet by QR. Withdraw winnings any time; the platform fee is 5%.

## 5 minutes: why it's fair
| Risk | How it's handled |
|---|---|
| Opponent sees your move | You send only `sha256(move:salt)`. The salt stays on your device until you reveal. |
| You change your move after seeing theirs | The reveal must match the commitment, or it's rejected. |
| The creator refuses to reveal when losing | There's a 2-minute reveal deadline, after which the opponent wins. |
| The House Bot cheats | Its move is fixed per duel by a secret seed before you reveal. |
| The Up/Down price is rigged | Bets close before the minute starts. The **public Coinbase BCH-USD 1-minute candle** settles the round (Kraken is the fallback), and anyone can look it up. |
| Hidden results | Every duel (`SDL1…`) and every bet (`SUD1…`) is written to BCH in an `OP_RETURN` record. |
| Bonus farming | 100 bonuses platform-wide and 3 per network address. Bonus credit is play-only; it becomes withdrawable only by winning. |
| A withdrawal paid twice | The txid is saved before broadcast, and a slow broadcast is never refunded. |

**Trust model:** balances are custodial. The platform holds the pot, the way a card room does. The chain serves as the public scoreboard and the payment rail, not as an escrow.

## 30 minutes: how it's built
```
api/duel.mjs          one Vercel serverless function (all routes)
server/engine.mjs     game rules: duel, Up/Down, bonus, referral, fees (pure, tested)
server/service.mjs    balances, duels, bets in Postgres transactions
server/db.mjs         schema (Neon Postgres)
server/chain.mjs      house wallet: on-chain records and withdrawals (CashScript + libauth, Electrum)
server/price.mjs      BCH/USD candles (Coinbase, Kraken fallback)
server/test/          game-rule tests
web/src/              React app: duel, Up/Down, wallet, leaderboard
web/src/duel/wizard.js + WalletConnect.jsx   WizardConnect deposit
web/public/duel.mjs   terminal client (no dependencies) + play.ps1 / play.sh
scripts/e2e.mjs       full flow against a live API on chipnet
docs/MAINNET.md       mainnet switch checklist
```

## 1 hour: run and test it
```bash
npm ci
npm test              # 27 tests: game rules, Up/Down, WizardConnect deposit, banner
npm run build
BASE=https://satoshi-duel.vercel.app npm run e2e   # signup, referral, bot + friend duel, cheat attempt, on-chain record, withdrawal
```
To run the API locally, set `DATABASE_URL`, `HOUSE_SK` and `HOUSE_SECRET`, then run `npm run api`.

## Proof (chipnet)
| What | Transaction |
|---|---|
| Friend duel recorded on chain | [0654235d…6fc54](https://chipnet.imaginary.cash/tx/0654235de2ff2ca8e1f06a6dd0af7989ed18f045b422386d68d9bdd2bdb6fc54) |
| Up/Down bet recorded on chain ($190.24 → $190.12, DOWN) | [c927a6e0…05ac6](https://chipnet.imaginary.cash/tx/c927a6e002cb05db41ccffff24e419ac7f30ac70bed61495b297c62051905ac6) |
| Withdrawal (5% fee) | [c5a7bb4b…fb0ee](https://chipnet.imaginary.cash/tx/c5a7bb4bee94602b575a288ee73ddc71a004e18df3186ebfdd27b7ecfb5fb0ee) |

## Business
- **Revenue:** a 5% fee on withdrawals, plus a 5% edge on Up/Down wins (pays 1.9×, not 2×).
- **Marketing budget:** the free bonuses, capped.
- **Next:** tournaments, streamer challenge links, a Telegram bot, PUSD stakes.

## Eligibility (BLAZE)
- **Deck:** _link pending_
- **Repo:** this repo
- **EMBER2026:** `bitcoincash:zrcvv9gjvgeeh6gesa2t3q0z40n3uzxwhua3m6rsyf`
- **No pre-hackathon code.** The first commit is from 17 Nov 2026. An earlier BLAZE experiment in this repo (PassRate.cash) was removed and is still in git history.
- **Wallet connection:** WizardConnect.
