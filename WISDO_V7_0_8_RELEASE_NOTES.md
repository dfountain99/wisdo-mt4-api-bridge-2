# WISDO v7.0.8 Release Notes

## Database-first trading core

- Added relational PostgreSQL account, pairing, tracking, history, command, audit, and signal tables.
- Added pre-deploy schema migration.
- Reporter heartbeat now performs narrow row reads and a single row-level transaction.
- Removed the full MT4 namespace from the live heartbeat path.
- Disabled buffered live JSON writes in the default Render blueprint.
- Preserved account-sharing, linking, and legacy copier-route metadata in a small compatibility namespace.

## Reliability

- Command rows use active dedupe indexes and expiry indexes.
- Signal rows use a unique account/ticket identity.
- History remains bounded per account and globally.
- Existing Culture Lane restoration and website recognition remain enabled.

## Verification

- 119 JavaScript files audited.
- 127 tests passed.
- 5,000 x 100-trade heartbeat pressure run passed under a 64 MB V8 heap.
- Final pressure-test V8 heap used: approximately 4.87 MB.
