# Deck text for the BLAZE "Widget Factory" template

One idea per slide. Replace the numbers in brackets when you have them.

## Slide 1: Title
**PassBCH.cash**
Play a one-minute Bitcoin Cash game in your terminal while Claude Code is thinking. Every result is proven on-chain and anyone can verify it.
Live: https://passbch.vercel.app · GitHub: https://github.com/Lakshmikanth-3/PassBCH.cash

## Slide 2: Problem
- Developers wait on AI agents many times a day: "Cogitating…" for 30 seconds to 3 minutes. That time is dead.
- Online games ask you to trust the house: did the opponent see my move? Was the price picked after my bet? Was the result edited?

## Slide 3: Solution
Five quick games you can play from the terminal or the browser:
1. **Rock · Paper · Scissors** (commit-reveal, vs the House Bot or a friend)
2. **Up or Down** (the next minute of the BCH price, real Coinbase trades)
3. **Prompt Fight** (your prompt trains an AI agent that fights another one)
4. **Coin Flip** (house seed committed first, your seed added)
5. **Typing Race** (beat the House Bot, server-timed)
Each finished game is written to Bitcoin Cash as a public record.

## Slide 4: Demo (screenshot or 20 s clip)
- One click on the landing page: "Play Rock Paper Scissors now"
- Result card: **Verified on Bitcoin Cash ✓**, transaction id, explorer link
- Terminal: `irm https://passbch.vercel.app | iex` or `curl -sL passbch.vercel.app | sh`
- Claude Code status line shows the live round while Claude works

## Slide 5: Why Bitcoin Cash
- Fees below a cent: every game result is its own transaction (about 300 sats).
- Fast and simple payments: one-minute games with real BCH deposits and withdrawals.
- `OP_RETURN` records: 38 to 59 bytes hold the moves, prices and hashes anyone can decode.
- WizardConnect: players deposit from their own wallet (Paytaca) without sharing keys.

## Slide 6: How it works
- **Commit-reveal:** you send `sha256(move:salt)`; the opponent plays blind; you reveal; the hash must match. No reveal in 2 minutes means you forfeit.
- **Exact-second prices:** entry = the public Coinbase trade at the second you bet; exit = exactly 60 seconds later.
- **No AI judge:** Prompt Fight rules are enforced by code; each agent sees only its own prompt; the first mover is a commit-reveal coin flip.
- **Verify:** the browser fetches the raw transaction, decodes the record and recomputes the result.

## Slide 7: Proof and traction
- 62 automated tests passing; live end-to-end script 13 of 13; live browser test 27 of 27.
- Real transactions on chipnet for every game type (see README evidence table).
- Mainnet: [first mainnet game txid] · [first mainnet withdrawal txid]
- [N] players, [N] games played, [N] on-chain records.

## Slide 8: Business model
- House edge on Up or Down: pays 1.9x (5%).
- 5% fee on withdrawals.
- Sponsored AI-model tournaments (a lab or tool pays the prize pool).
- Dev-tool integrations: a status-line panel for Claude Code and other agent terminals.

## Slide 9: Honest limits
- Balances are custodial (trusted operator); results are provable, balances are not.
- 18+; real-money games are regulated in many countries; check local law.
- Live house solvency (wallet balance vs what players could withdraw) is shown on /winners.

## Slide 10: Roadmap
- Non-custodial Rock · Paper · Scissors covenant: both players lock stakes from their own wallet; the contract pays on matching reveals and refunds on timeout.
- XO template port of the RPS escrow.
- Mainnet tournaments and sponsored prize pools.

## Slide 11: Team
[Your name], solo builder. Code written during BLAZE, from 17 Nov 2026 (first commit linked in the banner).
Vote with EMBER2026: bitcoincash:zrcvv9gjvgeeh6gesa2t3q0z40n3uzxwhua3m6rsyf
