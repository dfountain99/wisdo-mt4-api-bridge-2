# WISDO World Authored Asset Pipeline

WISDO World keeps the live Three.js/WebGL runtime and existing WISDO backend. High-visibility art is produced outside the runtime and delivered as optimized glTF/GLB assets.

## Runtime rule

The World engine owns movement, collision, account state, Reporter state, commands, market state and permissions. GLB assets own visual geometry, skeletons, materials and animation clips only.

Never place credentials, financial truth, account permissions or execution authority inside an asset.

## Operator pipeline

Production source workflow:

1. Create the base human in Blender using WISDO-approved first-party/CC0 inputs.
2. Keep one standardized WISDO humanoid skeleton for all Operators.
3. Fit head/body morphs to the standardized topology rather than generating a unique incompatible skeleton per member.
4. Fit clothing and accessories to the same rig.
5. Author/retarget locomotion clips.
6. Bake/pack PBR textures.
7. Export a single `.glb` with skinning and animation enabled.
8. Run asset validation.
9. Register the asset in `public/app/world/authored-asset-manifest.js` and `ASSET_LICENSES.md`.
10. The browser loads the GLB onto the existing `WisdoOperator` physics root. If loading fails, the procedural character remains the safety fallback.

### Required default clips

Preferred canonical clip names:

- `idle`
- `walk`
- `run`
- `sprint` (optional; run can be time-scaled initially)
- `walk_backward` (future)
- `strafe_left` (future)
- `strafe_right` (future)
- `jump` (future)
- `fall` (future)
- `land` (future)
- `turn_left` / `turn_right` (future)

The initial authored runtime accepts `idle`, `walk`, `run`, and optional `wave` and blends them according to the real World player's movement speed.

## Operator asset budget

Desktop/high target for the default Operator:

- Human scale: approximately 1.7–1.9 m before user height adjustment
- One primary humanoid skeleton
- Target 40k–90k visible triangles at LOD0
- LOD1 target 20k–45k
- LOD2 target 5k–15k
- Prefer 1k–2k PBR texture sets for browser production
- Avoid 8k textures in the web client
- Prefer KTX2/Basis texture compression once the asset is WISDO-owned
- Keep draw calls low through material consolidation

Mobile should select a lower LOD and lower-resolution texture package while preserving the same identity.

## Material contract

Use physically based materials:

- Base color
- Normal
- Roughness
- Metallic where physically appropriate
- Ambient occlusion where useful

Skin should not be represented as glossy plastic. Hair must use a browser-appropriate solution; do not ship massive strand-hair groom data directly to the web client without a measured LOD strategy.

## Smart Mirror / face-scan compatibility

Face capture produces approved Operator parameters, not a second authentication identity.

Preferred model:

`standard WISDO head mesh + approved morph values + skin/material configuration + user-selected hair/facial hair/body/outfit`

Raw scan images should remain temporary wherever practical. Do not expose raw landmark data to normal World clients.

## Environment pipeline

The same authored-asset strategy applies to Central and future districts.

Prioritize replacing procedural geometry in this order:

1. Default WISDO Operator
2. Trading Tower exterior/entrance/crown
3. WISDO Globe monument/base
4. Boulevard/plaza kit
5. Academy/Vault/Coach/Command façade modules
6. Street furniture and landscaping
7. Distant skyline modules
8. Smart Home interior kit
9. Command Center interior kit

Create reusable Blender modules rather than one giant city mesh:

- FacadeModule
- WindowModule
- EntranceModule
- ColumnModule
- RoofModule
- SignageModule
- ScreenModule
- StairModule
- RailModule
- PlanterModule
- StreetlightModule

## Coordinate and scale contract

- glTF +Y is up.
- Use real-world meters for authored assets.
- Keep building entrances and character scale believable.
- Set origins intentionally for placement/instancing.
- Avoid baking the full city at arbitrary scale.

## Export checklist

Before exporting GLB:

- Apply object scale/rotation where appropriate.
- Remove hidden high-poly source meshes.
- Remove unused materials/images.
- Keep UVs valid and texture references packed.
- Preserve skinning/armature.
- Export required animation clips.
- Confirm normals/tangents.
- Confirm model orientation.
- Confirm no proprietary or unlicensed source content remains.

## Licensing

Every third-party asset must have explicit commercial/redistribution rights and pinned provenance. Do not use extracted Rockstar/GTA content or assets from games.

The current transitional default Operator is documented in `public/app/world/ASSET_LICENSES.md`. It is CC0 MakeHuman/MPFB output pinned to a specific upstream commit and is intended to be replaced by a first-party WISDO-authored Operator.

## Long-term renderer architecture

The same WISDO services may eventually power both:

- Three.js browser/mobile-web client
- Unreal Engine native ultra-fidelity client

The backend, World Profile, Reporter Mesh, Campaign State, World Events, homes and permissions remain shared. Rendering clients are interchangeable views over one WISDO universe.
