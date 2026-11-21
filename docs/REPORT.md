# PassBCH.cash: Complete Project Report

*BCH BLAZE 2026 · status as of 22 Nov 2026 · network: BCH **chipnet** (testnet) only*

---

## 1. One-line summary

**PassBCH.cash is a Bitcoin Cash game show you play in the minute while your AI coding agent is "thinking".** It has three one-minute games (Rock · Paper · Scissors, Up or Down on the BCH price, and Prompt Fight). Each finished game is written to the BCH blockchain as a small public record, and anyone can re-check it in the browser or the terminal.

| | |
|---|---|
| Live app | https://passbch.vercel.app (same app: https://passbch-cash.vercel.app) |
| Terminal (Windows) | `irm https://passbch.vercel.app \| iex` |
| Terminal (Mac / Linux / VS Code) | `curl -sL passbch.vercel.app \| sh` |
| Repository | https://github.com/Lakshmikanth-3/PassBCH.cash |
| Verify any result | https://passbch.vercel.app/verify |
| Winners worldwide | https://passbch.vercel.app/winners |
| Rules and FAQ | https://passbch.vercel.app/rules |
| House wallet (chipnet) | `bchtest:qql3cd7mlgqepacnudgh9qg6xc9na6a40qgmzdahgk` |
| Code started | 17 Nov 2026 (all code written during BLAZE; about 170 commits) |
| Tests | 56 automated (all pass) + live end-to-end script (13 checks) + live browser test (27 / 27 checks) |

---

## 2. The idea

### 2.1 Where it came from
A friend's observation: developers using Claude Code (or any AI agent) watch a "Cogitating…" message many times a day, for 30 seconds to a few minutes. That is dead time. PassBCH.cash fills it with a game that:

- takes **about one minute**,
- can be played **without leaving the terminal** (or in the browser),
- uses **real BCH payments** with fees below a cent, and
- is **provably fair**: the result is on chain and anyone can recompute it.

Pitch: **"Play while your AI thinks."**

### 2.2 Who it is for
| User | Why they care |
|---|---|
| Developers waiting on AI agents | A one-minute game in the same terminal; a Claude Code status-line panel shows the live round |
| BCH newcomers | Free starting credit, no wallet needed to start, one-minute rounds |
| Friends / streamers | Invite links that work in a browser **and** in a terminal; public winners page |
| Judges / auditors | Every result is an `OP_RETURN` record the browser decodes and recomputes |

### 2.3 Problems it solves
| Problem in typical online games | How PassBCH.cash fixes it |
|---|---|
| "Provably fair" claims you can't check | Every result is a public BCH record; the Verify page recomputes the winner from the raw transaction |
| In peer-to-peer games, whoever moves second can see the first move | Commit-reveal: only `sha256(move:salt)` is sent until both players have committed |
| A player can quit when they're losing | A 2-minute reveal deadline; no reveal means you forfeit |
| Price games can pick the price or time after the bets | Entry = the public trade at the exact second you bet; exit = exactly 60 s later |
| AI judges can be argued with or prompt-injected | Prompt Fight has no judge: code enforces the rules, and each agent sees only its own prompt |

---

## 3. The games

### 3.1 Rock · Paper · Scissors (player vs player, about 2 minutes)
- **Ways to play:** against the **House Bot**, **Challenge a friend** (share link), or **accept an open challenge**.
- **Fairness (commit-reveal):**
  1. Your device creates a random salt and sends only `sha256(move:salt)`.
  2. The opponent (or bot) plays without seeing your move.
  3. Your device reveals the move and salt; the server checks the hash matches.
  4. No reveal within **2 minutes** means you forfeit.
- **House Bot:** its move is fixed per duel by a secret seed *before* you reveal.
- **Pay-out:** the winner takes the pot; a draw returns both stakes. No house edge.
- **Record:** `SDL1`, 59 bytes (duel id, result, stake, both moves, commitment).
- **3D show:** a TV-studio table with you, the opponent and a host; cameras on tripods; jointed hands shake "Rock… Paper… Scissors…" and reveal the real moves; the winner gets a spotlight.

