# WISDO V5 Deployment

## Render deployment

1. Create or update the service from `render.yaml`.
2. Confirm the persistent disk is mounted at `/var/data`.
3. Set `PUBLIC_BASE_URL` to the final HTTPS origin.
4. Add Discord, OAuth, MT4, Stripe, Resend, AI, market, and push credentials as needed.
5. Deploy with `npm ci --omit=dev --no-audit --no-fund` and `npm start`.
6. Verify `/health`, `/api/public/health`, and `/api/runtime-audit`.

The default Render persistence mode is JSON under `/var/data/wisdo`. Do not use an unmounted application directory for live state.

## Required secrets

- `SESSION_SECRET`
- `ENCRYPTION_KEY` (32+ random characters)
- `BROKER_WEBHOOK_SECRET`
- `CRON_SECRET`
- `MT4_SYNC_API_KEY`

Provider-specific secrets are listed in `.env.example`.

## OAuth callbacks

```text
https://YOUR_DOMAIN/auth/discord/callback
https://YOUR_DOMAIN/auth/google/callback
```

Configure both callback URLs at the providers and set the matching client IDs/secrets.

## Stripe webhook

Canonical route:

```text
POST https://YOUR_DOMAIN/api/public/webhooks/stripe
```

Subscribe to at least:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

The legacy `/stripe/webhook` path remains for compatibility with the original product pass.

## Broker webhook signature

Compute an HMAC-SHA256 hex digest over the exact raw JSON body using `BROKER_WEBHOOK_SECRET` and send it as `x-wisdo-signature`.

## Cron requests

Send:

```text
Authorization: Bearer <CRON_SECRET>
```

to the three `/api/public/cron/*` endpoints. Account synchronization may run each minute; market refresh hourly; expired trial cleanup daily.

## PostgreSQL/Supabase option

1. Provision PostgreSQL/Supabase.
2. Apply `migrations/2026-07-10-wisdo-major-production-v5.sql`.
3. Set `DATABASE_URL`.
4. Set `WISDO_PERSISTENCE_MODE=postgres`.
5. Restart and verify health shows PostgreSQL configured.

Start in JSON mode unless the database migration and backup/restore plan have been validated.

## Rollback

- retain the previous deploy artifact
- snapshot `/var/data/wisdo` before migration
- do not downgrade state formats without restoring the matching snapshot
- keep symbol execution automatch disabled during rollback testing
