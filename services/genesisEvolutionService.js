/**
 * Genesis Evolution — 10 live mechanics x 100 purchasable tiers.
 * Pure server-side rules; the browser displays the server's snapshot only.
 * Legacy Genesis profiles remain playable without requiring a reset.
 */
export const EVOLUTION_LEVEL_CAP = 100;
export const EVOLUTION_TRACKS = Object.freeze([
  Object.freeze({id:'mining',label:'Deep Mining',detail:'Stone, iron and obsidian extraction',rate:0.003}),
  Object.freeze({id:'forestry',label:'Forest Engineering',detail:'Wood harvesting',rate:0.003}),
  Object.freeze({id:'foraging',label:'Botanical Adaptation',detail:'Moonleaf gathering',rate:0.003}),
  Object.freeze({id:'crystals',label:'Crystal Resonance',detail:'Crystal and aether shard extraction',rate:0.003}),
  Object.freeze({id:'circuitry',label:'Tech Salvaging',detail:'Circuit recovery',rate:0.003}),
  Object.freeze({id:'meteorology',label:'Storm Research',detail:'Extra yield in rain and crystal storms',rate:0.002}),
  Object.freeze({id:'ecology',label:'Biome Mastery',detail:'Extra yield from native biome resources',rate:0.0015}),
  Object.freeze({id:'fabrication',label:'Resource-Efficient Crafting',detail:'Fractional crafting material rebates',rate:0.0025}),
  Object.freeze({id:'architecture',label:'Settlement Engineering',detail:'Building capacity and material rebates',rate:0.002}),
  Object.freeze({id:'exploration',label:'Explorer Training',detail:'Experience gains from Genesis actions',rate:0.003}),
]);
const TRACK_BY_ID = Object.freeze(Object.fromEntries(EVOLUTION_TRACKS.map(track=>[track.id,track])));
const HARVEST_TRACK = Object.freeze({
  stone:'mining',iron:'mining',obsidian:'mining',wood:'forestry',
  moonleaf:'foraging',crystal:'crystals',aether_shard:'crystals',
  circuit:'circuitry',
});
const safeLevel = value => Number.isSafeInteger(value) ? Math.max(0,Math.min(EVOLUTION_LEVEL_CAP,value)) : 0;
const safeNonnegative = value => Number.isSafeInteger(value)&&value>=0 ? value : 0;
const safeCarry = value => typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<1 ? value : 0;

/** Each ten-tier bracket raises research cost by one point. */
export function evolutionTierCost(nextLevel) {
  if (!Number.isInteger(nextLevel)||nextLevel<1||nextLevel>EVOLUTION_LEVEL_CAP) {
    throw new RangeError('Evolution tier must be from 1 to 100');
  }
  return Math.ceil(nextLevel/10);
}
function cumulativeTierCost(level) {
  let sum=0;
  for(let next=1;next<=level;next++)sum+=evolutionTierCost(next);
  return sum;
}
export function ensureGenesisEvolution(profile) {
  if(!profile||typeof profile!=='object')throw new TypeError('Genesis profile required');
  const previous=profile.evolution&&typeof profile.evolution==='object'?profile.evolution:{};
  const levels=Object.fromEntries(EVOLUTION_TRACKS.map(t=>[t.id,safeLevel(previous.levels?.[t.id])]));
  const earnedCost=Object.values(levels).reduce((sum,level)=>sum+cumulativeTierCost(level),0);
  const readCarry=(source,allowed)=>Object.fromEntries(allowed.map(key=>[key,safeCarry(source?.[key])]));
  // Keep invested points monotonic. Old saves have no evolution fields.
  profile.evolution={
    levels,
    spent:Math.max(earnedCost,safeNonnegative(previous.spent)),
    harvestCarry:readCarry(previous.harvestCarry,Object.keys(HARVEST_TRACK)),
    craftCarry:readCarry(previous.craftCarry,Object.keys(HARVEST_TRACK).concat([
      'planks','pickaxe','energy_core','rope','stone_bricks','nails','scrap_metal',
      'engine_parts','iron_ingot','crystal_glass','resonance_bait','stone_axe','reinforced_pickaxe',
    ])),
    buildCarry:readCarry(previous.buildCarry,Object.keys(HARVEST_TRACK).concat([
      'planks','pickaxe','energy_core','rope','stone_bricks','nails','scrap_metal',
      'engine_parts','iron_ingot','crystal_glass','resonance_bait','stone_axe','reinforced_pickaxe',
    ])),
    xpCarry:safeCarry(previous.xpCarry),
  };
  return profile.evolution;
}
export function genesisResearchBudget(profile) {
  const evolution=ensureGenesisEvolution(profile);
  return Math.max(0,Math.floor(safeNonnegative(profile.xp)/3)-evolution.spent);
}
export function genesisEvolutionSnapshot(profile) {
  const evolution=ensureGenesisEvolution(profile);
  const researchPoints=genesisResearchBudget(profile);
  const tracks=EVOLUTION_TRACKS.map(track=>{
    const level=evolution.levels[track.id];
    return {
      ...track,
      level,
      maxLevel:EVOLUTION_LEVEL_CAP,
      bonusPercent:Number((level*track.rate*100).toFixed(2)),
      nextCost:level<EVOLUTION_LEVEL_CAP?evolutionTierCost(level+1):null,
    };
  });
  return {
    researchPoints,
    spent:evolution.spent,
    invested:tracks.reduce((sum,track)=>sum+track.level,0),
    maxInvested:EVOLUTION_TRACKS.length*EVOLUTION_LEVEL_CAP,
    tracks,
    settlementLimit:160+evolution.levels.architecture,
  };
}
export function buyGenesisEvolution(profile,trackId,steps=1) {
  if(typeof trackId!=='string'||!Object.hasOwn(TRACK_BY_ID,trackId)) {
    throw new RangeError('Unknown Genesis evolution track');
  }
  if(!Number.isSafeInteger(steps)||steps<1||steps>10) {
    throw new RangeError('Evolution purchases are between 1 and 10 levels');
  }
  const evolution=ensureGenesisEvolution(profile);
  const current=evolution.levels[trackId];
  if(current+steps>EVOLUTION_LEVEL_CAP)throw new RangeError('Genesis track already at its maximum tier');
  let cost=0;
  for(let level=current+1;level<=current+steps;level++)cost+=evolutionTierCost(level);
  if(Math.floor(safeNonnegative(profile.xp)/3)-evolution.spent<cost) {
    throw new RangeError('Earn more exploration XP before researching this upgrade');
  }
  evolution.levels[trackId]+=steps;
  evolution.spent+=cost;
  return {trackId,level:evolution.levels[trackId],spent:cost,label:TRACK_BY_ID[trackId].label};
}
/**
 * Uses a bounded fractional bank: every level improves expected yield across
 * many successful gathers; no random client input or floating inventory.
 */
