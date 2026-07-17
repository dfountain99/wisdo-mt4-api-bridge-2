# WISDO v6.0.7 — PostgreSQL Performance Recovery and All-Reporter Restore

## Production regression repaired

After v6.0.6 enabled database-only runtime state, the live service could become extremely slow and MT4 Reporter v1.58 could move every account into Error. The failure was not caused by Reporter pairing itself. It was caused by database pressure inside the web process:

- Each WISDO state namespace created its own PostgreSQL connection pool.
- Every page/API read reloaded a complete namespace from PostgreSQL.
- Every Reporter heartbeat could perform up to three live-state transactions.
- Signal creation and relay commands ran while the live-state advisory lock was held.
- Reporter responses waited for product ledger, Academy, Lane Coach, Harvest, and route-repair work.
- AI and broker background workers could overlap their own previous cycles.

On a small Render instance/database, those operations queued behind one another until MT4 exceeded its WebRequest timeout.

## v6.0.7 changes

### Shared PostgreSQL runtime

- One process-wide `pg.Pool` is shared by all WISDO state namespaces.
- Default total pool size is 8 instead of up to 10 connections per namespace.
- Schema initialization runs once per database pool.
- Legacy-state import checks run once per namespace rather than on every read and write.
- Adapters using the same namespace share one cache and one write chain.

### Fast read path for tabs

- Fresh cache window: 2 seconds by default.
- Stale-while-revalidate window: 30 seconds by default.
- Normal WISDO writes immediately update the shared cache.
- Dashboard, Accounts, Copier Engine, Compound Tracker, Academy, and Lane Intelligence no longer reload the full database state on every closely spaced request.
- PostgreSQL remains authoritative; no JSON state fallback was restored.

### Reporter heartbeat recovery

- One cached live-state read replaces several full database loads.
- One authoritative live-state transaction now persists pairing, connection, latest snapshot, account settings, signal tracking, and bounded history.
- Signal creation and close relay work execute outside the MT4-state database lock.
- Compact snapshot history is written every 15 seconds, plus immediately on connect/open/close activity.
- Academy, Lane Coach, WISDO memory, product ledger, Harvest, and relay reconciliation run after the HTTP response instead of blocking Reporter.
- All Reporter accounts remain in `connectionsByAccountId` and `latestSnapshotsByAccountId`; one account update does not replace the others.

### Worker protection

- Broker API and proactive Coach loops are single-flight.
- Notification retry is single-flight.
- Broker sync production default: 120 seconds.
- Proactive Coach poll production default: 180 seconds.
- A cycle is skipped when its prior cycle is still active.

## Reporter requirement

Reporter v1.58 remains the correct MT4 bridge. No Reporter source update is required for v6.0.7. Once the server patch is deployed, existing v1.58 terminals should recover automatically after their next retry cycle.

## Database requirement

Use Render's Internal Database URL when the database and web service are in the same region. v6.0.7 remains database-only and still refuses to start without `DATABASE_URL`.

## Validation

- Build check: 92 JavaScript files and 14 production assets.
- Automated tests: 61 passed, 0 failed.
- Added multi-Reporter persistence test.
- Added one-transaction heartbeat test.
- Added nonblocking AI/relay preparation test.
- Added shared pool/cache structural test.
