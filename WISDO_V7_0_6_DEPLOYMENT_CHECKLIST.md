# WISDO v7.0.6 Deployment Checklist

## Before push

```cmd
npm ci
npm run check
npm run pressure:v706
```

Expected results:

- 112 JavaScript files pass.
- 120 tests pass.
- Pressure output reports `ok: true` and no false signal churn.

## Required Render settings

```text
NODE_VERSION=22.23.1
DB_POOL_MAX=2
WISDO_SIGNAL_BACKGROUND_CONCURRENCY=1
WISDO_SIGNAL_BACKGROUND_MAX_QUEUE=150
WISDO_SIGNAL_TASK_TIMEOUT_MS=15000
WISDO_POST_SNAPSHOT_QUEUE_MAX=50
WISDO_POST_SNAPSHOT_MAX_TRADES=300
WISDO_PRODUCT_TRADES_PER_ACCOUNT_LIMIT=1000
WISDO_ACCOUNT_TELEMETRY_LIMIT=500
WISDO_MEMBER_ALERT_LIMIT=250
WISDO_LIVE_TRADE_EVENT_KEY_LIMIT=2000
WISDO_RELAY_DIAGNOSTIC_LIMIT=500
WISDO_MEMORY_SHED_RATIO=0.70
WISDO_RENDER_MEMORY_LIMIT_MB=512
ENABLE_LEGACY_DEADSHOT_MT4_SYNC=false
```

Set `WISDO_RENDER_MEMORY_LIMIT_MB` to the actual Render service memory if it differs.

Keep the v7.0.5 MT4 poll and command limits already configured.

## Reporter

- Compile and install Reporter v1.59.
- Remove old Reporter instances from every chart.
- Keep one active Reporter lease per MT4 account.
- Extra chart instances should show Standby.

## Production verification

1. Confirm startup log reports version 7.0.6.
2. Confirm `Culture Lane relay restoration completed` has zero failures.
3. Observe the first two heartbeats for the 100-trade account.
4. After automatic legacy migration, unchanged tickets must report:

```text
copySignalsOpened: 0
copySignalsClosed: 0
```

5. Open `/health/performance` and confirm heap/RSS stabilize instead of rising every heartbeat.
6. Test one new leader trade and confirm exactly one open-copy event.
7. Close that ticket and confirm exactly one close-copy event.
8. Restart the Render service and confirm the same open tickets do not replay.
9. Confirm Culture Lanes and receiver membership restore after restart.
10. Confirm the website recognition HUD and 50% milestone queue still load.
