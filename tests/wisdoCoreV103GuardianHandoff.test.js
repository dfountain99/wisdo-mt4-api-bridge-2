import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('V10.3 guardian chamber exposes three body control anchors', async () => {
  const source=await fs.readFile(new URL('../public/app/world/command/rank-ascension.js',import.meta.url),'utf8');
  assert.match(source,/data-guardian-anchor="AUTO"/);
  assert.match(source,/data-guardian-anchor="PROTECT"/);
  assert.match(source,/data-guardian-anchor="TAKE_PROFIT"/);
  assert.match(source,/guardian-chest-core/);
});

test('V10.3 body-to-floor handoff is animated for all three controls', async () => {
  const css=await fs.readFile(new URL('../public/app/world/command/wisdo-core-v10-living-controls.css',import.meta.url),'utf8');
  assert.match(css,/v103HandoffDown/);
  assert.match(css,/data-control="auto"/);
  assert.match(css,/data-control="protect"/);
  assert.match(css,/data-control="take_profit"/);
  assert.match(css,/wisdo-v10-floor-node\.active/);
});

test('V10.3 Three.js projection paths originate from distinct guardian body zones', async () => {
  const renderer=await fs.readFile(new URL('../public/app/world/command/campaign-core-renderer.js',import.meta.url),'utf8');
  assert.match(renderer,/AUTO: \{ x: 0, z: 3\.18, color: 0x62ddff, source: \[0, 3\.18, \.2\] \}/);
  assert.match(renderer,/PROTECT: \{ x: -2\.45, z: 2\.42, color: 0x57e7c1, source: \[-\.72, 3\.0, \.16\] \}/);
  assert.match(renderer,/TAKE_PROFIT: \{ x: 2\.45, z: 2\.42, color: 0xe8bb51, source: \[\.72, 3\.0, \.16\] \}/);
  assert.match(renderer,/sourceCore/);
});

test('V10.3 preserves safe proposal execution path', async () => {
  const runtime=await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/onRequest:\s*\(\{ action \}\) => arm\(action\)/);
  assert.match(runtime,/proposal = await runtime\.propose\(/);
  assert.match(runtime,/latestReceipt = await runtime\.execute\(/);
  assert.match(runtime,/HOLD TO CONFIRM/);
});
