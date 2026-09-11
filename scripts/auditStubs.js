import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const patterns=/TODO|FIXME|placeholder|coming soon|not implemented|website-buyer|active_manual|fake success|simulate/gi;
const allowedExtensions=new Set(['.js','.json','.md','.html']);
const excludedDirectories=new Set(['node_modules','.git','data','.venv','dist','build']);

function isExcludedPath(file=''){
  return String(file).replaceAll('\\','/').split('/').some((segment)=>excludedDirectories.has(segment)||segment.startsWith('.venv'));
}

async function walk(directory,relative=''){
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(entry.isDirectory()&&(excludedDirectories.has(entry.name)||entry.name.startsWith('.venv')))continue;
    const rel=relative?`${relative}/${entry.name}`:entry.name;
    const full=path.join(directory,entry.name);
    if(entry.isDirectory())files.push(...await walk(full,rel));
    else if(entry.isFile()&&allowedExtensions.has(path.extname(entry.name).toLowerCase()))files.push(rel.replaceAll('\\','/'));
  }
  return files;
}

function gitFiles(){
  try{
    return execFileSync('git',['ls-files','*.js','*.json','*.md','*.html'],{encoding:'utf8',cwd:root,stdio:['ignore','pipe','ignore']})
      .trim().split(/\r?\n/).filter(Boolean);
  }catch{return null;}
}

function classify(file,line,term){
  if(file.startsWith('render/'))return'DUPLICATE_NON_CANONICAL';
  if(file.startsWith('tests/')||/\.test\.js$/i.test(file))return'TEST_ONLY';
  if(file.startsWith('docs/')||file.endsWith('.md'))return'DOCUMENTATION_REFERENCE';
  if(file.startsWith('scripts/'))return'DEVELOPMENT_TOOLING';
  if(/simulat|dry.?run/i.test(`${file} ${line}`)&&/simulate/i.test(term))return'INTENTIONAL_SIMULATION';
  if(/setPlaceholder|placeholder\s*[:=]|placeholderText/i.test(line)&&/placeholder/i.test(term))return'UI_INPUT_ATTRIBUTE';
  if(/placeholder\/local|PUBLIC_BASE_URL/i.test(line)&&/placeholder/i.test(term))return'CONFIGURATION_GUARD';
  if(/DatabasePersistenceAdapterPlaceholder/i.test(line))return'UNUSED_FAIL_CLOSED_GUARD';
  if(/pending_hook|not trusted until scanner/i.test(line)&&/placeholder/i.test(term))return'FAIL_CLOSED_SECURITY_GUARD';
  if(/no longer a placeholder/i.test(line))return'VERIFIED_FEATURE_COPY';
  if(/function inputRow|if \(placeholder\)/i.test(line))return'UI_INPUT_ATTRIBUTE';
  return'REVIEW_REQUIRED';
}

const files=(gitFiles()||await walk(root)).filter((file)=>!isExcludedPath(file)&&!file.includes('legacy-source-notes'));
const findings=[];
for(const file of files){
  const body=await readFile(path.join(root,file),'utf8').catch(()=>null);
  if(body===null)continue;
  const lines=body.split(/\r?\n/);
  for(const match of body.matchAll(patterns)){
    const lineNumber=body.slice(0,match.index).split('\n').length;
    const line=lines[lineNumber-1]||'';
    findings.push({file,line:lineNumber,term:match[0],classification:classify(file,line,match[0])});
  }
}
const review=findings.filter((row)=>row.classification==='REVIEW_REQUIRED');
console.log(JSON.stringify({ok:review.length===0,source:gitFiles()?'git':'filesystem',filesScanned:files.length,findings:findings.length,reviewRequired:review.length,counts:Object.fromEntries([...new Set(findings.map((row)=>row.classification))].map((kind)=>[kind,findings.filter((row)=>row.classification===kind).length])),items:review.slice(0,200)},null,2));
if(review.length)process.exitCode=1;
