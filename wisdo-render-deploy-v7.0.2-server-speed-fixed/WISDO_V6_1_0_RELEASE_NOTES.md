# WISDO v6.1.0 — Full Queue Audit and Performance Recovery

## Purpose

v6.1.0 is a repository-wide concurrency and performance repair. It audits all production JavaScript files for global promise queues, serialized state chains, cross-account command queues, blocking Reporter reconciliation, unnecessary media traffic, and hidden JSON state writes.

## Main repairs

### 1. Global queue removal

Removed request-blocking promise tails from:

- Major product state mutations.
- Legacy API state saves.
- WISDO Phase 1 repository state.
- Notification delivery.
- Growth Funnel state.
- Trade Signal state.
- MT4 command mutations.
- PostgreSQL namespace writes.

Writes now use optimistic, revision-based hot-state updates with background PostgreSQL persistence. Required concurrency protection is scoped instead of global.

### 2. Accounts and role-save recovery

`GET /api/v2/accounts?includeReporter=1` returns stored PostgreSQL accounts within a fixed time budget. Live Reporter reconciliation continues in the background when necessary.

`PATCH /api/v2/accounts/:accountId/desk-role` updates the hot state and visible account immediately. The page no longer waits for a second complete account refresh before showing the saved role.

### 3. Full workspace fail-open reads

Trades, statistics, analyzers, alerts, Compound Tracker, community discovery, and Lane Coach history reads now use bounded live synchronization. One delayed Reporter or database refresh no longer freezes every tab.

### 4. Reporter and copier priority

Reporter heartbeat responses no longer wait for:

- Lane Coach generation.
- Academy ingestion.
- Product-ledger updates.
- Route reconciliation.
- Analytics rebuilding.

MT4 command writes no longer share one global queue across all accounts. Copy open, copy close, Close All, Harvest, and command acknowledgements retain idempotency and ownership checks.

### 5. 4K background-video recovery

The workspace previously started two looping videos on every app page, including a 4K MP4. Together the videos could consume roughly 37 MB per fresh cache cycle while APIs and scripts were loading.

v6.1.0:

- Uses no initial video `src`.
- Uses `preload="none"`.
- Downloads video only when the matching motion theme is selected.
- Unloads the video when another theme is selected.
- Prevents the service worker from caching MP4 or Range responses.

### 6. Database-only state completion

- PostgreSQL remains durable truth.
- No laptop or runtime JSON fallback is used.
- The old Culture Feed JSON index is removed.
- Culture Feed metadata now persists through PostgreSQL-backed WISDO state.
- Redis is optional and disabled by default.
- The Render persistent-disk requirement is removed.

### 7. Browser resilience

- Safe GET requests default to one attempt.
- Accounts can render from the last successful browser snapshot during a temporary live refresh delay.
- Role saves update local page state immediately.
- Service-worker cache version is advanced to the v6.1.0 queue-audit build.

## Compatibility

- Reporter v1.58 remains compatible.
- No Reporter recompilation is required.
- Existing PostgreSQL data remains compatible.
- Existing Culture Lanes, account records, symbol policies, Harvest records, Academy memory, and command history remain in the same database namespaces.
- Redis is not required.

## Validation

- Build check: passed
- JavaScript files: 95
- Required production assets: 14
- Automated tests: 69
- Passed: 69
- Failed: 0
