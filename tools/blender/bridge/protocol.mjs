import path from 'node:path';

export const BRIDGE_PROTOCOL_VERSION = 1;
export const JOB_TITLE_PREFIX = '[BLENDER JOB]';
export const JOB_MARKER = '<!-- WISDO_BLENDER_JOB:v1 -->';
export const CLAIM_MARKER = '<!-- WISDO_BLENDER_CLAIM:v1 ';
export const RESULT_MARKER = '<!-- WISDO_BLENDER_RESULT:v1 ';

export const ASSET_TYPES = Object.freeze(['character','arcade','building','vehicle','vegetation','prop','interior']);
export const REGISTER_TARGETS = Object.freeze([
  'none',
  'playerV2',
  'arcadeV2',
  'npc',
  'building',
  'prop',
  'vehicle',
  'interior',
  'vegetation',
  'worldObject',
]);

const TARGET_ASSET_TYPES = Object.freeze({
  playerV2: Object.freeze(['character']),
  arcadeV2: Object.freeze(['arcade']),
  npc: Object.freeze(['character']),
  building: Object.freeze(['building']),
  prop: Object.freeze(['prop']),
  vehicle: Object.freeze(['vehicle']),
  interior: Object.freeze(['interior','building']),
  vegetation: Object.freeze(['vegetation']),
  worldObject: Object.freeze(['prop','building','vegetation','interior']),
});

export const DEFAULT_ALLOWED_HOSTS = Object.freeze([
  'github.com',
  'raw.githubusercontent.com',
  'private-user-images.githubusercontent.com',
  'cdn.jsdelivr.net',
]);

function cleanSegment(value, max=80) {
  return String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
}

export function slug(value, fallback='asset') {
  return cleanSegment(value) || fallback;
}

export function extractJobJson(body='') {
  const text=String(body||'');
  const marker=text.indexOf(JOB_MARKER);
  const source=marker>=0?text.slice(marker+JOB_MARKER.length):text;
  const fenced=source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw=(fenced?fenced[1]:source).trim();
  if(!raw) throw new Error('Blender job body does not contain JSON.');
  return JSON.parse(raw);
}

function assertRelativePath(value, label, allowedPrefixes) {
  const raw=String(value||'').replaceAll('\\','/');
  if(!raw || raw.startsWith('/') || /^[A-Za-z]:\//.test(raw)) throw new Error(`${label} must be a repository-relative path.`);
  const normalized=path.posix.normalize(raw);
  if(normalized==='..'||normalized.startsWith('../')||normalized.includes('/../')) throw new Error(`${label} may not escape the repository.`);
  if(allowedPrefixes?.length && !allowedPrefixes.some((prefix)=>normalized===prefix||normalized.startsWith(`${prefix}/`))) {
    throw new Error(`${label} must live under ${allowedPrefixes.join(' or ')}.`);
  }
  return normalized;
}

function assertTargetMatchesAssetType(registerTarget, assetType) {
  if(registerTarget==='none') return;
  const allowed=TARGET_ASSET_TYPES[registerTarget]||[];
  if(!allowed.includes(assetType)) {
    throw new Error(`registerTarget ${registerTarget} is incompatible with assetType ${assetType}. Expected: ${allowed.join(', ') || 'none'}`);
  }
}

export function validateJob(input, {allowedHosts=DEFAULT_ALLOWED_HOSTS}={}) {
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new Error('Blender job must be an object.');
  if(!String(input.assetId||'').trim()) throw new Error('assetId is required.');
  if(!String(input.output||'').trim()) throw new Error('output is required.');
  if(!String(input.report||'').trim()) throw new Error('report is required.');

  const assetType=String(input.assetType||'').toLowerCase();
  if(!ASSET_TYPES.includes(assetType)) throw new Error(`Unsupported assetType: ${assetType}`);
  const name=slug(input.name||input.assetId,'WISDO_ASSET').toUpperCase();
  const assetId=slug(input.assetId,'wisdo-asset').toLowerCase();
  const output=assertRelativePath(input.output,'output',['public/world-assets']);
  if(!output.toLowerCase().endsWith('.glb')) throw new Error('output must end in .glb.');
  const report=assertRelativePath(input.report,'report',['public/world-assets','tools/blender/reports']);
  if(!report.toLowerCase().endsWith('.json')) throw new Error('report must end in .json.');
  const registerTarget=String(input.registerTarget||'none');
  if(!REGISTER_TARGETS.includes(registerTarget)) throw new Error(`Unsupported registerTarget: ${registerTarget}`);
  assertTargetMatchesAssetType(registerTarget,assetType);

  let source=null;
  if(input.source?.repoPath) {
    source={kind:'repo',repoPath:assertRelativePath(input.source.repoPath,'source.repoPath',['assets-source','public/world-assets','tools/blender/temp'])};
  } else if(input.source?.url) {
    const url=new URL(String(input.source.url));
    if(url.protocol!=='https:') throw new Error('source.url must use HTTPS.');
    const extra=String(process.env.WISDO_BLENDER_ALLOWED_HOSTS||'').split(',').map((v)=>v.trim()).filter(Boolean);
    const allow=new Set([...allowedHosts,...extra]);
    if(!allow.has(url.hostname)) throw new Error(`source.url host is not approved: ${url.hostname}`);
    const ext=path.posix.extname(url.pathname).toLowerCase();
    if(!['.fbx','.glb','.gltf','.obj','.blend'].includes(ext)) throw new Error(`Unsupported source extension: ${ext||'(none)'}`);
    source={kind:'url',url:url.href,filename:slug(input.source.filename||path.posix.basename(url.pathname),'source.glb')};
  } else {
    throw new Error('source.repoPath or source.url is required.');
  }

  const targetHeight=input.targetHeight==null?null:Number(input.targetHeight);
  if(targetHeight!=null && (!Number.isFinite(targetHeight)||targetHeight<=0||targetHeight>500)) throw new Error('targetHeight is invalid.');
  const lodRatios=Array.isArray(input.lodRatios)?input.lodRatios.map(Number):null;
  if(lodRatios && (lodRatios.length<1||lodRatios.length>6||lodRatios.some((n)=>!Number.isFinite(n)||n<=0||n>1))) throw new Error('lodRatios must contain 1-6 values in (0,1].');

  return Object.freeze({
    protocol:BRIDGE_PROTOCOL_VERSION,
    assetId,
    name,
    assetType,
    source,
    output,
    report,
    registerTarget,
    targetHeight,
    lodRatios,
    license:String(input.license||'UNSPECIFIED').slice(0,120),
    sourceNote:String(input.sourceNote||'').slice(0,300),
    clips:input.clips&&typeof input.clips==='object'&&!Array.isArray(input.clips)?input.clips:null,
  });
}

export function issueIsJob(issue) {
  return Boolean(issue && !issue.pull_request && String(issue.title||'').startsWith(JOB_TITLE_PREFIX));
}

export function claimPayload(agentId) {
  return `${CLAIM_MARKER}${JSON.stringify({agent:agentId,at:new Date().toISOString()})} -->`;
}
export function resultPayload(data) {
  return `${RESULT_MARKER}${JSON.stringify(data)} -->`;
}
export function parseClaim(body='') {
  const start=String(body).indexOf(CLAIM_MARKER);
  if(start<0) return null;
  const rest=String(body).slice(start+CLAIM_MARKER.length);
  const end=rest.indexOf(' -->');
  if(end<0) return null;
  try{return JSON.parse(rest.slice(0,end));}catch{return null;}
}