export function applyGenesisGatherEvolution(profile,{type,baseYield,weather='',biomeResources=[]}) {
  if(!Number.isSafeInteger(baseYield)||baseYield<1||baseYield>100)throw new RangeError('Invalid base harvest yield');
  const evolution=ensureGenesisEvolution(profile);
  const trackId=HARVEST_TRACK[type];
  if(!trackId)return baseYield;
  let rate=evolution.levels[trackId]*TRACK_BY_ID[trackId].rate;
  if((weather==='Light Rain'||weather==='Crystal Storm')) {
    rate+=evolution.levels.meteorology*TRACK_BY_ID.meteorology.rate;
  }
  if(Array.isArray(biomeResources)&&biomeResources.includes(type)) {
    rate+=evolution.levels.ecology*TRACK_BY_ID.ecology.rate;
  }
  // Under full specialization, this remains below +65% of base yield.
  const accrued=baseYield*rate+evolution.harvestCarry[type];
  const extra=Math.floor(accrued+1e-10);
  evolution.harvestCarry[type]=Number((accrued-extra).toFixed(9));
  return baseYield+extra;
}
/**
 * Craft/build savings are earned only AFTER the full authorized inventory cost
 * has been paid. Carries never exceed one item, preventing free recipe bypass.
 */
export function applyGenesisMaterialRebate(profile,cost,trackId) {
  if(trackId!=='fabrication'&&trackId!=='architecture')throw new RangeError('Invalid rebate track');
  const evolution=ensureGenesisEvolution(profile);
  const rate=evolution.levels[trackId]*TRACK_BY_ID[trackId].rate;
  const carry=trackId==='fabrication'?evolution.craftCarry:evolution.buildCarry;
  const refunded={};
  if(rate<=0)return refunded;
  for(const [item,count] of Object.entries(cost||{})) {
    if(!Object.hasOwn(profile.inventory||{},item)||!Number.isSafeInteger(count)||count<1) {
      throw new RangeError('Invalid evolution rebate ingredient');
    }
    const accrued=count*rate+safeCarry(carry[item]);
    const returned=Math.min(count,Math.floor(accrued+1e-10));
    carry[item]=Number((accrued-returned).toFixed(9));
    if(returned>0){
      profile.inventory[item]+=returned;
      refunded[item]=returned;
    }
  }
  return refunded;
}
export function applyGenesisXpEvolution(profile,baseXp) {
  if(!Number.isSafeInteger(baseXp)||baseXp<0||baseXp>1000)throw new RangeError('Invalid Genesis XP reward');
  const evolution=ensureGenesisEvolution(profile);
  const rate=evolution.levels.exploration*TRACK_BY_ID.exploration.rate;
  const accrued=baseXp*rate+evolution.xpCarry;
  const extra=Math.floor(accrued+1e-10);
  evolution.xpCarry=Number((accrued-extra).toFixed(9));
  return baseXp+extra;
}
