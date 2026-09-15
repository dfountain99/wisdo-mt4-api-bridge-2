import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';

const TARGETS=Object.freeze(['playerV2','arcadeV2','npc','building','prop','vehicle','interior','vegetation','worldObject']);
const TARGET_TO_COLLECTION=Object.freeze({
  npc:'npcs',
  building:'buildings',
  prop:'props',
  vehicle:'vehicles',
  interior:'interiors',
  vegetation:'vegetation',
  worldObject:'worldObjects',
});
const TARGET_TO_KIND=Object.freeze({
  playerV2:'operator',
  arcadeV2:'arcade',
  npc:'npc',
  building:'building',
  prop:'prop',
  vehicle:'vehicle',
  interior:'interior',
  vegetation:'vegetation',
  worldObject:'world-object',
});
const SEMANTIC_CLIP_KEYS=Object.freeze({
  IDLE:'idle',
  SEATED_IDLE:'seated',
  WALK_FORWARD:'walk',
  WALK:'walk',
  SPRINT:'run',
  JOG:'run',
  RUN:'run',
  GREET:'greet',
  SPEAK:'speak',
  POINT:'point',
  STAND:'stand',
  SIT:'sit',
  INTERACT:'interact',
  WAVE:'wave',
});

function args() {
  const out={};
  const raw=process.argv.slice(2);
  for(let i=0;i<raw.length;i+=2) out[raw[i].replace(/^--/,'')]=raw[i+1];
  return out;
}

function safeObject(value) {
  return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
}

function defaultData() {
  return {
    players:{default:null},
    arcades:{default:null},
    npcs:{},
    buildings:{},
    props:{},
    vehicles:{},
    interiors:{},
    vegetation:{},
    worldObjects:{},
  };
}

function normalizeData(value) {
  const raw=safeObject(value);
  const next=defaultData();
  next.players={...safeObject(raw.players),default:safeObject(raw.players).default??raw.playerV2??null};
  next.arcades={...safeObject(raw.arcades),default:safeObject(raw.arcades).default??raw.arcadeV2??null};
  for(const key of ['npcs','buildings','props','vehicles','interiors','vegetation','worldObjects']) next[key]={...safeObject(raw[key])};
  return next;
}

function parseJson(value,fallback={}) {
  if(!value) return fallback;
  try{return JSON.parse(value);}catch{throw new Error('clips-json must be valid JSON.');}
}

function cleanClipList(value) {
  const list=Array.isArray(value)?value:[value];
  return [...new Set(list.map((item)=>String(item||'').trim()).filter(Boolean))];
}

function buildClips(report, requestedClips) {
  const mapping=safeObject(report.animations?.mapping);
  const actionSource=(key)=>mapping[key]?.source||null;
  const clips={
    idle:[actionSource('IDLE'),'IDLE','idle','Idle'].filter(Boolean),
    walk:[actionSource('WALK_FORWARD'),'WALK_FORWARD','walk','Walk'].filter(Boolean),
    run:[actionSource('SPRINT'),actionSource('JOG'),'SPRINT','run','Run'].filter(Boolean),
    wave:[actionSource('INTERACT'),'INTERACT','wave','Wave'].filter(Boolean),
  };
  for(const [name,info] of Object.entries(mapping)) {
    const key=SEMANTIC_CLIP_KEYS[String(name).toUpperCase()]||String(name).toLowerCase();
    const values=cleanClipList([info?.source,name]);
    clips[key]=[...new Set([...(clips[key]||[]),...values])];
  }
  for(const [name,values] of Object.entries(safeObject(requestedClips))) {
    const key=SEMANTIC_CLIP_KEYS[String(name).toUpperCase()]||String(name).toLowerCase();
    const cleaned=cleanClipList(values);
    if(cleaned.length) clips[key]=cleaned;
  }
  for(const [key,values] of Object.entries(clips)) clips[key]=cleanClipList(values);
  return clips;
}

