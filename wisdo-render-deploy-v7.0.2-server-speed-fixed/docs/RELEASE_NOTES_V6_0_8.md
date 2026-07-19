# WISDO v6.0.8 — Cloud-Only Emergency Recovery

## Why the website stopped working

The previous database-only conversion moved whole application state objects into PostgreSQL and made live requests wait for database reads and advisory locks. When PostgreSQL slowed down or a namespace lock was busy, dashboard APIs, account pages, pairing-code reads, and Reporter heartbeats all waited together. Removing JSON files was correct, but PostgreSQL was being used like a remote file system instead of a durable database behind a fast runtime layer.

## Cloud-only architecture

v6.0.8 does not restore laptop files or JSON runtime persistence. It uses:

- PostgreSQL as durable source of truth.
- One shared PostgreSQL pool for the complete process.
- A disposable in-process hot mirror for page reads and Reporter heartbeats.
- Optional Redis for command streams and fast relay delivery.
- Bounded database query timeouts and a circuit breaker.
- Buffered live-state writes with automatic PostgreSQL retry.
- Database health details in `/health`.

The hot mirror is process memory on Render, not a laptop file. PostgreSQL remains the durable record. If PostgreSQL is temporarily slow, the site can render from its last hot state while persistence retries instead of freezing every tab.

## Recovery behavior

- Website reads fail open to the last hot state or an empty safe state.
- Live-state writes update the hot mirror immediately, then flush to PostgreSQL.
- Failed flushes remain queued in process memory and retry automatically.
- PostgreSQL advisory locks use nonblocking acquisition instead of waiting forever.
- Query, connection, and statement timeouts prevent one database operation from freezing the service.
- Redis and the primary state layer share one PostgreSQL pool.
- Background AI and broker workers are disabled by default during recovery and can be re-enabled after health is stable.

## Data recovery limitation

Records that were only stored in deleted JSON files cannot be recreated automatically. Signed Reporter pairing codes can recover their owner identity, and new snapshots can rebuild account records. Culture Lanes and settings survive only when they were successfully written to PostgreSQL before the old file state disappeared.

Reporter v1.58 remains compatible and does not need another compile for this server release.
