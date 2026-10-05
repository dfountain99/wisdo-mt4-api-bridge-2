# WISDO campaign connection — protocol 1

This release connects the authenticated Command Center to a campaign EA through the existing pairing and command queue. It supplies source code, not a compiled or live-validated EX4. MetaEditor compilation and a demo-terminal check remain required.

## Install on the MT4 terminal

1. Copy `mql4/HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4` and `mql4/CultureCoin_MT4_Reporter.mq4` into `MQL4/Experts/`.
2. Copy the complete `mql4/include/` directory to `MQL4/Experts/include/`. Keep these files together; the quoted includes are relative to the EA source.
3. Compile both MQ4 files in MetaEditor. Resolve any compiler errors before loading either EA. This repository's compatibility tests do not substitute for this step.
4. On a demo account, attach HIGHTOWER to its trading chart. Use only one campaign EA per account/server/symbol/magic identity. A fresh campaign starts from flat; unknown existing tickets are quarantined instead of being assigned guessed roles.
5. Attach Reporter **1.65** to a separate chart in that same terminal. Keep your existing pairing code and server URL. Enable `EnableCampaignControl`, set `CampaignControlSymbol` to the EA's exact broker symbol (including suffix), and set `CampaignControlMagic` to the EA's `MagicNumber`. Leave copy/manual execution settings as previously configured.
6. Enable the terminal permissions needed by the EA and the Reporter's existing WebRequest connection. Open `/app/command-center`, select this account, and wait for fresh Reporter AND campaign telemetry.
7. First preview a short entry pause. Confirm it deliberately, observe the transport receipt, then the separate EA acknowledgement. Verify that open-position protection continues and that cancelling a goal does not clear a manual/emergency pause.

Website changes alone cannot install an EA in a user's terminal or restore a stopped Reporter heartbeat. The source receiver only runs on market ticks; timers whose deadline occurs without ticks are handled on the next tick. The terminal clock must be correct. Remote control remains unavailable while telemetry is stale.

## Implemented commands

| Intention | Behavior |
|---|---|
| Pause entries for X | Persist a UTC timer; protection continues; resume normal evaluation after it expires. |
| After each win, pause X | Each newly observed profitable closed campaign ticket resets the pause duration. Remains armed for subsequent wins. Depends on terminal account-history availability. |
| After each compound target | Pause after a new realized milestone. Wait for an opposite candle that started after the trigger and then closed. Resume normal evaluation in the retained campaign direction. |
| End campaign after X | Enter the existing close-and-retry state, disable automatic flip, and keep entries paused until the intention is cancelled. Acceptance is not confirmation that every broker close succeeded. |
| After campaign end, pause X | On the flat/awaiting-flip transition, pause before permitting another entry. |
| Evaluate entry now | Evaluate on the EA tick through existing logic; never guarantee or force an order. Distinct no-entry and broker-entry statuses. |
| Bounded SONIC window | In an active campaign, allow up to 1–10 normal SONIC entries during the selected duration. Every original signal, spacing, spread and risk gate applies. Quota decrements only after a successful order. When exhausted/expired, SONIC pauses until the standing intention is cancelled or replaced. It does not block unrelated normal strategy entries. |
| Two-minute scalp watchdog | Hold the WISDO Time core for 2.0 seconds to arm a fixed 120-second inactivity window. Every broker-confirmed new campaign entry restarts the clock. If no new entry arrives before expiry, HIGHTOWER blocks new entries first, enters its full-basket close-and-retry state, records the finished basket median, and then waits flat for a newly closed opposite-color candle. After that reset candle, the entry gate reopens and the stored median becomes the first resumed campaign's launch reference; normal spread, structure, room, stop, risk and broker-legality gates still decide whether an entry is valid. |
| Move targets | Up to 12 selected collectors/runners move to one currently confirmed pivot. HOLD targets cannot be changed. Each broker modification is checked; partial outcomes are reported. |
| Protect campaign rail | Accept only a currently confirmed pivot that tightens the rail and satisfies broker distance checks. The normal rail manager applies broker stops; acceptance is not a broker modification receipt. |
| Assign runner / collector | Persist assignments on selected non-HOLD tickets in this campaign. |
| Structure Keeper | Selected non-HOLD tickets follow the campaign structure rail; existing stops never loosen. |
| Profit Vault | Selected non-HOLD tickets prioritize the existing break-even/cost reserve and trailing logic, subject to broker distance checks. This is not a guarantee against slippage or costs. |
| Cancel standing intention | Cancel only this receiver's rule/SONIC window; never clear manual or emergency locks. |

