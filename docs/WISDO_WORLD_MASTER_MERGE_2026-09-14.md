# WISDO World — production master merge source of truth

Date: 2026-09-14

## Rollback point

The master-merge branch was created from production `main` commit:

`2af672a099c680b3e52cd875aeaa2404d6c7e4d4` — Force WISDO memory guard at runtime.

No alternate World repository, route, account system, event bus, trading API, Reporter connection, inventory, or user identity was introduced.

## Production source map

- Repository: `dfountain99/wisdo-mt4-api-bridge-2`
- Production branch: `main`
- Runtime root: repository root
- Node runtime: Node 22
- Start path: `npm start` -> `scripts/runtimeMemoryBootstrap.js` -> existing WISDO runtime
- Web server: existing Express server and route registry
- World route: `/app/world`
- World HTML: `public/app/world/index.html`
- World shell/state/router: `public/app/world/world-v2.js`
- Production Central renderer: `world3d-production.js` + `world3d-production-core.js`
- Production city: `world-production-city.js`
- PBR library: `world-pbr-materials.js`
- Production market presentation: `production-fidelity-layer.js`
- Distinct interiors: `world-interior3d-v2.js`
- Smart Home: existing `home3d.js` and existing World/Home APIs
- Input: `input-manager.js`
- Adaptive quality: `world-quality.js`
- Identity/Operator: existing `operator-identity-runtime.js`, `authored-operator.js`, avatar capture/scan flow
- Shared event fabric: existing singleton `world-event-bus.js`
- Authorized World state: existing `/api/world/state` consumed by `world-data-runtime.js`
- Real-time signal transport: existing SSE `/api/world/events` in `world-signal-runtime.js`
- Market state: existing `/api/world/markets/active`
- Signal state: existing `/api/world/signals/*`
- Command: existing `/api/world/command/*` and `command/command-center-runtime.js`
- Campaign Core: existing World Command/Campaign Core modules
- Market billboards: existing `markets/market-billboard-manager-v2.js`
- Fast Mode: existing conventional `/member/*` UI, explicitly external from World when requested

## Master merge architecture

This merge extends the single existing World instead of creating a second application.

### Spatial context bridge

`world3d-master.js`, `world-interior3d-master.js`, and `home3d-master.js` wrap the existing renderers and publish a read-only reference to the active Three.js scene/camera/renderer. They do not replace the production city, Smart Home, interiors, identity, account services, or execution services. They make one active spatial context available to shared World systems and clear it on scene teardown.

### Master runtime

`world-master-runtime.js` composes the existing game loop, World Director, privacy-safe telemetry, and new presentation systems under the same `/app/world` route. It is an integration runtime, not a second World.

### Companion Dashboard / WISDO Link

`world-companion-dashboard.js` creates an owner-private world-space dashboard that follows the active Operator. It reads authorized `/api/world/state` once and reacts to the existing World event fabric. It supports Glance, Expanded, Focus, Orb, side placement, collision-aware fallback, signal response, and Streamer Mode. It contains no broker credential path and no direct trading execution.

### Blue-hour environment

`world-atmosphere-runtime.js` applies the requested restrained blue-hour/early-night art direction to outdoor Central only. Day, sunset, blue hour, night, dawn, and weather foundations are decorative and explicitly not linked to market direction or market sessions.

### Ambient city life and transport

`world-population-runtime.js` adds a quality-budgeted ambient NPC layer and autonomous WISDO shuttle in Central. Ambient citizens are explicitly tagged `AMBIENT_NPC`, are never counted as real Operators, and use deterministic purpose routes. This is a population foundation, not a claim of completed navmesh multiplayer AI.

### Audio

`world-audio-runtime.js` adds user-gesture-gated ambient audio, basic location-aware footstep materials, and an original WISDO signal cue. It does not execute trades or auto-play before a user gesture.

## Authority and privacy invariants

- Financial state remains server-authoritative.
- World visuals never become trading authority.
- The existing Command API remains the execution path.
- Destructive execution still uses existing scope, permission, proposal, hold-to-confirm, server revalidation, acknowledgement, and receipt architecture.
- NPC population is never represented as real online users.
- Streamer Mode hides private monetary/account context in the Companion Dashboard.
- Telemetry continues to exclude account numbers, balance, equity, lots, tickets, profit, and positions.
- Signal timers remain based on server timestamps/expiresAt from the existing signal runtime; late clients see remaining review time rather than a fresh local two-minute timer.
- Fast Mode remains explicitly available and is not the default result of entering a World building.

## Production gates

The full repository test suite remains authoritative. This merge also adds `wisdoWorldMasterMerge.test.js` and includes both the production-city and master-merge tests in the smoke command. Merge/deploy must not proceed on known failing gates.

## Intentionally not falsely claimed complete

The repository now has a stronger production foundation for a living WISDO universe, but this merge does not label unfinished future layers as done. Full real multiplayer replication, a production navmesh, full-body foot/hand IK, spatial voice, large-scale asset streaming, production-grade weather simulation, and vehicle driving remain future gates unless and until their server/client implementations and tests exist. The current merge does not fabricate those capabilities.
