import { blueprintManifest } from './worldBlueprintService.js';
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const op=(type,payload,phase)=>({type,phase,payload});
export function compileApprovedBlueprint(bp){
  if(!bp?.approved||bp.stage!=='approved') throw new Error('Only approved blueprints can be forged.');
  const seed=hash(bp.blueprintId+bp.name), s=bp.sections||{}, operations=[];
  operations.push(op('SET_WORLD_RULE',{mode:bp.mode,seed},'validate'));
  operations.push(op('SET_TERRAIN',{seed,geography:s.geography?.data||{},biomes:s.biomes?.data||{}},'terrain'));
  operations.push(op('SET_WEATHER',{climate:s.climate?.data||{}},'biomes'));
  for(const [name,data] of Object.entries(s.cities?.data||{})) operations.push(op('CREATE_ZONE',{kind:'city',name,data},'architecture'));
  operations.push(op('ACTIVATE_MODULE',{module:'crafting',config:s.crafting?.data||{}},'gameplay'));
  operations.push(op('ACTIVATE_MODULE',{module:'progression',config:s.progression?.data||{}},'civilization'));
  operations.push(op('ACTIVATE_MODULE',{module:'planet-travel',config:s.travel?.data||{}},'travel'));
  operations.push(op('ACTIVATE_MODULE',{module:'social-worlds',config:s.social?.data||{}},'social'));
  return {schema:'wisdo-world-forge-plan-v1',planId:bp.constructionPlan?.planId,seed,source:blueprintManifest(bp),phases:bp.constructionPlan?.phases||[],operations};
}
