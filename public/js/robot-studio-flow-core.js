/**
 * WISDO Flow Builder V3 — a typed, executable (source-generating) graph format.
 * This module intentionally compiles only newly constructed, known blocks.
 * It does not reinterpret arbitrary HIGHTOWER/MQL imports.
 */
import { createDraft, normalizeDraft, validateDraft, generateMql4 } from './robot-studio-core.js';

export const FLOW_VERSION = 1;
export const FLOW_KEY = 'wisdo.robot-studio.flow.v1';
export const MAX_FLOW_NODES = 50;
export const BLOCKS = Object.freeze({
  tick: { title:'OnTick event', icon:'◉', group:'Trigger', ports:['next'], description:'Runs the graph once per completed candle.' },
  ema: { title:'EMA crossover', icon:'⌁', group:'Condition', ports:['true','false'], description:'Up or down crossover from two completed candles.' },
  rsi: { title:'RSI threshold', icon:'◇', group:'Condition', ports:['true','false'], description:'RSI comparison on the last closed candle.' },
  session: { title:'Trading hours', icon:'◷', group:'Filter', ports:['true','false'], description:'Broker-server hours; overnight windows supported.' },
  spread: { title:'Spread check', icon:'⛨', group:'Filter', ports:['true','false'], description:'Current broker bid/ask spread in pips.' },
  buy: { title:'Open BUY', icon:'↗', group:'Action', ports:[], description:'Market buy through WISDO safety/size helper.' },
  sell: { title:'Open SELL', icon:'↘', group:'Action', ports:[], description:'Market sell through WISDO safety/size helper.' },
  wait: { title:'End / do nothing', icon:'◼', group:'Action', ports:[], description:'Ends this branch without trading.' }
});
const TYPES = Object.keys(BLOCKS);
const defaultParams = {
  tick: {}, ema: { direction:'up',fast:9,slow:21 },
  rsi: { mode:'below', period:14, threshold:30 },
  session: { start:8,end:18 },
  spread: { max:2 }, buy:{},sell:{},wait:{}
};
const int = (n,lo,hi) => Number.isInteger(n) && n>=lo && n<=hi;
const num = (n,lo,hi) => typeof n==='number' && Number.isFinite(n) && n>=lo && n<=hi;
export function freshNode(type,id,x=120,y=100){
  if(!BLOCKS[type])throw new Error('Unsupported block type: '+type);
  return { id, type, x, y, params: { ...defaultParams[type] } };
}
export function exampleFlow(){
  const settings = createDraft();
  return {
    schema: 'wisdo-flow-graph', version: FLOW_VERSION, settings,
    nodes:[
      freshNode('tick','tick',72,220),
      freshNode('ema','buy-signal',380,100),
      freshNode('ema','sell-signal',380,400),
      freshNode('buy','buy-action',750,90),
      freshNode('sell','sell-action',750,400),
      freshNode('wait','no-trade',750,610)
    ],
    edges:[
      { from:'tick',port:'next',to:'buy-signal' },
      { from:'buy-signal',port:'true',to:'buy-action' },
      { from:'buy-signal',port:'false',to:'sell-signal' },
      { from:'sell-signal',port:'true',to:'sell-action' },
      { from:'sell-signal',port:'false',to:'no-trade' }
    ]
  };
}
exampleFlow; // Do not execute network or brokers; graph is just an editable project.

