# WISDO v6.1.1 — Bounded Mutation Persistence Hotfix

## Root cause

The v6.1.0 `PATCH /api/v2/accounts/:id/desk-role` route reported `databaseFlush: deferred`, but the shared `mutate()` helper still awaited `save(state)` before sending the HTTP response. When PostgreSQL persistence slowed, the browser request could remain Pending and the Accounts page stayed in a saving/loading state.

## Fix

- Added `WISDO_MUTATION_SAVE_BUDGET_MS` with a default of 500 ms.
- All routes using the shared major-product `mutate()` helper now wait only for the configured persistence budget.
- If persistence exceeds that budget, the HTTP request is released while the existing save promise continues in the background.
- Immediate persistence errors still surface instead of being silently hidden.
- PostgreSQL remains authoritative.
- No JSON or laptop file persistence was restored.
- Redis remains optional.

## Validation

- 95 production JavaScript files checked.
- 14 required production assets checked.
- 70 automated tests passed.
- Added a source audit proving the old unbounded `await save(state)` pattern is absent from the shared mutation helper.
- Reporter v1.58 remains compatible.
