# Wisdo Live Metrics + Command Registration Patch

## What changed

- New Discord slash commands are included in both root and server command registries:
  - `/pair generate`
  - `/pair connect code:<code>`
  - `/pair status`
  - `/pair sync`
  - `/pair disconnect`
  - `/account status`
  - `/account config`
  - `/copier status`
  - `/copier pause`
  - `/copier resume`
  - `/reporter status`
  - `/wisdo-notifications`
  - `/wisdo-help`

- `npm run start:web` now uses the real MT4 sync repository and MT4 sync service instead of an empty dummy bridge object.
- Website-generated and Discord-generated pairing codes are now also registered into the MT4/MT5 bridge store.
- When the Culture Coin MT4 Reporter posts to `/mt4-sync`, the website now syncs:
  - balance
  - equity
  - floating P/L
  - daily closed P/L
  - margin level
  - open trade count
  - open trade table
  - closed trades today
  - symbols
  - bridge freshness
- Demo dashboard numbers were removed from member dashboard pages. Empty states now say the site is waiting for a real reporter snapshot.
- `/api/account/status` and `/api/deadshot/me` now return `liveAccount` data.
- `/api/discord/status` also returns `liveAccount`, so `/account status` in Discord can show balance, equity, floating P/L, and open trades.

## Register commands

From the project root:

```bash
npm install
npm run register-commands
```

Required env vars:

```env
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
PUBLIC_BASE_URL=https://your-domain.com
DISCORD_COMMAND_API_SECRET=optional-but-recommended
```

If you deploy from the `server/` folder instead, use:

```bash
cd server
npm install
npm run register-commands
```

## Live bridge test

1. Login to the website.
2. Open `/app/connect-account`.
3. Click **Generate Pairing Code**.
4. Paste that same code into the Culture Coin MT4 Reporter.
5. Make sure MT4 WebRequest allows your site base URL.
6. Reporter posts to:

```txt
/mt4-sync
```

After the first successful snapshot, open:

```txt
/app/dashboard
/app/account-trades
/app/performance
/api/account/status
```

Those pages should now show real live values instead of demo dummy values.

## Access rule preserved

Reporter remains visible for free, inactive, and active users.

Copying/trading execution remains blocked unless:

```txt
subscription_status === active
role === culture_coin_member_active
copier enabled === true
trading account connected === true
```
