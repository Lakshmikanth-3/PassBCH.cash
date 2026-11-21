# Switching PassBCH.cash to mainnet (final submission only)

Chipnet until then. The switch is configuration only; no code changes.

1. **Fund the mainnet house wallet** (key in `keys/duel-mainnet.env`, never committed):
   `bitcoincash:qqf029whcssjtkpfkyfk5s2z4t9vawvkfcn56u84un`
   Budget: bonuses are paid from balances, but withdrawals and records are real BCH.
   100 bonus grants × 10,000 sats ≈ 0.01 BCH worst case, plus ~300 sats per duel record. **Send ~0.012 BCH.**
2. Replace the Vercel env vars (production) with the mainnet values: `HOUSE_SK`, `HOUSE_SECRET`, and add `DUEL_NETWORK=mainnet`.
3. Reset game data (chipnet balances must not carry over): `truncate deposits, withdrawals, duels, bonus_grants restart identity; delete from players where not is_house;`
4. Redeploy, then run `BASE=https://passbch-cash.vercel.app node duel/scripts-e2e.mjs` once (it withdraws to a mainnet address you set) and play one duel by hand from a phone with WizardConnect.
5. Update `packages/web/src/config.js` (`network: 'mainnet'`) so the banner pill disappears.
