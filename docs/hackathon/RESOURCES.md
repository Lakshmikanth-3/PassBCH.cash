# BCH BLAZE 2026: imported resources (fetched 17 Nov 2026)

Raw page copies are in this folder: `detail.md`, `resources.md`, `bounties.md`, `bounty-build-with-xo*.md`, `bchblaze-*.md`.

## Key facts
- **Deadline:** 22 Nov 2026, 14:00 UTC. Judging runs 23–27 Nov; winners announced 28 Nov.
- **Mainnet prizes:** 1st $3,500, 2nd $1,500, 3rd $750 (all in PUSD), plus BLISS 2027 tickets. Media prize: $1,000. Community Choice: $750. TokenHunt pool: $250.
- **Judges:** Elliot Price (BCH Bull), Kallisti (Selene), Sayoshi Nakamario. Each scores 4 categories × 10 points, 120 points total.
- **Judges spend "a couple of minutes" per project by default.** Bugs, confusing flows or mockups lose them fast.
- **Roll call is closed.** Without it the project goes in the low-priority queue. The two ways out are buzz on social media or joining a team that did roll call.

## Mainnet track requirements (what we must have)
1. Anyone can make a useful BCH mainnet transaction through the app. For us, that's the Run Ticket.
2. A live demo that opens from a single link.
3. The project is original, with any pre-existing work declared in the banner.
4. **A top-of-page banner** with: a link to a Widget Factory deck ([template](https://docs.google.com/presentation/d/1Yfuk9CJkf4U9M_WukcELhumWgj3Ak6345Ewy8hSp-Hk/edit?usp=sharing)), the repo link, and a **CashTokens address for EMBER2026**.
5. A WizardConnect or XO integration.
6. Confirmation in [Telegram @bchblaze](https://t.me/bchblaze) that the project is real.

## Build with XO bounty: 0.3 BCH × 10 winners
Requirements: a working XO template, a Chipnet or mainnet transaction made through an invitation that can be inspected in the [debug tool](https://blaze.xo.cash/), follow-up actions where applicable, and the template plus invitation with steps to reproduce them. **The ~500-word feedback must be written personally by a team member. AI-written feedback is rejected.**

## Dev resources to use
| Need | Resource |
|---|---|
| Covenant (`RunTicket`) | [CashScript docs](https://cashscript.org/docs/), [covenants guide](https://cashscript.org/docs/guides/covenants), [Playground](https://next-cashscript-playground.netlify.app/) |
| Transaction building and anchors | [Libauth](https://libauth.org/), [mainnet.cash](https://mainnet.cash/) |
| Wallet connection (React) | [BCH Connect](https://github.com/fran-dv/bch-connect), CashScript WizardConnect guide |
| XO | [stack.xo.cash](https://stack.xo.cash/), [getting started](https://stack.xo.cash/getting-started.html), [@xo-cash on npm](https://www.npmjs.com/org/xo-cash) (latest `0.1.0-next.*`), [templates](https://gitlab.com/GeneralProtocols/xo/templates), [workshop](https://www.youtube.com/live/MuWEHO5Ufrk) |
| Chipnet coins | [tbch.googol.cash](https://tbch.googol.cash/), [chipnet.bch.ninja](https://chipnet.bch.ninja/) |
| Protocol and spec reference | [documentation.cash](https://documentation.cash/), [consensus.cash/upgrades](https://www.consensus.cash/upgrades) |
| Help | [General Protocols TG](https://t.me/generalprotocols), [DEEPCASH (BCH AI) TG](https://t.me/DEEPCASH_BCH), [Info session video](https://www.youtube.com/watch?v=9qudgWloY1g), [Kickoff and judge tips](https://www.youtube.com/watch?v=xWdo27QvzCo) |

## TokenHunt (to claim the $250 pool share)
Collect 9 tokens on [bchblaze.cash/tokenhunt](https://bchblaze.cash/tokenhunt/). Several match work we already plan: #1 Paytaca Pioneer, #2 Template Titan (XO), #3 Selene Sorcerer, #9 BLAZE Builder.

## Impact on our plan
- PRD prize figures are confirmed. XO is 0.3 BCH per winner.
- New task: a person writes the XO feedback themselves. Owner: A, Fri 20.
- Resources say "build and test on Chipnet; on mainnet use only minimal funds". That matches our plan: Phase 1 on Chipnet, 20,000-sat tickets on mainnet.
- BCH Connect is a candidate for WizardConnect in React. Evaluate it in T5.
