# WISDO v7.0.7 Section-Persistence OOM Repair Audit

## Incident

Production continued to terminate near a 252–259 MB V8 heap with native frames ending in:

- `v8::ValueDeserializer::ReadValue`
- `node::worker::Message::Deserialize`

The crash repeatedly appeared around Reporter snapshot processing and process restarts.

## Root cause

The remaining production persistence adapter used `structuredClone()` to create complete working copies of WISDO namespaces. Node routes structured cloning through its V8 serialization/deserialization machinery. A Reporter heartbeat could therefore copy the complete ecosystem—including trading history, member product state, lanes, alerts, education, and other unrelated sections—before changing a small set of account fields.

Earlier queue and signal fixes reduced growth but did not remove this complete-namespace clone boundary.

## v7.0.7 repair

### Section-level copy-on-write

- Removed production `structuredClone()` calls.
- Added an iterative JSON-shaped clone that does not use Node worker-message serialization.
- Added top-level copy-on-write drafts.
- A mutation clones only a section when that section is actually accessed.
- Large untouched sections retain the same object reference.

### Dirty-section PostgreSQL persistence

- Replaced complete dirty snapshots with `dirtySections` and `deletedSections`.
- PostgreSQL serializes and upserts one changed section at a time.
- Reporter heartbeats use named section saves.
- A database refresh cannot overwrite hot state while dirty sections are pending.
- Failed section flushes are restored without replacing newer in-flight changes.

### Low-memory Reporter path

Every heartbeat persists only:

- `tradingAccounts`
- `accountTelemetry`
- `accountHealthState`
- `relayDiagnostics`

On Starter-size Render instances, the heartbeat does not serialize the full `trades`, `alerts`, `liveTradeEventKeys`, or leader-close ledger sections. Core copier open/close authority remains in the dedicated MT4/copy services.

### Background-work controls

- Rank processing is throttled before service/database work begins.
- Explicit recognition and milestone checks remain immediate.
- Discord desk-dashboard refresh is rate-limited before loading state.
- Post-snapshot enrichment remains single-worker and coalesced by account.
- Noncritical enrichment is skipped before heap exhaustion.

### Features retained

- Durable Culture Lanes and boot-time relay restoration
- Personalized website recognition
- Live selected-account balance/equity/floating P/L HUD
- 50%, 100%, 150%, and continuing 50% growth celebrations
- Reporter v1.59 polling lease and compact command transport
- Priority close, emergency, protection, and harvest authority

## Validation

- Build audit: 114 JavaScript files
- Automated tests: 124/124 passed
- Existing snapshot-churn pressure test: 1,000 cycles under 64 MB heap
- Section-persistence pressure test: 5,000 mutations against a 20,000-trade state under 64 MB heap
- Large trade section reference remained unchanged through all section mutations
- Final section-pressure heap used: 8.35 MB
- Final snapshot-pressure heap used: 7.27 MB
- No production source path invokes `structuredClone()`

## Production confirmation criteria

After deployment:

1. Startup reports version 7.0.7.
2. `/health/performance` heap should stabilize rather than climb every heartbeat.
3. Reporter syncs should not be followed by `ValueDeserializer` OOM frames.
4. Culture Lane startup restoration should continue to report successful rule restoration.
5. Existing 100-ticket snapshots should not replay 100 opens and 100 closes.
