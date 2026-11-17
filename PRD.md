# PassRate.cash — Product Requirements Document (v1.1)

**Tagline:** Insert coin. The chain picks the exam. AI agents can't hide a failure.
**v1.1 changes (17 Nov):** fresh-exam lane against memorisation, two model rows as must-have, double-spend wait before START, B2B-first business framing, join a roll-call team, token-aware EMBER2026 address, faucet. See §20.
**Event:** BCH BLAZE 2026, Mainnet Track
**Submission deadline:** Sun 22 Nov 2026, 14:00 UTC (internal target: 08:00 UTC; hard stop 12:00 UTC)
**Team:** 4 people (A: contracts/chain, B: frontend/wallet, C: harness/ops, D: verify/indexer/PM/media)
**Status:** Final, 17 Nov 2026. Items marked **UNVERIFIED** are gated by the day-1 tests in §15.

---

## 1. Summary

AI coding agents grade their own homework. Benchmark claims in READMEs are cherry-picked, rerun until they pass, and impossible to audit.

PassRate is a live proving ground for AI coding agents on Bitcoin Cash. Anyone pays a 20,000-sat Run Ticket (about $0.04). The ticket's own transaction ID, mixed with a Bitcoin Cash block hash, picks an exercise from a task list committed on-chain in advance. A covenant prevents the operator from collecting the ticket until it publishes a START record naming that ticket. An AI agent then attempts the exercise live, and the result is sealed on mainnet. Every started run that does not finish counts as a FAIL.

In about 90 seconds the payer sees three linked mainnet transactions: **Ticket → START → RESULT**.

---

## 2. Problem

- Agent and model makers publish pass rates nobody can check.
- Operators of benchmarks choose which tasks run and which results to publish.
- Failed or slow runs are silently dropped; good runs are rerun until they pass.
- Existing leaderboards are free but rely entirely on trusting the operator.

## 3. Solution in one paragraph

PassRate removes the two easiest ways to cheat. **Task choice:** the exam is picked by the payer's transaction and a block hash from a list committed before the run, so the operator can't choose easy tasks. **Selective reporting:** the operator can't be paid without committing that the run started, and a started run without a sealed result is recorded as a FAIL, so failures can't be hidden.

## 4. Goals and non-goals

**Goals (hackathon)**
1. A judge completes the full Ticket → START → RESULT loop on mainnet in under 2 minutes, without getting stuck.
2. No judge ever waits on a slow run: a sealed replay plays instantly, and live runs never block the UI.
3. Every claim on screen is verifiable in the browser from public chain data.
4. Meet all 7 BLAZE Mainnet requirements and qualify for Media and Build with XO.

**Non-goals**
- Proving that the transcript is genuine (disclosed openly; see §11).
- Paid forecasting, betting, tokens or NFTs of any kind.
- Multi-vendor agent support at launch (one agent family, one or two models).
- Identity, stablecoin bridging, FoldingCash, SolidCash, Migrate to XO.

## 5. Users

| User | Need | What PassRate gives them |
|---|---|---|
| Hackathon judge / curious public | See something real happen, fast | Pay 4 cents, watch an AI take a chain-chosen exam, see it sealed |
| Agent / tool maker | A pass rate people believe | A live README badge backed by chain-drawn runs that can't skip failures |
| Developer choosing an agent | Honest comparison | Leaderboard with confidence intervals and missing-result counts |

## 6. Success metrics (by judging, 23–27 Nov)

- ≥ 150 sealed scheduled runs on mainnet before Sat 21 Nov.
- ≥ 10 successful judge-path tickets from fresh wallets in the bug bash, on 3 phones.
- p90 ticket → START latency ≤ 15 s.
- Replay hero loads and plays in ≤ 3 s.
- ≥ 1 public "I would use this badge" reply from an agent/tool maker.

---

## 7. User flow (the judge path)

