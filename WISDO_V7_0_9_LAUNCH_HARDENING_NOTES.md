# WISDO v7.0.9 Launch Hardening

Date: 2026-08-10

## Fixed in this build

- Pi speech dependency upgraded from PocketSphinx 5.0.4 to 5.1.1.
- Pi microphone capture now supports native device sample rates, mono/stereo devices, S16/S32 capture, channel selection, 32-bit scaling, and 16 kHz STT output.
- Pi installer now preserves `.env` and `data/device-token` across upgrades and restores correct runtime ownership/permissions.
- MT4 PostgreSQL snapshot persistence uses a per-account transaction advisory lock, bounded retries for PostgreSQL deadlock/serialization errors, and moves global history pruning outside the authoritative snapshot transaction behind a non-blocking advisory lock.
- Voice trading is explicitly pinned to `DEMO_ONLY` in the canonical Render blueprint.
- Render auto-deploy is disabled so a Git push cannot bypass release validation.
- Affiliate default commission is 50%, matching a 50/50 company/sales split.
- Public performance mockups are labeled illustrative/target/measured instead of presenting unverified portfolio, latency, uptime, or zero-delay claims as observed production facts.
- Platform marketing now distinguishes the live MT4 Reporter from staged/roadmap connectors.
- Added `audit:secrets` and a required GitHub launch-gates workflow.
- Expanded `.gitignore` for runtime env files, node_modules, and private-key material.
- Product/build identity normalized to v7.0.9 launch-hardening.
- Added a regression test proving MT4 snapshot persistence retries a deadlock and keeps global history pruning out of the snapshot transaction.

## Validation performed in the repair environment

- JavaScript syntax checks: passed for changed runtime/test files.
- `python3 -m py_compile pi-edge/wisdo_edge.py`: passed.
- `bash -n pi-edge/install.sh`: passed.
- `npm run lint`: passed.
- `npm run audit:runtime`: passed.
- `npm run audit:commands`: passed, 100 unique commands.
- `npm run audit:stubs`: passed, 0 review-required production stubs.
- `npm run audit:secrets`: passed.
- 218/218 runnable Node tests passed using the dependency tree supplied in the prior WISDO package.
- Fresh `npm ci` could not complete in the repair sandbox because its internal npm mirror returned 404 for `xtend@4.0.2`. The two omitted original test files require `pg`/`web-push`, which were not present in the supplied legacy dependency tree. Run the canonical fresh install and full suite in GitHub/Windows/Render before production merge.

## External actions still required

These cannot be safely performed by source code alone:

1. Rotate any Discord/OpenAI credentials that were ever packaged in an old distributable `.env` file. Do not paste the replacement secrets into chat or Git.
2. Keep Square in sandbox until a real production Square token/location/webhook configuration is available and a signed completed-payment webhook is verified end-to-end. Then change `SQUARE_ENVIRONMENT` to production through an intentional release.
3. After this source is committed, reinstall/upgrade the Pi from the new `pi-edge` directory so the local Studio 24c hotfix is no longer divergent from Git.
4. Run one authenticated production sweep: all 100 Discord commands, account switching, demo close command receipt, Copier dry-run, website greeting/presence, and Pi wake -> STT -> response -> playback.
5. Do not enable live voice execution until demo-only completion receipts have been observed cleanly.

## Production release gate

```bash
npm ci --no-audit --no-fund
npm run audit:secrets
npm run lint
npm run test:unit
npm run test:integration
npm run test:commands
npm run smoke
npm run audit:runtime
npm run audit:commands
npm run audit:stubs
npm test
```

Then deploy manually because `autoDeploy` is intentionally false.
