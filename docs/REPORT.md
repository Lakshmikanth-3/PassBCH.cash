# PassBCH.cash: Complete Project Report

*BCH BLAZE 2026 · Mainnet Track · status as of 22 Nov 2026 · network: **Bitcoin Cash mainnet** (built and tested on chipnet first)*

---

## 1. One-line summary

**PassBCH.cash is a Bitcoin Cash game show you play in the minute while your AI coding agent is "thinking".** It has five short games: Rock · Paper · Scissors, Up or Down on the BCH price, Prompt Fight, Coin Flip and Typing Race. Each finished game is written to the BCH blockchain as a small public record, and anyone can re-check it in the browser or the terminal.

| | |
|---|---|
| Live app (mainnet) | https://passbch.vercel.app (same app: https://passbch-cash.vercel.app) |
| Terminal, any OS | `npx passbch` (npm package `passbch`) |
| Terminal, no Node.js | Windows `irm https://passbch.vercel.app \| iex` · Mac/Linux `curl -sL passbch.vercel.app \| sh` |
| Repository | https://github.com/Lakshmikanth-3/PassBCH.cash |
| Verify any result | https://passbch.vercel.app/verify |
| Winners worldwide | https://passbch.vercel.app/winners |
| Rules and FAQ | https://passbch.vercel.app/rules |
| DoraHacks | https://dorahacks.io/build/51625 |
| Pitch deck | https://docs.google.com/presentation/d/1ihRRCqbTXc56jZPF8c5AjsR113gBCRdJ/edit?usp=sharing |
| House wallet (mainnet) | `bitcoincash:qqf029whcssjtkpfkyfk5s2z4t9vawvkfcn56u84un` |
| First mainnet game | `c1e08e256ce37a8ec7a0b3f26b5fa02f81e8b90506053e9ea815845ff3e14970` (confirmed in block 978,468) |
| Demo video | https://youtu.be/Or1W7viUzTI (2:50, every game played on mainnet) |
| EMBER2026 vote address | `bitcoincash:zrcvv9gjvgeeh6gesa2t3q0z40n3uzxwhua3m6rsyf` |
| Code started | 17 Nov 2026 (all code written during BLAZE) |
| Tests | 62 automated (all pass) + live end-to-end script (13 checks) + live browser audit (27 / 27 checks) |
| XO bounty | Built: trustless RPS escrow template, executed on chipnet ([xo/](../xo)) |

---

## 2. The idea

### 2.1 Where it came from
Developers using Claude Code (or any AI agent) watch a "Cogitating…" message many times a day, for 30 seconds to a few minutes. That is dead time. PassBCH.cash fills it with a game that:

- takes **about one minute**,
- can be played **without leaving the terminal** (or in the browser),
- uses **real BCH payments** with fees below a cent, and
- is **provably fair**: the result is on chain and anyone can recompute it.

Pitch: **"Play while your AI thinks."**

### 2.2 Who it is for
| User | Why they care |
|---|---|
| Developers waiting on AI agents | A one-minute game in the same terminal (`npx passbch`); a Claude Code status-line panel shows the live round |
| BCH newcomers | Free starting credit, no wallet needed to start, one-minute rounds |
| Friends / streamers | Invite links that work in a browser **and** in a terminal (`npx passbch race <code>`); public winners page |
| Judges / auditors | Every result is an `OP_RETURN` record the browser decodes and recomputes |

### 2.3 Problems it solves
| Problem in typical online games | How PassBCH.cash fixes it |
|---|---|
| "Provably fair" claims you can't check | Every result is a public BCH record; the Verify page recomputes the winner from the raw transaction |
| In peer-to-peer games, whoever moves second can see the first move | Commit-reveal: only `sha256(move:salt)` is sent until both players have committed |
| The house can pick the outcome after you bet | Coin Flip and the House Bot commit their seed hash **before** you play |
| A player can quit when they're losing | A 2-minute reveal deadline; no reveal means you forfeit |
| Price games can pick the price or time after the bets | Entry = the public trade at the exact second you bet; exit = exactly 60 s later |
| AI judges can be argued with or prompt-injected | Prompt Fight has no judge: code enforces the rules, and each agent sees only its own prompt |

---

## 3. The games

