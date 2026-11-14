import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 BIOMES,biomeAt,RESOURCE_REWARDS
} from '../public/js/genesisWorldMap.js';
import {
 GENESIS_HYBRIDS,hybridById,activeResonance,resonanceHarvestBonus,
 resonanceScanDistance,HYBRID_POWER_KINDS
} from '../public/js/genesisHybrids.js';
import {
 ECHOES,createGenesisProfile,ensureGenesisProfile,profileSnapshot,
 applyGenesisAction,moveSpeed,getStats
} from '../services/genesisGameService.js';
import {GENESIS_GRAPHICS_MODES,genesisGraphicsPreset}
 from '../public/js/genesisGraphicsQuality.js';

const NOW=Date.UTC(2026,10,14,5,0,0);
const act=(profile,body,position={x:0,z:0},now=NOW)=>
 applyGenesisAction(profile,body,position,now);
const bond=(p,echo,now=NOW)=>{
 for(const [item,count] of Object.entries(echo.cost))p.inventory[item]=(p.inventory[item]||0)+count;
 act(p,{action:'scan',echoId:echo.id},{x:echo.x,z:echo.z},now);
 act(p,{action:'bond',echoId:echo.id},{x:echo.x,z:echo.z},now+50);
 act(p,{action:'equip',form:echo.id},{x:echo.x,z:echo.z},now+100);
};

test('eighteen distinct hybrid creatures are grounded in all six biomes',()=>{
 assert.equal(GENESIS_HYBRIDS.length,18);
 assert.equal(new Set(GENESIS_HYBRIDS.map(c=>c.id)).size,18);
 assert.equal(ECHOES.length,26);
 for(const name of Object.keys(BIOMES)){
   const creatures=GENESIS_HYBRIDS.filter(c=>c.biome===name);
   assert.equal(creatures.length,3,'Missing 3 hybrids in '+name);
   for(const c of creatures){
     assert.equal(biomeAt(c.x,c.z).id,name,c.id+' outside its biome');
     assert.ok(c.hybrid.includes(' × '));
     assert.ok(c.power.name&&HYBRID_POWER_KINDS.includes(c.power.kind));
     assert.ok(c.power.cooldownMs>c.power.durationMs);
     assert.ok(c.power.durationMs>=15000);
     assert.equal(hybridById(c.id)?.name,c.name);
     assert.ok(ECHOES.some(e=>e.id===c.id));
   }
 }
});

test('bonded hybrid activates server-validated PRISM speed power with recharge',()=>{
 const p=createGenesisProfile('new-player',NOW),wolf=hybridById('thornwolf');
 assert.throws(()=>act(p,{action:'activate',form:wolf.id}),/Bond and equip/);
 bond(p,wolf);
 const passive=moveSpeed(p,NOW+150);
 act(p,{action:'activate',form:wolf.id},null,NOW+200);
 assert.ok(moveSpeed(p,NOW+1000)>passive);
 assert.equal(activeResonance(p,NOW+1000).kind,'surge');
 assert.ok(profileSnapshot(p,{x:0,z:0},NOW+1000).resonance.active.name.includes('Rootsprint'));
 assert.throws(()=>act(p,{action:'activate',form:wolf.id},null,NOW+2000),/recharging/);
 assert.equal(activeResonance(p,NOW+wolf.power.durationMs+201),null);
 assert.equal(moveSpeed(p,NOW+wolf.power.durationMs+201),passive);
 act(p,{action:'activate',form:wolf.id},null,NOW+wolf.power.cooldownMs+400);
 assert.ok(p.resonanceCooldowns[wolf.id]>NOW+wolf.power.cooldownMs+400);
});

