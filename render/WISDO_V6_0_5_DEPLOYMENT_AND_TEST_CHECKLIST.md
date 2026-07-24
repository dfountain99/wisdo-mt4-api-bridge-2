# WISDO v6.0.5 Deployment and Test Checklist

## Build

```cmd
npm ci --no-audit --no-fund
npm run check
```

Expected: 52 tests pass with zero failures.

## Render

Confirm `/api/public/health` reports:

- `version: 6.0.5`
- `persistence: postgres`
- `comprehensiveCompoundTracker: true`

## Compound Tracker

Open `/app/compound-tracker` and test:

1. Scope selector: portfolio, Culture Lane, individual account.
2. Period selector: today, 7d, 30d, 90d, year, all time.
3. Save daily, weekly, and monthly dollar goals; refresh and confirm persistence.
4. Compare combined balance/equity with the dashboard.
5. Compare closed-trade P/L against MT4 Account History.
6. Verify symbol and account contribution tables.
7. Expand a close tracker and confirm command ID, completion time, closed/failed counts, and Reporter payload.
8. Export visible trades and open the CSV.
9. Redeploy Render and confirm saved goals and tracker history remain.

## Safety

Use demo accounts until Reporter v1.57 sync, live relay registration, copy open, copy close, lane close, and Harvest confirmation all pass.
