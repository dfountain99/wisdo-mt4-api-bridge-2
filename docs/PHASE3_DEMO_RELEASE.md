# Phase 3 controlled demo release

This release is staging-only. Do not connect it to production PostgreSQL and do not enable live-account voice execution. The required deployment setting is `WISDO_VOICE_EXECUTION_MODE=DEMO_ONLY`.

## Release gates

- Use Node 22, run `npm ci`, `npm run check`, and `npm run pressure:v708`.
- Run `npm audit --omit=dev`; the reviewed lockfile must report no known vulnerability.
- Back up the target staging database and run `npm run migrate:postgres` before starting the application. Run it a second time to prove idempotency.
- Verify Reporter v1.59, the demo account classification, device enrollment, ownership, and completion receipts.
- Install the Pi package on a clean Raspberry Pi OS host and execute the hardware checks below.
- Keep `WISDO_VOICE_EXECUTION_MODE=DEMO_ONLY`; a live release requires a separate security approval and explicit configuration change.

## Staging deployment

1. Provision an isolated PostgreSQL database and a staging application with Node 22.
2. Set the normal service secrets and `WISDO_VOICE_EXECUTION_MODE=DEMO_ONLY`. Never put secrets in source control.
3. Run `npm ci`, `npm run migrate:postgres`, and `npm start`.
4. Confirm `/health`, the Coach operations dashboard, Discord/API authentication, and Reporter v1.59 heartbeat.
5. Copy the versioned `pi-edge` package to Raspberry Pi OS, verify its checksums from `release-manifest.json`, and run `sudo ./install.sh`.
6. Edit `/opt/wisdo-edge/.env`, enroll once, clear the enrollment code from the environment, and start `wisdo-edge`.

## End-to-end demo checklist

- [ ] A. Register one Raspberry Pi and confirm its authenticated heartbeat.
- [ ] B. Link one account that Reporter identifies as a demo MT4 account.
- [ ] C. Verify Reporter v1.59 heartbeat.
- [ ] D. Say “Hey Coach.”
- [ ] E. Hear “I'm listening. What can I help you with?”
- [ ] F. Ask “What is my demo account balance?”
- [ ] G. Confirm the spoken balance matches MT4.
- [ ] H. Ask Coach to pause demo trading.
- [ ] I. Verify a strong, bound, unexpired confirmation is required.
- [ ] J. Verify requested → confirmed → queued → Reporter lifecycle.
- [ ] K. Verify only Reporter creates the completed receipt.
- [ ] L. Verify completion speech and delivered/playing/played receipts.
- [ ] M. Build a Daily Plan for the demo account.
- [ ] N. Activate it with strong confirmation.
- [ ] O. Verify conditional-rule monitoring against Reporter snapshots.
- [ ] P. Attempt a live and a mixed-account command; verify DEMO_ONLY rejects and audits both before queueing.
- [ ] Q. Disconnect and reconnect the Pi; verify bounded retry and no duplicate playback.
- [ ] R. Activate physical mute; verify the muted LED state and that no audio upload occurs.

## Raspberry Pi hardware acceptance

Run these on a clean supported Raspberry Pi OS image. Re-running `install.sh` must preserve the environment and token while safely refreshing the runtime.

1. Select the microphone with `WISDO_MIC_DEVICE_INDEX`; use the console diagnostic to confirm capture.
2. Select the ALSA speaker with `WISDO_AUDIO_OUTPUT`; run `speaker-test -D <device> -t wav`.
3. Create the configured `WISDO_MUTE_FILE`; verify muted state and zero upload requests, then remove it.
4. Configure `WISDO_LED_COMMAND`; verify idle, listening, processing, speaking, muted, and error states.
5. Interrupt networking during upload and long polling; verify recovery, bounded memory, and one stable idempotency key.
6. Restart the service during playback; verify the persistent played-delivery ledger prevents replay.
7. Inspect `journalctl -u wisdo-edge`; tokens and enrollment secrets must not appear.
8. Verify temporary capture and playback files are removed after success and failure.
9. Roll back with `sudo ./uninstall.sh`. It removes the service but preserves `/opt/wisdo-edge/data` until an operator explicitly removes it.

## Migration evidence and rollback

The canonical Render migration path is `scripts/migratePostgres.js`: its base schema plus `migrations/2026-08-09-conversational-trading-os.sql`. It was applied twice to disposable PostgreSQL 17 and produced 66 public tables, 147 indexes, and 33 foreign keys. Required utterance, delivery, plan, and receipt tables and their owner/poll indexes were present.

The historical files in `migrations/` are not one universal linear chain: legacy SQLite-to-PostgreSQL and Supabase-targeted histories define incompatible `trading_accounts` roots. A production operator must select the migration entry point for that deployment; concatenating every historical file is prohibited.

The Conversational Trading OS migration is additive. For rollback, stop new application writers, restore the previous application image, and retain the new tables for audit/history. Destructive table removal requires a separately reviewed maintenance migration and a verified backup. Existing account data is not rewritten by the additive migration.

## Production deployment gates

Production remains blocked until Raspberry Pi hardware acceptance is signed off, a production database backup/restore rehearsal passes, the correct historical migration lineage is documented for the target, monitoring and rollback owners are assigned, live-account authorization receives separate approval, and all Node 22/security gates are repeated against the exact release commit.
