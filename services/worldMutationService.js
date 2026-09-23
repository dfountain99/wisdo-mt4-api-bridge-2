// WISDO World Mutation Runtime v1
// Validated declarative operations only. Renderer clients consume these mutations; no generated code is executed.
import crypto from 'node:crypto';

export const WORLD_MUTATION_TYPES = Object.freeze([
  'CREATE','DELETE','MOVE','ROTATE','SCALE','PAINT','TERRAFORM','SPAWN','CONNECT',
  'LIGHT','WEATHER','TIME','PORTAL','SCRIPT_BEHAVIOR','ACTIVATE_MODULE','DEACTIVATE_MODULE',
]);

function clean(v,max=120){return String(v??'').replace(/\u0000/g,'').trim().slice(0,max)}
function finite(v,fallback=0,min=-10000,max=10000){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}
function vec3(v={},fallback={x:0,y:0,z:0}){return {x:finite(v.x,fallback.x),y:finite(v.y,fallback.y),z:finite(v.z,fallback.z)}}
function objectId(){return `obj_${crypto.randomUUID()}`}
function revisionId(){return `rev_${crypto.randomUUID()}`}

export function ensureWorldHistory(dna){
  dna.history ||= { cursor: -1, revisions: [] };
  if(!Array.isArray(dna.history.revisions)) dna.history.revisions=[];
  if(!Number.isInteger(dna.history.cursor)) dna.history.cursor=dna.history.revisions.length-1;
  return dna;
}

export function validateMutation(input={}){
  const type=clean(input.type,40).toUpperCase();
  if(!WORLD_MUTATION_TYPES.includes(type)) throw new Error('unsupported_world_mutation');
  const mutation={type,objectId:clean(input.objectId,160)||null,objectType:clean(input.objectType,80)||null,name:clean(input.name,100)||null,
    position:vec3(input.position),rotation:vec3(input.rotation),scale:vec3(input.scale,{x:1,y:1,z:1}),
    material:clean(input.material,80)||null,asset:clean(input.asset,240)||null,parentId:clean(input.parentId,160)||null,
    tags:[...new Set((Array.isArray(input.tags)?input.tags:[]).map(x=>clean(x,60)).filter(Boolean))].slice(0,24),
    behavior:clean(input.behavior,300)||null,module:clean(input.module,80)||null,value:clean(input.value,120)||null};
  if(type==='CREATE'&&!mutation.objectType) mutation.objectType='primitive';
  return mutation;
}

function snapshot(dna){return {objects:structuredClone(dna.objects||[]),portals:structuredClone(dna.portals||[]),environment:structuredClone(dna.environment||{}),gameplay:structuredClone(dna.gameplay||{})}}

export function applyMutation(dna,input={},meta={}){
  const next=ensureWorldHistory(structuredClone(dna)); const mutation=validateMutation(input); const before=snapshot(next);
  const objects=next.objects ||= []; const find=()=>objects.find(o=>o.objectId===mutation.objectId);
  if(mutation.type==='CREATE'||mutation.type==='SPAWN'){
    const id=mutation.objectId||objectId(); objects.push({objectId:id,name:mutation.name||mutation.objectType||'World Object',type:mutation.objectType||'primitive',
      position:mutation.position,rotation:mutation.rotation,scale:mutation.scale,material:mutation.material,asset:mutation.asset,parentId:mutation.parentId,
      tags:mutation.tags,behaviors:mutation.behavior?[mutation.behavior]:[],permissions:{owner:'edit',visitor:'view'},createdBy:clean(meta.userId,120)||next.ownerUserId,createdAt:new Date().toISOString()}); mutation.objectId=id;
  } else if(mutation.type==='DELETE'){next.objects=objects.filter(o=>o.objectId!==mutation.objectId)}
  else if(['MOVE','ROTATE','SCALE','PAINT','SCRIPT_BEHAVIOR'].includes(mutation.type)){const o=find();if(!o)throw new Error('world_object_not_found');if(mutation.type==='MOVE')o.position=mutation.position;if(mutation.type==='ROTATE')o.rotation=mutation.rotation;if(mutation.type==='SCALE')o.scale=mutation.scale;if(mutation.type==='PAINT')o.material=mutation.material||mutation.value;if(mutation.type==='SCRIPT_BEHAVIOR'&&mutation.behavior)o.behaviors=[...(o.behaviors||[]),mutation.behavior].slice(-24)}
  else if(mutation.type==='WEATHER')next.environment.weather=mutation.value||'clear';
  else if(mutation.type==='TIME')next.environment.timeOfDay=mutation.value||'dynamic';
  else if(mutation.type==='ACTIVATE_MODULE'){const set=new Set(next.gameplay.modules||[]);if(mutation.module)set.add(mutation.module);next.gameplay.modules=[...set]}
  else if(mutation.type==='DEACTIVATE_MODULE'){next.gameplay.modules=(next.gameplay.modules||[]).filter(x=>x!==mutation.module)}
  else if(mutation.type==='PORTAL'){next.portals ||= [];next.portals.push({portalId:mutation.objectId||objectId(),name:mutation.name||'Portal',position:mutation.position,target:mutation.value||null})}
  // CONNECT/LIGHT/TERRAFORM are preserved as declarative runtime objects until specialized renderer adapters consume them.
  else {const id=mutation.objectId||objectId();objects.push({objectId:id,type:`runtime:${mutation.type.toLowerCase()}`,name:mutation.name||mutation.type,position:mutation.position,rotation:mutation.rotation,scale:mutation.scale,value:mutation.value,tags:mutation.tags,createdBy:clean(meta.userId,120)||next.ownerUserId,createdAt:new Date().toISOString()});mutation.objectId=id}
  const after=snapshot(next); const revisions=next.history.revisions.slice(0,next.history.cursor+1);
  revisions.push({revisionId:revisionId(),mutation,before,after,createdAt:new Date().toISOString(),createdBy:clean(meta.userId,120)||next.ownerUserId});
  next.history.revisions=revisions.slice(-100);next.history.cursor=next.history.revisions.length-1;next.generation.revision=Number(next.generation.revision||0)+1;next.updatedAt=new Date().toISOString();
  return {dna:next,mutation,revision:next.history.revisions[next.history.cursor]};
}
export function undoWorldMutation(dna){const next=ensureWorldHistory(structuredClone(dna));if(next.history.cursor<0)return {dna:next,changed:false};const rev=next.history.revisions[next.history.cursor];Object.assign(next,structuredClone(rev.before));next.history.cursor--;next.generation.revision=Number(next.generation.revision||0)+1;next.updatedAt=new Date().toISOString();return {dna:next,changed:true,revision:rev}}
export function redoWorldMutation(dna){const next=ensureWorldHistory(structuredClone(dna));const idx=next.history.cursor+1;if(idx>=next.history.revisions.length)return {dna:next,changed:false};const rev=next.history.revisions[idx];Object.assign(next,structuredClone(rev.after));next.history.cursor=idx;next.generation.revision=Number(next.generation.revision||0)+1;next.updatedAt=new Date().toISOString();return {dna:next,changed:true,revision:rev}}
