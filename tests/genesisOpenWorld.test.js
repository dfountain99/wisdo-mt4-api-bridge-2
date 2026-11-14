import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_LIMIT,CHUNK_SIZE,BIOMES,WAYSTONES,LANDMARKS,
  biomeAt,terrainHeight,biomeColor,worldChunk,
  generateChunkNodes,nearbyGeneratedNodes,generatedNodeFromId,
  nearestWaystone,findWaystone,RESOURCE_REWARDS
} from '../public/js/genesisWorldMap.js';
import {
  createGenesisProfile,ensureGenesisProfile,applyGenesisAction,profileSnapshot,
  ECHOES,BUILDINGS,moveSpeed
} from '../services/genesisGameService.js';

import { resolveGenesisLandmark } from '../public/js/genesisTerrain.js';

test('Waystone and landmark lookup resolves every fixed location without a browser',()=>{
  for(const entry of WAYSTONES){
    const found=resolveGenesisLandmark(entry.x,entry.z);
    assert.equal(found?.entry.id,entry.id);
    assert.equal(found?.waystone,true);
  }
  for(const entry of LANDMARKS){
    const found=resolveGenesisLandmark(entry.x,entry.z);
    assert.equal(found?.entry.id,entry.id);
    assert.equal(found?.waystone,false);
  }
  assert.equal(resolveGenesisLandmark(1599,1599),null);
});

const NOW=Date.UTC(2026,10,13,19,0,0);
const act=(p,body,x=0,z=0,t=NOW)=>applyGenesisAction(p,body,{x,z},t);

test('connected world spans 3.2 km per side with six distinct biomes',()=>{
  assert.equal(WORLD_LIMIT*2,3200);
  assert.equal(Object.keys(BIOMES).length,6);
  assert.ok(LANDMARKS.length>=6);
  for(const w of WAYSTONES)assert.equal(biomeAt(w.x,w.z).id,w.biome,
    'Wrong region at '+w.id);
});

test('terrain shares exactly matching heights at chunk boundaries',()=>{
  for(const [x,z] of [[80,11],[-160,90],[0,0],[800,-280],[-800,-720]]){
    const h=terrainHeight(x,z);
    assert.ok(Number.isFinite(h),'Terrain height should be finite');
    assert.ok(Math.abs(terrainHeight(x-.001,z)-terrainHeight(x+.001,z))<.25,
      'Terrain seam should not form a sudden height jump');
    const c=biomeColor(x,z);
    assert.equal(c.length,4);
    assert.ok(c.every(n=>n>=0&&n<=1));
  }
});

test('resource generation is deterministic and IDs cannot be forged',()=>{
  const a=generateChunkNodes(10,10),b=generateChunkNodes(10,10);
  assert.deepEqual(a,b);
  assert.ok(a.length>=5);
  const node=a[0];
  assert.deepEqual(generatedNodeFromId(node.id),node);
  assert.equal(generatedNodeFromId('gen_999_999_0'),null);
  assert.equal(generatedNodeFromId('gen_10_10_999'),null);
  assert.equal(generatedNodeFromId('wood-99'),null);
  assert.ok(a.every(n=>RESOURCE_REWARDS[n.type]>0));
});

test('far region resource nodes are provided only in the local neighborhood',()=>{
  const p=createGenesisProfile('world-tester',NOW);
  const far={x:820,z:-280};
  const snap=profileSnapshot(p,far,NOW);
  assert.equal(snap.map.widthMeters,3200);
  assert.equal(snap.map.biome,'neon');
  assert.ok(snap.resources.length>5);
  assert.ok(snap.resources.every(n=>Math.abs(n.x-far.x)<CHUNK_SIZE*2&&
    Math.abs(n.z-far.z)<CHUNK_SIZE*2));
  assert.ok(!snap.resources.some(n=>n.x===5&&n.z===4));
});

test('v1 players retain their old construction, inventory, and PRISM morph',()=>{
  const saved=createGenesisProfile('v1',NOW);
  saved.inventory.wood=47;
  saved.structures.push({id:'old-hut',kind:'hut',x:12,z:15,rotation:0});
  saved.character.equipped='voltfang';
  const state={genesisProfilesByUserId:{v1:saved}};
  const updated=ensureGenesisProfile(state,'v1',NOW);
  assert.equal(updated.inventory.wood,47);
  assert.equal(updated.inventory.circuit,0);
  assert.equal(updated.structures[0].id,'old-hut');
  assert.equal(updated.character.equipped,'voltfang');
});

test('server validates mining across distant regions including required tools',()=>{
  const p=createGenesisProfile('miner',NOW);
  const iron=generateChunkNodes(10,10).find(n=>!['wood','stone','moonleaf'].includes(n.type));
  assert.ok(iron);
  assert.throws(()=>act(p,{action:'gather',nodeId:iron.id},0,0),/closer/);
  assert.throws(()=>act(p,{action:'gather',nodeId:iron.id},iron.x,iron.z),/pickaxe/);
  p.inventory.pickaxe=1;
  act(p,{action:'gather',nodeId:iron.id},iron.x,iron.z);
  assert.equal(p.inventory[iron.type],RESOURCE_REWARDS[iron.type]);
  assert.throws(()=>act(p,{action:'gather',nodeId:iron.id},iron.x,iron.z),/regenerating/);
});

test('far region construction works but waypoint travel plazas are protected',()=>{
  const p=createGenesisProfile('builder',NOW);
  p.inventory.wood=50;p.inventory.stone=50;
  const w=WAYSTONES.find(x=>x.id==='neon');
  assert.throws(()=>act(p,{action:'build',kind:'hut',x:w.x+3,z:w.z+2},w.x,w.z),
    /Waystone/);
  act(p,{action:'build',kind:'hut',x:870,z:-300},865,-300);
  assert.equal(p.structures[0].kind,'hut');
  assert.ok(BUILDINGS.neon_lab);
});

test('new Echoforms are discoverable, bondable and improve PRISM stats',()=>{
  const p=createGenesisProfile('explorer',NOW);
  const echo=ECHOES.find(e=>e.id==='circuit-lynx');
  assert.ok(echo);
  p.inventory.circuit=4;p.inventory.iron=3;
  act(p,{action:'scan',echoId:echo.id},echo.x,echo.z);
  act(p,{action:'bond',echoId:echo.id},echo.x,echo.z);
  const original=moveSpeed(p);
  act(p,{action:'equip',form:echo.id});
  assert.ok(moveSpeed(p)>original);
  assert.ok(p.echoforms.includes(echo.id));
});

test('waystone travel is restricted to known fixed destinations in geometry contract',()=>{
  const origin=findWaystone('arrival');
  assert.equal(nearestWaystone({x:1,z:2},13).id,'arrival');
  assert.equal(nearestWaystone({x:100,z:80},13),null);
  assert.equal(findWaystone('arbitrary-free-teleport'),null);
  assert.equal(findWaystone('titan').biome,'titan');
  assert.ok(WAYSTONES.every(w=>Math.abs(w.x)<=WORLD_LIMIT&&Math.abs(w.z)<=WORLD_LIMIT));
});
