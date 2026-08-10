# WISDO Major Stability Upgrade — Deployment Checklist

1. Run `npm ci`, `npm run check`, and `npm run pressure:v708`.
2. Keep Render's shutdown grace period at 10 seconds or longer.
3. Optionally set `WISDO_SHUTDOWN_TIMEOUT_MS=10000`; accepted runtime values are bounded to 1–30 seconds.
4. Deploy and confirm startup health endpoints are green.
5. Trigger one controlled restart and confirm `Shutdown requested` appears before the next startup.
6. Confirm there are no `API resource shutdown failed` or `Graceful shutdown deadline exceeded` entries.
7. Confirm Reporter reconnects and command polling resumes after restart without duplicate commands.

Rollback requires only the previous application commit; this upgrade adds no database migration.
