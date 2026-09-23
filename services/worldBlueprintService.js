const BLUEPRINT_VERSION = 1;
const MODES = new Set(['creative','survival','civilization','roleplay','custom']);
const STAGES = ['idea','blueprint','simulation','approved','forging','world','civilization'];
const SECTIONS = ['vision','planet','geography','biomes','climate','civilization','cities','architecture','infrastructure','technology','resources','crafting','gameplay','economy','npcs','story','progression','space','travel','social','permissions','wisdo','audio','media'];

const clone = v => JSON.parse(JSON.stringify(v));
const clean = (v,n=240) => String(v ?? '').trim().slice(0,n);
const id = p => p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);

export function createWorldBlueprint(userId, seed={}) {
  const sections={}; for(const key of SECTIONS) sections[key]={status:'open',notes:[],data:{}};
  return {
    schema:'wisdo-world-blueprint-v1', version:BLUEPRINT_VERSION,
    blueprintId:id('bp'), ownerUserId:String(userId), name:clean(seed.name||'Untitled World',80),
    mode:MODES.has(seed.mode)?seed.mode:'creative', stage:'idea', approved:false,
    vision:clean(seed.vision||'',1200), sections,
    hologram:{scale:'planet',focus:null,quality:'concept',overlays:[]},
    branches:[], revisions:[], simulation:{runs:[],warnings:[],readiness:0},
    constructionPlan:null, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
  };
}
export function reviseBlueprint(bp, patch={}, actor='wisdo') {
  const before=clone(bp); const next=clone(bp);
  if(patch.name) next.name=clean(patch.name,80);
  if(patch.vision!==undefined) next.vision=clean(patch.vision,1200);
  if(MODES.has(patch.mode)) next.mode=patch.mode;
  if(patch.hologram) next.hologram={...next.hologram,...patch.hologram};
  if(patch.sections) for(const [k,v] of Object.entries(patch.sections)) if(SECTIONS.includes(k)) next.sections[k]={...next.sections[k],...v};
  next.stage='blueprint'; next.approved=false; next.updatedAt=new Date().toISOString();
  next.revisions=[...(next.revisions||[]),{revisionId:id('rev'),actor,at:next.updatedAt,before:{name:before.name,vision:before.vision,mode:before.mode,sections:before.sections}}].slice(-100);
  next.simulation.readiness=blueprintReadiness(next);
  return next;
}
export function blueprintReadiness(bp) {
  const required=['vision','geography','gameplay','progression','social','permissions'];
  return Math.round(required.filter(k=>bp.sections?.[k]?.status==='ready').length/required.length*100);
}
export function branchBlueprint(bp,label='Alternative') {
  const branch=clone(bp); branch.blueprintId=id('bp'); branch.name=clean(label,80); branch.approved=false; branch.stage='blueprint'; branch.revisions=[]; return branch;
}
export function simulateBlueprint(bp, scenario={}) {
  const warnings=[]; const s=bp.sections||{};
  if(s.travel?.data?.requiresTelescope && !s.technology?.data?.telescope) warnings.push('Travel requires telescope progression but telescope technology is not defined.');
  if(s.technology?.data?.requiresElectricity && !s.infrastructure?.data?.power) warnings.push('Technology requires electricity but no power infrastructure is defined.');
  if(bp.mode==='civilization' && !Object.keys(s.resources?.data||{}).length) warnings.push('Civilization mode has no resource model.');
  const run={runId:id('sim'),at:new Date().toISOString(),scenario,readiness:blueprintReadiness(bp),warnings};
  const next=clone(bp); next.stage='simulation'; next.simulation.runs=[...(next.simulation.runs||[]),run].slice(-50); next.simulation.warnings=warnings; next.simulation.readiness=run.readiness;
  return {blueprint:next,run};
}
export function approveBlueprint(bp) {
  const readiness=blueprintReadiness(bp); if(readiness<100) throw new Error('Blueprint is not ready for approval.');
  const next=clone(bp); next.stage='approved'; next.approved=true; next.approvedAt=new Date().toISOString();
  next.constructionPlan={planId:id('forge'),status:'approved',phases:['validate','terrain','biomes','resources','infrastructure','architecture','gameplay','civilization','social','travel','optimize','activate'],sourceBlueprintId:next.blueprintId};
  return next;
}
export function blueprintManifest(bp){return {schema:bp.schema,blueprintId:bp.blueprintId,name:bp.name,mode:bp.mode,stage:bp.stage,approved:bp.approved,readiness:blueprintReadiness(bp),hologram:bp.hologram,sections:bp.sections,constructionPlan:bp.constructionPlan};}
