import test from 'node:test';
import assert from 'node:assert/strict';
import { WisdoPresenceLearningService, WISDO_PRESENCE_MODES } from '../services/wisdoPresenceLearningService.js';
import { CEM_NEURAL_LAYOUT } from '../services/cemNeuralCommandService.js';

test('presence manifest exposes room modes and hard consent boundaries', () => {
  const service = new WisdoPresenceLearningService();
  const manifest = service.manifest();
  assert.ok(Object.keys(WISDO_PRESENCE_MODES).length >= 10);
  assert.equal(manifest.screenShare.nativeDiscordStreamAccess, false);
  assert.equal(manifest.screenShare.requiresExplicitCompanionShare, true);
  assert.equal(manifest.recording.default, false);
  assert.equal(manifest.financialExecution.receiptRequired, true);
});

test('recorded presence rejects missing participant consent', () => {
  const service = new WisdoPresenceLearningService();
  assert.throws(() => service.startSession({ mode: 'coach', participants: ['a', 'b'], consent: { recording: true, participantIds: ['a'] } }), /Every participant/);
  const session = service.startSession({ mode: 'instructor', participants: ['a'], consent: { recording: true, participantIds: ['a'] } });
  assert.equal(session.status, 'active');
});

test('voice-to-course draft includes curriculum, placement, promotion, and governance', () => {
  const service = new WisdoPresenceLearningService();
  const draft = service.createCourseDraft({ ownerId: 'u1', guildId: 'g1', title: 'risk mastery', outcome: 'calculate position size safely', audience: 'new operators', source: 'consented coaching session' });
  assert.equal(draft.modules.length, 6);
  assert.ok(draft.channels.some(([name]) => name === 'curriculum'));
  assert.ok(draft.voiceChannels.includes('live-classroom'));
  assert.equal(draft.promotion.status, 'approval_required');
  assert.equal(draft.governance.publishRequiresStaff, true);
});

test('Neural installer includes classroom and creator-studio surfaces', () => {
  const academy = CEM_NEURAL_LAYOUT.find((section) => section.category.includes('ACADEMY'));
  const studio = CEM_NEURAL_LAYOUT.find((section) => section.category.includes('CREATOR STUDIO'));
  assert.ok(academy.voice.includes('live-classroom'));
  assert.ok(studio.channels.some(([name]) => name === 'promotion-review'));
});
