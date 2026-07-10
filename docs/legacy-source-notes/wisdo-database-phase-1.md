# Wisdo Database Phase 1

Phase 1 makes the most important Wisdo state restart-safe without forcing a production database on local development.

## Chosen Mode

Default mode is still JSON:

```env
WISDO_PERSISTENCE_MODE=json
WISDO_STORAGE_PATH=./data/operator-desks
```

PostgreSQL mode is explicit:

```env
WISDO_PERSISTENCE_MODE=postgres
DATABASE_URL=postgres://...
WISDO_DB_SSL=true
```

If postgres mode is enabled and `DATABASE_URL` is missing, startup fails clearly.

## Files Added

- `services/repositories/wisdoPhase1Repository.js`
- `migrations/2026-07-04-wisdo-phase-1.sql`

## Schema Added

The Phase 1 migration defines:

- `user_desks`
- `trading_accounts`
- `account_snapshots`
- `bots`
- `bot_versions`
- `bot_access`
- `bot_purchases`
- `copy_requests`
- `copy_relationships`
- `copy_trade_logs`
- `theme_preferences`
- `notifications`
- `lesson_progress`
- `admin_audit_logs`
- `mt4_commands`
- `wisdo_kv_store`
- `affiliates`
- `affiliate_referrals`
- `affiliate_commissions`
- `affiliate_payouts`
- `affiliate_campaigns`

`wisdo_kv_store` is the launch-safe bridge used by the adapter. The normalized tables are present for the next backfill/query pass.

## Services Migrated

- `server/apiServer.js` now loads/saves Wisdo ecosystem state through `WisdoPhase1Repository`.
- `copyTradingService.js` and `mt4CommandService.js` use the shared adapter.
- `botStoreService.js` keeps the existing commerce repository but now supports Phase 1 marketplace/access/purchase contracts.
- `operatorDeskService.js` continues to use `OperatorDeskRepository` for desks, account selection, connected accounts, and snapshots.

## Persisted In Phase 1

- User desk state
- Selected account per user
- Theme preferences
- Notifications
- Education progress
- Admin audit logs
- Copy requests and relationships
- Copy risk/calculation logs
- Bot admin version metadata
- MT4 command queue/status logs through the command adapter
- Affiliate activation-fee referrals, commissions, payout batches, campaigns, and settings

## Affiliate Activation Fee Engine

Default env-backed settings:

```env
WISDO_ACTIVATION_FEE_AMOUNT=125
WISDO_AFFILIATE_DEFAULT_PERCENT=30
WISDO_AFFILIATE_MIN_PAYOUT=25
WISDO_AFFILIATE_HOLD_DAYS=7
WISDO_AFFILIATE_AUTO_APPROVE=false
```

When a referred customer pays the setup/activation fee, Wisdo records the payment reference on the referral and creates a pending `AffiliateCommission`. A 30% commission on a $125 activation fee is $37.50. The percentage can be overridden globally, per affiliate, or per campaign before payout.

Payouts are not marked paid until an admin records the payout reference. Refund, cancellation, dispute, or chargeback handling can cancel or claw back commissions.

## Remaining JSON/Legacy State

Some broad legacy website surfaces still use the central ecosystem state shape for compatibility, including social feed posts, affiliate/payout scaffolding, VPS assignments, and paid-link helpers. They are still durable in JSON/postgres key-value mode, but not yet normalized into dedicated tables.

## Render Setup

1. Keep local/dev on `WISDO_PERSISTENCE_MODE=json`.
2. Create a Render PostgreSQL database when ready.
3. Add `DATABASE_URL` to the Render web service.
4. Set `WISDO_PERSISTENCE_MODE=postgres`.
5. Set `WISDO_DB_SSL=true` for Render-managed Postgres.
6. Configure affiliate settings with `WISDO_ACTIVATION_FEE_AMOUNT`, `WISDO_AFFILIATE_DEFAULT_PERCENT`, `WISDO_AFFILIATE_MIN_PAYOUT`, `WISDO_AFFILIATE_HOLD_DAYS`, and `WISDO_AFFILIATE_AUTO_APPROVE`.
7. Run `migrations/2026-07-04-wisdo-phase-1.sql` against the database before flipping production traffic.

## Safety

- Dangerous MT4 commands are validated at queue insertion and require confirmation.
- Voice execution still refuses confirmed-dangerous trading actions unless explicit confirmation is supplied.
- Copy-trading paths keep risk settings and skipped-trade logging.
- Affiliate payouts hide payout details from user-facing dashboard responses.
- Self-referrals are blocked unless explicitly enabled.
- No guaranteed-profit claims are added.

## Next Recommended Phase

Backfill from `wisdo_kv_store`/JSON into the normalized tables, then switch high-read APIs to typed table queries one domain at a time: accounts first, then bot access/purchases, then copy relationships, then education/audit.
