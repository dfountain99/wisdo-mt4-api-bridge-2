# WISDO Blender Bridge V1

This bridge lets a coding ChatGPT that can write to the WISDO GitHub repository **request real Blender work** on a trusted machine that actually has Blender installed.

## Control plane

The queue is GitHub Issues. A job issue has a title beginning with `[BLENDER JOB]` and a body containing:

```html
<!-- WISDO_BLENDER_JOB:v1 -->
```

followed by one fenced JSON object. The local bridge agent polls those issues, claims one job, creates an isolated Git worktree from `origin/main`, runs the checked-in WISDO Blender pipeline, validates the GLB/report, commits the generated asset to a new `blender/job-*` branch, pushes it, opens a pull request, posts the result back to the issue, and closes the issue.

The issue **cannot provide arbitrary shell commands or Python scripts**. It only selects a fixed asset type, approved source, runtime output, LOD ratios, target height, and optional generated-asset registration target.

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

## Job example

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

## Security boundaries

- Jobs are limited to the checked-in `build_wisdo_asset.py` pipeline.
- Source URLs must be HTTPS and use an approved hostname.
- Repository sources are restricted to asset directories.
- Runtime outputs must stay under `public/world-assets/`.
- No job can provide a local absolute path, arbitrary command, arbitrary script or arbitrary Git destination.
- GitHub credentials stay on the local worker and are never committed.
- The worker builds in a disposable Git worktree and pushes a reviewable PR; it does not push generated Blender work directly to `main`.
- `playerV2` registration is a generated manifest override. Until a validated Blender output PR updates it, WISDO continues to use the existing authored fallback model.

## ChatGPT workflow

1. Create a `[BLENDER JOB]` GitHub issue with a validated JSON job.
2. The local agent performs the actual Blender work.
3. Inspect the generated PR and asset report.
4. Run CI.
5. Merge the asset PR.
6. Verify the deployed World loads the new GLB and does not fall back.
