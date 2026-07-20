# WISDO v7.0.3 Heap-Safe MT4 Poll Repair

This release keeps the complete remodel and v7.0.2 transport repairs while fixing the Render heap crash and multi-second `/mt4-command-poll` path. MT4 command state now has one compact durable queue instead of three duplicated indexes, concurrent idle polls share one hot read, idle polls perform zero writes, Redis heartbeat is removed from the response path, performance health uses compact metrics, and noncritical reads are shed before memory exhaustion. See `WISDO_V7_0_3_HEAP_AND_POLL_REPAIR_AUDIT.md` and `WISDO_V7_0_3_DEPLOYMENT_CHECKLIST.md`.

## Previous v7.0.2 transport repair

The v7.0.1 remodel remains included: 77 unique slash commands, guarded interactions, hardened private desk creation/restoration, one authoritative `/mt4-sync` route, and first-visit/first-login-of-day/return-after-away WISDO greetings across `/app/*`.

## WISDO v6.1.0 — Full Queue Audit and Performance Recovery


This release audits every production JavaScript file for request-blocking global promise tails and removes cross-account serialization from the website, MT4 command path, notification delivery, Phase 1 state, trade signals, growth funnel, and PostgreSQL hot-state adapters. Required concurrency controls are now scoped single-flight guards or nonblocking database try-locks.

It also bounds live Reporter reconciliation on read-only pages, returns stored PostgreSQL state when live refresh is delayed, lazy-loads motion videos only when selected, bypasses MP4 range traffic in the service worker, and stores Culture Feed metadata in PostgreSQL instead of a JSON index. PostgreSQL remains durable truth; there is no laptop or JSON runtime-state fallback, and Redis remains optional.

See `WISDO_V6_1_0_RELEASE_NOTES.md` and `WISDO_V6_1_0_DEPLOYMENT_AND_TEST_CHECKLIST.md`.

# WISDO v6.0.8 — Cloud-Only Recovery and Database Circuit Breaker

WISDO v6.0.8 keeps the database-only architecture from v6.0.6 while repairing the production slowdown that caused dashboard tabs to stall and every MT4 Reporter to time out. PostgreSQL remains the source of truth; the server now uses one shared connection pool, a process-wide read-through cache, short state mutations, and nonblocking AI/product ingestion.

This release repairs:

- All connected Reporter accounts loading together from PostgreSQL instead of disappearing behind database timeouts.
- MT4 heartbeat persistence reduced from up to three live-state transactions to one short transaction.
- Signal creation and close relay work moved outside PostgreSQL advisory-lock transactions.
- Academy, Lane Coach, product ledger, and route-reconciliation work no longer delays the MT4 HTTP response.
- Dashboard and app-tab reads use a shared stale-while-revalidate cache instead of reloading every database namespace repeatedly.
- Background broker and AI workers are single-flight and cannot overlap with their own previous cycle.

The v6.0.6 capabilities remain included:

- Reporter v1.58 connection grace, exponential retry backoff, and Connected/Degraded/Retrying/Offline health states.
- Broker API onboarding in `/app/accounts` through MetaApi, cTrader OAuth account discovery, and a signed WISDO broker webhook.
- An active Lane Intelligence coach grounded in current Culture Lane Vault metrics, confirmed trade history, timeline events, Trade Passports, and shared Academy memory.
- Contextual Academy AI that can build lessons from the selected lane and shares approved educational memory with Lane Intelligence.
- Opt-in email, SMS, and Discord DM coach notifications with a PostgreSQL outbox and retry worker.
- Internal background workers for broker refresh and meaningful-change coach updates.

Important execution boundary: Broker API accounts are monitoring/leader data sources by default. They are not eligible as execution receivers until a provider-specific trading adapter is explicitly implemented and enabled. Reporter v1.58 remains the MT4 execution bridge for copy and close commands.

See `WISDO_V6_0_6_RELEASE_NOTES.md` and `WISDO_V6_0_6_DEPLOYMENT_AND_TEST_CHECKLIST.md` before deployment.

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

Production is PostgreSQL-only. Set `DATABASE_URL`, `WISDO_PERSISTENCE_MODE=postgres`, and `WISDO_DB_SSL=true` on Render. The application refuses production startup without a database. Redis remains the low-latency command transport and recovery queue, but PostgreSQL is the durable state source. Local automated tests use volatile memory and do not create JSON state files.

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


