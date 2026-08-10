# Migrations

The selected lineage is the existing ordered migration list in `scripts/migratePostgres.js`, followed by `migrations/2026-08-09-major-stability-ecosystem.sql`. The major-stability migration is additive: it adds account UUIDs/health, command lifecycle fields, interactions, desks, copier entities, bot lanes, presence, payment-event idempotency, affiliate ledger entries, and operational metrics.

`stable_account_id` is backfilled for legacy MT4 rows and made non-null before the new UUID foreign keys depend on it. Legacy text account keys remain in place for compatibility; this is not a destructive primary-key cutover.

Run against a disposable PostgreSQL clone first. Execute `npm run migrate:postgres` twice to prove the selected path is repeat-safe, inspect row counts/foreign keys/unique indexes, then take a production backup/checkpoint before any production migration. Do not concatenate unrelated historical SQL manually.

Real PostgreSQL execution of the final migration was not available in the manual-finish sandbox and remains a staging release gate. Rollback primarily restores the prior application while leaving additive schema in place; destructive down migrations are intentionally avoided unless separately reviewed with a verified backup.
