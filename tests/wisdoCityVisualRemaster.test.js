import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');

test('the personal Lobby links to the existing playable City runtime',()=>{
  const root=read('public/app/world/index.html');
  const lobby=read('public/app/world/aether-lobby/index.html');
  const city=read('public/app/world/legacy.html');
  assert.match(lobby,/href="\/app\/world\?scene=city"/);
  assert.match(root,/scene==='city'.*\/app\/world\/legacy\.html/);
  assert.match(city,/world-city-remaster\.css/);
  assert.match(city,/world-v2\.js/);
  assert.match(city,/mobileControls/);
});

test('City art pass retains the existing collision and quality budgets',()=>{
  const city=read('public/app/world/world-production-city.js');
  const atmosphere=read('public/app/world/world-cinematic-layer.js');
  assert.match(city,/addCollider\(THREE,tower,colliders/);
  assert.match(city,/groundMeshes\.push/);
  assert.match(city,/quality==='low'\?24/);
  assert.match(city,/WISDOCityHeroTower/);
  assert.match(atmosphere,/const signs = quality === 'low' \? \[\]/);
  assert.match(atmosphere,/restoreLights\?\.\(\)/);
});
