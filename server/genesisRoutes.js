import { fileURLToPath } from 'node:url';
import {GenesisMultiplayerPresence} from './genesisMultiplayer.js';
import {ensureGenesisIsland,genesisIslandDirectory,isGenesisIslandId} from './genesisIslands.js';
import { nearestWaystone,findWaystone } from '../public/js/genesisWorldMap.js';
import { getSessionUser } from './security.js';
import { createWisdoPhase1Repository } from '../services/repositories/wisdoPhase1Repository.js';
import {
  createGenesisProfile,ensureGenesisProfile,profileSnapshot,applyGenesisAction,
  moveSpeed,WORLD_LIMIT,fail,
} from '../services/genesisGameService.js';

const PAGE = fileURLToPath(new URL('../public/genesis.html',import.meta.url));
const presence = new GenesisMultiplayerPresence({capacity:100,maxVisible:24});
const actionAt = new Map();
const auth = (req,res,next)=>{
  const user=getSessionUser(req);
  if(!user?.id){
    if(String(req.headers.accept||'').includes('text/html'))return res.redirect('/login?returnTo=%2Fapp%2Fgenesis');
    return res.status(401).json({ok:false,error:'Sign in to WISDO to play Genesis.'});
  }
  req.genesisUser=user;res.set('Cache-Control','private, no-store');next();
};
function csrf(req,res,next){
  try{
    const origin=req.get('origin');
    const host=req.get('host');
    const incomingSite=req.get('sec-fetch-site');
    if(req.get('x-wisdo-genesis')!=='1'||!origin||!host||(incomingSite&&incomingSite!=='same-origin'&&incomingSite!=='none')){
      return res.status(403).json({ok:false,error:'Trusted browser interaction required.'});
    }
    if(new URL(origin).origin!==new URL(req.protocol+'://'+host).origin){
      return res.status(403).json({ok:false,error:'Cross-site gameplay requests are blocked.'});
    }
    next();
  }catch{return res.status(403).json({ok:false,error:'Invalid request origin.'});}
}
function boundPosition(entry,userId,islandId){
  return presence.join(userId,{speed:entry?.speed??moveSpeed(createGenesisProfile(userId)),islandId});
}
function islandSnapshot(profile,position,state,now=Date.now()){
  const islandId=profile.currentIslandId;
  const owner=Object.values(state?.genesisProfilesByUserId||{})
    .find(p=>p?.homeIslandId===islandId);
  return profileSnapshot(profile,position,now,{
    visibleStructures:owner?.structures||profile.structures||[],
  });
}
function cleanError(res,error){
  return res.status(Number(error?.status)||500).json({
    ok:false,error:error?.status?String(error.message):'Genesis world could not save your action.',
  });
}
export function registerGenesisRoutes(app,{config={}}={}){
  const repository=createWisdoPhase1Repository(config);
  app.get('/app/genesis',auth,(_req,res)=>res.sendFile(PAGE));
  app.get('/api/genesis/state',auth,async(req,res)=>{
    try{
      const key=String(req.genesisUser.id);
      const state=await repository.loadState();
      let profile=state.genesisProfilesByUserId?.[key];
      // Assign the home island once in a durable transaction, not in memory.
      if(!profile?.homeIslandId||!profile?.currentIslandId){
        await repository.updateState(s=>{
          profile=ensureGenesisProfile(s,key);
          ensureGenesisIsland(s,profile);
          return s;
        },{durable:true});
      }
      const position=boundPosition(presence.get(key),key,profile.currentIslandId);
      position.speed=moveSpeed(profile);
      res.json(islandSnapshot(profile,{x:position.x,z:position.z},state));
    }catch(error){cleanError(res,error);}
  });
  // Public island identifiers only. Never return owners' account identifiers.
  app.get('/api/genesis/islands',auth,async(req,res)=>{
    try{
      const key=String(req.genesisUser.id);
      const state=await repository.loadState();
      const profile=state.genesisProfilesByUserId?.[key];
      if(!profile?.homeIslandId)return res.status(409).json({
        ok:false,error:'Load your world before visiting other islands.',
      });
      const islands=genesisIslandDirectory(state).slice(0,200);
      for(const id of [profile.homeIslandId,profile.currentIslandId]){
        if(!islands.some(entry=>entry.id===id))
          islands.push({id,name:'Island '+Number(id.slice(7))});
      }
      res.json({ok:true,homeIslandId:profile.homeIslandId,
        currentIslandId:profile.currentIslandId,islands});
    }catch(error){cleanError(res,error);}
  });
  // Authenticated nearby player snapshots contain only rotating public IDs.
  app.get('/api/genesis/players',auth,(req,res)=>{
    try{
      const key=String(req.genesisUser.id);
      if(!presence.get(key))return res.status(409).json({ok:false,error:'Load your world first.'});
      res.json(presence.nearby(key));
    }
    catch(error){cleanError(res,error);}
  });
  app.post('/api/genesis/move',auth,csrf,(req,res)=>{
    try{
      const key=String(req.genesisUser.id),x=req.body?.x,z=req.body?.z;
      if(typeof x!=='number'||typeof z!=='number'||!Number.isFinite(x)||!Number.isFinite(z)||
        Math.abs(x)>WORLD_LIMIT||Math.abs(z)>WORLD_LIMIT)
        return res.status(400).json({ok:false,error:'Move within the current Genesis region.'});
      if(!presence.get(key))return res.status(409).json({ok:false,error:'Load your world first.'});
      const current=boundPosition(presence.get(key),key);
      const moved=presence.move(key,{x,z});
      if(!moved.ok)return res.status(409).json({
        ok:false,error:'PRISM recalibrated your position.',position:{x:current.x,z:current.z},
      });
      res.json(moved);
    }catch(error){cleanError(res,error);}
  });
  // Both regional and cross-island travel require a nearby Waystone.
  // The destination island must already be in the authoritative home registry.
  app.post('/api/genesis/travel',auth,csrf,async(req,res)=>{
    try{
      const key=String(req.genesisUser.id);
      const existing=presence.get(key);
      if(!existing)return res.status(409).json({ok:false,error:'Load your world first.'});
      const current=boundPosition(existing,key);
      const origin=nearestWaystone(current,13);
      if(!origin)return res.status(403).json({
        ok:false,error:'Approach a Waystone portal to travel.',
      });
      if(req.body?.islandId!==undefined){
        const targetId=req.body.islandId;
        if(!isGenesisIslandId(targetId))return res.status(400).json({
          ok:false,error:'Invalid island destination.',
        });
        const state=await repository.loadState();
        if(!genesisIslandDirectory(state).some(entry=>entry.id===targetId))
          return res.status(404).json({ok:false,error:'That island is unavailable.'});
        const existingProfile=state.genesisProfilesByUserId?.[key];
        if(!existingProfile?.homeIslandId)return res.status(409).json({
          ok:false,error:'Load your home island first.',
        });
        if(existingProfile.currentIslandId===targetId)return res.status(409).json({
          ok:false,error:'You are already on that island.',
        });
        let profile;
        await repository.updateState(s=>{
          profile=ensureGenesisProfile(s,key);
          ensureGenesisIsland(s,profile);
          if(!genesisIslandDirectory(s).some(entry=>entry.id===targetId))
            throw fail('That island is unavailable.',404);
          profile.currentIslandId=targetId;
          return s;
        },{durable:true});
        // New island instance, same local Waystone coordinates. The player
        // cannot teleport to forged x/z, and movement credit is reset.
        presence.teleport(key,{x:0,z:0,islandId:targetId});
        const p=presence.get(key);
        p.speed=moveSpeed(profile);
        return res.json({ok:true,message:'Travelled to Island '+Number(targetId.slice(7))+'.',
          snapshot:islandSnapshot(profile,{x:p.x,z:p.z},state)});
      }
      const destination=findWaystone(String(req.body?.destination||''));
      if(!destination)return res.status(400).json({
        ok:false,error:'Unknown Waystone destination.',
      });
      const state=await repository.loadState();
      const profile=state.genesisProfilesByUserId?.[key]||createGenesisProfile(key);
      current.speed=moveSpeed(profile);
      presence.teleport(key,{x:destination.x,z:destination.z});
      return res.json({ok:true,message:'Arrived at '+destination.name+'.',
        snapshot:islandSnapshot(profile,{x:current.x,z:current.z},state)});
    }catch(error){cleanError(res,error);}
  });

  app.post('/api/genesis/action',auth,csrf,async(req,res)=>{
    const key=String(req.genesisUser.id);
    const now=Date.now();
    if((actionAt.get(key)||0)+350>now)return res.status(429).json({ok:false,error:'Action cooldown. Try again.'});
    if(actionAt.size>2000)actionAt.clear();
    actionAt.set(key,now);
    const player=boundPosition(presence.get(key),key);
    try{
      let outcome=null,profile=null,viewState=null;
      await repository.updateState(state=>{
        profile=ensureGenesisProfile(state,key,now);
        ensureGenesisIsland(state,profile);
        if(profile.currentIslandId!==profile.homeIslandId&&
           ['build','dismantle','store','retrieve'].includes(req.body?.action))
          throw fail('Visit your home island to build or manage your storage.',403);
        if(player.islandId!==profile.currentIslandId)
          throw fail('Your island changed. Reload the world.',409);
        outcome=applyGenesisAction(profile,req.body||{},{x:player.x,z:player.z},now);
        viewState=state;
        return state;
      },{durable:true});
      player.speed=moveSpeed(profile);
      res.json({...outcome,snapshot:islandSnapshot(profile,{x:player.x,z:player.z},viewState,now)});
    }catch(error){cleanError(res,error);}
  });
}
