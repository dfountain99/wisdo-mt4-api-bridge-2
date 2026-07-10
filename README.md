# WISDO Member App — Capability + Adaptive Academy V5.2.0

WISDO is a multi-account trading command center that combines a premium public product site, account linking, MT4/Discord relay execution, Culture Lanes, risk governance, analytics, education, affiliate operations, billing, alerts, and administrative controls.

This release was rebuilt directly from the user-provided `wisdo-member-app-product-pass(1).zip`. Its root application is the only production source of truth. Historical copied source trees were removed so Render, local development, Discord command registration, and the web-only server all execute the same code.


## V5.2 capability and Academy release

- Xbox-inspired WISDO dashboard startup sequence tied to real account hydration
- Reporter-backed account list shared across every authenticated screen
- Non-freezing broker account onboarding with timeout, visible status, and immediate pairing code
- Unified `/app/education` Academy shell with legacy redirect preservation
- Protected DF Sauce chart replay, decision grading, video checkpoints, and a TradingView Watch Room without shipping proprietary Pine source
- WISDO Insight Engine naming plus member-selectable color and background themes


### V5.2 additions

- One authoritative `/api/copier/options` response for Dashboard, Accounts, and Copier Engine
- Explicit account capabilities: `canLead`, `canReceive`, `canExecute`, `isShared`, and `isCommunity`
- Account-role editor for Private Desk, Culture Lead, Mirror Receiver, and Dual Role
- Copier diagnostics for missing roles, stale Reporter heartbeats, offline terminals, and disabled AutoTrading
- Receiver dropdown restricted to owned accounts explicitly allowed to receive
- Shared and community leads displayed with their access type and permission
- 6,500 structured Academy courses across 65 knowledge domains and five levels
- Adaptive learner profile, personalized 36-course path, searchable catalog, course assessments, progress, and badges
- Account-aware AI tutor with persistent history and course recommendations
- Proprietary DF Sauce Pine source removed from all public assets and blocked from Git commits
- Private TradingView layout handoff through `WISDO_DF_SAUCE_TRADINGVIEW_URL`

## Production entry order

```text
render.yaml
  -> npm start
  -> index.js
  -> config.js
  -> root commands/
  -> root services/
  -> server/apiServer.js
      1. security and request middleware
      2. static assets and service worker
      3. premium public/product routes
      4. extended product APIs
      5. legacy-compatible member and Discord routes
      6. error handling and startup
```

Use `npm run start:web` for an HTTP-only smoke environment without connecting the Discord bot.

## Included product surfaces

### Public product website

- `/` premium WISDO landing page
- `/copier` copier deep dive
- `/analyzer` analytics deep dive
- `/compare` broker/prop comparison
- `/pricing` interactive CFD/Futures configurator
- `/academy` public Academy overview
- `/blog` and `/blog/:slug`
- `/login`, `/register`, `/forgot-password`, `/reset-password`
- `/terms`, `/privacy`, `/risk-disclosure`, `/contact`
- `/robots.txt`, `/llms.txt`, `/sitemap.xml`

### Authenticated workspace

- `/app` and `/app/dashboard`
- `/app/accounts`
- `/app/copier-engine`
- `/app/trades`
- `/app/analyzer`
- `/app/alerts`
- `/app/education`
- `/app/affiliate`
- `/app/settings`
- `/app/settings/billing`
- `/app/admin` for authorized administrators

### Trading and relay systems

- MT4 Reporter pairing and heartbeat state
- Account-specific command queues
- Mobile account switching and account-specific Close All
- Culture Lead to Mirror Receiver routes
- Fixed lot, multiplier, equity ratio, and balance ratio sizing
- Symbol sanitation and broker symbol mapping
- Trading-hour, spread, pending-order, maximum-position, daily-loss, and equity-protection gates
- Signed broker webhook fanout for opens and closes
- Idempotent open handling
- Close routing bound to the original copied ticket/symbol
- Command delivery status synchronized across user and account queue copies
- Three symbol feature flags: UI, preview/save, and live execution

## Security controls

