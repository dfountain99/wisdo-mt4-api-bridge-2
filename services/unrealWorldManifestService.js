// Engine-neutral forge data consumed by the web renderer and Unreal importer.
export function createUnrealWorldManifest(world) {
  if (!world?.worldId || world.buildStatus !== 'forged') throw new Error('forged_world_required');
  return {
    schema: 'wisdo-unreal-world-v1',
    worldId: world.worldId,
    revision: world.revision || 1,
    name: world.name,
    theme: world.theme,
    terrain: world.terrain,
    spawn: world.spawn,
    zones: world.zones,
    buildings: world.buildings,
    objects: world.objects,
    portals: world.portals,
    operations: world.forgeOperations || [],
    // Rendered assets are resolved by the Unreal project, never from user input.
    assetCatalog: 'wisdo-world-assets-v1',
  };
}