function registrySource(data) {
  const json=JSON.stringify(data,null,2);
  return `// AUTO-UPDATED ONLY BY tools/blender/bridge/register-generated-asset.mjs\n// Empty catalog entries intentionally preserve authored/fallback runtime until a validated Blender PR supplies a real GLB.\nexport const GENERATED_WORLD_ASSET_DATA =\n/* WISDO_GENERATED_ASSET_DATA_BEGIN */\n${json}\n/* WISDO_GENERATED_ASSET_DATA_END */;\n\nfunction freezeAsset(value){\n  if(!value)return null;\n  const clips={};for(const [key,names] of Object.entries(value.clips||{}))clips[key]=Object.freeze(Array.isArray(names)?names:[]);\n  return Object.freeze({...value,clips:Object.freeze(clips)});\n}\nfunction freezeAssetMap(value){\n  const out={};for(const [key,asset] of Object.entries(value||{}))out[key]=freezeAsset(asset);\n  return Object.freeze(out);\n}\nconst PLAYERS=Object.freeze({default:freezeAsset(GENERATED_WORLD_ASSET_DATA.players?.default)});\nconst ARCADES=Object.freeze({default:freezeAsset(GENERATED_WORLD_ASSET_DATA.arcades?.default)});\nconst NPCS=freezeAssetMap(GENERATED_WORLD_ASSET_DATA.npcs);\nconst BUILDINGS=freezeAssetMap(GENERATED_WORLD_ASSET_DATA.buildings);\nconst PROPS=freezeAssetMap(GENERATED_WORLD_ASSET_DATA.props);\nconst VEHICLES=freezeAssetMap(GENERATED_WORLD_ASSET_DATA.vehicles);\nconst INTERIORS=freezeAssetMap(GENERATED_WORLD_ASSET_DATA.interiors);\nconst VEGETATION=freezeAssetMap(GENERATED_WORLD_ASSET_DATA.vegetation);\nconst WORLD_OBJECTS=freezeAssetMap(GENERATED_WORLD_ASSET_DATA.worldObjects);\nexport const GENERATED_WORLD_ASSETS=Object.freeze({\n  playerV2:PLAYERS.default,\n  arcadeV2:ARCADES.default,\n  players:PLAYERS,\n  arcades:ARCADES,\n  npcs:NPCS,\n  buildings:BUILDINGS,\n  props:PROPS,\n  vehicles:VEHICLES,\n  interiors:INTERIORS,\n  vegetation:VEGETATION,\n  worldObjects:WORLD_OBJECTS,\n});\nexport function getGeneratedPlayerV2(){return GENERATED_WORLD_ASSETS.players.default||null;}\nexport function getGeneratedArcadeV2(){return GENERATED_WORLD_ASSETS.arcades.default||null;}\nexport function getGeneratedNpcAsset(assetId){return GENERATED_WORLD_ASSETS.npcs?.[String(assetId||'')]||null;}\nexport function getGeneratedAsset(collection,assetId='default'){return GENERATED_WORLD_ASSETS?.[String(collection||'')]?.[String(assetId||'')]||null;}\n`;
}

const a=args();
const target=String(a.target||'');
if(!TARGETS.includes(target)) throw new Error(`target must be one of: ${TARGETS.join(', ')}`);
const output=String(a.output||'').replaceAll('\\','/');
if(!output.startsWith('public/world-assets/')||!output.toLowerCase().endsWith('.glb')) throw new Error('output must be a GLB under public/world-assets.');
const reportPath=String(a.report||'').replaceAll('\\','/');
if(!(reportPath.startsWith('public/world-assets/')||reportPath.startsWith('tools/blender/reports/'))||!reportPath.toLowerCase().endsWith('.json')) {
  throw new Error('report must be a JSON file under public/world-assets or tools/blender/reports.');
}
const report=JSON.parse(readFileSync(reportPath,'utf8'));
const registryPath='public/app/world/generated-asset-registry.js';
let current=defaultData();
try{
  const source=readFileSync(registryPath,'utf8');
  const match=source.match(/\/\* WISDO_GENERATED_ASSET_DATA_BEGIN \*\/\s*([\s\S]*?)\s*\/\* WISDO_GENERATED_ASSET_DATA_END \*\//);
  if(match) current=normalizeData(JSON.parse(match[1]));
}catch{}

const assetId=String(a['asset-id']||path.basename(output,'.glb')).trim();
if(!assetId) throw new Error('asset-id is required.');
const url=`/${output.slice('public/'.length)}`;
const requestedClips=parseJson(a['clips-json'],{});
const clips=buildClips(report,requestedClips);
const measuredHeight=Number(report?.boundsMeters?.size?.[2]);
const targetHeightMeters=Number.isFinite(measuredHeight)&&measuredHeight>0?measuredHeight:undefined;
const asset={
  id:assetId,
  kind:TARGET_TO_KIND[target],
  format:'glb',
  url,
  sourceRepository:'wisdo-blender-bridge',
  sourceCommit:'GENERATED_BY_PR',
  sourcePath:output,
  license:String(a.license||'UNSPECIFIED'),
  provenance:String(a['source-note']||'Processed by the WISDO Blender Bridge.'),
  ...(targetHeightMeters?{targetHeightMeters}:{}),
  faces:'+z',
  rotationY:0,
  clips,
  reportUrl:`/${reportPath.startsWith('public/')?reportPath.slice('public/'.length):reportPath}`,
};

if(target==='playerV2') current.players.default=asset;
else if(target==='arcadeV2') current.arcades.default=asset;
else current[TARGET_TO_COLLECTION[target]][assetId]=asset;

writeFileSync(registryPath,registrySource(current));
console.log(JSON.stringify({ok:true,target,assetId,url,report:reportPath},null,2));
