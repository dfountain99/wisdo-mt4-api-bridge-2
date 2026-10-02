import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(fileURLToPath(new URL('../package.json',import.meta.url)));
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('Aether Arcade links to the 3D race and labels remaining flat-screen games honestly',()=>{
  const experience=read('public/app/world/experiences/index.html');
  assert.match(experience,/Street Sprint/);
  assert.match(experience,/STRIKE ZONE/);
  assert.match(experience,/COIN RUSH/);
  assert.match(experience,/href="\/app\/world\/experiences\/street-sprint\.html"/);
  assert.match(experience,/data-game="fps"/);
  assert.match(experience,/data-game="quick"/);
  assert.match(experience,/pointerdown/);
  assert.match(experience,/pointermove/);
  assert.doesNotMatch(experience,/data-game="race"|PLACEMENT REWARD|MATCH REWARD PREVIEW/);
  assert.doesNotMatch(experience,/MT4_SYNC_API_KEY|DISCORD_TOKEN|broker password/i);
});

test('City Arcade and personal Lobby link into playable experiences',()=>{
  const plaza=read('public/app/world/world-arcade-plaza.js');
  const lobby=read('public/app/world/aether-lobby/index.html');
  assert.match(plaza,/key === 'arcade'/);
  assert.match(plaza,/\/app\/world\/experiences\//);
  assert.match(lobby,/\/app\/world\/experiences\//);
  assert.match(lobby,/street-sprint\.html/);
  assert.doesNotMatch(lobby,/3 friends online|1,240|Party ready|\+200/);
});

test('Street Sprint is a WebGL race with checkpoints, mobile controls and honest solo status',()=>{
  const html=read('public/app/world/experiences/street-sprint.html');
  const game=read('public/app/world/experiences/street-sprint.js');
  assert.match(html,/street-sprint\.js/);
  assert.match(html,/value="5" checked/);
  assert.match(html,/value="15"/);
  assert.match(html,/data-key="ArrowUp"/);
  assert.match(html,/id="pause"/);
  assert.match(html,/Friends, phone alerts and Culture Coin payouts are not live yet/);
  assert.match(game,/THREE\.WebGLRenderer/);
  assert.match(game,/depositCheckpoint/);
  assert.match(game,/localRaceResult/);
  assert.match(game,/onRail/);
  assert.doesNotMatch(game,/fetch\(['"]\/api\/arcade\/sessions/);
});
