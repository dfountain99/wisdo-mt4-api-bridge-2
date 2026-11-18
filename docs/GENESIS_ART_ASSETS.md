# WISDO Genesis — Authored 3D art provenance

## Scope
Graphics V4 adds five embedded-texture binary glTF models in `public/assets/genesis/models/`.
They are stored in `.glb.b64` text transport format for GitHub contents compatibility; the
browser converts them back to GLB before loading them into the Babylon scene. They are
self-hosted by WISDO and don't need a third-party CDN at runtime.

| Local asset | Original art | Original author | License | Source used |
| --- | --- | --- | --- | --- |
| tree1.glb.b64 | CommonTree 1 | Quaternius | CC0 1.0 | [skyline-run tree1.glb](https://github.com/anshaneja5/skyline-run/blob/main/public/assets/models/tree1.glb) |
| tree2.glb.b64 | CommonTree 2 | Quaternius | CC0 1.0 | [skyline-run tree2.glb](https://github.com/anshaneja5/skyline-run/blob/main/public/assets/models/tree2.glb) |
| tree3.glb.b64 | CommonTree 4 | Quaternius | CC0 1.0 | [skyline-run tree3.glb](https://github.com/anshaneja5/skyline-run/blob/main/public/assets/models/tree3.glb) |
| bush.glb.b64 | Bush Common | Quaternius | CC0 1.0 | [skyline-run bush.glb](https://github.com/anshaneja5/skyline-run/blob/main/public/assets/models/bush.glb) |
| explorer.glb.b64 | Knight character (10 original animation clips) | Kay Lousberg / KayKit | CC0 1.0 | [jevfire knight.glb](https://github.com/kikoncuo/jevfire/blob/main/web/public/assets/knight.glb) |

### Primary artist sites and licenses
- [Quaternius Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html) — CC0.
- [KayKit Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) — CC0; see `LICENSE.txt` at the source.
- [skyline-run source credits](https://github.com/anshaneja5/skyline-run/blob/main/CREDITS.md).
- [jevfire source credits](https://github.com/kikoncuo/jevfire/blob/main/web/ASSETS.md).

### Runtime and limits
- Files include embedded geometry/materials/textures, avoiding runtime external calls.
- Terrain and decorative 3D assets are clients-only; saved inventories, construction
  validation, account state, world geometry and resource rewards are unchanged.
- 3D art uses an asynchronous loader and safe fallback to the existing geometry when
  import is unavailable.
- This upgrades authored character and vegetation models. It does **not** promise
  photorealistic full-production terrain or complete PRISM character animation;
  those need further asset art and performance validation.

## Optional forest scan integration (Nov 2026)

The Reality asset directory `public/assets/genesis/reality/` (served by `registerGenesisAssetRoutes`) also accepts:

| Optional GLB | Use | Runtime budget |
| --- | --- | --- |
| `grass_medium_01.glb` | Dense forest/marsh/aether ground cover, instanced in deterministic streamed chunks | ≤24,000 source mesh vertices; ≤8–12 instances/chunk on mobile |
| `mountainside.glb` | Rugged cliff model, **available to the library only**; not auto-placed until dimensions and collision are validated | ≤120,000 source mesh vertices |

Both source models came from user-provided 4K Poly Haven BLEND ZIPs (CC0):
- https://polyhaven.com/a/grass_medium_01
- https://polyhaven.com/a/mountainside

`grass_medium_01.glb` **is present on the draft PR #204 branch** as an optimized 16,984-byte alpha-masked grass-card prototype. It is not the original Blender grass mesh and its visuals still require on-device Safari QA. `mountainside.glb` **is not installed**; the original user-provided Blender ZIP is available for future export and optimization. All future originals must pass material alpha, texture compression, size/collision, triangle budgets, and on-device frame-time checks. See `docs/GENESIS_REALISM_PRODUCTION_PLAN.md`.

## New user-supplied 3D mesh — mossy rocky ground patch (Nov 2026)

An independently uploaded `model.glb` (original file 14,187,556 bytes) was analyzed:
- Blender glTF 2.0 exporter; one static mesh; 55,552 vertices; 89,442 triangles
- Three embedded 2K textures: diffuse, normal and metallic/roughness; no skeleton or animation
- ~1.78m × 0.40m × 1.89m bounding extents; multiple irregular mossy stone/ground clusters
- Optimized **locally**, using VTK quadric mesh simplification and 1K texture resizing: 22,282 vertices, 23,254 triangles, 4,172,676 bytes, ground base aligned to Y=0
- Prepared output filename: `mossy_rock_patch.glb`; *binary not yet committed to GitHub*
- Loader key `mossy_rock_patch` accepts up to 30,000 source vertices; in forest/marsh, scenery only, ≤2 instances/chunk mobile and ≤3 desktop
- **Provenance / redistribution license unverified**: the GLB contains no licensed-source metadata. Confirm the original source URL and rights before adding the binary to the public repository or merging this asset into production.

The code and tests may ship with an optional missing-asset fallback, but that does *not* make the unlicensed geometry available at runtime.
