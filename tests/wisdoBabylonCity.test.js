import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Babylon full city is present inside the production world tree', () => {
  const root = process.cwd();
  for (const rel of [
    'public/app/world/babylon-city/index.html',
    'public/app/world/babylon-city/world.js',
    'public/app/world/babylon-city/README.md',
    'public/app/world/babylon-city.js',
  ]) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
  }
  const html = fs.readFileSync(path.join(root, 'public/app/world/babylon-city/index.html'), 'utf8');
  const runtime = fs.readFileSync(path.join(root, 'public/app/world/babylon-city/world.js'), 'utf8');
  assert.match(html, /babylonjs/i);
  assert.match(runtime, /WISDO_WORLD/);
  assert.match(runtime, /WISDO ACADEMY/);
  assert.match(runtime, /MASTER CHAMBER/);
  assert.match(runtime, /TRADING HALL/);
  assert.match(runtime, /BOT VAULT/);
});
