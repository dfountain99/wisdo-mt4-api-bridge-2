# WISDO Major Upgrade Manual Finish Notes

Date: 2026-08-09

## Recovery status

The Codex run stopped during disposable-PostgreSQL migration validation. The existing working tree was preserved and reviewed instead of reset. Manual stabilization continued from that tree; no push, merge, Render deployment, production database change, or live-account voice enablement was performed.

## Manual repairs after the interruption

- Reporter/account health now treats heartbeat age as authoritative, so a stale Reporter cannot remain `CONNECTED` indefinitely.
- Payout requests use integer cents, enforce available commission, and keep legacy display compatibility.
- Review upload/edit/timestamp/admin assignment routes persist real state instead of returning hard-coded success/empty data.
- Copy Hub approval/removal now changes MT4 account settings rather than reporting a no-op success.
- Telegram review ingestion fails closed unless its webhook secret is configured and verified.
- `/admin/system-health` now enforces OWNER/WISDO authorization.
- Discord OAuth preserves useful login errors, requests `identify email`, and persists the authenticated member profile while preserving a linked signed-session identity.
- Bot checkout completion validates the paid amount before license delivery.
- Affiliate commission is created only after verified paid completion and is idempotent.
- Paid-in-full bot checkout creates a real Square checkout when Square + webhook are configured. Recurring bot/VPS billing remains intentionally fail-closed with HTTP 501 until a webhook-backed subscription lifecycle exists.
- Deadshot checkout no longer creates manual/fake payment success when Square is unavailable.
- Production startup now requires a dedicated `SESSION_SECRET` of at least 32 characters; the development fallback cannot silently protect production sessions.
- Stable MT4 UUIDs are explicitly backfilled and set `NOT NULL` before new foreign-key tables rely on them.
- `audit:stubs` can audit an extracted source tree without `.git` and currently reports zero items requiring manual production-stub review.

## Validation completed here

- `node scripts/checkBuild.js`: PASS (309 JavaScript files, 14 required production assets, no public strategy source)
- `npm test`: PASS (261/261)
- `npm run test:unit`: PASS (87/87)
- `npm run test:integration`: PASS (43/43)
- `npm run test:commands`: PASS (9/9)
- `npm run smoke`: PASS (29/29)
- `npm run audit:runtime`: PASS; root `index.js` / `server/apiServer.js` / `commands/index.js` are canonical
- `npm run audit:commands`: PASS; 100 unique commands
- `npm run audit:stubs`: PASS; 529 files scanned, 0 review-required production stubs
- `npm run pressure:mt4`: PASS as a simulated/in-memory pressure test only

The sandbox used dependency shims only to execute tests because its private npm mirror could not reinstall all packages. Those shims and `node_modules` are not part of the deliverable. The user's own Windows run had already completed `npm ci` successfully with 0 vulnerabilities.

## Still requires staging evidence before deployment

1. Run `npm ci` on the Windows checkout again after applying the finished source.
2. Run the full validation commands in `TESTING.md`.
3. Point `DATABASE_URL` at a disposable/staging PostgreSQL database and run `npm run migrate:postgres` twice. The second run must succeed and table/index/constraint counts should be inspected.
4. Run authenticated browser smoke tests for Discord OAuth, account switching, `/app/*`, greeting cooldowns, and mobile trade controls.
5. Connect only a demo Reporter and verify requested -> queued -> delivered -> acknowledged -> completed status truth.
6. Verify Square checkout/webhook with Square sandbox before enabling sales.

Real PostgreSQL migration execution was not available in this sandbox, so that release gate is explicitly **UNVERIFIED**, not assumed passed.

## Intentional production blocks

- `WISDO_VOICE_EXECUTION_MODE=DEMO_ONLY` remains the required protected default.
- Recurring bot payment plans and VPS recurring checkout return explicit not-enabled responses until a real recurring Square subscription/webhook lifecycle is implemented.
- Payment/provider absence never grants access or commission.

## Repository hygiene

This legacy repository tracks `node_modules`. Do not mix generated vendor churn with the functional upgrade. Removing tracked `node_modules` should be a separate, deliberate repository-hygiene change after the release branch is proven reproducible from `package-lock.json`.
