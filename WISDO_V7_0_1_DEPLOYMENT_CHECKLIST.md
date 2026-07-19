# WISDO v7.0.1 Deployment Checklist

## 1. Replace the Render source

Deploy the contents of `wisdo-render-deploy-v7.0.1-fixed.zip` as one application. Do not merge the remodel’s duplicate `server/`, `src/`, `.env`, `.git`, `node_modules`, or runtime data into it.

## 2. Confirm required Render variables

```env
NODE_ENV=production
PUBLIC_BASE_URL=https://wisdo-mt4-api-bridge.onrender.com
DISCORD_TOKEN=<real bot token>
CLIENT_ID=<Discord application ID>
CLIENT_SECRET=<Discord OAuth secret>
GUILD_ID=<Discord server ID>
CULTURE_COIN_ROLE_ID=<role ID>
COACH_ROLE_ID=<role ID>
OWNER_USER_ID=<your Discord user ID>
DATABASE_URL=<production PostgreSQL URL>
AUTO_REGISTER_COMMANDS_ON_START=true
MT4_SYNC_PATH=/mt4-sync
MT4_SYNC_API_KEY=<same key configured in Reporter>
MT4_REQUIRE_KNOWN_PAIRING=true
ENABLE_LEGACY_DEADSHOT_MT4_SYNC=false
```

Keep `ENABLE_LEGACY_DEADSHOT_MT4_SYNC=false`. Turning it on restores the old duplicate sync behavior and should be used only for isolated diagnosis.

## 3. Confirm Discord bot role

Move the WISDO bot role above the Culture Coin role.

Required desk permissions:

- View Channels
- Manage Channels
- Send Messages
- Read Message History
- Manage Messages
- Use Application Commands
- Manage Roles when `/create-desk grant_role:true` should assign Culture Coin

## 4. Build and start

Render blueprint commands:

```text
Build: npm ci --omit=dev --no-audit --no-fund
Start: npm start
Health path: /health
Node: 22.x
```

## 5. Verify slash commands

The app registers 77 guild commands automatically at startup. In logs, confirm:

```text
Discord command registry built
Discord slash-command startup registration checked
commandCount: 77
```

Manual fallback:

```bash
npm run register-commands
```

Then restart Discord or type `/` again after the guild command refresh.

## 6. Verify health routes

Open:

```text
https://wisdo-mt4-api-bridge.onrender.com/health
https://wisdo-mt4-api-bridge.onrender.com/health/discord
https://wisdo-mt4-api-bridge.onrender.com/api/copier-infrastructure-health
```

`/health/discord` should show:

- `commandRegistry.commandCount: 77`
- `commandRegistry.unique: true`
- `guildVisible: true` after the gateway is ready
- no missing desk permissions
- `roleManageable: true` when automatic role assignment is required

## 7. Verify desk workflow

Test in this order:

1. `/desk-status`
2. `/create-desk member:@TestUser grant_role:true`
3. confirm text desk access for the member, Coach, owner/admin, and WISDO bot
4. confirm an unrelated member cannot see the desk
5. archive/remove the test desk using the current admin workflow
6. `/restore-desk member:@TestUser`
7. verify `archivedAt` is cleared and the channel returns to an active category

When a category reaches capacity, WISDO should create the next category shard automatically.

## 8. Verify MT4 Reporter latency

Run a real Reporter sync and inspect its response JSON:

```json
{
  "ok": true,
  "responseMs": 0
}
```

The exact value will vary, but it should no longer wait on the old duplicate website-state save or Discord signal posting. Render logs now flag any authoritative sync over 2.5 seconds.

Verify the Reporter points to:

```text
https://wisdo-mt4-api-bridge.onrender.com/mt4-sync
```

and uses the same `MT4_SYNC_API_KEY` as Render.

## 9. Verify website presence greetings

Using a normal member account:

1. log in for the first time that day — greeting should open;
2. reload immediately — it should not repeatedly interrupt;
3. leave the site for more than 15 minutes, then return — return greeting should open;
4. switch the active account — WISDO context should update;
5. use the WISDO orb to reopen the context panel manually.

## 10. Rollback signal

Rollback only if one of these occurs:

- `/health` fails continuously;
- production persistence cannot connect to PostgreSQL;
- Discord reports invalid credentials;
- command registration is rejected;
- Reporter receives repeated 5xx responses.

Do not enable the old legacy MT4 route as a general rollback. Restore the prior deploy instead, because the legacy route recreates duplicate sync authority.
