# World Composition V2 — Aurelia Prime review gate

The mobile baseline `IMG_3583.png` shows a visible generated layout with `12/12 VISIBLE`, but the world sits in the lower half of the portrait viewport and reads as a small rectangular diorama. This change addresses layout and semantic structure. It is **not** a Babylon certification result.

The shared manifest uses meters and records semantic roles, relationships and dimensions. Aurelia Prime's planned island is 2400 m across; surrounding ocean is 3600 m; the mountain boundary reaches 360 m; the 420 m Tower dominates 65 m city buildings. Babylon produces an irregular land outline, ocean disc, seeded mountain peaks, a radial city district with a central plaza, and a reserved portal approach. Deterministic seeds preserve the same result for the same approved prompt. The island and ocean are still procedural fallback geometry, not finished materials.

The structural composition report checks landmass, ocean containment, mountain perimeter, Tower centrality and prominence, city clustering, forest separation, portal proximity and spawn placement. It returns `STRUCTURAL_PASS_VISUAL_PENDING` when those relationships are valid. A misplaced Tower or undersized ocean fails. Babylon's operation visibility remains a separate observation; for Aurelia Prime a successful observation now leaves `forgeStatus: composition_pending` and `babylonCertification: PENDING`.

## Visual acceptance still required

Run the exact `public/app/world/fixtures/golden-world.json` on desktop and portrait mobile, plus the authenticated approved Forge world. Capture overview, city, Tower, forest, portal and spawn views. Check that the island fills useful portrait space without clipping, the Tower is immediately recognizable, the mountain ring reads as a boundary, ocean surrounds the irregular coast, the city is a district, and the forest occupies its own region. Use `?compositionDebug=1` to display operation region outlines and spawn direction; turn it off for evidence captures.

Record screenshots, manifest hash, render diagnostics, and the persisted Forge truth report. A report of `487 tests PASS`, all operations visible, or structural composition pass does not establish the visual gate. Keep this PR draft until the actual revised scene passes on desktop and mobile. Player traversal and UE 5.8 remain later gates.
