import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {registerWisdoWorldRoutes} from '../server/worldRoutes.js';

test('approved Aurelia Prime produces a pending truth report, then records Babylon observation',async()=>{
 const previous=process.env.WISDO_ALLOW_TEST_IDENTITY;process.env.WISDO_ALLOW_TEST_IDENTITY='true';
 const app=express();app.use(express.json());registerWisdoWorldRoutes(app,{publicRoot:process.cwd(),config:{persistenceMode:'memory'}});
 const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));
 const root=`http://127.0.0.1:${server.address().port}`,headers={'x-wisdo-test-user':'forge-truth-route-user','Content-Type':'application/json'};
 const req=async(path,method='GET',body)=>{const response=await fetch(root+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()}};
 try{
  await req('/api/world/foundry/draft','POST',{prompt:'Create Aurelia Prime futuristic island kingdom with water mountains WISDO tower city buildings forest portal'});
  await req('/api/world/foundry/approve','POST',{});
  const forged=await req('/api/world/foundry/forge','POST',{});
  assert.equal(forged.status,200);assert.equal(forged.data.truthReport.status,'PENDING_VISUAL');assert.equal(forged.data.truthReport.visible,null);
  const w=forged.data.world;
  assert.equal((await req('/api/world/personal')).data.world.forgeStatus,'awaiting_visual');
  const operations=w.forgeOperations.filter(o=>o.type.startsWith('CREATE_')).map(o=>({id:o.id,type:o.type,meshCount:1,visible:true,inCamera:true,bounds:{min:{x:o.position.x-1,y:o.position.y,z:o.position.z-1},max:{x:o.position.x+1,y:o.position.y+1,z:o.position.z+1}}}));
  const visual={worldId:w.worldId,manifestVersion:w.revision,operations,cameraFraming:true,worldBounds:{min:{x:-1400,y:-2,z:-1400},max:{x:1400,y:200,z:1400}}};
  assert.equal((await req('/api/world/personal/visual-report','POST',{...visual,manifestVersion:w.revision+1})).status,400);
  const accepted=await req('/api/world/personal/visual-report','POST',visual);
  assert.equal(accepted.status,200);assert.equal(accepted.data.truthReport.status,'PASS');
  assert.equal((await req('/api/world/personal')).data.world.forgeStatus,'complete');
 }finally{server.close();if(previous===undefined)delete process.env.WISDO_ALLOW_TEST_IDENTITY;else process.env.WISDO_ALLOW_TEST_IDENTITY=previous}
});
