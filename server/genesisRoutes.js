import { fileURLToPath } from 'node:url';
import { nearestWaystone,findWaystone } from '../public/js/genesisWorldMap.js';
import { getSessionUser } from './security.js';
import { createWisdoPhase1Repository } from '../services/repositories/wisdoPhase1Repository.js';
import {
  createGenesisProfile,ensureGenesisProfile,profileSnapshot,applyGenesisAction,
  moveSpeed,WORLD_LIMIT,fail,
} from '../services/genesisGameService.js';

const PAGE = fileURLToPath(new URL('../public/genesis.html',import.meta.url));
const freshPosition = ()=>({x:0,z:0,at:Date.now()});
const presence = new Map();
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
function boundPosition(entry,userId){
  if(!entry){
    entry={...freshPosition(),speed:moveSpeed(createGenesisProfile(userId))};
    if(presence.size>2000)presence.clear();
    presence.set(userId,entry);
  }
  return entry;
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
      const profile=state.genesisProfilesByUserId?.[key]||createGenesisProfile(key);
      const position=boundPosition(presence.get(key),key);
      position.speed=moveSpeed(profile);
      res.json(profileSnapshot(profile,{x:position.x,z:position.z}));
    }catch(error){cleanError(res,error);}
  });
  app.post('/api/genesis/move',auth,csrf,(req,res)=>{
    const key=String(req.genesisUser.id);
    const x=req.body?.x,z=req.body?.z;
    if(typeof x!=='number'||typeof z!=='number'||!Number.isFinite(x)||!Number.isFinite(z)||
      Math.abs(x)>WORLD_LIMIT||Math.abs(z)>WORLD_LIMIT)
      return res.status(400).json({ok:false,error:'Move within the current Genesis region.'});
    const now=Date.now();
    const current=boundPosition(presence.get(key),key);
    const elapsed=Math.min(3000,Math.max(0,now-current.at))/1000;
    const maxTravel=Math.max(1.7,Math.min(18,(current.speed||5.3)*elapsed+1.6));
    const actual=Math.hypot(x-current.x,z-current.z);
    if(actual>maxTravel) return res.status(409).json({
      ok:false,error:'PRISM recalibrated your position.',position:{x:current.x,z:current.z},
    });
    current.x=x;current.z=z;current.at=now;
    res.json({ok:true,position:{x,z}});
  });
  // Fast travel is allowed only while standing at an established waystone.
  // Never accept arbitrary destination coordinates from the browser.
  app.post('/api/genesis/travel',auth,csrf,async(req,res)=>{
    try{
      const key=String(req.genesisUser.id);
      const current=boundPosition(presence.get(key),key);
      const origin=nearestWaystone(current,13);
      if(!origin)return res.status(403).json({ok:false,error:'Find a glowing Waystone to travel between regions.'});
      const destination=findWaystone(String(req.body?.destination||''));
      if(!destination)return res.status(400).json({ok:false,error:'Unknown Waystone destination.'});
      const state=await repository.loadState();
      const profile=state.genesisProfilesByUserId?.[key]||createGenesisProfile(key);
      current.x=destination.x;current.z=destination.z;current.at=Date.now();
      current.speed=moveSpeed(profile);
      return res.json({
        ok:true,message:'Arrived at '+destination.name+'.',
        snapshot:profileSnapshot(profile,{x:current.x,z:current.z}),
      });
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
      let outcome=null,profile=null;
      await repository.updateState(state=>{
        profile=ensureGenesisProfile(state,key,now);
        outcome=applyGenesisAction(profile,req.body||{},{x:player.x,z:player.z},now);
        return state;
      },{durable:true});
      player.speed=moveSpeed(profile);
      res.json({...outcome,snapshot:profileSnapshot(profile,{x:player.x,z:player.z},now)});
    }catch(error){cleanError(res,error);}
  });
}
