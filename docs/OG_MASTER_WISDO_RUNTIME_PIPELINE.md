# OG MASTER WISDO runtime asset pipeline

The OG MASTER WISDO visual path is intentionally data-driven and asset-gated:

```text
Blender source (.blend)
  -> WISDO Blender Bridge job
  -> validated GLB + validation report
  -> generated-asset-registry.js / npcs["og-master-wisdo"]
  -> npc-runtime-registry.js
  -> world-npc-visual-runtime.js
  -> active production Three.js scene
```

## Current behavior

`OG_MASTER_WISDO` owns the stable runtime asset ID `og-master-wisdo` and the Central/Academy anchor `[-42, 0, -49]`. Mission and dialogue logic do not require a visual asset.

The World only creates an OG MASTER visual descriptor when `GENERATED_WORLD_ASSETS.npcs["og-master-wisdo"]` contains a registered GLB URL. If the generated catalog entry is absent, the NPC visual runtime reports `PENDING_ASSET`, does not import a GLTF loader, does not request a model, and does not add a fake placeholder character.

A generated NPC load failure is isolated from the production World. The player, city, authored Operator fallback, authentication, and trading systems continue independently.

## Canonical Blender job

Use `tools/blender/jobs/og-master-wisdo.template.json` after the real source exists at:

`assets-source/characters/npcs/og-master-wisdo/og_master_wisdo.blend`

The Blender Bridge must produce and validate both:

- `public/world-assets/characters/npcs/og-master-wisdo/og_master_wisdo.glb`
- `public/world-assets/characters/npcs/og-master-wisdo/og_master_wisdo.report.json`

Only then may `registerTarget: "npc"` write the generated metadata into the NPC catalog.

## Runtime authority boundary

The NPC visual layer is presentation-only. It can load validated art, play authored animation clips, observe player position, and publish NPC proximity diagnostics. It cannot place, modify, or close trades, and world position never grants financial or account authority.

A later interaction merge may consume `wisdo:npc-proximity` to open OG MASTER dialogue/mission UI. That interaction must remain independent from trading command authorization.
