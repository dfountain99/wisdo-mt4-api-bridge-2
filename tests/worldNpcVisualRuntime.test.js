import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildNpcVisualDescriptor,
  collectReadyNpcVisuals,
  resolveNearbyNpc,
} from '../public/app/world/world-npc-visual-runtime.js';
import { resolveNpcRuntime } from '../public/app/world/npc-runtime-registry.js';
import { OG_MASTER_WISDO } from '../public/app/world/og-master-wisdo-contract.js';
import { validateJob } from '../tools/blender/bridge/protocol.mjs';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const worldFile = (name) => fs.readFileSync(path.join(root, 'public', 'app', 'world', name), 'utf8');

function syntheticOgMasterAsset(overrides = {}) {
  return Object.freeze({
    id: 'og-master-wisdo',
    kind: 'npc',
    format: 'glb',
    url: '/world-assets/characters/npcs/og-master-wisdo/og_master_wisdo.glb',
    reportUrl: '/world-assets/characters/npcs/og-master-wisdo/og_master_wisdo.report.json',
    license: 'USER_PROVIDED',
    provenance: 'Original OG MASTER WISDO founder/legendary mentor NPC created for WISDO World.',
    targetHeightMeters: 1.84,
    rotationY: 0,
    clips: Object.freeze({
      idle: Object.freeze(['IDLE']),
      seated: Object.freeze(['SEATED_IDLE']),
      speak: Object.freeze(['SPEAK']),
      point: Object.freeze(['POINT']),
      walk: Object.freeze(['WALK_FORWARD']),
    }),
    ...overrides,
  });
}

test('OG MASTER visual collection stays empty until a real generated NPC GLB is registered', () => {
  assert.deepEqual(collectReadyNpcVisuals(), []);
  assert.equal(buildNpcVisualDescriptor(OG_MASTER_WISDO, resolveNpcRuntime(OG_MASTER_WISDO)), null);
});

test('registered OG MASTER GLB resolves into a spawn descriptor at the Academy contract anchor', () => {
  const asset = syntheticOgMasterAsset();
  const catalog = Object.freeze({ 'og-master-wisdo': asset });
  const descriptors = collectReadyNpcVisuals({ catalog });
  assert.equal(descriptors.length, 1);
  const descriptor = descriptors[0];
  assert.equal(descriptor.assetId, 'og-master-wisdo');
  assert.equal(descriptor.asset.url, asset.url);
  assert.deepEqual(descriptor.position, [-42, 0, -49]);
  assert.equal(descriptor.interactionRadius, 5.25);
  assert.equal(descriptor.targetHeightMeters, 1.84);
  assert.deepEqual(descriptor.asset.clips.seated, ['SEATED_IDLE']);
  assert.deepEqual(descriptor.asset.clips.speak, ['SPEAK']);
});

test('non-GLB or URL-less generated metadata cannot create an NPC visual descriptor', () => {
  const wrongFormat = syntheticOgMasterAsset({ format: 'fbx' });
  const noUrl = syntheticOgMasterAsset({ url: '' });
  assert.deepEqual(collectReadyNpcVisuals({ catalog: { 'og-master-wisdo': wrongFormat } }), []);
  assert.deepEqual(collectReadyNpcVisuals({ catalog: { 'og-master-wisdo': noUrl } }), []);
});

test('NPC proximity is deterministic and bounded by the contract interaction radius', () => {
  const asset = syntheticOgMasterAsset();
  const descriptor = collectReadyNpcVisuals({ catalog: { 'og-master-wisdo': asset } })[0];
  const inside = resolveNearbyNpc([descriptor], { x: -42.5, z: -48.75 });
  assert.equal(inside?.descriptor.assetId, 'og-master-wisdo');
  assert.ok(inside.distance < descriptor.interactionRadius);
  assert.equal(resolveNearbyNpc([descriptor], { x: -20, z: -20 }), null);
});

test('active World entry point installs NPC visuals as a non-authoritative production layer', () => {
  const source = worldFile('world3d.js');
  assert.match(source, /createProductionWorldExperience/);
  assert.match(source, /installWorldNpcVisuals/);
  assert.match(source, /Generated NPC visuals unavailable; production World continues/);
  assert.match(source, /npcVisualRuntime/);
  assert.doesNotMatch(source, /placeTrade|closeTrade|executeTrade|commandBus/);
});

test('canonical OG MASTER Blender job is valid and remains a character-to-NPC registration', () => {
  const templatePath = path.join(root, 'tools', 'blender', 'jobs', 'og-master-wisdo.template.json');
  const raw = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const job = validateJob(raw);
  assert.equal(job.assetId, 'og-master-wisdo');
  assert.equal(job.assetType, 'character');
  assert.equal(job.registerTarget, 'npc');
  assert.equal(job.output, 'public/world-assets/characters/npcs/og-master-wisdo/og_master_wisdo.glb');
  assert.equal(job.report, 'public/world-assets/characters/npcs/og-master-wisdo/og_master_wisdo.report.json');
  assert.deepEqual(job.clips.SPEAK, ['SPEAK']);
});
