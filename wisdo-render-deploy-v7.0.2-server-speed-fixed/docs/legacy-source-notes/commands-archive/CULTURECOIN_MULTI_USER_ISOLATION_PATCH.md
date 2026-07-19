# CultureCoin Multi-User Isolation Patch

## Main features

- Force Discord login before member dashboard loads.
- Store and display MT4 connections under the correct Discord user ID.
- Keep every pairing code tied to one owner.
- Block public access to account dashboards.
- Replace latest connected account logic with my connected accounts.
- Add account switcher for users with multiple MT4 accounts.
- Prevent one user’s popup, signal, video, bot, license, referral, wallet, or account data from appearing in another user’s dashboard.
- Add `/api/me` identity route.
- Add owner checks to sensitive dashboard and API requests.
- Add admin-only checks for admin routes and admin APIs.

## Required new environment variable

Add this to Render for Discord OAuth login:

```txt
CLIENT_SECRET=your_discord_app_client_secret
```

Existing values still required:

```txt
CLIENT_ID=
OWNER_USER_ID=
PUBLIC_BASE_URL=https://wisdo-mt4-api-bridge.onrender.com
```

## Discord Developer Portal redirect URL

Add this OAuth redirect URL:

```txt
https://wisdo-mt4-api-bridge.onrender.com/auth/discord/callback
```

For local testing, also add:

```txt
http://localhost:3000/auth/discord/callback
```

## Security behavior

Member pages redirect to `/login` if the user is not signed in with Discord.

`/member` now loads only:

```txt
mt4.latestSnapshots[currentDiscordUser.id]
mt4.connections[currentDiscordUser.id]
```

It no longer falls back to the global latest account.

Owner-only API checks block mismatched users unless the requester is `OWNER_USER_ID`.
