import crypto from 'node:crypto';
import {createUnrealWorldManifest} from './unrealWorldManifestService.js';

const order=['REQUESTED','ALLOCATING_GPU','STARTING_UNREAL','LOADING_MANIFEST','WORLD_READY','STREAM_READY','CONNECTED','IDLE','SHUTDOWN'];
const publicStatus={REQUESTED:'starting',ALLOCATING_GPU:'starting',STARTING_UNREAL:'starting',LOADING_MANIFEST:'starting',WORLD_READY:'starting',STREAM_READY:'ready',CONNECTED:'connected',IDLE:'reconnecting',SHUTDOWN:'ended',FAILED:'failed'};
const digest=value=>crypto.createHash('sha256').update(value).digest();
const equals=(a,b)=>{const x=digest(a),y=digest(b);return crypto.timingSafeEqual(x,y)};
const fail=(code,status=400)=>Object.assign(new Error(code),{status});
export class WorldSessionService {
 constructor({allocator,streamOrigin,clock=()=>Date.now(),ttlMs=15*60_000,idleMs=90_000}={}){this.allocator=allocator;this.streamOrigin=streamOrigin;this.clock=clock;this.ttlMs=ttlMs;this.idleMs=idleMs;this.sessions=new Map()}
 visible(s){return {sessionId:s.id,worldId:s.worldId,manifestVersion:s.version,renderer:'unreal',status:publicStatus[s.state],phase:s.state,streamUrl:s.state==='STREAM_READY'||s.state==='CONNECTED'?s.streamUrl:null,expiresAt:new Date(s.expires).toISOString()}}
 current(id){const s=this.sessions.get(id);if(!s)throw fail('session_not_found',404);const now=this.clock();if(now>=s.expires||s.state==='IDLE'&&now-s.idleAt>=this.idleMs){s.state='SHUTDOWN';s.streamUrl=null;this.allocator?.shutdown?.(s.id).catch(()=>{});}return s}
 async enter({world,userId}){
  if(!world||world.buildStatus!=='forged'||String(world.ownerId)!==String(userId))throw fail('world_access_denied',403);
  if(!this.allocator||!this.streamOrigin)throw fail('gpu_session_unavailable',503);
  const id='ws_'+crypto.randomUUID(),launchToken=crypto.randomBytes(32).toString('base64url'),expires=this.clock()+this.ttlMs;
  const s={id,worldId:world.worldId,userId:String(userId),version:world.revision||1,manifest:createUnrealWorldManifest(world),tokenHash:digest(launchToken).toString('hex'),expires,state:'REQUESTED',streamUrl:null,idleAt:0,steps:new Set()};this.sessions.set(id,s);
  s.state='ALLOCATING_GPU';
  try{await this.allocator.allocate({sessionId:id,worldId:s.worldId,userId:s.userId,manifestVersion:s.version,launchToken,expiresAt:new Date(expires).toISOString()});}
  catch{ s.state='FAILED';throw fail('gpu_allocation_failed',503) }
  return this.visible(s)
 }
 owner(id,userId){const s=this.current(id);if(s.userId!==String(userId))throw fail('session_access_denied',403);return this.visible(s)}
 authenticated(id,token){const s=this.current(id);if(s.state==='SHUTDOWN'||!token||!equals(s.tokenHash,digest(token).toString('hex')))throw fail('invalid_runtime_token',403);return s}
 manifest(id,token){const s=this.authenticated(id,token);return s.manifest}
 report(id,token,{phase,streamUrl}={}){
  const s=this.authenticated(id,token);
  const transitions={ALLOCATING_GPU:'STARTING_UNREAL',STARTING_UNREAL:'LOADING_MANIFEST',LOADING_MANIFEST:'WORLD_READY',WORLD_READY:'STREAM_READY',STREAM_READY:'CONNECTED',CONNECTED:'IDLE',IDLE:'CONNECTED'};
  if(phase!==transitions[s.state])throw fail('invalid_session_transition');
  if(phase==='WORLD_READY'&&!s.steps.has('WORLD_BUILD_COMPLETE'))throw fail('world_build_unconfirmed');
  if(phase==='STREAM_READY'){
   if(!s.steps.has('PLAYER_READY'))throw fail('player_unconfirmed');
   let url;try{url=new URL(streamUrl)}catch{throw fail('invalid_stream_url')}
   if(url.origin!==this.streamOrigin||url.protocol!=='https:')throw fail('invalid_stream_origin');s.streamUrl=url.toString();
  }
  if(phase==='IDLE'){s.idleAt=this.clock()}
  s.state=phase;return this.visible(s)
 }
 confirm(id,token,step){const s=this.authenticated(id,token);if(!['WORLD_BUILD_COMPLETE','PLAYER_READY'].includes(step))throw fail('invalid_runtime_step');s.steps.add(step);return this.visible(s)}
 disconnect(id,userId){const s=this.current(id);if(s.userId!==String(userId))throw fail('session_access_denied',403);if(s.state==='CONNECTED'){s.state='IDLE';s.idleAt=this.clock()}return this.visible(s)}
}
export function createWorldGpuAllocator({url=process.env.WISDO_WORLD_GPU_ALLOCATOR_URL,secret=process.env.WISDO_WORLD_GPU_ALLOCATOR_SECRET}={}){
 if(!url||!secret||secret.length<32)return null;
 const endpoint=new URL(url);if(endpoint.protocol!=='https:')return null;
 return {async allocate(payload){const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${secret}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});if(!response.ok)throw fail('allocator_rejected',503)},async shutdown(id){await fetch(new URL(`sessions/${encodeURIComponent(id)}`,endpoint),{method:'DELETE',headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(8000)})}};
}
