import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import { registerGenesisAssetRoutes } from '../server/genesisAssetRoutes.js';

test('Genesis serves all five self-hosted 3D models without login',async t=>{
 const app=express();
 registerGenesisAssetRoutes(app);
 const server=await new Promise((resolve,reject)=>{
  const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));
  listener.on('error',reject);
 });
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const root='http://127.0.0.1:'+server.address().port;
 for(const model of ['tree1','tree2','tree3','bush','explorer']){
  const response=await fetch(root+'/assets/genesis/models/'+model+'.glb.b64');
  assert.equal(response.status,200,model+' must be accessible to the browser');
  assert.match(response.headers.get('content-type')||'',/^text\/plain/,model);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  const encoded=await response.text();
  const binary=Buffer.from(encoded.replace(/\s/g,''),'base64');
  assert.equal(binary.toString('ascii',0,4),'glTF',model);
  assert.equal(binary.readUInt32LE(8),binary.length,model);
 }
 const missing=await fetch(root+'/assets/genesis/models/does-not-exist.glb.b64');
 assert.equal(missing.status,404,'missing assets must not silently render a login page');
});

test('production API mounts Genesis asset route before gameplay routes',()=>{
 const apiServer=readFileSync(new URL('../server/apiServer.js',import.meta.url),'utf8');
 assert.match(apiServer,/registerGenesisAssetRoutes\(app\);/);
 assert.ok(apiServer.indexOf('registerGenesisAssetRoutes(app);') <
   apiServer.indexOf('registerGenesisRoutes(app,'));
});
