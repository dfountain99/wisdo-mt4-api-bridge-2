# WISDO Genesis — Open World Expansion v2

## Why this change exists

The initial public survival alpha presented a tiny 82 m flat starter area with a handful of simple trees. That was a proof-of-mechanics, not the large exploration game designed for WISDO. This release expands the **actual game world**, rather than substituting concept imagery.

## What is implemented

- **3.2 km × 3.2 km contiguous, bounded world** (10.24 sq km) with seamless procedurally elevated terrain computed from a deterministic server/client contract.
- **Six distinct connected biomes** with unique terrain influences, color palettes, scattered landscape props and resource types: Genesis Forest, Neon Metropolis, Titan Wastes, Aether Skies, Crystal Grotto and Sunken Marsh.
- **Streamed 80m terrain chunks**: only nearby chunks are created; older chunks and their visual objects are discarded on travel. Mobile uses a lower terrain subdivision/decorative density than desktop, with GPU thin-instancing for terrain foliage/props.
- **Regional landmarks** including an overgrown temple, Great Cascade waterfall, Neon Spire, Caldera Fortress, Skyborne Palace, Underdeep cavern entrance and Drowned Vault, all rendered on entry into their surrounding area.
- **Six Waystones** that let a signed-in player fast-travel to distant regions from an existing Waystone. Destinations and proximity are validated on the backend: the browser cannot freely teleport via coordinate injection.
- **Interactive world atlas** with player coordinates, biomes and accessible Waystones. On iPhone, Field Kit defaults to a compact collapsed bar to prioritize exploration.
- **Biome resources** generated from reproducible chunk coordinates and awarded only after backend validation of proximity, inventory tools and replenishment cooldowns. Includes circuit, obsidian, aether shards and moonleaf.
- **Five additional original Echoforms** and distinct stat bonuses, discovery/bond costs, PRISM morph palettes and animation traits.
- **Expanded crafting and construction**: storm cell and sky alloy recipes, watchtower, neon lab, titan forge and sky dock blueprints.
- **V1 save compatibility**: existing user inventory, structures, PRISM customizations, morphs and XP are retained; new resources are introduced as zero quantities.
- **No alterations** to account controls, trading execution, Home Assistant privileges, alarm permissions or existing WISDO World endpoints.

## Open / test

1. Sign into the existing WISDO Cloud OS site.
2. Open `/app/genesis`; on mobile, the world map now appears in the header and Field Kit starts collapsed.
3. Tap **WORLD MAP**. At the Genesis Sanctuary arrival Waystone, select a remote region to travel; outside a Waystone, travel remains disabled until you approach an arch.
4. Explore with the joystick, watch terrain and decorations stream in, and approach new biome resource nodes to gather using real saved inventory.
5. Find the new Echoforms and try the new construction blueprints. Return through any Waystone.
6. Reload and confirm that previously saved huts, inventory and PRISM profile remain intact.

## Boundaries and next visual-quality work

This is a **stylized streamed open-world expansion**, not a fully art-directed ARK-scale AAA environment. The generated landmass, landmark geometry and foliage are runtime meshes. Next passes should add licensed author-created 3D asset packs (proper GLB LOD meshes and atlased materials), physically based landscape textures, collision/navigation physics, actual hollow caves with interior spaces, dynamic wildlife AI, wildlife population ecology, survival enemies, real flight mechanics, cooperative networking and terrain excavation.

Mobile rendering has no guaranteed frame-rate until tested on real devices. Large draw-distance settings, high-end effects or remote assets should not be enabled blindly. The game remains a private single-player survival alpha, with the position session still in memory across application restarts; permanent inventory and construction use the existing persisted game namespace.

## Acceptance gates

- Node 22 syntax validation for shared world generator, terrain client and server routes
- `node --test tests/genesisGame.test.js tests/genesisOpenWorld.test.js`
- `npm run check`
- Existing HoloMode and WISDO Launch Gates
- Render startup and database migration health
- Manual iPhone testing of chunk streaming, fast travel, resource visibility and build persistence

Do not imply that a CI pass proves visual quality or device-specific WebGL performance.
