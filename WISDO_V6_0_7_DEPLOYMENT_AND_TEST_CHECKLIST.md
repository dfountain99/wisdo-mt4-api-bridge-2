# WISDO v6.0.7 Deployment and Test Checklist

## Render environment

Required:

```text
DATABASE_URL=<Render Internal Database URL>
WISDO_PERSISTENCE_MODE=postgres
WISDO_DB_SSL=true
WEB_CONCURRENCY=1
```

Recommended performance values:

```text
DB_POOL_MAX=8
DB_POOL_MIN=0
WISDO_DB_CACHE_TTL_MS=2000
WISDO_DB_CACHE_MAX_STALE_MS=30000
WISDO_MT4_HISTORY_INTERVAL_MS=15000
WISDO_BROKER_SYNC_INTERVAL_SECONDS=120
WISDO_COACH_POLL_INTERVAL_SECONDS=180
WISDO_NOTIFICATION_RETRY_INTERVAL_SECONDS=300
```

Use the Internal Database URL and keep PostgreSQL in the same Render region as the WISDO web service.

## Build settings

```text
Build Command: npm ci --omit=dev --no-audit --no-fund
Pre-Deploy Command: npm run migrate:postgres
Start Command: npm start
```

## Local validation

```cmd
npm config set registry https://registry.npmjs.org/
npm ci --no-audit --no-fund
npm run check
```

Expected:

```text
61 tests
61 pass
0 fail
```

## Post-deploy health

Open:

```text
https://wisdo-mt4-api-bridge.onrender.com/api/public/health
```

Confirm:

```text
version: 6.0.7
persistence: postgres
sharedPostgresPool: true
databaseReadCache: true
fastReporterHeartbeat: true
singleFlightWorkers: true
```

## Reporter recovery test

1. Keep Reporter v1.58 attached to every MT4 terminal.
2. Wait through the current retry backoff or remove and reattach Reporter once.
3. Confirm each terminal changes to Connected.
4. Open `/app/accounts` and confirm every account appears together.
5. Refresh twice and confirm accounts do not disappear.
6. Open Dashboard, Copier Engine, Compound Tracker, Academy, and Lane Intelligence. Tabs should render without long database stalls.

## Relay test

1. Use demo accounts.
2. Confirm leader and receivers are Connected.
3. Open a new leader trade.
4. Confirm every eligible receiver opens the routed trade.
5. Close the leader trade.
6. Confirm stored follower tickets receive priority close commands.
7. Test Close All Culture Lane and Close Leader Trades separately.

## Temporary emergency relief before deploy

When the current v6.0.6 server is unusably slow, set:

```text
WISDO_BACKGROUND_WORKERS_ENABLED=false
```

Redeploy, then deploy v6.0.7. Re-enable the workers after v6.0.7 is live because the new single-flight guards prevent overlap.
