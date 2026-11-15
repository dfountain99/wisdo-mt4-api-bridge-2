/**
 * Genesis V9 modular construction contract.
 * The server resolves snapping; coordinates supplied by the browser are only
 * hints for free placement, never authority to bypass distance rules.
 */
export const GENESIS_SNAP_SIDES=Object.freeze({
 north:Object.freeze({x:0,z:-1}),
 east:Object.freeze({x:1,z:0}),
 south:Object.freeze({x:0,z:1}),
 west:Object.freeze({x:-1,z:0}),
});
export const GENESIS_MODULAR_PARTS=Object.freeze([
 'floor','stone_foundation','wall','stone_wall','fence','gate',
 'door_frame','roof_panel','stone_roof','staircase','ramp',
]);
export const GENESIS_SNAP_SPACING=3;
export function genesisIsModular(kind){
 return GENESIS_MODULAR_PARTS.includes(kind);
}
export function genesisSnapPosition(target,side){
 if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.z))
  throw Error('Select a valid structure to snap to.');
 const direction=Object.prototype.hasOwnProperty.call(GENESIS_SNAP_SIDES,side)
   ? GENESIS_SNAP_SIDES[side]:null;
 if(!direction)throw Error('Choose a cardinal snap direction.');
 return {
  x:Number((target.x+direction.x*GENESIS_SNAP_SPACING).toFixed(3)),
  z:Number((target.z+direction.z*GENESIS_SNAP_SPACING).toFixed(3)),
 };
}
export function genesisResolvePlacement(body,existing=[]){
 const kind=String(body?.kind||'');
 if(!body?.snapTo)return {x:body?.x,z:body?.z,snapped:false};
 if(!genesisIsModular(kind))throw Error('Only modular building pieces can be snapped.');
 const target=existing.find(s=>s?.id===body.snapTo);
 if(!target)throw Error('Snap target no longer exists.');
 if(!genesisIsModular(target.kind))throw Error('Snap to a foundation, wall, gate or other modular piece.');
 return {...genesisSnapPosition(target,body.snapSide),snapped:true,anchorId:target.id};
}
export function genesisBuildOverlap(structures,pos,threshold=2.98){
 return structures.some(s=>Number.isFinite(s?.x)&&Number.isFinite(s?.z)
   &&Math.hypot(s.x-pos.x,s.z-pos.z)<threshold);
}
export function genesisNearbySnapTargets(structures,position,maxDistance=12){
 if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.z))return [];
 return structures.filter(s=>genesisIsModular(s.kind)&&
   Math.hypot(s.x-position.x,s.z-position.z)<=maxDistance);
}
