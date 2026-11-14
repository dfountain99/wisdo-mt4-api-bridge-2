/**
 * WISDO Genesis Living World deterministic public contract.
 *
 * Pure math shared by server and web renderer, so terrain/resources are not
 * awarded by trusting browser-generated coordinates. The world is a finite
 * 3.2km x 3.2km region, streamed locally in small terrain chunks.
 */
export const WORLD_LIMIT = 1600;
export const CHUNK_SIZE = 80;
export const MAX_GENERATED_NODES_PER_CHUNK = 8;
export const BIOMES = Object.freeze({
  forest: {id:'forest',name:'Genesis Forest',cx:0,cz:0,spread:590,
    base:3,relief:6,rough:3,color:'#27684f',deep:'#144a3b',leaf:'#278f70',accent:'#72d9bd',
    resources:['wood','wood','wood','stone','iron','crystal']},
  neon: {id:'neon',name:'Neon Metropolis',cx:820,cz:-280,spread:510,
    base:6,relief:5,rough:2,color:'#344f5c',deep:'#273d55',leaf:'#5279a3',accent:'#61ecf4',
    resources:['iron','iron','crystal','circuit','stone','circuit']},
  titan: {id:'titan',name:'Titan Wastes',cx:750,cz:760,spread:540,
    base:24,relief:24,rough:10,color:'#6a493c',deep:'#432e2b',leaf:'#7c6353',accent:'#feac64',
    resources:['stone','iron','obsidian','obsidian','stone','crystal']},
  aether: {id:'aether',name:'Aether Skies',cx:-820,cz:-680,spread:550,
    base:17,relief:21,rough:11,color:'#526b91',deep:'#35456e',leaf:'#758dbd',accent:'#b5c5ff',
    resources:['aether_shard','aether_shard','crystal','stone','aether_shard','iron']},
  crystal: {id:'crystal',name:'Crystal Grotto',cx:-550,cz:420,spread:410,
    base:8,relief:14,rough:7,color:'#325a67',deep:'#254355',leaf:'#568b95',accent:'#72ffef',
    resources:['crystal','crystal','iron','stone','crystal','aether_shard']},
  marsh: {id:'marsh',name:'Sunken Marsh',cx:-480,cz:1090,spread:480,
    base:-1,relief:3,rough:1,color:'#285956',deep:'#17443b',leaf:'#378577',accent:'#b5efa1',
    resources:['wood','moonleaf','moonleaf','stone','crystal','wood']},
});
export const WAYSTONES = Object.freeze([
  {id:'arrival',name:'Genesis Sanctuary',biome:'forest',x:0,z:0},
  {id:'neon',name:'Neon Gateway',biome:'neon',x:805,z:-268},
  {id:'titan',name:'Titan Forge',biome:'titan',x:740,z:760},
  {id:'aether',name:'Aether Observatory',biome:'aether',x:-820,z:-670},
  {id:'crystal',name:'Crystal Cathedral',biome:'crystal',x:-552,z:417},
  {id:'marsh',name:'Sunken Citadel',biome:'marsh',x:-480,z:1075},
]);
export const LANDMARKS = Object.freeze([
  {id:'forest-temple',name:'Overgrown Temple',x:-210,z:190,biome:'forest',kind:'ruin'},
  {id:'great-cascade',name:'Great Cascade',x:210,z:260,biome:'forest',kind:'waterfall'},
  {id:'neon-spire',name:'Neon Spire',x:905,z:-350,biome:'neon',kind:'tower'},
  {id:'titan-caldera',name:'Caldera Fortress',x:850,z:865,biome:'titan',kind:'fortress'},
  {id:'aether-palace',name:'Skyborne Palace',x:-890,z:-780,biome:'aether',kind:'islands'},
  {id:'underdeep',name:'Underdeep Entrance',x:-650,z:510,biome:'crystal',kind:'cavern'},
  {id:'drowned-vault',name:'Drowned Vault',x:-550,z:1200,biome:'marsh',kind:'ruin'},
]);
export const RESOURCE_RESPAWNS = Object.freeze({
  wood:25000,stone:35000,iron:55000,crystal:75000,circuit:70000,
  obsidian:90000,aether_shard:90000,moonleaf:45000,
});
export const RESOURCE_REWARDS = Object.freeze({
  wood:2,stone:2,iron:1,crystal:1,circuit:1,obsidian:1,aether_shard:1,moonleaf:2,
});
export const RESOURCE_KEYS = Object.freeze(Object.keys(RESOURCE_RESPAWNS));
function clamp(x,a,b){return Math.min(b,Math.max(a,x));}
function smooth(t){return t*t*(3-2*t);}
function hash(ix,iz,seed=0){
  let h=(Math.imul(ix,374761393)^Math.imul(iz,668265263)^Math.imul(seed+17,1442695041))|0;
  h=Math.imul(h^(h>>>13),1274126177);
  h^=h>>>16;
  return (h>>>0)/4294967295;
}
export function valueNoise(x,z,seed=0){
  const ix=Math.floor(x),iz=Math.floor(z),tx=smooth(x-ix),tz=smooth(z-iz);
  const a=hash(ix,iz,seed),b=hash(ix+1,iz,seed),c=hash(ix,iz+1,seed),d=hash(ix+1,iz+1,seed);
  return (a+(b-a)*tx)*(1-tz)+(c+(d-c)*tx)*tz;
}
function weightsAt(x,z){
  const result={};let sum=0;
  for(const biome of Object.values(BIOMES)){
    const dx=x-biome.cx,dz=z-biome.cz;
    const weight=Math.exp(-(dx*dx+dz*dz)/(biome.spread*biome.spread*1.5));
    result[biome.id]=weight;sum+=weight;
  }
  for(const id of Object.keys(result))result[id]/=sum;
  return result;
}
export function biomeAt(x,z){
  const weights=weightsAt(x,z);
  let best='forest',top=0;
  for(const [id,w] of Object.entries(weights)){
    if(w>top){top=w;best=id;}
  }
  return BIOMES[best];
}
export function terrainHeight(x,z){
  const weights=weightsAt(x,z);
  const broad=(valueNoise(x/180,z/180,49)-.5)*2;
  const ridges=Math.pow(1-Math.abs(valueNoise(x/90,z/90,23)*2-1),3);
  const detail=(valueNoise(x/29,z/29,93)-.5)*2;
  let ground=0;
  for(const biome of Object.values(BIOMES)){
    const highland=(biome.id==='titan'||biome.id==='aether')?1:0;
    const elevation=biome.base+biome.relief*(highland?ridges:broad*.6)+biome.rough*detail;
    ground+=weights[biome.id]*elevation;
  }
  // Preserve the existing starter grove and its nearby resource nodes.
  const dist=Math.hypot(x,z),spawnFactor=smooth(clamp((dist-7)/100,0,1));
  return Math.round(ground*spawnFactor*100)/100;
}
export function biomeColor(x,z){
  const weights=weightsAt(x,z);
  const channels=[0,0,0];
  for(const [id,weight] of Object.entries(weights)){
    const hex=BIOMES[id].color.slice(1);
    for(let k=0;k<3;k++)channels[k]+=parseInt(hex.slice(k*2,k*2+2),16)/255*weight;
  }
  const light=(valueNoise(x/22,z/22,77)-.5)*.18;
  return [...channels.map(c=>clamp(c+light,.02,.95)),1];
}
export function worldChunk(x,z){
  return {cx:Math.floor(x/CHUNK_SIZE),cz:Math.floor(z/CHUNK_SIZE)};
}
export function chunkKey(cx,cz){return cx+':'+cz;}
export function generateChunkNodes(cx,cz){
  if(!Number.isInteger(cx)||!Number.isInteger(cz)||
     Math.abs(cx)>Math.ceil(WORLD_LIMIT/CHUNK_SIZE)||
     Math.abs(cz)>Math.ceil(WORLD_LIMIT/CHUNK_SIZE))return [];
  const nodes=[];
  for(let i=0;i<MAX_GENERATED_NODES_PER_CHUNK;i++){
    const x=Number((cx*CHUNK_SIZE+9+hash(cx,cz,i*13+37)*(CHUNK_SIZE-18)).toFixed(2));
    const z=Number((cz*CHUNK_SIZE+9+hash(cx,cz,i*19+91)*(CHUNK_SIZE-18)).toFixed(2));
    if(Math.abs(x)>WORLD_LIMIT-8||Math.abs(z)>WORLD_LIMIT-8||Math.hypot(x,z)<45)continue;
    const biome=biomeAt(x,z);
    const slot=Math.floor(hash(cx,cz,i*29+213)*biome.resources.length);
    const type=biome.resources[Math.min(biome.resources.length-1,slot)];
    nodes.push({id:'gen_'+cx+'_'+cz+'_'+i,type,x,z,
      respawnMs:RESOURCE_RESPAWNS[type],biome:biome.id});
  }
  return nodes;
}
export function generatedNodeFromId(id){
  const m=/^gen_(-?\d+)_(-?\d+)_(\d{1,2})$/.exec(String(id||''));
  if(!m)return null;
  const cx=Number(m[1]),cz=Number(m[2]),i=Number(m[3]);
  if(i<0||i>=MAX_GENERATED_NODES_PER_CHUNK)return null;
  return generateChunkNodes(cx,cz).find(node=>node.id===id)||null;
}
export function nearbyGeneratedNodes(x,z,radius=1){
  const {cx,cz}=worldChunk(x,z);
  const nodes=[];
  const r=clamp(Math.floor(radius),0,2);
  for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++)
    nodes.push(...generateChunkNodes(cx+dx,cz+dz));
  return nodes;
}
export function nearestWaystone(position,range=12){
  if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.z))return null;
  return WAYSTONES.find(w=>Math.hypot(w.x-position.x,w.z-position.z)<=range)||null;
}
export function findWaystone(id){return WAYSTONES.find(w=>w.id===id)||null;}