function checkParams(n, errors){
  const p=n.params;
  const label=n.id+': ';
  if(n.type==='ema'){
    if(!['up','down'].includes(p.direction))errors.push(label+'EMA direction must be up or down.');
    if(!int(p.fast,2,100)||!int(p.slow,3,300)||p.fast>=p.slow)
      errors.push(label+'EMA periods must be integers, fast 2–100 and slow 3–300, fast below slow.');
  }
  if(n.type==='rsi'){
    if(!['below','above'].includes(p.mode)||!int(p.period,2,100)||!num(p.threshold,1,99))
      errors.push(label+'RSI mode/period/threshold invalid.');
  }
  if(n.type==='session'){
    if(!int(p.start,0,23)||!int(p.end,0,23)||p.start===p.end)
      errors.push(label+'Hours must be between 0–23, with different start/end.');
  }
  if(n.type==='spread'&&!num(p.max,0.1,100))
    errors.push(label+'Spread maximum must be between 0.1 and 100 pips.');
}
export function validateFlow(g){
  const errors=[];
  if(!g || typeof g!=='object'||Array.isArray(g))return ['Invalid graph project.'];
  if(g.schema!=='wisdo-flow-graph'||g.version!==FLOW_VERSION)errors.push('Unsupported flow project schema/version.');
  if(!Array.isArray(g.nodes)||!Array.isArray(g.edges))return [...errors,'Expected nodes and edges arrays.'];
  if(g.nodes.length>MAX_FLOW_NODES||g.nodes.length<1)errors.push('Flow must contain 1–'+MAX_FLOW_NODES+' nodes.');
  if(g.edges.length>2*MAX_FLOW_NODES)errors.push('Too many graph connections.');
  let cfg;
  try { cfg=normalizeDraft(g.settings); errors.push(...validateDraft(cfg).map(e=>'Robot settings: '+e)); }
  catch(e){errors.push(e.message);}
  const byId=new Map();
  for(const n of g.nodes){
    if(!n || typeof n!=='object' || !/^[a-zA-Z0-9_-]{1,64}$/.test(n.id||'')){errors.push('Invalid block ID.');continue;}
    if(byId.has(n.id))errors.push('Duplicate block ID: '+n.id);
    byId.set(n.id,n);
    if(!BLOCKS[n.type]){errors.push(n.id+': unknown block type.');continue;}
    if(!num(n.x,0,8000)||!num(n.y,0,8000))errors.push(n.id+': invalid canvas coordinates.');
    if(!n.params||typeof n.params!=='object'||Array.isArray(n.params))errors.push(n.id+': invalid parameters.');
    else checkParams(n,errors);
  }
  const roots=g.nodes.filter(n=>n?.type==='tick');
  if(roots.length!==1)errors.push('Exactly one OnTick event block is required.');
  const outgoing=new Map(), incoming=new Map();
  for(const e of g.edges){
    if(!e || typeof e!=='object'){errors.push('Invalid connection.');continue;}
    const a=byId.get(e.from), b=byId.get(e.to);
    if(!a || !b){errors.push('Connection points at a missing block.');continue;}
    if(!BLOCKS[a.type]?.ports.includes(e.port)){errors.push('Invalid output port on '+e.from+'.');continue;}
    if(e.to===e.from)errors.push('Block cannot link to itself.');
    if(b.type==='tick')errors.push('OnTick event cannot receive a connection.');
    const key=e.from+'|'+e.port;
    if(outgoing.has(key))errors.push(e.from+': each output socket connects to at most one target.');
    outgoing.set(key,e.to);
    incoming.set(e.to,(incoming.get(e.to)||0)+1);
  }
  for(const n of g.nodes)if(n&&n.type!=='tick'&&incoming.get(n.id)!==1)
    errors.push(n.id+': connect exactly one incoming path; delete unconnected blocks before export.');
  if(roots.length===1){
    const visited=new Set(), active=new Set();
    const walk=(id)=>{
      if(active.has(id)){errors.push('Cycle detected: loops are not supported in this compiler.');return;}
      if(visited.has(id))return;
      visited.add(id);active.add(id);
      const node=byId.get(id);
      if(node&&BLOCKS[node.type])for(const port of BLOCKS[node.type].ports){
        const next=outgoing.get(id+'|'+port);
        if(next)walk(next);
      }
      active.delete(id);
    };
    walk(roots[0].id);
    for(const n of g.nodes)if(n&&!visited.has(n.id))errors.push(n.id+': unreachable from OnTick.');
    if(!outgoing.has(roots[0].id+'|next'))errors.push('Connect OnTick to a first block.');
    if(!g.nodes.some(n=>visited.has(n.id)&&['buy','sell'].includes(n.type)))
      errors.push('At least one reachable Buy or Sell action is required.');
  }
  return [...new Set(errors)];
}
export function connectFlow(raw, from, port, to){
  const g=structuredClone(raw);
  const source=g.nodes.find(n=>n.id===from),target=g.nodes.find(n=>n.id===to);
  if(!source||!target||!BLOCKS[source.type].ports.includes(port)||target.type==='tick'||from===to)
    throw new Error('Select a valid output port and another non-event block.');
  g.edges=g.edges.filter(e=>!(e.from===from&&e.port===port)&&e.to!==to);
  g.edges.push({from,port,to});
  // Check cycles even while the canvas contains disconnected/unreachable blocks.
  const byId=new Map(g.nodes.map(n=>[n.id,n])), adjacency=new Map();
  for(const edge of g.edges){if(!adjacency.has(edge.from))adjacency.set(edge.from,[]);adjacency.get(edge.from).push(edge.to);}
  const seen=new Set(), stack=new Set();
  const visit=(id)=>{
    if(stack.has(id))return true;
    if(seen.has(id))return false;
    seen.add(id);stack.add(id);
    for(const next of adjacency.get(id)||[])if(byId.has(next)&&visit(next))return true;
    stack.delete(id);return false;
  };
  if(g.nodes.some(n=>visit(n.id)))throw new Error('Connection rejected: a cycle would be created.');
  return g;
}
export function removeFlowNode(raw,id){
  const g=structuredClone(raw), node=g.nodes.find(n=>n.id===id);
  if(!node)throw new Error('Block not found.');
  if(node.type==='tick')throw new Error('OnTick cannot be removed.');
  g.nodes=g.nodes.filter(n=>n.id!==id);
  g.edges=g.edges.filter(e=>e.from!==id&&e.to!==id);
  return g;
}
export function deserializeFlow(json){
  if(typeof json!=='string'||json.length>140000)throw new Error('Flow JSON must be a project under 140 KB.');
  let g;try{g=JSON.parse(json);}catch{throw new Error('Invalid flow project JSON.');}
  const errors=validateFlow(g);
  if(errors.length)throw new Error(errors.join('\n'));
  // Whitelist project fields so unnecessary untrusted data is not retained.
  return {
    schema:'wisdo-flow-graph',version:FLOW_VERSION,settings:normalizeDraft(g.settings),
    nodes:g.nodes.map(n=>({id:n.id,type:n.type,x:n.x,y:n.y,params:{...n.params}})),
    edges:g.edges.map(e=>({from:e.from,port:e.port,to:e.to}))
  };
}
export function exportFlowJson(graph){
  const errors=validateFlow(graph);
  if(errors.length)throw new Error(errors.join('\n'));
  return JSON.stringify(deserializeFlow(JSON.stringify(graph)),null,2)+'\n';
}
function emitCondition(node){
  const p=node.params;
  if(node.type==='ema'){
    const fast=p.fast,slow=p.slow;
    const dir=p.direction==='up';
    const f1='iMA(Symbol(),0,'+fast+',0,MODE_EMA,PRICE_CLOSE,1)';
    const f2='iMA(Symbol(),0,'+fast+',0,MODE_EMA,PRICE_CLOSE,2)';
    const s1='iMA(Symbol(),0,'+slow+',0,MODE_EMA,PRICE_CLOSE,1)';
    const s2='iMA(Symbol(),0,'+slow+',0,MODE_EMA,PRICE_CLOSE,2)';
    return dir?'('+f1+' > '+s1+' && '+f2+' <= '+s2+')':'('+f1+' < '+s1+' && '+f2+' >= '+s2+')';
  }
  if(node.type==='rsi')return '(iRSI(Symbol(),0,'+p.period+',PRICE_CLOSE,1) '+(p.mode==='above'?'>':'<')+' '+p.threshold+')';
  if(node.type==='spread')return '((Ask-Bid)/PipSize() <= '+p.max+')';
  if(node.type==='session')return p.start<p.end ?
    '(TimeHour(TimeCurrent()) >= '+p.start+' && TimeHour(TimeCurrent()) < '+p.end+')' :
    '(TimeHour(TimeCurrent()) >= '+p.start+' || TimeHour(TimeCurrent()) < '+p.end+')';
  throw new Error('Unknown condition block.');
}
export function generateFlowMql4(raw){
  const errors=validateFlow(raw);
  if(errors.length)throw new Error(errors.join('\n'));
  const g=raw, byId=new Map(g.nodes.map(n=>[n.id,n]));
  const from=new Map(g.edges.map(e=>[e.from+'|'+e.port,e.to]));
  const root=g.nodes.find(n=>n.type==='tick');
  const settings=normalizeDraft(g.settings);
  // Inherit mature fixed/percent risk, stop, spread, margin and order gates.
  // None of the original starter strategy OnTick rules are included.
  const prefix=generateMql4({...settings,rsiEnabled:false,sessionEnabled:false});
  const index=prefix.indexOf('\nvoid OnTick() {');
  if(index===-1)throw new Error('WISDO source template did not contain a known OnTick function.');
  const maxBars=Math.max(5,...g.nodes.map(n=>n.type==='ema'?n.params.slow+5:n.type==='rsi'?n.params.period+5:5));
  const lines=[
    'void OnTick() {',
    '  // WISDO FLOW GRAPH v1: branch order follows typed graph sockets.',
    '  if (Bars < '+maxBars+') return;',
    '  datetime candle = iTime(Symbol(), PERIOD_CURRENT, 0);',
    '  if (candle <= 0 || candle == g_lastCandle) return;',
    '  g_lastCandle = candle;',
    '  if (!IsTradeAllowed() || HasOwnOpenOrder()) return;',
    '  RefreshRates();',
    '  if ((Ask-Bid)/PipSize() > MaxSpreadPips) return;'
  ];
  const emit=(id,level)=>{
    if(!id)return;
    const n=byId.get(id),pad='  '.repeat(level);
    if(n.type==='buy'||n.type==='sell'){
      lines.push(pad+'SubmitTrade('+(n.type==='buy'?'OP_BUY':'OP_SELL')+');');return;
    }
    if(n.type==='wait')return;
    lines.push(pad+'if ('+emitCondition(n)+') {');
    emit(from.get(n.id+'|true'),level+1);
    const no=from.get(n.id+'|false');
    if(no){lines.push(pad+'} else {');emit(no,level+1);}
    lines.push(pad+'}');
  };
  emit(from.get(root.id+'|next'),1);
  lines.push('}','');
  return prefix.slice(0,index)+'\n'+lines.join('\n');
}