### 3.1 Rock · Paper · Scissors (player vs player, about 2 minutes)
- **Ways to play:** against the **House Bot**, **challenge a friend** (share link or terminal command), or **accept an open challenge**.
- **Fairness (commit-reveal):** your device creates a random salt and sends only `sha256(move:salt)`; the opponent plays without seeing it; your device reveals move and salt and the server checks the hash. No reveal within **2 minutes** means you forfeit.
- **House Bot:** its move is fixed per duel by a secret seed *before* you reveal.
- **Pay-out:** the winner takes the pot; a draw returns both stakes. No house edge.
- **Record:** `SDL1`, 59 bytes (duel id, result, stake, both moves, commitment).
- **3D show:** a TV-studio table with you, the opponent and a host; jointed hands shake "Rock… Paper… Scissors…" and reveal the real moves.

### 3.2 Up or Down (prediction, exactly 1 minute)
- **You do:** pick a stake, tap **UP** or **DOWN**, confirm.
- **Prices are real:** entry = the last Coinbase BCH-USD public trade at or before the second you confirm (Kraken fallback); exit = the last trade exactly 60 s later. The screen shows the live ticker, 1-minute candles (15 min / 1 h / 5 h), your entry line and a countdown.
- **Rules:** higher → UP wins, lower → DOWN wins, the same price refunds. A correct call pays **1.9×** (5% house edge).
- **Record:** `SUD1`, 38 bytes (bet id, side, result, stake, entry time, entry price, exit price).

### 3.3 Prompt Fight (AI vs AI, about 30 seconds)
- **You do:** write a strategy prompt (up to 400 characters) for your AI agent, then fight the **House Agent** or a friend.
- **Game: Race to N.** N is drawn between 15 and 24 and the maximum step between 2 and 4; agents add 1…step to a counter; landing exactly on N wins. The first mover is a commit-reveal coin flip.
- **AI:** Groq `openai/gpt-oss-20b` plays each side; each agent sees only its own prompt; code enforces legal moves; no AI judge. Invalid replies are retried once, then an automatic move (marked `*`) is used.
- **Record:** `SPF1`, 59 bytes (match id, winner, N, step, stake, sha256 of all moves).

### 3.4 Coin Flip (instant)
Heads or tails. The house commits sha256 of a secret seed first; your browser or terminal adds a random seed; the flip is the parity of sha256(seed : your seed : game id). The seed is revealed afterwards and Verify recomputes it. Pays 1.9×. Record: `SQG1` (66 bytes). **This is the game of the first mainnet transaction.**

### 3.5 Typing Race (about 15 seconds)
Type a phrase faster than the House Bot (45 to 80 wpm, fixed by a committed seed). The server times you; paste is blocked; speeds above about 260 wpm count as a loss. Pays 1.9×.
**Friend race:** "Challenge a friend" gives a link and a one-line terminal command (`npx passbch race <code>`). Both see a shared 4-second countdown and type the same phrase; the first valid finish takes the pot (no house edge). Record: `SQG1` kind 3.

### 3.6 Upcoming card
Placeholder for tournaments, lucky draws and team battles.

---

## 4. Ways to play

### 4.1 Browser
| Page | URL | What it does |
|---|---|---|
| Landing | `/` | BLAZE banner (deck, GitHub, EMBER2026), hero, live "paid to winners" strip, 3D showcase, game cards |
| Login / sign-up | `/login` | New player (name + optional referral code) or log in with a **login code** |
| Games | `/games` | Five game cards + upcoming |
| RPS | `/games/rps`, `/duel/<id>` | Play, share, accept challenges |
| Up or Down | `/games/predict` | Market dashboard + UP / DOWN |
| Prompt Fight | `/games/prompt-fight`, `/fight/<id>` | Write a prompt, fight, share |
| Coin Flip | `/games/coin-flip` | Heads / tails with committed house seed |
| Typing Race | `/games/typing-race`, `/race/<id>` | Solo vs House Bot or live friend race |
| Vault | `/wallet` | Balance (bonus / cash), history, CSV export, invite link |
| Add funds | `/wallet/add` | BCH via **WizardConnect** (e.g. Paytaca) or QR |
| Withdraw | `/wallet/withdraw` | BCH withdrawal with fee preview |
| Winners | `/winners` | Worldwide winners, top winners, biggest wins, house solvency line |
| Profile | `/u/<name>` | Player stats and games with Verify links |
| Verify | `/verify`, `/verify/<txid>` | Paste a transaction id; the browser decodes and recomputes the result |
| Rules | `/rules` | Rules, fairness, FAQ, money rules, house solvency |

UI: light "studio paper" theme, Bitcoin Cash green buttons, no emoji, 3D scenes with three.js.