test('harvest resonance grants verified wood bonuses while ability is active',()=>{
 const p=createGenesisProfile('gather',NOW),creature=hybridById('verdant-raptor');
 bond(p,creature);
 act(p,{action:'activate',form:creature.id},null,NOW+200);
 const before=p.inventory.wood;
 act(p,{action:'gather',nodeId:'wood-1'},{x:5,z:4},NOW+300);
 assert.ok(p.inventory.wood-before>=RESOURCE_REWARDS.wood+1);
 assert.equal(resonanceHarvestBonus(p,'wood',NOW+300),1);
 assert.equal(resonanceHarvestBonus(p,'iron',NOW+300),0);
 assert.equal(resonanceHarvestBonus(p,'wood',NOW+25000),0);
});

test('scan resonance extends range but never permits remote scans',()=>{
 const p=createGenesisProfile('scout',NOW),c=hybridById('mossgriffin');
 bond(p,c);
 act(p,{action:'activate',form:c.id},null,NOW+200);
 assert.equal(resonanceScanDistance(p,NOW+1000),12);
 const target=hybridById('thornwolf');
 act(p,{action:'scan',echoId:target.id},{x:target.x+10,z:target.z},NOW+1000);
 assert.ok(p.discovered.includes(target.id));
 assert.throws(()=>act(p,{action:'scan',echoId:target.id},{x:0,z:0},NOW+2000),/closer/);
 assert.equal(resonanceScanDistance(p,NOW+30000),6);
});

test('equipment changes invalidate previously active powers, profiles remain durable',()=>{
 const p=createGenesisProfile('legacy',NOW),shield=hybridById('obsidian-basilisk');
 p.structures.push({id:'saved-hut',kind:'hut',x:14,z:14,rotation:0});
 p.inventory.wood=72;
 bond(p,shield);
 const before=getStats(p,NOW+150).defense;
 act(p,{action:'activate',form:shield.id},null,NOW+200);
 assert.ok(getStats(p,NOW+300).defense>=before);
 act(p,{action:'equip',form:'core'},null,NOW+1000);
 assert.equal(activeResonance(p,NOW+1300),null);
 const state={genesisProfilesByUserId:{legacy:p}};
 const loaded=ensureGenesisProfile(state,'legacy',NOW+1500);
 assert.equal(loaded.structures[0].id,'saved-hut');
 assert.equal(loaded.inventory.wood,72);
 assert.ok(loaded.echoforms.includes(shield.id));
 assert.ok(loaded.resonanceCooldowns[shield.id]>NOW+1000);
});

test('hybrid art uses streamed creature meshes and keeps gameplay actions server-side',()=>{
 const world=readFileSync(new URL('../public/js/genesisWorld.js',import.meta.url),'utf8');
 const visuals=readFileSync(new URL('../public/js/genesisCreatureVisuals.js',import.meta.url),'utf8');
 assert.match(world,/buildGenesisHybrid/);
 assert.match(world,/hybridEchoVisuals/);
 assert.match(world,/action\(\{action:'activate',form:/);
 assert.match(world,/prismHybridVisual/);
 assert.match(visuals,/PBRMaterial/);
 assert.match(visuals,/CreateRibbon/);
});

test('graphics modes scale scenery detail without unbounded mobile resource use',()=>{
 assert.deepEqual(GENESIS_GRAPHICS_MODES,['performance','balanced','cinematic']);
 for(const mobile of [true,false]){
   const low=genesisGraphicsPreset('performance',mobile);
   const normal=genesisGraphicsPreset('balanced',mobile);
   const high=genesisGraphicsPreset('cinematic',mobile);
   assert.ok(low.subdivisions<normal.subdivisions&&normal.subdivisions<high.subdivisions);
   assert.ok(low.trees<normal.trees&&normal.trees<high.trees);
   assert.ok(low.decorations<normal.decorations&&normal.decorations<high.decorations);
   assert.ok(high.subdivisions<=32);
   assert.ok(high.trees<=24);
   assert.ok(low.scale>normal.scale&&normal.scale>high.scale);
   assert.equal(high.shadows,true);
   assert.equal(genesisGraphicsPreset('bad-profile',mobile).mode,'balanced');
 }
});
