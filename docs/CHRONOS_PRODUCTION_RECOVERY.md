# CHRONOS production recovery checklist

This change is a Reporter-side source hotfix, not an activated schedule. It validates the full nine-item broker-clock packet against the configured symbol and magic before writing, persists the blocked marker before writing the seven day masks, and enables only after all writes have been checked. A failed write must not reopen entries. Existing schedules still use broker server time, not Eastern time.

## Production setup and verification
- Locate World Command Center > WISDO CHRONOS and the receiver diagnostics.
- Confirm the account, exact broker symbol (including suffix), and EA MagicNumber. Reporter must have EnableCampaignControl=true, matching CampaignControlSymbol and CampaignControlMagic, and fresh EA heartbeat with scheduleVersion=1.
- Compile the updated Reporter source with its matching include files using MetaEditor; resolve compilation errors before replacing any binary. Preserve existing terminal settings. Verify the EA version actually supports the weekly schedule gate.
- Keep AutoTrading and position-management logic running. Do not use the global AutoTrading switch as the schedule.
- Translate Eastern windows to the actual broker clock using the verified offset for the relevant dates; do not guess the offset. For example, if the broker clock is exactly seven hours ahead, 03:00–10:00 and 12:00–16:00 ET become 10:00–17:00 and 19:00–23:00 broker time. Recheck on DST changes.
- Apply the intended day masks using the existing confirmation flow. A local draft or a queued command is not proof. Verify the EA reports the intended masks, scheduleActive and scheduleAllowed, and effective entryAllowed.
- Confirm every entry path and outstanding pending entry behavior separately, while keeping existing stops and position management available. Do not claim this hotfix establishes that coverage.
- Record compiled versions, account/lane identity, receipts and observed boundary results before enabling member rollout.

Remaining work: Eastern-time/DST-aware schedule persistence and compilation, lane-scoped Discord PAUSE_BOT/RESUME_BOT compatibility, full entry-path and pending-order audit, automated and terminal validation. No live account is modified by this branch alone.

## Native MT4 laptop mode (new optional Hightower source)
After compiling the updated Hightower source, the following EA Inputs configure the requested recurring local entry windows without a VPS or a per-boundary cloud command:
- DirectTradingWindowMode = TIME_WINDOW_CUSTOM_TWO_WINDOWS
- DirectCustomWindowsUseEasternTime = true
- DirectWindow1StartHour = 3; DirectWindow1EndHour = 10
- DirectWindow2StartHour = 12; DirectWindow2EndHour = 16
- DirectEasternWeekdaysOnly = true only if Monday–Friday is desired.
- DirectAllowNewEntries remains subject to the user's existing controls. Leave protective management running.

Eastern mode uses TimeGMT from the live terminal host and US DST rules. Keep Windows time synchronized, MT4 awake, and its connection and existing permissions active. This native input is not remotely editable by CHRONOS yet. It intersects with any previously applied broker-time weekly schedule and global pause/risk gates; a resume never overrides those. In Eastern mode equal endpoints disable a window. The strategy tester deliberately blocks entries in this mode because MT4 simulates TimeGMT as broker time. Existing broker-clock mode and default settings remain unchanged. The existing dashboard configured-window readout may still use broker-time labels; native Eastern input status is not yet separately reported.

For an immediate workaround using the already installed compatible Hightower build, select its existing custom-two-windows mode and enter equivalent broker hours after checking the actual broker clock. This does not require the new source or a VPS. If the EA inputs are absent, the installed version is different and must be verified before proceeding. This workaround is not proof that every entry route or pending order is gated.


## Version 2 Eastern weekly scheduler and lane pause
The draft branch now adds an Eastern-time option to World Command Center > CHRONOS. Select the exact live account, symbol and MagicNumber, then choose Eastern time and paint the allowed hours or use the Monday–Friday 03:00–10:00 / 12:00–16:00 preset. Review all seven days, clock and lane before holding confirmation. The updated Reporter validates the entire packet; the EA evaluates mode 3 against its own synchronized UTC clock and US daylight saving rules. Older receivers retain broker-time mode 1 and must not receive mode 3. The Reporter commit receipt is not proof of EA enforcement: inspect the reported clock, seven masks, active gate and actual terminal.

Compile both Hightower and Reporter together with the updated include folder. If remote scheduling is the sole desired time constraint, choose TIME_WINDOW_ALL_HOURS in the EA direct window input; otherwise both direct and remote constraints apply. Keep existing risk and protection settings unchanged. A laptop or desktop with MT4 running, awake and connected is sufficient. The EA uses the last successfully committed local schedule, not a server command at every boundary.

Discord /bot-lanes shows the watched Hightower symbol:magic ID. /pause-bot and /resume-bot require that exact fresh receiver, confirmation and account control permission. The lane pause is distinct from the terminal pause; resuming the lane cannot bypass other gates. Commands to unsupported or ambiguous lanes are rejected, never expanded to the account. The website's older PAUSE_BOT action is an explicitly labeled terminal-wide control.

Hightower now attempts to cancel its own unfilled pending entries when its time or pause gate is blocked, on ticks and timer events, leaving existing market positions alone. Cancellation can fail or race with broker fills, especially while disconnected, so verify that behavior in a connected terminal; no software can guarantee cancellation while offline. MQL compilation, broker behavior, every strategy entry path, installed versions and live operation remain unverified. Do not deploy or activate schedules until those checks are complete.
