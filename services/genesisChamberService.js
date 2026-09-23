export const GENESIS_BLUEPRINT_OPS = Object.freeze([
 'IDEA_ADD','IDEA_LINK','SET_FOCUS','SET_LENS','SET_LAYER_VISIBILITY','PAINT_ZONE',
 'PROPOSE_STRUCTURE','CREATE_SCENARIO_BRANCH','RUN_SIMULATION','SET_TECH_NODE','SET_RECIPE',
 'SET_SPACE_BODY','SET_DISCOVERY_RULE','ADD_SPATIAL_COMMENT','REQUEST_PREVIEW','APPROVE_GENESIS'
]);
export const GENESIS_SCALES = Object.freeze(['planet','continent','region','city','district','street','building','room','object']);
export const GENESIS_LENSES = Object.freeze(['geography','climate','resources','civilization','population','economy','energy','transport','crafting','technology','gameplay','npcs','social','space','performance','security']);
const safe=v=>JSON.parse(JSON.stringify(v??null));
export function validateGenesisBlueprintOp(input={}){
 const type=String(input.type||'').toUpperCase();
 if(!GENESIS_BLUEPRINT_OPS.includes(type)) throw new Error('Unsupported Genesis blueprint operation.');
 const op={type,payload:safe(input.payload||{}),context:safe(input.context||{}),createdAt:new Date().toISOString()};
 if(op.context.scale&&!GENESIS_SCALES.includes(op.context.scale)) throw new Error('Invalid Genesis spatial scale.');
 if(type==='SET_LENS'&&!GENESIS_LENSES.includes(op.payload.lens)) throw new Error('Invalid Genesis design lens.');
 return op;
}
export function createIdeaNode(text,category='vision'){
 const value=String(text||'').trim().slice(0,600); if(!value) throw new Error('Idea text is required.');
 return {ideaId:'idea_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7),text:value,category:String(category).slice(0,40),pinned:false,links:[],createdAt:new Date().toISOString()};
}
export function genesisDiagnostics(blueprint={}){
 const issues=[]; const s=blueprint.sections||{};
 if(s.travel?.data?.requiresTelescope&&!s.technology?.data?.telescope) issues.push({code:'TRAVEL_TELESCOPE_DEPENDENCY',section:'travel'});
 if(blueprint.mode==='civilization'&&!Object.keys(s.resources?.data||{}).length) issues.push({code:'CIVILIZATION_RESOURCES_UNDEFINED',section:'resources'});
 if(s.technology?.data?.requiresElectricity&&!s.infrastructure?.data?.power) issues.push({code:'POWER_DEPENDENCY_UNDEFINED',section:'infrastructure'});
 return {schema:'wisdo-genesis-diagnostics-v1',issues,unresolved:issues.length};
}