There is **one standing rule per watched campaign** in this version. Arming a new timed/conditional/SONIC/scalp-watchdog rule replaces the previous rule. Target, rail, assignment and trail-policy changes do not replace the standing rule. Arbitrary multi-rule programs, autonomous learned preference changes, and unrestricted natural-language strategy generation are not enabled.

## Canvas and voice

The canvas displays actual EA positions, confirmed pivots, targets and rail. These are structure candidates, not proof of institutional orders. Dragging snaps to these levels and opens a proposal. Circle trade dots or use accessible checkboxes for group selection. Pinch or use the zoom slider. Hold the orb for browser speech input; a tap gives a written/optional spoken summary. Swipe the orb up for the canvas, left for trades, right for levels. Spoken commands use a bounded grammar and always preview before confirmation. Unrecognized instructions do not execute. WISDO Voice output uses the existing `/api/wisdo/voice/speak` service and requires that service's configuration.

Examples:
- `Wisdo, pause entries for 1 hour`
- `After each win pause 15 minutes`
- `After every compound target pause until a new opposite candle closes`
- `End this campaign after 30 minutes`
- `After this campaign ends pause for 2 hours`
- `Arm a ten burst sonic attack for the next valid entry`
- `Activate the 2 minute game plan scalp system`
- `Extend selected trades three levels` (requires matching starting targets)
- `Make selected trades structure keeper`
- `Enter now`

No shake-to-close action is installed. The existing account Trade controls remain available separately. Repeating a gesture or double-tapping the orb never silently replays a financial command.

## Protocol and failure behavior

- Existing authenticated server ownership/share permissions apply. No account fallback on an invalid account ID.
- Proposals expire and are revalidated at confirmation: campaign ID, level identity/price, positions and freshness.
- Every packet contains the exact symbol/magic, campaign ID, request ID, operation and short delivery expiry.
- Reporter uses an atomic mailbox reservation and publishes the sequence last. It acknowledges **delivery only**.
- The EA persists its processing marker before action. A crash yields an uncertain/interrupted result instead of silently replaying an order. Rejected/expired commands cannot release a manual pause.
- Telemetry uses a revision guard to avoid partial reads. The terminal retains the last 12 EA acknowledgements; sampled snapshot history also retains them. This is not an unlimited execution audit.
- Strategy Tester command globals are isolated from live command globals. The H620 persistence key retains live compatibility and separates tester runs.
- A group broker modification is not atomic. Status 3 means partial success; inspect the changed/requested counts and live positions before submitting another instruction.

| EA status | Meaning |
|---|---|
| -2 | Processing marker; interrupted or outcome still uncertain |
| -1 | Rejected by the EA |
| 1 | Accepted rule/configuration change; not a fill receipt |
| 2 | Selected target modifications confirmed by broker calls |
| 3 | Partial target modifications |
| 4 | Entry evaluation accepted |
| 5 | Evaluation finished without an entry |
| 6 | Evaluation produced a broker-confirmed entry |

## Verification

- `npm run build`
- `node --test tests/campaignControl.test.js tests/worldCommandCenter.test.js tests/v706-snapshot-churn-memory-repair.test.js`
- `python scripts/testCampaignReceiver.py`

The Python runner extracts the current shipped H620 module and receiver, compiles that code against a C++ compatibility shim, and exercises timer/protocol scenarios. It does not compile the full EA in MetaEditor and does not model a real broker. Browser layout verification was unavailable in the build environment because the Chromium download failed. No test command was sent to a live account.

Reference semantics checked against MetaQuotes documentation: [atomic global-variable updates](https://docs.mql4.com/globals/globalvariablesetoncondition), [terminal global scope](https://docs.mql4.com/globals), and [date/time functions](https://docs.mql4.com/dateandtime).
