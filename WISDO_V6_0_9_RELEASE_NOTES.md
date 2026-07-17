# WISDO v6.0.9 — Accounts API Fail-Open Recovery

## Production regression repaired

The member workspace boot sequence waits for `GET /api/v2/accounts?includeReporter=1`. In v6.0.8 that route could wait behind the global ecosystem mutation queue while Reporter reconciliation and PostgreSQL state work completed. Because every major member tab loads the account list first, one blocked account refresh made the entire website appear stuck even when `/health` reported a healthy database.

## Changes

- Adds a strict server-side response budget for `/api/v2/accounts`.
- Returns the last PostgreSQL-backed account state when Reporter reconciliation exceeds the budget.
- Continues Reporter reconciliation in one shared background flight instead of starting duplicate work for every tab.
- Adds a short per-user account response cache.
- Prevents repeated account requests from multiplying database pressure.
- Adds response diagnostics: `responseMs`, `responseMode`, `degraded`, `syncDeferred`, `cacheHit`, and `source`.
- Prevents stale cached account results after account deletion.
- Reduces the browser account request timeout to eight seconds.
- Disables the browser's three-attempt retry loop for the critical account bootstrap call.
- Advances the service-worker cache key so browsers receive the repaired workspace bundle.
- Keeps PostgreSQL as durable storage and does not restore JSON or laptop-file persistence.
- Redis remains optional.

## Expected response modes

- `reporter-sync`: Reporter reconciliation completed inside the response budget.
- `hot-cache`: a recent account response was served immediately.
- `fail-open`: stored PostgreSQL account state was returned while Reporter reconciliation continued.
- `stale-cache`: the last in-process account response was returned during temporary database pressure.
- `empty-recovery`: no stored or cached account state was available, but the endpoint still returned instead of hanging.

## Reporter compatibility

CultureCoin Reporter v1.58 remains compatible. No Reporter source update is required for this release.
