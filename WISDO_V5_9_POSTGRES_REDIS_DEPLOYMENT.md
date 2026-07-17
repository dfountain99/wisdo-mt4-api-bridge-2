# WISDO v5.9 PostgreSQL + Redis Production Upgrade

This build does not use lazy loading. The complete application state is loaded eagerly at startup/request-cache initialization, while PostgreSQL stores each top-level domain section separately instead of rewriting one giant JSON row.

## Render services

Create or attach:

1. Render PostgreSQL database
2. Render Key Value / Redis-compatible instance
3. Existing WISDO web service

Set these environment variables on the web service:

```env
WISDO_PERSISTENCE_MODE=postgres
DATABASE_URL=<Render internal PostgreSQL URL>
DB_SSL=true
DB_POOL_MAX=10
DB_CONNECT_TIMEOUT_MS=10000
DB_IDLE_TIMEOUT_MS=30000
REDIS_ENABLED=true
REDIS_URL=<Render internal Redis URL>
REDIS_PREFIX=wisdo
```

Run once before the first production start:

```bash
npm install
npm run migrate:postgres
```

Then deploy normally with `npm start`.

## Verification

Open:

```text
/api/copier-infrastructure-health
```

The response must show PostgreSQL connected and Redis connected before funding live accounts.

## Architecture

- PostgreSQL is the permanent record.
- Redis is the immediate command broadcast, pending-command index, acknowledgement channel, and heartbeat store.
- Existing MT4 command methods are decorated transparently, so every queued account command is published to Redis and every delivered/completed/failed status is acknowledged.
- If Redis is temporarily unavailable, the existing command service remains operational and PostgreSQL/file persistence remains the fallback source of truth.
- Existing `wisdo_kv_store` data is imported automatically into sectioned rows on first load.
