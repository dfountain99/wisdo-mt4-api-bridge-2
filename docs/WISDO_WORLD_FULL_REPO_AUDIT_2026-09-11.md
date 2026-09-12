# WISDO World Full Repository Audit — 2026-09-11

## Executive finding

WISDO World is technically much farther along than its current visual presentation suggests. The product already has a real account/session backend, Reporter state, Smart Home runtime, Campaign Digital Twin, guarded command architecture, Signal Event Engine, market aggregation, world identity, mobile controls, adaptive quality, and a production Three.js renderer. The most damaging product defect discovered in this audit is not missing architecture: it is continuity. Central destination interaction currently ends with a conventional `window.location.assign(destination.route)`, which ejects the member from `/app/world` and makes the World feel like a lobby that links to webpages.

Core Experience V1 therefore adopts a new invariant:

> While World Mode is active, normal WISDO destinations remain inside the World shell. Only explicit Fast Mode, authentication, billing/checkout, downloads, or intentionally external actions may leave it.

## Current-state matrix

| System | Exists | Current condition | Core V1 action |
| --- | --- | --- | --- |
| `/app/world` production route | Yes | Live and stable | Preserve |
| Three.js renderer | Yes | Plain Three.js 0.185.1 | Preserve |
| Core movement physics | Yes | Fixed-step movement, acceleration/deceleration, gravity, sprint, jump | Preserve authority |
| Third-person camera | Yes | Shoulder camera, damping and collision | Polish later, do not rewrite |
| Mobile controls | Yes | Joystick/look/sprint/jump/interact | Preserve |
| Quality tiers | Yes | AUTO + adaptive policy | Preserve; fix probe lifecycle |
| Smart Home | Yes | Private scene with real WISDO data | Make it mission start/end hub |
| Central | Yes | Playable public district | Keep compact; increase fidelity over time |
| World destinations | Yes | Buildings/interaction anchors | Stop ejecting to webpages |
| World modal system | Yes | Used for home stations/settings | Preserve |
| Reporter Mesh | Yes | Authorized real state | Never fabricate |
| Account selection | Yes | Existing account ownership rules | Preserve |
| Market skyline | Yes | One symbol → one market state | Preserve and expose inside Observatory |
| Signal Event Engine | Yes | Server-authoritative signal events | Reuse as World event fabric |
| Campaign Core | Yes | Real CampaignState digital twin | Reuse inside Command and later other rooms |
| World Command | Yes | Guarded Reporter command pipeline | Preserve confirmations and receipts |
| Authored Operator | Yes | GLB pipeline with procedural fallback | Keep improving; isolate async instances |
| Operator scan identity | Foundation | Profile/scan contracts exist | Continue after Core loop is proven |
| Mission/game loop | No | World feels lobby-like | Add non-financial mission layer |
| World Director | No unified layer | Features react independently | Add light orchestration layer |
| Multiplayer presence | Not Core V1 | Future | Defer until single-player loop is complete |
| PostHog runtime telemetry | Connector available, SDK not guaranteed in page | No safe World adapter | Add no-secret, allowlisted adapter only |

## Confirmed continuity defect

`public/app/world/world-v2.js` already has a correct scene architecture for Home and Central. `switchScene()` destroys the current renderer and mounts another renderer inside the same page. Home's front door can return to Central without leaving the route. However, Central destination entry records `/api/world/visit` and then calls `window.location.assign(destination.route)`.

This creates four problems:

1. It destroys immersion immediately.
2. It throws away the live 3D scene and camera context.
3. It fragments one product into 'World' and 'real app' experiences.
4. It makes every future building behave like a decorative link.

Core V1 fixes this at the browser interaction boundary with a capture-phase World destination router. Keyboard `E`, mobile `USE`, and ordinary in-World links resolve to immersive interiors/overlays. Existing Fast Mode and intentionally external actions remain conventional navigation.

## Data authority map

The World must continue to obey this hierarchy:

