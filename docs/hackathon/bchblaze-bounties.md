Title: Bounties · BCH BLAZE 2026

URL Source: https://bchblaze.cash/bounties/

Markdown Content:
[![Image 1: BCH BLAZE](https://bchblaze.cash/assets/logo-mark.webp)BCH BLAZE](https://bchblaze.cash/)[Home](https://bchblaze.cash/)

The Forge ▾

[Getting Started First things first](https://bchblaze.cash/forge/)[Schedule The full BLAZE 2026 timeline](https://bchblaze.cash/schedule/)[Live Watch streams & join the chat](https://bchblaze.cash/live/)[Bounties Sponsor challenges & rewards](https://bchblaze.cash/bounties/)[TokenHunt A CashToken treasure hunt](https://bchblaze.cash/tokenhunt/)

Proof of Work ▾

[Archive Learn from BLAZE 2025 materials](https://bchblaze.cash/archive/)

Sponsors ▾

[Information Sponsor BLAZE or offer a bounty](https://bchblaze.cash/sponsors/)[Investing First access to BLAZE startups & alumni](https://bchblaze.cash/investing/)

[Register on DoraHacks](https://dorahacks.io/hackathon/bchblaze2026)

Connect wallet

☰

![Image 2](https://bchblaze.cash/assets/hero-bounty.webp)

The Forge · Bounties
# Bounties

Sponsor-listed challenges with real rewards. Pick a bounty, ship it during BLAZE, and claim the prize. Sponsors — list a challenge and put builders to work.

The Board Browse open bounties Bounty Rules How it all works List a Bounty For sponsors

The Board

## Open bounties

Total on offer

11.5 BCH+ $1,250 PUSD+ 26M FLDCH

Across

6 bounties

Sort

Most recent Oldest

Category

All Stablecoins Identity Templates Smart Contracts

Sponsor

All BCH BLAZE General Protocols Paytaca mainnet_pat FoldingCash

Showing 6 of 6 bounties

![Image 3: FoldingCash logo](https://bchblaze.cash/assets/bounty-foldingcash.webp)

BLAZE 2026 Bounty Smart Contracts

### [Trust-minimized, pull-based reward claims for FoldingCash](https://bchblaze.cash/bounties/foldingcash-reward-claims/)

26M FLDCH

Replace FoldingCash’s trusted monthly token pushes with pull-based claims: an on-chain Merkle root of earned rewards, and a pool contract users claim from with a proof, whenever they choose.

Prize

26,000,000 FLDCH

FoldingCash CashTokens

Sponsored by

FoldingCash

Miguel Molina Jr (StrungSafe) · [folding.cash](https://folding.cash/)

Contact

Telegram [@strungsafe](https://t.me/strungsafe) · Discord strungsafe

#### Summary

FoldingCash currently pays Folding@home contributors through trusted monthly distributions. This bounty asks builders to replace them with user-initiated claims that anyone can verify: the operator publishes a Merkle root of earned rewards on-chain, and each user withdraws their share with a proof, whenever they choose. Claim cost no longer grows with the number of users, and the operator has to be trusted far less.

#### Background

Folding@home (F@H) is a volunteer distributed-computing project. People donate spare CPU/GPU time to simulate protein behavior for disease research, and F@H tracks each contributor’s points. Site: [foldingathome.org](https://foldingathome.org/)

FoldingCash (FLDCH) is a CashToken on Bitcoin Cash that rewards F@H contributors in proportion to their folding. It continues the idea behind the earlier Counterparty-era FoldingCoin (FLDC).

#### Resources

Website[folding.cash](https://folding.cash/)API[api.folding.cash](https://api.folding.cash/)Repositories[github.com/foldingcash](https://github.com/foldingcash)Token explorer[FLDCH on tokenexplorer.cash](https://tokenexplorer.cash/?tokenId=0adb865ee9cc3038de87fba682e6cd361414edc9acff0da2fd0690d75341c640)Token category`0adb865ee9cc3038de87fba682e6cd361414edc9acff0da2fd0690d75341c640`F@H stats source[daily_user_summary.txt.bz2](https://apps.foldingathome.org/daily_user_summary.txt.bz2)

#### How it works today

*   **Linking.** A folder updates their F@H username to a token-enabled BCH address, or to the pattern `{name}_{address}`. The address is then public in F@H’s own data, so anyone can see which address a user chose.
*   **Data.** The FoldingCash API server downloads F@H’s public daily stats file once a day. Download frequency could be increased.
*   **Rewards.** Rewards are released on a per-block schedule and split proportionally by each user’s share of all contributed points, among users who meet the inclusion requirement: their F@H name carries a token-enabled BCH address as described in step 1.
*   **Payout.** About once a month, the operator sends tokens to every eligible user.

#### Planned: compatibility linking

The token-enabled BCH address in the username remains the preferred method. To let users keep their preferred F@H name, FoldingCash plans compatibility methods for ETH, legacy BTC and plain cashaddress. These are not built yet.

*   The API will issue a one-time nonce to authorize each link or update.
*   Control of the external address is proven with an off-chain signature. On-chain BCH actions are an alternative being considered for verification.
*   FoldingCash will store the mapping and return the BCH address from the API.
*   Linking will lag by up to a day with the current download schedule.

#### The problem

Users must trust the operator, and the cost of paying everyone forces slow, infrequent payouts.

*   **Trust.** Users rely on the operator to read the F@H data correctly, apply the reward formula correctly, and send what they are owed. None of this can be verified on-chain today.
*   **Scaling and dust.** Push cost grows with users × distributions. In the FoldingCoin era, dust became worth more than the rewards for many users. FoldingCash contains costs with monthly drops, which delays everyone’s access to their funds. Monthly pushes also reflect historical choices and infrastructure that do not apply to this project.

#### Goal and proposed design

**Goal:** replace trusted monthly pushes with verifiable, user-initiated claims whose cost does not grow with the number of users, so rewards are available sooner. FoldingCash remains the oracle for F@H data. The design below is a starting point, and builders may propose better ones.

daily F@H data → rewards computed → Merkle root of cumulative entitlements committed on-chain → user requests claim → Merkle proof → user’s transaction withdraws tokens

#### Requirements

*   **Root publication.** FoldingCash publishes a Merkle root of (address, cumulative earned) per epoch.
*   **Pool contract.** Holds the reward tokens and verifies the proof on each claim. Funds have no expiry, so users can claim whenever they like.
*   **Double-claim prevention.** BCH has no global contract state, so the likely approach is a per-user receipt NFT created at first claim, with the claimed total in its commitment.
*   **Root-update timelock.** A new root becomes claimable only after a delay, so watchers can audit it first.
*   **No claim threshold, user-funded dust.** A user can claim any amount at any time. The claiming user supplies the dust their tokens need, which is the fee the operator pays today when pushing, so the operator’s cost per user drops to zero. The operator’s optional push path keeps a minimum push threshold.
*   **Reference transaction-building code and a demo.** A chipnet demo with a few hundred leaves, plus a cost comparison against the current push model.

#### Infrastructure

The monthly push exists partly because supporting infrastructure does not exist yet. Builders may include any of the following:

*   A proof-serving endpoint (an extension of the existing API, or a static file host) so wallets can fetch a user’s proof.
*   A simple claim UI or CLI.
*   **Optional auto-claim.** A user opts in, and a relayer submits the claim once their balance crosses a threshold they choose. Funds can only go to the user’s own address, so the model stays non-custodial.

#### Stretch goals

*   Cumulative-only roots, so a new root supersedes the old one and users can skip epochs.
*   A watcher that recomputes the root from the public F@H daily file and flags mismatches. This needs each epoch’s input snapshot (or its hash) to be published alongside the root.
*   Independently verifiable links for compatibility users. Publish each link’s evidence (signature, nonce, and any on-chain action) or a commitment to it alongside the root, so a watcher can verify the mapping without trusting FoldingCash’s database. Builders should propose the mechanism.
*   An optional operator push path, available only after a long timelock and subject to a minimum push threshold.
*   Analysis of Merkle depth and VM limits for the target user count.

#### Open questions for builders

Proposals for these are part of what makes a strong submission.

*   **Epoch cadence.** Daily, weekly or monthly roots.
*   **Scale.** The maximum number of leaves the design must support.
*   **Root authority.** A single operator key, or multisig / threshold updates.
*   **Receipt NFT.** The commitment layout.
*   **Leaf contents.** Whether each leaf should record which linking method produced its address, so a watcher knows which entries it can verify from public F@H data and which depend on FoldingCash’s mapping.
*   **Link verification.** Whether compatibility links are verified off-chain with signatures or through on-chain BCH actions.

#### Trust boundaries

This bounty makes the operator’s output auditable; it does not remove the operator. These parts remain trusted in the initial version:

*   The F@H daily stats file is taken as given.
*   FoldingCash applies its inclusion requirements.
*   For users of the planned compatibility methods, FoldingCash’s stored mapping is a trust point. Users who put a BCH address in their F@H username today are fully verifiable from F@H’s public data.

The root-update timelock and the watcher exist to make mistakes in these steps visible before funds move.

#### Success criteria

A submission succeeds when it delivers working contracts, transaction-building code and a chipnet demo covering the required items above, with documentation another BCH developer could extend. Stretch items strengthen a submission but are not required.

#### Sponsor contact

Miguel Molina Jr (StrungSafe), creator of FoldingCash.

*   Telegram: [@strungsafe](https://t.me/strungsafe)
*   Discord: strungsafe

Available for questions during the hackathon (November 14–22). Brief, specific questions are welcome, and he would like to keep working with builders after the event.

[Full details →](https://bchblaze.cash/bounties/foldingcash-reward-claims/)[Contact on Telegram →](https://t.me/strungsafe)[FoldingCash on GitHub](https://github.com/foldingcash)[Bounty rules](https://bchblaze.cash/bounties/#panel)

![Image 4: SolidCash logo](https://bchblaze.cash/assets/bounty-solidcash.webp)

BLAZE 2026 Bounty Smart Contracts

### [Best SolidCash Application](https://bchblaze.cash/bounties/best-solidcash-application/)

3.5 BCH

Build a Solidity smart contract that compiles natively to BCH with SolidCash, and runs on mainnet.

BCH prize

3.5 BCH

1st 2 BCH · 2nd 1 BCH · 3rd 0.5 BCH

Sponsored by

mainnet_pat

[x.com/mainnet_pat](https://x.com/mainnet_pat)

Contact

Telegram [t.me/mainnet_pat](https://t.me/mainnet_pat)

#### Summary and requirements

*   SolidCash is a new framework for compiling EVM’s Solidity smart contract programming language natively on BCH. To promote the project and introduce it to a wider circle of talents we offer a bounty of: 2 BCH for the best project, 1 BCH for 2nd place and 0.5 BCH for 3rd place. Judged by regular hackathon judge committee.
*   Applicants are incentivized to develop the smart contract which is deployable and runnable on BCH mainnet, uses most of the SolidCash features and syntax variety. They are expected to use AI and fix all the findings they are experiencing with SolidCash and contribute back to the mainline repository [github.com/solidcash/solidcash](https://github.com/solidcash/solidcash) in form of Pull Requests.
*   Focus is on the smart contract, not on the web app UI, but UI shall be usable to demonstrate the contract lifecycle and capabilities.
*   Porting existing EVM projects is allowed and encouraged, using solidhat environment to test the contracts is mandatory, untested code does not demonstrate much value to the judges.

[Full details →](https://bchblaze.cash/bounties/best-solidcash-application/)[Contact on Telegram →](https://t.me/mainnet_pat)[SolidCash on GitHub](https://github.com/solidcash/solidcash)[Bounty rules](https://bchblaze.cash/bounties/#panel)

[![Image 5: Decentralized Identity bounty artwork](https://bchblaze.cash/assets/bounty-decentralized-identity.webp)](https://bchblaze.cash/assets/bounty-decentralized-identity.webp)

BLAZE 2026 Bounty Identity

### [Decentralized Identity](https://bchblaze.cash/bounties/decentralized-identity/)

$500 PUSD

Build a proof of concept for self-sovereign identity that cryptographically links Bitcoin Cash and Nostr identities.

BCH prize

![Image 6: PUSD](https://bchblaze.cash/assets/sponsor-paryonusd.webp)$500 PUSD

Sponsored by

![Image 7: Paytaca](https://bchblaze.cash/assets/sponsor-paytaca.webp)Paytaca

[paytaca.com](https://www.paytaca.com/)

Contact

Telegram [Paytaca group](https://t.me/PaytacaWalletApp/16452)

#### Summary

Digital identities depend too heavily on centralized platforms. Nostr offers public-key identities, signed events and independent relays; Bitcoin Cash offers programmable transactions and cryptographic commitments. Combined, they can power self-sovereign identities that work across applications.

#### Requirements

The proof of concept should demonstrate:

1.   **Identity creation & management.** Users hold their own keys and link a BCH wallet identity with a Nostr identity, with no centralized identity provider or custodial service.
2.   **Cryptographic identity binding.** A verifiable link between the BCH and Nostr identities, backed by proofs of control over both, without exposing private keys or reusing the same key across both. Simply listing a BCH address in a Nostr profile does not count.
3.   **Decentralized discovery.** Third parties can find identity data through Nostr or another decentralized method, with enough information to verify the link, and without relying on a proprietary database.
4.   **Verification & authentication.** Independent applications can verify the association and authenticate users (e.g. via challenge-response) without contacting a central authority.
5.   **Working demonstration & documentation.** A working prototype covering the above, plus source code, setup instructions, and documentation of the architecture and verification process.

#### Stretch goals

Optional, but earn extra consideration:

*   Send BCH or CashTokens to someone via their identity, without manually exchanging addresses.
*   Third-party attestations / verifiable credentials, such as qualifications, memberships or merchant verification.
*   Reputation that is portable across applications.
*   Key rotation and recovery with independently verifiable authorization.
*   Privacy-preserving selective disclosure that minimises exposure of personal data.
*   Reusable libraries, APIs or protocol specs that wallets and Nostr clients can adopt.
*   BCH transactions or CashTokens used as identity commitments, where they clearly improve on off-chain proofs.

#### Additional Notes

*   Paytaca sees decentralized identity as a key part of digital sovereignty and interoperability.
*   Build on existing open standards rather than inventing proprietary mechanisms. Good starting points include Nostr NIPs, BCH signatures & transactions, CashTokens, DIDs and W3C Verifiable Credentials.
*   A focused proof of concept covering binding, discovery, verification and authentication is sufficient.
*   Submissions are evaluated on technical correctness, security, decentralization, interoperability, usability and demo quality. The strongest submissions will be ones other BCH and Nostr applications could realistically adopt.

Read the [full bounty specification](https://docs.google.com/document/d/161UkJvxh3bdSYZi0ky-rZNyhgYOf595Fpopo9iDN2yw/edit?usp=sharing).

[Full details →](https://bchblaze.cash/bounties/decentralized-identity/)[Contact on Telegram →](https://t.me/PaytacaWalletApp/16452)[Bounty rules](https://bchblaze.cash/bounties/#panel)

[![Image 8: Migrate to XO bounty poster](https://bchblaze.cash/assets/bounty-migrate-to-xo.webp)](https://bchblaze.cash/assets/bounty-migrate-to-xo.webp)

BLAZE 2026 Bounty Templates

### [Migrate to XO](https://bchblaze.cash/bounties/migrate-to-xo/)

1 BCH × 5

Integrate XO into an existing project or migrate existing functionality to XO.

BCH prize

![Image 9: XO.cash](https://bchblaze.cash/assets/sponsor-xocash.webp)1 BCH per winner

Up to 5 winners · 5 BCH total

Sponsored by

General Protocols

[xo.cash](https://xo.cash/)

Winners

Best 5 submissions that satisfy all qualifying requirements, judged during the BLAZE judging period (23–27 November)

#### Qualifying requirements

The XO implementation does not need to replicate the original application’s UX. The interface and user experience may be adapted as appropriate, provided the relevant functionality is migrated to XO.

1.   Migrate existing functionality to a novel, well-designed, functional XO template that correctly implements its intended contract.
2.   Demonstrate XO functionality by executing a transaction on Chipnet or Mainnet using an invitation that can be inspected with the debug tool. Submit the invitation used to execute the transaction.
3.   Showcase the use of follow-up actions, if applicable to the underlying contract structure.
4.   Submit the XO template and invitation used, along with instructions for reproducing the invitation.
5.   Provide links to both the original working project and the XO implementation.
6.   Provide detailed feedback on your experience developing with XO, highlighting what worked well, areas for improvement, missing functionality, and any issues or limitations encountered. Where possible, include suggestions for improvement and steps to reproduce any issues. **The feedback must be personally written. AI written submissions will be rejected, and this requirement will be subjectively enforced.** Recommended word count: 500 words.

#### Additional Notes

Submissions are judged alongside all other BLAZE projects during the normal judging period, 23–27 November. Prizes go to the best qualifying submissions, not the earliest.

XO is still in early development. Some applications may not be possible, or may be entirely unfeasible with the current stack. It is important to maintain ongoing discussion with the XO team to assess feasibility.

#### Resources

Docs & learning

*   Website: [stack.xo.cash/](https://stack.xo.cash/)
*   Getting started: [stack.xo.cash/getting-started.html](https://stack.xo.cash/getting-started.html)
*   API reference: [stack.xo.cash/api/](https://stack.xo.cash/api/)
*   Blog: [stack.xo.cash/blog/](https://stack.xo.cash/blog/)
*   Workshop recording: [YouTube](https://www.youtube.com/live/MuWEHO5Ufrk)

Building

*   npm packages: [@xo-cash on npm](https://www.npmjs.com/org/xo-cash)
*   Templates: [GitLab: xo/templates](https://gitlab.com/GeneralProtocols/xo/templates)
*   Debugging tool: [blaze.xo.cash/](https://blaze.xo.cash/)

**Use Chipnet.** Please build and test on Chipnet. You can get test BCH from these faucets: [tbch.googol.cash/](https://tbch.googol.cash/) · [chipnet.bch.ninja/](https://chipnet.bch.ninja/)

**Mainnet track.** To qualify for the mainnet track, use only minimal funds, and only when you know you can get them back.

**Use the latest engine version.** The engine is still in active development, so please use the latest `0.1.0-next.xxx` release. [Check the current version on npm](https://www.npmjs.com/package/@xo-cash/engine?activeTab=versions).

**Stay updated.** Package updates are posted in the [General Protocols Telegram](https://t.me/generalprotocols). To follow XO development: [gitlab.com/GeneralProtocols/xo](https://gitlab.com/GeneralProtocols/xo)

Happy hacking!

[Full details →](https://bchblaze.cash/bounties/migrate-to-xo/)[Contact on Telegram →](https://t.me/generalprotocols)[Bounty rules](https://bchblaze.cash/bounties/#panel)

[![Image 10: Build with XO bounty poster](https://bchblaze.cash/assets/bounty-build-with-xo.webp)](https://bchblaze.cash/assets/bounty-build-with-xo.webp)

BLAZE 2026 Bounty Templates

### [Build with XO](https://bchblaze.cash/bounties/build-with-xo/)

0.3 BCH × 10

Build a functional XO template and use it with the XO debug tool.

BCH prize

![Image 11: XO.cash](https://bchblaze.cash/assets/sponsor-xocash.webp)0.3 BCH per winner

Up to 10 winners · 3 BCH total

Sponsored by

General Protocols

[xo.cash](https://xo.cash/)

Winners

Best 10 submissions that satisfy all qualifying requirements, judged during the BLAZE judging period (23–27 November)

#### Qualifying requirements

1.   Create a novel, well-designed, functional XO template that correctly implements its intended contract.
2.   Demonstrate XO functionality by executing a transaction on Chipnet or Mainnet using an invitation that can be inspected with the debug tool. Submit the invitation used to execute the transaction.
3.   Showcase the use of follow-up actions, if applicable to the underlying contract structure.
4.   Submit the XO template and invitation used, along with instructions for reproducing the invitation.
5.   Provide detailed feedback on your experience developing with XO, highlighting what worked well, areas for improvement, missing functionality, and any issues or limitations encountered. Where possible, include suggestions for improvement and steps to reproduce any issues. **The feedback must be personally written. AI written submissions will be rejected, and this requirement will be subjectively enforced.** Recommended word count: 500 words.

#### Additional Notes

Submissions are judged alongside all other BLAZE projects during the normal judging period, 23–27 November. Prizes go to the best qualifying submissions, not the earliest.

XO is still in early development. Some applications may not be possible, or may be entirely unfeasible with the current stack. It is important to maintain ongoing discussion with the XO team to assess feasibility.

#### Resources

Docs & learning

*   Website: [stack.xo.cash/](https://stack.xo.cash/)
*   Getting started: [stack.xo.cash/getting-started.html](https://stack.xo.cash/getting-started.html)
*   API reference: [stack.xo.cash/api/](https://stack.xo.cash/api/)
*   Blog: [stack.xo.cash/blog/](https://stack.xo.cash/blog/)
*   Workshop recording: [YouTube](https://www.youtube.com/live/MuWEHO5Ufrk)

Building

*   npm packages: [@xo-cash on npm](https://www.npmjs.com/org/xo-cash)
*   Templates: [GitLab: xo/templates](https://gitlab.com/GeneralProtocols/xo/templates)
*   Debugging tool: [blaze.xo.cash/](https://blaze.xo.cash/)

**Use Chipnet.** Please build and test on Chipnet. You can get test BCH from these faucets: [tbch.googol.cash/](https://tbch.googol.cash/) · [chipnet.bch.ninja/](https://chipnet.bch.ninja/)

**Mainnet track.** To qualify for the mainnet track, use only minimal funds, and only when you know you can get them back.

**Use the latest engine version.** The engine is still in active development, so please use the latest `0.1.0-next.xxx` release. [Check the current version on npm](https://www.npmjs.com/package/@xo-cash/engine?activeTab=versions).

**Stay updated.** Package updates are posted in the [General Protocols Telegram](https://t.me/generalprotocols). To follow XO development: [gitlab.com/GeneralProtocols/xo](https://gitlab.com/GeneralProtocols/xo)

Happy hacking!

[Full details →](https://bchblaze.cash/bounties/build-with-xo/)[Contact on Telegram →](https://t.me/generalprotocols)[Bounty rules](https://bchblaze.cash/bounties/#panel)

![Image 12: Stablecoin Bridge](https://bchblaze.cash/assets/bounty-stablecoin-bridge.webp)

BLAZE 2026 Bounty Stablecoins

### [Stablecoin Bridge](https://bchblaze.cash/bounties/stablecoin-bridge/)

$750 PUSD

BCH prize

![Image 13: PUSD](https://bchblaze.cash/assets/sponsor-paryonusd.webp)$750 PUSD

Sponsored by

BCH BLAZE

[bchblaze.cash](https://bchblaze.cash/)

Contact

Telegram [t.me/bchblaze](https://t.me/bchblaze)

#### Summary

*   Stablecoins have become a huge part of the cryptocurrency economy. Solving for high levels of volatility, and more familiar to end users, they’re a large part of how end users onboard to BCH and also how commerce among & between different cryptocurrency ecosystems happen
*   Stablecoin projects are also growing within BCH. Most prominently:
    *   ParyonUSD (BLAZE sponsors!!) [paryonusd.com](https://paryonusd.com/)
    *   MoriaUSD [moria.money](https://www.moria.money/)

*   BCH is still small, and one of the ways it can most easily facilitate growth in its liquidity & transactions is to grow our stablecoins, which can happen by lowering the barrier to entry from stablecoin users on other chains
*   Build a bridge connecting BCH stablecoins to stablecoin liquidity & tokens in other (and much larger) ecosystems! This will help bring in fresh liquidity & excitement from spare capital in other projects.

#### Requirements

*   Build a project that allows users to bridge or swap stablecoins into & out of BCH
    *   Ie. to be able to convert stablecoins on other chains to BCH stablecoins (eg USDC on ETH into PUSD on BCH)
    *   And vice-versa, BCH stables to other-chain stables (eg PUSD on BCH into USDC on ETH)

*   A swap from BCH stables to stables in one other ecosystem is sufficient, but from BCH stables to multiple/any other ecosystems would be even better. More liquidity, more flexibility!
*   The faster, cheaper, and easier to use the bridge is - the better.
*   On the BCH side, WizardConnect is highly recommended.
*   On the other chain side, WalletConnect is probably essential - but it depends on the paired chains and what is popular/easiest for their wallet integration stack.

#### Stretch goals

Additional considerations (outside of the basic spec) but receive extra credit

*   Project only needs to support 1 BCH stablecoin, but supporting multiple would be better
*   Contacting influential members of other ecosystems that would be willing to facilitate and promote the bridge for users of the other side of the bridge is a laudable business win.
    *   Especially good would be integration or collaborations that route through large popular and existing multicoin providers like ShapeShift, ThorChain etc.

#### Additional Notes

ParyonUSD is sponsoring BLAZE this year, so they are an excellent choice for first priority integration & demo purposes.

[Full details →](https://bchblaze.cash/bounties/stablecoin-bridge/)[Contact on Telegram →](https://t.me/bchblaze)[Bounty rules](https://bchblaze.cash/bounties/#panel)

No bounties match these filters.

General Information

## Bounty rules

How BLAZE bounties work and how they're judged.

### Overview

In addition to the general prizes for 1st, 2nd & 3rd place, BLAZE offers a series of bounties for hackathon participants. BLAZE Bounties are a method for sponsors to encourage interest in a particular project & potentially find collaborators for extending & improving it after the event. Hackers are encouraged to consider building their hackathon projects with as many bounties in mind as they find interesting and exciting (although don't spread your efforts too thin!).

In some ways, this is like a reverse "[FundMe](https://fundme.cash/)"/[Flipstarter](https://bitcoincashpodcast.com/faqs/Tech/what-is-flipstarter). The BCH community has had great success with community members providing a project specification and willingness to implement it, and looking for funding to deliver it. BLAZE bounties are the same thing in reverse. The project specification instead comes prepared with funding but not someone to implement it. That person could be you!

### Notes

*   The full list of bounties can be found on the [Board tab](https://bchblaze.cash/bounties/#panel), with sponsor information & requirements for each one attached.
*   A single project can submit to as many bounties as they like (provided they meet the requirements). There is no limit that a project can only be submitted to a single bounty, or that winning one bounty excludes the recipient from others. Some bounties overlap, or can be combined or covered in one project, so feel free to do that! However, making an attempt at multiple bounties which don't combine well may prove too scattergun to be competitive for any of them — so choose your focus carefully!

### Contacting sponsors

It is encouraged for hackers to speak to & directly collaborate with the bounty sponsors (if they leave their contact details on the bounty specification)! It is appropriate & encouraged to speak directly to the Sponsor if anything about the specification is not clear, or even to express interest & ask for some feedback on a proposed solution. A good ability to collaborate will be favourable to bounty submissions!

Just keep in mind that Sponsors are busy people & potentially trying to support multiple teams interested in their bounty, so any contact should generally be kept brief & necessary to completing the bounty. But collaborating clearly, effectively, briefly & amicably is a good signal to send to sponsors for the prospects of future collaboration.

### Judging & payment

*   Bounties will be paid at the discretion of Sponsors (at the same time or after the general judging period for BLAZE concludes, so November 28th), and only for _good faith_ efforts. Sponsors are able to decide for themselves what constitutes a sufficiently impressive effort to justify choosing a recipient, but hackers can appeal to the BLAZE organisers if they feel their submission was overlooked (particularly in a case where it was the only submission for that bounty so no other recipient was awarded).
*   Once awarded by the Sponsors, recipients will receive their payouts from BLAZE organisers.
*   Submissions for a bounty automatically waive their rights over intellectual property or similar in submitting their project for consideration for the bounty.
*   It is hoped that bounty winning projects will kickstart an ongoing relationship between the sponsor & builder(s) that flourishes into a future successful BCH project. Winning a bounty is ideally not the end of the process, but the start.

[Browse the open bounties →](https://bchblaze.cash/bounties/#panel)

For Sponsors

## List a bounty

Have a feature, tool or challenge you want built on Bitcoin Cash? Post a bounty and let BLAZE builders compete to deliver it. Money fully refunded if you don't receive at least one good-faith quality attempt.

### What you'll need

If you are interested in offering a bounty at BLAZE, use the form on the [Sponsor page](https://bchblaze.cash/sponsors/#contact). You will of course need:

*   Some non-trivial amount of BCH or appropriate CashTokens or other BCH relevant reward to offer.
*   Some idea of your desired project/requirements. Full details can be worked out in collaboration with the BLAZE team, but having more than a vague idea is essential. Consider taking a look at the existing bounties & sketching out a draft proposal in the same format.
*   Be willing to work with and support enthusiastic or interested builders in a reasonable capacity in the lead up to and especially during the BLAZE hackathon itself (November 14th – 22nd).

[Sponsor information & contact →](https://bchblaze.cash/sponsors/)

[![Image 14: BCH BLAZE](https://bchblaze.cash/assets/logo-mark.webp)](https://bchblaze.cash/)
Igniting BCH innovation through competition. A Bitcoin Cash Podcast production.

BLAZE 2026 Nov 14 – 28

#### The Forge

[Getting Started](https://bchblaze.cash/forge/)[Bounties](https://bchblaze.cash/bounties/)[Schedule](https://bchblaze.cash/schedule/)[Live streams & chat](https://bchblaze.cash/live/)[TokenHunt](https://bchblaze.cash/tokenhunt/)

#### Explore

[Archive · BLAZE 2025](https://bchblaze.cash/archive/)[Investing](https://bchblaze.cash/investing/)[Sponsors](https://bchblaze.cash/sponsors/)[Register](https://dorahacks.io/hackathon/bchblaze2026)

#### Follow & Support

[Support & Resources](https://bitcoincashpodcast.com/code)[X · @bchblaze](https://x.com/bchblaze)[Telegram · @bchblaze](https://t.me/bchblaze)

© 2026 BCH BLAZE Igniting BCH innovation through competition 🔥