### 4.2 Terminal (full parity with the web)
- **`npx passbch`** on any OS with Node.js 18+. The npm package ([packages/cli](../packages/cli)) is a small launcher that downloads the latest client from the live site, so it never goes stale. Published as `passbch@1.0.0`.
- Without Node's npx: `irm https://passbch.vercel.app | iex` (PowerShell) or `curl -sL passbch.vercel.app | sh`. The same URL returns the web app to browsers and a launcher to PowerShell or curl (user-agent routing).
- Menu: `[1]` RPS · `[2]` Up or Down · `[3]` Prompt Fight · `[4]` Coin Flip · `[5]` Typing Race · `[w]` vault · `[l]` winners · `[p]` profile · `[v]` verify · `[r]` rules · `[o]` log out · `[q]` quit. `g` on the welcome screen creates a guest with the free bonus.
- The client updates itself when the server reports a newer version.

### 4.3 Terminal invites
| You share | Your friend runs | What happens |
|---|---|---|
| Typing Race | `npx passbch race <code>` | Joins the live race straight away |
| RPS duel | `npx passbch join <code>` | Opens that duel; they pick a move |
| Prompt Fight | `npx passbch fight <code>` | Opens that fight; they write a prompt |
| The same link in a browser | (click it) | The normal web page |

### 4.4 Claude Code panel
`panel/panel.mjs` adds a status line and hooks to Claude Code: while Claude works it shows the live round ("Claude thinking 0:42 · play now →"), your bet status and the result. Install with `node panel/panel.mjs install`.

---

## 5. Money

### 5.1 Accounts and balances
- Custodial ledger in **Neon Postgres** (a separate, fresh database for mainnet). Each player has a **bonus** and a **cash** balance.
- Login is by a **login code** kept in the browser or the terminal config (`~/.passbch.json`).

### 5.2 Rules (mainnet)
| Rule | Value |
|---|---|
| Free credit | 0.00002 BCH (2,000 sats) per new player; 50 grants platform-wide; 3 per network address |
| Bonus use | Play only; must wager 2× the bonus before withdrawing |
| Stakes | 500 / 1,000 / 2,000 / 5,000 sats (custom 500 to 20,000) |
| Withdrawal | Minimum 0.0001 BCH (10,000 sats); 5% platform fee |
| House edge | Up/Down, Coin Flip and solo Typing Race 1.9× (5%); RPS, Prompt Fight and friend races have no edge |

On chipnet (testing) the same code used larger test values (0.00025 BCH bonus, 2,500 to 25,000-sat stakes).

### 5.3 Deposits and withdrawals
- **Deposit:** a per-player deposit address (QR), or **WizardConnect**: connect a BCH wallet such as Paytaca and approve one deposit transaction without sharing keys.
- **Withdraw:** the house wallet sends BCH. The txid is saved **before** broadcast, so a timed-out send is never refunded and paid twice.
- **House solvency:** shown live on /winners and /rules: house wallet balance (read from chain) against the cash players could withdraw. At launch: 0.01519982 BCH vs 0, covered.

---

## 6. On-chain records

Every finished game is its own BCH transaction from the house wallet with an `OP_RETURN` record (about 300 to 400 sats of fee each).

| Record | Size | Layout |
|---|---|---|
| `SDL1` duel | 59 B | `SDL1` · duel id (16) · result (1) · stake (4) · creator move (1) · joiner move (1) · commitment (32) |
| `SUD1` Up/Down | 38 B | `SUD1` · bet id (16) · side (1) · result (1) · stake (4) · entry time (4) · entry price ×10⁴ (4) · exit price ×10⁴ (4) |
| `SPF1` Prompt Fight | 59 B | `SPF1` · match id (16) · winner (1) · N (1) · max step (1) · stake (4) · sha256 of all moves (32) |
| `SQG1` Coin Flip / Typing Race | 66 B | `SQG1` · game id · kind · result · stake · values · commitment |

**Verify:** the browser downloads the raw transaction, decodes the record and **recomputes** the result (commitment check, winner, price direction, move hash, coin parity). The terminal's `[v]` does the same.

| Data | Where | Why |
|---|---|---|
| Moves, commitments, seeds, prices, winners, move hashes | BCH `OP_RETURN` | Public, permanent, recomputable |
| Deposits / withdrawals | BCH transactions | Real money movement |
| Balances, bonus, wagering, names | Postgres | Custodial ledger |
| Prompts | Postgres, revealed after the fight | Hidden in the lobby |

