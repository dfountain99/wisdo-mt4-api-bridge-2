# WISDO Genesis — Living Worlds Alpha

## Scope: first playable vertical slice

This release adds a **new**, isolated, authenticated game route at `/app/genesis` without replacing the existing World, PRISM HoloMode, command center, or trading infrastructure.

Players can:

- Walk around an original Babylon.js 3D forest/cavern landscape with WASD/arrows, or touch joystick on a phone. Drag the world view to orbit the camera.
- Travel with a customized following PRISM; adjust name, palette, body frame, size, eyes, and companion following style.
- Spend eight initial stat points (and earn more from exploration) on Strength, Speed, Defense, Agility, Energy and Intelligence. Speed changes actual locomotion, with server-side movement validation.
- Harvest renewable wood and stone; craft a pickaxe and then mine iron and crystals.
- Craft planks and tools; build persistent huts, floors, walls, workbenches, campfires and a morph station using owned resources, with collision and placement rules.
- Scan and bond three original Echoforms (Voltfang, Terrakron and Shadeveil), then morph PRISM to acquire distinct visual traits and stat boosts.
- Experience deterministic dawn/day/dusk/night and weather cycles. Rain improves wood harvesting/regrowth; a Crystal Storm improves crystal yields.
- Reopen the game with inventory, construction, morphs, stats and cosmetics persisted to the signed-in user's private WISDO game record.

The game uses `services/genesisGameService.js` for server-authoritative inventory and action policy, `server/genesisRoutes.js` for session-guarded API endpoints, and `public/js/genesisWorld.js` for the visual client. No trading credentials or WISDO trading command path are used.

## Site navigation

- Workspace sidebar: **✦ NEW · WISDO Genesis**
- Dashboard / Command Center: highlighted **Enter Genesis Forest** announcement
- Existing WISDO World: **✦ NEW · PLAY GENESIS SURVIVAL** link
- PRISM HoloMode: **✦ Genesis World** link
- Direct authenticated URL: `/app/genesis`

## APIs

| Endpoint | Meaning |
|---|---|
| `GET /app/genesis` | Authenticated playable browser page |
| `GET /api/genesis/state` | User-owned game state, catalog and resource regeneration |
| `POST /api/genesis/move` | In-process server-validated player location, rate-bounded travel |
| `POST /api/genesis/action` | Server-validated gather/craft/build/scan/bond/equip/train/customize, persisted through existing WISDO PostgreSQL state adapter |

All POST actions must carry `X-Wisdo-Genesis: 1` and originate from the same browser origin as WISDO. User identity is derived from the existing signed session cookie, never from the request body. Resources, prices, ability boosts, placement and cooldowns are determined by the server. Game state lives under a separate `genesisProfilesByUserId` namespace.

## Limitations, stated plainly

- This is **private PvE Genesis Forest alpha**, not yet a simultaneous shared multiplayer world. Real-time player presence and invitations must use a separate dedicated multiplayer service with per-world permissions.
- World objects are harvestable, but the initial release does **not** modify voxel terrain geometry or provide arbitrary digging tunnels like Minecraft.
- The first building system is modular structures and prefabs, not unrestricted structural physics or fully freeform city construction.
- Echoforms are collectible morphs with discovery, bonding, anatomy variations and stat boosts; real-time combat, creature AI ecology populations, breeding, mounts, and skill trees are later projects.
- PRISM is a procedural model, not a commissioned rigged cinematic character. Player movement lacks collision against props, complex pathfinding, multiplayer reconciliation and combat physics.
- Position is server-validated in the active Node process but is **ephemeral across server restarts**. Durable inventory and structures persist; on restart users spawn at the arrival circle. Multiple simultaneously active app instances require a shared presence store before enabling public worlds.
- Babylon.js currently loads via its public CDN; offline play is not supported.
- Real bank/broker funds, trade balances, smart-home devices and alarms cannot be used or controlled from Genesis.
- The game is not yet a stable commercial game or a substitute for a dedicated game server.

## Manual acceptance tests

1. Sign into WISDO; open `/app/genesis`.
2. Confirm the scene renders and the player can move on iPhone using the joystick or desktop using WASD/arrows.
3. Approach a tree, gather wood, wait for cooldown and gather again.
4. Gather stone, craft a pickaxe; verify iron/crystal mining becomes available.
5. Build a hut using resource costs; reload browser and ensure it remains.
6. Customize PRISM colors/frame/name; reload and verify the same character data is restored.
7. Find and scan Voltfang, bond with iron/crystal, morph and verify Speed changes.
8. Confirm home alarm/security/trading services cannot be reached through Genesis routes.
9. Check Render logs, CPU/memory pressure, persistence health and existing MT4 poll endpoints.
10. Test game on at least one iPhone Safari version and one desktop Chromium browser.

## Shipping and next milestones

1. Validate `tests/genesisGame.test.js`, `npm run check`, security checks and existing WISDO Launch Gates. Observe Render during deploy.
2. Add true real-time cooperative sessions with owner/invite permissions and presence shared through a fast message bus.
3. Introduce chunked deformable terrain with server-regulated digging and resource volumes.
4. Expand to Neon Metropolis, Titan Wastes and Aether Skies with biome-specific Echoforms and weather systems.
5. Upgrade PRISM to rigged/LOD-ready models, proper animation blending, pathfinding, equipment meshes, skill trees, combat and performance budgets for mobile.
6. Build long-lived ecosystem simulation for populations, conservation, migrations, player settlements and regional events.

This release is a **working slice** toward the unified WISDO Genesis vision, not a claim to implement all of those future systems now.