1. **Land on the page.** The hero auto-plays a real, already-sealed mainnet run chain (~25 s), each step linked to its explorer page. The leaderboard sits below.
2. **Insert coin.** Choose an agent row, tap **"Pay 20,000 sats and draw an exam."** Connect Selene or Paytaca via WizardConnect; one signature.
3. **Ticket card** appears at 0-conf: "Seed = H(your txid ‖ block #N hash) → exercise #37 of 120: `book-store`."
4. **START card** appears within ~5–15 s: "We could not take your 4 cents without publishing this commitment. If we never start, you reclaim it after 6 blocks."
5. **Live run.** The agent's transcript streams in a terminal pane.
6. **RESULT card**: ✅ PASS or ❌ FAIL (styled scorecard, never an error), tests passed x/y, duration, cost, sealed on mainnet.
7. If the run exceeds 75 s, the UI shows "Still running — it will be sealed; here's your receipt link" and never blocks.
8. **Verify** (one click, in the browser) shows four green checks and a "What this does NOT prove" line.

Three nouns only in the UI: **Ticket, Run, Verify.**

---

## 8. Functional requirements

### 8.1 Run Ticket (must)
- FR-1: Build a transaction paying 20,000 sats to the RunTicket P2SH with an OP_RETURN carrying the tip height, tip hash and agent index.
- FR-2: Sign via WizardConnect (Selene and Paytaca), with clearly labelled outputs.
- FR-3: Show the ticket at 0-conf with an explorer link and the refund option.
- FR-4: Compute the seed and task index in the browser using the same shared JS as the server.

### 8.2 Operator watcher and harness (must)
- FR-5: Watch RunTicket addresses (electrum-cash subscription); on a new ticket, broadcast START within 15 s (p90).
- FR-6: Run the agent (Aider + one small model) on the drawn Exercism exercise in a clean Docker container; agents see only instructions and stub; attempt policy (1 attempt + 1 retry with test output) committed in START.
- FR-7: Broadcast RESULT spending START's change output, so the three transactions are linked UTXO-to-UTXO.
- FR-8: Hard spend caps: vendor spend-limit API plus an internal $/day counter; watchdog and auto-restart.
- FR-9: Judge pool restricted to exercises with measured agent p90 < 60 s (rule published).

### 8.3 Scheduled runs (must, modest cadence)
- FR-10: At heights h ≡ 0 mod 6 (reduce to mod 12 if cost bites), run one agent round-robin with seed = H(blockHash(h) ‖ "S"), funded by the operator through the same contract.
- FR-11: These rows form the official leaderboard; ticket runs are shown separately (the payer can grind its own txid).

### 8.4 FAIL-on-missing (must)
- FR-12: Scheduled height with no START by h+3 → FAIL (no-show).
- FR-13: START with no RESULT by its committed deadline (start + 10 min) → FAIL (timeout/missing).
- FR-14: Ticket refunded by its payer → operator no-show, shown publicly.
- FR-15: All of the above derivable from chain data alone by a published script.

### 8.5 Verify (must, runs in the browser)
1. The task list Merkle root was committed on-chain (MANIFEST) before the ticket.
2. Ticket txid + committed block hash → this exercise, recomputed from a block header fetched over a public Fulcrum WebSocket, not our server.
3. START spends this ticket and names it (covenant-enforced), and was seen before RESULT.
4. Transcript and test-output hashes match RESULT; "Reproduce" gives one `docker run` command that re-runs the official tests on the published solution.

### 8.6 Leaderboard (must)
- Agent + model, n, pass rate, Wilson 95% CI, missing-result count (counted as FAIL), no-show count, median ticket→START latency.

### 8.7 Banner and compliance (must, day 1)
- Top banner: Widget Factory deck link · repo link · EMBER2026 CashTokens address · "Independent; not affiliated with any AI vendor or Exercism."

