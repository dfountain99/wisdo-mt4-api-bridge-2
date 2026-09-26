import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(fileURLToPath(new URL('../package.json',import.meta.url)));
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('Aether playable experiences ship race, FPS and quick arcade loops',()=>{
  const experience=read('public/app/world/experiences/index.html');
  assert.match(experience,/NEON CIRCUIT/);
  assert.match(experience,/STRIKE ZONE/);
  assert.match(experience,/COIN RUSH/);
  assert.match(experience,/data-game="race"/);
  assert.match(experience,/data-game="fps"/);
  assert.match(experience,/data-game="quick"/);
  assert.match(experience,/pointerdown/);
  assert.match(experience,/pointermove/);
  assert.doesNotMatch(experience,/MT4_SYNC_API_KEY|DISCORD_TOKEN|broker password/i);
});

test('City Arcade and personal Lobby link into playable experiences',()=>{
  const plaza=read('public/app/world/world-arcade-plaza.js');
  const lobby=read('public/app/world/aether-lobby/index.html');
  assert.match(plaza,/key === 'arcade'/);
  assert.match(plaza,/\/app\/world\/experiences\//);
  assert.match(lobby,/\/app\/world\/experiences\//);
});
