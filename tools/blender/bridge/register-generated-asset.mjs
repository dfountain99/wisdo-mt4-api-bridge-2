import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';

function args() {
  const out={};
  const raw=process.argv.slice(2);
  for(let i=0;i<raw.length;i+=2) out[raw[i].replace(/^--/,'')]=raw[i+1];
  return out;
}
const a=args();
const target=a.target;
if(!['playerV2','arcadeV2'].includes(target)) throw new Error('target must be playerV2 or arcadeV2');
const output=String(a.output||'').replaceAll('\\','/');
if(!output.startsWith('public/world-assets/')||!output.endsWith('.glb')) throw new Error('output must be a GLB under public/world-assets.');
const reportPath=String(a.report||'').replaceAll('\\','/');
const report=JSON.parse(readFileSync(reportPath,'utf8'));
const registryPath='public/app/world/generated-asset-registry.js';
let current={playerV2:null,arcadeV2:null};
try{
  const source=readFileSync(registryPath,'utf8');
  const match=source.match(/\/\* WISDO_GENERATED_ASSET_DATA_BEGIN \*\/\s*([\s\S]*?)\s*\/\* WISDO_GENERATED_ASSET_DATA_END \*\//);
  if(match) current=JSON.parse(match[1]);
}catch{}
const url=`/${output.slice('public/'.length)}`;
const mapping=report.animations?.mapping||{};
const actionSource=(key)=>mapping[key]?.source||null;
const clips={
  idle:[actionSource('IDLE'),'IDLE','idle','Idle'].filter(Boolean),
  walk:[actionSource('WALK_FORWARD'),'WALK_FORWARD','walk','Walk'].filter(Boolean),
  run:[actionSource('SPRINT'),actionSource('JOG'),'SPRINT','run','Run'].filter(Boolean),
  wave:[actionSource('INTERACT'),'INTERACT','wave','Wave'].filter(Boolean),
};
for(const [name,info] of Object.entries(mapping)) clips[name.toLowerCase()]=[info?.source,name].filter(Boolean);
current[target]={
  id:String(a['asset-id']||path.basename(output,'.glb')),
  kind:target==='playerV2'?'operator':'arcade',
  format:'glb',
  url,
  sourceRepository:'wisdo-blender-bridge',
  sourceCommit:'GENERATED_BY_PR',
  sourcePath:output,
  license:String(a.license||'UNSPECIFIED'),
  provenance:String(a['source-note']||'Processed by the WISDO Blender Bridge.'),
  targetHeightMeters:target==='playerV2'?Number(report?.boundsMeters?.size?.[2]||1.82):undefined,
  faces:'+z',
  rotationY:0,
  clips,
  reportUrl:`/${reportPath.startsWith('public/')?reportPath.slice('public/'.length):reportPath}`,
};
const json=JSON.stringify(current,null,2);
const source=`// AUTO-UPDATED ONLY BY tools/blender/bridge/register-generated-asset.mjs\n// Null entries intentionally preserve the current authored/fallback runtime until a Blender PR supplies a validated GLB.\nexport const GENERATED_WORLD_ASSET_DATA =\n/* WISDO_GENERATED_ASSET_DATA_BEGIN */\n${json}\n/* WISDO_GENERATED_ASSET_DATA_END */;\n\nfunction freezeAsset(value){\n  if(!value)return null;\n  const clips={};for(const [key,names] of Object.entries(value.clips||{}))clips[key]=Object.freeze(Array.isArray(names)?names:[]);\n  return Object.freeze({...value,clips:Object.freeze(clips)});\n}\nexport const GENERATED_WORLD_ASSETS=Object.freeze({\n  playerV2:freezeAsset(GENERATED_WORLD_ASSET_DATA.playerV2),\n  arcadeV2:freezeAsset(GENERATED_WORLD_ASSET_DATA.arcadeV2),\n});\n`;
writeFileSync(registryPath,source);
console.log(JSON.stringify({ok:true,target,url,report:reportPath},null,2));
