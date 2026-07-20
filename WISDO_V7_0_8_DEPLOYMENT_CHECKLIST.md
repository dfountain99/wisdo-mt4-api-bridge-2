# WISDO v7.0.8 Deployment Checklist

## 1. Before push

Run:

```bash
npm ci
npm run check
npm run pressure:v708
```

Expected:

- build audit passes;
- 127 tests pass;
- pressure report shows 5,000 commits, zero full-namespace loads/writes, and stable heap.

## 2. Render configuration

Required:

```text
DATABASE_URL=<Render PostgreSQL URL>
WISDO_DB_SSL=true
WISDO_DATABASE_FIRST_TRADING=true
WISDO_DB_BUFFER_LIVE_WRITES=false
DB_POOL_MAX=2
WISDO_DB_QUERY_TIMEOUT_MS=5000
WISDO_DB_STATEMENT_TIMEOUT_MS=4000
NODE_OPTIONS=--max-old-space-size=320
WISDO_RENDER_MEMORY_LIMIT_MB=512
ENABLE_LEGACY_DEADSHOT_MT4_SYNC=false
```

Keep existing Discord, session, encryption, MT4 API-key, pairing-signing, Square, email, and notification secrets.

## 3. Pre-deploy migration

`render.yaml` now declares:

```text
preDeployCommand: npm run migrate:postgres
```

The migration must log:

```text
WISDO PostgreSQL v7.0.8 database-first trading migration complete.
```

## 4. Startup verification

Confirm:

```text
culture-coin-operator-desks-bot@7.0.8
API/member portal listening
Culture Lane relay restoration completed
Discord bot is ready
```

## 5. Database verification

Using the Render PostgreSQL shell, verify:

```sql
select count(*) from wisdo_mt4_accounts;
select count(*) from wisdo_mt4_pairings;
select status, count(*) from wisdo_mt4_commands group by status;
select count(*) from wisdo_trade_signals;
```

After the first Reporter heartbeat, the connected account should appear in `wisdo_mt4_accounts`.

## 6. Live Reporter verification

Use Reporter v1.59 once per MT4 account. Confirm an unchanged 100-ticket account reports zero new opens and zero closes after its baseline is established.

## 7. Health verification

Open:

```text
/health
/health/mt4
/health/performance
/health/discord
/api/public/health
/api/runtime-audit
```

Heap should settle after startup rather than rising on every heartbeat.

## 8. Rollback

If the migration fails, do not remove the previous PostgreSQL JSON sections. Roll back the application commit; v7.0.8 imports existing account/pairing state only when the new relational tables are empty.
