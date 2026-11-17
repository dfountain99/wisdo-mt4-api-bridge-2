import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GenesisMultiplayerPresence} from '../server/genesisMultiplayer.js';
import {ensureGenesisIsland,genesisIslandDirectory,genesisIslandName}
  from '../server/genesisIslands.js';
import {createGenesisProfile} from '../services/genesisGameService.js';

test('100 distinct home islands are allocated without reassigning returning accounts',()=>{
  const state={genesisProfilesByUserId:{}};
  for(let i=0;i<100;i++){
    const id='player-'+i;
    state.genesisProfilesByUserId[id]=createGenesisProfile(id);
    const result=ensureGenesisIsland(state,state.genesisProfilesByUserId[id]);
    assert.equal(result.homeIslandId,'island-'+(i+1));
    assert.equal(result.currentIslandId,result.homeIslandId);
  }
  assert.equal(genesisIslandDirectory(state).length,100);
  const first=state.genesisProfilesByUserId['player-0'];
  const original=first.homeIslandId;
  first.currentIslandId='island-2';
  ensureGenesisIsland(state,first);
  assert.equal(first.homeIslandId,original);
  assert.equal(first.currentIslandId,'island-2');
  assert.equal(genesisIslandName('island-100'),'Island 100');
});

test('legacy Genesis saves retain structures and creatures on island assignment',()=>{
  const state={genesisProfilesByUserId:{legacy:createGenesisProfile('legacy')}};
  const legacy=state.genesisProfilesByUserId.legacy;
  legacy.structures=[{id:'kept-house',kind:'hut',x:3,z:4}];
  legacy.tamedCreatures={voltfang:{id:'voltfang'}};
  ensureGenesisIsland(state,legacy);
  assert.equal(legacy.homeIslandId,'island-1');
  assert.equal(legacy.structures[0].id,'kept-house');
  assert.equal(legacy.tamedCreatures.voltfang.id,'voltfang');
});

test('nearby player snapshots cannot cross island instances',()=>{
  const presence=new GenesisMultiplayerPresence({clock:()=>5000});
  presence.join('owner',{islandId:'island-1'});
  presence.join('neighbor',{islandId:'island-2'});
  assert.equal(presence.nearby('owner').players.length,0);
  presence.teleport('neighbor',{x:0,z:0,islandId:'island-1'},5000);
  assert.equal(presence.nearby('owner').players.length,1);
  presence.teleport('neighbor',{x:0,z:0,islandId:'island-2'},5000);
  assert.equal(presence.nearby('owner').players.length,0);
});

test('route and world atlas expose authorized island visit flow',()=>{
  const routes=readFileSync(new URL('../server/genesisRoutes.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../public/genesis.html',import.meta.url),'utf8');
  const client=readFileSync(new URL('../public/js/genesisWorld.js',import.meta.url),'utf8');
  assert.match(routes,/\/api\/genesis\/islands/);
  assert.match(routes,/genesisIslandDirectory\(state\)/);
  assert.match(routes,/currentIslandId=targetId/);
  assert.match(html,/id="island-list"/);
  assert.match(client,/refreshIslandDirectory/);
});
