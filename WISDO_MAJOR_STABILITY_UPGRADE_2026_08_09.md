# WISDO Major Stability Upgrade â€” 2026-08-09

## Runtime lifecycle repair

The production process now drains HTTP traffic, application resources, Discord, and background timers before it exits. Shutdown is idempotent, so overlapping Render `SIGTERM`, operator interrupts, and fatal-error paths cannot run cleanup twice.

The API server exposes one awaitable resource-cleanup operation for Redis, PostgreSQL-backed MT4 state, Phase 1 persistence, notification retries, and registered background timers. Cleanup failures are logged with the affected resource instead of being silently discarded.

## Fatal error policy

An uncaught exception or non-transient unhandled rejection can leave in-memory trading state inconsistent. Those failures now trigger the same bounded drain and exit with status 1 so the platform can restart a clean process. Known transient Discord transport failures remain recoverable and continue to be logged as warnings.

## Forced-exit boundary

Graceful shutdown defaults to 10 seconds and can be configured with `WISDO_SHUTDOWN_TIMEOUT_MS` from 1 to 30 seconds. Idle HTTP connections close immediately. If active connections prevent shutdown from completing by the deadline, remaining connections are forcibly closed and the process exits, avoiding an indefinitely stuck deployment.

## Verification

- 234 baseline tests passed before the repair.
- Lifecycle regression tests cover complete drain, idempotent overlapping signals, and nonzero fatal exit.
- The 5,000-heartbeat, 100-open-trade database-first pressure run still passes under a 64 MB V8 heap.
