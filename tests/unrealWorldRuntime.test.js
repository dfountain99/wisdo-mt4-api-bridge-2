import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compileHolographicPreview } from '../services/holographicBlueprintService.js';

test('Genesis acceptance prompt reaches the Unreal runtime through the shared operations', () => {
  const prompt = 'Mountain kingdom surrounded by water with a huge futuristic tower in the center.';
  const operations = compileHolographicPreview(prompt).operations;
  for (const type of ['CREATE_MOUNTAIN_RANGE','CREATE_OCEAN','CREATE_TOWER'])
    assert.ok(operations.some(op => op.type === type), `Missing ${type}`);
  const fixture = JSON.parse(fs.readFileSync('unreal/WisdoWorld/Content/WISDO/Fixtures/mountain_kingdom.json'));
  assert.deepEqual(fixture.operations, operations);
  assert.deepEqual(fixture.spawn, {x:0,y:1,z:6});
  const registry = fs.readFileSync('unreal/WisdoWorld/Source/WisdoWorld/WorldRuntimeActor.cpp','utf8');
  for (const {type} of operations) assert.ok(registry.includes(`Registry.Add(TEXT("${type}")`), `Unmapped ${type}`);
});
