# Security policy

PassBCH.cash runs on Bitcoin Cash mainnet with real funds. Please report security problems privately.

## Reporting
Open a **private security advisory** on GitHub (Security → Report a vulnerability). Please do not open a public issue for anything that could put player or house funds at risk.

## Scope
- The API (`api/duel.mjs`) and game service (`server/`)
- Commit-reveal, settlement and on-chain records (`server/engine.mjs`, `server/chain.mjs`)
- The browser Verify page and the terminal client (`web/public/duel.mjs`, `packages/cli`)
- The XO escrow template (`xo/`, tested on chipnet)

## How secrets are handled
- No secret is stored in this repository. `.env`, `keys/` and wallet files are git-ignored and Vercel-ignored, and git history was scanned for keys, database URLs and Groq tokens before release.
- The house key, server secret, database URL and Groq key live only in Vercel's encrypted environment settings.
- Mainnet uses its own house key, its own secret and its own database, separate from chipnet testing.

## Known trust assumptions
Balances are custodial (a trusted operator), shown with a live solvency line on /winners and /rules. Results are not trusted: every result is written to the chain and recomputed by the Verify page.
