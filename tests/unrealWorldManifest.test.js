import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnrealWorldManifest } from '../services/unrealWorldManifestService.js';

test('Unreal handoff preserves approved world operations and identity', () => {
  const world = { worldId:'world:1', buildStatus:'forged', revision:3,
    name:'Mountain Kingdom', theme:'future', terrain:{type:'spawn-island'},
    spawn:{x:0,y:1,z:6}, buildings:[], zones:[], objects:[], portals:[],
    forgeOperations:[{type:'CREATE_MOUNTAIN_RANGE',payload:{height:5}}] };
  const manifest = createUnrealWorldManifest(world);
  assert.equal(manifest.schema, 'wisdo-unreal-world-v1');
  assert.equal(manifest.revision, 3);
  assert.deepEqual(manifest.operations, world.forgeOperations);
  assert.throws(() => createUnrealWorldManifest({...world,buildStatus:'draft'}));
});
