# WISDO v7.0.3 Deployment Checklist

## Before deploying

1. Stop the full live-link crawler until v7.0.3 is active. A broad crawl is noncritical load and can accelerate a heap failure on the old build.
2. Preserve the existing `.env` file locally and all Render secrets.
3. Confirm the ZIP is extracted flat so `package.json` and `package-lock.json` are at the Git repository root.

## Required or recommended Render environment values

```text
NODE_ENV=production
NODE_VERSION=22.22.0
ENABLE_LEGACY_DEADSHOT_MT4_SYNC=false
WISDO_PERSISTENCE_MODE=postgres
DB_POOL_MAX=2
WISDO_DB_BUFFER_LIVE_WRITES=true
WISDO_SIGNAL_BACKGROUND_CONCURRENCY=2
WISDO_SIGNAL_BACKGROUND_MAX_QUEUE=200
WISDO_MT4_COMMAND_HISTORY_LIMIT=250
WISDO_MT4_COMMAND_AUDIT_LIMIT=250
WISDO_MT4_DELIVERY_ID_CACHE_MS=300000
WISDO_REPORTER_HEARTBEAT_INTERVAL_MS=15000
WISDO_MT4_HISTORY_GLOBAL_LIMIT=200
WISDO_MT4_HISTORY_ACCOUNT_LIMIT=40
WISDO_SIGNAL_HISTORY_LIMIT=200
WISDO_MEMORY_SHED_RATIO=0.85
WISDO_RENDER_MEMORY_LIMIT_MB=512
```

Set `WISDO_RENDER_MEMORY_LIMIT_MB` to the actual memory allowance of the deployed Render service. Do not set Node's maximum old-space size above the service's physical memory allowance.

## Local validation before push

```cmd
npm ci
npm run check
```

Expected result:

```text
Build check passed: 107 JavaScript files
100 tests passed
0 tests failed
```

## Production verification

Open:

```text
https://wisdo-mt4-api-bridge.onrender.com/health
https://wisdo-mt4-api-bridge.onrender.com/health/mt4
https://wisdo-mt4-api-bridge.onrender.com/health/performance
https://wisdo-mt4-api-bridge.onrender.com/health/discord
```

Verify:

- `heapUsedRatio` and `rssRatio` are below the configured shed threshold.
- MT4 command queue metrics load without returning a full command-history payload.
- `/mt4-command-poll` normally completes below the 2.5-second slow-request threshold.
- A new command is delivered, acknowledged, and completed by an MT4 Reporter.
- Close commands retain priority over opens and Discord presentation work.
- Discord slash commands and private desks still function.

## Safe link testing after stability is confirmed

Start with no more than 50 links and add a delay between requests. Do not launch multiple link crawlers in parallel. If the server returns `503` with `WISDO_MEMORY_PRESSURE_SHED`, stop the crawl and inspect `/health/performance`.
