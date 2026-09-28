import test from 'node:test';
import assert from 'node:assert/strict';
import { createWisdoTimeEngine } from '../public/app/world/command/wisdo-time-engine.js';

test('WISDO Time fails closed without a host', () => {
  const engine=createWisdoTimeEngine(null);
  assert.equal(typeof engine.setState,'function');
  assert.equal(typeof engine.destroy,'function');
  engine.setState({ campaignControl:null }, null);
  engine.destroy();
});

test('WISDO Time module imports without claiming server automation', async () => {
  const source=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../public/app/world/command/wisdo-time-engine.js',import.meta.url),'utf8'));
  assert.match(source,/NOT CONFIGURED/);
  assert.match(source,/STANDBY/);
  assert.match(source,/LOCAL \/ UTC/);
  assert.doesNotMatch(source,/server-confirmed schedule/i);
});
