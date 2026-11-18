# Genesis abandoned aircraft integration - first phase

The uploaded aircraft is a weathered, multi-engine airplane (GLB v2, one static mesh,
one PBR material, three embedded 2K textures, approximately 93,707 triangles).
It has **no animations or moving-part rig**. The source model's authored scale
is about 1.9 units across the wings and needs approximately 10x scaling for
an aircraft-sized preview in Genesis.

## Asset deployment

1. Confirm the artist/source's license permits redistribution before publicly deploying.
2. Copy the mobile preview GLB into
   `public/assets/genesis/vehicles/abandoned_aircraft.glb`.
   A full-texture original is available in the separate integration package.
3. Serve `/assets/genesis/vehicles/abandoned_aircraft.glb` using
   `registerGenesisAssetRoutes`. The branch also fixes the previously missing
   `/assets/genesis/reality/` static mount.
4. Verify the URL responds 200 with `Content-Type: model/gltf-binary`.
5. After Babylon and its GLB loader are initialized, import
   `loadGenesisAircraft` from `/js/genesisAircraft.js`; call the function and
   use the returned `spawn({x,y,z,scale:10,rotationY:0})` to preview one plane.
6. Keep it out of automatic world spawning until mobile FPS, terrain placement,
   collisions, license documentation, and persistence tests are complete.

## Proposed game mechanics (not yet implemented)

A broken aircraft is world-seeded and saved by the multiplayer server.
Repair state is server-authoritative: discovered -> salvage -> repair ->
taxi -> flight. Each aircraft should have an ID, owner/island reference,
durability, missing parts, fuel, seats, position, velocity and permissions.
The server validates crafting costs, movement, collisions, occupants and
cross-island travel. Client art changes are only a visualization.

Aircraft art production will need separate propeller meshes/animation,
landing gear, cockpit, collision hulls, distance LODs, wreck states,
and a lower triangle budget for mobile. Do not treat this unrigged GLB
as a complete flyable game vehicle.

## Release gates

- Artist licensing verified
- Optional GLB returns 200; absent GLB leaves Genesis playable
- No regression in original tree/explorer asset loading
- iPhone performance tested with terrain and other players loaded
- Flight and repair cannot be exploited by client-only state
