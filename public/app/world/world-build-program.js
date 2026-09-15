const PHASES = [
  {
    id: 'foundation',
    name: 'Foundation & Observability',
    builds: [
      ['100-build control plane + visible build identity', 'Ship the versioned 100-build program, visible HUD identity, cache-busted build marker, and contract tests.'],
      ['Frame-budget baseline', 'Measure CPU frame time, long tasks, memory growth, draw calls, triangles, and network cost by device tier.'],
      ['Runtime capability inventory', 'Detect renderer limits, device memory hints, touch/pointer support, audio state, and motion preferences without UA guessing.'],
      ['Client crash capture', 'Capture uncaught errors, rejected promises, renderer failures, scene/build identity, and bounded diagnostic context.'],
      ['Asset timing ledger', 'Measure every critical GLB, texture, module, shader, and API load against an explicit budget.'],
      ['Network timing ledger', 'Separate catalog, identity, market, presence, realtime, and reconnect latency so render slowness is not misdiagnosed.'],
      ['Deterministic replay harness', 'Record input, seed, scene, and checkpoints so movement and interaction regressions can be replayed.'],
      ['Visual regression capture hooks', 'Create deterministic camera bookmarks for Smart Home, Central, Trading Tower, Arcade, and night scenes.'],
      ['Launch-gate aggregator', 'Combine runtime, network, gameplay, visual, security, and deployment gates into one release verdict.'],
      ['Performance budget enforcement', 'Fail release checks when load time, frame time, memory, bandwidth, or asset budgets regress beyond tolerance.'],
    ],
  },
  {
    id: 'rendering',
    name: 'Visual Fidelity & Rendering',
    builds: [
      ['Filmic tone-mapping calibration', 'Calibrate exposure, highlight rolloff, shadow floor, and contrast for readable cinematic scenes.'],
      ['Physical sun/sky cycle', 'Drive sun direction, sky color, ambient intensity, and time-of-day transitions from one coherent model.'],
      ['PBR material normalization', 'Normalize metalness, roughness, normals, emissive strength, and texel density across authored and procedural assets.'],
      ['Contact-shadow pass', 'Ground characters, furniture, curbs, props, and vehicles with stable near-field contact shadows.'],
      ['Ambient-occlusion pass', 'Add restrained AO for corners and creases without dirty halos or crushed blacks.'],
      ['Reflection strategy', 'Add bounded reflections for glass, polished floors, vehicles, signage, and wet surfaces.'],
      ['Weather surface response', 'Add dry/wet material states, puddle masks, rain sheen, and reflected emissive response.'],
      ['Atmosphere & distance haze', 'Add height fog, aerial perspective, skyline fade, and district depth cues.'],
      ['Night emissive hierarchy', 'Tune windows, streetlights, billboards, vehicles, and crowns into a controlled night-light hierarchy.'],
      ['Adaptive render scaler', 'Scale resolution, shadows, effects, and LOD using frame-budget history instead of static quality guesses.'],
    ],
  },
  {
    id: 'character',
    name: 'Character, Camera & Animation',
    builds: [
      ['Authored operator rig validation', 'Validate skeleton, scale, materials, root orientation, clips, and explicit fallback behavior for the WISDO operator.'],
      ['Locomotion blend tree', 'Blend idle, walk, jog, sprint, strafe, and diagonals from actual velocity and heading.'],
      ['Turn-in-place system', 'Use natural turn-in-place behavior before large heading changes instead of snapping the avatar.'],
      ['Acceleration & deceleration', 'Add weighted acceleration, braking, slope response, and animation parameters tied to real motion.'],
      ['Jump/fall/land states', 'Separate anticipation, jump, apex, fall, landing, hard landing, and recovery.'],
      ['Third-person camera collision', 'Prevent walls and props from clipping the camera while preserving smooth follow behavior.'],
      ['Shoulder & focus framing', 'Add contextual shoulder framing for precision interactions and trading terminals without shooter mechanics.'],
      ['Foot placement & slope IK', 'Adapt feet and pelvis to stairs, curbs, ramps, and uneven ground within safe correction limits.'],
      ['Avatar LOD policy', 'Reduce skeleton, animation, material, and mesh cost by distance and crowd density.'],
      ['Touch movement polish', 'Tune joystick dead-zone, acceleration, camera drag, sprint, jump, and interaction targeting for phones.'],
    ],
  },
  {
    id: 'city',
    name: 'City, Interiors & Traversal',
    builds: [
      ['District streaming graph', 'Split Central into loadable districts with dependency-aware preload rings and bounded residency.'],
      ['Collision/nav authority map', 'Define walkable surfaces, blockers, stairs, doors, elevators, safe fallbacks, and interaction volumes.'],
      ['Doors & elevators', 'Create deterministic door/elevator state machines that remain safe under multiplayer transitions.'],
      ['Traffic ambience', 'Add bounded vehicle loops, signals, lights, parked traffic, and audio without making traffic authoritative physics.'],
      ['Pedestrian ambience', 'Add pooled background pedestrians with district-aware density and aggressive distance LOD.'],
      ['Interior streaming', 'Stream Trading Tower, Academy, Arcade, Vault, and Command interiors only when relevant.'],
      ['World interactable registry', 'Standardize prompt range, line-of-sight, priority, cooldown, entitlement, and action routing.'],
      ['District minimap data', 'Generate canonical bounds, landmarks, portals, and player markers from the same world data used by traversal.'],
      ['Fast-travel terminals', 'Add lore-consistent fast travel between unlocked districts with deterministic safe spawn points.'],
      ['Persistent safe spawn', 'Persist the last valid checkpoint and recover safely when old coordinates are invalid after an update.'],
    ],
  },
  {
    id: 'trading',
    name: 'Trading Gameplay & Market Spaces',
    builds: [
      ['Trading Tower live screens', 'Drive in-world screens from approved market/runtime data with freshness labels and no fabricated candles.'],
      ['Market billboard confidence states', 'Expose live, delayed, reconnecting, closed-market, and unavailable states on public boards.'],
      ['Arcade onboarding missions', 'Teach BUY/SELL/HOLD/CLOSE, size, stops, targets, R, drawdown, and discipline through short simulations.'],
      ['Replay verification UX', 'Surface deterministic replay checks and invalid-session reasons directly inside Arcade results.'],
      ['Risk simulator lab', 'Train position sizing, stop distance, expectancy, drawdown, and campaign math without broker execution.'],
      ['Campaign autopsy room', 'Visualize entry, adds, exits, realized R, MAE/MFE, drawdown, and decision timeline from replayable sessions.'],
      ['Reporter mesh visualization', 'Show linked reporters/accounts as health/freshness nodes without exposing credentials or execution secrets.'],
      ['Account vault visualization', 'Show aliases, connection state, permissions, and read-only portfolio context in a spatial secure UI.'],
      ['Command Center world portals', 'Deep-link spatial terminals into existing Fast Mode controls instead of duplicating live execution logic.'],
      ['Market event scenarios', 'Ship deterministic trend, range, spike, liquidity-sweep, breakout, and failed-breakout training scenarios.'],
    ],
  },
  {
    id: 'ai',
    name: 'Coach AI & NPC Intelligence',
    builds: [
      ['Coach world context', 'Give Coach safe scene, nearby-terminal, training-objective, build, and player-state context.'],
      ['Location-aware help', 'Trigger concise contextual help for new spaces with mastery-aware suppression and user dismissal.'],
      ['Voice intent router', 'Route allowed voice intents to navigation, explanation, UI opening, and training actions within existing auth boundaries.'],
      ['NPC behavior framework', 'Add bounded state machines for ambient, guide, mentor, and event NPC roles with deterministic fallbacks.'],
      ['Trading mentor missions', 'Score process quality such as sizing, stops, patience, and rule adherence rather than profit alone.'],
      ['Personalized training hints', 'Use gameplay telemetry to identify repeated training mistakes and recommend specific drills.'],
      ['Dynamic quest composer', 'Compose quests from approved templates, world state, and mastery gaps while preserving validated reward bounds.'],
      ['AI safety boundary layer', 'Keep explanation/training separate from live trade execution and block secrets or unauthorized actions.'],
      ['World commentary events', 'Let Coach/NPCs react to verified milestones, district events, reconnects, and achievements with rate limits.'],
      ['Memory & privacy boundaries', 'Define session-only context, persistence rules, redaction, reset behavior, and prohibited sensitive fields.'],
    ],
  },
  {
    id: 'multiplayer',
    name: 'Multiplayer & Social Presence',
    builds: [
      ['Authoritative presence contract', 'Version identity, scene, position, heading, animation, tier, and freshness fields for realtime presence.'],
      ['Remote interpolation', 'Smooth remote avatars with interpolation, bounded extrapolation, and snap recovery.'],
      ['Rooms & shards', 'Partition presence by district/room with bounded occupancy and deterministic overflow.'],
      ['Party invites', 'Add invite, accept, leave, follow-to-district, reconnect, and privacy controls.'],
      ['Proximity indicators', 'Show nearby players and interaction eligibility without exposing precise location outside the active room.'],
      ['Emote system', 'Add synchronized, rate-limited emotes with animation fallbacks and controls that never block movement.'],
      ['Co-op training missions', 'Run synchronized deterministic trading scenarios for small parties with shared and individual objectives.'],
      ['Spectator mode', 'Add read-only spectating for approved Arcade/training sessions without granting simulation authority.'],
      ['Season leaderboard transport', 'Move mastery/ranking snapshots through durable, idempotent server paths that survive worker restarts.'],
      ['Reconnect & ghost cleanup', 'Restore room/party state after short drops and remove stale ghost players deterministically.'],
    ],
  },
  {
    id: 'progression',
    name: 'Progression, Economy & Ownership',
    builds: [
      ['Culture Coin reward ledger', 'Define auditable reward sources, idempotency keys, caps, reversals, and anti-farm rules for World activities.'],
      ['XP & mastery model', 'Unify Arcade XP, mission mastery, streaks, and skill categories into one stable progression contract.'],
      ['Cosmetic inventory', 'Add non-execution cosmetics for operator, home, badges, effects, and district flair.'],
      ['Home customization slots', 'Persist approved decorative/read-only modules in the WISDO Smart Home with schema versioning.'],
      ['District access gates', 'Tie premium/role access to existing server authorization and explain locked content clearly.'],
      ['Marketplace preview', 'Allow browse/preview of cosmetics and access products while checkout remains in existing commerce flows.'],
      ['Achievement engine', 'Centralize one-time, cumulative, hidden, and seasonal achievements with idempotent awards.'],
      ['Daily & weekly challenges', 'Generate bounded rotating challenges with catch-up rules, anti-exploit counters, and timezone-safe rollover.'],
      ['Season framework', 'Define season IDs, dates, reward tracks, archival, and rollover without corrupting permanent mastery.'],
      ['Entitlement synchronization', 'Refresh roles/purchases into World access with cache invalidation and safe stale/offline behavior.'],
    ],
  },
  {
    id: 'mobile',
    name: 'Mobile, Performance & Accessibility',
    builds: [
      ['Adaptive resolution controller', 'Tune render scale from recent frame-time history with hysteresis so quality does not oscillate.'],
      ['Object/material pooling', 'Pool common props, indicators, effects, and temporary meshes to remove allocation spikes.'],
      ['Texture delivery tiers', 'Serve appropriately sized/compressed texture sets according to actual GPU support and device budget.'],
      ['Realtime bandwidth budget', 'Reduce presence precision/frequency by distance, visibility, and motion state in crowded rooms.'],
      ['Background-tab discipline', 'Pause rendering, reduce polling, and keep only essential session/realtime work while hidden.'],
      ['iOS Safari hardening', 'Handle touch lifecycle, audio unlock, resize/orientation, safe areas, memory pressure, and WebGL context loss.'],
      ['Android browser hardening', 'Handle varied GPUs, viewport changes, touch latency, thermal pressure, and renderer recovery.'],
      ['Haptics & touch feedback', 'Use bounded device feedback for valid interaction, errors, and mission events where supported.'],
      ['Reduced-motion & accessibility pass', 'Support reduced motion, keyboard focus, contrast, semantic labels, scalable HUD, and non-animation cues.'],
      ['Installable shell & recovery', 'Add robust install/offline error surfaces and safe fallback to Fast Mode when World cannot initialize.'],
    ],
  },
  {
    id: 'production',
    name: 'Production, Security & Launch',
    builds: [
      ['World threat model', 'Document trust boundaries across browser, realtime gateway, Redis, Postgres, workers, market data, and WISDO Core.'],
      ['CSP & asset allowlist', 'Tighten content security policy around Three/CDN/assets while preserving required modules.'],
      ['Realtime ticket rotation', 'Rotate ticket/signing versions safely and reject replayed or expired tickets without mass logout.'],
      ['Rate limits & abuse controls', 'Bound joins, presence, social actions, rewards, replay, and telemetry by identity and risk.'],
      ['Database load test', 'Stress World events, rewards, progression, parties, and rankings at realistic concurrency.'],
      ['Redis degradation plan', 'Test pub/sub and presence behavior through latency, disconnect, restart, and partial availability.'],
      ['Render topology productionization', 'Finalize web, realtime gateway, worker, Redis, and Postgres topology with independent health checks.'],
      ['Canary release lane', 'Route a small cohort to new World builds with build pinning, metrics, and instant rollback.'],
      ['Synthetic journey checks', 'Continuously test load → spawn → move → interact → Arcade → reconnect → Fast Mode in production.'],
      ['Launch readiness & rollback', 'Finalize SLOs, error budgets, incident ownership, migration reversibility, release checklist, and rollback.'],
    ],
  },
];

