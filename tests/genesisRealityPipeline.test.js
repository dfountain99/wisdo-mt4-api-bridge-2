import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GENESIS_MODEL_KEYS,GENESIS_DECOR_MODEL_KEYS,genesisRealityReadiness,loadGenesisArtLibrary }
  from '../public/js/genesisArtLibrary.js';

test('Genesis loads valid reality art but falls back for missing or rejected optional GLBs',async t=>{
 const original={
  BABYLON:globalThis.BABYLON,
  Blob:globalThis.Blob,
  fetch:globalThis.fetch,
  createObjectURL:URL.createObjectURL,
  revokeObjectURL:URL.revokeObjectURL,
 };
 t.after(()=>{
  globalThis.BABYLON=original.BABYLON;
  globalThis.Blob=original.Blob;
  globalThis.fetch=original.fetch;
  URL.createObjectURL=original.createObjectURL;
  URL.revokeObjectURL=original.revokeObjectURL;
 });
 const bytes=Buffer.alloc(24);
 bytes.write('glTF',0,'ascii');
 const fallbackBase64=bytes.toString('base64');
 const calls=[];
 const disposed=[];
 globalThis.Blob=class MockBlob {
  constructor(parts){this.parts=parts;}
 };
 URL.createObjectURL=(blob)=>{
  const part=blob.parts[0];
  return part instanceof ArrayBuffer
    ?'blob:reality-'+new Uint8Array(part)[4]
    :'blob:fallback';
 };
 URL.revokeObjectURL=url=>disposed.push(url);
 globalThis.fetch=async url=>{
  calls.push(url);
  if(url.includes('/reality/')){
   if(url.endsWith('tree1.glb')||url.endsWith('tree2.glb')||url.endsWith('grass_medium_01.glb')){
    const model=Buffer.from(bytes);
    model[4]=url.endsWith('tree1.glb')?1:url.endsWith('tree2.glb')?2:3;
    return {ok:true,arrayBuffer:async()=>Uint8Array.from(model).buffer};
   }
   if(url.endsWith('tree3.glb'))
    return {ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};
   return {ok:false,status:404};
  }
  if(url.includes('/models/grass_medium_01')||url.includes('/models/mountainside'))
    return {ok:false,status:404};
  return {ok:true,text:async()=>fallbackBase64};
 };
 globalThis.BABYLON={SceneLoader:{LoadAssetContainerAsync:async (_root,url)=>{
  if(url==='blob:reality-1')throw Error('Malformed optional art');
  return {
   meshes:[{getTotalVertices:()=>48}],
   instantiateModelsToScene:()=>({rootNodes:[],animationGroups:[]}),
   dispose(){},
  };
 }}};
 const previousWarn=console.warn;
 console.warn=()=>{};
 t.after(()=>{console.warn=previousWarn;});
 const library=await loadGenesisArtLibrary({});
 assert.equal(library.sources.tree1,'fallback');
 assert.equal(library.sources.tree2,'reality');
 assert.equal(library.sources.tree3,'fallback');
 assert.equal(library.sources.bush,'fallback');
 assert.equal(library.sources.explorer,'fallback');
 assert.equal(library.realityReady,false);
 assert.deepEqual(library.available,[...GENESIS_MODEL_KEYS,'grass_medium_01']);
 assert.equal(library.sources.grass_medium_01,'reality');
 assert.equal(library.sources.mountainside,'not-installed');
 assert.deepEqual(library.realitySummary.installed,['tree2','grass_medium_01']);
 assert.equal(library.realitySummary.forestGrassReady,true);
 assert.equal(library.realitySummary.coreReady,false);
 assert.equal(library.realitySummary.installedCount,2);
 assert.equal(library.realitySummary.expectedCount,7);
 assert.equal(library.failures.length,0);
 assert.ok(calls.some(url=>url.endsWith('/models/tree1.glb.b64')));
 assert.ok(!calls.some(url=>url.endsWith('/models/tree2.glb.b64')));
 assert.ok(disposed.includes('blob:reality-1'));
 library.dispose();
});

test('Genesis reality readiness distinguishes missing art from successfully loaded models',()=>{
 const empty=genesisRealityReadiness({});
 assert.equal(empty.installedCount,0);
 assert.equal(empty.expectedCount,GENESIS_MODEL_KEYS.length+GENESIS_DECOR_MODEL_KEYS.length);
 assert.equal(empty.forestGrassReady,false);
 const ready=genesisRealityReadiness({
  tree1:'reality',tree2:'reality',tree3:'reality',bush:'reality',
  explorer:'reality',grass_medium_01:'reality',mountainside:'not-installed'
 });
 assert.equal(ready.coreReady,true);
 assert.equal(ready.installedCount,6);
 assert.deepEqual(ready.missing,['mountainside']);
});

test('real bundled grass asset is a renderable cutout GLB with embedded texture',()=>{
 const bytes=readFileSync(new URL('../public/assets/genesis/reality/grass_medium_01.glb',import.meta.url));
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const jsonBytes=bytes.readUInt32LE(12);
 assert.equal(bytes.toString('ascii',16,20),'JSON');
 const doc=JSON.parse(bytes.toString('utf8',20,20+jsonBytes));
 assert.ok(doc.meshes?.length>0,'Grass must have 3D meshes');
 assert.ok(doc.meshes[0]?.primitives?.length>0,'Grass must have renderable primitives');
 assert.equal(doc.materials?.[0]?.alphaMode,'MASK');
 assert.equal(doc.materials?.[0]?.doubleSided,true);
 assert.ok(doc.images?.length>=1,'Grass must embed an image rather than load a third-party URL');
 assert.ok((doc.images||[]).every(img=>!/^https?:/i.test(img.uri||'')));
 assert.ok(bytes.length<512*1024,'Grass model must fit the initial mobile size budget');
});