### 3.2 Up or Down (prediction, exactly 1 minute)
- **You do:** pick a stake, tap **▲ UP** or **▼ DOWN**, confirm.
- **Where the price comes from: real data, not a mock.**
  | What | Source | Used for |
  |---|---|---|
  | Entry price | **Coinbase BCH-USD public trade history**: the last real trade at or before the second you confirm (Kraken as fallback) | Settlement |
  | Exit price | The last real trade **exactly 60 seconds later**, same source | Settlement |
  | Live price on screen | Coinbase BCH-USD ticker, refreshed every 2 s | Display |
  | Chart | Coinbase BCH-USD **1-minute candles** (15 min, 1 hour or 5 hours) + live ticks | Display / help you decide |
  | Local currency values (₹, ¥, € …) | BCH-USD spot × Coinbase USD FX rates | Display |

  Anyone can re-check a round from the exchange's public trade data. The server stores the trade time and price used.
- **Rules:** higher means UP wins, lower means DOWN wins, **exactly the same price refunds your stake**. A correct call pays **1.9×** (5% house edge).
- **Screen (updated 22 Nov):** a fixed **market dashboard** instead of the rotating 3D screen. It shows the big live price, the change over the range (e.g. `+0.34 (+0.17%) ↑ last 1h`), 15m / 1h / 5h tabs, a line-and-area chart with a price axis and times, a hover tooltip, your **entry line**, a countdown with "winning / losing" while your bet runs, and the result (won / lost / refunded, entry → exit) when it settles. A trend helper below shows the last 5 min, the last minute and how many candles went up. It also reminds you that past minutes don't decide the next one.
- **Record:** `SUD1`, 38 bytes (bet id, side, result, stake, entry time, entry price, exit price).

### 3.3 Prompt Fight (AI vs AI, about 30 seconds)
- **You do:** write a strategy prompt (up to 400 characters) that "trains" your AI agent, then fight the **House Agent** or a friend.
- **Game: Race to N.** N is drawn between 15 and 24 and the maximum step between 2 and 4. Agents take turns adding 1…step to a counter, and landing exactly on N wins. The first mover is drawn from the match id.
- **AI:** Groq `openai/gpt-oss-20b` plays each side. **Each agent sees only its own prompt.** Code enforces legal moves. There is no AI judge.
- **After the fight:** both prompts and every turn are revealed. Automatic moves (when the AI reply was invalid or rate-limited) are marked `*`.
- **Record:** `SPF1`, 59 bytes (match id, winner, N, step, stake, sha256 of all moves).
- **3D show:** two robot agents in a boxing ring; every move is a punch and the counter climbs to N.

### 3.4 Fourth card: "Upcoming BCH games"
Placeholder for tournaments, lucky draws and team battles (coming soon).

---

## 4. Ways to play

### 4.1 Browser
| Page | URL | What it does |
|---|---|---|
| Landing | `/` | Hero, live "paid to winners" strip, 3D showcase tabs (RPS table / Up-Down studio / replay of the latest real Prompt Fight), game cards, how it works, terminal commands |
| Login / sign-up | `/login` | New player (name + optional referral code) or log in with a **login code** |
| Games | `/games` | Four game cards |
| RPS | `/games/rps`, `/duel/<id>` | Play, share, accept challenges |
| Up or Down | `/games/predict` | Market dashboard + UP / DOWN |
| Prompt Fight | `/games/prompt-fight`, `/fight/<id>` | Write a prompt, fight, share |
| Vault | `/wallet` | Balance (bonus / cash), history, CSV export, invite link |
| Add funds | `/wallet/add` | BCH via **WizardConnect** (e.g. Paytaca) or QR; other crypto (SideShift quote) and bank / UPI quote tabs (mainnet only) |
| Withdraw | `/wallet/withdraw` | BCH withdrawal with fee preview |
| Winners | `/winners` | Worldwide winners: filters by game and time; top winners; biggest wins with Verify |
| Profile | `/u/<name>` | Player stats, net result, games with Verify links |
| Verify | `/verify`, `/verify/<txid>` | Paste a transaction id; the browser decodes and recomputes the result |
| Rules | `/rules` | Rules, fairness, FAQ, money rules |

