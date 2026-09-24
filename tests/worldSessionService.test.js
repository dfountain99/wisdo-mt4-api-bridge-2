import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldSessionService,createWorldGpuAllocator} from '../services/worldSessionService.js';
const world={worldId:'world:alice',ownerId:'alice',buildStatus:'forged',revision:7,name:'Aurelia',forgeOperations:[{type:'CREATE_TOWER',payload:{}}]};
const make=()=>{let now=1_000_000,launch;const allocator={async allocate(args){launch=args},async shutdown(){}};const service=new WorldSessionService({allocator,streamOrigin:'https://streams.example.test',clock:()=>now,ttlMs:60_000,idleMs:5000});return {service,token:()=>launch.launchToken,advance:ms=>now+=ms}};
test('unconfigured host and unauthorized user fail closed',async()=>{
 await assert.rejects(new WorldSessionService().enter({world,userId:'alice'}),/gpu_session_unavailable/);
 const {service}=make();await assert.rejects(service.enter({world,userId:'bob'}),/world_access_denied/);
 assert.equal(createWorldGpuAllocator({url:'http://host.test',secret:'x'.repeat(32)}),null);
});
test('session pins owner, world, revision and manifest to a trusted runtime',async()=>{
 const {service,token}=make(),s=await service.enter({world,userId:'alice'});
 assert.equal(s.streamUrl,null);assert.equal(s.manifestVersion,7);
 assert.throws(()=>service.owner(s.sessionId,'bob'),/session_access_denied/);
 assert.throws(()=>service.manifest(s.sessionId,'wrong'),/invalid_runtime_token/);
 assert.equal(service.manifest(s.sessionId,token()).worldId,'world:alice');
 assert.throws(()=>service.report(s.sessionId,token(),{phase:'WORLD_READY'}),/invalid_session_transition/);
 service.report(s.sessionId,token(),{phase:'STARTING_UNREAL'});
 service.report(s.sessionId,token(),{phase:'LOADING_MANIFEST'});
 assert.throws(()=>service.report(s.sessionId,token(),{phase:'WORLD_READY'}),/world_build_unconfirmed/);
 service.confirm(s.sessionId,token(),'WORLD_BUILD_COMPLETE');service.report(s.sessionId,token(),{phase:'WORLD_READY'});
 assert.throws(()=>service.report(s.sessionId,token(),{phase:'STREAM_READY',streamUrl:'https://evil.test/'}),/player_unconfirmed/);
 service.confirm(s.sessionId,token(),'PLAYER_READY');
 assert.throws(()=>service.report(s.sessionId,token(),{phase:'STREAM_READY',streamUrl:'https://evil.test/'}),/invalid_stream_origin/);
 const ready=service.report(s.sessionId,token(),{phase:'STREAM_READY',streamUrl:'https://streams.example.test/session/abc'});
 assert.equal(ready.status,'ready');assert.equal(ready.streamUrl,'https://streams.example.test/session/abc');
 service.report(s.sessionId,token(),{phase:'CONNECTED'});assert.equal(service.disconnect(s.sessionId,'alice').status,'reconnecting');
 assert.equal(service.report(s.sessionId,token(),{phase:'CONNECTED'}).streamUrl,ready.streamUrl);
});
test('idle timeout and expiration end session',async()=>{
 const {service,token,advance}=make(),s=await service.enter({world,userId:'alice'});
 service.report(s.sessionId,token(),{phase:'STARTING_UNREAL'});service.report(s.sessionId,token(),{phase:'LOADING_MANIFEST'});service.confirm(s.sessionId,token(),'WORLD_BUILD_COMPLETE');service.report(s.sessionId,token(),{phase:'WORLD_READY'});service.confirm(s.sessionId,token(),'PLAYER_READY');service.report(s.sessionId,token(),{phase:'STREAM_READY',streamUrl:'https://streams.example.test/s'});service.report(s.sessionId,token(),{phase:'CONNECTED'});service.disconnect(s.sessionId,'alice');advance(5001);
 assert.equal(service.owner(s.sessionId,'alice').status,'ended');assert.throws(()=>service.report(s.sessionId,token(),{phase:'CONNECTED'}),/invalid_runtime_token/);
});
