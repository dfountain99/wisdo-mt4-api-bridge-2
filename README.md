# WISDO Culture Lane OS v7.0.8

Database-first production repair for repeated Render heap exhaustion.

The high-frequency trading path no longer treats PostgreSQL like one large JSON file. Reporter heartbeats, account snapshots, pairing records, command queues, and trade signals use dedicated indexed PostgreSQL tables and row-level transactions.

Key protections:

- One Reporter heartbeat reads only the requested account and signal-tracking rows.
- One heartbeat commits only pairing, account, tracking, active-account, and optional compact-history rows.
- MT4 commands use a bounded relational queue with dedupe and priority indexes.
- Trade signals use a relational table keyed by signal and broker ticket.
- Culture Lanes remain PostgreSQL-durable and restore after crashes or redeploys.
- Account sharing and legacy copier-route metadata remain in a small compatibility namespace, separate from hot MT4 data.
- Website identity recognition and each 50% growth milestone remain enabled.
- Reporter v1.59 remains required so one terminal/account performs the polling lease.

Validate before deployment:

```bash
npm ci
npm run check
npm run pressure:v708
```

Render runs `npm run migrate:postgres` before starting the service.
