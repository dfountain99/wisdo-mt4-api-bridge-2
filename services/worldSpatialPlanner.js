// Manifest coordinates are meters: x east, y up, z south. Babylon uses them
// directly; Unreal maps (x,z,y) to centimeters.
export const WORLD_METERS = 2400;
const finite = n => typeof n === 'number' && Number.isFinite(n);
const bounds = {center:{x:0,z:0},north:{x:0,z:-850},south:{x:0,z:850},east:{x:850,z:0},west:{x:-850,z:0},perimeter:{x:0,z:-1050},coastline:{x:0,z:0},wilderness:{x:-550,z:-450}};
const definitions = {
 CREATE_LANDMASS:['TERRAIN','center',{x:0,y:0,z:0},{x:2400,y:1.5,z:2400}],
 CREATE_OCEAN:['OCEAN','coastline',{x:0,y:-1.7,z:0},{x:2800,y:.15,z:2800}],
 CREATE_RIVER:['RIVER','east',{x:650,y:-.1,z:0},{x:15,y:.15,z:1000}],
 CREATE_MOUNTAIN_RANGE:['MOUNTAINS','north',{x:0,y:0,z:-850},{x:720,y:120,z:250}],
 CREATE_FOREST:['FOREST','wilderness',{x:-550,y:0,z:-450},{x:360,y:8,z:300}],
 CREATE_CASTLE:['KINGDOM','west',{x:-400,y:0,z:100},{x:90,y:80,z:90}],
 CREATE_CITY_ZONE:['CITY','center',{x:280,y:0,z:150},{x:320,y:40,z:300}],
 CREATE_TOWER:['TOWER','center',{x:0,y:0,z:0},{x:70,y:180,z:70}],
 CREATE_HOME:['HOME','south',{x:-240,y:0,z:420},{x:45,y:22,z:45}],
 CREATE_CRAFTING_LAB:['CRAFTING LAB','south',{x:250,y:0,z:420},{x:55,y:25,z:55}],
 CREATE_PORTAL:['PORTAL','east',{x:530,y:0,z:200},{x:35,y:48,z:8}],
 CREATE_ROAD:['ROAD','center',{x:0,y:.04,z:0},{x:10,y:.08,z:100}],
 CREATE_SPACE_BODY:['ASTRONOMY','north',{x:450,y:350,z:-650},{x:80,y:80,z:80}],
};
const nonSpatial = {SET_THEME:'FUTURE',PREVIEW_MODULE:'FPS'};
export function planWorldOperations(input) {
 const operations = [{type:'CREATE_LANDMASS',payload:{}} ,...input.filter(o=>o.type!=='CREATE_LANDMASS')];
 const counts = new Map();
 return operations.map((op,index)=>{
  const count=counts.get(op.type)||0;counts.set(op.type,count+1);
  const definition=definitions[op.type];
  const id=`op_${String(index+1).padStart(3,'0')}`;
  if(!definition)return {...op,id};
  const [concept,region,position,dimensions]=definition;
  const p=op.payload||{};
  const payload={...p,position:{...position},rotation:{x:0,y:0,z:0},dimensions:{...dimensions}};
  if(op.type==='CREATE_FOREST')payload.density=Math.max(1,Math.min(64,Number(p.density)||40));
  if(op.type==='CREATE_TOWER'||op.type==='CREATE_MOUNTAIN_RANGE')payload.height=dimensions.y;
  if(op.type==='CREATE_MOUNTAIN_RANGE'||op.type==='CREATE_FOREST')payload.radius=dimensions.x/2;
  return {...op,id,concept,region,parentId:null,position:{...position},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1},dimensions:{...dimensions},renderStatus:'planned',payload};
 });
}
export function validateWorldPlan(operations,ideas=[]) {
 const errors=[], ids=new Set(), types=new Set();
 for(const [index,op] of operations.entries()){
  if(!op.id||ids.has(op.id))errors.push({operationId:op.id||`index:${index}`,code:'DUPLICATE_OR_MISSING_ID'});
  ids.add(op.id);types.add(op.type);
  if(nonSpatial[op.type])continue;
  if(!definitions[op.type]){errors.push({operationId:op.id,code:'UNSUPPORTED_OPERATION'});continue}
  if(!op.region||!bounds[op.region]||!op.position||!op.rotation||!op.scale||!op.dimensions||op.renderStatus!=='planned')errors.push({operationId:op.id,code:'MISSING_SPATIAL_DATA'});
  for(const key of ['x','y','z'])if(!finite(op.position?.[key])||!finite(op.dimensions?.[key])||op.dimensions[key]<=0||!finite(op.rotation?.[key])||!finite(op.scale?.[key])||op.scale[key]<=0)errors.push({operationId:op.id,code:`INVALID_${key.toUpperCase()}`});
  if(op.position?.y < -2 && op.type!=='CREATE_OCEAN')errors.push({operationId:op.id,code:'BELOW_TERRAIN'});
 }
 for(const idea of ideas){if(!operations.some(op=>op.concept===idea.label||nonSpatial[op.type]===idea.label))errors.push({concept:idea.label,code:'REQUESTED_CONCEPT_MISSING'});}
 if(!types.has('CREATE_LANDMASS'))errors.push({code:'TERRAIN_MISSING'});
 const structures=operations.filter(o=>/CREATE_(CASTLE|CITY_ZONE|TOWER|HOME|CRAFTING_LAB|PORTAL)/.test(o.type));
 for(let i=0;i<structures.length;i++)for(let j=i+1;j<structures.length;j++){
  const a=structures[i],b=structures[j];if(Math.abs(a.position.x-b.position.x)<(a.dimensions.x+b.dimensions.x)/2+5&&Math.abs(a.position.z-b.position.z)<(a.dimensions.z+b.dimensions.z)/2+5)errors.push({operationId:b.id,code:'STRUCTURE_OVERLAP',with:a.id});
 }
 return {schema:'wisdo-forge-truth-v2',requested:ideas.map(i=>i.label),generated:operations.map(o=>({id:o.id,concept:o.concept||nonSpatial[o.type]||null,type:o.type,status:errors.some(e=>e.operationId===o.id)?'invalid':'planned'})),errors,valid:errors.length===0};
}
export function validateWorldManifest(manifest){const report=validateWorldPlan(manifest.operations||[],manifest.intent?.ideas||[]);const spawn=manifest.spawn;if(!spawn||!['x','y','z'].every(k=>finite(spawn[k]))||spawn.y<1||Math.abs(spawn.x)>WORLD_METERS/2-20||Math.abs(spawn.z)>WORLD_METERS/2-20)report.errors.push({code:'INVALID_SPAWN'});for(const op of manifest.operations||[]){if(!/CREATE_(CASTLE|CITY_ZONE|TOWER|HOME|CRAFTING_LAB|PORTAL)/.test(op.type)||!op.position||!op.dimensions||!spawn)continue;if(Math.abs(spawn.x-op.position.x)<op.dimensions.x/2+1&&Math.abs(spawn.z-op.position.z)<op.dimensions.z/2+1)report.errors.push({operationId:op.id,code:'SPAWN_INTERSECTS_STRUCTURE'});}report.valid=report.errors.length===0;return report}