let number = 0;
export const NEXT_WORLD_BUILDS = Object.freeze(PHASES.flatMap((phase, phaseIndex) =>
  phase.builds.map(([title, outcome], buildIndex) => {
    number += 1;
    return Object.freeze({
      number,
      id: `W${String(number).padStart(3, '0')}`,
      phase: phase.id,
      phaseName: phase.name,
      phaseNumber: phaseIndex + 1,
      buildInPhase: buildIndex + 1,
      title,
      outcome,
      status: number === 1 ? 'shipped' : 'planned',
    });
  })
));

if (NEXT_WORLD_BUILDS.length !== 100) {
  throw new Error(`WISDO World build program must contain exactly 100 builds; got ${NEXT_WORLD_BUILDS.length}`);
}

export const WORLD_BUILD_PROGRAM = Object.freeze({
  id: 'wisdo-world-next-100-v1',
  name: 'WISDO World Next 100',
  totalBuilds: NEXT_WORLD_BUILDS.length,
  shippedBuilds: NEXT_WORLD_BUILDS.filter((build) => build.status === 'shipped').length,
  currentBuild: NEXT_WORLD_BUILDS.find((build) => build.status === 'shipped') || NEXT_WORLD_BUILDS[0],
  phases: Object.freeze(PHASES.map((phase, index) => Object.freeze({
    number: index + 1,
    id: phase.id,
    name: phase.name,
    firstBuild: index * 10 + 1,
    lastBuild: index * 10 + 10,
  }))),
});
