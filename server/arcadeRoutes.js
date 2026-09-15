import { getSessionUser } from './security.js';
import { ARCADE_BUILD, WisdoArcadeService } from '../services/wisdoArcadeService.js';

function bool(value){return value===true||['1','true','yes','on'].includes(String(value||'').toLowerCase());}
function currentUser(req){
  const session=getSessionUser(req);
  if(session?.id)return session;
  if((process.env.NODE_ENV==='test'||bool(process.env.WISDO_ALLOW_TEST_IDENTITY))&&req.headers['x-wisdo-test-user']){
    return {id:String(req.headers['x-wisdo-test-user']),username:'Test Member',roles:['admin']};
  }
  return null;
}
function requireUser(req,res,next){
  const user=currentUser(req);
  if(!user)return res.status(401).json({ok:false,error:'Authentication required.'});
  req.wisdoUser=user;next();
}
function sendError(res,error){
  const status=Number(error?.statusCode)||400;
  res.status(status).json({ok:false,error:error?.message||'Arcade request failed.'});
}

export function registerArcadeRoutes(app,{pool,logger=console}={}){
  const service=new WisdoArcadeService({pool,logger});

  app.get('/api/arcade/catalog',requireUser,async(req,res)=>{
    try{
      const profile=await service.profile(req.wisdoUser.id);
      res.set('Cache-Control','private, no-store');
      res.json({ok:true,games:service.catalog(),profile,policy:service.policy(),build:ARCADE_BUILD});
    }catch(error){logger?.warn?.('Arcade catalog failed',{message:error.message});sendError(res,error);}
  });

  app.post('/api/arcade/sessions',requireUser,async(req,res)=>{
    try{
      const session=await service.startSession(req.wisdoUser.id,req.body?.gameId||'bull-man');
      res.set('Cache-Control','private, no-store');
      res.status(201).json({ok:true,session});
    }catch(error){logger?.warn?.('Arcade session start failed',{message:error.message});sendError(res,error);}
  });

  app.post('/api/arcade/sessions/:sessionId/finish',requireUser,async(req,res)=>{
    try{
      const result=await service.finishSession(req.wisdoUser.id,req.params.sessionId,req.body||{});
      res.set('Cache-Control','private, no-store');
      res.json({ok:true,...result});
    }catch(error){logger?.warn?.('Arcade session finish failed',{message:error.message});sendError(res,error);}
  });

  app.get('/api/arcade/profile',requireUser,async(req,res)=>{
    try{res.set('Cache-Control','private, no-store');res.json({ok:true,profile:await service.profile(req.wisdoUser.id)});}
    catch(error){sendError(res,error);}
  });

  app.get('/api/arcade/leaderboard',requireUser,async(req,res)=>{
    try{res.set('Cache-Control','private, no-store');res.json({ok:true,gameId:String(req.query.gameId||'bull-man'),rows:await service.leaderboard(req.query.gameId||'bull-man',req.query.limit)});}
    catch(error){sendError(res,error);}
  });

  app.get('/health/arcade',async(_req,res)=>{
    try{res.json(await service.health());}catch(error){res.status(503).json({ok:false,service:'wisdo-arcade',error:error.message});}
  });

  return service;
}
