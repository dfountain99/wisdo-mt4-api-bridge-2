import test from 'node:test';
import assert from 'node:assert/strict';

import { CemNeuralCommandService, CEM_NEURAL_COLORS, CEM_NEURAL_LAYOUT } from '../services/cemNeuralCommandService.js';
import { createCommandRegistry } from '../commands/index.js';

function fakeGuild() {
  const members = new Map([['1', { presence: { status: 'online' } }], ['2', { presence: { status: 'offline' } }]]);
  members.filter = (predicate) => new Map([...members].filter(([, member]) => predicate(member)));
  return { memberCount: 2, members: { cache: members } };
}

test('CEM Neural Gateway exposes the futuristic command deck controls', () => {
  const service = new CemNeuralCommandService();
  const payload = service.buildGatewayPayload(fakeGuild());
  const json = payload.embeds[0].toJSON();
  assert.equal(json.color, CEM_NEURAL_COLORS.gold);
  assert.match(json.title, /WISDO CORE/);
  assert.match(json.description, /PEOPLE.*DISCIPLINE.*PROGRESS/s);
  assert.deepEqual(payload.components[0].components.map((button) => button.data.custom_id), [
    'cem_neural:capsule', 'cem_neural:mission', 'cem_neural:wisdo', 'cem_neural:pulse',
  ]);
});

test('CEM Neural layout is substantial, organized, and does not replace private desks', () => {
  assert.ok(CEM_NEURAL_LAYOUT.length >= 6);
  assert.ok(CEM_NEURAL_LAYOUT.some((section) => section.category.includes('NEURAL GATEWAY')));
  assert.ok(CEM_NEURAL_LAYOUT.some((section) => section.category.includes('WISDO CORE')));
  assert.ok(CEM_NEURAL_LAYOUT.some((section) => section.category.includes('BOT CHAMBER')));
  assert.equal(CEM_NEURAL_LAYOUT.some((section) => section.category.includes('OPERATOR CAPSULES')), false);
});

test('canonical command registry remains within Discord limit while Neural controls attach to existing help', () => {
  const registry = createCommandRegistry({});
  assert.ok(registry.commandMap.has('wisdo-help'));
  assert.ok(registry.audit.commandCount <= 100);
});
