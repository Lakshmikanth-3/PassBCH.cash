# PassRate.cash protocol v1 (Phase 0 spec, frozen 17 Nov 2026)

Reference implementation: `packages/shared` (same code runs on the server and in the browser).

## Encoding
- Every record is one output: `OP_RETURN <single push of payload>` (direct push ≤ 75 B, else `OP_PUSHDATA1`). Whole script ≤ 223 B.
- Payload header: `"PR2"` (3 B) · version `0x01` · type byte (`M`/`T`/`S`/`R`).
- Integers are unsigned little-endian. Hashes, txids and block hashes are 32 B in **display (explorer) hex order**.

| Type | Fields after header | Payload B |
|---|---|---|
| MANIFEST `M` | day u32 · lane u8 · taskCount u16 · taskRoot · harnessDigest · rosterHash · ruleVersion u8 | 109 |
| TICKET `T` | tipHeight u32 · tipHash · agentIdx u8 · **payerPk (33 B, compressed)** | 75 |
| START `S` | mode u8 (0 ticket, 1 scheduled) · ref (ticket txid or scheduled block hash) · refHeight u32 · taskRoot · taskIdx u16 · agentIdx u8 · modelIdx u8 · lane u8 (0 public, 1 fresh) · harnessDigest · deadlineUnix u32 · attemptPolicy u8 | 116 |
| RESULT `R` | startTxid · exit u8 · passed u16 · total u16 · testOutHash · transcriptHash · solutionHash · durationS u16 · costMilliUSD u32 | 144 |

## Changes from PRD v1.1 (fixes from the review)
1. **TICKET carries `payerPk`.** Every ticket has its own P2SH address (the contract is parameterised by `payerPk`), so the operator rebuilds the redeem script from the OP_RETURN. The watcher finds tickets by the `PR2…T` prefix, not by subscribing to an address.
2. **START gets `mode`, `refHeight` and `lane`,** so one record type serves ticket runs, scheduled runs, and the Public and Fresh lanes.
3. **The scheduled START deadline is `h+1`** (was `h+3`). This leaves less time for hidden pre-attempts.
4. **Tip freshness:** a ticket's `tipHeight` must be within 2 blocks of the tip when the ticket was first seen. Otherwise the run doesn't count.
5. Scheduled cadence `h % SCHEDULE_EVERY == 0` is a parameter (the value is chosen in Phase 1; see the open questions).

## Draw
- Ticket: `seed = SHA256(ticketTxid ‖ tipHash)`; scheduled: `seed = SHA256(blockHash(h) ‖ "S")`.
- `taskIdx = uint256(seed) mod taskCount`.

## Task Merkle tree
- `leaf = SHA256(0x00 ‖ len(slug) ‖ slug ‖ H(instructions) ‖ H(stub) ‖ H(tests) ‖ containerDigest)`
- `node = SHA256(0x01 ‖ left ‖ right)`. An odd last node is promoted unchanged, never duplicated.

## Run status (derivable from chain data alone)
| Condition | Status |
|---|---|
| Payer refunded the ticket | `REFUNDED_NO_SHOW` (shown publicly, not counted in n) |
| Scheduled height `h` with no START when the tip is past `h+1` | `FAIL_NO_SHOW` |
| START with no RESULT by `deadlineUnix`, or a late RESULT | `FAIL_TIMEOUT` (the "missing" column) |
| RESULT with `exit=0`, `total>0`, `passed=total` | `PASS` |
| Any other RESULT | `FAIL` |

Leaderboard: n, pass rate, Wilson 95% CI, missing, no-show, median ticket→START latency.
