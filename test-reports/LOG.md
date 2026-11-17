# Test log

| Phase | Date (UTC) | Suite | Result | Raw report |
|---|---|---|---|---|
| 0 | 2026-11-17 | `packages/shared`: bytes, payloads, draw, merkle, stats | **50 / 50 pass** (Node 22.21.0) | [phase0-shared.txt](phase0-shared.txt), [junit](phase0-shared.junit.xml) |

## Phase 0 coverage
- **bytes:** the NIST SHA-256 "abc" vector, hex and uint round trips, and range checks.
- **payloads:** round trip for all 4 types through OP_RETURN; every script ≤ 223 B; documented sizes; the `PR2`+version+type prefix; rejection of missing fields, uncompressed keys, passed > total, bad lane/mode, uint overflow, bad magic/version/type/length, trailing bytes; direct push vs PUSHDATA1.
- **draw:** determinism, a golden vector, order sensitivity, separate scheduled and ticket seeds, a chi-square uniformity test (12,000 draws into 120 buckets), the scheduled-height rule, tip freshness.
- **merkle:** every proof verifies for n = 1, 2, 3, 5, 7, 8, 13, 120; rejection of wrong leaf, index, root or tampered and truncated proofs; no duplicate-leaf ambiguity; the leaf commits to every component.
- **stats:** Wilson CI checked against a reference value and edge cases; all 6 run statuses; leaderboard counts missing results as FAIL and excludes pending runs.
