# WISDO v6.0.0 Deployment Checklist

## 1. Use this ZIP as the full repository

Do not overlay only selected files onto an unknown older build. This package already contains the complete v5.8 application, the v5.9 persistence overlay, and the v6 reliability/product additions.

## 2. Required Render environment

```text
NODE_ENV=production
WISDO_PERSISTENCE_MODE=postgres
DATABASE_URL=<Render PostgreSQL internal URL>
WISDO_DB_SSL=true
REDIS_ENABLED=true
REDIS_URL=<Render Key Value / Redis internal URL>
REDIS_PREFIX=wisdo
REDIS_HEALTH_TTL_SECONDS=90
REDIS_RECOVERY_INTERVAL_MS=15000
REDIS_VISIBILITY_TIMEOUT_MS=30000
REDIS_MAX_DELIVERY_ATTEMPTS=5
```

Keep all existing Discord, MT4, Square, session, encryption, webhook, email, and notification secrets.

## 3. Install and verify

```bash
npm ci --no-audit --no-fund
npm run check
npm run migrate:postgres
npm start
```

Expected test result: 37 passing tests.

## 4. Confirm health

- `/health` returns HTTP 200.
- `/api/public/health` reports version `6.0.0`.
- `/api/copier-infrastructure-health` reports PostgreSQL connected and Redis connected.
- Redis `health:api` remains renewed beyond 90 seconds.
- Reporter polling updates `wisdo_receiver_heartbeats`.

## 5. Verify command lifecycle with a demo account

1. Queue a harmless `SYNC_ACCOUNT` or `PAUSE_BOT` command.
2. Confirm one account stream entry is created, not both account and user execution queues.
3. Confirm the website command receives `bridgeDelivery.state`.
4. Confirm Reporter poll marks it delivered.
5. Confirm completion changes PostgreSQL status to completed.
6. Re-submit the same command ID and verify it becomes an idempotent replay rather than a duplicate execution.

## 6. Verify Culture Lane OS on demo accounts

1. Create one leader and at least one owned follower.
2. Create a Culture Lane.
3. Upload the follower broker symbol inventory.
4. Save a Symbol Policy and test symbol resolution.
5. Save a Harvest policy.
6. Evaluate without `execute` first.
7. Only test confirmed Harvest execution on demo accounts.
8. Review Timeline, Genome, Passport, DNA, and Intelligence responses.

## 7. Production boundary

Do not enable automatic Harvest execution on funded accounts until Reporter completion, flat-state verification, reconnect behavior, and broker-specific symbol translation have been validated in a multi-terminal demo environment.
