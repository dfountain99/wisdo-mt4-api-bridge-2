import {randomInt,randomUUID} from 'node:crypto';

// Island ownership is permanent in the durable Genesis repository, not in a session.
// An island is a realm: positions from different islands never share presence/physics.
export const GENESIS_ISLAND_RADIUS=84;
export const GENESIS_ISLAND_BIOMES=Object.freeze([
  'forest','neon','titan','aether','crystal','marsh',
]);
export const ISLAND_MACHINE_RECIPES=Object.freeze({
  slow_field:Object.freeze({label:'Resonance Snare',cost:Object.freeze({
    stone:35,iron:24,obsidian:12,sulfur:9,magma_crystal:2,
  }),radius:26,speedMultiplier:.55}),
  volcano_maker:Object.freeze({label:'Volcano Generator',cost:Object.freeze({
    stone:95,iron:65,obsidian:44,sulfur:32,magma_crystal:10,ancient_alloy:2,
  }),radius:38,speedMultiplier:.68}),
});
const FAILURE=(message,status=400)=>Object.assign(new Error(message),{status});
const slots=['stone','iron','obsidian','sulfur','magma_crystal','ancient_alloy'];
const whole=n=>Number.isInteger(n)&&Number.isFinite(n);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function hash(seed,x,z,depth){
  let n=(seed ^ Math.imul(x,374761393) ^ Math.imul(z,668265263) ^ Math.imul(depth,1442695041))|0;
  n=Math.imul(n^(n>>>13),1274126177);
  n^=n>>>16;
  return (n>>>0)/4294967296;
}
export function ensureGenesisIsland(state,ownerId,now=Date.now()){
  state.genesisIslandsByOwner ||= {};
  const key=String(ownerId);
  if(!Object.hasOwn(state.genesisIslandsByOwner,key)){
    const seed=randomInt(1,0x7fffffff);
    const serial=Object.keys(state.genesisIslandsByOwner).length+1;
    state.genesisIslandsByOwner[key]={
      id:randomUUID(),ownerId:key,seed,serial,
      biome:GENESIS_ISLAND_BIOMES[seed%GENESIS_ISLAND_BIOMES.length],
      createdAt:new Date(now).toISOString(),shafts:{},minerals:
        Object.fromEntries(slots.map(s=>[s,0])),machines:[],
    };
  }
  return state.genesisIslandsByOwner[key];
}
export function publicGenesisIsland(island){
  return {id:island.id,name:'Island '+island.serial,biome:island.biome,
    machines:(island.machines||[]).map(({id,kind,x,z})=>({id,kind,x,z}))};
}
export function listGenesisIslands(state,max=100){
  return Object.values(state.genesisIslandsByOwner||{})
    .slice(0,max).map(publicGenesisIsland);
}
export function findGenesisIsland(state,islandId){
  return Object.values(state.genesisIslandsByOwner||{}).find(i=>i.id===islandId)||null;
}
function oreAt(seed,x,z,depth){
  const score=hash(seed,x,z,depth);
  if(depth>=9&&score<.003)return 'ancient_alloy';
  if(depth>=6&&score<.045)return 'magma_crystal';
  if(depth>=4&&score<.24)return 'sulfur';
  if(depth>=3&&score<.55)return 'obsidian';
  if(depth>=1&&score<.71)return 'iron';
  return 'stone';
}
export function mineGenesisIsland(island,{actorId,position,x,z,now=Date.now()}){
  if(String(actorId)!==island.ownerId)throw FAILURE('Only the island owner can excavate their home.');
  if(!whole(x)||!whole(z)||x%4!==0||z%4!==0||
    Math.hypot(x,z)>GENESIS_ISLAND_RADIUS-8)
    throw FAILURE('Select a 4-meter shaft grid inside your island.');
  if(!position||distance(position,{x,z})>5)
    throw FAILURE('Stand beside the shaft to mine.');
  const key=x+':'+z;
  island.shafts ||= {};
  if(!Object.hasOwn(island.shafts,key)){
    if(Object.keys(island.shafts).length>=32)throw FAILURE('Maximum 32 excavation shafts on one island.');
    island.shafts[key]={x,z,depth:0,hits:0,lastHit:0};
  }
  const shaft=island.shafts[key];
  if(now-shaft.lastHit<800)throw FAILURE('The mining tool is recovering.',429);
  if(shaft.depth>=12)throw FAILURE('This shaft has reached bedrock.');
  shaft.hits++;
  shaft.lastHit=now;
  const needed=3+shaft.depth;
  if(shaft.hits<needed)return {ok:true,completed:false,
    depth:shaft.depth,hits:shaft.hits,required:needed};
  shaft.hits=0;
  shaft.depth++;
  const mineral=oreAt(island.seed,x,z,shaft.depth);
  island.minerals ||= Object.fromEntries(slots.map(s=>[s,0]));
  island.minerals[mineral]=(island.minerals[mineral]||0)+1;
  return {ok:true,completed:true,depth:shaft.depth,mineral,
    inventory:{...island.minerals}};
}
export function buildGenesisIslandMachine(island,{actorId,position,kind,x,z}){
  if(String(actorId)!==island.ownerId)throw FAILURE('Only the island owner can install defenses.');
  const recipe=Object.hasOwn(ISLAND_MACHINE_RECIPES,kind)?
    ISLAND_MACHINE_RECIPES[kind]:null;
  if(!recipe)throw FAILURE('Unknown island machine.');
  if(!whole(x)||!whole(z)||Math.hypot(x,z)>GENESIS_ISLAND_RADIUS-8)
    throw FAILURE('Choose a valid island installation site.');
  if(!position||distance(position,{x,z})>6)
    throw FAILURE('Stand beside the installation site.');
  island.machines ||= [];
  if(island.machines.length>=12)throw FAILURE('Maximum 12 machines on one island.');
  if(island.machines.some(m=>Math.hypot(m.x-x,m.z-z)<12))
    throw FAILURE('Too close to another island machine.');
  for(const [ore,quantity] of Object.entries(recipe.cost))
    if((island.minerals?.[ore]||0)<quantity)
      throw FAILURE('Mine more '+ore+' to craft '+recipe.label+'.');
  for(const [ore,quantity] of Object.entries(recipe.cost))
    island.minerals[ore]-=quantity;
  const machine={id:randomUUID(),kind,x,z};
  island.machines.push(machine);
  return {ok:true,machine,inventory:{...island.minerals}};
}
export function genesisIslandVisitorEffects(island,actorId,position){
  if(!island||String(actorId)===island.ownerId)
    return {speedMultiplier:1,effects:[]};
  let speedMultiplier=1;
  const effects=[];
  for(const m of island.machines||[]){
    const rule=ISLAND_MACHINE_RECIPES[m.kind];
    if(!rule||distance(position,m)>rule.radius)continue;
    speedMultiplier=Math.min(speedMultiplier,rule.speedMultiplier);
    effects.push(m.kind);
  }
  return {speedMultiplier,effects};
}
