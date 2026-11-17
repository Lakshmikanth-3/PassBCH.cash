# Status: what is real

Updated 17 Nov 2026. Network: **chipnet** until final submission, then mainnet.

| Part | Label | Notes |
|---|---|---|
| `RunTicket` covenant (`packages/feasibility/contracts/RunTicket.cash`) | **REAL** | Start and refund both broadcast on chipnet; early refund rejected by the network |
| Shared protocol code (`packages/shared`) | **REAL** | Encoding, draw, Merkle, Wilson CI, FAIL-on-missing; same code for server and browser |
| MANIFEST on chain | **REAL** | chipnet `90ec3d38…`, 141 exercises |
| Operator: ticket validation, START, RESULT, watcher (`packages/operator`) | **REAL** | Two full chains sealed on chipnet; the watcher found one by itself |
| Agent harness (`packages/harness`) | **REAL** | Own small harness (not Aider), Groq `gpt-oss-20b` / `gpt-oss-120b`, tests in Docker with no network |
| Run chain card on the site | **REAL** | Shows the latest sealed chipnet run; every txid links to an explorer |
| Leaderboard on the site | **REAL, thin** | Built from 2 ticket runs. Scheduled runs are not live yet |
| Banner | **REAL** | Deck link still missing |
| "Pay 20,000 sats" button | **NOT BUILT** | Disabled on the site; QR + WizardConnect flow is next |
| Replay hero | **NOT BUILT** | |
| Verify in browser | **NOT BUILT** | |
| Scheduled runs, fresh-exam lane | **NOT BUILT** | |
| Vite/React scaffold, CSS reset, Vercel config | **BOILERPLATE** | |

There are no mockups on the site. Anything not built is either disabled or absent.
