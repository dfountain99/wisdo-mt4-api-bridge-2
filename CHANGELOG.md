# Changelog

## 2026-08-10 - v7.1.0 Live Desk

- Added real browser-native WebRTC screen broadcasting inside the authenticated WISDO member portal.
- Added Private My Devices, Private Room, Selected Members, Members Only, Public, and Unlisted visibility policies.
- Added mobile/desktop viewer experience with fullscreen, Picture-in-Picture, return-live, mute, WebRTC quality telemetry, account overlays, and session chat.
- Added owner viewer controls, remove/block, Panic Stop, logout termination, bounded viewer/signaling/chat state, and Live Desk audit metadata.
- Added STUN defaults and optional short-lived TURN credentials without exposing the TURN shared secret to browsers.
- Added sanitized live account telemetry without exposing broker credentials or bypassing WISDO account authorization.
- Added production configuration examples and a bounded peer-to-peer capacity model; high-scale broadcasting remains reserved for a future SFU/media tier.
- Kept voice execution in `DEMO_ONLY` and Square in sandbox.
- Added dedicated Live Desk privacy/signaling/networking regression coverage.

## 2026-08-09 - Major stability and ecosystem upgrade (unreleased)

- Established and audited one root production entrypoint, API server, and 100-command registry.
- Added strict multi-account selection, canonical command envelopes, symbol/copier safety, bot lane controls, desk reconciliation, interaction lifecycle telemetry, and presence rules.
- Moved MT4 signal derivation out of the authoritative snapshot ACK path and added bounded post-snapshot work.
- Removed fake checkout success and arbitrary production user fallbacks; added signed Square webhook replay protection and integer-cent affiliate fields.
- Added additive PostgreSQL migration, health/readiness, shutdown cleanup, audit/pressure scripts, tests, and release documentation.

### Manual stabilization after interrupted Codex run

- Fixed stale Reporter health classification, payout-cent compatibility, review persistence, Copy Hub admin mutations, and Telegram review webhook verification.
- Hardened effective Discord OAuth/session routing and OWNER/WISDO system-health authorization.
- Enforced amount-verified Square license delivery and paid-only/idempotent affiliate commission creation; unfinished recurring payment flows now fail closed.
- Required a strong dedicated production `SESSION_SECRET` and strengthened stable MT4 UUID migration backfill/non-null guarantees.
- Final local regression evidence: 261 tests passing, 100-command registry audit passing, zero review-required production stubs.
