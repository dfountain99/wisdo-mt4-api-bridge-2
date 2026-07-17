# WISDO v6.1.0 Deployment and Test Checklist

## 1. Local extraction and validation

```cmd
cd /d "%USERPROFILE%\Downloads"

powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path '%USERPROFILE%\Downloads\wisdo-v610-git') { Remove-Item '%USERPROFILE%\Downloads\wisdo-v610-git' -Recurse -Force }; Expand-Archive -LiteralPath '%USERPROFILE%\Downloads\WISDO_CULTURE_LANE_OS_V6_1_0_FULL_QUEUE_AUDIT_PERFORMANCE_RECOVERY_FULL.zip' -DestinationPath '%USERPROFILE%\Downloads\wisdo-v610-git' -Force"

cd /d "%USERPROFILE%\Downloads\wisdo-v610-git"

npm config set registry https://registry.npmjs.org/
npm ci --no-audit --no-fund
npm run check
```

Expected:

```text
69 tests
69 pass
0 fail
```

## 2. Replace the Render repository working tree

```cmd
cd /d "%USERPROFILE%\Downloads"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem '%USERPROFILE%\Downloads\wisdo-render-deploy' -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force"

robocopy "%USERPROFILE%\Downloads\wisdo-v610-git" "%USERPROFILE%\Downloads\wisdo-render-deploy" /E /XD node_modules .git .cache logs data /XF .env "*.log"

cd /d "%USERPROFILE%\Downloads\wisdo-render-deploy"

git status
git add -A
git commit -m "Deploy WISDO v6.1.0 full queue audit and performance recovery"
git push origin main
```

## 3. Render environment

Required:

```text
DATABASE_URL=<Render PostgreSQL internal URL>
WISDO_PERSISTENCE_MODE=postgres
WEB_CONCURRENCY=1

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

WISDO_ACCOUNTS_API_BUDGET_MS=1500
WISDO_ACCOUNTS_RESPONSE_CACHE_MS=5000

REDIS_ENABLED=false
WISDO_BACKGROUND_WORKERS_ENABLED=false
```

Use the database SSL setting that already produces a healthy `/health` response. Do not change a working database SSL configuration during this deployment.

Redis is optional. Do not add `REDIS_URL` until a real Render Key Value service exists and the core portal is stable.

## 4. Render build settings

```text
Build Command:
npm ci --omit=dev --no-audit --no-fund

Pre-Deploy Command:
npm run migrate:postgres

Start Command:
npm start

Health Check Path:
/health
```

## 5. Browser reset

A live session cookie was previously copied into debugging output. After deployment:

1. Log out of WISDO.
2. Open Chrome DevTools.
3. Application → Service Workers → Unregister.
4. Application → Storage → Clear site data.
5. Close all WISDO tabs.
6. Open `/login` and sign in again.

## 6. Core health test

Open `/health` and verify:

```text
ok: true
persistenceMode: postgres
cloudOnly: true
filePersistence: false
database.status: healthy
poolCount: 1
```

## 7. Page-load test

Open these pages in order:

1. `/app/accounts`
2. `/app/dashboard`
3. `/app/copier-engine`
4. `/app/trades`
5. `/app/compound-tracker`
6. `/app/academy`
7. `/app/lane-intelligence`

In DevTools Network:

- `/api/v2/accounts?includeReporter=1` should complete rather than remain Pending.
- The Accounts role PATCH should complete without a second full Accounts refresh.
- `/media/14683743_3840_2160_30fps.mp4` should not appear unless that motion theme is selected.
- No normal page should download both background videos.

## 8. Reporter test

Keep Reporter v1.58 attached.

1. Confirm each Reporter reaches Connected or Degraded rather than permanent Error.
2. Confirm all connected accounts appear together.
3. Open one new demo leader trade.
4. Confirm every configured receiver copies it.
5. Close the leader trade.
6. Confirm every receiver closes the stored follower ticket.
7. Test Close All Culture Lane.
8. Test Close Leader Trades.

## 9. Persistence test

1. Save an account desk role.
2. Save a Culture Lane.
3. Save symbol permissions.
4. Save a Compound Tracker goal.
5. Redeploy the same commit.
6. Confirm all four records remain.

## 10. Re-enable optional workers

Only after the portal and Reporters remain stable, set:

```text
WISDO_BACKGROUND_WORKERS_ENABLED=true
```

Keep Redis disabled until a valid Redis service is intentionally connected.