**UI style (updated 22 Nov):** a light "studio paper" look modelled on the reference video: cream page, dark ink text, Bitcoin Cash green buttons with a pressed edge, white cards, a lime highlight on the headline, and a full-width dark footer band. The landing page and every internal page share the same style. Fonts unchanged; no emojis; 3D scenes unchanged.

### 4.2 Terminal (full parity with the web)
- Start: `irm https://passbch.vercel.app | iex` (PowerShell) or `curl -sL passbch.vercel.app | sh`.
- The same URL returns the web app to browsers and a launcher script to PowerShell or curl (the server checks the user-agent).
- The client (`duel.mjs`) **updates itself** when the server reports a newer version (now `2026.11.22-1`).
- Menu: `[1]` RPS · `[2]` Up or Down · `[3]` Prompt Fight · `[4]` upcoming · `[w]` vault · `[l]` winners · `[p]` profile · `[v]` verify · `[r]` rules · `[o]` log out · `[q]` quit.
- ASCII "3D" shows: hands at the table, a candle chart, agents in the ring.

### 4.3 Terminal invites (new, 22 Nov)
Scenario: you are building in VS Code, Claude is thinking, and your friend is also coding in a terminal. They should not have to open a browser.

| You share | Your friend runs | What happens |
|---|---|---|
| RPS challenge `https://passbch.vercel.app/duel/<id>` | `irm https://passbch.vercel.app/duel/<id> \| iex` (Windows) or `curl -sL passbch.vercel.app/duel/<id> \| sh` | The terminal client opens **straight into that duel**: shows who challenged them and for how much, they pick a move, and both see the result |
| Prompt Fight `https://passbch.vercel.app/fight/<id>` | `irm https://passbch.vercel.app/fight/<id> \| iex` or `curl -sL passbch.vercel.app/fight/<id> \| sh` | Opens **straight into that fight**: they write a prompt and the fight plays out in the terminal |
| The same link in a browser | (click it) | The normal web page for that duel or fight |

- **One link works everywhere.** Vercel routes `/duel/<id>` and `/fight/<id>` by user-agent: PowerShell and curl get a launcher that runs `node passbch.mjs join <id>` or `fight <id>`, while browsers get the page.
- When you create a challenge **in the terminal**, it prints both terminal commands and the browser link.
- When you create one **in the browser**, the share box shows **copy buttons for the PowerShell and Mac/Linux commands** under the link.
- Checked live: the curl user-agent gets the `sh` launcher, the PowerShell user-agent gets the `ps1` launcher, and a browser gets the app.

### 4.4 Claude Code panel
`panel/panel.mjs` adds a status line and hooks to Claude Code. While Claude works it shows the live round ("Claude thinking 0:42 · play now →"), your bet status and the result. Install with `node panel/panel.mjs install`.

---

## 5. Money

### 5.1 Accounts and balances
- Custodial ledger in **Neon Postgres**. Each player has a **bonus** balance and a **cash** balance.
- Login is by a **login code** kept in the browser or the terminal config (`~/.passbch.json`).

### 5.2 Rules
| Rule | Value |
|---|---|
| Free credit | 0.00025 BCH per new player; with a referral code the new player gets 0.0005 and the inviter 0.00025 |
| Bonus limits | 100 grants platform-wide, 3 per network address |
| Bonus use | Play only; bonus won in friend duels stays bonus; you must wager 2× your bonus before withdrawing |
| Withdrawal | Minimum 0.0001 BCH (10,000 sats); 5% platform fee |
| House edge | Up/Down 1.9× (5%); RPS vs bot and Prompt Fight have no edge |
| Stakes | Fixed chips; a chip is disabled, with a tooltip saying why, if your balance is too low |

