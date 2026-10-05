import { WisdoAmbientLifeService } from '../services/wisdoAmbientLifeService.js';

function bearer(req){
  const value=String(req.headers.authorization||'');
  return value.toLowerCase().startsWith('bearer ')?value.slice(7).trim():'';
}

export function registerAmbientLifeRoutes(app,{commandBusService,universalControlService,tradingExecutionService=null,logger=console}={}){
  const service=new WisdoAmbientLifeService({
    pool:commandBusService.pool,
    universalControlService,
    commandBusService,
    tradingExecutionService,
    logger,
  });

  async function auth(req,res,next){
    try{
      const device=await commandBusService.authenticateDevice(req.headers['x-wisdo-device-id'],bearer(req));
      if(!device)return res.status(401).json({ok:false,error:'Invalid device credentials.'});
      req.wisdoDevice=device;
      next();
    }catch(error){next(error);}
  }

  app.get('/health/ambient-life',async(_req,res,next)=>{
    try{
      const rows=await commandBusService.pool.query(`SELECT
        (SELECT count(*)::int FROM wisdo_ambient_missions WHERE status='active') missions,
        (SELECT count(*)::int FROM wisdo_mission_runs WHERE status IN ('executing','queued','awaiting_confirmation')) active_runs,
        (SELECT count(*)::int FROM wisdo_mission_truth_events) truth_events`);
      res.json({ok:true,service:'wisdo-ambient-life-os',version:'23.0',...rows.rows[0]});
    }catch(error){next(error);}
  });

  app.get('/api/ambient/v1/dashboard',auth,async(req,res,next)=>{try{res.json({ok:true,...await service.dashboard(req.wisdoDevice)});}catch(error){next(error);}});
  app.post('/api/ambient/v1/zones',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,zone:await service.createZone(req.wisdoDevice,req.body||{})});}catch(error){next(error);}});
  app.get('/api/ambient/v1/zones',auth,async(req,res,next)=>{try{res.json({ok:true,zones:await service.listZones(req.wisdoDevice,req.query.homeId||'')});}catch(error){next(error);}});
  app.post('/api/ambient/v1/household',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,member:await service.saveHouseholdMember(req.wisdoDevice,req.body||{})});}catch(error){next(error);}});
  app.get('/api/ambient/v1/household',auth,async(req,res,next)=>{try{res.json({ok:true,members:await service.listHousehold(req.wisdoDevice,req.query.homeId||'')});}catch(error){next(error);}});
  app.post('/api/ambient/v1/policies',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,policy:await service.savePolicy(req.wisdoDevice,req.body||{})});}catch(error){next(error);}});
  app.get('/api/ambient/v1/policies',auth,async(req,res,next)=>{try{res.json({ok:true,...await service.listPolicies(req.wisdoDevice,req.query.homeId||'')});}catch(error){next(error);}});
  app.post('/api/ambient/v1/missions',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,mission:await service.createMission(req.wisdoDevice,req.body||{})});}catch(error){next(error);}});
  app.get('/api/ambient/v1/missions',auth,async(req,res,next)=>{try{res.json({ok:true,missions:await service.listMissions(req.wisdoDevice)});}catch(error){next(error);}});
  app.post('/api/ambient/v1/missions/:missionId/simulate',auth,async(req,res,next)=>{try{res.json({ok:true,simulation:await service.simulateMission(req.wisdoDevice,req.params.missionId,req.body||{})});}catch(error){next(error);}});
  app.post('/api/ambient/v1/missions/:missionId/run',auth,async(req,res,next)=>{
    try{
      const confirmed=String(req.body?.confirm||'')==='EXECUTE';
      const result=await service.executeMission(req.wisdoDevice,req.params.missionId,{...req.body,confirmationVerified:confirmed});
      res.status(result.status==='blocked'?409:result.status==='awaiting_confirmation'?202:202).json({ok:result.status!=='blocked',...result});
    }catch(error){next(error);}
  });
  app.get('/api/ambient/v1/runs/:runId/truth',auth,async(req,res,next)=>{try{res.json({ok:true,...await service.runTruth(req.wisdoDevice,req.params.runId)});}catch(error){next(error);}});
  app.post('/api/ambient/v1/missions/:missionId/local-manifest',auth,async(req,res,next)=>{try{res.json({ok:true,...await service.compileLocalManifest(req.wisdoDevice,req.params.missionId)});}catch(error){next(error);}});

  return service;
}
