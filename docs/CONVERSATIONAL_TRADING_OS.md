# WISDO Conversational Trading OS

## Local startup

1. Use Node 22 and PostgreSQL.
2. Copy `.env.example` to `.env` and configure `DATABASE_URL`, Discord credentials, Reporter authentication, `WISDO_DEVICE_ENROLLMENT_CODE`, and optionally `OPENAI_API_KEY`.
3. Run `npm ci`, `npm run migrate:postgres`, then `npm start`.
4. Open `/member/coach-operations` to review plans, rules, confirmations, voice devices, receipts, failures, and audit events.

No OpenAI key is required for deterministic text commands. Without it, natural cloud speech and model-assisted low-confidence intent extraction are unavailable; established trading commands continue to use deterministic parsing.

## Register a Raspberry Pi voice device

1. Copy `pi-edge/` to the Pi and run `sudo ./install.sh`.
2. Edit `/opt/wisdo-edge/.env` using `pi-edge/.env.example`.
3. Set the same one-time `WISDO_DEVICE_ENROLLMENT_CODE` configured on the server.
4. Run `sudo -u wisdo-edge /opt/wisdo-edge/.venv/bin/python /opt/wisdo-edge/enroll.py` once, then remove the enrollment code from `.env`.
5. Start with `sudo systemctl start wisdo-edge` and inspect with `journalctl -u wisdo-edge -f`.

The token is generated locally with mode 0600. PocketSphinx performs wake detection locally; the Pi then uploads bounded WAV audio for server-side transcription. The device reports LED/mute/listening state, keeps a bounded server session, retries with one stable idempotency key, and reports delivered/playing/played/failed receipts. Temporary playback files are deleted after every attempt.

## Test â€œHey Coachâ€

For a no-microphone smoke test, set `WISDO_CONSOLE_MODE=true`, start `wisdo_edge.py`, and enter `Hey Coach`. Coach must answer, â€œI'm listening. What can I help you with?â€ Follow-up lines do not require the wake phrase until the session expires, is cancelled, or receives goodbye.

## Build and activate a Daily Plan

Say:

1. `Hey Coach, let's build today's trading plan.`
2. Describe the plan and pass the selected authorized `accountId` from the device/dashboard request.
3. Review Coach's read-back.
4. For a live plan, say `Confirm Coach, activate today's plan.` in the same unexpired session.

Plan activation stores a versioned plan and normalized rules. Snapshot monitoring can trigger supported stop-entry, profitable-close, and copier-pause commands. Queueing is reported as queueing; only authenticated Reporter completion creates a completed receipt.

Plans can be duplicated and retain immutable history snapshots. Automatic resets are checked on Reporter snapshot activity and create a new `DRAFT` only on configured trading weekdays in the plan timezone. A reset never activates rules, resumes a copier, clears a safety lock, or reopens trading; confirmation remains mandatory.

## Security and operational notes

- Natural language and model text never go directly to MT4.
- Device tokens are hashed server-side; API keys are never logged.
- Account ownership is checked before command creation.
- Confirmations bind user, session, device, accounts, action, parameters, plan, and expiry.
- Physical mute and room permissions are enforced by the voice-device layer.
- Deploy migrations before application startup. Roll out server first, then Pi/desktop agents, then verify Reporter v1.59 polling and completion receipts on demo accounts before enabling live plans.

## Deployment and rollback

1. Back up PostgreSQL and deploy the migration before the application build.
2. Verify `/health`, `/member/coach-operations`, authenticated device heartbeat, one demo utterance, and a complete delivery receipt chain.
3. Verify a demo command remains `queued` until Reporter completion, then confirm its completion speech is delivered.
4. Roll Pi devices gradually. The previous Pi service can be restored independently while the new tables remain unused.
5. For application rollback, restore the previous application image first. The additive tables and columns may remain safely in place. Drop them only in a separately reviewed maintenance migration after confirming no retained audit/history data is required.
