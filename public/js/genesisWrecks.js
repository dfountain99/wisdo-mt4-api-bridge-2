/**
 * Stable starting vehicle wreck for every Genesis home island.
 * Pure shared world contract: no browser-chosen location, rewards, or repair costs.
 * Flight physics and multi-passenger seating are future milestones.
 */
const WRECKS=Object.freeze([
  Object.freeze({
    kind:'boat',label:'Stranded Coastal Skiff',mode:'boat',x:54,z:14,
    salvage:Object.freeze({scrap_metal:2,engine_parts:1}),
    repair:Object.freeze({planks:6,rope:2,iron:2,engine_parts:1}),
    plannedSeats:2,
  }),
  Object.freeze({
    kind:'scout_plane',label:'Crashed Scout Aircraft',mode:'air',x:-56,z:23,
    salvage:Object.freeze({scrap_metal:4,engine_parts:1}),
    repair:Object.freeze({planks:4,iron:8,circuit:2,engine_parts:2}),
    plannedSeats:2,
  }),
  Object.freeze({
    kind:'transport_plane',label:'Wrecked Transport Aircraft',mode:'air',x:60,z:-46,
    salvage:Object.freeze({scrap_metal:6,engine_parts:1}),
    repair:Object.freeze({planks:8,iron:12,circuit:4,crystal:2,engine_parts:3}),
    plannedSeats:6,
  }),
]);
export function genesisStarterWreck(islandId){
  const match=/^island-([1-9]\d{0,8})$/.exec(String(islandId||''));
  if(!match)return null;
  const index=(Number(match[1])-1)%WRECKS.length;
  const wreck=WRECKS[index];
  return {id:'wreck-'+islandId,islandId,...wreck};
}
export function genesisWreckWithinReach(position,wreck,radius=7){
  return !!wreck&&position&&Number.isFinite(position.x)&&Number.isFinite(position.z)&&
    Math.hypot(position.x-wreck.x,position.z-wreck.z)<=radius;
}
