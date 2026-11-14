import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createGenesisProfile, ensureGenesisProfile, applyGenesisAction, profileSnapshot,
 getStats, moveSpeed, worldWeather, RESOURCE_NODES, ECHOES, RECIPES, BUILDINGS,
} from '../services/genesisGameService.js';

const NOW=Date.UTC(2026,10,13,18,0,0);
function fresh(){return createGenesisProfile('player-1',NOW);}
const action=(profile,body,position={x:0,z:0},time=NOW)=>applyGenesisAction(profile,body,position,time);

test('players begin private and have no fabricated inventory',()=>{
 const profile=fresh(),view=profileSnapshot(profile,{x:0,z:0},NOW);
 assert.equal(view.realm,'private');
 assert.equal(view.inventory.wood,0);
 assert.equal(view.structures.length,0);
 assert.equal(view.echoes.filter(x=>x.bonded).length,0);
 assert.equal(view.statPoints,8);
 assert.ok(view.resources.length>=RESOURCE_NODES.length);
 assert.ok(view.resources.some(x=>x.id.startsWith('gen_')), 'New streamed resources should accompany original starting nodes');
});

test('separate WISDO accounts receive separate inventories and buildings',()=>{
 const state={};const one=ensureGenesisProfile(state,'owner',NOW);
 const two=ensureGenesisProfile(state,'friend',NOW);
 one.inventory.wood=6;
 assert.equal(two.inventory.wood,0);
 assert.notStrictEqual(one,two);
});

test('harvesting is location-gated, finite, and respawns',()=>{
 const p=fresh(),node=RESOURCE_NODES.find(x=>x.type==='wood');
 assert.throws(()=>action(p,{action:'gather',nodeId:node.id},{x:0,z:0}),/closer/);
 assert.equal(action(p,{action:'gather',nodeId:node.id},{x:node.x,z:node.z}).ok,true);
 assert.equal(p.inventory.wood,2);
 assert.throws(()=>action(p,{action:'gather',nodeId:node.id},{x:node.x,z:node.z}),/regenerating/);
 const after=NOW+node.respawnMs+1;
 assert.equal(action(p,{action:'gather',nodeId:node.id},{x:node.x,z:node.z},after).ok,true);
 assert.equal(p.inventory.wood,4);
});
test('pickaxe is required for iron and crystal mining',()=>{
 const p=fresh(),iron=RESOURCE_NODES.find(x=>x.type==='iron');
 const pos={x:iron.x,z:iron.z};
 assert.throws(()=>action(p,{action:'gather',nodeId:iron.id},pos),/pickaxe/);
 p.inventory.wood=3;p.inventory.stone=3;
 action(p,{action:'craft',recipe:'pickaxe'});
 assert.equal(p.inventory.pickaxe,1);
 action(p,{action:'gather',nodeId:iron.id},pos);
 assert.equal(p.inventory.iron,1);
 assert.throws(()=>action(p,{action:'craft',recipe:'pickaxe'}),/already/);
});

test('crafting cannot create materials without spending inputs',()=>{
 const p=fresh();
 assert.throws(()=>action(p,{action:'craft',recipe:'planks'}),/Not enough wood/);
 p.inventory.wood=2;
 action(p,{action:'craft',recipe:'planks'});
 assert.equal(p.inventory.wood,0);
 assert.equal(p.inventory.planks,4);
 assert.throws(()=>action(p,{action:'craft',recipe:'nonexistent'}),/Unknown/);
});
test('energy core requires a player-built workbench',()=>{
 const p=fresh();
 p.inventory.iron=5;p.inventory.crystal=5;
 assert.throws(()=>action(p,{action:'craft',recipe:'energy_core'}),/workbench/);
 p.inventory.wood=5;p.inventory.stone=5;
 action(p,{action:'build',kind:'workbench',x:4,z:0},{x:0,z:0});
 action(p,{action:'craft',recipe:'energy_core'});
 assert.equal(p.inventory.energy_core,1);
});

test('buildings have placement, cost, ownership, cap and collision restrictions',()=>{
 const p=fresh();
 p.inventory.wood=12;p.inventory.stone=8;
 assert.throws(()=>action(p,{action:'build',kind:'hut',x:25,z:25}),/closer/);
 assert.throws(()=>action(p,{action:'build',kind:'hut',x:0,z:0}),/arrival/);
 action(p,{action:'build',kind:'hut',x:4,z:0});
 assert.equal(p.structures.length,1);
 assert.equal(p.inventory.wood,4);
 assert.throws(()=>action(p,{action:'build',kind:'workbench',x:4,z:0}),/Too close/);
 assert.equal(p.inventory.wood,4);
 assert.deepEqual(p.structures[0].kind,'hut');
});
test('Echoform discovery, bonding and morph stats are verified',()=>{
 const p=fresh(),e=ECHOES[0],loc={x:e.x,z:e.z};
 assert.throws(()=>action(p,{action:'bond',echoId:e.id},loc),/Scan/);
 action(p,{action:'scan',echoId:e.id},loc);
 assert.equal(p.discovered[0],e.id);
 assert.throws(()=>action(p,{action:'bond',echoId:e.id},loc),/Not enough/);
 p.inventory.iron=1;p.inventory.crystal=1;
 action(p,{action:'bond',echoId:e.id},loc);
 assert.equal(p.echoforms[0],e.id);
 const base=moveSpeed(p);
 action(p,{action:'equip',form:e.id});
 assert.ok(moveSpeed(p)>base);
 assert.equal(p.character.equipped,e.id);
 action(p,{action:'equip',form:'core'});
 assert.equal(p.character.equipped,'core');
 assert.throws(()=>action(p,{action:'equip',form:'shadeveil'}),/Discover and bond/);
});
test('training spends points and improves one stat only',()=>{
 const p=fresh(),before=getStats(p);
 action(p,{action:'train',stat:'strength'});
 assert.equal(p.statPoints,7);
 assert.equal(getStats(p).strength,before.strength+3);
 assert.equal(getStats(p).speed,before.speed);
 assert.throws(()=>action(p,{action:'train',stat:'infinite_power'}),/Unknown/);
});
test('customization rejects markup, forged colors and unknown movements',()=>{
 const p=fresh();
 assert.throws(()=>action(p,{action:'customize',name:'<script>',color:'#59def4',movement:'follow'}),/name/);
 assert.throws(()=>action(p,{action:'customize',name:'Friend',color:'#000000',movement:'follow'}),/available/);
 assert.throws(()=>action(p,{action:'customize',name:'Friend',color:'#59def4',movement:'admin'}),/Choose/);
 action(p,{action:'customize',name:'Star Forge',color:'#ab8dff',movement:'hover'});
 assert.equal(p.character.name,'Star Forge');
 assert.equal(p.character.movement,'hover');
});
test('weather, event and resource catalogs remain deterministic',()=>{
 const a=worldWeather(NOW),b=worldWeather(NOW);
 assert.deepEqual(a,b);
 assert.equal(new Set(RESOURCE_NODES.map(n=>n.id)).size,RESOURCE_NODES.length);
 assert.equal(new Set(ECHOES.map(e=>e.id)).size,ECHOES.length);
 assert.ok(Object.keys(RECIPES).length>=3&&Object.keys(BUILDINGS).length>=5);
});
