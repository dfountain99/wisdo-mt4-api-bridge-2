import test from 'node:test';
import assert from 'node:assert/strict';
import { GENESIS_MODEL_KEYS,loadGenesisArtLibrary }
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
   if(url.endsWith('tree1.glb')||url.endsWith('tree2.glb')){
    const model=bytes.slice();
    model[4]=url.endsWith('tree1.glb')?1:2;
    return {ok:true,arrayBuffer:async()=>Uint8Array.from(model).buffer};
   }
   if(url.endsWith('tree3.glb'))
    return {ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};
   return {ok:false,status:404};
  }
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
 assert.deepEqual(library.available,GENESIS_MODEL_KEYS);
 assert.equal(library.failures.length,0);
 assert.ok(calls.some(url=>url.endsWith('/models/tree1.glb.b64')));
 assert.ok(!calls.some(url=>url.endsWith('/models/tree2.glb.b64')));
 assert.ok(disposed.includes('blob:reality-1'));
 library.dispose();
});
