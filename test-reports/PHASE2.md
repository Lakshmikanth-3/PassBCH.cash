# Phase 2: first real Ticket → START → RESULT chain (17 Nov 2026, chipnet)

## On-chain results (all chipnet; explorer: chipnet.imaginary.cash)
| Step | Txid |
|---|---|
| MANIFEST (141 tasks, root `d7a58d5e6f06374a36ee96d37cb818e564ab724878c0ea6da6fbcb53c37a886a`) | `90ec3d389d9424510ccc69c1fceba7f7f8dc5c932cd9d97fa032f72affe04704` |

| Run | Ticket | START | RESULT | Outcome |
|---|---|---|---|---|
| #1 (CLI e2e, gpt-oss-120b) | `d973858e0a94862d7327376e2428b316e0b3854852c733d887116428d02e346a` | `b23ab5c8789931d4da43cd5c9e69078e5ef557a41430f643b606b2ba1c9f8fc0` | `79a6a54f2477a3b1eb9ed6fb70d84a50e11f4529f95b181920132b550f185eb4` | `sieve` (#115) PASS 5/5; START 14.9 s after the ticket was seen; 38 s ticket→RESULT |
| #2 (**watcher discovered on-chain**, gpt-oss-20b) | `5828a6a8f34feb81a56978eb2efbc0f3697e01f7a40204458bc343d54e664b14` | `f22a917873adcaf4452831fc557eace79d30c52ab04b4ee954c3fce1b08207bc` | `0b84aba9bfce6c39ce9e6f62da13b4ce6fed9f752acb9dcdeee37a2d666a7819` | `spiral-matrix` (#119) PASS 6/6; START 11.3 s after seen |

## Independent chain verification (from raw chipnet txs): 7/7 pass
See [phase2-chain-verify.txt](phase2-chain-verify.txt): START spends ticket:1 and names it; RESULT spends START:1 and names it; START commits the published MANIFEST root; the task index recomputed from txid + tipHash equals START's; RESULT records PASS 5/5.

## Watcher
Discovers tickets through a 546-sat notify output to the operator inbox (no website needed). On its first scan it correctly **rejected** the two Phase 1 test tickets, which were built for a different task root. [log](phase2-watcher.txt)

## Test suites
| Suite | Result |
|---|---|
| `packages/operator`: ticket layout/validation, START covenant (VM-evaluated), RESULT linking, MANIFEST | **17 / 17** [report](phase2-operator.txt) |
| `packages/web`: banner compliance, real run chain, verdict, FAIL-on-unsealed, leaderboard, rowsFrom | **14 / 14** [report](phase2-web.txt) |

## Design change made in Phase 2
- **TICKET adds output 2: 546 sats to the operator inbox.** Each ticket has its own covenant address, so this is how the operator finds tickets on-chain. Recorded in `docs/PROTOCOL.md`.

## Open (rest of Phase 2)
- Browser wallet flow (WizardConnect / Paytaca): pay a real ticket from a phone (T5).
- T8: START latency is 11–15 s, at the edge of the 15 s p90 target. Reduce by reusing the Electrum connection and skipping redundant lookups.
