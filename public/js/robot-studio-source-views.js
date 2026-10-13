/**
 * Source Blueprint visual hierarchy only. Does not change MQL or claim
 * lexical function references are executable call order.
 * All function definitions are retained as individual inspectable nodes.
 */
const CATEGORY_IDS=['structure','sonic','campaign','risk','protection','collection','session','bridge'];
const WIDTH_ALL=1510, WIDTH_FOCUS=1260, WIDTH_COLLAPSED=1140;
const CARD_X=240, CARD_Y=145;
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
export function buildSourceHierarchy(caseFile){
  const {hospital}=caseFile;
  const byId=new Map(hospital.groups.map(g=>[g.id,g]));
  const categories=CATEGORY_IDS.map(id=>{
    const buckets=id==='bridge'?['bridge','custom']:[id];
    const functions=buckets.flatMap(key=>byId.get(key)?.functions||[]);
    const inputs=buckets.flatMap(key=>byId.get(key)?.inputs||[]);
    const title=id==='bridge'?'Accounts, server & other code':byId.get(id)?.title||id;
    return {id,title,buckets,functions,inputs};
  });
  const covered=new Set(categories.flatMap(c=>c.functions.map(f=>f.id)));
  // If future analyzers add categories, retain ALL unmatched functions under
  // the eighth umbrella rather than silently dropping source code.
  for(const fn of hospital.functions){
    if(!covered.has(fn.id))categories[7].functions.push(fn);
  }
  caseFile.categories=categories;
  caseFile.view='all';
  caseFile.activeCategory=null;
  caseFile.positions=new Map();
  caseFile.nodes=[
    ...categories.map(c=>({
      id:'module-'+c.id,type:'module',label:c.title,
      detail:c.functions.length+' functions · '+c.inputs.length+' controls',
      source:c.id,category:c.id,editable:false,x:0,y:0,
      evidence:'Subsystem inventory, not verified trading execution order'
    })),
    ...hospital.functions.map(f=>({
      id:'fn-'+f.id,type:'function',label:f.name,category:categories.find(c=>c.functions.some(v=>v.id===f.id))?.id||'bridge',
      detail:'lines '+f.line+'–'+f.endLine+' · '+f.calls.length+' source-name reference(s)',
      source:f.id,editable:false,x:0,y:0,
      evidence:'Original MQL definition; lexical references are NOT executable graph wiring'
    })),
    ...caseFile.nodes.filter(n=>n.type!=='module'&&n.type!=='function')
  ];
  setSourceView(caseFile,'all');
  return caseFile;
}
const viewKey=c=>c.view==='category'?'category:'+c.activeCategory:c.view;
export function visibleSourceNodes(c){return c.visibleNodes||c.nodes;}
export function setSourceView(c,view,category=null){
  if(!['all','collapsed','category'].includes(view))throw new Error('Invalid source layout.');
  if(view==='category'&&!c.categories.some(g=>g.id===category))throw new Error('Unknown category.');
  c.view=view;c.activeCategory=view==='category'?category:null;
  const cacheKey=viewKey(c),remember=c.positions?.get(cacheKey)||new Map();
  if(!c.positions)c.positions=new Map();
  c.positions.set(cacheKey,remember);
  let shown=[], width=WIDTH_ALL, cursor=35;
  const add=(node,x,y)=>{
    const previous=remember.get(node.id);
    node.x=previous?.x??x;
    node.y=previous?.y??y;
    shown.push(node);
  };
  if(view==='collapsed'){
    width=WIDTH_COLLAPSED;
    for(const [i,cat] of c.categories.entries()){
      const node=c.nodes.find(n=>n.id==='module-'+cat.id);
      add(node,35+(i%4)*275,70+Math.floor(i/4)*200);
    }
    cursor=500;
  } else{
    const focus=view==='category';
    width=focus?WIDTH_FOCUS:WIDTH_ALL;
    const categories=focus?c.categories.filter(t=>t.id===category):c.categories;
    const columns=focus?5:6;
    for(const group of categories){
      const header=c.nodes.find(n=>n.id==='module-'+group.id);
      add(header,35,cursor);
      cursor+=165;
      const funcs=c.nodes.filter(n=>n.type==='function'&&n.category===group.id)
        .sort((a,b)=>{
          const fnA=c.hospital.functions.find(f=>f.id===a.source);
          const fnB=c.hospital.functions.find(f=>f.id===b.source);
          return (fnA?.line||0)-(fnB?.line||0);
        });
      if(!funcs.length){cursor+=60;continue;}
      for(let i=0;i<funcs.length;i++)add(funcs[i],40+(i%columns)*CARD_X,cursor+Math.floor(i/columns)*CARD_Y);
      cursor+=Math.ceil(funcs.length/columns)*CARD_Y+50;
    }
    // Source-linked numeric controls/conditions and added gates are kept in a
    // dedicated lower section, never hidden by the 333 function limit.
    const extras=c.nodes.filter(n=>n.type!=='module'&&n.type!=='function');
    const selectedExtra=focus?extras.filter(n=>{
      if(n.type==='input'){
        const item=c.hospital.inputs.find(i=>i.id===n.source);
        return item?.category===category||(category==='bridge'&&item?.category==='custom');
      }
      if(n.type==='condition'||n.type==='action'){
        const line=n.type==='condition'?c.analysis.conditions.find(t=>t.id===n.source)?.line:
          c.analysis.links.find(t=>t.id===n.source)?.line;
        const fn=c.hospital.functions.find(t=>t.line<=line&&t.endLine>=line);
        const cat=fn?.category||'bridge';
        return cat===category||(category==='bridge'&&cat==='custom');
      }
      return false;
    }):extras;
    const relatedGates=c.gates.filter(g=>selectedExtra.some(n=>n.type==='condition'&&n.source===g.source));
    if(selectedExtra.length||relatedGates.length){
      cursor+=40;
      for(const [i,node] of [...selectedExtra,...relatedGates].entries())
        add(node,40+(i%columns)*CARD_X,cursor+Math.floor(i/columns)*CARD_Y);
      cursor+=Math.ceil((selectedExtra.length+relatedGates.length)/columns)*CARD_Y+80;
    }
  }
  c.visibleNodes=shown;
  c.dimensions={width,height:Math.max(850,cursor+50)};
  return {view:c.view,category:c.activeCategory,shown:shown.length,totalFunctions:c.hospital.functions.length,
    categoryCount:c.categories.length,...c.dimensions};
}
export function rememberSourcePosition(c,id,x,y){
  const n=visibleSourceNodes(c).find(v=>v.id===id);
  if(!n)throw new Error('Unknown visible source block.');
  const p={x:clamp(Math.round(x/10)*10,0,c.dimensions.width-210),
    y:clamp(Math.round(y/10)*10,0,c.dimensions.height-150)};
  n.x=p.x;n.y=p.y;
  c.positions.get(viewKey(c))?.set(id,p);
  return n;
}
export function sourceCategorySummary(c){
  return c.categories.map(g=>({id:g.id,title:g.title,functions:g.functions.length,inputs:g.inputs.length}));
}
export function sourceViewEdges(c,fullEdges){
  const shown=new Set(visibleSourceNodes(c).map(n=>n.id));
  return fullEdges.filter(e=>shown.has(e.from)&&shown.has(e.to));
}