### 5.3 Deposits and withdrawals
- **Deposit:** a per-player deposit address (QR), or **WizardConnect**: connect a BCH wallet such as Paytaca and approve one deposit transaction without sharing keys.
- **Withdraw:** the house wallet sends BCH. The txid is saved **before** broadcast, so a timed-out send is never refunded and paid twice.
- **Other crypto / bank / UPI:** live quotes only (SideShift, FX). Real swaps switch on only with mainnet.

---

## 6. On-chain records

Every finished game is its own BCH transaction from the house wallet with an `OP_RETURN` record (about 300 sats each on chipnet).

| Record | Size | Layout |
|---|---|---|
| `SDL1` duel | 59 B | `SDL1` · duel id (16) · result (1) · stake (4) · creator move (1) · joiner move (1) · commitment (32) |
| `SUD1` Up/Down | 38 B | `SUD1` · bet id (16) · side (1) · result (1) · stake (4) · entry time (4) · entry price ×10⁴ (4) · exit price ×10⁴ (4) |
| `SPF1` Prompt Fight | 59 B | `SPF1` · match id (16) · winner (1) · N (1) · max step (1) · stake (4) · sha256 of all moves (32) |

**Verify:** the browser downloads the raw transaction, decodes the record and **recomputes** the result: the commitment check, the winner, the price direction and the move hash. The terminal's `[v]` does the same.

| Data | Where | Why |
|---|---|---|
| Moves, commitments, prices, winners, move hashes | BCH `OP_RETURN` | Public, permanent, recomputable |
| Deposits / withdrawals | BCH transactions | Real money movement |
| Balances, bonus, wagering, names | Postgres | Custodial ledger |
| Prompts | Postgres, revealed after the fight | Hidden in the lobby |
| RPS salt | Your device until reveal, then Postgres | Lets anyone re-check the commitment |

---

## 7. Architecture

```
Browser (React + three.js)  ─┐
Terminal client (duel.mjs)  ─┼──►  /api/duel  (one Vercel serverless function)
Claude Code panel           ─┘          │
                                        ├── server/service.mjs   players, duels, bets, fights, winners (SQL transactions, row locks)
                                        ├── server/engine.mjs    rules, commit-reveal, settlement, record layouts
                                        ├── server/promptfight.mjs  Race-to-N + Groq
                                        ├── server/price.mjs     Coinbase / Kraken prices, candles, FX, SideShift quotes
                                        ├── server/chain.mjs     house wallet: OP_RETURN records, withdrawals (CashScript + Electrum)
                                        └── Neon Postgres
                                        BCH chipnet via Electrum (chipnet.bch.ninja, chipnet.imaginary.cash)
```

### 7.1 Stack
| Layer | Technology |
|---|---|
| Front end | Vite, React 18, three.js 0.170 (3D studios), plain CSS |
| API | Node serverless function on Vercel (`api/duel.mjs`, 30 s max) |
| Database | Neon Postgres |
| Blockchain | CashScript 0.11.5 (`TransactionBuilder`, `ElectrumNetworkProvider`), libauth 3.0 |
| Wallet connect | @wizardconnect/react 0.2.6, dapp 0.2.7, core 0.2.10 |
| AI | Groq free tier, `openai/gpt-oss-20b` |
| Prices | Coinbase Exchange public API (trades, ticker, 1-min candles), Kraken fallback, Coinbase FX |
| Tests | Vitest |
| Hosting | Vercel (`passbch.vercel.app`, `passbch-cash.vercel.app`) |

