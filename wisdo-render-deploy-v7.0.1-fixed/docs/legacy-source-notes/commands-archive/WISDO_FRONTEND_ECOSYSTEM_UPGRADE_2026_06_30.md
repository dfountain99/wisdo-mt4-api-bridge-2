# Wisdo Frontend Ecosystem Upgrade — 2026-06-30

## What changed

This patch upgrades the server-rendered Wisdo frontend shell without importing backend/copier/Discord bot code into the frontend.

Active app files changed:
- `server/deadshotSite.js`
- `server/wisdo/demoData.js`
- `server/wisdo/components.js`
- `server/wisdo/wisdoPremiumPages.js`

Mirrored source-copy files changed:
- `src/server/deadshotSite.js`
- `src/server/wisdo/demoData.js`
- `src/server/wisdo/components.js`
- `src/server/wisdo/wisdoPremiumPages.js`

## New visual systems
- Premium Wisdo landing page with logo pulse, command launch, MT4 heartbeat, dashboard preview, and Master → Follower copier network visual.
- Member Dashboard with rank badge, progress, demo MT4 account cards, copy mode controls, Signal Grid widget, Risk Guardian card, and copy logs.
- Rank Center with 12 Wisdo ranks, Discord role mapping, progress, requirements, unlocks, and animated badges.
- Signal Grid with active routes, expiration labels, provider ranks, risk labels, and copy-button UI.
- Discord Sync page with role sync preview, rank match state, and bot command preview.
- Copy Logs page with animated demo events, rank events, and status badges.
- Wisdo Voice / future Alexa-style architecture page with safety levels and read-only-first command model.
- Risk Guardian page with drawdown, exposure, warnings, checklist, and emergency-stop UI.
- Signal Performance, TradingView Intake, Trust Center, Support Center, Academy, Live, Seminar Room, Shows, Replays, Coach, Marketplace, Mobile/PWA, and Profile UI.
- Admin-side Wisdo Users, Signals, Education, Support, and Audit demo pages.

## Demo routes
- `/` — upgraded Wisdo landing page.
- `/demo/dashboard` — public dashboard demo shell.
- `/demo/signal-grid` — public Signal Grid demo shell.

## Member routes added
- `/app/rank-center`
- `/app/signal-grid`
- `/app/discord-sync`
- `/app/voice`
- `/app/risk-guardian`
- `/app/signal-history`
- `/app/provider-performance`
- `/app/tradingview-intake`
- `/app/trust-center`
- `/app/support-center`
- `/app/academy`
- `/app/live`
- `/app/seminar-room`
- `/app/shows`
- `/app/replays`
- `/app/coach`
- `/app/marketplace`
- `/app/mobile-pwa`

## Admin routes added
- `/admin/wisdo-users`
- `/admin/wisdo-signals`
- `/admin/wisdo-education`
- `/admin/wisdo-support`
- `/admin/wisdo-audit`

## Technical notes
- Demo data is isolated in `server/wisdo/demoData.js` and mirrored to `src/server/wisdo/demoData.js`.
- Components are reusable and lightweight in `server/wisdo/components.js`.
- Page assembly stays in `server/wisdo/wisdoPremiumPages.js`.
- Frontend visuals do not import MT4 copier, Discord bot, or backend service logic.
- No large JSON data or video files were added.
- Animations are CSS-only and lightweight.

## Validation performed
- `node --check server/deadshotSite.js`
- `node --check server/wisdo/wisdoPremiumPages.js`
- `node --check server/wisdo/components.js`
- `node --check server/wisdo/demoData.js`
- Started web-only server with `PORT=5056 node scripts/startWebOnly.js`
- Verified `/health`, `/`, `/demo/dashboard`, and `/demo/signal-grid` returned successfully.
