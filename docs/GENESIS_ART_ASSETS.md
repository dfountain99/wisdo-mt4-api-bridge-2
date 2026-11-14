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
