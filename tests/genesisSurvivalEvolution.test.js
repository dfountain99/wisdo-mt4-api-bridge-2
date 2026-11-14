import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGenesisProfile,ensureGenesisProfile,profileSnapshot,applyGenesisAction,
 RECIPES,BUILDINGS,CHEST_CAPACITY,MAX_CREATURE_TRUST,RESOURCE_NODES,
} from '../services/genesisGameService.js';
import {GENESIS_HYBRIDS} from '../public/js/genesisHybrids.js';
import {genesisWildlifePose} from '../public/js/genesisWildlifeBehavior.js';
import {drawGenesisStructure} from '../public/js/genesisStructureVisuals.js';
import {applyGenesisWoodDetail} from '../public/js/genesisMaterialDetail.js';

const NOW=Date.UTC(2026,10,14,23,0,0);
const act=(p,body,x=0,z=0,t=NOW)=>applyGenesisAction(p,body,{x,z},t);
const rich=()=>{
 const p=createGenesisProfile('sandbox',NOW);
 for(const k of Object.keys(p.inventory))p.inventory[k]=70;
 p.inventory.pickaxe=1;
 return p;
};

test('crafting expansion defines a complete resource-to-station progression',()=>{
 for(const name of ['rope','stone_bricks','nails','iron_ingot','crystal_glass',
 'resonance_bait','stone_axe','reinforced_pickaxe']){
  assert.ok(RECIPES[name],name);
  for(const [item,count] of Object.entries(RECIPES[name].requires)){
   assert.ok(Number.isSafeInteger(count)&&count>0);
   assert.ok(item in rich().inventory,'Unrecognized ingredient '+item);
  }
 }
 assert.equal(RECIPES.iron_ingot.needs,'kiln');
 assert.equal(RECIPES.resonance_bait.needs,'workbench');
 assert.ok(BUILDINGS.kiln&&BUILDINGS.storage_chest&&BUILDINGS.creature_habitat);
 assert.equal(Object.keys(BUILDINGS).length,20);
});

test('real crafted recipes consume resources and station gates cannot be bypassed',()=>{
 const p=rich();
 assert.throws(()=>act(p,{action:'craft',recipe:'iron_ingot'}),/kiln/);
 act(p,{action:'craft',recipe:'rope'});
 assert.equal(p.inventory.rope,72);assert.equal(p.inventory.wood,67);
 act(p,{action:'build',kind:'workbench',x:8,z:0},5,0);
 act(p,{action:'craft',recipe:'stone_bricks'});
 act(p,{action:'build',kind:'kiln',x:16,z:0},12,0);
 const before=p.inventory.iron_ingot;
 act(p,{action:'craft',recipe:'iron_ingot'});
 assert.equal(p.inventory.iron_ingot,before+1);
 const first=act(p,{action:'craft',recipe:'resonance_bait'});
 assert.match(first.message,/Resonance Bait/);
});

test('supply chests require physical proximity and enforce storage limits',()=>{
 const p=rich();
 act(p,{action:'build',kind:'storage_chest',x:8,z:0},5,0);
 const chest=p.structures[0];
 assert.equal(chest.kind,'storage_chest');
 assert.throws(()=>act(p,{action:'store',chestId:chest.id,item:'wood',count:2},100,0),/closer/);
 assert.throws(()=>act(p,{action:'store',chestId:chest.id,item:'wood',count:21},8,0),/quantity/);
 assert.throws(()=>act(p,{action:'store',chestId:chest.id,item:'unrecognized',count:2},8,0),/valid item/);
 const before=p.inventory.wood;
 act(p,{action:'store',chestId:chest.id,item:'wood',count:18},8,0);
 assert.equal(p.inventory.wood,before-18);
 assert.equal(p.storage[chest.id].wood,18);
 assert.throws(()=>act(p,{action:'retrieve',chestId:chest.id,item:'wood',count:20},8,0),/Not enough/);
 act(p,{action:'retrieve',chestId:chest.id,item:'wood',count:5},8,0);
 assert.equal(p.storage[chest.id].wood,13);
 for(const item of ['stone','iron','crystal'])act(p,{action:'store',chestId:chest.id,item,count:15},8,0);
 assert.throws(()=>act(p,{action:'store',chestId:chest.id,item:'wood',count:3},8,0),/full/);
 assert.equal(CHEST_CAPACITY,60);
 const state={genesisProfilesByUserId:{sandbox:p}};
 const loaded=ensureGenesisProfile(state,'sandbox',NOW+5000);
 assert.equal(loaded.storage[chest.id].wood,13);
 assert.equal(profileSnapshot(loaded,{x:8,z:0},NOW+5000).storage[chest.id].wood,13);
});

