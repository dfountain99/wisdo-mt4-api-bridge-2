# WISDO Blender Production Conversion — Milestone 1

This milestone converts the existing WISDO World from a fallback-first visual stack into an asset-gated Blender production stack without replacing the server, authentication, Reporter/MT4 bridge, Arcade, Academy, Smart Home, missions, HUD, navigation, or command authority.

## First production slice

The first slice is deliberately small and testable:

- `wisdo-operator-v1` — a real humanoid GLB processed by the checked-in Blender pipeline and registered into `players.default`.
- `wisdo-central-v1` — a Blender-authored WISDO Central atrium registered into `interiors`.
- `wisdo-terminal-v1` — a Blender-authored interactive terminal registered into `props`.

The runtime remains fallback-safe until these GLBs are actually produced and merged. Empty registry entries never disable the existing procedural World.

## Trusted Blender recipes

The bridge now accepts a third source kind in addition to approved HTTPS assets and repository 3D files:

```json
{"source":{"recipe":"tools/blender/recipes/wisdo_central_v1.py"}}
```

Only Python files already committed under `tools/blender/recipes/` are permitted. Issue bodies cannot provide arbitrary Blender/Python code. The bridge runs the checked-in recipe headlessly, saves a temporary `.blend`, then sends that source through the same normalize, material, LOD, collision, validation, GLB export, report, registry, test and PR pipeline as every other asset.

## Runtime semantic nodes

Blender assets may expose stable semantics through object names. The runtime discovers the semantic marker even after the Blender pipeline adds a WISDO asset prefix.

- `INTERACT_*` — physical interaction anchors.
- `SCREEN_*` — surfaces reserved for live WISDO data/UI.
- `COLLIDER_*` / `UCX_*` — simplified collision proxies.
- `SPAWN_*` — authored spawn/reference anchors.
- `_LOD1`, `_LOD2`, ... — asset LOD variants.

The first Central recipe contains interaction anchors for Trading Tower, Market Arcade, Reporter Command, Smart Home, Vault and Intelligence, plus a `SCREEN_WELCOME_HOME` surface and `SPAWN_MAIN` anchor.

## Fallback contract

Production loading always follows:

`generated Blender asset -> validate/load -> configure PBR/LOD -> discover semantics -> mount`

If any production GLB is absent or fails to parse, the existing procedural/authored World stays active. A missing asset must never create a black screen or disable core WISDO features.

## Operator animation

The authored Operator now uses a blended animation state machine rather than direct clip snapping. The state contract supports Idle, Walk, Run, Sprint, WalkBackward, StrafeLeft, StrafeRight, TurnLeft, TurnRight, Interact and TerminalUse with graceful fallback when a source model lacks a specific clip.

## Mobile budget

The visual system remains browser-first. The production contract keeps explicit mobile targets: adaptive LOD, capped DPR, simplified collision, limited material counts, 2K default textures, selective 4K hero textures, and no requirement for mobile to fall back to primitive graphics.

## Activation

The code merge does **not** pretend that generated GLBs already exist. After this merge lands, queue the three checked-in job templates through `[BLENDER JOB]` issues. The trusted Windows Blender worker will build and open separate generated-asset PRs.

Only after those generated PRs pass validation and merge will the production assets appear on `/app/world`.

Live trading authority remains outside all Blender/runtime code. Visual interactions may navigate or open existing World experiences; they do not bypass WISDO Core command authorization.
