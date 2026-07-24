# WISDO v7.0.4 Deployment Checklist

## Render environment

Keep all existing secrets and add or verify:

```text
NODE_VERSION=22.23.1
DB_POOL_MAX=2
WISDO_SIGNAL_BACKGROUND_CONCURRENCY=2
WISDO_SIGNAL_BACKGROUND_MAX_QUEUE=150
WISDO_MT4_ACTIVE_COMMAND_LIMIT=500
WISDO_MT4_ACTIVE_PER_USER_LIMIT=300
WISDO_MT4_ACTIVE_PER_ACCOUNT_LIMIT=125
WISDO_MT4_CRITICAL_COMMAND_LIMIT=200
WISDO_MT4_COMMAND_SCAN_LIMIT=3000
WISDO_MT4_COMMAND_HISTORY_LIMIT=150
WISDO_MT4_COMMAND_AUDIT_LIMIT=150
WISDO_MT4_DELIVERY_CACHE_MAX=500
WISDO_MT4_RATE_LIMIT_CACHE_MAX=750
WISDO_PAIRING_CACHE_MAX=750
WISDO_PAIRING_RECOVERY_MAX=150
WISDO_REPORTER_HEARTBEAT_INTERVAL_MS=15000
WISDO_REPORTER_HEARTBEAT_CACHE_MAX=500
WISDO_ACCOUNT_CACHE_MAX_USERS=250
WISDO_ACCOUNT_SYNC_FLIGHT_MAX=250
WISDO_LEDGER_SYNC_FLIGHT_MAX=250
WISDO_COACH_FLIGHT_MAX=150
WISDO_FUNNEL_RATE_CACHE_MAX=500
WISDO_DISCORD_GRID_TIMER_MAX=100
WISDO_RANK_PROCESS_MIN_INTERVAL_MS=10000
WISDO_RANK_PROCESS_CACHE_MAX=500
WISDO_MEMORY_SHED_RATIO=0.78
WISDO_RENDER_MEMORY_LIMIT_MB=512
WISDO_DURABLE_MUTATION_TIMEOUT_MS=12000
ENABLE_LEGACY_DEADSHOT_MT4_SYNC=false
```

Set `WISDO_RENDER_MEMORY_LIMIT_MB` to the actual Render service memory allowance.

## Build and start commands

```text
Build Command: npm ci --omit=dev --no-audit --no-fund
Start Command: npm start
```

The ZIP is flat: `package.json` and `package-lock.json` are at the archive root.

## Post-deploy tests

Open:

```text
/health
/health/mt4
/health/performance
/health/discord
/api/public/health
/api/runtime-audit
```

Then verify:

1. Log in and wait for Reporter accounts to load.
2. Confirm the member-name/account/P&L recognition animation appears.
3. Switch accounts and confirm the compact HUD changes and reanimates.
4. Create a Culture Lane with one leader and at least one receiver.
5. Refresh the page and verify the lane remains.
6. Manually redeploy/restart the Render service.
7. Confirm the lane, receiver list, risk settings, symbol policy, and Harvest policy remain.
8. Open Copier Relay Health and confirm the active route restored without pressing Repair Live Relay.
9. Review logs for `Culture Lane relay restoration completed`.
10. Confirm `/mt4-command-poll` remains below the slow-request threshold under normal load.

## Safe link testing

Use the paced sequential tester. Do not run the earlier 500-link concurrent crawler against the live trading bridge.