test('felling axe and reinforced pickaxe yield one actual extra resource',()=>{
 const base=rich(),enhanced=rich();
 base.inventory.stone_axe=0;
 enhanced.inventory.stone_axe=1;
 const wood=RESOURCE_NODES.find(n=>n.type==='wood');
 act(base,{action:'gather',nodeId:wood.id},wood.x,wood.z);
 act(enhanced,{action:'gather',nodeId:wood.id},wood.x,wood.z);
 assert.equal(enhanced.inventory.wood-base.inventory.wood,1);
 const ore=RESOURCE_NODES.find(n=>n.type==='iron');
 base.inventory.reinforced_pickaxe=0;
 enhanced.inventory.reinforced_pickaxe=1;
 act(base,{action:'gather',nodeId:ore.id},ore.x,ore.z);
 act(enhanced,{action:'gather',nodeId:ore.id},ore.x,ore.z);
 assert.equal(enhanced.inventory.iron-base.inventory.iron,1);
});

test('feeding scanned hybrids increases trust and extends real PRISM ability duration',()=>{
 const p=rich(),creature=GENESIS_HYBRIDS.find(e=>e.id==='thornwolf');
 assert.ok(creature);
 assert.throws(()=>act(p,{action:'feed',echoId:creature.id},creature.x,creature.z),/Scan/);
 act(p,{action:'scan',echoId:creature.id},creature.x,creature.z);
 assert.throws(()=>act(p,{action:'feed',echoId:creature.id},0,0),/closer/);
 const initial=p.inventory.resonance_bait;
 act(p,{action:'feed',echoId:creature.id},creature.x,creature.z);
 assert.equal(p.creatureTrust[creature.id],1);
 assert.equal(p.inventory.resonance_bait,initial-1);
 assert.throws(()=>act(p,{action:'feed',echoId:creature.id},creature.x,creature.z,NOW+1000),/time/);
 act(p,{action:'feed',echoId:creature.id},creature.x,creature.z,NOW+46000);
 act(p,{action:'feed',echoId:creature.id},creature.x,creature.z,NOW+92000);
 assert.equal(p.creatureTrust[creature.id],MAX_CREATURE_TRUST);
 assert.throws(()=>act(p,{action:'feed',echoId:creature.id},creature.x,creature.z,NOW+139000),/completely/);
 act(p,{action:'bond',echoId:creature.id},creature.x,creature.z,NOW+140000);
 act(p,{action:'equip',form:creature.id},0,0,NOW+140100);
 act(p,{action:'activate',form:creature.id},0,0,NOW+140200);
 assert.equal(p.activeResonance.expiresAt,NOW+140200+creature.power.durationMs+9000);
 const state={genesisProfilesByUserId:{sandbox:p}};
 const updated=ensureGenesisProfile(state,'sandbox',NOW+142000);
 assert.equal(updated.creatureTrust[creature.id],3);
 assert.equal(profileSnapshot(updated,{x:0,z:0},NOW+142000).echoes
  .find(x=>x.id===creature.id).trust,3);
});

test('creature visual wander remains local, predictable and tied to biome weather',()=>{
 const samples=[NOW,NOW+2100,NOW+3800,NOW+16000];
 for(const creature of GENESIS_HYBRIDS){
  for(const time of samples){
   const pose=genesisWildlifePose(creature,time,{x:creature.x+2,z:creature.z+2},'Crystal Storm');
   assert.deepEqual(pose,genesisWildlifePose(creature,time,{x:creature.x+2,z:creature.z+2},'Crystal Storm'));
   assert.ok(Math.abs(pose.x-creature.x)<=1.65);
   assert.ok(Math.abs(pose.z-creature.z)<=1.65);
   assert.ok(Number.isFinite(pose.y)&&Number.isFinite(pose.facing));
   assert.ok(['friendly','wary','sheltering','foraging','roaming'].includes(pose.mood));
  }
 }
 const friendly={...GENESIS_HYBRIDS[0],trust:3};
 assert.equal(genesisWildlifePose(friendly,NOW,{x:friendly.x,z:friendly.z}).mood,'friendly');
});

test('builder and cosmetic modules have safe nonbrowser fallback and correct wiring',()=>{
 assert.equal(drawGenesisStructure(null,null,{kind:'hut'},{}),false);
 assert.equal(applyGenesisWoodDetail(null,{}),null);
 const world=readFileSync(new URL('../public/js/genesisWorld.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/genesis.html',import.meta.url),'utf8');
 assert.match(world,/function selectBlueprint\(/);
 assert.match(world,/function updateBuildPreview\(/);
 assert.match(world,/action\(\{action:'build',kind,/);
 assert.match(world,/genesisWildlifePose/);
 assert.match(world,/action\(\{action:'feed',echoId:/);
 assert.match(html,/id="chest-controls"/);
 assert.match(html,/id="build-rotate"/);
 assert.match(html,/genesisWorld\.js\?v=7/);
});
