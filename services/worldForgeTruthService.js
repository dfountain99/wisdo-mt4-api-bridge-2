import {compileHolographicPreview} from './holographicBlueprintService.js';
import {validateWorldManifest} from './worldSpatialPlanner.js';
import {evaluateWorldComposition} from './worldCompositionService.js';

const groups={
 terrain:['CREATE_LANDMASS'],water:['CREATE_OCEAN','CREATE_RIVER'],mountains:['CREATE_MOUNTAIN_RANGE'],
 tower:['CREATE_TOWER'],buildings:['CREATE_CASTLE','CREATE_CITY_ZONE','CREATE_HOME','CREATE_CRAFTING_LAB'],
 forest:['CREATE_FOREST'],portal:['CREATE_PORTAL'],spawn:[],
};
const isRenderable=op=>op?.type?.startsWith('CREATE_');
export function compileApprovedForgePreview(draft){
 if(!draft?.approved||!draft.description)throw new Error('approved_blueprint_required');
 return draft.preview?.truth&&draft.preview.fidelityVersion>=4&&Array.isArray(draft.preview.operations)?draft.preview:compileHolographicPreview(draft.description,{...(draft.preview?.context||{}),worldName:draft.name});
}
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const issue=(code,operationId)=>({code,...(operationId?{operationId}:{})});
export function buildForgeTruthReport(world){
 const operations=world.forgeOperations||[],ideas=world.intent?.ideas||[];
 const structural=validateWorldManifest({...world,operations});
 const renderable=operations.filter(isRenderable),requested=ideas.map(i=>i.label);
 const missing=structural.errors.filter(e=>e.code==='REQUESTED_CONCEPT_MISSING'||e.code==='TERRAIN_MISSING');
 const invalid=structural.errors.filter(e=>!missing.includes(e));
 const spatial=renderable.filter(o=>o.position&&o.dimensions);
 const worldBounds=spatial.length?{min:{x:Math.min(...spatial.map(o=>o.position.x-o.dimensions.x/2)),y:Math.min(...spatial.map(o=>o.position.y-(o.type==='CREATE_OCEAN'?0:o.dimensions.y))),z:Math.min(...spatial.map(o=>o.position.z-o.dimensions.z/2))},max:{x:Math.max(...spatial.map(o=>o.position.x+o.dimensions.x/2)),y:Math.max(...spatial.map(o=>o.position.y+o.dimensions.y)),z:Math.max(...spatial.map(o=>o.position.z+o.dimensions.z/2))}}:null;
 const spawnStatus=structural.errors.some(e=>e.code==='INVALID_SPAWN'||e.code==='SPAWN_INTERSECTS_STRUCTURE')?'FAIL':'PASS';
 const requirements=Object.fromEntries(Object.entries(groups).map(([name,types])=>[name,{operationIds:types.length?renderable.filter(o=>types.includes(o.type)).map(o=>o.id):[],status:name==='spawn'?spawnStatus:'NOT_REQUESTED'}]));
 for(const [name,entry] of Object.entries(requirements))if(name!=='spawn')entry.status=entry.operationIds.length?'MANIFEST_VALID':'MISSING';
 // Do not demand concepts the user did not request. Aurelia Prime exercises all
 // eight groups, while smaller approved worlds can still be valid.
 const required=new Set(['terrain','spawn']);
 for(const idea of ideas){const label=String(idea.label||'').toLowerCase();for(const [name,types] of Object.entries(groups))if(types.some(t=>operations.some(o=>o.type===t&&o.concept?.toLowerCase()===label)))required.add(name)}
 if(/aurelia prime/i.test(world.name+' '+(world.description||'')))for(const name of Object.keys(groups))required.add(name);
 for(const name of required)if(requirements[name].status==='MISSING')missing.push(issue('REQUIRED_GROUP_MISSING',name));
 const composition=/aurelia prime/i.test(world.name+' '+(world.description||''))?evaluateWorldComposition(world):null;
 if(composition?.status==='FAIL')for(const name of composition.failed)invalid.push(issue('COMPOSITION_'+name.toUpperCase()));
 const valid=structural.valid&&missing.length===0&&invalid.length===0;
 return {schema:'wisdo-forge-truth-report-v1',worldId:world.worldId,manifestVersion:world.revision||1,
  requested:{count:requested.length,concepts:requested},manifest:{count:renderable.length,operationIds:renderable.map(o=>o.id)},
  executed:null,visible:null,missing,invalid,requirements,worldBounds,spawnStatus,composition,
  visual:null,status:valid?'PENDING_VISUAL':'FAIL',forgeStatus:valid?'awaiting_visual':'incomplete',babylonCertification:'PENDING'};
}
export function applyBabylonObservation(report,world,observation){
 if(!report||report.status==='FAIL')throw new Error('structural_report_invalid');
 if(observation?.worldId!==world.worldId||observation?.manifestVersion!==world.revision)throw new Error('visual_report_version_mismatch');
 const expected=(world.forgeOperations||[]).filter(isRenderable),rows=observation.operations;
 if(!Array.isArray(rows)||rows.length!==expected.length||rows.length>256)throw new Error('visual_operation_set_mismatch');
 const ids=new Set(),invalid=[];
 const validated=rows.map((row,i)=>{
  const op=expected[i];if(row?.id!==op.id||row?.type!==op.type||ids.has(row.id))throw new Error('visual_operation_set_mismatch');ids.add(row.id);
  const meshCount=row.meshCount;
  if(!Number.isInteger(meshCount)||meshCount<0||meshCount>1000)throw new Error('invalid_visual_mesh_count');
  const b=row.bounds;
  const sane=b&&['min','max'].every(side=>['x','y','z'].every(k=>finite(b[side]?.[k])))&&['x','y','z'].every(k=>b.min[k]<=b.max[k]&&Math.abs(b.min[k])<10000&&Math.abs(b.max[k])<10000);
  const inRegion=sane&&op.position&&op.dimensions&&Math.abs((b.min.x+b.max.x)/2-op.position.x)<=Math.max(10,op.dimensions.x)&&Math.abs((b.min.z+b.max.z)/2-op.position.z)<=Math.max(10,op.dimensions.z);
  if(!sane||meshCount===0||!inRegion)invalid.push(issue(meshCount===0?'NO_GEOMETRY':!sane?'INVALID_BOUNDS':'WRONG_REGION',row.id));
  return {id:row.id,type:row.type,meshCount,bounds:sane?b:null,inCamera:row.inCamera===true,visible:sane&&inRegion&&meshCount>0&&row.visible===true&&row.inCamera===true};
 });
 const executed=validated.filter(r=>r.meshCount>0).length,visible=validated.filter(r=>r.visible).length;
 for(const [name,entry] of Object.entries(report.requirements)){
  if(name==='spawn')continue;
  if(entry.status==='NOT_REQUESTED'||entry.status==='MISSING')continue;
  entry.status=entry.operationIds.every(id=>validated.some(r=>r.id===id&&r.visible))?'PASS':'FAIL';
 }
 const camera=observation.cameraFraming===true,bounds=observation.worldBounds;
 const boundsSane=bounds&&['min','max'].every(side=>['x','y','z'].every(k=>finite(bounds[side]?.[k])))&&['x','y','z'].every(k=>bounds.min[k]<=bounds.max[k]);
 const land=expected.find(o=>o.type==='CREATE_LANDMASS');
 if(!boundsSane||land&&((bounds.max.x-bounds.min.x)<land.dimensions.x*.8||(bounds.max.z-bounds.min.z)<land.dimensions.z*.8))invalid.push(issue('SCENE_BOUNDS_INVALID'));
 if(!camera)invalid.push(issue('CAMERA_FRAMING_FAILED'));
 const status=invalid.length||visible!==expected.length||Object.values(report.requirements).some(r=>r.status==='FAIL')?'FAIL':'PASS';
 return {...report,executed,visible,invalid:[...report.invalid,...invalid],requirements:report.requirements,
  visual:{renderer:'babylon',operations:validated,worldBounds:boundsSane?bounds:null,cameraFraming:camera,observedAt:new Date().toISOString()},status,forgeStatus:status==='PASS'?(report.composition?'composition_pending':'complete'):'incomplete',babylonCertification:'PENDING'};
}
