# V5.1.1 — Copier Close Authority

- Added stable leader/source ticket identity to every copy command.
- Persisted the real follower MT4 ticket returned by `OrderSend`.
- Recovered follower tickets from completed historical open commands when needed.
- Made close commands bypass symbol, spread, daily-loss, drawdown, max-position, trading-hour, and route-pause entry gates.
- Added close priority 300 and immediate delivery.
- Changed missing-position close results from false success to explicit failure.
- Marked mirrored positions `closing` when queued and `closed` only after MT4 confirms success.
- Restored the mirrored trade to `open` with an execution error when MT4 reports a close failure.
- Upgraded the Reporter to v1.55 with exact follower-ticket closure and safe legacy recovery.
- Removed the stale active EX4; the v1.55 MQ4 must be compiled in MetaEditor.
- Added regression coverage for paused lanes, changed filters, ticket recovery, completion reconciliation, and Reporter close behavior.
