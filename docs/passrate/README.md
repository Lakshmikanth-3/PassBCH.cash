# PassRate.cash

> Insert coin. The chain picks the exam. AI agents can't hide a failure.

Built for BCH BLAZE 2026 (Mainnet Track). Independent; not affiliated with any AI vendor or Exercism.

## How it works
1. You pay a 20,000-sat **Ticket**. Your txid plus a Bitcoin Cash block hash picks an exercise from a task list committed on-chain beforehand.
2. A covenant stops the operator from collecting the ticket until it publishes a **START** record naming it.
3. An AI agent attempts the exercise live, and the **RESULT** is sealed on mainnet. A started run with no result counts as a FAIL.
4. **Verify** recomputes everything in your browser from public chain data.

Protocol: [docs/PROTOCOL.md](docs/PROTOCOL.md)

## Status
| Phase | Scope | Status | Tests |
|---|---|---|---|
| 0 | Protocol spec + shared codec, draw, Merkle tree, stats | ✅ Done | 50/50 ([log](test-reports/LOG.md)) |
| 1 | Feasibility tests T1–T8 | 🟡 T1 ✅ chipnet, T4 ✅ (Groq, 2 models), T2–T3, T7 partly done; T5, T8 open | 10/10 contract tests ([report](test-reports/PHASE1.md)) |
| 2 | First Ticket → START → RESULT (chipnet first) | 🟡 Chain + watcher done; wallet flow next | 17/17 operator, 14/14 web ([report](test-reports/PHASE2.md)) |
| 3 | Core product | ⏳ | |
| 4 | Polish and business | ⏳ | |
| 5 | Freeze + bug bash | ⏳ | |
| 6 | Submit | ⏳ | |

## Proof (filled in as each item exists)
| Item | Value |
|---|---|
| Live demo (chipnet build) | https://passrate-cash.vercel.app |
| RunTicket contract address / redeem script | _TBD_ |
| First MANIFEST txid (chipnet) | `90ec3d389d9424510ccc69c1fceba7f7f8dc5c932cd9d97fa032f72affe04704` |
| First Ticket → START → RESULT (chipnet) | `d973858e…346a` → `b23ab5c8…8fc0` → `79a6a54f…5eb4` (`sieve`, PASS 5/5) |
| Scheduled runs sealed | _TBD_ |
| EMBER2026 token-aware address | _TBD (needed from team)_ |
| DoraHacks BUIDL page | _TBD_ |
| Widget Factory deck | _TBD_ |
| Demo video | _TBD_ |

## Repo layout
- `packages/shared`: isomorphic protocol code (encode/decode, seed → task, Merkle, Wilson CI, FAIL-on-missing)
- `docs/`: protocol spec
- `test-reports/`: recorded test runs

## Run the tests
```
cd packages/shared && npm install && npm test
```

## Credits and prior work
Cogitating (NEAR), Gensyn Judge, "Who Verifies the Benchmark?" (arXiv 2608.07762), Foresight Arena, Metaculus, Aider Polyglot / Exercism, Release Seal. See PRD §11.
