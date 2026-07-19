# Wisdo Persistence Plan

Wisdo is still intentionally JSON-first for local development and Render deployment, but the live services now expose cleaner boundaries that can be backed by a database later.

## Current Adapter

| Store | Current file | Owner |
| --- | --- | --- |
| Desk/profile/log state | `data/operator-desks/desks.json`, `profiles.json`, `logs.json` | `OperatorDeskRepository` |
| MT4 account state | `data/operator-desks/mt4.json` | `OperatorDeskRepository` |
| Commerce/catalog/license state | `data/operator-desks/commerce.json` | `OperatorDeskRepository` |
| MT4 commands | `data/operator-desks/mt4-commands.json` or `wisdo_kv_store` namespace | `Mt4CommandService` |
| Copy trading | `data/operator-desks/copy-trading.json` or `wisdo_kv_store` namespace | `CopyTradingService` |
| Wisdo ecosystem/API state | `data/operator-desks/ecosystem.json` or `wisdo_kv_store` namespace | `WisdoPhase1Repository` |

The immediate adapter is still JSON file storage with atomic temp-file writes where each service already used that pattern. `services/persistenceAdapter.js` now provides the concrete `JsonFilePersistenceAdapter`, a `MemoryPersistenceAdapter` for isolated tests, and a `PostgresKeyValuePersistenceAdapter` for explicit PostgreSQL mode. This preserves local behavior while making Render PostgreSQL possible without route rewrites.

## Env Controls

- `WISDO_PERSISTENCE_MODE=json | memory | postgres`
- `WISDO_STORAGE_PATH=./data/operator-desks`
- `DATABASE_URL=postgres://...`
- `WISDO_DB_SSL=true | false`
- `WISDO_SEED_DEV_DATA=false`

If `WISDO_PERSISTENCE_MODE=postgres` is enabled without `DATABASE_URL`, startup fails with a clear error. Local/dev defaults to JSON.

## Persistence Boundaries

The next database adapter should implement these repository/service boundaries without changing API or Discord command callers:

- `OperatorDeskRepository`: desks, profiles, logs, MT4 accounts, snapshots, shares, copy routes, broker requests, commerce.
- `WisdoPhase1Repository`: premium Wisdo API state including theme, notifications, lesson progress, copy requests, bot admin metadata, and admin audit.
- `Mt4CommandService`: command queue, command status history, command audit.
- `CopyTradingService`: masters, followers, copy requests, relationships, trade logs, ticket maps, audit.
- `BotStoreService`: bot metadata, versions, orders, licenses, purchase/access audit.

## Database Shape

Recommended first relational tables:

- `users`
- `operator_desks`
- `mt4_accounts`
- `mt4_snapshots`
- `mt4_commands`
- `mt4_command_audit`
- `copy_masters`
- `copy_followers`
- `copy_requests`
- `copy_relationships`
- `copy_trade_logs`
- `bot_catalog`
- `bot_versions`
- `bot_orders`
- `bot_licenses`
- `admin_audit_logs`
- `affiliates`
- `affiliate_referrals`
- `affiliate_commissions`
- `affiliate_payouts`
- `affiliate_campaigns`

JSON columns are acceptable for broker snapshots, risk profile blobs, command payloads, and bot delivery metadata. Core join fields such as `discordUserId`, `accountId`, `botId`, `relationshipId`, and `commandId` should be indexed.

## Migration Order

1. Add adapter interfaces beside current services, but keep JSON as the default implementation. Complete for Phase 1.
2. Add PostgreSQL schema in `migrations/2026-07-04-wisdo-phase-1.sql`. Complete for Phase 1.
3. Use `WISDO_PERSISTENCE_MODE=postgres` and `DATABASE_URL` to switch the new repositories/adapters to PostgreSQL key/value persistence.
4. Backfill normalized tables from JSON/key-value state in the next pass.
5. Remove JSON as primary storage only after command delivery and license delivery have passed production soak.

## Safety Notes

- MT4 command delivery must remain idempotent. `commandId` is the stable key.
- Copy ticket maps must preserve leader-ticket to follower-ticket mapping by follower account.
- Bot access should be license-driven, not inferred from orders alone.
- Dangerous MT4 actions should remain validation-gated before command queue insertion.
- Admin audit events should be append-only in DB even if JSON records are edited or replayed.
