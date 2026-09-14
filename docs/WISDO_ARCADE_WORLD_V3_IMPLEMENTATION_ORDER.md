# WISDO ARCADE WORLD V3 — Active Runtime Map and Implementation Order

This document is the file-by-file production map for the live WISDO World. It exists to prevent changes to dead, shadowed, or superseded files from being mistaken for deployed visual work.

## 1. Active runtime map

```text
/public/app/world/index.html
  |
  | import map: /app/world/world3d.js
  |          -> /app/world/world3d-production.js
  |
  +-> world-v2.js
  |     -> world-data-runtime.js
  |     -> world-scene-router.js
  |     -> world-game-runtime.js
  |     -> world-director.js
  |     -> world-telemetry.js
  |     -> imports /app/world/world3d.js
  |              -> world3d-production.js
  |                   -> world3d-production-core.js
  |                        -> world-production-city.js
  |                        -> world-pbr-materials.js
  |                   -> production-fidelity-layer.js
  |                        -> world-cinematic-layer.js
  |                        -> world-arcade-plaza.js
  |                        -> market-billboard-manager.js
  |                             -> market-billboard-manager-v2.js
  |                   -> authored-operator.js
  |                        -> authored-asset-manifest.js
  |
  +-> world-multiplayer-runtime.js
  +-> world-merged-runtime-v3.js
  +-> world-minimap-runtime.js
  +-> world-living-runtime.js
  +-> world-debug-runtime.js
```

### Server boundary

```text
server/apiServer.js
  -> kernelRouteRegistry.js
       -> worldRoutes.js                persistent World/profile/home state
       -> worldBuildRoutes.js           build/version proof
       -> worldRealtimeRoutes.js        ephemeral multiplayer presence/movement
       -> worldLivingIdentityRoutes.js  World events/avatar/living systems
       -> worldMarketRoutes.js          authorized market presentation data
       -> worldCommandRoutes.js         controlled command boundary
```

The visual renderer never receives MT4 execution services directly. Trading execution remains behind the existing command/authorization path.

## 2. Files changed by the cinematic Central pass

### `public/app/world/index.html`
**Role:** canonical live entrypoint.

**Production change:** every active World entry asset now uses the same `2026.09.14.cinematic-v1` cache identity. The active import map continues to redirect `world3d.js` to `world3d-production.js` and the billboard manager to V2.

### `public/app/world/world-build.js`
**Role:** canonical World build identity.

Exports:
- `WORLD_VERSION`
- `WORLD_BUILD_ID`
- `WORLD_RENDERER`
- `WORLD_CITY_ID`
- `WORLD_OPERATOR_ASSET`

### `server/worldBuildRoutes.js`
**Role:** production proof endpoint.

`GET /api/world/build` returns non-secret diagnostic data including build ID, renderer, city ID, operator asset, environment, and deployed commit when Render exposes it.

### `public/app/world/production-fidelity-layer.js`
**Role:** active visual installer inside the real Three.js scene.

It installs:
1. cinematic atmosphere/director,
2. Arcade Plaza vertical slice,
3. real market billboard manager.

If either optional visual layer fails, the base production city continues running.

### `public/app/world/world-cinematic-layer.js`
**Role:** global visual art direction.

Adds named scene objects including:
- `WISDOCinematicVisualDirector`
- `WISDOCinematicNightSky`
- `WISDOCinematicCentralCrown`
- `WISDOCinematicTradingSpine`
- `WISDOCinematicDistrictBeacons`
- `WISDOCinematicFallbackOperator`

It changes atmosphere, wet-road treatment, route lighting, landmark crowns, holographic signs, drones, and the emergency player silhouette without owning game physics or financial state.

### `public/app/world/world-arcade-plaza.js`
**Role:** first visible WISDO Central lifestyle/social vertical slice.

Adds stable named scene objects:
- `WisdoBrew`
- `WisdoArcade`
- `WisdoGym`
- `WisdoChillPlaza`
- `WisdoCoachHologram`
- `WisdoLiveTradeHologram`
- `WisdoPalm-*`
- `WisdoNPC-*`

Adds DOM presentation:
- live-account financial HUD,
- activity ribbon: DRIVE / COFFEE / GYM / ARCADE / CHILL / EXPLORE,
- visible World build badge.

Financial values are read from `/api/world/state`. If no authorized account exists, the UI says `NO LIVE ACCOUNT`; it does not fabricate balances.

### `public/app/world/world-minimap-runtime.js`
**Role:** player navigation.

Now accepts `wisdo:set-waypoint` events so the activity ribbon sets real map targets and live distance rather than navigating away from the World.

### `public/app/world/world-debug-runtime.js`
**Role:** runtime truth.

