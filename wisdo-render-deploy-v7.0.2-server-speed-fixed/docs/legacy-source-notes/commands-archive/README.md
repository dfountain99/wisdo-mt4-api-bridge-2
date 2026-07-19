# Culture Coin Operator Desks Bot

Culture Coin Operator Desks is a private Discord operating system for a premium trading community. Each eligible student gets an individual 1-on-1 desk with Coach, plus a structured workflow for profile setup, clock-ins, EA logging, clock-outs, weekly reviews, coach notes, WISDO guidance, optional MT4 sync, and a private MT4 bot storefront.

This project now includes six layers:

1. Operator Desk Bot
2. WISDO Teacher Assistant
3. MT4 Reporter EA
4. MT4 API Bridge
5. Culture Coin Bot Store
6. Warm Welcome / Membership Onboarding

## Current Project Structure

This workspace started empty, so the bot was scaffolded from scratch and then extended in place.

- Bot entry file: [src/index.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/src/index.js)
- Slash command registration: [scripts/registerCommands.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/scripts/registerCommands.js)
- Command registry: [src/commands/index.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/src/commands/index.js)
- Package manager: `npm`
- Discord stack: `discord.js@14`
- Storage repository: [src/storage/operatorDeskRepository.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/src/storage/operatorDeskRepository.js)
- Main desk service: [src/services/operatorDeskService.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/src/services/operatorDeskService.js)
- WISDO services:
  [src/services/wisdoAnalysisService.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/src/services/wisdoAnalysisService.js),
  [src/services/wisdoRulesEngine.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/src/services/wisdoRulesEngine.js),
  [src/services/wisdoToneService.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/src/services/wisdoToneService.js)
- Bot store services:
  [src/services/botCatalogService.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/src/services/botCatalogService.js),
  [src/services/botPricingService.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/src/services/botPricingService.js),
  [src/services/botStoreService.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/src/services/botStoreService.js),
  [src/services/paymentService.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/src/services/paymentService.js)
- MT4 bridge service: [src/services/mt4SyncService.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/src/services/mt4SyncService.js)
- API server:
  [src/server/apiServer.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/src/server/apiServer.js),
  [src/server/mt4Routes.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/src/server/mt4Routes.js),
  [src/server/storeRoutes.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/src/server/storeRoutes.js)
- MT4 Reporter EA source: [mql4/CultureCoin_MT4_Reporter.mq4](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/mql4/CultureCoin_MT4_Reporter.mq4)

## What Operator Desks Do

The base Operator Desk system remains responsible for:

- Private desk creation
- Culture Coin role eligibility
- One desk per student
- Duplicate protection using `userId` in the channel topic
- Student profile storage
- `/clock-in`
- `/log-ea`
- `/clock-out`
- `/weekly-review`
- `/coach-note`
- `/template`
- Safe JSON persistence

Culture Coin role automation:

- Admin / Coach can still run `/create-desk member:@user` or `/create-all-desks dry_run:false`.
- If a member joins already holding the Culture Coin role, the bot can create their desk automatically.
- If an existing member is later given the Culture Coin role, the bot can create their desk automatically on the role change event.

Privacy rule:

- The `Culture Coin` role qualifies a student for a private desk.
- The `Culture Coin` role does **not** grant access to all desks.
- Never grant the full Culture Coin role access to the category or desk channels.
- Each desk channel must only allow that specific student plus Coach/Admin access.

## WISDO Teacher Assistant

WISDO is a teacher assistant and mentor layer.

WISDO is **not**:

- the data pipeline
- a trade executor
- a replacement for Coach

WISDO does:

- analyze student logs
- analyze clock-ins, EA logs, clock-outs, weekly reviews, and coach notes
- read MT4 snapshots if connected
- give advisory suggestions only

WISDO does **not**:

- place trades
- close trades
- modify trades
- control the EA
- promise profit

Coach remains the final authority.

If MT4 is not connected, WISDO falls back to the manual desk logs.

## Bot Store + WISDO Sales Assistant

The bot now includes a private MT4 storefront layer.

Store rules:

- Every bot starts at `500 USD`
- Culture Coin members get discounted pricing
- Culture Coin members get **one free bot claim**
- WISDO can negotiate within configured pricing guardrails
- WISDO can describe each bot from catalog metadata without exposing source code
- Delivery happens through Discord after the free claim or a completed purchase

WISDO does not expose source code and does not send `.mq4` source for the sale bots by default. Delivery is intended for compiled MT4 bot files.

## New Member Welcome Flow

When a new member joins:

- the bot can send a warm DM welcome
- the welcome points them to `/bots`
- the welcome points them to `/culture-coin-info`
- if they already have the Culture Coin role, the message points them to `/claim-free-bot`

When an existing member gains the Culture Coin role:

- the bot can create their private desk automatically
- the bot can send the Culture Coin onboarding message
- the member is reminded that they have one free bot claim

## Culture Coin Membership Perk

Culture Coin members get:

- private operator desk access
- one free bot claim
- discounted bot pricing
- WISDO workflow support inside the desk

Free bot claim rule:

- one free claim per Discord user
- one bot per claim
- claim with `/claim-free-bot bot:<name>`
- the claim is tracked in store storage so it cannot be claimed again accidentally

## WISDO Commands

Student or desk-safe commands:

- `/wisdo`
- `/wisdo-review period:today|week`

Coach/Admin command:

- `/wisdo-settings`

Coach/Admin can also run `/wisdo-review` with the optional `member` argument to review a specific student.

WISDO can also auto-comment after:

- `/clock-in`
- `/log-ea`
- `/clock-out`
- `/weekly-review`

These auto-replies are controlled by env flags.

## MT4 Reporter EA

The MT4 Reporter is a universal companion EA.

Important design rules:

- It runs beside the student's main EA.
- It does not replace the student's main EA.
- It does not place, close, or modify trades.
- It only reads account and order data.
- It sends snapshots to your API by `WebRequest`.
- Students do not run Node.
- Students do not touch backend code.
- Students do not share MT4 passwords.
- Students keep their own EA versions.

Source file:

- [mql4/CultureCoin_MT4_Reporter.mq4](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/mql4/CultureCoin_MT4_Reporter.mq4)

Students compile this in MetaEditor to produce:

- `CultureCoin_MT4_Reporter.ex4`

## Student MT4 Setup

1. Run `/connect-mt4` inside the private desk.
2. Copy the pairing code.
3. Install `CultureCoin_MT4_Reporter.ex4` into `MQL4 -> Experts`.
4. Restart MT4 or refresh Navigator.
5. Attach the Reporter EA to any chart.
6. Paste the pairing code into `PairingCode`.
7. Set `SyncUrl` to `${PUBLIC_BASE_URL}${MT4_SYNC_PATH}`.
8. If `MT4_SYNC_API_KEY` is configured, paste that same value into the Reporter EA `ApiKey` input.
9. In MT4 go to `Tools -> Options -> Expert Advisors`.
10. Check `Allow WebRequest for listed URL`.
11. Add the base URL from `PUBLIC_BASE_URL`.
12. Make sure `AutoTrading` is ON.
13. Run `/mt4-status` in Discord.

Students do not need to run Node and do not need to change their main EA.

If `PUBLIC_BASE_URL` is still a placeholder or localhost value, remote MT4 terminals will not be able to reach the API yet even though the bot can still generate a pairing code.

## MT4 Commands

Inside desks:

- `/connect-mt4`
- `/mt4-status`

Coach/Admin:

- `/sync-mt4 member:@user`

Utility:

- `/my-id`

`/sync-mt4` only shows the latest snapshot already received. It does not force MT4 to send new data.

## Bot Store Commands

Student / buyer:

- `/bots`
- `/bot-info`
- `/claim-free-bot`
- `/negotiate-bot`
- `/buy-bot`
- `/my-bots`
- `/culture-coin-info`

Admin / Coach:

- `/refresh-bot-catalog`
- `/store-status`

What each command does:

- `/bots` lists the active MT4 bot catalog
- `/bot-info` gives a high-level catalog description for one bot without exposing source code
- `/claim-free-bot` uses the member's one free Culture Coin bot claim
- `/negotiate-bot` lets WISDO work a deal inside the configured pricing floor and bundle rules
- `/buy-bot` creates a Stripe checkout link when payment is configured
- `/my-bots` shows prior deliveries
- `/culture-coin-info` shows Culture Coin perks and how to join
- `/refresh-bot-catalog` rescans local MT4 expert folders and copies delivery files into the private vault
- `/store-status` shows catalog, quote, order, and license counts

## Store Pricing Rules

Default rules in code:

- base bot price: `500 USD`
- Culture Coin member price: `400 USD`
- negotiation floor: `350 USD`
- bundle deal: `Buy 3 Get 3 Free`

The quote engine controls the final math.

WISDO can talk through the deal, but WISDO does not bypass the pricing guardrails.

## Bot Delivery

Bot deliveries use a private file vault in:

- `private-downloads/mt4-bots`

