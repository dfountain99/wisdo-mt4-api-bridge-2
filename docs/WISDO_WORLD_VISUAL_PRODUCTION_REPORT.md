# WISDO World Visual Production Report

**Target:** move `/app/world` from a technically functional alpha into the cinematic financial-city language shown in the September 14 visual references, while preserving the existing WISDO Core, MT4 command boundary, account state, multiplayer contract, and mobile controls.

## Executive decision

The current problem is not lack of backend capability. WISDO already has a working production-connected World shell, account context, market billboards, player movement, multiplayer Central presence, scene routing, and an authored-operator loader. The visual gap is caused by presentation defaults: bright daytime lighting, box-first architecture, low-contrast materials, sparse scene life, and an emergency low-poly Operator fallback.

The correct approach is **layered visual production**, not replacing the working World game loop. The renderer remains authoritative for movement/collision while a Cinematic Visual Director adds atmosphere, lighting, surface treatment, district identity, neon routes, holographic messaging, ambient population, and a higher-quality fallback Operator. This keeps visual iteration isolated from trading execution.

## Reference language to reproduce

The supplied references establish seven visual pillars:

1. **One ecosystem, two modes.** A conventional trading dashboard and the 3D World must feel like the same product, not two separate brands. Cyan/blue market data, black glass, gold achievement/status accents, WISDO marks, and matching account state should cross both modes.
2. **Cinematic WISDO Central.** Central should read as a premium financial city at night: tall glass towers, cyan/gold edge lighting, luminous crowns, atmospheric depth, wet reflective streets, dense signage, elevated routes, and a strong central landmark.
3. **War Room.** Trading spaces need a command-center identity: central live market surface, wall analytics, risk/copy controls, account health, AI Coach, and campaign context arranged as a spatial room rather than ordinary HTML panels.
4. **Arcade World / social plaza.** Community, competition, challenges, mini-games, leaderboards, lounges, and owned systems should visibly occupy the city so multiplayer has a reason to exist beyond seeing another avatar.
5. **Human third-person Operator.** The player silhouette must stop reading like blocks. A successful authored GLB remains the preferred path, but the emergency fallback also needs human proportions, curved geometry, suit materials, and WISDO identity lighting.
6. **Data as architecture.** Real account state, market state, achievements, missions, copy status, and multiplayer presence should appear on physical billboards, towers, holograms, room walls, and floating companion surfaces.
7. **Mobile is a first-class render target.** The visual system must retain the same art direction on iPhone/Android even when geometry, dynamic lights, particles, crowd count, and shadows are reduced.

## Current production gaps

### Environment / lighting
- Existing production sky is a bright blue/orange daytime gradient.
- Hemisphere and directional lighting are tuned like an outdoor daytime demo rather than a neon city.
- Fog is pale gray-blue, which flattens depth and removes the black/blue/gold contrast from the references.
- Streets are physically rough and visually dry, so emissive architecture has little perceived response on the ground.

### Architecture
- Most destination buildings are single rectangular masses with regular window grids.
- Districts lack silhouette identity. Academy, Growth, Coach, Vault, Arena, and Marketplace do not yet read as different destinations at city scale.
- WISDO Central and Trading Tower have functional shapes but need luminous crowns, orbital elements, vertical light channels, district beacons, and richer foreground layering.

### Scene life
- Traffic exists, but there is little pedestrian/crowd life, holographic signage, aerial movement, environmental motion, or social activity.
- Multiplayer is technically present but the city does not yet visually celebrate another player arriving.

### Operator
- The authored GLB path is correct, but any failure falls back to a visibly block-based human.
- The fallback therefore becomes the first impression on slow/mobile/CORS-failed sessions.

### HUD
- Existing HUD is clean but subdued and reads like a debug/control overlay.
- The target calls for a premium glass cockpit with cyan/gold hierarchy, stronger edge light, darker translucency, clearer live-state status, and a more game-like mobile presentation.

## Implementation architecture

```text
Existing physics / renderer / multiplayer
                 │
                 ▼
      WISDO Production City Core
                 │
                 ▼
        Cinematic Visual Director
        ├─ night atmosphere
        ├─ skyline glow + stars
        ├─ wet street veneers
        ├─ neon road/route strips
        ├─ district beacons
        ├─ Central orbital crown
        ├─ Trading Tower light spine
        ├─ holographic WISDO signage
        ├─ ambient drones / crowd hints
        └─ cinematic fallback Operator
                 │
                 ▼
      Existing market billboard layer
                 │
                 ▼
       Existing authored GLB Operator
       (wins whenever it loads)
```

The order matters. The authored GLB still overrides the fallback. Real markets still come from the existing market manager. The visual layer never receives broker command services and never owns financial truth.

## Pass 1 — implemented with this report

This pass is intentionally asset-light so it can deploy immediately without waiting on a full Blender/Unreal-style art pipeline.

### Atmosphere
- Replace the bright daytime presentation with a deep navy/violet night gradient.
- Add star field and distant glow so towers separate from the horizon.
- Rebalance fog toward dark blue for cinematic depth.
- Lower exposure and use emissive accents as the dominant visual hierarchy.

### Streets and city energy
- Add clear-coated wet-road veneers over the production road meshes.
- Add cyan/gold route-edge strips to create the “energy network” seen in the references.
- Add district beacon rings/pillars so destinations are readable from far away.
- Add animated aerial drones and subtle rotating architectural elements.

