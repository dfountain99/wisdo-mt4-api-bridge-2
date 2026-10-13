/**
 * WISDO Source Blueprint: conservative source-backed graph for real MQ4/MQ5.
 * Never treat function-name references as executable control-flow edges.
 * "Gate" nodes are real source edits only on verified simple IF -> direct trade
 * calls, using short-circuit numeric input guards. Opaque nodes remain intact.
 */
import { analyzeHospitalSource, getHospitalChanges } from './robot-studio-hospital-core.js';
import { analyzeMqlSource, patchImportedSource, getSourceChanges } from './robot-studio-import-core.js';

const OPERATORS=['<','>','<=','>=','==','!='];
const maxNodes=38;
const isSafeIdentifier=s=>/^[A-Za-z_]\w{0,100}$/.test(s||'');
const normNumber=value=>{
  if(typeof value!=='number'&&typeof value!=='string')throw new Error('Numeric input required.');
  if(String(value).trim()===''||!Number.isFinite(Number(value)))throw new Error('Expected a finite numeric threshold.');
  return String(Number(value));
};
const numericTypes=new Set(['int','long','short','uint','ulong','ushort','char','uchar','double','float']);
const coord=(n,max)=>Math.min(max,Math.max(10,Math.round(n/10)*10));
function listNumericInputs(hospital){
  return hospital.inputs.filter(i=>
    !i.isInternalDefault&&numericTypes.has(i.type.toLowerCase())&&i.hospitalKind!=='readonly'&&isSafeIdentifier(i.name));
}
export function sourceBlueprint(source,filename){
  const analysis=analyzeMqlSource(source,filename);
  const hospital=analyzeHospitalSource(source,filename);
  const nodes=[], edges=[];
  // Module cards represent SOURCE INVENTORY, not a claimed trading sequence.
  const groups=hospital.groups.filter(g=>g.total>0).slice(0,8);
  groups.forEach((group,i)=>nodes.push({
    id:'module-'+group.id,type:'module',label:group.title,detail:group.functions.length+' functions · '+group.inputs.length+' controls',
    x:50+(i%4)*270,y:54+Math.floor(i/4)*175,source:group.id,editable:false,
    evidence:'inventory; execution links unknown'
  }));
  // Discover direct guard -> trade-call edges only when source scanner verifies a
  // single statement branch. Same-condition links are individually visible.
  const direct=analysis.links.slice(0,6), conditionMap=new Map(analysis.conditions.map(c=>[c.id,c]));
  direct.forEach((edge,i)=>{
    const guard=conditionMap.get(edge.from);
    if(!guard)return;
    const x=60+(i%2)*500,y=400+Math.floor(i/2)*145;
    nodes.push({id:'guard-'+guard.id,type:'condition',label:'IF '+guard.lhs+' '+guard.operator+' '+guard.valueOriginal,
      detail:'line '+guard.line+' · exact numeric condition',x,y,source:guard.id,editable:true,evidence:'verified direct call'});
    nodes.push({id:'action-'+i,type:'action',label:edge.action,detail:'line '+edge.line+' · original trade call preserved',
      x:x+208,y:y+17,source:edge.id,editable:false,evidence:'single direct call'});
    edges.push({from:'guard-'+guard.id,to:'action-'+i,kind:'verified',label:'TRUE'});
  });
  if(nodes.length<maxNodes){
    const featured=hospital.inputs.filter(i=>i.hospitalKind!=='readonly').slice(0,Math.min(direct.length?0:4,maxNodes-nodes.length));
    featured.forEach((item,i)=>{
      const j=nodes.length;
      nodes.push({id:'param-'+item.id,type:'input',label:item.name,detail:item.type+' · line '+item.line,
        x:60+(i%4)*260,y:425+Math.floor(i/4)*145,source:item.id,editable:true,
        evidence:item.isInternalDefault?'internal initial default':'declared input'});
    });
  }
  // When no direct trade linkage can be established, still show precise
  // editable IF thresholds, but do not draw fabricated execution wires.
  if(!direct.length){
    const extras=analysis.conditions.slice(0,4);
    extras.forEach((guard,i)=>nodes.push({
      id:'guard-'+guard.id,type:'condition',
      label:'IF '+guard.lhs+' '+guard.operator+' '+guard.valueOriginal,
      detail:'line '+guard.line+' · executable path unverified',
      x:65+(i%4)*260,y:615,source:guard.id,editable:true,
      evidence:'exact predicate; surrounding execution unknown'
    }));
  }
  if(!nodes.length)nodes.push({id:'opaque-all',type:'module',label:'Custom MQL source',detail:'No safe executable links recognized.',x:80,y:125,editable:false,source:'custom',evidence:'unmapped'});
  return {
    schema:'wisdo-source-blueprint-v1',filename,platform:analysis.platform,analysis,hospital,
    nodes:nodes.slice(0,maxNodes),edges,updates:{},gates:[],
    numericInputs:listNumericInputs(hospital),
    represented:{functions:hospital.functions.length,inputs:hospital.inputs.length,conditions:analysis.conditions.length,
      verifiedActions:direct.length,shown:nodes.length},
    original:source
  };
}
export function moveSourceNode(caseFile,id,x,y){
  const node=caseFile.nodes.find(n=>n.id===id)||caseFile.gates.find(n=>n.id===id);
  if(!node)throw new Error('Unknown source block.');
  node.x=coord(x,920);node.y=coord(y,690);
  return node;
}
export function updateSourceInput(caseFile,id,value){
  const item=caseFile.hospital.inputs.find(i=>i.id===id);
  if(!item)throw new Error('Unknown mapped input.');
  // The source patch engine is the final authority for enum & value validity.
  getHospitalChanges(caseFile.hospital,{[id]:value});
  caseFile.updates[id]=value;
}
export function updateSourceCondition(caseFile,id,operator,value){
  const found=caseFile.analysis.conditions.find(c=>c.id===id);
  if(!found)throw new Error('Unknown mapped condition.');
  const patch={operator,value:Number(normNumber(value))};
  patchImportedSource(caseFile.analysis,{[id]:patch});
  caseFile.updates[id]=patch;
  const node=caseFile.nodes.find(n=>n.source===id);
  if(node)node.label='IF '+found.lhs+' '+operator+' '+normNumber(value);
}
export function attachSourceGate(caseFile,guardId,{input,operator,threshold},gateId){
  const guard=caseFile.analysis.conditions.find(c=>c.id===guardId);
  if(!guard||!caseFile.analysis.links.some(l=>l.from===guardId))
    throw new Error('Attach gates only to verified direct-trade conditions.');
  if(!OPERATORS.includes(operator))throw new Error('Unsupported gate comparison.');
  const selected=caseFile.numericInputs.find(i=>i.name===input);
  if(!selected)throw new Error('Gate must use a mapped numeric global input.');
  const value=normNumber(threshold);
  const id=gateId||('source-gate-'+(caseFile.gates.length+1)+'-'+Date.now().toString(36));
  if(!/^[a-z0-9_-]{1,64}$/i.test(id)||caseFile.gates.some(g=>g.id===id))throw new Error('Invalid or duplicate gate ID.');
  if(caseFile.gates.length>=10)throw new Error('Maximum 10 safety gates per imported source.');
  const reference=caseFile.nodes.find(n=>n.source===guardId);
  const gate={id,type:'gate',label:'AND '+input+' '+operator+' '+value,
    detail:'Source-linked AND predicate · remove to disconnect',x:coord((reference?.x||80)+20,920),
    y:coord((reference?.y||380)-105,690),source:guardId,input,operator,threshold:Number(value),editable:true,
    evidence:'exact added numeric conjunction'};
  caseFile.gates.push(gate);
  return gate;
}
export function removeSourceGate(caseFile,id){
  const index=caseFile.gates.findIndex(g=>g.id===id);
  if(index<0)throw new Error('Gate not found.');
  caseFile.gates.splice(index,1);
}
export function reconnectSourceGate(caseFile,id,guardId){
  const gate=caseFile.gates.find(g=>g.id===id);
  if(!gate||!caseFile.analysis.links.some(l=>l.from===guardId))throw new Error('Only verified trade guards can receive a gate.');
  gate.source=guardId;
}
export function sourceEdges(caseFile){
  return [...caseFile.edges,...caseFile.gates.map(g=>({
    from:g.id,to:'guard-'+g.source,kind:'gate',label:'AND'
  }))];
}
function buildSourcePatches(caseFile){
  const {hospital,analysis,updates}=caseFile,changes=[];
  const chosen=new Set(hospital.inputs.map(i=>i.id));
  const hospitalUpdates=Object.fromEntries(Object.entries(updates).filter(([k])=>chosen.has(k)));
  for(const change of getHospitalChanges(hospital,hospitalUpdates))
    changes.push({start:change.start,end:change.end,to:change.to,kind:'input',label:change.name});
  const guardIds=new Set(analysis.conditions.map(c=>c.id));
  const guardUpdates=Object.fromEntries(Object.entries(updates).filter(([k])=>guardIds.has(k)));
  // Reuse the validated condition parser and its exact source ranges.
  patchImportedSource(analysis,guardUpdates);
  for(const guard of analysis.conditions){
    const update=guardUpdates[guard.id];
    if(!update)continue;
    const value=normNumber(update.value),operator=update.operator;
    if(operator!==guard.operator)changes.push({start:guard.operatorStart,end:guard.operatorEnd,to:operator,kind:'condition',label:guard.lhs});
    if(value!==guard.valueOriginal)changes.push({start:guard.valueStart,end:guard.valueEnd,to:value,kind:'condition',label:guard.lhs});
  }
  for(const guard of analysis.conditions){
    const gates=caseFile.gates.filter(g=>g.source===guard.id);
    if(!gates.length)continue;
    if(!analysis.links.some(l=>l.from===guard.id))throw new Error('Gate link no longer targets a verified direct call.');
    const filter=gates.map(g=>{
      if(!caseFile.numericInputs.some(i=>i.name===g.input)||!OPERATORS.includes(g.operator))
        throw new Error('Unsupported imported gate.');
      return '('+g.input+' '+g.operator+' '+normNumber(g.threshold)+')';
    }).join(' && ');
    changes.push({start:guard.valueEnd,end:guard.valueEnd,to:' && '+filter,kind:'inserted gate',label:guard.lhs});
  }
  changes.sort((a,b)=>b.start-a.start||b.end-a.end);
  for(let i=1;i<changes.length;i++){
    const prev=changes[i-1],current=changes[i];
    if(current.end>prev.start)throw new Error('Overlapping source edits blocked.');
  }
  return changes;
}
export function compileSourceBlueprint(caseFile){
  const changes=buildSourcePatches(caseFile);
  let result=caseFile.original;
  for(const patch of changes){
    if(patch.start<0||patch.end>result.length||patch.end<patch.start)
      throw new Error('Invalid source patch range.');
    result=result.slice(0,patch.start)+patch.to+result.slice(patch.end);
  }
  return {source:result,changes};
}
export function sourceCaseSummary(caseFile){
  return {name:caseFile.filename,platform:caseFile.platform,...caseFile.represented,
    displayedNodes:caseFile.nodes.length+caseFile.gates.length,
    editableGates:caseFile.gates.length,unverified:caseFile.hospital.functions.length,
    warning:'Only exact mapped values and optional numeric AND gates in verified single-action guards alter the imported source. Other nodes are inspect-only.'};
}
