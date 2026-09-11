import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveWorldTier, worldCatalog } from '../server/worldRoutes.js';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('WISDO World catalog exposes the immersive destinations without trade execution authority', () => {
  const catalog = worldCatalog();
  assert.equal(catalog.ok, true);
  assert.equal(catalog.executionFromWorldEnabled, false);
  assert.equal(catalog.billingConnected, false);
  assert.ok(catalog.destinations.length >= 10);
  assert.ok(catalog.destinations.some((item) => item.id === 'trading-tower' && item.route === '/member/command-center'));
  assert.ok(catalog.destinations.some((item) => item.id === 'academy' && item.route === '/member/education'));
  assert.ok(catalog.destinations.some((item) => item.id === 'war-room' && item.minTier === 'Commander'));
});

test('WISDO World tier resolver maps existing WISDO identity roles conservatively', () => {
  assert.equal(resolveWorldTier({ id: '1', roles: ['member'] }, {}).label, 'Member');
  assert.equal(resolveWorldTier({ id: '2', roles: ['premium_member'] }, {}).label, 'Sovereign');
  assert.equal(resolveWorldTier({ id: '3', roles: ['vip_member'] }, {}).label, 'Elite');
  assert.equal(resolveWorldTier({ id: '4', roles: ['owner'] }, {}).label, 'Commander');
});

test('WISDO World static workspace is present and points to its native asset bundle', () => {
  const indexFile = path.join(root, 'public', 'app', 'world', 'index.html');
  const cssFile = path.join(root, 'public', 'app', 'world', 'world.css');
  const jsFile = path.join(root, 'public', 'app', 'world', 'world.js');
  assert.equal(fs.existsSync(indexFile), true);
  assert.equal(fs.existsSync(cssFile), true);
  assert.equal(fs.existsSync(jsFile), true);
  const html = fs.readFileSync(indexFile, 'utf8');
  assert.match(html, /\/world\/assets\/world\.css/);
  assert.match(html, /\/world\/assets\/world\.js/);
});