### 7.2 API routes (`/api/duel?a=<route>`)
`config` · `signup` · `login` · `me` · `create` · `join` · `reveal` · `duel` · `open` · `leaderboard` · `deposit` · `walletutxos` · `broadcast` · `withdraw` · `price` (with `history=1` for the trend helper and `chart=<minutes>` for the dashboard) · `bet` · `bets` · `rates` · `swapquote` · `pfcreate` · `pfjoin` · `pf` · `pfopen` · `pflatest` · `player` · `activity` · `verify` · `winners` · `launch` (terminal invite script).

### 7.3 Reliability
| Problem met | Fix |
|---|---|
| Recording froze because a session advisory lock stayed held | Atomic row claims (`update … for update skip locked`) with a 30 s retry |
| A withdrawal raced a result record and never confirmed | `serialSend`: one house-wallet send at a time (`pg_advisory_xact_lock`) |
| Up/Down page piled up requests | "busy" guard: one poll at a time |
| Old terminal copies showed old games | Client version + self-update + `no-store` headers |

### 7.4 File structure
```
api/duel.mjs                 HTTP API (all routes, terminal invite launcher)
server/engine.mjs            game rules, settlement, record layouts
server/promptfight.mjs       Prompt Fight engine + Groq
server/service.mjs           game service (SQL)
server/db.mjs                schema
server/chain.mjs             house wallet
server/price.mjs             prices, candles, FX, quotes
server/dev-server.mjs        local API server
server/test/                 engine (25) + Prompt Fight (8) tests
web/app.html                 page shell
web/src/App.jsx              routes and pages
web/src/duel/                Play (RPS), UpDown, MarketChart, PromptFight, Funds (vault/add/withdraw),
                             Winners, Proof (verify), WalletConnect, TermInvite, LowBalance, api/money/wizard helpers
web/src/three/               3D stages (stage.js), Stage3D, Showcase, show.js
web/src/styles.css           theme
web/public/duel.mjs          terminal client
web/public/play.ps1, play.sh terminal launchers
web/test/                    WizardConnect (6), record decoding (5), banner (3) tests
panel/                       Claude Code panel (+6 tests)
scripts/e2e.mjs              live end-to-end script
docs/MAINNET.md              mainnet switch checklist
docs/REPORT.md               this report
vercel.json                  build, headers, user-agent rewrites
```
Secrets (`.ENV`, `keys/`) are git-ignored and Vercel-ignored, and have never been committed.

---

## 8. Security and threat model

| Guarantee | Provided by | Limit |
|---|---|---|
| Moves stay hidden until reveal | SHA-256 commitment | — |
| Quitting doesn't help | 2-minute reveal deadline | — |
| Results can't be silently edited | `OP_RETURN` + browser Verify | Rows recorded before salts were stored show as "information" |
| Price can't be chosen after the bet | Exact-second public trades | Depends on the exchange's data |
| Prompt Fight can't be argued into a win | Code-enforced rules, prompt isolation | Groq rate limits cause automatic `*` moves |
| No double withdrawal | txid stored before broadcast | — |
| Bonus farming limited | Same-bucket settlement, 2× wagering, 3 per network | VPNs can get round the network limit |
| Balances honest | **Trusted operator** (custodial) | Not enforced by the chain |
| Account access | Login code | Losing the code loses the account; no wallet-signature login yet |

Regulation: real-money games are regulated in many countries (including India). Get legal advice before mainnet. 18+.

---

## 9. Testing

