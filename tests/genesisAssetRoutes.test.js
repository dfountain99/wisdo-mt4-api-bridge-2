import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import { registerGenesisAssetRoutes } from '../server/genesisAssetRoutes.js';
import {
 GENESIS_SURFACE_FILES,genesisSceneDisposed,genesisSurfaceForBiome,
} from '../public/js/genesisPhotoSurfaces.js';

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

test('Babylon scene disposal guard handles boolean isDisposed getters',()=>{
 assert.equal(genesisSceneDisposed({isDisposed:false}),false);
 assert.equal(genesisSceneDisposed({isDisposed:true}),true);
 assert.equal(genesisSceneDisposed({isDisposed:()=>false}),false);
 assert.equal(genesisSceneDisposed({isDisposed:()=>true}),true);
 assert.equal(genesisSceneDisposed(null),true);
});

test('all six Genesis biomes map to photographic ground materials',()=>{
 assert.deepEqual(Object.keys(GENESIS_SURFACE_FILES).sort(),
  ['asphalt','dry','rock','turf']);
 const biomes=['forest','marsh','titan','neon','crystal','aether'];
 for(const b of biomes)assert.ok(GENESIS_SURFACE_FILES[genesisSurfaceForBiome(b)],b);
 assert.equal(genesisSurfaceForBiome('forest'),'turf');
 assert.equal(genesisSurfaceForBiome('neon'),'asphalt');
 assert.equal(genesisSurfaceForBiome('titan'),'dry');
});

test('all self-hosted CC0 photographic surfaces load through the exact game URLs',async t=>{
 const app=express();
 registerGenesisAssetRoutes(app);
 const server=await new Promise((resolve,reject)=>{
  const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));
  listener.on('error',reject);
 });
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const root='http://127.0.0.1:'+server.address().port;
 for(const [name,filename] of Object.entries(GENESIS_SURFACE_FILES)){
  const response=await fetch(root+'/assets/genesis/textures/'+filename);
  assert.equal(response.status,200,'Missing texture '+name);
  assert.match(response.headers.get('content-type')||'',/^text\/plain/,name);
  const encoded=(await response.text()).replace(/\s/g,'');
  const jpg=Buffer.from(encoded,'base64');
  assert.ok(jpg.length>30000,'Unexpectedly small photo '+name);
  assert.equal(jpg[0],255);assert.equal(jpg[1],216);
 }
 const missing=await fetch(root+'/assets/genesis/textures/invalid.jpg.b64');
 assert.equal(missing.status,404);
});

test('the iPhone entrypoint reloads the corrected 3D loader and terrain module',()=>{
 const html=readFileSync(new URL('../public/genesis.html',import.meta.url),'utf8');
 const renderer=readFileSync(new URL('../public/js/genesisWorld.js',import.meta.url),'utf8');
 assert.match(html,/genesisWorld\.js\?v=6/);
 assert.match(renderer,/genesisTerrain\.js\?v=6/);
 assert.match(renderer,/genesisSceneDisposed\(scene\)/);
 assert.doesNotMatch(renderer,/scene\.isDisposed\(\)/);
});
