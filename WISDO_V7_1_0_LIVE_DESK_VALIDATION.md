# WISDO v7.1.0 Live Desk — Validation Evidence

Date: 2026-08-10

## Passed in the build environment

- JavaScript syntax checks for the Live Desk service, server views, host client, viewer client, directory client, and canonical website router.
- `node --test tests/live-desk.test.js`: **9/9 passed**.
- `node scripts/checkBuild.js`: passed; 316 JavaScript files and 14 required production assets checked.
- `node scripts/auditRuntime.js`: canonical production entrypoint confirmed.
- `node scripts/auditCommands.js`: **100 unique Discord commands**, no duplicates or invalid names.
- `node scripts/auditStubs.js`: **0 review-required production stubs**.
- `node scripts/auditSecrets.js`: passed; no runtime `.env` or obvious committed credentials.
- No trailing whitespace in the changed JavaScript sources.

## Full-suite environment limitation

A full `node --test tests/*.test.js` run was also attempted using the only dependency tree available in this sandbox. It produced 226 passes and 3 failures. Those three failures are attributable to the validation dependency tree rather than Live Desk behavior:

1. `tests/major-product.test.js` cannot import `web-push` because that package is absent from the old validation dependency tree.
2. `tests/v702-transport-sync-repair.test.js` expects the repository postinstall patch to have modified `node_modules/ws`; the borrowed validation dependency tree was not installed through this repository's `npm ci`/postinstall lifecycle.
3. `tests/wisdoReleaseReadiness.test.js` cannot import `pg` because that package is absent from the old validation dependency tree.

The release therefore requires a normal `npm ci` in the user's Windows/GitHub/Render environment followed by the canonical gates before production deployment. No dependency was added for Live Desk itself.

## Production acceptance tests still required after deployment

- Host screen/window capture over HTTPS.
- Private My Devices owner-only join.
- Private Room wrong-code rejection and correct-code success.
- Selected Members and Members Only authorization.
- Public discovery and Unlisted non-discovery.
- Real desktop-to-phone viewing across Wi-Fi and cellular.
- TURN relay path on a restrictive network.
- Viewer remove and block.
- Panic Stop and browser capture-ended auto-stop.
- Logout termination.
- Account overlay refresh without exposing broker credentials.
- Fullscreen and Picture-in-Picture on supported mobile browsers.