| Suite | Result |
|---|---|
| Game rules (`server/test/engine.test.mjs`) | 25 passed |
| Prompt Fight (`server/test/promptfight.test.mjs`) | 8 passed |
| WizardConnect deposit (`web/test/wizard.test.js`) | 6 passed |
| Record decoding (`web/test/proof.test.js`) | 5 passed |
| Claude Code panel (`panel/panel.test.mjs`) | 6 passed |
| Banner (`web/test/banner.test.jsx`) | 3 passed |
| **Total `npm test`** | **56 passed** (re-run 22 Nov after these changes) |
| Live end-to-end (`npm run e2e`) | 13 / 13: signup, referral, bot duel, friend duel, self-join refused, changed move refused, payout, leaderboard, on-chain record, deposit address, bonus not withdrawable, withdrawal with fee |
| Live browser test (headless Edge, 21 Nov) | 27 / 27: landing, signup, RPS + Verify, Up/Down settled after 60 s, Prompt Fight, vault, add funds tabs, withdraw, winners, rules, verify, profile, 404, phone width, no JS or server errors |
| Terminal invite routes (22 Nov, live) | curl → `sh` launcher with `join <id>`; PowerShell → `ps1` launcher with `fight <id>`; browser → web app |
| Market chart API (22 Nov, live) | 60 real 1-minute points returned (e.g. $197.82 – $198.87) |

