# WISDO World — Next 100 Build Program

This is the ordered production path from the current WISDO World foundation toward a high-fidelity, GTA-style, persistent financial-tech world without moving live broker execution authority into the World client.

The executable source of truth is `public/app/world/world-build-program.js`. Every build has a stable `W###` identity, phase, title, outcome, and status. The World HUD exposes the active program/build so a merge is visible in production instead of existing only in Git history.

## Release rules

1. Build order is deliberate. A later visual/gameplay layer must not hide a failed foundation, security, data-integrity, or performance gate.
2. Every shipped build must update `world-build.js`, carry a cache-busted asset tag, and remain visible in the World status HUD.
3. World stays non-authoritative for live trade execution. Spatial terminals may deep-link to existing WISDO controls, but World does not become a second broker-control path.
4. Market and account visuals must expose freshness/unavailable states and must not fabricate live candles, balances, positions, or reporter health.
5. Desktop and mobile are both release targets. A feature is not complete if it only works on a high-end desktop.
6. Every 10-build phase ends with a measurable gate before the next phase becomes the main focus.

## Phase 1 — Foundation & Observability (W001–W010)

- **W001 — 100-build control plane + visible build identity** — executable roadmap, HUD identity, cache-busted build marker, contract tests. **Status: shipped by this merge.**
- **W002 — Frame-budget baseline** — establish p50/p95 frame, memory, long-task, draw-call, triangle, and network baselines by device tier.
- **W003 — Runtime capability inventory** — detect actual renderer/device/input/audio capabilities and choose profiles without fragile UA guessing.
- **W004 — Client crash capture** — bounded/redacted capture of renderer/runtime failures with scene and build identity.
- **W005 — Asset timing ledger** — time critical GLB, texture, module, shader, and API loads against budgets.
- **W006 — Network timing ledger** — separate catalog, identity, market, presence, realtime, and reconnect latency.
- **W007 — Deterministic replay harness** — replay player input/seed/checkpoints to reproduce movement and interaction regressions.
- **W008 — Visual regression capture hooks** — stable reference cameras for Smart Home, Central, Trading Tower, Arcade, and night scenes.
- **W009 — Launch-gate aggregator** — one pass/fail surface for runtime, network, gameplay, visual, security, and deployment gates.
- **W010 — Performance budget enforcement** — release failure on unacceptable load, frame, memory, bandwidth, or asset regressions.

## Phase 2 — Visual Fidelity & Rendering (W011–W020)

- **W011 — Filmic tone-mapping calibration** — controlled exposure, highlights, shadows, skin/signage readability.
- **W012 — Physical sun/sky cycle** — coherent sun, sky, ambient, and time-of-day transitions.
- **W013 — PBR material normalization** — consistent roughness, metalness, normals, emissive strength, and texel density.
- **W014 — Contact-shadow pass** — ground characters, furniture, curbs, props, and vehicles.
- **W015 — Ambient-occlusion pass** — restrained depth in corners/creases without dirty halos.
- **W016 — Reflection strategy** — bounded reflections for glass, floors, vehicles, signage, and wet surfaces.
- **W017 — Weather surface response** — dry/wet states, puddles, rain sheen, reflected emissive response.
- **W018 — Atmosphere & distance haze** — aerial perspective, skyline fade, district depth cues.
- **W019 — Night emissive hierarchy** — controlled windows, streetlights, billboards, vehicles, and building crowns.
- **W020 — Adaptive render scaler** — dynamic resolution/shadow/effect/LOD scaling from real frame-budget history.

## Phase 3 — Character, Camera & Animation (W021–W030)

- **W021 — Authored operator rig validation** — validate skeleton, scale, materials, orientation, clips, fallback behavior.
- **W022 — Locomotion blend tree** — idle/walk/jog/sprint/strafe/diagonal blending from actual movement.
- **W023 — Turn-in-place system** — natural heading changes without snap pivots.
- **W024 — Acceleration & deceleration** — weighted starts/stops, slopes, and momentum-linked animation.
- **W025 — Jump/fall/land states** — anticipation, jump, apex, fall, land, hard-land, recovery.
- **W026 — Third-person camera collision** — keep camera out of walls/props without violent popping.
- **W027 — Shoulder & focus framing** — precision interaction framing for terminals and objects.
- **W028 — Foot placement & slope IK** — feet/pelvis adaptation on stairs, curbs, ramps, uneven ground.
- **W029 — Avatar LOD policy** — scale skeleton/animation/material/mesh cost with distance and crowd density.
- **W030 — Touch movement polish** — phone-first joystick, drag-look, sprint, jump, and targeting tuning.