```
MT4 / Reporter / Account Services
              ↓
       WISDO Backend
              ↓
  normalized authorized APIs
              ↓
World data/event adapters
              ↓
  World presentation state
              ↓
Three.js / DOM immersive UI
```

Never reverse this flow. A Three.js object never becomes broker authority. A mission cannot manufacture a trade. A game reward cannot modify risk. A Signal Burst never proves anything unless the backend event exists.

## Core V1 continuity policy

### Must remain in World

- Trading Tower / Signal Observatory
- Academy
- Vault
- Bot Arena
- Switch Lab
- Growth Chamber
- Strategy Lab
- Coach Center
- Culture Arena
- Marketplace browsing
- VPS Forge
- Private Rooms
- War Room shell
- Campaign Command
- account inspection
- Reporter inspection
- World map / progress / identity

### May intentionally leave World

- explicit **Fast Mode**
- login/logout
- secure checkout/payment
- browser downloads
- legal/privacy documents when necessary
- unsupported legacy tools explicitly opened by the member

## Game-layer boundaries

WISDO can be a game without turning trading into gambling mechanics.

Core V1 game state may persist:

- mission IDs
- completed steps
- discoveries
- World XP
- cosmetic unlock state
- tutorials completed
- non-financial achievements

Core V1 game state must not persist copies of:

- account numbers
- balances/equity
- lot sizes
- tickets
- open-position details
- broker credentials
- trade execution state

Those remain service-owned data.

## Core 15-minute experience

The first shippable loop is:

1. Enter WISDO World.
2. Spawn in Smart Home.
3. Inspect the real Trading Room.
4. Check Reporter Mesh.
5. Open Campaign Command.
6. Exit to Central.
7. Walk through the district.
8. Enter Trading Tower without leaving `/app/world`.
9. See the real Signal Observatory / active market state or an honest standby state.
10. If a real bot signal occurs, let the World react; never fake one to complete a mission.
11. Return to Smart Home.

The loop must remain valuable even when the account has zero open positions and no signal fires.

## Core V1 new runtime modules

- `world-destination-router.js` — keeps ordinary WISDO destinations inside World and provides immersive interiors.
- `world-game-runtime.js` — non-financial missions and persistent World progression.
- `world-director.js` — orchestration/announcements over real World events.
- `world-telemetry.js` — allowlisted privacy-safe telemetry adapter; no trading payloads.
- `world-core-game-runtime.js` — mounts the above without replacing `world-v2.js`.

## Mobile runtime defects included in this branch

Two issues identified by automated review after the prior mobile fidelity work are included in Core V1:

### WebGL capability probe lifecycle

The old capability probe created a temporary WebGL2 context every time it ran. On mobile browsers, repeated probes can contribute to WebGL context quota pressure. Core V1 caches the WebGL2 result per environment and asks `WEBGL_lose_context` to release the temporary probe context immediately.

### Stale authored Operator completion

The authored Operator loads in the background. If Central is destroyed while the GLB is still downloading, a late completion from the old scene could write/delete global Operator diagnostics belonging to a newer scene. Core V1 adds a render-instance ID and guards async completion/cleanup against the active instance.

## What should not be built yet

Until this loop is production-quality, defer:

- drivable cars
- giant map expansion
- hundreds of properties
- jobs/economy simulation
- full spatial voice
- complex weather
- large NPC simulation
- full VR/AR
- creator-generated districts

Those are later civilization systems. The present bottleneck is cohesion.

## Definition of done for Core Experience V1

Core V1 is done only when:

- ordinary destination entry no longer ejects a World-mode member;
- Smart Home → Central → Trading Tower → Home can be completed in one `/app/world` session;
- the first mission can complete without executing a trade;
- no signal is fabricated for game progression;
- real signal events can enrich the experience when they occur;
- Fast Mode remains an explicit escape hatch;
- iPhone quality and Operator-loading diagnostics remain intact;
- all existing launch gates pass;
- Command still requires server authorization/confirmation;
- the branch passes review before merge.
