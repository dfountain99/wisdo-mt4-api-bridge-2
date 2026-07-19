# Culture Coin / Deadshot Trading Command Center Rebuild

## What changed

This rebuild replaces the old frontend experience with an original premium dark fintech command-center interface, while keeping the existing Express/Discord/MT4 backend structure intact.

### New public pages
- `/` Home page
- `/tunnel` Tunnel landing page
- `/webinar/register` Webinar registration
- `/webinar/replay` Webinar replay
- `/offer` Offer/checkout page
- `/pricing` Pricing page
- `/login` Login page
- `/signup` Signup page
- `/faq` FAQ page
- `/contact` Support/contact page
- `/checkout/success`
- `/checkout/cancel`

### New user portal pages
- `/app/dashboard`
- `/app/subscriptions`
- `/app/membership`
- `/app/connect-account`
- `/app/copier`
- `/app/reporter`
- `/app/bot-control`
- `/app/risk`
- `/app/discord`
- `/app/trade-history`
- `/app/billing`
- `/app/profile`

Legacy `/member/...` pages are redirected to the new `/app/...` command-center routes where appropriate.

### New admin pages
- `/admin`
- `/admin/users`
- `/admin/active-members`
- `/admin/inactive-members`
- `/admin/subscriptions`
- `/admin/payments`
- `/admin/products`
- `/admin/leads`
- `/admin/copier-access`
- `/admin/reporter-settings`
- `/admin/support-tickets`
- `/admin/licenses`

## New backend/API behavior

### Membership roles
- `guest`
- `free_user`
- `culture_coin_member_active`
- `culture_coin_member_inactive`
- `admin`

### Access rules
- Reporter is visible to free, inactive, active, and admin users.
- Trade copying is blocked unless all checks pass:
  1. User is authenticated.
  2. User is active by Stripe/admin/Discord role.
  3. User role is `culture_coin_member_active` or `admin`.
  4. Copier is enabled for the user.
  5. Trading account is connected.

Blocked attempts are logged in `state.tradeCopyAttempts` inside the existing ecosystem JSON store.

### Discord role activation
If `DISCORD_TOKEN`, `GUILD_ID`, and `CULTURE_COIN_ROLE_ID` are configured, the website checks the logged-in Discord user against the guild member roles. Manually granting the Culture Coin role in Discord can keep the member active.

### Stripe
Added a new webhook endpoint:

```txt
/api/stripe/membership-webhook
```

Stripe checkout is created through:

```txt
/api/checkout/session
```

The checkout flow supports recurring subscriptions and one-time products. Apple Pay / Google Pay are handled by Stripe Checkout after wallet/domain settings are configured in Stripe.

## New animation system

The new original Culture Coin “Command Launch” animation plays after:
- successful login
- Google OAuth callback
- Discord OAuth callback
- checkout success
- bridge/dashboard launch query

The animation is not a fake unlock. It calls `/api/deadshot/me` and waits for the membership response before showing unlocked/locked state.

Reduced-motion users skip the animation.

## Files added

- `server/deadshotSite.js`
- `scripts/startWebOnly.js`
- `frontend/components/connection/LaunchConnectionAnimation.tsx`
- `frontend/components/connection/CommandCenterOnlineToast.tsx`
- `frontend/components/connection/AuthSuccessTransition.tsx`
- `frontend/components/connection/TradingBridgeConnectAnimation.tsx`
- `frontend/design/command-launch.css`
- `frontend/design/tailwind.config.ts`
- `DEADSHOT_REBUILD_NOTES.md`

## Files changed

- `server/apiServer.js`
  - Imports the new Deadshot command-center route module.
  - Registers Stripe membership webhook before JSON body parsing.
  - Registers the new frontend routes before old legacy routes.
  - Discord OAuth now redirects to `/auth/success?provider=discord` so the launch animation can play.

- `package.json`
  - Added `start:web` and `dev:web` scripts.

- `server/package.json`
  - Added `start:web` and `dev:web` scripts.

- `.env.example` and `server/.env.example`
  - Added Google OAuth, Discord role sync, and Stripe membership webhook notes.

## Reporter file

The uploaded compiled reporter `.ex4` was not decompiled or edited. The website-side rules were enhanced around it. The reporter can still display reports/alerts for free or inactive users, while the backend blocks copier/bot execution for inactive users.

## Environment variables needed

```env
PUBLIC_BASE_URL=http://localhost:3000
DISCORD_TOKEN=
CLIENT_ID=
CLIENT_SECRET=
DISCORD_CLIENT_SECRET=
GUILD_ID=
CULTURE_COIN_ROLE_ID=
OWNER_USER_ID=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
MT4_SYNC_PATH=/mt4-sync
MT4_SYNC_API_KEY=
```

## How to run

Install dependencies if `node_modules` is not included:

```bash
npm install
```

Run web portal without needing a live Discord bot token:

```bash
npm run start:web
```

Run the full Discord bot + portal:

```bash
npm start
```

Register Discord commands after setting Discord env vars:

```bash
npm run register-commands
```

## Mock/demo vs live

### Live once keys are configured
- Discord OAuth
- Google OAuth
- Stripe checkout
- Stripe webhook membership sync
- Discord role membership check
- Existing MT4/MT5 bridge routes

### Mock/demo placeholders
- Dashboard balances/equity widgets use demo display data until connected account telemetry is wired into the new cards.
- Webinar video is a placeholder.
- Trade copier actions are gated/logged, but the new `/api/trade-copy/action` endpoint currently queues a safe placeholder response instead of directly firing a broker trade.
- Admin tables use the existing JSON ecosystem store and demo-friendly records.