## Phase 4 — City, Interiors & Traversal (W031–W040)

- **W031 — District streaming graph** — loadable districts, dependency-aware preload rings, bounded memory residency.
- **W032 — Collision/nav authority map** — canonical walkable/blocker/stair/door/elevator/fallback volumes.
- **W033 — Doors & elevators** — deterministic multiplayer-safe building transitions.
- **W034 — Traffic ambience** — bounded vehicle loops, signals, parked traffic, lighting, and audio.
- **W035 — Pedestrian ambience** — pooled crowd life with district density and aggressive LOD.
- **W036 — Interior streaming** — Trading Tower, Academy, Arcade, Vault, and Command interiors load only when relevant.
- **W037 — World interactable registry** — one rule set for prompt range, LOS, priority, cooldown, entitlement, and action routing.
- **W038 — District minimap data** — map bounds/landmarks/portals from the same source as traversal.
- **W039 — Fast-travel terminals** — unlocked-district travel with safe deterministic spawning.
- **W040 — Persistent safe spawn** — recover safely when a returning player's old coordinates become invalid.

## Phase 5 — Trading Gameplay & Market Spaces (W041–W050)

- **W041 — Trading Tower live screens** — approved live/runtime data with freshness labels; never fabricate candles.
- **W042 — Market billboard confidence states** — live/delayed/reconnecting/closed/unavailable visual states.
- **W043 — Arcade onboarding missions** — guided BUY/SELL/HOLD/CLOSE, sizing, stops, targets, R, drawdown, discipline.
- **W044 — Replay verification UX** — explain deterministic validation and invalid competitive sessions.
- **W045 — Risk simulator lab** — position size, stop distance, expectancy, drawdown, campaign math without broker execution.
- **W046 — Campaign autopsy room** — entry/add/exit, R, MAE/MFE, drawdown, decision timeline visualization.
- **W047 — Reporter mesh visualization** — linked account/reporter health/freshness without secrets.
- **W048 — Account vault visualization** — aliases, connection state, permissions, read-only portfolio context.
- **W049 — Command Center world portals** — spatial deep-links to existing Fast Mode trading controls.
- **W050 — Market event scenarios** — deterministic trend/range/spike/sweep/breakout/failed-breakout training seeds.

## Phase 6 — Coach AI & NPC Intelligence (W051–W060)

- **W051 — Coach world context** — scene, nearby terminal, training objective, build, and player context.
- **W052 — Location-aware help** — mastery-aware contextual assistance without spam.
- **W053 — Voice intent router** — allowed navigation/explanation/UI/training intents inside existing authorization.
- **W054 — NPC behavior framework** — bounded ambient/guide/mentor/event state machines with deterministic fallbacks.
- **W055 — Trading mentor missions** — score sizing, stops, patience, and process quality rather than profit alone.
- **W056 — Personalized training hints** — identify repeated simulation mistakes and recommend drills.
- **W057 — Dynamic quest composer** — validated template-based quests from world state and mastery gaps.
- **W058 — AI safety boundary layer** — training/explanation cannot become unauthorized live execution or secret access.
- **W059 — World commentary events** — grounded reactions to verified milestones, reconnects, and achievements.
- **W060 — Memory & privacy boundaries** — explicit persistence, redaction, reset, session-only, and prohibited-data rules.

## Phase 7 — Multiplayer & Social Presence (W061–W070)

