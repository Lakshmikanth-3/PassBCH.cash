# Demo video

**Final video:** https://youtu.be/Or1W7viUzTI · file `docs/demo/passbch-demo-mainnet.mp4` (2:50, voice-over, no music). **Every game is played on Bitcoin Cash mainnet.**

| Scene | What you see |
|---|---|
| The problem | VS Code with Claude Code "Cogitating…", the developer waiting |
| How Bitcoin Cash earns | one game = one transaction; miners earn fees; 5% platform fee on withdrawals |
| Right next to Claude Code | PassBCH in the same VS Code window |
| `npx passbch` | one command in any terminal |
| Rock · Paper · Scissors | vs the House Bot, draw, verified (`acf4720b…`) |
| Up or Down | UP for 60 s on the real BCH price, win, verified (`48667e3f…`) |
| Coin Flip · Typing Race | win, verified (`0e469567…`) |
| Leaderboard and Verify | the terminal recomputes a result from the chain |
| On the web | a new player's Coin Flip, Verified ✓ on mainnet |
| Mainnet proof | `c1e08e25…` confirmed in block 978,468 |
| Judges | verify it in under 2 minutes |

Older notes on how earlier cuts were made follow below.

## Shortcut: ready-made terminal video
`docs/demo/terminal-demo.mp4` is a 38-second video of the real terminal client (logo, one-key guest start, Coin Flip, Typing Race, Winners with solvency, Verify). Use it for shots 3 to 7, or add your own voice-over.

## Shortcut: replayable terminal demo
`docs/demo/terminal-demo.html` plays a real recording of the terminal client. Open it in a browser, press Play and screen-record that window for shots 3 to 7. `npm run demo:record` makes a fresh recording.
