import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePlayerState, sanitizeWorldInstance } from '../server/worldRealtimeRoutes.js';

test('World realtime alpha only accepts the Central instance', () => {
  assert.equal(sanitizeWorldInstance('central'), 'central');
  assert.equal(sanitizeWorldInstance(undefined), 'central');
  assert.equal(sanitizeWorldInstance('home'), null);
  assert.equal(sanitizeWorldInstance('../central'), null);
});

test('World realtime alpha clamps and normalizes player state', () => {
  const state = sanitizePlayerState({ x: 9999, y: -999, z: -9999, yaw: '2.5', state: 'sprint' });
  assert.deepEqual(state, { x: 160, y: -40, z: -160, yaw: 2.5, state: 'SPRINT' });
});

test('World realtime alpha rejects unknown animation states without corrupting position', () => {
  const state = sanitizePlayerState({ x: 'bad', state: '<script>' }, { x: 12, y: 3, z: -4, yaw: 1.2, state: 'RUN' });
  assert.equal(state.x, 12);
  assert.equal(state.y, 3);
  assert.equal(state.z, -4);
  assert.equal(state.yaw, 1.2);
  assert.equal(state.state, 'IDLE');
});
