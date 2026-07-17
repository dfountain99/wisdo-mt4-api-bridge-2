# WISDO v6.0.9 Deployment and Test Checklist

## Before deployment

- Keep `DATABASE_URL` configured.
- Keep `WISDO_PERSISTENCE_MODE=postgres`.
- Keep `REDIS_ENABLED=false` unless a valid Render Key Value URL exists.
- Keep `WISDO_BACKGROUND_WORKERS_ENABLED=false` during recovery testing.
- Recommended: `WISDO_ACCOUNTS_API_BUDGET_MS=1500`.
- Recommended: `WISDO_ACCOUNTS_RESPONSE_CACHE_MS=5000`.

## Local validation

```cmd
npm ci --no-audit --no-fund
npm run check
```

Expected: 65 tests passed, 0 failed.

## Render validation

1. Deploy the new commit.
2. Open `/health` and confirm PostgreSQL is healthy.
3. Log out and back in to rotate the session cookie.
4. Hard refresh or clear the WISDO service worker/site data.
5. Open `/app/dashboard`.
6. Inspect `/api/v2/accounts?includeReporter=1` in DevTools.
7. Confirm it completes within eight seconds.
8. Confirm the JSON includes `responseMode` and `responseMs`.
9. Open Accounts, Copier Engine, Compound Tracker, Academy, and Lane Intelligence.
10. Confirm all tabs render even when Reporter reconciliation is delayed.
11. Confirm Reporter v1.58 reconnects and account status updates on later refreshes.

## Security

A session cookie was copied into troubleshooting text. Log out of WISDO and log back in after deployment to invalidate the exposed session token.
