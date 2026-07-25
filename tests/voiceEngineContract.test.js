import test from 'node:test';
import assert from 'node:assert/strict';
import { WisdoVoiceService } from '../server/voiceRoutes.js';

test('sovereign voice is slow, original, and mature', () => {
  const service = new WisdoVoiceService();
  const profile = service.resolveProfile({ profile: 'sovereign' });
  assert.equal(profile.id, 'sovereign');
  assert.ok(profile.speed < 1);
  assert.match(profile.instructions, /original mature Black male mentor/i);
  assert.match(profile.instructions, /do not|never imitate/i);
});

test('voice speed remains within provider boundaries', () => {
  const service = new WisdoVoiceService();
  assert.equal(service.resolveProfile({ speed: 99 }).speed, 4);
  assert.equal(service.resolveProfile({ speed: 0 }).speed, 0.25);
});
