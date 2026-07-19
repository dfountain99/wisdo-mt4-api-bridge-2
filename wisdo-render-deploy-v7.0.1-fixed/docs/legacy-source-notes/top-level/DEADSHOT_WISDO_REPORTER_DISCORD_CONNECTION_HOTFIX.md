# Deadshot + Wisdo Reporter / Discord Connection Hotfix

## What was broken

1. Discord MT4 pairing was too dependent on a private Operator Desk channel. If the user ran `/connect-mt4` outside the desk, the command could feel like it did not load or could fail before creating a usable MT4 pairing code.
2. The environment example had conflicting `PUBLIC_BASE_URL` guidance. Copying it as-is could accidentally leave `PUBLIC_BASE_URL=http://localhost:3000`, which makes MT4 Reporter fail from a VPS or remote terminal.
3. Render/Node used `PORT`, but the env example only emphasized `API_PORT`. The server now supports both, with `PORT` first and `API_PORT` as a fallback.
4. Discord slash commands required a manual `npm run register-commands` step after deployment. The bot now attempts safe guild command registration on startup when `AUTO_REGISTER_COMMANDS_ON_START=true`.
5. Reporter HTTP errors were too vague on the MT4 dashboard. It now surfaces server JSON `error` text when the API returns a 400/401/409/etc.

## Fixes added

- `/connect-mt4` and `/connect` can generate a pairing code from any Discord channel/DM.
- If the command is run inside a valid Operator Desk, it still attaches to that desk owner.
- If no desk exists, the pairing code attaches directly to the Discord user ID.
- Startup command registration now keeps Discord commands from going stale after a redeploy.
- `/health/mt4` now shows the exact SyncUrl, CommandPollUrl, CommandCompleteUrl, API-key requirement, and pairing/snapshot counts.
- A fresh `CultureCoin_MT4_Reporter_Package.zip` is now bundled in both `mql4/` and `server/mql4/`.

## Live deployment checklist

1. Set `PUBLIC_BASE_URL` to the live HTTPS domain, for example `https://your-app.onrender.com`.
2. Do not use `localhost` for a VPS or remote MT4 terminal.
3. Redeploy the server.
4. Confirm `/health/mt4` loads and shows `syncUrl` as `https://your-live-domain/mt4-sync`.
5. In Discord, run `/connect-mt4`.
6. Copy the pairing code and SyncUrl into the Reporter.
7. In MT4 WebRequest settings, allow only the base URL, for example `https://your-live-domain`.
8. If `MT4_SYNC_API_KEY` is set on the server, put the same value in Reporter `ApiKey`. If it is blank, leave Reporter `ApiKey` blank.
9. Watch the Reporter dashboard. If it errors, the dashboard now shows the specific server error like invalid pairing code, expired pairing code, API key mismatch, or account mismatch.
