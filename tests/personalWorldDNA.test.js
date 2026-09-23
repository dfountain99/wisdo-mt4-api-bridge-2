import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultWorldDNA, applyWorldDNAUpdate, worldRuntimeManifest } from '../services/worldDNAService.js';
import { compileWorldPrompt } from '../services/worldArchitectService.js';

test('personal World DNA starts as a private floating creation seed', () => {
  const dna = createDefaultWorldDNA({ id: '42', username: 'D' });
  assert.equal(dna.worldId, 'planet:42');
  assert.equal(dna.visibility, 'private');
  assert.equal(dna.environment.biome, 'void');
  assert.equal(dna.architect.companionForm, 'blob');
  assert.match(dna.architect.openingQuestion, /what world/i);
});

test('World Architect compiles medieval FPS requests into safe DNA patches', () => {
  const dna = createDefaultWorldDNA({ id: '42', username: 'D' });
  const plan = compileWorldPrompt('Make my world a discoverable medieval FPS at night with rain and a castle', dna);
  assert.equal(plan.patch.environment.era, 'medieval');
  assert.equal(plan.patch.environment.timeOfDay, 'night');
  assert.equal(plan.patch.environment.weather, 'rain');
  assert.equal(plan.patch.gameplay.mode, 'fps');
  assert.equal(plan.patch.gameplay.perspective, 'first_person');
  assert.equal(plan.patch.visibility, 'discoverable');
  assert.equal(plan.requiresAssetGeneration, true);
  assert.equal(plan.safeRuntimeMutation, true);
});

test('World DNA mutations preserve identity and emit an engine-neutral manifest', () => {
  const original = createDefaultWorldDNA({ id: '42', username: 'D' });
  const updated = applyWorldDNAUpdate(original, {
    visibility: 'discoverable',
    environment: { era: 'future', gravity: 0.5 },
    gameplay: { mode: 'racing', modules: ['social','creator','vehicles'] },
  });
  assert.equal(updated.worldId, original.worldId);
  assert.equal(updated.discoverable, true);
  assert.equal(updated.environment.gravity, 0.5);
  assert.ok(updated.generation.revision > original.generation.revision);
  const runtime = worldRuntimeManifest(updated);
  assert.equal(runtime.rendererContract, 'wisdo-world-dna-v1');
  assert.equal(runtime.gameplay.mode, 'racing');
});