Debug mode now displays:
- World version/build ID,
- deployed commit when available,
- renderer/city ID,
- cinematic status,
- Brew/Arcade/Gym/Coach scene presence,
- NPC/palm/drone counts,
- authored-vs-fallback Operator state,
- quality/device/render information,
- multiplayer state when available,
- visual execution boundary.

### `tests/worldCinematicContract.test.js`
**Role:** regression guard.

Fails if the production entrypoint stops targeting the active cinematic renderer, if hero scene contracts vanish, if fake balances are introduced, if the build endpoint disappears, or if visual code starts importing trading execution services.

## 3. What this pass is — and is not

This is a **real production-connected visual vertical slice**, not a static background and not a claim that the supplied concept art has already been matched one-for-one.

Visible improvements in this pass:
- nighttime cyber-luxury palette,
- wet reflective road veneers,
- cyan/gold city energy routes,
- luminous WISDO landmark crowns,
- physical district beacons,
- WISDO-branded world holograms,
- aerial motion,
- human-proportion emergency Operator,
- Brew/Arcade/Gym/Chill visual anchors,
- moving pedestrian population,
- palm silhouettes,
- embodied Coach hologram,
- real-account financial HUD,
- live-trade hologram fed by authorized World state,
- destination activity ribbon + physical waypoint,
- build/commit diagnostics.

Not yet final-quality:
- authored hero Central tower GLB,
- authored WISDO Operator V2 with full face/hair/clothing rig,
- authored palm/vehicle/NPC assets,
- Brew/Arcade/Gym walkable interiors,
- vehicle driving,
- full interaction registry integration for the new lifestyle businesses,
- production spatial audio,
- post-processing bloom/AO/reflection pipeline,
- crowd navigation mesh,
- full animation state machine,
- automated browser screenshot capture in CI.

## 4. V3 implementation order after this merge

### Priority 1 — WISDO Operator V2
Files:
- `public/app/world/authored-asset-manifest.js`
- `public/app/world/authored-operator.js`
- new controlled asset path/CDN entry.

Deliverable:
- WISDO-specific black street-tech Operator,
- W logo integrated into clothing material,
- idle/walk/run/strafe/turn/jump/interact/sit/wrist/talk clips,
- face/eye/blink support where asset permits,
- controlled WISDO-hosted asset rather than third-party CDN as primary.

### Priority 2 — Central Tower hero asset
Files:
- new `assets/world/central/` manifest and GLB,
- `world-production-city.js` or a dedicated active city asset installer.

Deliverable:
- authored facade,
- ARCADE WORLD display,
- lobby entrance,
- physical billboard frame,
- LODs,
- strong skyline silhouette.

### Priority 3 — lifestyle interiors
Files:
- `world-interior3d-v2.js`
- scene-router/location registry extensions.

Deliverable:
- WISDO Brew interior,
- Arcade interior + first playable activity,
- Gym interior,
- Chill social seating.

### Priority 4 — interaction unification
Create one active registry contract for every usable object:

```js
{
  id,
  type,
  displayName,
  interactionRadius,
  prompt,
  action,
  permissions,
  cooldown,
  route?,
  worldAction?,
  serverAction?
}
```

The nearest-object prompt should consume this registry instead of individual one-off interaction code.

### Priority 5 — animation and movement
Extend authored Operator controller into a real locomotion state machine with crossfades and foot-sliding safeguards.

### Priority 6 — vehicle vertical slice
One polished drivable WISDO vehicle first; do not add a fleet until collision, chase camera, mobile controls, enter/exit animation, and networking are correct.

### Priority 7 — rendering pipeline
High/medium quality:
- restrained bloom,
- AO/contact strategy,
- reflection probes or selective reflection technique,
- color grading.

Mobile low retains the same composition without expensive post effects.

### Priority 8 — production screenshot gate
Add a browser-capable CI job when the environment permits it:
- desktop 1440x900,
- mobile 390x844,
- canvas nonzero,
- loading screen cleared,
- cinematic diagnostics active,
- Operator active or explicit fallback,
- Brew/Arcade/Coach scene nodes present,
- screenshot artifact uploaded.

## 5. Visible deployment contract

Every future visual PR must report:

```text
SOURCE FILE CHANGED:
ACTIVE IMPORTER:
PRODUCTION ROUTE:
BUILD/DEPLOY COMMIT:
EXPECTED VISUAL:
DOM/SCENE PROOF:
LIVE TEST RESULT:
SCREENSHOT RESULT:
KNOWN DIFFERENCES:
NEXT VISUAL GAP:
```

`MERGED`, `DEPLOYED`, and `VISIBLE` are three separate states. A visual feature is not accepted until the live production World proves the active build and the object can be seen/used.
