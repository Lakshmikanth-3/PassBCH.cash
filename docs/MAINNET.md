# Switching PassBCH.cash to mainnet (final submission only)

Chipnet stays the default until you decide. The switch is configuration only; no code changes.
**Nothing here has been run.** No mainnet funds were spent and nothing was deployed to mainnet by the assistant.

## What changes with `BCH_NETWORK=mainnet`

| Setting | Chipnet | Mainnet |
|---|---|---|
| Electrum hosts | chipnet.bch.ninja, chipnet.imaginary.cash | bch.imaginary.cash, electroncash.dk, bch.loping.net |
| Address prefix | `bchtest:` | `bitcoincash:` |
| Explorer links | chipnet.imaginary.cash | https://blockchair.com/bitcoin-cash/transaction/ |
| Free bonus | 0.00025 BCH, 100 grants | **0.00002 BCH, 50 grants**, 3 per network address, 2x wagering |
| Quick stakes | 2,500 / 5,000 / 10,000 / 25,000 sats | **500 / 1,000 / 2,000 / 5,000 sats** (custom: 500 to 20,000) |
| "Upcoming BCH games" card | shown | hidden |
| Add funds: other crypto, bank/UPI tabs | shown (quotes only) | hidden (BCH only) |
| Network pill in the banner | shown | hidden |

`DUEL_NETWORK` (the older name) still works; `BCH_NETWORK` wins if both are set.

## 1. Vercel environment variables (Production)

| Variable | Value | Notes |
|---|---|---|
| `BCH_NETWORK` | `mainnet` | the one switch |
| `HOUSE_SK` | the mainnet house key (64 hex) from `keys/duel-mainnet.env` | never commit or print it |
| `HOUSE_SECRET` | a new random string | the bot seed and address hashing use it |
| `DATABASE_URL` | a **new, empty** Neon database (recommended) | keeps chipnet balances out of mainnet. Alternative: truncate the game tables. |
| `GROQ_KEY` | unchanged | |
| `DECK_URL` | your Widget Factory deck link | shows in the banner |
| `EMBER_ADDRESS` | optional; defaults to the EMBER2026 address already in the code | |

Then redeploy (`npx vercel --prod`).

## 2. Fund the house wallet

House address (mainnet): `bitcoincash:qqf029whcssjtkpfkyfk5s2z4t9vawvkfcn56u84un`

Budget: records cost about 300 to 400 sats each. Worst case free bonus is 50 x 2,000 sats = 0.001 BCH, but bonus credit is spent on games, not paid out of the wallet; withdrawals are real BCH. **About 0.002 BCH (about Rs 37) is enough for a demo; 0.005 BCH leaves room for judges.** The live check is on `/winners` and `/rules` (House solvency line).

## 3. One real game and one real withdrawal (manual, about 5 minutes)

Do not run `npm run e2e` on mainnet: it uses chipnet-only addresses and stakes.

1. Open https://passbch.vercel.app on your phone. Press **Play Rock Paper Scissors now**. Save the login code.
2. Play the House Bot with any stake. After the result, the **Verified on Bitcoin Cash** card shows the transaction id. Open the explorer link and `/verify/<txid>`. Put that txid in README under "Mainnet transactions".
3. Vault, **Add funds**, **WizardConnect** (Paytaca): send a small deposit, for example 0.0002 BCH. Confirm the balance rises.
4. Vault, **Withdraw**: your own mainnet address, at least 0.0001 BCH (10,000 sats). The fee is 5%. Only cash (deposited or won from cash) can be withdrawn, and the bonus must have been played 2x first.
5. Put the withdrawal txid in README too, and check `/winners` shows the solvency line as covered.

## 4. Rolling back

Set `BCH_NETWORK=chipnet` (or remove it), restore the chipnet `HOUSE_SK`, `HOUSE_SECRET` and `DATABASE_URL`, and redeploy.
