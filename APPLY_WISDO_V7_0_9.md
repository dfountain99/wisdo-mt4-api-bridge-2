# Apply WISDO v7.0.9 Launch Hardening

## Windows repository

Back up or commit any unrelated local work first. Extract `WISDO_V7_0_9_LAUNCH_HARDENING_OVERLAY.zip` directly over the root of `wisdo-mt4-api-bridge-2`, replacing files when prompted.

Then run:

```powershell
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

If all gates pass:

```powershell
git checkout -b agent/wisdo-v7-0-9-launch-hardening
git add .github/workflows/launch-gates.yml .gitignore package.json config.js render.yaml scripts/auditSecrets.js services/postgresMt4Store.js server/deadshotSite.js server/majorUpgradeRoutes.js public/service-worker.js pi-edge tests/v708-database-first-trading.test.js tests/v704-heap-recognition.test.js WISDO_V7_0_9_LAUNCH_HARDENING_NOTES.md APPLY_WISDO_V7_0_9.md
git commit -m "fix: harden WISDO ecosystem for launch"
git push -u origin agent/wisdo-v7-0-9-launch-hardening
```

Open a PR to `main`. Render auto-deploy is intentionally disabled by this patch; deploy manually only after the PR is merged and production environment checks are complete.

## Raspberry Pi

After the new source is merged, update the Pi from the new `pi-edge` folder. The installer preserves the existing `.env` and device token.

For the current PreSonus Studio 24c, keep these values in `/opt/wisdo-edge/.env`:

```text
WISDO_MIC_DEVICE_INDEX=2
WISDO_MIC_SAMPLE_RATE=44100
WISDO_MIC_CHANNELS=2
WISDO_MIC_SAMPLE_FORMAT=S32_LE
WISDO_MIC_CHANNEL_SELECT=0
WISDO_MIC_S32_SHIFT=12
WISDO_STT_SAMPLE_RATE=16000
```

Then:

```bash
sudo bash install.sh
sudo systemctl restart wisdo-edge
sudo systemctl is-active wisdo-edge
```

Keep `WISDO_VOICE_EXECUTION_MODE=DEMO_ONLY` in production.