### Evidence: real chipnet transactions
| What | Result | Transaction |
|---|---|---|
| Duel: rock vs paper (salt published) | House Bot wins | [aabd0d33…4e19e4dd](https://chipnet.imaginary.cash/tx/aabd0d3307cab5bb20bf9e243f954e2734a1393dd8489417aca0d5eb4e19e4dd) |
| Duel: paper vs paper | Draw | [d5913d18…1722357e](https://chipnet.imaginary.cash/tx/d5913d189c0f2634b83672512909a5419cde3f0353b86175e57e091e1722357e) |
| Up/Down: UP $198.53 → $198.59 | Win 1.9× | [e6ba1ddd…5c23670d](https://chipnet.imaginary.cash/tx/e6ba1ddd9fe346fe0f86eff6366aef66334bec0a91688c9373e20eef5c23670d) |
| Up/Down: DOWN $198.66 → $198.80 | Lose | [0f2f18da…7617ab55](https://chipnet.imaginary.cash/tx/0f2f18da37cbf56168d0dfa837a7be74f5795b065a7bf3f40e15aa277617ab55) |
| Prompt Fight: Race to 18, step 1–3 | KANTH wins | [7a7fad7f…5f17d1bce](https://chipnet.imaginary.cash/tx/7a7fad7ffad96b2c73f640628e77c0b9de10216d5a15dcc9f5f15cb5f17d1bce) |
| Friend duel: scissors beats paper | Creator wins | [37cc34d3…0dd68114](https://chipnet.imaginary.cash/tx/37cc34d35c5badd3f4cafff93dc3d3183ac5439cb0a14b136eac38ea0dd68114) |
| Withdrawal 5,000 sats → 4,600 after fee | Confirmed | [c5a7bb4b…fb5fb0ee](https://chipnet.imaginary.cash/tx/c5a7bb4bee94602b575a288ee73ddc71a004e18df3186ebfdd27b7ecfb5fb0ee) |
| House wallet funded | 200,000 sats | [a9475687…6bd92211](https://chipnet.imaginary.cash/tx/a947568787d4b78350d2e6e096b311c3ad4ef91ebe2d74fef415c7306bd92211) |

---

## 10. Deployment

- **Vercel** builds the single package (`npm run build` → `web/dist`) and deploys `api/duel.mjs` as the function.
- **Rewrites:**
  - `/` serves `play.ps1` or `play.sh` to PowerShell and curl, and the app to browsers.
  - `/duel/<id>` and `/fight/<id>` serve the terminal invite launcher to PowerShell and curl, and the app to browsers.
  - All other paths fall back to the single-page app.
- **Headers:** `no-store` on the terminal client and launchers; `nosniff`; strict referrer policy.
- **Env (on Vercel, never in git):** `DATABASE_URL`, `HOUSE_SK`, `HOUSE_SECRET`, `GROQ_KEY`, network setting.

---

## 11. Timeline (summary)

| Date | Milestone |
|---|---|
| 17 Nov 2026 | First commit; duel engine, commit-reveal, chipnet records |
| 18–19 Nov | Up or Down (one-minute rounds, exact-second prices), terminal client, vault, WizardConnect deposit |
| 19–20 Nov | Prompt Fight (Race to N with Groq), 3D studios, winners worldwide, profiles, Verify page |
| 20–21 Nov | QA fixes (recording locks, send serialization, salts stored), evaluator-style README, calm UI, full live browser test 27/27 |
| 22 Nov | Light studio theme from the reference video; terminal invite links; fixed market dashboard for Up/Down; this report |

---

## 12. Known issues and gaps (status on 22 Nov, after the final fix round)

| # | Issue | Status |
|---|---|---|
| 1 | Prompt Fight first mover could be a forced win | **Mitigated.** First mover is a commit-reveal coin flip (hash published at creation, seed revealed after). Race to N is still a solved game, so a strong prompt that finds the winning line wins; this is explained on /rules. The commitment is stored in the database and shown on the fight; it is not inside the 59-byte on-chain record. |
| 2 | Invalid AI replies became automatic `*` moves | **Fixed.** Groq is asked for JSON `{"add": n}`, the reply is validated, retried once, then the automatic move is used. Tests added. |
| 3 | "Writing on-chain record…" stuck | **Fixed.** Fights keep polling until the txid arrives; the Verified card updates by itself. |
| 4 | Finished fight/duel replayed on reload | **Fixed.** Opening a finished game shows the result at once with a Replay button. |
| 5 | Winners ranked by gross | **Fixed.** Ranked by net profit (winnings minus stakes); gross is shown next to it. |
| 6 | KANTH record changed (2-1-2 to 1-0-2) | **Finding (inferred, not proven).** The code never overwrites a player's record: the leaderboard recomputes W-L-D live from settled duel rows. My test clean-ups deleted QA test accounts together with their duels, and a duel against KANTH would disappear from his record with them. No code path edits stats. |
| 7 | RPS open challenges vanished when empty | **Fixed.** Empty state shown. |
| 8 | LIVE badge always lit | **Fixed.** Shows STUDIO (grey) until a duel or fight is actually open. |
| 9 | Login code is the only key | Open (documented). |
| 10 | Mainnet bonus too large | **Fixed.** Mainnet: 0.00002 BCH, 50 grants, 3 per network address, stakes 500 to 20,000 sats. |
| 11 | WizardConnect / Paytaca phone test | Needs you. |
| 12 | Terminal friend needs Node.js 18+ | By design. |
| 13 | Custodial balances | By design; solvency line added. |
| 14 | Non-custodial covenant duel, XO template | Not built (not safe to ship half-finished). |

---

## 13. Remaining steps to submission

1. Fix items 1–3 above (and 5 if there's time).
2. Lower the mainnet bonus and cap.
3. **You:** test WizardConnect with Paytaca on your phone (chipnet).
4. **You:** add the pitch-deck link (the banner currently says "Deck: not linked yet").
5. Final README refresh (test counts, new features, deck link).
6. Run `npm test`, the live end-to-end script and the browser test again on the final build.
7. **Only after you say the project is finished:** switch to mainnet with `docs/MAINNET.md`. Fund the mainnet house address `bitcoincash:qqf029whcssjtkpfkyfk5s2z4t9vawvkfcn56u84un` (about ₹500 of BCH covers many records; a float of 0.002 BCH is about ₹37). Then run one real mainnet game and record its txid.
8. Optional 60-second demo video; Telegram post.
9. Submit on DoraHacks before **22 Nov 2026, 14:00 UTC**.

---

## 14. How to run locally

```bash
npm ci
npm test          # 56 tests, no secrets needed
npm run dev       # web app on http://localhost:5173
# own API: DATABASE_URL, HOUSE_SK, HOUSE_SECRET, GROQ_KEY  →  npm run api  (http://localhost:8787)
BASE=https://passbch.vercel.app npm run e2e   # live end-to-end (spends a little chipnet BCH)
```
