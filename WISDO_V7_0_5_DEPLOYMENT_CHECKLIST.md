# WISDO v7.0.5 Deployment Checklist

## 1. Replace the repository contents

Extract the flat release ZIP and copy it into the existing Git repository while preserving `.git` and `.env`.

## 2. Verify locally

```cmd
npm ci
npm run check
```

Expected result: all JavaScript files pass the build audit and 114 tests pass.

## 3. Render environment

Keep all existing secrets. Add or update:

```text
DB_POOL_MAX=2
WISDO_SIGNAL_BACKGROUND_CONCURRENCY=2
WISDO_SIGNAL_BACKGROUND_MAX_QUEUE=150

WISDO_MT4_POLL_AFTER_MS=2000
WISDO_MT4_POLL_BURST_MS=750
WISDO_MT4_POLL_CACHE_MAX=750
WISDO_MT4_COMMAND_RESPONSE_MAX_BYTES=16384

WISDO_COPY_COMMAND_ACTIVE_LIMIT=250
WISDO_COPY_COMMAND_PER_USER_LIMIT=100
WISDO_COPY_COMMAND_PER_ACCOUNT_LIMIT=75
WISDO_COPY_COMMAND_CRITICAL_LIMIT=100
WISDO_COPY_COMMAND_SCAN_LIMIT=2000
WISDO_COPY_COMMAND_HISTORY_LIMIT=100
WISDO_COPY_SIGNAL_HISTORY_LIMIT=300
WISDO_COPY_AUDIT_LIMIT=300
WISDO_COPY_TRADE_LOG_LIMIT=300
WISDO_COPY_TICKET_ACCOUNT_LIMIT=250
WISDO_COPY_TICKET_PER_ACCOUNT_LIMIT=500

WISDO_MT4_ACTIVE_COMMAND_LIMIT=500
WISDO_MT4_ACTIVE_PER_USER_LIMIT=300
WISDO_MT4_ACTIVE_PER_ACCOUNT_LIMIT=125
WISDO_MT4_CRITICAL_COMMAND_LIMIT=200
WISDO_MT4_COMMAND_SCAN_LIMIT=3000
WISDO_MT4_COMMAND_HISTORY_LIMIT=150
WISDO_MT4_COMMAND_AUDIT_LIMIT=150

WISDO_MEMORY_SHED_RATIO=0.70
WISDO_RENDER_MEMORY_LIMIT_MB=512
ENABLE_LEGACY_DEADSHOT_MT4_SYNC=false
```

Set `WISDO_RENDER_MEMORY_LIMIT_MB` to the actual service memory if it is not 512 MB.

## 4. Replace every Reporter

1. Open MetaEditor.
2. Replace the old source with `mql4/CultureCoin_MT4_Reporter.mq4` v1.59.
3. Compile it.
4. Remove older Reporter copies from all charts.
5. Attach v1.59 once per account/terminal.
6. Confirm the dashboard shows v1.59. Additional copies should show `Standby` instead of polling.

## 5. Verify live health

Open:

```text
/health
/health/mt4
/health/performance
/health/discord
```

`/health/performance` should show:

- `mt4Poll.maxResponseBytes` below `mt4Poll.responseLimitBytes`;
- a bounded `copyCommands.total`;
- stable heap and RSS;
- no continuously growing background queue.

## 6. Verify Culture Lane durability

Create or edit a lane, wait for success, manually redeploy, then confirm:

- lane leader and receivers remain;
- profile/risk/symbol/harvest rules remain;
- startup logs include `Culture Lane relay restoration completed`.

## 7. Verify recognition

Log in after account data has loaded. Confirm the entrance animation shows name, identity/rank, selected account, balance, equity, floating P/L, and open trades. Switch accounts and confirm the HUD follows the selected account.
