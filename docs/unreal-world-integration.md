# Unreal renderer for personal worlds

Genesis remains the authoring and approval surface. The WISDO server owns the
world state. Unreal consumes a versioned manifest and renders the same world.

## Current handoff

After Forge, an authenticated owner can request
`GET /api/world/personal/unreal-manifest`. The response contains a
`wisdo-unreal-world-v1` manifest with the world ID, revision, terrain, spawn,
buildings, zones, portals and the approved forge operations. The endpoint uses
the existing world session and only returns that user's world. Do not expose it
as a public asset URL.

An Unreal project should parse this manifest into a data structure, use a
curated asset catalog to map operation types to meshes/materials, and spawn
actors with stable IDs. Never treat prompt text as an asset path or class name.
Rebuild on revision changes and report missing asset mappings back to the
Forge UI. Start with `CREATE_MOUNTAIN_RANGE`, `CREATE_FOREST`, `CREATE_OCEAN`,
`CREATE_CASTLE`, and `CREATE_CITY_ZONE`; expand the compiler for roads, homes,
crafting labs and portals as those operations gain real parameters.

## Browser delivery

Package the Unreal application with Pixel Streaming. Run it on a GPU-capable
host with its signaling infrastructure, then embed its player in the WISDO
personal-world route. Pass a short-lived, world-scoped session ticket from
WISDO to the streaming host; the host fetches the manifest server-to-server.
Keep the Babylon view as the available renderer when no Unreal stream exists.
Each active interactive stream needs hosting capacity; authentication,
isolation, persistence and reconnect behavior must be built before inviting
users into their own worlds.

## Runtime V1 local proof

`unreal/WisdoWorld/WisdoWorld.uproject` targets Unreal Engine 5.8. Open it in
the 5.8 editor, let Unreal compile the C++ module, and press Play. The default
map is intentionally empty. `AWisdoWorldGameMode` reads the canonical fixture
at `public/app/world/fixtures/golden-world.json` and builds the world on
startup. Regenerate it with `node scripts/exportUnrealFixture.js`.

Controls: WASD to move, mouse to look, Space to jump. The visible character is
a placeholder cylinder with a third-person camera. To try an actual forged
world locally, save the authenticated endpoint response as a JSON file and
launch the editor/game with `-WisdoManifest="/absolute/path/to/world.json"`.
The loader accepts either the API envelope or its inner manifest. Keep that
file private because it contains the owner's world design.

The current geometry uses stock Unreal meshes. The terrain is a flat island,
mountains are cone clusters, water is a non-colliding plane, and buildings are
scaled blocks. The operation registry also creates forests, homes, city zones,
crafting labs and portal frames. This proves manifest-driven world generation;
it is not the final visual asset catalog or an Unreal Landscape implementation.
Unsupported operations are logged explicitly. Pixel Streaming, multiplayer,
remote authentication and GPU hosting are separate subsequent milestones.

## Unreal Runtime V1 in-engine validation

1. Clone the repository on a machine with Unreal Engine 5.8 and a C++ build
   toolchain. From the repository root, run `node scripts/exportUnrealFixture.js`
   and `node --test tests/unrealWorldRuntime.test.js`.
2. Open `unreal/WisdoWorld/WisdoWorld.uproject` in UE 5.8 and compile the
   project. Record any compiler errors with the source file and line number.
3. Press Play. In Output Log, filter `WISDO`. Require every `op:NN:TYPE` line,
   its expected actor count, and `WISDO_VALIDATION_PASS`. The golden scene has
   the base terrain, seven mountains, eighteen trees, ocean, castle, tower,
   home, crafting lab, three portal-frame pieces and a portal trigger.
4. From spawn at manifest `(x:0,y:1,z:6)`, verify the character stands on the
   island, moves with WASD, looks with the mouse, jumps and lands, collides with
   buildings, and walks into the portal trigger. The portal should say its
   destination is not connected. It does not teleport yet.
5. Open `/app/world/babylon-city/personal-world-v1.html?fixture=golden&debug=1`
   on the WISDO site. Compare a top-down view and a view from spawn against
   Unreal. Match the main layout and the operation IDs, not material quality.
   Save screenshots of both and the filtered UE Output Log for review.

Contract coordinates are meters with `(x,y,z)` where `y` is height. Unreal
maps these to centimeters `(100x,100z,100y)`; Babylon uses `(x,y,z)` directly.
An optional `payload.rotation.y` is a yaw in degrees. Terrain top is height
zero and the spawn capsule starts one meter above it. Babylon uses the same
island, water level, mountain and forest placement as the Unreal placeholder
generators. The `buildings` list is metadata; renderers consume `operations`
when present so a building is not instantiated twice.

This workspace does not have Unreal Editor, so C++ compilation, playability,
collision, portal overlap and visual parity remain unverified until step 2–5
are run. Do not label the renderer “V1.1 Proven” on contract tests alone.
