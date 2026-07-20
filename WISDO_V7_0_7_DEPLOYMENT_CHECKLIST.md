# WISDO v7.0.7 Deployment Checklist

## Local validation

```cmd
npm ci
npm run check
npm run pressure:v706
npm run pressure:v707
```

Expected:

- 114 JavaScript files pass the build audit
- 124/124 tests pass
- Both pressure scripts print `"ok": true`

## Required Render environment

```text
NODE_OPTIONS=--max-old-space-size=320
DB_POOL_MAX=2
WISDO_DB_BUFFER_LIVE_WRITES=true
WISDO_SIGNAL_BACKGROUND_CONCURRENCY=1
WISDO_SIGNAL_BACKGROUND_MAX_QUEUE=150
WISDO_SIGNAL_TASK_TIMEOUT_MS=15000
WISDO_LOW_MEMORY_RELAY_MODE=true
WISDO_POST_SNAPSHOT_SKIP_HEAP_RATIO=0.58
WISDO_POST_SNAPSHOT_QUEUE_MAX=25
WISDO_MT4_MAX_NEW_SIGNALS_PER_SNAPSHOT=40
WISDO_MT4_SIGNAL_CHURN_GUARD=20
WISDO_REPLAY_EXISTING_TRADES_ON_FIRST_SYNC=false
WISDO_RANK_PROCESS_MIN_INTERVAL_MS=10000
WISDO_RANK_PROCESS_CACHE_MAX=500
WISDO_DASHBOARD_UPDATE_SECONDS=60
WISDO_MEMORY_SHED_RATIO=0.65
WISDO_RENDER_MEMORY_LIMIT_MB=512
ENABLE_LEGACY_DEADSHOT_MT4_SYNC=false
```

Use a smaller `NODE_OPTIONS` value if the service has less than 512 MB total memory. Do not set the V8 heap close to the complete container allowance because native libraries, buffers, TLS, PostgreSQL, Discord, and the runtime also consume memory.

## Deploy

1. Copy the flat release into the existing Git repository while preserving `.git` and `.env`.
2. Run validation.
3. Commit and push `main`.
4. Confirm Render runs the PostgreSQL pre-deploy migration.
5. Confirm startup reports v7.0.7.

## Live checks

```text
/health
/health/mt4
/health/performance
/health/discord
/api/public/health
/api/runtime-audit
```

Confirm:

- heap pressure remains below the configured shedding threshold
- background queue returns toward zero
- command queues remain bounded
- Culture Lane restoration reports no failures
- Reporter command-poll responses remain compact JSON
- unchanged broker tickets do not produce new open/close signals

## Reporter

Use Culture Coin Reporter v1.59. Remove older Reporter copies from all charts. Only one active Reporter lease should poll per MT4 account; extra instances should remain in Standby.