### 8.8 Should-have
- XO template of RunTicket (start + refund), tested in the XO debug tool on Chipnet with the latest 0.1.0-next engine.
- 60-second Media video of the arcade loop.
- Second model row; rate-limited faucet (25,000 sats, 0.05 BCH cap) for judges without BCH; IPFS pin of transcripts; second harness host.

### 8.9 Cut
Paid forecasting, bonds, sponsor pools, tokens/NFTs, Merkle payouts, FoldingCash, SolidCash, Terminal-Bench, Tamper toggle, multi-vendor launch, Claude Code/Codex/Gemini CLIs, the "Call it" button.

---

## 9. On-chain design

### 9.1 Contract: `RunTicket` (CashScript) — the only contract
Parameters: `operatorPk`, `payerPk`, `manifestRootHash`.

- `start(sig operatorSig)` requires:
  - `tx.outputs[0].lockingBytecode` is an OP_RETURN beginning with `PR2S` and containing this input's `outpointTransactionHash` (the ticket txid) and `manifestRootHash`;
  - a valid operator signature.
  → The operator cannot spend the ticket without publishing a START naming it.
- `refund(sig payerSig)` requires `tx.age >= 6` (~1 hour). The payer reclaims without us.
- Estimated 150–250 B redeem script (**UNVERIFIED until compiled**). No loops needed.

### 9.2 Data transactions (OP_RETURN, compact binary; limit 223 B per tx)

| Tx | Payload | Bytes | Approx fee |
|---|---|---|---|
| MANIFEST (daily) | `PR2` ver `M` day taskRoot(32) harnessDigest(32) rosterHash(32) ruleVersion | 106 | ~260 sats |
| TICKET | `PR2` ver `T` tipHeight(4) tipHash(32) agentIdx(1) | 42 | ~330 sats + 20,000 sats ticket |
| START | `PR2` ver `S` ticketTxid(32) taskRoot(32) taskIdx(2) agentIdx modelIdx harnessDigest(32) deadlineUnix(4) attemptPolicy | 111 | ~420 sats |
| RESULT | `PR2` ver `R` startTxid(32) exit passed total testOutHash(32) transcriptHash(32) solutionHash(32) durationS(2) costMilliUSD(2) | 141 | ~300 sats |

Chain cost per run ≈ 1,050 sats ≈ $0.002 (at ~$208/BCH; sizes **UNVERIFIED** until measured).

### 9.3 Task draw
- Seed for ticket runs = H(ticketTxid ‖ tipHash at broadcast), with the tip committed in the ticket and START. No waiting for a block. Disclosed: the tip is known at broadcast; the txid gives the payer the unpredictability.
- Merkle leaf = H(slug ‖ H(instructions) ‖ H(stub) ‖ H(tests) ‖ container digest).

### 9.4 Why only BCH
- **Covenant introspection** makes "commit before you get paid" a network rule.
- **Sub-cent fees** make sealing every single run economical.
- **Proof-of-work block hash** is public, practically unbiasable randomness (withholding a block costs ~3.125 BCH against a $0.04 ticket).
- **0-conf** makes the Ticket → START → RESULT chain feel instant.

---

## 10. Off-chain architecture

| Component | Tech | Notes |
|---|---|---|
| Harness | Python, fork/wrapper of the Aider benchmark runner, one Docker image | Exercism Python exercises at a pinned commit |
| Watcher | electrum-cash client | Ticket seen → START → run → RESULT |
| Anchor writer | libauth or mainnet-js | MANIFEST/START/RESULT |
| Indexer | SQLite from anchor address history | Also re-derivable in the browser per run |
| Web | Vite + React, WizardConnect | Replay hero, Run Chain, Verify, Leaderboard |
| Storage | R2 (IPFS pin should-have) | Hash-addressed transcripts |
| Shared JS | seed → index, Merkle proof, anchor parse | Same code on server and in browser |

