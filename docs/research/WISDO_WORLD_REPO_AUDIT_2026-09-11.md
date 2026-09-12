# WISDO World Repository Audit — 2026-09-11

## Purpose

This document is the implementation audit for WISDO World Core Experience V1. It describes what already exists in `dfountain99/wisdo-mt4-api-bridge-2`, what is authoritative, what is presentation-only, the major technical debt, and what must not be rebuilt unnecessarily.

The audit is based on the repository state after the merged Smart Home, Campaign Core, Signal Event, market skyline, production fidelity, authored Operator and mobile quality work.

## Product boundary

WISDO World is one interface over the same WISDO platform. The 3D client is not a second trading backend and must never become the source of financial truth.

Authoritative flow:

`MT4 / Reporter / WISDO services -> server authorization -> normalized World state -> 3D representation`

Never:

`Three.js -> direct broker credentials`

## Current runtime

| System | Current implementation | Status | Action |
|---|---|---|---|
| World route | `/app/world` | Production | Preserve; never fork into a second world route |
| Renderer | plain Three.js 0.185.1 | Production | Preserve |
| Central | `world3d-core.js` + `world3d-production.js` | Production | Continue fidelity/asset replacement |
| Smart Home | `home3d.js` | Production foundation | Keep as private player OS |
| Input | `input-manager.js` | Production | Preserve keyboard/touch/gamepad behavior |
| Camera | third-person shoulder camera with collision in Central | Production | Polish, do not rewrite blindly |
| Quality | `world-quality.js` capability policy + adaptive FPS | Production | Preserve mobile medium/high path |
| Operator | authored GLB loader + procedural fallback | Production foundation | Replace fallback visibly only when authored asset is confirmed |
| World Profile | server-backed user identity/home data | Production | Keep linked to existing WISDO auth |
| Reporter data | normalized authorized World data | Production | Never simulate |
| Account state | server-projected balances/equity/positions | Production | Never duplicate into game save |
| Signals | server-authoritative SignalEvent + SSE client | Production foundation | Continue one-event/many-representations model |
| Markets | one-symbol shared market state and billboard manager | Production foundation | Keep public/private separation |
| Campaign Core | normalized CampaignState + 3D renderer | Production foundation | Continue as WISDO differentiator |
| World Command | guarded existing Reporter command path | Production foundation | Server confirmation remains mandatory |
| Lite Mode | non-WebGL fallback | Production | Preserve |
| Fast Mode | conventional WISDO application | Production | Preserve as deliberate explicit exit, not automatic navigation |

## Confirmed navigation defect

`public/app/world/world-v2.js` previously called:

`window.location.assign(destination.route)`

inside normal Central destination interaction. This caused a player who was already inside WISDO World to be ejected into a conventional page whenever they entered a building.

Core Experience V1 replaces this rule with persistent World scenes:

- Smart Home
- WISDO Central
- Trading Tower
- Academy
- Vault
- Bot Arena
- Switch Lab
- Growth Chamber
- Strategy Lab
- Coach Center
- Culture Arena
- Marketplace
- VPS Forge
- Private Rooms
- War Room
- Signal Observatory

The URL remains `/app/world`; scene identity is represented by World state/history rather than conventional page navigation.

## Scene architecture

### Smart Home
Private instance. Real account context, Reporter state and personal systems.

### Central
Shared/public-style world hub. Market skyline, globe, destinations and future multiplayer presence.

### Destination interiors
Reusable interior runtime rather than separate websites. Each destination can expose physical terminals that call the same WISDO services as Fast Mode.

### Explicit World exits
Only deliberate actions should leave `/app/world`:

- Fast Mode
- login/logout when required
- secure billing/checkout
- external links
- unsupported legacy workflows when the user explicitly chooses conventional mode

## Existing data/event architecture worth preserving

- `world-event-bus.js`
- `world-signal-runtime.js`
- `world-data-runtime.js`
- World market state/adapter files under `public/app/world/markets/`
- `server/worldMarketService.js`
- `server/worldEventService.js`
- `server/worldDataAdapterService.js`
- Campaign/Command modules under `public/app/world/command/`
- existing server authorization and Reporter command queue

These are the spine for a game world that reacts to real WISDO state.

## Core Experience V1 game layer

Game progression must be separate from financial outcomes.

Safe game progress includes:

- exploration
- education
- discovering buildings
- connecting infrastructure
- learning Reporter health
- inspecting verified signals
- using simulation/replay
- completing World orientation missions
- community participation

Do not reward:

- trade volume
- oversized risk
- monetary profit
- chasing losses
- rapid-fire entries

This prevents the game layer from turning live financial activity into casino mechanics.

## Current highest-priority technical issues

1. Persistent in-world routing for every normal destination.
2. Verify authored Operator reliability on iPhone with visible diagnostics.
3. Continue authored asset replacement for Central and Smart Home.
4. Keep WebGL context count bounded across scene changes.
5. Prevent stale asynchronous Operator loads from mutating newer scenes.
6. Keep live financial data clearly stale/disconnected when service state is stale.
7. Add mission/game instrumentation without collecting account balances or trade details.
8. Maintain mobile performance budgets while adding interiors and ambience.

## Mobile rules

Touch input is not a proxy for weak GPU capability.

Modern capable phones should retain:

- authored Operator
- useful shadows
- environment depth
- medium/high material quality
- World geometry
- market information
- mission/game systems

Adaptive quality may reduce expensive presentation after sustained poor frame rate.

## Observability

PostHog is connected at the workspace level, but the current project had no ingested World events at audit time. The World telemetry adapter therefore behaves as optional instrumentation and maintains a small local runtime buffer when no analytics client is available.

Allowed World telemetry is intentionally narrow: scene, destination, mission step, quality, FPS, Operator renderer, online state and version. It must not send account number, balance, equity, lot size, ticket IDs, profit, positions or credentials.

## Definition of Core Experience V1

A member should be able to complete this loop without being thrown out of the World:

1. enter WISDO
2. load Operator
3. spawn at Smart Home
4. inspect real account context
5. inspect Trading Room
6. check Reporter Mesh
7. use Command/Campaign Core
8. exit through front door
9. walk through Central
10. enter Trading Tower
11. inspect live authorized market/signal state
12. visit Academy or another destination
13. return to Central
14. return home

The World is complete enough for expansion only when this loop is stable, visually coherent and mobile-usable.
