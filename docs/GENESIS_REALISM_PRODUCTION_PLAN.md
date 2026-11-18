# WISDO Genesis — 3D asset acquisition & production roadmap

**Scope:** realistic, playable, multiplayer survival environments for the existing Babylon.js browser game. Preserve the existing server-authoritative inventory, crafting, islands, persistence, mining, construction, creatures, and player movement. This is an asset and gameplay-quality program, **not a graphics-slider change**.

**Reality check (Nov 2026):** PR #203 introduced an optional high-fidelity loader but did not ship replacement forest/player meshes. PR #204 (draft) repairs the asset route, supports grass/mountainside keys, and includes a committed CC0 `grass_medium_01.glb` starter grass-card prototype. This is one actual game-ready asset, **not** a photorealistic scene or the original Blender grass geometry. Remaining tree/character assets are still stylized. No `mountainside.glb` is installed. Do not declare a phase complete from passing code-only CI; require mobile screenshots, video, and FPS/controls checks.

## Nonnegotiable production policy

- **Canonical interchange:** glTF 2.0 binary `.glb`; PBR base color, metalness, roughness and tangent-space normal where available. Prefer self-contained or explicitly self-hosted textures, no hotlinking to third-party hosts.
- **Rights:** CC0 first for binaries checked into this public repository. Record exact asset URL, author, license, version, date, modifications, and whether shipping original files is allowed. Keep restricted/free-but-not-redistributable files out of the public repository. Mixamo character/animation content has usage restrictions; review Adobe's terms before packaging.
- **Art budget:** mobile variant, desktop variant, and LODs. Proposed *starting* limits below need actual profiling, not blanket guarantees. Texture sizes and triangles are targets, not promises of fidelity.
- **World rules:** server authoritatively validates resources, mining, damage, crafting, ownership, speed, transforms, collisions, and vehicles. Visual assets never confer gameplay powers or authorize client-side state changes.
- **No placeholders as completion:** every milestone must display its actual 3D art on iPhone and desktop and demonstrate the relevant animation/collision.
- **Maintain a fallback:** missing or corrupt optional assets do not prevent sign-in, loading saved characters, or playing the current world.

## Acquisition register — source families