Catalog sync can auto-discover local compiled `.ex4` bots from MT4 expert folders, copy them into the delivery vault, and build sale records in storage.

After a free claim or paid purchase:

- if the buyer has a private desk, the bot delivers the files there
- otherwise the bot attempts a Discord DM delivery
- delivery also includes a basic MT4 install guide

## Stripe Checkout

If Stripe is configured:

- `/buy-bot` creates a Checkout Session
- the API receives `POST /stripe/webhook`
- successful payments trigger file delivery
- checkout success and cancel pages are served from the same API process

If Stripe is not configured:

- `/buy-bot` still builds a quote
- no payment link is generated until Stripe env values are added

## MT4 Auto-Fill Upgrades

When a fresh MT4 snapshot exists, the desk workflow upgrades automatically:

- `/clock-in` auto-fills balance, equity, floating P/L, open trades, symbols, and last sync
- `/log-ea` auto-fills balance, equity, floating P/L, open trades, buy/sell count, total lots, and symbols
- `/clock-out` auto-fills ending balance, ending equity, floating P/L, open trades, and daily closed P/L

If MT4 is missing or stale, the original manual modal flow is still used.

## API Bridge

The API bridge runs in the same Node process as the Discord bot.

Endpoint:

- `POST /mt4-sync` by default
- `GET /health` for a simple health check
- `POST /stripe/webhook` when Stripe is enabled

Configurable via:

- `API_PORT`
- `PUBLIC_BASE_URL`
- `MT4_SYNC_PATH`
- `MT4_SYNC_API_KEY`
- `MT4_PAIRING_CODE_TTL_HOURS`
- `MT4_REQUIRE_KNOWN_PAIRING`
- `MT4_MAX_PAYLOAD_KB`

Behavior:

- accepts JSON
- validates pairing code
- rejects expired pairing codes unless already connected
- stores latest snapshot by Discord user
- stores snapshot history
- stores MT4 connection metadata
- verifies account number consistency after first connection

Security:

- no MT4 passwords
- no broker passwords
- no investor passwords
- no Discord token in MT4
- no direct Discord webhook from MT4
- read-only snapshots only

## Server/API Setup

There was no existing API server in this repo, so Express was added and is started from [src/index.js](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/src/index.js).

Run everything with:

```bash
npm start
```

That starts:

- the Discord bot
- the MT4 API listener

The API listens on `API_PORT`.

Important:

- `PUBLIC_BASE_URL` must be a real public URL before student MT4 terminals can reach your API.
- `PUBLIC_BASE_URL` must also be a real public URL before Stripe checkout success, cancel, and webhook flows can be completed from outside your machine.
- `PUBLIC_BASE_URL` should be the base origin only, for example `https://your-domain.com`, not the `/mt4-sync` path itself.
- The default placeholder is only for setup and local development.

## Render Deployment

This repo now includes [render.yaml](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/render.yaml) so you can create a Render web service straight from GitHub.

Recommended Render setup:

- Service type: `Web Service`
- Runtime: `Node`
- Plan: `Starter` or higher

Why not free:

- Discord bots and MT4 sync endpoints should stay awake
- free-tier sleeping breaks live bot availability and MT4 sync reliability

Render commands:

- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/health`

Render env notes:

- Render injects `PORT` automatically
- local development still uses `API_PORT`
- set `PUBLIC_BASE_URL` to your real Render domain, for example `https://your-service.onrender.com`
- set `MT4_SYNC_PATH=/mt4-sync`
- do not paste your Discord token into the repo; add it in the Render dashboard env settings

Suggested deploy flow:

1. Push this folder to a GitHub repo.
2. In Render, create a new web service from that repo.
3. Let Render detect [render.yaml](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/render.yaml).
4. Add the required env vars in Render.
5. Deploy.
6. Set `PUBLIC_BASE_URL` to the final Render service URL if you did not prefill it.
7. Re-run `npm run register-commands` after the env is finalized if needed.
8. In Discord, run `/connect-mt4` and use the Render URL for the Reporter EA `SyncUrl`.

## Environment Variables

Template file:

- [.env.example](/C:/Users/jaque/Documents/Codex/2026-04-24/build-a-discord-bot-feature-for/.env.example)

Main Discord values:

- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID`
- `CULTURE_COIN_ROLE_ID`
- `CULTURE_COIN_ROLE_NAME`
- `COACH_ROLE_ID`
- `COACH_ROLE_NAME`
- `OWNER_USER_ID`

Desk values:

- `CATEGORY_NAME`
- `ARCHIVE_CATEGORY_NAME`
- `CREATE_PRIVATE_VOICE_CHANNELS`
- `DATA_DIR`

WISDO values:

- `WISDO_ENABLED`
- `WISDO_TONE`
- `WISDO_AUTO_ANALYZE_CLOCK_IN`
- `WISDO_AUTO_ANALYZE_EA_LOG`
- `WISDO_AUTO_ANALYZE_CLOCK_OUT`
- `WISDO_AUTO_ANALYZE_WEEKLY_REVIEW`
- `WISDO_MAX_SAFE_OPEN_TRADES`
- `WISDO_DRAWDOWN_WARN_PERCENT`
- `WISDO_DRAWDOWN_DANGER_PERCENT`
- `WISDO_PROFIT_PROTECT_PERCENT`
- `WISDO_ENABLE_STRONG_WARNINGS`
- `WISDO_MT4_STALE_MINUTES`

API / MT4 values:

- `API_PORT`
- `PUBLIC_BASE_URL`
- `MT4_SYNC_PATH`
- `MT4_SYNC_API_KEY` optional
- `MT4_PAIRING_CODE_TTL_HOURS`
- `MT4_REQUIRE_KNOWN_PAIRING`
- `MT4_MAX_PAYLOAD_KB`

Bot store values:

- `BOT_STORE_ENABLED`
- `BOT_DELIVERY_DIR`
- `BOT_SOURCE_DIRS`
- `BOT_AUTO_SYNC_ON_START`
- `BOT_BASE_PRICE`
- `CULTURE_COIN_BOT_PRICE`
- `BOT_NEGOTIATION_FLOOR`
- `BOT_BUY_3_GET_3_FREE`
- `CULTURE_COIN_FREE_BOT_ENABLED`
- `WELCOME_DM_ENABLED`
- `WELCOME_CHANNEL_ID`
- `CULTURE_COIN_JOIN_URL`
- `CULTURE_COIN_SUPPORT_CONTACT`
- `BOT_STORE_CURRENCY`
- `BOT_QUOTE_TTL_HOURS`

Stripe values:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_WEBHOOK_PATH`
- `STRIPE_SUCCESS_PATH`
- `STRIPE_CANCEL_PATH`

## Required Bot Permissions

The bot should have:

- `Manage Channels`
- permission overwrite control on desk channels and categories
- `Send Messages`
- `Read Message History`
- `Attach Files`
- `Embed Links`
- `Use Application Commands`
- `Manage Messages`
- `Connect`, `Speak`, and `Stream` only if private voice channels are enabled

## Required Intents

Enable these in code and in the Discord Developer Portal:

- `Guilds`
- `Guild Members`

Important:

- Server Members Intent must be enabled.
- `/create-all-desks` depends on member fetching.

## Storage

The project uses JSON files with temp-file rename writes for safer persistence.

Default storage directory:

- `data/operator-desks/profiles.json`
- `data/operator-desks/desks.json`
- `data/operator-desks/logs.json`
- `data/operator-desks/mt4.json`
- `data/operator-desks/commerce.json`

Stored MT4 data includes:

- pairing codes
- connection records
- latest snapshots
- snapshot history

## Slash Commands

Admin / Coach:

- `/create-desk`
- `/create-all-desks`
- `/desk-status`
- `/remove-desk`
- `/coach-note`
- `/sync-mt4`
- `/wisdo-settings`
- `/refresh-bot-catalog`
- `/store-status`

Student / Desk workflow:

- `/setup-profile`
- `/profile`
- `/edit-profile`
- `/clock-in`
- `/log-ea`
- `/clock-out`
- `/weekly-review`
- `/template`
- `/connect-mt4`
- `/mt4-status`
- `/wisdo`
- `/wisdo-review`
- `/my-id`

Store / membership:

- `/bots`
- `/bot-info`
- `/claim-free-bot`
- `/negotiate-bot`
- `/buy-bot`
- `/my-bots`
- `/culture-coin-info`

## Command Registration

Register guild commands with:

```bash
npm run register-commands
```

This uses the values in `.env` and registers commands to the configured `GUILD_ID`.

## Running The Project

Install dependencies:

```bash
npm install
```

Node.js `20+` is recommended for this project.

Register slash commands:

```bash
npm run register-commands
```

Run the bot + API server:

```bash
npm start
```

Development watch mode:

```bash
npm run dev
```

## Troubleshooting

Commands not showing:

- Confirm `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID` are correct.
- Run `npm run register-commands` again.
- Reload Discord after registration.

Bot cannot create desks:

- Confirm the bot has `Manage Channels`.
- Confirm the bot role sits above the roles involved in the permission overwrites.
- Check the bot logs for `Permission failure`.

