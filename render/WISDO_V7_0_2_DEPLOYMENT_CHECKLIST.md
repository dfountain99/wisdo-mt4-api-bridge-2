# WISDO v7.0.2 Deployment Checklist

## 1. Back up the current Render environment

Before replacing files, copy the existing Render environment-variable names and values into a secure private record. Do not put real secrets in Git or inside the ZIP.

## 2. Required Render variables

Confirm these existing values are present:

```text
NODE_ENV=production
NODE_VERSION=22.22.0
PUBLIC_BASE_URL=https://wisdo-mt4-api-bridge.onrender.com
DATABASE_URL=<existing PostgreSQL URL>
WISDO_PERSISTENCE_MODE=postgres
DISCORD_TOKEN=<current Discord bot token>
CLIENT_ID=<Discord application ID>
GUILD_ID=<server ID>
MT4_SYNC_API_KEY=<current Reporter API key>
MT4_PAIRING_SIGNING_SECRET=<one stable random secret>
SESSION_SECRET=<existing stable value>
ENCRYPTION_KEY=<existing stable value>
ENABLE_LEGACY_DEADSHOT_MT4_SYNC=false
MT4_ALLOW_PAIRING_CODE_AUTH=true
MT4_REQUIRE_KNOWN_PAIRING=true
```

Do not casually rotate `MT4_PAIRING_SIGNING_SECRET`, `SESSION_SECRET`, or `ENCRYPTION_KEY`. Changing them can invalidate pairing codes, sessions, or protected stored values.

## 3. Repair the current stale Reporter keys

The live logs prove that at least one terminal has a different key from Render.

1. Leave the desired new/current value in `MT4_SYNC_API_KEY`.
2. Temporarily put the previous terminal key in `MT4_SYNC_PREVIOUS_API_KEYS`.
3. Separate multiple previous keys with commas and no quotes.
4. Deploy v7.0.2.
5. Update each MT4 Reporter to the current `MT4_SYNC_API_KEY`.
6. Confirm every account syncs.
7. Remove the retired key from `MT4_SYNC_PREVIOUS_API_KEYS` after the migration window.

Do not publish either key in Discord, screenshots, logs, or GitHub.

## 4. Add the pressure-control variables

Recommended starting values:

```text
WISDO_SIGNAL_BACKGROUND_CONCURRENCY=4
WISDO_SIGNAL_TASK_TIMEOUT_MS=15000
WISDO_SIGNAL_BACKGROUND_MAX_QUEUE=500
WISDO_PAIRING_CACHE_TTL_MS=300000
WISDO_MT4_COMMAND_HISTORY_LIMIT=2500
WISDO_JSON_BODY_LIMIT=4mb
WISDO_COMPRESSION_THRESHOLD_BYTES=1024
WISDO_SLOW_REQUEST_MS=2500
DB_POOL_MAX=4
WISDO_DB_QUERY_TIMEOUT_MS=5000
WISDO_DB_STATEMENT_TIMEOUT_MS=4000
```

Do not raise worker concurrency aggressively on a small Render instance. Higher concurrency can increase memory usage and database contention.

## 5. Replace and push the project

From Windows Command Prompt, after placing the ZIP in Downloads:

```cmd
cd /d "%USERPROFILE%\Downloads"

powershell -NoProfile -Command "Expand-Archive -LiteralPath '%USERPROFILE%\Downloads\wisdo-render-deploy-v7.0.2-server-speed-fixed.zip' -DestinationPath '%USERPROFILE%\Downloads\wisdo-render-deploy-v7.0.2-server-speed-fixed' -Force"

robocopy "%USERPROFILE%\Downloads\wisdo-render-deploy-v7.0.2-server-speed-fixed" "%USERPROFILE%\Downloads\wisdo-render-deploy" /E /PURGE /XD .git node_modules runtime data logs /XF .env

cd /d "%USERPROFILE%\Downloads\wisdo-render-deploy"

npm ci --no-audit --no-fund
npm run check
git status
git add -A
git commit -m "Deploy WISDO v7.0.2 server pressure and Reporter transport repair"
git push origin main
```

`robocopy` exit codes 1–7 can describe copied files or other nonfatal differences. Review its summary before treating the code as a failure.

## 6. Confirm the Render build

The build must show:

```text
npm ci --omit=dev --no-audit --no-fund
node scripts/patchWsHandshake.js
Patched ws handshake null race
npm start
```

The application should run on Node 22.x, not Node 26.x.

## 7. Check health after deployment

Open these authenticated/publicly permitted routes as configured:

```text
/health
/health/discord
/health/performance
```

Confirm:

- database status is healthy;
- Discord client is ready and the expected guild is present;
- 77 commands are registered;
- background queue depth is stable or draining;
- event-loop lag is not continuously elevated;
- in-flight requests return toward zero;
- recent slow requests do not continuously fill with `/mt4-sync`.

## 8. Validate Reporter accounts one at a time

For each connected MT4 account:

1. Confirm the account appears connected on the website.
2. Confirm balance, equity, open-trade count, and heartbeat time update.
3. Confirm one pairing recovery warning may occur after the first restart, but it does not repeat on every heartbeat.
4. Confirm no repeated `Invalid API key` warning remains after the terminal key is updated.
5. Confirm `responseMs` stays well below the prior 30-second request boundary.
6. Confirm a test open/close command reaches only the intended receiver account.

Use demo or minimum-risk test accounts for execution validation.

## 9. Validate Discord and desks

- Run several `/` commands, including one command that performs network work.
- Confirm no “application did not respond” message appears.
- Create a new private desk for a test member.
- Confirm the Culture Coin role is assignable by the bot.
- Confirm text-channel permissions are correct.
- Archive and restore the test desk.
- Check `/health/discord` for missing permissions, role hierarchy conflicts, category capacity, or guild mismatch.

The Discord bot role must remain above any role it needs to assign or manage.

## 10. Validate website presence

- Sign in for the first time that day and confirm the daily greeting.
- Leave the site beyond the configured away interval, return, and confirm the return greeting.
- Move across multiple `/app/*` pages and confirm the WISDO orb remains available without greeting on every normal heartbeat.

## Rollback boundary

Keep the previous v7.0.1 deployment commit available until live Reporter, Discord, desk, and website tests pass. Rolling code back does not automatically restore changed Render secrets, so preserve the pre-deployment environment separately.
