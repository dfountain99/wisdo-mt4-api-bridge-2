# World Completion Gate 0 — Forge truth and Babylon visibility

This change removes `MISSING_TRUTH_REPORT` as a Forge dead end. Forge recompiles an older approved draft from its approved description when its preview predates truth reporting, then validates the generated manifest. It returns `FORGE AWAITING BABYLON` with a structural `truthReport`. `executed` and `visible` are **null** until Babylon renders.

The Babylon fallback now draws a layered island/coast, a wider connected northern mountain range, a multi-level 420 m tower with crown, a 12-building city district, varied tree canopy, roads and portal geometry from the same operation IDs. These shapes improve recognizability but still require a human visual check.

The authenticated Babylon personal-world page records each renderable operation ID, mesh count, world bounding box, viewport intersection and visibility. It posts that observation with the world ID and manifest revision to `/api/world/personal/visual-report`. The server rejects mismatched revisions, missing/duplicate operations, zero meshes, invalid bounds, misplaced geometry, invalid world bounds and failed camera framing. A matching observation updates `forgeStatus` to `complete` or `incomplete`; it does not certify Unreal. The fixture mode never posts a report to a user's world.

The report records requested concepts, renderable manifest operations, executed and visible counts, missing/invalid items, world bounds, spawn status, and terrain/water/mountains/tower/buildings/forest/portal/spawn groups. Aurelia Prime requires all eight groups. Non-rendering operations such as theme metadata do not inflate visible counts.

## Manual visual gate still required

1. Forge an approved Aurelia Prime prompt that mentions island/water, mountains, WISDO Tower, city/buildings, forest and portal. The Forge response must be `PENDING_VISUAL`, with `visible: null` and a link to the personal Babylon preview.
2. Open `/app/world/babylon-city/personal-world-v1.html?fixture=golden&debug=1` at desktop and portrait sizes. Inspect the actual overview, then click each operation ID. Check that the named geometry exists in the intended region and is recognizable, not simply nonzero meshes.
3. Open the signed-in personal preview. Inspect `window.__WISDO_FORGE_HEALTH__` in browser developer tools and the persisted `/api/world/personal` `forgeTruth`. Capture overview, terrain/water, mountains, tower/buildings, forest, portal, spawn and portrait screenshots. Require all operation IDs visible, sane bounds, a framed camera, and `forgeStatus: complete`.
4. If anything is visually wrong, keep the gate FAIL and fix the manifest, spatial planner or renderer. Do not edit the golden fixture or Unreal map merely to make a screenshot pass.

## PR #94 merge checklist

Use the **same Aurelia Prime golden fixture** for desktop and portrait comparison, then repeat against an authenticated approved Genesis/Forge preview. Record PASS/FAIL with evidence for: fixture load, authenticated preview, terrain, water, mountain boundary, WISDO Tower, multiple buildings, forest, portal, valid spawn, operation-to-mesh observations, nondegenerate mesh and world bounds, auto-framing, no critical overlap, no below-terrain geometry, desktop, portrait, persisted truth report, and Forge COMPLETE. A numeric mesh count alone cannot satisfy any visual item.

Save at least `desktop-overview.png`, `mobile-portrait-overview.png`, `forge-truth-report.png`, and `player-scale-tower-buildings-portal.png` beside the golden fixture's validation evidence. Do not create placeholders and do not mark a capture PASS without inspecting its pixels. Check the portrait view for a tower in frame, clear island structure, and a camera above and outside geometry.

The route test deliberately submits a portal observation with geometry but no camera visibility. It asserts Forge remains `incomplete` with one fewer visible operation, then submits a corrected observation to prove the same manifest can recover without re-forging. It is an API regression test, not a substitute for actual browser captures.

Local Node tests simulate the observation API and cannot establish that pixels appeared. The available cloud browser could not open the workspace's localhost server (`ERR_BLOCKED_BY_CLIENT`); therefore **Babylon visual certification remains PENDING**. UE 5.8, parity, Pixel Streaming and RC1 remain pending as described in the finish-line plan.
