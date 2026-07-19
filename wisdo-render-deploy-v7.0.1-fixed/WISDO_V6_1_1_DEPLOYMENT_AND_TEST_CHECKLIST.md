# WISDO v6.1.1 Deployment and Test Checklist

1. Extract the ZIP into a fresh folder.
2. Run `npm ci --no-audit --no-fund`.
3. Run `npm run check` and confirm 70/70 tests pass.
4. Deploy to the Render-connected `main` branch.
5. Set `WISDO_MUTATION_SAVE_BUDGET_MS=500`.
6. Keep `WISDO_DB_BUFFER_LIVE_WRITES=true`.
7. Keep PostgreSQL and the existing healthy `DATABASE_URL` settings.
8. Keep Redis disabled until core website behavior is stable.
9. After deployment, clear site data/service worker and log in again.
10. On `/app/accounts`, assign account `5205295:Coinexx-Demo` as Culture Lead and Community.
11. Verify the PATCH returns HTTP 200 in under 2 seconds.
12. Verify the response contains `responseMode: hot-state-write` and the updated account.
13. Reload the page and confirm the role survived from PostgreSQL.
