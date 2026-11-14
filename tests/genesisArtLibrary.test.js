import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GENESIS_MODEL_KEYS,genesisArtPlacement,decodeGenesisGlb64}
  from '../public/js/genesisArtLibrary.js';

test('Genesis ships genuine embedded-texture GLB game models',()=>{
 assert.deepEqual(GENESIS_MODEL_KEYS,['tree1','tree2','tree3','bush','explorer']);
 for(const name of GENESIS_MODEL_KEYS){
  const encoded=readFileSync(new URL('../public/assets/genesis/models/'+name+'.glb.b64',
    import.meta.url),'utf8');
  const bytes=Buffer.from(encoded.replace(/\\s/g,''),'base64');
  assert.equal(bytes.toString('utf8',0,4),'glTF',name);
  assert.equal(bytes.readUInt32LE(4),2,name);
  assert.equal(bytes.readUInt32LE(8),bytes.length,name);
  const jsonLength=bytes.readUInt32LE(12);
  assert.equal(bytes.toString('utf8',16,20),'JSON',name);
  const doc=JSON.parse(bytes.toString('utf8',20,20+jsonLength));
  assert.ok(doc.meshes?.length>0,name+' has renderable meshes');
  assert.ok(doc.materials?.length>0,name+' has artist-authored materials');
  if(name==='explorer'){
   for(const clip of ['Idle','Walking_A','Running_A'])
    assert.ok(doc.animations?.some(a=>a.name===clip),'Missing player animation '+clip);
  }
 }
});

test('seeded authored-art positions are deterministic and within each terrain chunk',()=>{
 for(const [cx,cz] of [[0,0],[3,-2],[-10,11]]){
  for(let i=0;i<12;i++){
   const a=genesisArtPlacement(cx,cz,i);
   assert.deepEqual(a,genesisArtPlacement(cx,cz,i));
   assert.ok(a.x>cx*80&&a.x<(cx+1)*80);
   assert.ok(a.z>cz*80&&a.z<(cz+1)*80);
   assert.ok(a.scale>.8&&a.scale<1.4);
   assert.ok(['tree1','tree2','tree3'].includes(a.tree));
  }
 }
});

test('transported base64 GLB is valid in browser-compatible decoder',()=>{
 const encoded=readFileSync(new URL('../public/assets/genesis/models/bush.glb.b64',
   import.meta.url),'utf8');
 const bytes=decodeGenesisGlb64(encoded);
 assert.equal(bytes[0],103);
 assert.ok(bytes.length>10000);
 assert.throws(()=>decodeGenesisGlb64('not-a-model'),/Invalid Genesis/);
});