- HMAC-signed sessions
- AES-256-GCM encrypted broker credentials
- HMAC-SHA256 broker webhook validation
- Stripe signature validation
- bearer-token cron protection
- ownership checks on follower accounts and command actions
- administrator role gates
- password reset tokens are one-time and update the stored password hash
- safe local return-path validation across email, Discord, and Google auth
- dangerous account commands require confirmation

## Install and verify

```bash
npm ci
npm run check
npm run start:web
```

`npm run check` performs JavaScript syntax validation and runs the regression suite.

## Required production configuration

Copy `.env.example` into the provider/runtime secret manager. Do not commit a populated `.env` file.

Minimum standalone configuration:

```env
PUBLIC_BASE_URL=https://your-domain.example
SESSION_SECRET=<long random secret>
ENCRYPTION_KEY=<32+ random characters>
BROKER_WEBHOOK_SECRET=<long random secret>
CRON_SECRET=<long random secret>
DATA_DIR=/var/data/wisdo
WISDO_STORAGE_PATH=/var/data/wisdo
WISDO_DF_SAUCE_TRADINGVIEW_URL=https://www.tradingview.com/chart/YOUR_PRIVATE_LAYOUT
```

Discord and MT4 add `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `MT4_SYNC_API_KEY`, and related role/channel IDs. Stripe, Resend, market providers, AI, Google OAuth, VAPID, and PostgreSQL are provider integrations and stay unavailable until their real production credentials are configured.

## Persistent storage

The Render blueprint mounts `/var/data` and stores runtime state below `/var/data/wisdo`. JSON mode is the safe default for a single Render instance. PostgreSQL mode is available through `WISDO_PERSISTENCE_MODE=postgres` and `DATABASE_URL` after applying the V5 migration.

## Database migration

Apply:

```text
migrations/2026-07-10-wisdo-major-production-v5.sql
```

The migration defines profiles, roles, trading accounts, account shares, copier rules, trades, commands, snapshots, subscriptions, alerts, firms, affiliates, Academy progress, support tickets, audit records, RLS policies, and realtime publication entries.

## Production safety gate

Keep live symbol substitution disabled until two demo accounts pass open, modification, pending-order, partial-close, full-close, reconnect, duplicate-webhook, and stale-heartbeat tests:

```env
WISDO_SYMBOL_AUTOMATCH_EXECUTION_ENABLED=false
```

The spin-wheel UI and preview/save mapping can remain enabled while execution substitution is off.

## Documentation

- `docs/ARCHITECTURE_V5.md`
- `docs/API_V5.md`
- `docs/DEPLOYMENT_V5.md`
- `docs/SUPABASE_MIGRATION_V5.md`
- `docs/PRODUCTION_LAUNCH_CHECKLIST_V5.md`
- `docs/RELEASE_NOTES_V5.md`
- `docs/RELEASE_NOTES_V5_2_0.md`
- `docs/legacy-source-notes/` contains archived product-pass notes that are not production entrypoints.

## Risk notice

Trading and copy trading involve substantial risk of loss. Risk controls reduce operational exposure but cannot eliminate market, broker, connectivity, slippage, liquidity, or execution risk. No feature in this repository guarantees profitability.

## V5.1.1 copier close authority

V5.1.1 repairs the full lead-close path. Opening filters such as symbol allowlists, route pause, spread limits, drawdown gates, and max-open-trades apply only to new entries. A leader close remains authoritative for an existing mirrored position.

The server now sends and persists all close identities:

- stable `sourceTicket` / `leaderTicket`
- route-scoped `copyKey`
- actual `followerTicket` returned by MT4 `OrderSend`
- follower account ID and resolved follower symbol

Reporter v1.55 closes by the stored follower ticket first, then the stable source marker, then a safe unique symbol/side recovery. It never reports success when no position was closed.

**Follower terminal upgrade is mandatory:** compile `mql4/CultureCoin_MT4_Reporter.mq4` in MetaEditor and replace the older Reporter EX4. The legacy compiled binary is archived and is not delivered as the active Reporter.
