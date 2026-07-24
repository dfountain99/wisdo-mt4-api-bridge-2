# WISDO v7.0.6 Snapshot-Churn OOM Repair Audit

## Incident signature

Production restarted within roughly 20–30 seconds after one account reported 100 open trades. The same heartbeat was logged as `copySignalsOpened: 100` and `copySignalsClosed: 100`, then V8 reached about 252 MB and failed while deserializing a worker message.

## Confirmed root cause chain

1. Signal identity included ticket, open time, symbol, and side.
2. Reporter date formatting or a restart changed the serialized open-time value.
3. The same 100 tickets were treated as 100 new opens while the former 100 keys were treated as closes.
4. Open-copy, close-copy, signal presentation, Wisdo memory, product-ledger, and persistence work started together.
5. Product trade reconciliation rebuilt the entire trade array once per trade.
6. Timed-out background tasks released concurrency slots even though the underlying task continued running.
7. Buffered authoritative saves cloned a full prior namespace even when replacing it completely.
8. Those overlapping object graphs crossed Render's effective V8 heap limit.

## Repairs

### Stable trade identity

- Signal keys now use `accountId|ticket` when a broker ticket exists.
- Old five-part keys migrate in place on the next heartbeat.
- Changing open-time formatting no longer creates a new signal.
- Stored metadata preserves symbol, side, open time, and source ticket for later close routing.

### Coalesced post-snapshot work

- Wisdo memory and product-ledger ingestion use one bounded per-account queue.
- A newer heartbeat replaces an older queued heartbeat for that account.
- The worker processes accounts serially on low-memory Render services.
- Compact trade records cross the asynchronous boundary instead of the entire snapshot object graph.

### Product-ledger indexing

- The account/ticket trade lookup is built once per reconciliation.
- Per-trade `Object.values(...).find()` scans were removed.
- Trade history, telemetry, alerts, event keys, and relay diagnostics are bounded.

### Persistence and worker safety

- Full authoritative saves replace the hot snapshot without cloning a discarded old namespace.
- A task that exceeds its warning timeout keeps its worker slot until the task truly settles.
- MT4 command loading can return the canonical queue without duplicated user/account indexes.

## Validation

- 112 JavaScript files passed the build audit.
- 120/120 automated tests passed.
- Stable-ticket migration test: 100 legacy trades produced 0 opens and 0 closes.
- Repeated-format test: the same ticket stayed one signal.
- 1,000 repeated 100-open/100-closed snapshot cycles passed under a 64 MB V8 heap.
- Pressure result after garbage collection: 7.19 MB heap used, 40.30 MB heap total.
- Product ledger remained at 200 account trade records during the repeated run.

## Features preserved

- 77 Discord slash commands.
- Desk creation and restoration.
- Culture Lane PostgreSQL durability and boot restoration.
- Website recognition HUD and animated account metrics.
- Persistent 50%, 100%, 150%, and later 50% growth milestones.
- MT4 close, emergency, protect-profit, and Culture Lane relay authority.
