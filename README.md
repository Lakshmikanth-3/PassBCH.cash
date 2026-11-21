# PassBCH.cash

**Play while your AI thinks.** Every developer stares at Claude Code saying *"Cogitating…"*. PassBCH.cash turns that wait into three quick games played for real Bitcoin Cash, and every result is written on chain.

▶ **One link for everything:** https://passbch-cash.vercel.app

⌨️ **Terminal**, PowerShell:
```
irm https://passbch-cash.vercel.app/play.ps1 | iex
```
bash, zsh or VS Code:
```
curl -fsSL https://passbch-cash.vercel.app/play.sh | sh
```

Built from scratch for **BCH BLAZE 2026** (Mainnet Track). Network: **chipnet** while testing; mainnet at final submission.

---

## 1 minute: the three games
| Game | You predict | Settled by |
|---|---|---|
| **Prompt Fight** | Write a strategy prompt; your AI agent plays "Race to N" live against another agent | Game rules enforced by code (no AI judge). Each agent sees only its own prompt. |
| **Up or Down** | Will BCH/USD close the next minute up or down? | The public Coinbase 1-minute candle |
| **Rock · Paper · Scissors** | Beat a friend or the House Bot at a TV-show table | Commit-reveal: your move is hashed until you reveal |

**To start playing:**
- Pick a name and get **25,000 free sats** (≈5¢).
- Invite a friend: you both get 25,000 more.
- Deposit with **WizardConnect** or by QR, and withdraw winnings any time. The platform fee is 5%.

**The "woah" moment: the Claude Code panel.** While Claude is thinking, your status bar shows the live AI exam and an invitation to play:
```
🤖 gpt-oss-120b vs "book-store" ● BETTING 1:05 · PASS 1.42x | FAIL 3.16x  │ 📈 BCH $192.16
✻ Claude thinking 0:42 · play now → passbch-cash.vercel.app
```
Set it up with `node panel/panel.mjs install` and `node panel/panel.mjs feed`.

## 5 minutes: why it's fair
| Game | Rule |
|---|---|
| Prompt Fight | The target (15–24), the step size (2–4) and who moves first are drawn from the match id. The server enforces every move; an unusable reply plays the smallest legal move (marked). Prompts are hidden until the fight ends. Winner takes the pot in the same buckets it was staked in. |
| Up/Down | Bets close before the minute starts. The public Coinbase BCH-USD candle settles the round (Kraken is the fallback). A win pays 1.9×; an unchanged price refunds the bet. |
| Duel | You send only `sha256(move:salt)`. Reveals must match the commitment. If you don't reveal within 2 minutes, you lose. The bot's move is fixed by a secret seed per duel. |
| All | Every result is written to BCH as an `OP_RETURN` record: `SPF1` (Prompt Fight), `SUD1` (Up/Down bet), `SDL1` (duel). |

**Network:** chipnet (testnet) until the project is finished and fully tested; mainnet only at the very end.

**Trust model:** balances are custodial. The platform holds the pot, the way a card room does. The chain serves as the public scoreboard and payment rail. Bonuses are capped at 100 platform-wide and 3 per network address, and bonus credit is play-only.

## 30 minutes: how it's built
```
api/duel.mjs        one Vercel serverless function (all routes)
server/             rules (engine.mjs), Postgres service, house wallet (chain.mjs), price feed + tests
server/promptfight.mjs  Prompt Fight rules + Groq agent calls (gpt-oss-20b)
ai/                 earlier AI coding-exam experiment (not used by the site)
panel/panel.mjs     Claude Code status line + hooks ("play while your AI thinks")
web/                React app (3 game tabs, wallet, leaderboard) + terminal client (public/duel.mjs)
scripts/e2e.mjs     full flow against the live API on chipnet
docs/MAINNET.md     mainnet switch checklist
```
**Stack:** Vite + React, Vercel, Neon Postgres, CashScript + libauth, Electrum (Fulcrum), WizardConnect, Docker, Groq (gpt-oss-20b / 120b).

## 1 hour: run and test it
```bash
npm ci
npm test                                            # 37 tests: rules, AI/UpDown/Duel, WizardConnect deposit, panel, banner
npm run build
BASE=https://passbch-cash.vercel.app npm run e2e    # signup, referral, duels, cheat attempt, on-chain record, withdrawal
```

## Proof (chipnet)
| What | Transaction |
|---|---|
| AI round: gpt-oss-120b, "book-store" (drawn from block 341080), **PASS 20/20** | [9616cb60…4963c](https://chipnet.imaginary.cash/tx/9616cb605fb7c06bd9890a64e7426d210b2e6ba3cf47564aff1c62a6bfb4963c) |
| Up/Down bet: $190.24 → $190.12, DOWN | [c927a6e0…05ac6](https://chipnet.imaginary.cash/tx/c927a6e002cb05db41ccffff24e419ac7f30ac70bed61495b297c62051905ac6) |
| Friend duel record | [0654235d…6fc54](https://chipnet.imaginary.cash/tx/0654235de2ff2ca8e1f06a6dd0af7989ed18f045b422386d68d9bdd2bdb6fc54) |
| Withdrawal (5% fee) | [c5a7bb4b…fb0ee](https://chipnet.imaginary.cash/tx/c5a7bb4bee94602b575a288ee73ddc71a004e18df3186ebfdd27b7ecfb5fb0ee) |

## Business
- **Revenue:** a 5% withdrawal fee, plus a 5% edge on Up/Down and AI odds.
- **Marketing budget:** the free bonuses, capped.
- **Next:** verified AI leaderboards that agent makers pay to be listed on, tournaments, streamer links, a Telegram bot, PUSD stakes.

## Eligibility (BLAZE)
- **Deck:** _link pending_
- **Repo:** this repo
- **EMBER2026:** `bitcoincash:zrcvv9gjvgeeh6gesa2t3q0z40n3uzxwhua3m6rsyf`
- **No pre-hackathon code.** The first commit is from 17 Nov 2026.
- **Wallet connection:** WizardConnect.
