# Wisdo Final Mass Upgrade Report

Date: 2026-07-04

## Files Changed In This Sprint

- `server/apiServer.js`
- `services/signalCopyService.js`

This sprint also verified current Phase 2 Signal Grid files already present from the prior pass:

- `services/discordSignalGridService.js`
- `commands/signalGrid.js`
- `index.js`
- `docs/architecture/wisdo-signal-grid.md`

## Passes Completed

- Verified canonical boot path: `render.yaml -> npm start -> node index.js`.
- Verified canonical config, command registry, root services, and `server/apiServer.js` source of truth docs.
- Re-read source-of-truth, service merge, persistence, database, Signal Grid, RBAC, and Discord role sync docs.
- Added `/member/risk-settings` exact route before legacy `/member/*` fallbacks.
- Added `/member/marketplace` exact route before legacy `/member/*` fallbacks.
- Upgraded risk profile UI into a Risk Settings / Risk Passport page.
- Added missing `POST /api/me/risk-profile`.
- Added `GET /api/me/risk-profile`.
- Persisted risk profiles into both `riskProfilesByUserId` and `copyRiskProfilesByUserId`.
- Added risk passport fields: risk percent, risk dollars, daily/weekly loss limits, open trade limits, exposure, drawdown, spread, slippage, min/max lot, lot step, paper default, live confirmation, disclaimer acceptance.
- Added safe and gold/XAU risk presets.
- Wired `SignalCopyService` to fall back to the saved risk passport when account-level copy risk is missing.
- Added secret-free runtime readiness data to `/health`.
- Fixed route order for new exact member routes.
- Added explicit JSON validation response for rejected MT4 command queue actions.
- Confirmed dangerous MT4 command without confirmation is blocked.
- Confirmed dangerous MT4 command with confirmation is accepted for owner/account smoke.

## Systems Upgraded

- Member navigation and route order.
- Risk passport and Signal Grid copy readiness.
- Signal copy risk fallback.
- Runtime health/readiness reporting.
- MT4 dangerous command error handling.
- Marketplace route discoverability.

## Passes Skipped Or Deferred

- Duplicate folder deletion was skipped by rule.
- Full normalized Postgres table backfill was not attempted.
- Full frontend visual redesign of Signal Grid, education, simulator, marketplace, admin, and social pages was not attempted.
- Real Discord API live role fetch and command registration were not run because local smoke does not include production Discord credentials.
- Real Stripe checkout/webhook smoke was not run because live Stripe configuration is not present.
- Broker-specific margin estimate model remains deferred.
- Education-completion enforcement is still a future hardening pass.
- Ephemeral Discord account selector remains a Phase 3 improvement.

## Tests Run

- `node --check index.js`
- `node --check config.js`
- `node --check commands/index.js`
- `node --check commands/signalGrid.js`
- `node --check server/apiServer.js`
- `node --check services/signalCopyService.js`
- `node --check services/discordSignalGridService.js`
- `node --check scripts/startWebOnly.js`
- Web/API boot smoke on local temporary ports.
- `/health`
- `/`
- `/member`
- `/member?userId=owner-smoke`
- `/member/command-center`
- `/member/education`
- `/member/simulator`
- `/member/social`
- `/member/signal-grid`
- `/member/risk-settings`
- `/member/marketplace`
- `/member/admin-wisdo` denied user
- `/member/admin-wisdo` owner user
- `GET /api/wisdo/models`
- `GET /api/wisdo/marketplace`
- `GET /api/wisdo/signal-grid`
- `POST /api/wisdo/signal-grid/preview-copy`
- `POST /api/wisdo/signal-grid/copy-basket` non-premium blocked
- `POST /api/wisdo/signal-grid/copy-basket` owner paper-mode success
- `GET /api/wisdo/affiliate/dashboard`
- admin affiliate endpoint denied for non-admin
- role API
- risk profile save/load
- MT4 dangerous command without confirmation
- MT4 dangerous command with confirmation

## Test Results

- Syntax checks passed.
- `/health` returned `200`.
- Homepage returned `200`.
- `/member` returned preview for logged-out smoke and redirected to command center with explicit identity.
- Core member pages returned `200`.
- `/member/risk-settings` returned `200` after route-order fix.
- `/member/marketplace` returned `200` after route-order fix.
- Admin page returned `403` for normal user and `200` for owner.
- Signal Grid API returned `200` with seeded smoke cell.
- Copy preview allowed owner smoke user and returned projected lot.
- Non-premium copy returned `403` with exact role requirement.
- Owner paper copy returned `200` and `paper_recorded`.
- Affiliate dashboard returned `200`.
- Admin affiliate endpoint returned `403` for non-admin.
- Risk profile save/load returned `200` and persisted disclaimer acceptance.
- Dangerous MT4 command without confirmation returned `400 confirmation_required`.
- Dangerous MT4 command with confirmation returned `200`.

## Known Risks

- The working tree contains many existing dirty files and untracked phase files from prior upgrade passes. Review before staging broadly.
- `scripts/startWebOnly.js` is expected to work through canonical config, but this sprint used direct web boot smokes rather than a long-running `npm run start:web` process.
- `/api/wisdo/command` has duplicate route definitions later in `server/apiServer.js`; both now return clean validation errors, but a future cleanup should reduce duplicated route bodies.
- Saved risk passport now feeds Signal Copy fallback, but account-specific copy risk still takes precedence.
- Live copy still depends on connected account health and MT4 bridge behavior that require production-like testing.
- Stripe/payment flows remain manual or placeholder unless Stripe env/webhooks are configured.

## Env / Render Notes

- Keep `WISDO_PERSISTENCE_MODE=json` for local/dev.
- For Render Postgres, set `WISDO_PERSISTENCE_MODE=postgres`, `DATABASE_URL`, and `WISDO_DB_SSL=true`.
- `PUBLIC_BASE_URL` should be origin-only, for example `https://your-service.onrender.com`.
- `/health` now reports persistence mode, database URL configured flag, public base URL configured flag, origin-only status, and MT4 sync path without exposing secrets.
- Render start path remains `npm start`.

## Safe To Push?

Conditionally yes for a feature branch after reviewing the dirty worktree. The app is bootable in local web smoke and the launch-critical routes passed. Because the repo has many pre-existing modified/untracked files, do not blindly stage if you intend to split phases into separate commits.

Recommended if pushing the full current upgrade state:

```bash
git status
git add .
git commit -m "Upgrade Wisdo command center, signal grid, RBAC, marketplace, education, and affiliate systems"
git push
```

Recommended safer review flow:

```bash
git status --short
git diff -- server/apiServer.js services/signalCopyService.js
git add server/apiServer.js services/signalCopyService.js docs/architecture/wisdo-final-mass-upgrade-report.md
git commit -m "Finalize Wisdo risk settings and launch readiness smoke report"
```

## Next Recommended Pass

1. Archive duplicate copied source trees in small batches after a clean commit.
2. Add Discord ephemeral account selector for Signal Grid copy actions.
3. Add education-completion checks to live copy gating.
4. Add marketplace admin publish/archive/grant UI polish.
5. Add Stripe activation-fee checkout/webhook smoke with test keys.
6. Run production-like Discord command registration and interaction tests in a staging guild.
