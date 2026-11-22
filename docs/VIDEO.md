# 60 to 90 second demo video: shot list

Record the screen with the browser and a terminal side by side (OBS or the Windows Game Bar). Use two terminals for the friend duel. Narration in plain, short sentences. Aim for about 75 seconds.

| # | Time | Shot | Say |
|---|---|---|---|
| 1 | 0:00 to 0:08 | Claude Code in VS Code showing "Cogitating…" with the status line | "Every developer waits on their AI agent. That time is dead." |
| 2 | 0:08 to 0:14 | Status line changes to "Claude thinking 0:42, play now" | "PassBCH.cash fills it with a one-minute Bitcoin Cash game." |
| 3 | 0:14 to 0:22 | In the terminal paste `curl -sL passbch.vercel.app \| sh` (or the PowerShell line). The menu appears. | "One line in your terminal. No wallet, no sign-up form." |
| 4 | 0:22 to 0:40 | Menu `[1]`, then challenge a friend. The challenge box prints the invite commands. | "I challenge a friend and send them one command." |
| 5 | 0:40 to 0:55 | Second terminal: paste the friend's command. It opens straight into the duel; pick a move; the hands shake and reveal. | "My friend joins from their own terminal. Moves are hidden by a hash until both are locked." |
| 6 | 0:55 to 1:05 | The result: "YOU WIN". Then open the browser at the result's Verified card. | "I win. And the result is not just a message." |
| 7 | 1:05 to 1:20 | Browser: **Verified on Bitcoin Cash**, the transaction id, the explorer, then `/verify/<txid>` showing the checks passing | "It is a public Bitcoin Cash transaction. Anyone can recompute the winner. Nobody, not even me, can edit it." |
| 8 | 1:20 to 1:30 | `/winners` with the House solvency line, then the banner with the GitHub and EMBER2026 links | "Winners, a live solvency check, and every game provable. PassBCH.cash." |

Tips:
- Have a funded guest account ready so the stake never fails.
- If recording on mainnet, use the smallest stake (500 sats).
- Show the Up or Down chart for two seconds if there is time (real Coinbase prices, 1m to 5Y ranges).


## Shortcut: replayable terminal demo
`docs/demo/terminal-demo.html` plays a real recording of the terminal client. Open it in a browser, press Play and screen-record that window for shots 3 to 7. `npm run demo:record` makes a fresh recording.
