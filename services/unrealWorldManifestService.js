// Engine-neutral forge data consumed by the web renderer and Unreal importer.
import {WORLD_SCALE} from './worldSpatialPlanner.js';
export function createUnrealWorldManifest(world) {
  if (!world?.worldId || world.buildStatus !== 'forged') throw new Error('forged_world_required');
  return {
    schema: 'wisdo-unreal-world-v1',
    worldId: world.worldId,
    revision: world.revision || 1,
    name: world.name,
    theme: world.theme,
    themeIdentity: world.themeIdentity,
    seed: world.seed,
    fidelityVersion: world.fidelityVersion,
    world: world.world,
    worldScale: world.worldScale||WORLD_SCALE,
    intent: world.intent,
    forgeTruth: world.forgeTruth,
    terrain: world.terrain,
    spawn: world.spawn,
    zones: world.zones,
    buildings: world.buildings,
    objects: world.objects,
    portals: world.portals,
    operations: world.forgeOperations || [],
    // Rendered assets are resolved by the Unreal project, never from user input.
    assetCatalog: world.assetCatalog || 'wisdo-world-assets-v1',
  };
}
