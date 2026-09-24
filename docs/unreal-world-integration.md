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
map is intentionally empty. `AWisdoWorldGameMode` loads the fixture generated
by `node scripts/exportUnrealFixture.js` and builds the world on startup.

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

This environment does not have Unreal Editor installed, so C++ compilation,
playability and the rendered result still require verification in Unreal 5.8.
