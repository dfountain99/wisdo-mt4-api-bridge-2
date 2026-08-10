# Render Deployment

This branch was not deployed. Render must use the root `render.yaml`, Node 22, `npm ci`, `npm run migrate:postgres`, and `npm start`. Required secrets belong in Render environment configuration, never Git. `SESSION_SECRET` must be at least 32 characters; Render already defines generated `SESSION_SECRET` and `ENCRYPTION_KEY` values in the canonical configuration.

Square is the canonical payment provider in this repository. Sales must remain locked unless Square checkout and the signed webhook are configured. Recurring bot/VPS billing is intentionally fail-closed until its subscription lifecycle is implemented.

Release order:

1. Back up/clone the target database into disposable staging.
2. Run `npm ci` and the complete gates in `TESTING.md`.
3. Run `npm run migrate:postgres` twice against disposable/staging PostgreSQL and inspect constraints/data.
4. Start one staging instance and check `/health` and `/ready`.
5. Validate Discord OAuth and `npm run register-commands` against the intended staging guild/application.
6. Connect a demo Reporter and verify command lifecycle truth through Reporter completion.
7. Validate account switching, copier open/modify/partial-close/final-close, greeting cooldowns, and mobile controls.
8. Validate Square sandbox checkout + signed webhook.
9. Only after those gates pass should a production deploy be considered.

Keep `WISDO_VOICE_EXECUTION_MODE=DEMO_ONLY`. Do not use the noncanonical `render/` mirror.