| Category | Preferred free source | Licensing caution | Acquisition specification |
| --- | --- | --- | --- |
| PBR terrain, soil, mud, snow, bark, cliff, ore, rocks | [Poly Haven](https://polyhaven.com), [ambientCG](https://ambientcg.com) | CC0; preserve URL and provenance | Base color + normal + roughness + optional AO, 1K mobile/2K desktop |
| Trees and grass | Poly Haven realistic scans | CC0; scan may need decimation and two-sided alpha cards | 3 tree species + bush/ferns/ground grass, LOD0/1/2 and distant impostors |
| Human models | CC0 only until a suitable production license is reviewed; optional Fab for licensed commercial game models | Some 'free' assets prohibit raw public redistribution | Rigged skinned humanoid (adult-safe customization), separate armor slots, base and target skeleton |
| Human locomotion | [Mixamo](https://www.mixamo.com) plus custom keyframes | Read Adobe license; avoid distributing unmodified source files separately | Idle, walk, run, sprint, jump, crouch, climb, swim, mine, hit, dodge, use tool |
| Wildlife/creature scans | CC0 scanned animal models or independently modeled originals | Check per-model rights | Reference anatomy and quality; build original hybrid morphology and rig |
| Structures/vehicles/technology | Original Blender procedural/modeling pipeline; CC0 materials from Poly Haven/ambientCG | Avoid trademarked or restricted meshes | Modular UVs, part hierarchy, break/repair states, snap points, damaged material variants |

## Production phases & acceptance gates

### Phase 0 — Asset pipeline, inventory, and proof of reality
**Already underway.** Keep draft PR #204 as the workbench. Resolve production asset serving and malformed GLB fallbacks; track source and licensing; record verified loaded models in HUD; add real GLB structure test; keep build checks green.

**Current starter asset:** `public/assets/genesis/reality/grass_medium_01.glb` (CC0 texture-based, alpha-cutout grass card prototype, 16,984 bytes at initial import). Browser loader should report it independently from tree/character fallback readiness. Actual frame-level Safari testing remains **not done**.

**Exit gate:** downloadable self-hosted GLB returns 200, Babylon parses and instances it in the streamed forest, visual confirmation on iPhone, FPS comparison with/without grass, no broken saves or controls.

### Phase 1 — Forest: the first true visual benchmark
**P0 in sequence:** grass card QA → scanned fallen log/rock → 3 realistic species of trees → bush/fern → photogrammetric cliff or rocks → layered ground PBR materials → daylight/weather/fog/shadow tuning → water edge.

**Asset IDs:** `grass_medium_01` (present), `tree1`, `tree2`, `tree3`, `bush`, `mountainside` (missing). Existing 3 tree keys / bush / explorer can be individually replaced via `/assets/genesis/reality/<key>.glb`. Validate new tree and grass dimensions; align roots at ground Y=0 and preserve scale. **Do not auto-place mountainside until measured footprint and physics collision are safe.**

**Proposed budgets:** starter grass ≤24K source vertices, ≤8–12 visible clumps/chunk on mobile; up to 24 trees per mobile cinematic chunk; prefer textures ≤1K per unique nearby vegetation material. Move distant vegetation to LOD/impostors, profile actual draw calls and battery heat. A continuously playable **30 FPS target** on a representative supported iPhone, measured in the forest after camera movement and chunk changes. Maintain responsive right-look and left movement.

**Exit gate:** iPhone and desktop reference footage shows no cartoon default tree where new scans are available; no camera clipping in trees/cliffs; saved structures/resource locations unchanged; multiplayer join/leave still works.

### Phase 2 — Realistic player and equipment
Acquire a suitably licensed, fully rigged humanoid; optimize for Safari and verify GLB armature/skin weights. Retarget character animation clips to existing runtime keys `Idle`, `Walking_A`, `Running_A`; add jumping/crouching/mining/combat/tool animation state after baseline works. Implement equipment slots and body customization without changing server-derived speed or abilities.

**Exit gate:** player and a remote player display an animated mesh, facing and foot-ground contact are correct, tools attach to named bones, and touch controls still respond at the target FPS.

### Phase 3 — Wildlife and original hybrid creatures
Prototype **three distinct biome-matched original creatures**, each with body proportions, skeleton, idle/walk/run/attack/death clips, basic movement and physics proxies. Build a shared runtime asset registry mapping creature ID, rig, mesh, skin, LOD, and animation states. Keep server-authoritative scan, tame, bond, power cooldowns and rewards; visual effects must follow confirmed state.

**Exit gate:** creature animation and collision validated; taming and morph remain durable across reload; additional creatures can be registered without editing a giant render switch.

### Phase 4 — PRISM form evolution and customization
Develop original high-detail PRISM core body, eyes, wing variants, horns, tails, armor, material swaps and resonance effects. Preserve existing evolution rules; make attachment points and skin morphs data-driven with distinct meshes and skeleton mappings. PRISM companion follows the player reliably; transitions cannot corrupt saved ownership or powers.

**Exit gate:** three original hybrid forms, saved customization restored after relogin, playable movement and power VFX on iPhone, PRISM does not obscure camera or touch controls.

### Phase 5 — Construction and settlements
Create consistent modular kits for wood, stone, and metal (foundation, 3m wall, ceiling, doors, staircase, roof) using existing snap placement contract. Introduce workbench, forge, storage, defenses, power socket, visual build preview, repair/damage variants. Validate collision against character/vehicle navigation; inventory remains server authoritative.

**Exit gate:** a reproducible two-story shelter can be built, edited and revisited after logout; snapping and dismantling pass regression tests, no structure duplicates across multiplayer sessions.

### Phase 6 — Inter-island vehicles and recovery projects
On each island place a **server-defined** ruined travel frame: starter boat/aircraft/land rover appropriate to geography. Craft parts (hull, propeller, steering, fuel/power, seats) and assemble to a driveable/swimmable prototype before attempting flight. Implement ownership, network prediction/reconciliation, authorized seat use, save persistence, shoreline loading/collision and fail-safe disconnect behavior.

**Exit gate:** two players can travel together in a boat between supported islands without desync, duplication or inventory bypass. Then add aircraft and eventually spacecraft as separately gated features.

### Phase 7 — Advanced technology and deeper mining
Extend the resource/ore catalog through **server-approved** changes only: stone, iron, copper, titanium, silicon, crystal, obsidian, rare aether resources, deep strata, depth hazards and tool tiers. Create particle collectors, renewable power cells, generators, wiring, lasers, ore processing, navigation and world portals as fictional game technologies. Define exact recipe costs, build prerequisites, energy consumption, asset/animation loops and multiplayer permissions.

**Exit gate:** full gather → process → craft → power → interact gameplay loop for three real machines; no visual-only 'fake machine' counts as complete.

### Phase 8 — Production multiplayer, tools and world expansion
Progressively roll the validated forest art pipeline into marsh, tundra/aether, mountains, oceans, neon metropolis and crystal caves. Add content streaming, scene/texture cache, network LOD, robust save migrations and cross-platform performance test suite. Load test target concurrency separately from visual appearance. Release gates require same-build iPhone footage, desktop footage, frame-time logs, server authority test results, and a rollback mechanism.

## Per-asset acceptance template

Every asset entry requires: unique ID; source link; author; license and redistribution decision; source hash; working GLB path; Blender or conversion script; texture inventory; triangle/vertex count; bound dimensions and pivot; skeletal animations; collision/hitbox choice; LOD variants; browser console warnings; Safari FPS and memory measurement; before/after image; build SHA; reviewer sign-off.

**Initial directory pattern:**
```
public/assets/genesis/reality/
  grass_medium_01.glb        # starter imported
  tree1.glb                  # future scanned replacement
  tree2.glb
  tree3.glb
  bush.glb
  explorer.glb               # licensed rigged player
  mountainside.glb           # queued, not yet installed
```

**Implementation order / priority queue:**
1. Confirm current grass model loads and renders from GitHub branch; benchmark Safari.
2. Export the user-provided original Poly Haven `mountainside_4k.blend.zip` to a bounded GLB via Blender, check UVs/scale, and make its placement optional.
3. Acquire/convert high-detail CC0 trees and bushes; prove forest camera collision and performance before expanding foliage density.
4. Acquire a legally redistributable game-ready human rig, add animation remapping.
5. Prototype one original wildlife species and one PRISM morph with animation.
6. Build the modular shelter and drivable two-seat boat vertical slices; add technology after foundational gameplay is tested.

## Definition of done

**A phase is not done** because its code compiles, a static concept image looks realistic, or an asset is stored in Git. It is done only when a player can interact with the real geometry inside the browser game, the authoritative server rules hold, and mobile + desktop proof is reviewed. Never auto-merge an incomplete phase.
