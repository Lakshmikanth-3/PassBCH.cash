# Phase 1: feasibility results (17 Nov 2026)

Verdicts reflect what was run here (offline VM, public Fulcrum, local clone). Nothing has been broadcast yet.

| Test | Verdict | Evidence | Still open |
|---|---|---|---|
| T1 RunTicket | **Partial pass** | Compiles to a 173 B redeem script (`packages/feasibility/contracts/RunTicket.cash`). 10 tests in the local VM: valid START passes; wrong txid, un-reversed txid, wrong taskRoot, scheduled mode, START not at output 0, wrong sig, and no-OP_RETURN all fail on the intended `require`; refund fails at age 5 and with the operator key, passes at age 6 with the payer key. | **Chipnet broadcast of start + refund** needs funded chipnet coins (faucet). `OP_REVERSEBYTES` is accepted by the local VM; confirm the node accepts it. |
| T2 sizes/fees | **Pass (built, not broadcast)** | MANIFEST 306 B, TICKET 315 B, START 455 B, RESULT 341 B, REFUND 327 B; all < 600 sats at 1 sat/B; OP_RETURN scripts ≤ 119 B (limit 223). [t2-sizes.txt](t2-sizes.txt) | Mainnet relay of the four types. |
| T3 tasks and licences | **Pass** | `exercism/python` @ `479f11b4` is MIT; 141 of 142 practice exercises pass their own tests with the reference solution in < 30 s (excluded: `parallel-letter-frequency`, 31.2 s). [json](t3-task-selection.json) | Ran on Python 3.14 locally, not a clean `python:3.12` container (Docker daemon is not running here). Re-run with Docker. Aider's `polyglot-benchmark` repo has no LICENSE file; we use Exercism directly and do not depend on it. |
| T4 agent speed/cost | **Not run** | | Needs a model API key, a spend cap and Docker. |
| T5 WizardConnect | **Not run** | | Needs a deployed URL, a phone, Selene and Paytaca. |
| T7 Fulcrum wss | **Server half pass** | 3 of 4 public servers reachable from Node; two compared on 20 heights: 20/20 identical header hashes. [t7-fulcrum-node.txt](t7-fulcrum-node.txt) | **Browser half**: run from the deployed origin to check CORS/origin policy. |
| T8 ticket→START latency | **Not run** | | Needs the watcher and a live ticket. |

## T1 on chipnet (17 Nov 2026), real network
| Step | Result | Txid |
|---|---|---|
| Ticket → RunTicket covenant `bchtest:pvuxp4ku9wn0grvmxkh8gecgyxfcdz6y5f2wyr4yzupdq7mtuhmjge08x8emq` | ✅ broadcast | `1eadee28704a8a20ea603d6bd28aeacc7f22e7fa070de39b676f01cff578a18a` |
| **START spending the ticket via covenant** (`OP_REVERSEBYTES` accepted by the node) | ✅ **accepted** | `599a8cbc9ab957a28d94fe48bba55622e72796c7f8273d42fdb5a74d27477843` |
| Refund ticket | ✅ broadcast | `09a445af12ae6d13810a71d618261664ad69aafcbb624cce5cd2afc618400baa` |
| Refund before 6 blocks | ✅ **rejected by network** (`non-BIP68-final`, code 64), as intended | n/a |
| Refund after 6 blocks | ⏳ waiting for confirmations | |

Funding: chipnet faucet → `bchtest:qzmuv37ealgxg3cm3t9vqawusm6q4t5wysv50yfxkn` (`98f6499d…e6af:1`, 335,032 sats).

## Spec findings from T1
- `START.ref` is in explorer order and the covenant sees the outpoint hash in internal order, so the contract reverses it with `OP_REVERSEBYTES`. This costs 1 opcode and works; keep it.
- The covenant pins START to exactly 119 B, mode 0, output 0, with `ref` at script offset 9 and `taskRoot` at 45. If the START layout in `docs/PROTOCOL.md` changes, update those constants.
- It does not check `refHeight`, `taskIdx` or `deadlineUnix`. The draw is verified by the indexer and the browser, not the covenant.
