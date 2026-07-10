# WISDO Member App Major All-Upgrades V5 — Audit

Date: 2026-07-10

## Source provenance

- Sole source package: `wisdo-member-app-product-pass(1).zip`
- Source SHA-256: `df2143c9aee5039bf4ff547256d68bca84bd54b1ddbd1db99e30bcd7f4d1f7ce`
- Upgrade method: rebuilt forward inside the supplied application; the prior V4 package was not merged into this release.

## Production structure

The release has one root production tree: `index.js`, `config.js`, `commands/`, `services/`, `server/`, `storage/`, `public/`, `scripts/`, `migrations/`, and `tests/`.

Nested copied project generations were removed. Historical manifests and non-production source notes are retained only under `docs/legacy-source-notes/`. Runtime JSON from the supplied ZIP and local smoke runs was removed from the deliverable.

## Added product upgrades

### Premium public website

- premium WISDO home page with trading-SaaS visual system
- dedicated Copier, Analyzer, Compare, Pricing, Academy, Blog, Resources, Auth, Legal, and Contact pages
- interactive CFD/Futures pricing configurator
- platform logo artwork
- market sentiment/calendar/news sections with explicit provider/fallback status
- motion, count-up metrics, card glow, social proof, cookie consent, JSON-LD, Open Graph, sitemap, robots, and llms routes

### Authenticated member workspace

- dashboard and account selector
- accounts create/update/test/sync/disconnect/delete
- Culture Lane/Copier Engine controls
- trades and account-specific ticket/Close All controls
- analyzer, alerts, Academy, affiliate, settings, billing, support, and admin surfaces
- mobile-compatible workspace script and service worker

### Backend and relay

- stable route registration order
- account, copier rule, trade, analyzer, alert, affiliate, Academy, support, push, billing, firm, and admin APIs
- signed broker webhook connected to live follower command fanout
- idempotent open processing
- close processing bound to the original copied trade/ticket and follower symbol
- follower symbol guaranteed before queueing
- open-only allowed-symbol, trading-hours, equity, daily-loss, spread, pending-order, and maximum-position gates
- close events bypass opening filters
- fixed lot, multiplier, equity ratio, and balance ratio modes
- owned/shared/community Culture Lead access with follower ownership enforcement
- synchronized account/user MT4 command delivery state
- route-ID based lane deletion
- automatic relay alerts persisted for members

### Security and deployment

- HMAC-signed sessions
- safe full-path `returnTo` preservation for email, Discord, and Google auth
- AES-256-GCM credential encryption
- one-time password reset that changes the stored password hash
- HMAC-SHA256 broker webhook verification
- Stripe webhook signature verification
- cron bearer protection
- dangerous command confirmation including single-ticket close
- persistent Render disk at `/var/data`
- pure-Node PNG chart renderer; native Canvas build dependency removed
- repaired web-only startup command
- comprehensive environment blueprint
- PostgreSQL/Supabase migration with RLS and realtime publication support
- Resend email templates and live test route
- VAPID service worker, key route, subscription storage, and live test-push route

## Validation results

### Clean dependency install

`npm ci --no-audit --no-fund` completed successfully from an empty `node_modules` directory.

### Automated regression suite

- JavaScript syntax checked: 72 files
- required production assets checked: 9
- automated tests: 5 passed
- failed tests: 0

The tests cover pricing, sessions, HMAC, encrypted credentials, command synchronization, dangerous close confirmation, portable PNG rendering, public pages, auth return state, protected routes, account persistence, encrypted-at-rest credentials, Culture Lane creation, symbol sanitation, signed open/close webhook fanout, duplicate-open protection, original-symbol close routing, password reset, community leads, Academy progress, support, provider readiness, route deletion, and admin access.

### Final HTTP smoke test

- web-only server started successfully
- 14 public/product/static/audit routes returned HTTP 200
- unauthenticated `/app/dashboard` returned HTTP 302 to a preserved login return path
- 12 authenticated workspace/API routes returned HTTP 200
- health reported signed sessions and credential encryption ready

## Provider and live-execution boundary

The application contains real integration code and validation points, but external systems require production credentials and provider-side configuration:

- Discord bot/OAuth
- Google OAuth
- MT4 Reporter/API keys and broker connectivity
- Stripe Checkout/Portal/webhook
- Resend email
- OpenAI/Google AI
- Finnhub/TradingEconomics/Firecrawl market feeds
- VAPID push delivery
- PostgreSQL/Supabase

No live-money broker execution or production Stripe charge was performed in this build environment. Legal pages require counsel review before launch. TradingView Pine Script is not executed inside WISDO; the Academy provides explanation/simulation workflows instead.

## Required launch safety setting

Keep the following disabled until two demo MT4 accounts pass the complete relay certification checklist:

`WISDO_SYMBOL_AUTOMATCH_EXECUTION_ENABLED=false`
