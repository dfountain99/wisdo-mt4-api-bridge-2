import { getSessionUser } from './security.js';
import { ARCADE_BUILD, WisdoArcadeService } from '../services/wisdoArcadeService.js';
import { WisdoArcadeProgressionService } from '../services/wisdoArcadeProgressionService.js';

function bool(value){return value===true||['1','true','yes','on'].includes(String(value||'').toLowerCase());}
function currentUser(req){
  const session=getSessionUser(req);
  if(session?.id)return session;
  if((process.env.NODE_ENV==='test'||bool(process.env.WISDO_ALLOW_TEST_IDENTITY))&&req.headers['x-wisdo-test-user'])return{id:String(req.headers['x-wisdo-test-user']),username:'Test Member',roles:['admin']};
  return null;
}
function requireUser(req,res,next){const user=currentUser(req);if(!user)return res.status(401).json({ok:false,error:'Authentication required.'});req.wisdoUser=user;next();}
function sendError(res,error){const status=Number(error?.statusCode)||400;res.status(status).json({ok:false,error:error?.message||'Arcade request failed.'});}

export function registerArcadeRoutes(app,{pool,logger=console}={}){
  const service=new WisdoArcadeService({pool,logger});
  const progression=new WisdoArcadeProgressionService({pool,logger});

  app.get('/api/arcade/catalog',requireUser,async(req,res)=>{
    try{
      const [wallet,catalogState]=await Promise.all([service.profile(req.wisdoUser.id),progression.catalogForUser(req.wisdoUser.id,service.catalog())]);
      res.set('Cache-Control','private, no-store');
      res.json({ok:true,games:catalogState.games,profile:{...wallet,progression:catalogState.progression},progression:catalogState.progression,policy:service.policy(),build:ARCADE_BUILD,gameType:'trading_simulation'});
    }catch(error){logger?.warn?.('Arcade catalog failed',{message:error.message});sendError(res,error);}
  });

  app.post('/api/arcade/sessions',requireUser,async(req,res)=>{
    try{
      const gameId=req.body?.gameId||'structure-trader';
      const game=service.game(gameId);
      if(!game){const error=new Error('Trading game not found.');error.statusCode=404;throw error;}
      await progression.assertGameAccess(req.wisdoUser.id,game);
      const session=await service.startSession(req.wisdoUser.id,gameId);
      res.set('Cache-Control','private, no-store');res.status(201).json({ok:true,session});
    }catch(error){logger?.warn?.('Arcade session start failed',{message:error.message});sendError(res,error);}
  });

  app.post('/api/arcade/sessions/:sessionId/finish',requireUser,async(req,res)=>{
    try{
      const result=await service.finishSession(req.wisdoUser.id,req.params.sessionId,req.body||{});
      const progressionState=await progression.recordVerifiedRun(req.wisdoUser.id,result);
      res.set('Cache-Control','private, no-store');res.json({ok:true,...result,progression:progressionState});
    }catch(error){logger?.warn?.('Arcade session finish failed',{message:error.message});sendError(res,error);}
  });

  app.get('/api/arcade/profile',requireUser,async(req,res)=>{
    try{
      const [wallet,progressionState]=await Promise.all([service.profile(req.wisdoUser.id),progression.profile(req.wisdoUser.id)]);
      res.set('Cache-Control','private, no-store');res.json({ok:true,profile:{...wallet,progression:progressionState},progression:progressionState});
    }catch(error){sendError(res,error);}
  });

  app.get('/api/arcade/progression',requireUser,async(req,res)=>{
    try{res.set('Cache-Control','private, no-store');res.json({ok:true,progression:await progression.profile(req.wisdoUser.id)});}catch(error){sendError(res,error);}
  });

  app.get('/api/arcade/leaderboard',requireUser,async(req,res)=>{
    try{res.set('Cache-Control','private, no-store');res.json({ok:true,gameId:String(req.query.gameId||'structure-trader'),rows:await service.leaderboard(req.query.gameId||'structure-trader',req.query.limit)});}catch(error){sendError(res,error);}
  });

  app.get('/api/arcade/season-leaderboard',requireUser,async(req,res)=>{
    try{res.set('Cache-Control','private, no-store');res.json({ok:true,rows:await progression.seasonLeaderboard(req.query.limit)});}catch(error){sendError(res,error);}
  });

  app.get('/health/arcade',async(_req,res)=>{
    try{const [arcade,progress]=await Promise.all([service.health(),progression.health()]);res.json({...arcade,progression:progress});}
    catch(error){res.status(503).json({ok:false,service:'wisdo-arcade',error:error.message});}
  });

  service.progression=progression;
  return service;
}