Bot cannot see members:

- Confirm `Guild Members` intent is enabled in the Discord Developer Portal.
- Confirm the bot is invited with the correct scopes and is in the right guild.
- `/create-all-desks` depends on being able to fetch members.

Students can see other channels:

- Remove any manual category-wide access given to `Culture Coin`.
- Re-run `/create-desk` or `/create-all-desks dry_run:false` after fixing the permissions.

Duplicate desks:

- Run `/desk-status` to look for duplicate warnings.
- Desk matching is based on `userId` stored in the channel topic, not only the channel name.
- If old channels were created manually without the correct topic metadata, archive them before recreating desks.

Missing profile data:

- Run `/setup-profile` once inside the student's desk.
- Use `/edit-profile` if defaults changed.
- If WISDO or trading modals are sparse, check that the student's profile exists in storage.

Student with Culture Coin role does not get a desk:

- Run `/create-desk member:@user` as a one-off fix.
- Run `/create-all-desks dry_run:false` to backfill all eligible members.
- Confirm the member actually has the configured Culture Coin role.
- Confirm the bot has `Manage Channels` and permission overwrite control.

No bot catalog loaded:

- Run `/refresh-bot-catalog`.
- Confirm local MT4 bot `.ex4` files exist in the discovered expert folders or set `BOT_SOURCE_DIRS`.
- Confirm the bot process can copy files into `BOT_DELIVERY_DIR`.

Free bot claim not working:

- Confirm the member actually has the Culture Coin role.
- Confirm `CULTURE_COIN_FREE_BOT_ENABLED=true`.
- Check `/my-bots` to see if the free claim was already used.

Checkout link not showing:

- Add `STRIPE_SECRET_KEY`.
- Add a real `PUBLIC_BASE_URL`.
- Make sure `/buy-bot` is running on the updated bot process.

Stripe webhook not delivering bots:

- Add `STRIPE_WEBHOOK_SECRET`.
- Point Stripe to `POST /stripe/webhook` on the same public origin.
- Check that the paid checkout metadata contains the quote and Discord user IDs.

Welcome DM not arriving:

- Users may have DMs from server members turned off.
- Set `WELCOME_CHANNEL_ID` if you also want a public fallback welcome message.

WISDO not responding:

- Confirm `WISDO_ENABLED=true`.
- Check the bot logs for interaction errors.
- Make sure the command is used inside a private desk unless Coach/Admin is reviewing.

MT4 status says no data:

- Run `/connect-mt4` again if needed.
- Confirm the Reporter EA is attached to a chart.
- Confirm `PairingCode` and `SyncUrl` were entered correctly.
- Confirm `AutoTrading` is ON.

Wrong pairing code:

- Generate a fresh code with `/connect-mt4`.
- Make sure the student pasted the newest code into the Reporter EA.

Expired pairing code:

- Pairing codes expire after `MT4_PAIRING_CODE_TTL_HOURS`.
- Run `/connect-mt4` again to issue a fresh code.

WebRequest not enabled:

- In MT4 go to `Tools -> Options -> Expert Advisors`.
- Check `Allow WebRequest for listed URL`.
- Add the base URL from `PUBLIC_BASE_URL`.

Wrong `PUBLIC_BASE_URL`:

- `PUBLIC_BASE_URL` must be the public base domain, not just a path.
- The Reporter EA needs a reachable public URL, not a private localhost address.

API not reachable:

- Confirm `npm start` is running.
- Confirm the server exposed at `PUBLIC_BASE_URL` is reachable from the student terminal.
- Confirm `MT4_SYNC_PATH` matches the Reporter EA `SyncUrl`.
- Check `GET /health` on the same public origin to verify the API is up.

MT4 API key rejected:

- If `MT4_SYNC_API_KEY` is set on the server, the Reporter EA `ApiKey` input must match it exactly.
- Leave both sides blank if you do not want to enforce an API key.

AutoTrading off:

- MT4 must have `AutoTrading` enabled for the Reporter timer to keep sending snapshots.

Reporter EA not attached:

- The student must attach `CultureCoin_MT4_Reporter.ex4` to any chart.
- It can run beside the main EA and does not replace it.

Account number mismatch:

- The first successful sync locks the connection to that MT4 account number.
- If the student switches accounts, issue a new pairing flow and verify the desk connection.

Stale MT4 data:

- WISDO and `/mt4-status` flag stale snapshots when the last sync is older than `WISDO_MT4_STALE_MINUTES`.
- Check terminal connection, WebRequest permission, Reporter EA status label, and API reachability.
