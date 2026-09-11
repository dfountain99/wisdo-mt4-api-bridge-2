# WISDO World — Core Experience V1 Phase 0/1 Audit

Date: 2026-09-11

Scope: production runtime forensics and mobile-fidelity policy only. No new major World systems are introduced in this phase.

## A. Current-state matrix

| System | Exists | Working | Problem | Phase 0/1 action |
| --- | --- | --- | --- | --- |
| `/app/world` production entry | Yes | Yes | Must remain the single World entry | Preserve existing route and loader chain |
| Three.js core renderer | Yes | Yes | Procedural art still dominates visible scene | Preserve; do not rewrite movement/physics |
| Fixed-step player movement/camera | Yes | Yes | Screenshot quality can make it look simpler than it is | Preserve as authority |
| Core AUTO quality selection | Yes | Partially | `(pointer: coarse)` forced LOW | Replace with capability policy |
| Fidelity-layer quality selection | Yes | Partially | Independently forced LOW for coarse pointer and treated missing `deviceMemory` as 4 GB | Unify with core capability policy |
| Runtime adaptive quality | Partial | No sustained policy | Static startup choice cannot react to real frame performance | Add sustained FPS downgrade/upgrade with hysteresis |
| Authored GLB Operator | Yes | Fallback is safe | Live iPhone still shows fallback; old loader had external dependency and 15 s timeout | Add explicit fetch/parse diagnostics, retries, longer mobile budget, nonblocking load |
| Procedural Operator fallback | Yes | Yes | Too visually primitive to be the intended production character | Keep strictly as safety fallback |
| World debug HUD | Yes | Partially | Did not explain GLB failure or mobile quality decision | Add Operator/asset/render/quality diagnostics |
| Production Fidelity layer | Yes | Yes | Still procedural, and LOW quality removed several fidelity features | Start modern touch devices at MEDIUM and preserve shadows |
| Market/Reporter/account systems | Yes | Yes | Not part of Phase 0/1 issue | Do not change |
| Smart Home / Campaign / commands | Yes | Yes/ongoing | Not part of Phase 0/1 issue | Do not change |
| Authored environment GLBs/PBR texture pipeline | Planned | Not production-complete | Procedural environment remains the main art-quality ceiling | Phase 2+, only after Phase 0/1 deployment is proven |

## B. Why the current iPhone screenshot still looks procedural

### Confirmed from repository code

1. The old core AUTO quality policy selected `low` whenever `(pointer: coarse)` matched. A touchscreen was therefore treated as a weak GPU signal.
2. The Production Fidelity layer independently repeated that rule.
3. The Fidelity layer also used `navigator.deviceMemory || 4`; Safari commonly does not expose `deviceMemory`, so an unknown value was treated as 4 GB and selected `low` again.
4. LOW disables the core shadow map and reduces prop/skyline density. The fidelity layer also omits some effects at LOW.
5. The authored Operator was fetched from a third-party pinned CDN asset and had a hard 15-second timeout. Any import/download/parse failure retained the procedural fallback.
6. The old in-world debug panel did not expose the authored asset URL, download state, parse state, detected clips, mesh statistics, or exact fallback reason.
7. The foreground city and fallback Operator remain largely procedural geometry. Even a successful quality fix does not by itself make the environment photorealistic.

### Runtime causes that must be verified on the deployed iPhone

The repository alone cannot prove which authored-Operator failure occurred on the user's specific Safari session. The new `?debug=1` diagnostics are intended to distinguish:

- GLTFLoader module import failure
- HTTP/CDN failure
- CORS/opaque response problem
- mobile download timeout
- GLB parse failure
- invalid scene/bounds
- successful authored GLB activation

The current pinned suited GLB is approximately 6.7 MB. This is large enough that a 15-second cold-load deadline could plausibly fail on mobile, but the exact live failure must be read from the deployed diagnostics rather than guessed.

## C. Phase 0/1 file architecture

```text
public/app/world/
├── index.html                     # same production World route; loads debug runtime
├── world-v2.js                    # same scene/session orchestrator
├── world-config.js                # gameplay config + delegates AUTO quality policy
├── world-quality.js               # NEW: device capabilities + adaptive quality controller
├── world3d-core.js                # unchanged physics/camera/render authority
├── world3d-production.js          # production wrapper + telemetry + adaptive quality + async Operator load
├── production-fidelity-layer.js   # same visual layer, now uses shared quality policy
├── authored-asset-manifest.js     # same licensed/pinned asset manifest
├── authored-operator.js           # resilient authored asset download/parse/stats/fallback diagnostics
└── world-debug-runtime.js         # NEW: visible `?debug=1` runtime diagnostics

tests/
├── wisdoWorldContract.test.js
├── wisdoWorldQuality.test.js          # NEW
└── wisdoWorldRuntimeContracts.test.js # NEW
```

Future authored environment work should use a separate reusable asset cache/manifest layer rather than being added to `world3d-core.js`. That work is intentionally not part of this Phase 0/1 change set.

## Phase 0 implementation

- Explicit authored Operator status pipeline: STARTING → LOADER_READY → FETCHING → FETCHED → PARSING → PARSED → ACTIVE.
- Exact fallback stages: LOADER_FAILED, FETCH_FAILED, PARSE_FAILED, or caller-level FAILED.
- Two mobile-friendly fetch attempts with 30-second and 45-second limits.
- GLB loading happens in the background so the World remains playable while the asset downloads.
- Debug data includes asset URL, bytes, timings, clips, mesh/skinned-mesh/material/texture/triangle counts and failure reason.
- Existing procedural Operator remains active until the authored GLB has actually mounted successfully.

## Phase 1 implementation

- Touch/coarse pointer is an input characteristic, not an automatic LOW-quality trigger.
- Unknown Safari `deviceMemory` is kept unknown instead of being coerced to 4 GB.
- Capable touch devices start at MEDIUM, preserving shadows.
- Truly constrained devices can still start LOW.
- AUTO quality can adapt using sustained frame-rate samples with hysteresis and cooldown.
- Manual LOW/MEDIUM/HIGH selection disables automatic adaptation until AUTO is restored.

## Deployment acceptance check

After this branch passes CI and is deployed, test:

`/app/world?scene=central&debug=1`

The HUD must make the following unambiguous:

- `OPERATOR AUTHORED_GLTF` or `OPERATOR PROCEDURAL_FALLBACK`
- exact Operator load/failure status and reason
- active quality tier
- touch/WebGL2/core/memory capability information
- DPR
- shadows ON/OFF
- FPS, draw calls and triangles
- renderer dimensions

On a modern iPhone in AUTO, touch input alone must not select LOW. The expected starting tier is MEDIUM unless a hard capability limit is actually detected; runtime telemetry may later downgrade if sustained frame performance requires it.
