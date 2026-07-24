# WISDO v7.0.3 Heap and MT4 Poll Repair Audit

## Incident

Render terminated the Node.js process with `Reached heap limit: Allocation failed - JavaScript heap out of memory`. At the same time, `POST /mt4-command-poll` required 3,718 ms even though it returned HTTP 200.

## Root causes found

1. MT4 command state was retained three times: the global queue, a per-user index, and a per-account index.
2. Each persistence update cloned and serialized those duplicate structures several times.
3. A single Reporter poll could reload command state once for every candidate delivery identity.
4. Concurrent first polls did not share their initial state load.
5. Poll responses awaited a Redis heartbeat that is not required to deliver a command.
6. The performance health route cloned the entire command history to calculate small counters.
7. Command and signal history defaults were too large for a memory-constrained web process.
8. Noncritical website crawls had no admission control when heap or RSS pressure was already dangerous.

## Repairs

### Compact command persistence

- PostgreSQL now stores one `commandQueue`, one bounded `commandAuditLog`, and `schemaVersion: 2`.
- Legacy per-user and per-account indexes are accepted during migration but are no longer persisted.
- In-memory indexes are generated only for legacy/admin callers that explicitly request the old public shape.
- Completed, failed, cancelled, and expired history defaults to 250 records while all active commands remain preserved.

### Heap-safe polling

- `getPendingCommandForAnyUser()` searches all candidate identities from one hot state read.
- One thousand concurrent cold polls coalesce into one persistence load.
- Empty polls perform zero command-state writes.
- Delivery and completion mutations operate against the compact queue.
- Reporter delivery identity results are cached for five minutes.
- Duplicate identity arrays were removed from poll responses.
- Redis heartbeat is fire-and-forget and rate-limited; it is no longer on the HTTP response path.

### Lower-clone persistence

- Runtime cloning uses native `structuredClone` when available instead of JSON stringify/parse.
- Buffered PostgreSQL updates use one working copy and retain one immutable dirty snapshot.
- Persistence adapters expose a read-only hot `peek()` for safe poll reads.

### Memory pressure protection

- `/health/performance` uses compact queue metrics and no longer clones full command history.
- V8 heap and process RSS pressure are reported separately.
- At the configured pressure threshold, noncritical GET/HEAD/OPTIONS requests return HTTP 503 with `WISDO_MEMORY_PRESSURE_SHED`.
- Critical bridge and health routes remain admitted:
  - `/mt4-sync`
  - `/mt4-command-poll`
  - `/mt4-command-complete`
  - `/health`
  - `/health/mt4`
  - `/health/performance`
  - `/health/discord`

### Conservative production defaults

- `DB_POOL_MAX=2`
- `WISDO_SIGNAL_BACKGROUND_CONCURRENCY=2`
- `WISDO_SIGNAL_BACKGROUND_MAX_QUEUE=200`
- `WISDO_MT4_COMMAND_HISTORY_LIMIT=250`
- `WISDO_MT4_COMMAND_AUDIT_LIMIT=250`
- `WISDO_MT4_HISTORY_GLOBAL_LIMIT=200`
- `WISDO_MT4_HISTORY_ACCOUNT_LIMIT=40`
- `WISDO_SIGNAL_HISTORY_LIMIT=200`
- `WISDO_MEMORY_SHED_RATIO=0.85`

## Verification

- 107 JavaScript files passed the production build audit.
- 100 tests passed; zero failed.
- Pressure test: 1,000 concurrent idle polls use one state read and zero writes.
- Migration test: duplicate durable indexes are removed and schema version becomes 2.
- Existing Discord, remodel, desk, MT4 sync, copier, close-authority, authentication, and presence tests remain passing.

## Production boundary

These repairs are verified locally and in the clean release package. Actual Render memory ratios, PostgreSQL latency, Discord connectivity, and Reporter response time must be checked after deployment through `/health/performance` and live Reporter logs.