## Audit pass updates

The rebuilt site was audited again and hardened so old member/admin frontend surfaces cannot render the previous website experience.

### Premium UI cleanup
- Replaced the flat public navbar with premium SaaS-style dropdown navigation for Platform, Funnel, Pricing, and Trust.
- Added responsive mobile behavior so public navigation remains usable instead of disappearing.
- Added a stronger dashboard-first connection-flow section to the homepage.
- Added richer account-connection UI with bridge heartbeat simulation for local testing.
- Added lock notices on copier, bot control, risk, and Discord command pages.
- Replaced legacy OAuth debug/setup pages with command-center styled OAuth status screens.
- Redirected legacy public/member/admin surfaces such as `/member/*`, `/admin/*`, `/feed`, `/r/*`, `/u/*`, and `/join/*` into the new funnel or portal shell before old routes can render.

### Access and billing hardening
- `/api/trade-copy/action` now requires both active Culture Coin status and `culture_coin_member_active` role, unless the user is admin.
- Backend still blocks copier actions even if someone bypasses frontend locked buttons.
- Blocked copy-trade attempts are written to `tradeCopyAttempts`.
- Guest checkout is blocked so paid products cannot create subscriptions with no user attached.
- Stripe checkout success only activates membership/Discord role for membership products, not one-time setup products.
- Admin membership update endpoint now requires an authenticated admin session.
- Manual admin activation attempts to grant the Discord Culture Coin role when the user has linked Discord and bot role settings are configured.
- Stripe membership activation attempts to grant the Discord Culture Coin role when the user has linked Discord and bot role settings are configured.

### Reporter/copy rule confirmed
- Free user: reporter visible, copier blocked.
- Inactive user: reporter visible, copier blocked.
- Active Culture Coin member: reporter visible, copier available only after copier is enabled and trading account/bridge is connected.
- Admin: full access.

### Legacy duplicate source cleanup
- Removed unused duplicate source trees `src/`, `server/src/`, and `server/server/` from this packaged rebuild so accidental legacy copies do not confuse deployment or future edits.
- The active runtime still uses the root `index.js`, root `commands/`, root `services/`, and `server/apiServer.js` with the new `server/deadshotSite.js` command-center routes.

## Correction pass: Wisdo synced command center + corrected trading sections

This pass removes the corrected non-product labels from the main member trading navigation. `TC Copier`, `Trading Tools`, `TC Analyzer`, and `Feedback` are not main trading tabs.

### Main member trading sections now used

- Copier Engine
- Copier Logs
- Account Trades
- Performance
- Culture Coin Reporter
- Wisdo Command Center
- Account Connection
- Account Configuration

Feedback remains support/admin feedback only via Contact/Support and `/admin/feedback`.

### Login navigation fix

The public shell now checks the current session/membership before rendering navbar actions. Logged-in users see:

- Dashboard
- Logout
- membership/copy status pill

Logged-out users see:

- Login
- Command Center

### Enhanced Wisdo command console

The Wisdo Command Center now includes:

- Premium command console layout
- Command tiles for Close Profitable, Pause Copier, Resume Copier, and Emergency Close
- Two-way sync radar for Website → Discord and Discord → Website
- Locked overlay for inactive/free users
- Live notification chat with filters, unread count, copy chat, and account links
- Backend-gated execution only; locked frontend buttons do not fake access

### New backend routes added

Account/config:

- `GET /api/account/status`
- `POST /api/account/configuration`
- `POST /api/account/metrics`

Pairing:

- `POST /api/pairing/generate`
- `POST /api/pairing/verify`
- `POST /api/pairing/sync`
- `GET /api/pairing/status`

Discord sync:

- `POST /api/discord/pairing-code`
- `POST /api/discord/connect`
- `GET /api/discord/status`
- `POST /api/discord/sync`
- `GET /api/discord/sync`
- `DELETE /api/discord/disconnect`
- `POST /api/discord/disconnect`
- `POST /api/discord/command-event`
- `GET /api/discord/notifications`

Notifications:

- `GET /api/notifications`
- `POST /api/notifications`
- `PATCH /api/notifications/read`
- `POST /api/notifications/test`

Copier:

- `GET /api/copier/status`
- `POST /api/copier/validate-access`
- `GET /api/copier/logs`
- `POST /api/copier/action`
- `POST /api/trade-copy/action`

### Discord slash commands added

New command module: `commands/wisdoCommandCenter.js`

Commands:

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

The existing `/wisdo` command is preserved, so `/wisdo help` was implemented as `/wisdo-help` to avoid breaking the current command name.

### Two-way sync behavior

Website-origin actions create `sync_events` and `notification_events` that Discord commands can read.
Discord-origin actions call the website API and create the same records so the website notification chat updates.

Synced items include:

- Pairing status
- Discord connection status
- Account configuration
- Risk mode
- Bot mode
- Daily profit target
- Max drawdown
- Copier commands
- Blocked action alerts
- Reporter status
- Notifications

### Profit notification trigger logic

`POST /api/account/metrics` compares new account metrics against previous metrics and creates alerts for:

- Equity Growth Alert
- Profit Moving Alert
- Drawdown Recovery Alert
- Daily Goal Progress Alert at 25/50/75/90/100%
- Bot Mode Changed Alert

Cooldowns are stored in `notificationCooldowns` to reduce spam.

### Access rule confirmed again

Culture Coin Reporter remains available to free, inactive, and active users.
Trade copying remains backend-blocked unless the user has active Culture Coin membership, active role, copier enabled, and a connected account.

