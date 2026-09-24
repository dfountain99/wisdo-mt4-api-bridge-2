import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compileHolographicPreview } from '../services/holographicBlueprintService.js';

test('Genesis acceptance prompt reaches the Unreal runtime through the shared operations', () => {
  const prompt = 'Aurelia Prime: Futuristic mountain kingdom island surrounded by water, city, huge tower in the center, forest, private home, crafting lab and portal.';
  const operations = compileHolographicPreview(prompt).operations;
  for (const type of ['CREATE_MOUNTAIN_RANGE','CREATE_OCEAN','CREATE_TOWER','CREATE_FOREST','CREATE_HOME','CREATE_CRAFTING_LAB','CREATE_PORTAL'])
    assert.ok(operations.some(op => op.type === type), `Missing ${type}`);
  const fixture = JSON.parse(fs.readFileSync('public/app/world/fixtures/golden-world.json'));
  assert.deepEqual(fixture.operations, operations);
  assert.deepEqual(fixture.spawn, {x:0,y:1.8,z:600});
  const registry = fs.readFileSync('unreal/WisdoWorld/Source/WisdoWorld/WorldRuntimeActor.cpp','utf8');
  for (const {type} of operations) assert.ok(registry.includes(`Registry.Add(TEXT("${type}")`), `Unmapped ${type}`);
  const browser = fs.readFileSync('public/app/world/babylon-city/personal-world-v1.js','utf8');
  for (const {type} of operations) assert.ok(browser.includes(`${type}:`), `Babylon unmapped ${type}`);
  assert.match(browser, /if\(!operations\.length\)/, 'Metadata fallback should only run when operations are absent');
  assert.match(registry, /WISDO_VALIDATION_/, 'UE must report an explicit validation result');
  assert.match(registry, /CurrentOperationId = Operation.Id.IsEmpty/, 'UE must trace manifest operation IDs');
});
