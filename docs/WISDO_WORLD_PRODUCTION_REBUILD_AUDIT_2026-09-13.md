# WISDO World — Production 3D Rebuild Forensic Audit

Date: 2026-09-13
Branch: `feat/wisdo-world-production-rebuild-20260913`
Target route: `/app/world`

## Executive finding

The deployed World is not missing a backend or a game loop. It already has a useful product shell: WISDO auth/session state, MT4/account data, World destinations, missions, account selection, live market state, touch controls, a fixed-step player controller, scene routing, and explicit in-World vs Fast Mode behavior. The visual problem is that the playable layer is generated primarily from primitive Three.js geometry and flat/near-flat procedural materials, then visually compensated with HUD-heavy holographic overlays. The correct fix is therefore to replace the Central 3D presentation/core while keeping the WISDO product and server authority intact.

## Existing stack

- Backend/runtime: Node 22 + Express 5, started by `node index.js` through `npm start`.
- Persistence/services: PostgreSQL/Redis-backed WISDO services and repository state; no separate game server is required for this visual milestone.
- 3D frontend: vanilla ES modules using Three.js `0.185.1` from jsDelivr. React Three Fiber is not used.
- `/app/world` is a real application route with a Three.js import map and separate World modules.
- Production deployment remains the existing Render service. Render builds with `npm ci --omit=dev --no-audit --no-fund`, runs the PostgreSQL migration pre-deploy, starts with `npm start`, and checks `/health`.

## Current route / product control

`public/app/world/world-v2.js` is the World coordinator. It owns:

- `/api/world/catalog`
- `/api/world/me`
- `/api/world/profile`
- `/api/world/visit`
- account selection through the World data runtime
- World/home/interior scene switching
- Reporter Mesh, account, performance, Coach and progress modals
- deliberate Fast Mode escape paths
- in-World interception of ordinary member routes

The current scene architecture already prevents ordinary destination entry from automatically ejecting the player to another website page. That behavior must be preserved.

## Current 3D renderer

`public/app/world/world3d-production.js` wraps the core renderer, captures the active scene/camera/renderer, installs adaptive quality, live World market presentation and the authored humanoid asset.

The old Central renderer is `public/app/world/world3d-core.js`. It provides useful game mechanics but visually builds the city from primitives:

- `BoxGeometry` building masses
- simple window strips
- low-detail palms/props
- large flat ground meshes
- a procedural skyline made from repeated boxes
- a procedural operator assembled from capsule/sphere primitives
- mostly color-only MeshStandard/Physical materials

The core player controller itself is valuable and should be preserved conceptually: fixed-step movement, acceleration/deceleration, gravity, coyote-time jump, ground raycasts, collider checks, camera-relative movement, sprint FOV and camera occlusion raycasts.

## Current fidelity layer

`public/app/world/production-fidelity-layer.js` was originally intended to improve presentation after the core scene was already built. It adds another ground layer, more street furniture, facade skins, tower skins, skyline geometry and another procedural character representation. This produces a layered prototype instead of a single authored production world.

For the production rebuild, the fidelity layer should stop trying to be a second city renderer. It should retain only WISDO-specific live systems such as authoritative market billboards.

## Current character architecture

There are two character paths:

1. Primitive/procedural fallback in the old Central renderer.
2. `authored-operator.js`, which loads a CC0 GLB humanoid through `GLTFLoader` and drives available idle/walk/run clips.

The authored asset path is the correct production direction. The fallback must be a recognizable humanoid instead of a capsule/sphere placeholder so a slow or failed GLB fetch still leaves a human character on screen.

## Current camera / input

`input-manager.js` already supports:

- desktop keyboard
- pointer lock mouse look
- mobile movement joystick
- mobile camera drag zone
- jump / sprint / interact buttons
- gamepad axes/buttons

The Central camera already performs follow damping, shoulder offset, pitch limits, sprint FOV changes and raycast obstruction checks. The rebuild should retain these mechanics while improving the environment that the camera moves through.

## Current lighting / materials problem

The old core renderer uses ACES tone mapping and soft shadows, but the scene remains dominated by dark material colors and blue-hour/cyber lighting. Many surfaces are color-only; they lack believable texture scale and micro-surface variation. The holographic CSS then darkens the stage further with heavy vignette/scanline overlays.

The production rebuild must shift responsibility from overlays to actual scene rendering: brighter golden-hour sunlight, readable ambient fill, texture-backed pavement/concrete/facades, believable glass/metal, softer atmospheric fog and visibly grounded contact shadows.

## Current HUD problem

`holo-ai-theme.js` and `holo-ai-theme.css` intentionally add a full-frame holographic canvas, corners, scan lines, tactical readouts and extra status layers. This reinforces the exact problem reported by the user: the World feels like a website/HUD with 3D beneath it.

The rebuild should preserve WISDO identity and data access but remove the holographic world frame from the default exploration view. Exploration should show only compact identity/status, minimap, mission/waypoint and contextual interaction prompts.

## Backend, auth and account systems to preserve

The rebuild must not alter WISDO server authority. Existing server code already provides signed-session auth through `getCurrentUser`, persistent ecosystem state through the WISDO repository, account/Reporter data, command safety and role/access logic. The 3D client remains presentation and interaction; it must not become a second source of truth for trading state.

## Live market systems to preserve

The current market billboard manager reads authoritative `/api/world/markets/active` and market candle endpoints and explicitly refuses to fabricate candles when real market series are unavailable. This should remain intact and be mounted into the new production city.

## Render deployment to preserve

Do not introduce a second Render service or change the repository root. Existing production contract remains:

- build: `npm ci --omit=dev --no-audit --no-fund`
- predeploy: `npm run migrate:postgres`
- start: `npm start`
- health: `/health`
- auto deploy enabled for the configured service

## Production rebuild implemented on this branch

The first playable visual milestone is being implemented as a clean Central renderer replacement rather than another skin:

- `world3d-production-core.js`: replacement Central game/renderer core
- `world-production-city.js`: city geometry, landmarks, roads, props, traffic, vegetation and lighting
- `world-pbr-materials.js`: reusable texture-backed PBR material library
- `production-fidelity-layer.js`: reduced to live WISDO market presentation instead of duplicate city geometry
- `production-world.css`: contextual/restrained HUD presentation
- `world-minimap-runtime.js`: minimap + mission waypoint presentation
- `index.html`: removes the HUD-first holographic world skin and loads the production presentation

## Milestone acceptance intent

Opening `/app/world` should now prioritize the actual playable environment: bright golden-hour city, WISDO Central HQ, Trading Tower skyline landmark, premium Smart Home exterior, Market District, roads/curbs/sidewalks/crosswalks/parking markings, streetlights, benches, bollards, vegetation, parked/moving vehicle architecture, PBR texture variation, humanoid player fallback plus authored GLB upgrade, smooth third-person camera, minimap/waypoint and mobile controls.

This milestone intentionally preserves existing WISDO routes, sessions, account logic, Reporter state, market data, command authorization and Render service configuration.
