import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

function parseArgs(){const o={};for(let i=2;i<process.argv.length;i++){const k=process.argv[i];if(k.startsWith('--'))o[k.slice(2)]=process.argv[++i];}return o;}
function die(m){console.error(`[WISDO IMAGE3D] ${m}`);process.exit(1);}
function slug(v){return String(v||'asset').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'asset';}
const a=parseArgs();
if(!a.image)die('Missing --image <jpg/png/webp>.');
if(!fs.existsSync(a.image))die(`Image not found: ${a.image}`);
const id=slug(a.id||path.basename(a.image,path.extname(a.image)));
const type=a.type||'prop';
const target=a.target||({character:'npc',building:'building',vehicle:'vehicle',vegetation:'vegetation',prop:'prop'}[type]||'worldObject');
const endpoint=(a.endpoint||process.env.WISDO_IMAGE3D_ENDPOINT||'http://127.0.0.1:8080/generate').replace(/\/$/,'');
const outDir=path.resolve('tools/image3d/generated',id);fs.mkdirSync(outDir,{recursive:true});
const raw=path.join(outDir,`${id}.source.glb`);
const output=a.output||`public/world-assets/generated/${id}/${id}.glb`;
const report=a.report||`public/world-assets/generated/${id}/${id}.report.json`;
const image=fs.readFileSync(a.image).toString('base64');
console.log(`[WISDO IMAGE3D] Generating ${id} from ${a.image}`);
let res;try{res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',...(process.env.WISDO_IMAGE3D_TOKEN?{authorization:`Bearer ${process.env.WISDO_IMAGE3D_TOKEN}`}:{})},body:JSON.stringify({image})});}catch(e){die(`Cannot reach image-to-3D provider at ${endpoint}: ${e.message}`);}
if(!res.ok)die(`Generator returned HTTP ${res.status}: ${(await res.text()).slice(0,500)}`);
const bytes=Buffer.from(await res.arrayBuffer());if(bytes.length<1000)die('Generator response is too small to be a usable GLB.');fs.writeFileSync(raw,bytes);
const build=['tools/blender/run_blender.mjs','build','--input',raw,'--output',output,'--report',report,'--type',type,'--name',id.toUpperCase().replaceAll('-','_'),'--lod-ratios',a.lods||'1,0.62,0.36,0.18'];
if(a.height)build.push('--target-height',a.height);
console.log('[WISDO IMAGE3D] Blender cleanup / optimization / LOD / validation...');
const b=spawnSync(process.execPath,build,{stdio:'inherit'});if(b.status!==0)die('Blender processing failed; generated source was kept for inspection.');
if(a['no-register']==='true'){console.log(`[WISDO IMAGE3D] READY (not registered): ${output}`);process.exit(0);}
const reg=['tools/blender/bridge/register-generated-asset.mjs','--target',target,'--asset-id',id,'--output',output,'--report',report,'--license',a.license||'USER_PROVIDED','--source-note',a.note||`Generated from user-provided 2D reference through WISDO Image3D Factory.`];
const r=spawnSync(process.execPath,reg,{stdio:'inherit'});if(r.status!==0)die('GLB built but registry registration failed.');
console.log(`\n[WISDO IMAGE3D] SUCCESS\nAsset: ${id}\nGLB: ${output}\nReport: ${report}\nRegistry target: ${target}\nReview the model before committing/deploying.`);
