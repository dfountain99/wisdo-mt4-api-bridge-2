// WISDO Genesis v1: server-authoritative PvE survival slice.
// The renderer never awards resources, owns inventory, or approves structures.
export const GENESIS_VERSION = 'genesis-forest-survival-v1';
export const WORLD_LIMIT = 38;
export const STAT_KEYS = Object.freeze(['strength','speed','defense','agility','energy','intelligence']);
const COLORS = Object.freeze(['#59def4','#ab8dff','#75e2a6','#ffc078','#f38fad','#ffffff','#ff7272']);
export const ECHOES = Object.freeze([
  {id:'voltfang',name:'Voltfang',x:-19,z:20,description:'Electric sprint and agility.',cost:{iron:1,crystal:1},bonus:{speed:22,agility:12,energy:5},color:'#72d9ff'},
  {id:'terrakron',name:'Terrakron',x:25,z:-17,description:'Heavy armor and tremendous strength.',cost:{stone:4,iron:1},bonus:{strength:24,defense:20,speed:-6},color:'#eeac72'},
  {id:'shadeveil',name:'Shadeveil',x:-27,z:-21,description:'Stealth, climbing, and curiosity.',cost:{wood:4,crystal:1},bonus:{agility:20,intelligence:12},color:'#bd92fe'},
]);
const RESOURCE_LOCATIONS = Object.freeze({
  wood:[[5,4],[2,12],[-8,8],[-12,-4],[13,11],[-18,19],[20,-12],[-28,-4],[28,7],[0,-20],[16,22],[-5,27]],
  stone:[[7,-5],[15,-1],[-16,1],[-9,-16],[20,-19],[-25,12],[29,23],[12,28],[-29,-29]],
  iron:[[16,-15],[24,-24],[-19,-17],[19,26],[-30,15]],
  crystal:[[-21,24],[25,27],[-30,-23],[8,29],[-24,1]],
});
const RESPAWNS = Object.freeze({wood:25000,stone:35000,iron:55000,crystal:75000});
const REWARDS = Object.freeze({wood:2,stone:2,iron:1,crystal:1});
export const RESOURCE_NODES = Object.freeze(Object.entries(RESOURCE_LOCATIONS).flatMap(([type,points]) =>
  points.map(([x,z],i)=>Object.freeze({id:type+'-'+(i+1),type,x,z,respawnMs:RESPAWNS[type]})
));
export const RECIPES = Object.freeze({
  planks:{label:'Saw 4 Planks',requires:{wood:2},grants:{planks:4}},
  pickaxe:{label:'Stone Pickaxe',requires:{wood:3,stone:3},grants:{pickaxe:1}},
  energy_core:{label:'Energy Core',requires:{iron:2,crystal:2},grants:{energy_core:1},needs:'workbench'},
});
export const BUILDINGS = Object.freeze({
  hut:{label:'Starter Hut',cost:{wood:8,stone:4},width:4,height:3},
  workbench:{label:'Workbench',cost:{wood:4,stone:2},width:2,height:1},
  floor:{label:'Wood Floor',cost:{planks:2},width:3,height:.2},
  wall:{label:'Wood Wall',cost:{planks:2},width:3,height:2.7},
  campfire:{label:'Campfire',cost:{wood:2,stone:3},width:1,height:.5},
  morph_station:{label:'Morph Station',cost:{iron:4,crystal:3,planks:4},width:3,height:2,needs:'workbench'},
});
const DEFAULT_INVENTORY = Object.freeze({wood:0,stone:0,iron:0,crystal:0,planks:0,pickaxe:0,energy_core:0});
const nowString=(now)=>new Date(now).toISOString();
const compact=(value)=>String(value||'').trim().slice(0,28);
export function fail(message,status=400){const error=new Error(message);error.status=status;return error;}
const finite=(n)=>typeof n==='number'&&Number.isFinite(n);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const lookup=(table,key)=>Object.prototype.hasOwnProperty.call(table,key)?table[key]:null;
function take(profile,need){
 for(const [key,count] of Object.entries(need))if((profile.inventory[key]||0)<count)throw fail('Not enough '+key+'.');
 for(const [key,count] of Object.entries(need))profile.inventory[key]-=count;
}
function award(profile,xp){const prev=Math.floor(profile.xp/15);profile.xp+=xp;const newly=Math.floor(profile.xp/15)-prev;if(newly)profile.statPoints=Math.min(60,profile.statPoints+newly);}
export function createGenesisProfile(userId,now=Date.now()){
 return {
  schemaVersion:1,userId:String(userId),createdAt:nowString(now),updatedAt:nowString(now),
  character:{name:'PRISM',color:'#59def4',movement:'follow',equipped:'core',statTraining:Object.fromEntries(STAT_KEYS.map(k=>[k,0]))},
  inventory:{...DEFAULT_INVENTORY},xp:0,statPoints:8,structures:[],
  depleted:{},discovered:[],echoforms:[],lastMessage:'Welcome to Genesis Forest. Collect wood and stone to craft your first tools.',
 };
}
export function ensureGenesisProfile(state,userId,now=Date.now()){
 state.genesisProfilesByUserId ||= {};
 const key=String(userId);
 state.genesisProfilesByUserId[key] ||= createGenesisProfile(key,now);
 return state.genesisProfilesByUserId[key];
}
export function getStats(profile){
 const equip=ECHOES.find(x=>x.id===profile.character.equipped);
 return Object.fromEntries(STAT_KEYS.map(key=>[key,
  Math.max(10,Math.min(100,50+3*(profile.character.statTraining?.[key]||0)+(equip?.bonus?.[key]||0)))
 ]));
}
export function moveSpeed(profile){return 2.7+getStats(profile).speed/22;}
export function worldWeather(now=Date.now()){
 const quarter=Math.floor(now/900000);
 const stages=['Dawn','Day','Dusk','Night'];
 const weather=['Clear','Light Rain','Clear','Crystal Storm'][Math.floor(quarter/2)%4];
 return {timeOfDay:stages[quarter%4],weather,event:weather==='Crystal Storm'?'Crystal Surge':'No regional event',season:'Genesis Cycle'};
}
export function profileSnapshot(profile,position={x:0,z:0},now=Date.now()){
 return {
  ok:true,version:GENESIS_VERSION,realm:'private',position,
  world:worldWeather(now),stats:getStats(profile),speed:moveSpeed(profile),
  character:profile.character,inventory:profile.inventory,statPoints:profile.statPoints,xp:profile.xp,
  structures:profile.structures,
  resources:RESOURCE_NODES.map(node=>({...node,ready:!(profile.depleted[node.id]>now),readyAt:Math.max(0,profile.depleted[node.id]||0)})),
  echoes:ECHOES.map(e=>({...e,discovered:profile.discovered.includes(e.id),bonded:profile.echoforms.includes(e.id)})),
  recipes:RECIPES,buildings:BUILDINGS,lastMessage:profile.lastMessage,
 };
}
function near(position,target,meters=5){if(!position||!finite(position.x)||!finite(position.z)||dist(position,target)>meters)throw fail('Move closer to interact.');}
function buildablePosition(position,x,z){
 if(!finite(x)||!finite(z)||Math.abs(x)>WORLD_LIMIT-3||Math.abs(z)>WORLD_LIMIT-3)throw fail('Select a build location inside Genesis Forest.');
 if(Math.abs(x)<2.5&&Math.abs(z)<2.5)throw fail('The arrival circle must stay clear.');
 near(position,{x,z},7);
 const gx=Math.round(x/2)*2,gz=Math.round(z/2)*2;
 return {x:gx,z:gz};
}
export function applyGenesisAction(profile,body,position,now=Date.now()){
 const action=String(body?.action||'').slice(0,32);
 let message='';
 if(action==='gather'){
  const node=RESOURCE_NODES.find(x=>x.id===body.nodeId);
  if(!node)throw fail('Unknown resource node.');
  near(position,node,5);
  if((profile.depleted[node.id]||0)>now)throw fail('This deposit is regenerating.');
  if((node.type==='iron'||node.type==='crystal')&&!profile.inventory.pickaxe)throw fail('Craft a stone pickaxe to mine iron and crystal.');
  const weather=worldWeather(now).weather;
  // Live ecology: rainy forests replenish more quickly and crystal surges increase yield.
  const bonus=(weather==='Light Rain'&&node.type==='wood')||(weather==='Crystal Storm'&&node.type==='crystal')?1:0;
  const yieldCount=REWARDS[node.type]+bonus;
  profile.inventory[node.type]+=yieldCount;
  profile.depleted[node.id]=now+Math.floor(node.respawnMs*(weather==='Light Rain'&&node.type==='wood' ? .70 : 1));
  award(profile,node.type==='crystal'?5:node.type==='iron'?3:2);
  message='Collected '+yieldCount+' '+node.type+(bonus?' (ecosystem bonus)':'')+'.';
 }else if(action==='craft'){
  const key=String(body.recipe||'');
  const recipe=lookup(RECIPES,key);
  if(!recipe)throw fail('Unknown crafting recipe.');
  if(recipe.needs&&!profile.structures.some(s=>s.kind===recipe.needs))throw fail('Build a '+recipe.needs+' first.');
  if(key==='pickaxe'&&profile.inventory.pickaxe)throw fail('You already have a pickaxe.');
  take(profile,recipe.requires);
  for(const [item,count] of Object.entries(recipe.grants))profile.inventory[item]+=count;
  award(profile,4);message='Crafted '+recipe.label+'.';
 }else if(action==='build'){
  const kind=String(body.kind||'');
  const blueprint=lookup(BUILDINGS,kind);
  if(!blueprint)throw fail('Unknown building blueprint.');
  if(profile.structures.length>=80)throw fail('Your private settlement reached the 80-piece prototype limit.');
  if(blueprint.needs&&!profile.structures.some(s=>s.kind===blueprint.needs))throw fail('Build a '+blueprint.needs+' first.');
  const pos=buildablePosition(position,body.x,body.z);
  if(profile.structures.some(s=>dist(s,pos)<3))throw fail('Too close to another building.');
  take(profile,blueprint.cost);
  const id='structure-'+String(profile.structures.length+1)+'-'+Math.trunc(now);
  profile.structures.push({id,kind,...pos,rotation:[0,90,180,270].includes(body.rotation)?body.rotation:0});
  award(profile,6);message='Built '+blueprint.label+'. Your settlement is saved.';
 }else if(action==='scan'){
  const echo=ECHOES.find(x=>x.id===body.echoId);
  if(!echo)throw fail('Unknown Echoform.');
  near(position,echo,6);
  if(!profile.discovered.includes(echo.id)){profile.discovered.push(echo.id);award(profile,8);}
  message='Scanned '+echo.name+'. '+echo.description+' Complete its resonance offering to bond.';
 }else if(action==='bond'){
  const echo=ECHOES.find(x=>x.id===body.echoId);
  if(!echo)throw fail('Unknown Echoform.');
  near(position,echo,6);
  if(!profile.discovered.includes(echo.id))throw fail('Scan the Echoform before bonding.');
  if(profile.echoforms.includes(echo.id))throw fail('This Echoform is already bonded.');
  take(profile,echo.cost);profile.echoforms.push(echo.id);
  award(profile,15);message='Resonance complete! '+echo.name+' can now morph with PRISM.';
 }else if(action==='equip'){
  const form=String(body.form||'core');
  if(form!=='core'&&!profile.echoforms.includes(form))throw fail('Discover and bond this form first.');
  profile.character.equipped=form;
  message=form==='core'?'PRISM returned to Core form.':'PRISM morphed into '+ECHOES.find(e=>e.id===form).name+'.';
 }else if(action==='train'){
  const stat=String(body.stat||'');
  if(!STAT_KEYS.includes(stat))throw fail('Unknown attribute.');
  if(profile.statPoints<1)throw fail('Earn more stat points by exploring.');
  if(profile.character.statTraining[stat]>=14)throw fail('Attribute training limit reached.');
  profile.statPoints--;profile.character.statTraining[stat]++;
  message='Increased '+stat+' training.';
 }else if(action==='customize'){
  const name=compact(body.name);
  if(!/^[\p{L}\p{N} _-]{1,24}$/u.test(name))throw fail('PRISM name must contain 1–24 letters, numbers, spaces, _ or -.');
  const color=String(body.color||'').toLowerCase();
  if(!COLORS.includes(color))throw fail('Select an available PRISM color.');
  const movement=String(body.movement||'');
  if(!['follow','hover','stay'].includes(movement))throw fail('Choose Follow, Hover or Stay.');
  profile.character.name=name;
  profile.character.color=color;
  profile.character.movement=movement;
  message='Your PRISM appearance and behavior were saved.';
 }else throw fail('Unsupported Genesis action.');
 profile.lastMessage=message;
 profile.updatedAt=nowString(now);
 return {ok:true,action,message};
}
