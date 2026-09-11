import test from 'node:test';
import assert from 'node:assert/strict';

import {
  chooseQualityFromCapabilities,
  createAdaptiveQualityController,
  stepQuality,
} from '../public/app/world/world-quality.js';

test('coarse/touch input alone never forces WISDO World to LOW', () => {
  const quality = chooseQualityFromCapabilities({
    coarse: true,
    touchLike: true,
    webgl2: true,
    memoryGb: null,
    memoryKnown: false,
    cores: 6,
    renderPixels: 1_500_000,
  });
  assert.equal(quality, 'medium');
});

test('Safari-style unknown deviceMemory is not treated as 4 GB', () => {
  const quality = chooseQualityFromCapabilities({
    coarse: true,
    touchLike: true,
    webgl2: true,
    memoryGb: null,
    memoryKnown: false,
    cores: 4,
    renderPixels: 1_400_000,
  });
  assert.equal(quality, 'medium');
});

test('genuinely constrained devices may still start LOW', () => {
  assert.equal(chooseQualityFromCapabilities({
    coarse: true,
    touchLike: true,
    webgl2: false,
    memoryGb: 2,
    memoryKnown: true,
    cores: 2,
    renderPixels: 1_000_000,
  }), 'low');
});

test('capable desktop can start HIGH', () => {
  assert.equal(chooseQualityFromCapabilities({
    coarse: false,
    touchLike: false,
    webgl2: true,
    memoryGb: 16,
    memoryKnown: true,
    cores: 12,
    renderPixels: 3_000_000,
  }), 'high');
});

test('quality stepping is bounded', () => {
  assert.equal(stepQuality('medium', -1), 'low');
  assert.equal(stepQuality('medium', 1), 'high');
  assert.equal(stepQuality('low', -1), 'low');
  assert.equal(stepQuality('high', 1), 'high');
});

test('adaptive controller uses sustained samples and hysteresis', () => {
  const changes = [];
  let time = 0;
  const controller = createAdaptiveQualityController({
    initialQuality: 'medium',
    downgradeSamples: 3,
    upgradeSamples: 4,
    cooldownMs: 0,
    lowFps: 27,
    highFps: 52,
    now: () => time,
    setQuality: (quality) => changes.push(quality),
  });

  for (const fps of [20, 22]) { time += 1000; controller.sample({ fps }); }
  assert.equal(controller.quality, 'medium');
  time += 1000; controller.sample({ fps: 21 });
  assert.equal(controller.quality, 'low');
  assert.deepEqual(changes, ['low']);

  for (const fps of [58, 59, 60]) { time += 1000; controller.sample({ fps }); }
  assert.equal(controller.quality, 'low');
  time += 1000; controller.sample({ fps: 60 });
  assert.equal(controller.quality, 'medium');
  assert.deepEqual(changes, ['low', 'medium']);
});
