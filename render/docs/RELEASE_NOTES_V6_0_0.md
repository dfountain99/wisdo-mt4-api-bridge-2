# WISDO v6.0.0 — Culture Lane OS + Reliable Relay Foundation

## Reliability upgrades

- Replaced duplicate account/user Redis list delivery with one authoritative Redis Stream per execution route.
- Added command-ID idempotency so the same command cannot be published twice into the execution stream.
- Added validated command lifecycle transitions: queued → claimed/delivered → completed/failed/expired/cancelled/dead-letter.
- Added user/account ownership checks before acknowledgements can update a command.
- Added stale-command recovery, TTL expiration, delivery-attempt limits, and dead-letter handling.
- Fixed Redis TTL handling so requested seconds are no longer multiplied by 24.
- Added recurring API health-key renewal instead of a one-time 90-second key.
- Added explicit bridge delivery states: published-and-durable, Redis-only, durable-degraded, failed, or idempotent replay.
- Added PostgreSQL command lifecycle and receiver-heartbeat persistence.
- Added graceful Redis and PostgreSQL shutdown hooks.

## PostgreSQL persistence upgrades

- Added database advisory locking around load-modify-save operations across multiple Node/Render instances.
- Added section-level comparison and writes so unrelated state sections are not rewritten on every mutation.
- Removed automatic deletion of absent sections during ordinary snapshots.
- Added `saveSection()` and adapter-level `atomicUpdate()` primitives.
- Fixed string Boolean parsing for database SSL and Redis enablement.

## Culture Lane Portfolio Operating System foundation

- Culture Lane durable entities and authenticated API routes.
- Culture Lane Vault aggregation across leader and follower accounts.
- Broker symbol inventory upload.
- Smart Symbol Policy, aliases, allowed/blocked symbols, and skip-and-notify resolution.
- Harvest policies with percent, dollar, equity, balance, floating, and closed-profit targets.
- Confirmation-gated multi-account Harvest execution that refuses to run while receivers are degraded.
- Versioned Lane Genomes for configuration history.
- Append-only Lane Timeline events.
- Trade Passports with one-time finalization.
- Lane DNA snapshots with confidence and sample size.
- Culture Intelligence reports that separate observations from non-auto-applied recommendations.

## API additions

- `GET/POST /api/v2/culture-lanes`
- `PATCH /api/v2/culture-lanes/:laneId`
- `GET /api/v2/culture-lanes/:laneId/vault`
- `POST /api/v2/accounts/:accountId/symbol-inventory`
- `PUT /api/v2/culture-lanes/:laneId/symbol-policy`
- `GET /api/v2/culture-lanes/:laneId/symbol-resolution`
- `PUT /api/v2/culture-lanes/:laneId/harvest-policy`
- `POST /api/v2/culture-lanes/:laneId/harvest/evaluate`
- `GET/POST /api/v2/culture-lanes/:laneId/genomes`
- `POST /api/v2/culture-lanes/:laneId/passports`
- `POST /api/v2/trade-passports/:passportId/finalize`
- `GET /api/v2/culture-lanes/:laneId/timeline`
- `POST /api/v2/culture-lanes/:laneId/dna`
- `POST /api/v2/culture-lanes/:laneId/intelligence`

## Verification

- `npm run check` passes.
- 37 automated tests pass.
- Build scan confirms 90 JavaScript files, 14 required production assets, and no public proprietary strategy source.

## Deliberate safety boundaries

- Harvest execution requires `execute: true` and `confirmation: "confirmed"`.
- Harvest execution is blocked when any lane receiver is disconnected.
- Intelligence recommendations are stored as recommendations and are never auto-applied.
- PostgreSQL and Redis are strongly recommended for live funded-account control. JSON remains a safe fallback for local or single-instance use.
