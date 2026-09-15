import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  JOB_MARKER,
  issueIsJob,
  extractJobJson,
  validateJob,
  claimPayload,
  parseClaim,
  resultPayload,
  slug,
} from './protocol.mjs';

const REPO=process.env.WISDO_BLENDER_REPO||'dfountain99/wisdo-mt4-api-bridge-2';
const API='https://api.github.com';
const AGENT_ID=process.env.WISDO_BLENDER_AGENT_ID||`${os.hostname()}-${process.pid}`;
const POLL_MS=Math.max(15_000,Number(process.env.WISDO_BLENDER_POLL_MS||30_000));
const ONCE=process.argv.includes('--once');
const ROOT=process.cwd();
const TMP_ROOT=path.resolve(process.env.WISDO_BLENDER_WORK_ROOT||path.join(ROOT,'tools/blender/temp/bridge'));
const RUN_TESTS=String(process.env.WISDO_BLENDER_RUN_TESTS||'true').toLowerCase()!=='false';

function token() {
  if(process.env.WISDO_BLENDER_GITHUB_TOKEN) return process.env.WISDO_BLENDER_GITHUB_TOKEN.trim();
  if(process.env.GH_TOKEN) return process.env.GH_TOKEN.trim();
  try{return execFileSync('gh',['auth','token'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
  throw new Error('No GitHub credential available. Set WISDO_BLENDER_GITHUB_TOKEN / GH_TOKEN or authenticate GitHub CLI.');
}
const TOKEN=token();

async function gh(pathname, {method='GET',body}={}) {
  const response=await fetch(`${API}${pathname}`,{
    method,
    headers:{
      accept:'application/vnd.github+json',
      authorization:`Bearer ${TOKEN}`,
      'x-github-api-version':'2022-11-28',
      'user-agent':'wisdo-blender-bridge-v1',
      ...(body?{'content-type':'application/json'}:{}),
    },
    body:body?JSON.stringify(body):undefined,
  });
  const text=await response.text();
  const data=text?JSON.parse(text):null;
  if(!response.ok) throw new Error(`GitHub ${method} ${pathname} -> ${response.status}: ${data?.message||text}`);
  return data;
}

function authHeader() {
  return `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${TOKEN}`).toString('base64')}`;
}
function git(args,{cwd=ROOT,capture=false}={}) {
  const result=spawnSync('git',['-c',`http.extraheader=${authHeader()}`,...args],{
    cwd,encoding:'utf8',stdio:capture?['ignore','pipe','pipe']:'inherit'
  });
  if(result.status!==0) throw new Error(`git ${args.join(' ')} failed: ${capture?result.stderr:''}`);
  return capture?result.stdout.trim():'';
}
function run(command,args,{cwd=ROOT,allowFailure=false}={}) {
  const result=spawnSync(command,args,{cwd,encoding:'utf8',stdio:'inherit',env:process.env});
  if(result.status!==0&&!allowFailure) throw new Error(`${command} ${args.join(' ')} failed with ${result.status}`);
  return result.status??1;
}
function ownerRepo() {
  const [owner,repo]=REPO.split('/');
  if(!owner||!repo) throw new Error('WISDO_BLENDER_REPO must be owner/repo.');
  return {owner,repo};
}
async function listJobs() {
  const {owner,repo}=ownerRepo();
  const issues=await gh(`/repos/${owner}/${repo}/issues?state=open&sort=created&direction=asc&per_page=50`);
  return issues.filter(issueIsJob);
}
async function comments(number) {
  const {owner,repo}=ownerRepo();
  return gh(`/repos/${owner}/${repo}/issues/${number}/comments?per_page=100`);
}
async function comment(number,body) {
  const {owner,repo}=ownerRepo();
  return gh(`/repos/${owner}/${repo}/issues/${number}/comments`,{method:'POST',body:{body}});
}
async function closeIssue(number) {
  const {owner,repo}=ownerRepo();
  return gh(`/repos/${owner}/${repo}/issues/${number}`,{method:'PATCH',body:{state:'closed'}});
}
async function claim(issue) {
  const existing=(await comments(issue.number)).map((c)=>({c,claim:parseClaim(c.body)})).filter((x)=>x.claim);
  if(existing.length) return existing[0].claim.agent===AGENT_ID;
  await comment(issue.number,claimPayload(AGENT_ID));
  const verified=(await comments(issue.number)).map((c)=>({c,claim:parseClaim(c.body)})).filter((x)=>x.claim);
  verified.sort((a,b)=>new Date(a.c.created_at)-new Date(b.c.created_at)||a.c.id-b.c.id);
  return verified[0]?.claim?.agent===AGENT_ID;
}
function ensureCleanBase() {
  mkdirSync(TMP_ROOT,{recursive:true});
  git(['fetch','origin','main'],{cwd:ROOT});
}
function makeWorktree(issue,job) {
  const dir=path.join(TMP_ROOT,`job-${issue.number}-${job.assetId}`);
  rmSync(dir,{recursive:true,force:true});
  git(['worktree','add','--detach',dir,'origin/main'],{cwd:ROOT});
  const branch=`blender/job-${issue.number}-${slug(job.assetId)}`;
  git(['switch','-c',branch],{cwd:dir});
  return {dir,branch};
}
function removeWorktree(dir) {
  try{git(['worktree','remove','--force',dir],{cwd:ROOT});}catch{}
  rmSync(dir,{recursive:true,force:true});
}
async function materializeSource(job,dir) {
  if(job.source.kind==='repo') {
    const source=path.resolve(dir,job.source.repoPath);
    if(!source.startsWith(path.resolve(dir)+path.sep)||!existsSync(source)) throw new Error(`Repository source missing: ${job.source.repoPath}`);
    return source;
  }
  const destDir=path.join(dir,'tools/blender/temp/downloads');
  mkdirSync(destDir,{recursive:true});
  const dest=path.join(destDir,job.source.filename);
  const response=await fetch(job.source.url,{headers:{'user-agent':'wisdo-blender-bridge-v1'}});
  if(!response.ok) throw new Error(`Source download failed (${response.status})`);
  const bytes=Buffer.from(await response.arrayBuffer());
  const maxMb=Math.max(10,Number(process.env.WISDO_BLENDER_MAX_SOURCE_MB||750));
  if(bytes.length>maxMb*1024*1024) throw new Error(`Source asset exceeds ${maxMb}MB limit.`);
  writeFileSync(dest,bytes);
  return dest;
}
function presetPath(job) {
  const map={character:'character.json',arcade:'arcade.json',building:'building.json',vehicle:'vehicle.json',vegetation:'vegetation.json',prop:'building.json'};
  return `tools/blender/presets/${map[job.assetType]}`;
}
function runBlender(job,dir,inputPath) {
  const args=['tools/blender/run_blender.mjs','build',
    '--input',inputPath,
    '--type',job.assetType,
    '--name',job.name,
    '--output',job.output,
    '--report',job.report,
    '--preset',presetPath(job),
  ];
  if(job.targetHeight!=null) args.push('--target-height',String(job.targetHeight));
  if(job.lodRatios?.length) args.push('--lod-ratios',job.lodRatios.join(','));
  run(process.execPath,args,{cwd:dir});
  if(!existsSync(path.join(dir,job.output))) throw new Error('Blender exited without producing the expected GLB.');
  if(!existsSync(path.join(dir,job.report))) throw new Error('Blender exited without producing the expected asset report.');
}
function registerAsset(job,dir) {
  if(job.registerTarget==='none') return;
  run(process.execPath,['tools/blender/bridge/register-generated-asset.mjs',
    '--target',job.registerTarget,
    '--asset-id',job.assetId,
    '--output',job.output,
    '--report',job.report,
    '--license',job.license,
    '--source-note',job.sourceNote||'',
  ],{cwd:dir});
}
function validateRepo(job,dir) {
  run(process.execPath,['--check','public/app/world/authored-asset-manifest.js'],{cwd:dir});
  run(process.execPath,['--check','public/app/world/generated-asset-registry.js'],{cwd:dir});
  const report=JSON.parse(readFileSync(path.join(dir,job.report),'utf8'));
  if(report?.checks?.glbExport!=='PASS') throw new Error('Asset report does not show a successful GLB export.');
  if(job.assetType==='character'&&report?.checks?.armature!=='PASS') throw new Error('Character report does not pass armature validation.');
  if(RUN_TESTS) run('npm',['test'],{cwd:dir});
}
function commitAndPush(issue,job,dir,branch) {
  git(['add','--',job.output,job.report,'public/app/world/generated-asset-registry.js'],{cwd:dir});
  const staged=git(['diff','--cached','--name-only'],{cwd:dir,capture:true});
  if(!staged) throw new Error('Bridge produced no staged asset changes.');
  git(['commit','-m',`feat(world-assets): build ${job.assetId} with Blender bridge`],{cwd:dir});
  git(['push','origin',`HEAD:refs/heads/${branch}`],{cwd:dir});
}
async function createPr(issue,job,branch) {
  const {owner,repo}=ownerRepo();
  const existing=await gh(`/repos/${owner}/${repo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}&base=main`);
  if(existing.length) return existing[0];
  return gh(`/repos/${owner}/${repo}/pulls`,{method:'POST',body:{
    title:`feat(world-assets): Blender build ${job.assetId}`,
    head:branch,
    base:'main',
    body:[
      `Automated Blender Bridge output for #${issue.number}.`,
      '',
      `- Asset: \`${job.assetId}\``,
      `- Type: \`${job.assetType}\``,
      `- Output: \`${job.output}\``,
      `- Report: \`${job.report}\``,
      `- Runtime registration: \`${job.registerTarget}\``,
      '',
      'Generated by the checked-in WISDO Blender pipeline. The bridge does not execute arbitrary scripts from issue bodies.',
    ].join('\n')
  }});
}
async function processIssue(issue) {
  if(!(await claim(issue))) return false;
  let work=null;
  try{
    const job=validateJob(extractJobJson(issue.body||''));
    await comment(issue.number,`${JOB_MARKER}\nBridge **${AGENT_ID}** accepted \`${job.assetId}\`. Detecting Blender and preparing isolated worktree.`);
    run(process.execPath,['tools/blender/detect_blender.mjs'],{cwd:ROOT});
    ensureCleanBase();
    work=makeWorktree(issue,job);
    const input=await materializeSource(job,work.dir);
    runBlender(job,work.dir,input);
    registerAsset(job,work.dir);
    validateRepo(job,work.dir);
    commitAndPush(issue,job,work.dir,work.branch);
    const pr=await createPr(issue,job,work.branch);
    const report=JSON.parse(readFileSync(path.join(work.dir,job.report),'utf8'));
    await comment(issue.number,[
      resultPayload({ok:true,agent:AGENT_ID,branch:work.branch,pr:pr.number,asset:job.output,report:job.report}),
      `Blender bridge completed **${job.assetId}**.`,
      `PR: ${pr.html_url}`,
      `Triangles: ${Number(report.triangles||0).toLocaleString()} · Materials: ${report.materials??'-'} · Textures: ${report.textures??'-'} · Animations: ${report.animations??'-'}`,
    ].join('\n\n'));
    await closeIssue(issue.number);
    return true;
  }catch(error){
    const safe=String(error?.message||error).replace(TOKEN,'[REDACTED]').slice(0,1800);
    await comment(issue.number,`${resultPayload({ok:false,agent:AGENT_ID,error:safe})}\nBridge failed safely:\n\`\`\`\n${safe}\n\`\`\``).catch(()=>null);
    await closeIssue(issue.number).catch(()=>null);
    return true;
  }finally{
    if(work?.dir) removeWorktree(work.dir);
  }
}
async function cycle() {
  const jobs=await listJobs();
  for(const issue of jobs) {
    if(await processIssue(issue)) break;
  }
}
async function main() {
  console.log(`[WISDO Blender Bridge] agent=${AGENT_ID} repo=${REPO} once=${ONCE}`);
  do{
    try{await cycle();}catch(error){console.error('[WISDO Blender Bridge]',String(error?.message||error));}
    if(ONCE) break;
    await new Promise((resolve)=>setTimeout(resolve,POLL_MS));
  }while(true);
}
main();