---

## 7. Architecture

```
Browser (React + three.js)  ─┐
Terminal client (duel.mjs)  ─┼──►  /api/duel  (one Vercel serverless function)
npx passbch (packages/cli)  ─┤          │
Claude Code panel           ─┘          ├── server/service.mjs      players, duels, bets, fights, coin flips, races, winners
                                        ├── server/engine.mjs       rules, commit-reveal, settlement, record layouts
                                        ├── server/promptfight.mjs  Race-to-N + Groq
                                        ├── server/price.mjs        Coinbase / Kraken prices, candles, FX
                                        ├── server/chain.mjs        house wallet: OP_RETURN records, withdrawals (CashScript + Electrum)
                                        └── Neon Postgres
                                        BCH mainnet via Electrum (bch.imaginary.cash, electroncash.dk, bch.loping.net)
```

### 7.1 Stack
| Layer | Technology |
|---|---|
| Front end | Vite, React 18, three.js 0.170, plain CSS |
| API | Node serverless function on Vercel (`api/duel.mjs`) |
| Database | Neon Postgres |
| Blockchain | CashScript 0.11.5 (`TransactionBuilder`, `ElectrumNetworkProvider`), libauth 3.0 |
| Wallet connect | @wizardconnect/react 0.2.6, dapp 0.2.7, core 0.2.10 |
| AI | Groq, `openai/gpt-oss-20b` |
| Prices | Coinbase Exchange public API, Kraken fallback, Coinbase FX |
| Terminal | Node client + `passbch` npm launcher |
| Tests | Vitest |
| Hosting | Vercel |

### 7.2 Network switch
One setting, `BCH_NETWORK`, chooses chipnet or mainnet: Electrum hosts, address prefix, explorer links, bonus and stake sizes. Mainnet also uses its own house key, its own secret and a fresh database ([docs/MAINNET.md](MAINNET.md)).

### 7.3 Reliability
| Problem met | Fix |
|---|---|
| Recording froze because a session advisory lock stayed held | Atomic row claims (`for update skip locked`) with a 30 s retry |
| A withdrawal raced a result record | `serialSend`: one house-wallet send at a time (`pg_advisory_xact_lock`) |
| Up/Down page piled up requests | One poll at a time |
| Old terminal copies showed old games | Client version + self-update + `no-store` headers |

### 7.4 File structure
```
api/duel.mjs                All HTTP routes + terminal invite launcher
server/engine.mjs           Game rules, settlement, record layouts
server/promptfight.mjs      Prompt Fight engine + Groq
server/service.mjs          Game service (SQL)
server/db.mjs               Schema
server/chain.mjs            House wallet (chipnet or mainnet)
server/price.mjs            Prices, candles, FX
server/dev-server.mjs       Local API server
server/test/                Engine, Prompt Fight, Coin Flip / Typing Race tests
web/src/                    React app: pages, 3D stages, games, vault, verify, winners, banner
web/public/duel.mjs         Terminal client (+ play.ps1 / play.sh launchers)
web/test/                   Record decoding, WizardConnect, banner tests
packages/cli/               npm package `passbch`
panel/                      Claude Code panel (+ tests)
xo/                         XO bounty: escrow template, chipnet runner, invitations, feedback
scripts/e2e.mjs             Live end-to-end script
docs/                       This report, DoraHacks text, mainnet checklist, deck (text + PowerPoint), Telegram post, images, demo video
SECURITY.md                 Security policy
.github/dependabot.yml      Weekly dependency updates
vercel.json                 Build, headers, user-agent rewrites
```
Secrets (`.ENV`, `keys/`) are git-ignored and Vercel-ignored, and have never been committed.

---

## 8. XO bounty (Build with XO / Migrate to XO)

The PassBCH Rock · Paper · Scissors game was migrated into a **trustless XO template** ([xo/](../xo)):

| PassBCH today (custodial) | XO template (trustless) |
|---|---|
| Stakes sit in the server's database | Both stakes locked in one on-chain pot |
| Server checks `sha256(move:salt)` | The pot's script checks the commitment |
| Server computes the winner | The script computes `(A − B + 3) mod 3` |
| Server pays the winner | The script only lets the pot pay the winner (or 50/50 on a draw) |
| Server timeout | CHECKLOCKTIMEVERIFY: after the deadline the pot goes to the challenger |

