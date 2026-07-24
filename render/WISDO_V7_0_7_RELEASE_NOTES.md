# WISDO v7.0.7 Release Notes

WISDO v7.0.7 replaces full-ecosystem persistence cloning with section-level copy-on-write and dirty-section PostgreSQL writes.

## Fixed

- Native V8 `ValueDeserializer` OOM during full namespace cloning
- Complete ecosystem serialization during Reporter heartbeats
- Database refresh overwriting hot unflushed section changes
- Unnecessary full trade-ledger persistence in low-memory relay mode
- Rank processing beginning before heartbeat throttling
- Discord dashboard state reads occurring before update-rate checks

## Added

- Named section persistence APIs
- Dirty-section runtime diagnostics
- Low-memory Reporter core-section mode
- v7.0.7 20,000-trade section-persistence pressure test
- Render Starter memory defaults and controlled V8 heap headroom

## Preserved

- Crash-safe Culture Lanes
- Relay restoration after redeploy
- Website identity and live floating-P/L recognition
- Every-50%-growth milestone celebrations
- Compact MT4 polling and Reporter v1.59 lease
- Priority follower close authority
