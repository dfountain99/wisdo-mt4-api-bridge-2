# WISDO V5 Supabase/PostgreSQL Migration

The SQL migration is a production schema path, not an automatic replacement of the current WISDO session system.

## Apply

Use the Supabase SQL editor, CLI, or a PostgreSQL migration runner to apply:

```text
migrations/2026-07-10-wisdo-major-production-v5.sql
```

## Schema areas

- profiles and user roles
- trading accounts and encrypted credential payloads
- account shares/community access
- copier rules and safety controls
- trades and copied-trade linkage
- command records and account snapshots
- subscriptions
- alerts and push subscriptions
- firms/comparison data
- affiliate accounts, conversions, commissions
- Academy progress
- support tickets
- audit log

RLS is enabled for member-owned tables. Service operations should use a server-only service role. Never expose a service-role key to browser code.

## Migration order

1. back up JSON state and database
2. apply schema in a non-production environment
3. import users/profiles and establish identity mapping
4. import accounts without decrypting/re-encrypting credentials in transit
5. import routes, trades, alerts, affiliate records, and Academy progress
6. verify RLS using multiple test users
7. run webhook and MT4 command tests
8. switch persistence mode during a controlled maintenance window

## Realtime

The migration adds supported tables to the Supabase realtime publication when available. Browser realtime is optional; the existing API remains authoritative.
