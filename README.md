# WISDO v6.0.2 — Culture Lane Portfolio Operating System

WISDO v6.0.2 combines the complete application with a hardened PostgreSQL/Redis relay foundation and the first operational Culture Lane OS APIs. The release adds multi-instance-safe section persistence, Redis Streams, command idempotency, retry/dead-letter recovery, durable acknowledgements and heartbeats, Culture Lane Vaults, Smart Symbol Routing, Harvest policies, Genomes, Timelines, Trade Passports, DNA, and Intelligence reports.

See `docs/RELEASE_NOTES_V6_0_0.md` and `WISDO_V6_0_0_DEPLOYMENT_CHECKLIST.md` before deployment.

# WISDO V5.8.0 — Persistent Account Controls + Immediate Close Intelligence

## V5.8.0 release additions

- Saves every account desk role, sharing mode, and community label in a dedicated durable account-control registry. Reporter re-imports no longer reset an account to Private.
- Keeps account deletion intentional with persistent deletion tombstones. A deleted Reporter account does not silently reappear until the member adds it again; administrators have a separate permanent-delete route.
- Hardens JSON persistence with serialized writes, a last-known-good in-memory state, and an `ecosystem.json.bak` recovery copy. A transient read or parse problem no longer causes the application to replace live state with an empty object.
- Reduces unnecessary account-registry writes and changes the browser account refresh interval from 15 seconds to 45 seconds.
- Adds automatic server wake/retry behavior for safe GET requests while never retrying dangerous POST close commands.
- Adds immediate **Close All Now**, **Profit Secure**, and **Close Losing Only** controls. Bulk close commands use MT4 priority `1000`, immediate delivery, and a ten-minute execution window.
- Creates a persistent Compound Tracker for each bulk close, recording the pre-close account picture, MT4 result, realized outcome, and post-close trend analysis.
- Sends close completion results to the website Alert ledger, transactional email, Discord private message, private desk channel, and optional notification webhook when those integrations are configured.
- Adds always-visible daily and weekly trend gauges, Compound Score, Risk Pressure, Win Rate, Consistency, Profit Factor, a 7-day line chart, and an 8-week line chart based on MT4 Reporter history.

# WISDO V5.6.1 — Render Stability + Growth Funnel + Signup Email/SMS

## V5.6.1 stability and growth additions

- Fixes the MT4 `signalTrackingByAccountId` persistence regression that caused every Reporter heartbeat to reopen the same copy signals.
- Compacts Reporter history so historical snapshots keep account metrics without duplicating full open/closed trade arrays.
- Bounds trade-signal, tracking, and snapshot collections and runs a safe prestart repair against existing persistent files.
- Adds `/growth`, UTM/referral attribution, deduplicated lead capture, and an admin dashboard measured against a configurable 1,000-lead monthly target. The target is not a guarantee.
- Sends transactional signup and webinar email through Resend, plus optional consent-based SMS through Twilio. Failed deliveries enter a durable retry outbox.


WISDO is a multi-account trading command center that combines a premium public product site, account linking, MT4/Discord relay execution, Culture Lanes, risk governance, analytics, education, affiliate operations, billing, alerts, and administrative controls.

This release was rebuilt directly from the user-provided `wisdo-member-app-product-pass(1).zip`. Its root application is the only production source of truth. Historical copied source trees were removed so Render, local development, Discord command registration, and the web-only server all execute the same code.


## V5.6 Square checkout and real historical Study Room

- Stripe runtime checkout code and dependencies are removed from the active application.
- WISDO subscriptions, one-time setup products, bot purchases, paid-link access, and affiliate activation now use Square-hosted payment links.
- Square webhook signatures are checked against the exact configured notification URL and raw request body before any access is granted.
- Monthly, quarterly, semiannual, and annual subscription checkout use Square Catalog subscription plan variation IDs supplied through environment variables.
- In-app cancel and resume controls call Square subscription endpoints when a Square subscription ID is connected.
- The Study Room no longer creates simulated teaching candles. It loads verified historical OHLC from the configured provider and displays the provider, symbol, timeframe, and exact date range.
- WISDO selects a useful historical window, marks context, observed confirmation, educational entry, invalidation, and a 2R teaching projection, then supports automatic and manual zoom.
- If real historical data is unavailable, Live TradingView remains available while AI Historical Markup is disabled. WISDO returns zero substitute candles.
- Historical providers can be a WISDO market-data bridge, Twelve Data, or supported Coinbase public candle markets.


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


## V5.4 AI Webinar Room and Strategy Teaching Studio

