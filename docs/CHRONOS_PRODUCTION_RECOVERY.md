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
