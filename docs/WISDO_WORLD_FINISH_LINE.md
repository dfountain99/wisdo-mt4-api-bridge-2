# WISDO World — finish line

**Baseline:** `main` at `39c13cc` (PR #92), audited 2026-09-24. **Active milestone:** Phase 1, Forge/Babylon completion. Expansion is frozen until World RC1. The statuses below describe the merged repository, not an intended architecture or an unmerged branch.

## Evidence and status rules

| State | Meaning |
| --- | --- |
| DONE | Implemented on `main` and verified at the relevant gate. |
| PARTIAL | Code exists, but the complete user-visible behavior or required evidence is missing. |
| BLOCKED | The next required verification depends on unavailable engine, host, or evidence. |
| NOT STARTED | No accepted implementation or proof exists on `main`. |

Source evidence: `services/holographicBlueprintService.js`, `server/worldRoutes.js`, `services/unrealWorldManifestService.js`, `public/app/world/babylon-city/personal-world-v1.js`, `public/app/world/fixtures/golden-world.json`, `unreal/WisdoWorld/Source/WisdoWorld/`, `docs/unreal-world-integration.md`. On this audit, `npm test` passed **476 tests** and `npm run audit:secrets` passed. The visual completion script reported `checked: []`; that is **not** visual verification. No UE 5.8 executable was found in this workspace. GitHub workflow definitions exist; this audit did not run remote workflows.

## Inventory on `main`

| System | State | Evidence and remaining proof |
| --- | --- | --- |
| Genesis prompt extraction and design | PARTIAL | Keyword compiler produces ideas and operations; prompt fidelity and requested-versus-generated coverage are not proven. |
| Draft and approved-design storage | DONE | Authenticated foundry draft, approve, forge routes persist per user. |
| Forge operation compiler, including tower | PARTIAL | Tower and other operations are generated; there is no pre-forge completeness gate on `main`. |
| Shared versioned world manifest | DONE | Authenticated `wisdo-unreal-world-v1` endpoint includes revision and operations. This is schema versioning, not a proven migration system. |
| Root city and personal-world separation | PARTIAL | `/app/world?scene=central` and per-user `world:<userId>` records are separate today. There is no versioned root-city manifest or explicit ownership hierarchy; Forge currently writes only the user's personal-world record. |
| World hierarchy and parcel contract | NOT STARTED | No district/parcel allocation, ownership-aware composition, or live parcel replacement exists on `main`. The contract is specified below without claiming implementation. |
| Spatial planning and measurement rules | PARTIAL | Fixed positions and implicit meter conversion exist; region layout and object dimensions are not manifest-wide on `main`. |
| Guaranteed Babylon geometry | PARTIAL | Fallback primitives for known operations exist; zero meshes and unsupported operations are logged without failing Forge. |
| Babylon renderer and composition | PARTIAL | Golden fixture mode works in code; the Aurelia Prime visual failure baseline has not been closed by screenshots. |
| Camera framing and mobile preview | PARTIAL | Player camera exists; bounds-based overview and portrait framing are not on `main`. |
| Golden manifest and debug view | PARTIAL | Fixture and `?fixture=golden&debug=1` exist; operation counts are visible, but scene health and visual parity are unproven. |
| Theme, materials, roads, biome and architecture variation | NOT STARTED | V3 work is unmerged and incomplete. Existing primitives remain placeholders. |
| Unreal 5.8 project and operation registry | PARTIAL | `.uproject` targets 5.8; C++ generators, third-person character, IDs/count logs, portal overlap code are present, but no UE compile/run proof exists. |
| Unreal terrain/water/mountains/buildings/forest/portal | PARTIAL | Implemented in C++ source, not visually or functionally proven in engine. |
| UE project generation, compile, editor and map boot | BLOCKED | Requires an actual UE 5.8 machine and retained build/runtime logs. |
| Character movement, collision, gravity, portal overlap | BLOCKED | Source exists; requires in-engine play evidence. |
| Babylon–Unreal layout parity | BLOCKED | Same fixture is available, but paired screenshots and transform checks are missing. |
| Local Pixel Streaming | NOT STARTED | No accepted local signaling/player/input evidence. |
| GPU allocation and authenticated World Sessions | NOT STARTED | No merged allocator, runtime handoff, or per-world stream. |
| Mobile streamed controls and reconnect | NOT STARTED | Requires a working local and hosted stream first. |
| Persistent multiplayer, marketplace, live editing, discovery | NOT STARTED | Frozen until after RC1. |

## Unmerged work is not completion

- Local `feat/world-forge-v2` commit `5d69e58` implements a 2,400 m spatial layout, Forge truth checks, Babylon bounds camera, operation highlighting, a revised Aurelia Prime fixture, and Unreal dimension consumption. Its 479 Node tests and build check passed locally. It is **not on `main`** and has **no browser screenshot or UE 5.8 compile proof**. Review it as a Phase 1 candidate, not a passed Phase 1 gate.
- Incomplete V3 fidelity, V4 camera/coordinate certification, and V5 session work were set aside before this audit. None is merged, complete, or a reason to advance milestones.
- Earlier PRs #91 and #92 are merged. They established the Unreal scaffold and validation instrumentation, not “V1.1 Proven Renderer.”

## Locked city ownership rule

**WISDO City is persistent shared infrastructure. Genesis never replaces its base world.** An approved creation either produces an authorized user-owned space attached to the city or a separate personal world linked by a portal. The existing central-city scene remains the root experience while this contract is introduced. Current Forge behavior creates `world:<userId>` personal worlds; it does **not** yet allocate city parcels. Do not silently relabel those records as parcels or copy their coordinates into the city.

The hierarchy contract must be fixed during Phase 3, before Unreal certification and streaming, but implementation of procedural district expansion and live shared updates stays outside RC1 unless required to make the single-world experience work. A minimal future manifest envelope is:

```json
{
  "schema": "wisdo-world-hierarchy-v1",
  "scope": "parcel",
  "rootWorldId": "wisdo-city",
  "rootVersion": 1,
  "districtId": "creator-district",
  "parcelId": "parcel_001",
  "ownerId": "user_123",
  "manifestVersion": 7,
  "bounds": { "min": { "x": 0, "z": 0 }, "max": { "x": 100, "z": 100 } },
  "portalLinks": [],
  "operations": []
}
```

This is a **proposed contract**, not a stored manifest or allocated parcel. `scope` distinguishes `root`, `parcel`, and `personal-world`. The root manifest is WISDO-owned and separately versioned. A parcel pins the root version it was placed against and has a unique owner, permitted bounds, and its own revision. A personal world has its own world ID and version; a portal stores an authorized link rather than merging two manifests. Actor identity derives from `(scope, worldId/rootWorldId, parcelId, operationId)`, with owner and editability resolved server-side. Browser-provided owner IDs, bounds, operation IDs, or portal destinations cannot authorize a build.

Composition is `root manifest + authorized parcel manifests + live state`, with independently versioned records and collision/placement validation at boundaries. A parcel update replaces only actors tagged for that parcel after authorization and validation; it must not rewrite root actors, another parcel, or restart the city. This replacement and procedural allocation require later runtime tests and are **not** implied by defining the envelope. Root upgrades need explicit parcel compatibility or migration checks. Preserve existing `world:<userId>` personal worlds and the central scene while introducing the hierarchy through additive versioned records.

## Integrated code branch note

The subsequent `feat/world-sessions-v5` branch combines V2–V5 code and tests, but does not close the visual, UE 5.8, Pixel Streaming, or GPU gates. If merged, use `docs/WISDO_WORLD_V1_V5_INTEGRATION_STATUS.md` for post-merge code status. The inventory above remains the audit of `main` at `39c13cc`, not a claim that these gates have since passed.

## Single active sequence

| Phase | Work and gate | Required retained evidence |
| --- | --- | --- |
| **1 — Forge/Babylon** | Review the V2 candidate against `main`, close gaps in intent coverage and spatial validity, guarantee visible fallback geometry, and make Forge refuse incomplete worlds. Render the exact Aurelia Prime prompt in a desktop and portrait browser. Require terrain, surrounding water, mountain region, hero tower, building district, forest, portal, spawn, and camera framing; each requested renderable operation must have a mesh and a traceable ID. | Approved prompt/blueprint/manifest, requested/generated/executed/visible report, runtime log, overview and detail screenshots, portrait screenshot, failing operation IDs if any. No `FORGE COMPLETE` on zero or missing critical geometry. |
| **2 — Recognizable world** | Add only the needed theme, materials, landmark hierarchy, architecture variation, roads, biome, atmosphere, portal presentation, deterministic seed, semantic asset IDs, and player-scale checks. Keep a bounded Babylon asset budget. | Same prompt and seed reproduce the same scene; screenshots show a dominant tower, city district, outer mountains, distinct forest and coastline; measured player clearances and browser performance capture. |
| **3 — Renderer and ownership contract** | Freeze one coordinate convention, origin, meters, elevations, transforms and scale bounds. Specify root/parcel/personal-world identity and ownership boundaries without building multiplayer or city expansion. Add overview/city/tower/forest/portal/spawn camera anchors to the golden manifest. Both renderers use adapters and the same manifest hash. | Contract tests, manifest fixture/hash, view coordinates, side-by-side transform table, ownership and root-protection tests. Repair the manifest/converter/generator, never move actors manually in `.umap`. |
| **4 — UE 5.8 boot** | On a UE 5.8 Windows machine, generate project files, compile, open editor, load runtime map and parse the golden manifest. Fix all C++/UE API errors before gameplay work. | Full project-generation and compile logs, UE version, editor/runtime log, map screenshot, binary PASS/FAIL for each boot gate. |
| **5 — Unreal gameplay** | Verify every required operation ID spawns expected actors at correct transforms; play character spawn, walk/run, camera, gravity, terrain/building collision, water boundary and portal overlap. Repeat launch. | Actor-count/transform log, character and portal log, screenshots/video, repeat-run comparison and per-subsystem verdict. |
| **6 — Renderer parity** | Capture both engines from the same six anchors. Compare terrain, coastline, mountains, tower, city, forest, portal, spawn, scale and orientation. | Paired screenshots, manifest hash, comparison table and signed-off binary verdict. Only here may `V1.1 PROVEN RENDERER` become `CERTIFIED`. |
| **7 — Local Pixel Streaming** | Package UE 5.8 and prove localhost video, audio, keyboard, mouse, touch and reconnect before cloud work. Embed the local player in WISDO's web shell. | Local signaling/browser logs and input captures on desktop and touch device. |
| **8 — GPU sessions** | Provision a GPU host; bind authenticated user, authorized world, exact revision, session and instance. Start GPU only on Enter; fail closed while unavailable, expire and shut down idle sessions. | Provisioning, scoped manifest handoff, stream readiness, authorization rejection, reconnect, expiration, cost and shutdown logs. |
| **9 — Mobile world mode** | Validate joystick, camera drag, jump/interact, fullscreen, orientation, network quality, reconnect and exit against a real hosted stream. | iPhone capture plus touch/input and reconnect logs. |
| **10 — World RC1** | Run all repository and runtime gates, secret audit, GitHub workflows, regression prompt, UE and streaming tests. Remove dead duplicates only after confirming no active route depends on them. | RC1 report, exact commits/builds, screenshots/logs, security and cleanup results. |

**Gate discipline:** build → run → look → test → fix → rerun → pass → merge → next phase. A passing Node suite establishes contract behavior only. Phase 1 is the only active build now. Phases 2–10 remain queued; multiplayer, live editing, social discovery and marketplace remain frozen.

## Next action

Review local `feat/world-forge-v2` against `main`, run the Aurelia Prime golden fixture in a real Babylon browser at desktop and portrait sizes, retain screenshots and the operation health report, and fix observed placement or visibility failures. Advance to Phase 2 only after that evidence passes. No Unreal certification, Pixel Streaming, GPU session, or RC1 status should be inferred from repository tests.