- Replaces the external “live webinar” placeholder with an on-demand AI Webinar Room inside `/app/education`.
- Members enter any learning question and receive a structured narrated lesson with scenes, examples, risk guidance, knowledge checks, progress saving, and follow-up questions.
- Browser speech synthesis powers the interactive AI-video lesson immediately; no webinar host or video-rendering vendor is required.
- OpenAI lesson generation is used when `OPENAI_API_KEY` is configured, with a deterministic educational fallback when it is not.
- Optional external MP4 rendering can be connected through `WISDO_AI_VIDEO_PROVIDER_URL`, while the browser lesson remains the default reliable experience.
- Authorized administrators receive a Strategy Teaching Studio for structured market conditions, entry, confirmation, exit, invalidation, risk, examples, mistakes, and FAQs.
- Strategies remain private drafts until explicitly published. Editing published knowledge automatically returns it to review, preventing unapproved changes from being taught.
- Every published strategy version is snapshotted, and the AI is instructed to use only the published version without inventing missing rules or exposing protected source code.
- Member webinar payloads do not expose quiz answer indices.

## V5.3 connected intelligence and Education Hub

- Reporter snapshots feed one authoritative trade/event ledger used by Trades, WISDO Insight Engine, Alerts, and Culture Lane lifecycle diagnostics.
- Active Culture Lanes are synchronized into the lead snapshot detector before open/close comparison.
- Education Hub has four pillars: Trading Academy, WISDO University, Resource Center, and the on-demand AI Webinar Room.
- 6,500 adaptive courses remain searchable, while course sessions now open into worked explanations, vocabulary, context, risk, replay practice, checkpoints, and tutor engagement instead of static module paragraphs.
- Resource Center generates 390 original WISDO study guides, checklists, worksheets, flash-card packs, journal templates, and cheat sheets with bookmarks.
- Trading tools include position size, risk/reward, margin, pip value, P/L, drawdown, compounding, and risk-of-ruin scenarios.
- Wisdo AI is a persistent assistant across public and member pages with page context, selected-account context, voice input, screenshot attachment, history, suggested questions, navigation links, membership usage limits, and visible confirmation boundaries for account actions.
- Private DF Sauce and HIGHTOWER source remains excluded; the site teaches operating logic and opens the configured private TradingView layout.

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
- `/resources` public Resource Center overview
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
- Square signature validation
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
OPENAI_API_KEY=<optional for generative webinar lessons>
WISDO_AI_VIDEO_PROVIDER_URL=<optional external MP4 renderer>
WISDO_AI_VIDEO_PROVIDER_KEY=<optional renderer credential>
WISDO_AI_VIDEO_WEBHOOK_SECRET=<required when external rendering is enabled>
```

Discord and MT4 add `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `MT4_SYNC_API_KEY`, and related role/channel IDs. Square, Resend, market providers, AI, Google OAuth, VAPID, and PostgreSQL are provider integrations and stay unavailable until their real production credentials are configured.

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

## v6.0.2 visible controls and fast close

v6.0.2 makes the Culture Lane OS operational from the website: dedicated Culture Lane, Symbol Routing, Harvest, Audit, Intelligence, and Compound Tracker pages; automatic migration of existing copier routes; parallel lane/Harvest close fanout; click-to-allow leader-symbol highlights tied to the live relay; mobile page navigation; and Reporter v1.57 atomic basket sweep. See `docs/RELEASE_NOTES_V6_0_2.md`.

## V5.1.1 copier close authority

V5.1.1 repairs the full lead-close path. Opening filters such as symbol allowlists, route pause, spread limits, drawdown gates, and max-open-trades apply only to new entries. A leader close remains authoritative for an existing mirrored position.

The server now sends and persists all close identities:

- stable `sourceTicket` / `leaderTicket`
- route-scoped `copyKey`
- actual `followerTicket` returned by MT4 `OrderSend`
- follower account ID and resolved follower symbol

Reporter v1.57 supports immediate account synchronization and closes by the stored follower ticket first, then the stable source marker, then a safe unique symbol/side recovery. It never reports success when no position was closed.

**Follower terminal upgrade is mandatory:** compile `mql4/CultureCoin_MT4_Reporter.mq4` in MetaEditor and replace the older Reporter EX4. The legacy compiled binary is archived and is not delivered as the active Reporter.

## Education and AI Webinar settings

```env
WISDO_DF_SAUCE_TRADINGVIEW_URL=https://www.tradingview.com/chart/YOUR_PRIVATE_LAYOUT/
OPENAI_API_KEY=
WISDO_AI_MODEL=gpt-4.1-mini
WISDO_AI_VIDEO_PROVIDER_URL=
WISDO_AI_VIDEO_PROVIDER_KEY=
WISDO_AI_VIDEO_WEBHOOK_SECRET=
```

Without external AI or video-rendering credentials, the internal adaptive tutor, calculators, resource library, scenario labs, and browser-narrated AI Webinar Room remain available. The optional renderer is used only when a downloadable MP4 provider is deliberately configured.

## v5.9 PostgreSQL + Redis infrastructure

The v5.9 patch adds eager, sectioned PostgreSQL persistence and a Redis-backed MT4 command bridge. It intentionally does not use lazy loading. See `WISDO_V5_9_POSTGRES_REDIS_DEPLOYMENT.md` and verify `/api/copier-infrastructure-health` after deployment.
