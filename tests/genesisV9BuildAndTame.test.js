import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 createGenesisProfile,ensureGenesisProfile,profileSnapshot,applyGenesisAction,BUILDINGS,
} from '../services/genesisGameService.js';
import {GENESIS_HYBRIDS} from '../public/js/genesisHybrids.js';
import {
 GENESIS_SNAP_SPACING,GENESIS_MODULAR_PARTS,genesisSnapPosition,
 genesisResolvePlacement,genesisBuildOverlap,genesisNearbySnapTargets,
} from '../public/js/genesisConstruction.js';
import {drawGenesisStructure} from '../public/js/genesisStructureVisuals.js';

const NOW=Date.UTC(2026,10,15,1,0,0);
const action=(p,request,x=0,z=0,now=NOW)=>
 applyGenesisAction(p,request,{x,z},now);
const stocked=()=>{
 const p=createGenesisProfile('builder-v9',NOW);
 for(const key of Object.keys(p.inventory))p.inventory[key]=100;
 return p;
};

test('five modular snap pieces exist with real crafting costs and visible geometry',()=>{
 for(const kind of ['staircase','roof_panel','door_frame','stone_wall','stone_roof']){
  assert.ok(BUILDINGS[kind]?.cost,kind);
  assert.ok(GENESIS_MODULAR_PARTS.includes(kind));
 }
 assert.equal(Object.keys(BUILDINGS).length,25);
 assert.equal(GENESIS_SNAP_SPACING,3);
 const source=readFileSync(new URL('../public/js/genesisStructureVisuals.js',import.meta.url),'utf8');
 for(const kind of ['staircase','roof_panel','door_frame','stone_wall','stone_roof'])
  assert.ok(source.includes("k==='"+kind+"'"),kind);
 assert.equal(drawGenesisStructure(null,null,{kind:'stone_wall'},{}),false);
});

test('snap math places exactly three meters from supported modular anchors',()=>{
 const target={id:'floor-1',kind:'floor',x:8,z:2};
 assert.deepEqual(genesisSnapPosition(target,'north'),{x:8,z:-1});
 assert.deepEqual(genesisSnapPosition(target,'east'),{x:11,z:2});
 assert.deepEqual(genesisSnapPosition(target,'south'),{x:8,z:5});
 assert.deepEqual(genesisSnapPosition(target,'west'),{x:5,z:2});
 assert.throws(()=>genesisSnapPosition(target,'diagonal'),/cardinal/);
 assert.throws(()=>genesisResolvePlacement({kind:'hut',snapTo:target.id,snapSide:'east'},[target]),/Only modular/);
 assert.throws(()=>genesisResolvePlacement({kind:'wall',snapTo:'fake',snapSide:'east'},[target]),/no longer exists/);
 assert.deepEqual(genesisResolvePlacement({kind:'stone_wall',snapTo:target.id,snapSide:'east',x:999,z:999},[target]),
  {x:11,z:2,snapped:true,anchorId:target.id});
 assert.ok(!genesisBuildOverlap([target],{x:11,z:2}));
 assert.ok(genesisBuildOverlap([target],{x:10,z:2}));
 assert.equal(genesisNearbySnapTargets([target],{x:8,z:0},6).length,1);
});

test('server ignores spoofed snap coordinates and validates proximity, collision and costs',()=>{
 const p=stocked();
 action(p,{action:'build',kind:'floor',x:8,z:0},5,0);
 const anchor=p.structures[0];
 assert.equal(anchor.x,8);
 const before=p.inventory.planks;
 action(p,{action:'build',kind:'wall',snapTo:anchor.id,snapSide:'east',x:800,z:800,rotation:90},10,0,NOW+50);
 const wall=p.structures[1];
 assert.equal(wall.x,11);
 assert.equal(wall.z,0);
 assert.equal(wall.rotation,90);
 assert.equal(wall.snappedTo,anchor.id);
 assert.equal(wall.snapSide,'east');
 assert.equal(p.inventory.planks,before-BUILDINGS.wall.cost.planks);
 assert.throws(()=>action(p,{action:'build',kind:'roof_panel',snapTo:anchor.id,snapSide:'east'},10,0,NOW+100),/Too close/);
 assert.throws(()=>action(p,{action:'build',kind:'roof_panel',snapTo:anchor.id,snapSide:'west'},100,0,NOW+150),/closer/);
 assert.throws(()=>action(p,{action:'build',kind:'roof_panel',snapTo:anchor.id,snapSide:'vertical'},8,0,NOW+160),/cardinal/);
 const noMoney=stocked();noMoney.inventory.planks=0;
 assert.throws(()=>action(noMoney,{action:'build',kind:'floor',x:8,z:0},5,0),/Not enough/);
});

test('dismantle salvages safely and does not delete distant or nonempty chests',()=>{
 const p=stocked();
 action(p,{action:'build',kind:'storage_chest',x:8,z:0},5,0);
 const chest=p.structures[0];
 action(p,{action:'store',chestId:chest.id,item:'wood',count:2},8,0);
 assert.throws(()=>action(p,{action:'dismantle',structureId:chest.id},8,0),/Empty/);
 action(p,{action:'retrieve',chestId:chest.id,item:'wood',count:2},8,0);
 assert.throws(()=>action(p,{action:'dismantle',structureId:chest.id},100,100),/closer/);
 const planksBefore=p.inventory.planks;
 action(p,{action:'dismantle',structureId:chest.id},8,0);
 assert.equal(p.structures.length,0);
 assert.equal(p.storage[chest.id],undefined);
 assert.equal(p.inventory.planks,planksBefore+2);
 assert.throws(()=>action(p,{action:'dismantle',structureId:chest.id},8,0),/existing buildings/);
});

