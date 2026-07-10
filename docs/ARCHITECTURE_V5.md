# WISDO V5 Architecture

## Source-of-truth rule

The root folders are authoritative:

```text
index.js
config.js
commands/
services/
server/
storage/
public/
migrations/
scripts/
tests/
```

Do not recreate nested copies of the project under `commands/`, `server/`, or `src/`. All future patches must target this root tree.

## Runtime components

### `index.js`

Initializes configuration, persistence, Discord, the command registry, MT4 synchronization, copy services, bot catalog, and HTTP server.

### `server/apiServer.js`

Owns middleware and route order. Raw request bytes are preserved for signed Stripe and broker webhooks. Premium routes register before broad legacy aliases so modern pages cannot be shadowed.

### `server/majorUpgradeRoutes.js`

Owns the premium public website, protected workspace shell, pricing calculation, account/copier/trade/analyzer/alert APIs, broker webhook relay, cron endpoints, runtime audit, and public health response.

### `server/extendedProductRoutes.js`

Owns community leads and account sharing, Stripe billing and subscription state, push registration, Resend validation, Academy progress, support tickets, affiliate activation, AI analyzer chat, expanded admin functions, and trial expiration.

### `server/deadshotSite.js`

Keeps compatible historical URLs and auth providers. It uses signed sessions and preserves an exact safe `returnTo` path across email, Discord, and Google flows.

### Relay services

`Mt4CommandService` writes synchronized command copies for user-level and account-level polling. `CopyTradingService`, `SignalCopyService`, and the broker webhook layer resolve followers and risk controls before queuing commands.

## Data modes

### JSON mode

Best for one Render instance with a persistent disk. Runtime files live under `DATA_DIR`/`WISDO_STORAGE_PATH`.

### PostgreSQL mode

Enabled with `WISDO_PERSISTENCE_MODE=postgres` and `DATABASE_URL`. Apply the V5 migration first. RLS policies are included for a Supabase-compatible database, but the existing Node auth/session layer remains the active application auth unless explicitly replaced.

## Request safety order

1. request body and raw-body capture
2. security headers and size limits
3. session parsing
4. authentication/role guards
5. account ownership checks
6. route/risk validation
7. persistent state mutation
8. account-specific command queue
9. audit/alert response

## Broker webhook relay

```text
signed master event
  -> verify HMAC
  -> normalize event and symbol
  -> persist master trade/event
  -> find active routes
  -> validate leader access and follower ownership
  -> for opens: apply allowed-symbol, time, equity, daily-loss, spread,
     pending-order and maximum-position gates
  -> resolve original/follower symbol
  -> calculate follower lot
  -> queue account-specific MT4 command
  -> persist copied-trade association
  -> for closes: find original copied trade/ticket and bypass opening filters
```

Open events are idempotent. Close events use the original copied symbol/ticket even if the close webhook carries a broker alias.

## Browser architecture

Public pages are server-rendered with page-specific metadata and JSON-LD. The authenticated workspace uses `public/js/workspace.js` against `/api/v2/*`. `public/service-worker.js` caches the non-API shell and receives push notifications when VAPID delivery is configured.