**Task set rule (published and committed):** every exercise under `exercises/practice/` in `exercism/python` at a pinned commit whose reference solution passes its own tests in a clean `python:3.12` container in < 30 s. Excluded list published with reasons. Judge pool = the subset with agent p90 < 60 s.

---

## 11. Honest claims (on screen and in README)

**The chain proves:** which exam was chosen and that it came from a list committed beforehand; that the operator committed the start before being paid and before the result; that every started run has either a sealed result or is counted as a FAIL.

**It does NOT prove:** that the transcript is genuine, or that no parallel hidden attempts ran after START. The browser-measured ticket→START latency shows no hidden attempt finished before START.

**Originality and credits:** Cogitating (NEAR) for crowd interest in agent runs; Gensyn Judge for committed reproducible evaluation (open models only; closed-API agents can't be bitwise-reproduced, so we commit and disclose); "Who Verifies the Benchmark?" (arXiv 2608.07762) for on-chain commit-reveal of LLM evaluation; Foresight Arena and Metaculus for scored AI forecasting; Aider Polyglot for the Exercism exam pool; Release Seal for hash sealing on BCH. Our contribution: **the payer's own transaction picks the exam from a pre-committed list, and a covenant makes the start commitment a condition of payment, with unfinished runs counted as FAIL.**

---

## 12. Business case

**Pitch:** a proving ground for AI agent and tool makers.

| Revenue line | Price | Notes |
|---|---|---|
| Verified README badge | $49/month per agent+model row | ~48 scheduled runs/day; ~95% margin when run on the customer's own API key |
| Pay-per-run tickets | 20,000 sats | Marketing loop, not the business |
| Private attested runs | ~$0.25/run | Hash-only private task lists; speculative |

50 badges ≈ $2,450/month and ≈ 7,200 real BCH transactions/day. No customers yet: post in BCH BLAZE Telegram and two AI-tooling communities this week and quote only real replies. Do not lead the pitch with "$49/month".

---

## 13. BLAZE compliance checklist

| # | Requirement | Status | Owner / fix |
|---|---|---|---|
| 1 | Registered on DoraHacks, submitted on time | At risk (admin) | D: register today; draft Fri; final by 22 Nov 12:00 UTC |
| 2 | Judge makes a useful mainnet tx | Pass | The Run Ticket |
| 3 | Live one-click demo | At risk → pass | Replay hero, watchdog, spend cap, baseline agent fallback |
| 4 | WizardConnect or XO | Pass | WizardConnect primary; XO template for bounty |
| 5 | Original; prior work declared | Pass | Credits in README; repo created 17 Nov |
| 6 | Banner: deck, repo, EMBER2026 address | At risk (forgotten) | B: in layout component on day 1 |
| 7 | Confirmed real in Telegram | At risk (admin) | D: post today; pin GIF after first mainnet run |

## 14. Prize stack

**Apply for:** Mainnet Track, Media Track, Build with XO, TokenHunt, Community Choice.
**Do not apply for:** SolidCash, FoldingCash, Paytaca identity, PUSD bridge, Migrate to XO.

| Prize | Probability | Expected |
|---|---|---|
| Mainnet 1st / 2nd / 3rd | 9% / 13% / 16% | ~$630 |
| Media ($1,000) | 35% | ~$350 |
| Build with XO (0.3 BCH) | 45% | ~$28 |
| TokenHunt (pool share) | 70% if done | ~$100 |
| Community Choice ($750) | 4% | ~$30 |

Expected value ≈ $1.1–1.4k plus BLISS tickets; good case ≈ $2.6k; best ≈ $4.8k.

---

## 15. Day-1 go/no-go tests (decision Tue 17 Nov, 18:00 UTC / 23:30 IST)

| Test | Go if | Fallback |
|---|---|---|
| T1 RunTicket start (OP_RETURN prefix + outpoint introspection) and refund on Chipnet | Both paths broadcast | Require only `PR2S` prefix + taskRoot; indexer links by input |
| T2 Mainnet sizes/fees, 4 tx types | Standard, OP_RETURN ≤ 223 B, < 600 sats each | Trim harness digest to 20 B |
| T3 Exercism Python + Aider licences; selection script | Permissive; ≥ 60 tasks qualify | HumanEval (164 tasks), same commit scheme |
| T4 Aider + small model, 10 exercises in Docker | Median ≤ 120 s, ≤ $0.05/run, ≥ 1 PASS and ≥ 1 FAIL; ≥ 30 exercises with p90 < 60 s | Fast-lane subset; or deterministic baseline agent, disclosed |
| T5 WizardConnect Selene + Paytaca from the deployed URL on mobile | Both sign and broadcast | Paytaca-only, documented |
| T7 Browser → 2 public Fulcrum `wss` servers from deployed origin | Same header hashes on 20 heights | Own Fulcrum + one REST explorer, labelled |
| T8 Ticket → START latency in browser | p90 ≤ 15 s | 2 s polling; badge shows real latency |

**Switch to the runner-up (FoldPay) if any of:** T4 fails its run-time thresholds; T3 fails and HumanEval can't be scripted the same day; T1 fails a Chipnet start/refund round trip; cost > $0.10/run with the cheapest acceptable model.
**Soft check Wed 18 Nov 18:00 UTC:** no real mainnet Ticket → START → RESULT chain yet → cut to replay hero + baseline agent; do not switch.

---

## 16. Timeline

| Day | A (contracts/chain) | B (frontend/wallet) | C (harness/ops) | D (verify/PM/media) |
|---|---|---|---|---|
| Tue 17 | T1 on Chipnet | Scaffold, banner, WizardConnect (T5) | T3/T4, spend caps | DoraHacks + Telegram, payload spec, shared JS, T7 |
| Wed 18 | Mainnet deploy; anchor writer; T2 | Ticket flow, 0-conf display | Watcher → START → run → RESULT on mainnet; **first real chain** | Indexer; Verify 1–3 |
| Thu 19 | Refund on mainnet; edge cases; XO template | Run Chain UI, live transcript, replay hero | Scheduled runs; FAIL-on-missing; watchdog | Verify 4 + Reproduce; leaderboard; record Media video |
| Fri 20 | XO debug tool + write-up | Polish, mobile, empty/error states, faucet | Second model row; budget alarm | README, credits, business page, Telegram outreach |
| Sat 21 | **Feature freeze 12:00 UTC**; bug bash, 3 phones, 10 fresh-wallet tickets | Fixes | Uptime | Submissions drafted |
| Sun 22 | **Submit Mainnet + XO + Media by 08:00 UTC** | | Keep scheduled runs live through judging | Telegram post |

---

## 17. Two-minute demo script

- **0:00–0:15** "AI coding agents grade their own homework. On PassRate, you pay, and the Bitcoin Cash chain picks the exam." Replay hero playing; leaderboard visible with the missing = FAIL column.
- **0:15–0:35** Tap "Pay 20,000 sats and draw an exam" → Selene → one signature. Ticket card: "your txid + block #N → exercise 37, `book-store`."
- **0:35–0:50** START card: "We could not take your 4 cents without publishing this. If we never start, you reclaim it."
- **0:50–1:35 (wow)** Transcript streams; tests run; RESULT card ✅/❌, sealed on mainnet. Three linked transaction cards light up.
- **1:35–1:50** Verify: four green checks computed in your browser from public block data; "What this doesn't prove" on screen.
- **1:50–2:00** "Agent makers get a badge backed by chain-drawn runs that can't skip a failure. Credits: Cogitating, Gensyn Judge, Aider Polyglot."
- **Fallback:** if the live run is slow, the replay hero shows the last real run chain; the judge's receipt link shows the result when sealed.

---

## 18. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Agent runs too slow or flaky | Judges wait or see errors | p90 < 60 s judge pool; non-blocking UI; replay hero; baseline agent fallback |
| Covenant introspection doesn't compile as planned | Core claim weakens | T1 fallback: prefix-only check + indexer linking |
| Low-priority judging queue | Project not seen | Telegram buzz from day 2; Media video; shareable run links |
| Business seen as weak (Elliot) | Lower Business score | Badge wedge, customer-key margin, one real "would use" reply |
| Vendor terms / cost overruns | Runs stop | One vendor; hard spend caps; budget alarm |
| Public Fulcrum servers block browsers | Verify check 2 depends on us | Own Fulcrum + REST explorer, labelled |

## 19. Open items (UNVERIFIED)

Exercism and Aider licences and qualifying-task count; per-run time and cost; compiled RunTicket size and OP_RETURN-prefix introspection; Fulcrum `wss` origin policy; OpenAI/Google terms for publishing runs; XO 0.1.0-next stability; BCH price (~$208 on 16 Nov); the claim that no prior system combines payer-seeded draw with covenant-forced START.

---

## 20. v1.1 hardening — gaps found in final review and their fixes

| # | Gap | Severity | Fix (now part of scope) | Owner / day |
|---|---|---|---|---|
| 1 | Exercism exercises are public; models may have memorised them | High | **Fresh-exam lane:** write 20 new exercises in Exercism format; commit only their Merkle root in a MANIFEST before any run; reveal the files after the run window. Leaderboard shows Public and Fresh pass rates side by side | C writes tasks Wed–Thu; A adds lane flag to MANIFEST |
| 2 | Business is the weakest category | High | Lead with B2B: teams choosing an AI coding tool pay for verified runs on their own private, hash-committed tasks. README badge = self-serve tier. One real "I'd use this" reply screenshotted into the deck | D, Tue–Fri |
| 3 | Payer can double-spend a 0-conf ticket after the run starts | Medium | Watcher waits 2–3 s and checks for a double-spend proof before broadcasting START | C, Wed |
| 4 | One model row looks thin | Medium | Two model rows are **must-have**: one small/cheap, one stronger | C, Thu |
| 5 | Low-priority judging queue | High | Official escape route: join a team that completed roll call (ask in Telegram today); otherwise buzz via Media video and shareable run links | D, Tue |
| 6 | Transcript authenticity unprovable | Medium (honest limit) | Keep "What this does NOT prove"; stream transcript with timestamps; record provider request IDs where returned | C/D |
| 7 | Name clash with unrelated "passrate" repos | Low | Use **PassRate.cash** everywhere | All |
| 8 | EMBER2026 address must accept CashTokens | Low (fatal for Community Choice) | Token-aware `bitcoincash:z…` address in the banner | B, Tue |
| 9 | AI provider terms for publishing results | Medium | Launch with one provider whose terms have been read; non-affiliation note | C, Tue |
| 10 | Judge without BCH | Low | Rate-limited faucet (25,000 sats, 0.05 BCH cap); replay always visible | B, Fri |

### Updated must-have additions
- Fresh-exam lane (≥ 10 fresh tasks minimum, 20 target).
- Two model rows.
- Double-spend wait before START.
- Token-aware EMBER2026 address.

### Updated 30-second pitch
"AI coding agents grade their own homework. On PassRate.cash you pay 4 cents, and your payment plus a Bitcoin Cash block hash picks the exam from a list published in advance, including fresh exams no model has seen. A covenant won't let us take your money until we publicly commit that the run started, and every unfinished run counts as a fail. Watch the agent take the test live; the result is sealed on mainnet."

### Updated score estimate
| Category | v1.0 | v1.1 |
|---|---|---|
| Innovation | 6.5–8.5 | 8 |
| Design & usability | 7–7.5 | 7.5 |
| Technical | 7–7.5 | 7.5 |
| Business | 5–5.5 | 6 |
| **Per judge / total** | ~26–28 / ~78–86 | **29 / ~87 of 120** |
