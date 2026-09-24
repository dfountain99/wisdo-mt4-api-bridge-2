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

This repository currently contains the manifest handoff and a data-driven web
preview. It does not contain an Unreal project, packaged build, GPU host, or
Pixel Streaming deployment. The web server cannot run Unreal by itself.