- **W061 — Authoritative presence contract** — versioned identity/scene/position/heading/animation/tier/freshness fields.
- **W062 — Remote interpolation** — smooth avatars with bounded extrapolation and snap recovery.
- **W063 — Rooms & shards** — district/room partitioning with occupancy limits and deterministic overflow.
- **W064 — Party invites** — invite/accept/leave/follow/reconnect/privacy controls.
- **W065 — Proximity indicators** — nearby-player awareness without location leakage outside the active room.
- **W066 — Emote system** — synchronized, rate-limited, movement-safe social animation.
- **W067 — Co-op training missions** — synchronized deterministic simulations with shared and individual objectives.
- **W068 — Spectator mode** — read-only viewing without authoritative simulation influence.
- **W069 — Season leaderboard transport** — durable/idempotent mastery and rank snapshots.
- **W070 — Reconnect & ghost cleanup** — restore parties/rooms and remove stale duplicate avatars.

## Phase 8 — Progression, Economy & Ownership (W071–W080)

- **W071 — Culture Coin reward ledger** — auditable sources, idempotency, caps, reversals, anti-farm rules.
- **W072 — XP & mastery model** — unified Arcade XP, missions, streaks, and skill categories.
- **W073 — Cosmetic inventory** — operator/home/badge/effect/district cosmetics with no execution authority.
- **W074 — Home customization slots** — persistent approved Smart Home modules with schema versioning.
- **W075 — District access gates** — server-authoritative role/premium gates and clear locked-content UX.
- **W076 — Marketplace preview** — browse/preview in World while checkout stays in existing commerce.
- **W077 — Achievement engine** — one-time/cumulative/hidden/seasonal idempotent awards.
- **W078 — Daily & weekly challenges** — bounded rotating goals with anti-exploit and timezone-safe rollover.
- **W079 — Season framework** — IDs, dates, tracks, archive, rollover, permanent mastery preservation.
- **W080 — Entitlement synchronization** — prompt role/purchase refresh with safe stale/offline handling.

## Phase 9 — Mobile, Performance & Accessibility (W081–W090)

- **W081 — Adaptive resolution controller** — hysteresis-based frame-time render scaling.
- **W082 — Object/material pooling** — eliminate repeated interaction allocation spikes.
- **W083 — Texture delivery tiers** — device/GPU-appropriate texture resolution and compression.
- **W084 — Realtime bandwidth budget** — presence update precision/frequency based on distance/visibility/motion.
- **W085 — Background-tab discipline** — stop unnecessary rendering/polling/battery use while hidden.
- **W086 — iOS Safari hardening** — touch, audio unlock, resize/orientation, safe area, memory/context-loss recovery.
- **W087 — Android browser hardening** — GPU variance, touch latency, thermal pressure, viewport/context recovery.
- **W088 — Haptics & touch feedback** — bounded interaction/error/mission feedback respecting settings.
- **W089 — Reduced-motion & accessibility pass** — focus, contrast, labels, scalable HUD, alternative cues.
- **W090 — Installable shell & recovery** — robust PWA/error surface and safe Fast Mode fallback.

## Phase 10 — Production, Security & Launch (W091–W100)

- **W091 — World threat model** — trust boundaries across browser, realtime, Redis, Postgres, workers, market data, and WISDO Core.
- **W092 — CSP & asset allowlist** — restrict script/asset origins while preserving approved Three/assets.
- **W093 — Realtime ticket rotation** — safe ticket/key version rotation and replay/expiry rejection.
- **W094 — Rate limits & abuse controls** — bound joins, presence, social, rewards, replay, telemetry.
- **W095 — Database load test** — realistic concurrency for World events, rewards, parties, progression, rankings.
- **W096 — Redis degradation plan** — latency/disconnect/restart/partial-availability testing and safe recovery.
- **W097 — Render topology productionization** — independent web/realtime/worker/Redis/Postgres health and scale behavior.
- **W098 — Canary release lane** — small-cohort rollout, build pinning, metrics, instant rollback.
- **W099 — Synthetic journey checks** — continuously verify load → spawn → move → interact → Arcade → reconnect → Fast Mode.
- **W100 — Launch readiness & rollback** — SLOs, error budgets, incident ownership, reversible migration, release/rollback procedure.

## What W001 changes now

W001 is not a paper roadmap. It adds the executable 100-build registry, a browser runtime that exposes the program through `window.WISDO_WORLD_BUILD_PROGRAM`, a visible `NEXT 100 · W001/W100` status line, a new `3.3.0-next100-program-alpha` build identity, cache-busted World assets, and Node contract tests that fail if the program stops being exactly 100 ordered builds.
