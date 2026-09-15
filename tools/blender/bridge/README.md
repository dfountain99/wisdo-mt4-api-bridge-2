# WISDO Blender Bridge V1

This bridge lets a coding ChatGPT that can write to the WISDO GitHub repository **request real Blender work** on a trusted machine that actually has Blender installed.

## Control plane

The queue is GitHub Issues. A job issue has a title beginning with `[BLENDER JOB]` and a body containing:

```html
<!-- WISDO_BLENDER_JOB:v1 -->
```

followed by one fenced JSON object. The local bridge agent polls those issues, claims one job, creates an isolated Git worktree from `origin/main`, runs the checked-in WISDO Blender pipeline, validates the GLB/report, commits the generated asset to a new `blender/job-*` branch, pushes it, opens a pull request, posts the result back to the issue, and closes the issue.

The issue **cannot provide arbitrary shell commands or Python scripts**. It only selects a fixed asset type, approved source, runtime output, LOD ratios, target height, animation intent, and generated-asset registration target.

## First-time Windows bootstrap

Run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File tools/blender/bridge/install-windows.ps1
```

The bootstrap detects/installs Blender, Git, Node and GitHub CLI when possible, performs one-time GitHub authorization if needed, verifies the bridge once, and can register the agent as a user logon task.

## Run directly

```bash
node tools/blender/bridge/agent.mjs
```

One cycle only:

```bash
node tools/blender/bridge/agent.mjs --once
```

## Generalized runtime catalog

Validated Blender outputs can register into the grouped World asset catalog. Supported registration targets are:

- `playerV2` -> default generated player/operator
- `arcadeV2` -> default generated arcade
- `npc` -> `npcs[assetId]`
- `building` -> `buildings[assetId]`
- `prop` -> `props[assetId]`
- `vehicle` -> `vehicles[assetId]`
- `interior` -> `interiors[assetId]`
- `vegetation` -> `vegetation[assetId]`
- `worldObject` -> `worldObjects[assetId]`
- `none` -> build/validate the GLB without runtime registration

Legacy runtime access to `playerV2` and `arcadeV2` remains supported through aliases over the grouped catalog.

## Player job example

```json
{
  "assetId": "wisdo-player-v2",
  "name": "WISDO_PLAYER_V2",
  "assetType": "character",
  "source": {
    "url": "https://cdn.jsdelivr.net/gh/example/assets/player.glb"
  },
  "output": "public/world-assets/characters/player/wisdo_player_v2.glb",
  "report": "public/world-assets/characters/player/wisdo_player_v2.report.json",
  "registerTarget": "playerV2",
  "targetHeight": 1.82,
  "lodRatios": [1.0, 0.62, 0.36, 0.18],
  "license": "USER_PROVIDED",
  "sourceNote": "High-quality rigged WISDO Player V2 source."
}
```

## OG MASTER WISDO NPC job shape

Do not queue this until a real source `.blend`, `.glb`, `.gltf`, `.fbx`, or `.obj` exists at the declared source path.

```json
{
  "assetId": "og-master-wisdo",
  "name": "OG_MASTER_WISDO",
  "assetType": "character",
  "source": {
    "repoPath": "assets-source/characters/npcs/og-master-wisdo/og_master_wisdo.blend"
  },
  "output": "public/world-assets/characters/npcs/og-master-wisdo/og_master_wisdo.glb",
  "report": "public/world-assets/characters/npcs/og-master-wisdo/og_master_wisdo.report.json",
  "registerTarget": "npc",
  "targetHeight": 1.84,
  "lodRatios": [1.0, 0.62, 0.36, 0.18],
  "license": "USER_PROVIDED",
  "sourceNote": "Original OG MASTER WISDO founder/legendary mentor NPC created for WISDO World.",
  "clips": {
    "IDLE": ["IDLE"],
    "SEATED_IDLE": ["SEATED_IDLE"],
    "WALK_FORWARD": ["WALK_FORWARD"],
    "GREET": ["GREET"],
    "SPEAK": ["SPEAK"],
    "POINT": ["POINT"],
    "STAND": ["STAND"],
    "SIT": ["SIT"],
    "INTERACT": ["INTERACT"]
  }
}
```

## Security boundaries

- Jobs are limited to the checked-in `build_wisdo_asset.py` pipeline.
- Source URLs must be HTTPS and use an approved hostname.
- Repository sources are restricted to asset directories.
- Runtime outputs must stay under `public/world-assets/`.
- Every job must provide an explicit asset ID, output path and report path.
- No job can provide a local absolute path, arbitrary command, arbitrary script or arbitrary Git destination.
- GitHub credentials stay on the local worker and are never committed.
- The worker builds in a disposable Git worktree and pushes a reviewable PR; it does not push generated Blender work directly to `main`.
- Generated catalog registration never invents a model. Until a validated Blender output PR registers a real GLB, runtime lookup returns null and authored/fallback behavior remains in place.

## ChatGPT workflow

1. Create a `[BLENDER JOB]` GitHub issue with a validated JSON job.
2. The local agent performs the actual Blender work.
3. Inspect the generated PR and asset report.
4. Run CI.
5. Merge the asset PR.
6. Verify the deployed World loads the new GLB and does not fall back.
