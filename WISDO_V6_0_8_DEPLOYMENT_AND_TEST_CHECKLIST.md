# WISDO v6.0.8 Deployment and Recovery Checklist

## Render environment

Required:

```text
DATABASE_URL=<Render Internal Database URL>
WISDO_PERSISTENCE_MODE=postgres
WISDO_DB_SSL=true
WEB_CONCURRENCY=1
```

Recovery settings:

```text
DB_POOL_MAX=4
DB_POOL_MIN=0
DB_CONNECT_TIMEOUT_MS=5000
WISDO_DB_QUERY_TIMEOUT_MS=5000
WISDO_DB_STATEMENT_TIMEOUT_MS=4000
WISDO_DB_CIRCUIT_BREAKER_MS=5000
WISDO_DB_CACHE_TTL_MS=10000
WISDO_DB_CACHE_MAX_STALE_MS=300000
WISDO_DB_FAIL_OPEN_READS=true
WISDO_DB_BUFFER_LIVE_WRITES=true
WISDO_DB_WRITE_DEBOUNCE_MS=100
WISDO_DB_RETRY_MS=1500
WISDO_BACKGROUND_WORKERS_ENABLED=false
```

Use the Internal Database URL and keep PostgreSQL in the same Render region as the web service.

Optional real-time command layer:

```text
REDIS_ENABLED=true
REDIS_URL=<Render Key Value internal URL>
```

If no Redis service exists, set `REDIS_ENABLED=false` until one is created.

## Render commands

```text
Build Command: npm ci --omit=dev --no-audit --no-fund
Pre-Deploy Command: npm run migrate:postgres
Start Command: npm start
```

## Validation

```cmd
npm ci --no-audit --no-fund
npm run check
```

After deploy, open `/health` and confirm:

```text
cloudOnly: true
filePersistence: false
database.mode: postgres-with-hot-cache
database.status: healthy or recovering
```

## Reporter recovery

1. Keep Reporter v1.58 attached.
2. Confirm the base Render URL remains allowed in MT4 WebRequest settings.
3. Signed pairing codes should recover automatically.
4. Legacy unsigned pairing codes must be regenerated.
5. Open one demo trade only after the account appears in `/app/accounts`.
6. Verify copy open and copy close before enabling live accounts.

## Re-enable workers

After tabs and all Reporters stay healthy, set:

```text
WISDO_BACKGROUND_WORKERS_ENABLED=true
```
