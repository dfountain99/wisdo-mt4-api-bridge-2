# WISDO Persistent Account Controls + Close Intelligence V5.8.0 Audit

## Scope completed

### Durable account role and visibility
- Added `accountControlSettingsById` as the authoritative persistence layer for desk role, sharing mode, and community label.
- Reporter synchronization now reads the durable control record before using Reporter defaults.
- Account ID migrations move control settings to the canonical Reporter account ID.
- Account creation and both account-edit routes update the durable control record.
- Account deletion writes a stable tombstone keyed by account ID and owner/account/server identity, preventing deleted Reporter accounts from being re-imported automatically.
- Added an administrator account-delete route that uses the same tombstone protection.

### Persistence and deploy survival
- JSON writes are serialized.
- Every successful write updates both `ecosystem.json` and `ecosystem.json.bak`.
- Corrupt or temporarily unreadable primary storage restores from the backup instead of returning a blank state.
- The API server keeps a shared last-known-good state and refuses to silently replace it with empty collections after a storage exception.
- Render remains configured with the 10 GB persistent disk mounted at `/var/data` and `WISDO_STORAGE_PATH=/var/data/wisdo`.

### Server responsiveness
- Safe browser GET requests use up to three wake/retry attempts for timeout, network, 502, 503, and 504 conditions.
- POST/PATCH/DELETE requests, especially close commands, are never automatically replayed.
- Account background polling changed from 15 seconds to 45 seconds and pauses while the tab is hidden or a dialog is open.
- Reporter account synchronization skips an ecosystem write when the account material state did not change.

### Immediate trade control
- Added website controls and APIs for:
  - Close All Now → `CLOSE_ALL_TRADES`
  - Profit Secure → `CLOSE_ALL_PROFITS`
  - Close Losing Only → `CLOSE_ALL_LOSERS`
- Bulk close commands use `immediate=true`, priority `1000`, and `ttlMinutes=10`.
- Existing MT4 Reporter command support is reused; no incompatible command names were introduced.

### Compound Tracker and analytics
- Each bulk close creates a persistent tracker before command queue insertion.
- Tracker stores mode, selected account, request time, command ID, pre-close analytics, MT4 result, final status, and post-close analytics.
- Analytics use the WISDO trade ledger populated by MT4 open/closed history and account telemetry.
- Added daily and weekly statistics, seven-day and eight-week cumulative series, Daily Trend, Weekly Trend, Compound Score, Win Rate, Profit Factor, Risk Pressure, Consistency, floating P/L, and measured drawdown.
- Added `/api/v2/analyzer/trends` and `/api/v2/trades/compound-trackers`.

### Notifications
- Command completion finalizes the tracker for all supported close-command types.
- Completion creates/updates website alerts and queues a transactional email through the existing durable Resend outbox.
- When Discord is connected, the result is sent to both the member DM and the member private desk channel.
- The configured Discord/WISDO notification webhook continues to receive command completion messages.

## Validation performed

- `node --check` passed for all modified JavaScript files.
- `npm run check` passed the production asset/build audit.
- Full automated suite passed: **31 tests, 31 passed, 0 failed**.
- Added tests for:
  - role/visibility survival after Reporter re-import;
  - deletion tombstone blocking automatic account resurrection;
  - immediate priority Profit Secure command mapping;
  - Compound Tracker persistence and finalization;
  - daily and weekly gauge/series generation;
  - JSON backup restoration after primary-state corruption.
- Local web smoke passed:
  - `/api/public/health` → HTTP 200, version 5.8.0;
  - `/app/accounts` → HTTP 200;
  - `/api/v2/analyzer/trends` → HTTP 200 with 7 daily points, 8 weekly points, and seven gauges.

## Integration requirements

- Email: `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
- Discord DM/private desk: running Discord client, valid member connection, configured guild, and an existing member desk.
- Optional webhook: `DISCORD_NOTIFICATION_WEBHOOK_URL` or `WISDO_NOTIFICATION_WEBHOOK_URL`.
- Durable deployment: do not remove the Render disk mounted at `/var/data`.

## Notes

- The MT4 Reporter must continue polling `/mt4-command-poll` and posting completion to `/mt4-command-complete`; “immediate” means top-priority availability on the next Reporter poll, not execution without MT4 connectivity.
- Trend scores are historical operating indicators, not promises of future performance.
- No new npm dependency was introduced by this release.