Executed on chipnet with two XO accounts and invitations: open [`231206c8…b882465`](https://chipnet.imaginary.cash/tx/231206c80404e290355b94156f62f0787eaa4fafa3c731b79412a06b0b882465), reveal follow-up [`395fc025…5f7c3e1`](https://chipnet.imaginary.cash/tx/395fc025204be573e8efe4694134bee85a8a632680806515f914eb3535f7c3e1) (paid the winner 18,000 sats; SUCCESS in the XO debug tool Inspect). The timeout claim builds and passes the libauth VM, but chipnet nodes returned `bad-txns-nonfinal` during testing.

---

## 9. Security and threat model

| Guarantee | Provided by | Limit |
|---|---|---|
| Moves stay hidden until reveal | SHA-256 commitment | — |
| House can't pick the coin after you bet | Seed hash committed before play | — |
| Quitting doesn't help | 2-minute reveal deadline | — |
| Results can't be silently edited | `OP_RETURN` + browser Verify | — |
| Price can't be chosen after the bet | Exact-second public trades | Depends on the exchange's data |
| Prompt Fight can't be argued into a win | Code-enforced rules, prompt isolation | Rate limits cause automatic `*` moves |
| No double withdrawal | txid stored before broadcast | — |
| Bonus farming limited | 2× wagering, 50 grants, 3 per network | VPNs can get round the network limit |
| Balances honest | **Trusted operator** (custodial) + live solvency line | Not enforced by the chain (the XO template shows the trustless path) |
| Account access | Login code | Losing the code loses the account |

### 9.1 Security review (22 Nov, before submission)
| Finding | Fix |
|---|---|
| Unused AI-exam betting routes (`ai`, `aibet`, `airunner`) from an earlier harness were still reachable on mainnet | Removed with the `ai/` folder; live API now answers "unknown action" |
| Route lookup accepted `Object.prototype` keys (e.g. `?a=constructor`) | Only the API's own routes are dispatched |
| Request bodies had no size limit | Capped at 64 KB (413) |
| Sign-up showed the chipnet bonus amount on mainnet | Amounts and caps now come from the server config |
| Secrets | Repository and full git history scanned for keys, WIFs, database URLs and Groq tokens: none. `keys/` and env files are ignored by git and Vercel |
| Dependencies | `npm audit` (production): 0 vulnerabilities; Dependabot enabled; `SECURITY.md` with private reporting |

Regulation: real-money games are regulated in many countries (including India). 18+.

---

## 10. Testing

| Suite | Result |
|---|---|
| Game rules (`server/test/engine.test.mjs`) | 25 passed |
| Prompt Fight | 11 passed |
| Coin Flip / Typing Race | 6 passed |
| WizardConnect deposit | 6 passed |
| Record decoding | 5 passed |
| Claude Code panel | 6 passed |
| Banner | 3 passed |
| **Total `npm test`** | **62 passed** (re-run 22 Nov) |
| Live end-to-end (`npm run e2e`, chipnet) | 13 / 13 |
| Live browser audit (headless Edge) | 27 / 27 |
| Mainnet readiness (22 Nov) | Local mainnet run: network mainnet, house key → correct address, balance read from chain, solvency covered; then the live game below |

### 10.1 Mainnet transactions
| What | Transaction |
|---|---|
| House wallet funded, 0.01520254 BCH | [`8215f5fb…f3a3eabb`](https://blockchair.com/bitcoin-cash/transaction/8215f5fb8adeea2a3fcb66ef4912c1ae413339411617b16845772ed2f3a3eabb) |
| **First real mainnet game**: Judge572, Coin Flip, 500 sats, heads → tails (lose), `SQG1` record, confirmed in block 978,468, fee 272 sats | [`c1e08e256ce37a8ec7a0b3f26b5fa02f81e8b90506053e9ea815845ff3e14970`](https://blockchair.com/bitcoin-cash/transaction/c1e08e256ce37a8ec7a0b3f26b5fa02f81e8b90506053e9ea815845ff3e14970) · [Verify ✓](https://passbch.vercel.app/verify/c1e08e256ce37a8ec7a0b3f26b5fa02f81e8b90506053e9ea815845ff3e14970) |

### 10.2 Chipnet transactions (testing)
| What | Result | Transaction |
|---|---|---|
| Duel: rock vs paper | House Bot wins | [aabd0d33…4e19e4dd](https://chipnet.imaginary.cash/tx/aabd0d3307cab5bb20bf9e243f954e2734a1393dd8489417aca0d5eb4e19e4dd) |
| Duel: paper vs paper | Draw | [d5913d18…1722357e](https://chipnet.imaginary.cash/tx/d5913d189c0f2634b83672512909a5419cde3f0353b86175e57e091e1722357e) |
| Up/Down: UP $198.53 → $198.59 | Win 1.9× | [e6ba1ddd…5c23670d](https://chipnet.imaginary.cash/tx/e6ba1ddd9fe346fe0f86eff6366aef66334bec0a91688c9373e20eef5c23670d) |
| Up/Down: DOWN $198.66 → $198.80 | Lose | [0f2f18da…7617ab55](https://chipnet.imaginary.cash/tx/0f2f18da37cbf56168d0dfa837a7be74f5795b065a7bf3f40e15aa277617ab55) |
| Prompt Fight: Race to 18 | KANTH wins | [7a7fad7f…5f17d1bce](https://chipnet.imaginary.cash/tx/7a7fad7ffad96b2c73f640628e77c0b9de10216d5a15dcc9f5f15cb5f17d1bce) |
| Withdrawal 5,000 sats → 4,600 after fee | Confirmed | [c5a7bb4b…fb5fb0ee](https://chipnet.imaginary.cash/tx/c5a7bb4bee94602b575a288ee73ddc71a004e18df3186ebfdd27b7ecfb5fb0ee) |

---

## 11. Deployment

- **Vercel** builds `web/` and deploys `api/duel.mjs` as the function; `/`, `/duel/<id>`, `/fight/<id>` and `/race/<id>` serve terminal launchers to PowerShell and curl and the app to browsers.
- **Production settings (never in git):** `BCH_NETWORK=mainnet`, `HOUSE_SK` (mainnet key), `HOUSE_SECRET`, `DATABASE_URL` (mainnet database), `GROQ_KEY`, `DECK_URL`.
- **Mainnet switch, 22 Nov 2026:** house funded with ETH → BCH via SideShift (0.0018 ETH → 0.01520254 BCH); readiness checked locally; production settings changed; the same build was redeployed; live API confirmed `network: mainnet` and the house balance; one real game played and verified.
- **Rollback:** set the chipnet values back and redeploy ([docs/MAINNET.md](MAINNET.md)).

---

## 12. Timeline

| Date | Milestone |
|---|---|
| 17 Nov 2026 | First commit; duel engine, commit-reveal, chipnet records |
| 18–19 Nov | Up or Down, terminal client, vault, WizardConnect deposit |
| 19–20 Nov | Prompt Fight, 3D studios, winners, profiles, Verify page |
| 20–21 Nov | QA fixes, Coin Flip, Typing Race and friend races, live browser test 27/27 |
| 21–22 Nov | `npx passbch` on npm, terminal invites, light studio theme, demo video, XO template on chipnet, Widget Factory deck |
| 22 Nov | **Switched to Bitcoin Cash mainnet**; first real mainnet game recorded, verified and confirmed (block 978,468); security review and fixes deployed; mainnet demo video; XO feedback |

---

## 13. Known issues and limits

| # | Item | Status |
|---|---|---|
| 1 | Balances are custodial | By design; live solvency line; XO template shows the trustless version |
| 2 | Login code is the only key | Open (documented) |
| 3 | Race to N is a solved game | First mover is a commit-reveal coin flip; explained on /rules |
| 4 | Groq rate limits | Automatic `*` moves, marked and explained |
| 5 | Typing Race could be scripted | Server timing, paste blocked, speed ceiling, stake limits |
| 6 | WizardConnect phone test with Paytaca | To be done by the team on mainnet |
| 7 | XO timeout path | Builds and passes the VM; chipnet nodes rejected it as non-final during testing |
| 8 | Swaps / fiat on-ramps | Quotes only |

---

## 14. Submission checklist

- [x] Live on mainnet: https://passbch.vercel.app
- [x] Mainnet transaction: `c1e08e256ce37a8ec7a0b3f26b5fa02f81e8b90506053e9ea815845ff3e14970`
- [x] Open-source repo: https://github.com/Lakshmikanth-3/PassBCH.cash
- [x] Widget Factory deck linked in the banner and README
- [x] EMBER2026 address in the banner
- [x] Demo video with the mainnet proof
- [x] XO bounty built ([xo/](../xo))
- [x] XO technical feedback ([xo/FEEDBACK.md](../xo/FEEDBACK.md))
- [x] Security review fixes deployed
- [ ] Telegram roll call / post
- [x] DoraHacks submission: https://dorahacks.io/build/51625
