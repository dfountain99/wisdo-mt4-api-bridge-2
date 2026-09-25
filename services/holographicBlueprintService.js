import { enrichWorldFidelity } from './worldFidelityService.js';
import { planWorldOperations, validateWorldPlan, WORLD_SCALE } from './worldSpatialPlanner.js';
const cap=(s,n=120)=>String(s||'').trim().slice(0,n);
const has=(p,...words)=>words.some(w=>p.includes(w));
const idea=(label,category)=>({label,category});
export function compileHolographicPreview(prompt,context={}){
 const p=cap(prompt,1200).toLowerCase(), ideas=[], ops=[]; const add=(label,category)=>{if(!ideas.some(x=>x.label===label))ideas.push(idea(label,category))};
 if(has(p,'future','futuristic','cyber')){add('FUTURE','era');ops.push({type:'SET_THEME',payload:{theme:'future'}})}
 if(has(p,'medieval','kingdom','castle')){add('KINGDOM','civilization');ops.push({type:'CREATE_CASTLE',payload:{name:'Citadel',position:{x:2,y:2,z:-1}}})}
 if(has(p,'mountain')){add('MOUNTAINS','geography');ops.push({type:'CREATE_MOUNTAIN_RANGE',payload:{radius:6,height:2.8}})}
 if(has(p,'forest','nature')){add('FOREST','biome');ops.push({type:'CREATE_FOREST',payload:{radius:5,density:18}})}
 if(has(p,'city','atlanta')){add('CITY','civilization');ops.push({type:'CREATE_CITY_ZONE',payload:{name:'City',radius:3.5,position:{x:-3,y:.7,z:1}}})}
 if(has(p,'tower','skyscraper')){add('TOWER','architecture');ops.push({type:'CREATE_TOWER',payload:{name:'Central Tower',height:14,position:{x:0,y:0,z:-8}}})}
 if(has(p,'home','house')){add('HOME','architecture');ops.push({type:'CREATE_HOME',payload:{name:'Personal Home',position:{x:-7,y:0,z:1}}})}
 if(has(p,'crafting','craft lab','workshop')){add('CRAFTING LAB','activity');ops.push({type:'CREATE_CRAFTING_LAB',payload:{name:'Crafting Lab',position:{x:7,y:0,z:1}}})}
 if(has(p,'portal')){add('PORTAL','travel');ops.push({type:'CREATE_PORTAL',payload:{name:'Portal Gate',position:{x:9,y:0,z:-8}}})}
 if(has(p,'hidden','secret'))add('HIDDEN','experience');
 if(has(p,'fps','shooter')){add('FPS','gameplay');ops.push({type:'PREVIEW_MODULE',payload:{module:'fps'}})}
 if(has(p,'ocean','island','water')){add('OCEAN','geography');ops.push({type:'CREATE_OCEAN',payload:{radius:9}})}
 if(has(p,'river')){add('RIVER','geography');ops.push({type:'CREATE_RIVER',payload:{width:.5}})}
 if(has(p,'space','planet','moon','telescope','astronomy')){add('ASTRONOMY','space');ops.push({type:'CREATE_SPACE_BODY',payload:{kind:'moon',position:{x:8,y:6,z:-7}}})}
 if(!ideas.length){add('TERRAIN','vision');ops.push({type:'CREATE_LANDMASS',payload:{radius:6}})}
 const planned=planWorldOperations(ops.slice(0,63));
 const fidelity=enrichWorldFidelity({prompt,operations:planned},context.worldName||'');
 const operations=fidelity.operations;
 const truth=validateWorldPlan(operations,ideas);
 return {schema:'wisdo-holographic-preview-v1',prompt:cap(prompt,1200),ideas,operations,truth,themeIdentity:fidelity.theme,seed:fidelity.seed,assetCatalog:fidelity.assetCatalog,fidelityVersion:fidelity.fidelityVersion,world:{width:2400,depth:2400,unit:'meter',origin:{x:0,y:0,z:0}},worldScale:WORLD_SCALE,context:{scale:context.scale||'planet',selectedObjectId:context.selectedObjectId||null},state:'proposed'};
}