### Central / landmark identity
- Add luminous orbital rings and a vertical light core around WISDO Central.
- Add a branded holographic landmark surface and district messaging.
- Emphasize Trading Tower with a cyan/gold vertical spine.

### Operator fallback
- Add a curved human-proportion procedural suit shell mounted to the existing physics root.
- Hide the box fallback while the cinematic fallback is active.
- Automatically allow the existing authored GLB to supersede it when the GLB loads.
- Animate the procedural limbs using actual root movement so the fallback walks instead of sliding.

### HUD
- Move Central HUD to a darker black-glass presentation with cyan/blue/gold edge hierarchy.
- Strengthen active-state readability and mobile controls without increasing interaction complexity.
- Add a visual build marker so production screenshots can immediately identify whether the cinematic pass is loaded.

## Pass 2 — authored asset production

Procedural geometry can establish art direction, but the concept references will not be reached by primitives alone. The next art-production milestone should add versioned authored assets:

- Central tower hero GLB with physically modeled facade, emissive trims, lobby, roof crown, and LODs.
- Trading Tower GLB with command atrium and billboard anchors.
- Arcade Plaza kit: kiosks, lounge, leaderboard, challenge terminals, mini-game portals, props, seating, planters, railings.
- War Room interior kit: central holo table, wall terminals, control consoles, chairs, ceiling light rings, server walls.
- Human Operator base body + WISDO suit + 4–6 animation clips + mobile LOD.
- Vehicle/drone set.
- Street kit: bollards, lamps, barriers, benches, planters, signs, decals, road furniture.

Preferred delivery format: **GLB + KTX2 textures + meshopt/Draco where appropriate**, versioned and served from object storage/CDN rather than the Node process.

## Pass 3 — rendering fidelity

Once authored assets exist, add a managed post-processing pipeline on high-capability devices:

- bloom for emissive signage and architectural trims,
- SSAO/GTAO or baked AO strategy,
- subtle color grading,
- reflection strategy (SSR where practical, probe/baked cubemaps otherwise),
- contact shadows for local hero scenes,
- optional depth-of-field only for scripted cinematic cameras,
- volumetric/fake volumetric light shafts at major landmarks.

These effects must be quality-gated. Mobile should preserve composition and emissive hierarchy rather than chase desktop effect count.

## Performance budgets

### Mobile low
- 30 FPS minimum target.
- Dynamic point lights: 0–2 visible hero lights.
- No expensive post-processing.
- Minimal drones/crowd props.
- 1x-ish DPR cap through existing quality policy.
- Authored assets must use aggressive LOD and compressed textures.

### Mobile/desktop medium
- 45–60 FPS target where hardware allows.
- Limited dynamic district lights.
- Moderate particles/drones/crowds.
- Higher anisotropy and shadow budget.

### Desktop high
- 60 FPS target.
- Full neon architecture, richer crowd/traffic, larger billboard count, hero lights, optional post-processing.

## Data and safety boundaries

The visual system may read:
- authorized World/account snapshots,
- market billboard data,
- mission/progression state,
- multiplayer presence,
- public World events.

The visual system must not:
- execute trades,
- own account authorization,
- persist financial truth,
- generate fake market candles and present them as live,
- bypass Reporter/command receipts,
- expose private Smart Home/account data to visitors without the existing authorization path.

## Production acceptance test

A build is visually moving toward the references when all of the following are true:

1. On first load, Central reads as a **nighttime premium financial city**, not a block demo.
2. WISDO Central is the strongest visual landmark at city scale.
3. The road network visibly carries cyan/gold energy and reflects nearby emissive light.
4. Academy/Growth/Coach/Vault/Marketplace/Culture areas can be identified from distance by unique beacon treatment and signage.
5. A failed authored-avatar load still produces a human-proportion Operator.
6. Two multiplayer users remain visible and movement synchronization is unchanged.
7. Market billboards remain driven by the real server API.
8. iPhone/mobile UI remains readable with no required desktop-only control.
9. The World keeps the hard execution boundary: visuals never call broker execution directly.

## Team ownership model

If WISDO were staffed by a full team, responsibilities should be divided as follows:

- **Creative Director:** guards the black/cyan/gold financial-city language and rejects inconsistent assets.
- **Environment Artist:** Central, skyline, streets, district silhouettes, props, vegetation, signage.
- **Lighting Artist:** night composition, landmark hierarchy, fog, emissive balance, interior/exterior transitions.
- **Technical Artist:** GLB/KTX2 pipeline, LOD, batching, instancing, shader/material budget, profiling.
- **Character Artist/Animator:** Operator body, WISDO suit, facial/head quality, walk/run/idle/interaction clips.
- **Gameplay Engineer:** movement, interaction, destination entry, multiplayer state, crowd/traffic behavior.
- **Rendering Engineer:** quality tiers, post-processing, frame pacing, mobile GPU safeguards.
- **Backend/Realtime Engineer:** presence, event fan-out, Redis gateway later; never broker execution from World.
- **Product/Data Engineer:** server-authoritative market/account/mission data mapped into World surfaces.
- **QA/Performance:** cross-device visual baselines, reconnect tests, memory/RSS, draw calls, mobile thermal tests.

## Definition of done for the reference vision

The supplied images should be treated as **art-direction targets, not literal screenshots of current production**. Reaching them requires both code and authored 3D assets. This pass changes the production renderer immediately so the live World moves toward that target; the report above defines the remaining asset and rendering work required to reach the full cinematic standard without destabilizing the trading platform.
