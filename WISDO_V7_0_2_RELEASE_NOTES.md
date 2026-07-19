# WISDO v7.0.2 Release Notes

WISDO v7.0.2 is a server-pressure and transport hotfix on top of the full v7.0.1 unified remodel.

## Added

- Controlled Reporter API-key rotation through `MT4_SYNC_PREVIOUS_API_KEYS`.
- Stable signed-pairing authentication and coalesced recovery.
- Batch copier-command, signal, signal-grid, and legacy-close operations.
- Bounded prioritized background processing for copier and Discord presentation work.
- Automatic MT4 command-history compaction.
- HTTP compression, request IDs, event-loop monitoring, and slow-request telemetry.
- `/health/performance` runtime-pressure endpoint.
- Clean-install WebSocket handshake race guard.

## Changed

- MT4 idle polling and command-status reads no longer write to PostgreSQL.
- Large Reporter snapshots return before noncritical presentation work completes.
- Copier closes run ahead of opens, and copier opens run ahead of Discord presentation.
- Invalid Reporter credentials produce controlled authentication warnings instead of repeated server-error stacks.
- JSON request parsing defaults to 4 MB and preserves raw payloads only where webhook verification needs them.
- Runtime is pinned to Node 22.x.

## Retained

- Full unified remodel.
- 77 unique Discord commands.
- Hardened desk creation, diagnostics, archiving, and restoration.
- Authoritative `/mt4-sync` route.
- First-day and return-after-away WISDO greetings throughout the member app.

## Verified

- 106 JavaScript files passed the build audit.
- 96 of 96 tests passed.
- Public npm clean install passed.