test('taming requires scan, two trust levels, bait and rope at the hybrid location',()=>{
 const c=GENESIS_HYBRIDS.find(e=>e.id==='thornwolf');
 const p=stocked();
 assert.throws(()=>action(p,{action:'tame',echoId:c.id},c.x,c.z),/Scan/);
 action(p,{action:'scan',echoId:c.id},c.x,c.z);
 assert.throws(()=>action(p,{action:'tame',echoId:c.id},c.x,c.z),/2 trust/);
 action(p,{action:'feed',echoId:c.id},c.x,c.z,NOW+10);
 assert.throws(()=>action(p,{action:'tame',echoId:c.id},c.x,c.z,NOW+20),/2 trust/);
 action(p,{action:'feed',echoId:c.id},c.x,c.z,NOW+46010);
 assert.throws(()=>action(p,{action:'tame',echoId:c.id},0,0,NOW+46100),/closer/);
 const rope=p.inventory.rope,bait=p.inventory.resonance_bait;
 action(p,{action:'tame',echoId:c.id},c.x,c.z,NOW+46100);
 assert.equal(p.inventory.rope,rope-1);
 assert.equal(p.inventory.resonance_bait,bait-2);
 assert.equal(p.creatureCompanion,c.id);
 assert.equal(p.tamedCreatures[c.id].mode,'follow');
 assert.throws(()=>action(p,{action:'tame',echoId:c.id},c.x,c.z,NOW+47000),/already tamed/);
});

test('owned companions have saved names, follow/stay/stable commands and no spoofed ownership',()=>{
 const c=GENESIS_HYBRIDS.find(e=>e.id==='mossgriffin');
 const p=stocked();
 p.discovered.push(c.id);
 p.creatureTrust[c.id]=2;
 action(p,{action:'tame',echoId:c.id},c.x,c.z);
 assert.throws(()=>action(p,{action:'commandCreature',echoId:'fake',command:'follow'}),/do not own/);
 assert.throws(()=>action(p,{action:'commandCreature',echoId:c.id,command:'teleport'}),/Follow, Stay/);
 action(p,{action:'nameCreature',echoId:c.id,name:'Sage Griffin'});
 assert.equal(p.tamedCreatures[c.id].name,'Sage Griffin');
 assert.throws(()=>action(p,{action:'nameCreature',echoId:c.id,name:'bad<script>'}),/name/);
 action(p,{action:'commandCreature',echoId:c.id,command:'stay'},17,19,NOW+100);
 assert.equal(p.tamedCreatures[c.id].mode,'stay');
 assert.deepEqual(p.tamedCreatures[c.id].stayAt,{x:17,z:19});
 action(p,{action:'commandCreature',echoId:c.id,command:'dismiss'},0,0,NOW+200);
 assert.equal(p.creatureCompanion,null);
 assert.throws(()=>action(p,{action:'commandCreature',echoId:c.id,command:'stay'},17,19,NOW+300),/Summon/);
 action(p,{action:'commandCreature',echoId:c.id,command:'follow'},0,0,NOW+400);
 assert.equal(p.creatureCompanion,c.id);
 const stored={genesisProfilesByUserId:{'builder-v9':p}};
 const reloaded=ensureGenesisProfile(stored,'builder-v9',NOW+500);
 assert.equal(reloaded.tamedCreatures[c.id].name,'Sage Griffin');
 assert.equal(profileSnapshot(reloaded,{x:0,z:0},NOW+500).creatureCompanion,c.id);
 assert.ok(profileSnapshot(reloaded,{x:0,z:0},NOW+500).tamedCreatures[0].baseName);
});

test('older profiles migrate without losing structures, morphs, or stockpiles',()=>{
 const p=stocked(),original={...p};
 delete p.tamedCreatures;delete p.creatureCompanion;
 p.structures.push({id:'legacy-floor',kind:'floor',x:3,z:0,rotation:0});
 p.echoforms.push('voltfang');
 p.inventory.wood=42;
 const context={genesisProfilesByUserId:{'builder-v9':p}};
 const recovered=ensureGenesisProfile(context,'builder-v9',NOW+200);
 assert.equal(recovered.inventory.wood,42);
 assert.equal(recovered.structures[0].id,'legacy-floor');
 assert.ok(recovered.echoforms.includes('voltfang'));
 assert.deepEqual(recovered.tamedCreatures,{});
 assert.equal(recovered.creatureCompanion,null);
});

test('mobile interface keeps actual server actions for snap, tame and salvage',()=>{
 const ui=readFileSync(new URL('../public/js/genesisWorld.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/genesis.html',import.meta.url),'utf8');
 for(const name of ['snap-target','snap-side','snap-next','settlement-list','companion-status']){
  assert.match(html,new RegExp('id="'+name+'"'));
 }
 const version=Number(/genesisWorld\.js\?v=(\d+)/.exec(html)?.[1]||0);
 assert.ok(version>=9,'Genesis client entrypoint must not regress to V8 or earlier');
 assert.match(ui,/genesisResolvePlacement/);
 assert.match(ui,/action\(\{action:'tame',echoId:/);
 assert.match(ui,/action\(\{action:'dismantle',structureId:/);
 assert.match(ui,/action\(\{action:'commandCreature',echoId:/);
 assert.match(ui,/syncCompanion\(\)/);
});