## v6.0.3 unified lane workflow

v6.0.3 moves Culture Lane creation, multi-receiver selection, and click-to-allow symbol routing into `/app/copier-engine`. The main dashboard now presents each Culture Lane as one combined portfolio profile and includes working inline Harvest controls. Automatic Harvest evaluates every Reporter snapshot, queues one parallel atomic sweep per account, confirms the lane is flat, records the cycle, resets the next baseline, and pauses Harvest Once lanes. Leader closes gain a deterministic Reporter-snapshot failsafe that relays closes when the ticket appears in closed history or disappears from a complete open-trade snapshot. Reporter v1.57 remains the required MT4 execution bridge. See `docs/RELEASE_NOTES_V6_0_3.md`.


## v6.0.4 relay recovery and redeploy durability

- Production promotes the WISDO ecosystem state to PostgreSQL whenever `DATABASE_URL` is available.
- Trading accounts, Culture Lanes, symbol highlights, Harvest policies, lane timelines, Genomes, Passports, and portfolio metrics survive Render redeploys.
- Signed Reporter pairing codes recover after service replacement.
- Live copy routes reconcile whenever either the leader or receiver Reporter reconnects.
- Website-member route ownership can safely bridge to linked Reporter/Discord identities.
- Auto-copy execution resolves the follower through the verified route identity instead of rejecting the website owner.
- The dashboard exposes **Close All Culture Lane** and **Close Leader Trades** as separate priority atomic-sweep controls.
- The service-worker cache is versioned so the new dashboard controls replace older cached JavaScript immediately.


## v6.0.5 complete Compound Tracker

- Fixes the missing daily and weekly progress values that previously rendered as zero because the API never returned them.
- Adds portfolio, Culture Lane, and individual-account scope filters.
- Adds Today, 7-day, 30-day, 90-day, 1-year, and all-time periods.
- Shows combined balance, equity, floating P/L, realized P/L, return, open exposure, drawdown, expectancy, payoff ratio, recovery factor, streaks, and average hold time.
- Adds configurable daily, weekly, and monthly dollar goals with persistent PostgreSQL-backed progress.
- Adds symbol, account, and side contribution tables, recent closed trades, cumulative daily/weekly charts, and CSV export.
- Expands every Compound Tracker event with command ID, MT4 result payload, completion latency, before/after performance, failed-order count, and close source.
- Adds a full tracker execution summary for completed, failed, pending, closed-order, failed-order, realized, and average-confirmation results.

See `docs/RELEASE_NOTES_V6_0_5.md`.


## v6.0.6 database AI and Broker API release

- `/app/accounts` includes MetaApi token/account onboarding, cTrader OAuth discovery, and signed webhook bridge creation.
- `/app/lane-intelligence` is an active WISDO coach with persistent chat, live lane grounding, educational explanations, and opt-in outbound delivery.
- `/app/education` adds lane-aware AI lessons and shares database-backed learning memory with Lane Intelligence.
- Reporter v1.58 preserves the last healthy heartbeat through transient failures and uses exponential retry backoff.
- Every active runtime store uses PostgreSQL in production.


## v6.0.8 PostgreSQL performance recovery

- Uses one process-wide PostgreSQL pool instead of one pool per WISDO state namespace.
- Shares one cache and one serialized write queue for every adapter using the same namespace.
- Uses a 2-second fresh cache and a 30-second stale-while-revalidate window by default.
- Keeps database writes authoritative while allowing safe cached reads in the single Render web process.
- Persists all Reporter connections, pairing records, latest snapshots, signal tracking, and bounded history in one heartbeat mutation.
- Records compact MT4 history every 15 seconds unless a trade opens/closes or a Reporter connects.
- Defers WISDO memory, Academy, Lane Coach, product ledger, Harvest analysis, and route reconciliation until after the Reporter response.
- Prevents overlapping proactive Coach, Broker API, and notification retry cycles.
- Keeps Reporter v1.58 as the correct terminal bridge; no new MQL4 compilation is required.

See `WISDO_V6_0_7_RELEASE_NOTES.md` and `WISDO_V6_0_7_DEPLOYMENT_AND_TEST_CHECKLIST.md`.
