# CultureCoin Login Recovery + OAuth Health Patch

Adds /login, /auth/debug, /setup/oauth, /api/auth/health, /auth/discord, /auth/discord/callback, and /logout.

Required Render variables:

```txt
PUBLIC_BASE_URL=https://wisdo-mt4-api-bridge.onrender.com
CLIENT_ID=your_discord_client_id
CLIENT_SECRET=your_discord_client_secret
```

Required Discord redirect:

```txt
https://wisdo-mt4-api-bridge.onrender.com/auth/discord/callback
```

Never expose CLIENT_SECRET in frontend code, screenshots, Discord, or GitHub.
