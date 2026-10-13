/* WISDO Bot Hospital — visual diagnosis and conservative code-linked edits. */
import { MAX_SOURCE_BYTES, decodeMqlFile, encodeMqlSource } from './robot-studio-import-core.js';
import { analyzeHospitalSource, patchHospitalSource, getHospitalChanges, hospitalManifest } from './robot-studio-hospital-core.js';

const el = id => document.getElementById(id);
let caseFile = null, originalBytes = null, originalCodec = { encoding:'utf-8', bom:false };
let changes = {}, selected = 'structure', filter = '', order = [], fullPreview = false;
const HIGHTOWER_PUBLIC_SOURCE = 'https://raw.githubusercontent.com/dfountain99/wisdo-mt4-api-bridge-2/main/mql4/HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4';

function status(text, error=false) {
  const display = el('hosp-status');
  display.textContent = text;
  display.classList.toggle('error', error);
}
function download(name, bytes, mime='application/octet-stream') {
  const blob = new Blob([bytes], { type:mime }), url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function nameSafe(name) {
  return String(name || 'imported_robot.mq4').replace(/[^A-Za-z0-9_. -]/g,'_').slice(0,120);
}
function span(text,cls) {
  const x=document.createElement('span');x.textContent=text;if(cls)x.className=cls;return x;
}
function button(text,action,cls) {
  const x=document.createElement('button');x.type='button';x.textContent=text;if(cls)x.className=cls;
  x.addEventListener('click',action);return x;
}
function hasValue(key) {return Object.prototype.hasOwnProperty.call(changes,key);}
function visibleGroup(group) {
  if (!filter) return true;
  const q=filter.toLowerCase();
  return group.title.toLowerCase().includes(q) ||
    group.inputs.some(i=>i.name.toLowerCase().includes(q)) ||
    group.functions.some(f=>f.name.toLowerCase().includes(q));
}
function renderGroupCards() {
  if(!caseFile)return;
  const root=el('hosp-modules');root.replaceChildren();
  for(const id of order) {
    const group=caseFile.groups.find(g=>g.id===id);
    if(!group || !visibleGroup(group))continue;
    const card=document.createElement('button');
    card.type='button';card.className='hosp-module-card';
    card.dataset.group=id;card.setAttribute('aria-pressed',String(selected===id));
    card.draggable=true;
    card.append(span('◇','hosp-module-symbol'),span(group.title,'hosp-module-title'));
    card.append(span(group.functions.length+' functions · '+group.inputs.length+' controls','hosp-module-count'));
    card.addEventListener('click',()=>{selected=id;renderGroupCards();renderSelection();});
    card.addEventListener('dragstart',e=>{
      e.dataTransfer.setData('text/plain','hosp-group:'+id);
      e.dataTransfer.effectAllowed='move';
    });
    card.addEventListener('dragover',e=>{
      if(e.dataTransfer.types.includes('text/plain'))e.preventDefault();
    });
    card.addEventListener('drop',e=>{
      e.preventDefault();
      const raw=e.dataTransfer.getData('text/plain');
      if(!raw.startsWith('hosp-group:'))return;
      const moving=raw.slice(11);
      if(!order.includes(moving)||moving===id)return;
      const from=order.indexOf(moving);order.splice(from,1);
      order.splice(order.indexOf(id),0,moving);
      renderGroupCards();
      status('Hospital map rearranged visually. Imported function execution order was NOT modified.');
    });
    root.append(card);
  }
  if(!root.childElementCount)root.append(span('No mapped modules match this search. Clear the filter to see the complete X-ray.','help'));
}
function previewSource() {
  if(!caseFile)return;
  try {
    const source=patchHospitalSource(caseFile,changes);
    const list=getHospitalChanges(caseFile,changes);
    const preview=el('hosp-source-preview');
    preview.value=fullPreview?source:source.slice(0,120000);
    el('hosp-source-summary').textContent=source.length.toLocaleString()+' characters · '+list.length+' mapped code edits'+(fullPreview?' · full source visible':' · first 120,000 characters shown');
    el('hosp-export').disabled=false;el('hosp-report').disabled=false;
    const diffs=el('hosp-diff');diffs.replaceChildren();
    if(!list.length) diffs.textContent='No source changes. Export returns the original uploaded bytes.';
    for(const change of list) {
      const row=document.createElement('div');row.className='hosp-diff-row';
      row.append(span(change.name+' · line '+change.line+' · referenced in '+change.referencedBy.length+' function(s)'),span(change.from+' → '+change.to,'hosp-mono'));
      diffs.append(row);
    }
    status(list.length?list.length+' precisely mapped edit(s) staged. Not compiled or backtested.':'X-ray complete. Source preserved exactly until a supported input is changed.');
  } catch(error) {
    el('hosp-export').disabled=true;
    el('hosp-report').disabled=true;
    status('Edit blocked: '+error.message,true);
  }
}
function drawInput(input) {
  const wrapper=document.createElement('label');
  wrapper.className='hosp-input';
  const head=document.createElement('span');head.textContent=input.name+' · '+input.type;
  wrapper.append(head);
  const existing=hasValue(input.id)?changes[input.id]:input.hospitalKind==='enum'?input.original:input.value;
  let control;
  if(input.hospitalKind==='enum') {
    control=document.createElement('select');
    for(const option of input.options) {
      const item=document.createElement('option');item.value=option;item.textContent=option;
      control.append(item);
    }
    control.value=String(existing);
    control.addEventListener('change',()=>{changes[input.id]=control.value;previewSource();});
  } else if(input.hospitalKind==='bool') {
    control=document.createElement('input');control.type='checkbox';control.checked=Boolean(existing);
    control.addEventListener('change',()=>{changes[input.id]=control.checked;previewSource();});
  } else {
    control=document.createElement('input');
    const editable=input.hospitalKind!=='readonly';
    control.type=(input.hospitalKind==='string'||!editable)?'text':'number';
    if(input.hospitalKind==='integer')control.step='1';
    if(input.hospitalKind==='decimal')control.step='any';
    control.value=String(existing);control.readOnly=!editable;
    if(input.hospitalKind==='string')control.maxLength=180;
    if(editable) control.addEventListener('input',()=>{changes[input.id]=control.value;previewSource();});
    else control.title='The original expression stays read-only until its meaning is verified.';
  }
  control.setAttribute('aria-label','Edit '+input.name);
  wrapper.append(control);
  if(input.isInternalDefault)wrapper.append(span('INTERNAL DEFAULT · MAY BE OVERRIDDEN AT RUNTIME','hosp-readonly'));
  if(input.usedBy?.length) {
    const info=button('Used in '+input.usedBy.length+' function(s) · inspect',()=>{
      const linked=caseFile.functions.find(f=>input.usedBy.includes(f.name));
      if(linked)showFunction(linked);
      el('hosp-function-inspect').scrollIntoView({behavior:'smooth',block:'nearest'});
    },'hosp-impact-link');
    wrapper.append(info);
    info.title='Source-level identifier references only. This does not prove an execution or trading impact.';
  }
  if(input.hospitalKind==='readonly')wrapper.append(span('UNMAPPED • SOURCE PRESERVED','hosp-readonly'));
  return wrapper;
}
function showFunction(f) {
  const inspect=el('hosp-function-inspect');
  const details=caseFile.source.slice(Math.max(0,caseFile.source.lastIndexOf('\n',f.bodyStart)-140),f.bodyEnd);
  inspect.replaceChildren();
  const title=document.createElement('h4');
  title.textContent=f.name+' · lines '+f.line+'–'+f.endLine;
  const desc=document.createElement('p');desc.className='help';desc.textContent='References '+f.calls.length+' mapped function name(s). This does not prove runtime call order.';
  const links=document.createElement('p');links.className='hosp-function-links';
  links.textContent=f.calls.length?'REFERENCES: '+f.calls.slice(0,30).join(' → ')+(f.calls.length>30?' …':''):'No known in-file function references identified.';
  const code=document.createElement('pre');
  code.className='hosp-function-code';
  code.textContent=details.slice(0,16000)+(details.length>16000?'\n// Preview truncated. Full source remains preserved.':'');
  inspect.append(title,desc,links,code);
}
function renderSelection() {
  if(!caseFile)return;
  const group=caseFile.groups.find(g=>g.id===selected);
  const title=el('hosp-group-title'), controls=el('hosp-parameter-controls'), funcs=el('hosp-functions');
  title.textContent=group.title;
  el('hosp-group-caption').textContent=group.functions.length+' functions, '+group.inputs.length+' exposed inputs. Grouping is based on function and input names; it is not a verified execution sequence.';
  controls.replaceChildren();funcs.replaceChildren();
  const relatedInputs=filter?group.inputs.filter(x=>x.name.toLowerCase().includes(filter.toLowerCase())):group.inputs;
  const shownInputs=relatedInputs.slice(0,125);
  for(const input of shownInputs)controls.append(drawInput(input));
  if(!shownInputs.length)controls.append(span('No input controls in this module. Functions can still be inspected below.','help'));
  if(relatedInputs.length>shownInputs.length)controls.append(span('Showing first 125 matching controls. Narrow the search to locate the others.','help'));
  const filteredFns=filter?group.functions.filter(f=>f.name.toLowerCase().includes(filter.toLowerCase())):group.functions;
  for(const f of filteredFns.slice(0,85)) {
    const label=f.name+' · line '+f.line+' · '+f.calls.length+' calls';
    funcs.append(button(label,()=>showFunction(f),'hosp-fn-btn'));
  }
  if(filteredFns.length>85)funcs.append(span('Showing first 85 functions. Search to narrow results.','help'));
  const inspect=el('hosp-function-inspect');inspect.replaceChildren();
  if(filteredFns.length) showFunction(filteredFns[0]);
  else inspect.textContent='Select a function to inspect its original source and references.';
}
function renderDiagnostics() {
  const target=el('hosp-diagnostics');target.replaceChildren();
  for(const finding of caseFile.diagnostics) {
    const card=document.createElement('article');card.className='hosp-diagnostic';
    card.dataset.severity=finding.severity;
    const h=document.createElement('strong');h.textContent=finding.title;
    const d=document.createElement('p');d.textContent=finding.detail;
    card.append(h,d);target.append(card);
  }
}
function displayCase(analysis,bytes,codec) {
  caseFile=analysis;originalBytes=bytes;originalCodec=codec;
  changes={};selected='structure';filter='';fullPreview=false;
  order=analysis.groups.map(x=>x.id);
  el('hosp-search').value='';
  el('hosp-case').hidden=false;
  el('hosp-case-filename').textContent=analysis.filename+' · '+analysis.platform;
  el('hosp-case-stats').textContent=analysis.stats.lines.toLocaleString()+' lines · '+analysis.stats.functions+' functions · '+analysis.stats.enums+' enum types · '+analysis.stats.editable+' editable controls · '+analysis.stats.references+' in-file references';
  el('hosp-show-full').textContent='Show entire source';
  renderGroupCards();renderSelection();renderDiagnostics();previewSource();
  document.dispatchEvent(new CustomEvent('wisdo:hospital-admitted',{detail:{filename:analysis.filename}}));
}
async function admitBytes(bytes,name) {
  if(!/\.mq[45]$/i.test(name))throw new Error('Bot Hospital requires an editable MQ4/MQ5 source file, not EX4/EX5.');
  if(bytes.byteLength>MAX_SOURCE_BYTES)throw new Error('Source exceeds the 4 MB admission limit.');
  const decoded=decodeMqlFile(bytes);
  const result=analyzeHospitalSource(decoded.text,name);
  displayCase(result,bytes,{encoding:decoded.encoding,bom:decoded.bom});
}
async function admitFile(file) {
  if(!file)return;
  status('Reading source locally and mapping its anatomy…');
  try{await admitBytes(new Uint8Array(await file.arrayBuffer()),file.name);}
  catch(error){status('Admission failed: '+error.message,true);}
}
const picker=el('hosp-file');
el('hosp-choose').addEventListener('click',()=>picker.click());
picker.addEventListener('change',()=>{const file=picker.files?.[0];picker.value='';admitFile(file);});
el('hosp-drop').addEventListener('dragover',e=>{e.preventDefault();el('hosp-drop').classList.add('dragging');});
el('hosp-drop').addEventListener('dragleave',()=>el('hosp-drop').classList.remove('dragging'));
el('hosp-drop').addEventListener('drop',e=>{e.preventDefault();el('hosp-drop').classList.remove('dragging');admitFile(e.dataTransfer?.files?.[0]);});
el('hosp-example').addEventListener('click',async()=>{
  const b=el('hosp-example');b.disabled=true;status('Fetching public HIGHTOWER v6.21 source from GitHub…');
  try{
    const response=await fetch(HIGHTOWER_PUBLIC_SOURCE,{cache:'no-store',credentials:'omit'});
    if(!response.ok)throw new Error('GitHub responded '+response.status);
    const bytes=new Uint8Array(await response.arrayBuffer());
    await admitBytes(bytes,'HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4');
    status('HIGHTOWER source loaded from its public GitHub repository. Source edits remain local. No compilation or backtest was performed.');
  } catch(error){status('Could not load from GitHub: '+error.message+'. Download the MQ4 and import it manually instead.',true);}
  finally{b.disabled=false;}
});
el('hosp-search').addEventListener('input',e=>{
  filter=e.target.value.trim().slice(0,100);
  renderGroupCards();renderSelection();
});
el('hosp-reset').addEventListener('click',()=>{
  if(!caseFile)return;
  changes={};renderSelection();previewSource();
  status('All supported code edits cleared. Imported source restored exactly.');
});
el('hosp-show-full').addEventListener('click',()=>{
  fullPreview=!fullPreview;
  el('hosp-show-full').textContent=fullPreview?'Show short preview':'Show entire source';
  previewSource();
});
el('hosp-backup').addEventListener('click',()=>{
  if(!caseFile||!originalBytes)return;
  download('ORIGINAL_'+nameSafe(caseFile.filename),originalBytes);
  status('Original unmodified bytes exported for backup.');
});
el('hosp-export').addEventListener('click',()=>{
  try{
    const patched=patchHospitalSource(caseFile,changes);
    const edited=getHospitalChanges(caseFile,changes);
    const bytes=!edited.length?originalBytes:encodeMqlSource(patched,originalCodec);
    download(nameSafe(caseFile.filename),bytes);
    status('Downloaded '+edited.length+' change(s) in original '+caseFile.platform+' source encoding. You must compile and demo-test it before use.');
  }catch(error){status('Export blocked: '+error.message,true);}
});
el('hosp-report').addEventListener('click',()=>{
  try{
    const report=hospitalManifest(caseFile,changes);
    const name=nameSafe(caseFile.filename).replace(/\.mq[45]$/i,'');
    download(name+'_hospital_report.json',new TextEncoder().encode(JSON.stringify(report,null,2)),'application/json');
    status('Downloaded diagnosis report. No compilation, runtime test or semantic verification has taken place.');
  }catch(error){status('Report blocked: '+error.message,true);}
});
