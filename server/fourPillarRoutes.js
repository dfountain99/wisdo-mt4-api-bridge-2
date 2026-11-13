import { fileURLToPath } from 'node:url';
import { getSessionUser } from './security.js';
import { WisdoFourPillarOperations } from '../services/wisdoFourPillarOperations.js';

function bearer(req) {
  const authorization = String(req.headers.authorization || '');
  return authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
}
function fail(res,error) {
  const code = Number(error?.statusCode || 500);
  return res.status(code >= 400 && code < 600 ? code : 500)
    .json({ok:false,error:code >= 400 && code < 500 ? error.message : 'Operations request failed.',
      code:code >= 400 && code < 500 ? error.code || 'request_rejected' : 'internal_error'});
}
export function registerFourPillarRoutes(app,{commandBusService,pool}={}) {
  const operations = new WisdoFourPillarOperations({commandBusService,pool});
  function run(fn) {
    return async(req,res) => {
      res.set('Cache-Control','no-store');
      try { await fn(req,res); } catch(error) { fail(res,error); }
    };
  }
  const deviceAuth = async(req,res,next) => {
    try {
      const device=await commandBusService.authenticateDevice(req.headers['x-wisdo-device-id'],bearer(req));
      if (!device) return res.status(401).json({ok:false,error:'Valid enrolled device required.'});
      req.wisdoDevice=device;
      next();
    } catch(error) { fail(res,error); }
  };
  const memberAuth=(req,res,next)=>{
    const session=getSessionUser(req);
    if (!session?.id) return res.status(401).json({ok:false,error:'Signed member session required.'});
    req.wisdoOwnerId=String(session.id);
    next();
  };


  const memberAction=(req,res,next)=>{
    const origin=req.headers.origin;
    let sameOrigin=true;
    try { if(origin) sameOrigin=new URL(origin).host===req.get('host'); }
    catch { sameOrigin=false; }
    if (!sameOrigin || req.headers['sec-fetch-site']==='cross-site' ||
        req.headers['x-wisdo-intent']!=='operator-action') {
      return res.status(403).json({ok:false,error:'A same-origin operator action is required.'});
    }
    memberAuth(req,res,next);
  };

  // A signed member session grants read-only access, never a device credential or recovery right.
  app.get('/app/os',memberAuth,run(async(_req,res)=>{
    res.sendFile(fileURLToPath(new URL('../public/app/os/index.html',import.meta.url)));
  }));
  app.get('/api/member/os/v1/overview',memberAuth,run(async(req,res)=>{
    res.json(await operations.overview(req.wisdoOwnerId));
  }));
  app.get('/api/member/os/v1/trading',memberAuth,run(async(req,res)=>{
    res.json({ok:true,...await operations.tradingAccounts(req.wisdoOwnerId)});
  }));
  app.get('/api/member/os/v1/sentinel/events',memberAuth,run(async(req,res)=>{
    res.json({ok:true,events:await operations.sentinelEvents(req.wisdoOwnerId,{
      limit:req.query.limit,componentId:req.query.componentId||''
    })});
  }));

  app.post('/api/member/os/v1/vps/:deviceId/prepare',memberAction,run(async(req,res)=>{
    if (req.body?.confirm !== 'PREPARE VPS ' + req.params.deviceId) {
      return res.status(403).json({ok:false,error:'Exact VPS confirmation phrase required.'});
    }
    res.status(202).json({ok:true,...await operations.prepareVps(req.wisdoOwnerId,req.params.deviceId)});
  }));
  app.get('/api/member/os/v1/commands/:commandId',memberAuth,run(async(req,res)=>{
    res.json({ok:true,command:await operations.commandStatus(req.wisdoOwnerId,req.params.commandId)});
  }));


  // Agent-sourced records remain attributed to the actual authenticated edge device.
  app.post('/api/os/v1/nodes/heartbeat',deviceAuth,run(async(req,res)=>{
    res.status(201).json({ok:true,node:await operations.heartbeat(req.wisdoDevice,req.body||{})});
  }));
  app.get('/api/os/v1/nodes',deviceAuth,run(async(req,res)=>{
    res.json({ok:true,nodes:await operations.nodes(req.wisdoDevice.owner_user_id)});
  }));
  app.get('/api/os/v1/overview',deviceAuth,run(async(req,res)=>{
    res.json(await operations.overview(req.wisdoDevice.owner_user_id));
  }));
  app.get('/api/os/v1/trading/accounts',deviceAuth,run(async(req,res)=>{
    res.json({ok:true,...await operations.tradingAccounts(req.wisdoDevice.owner_user_id)});
  }));
  app.post('/api/os/v1/sentinel/events',deviceAuth,run(async(req,res)=>{
    const result=await operations.recordSentinelEvent(req.wisdoDevice,req.body||{});
    res.status(result.duplicate?200:201).json({ok:true,...result});
  }));
  app.get('/api/os/v1/sentinel/events',deviceAuth,run(async(req,res)=>{
    res.json({ok:true,events:await operations.sentinelEvents(req.wisdoDevice.owner_user_id,{
      limit:req.query.limit,componentId:req.query.componentId||''
    })});
  }));
  app.post('/api/os/v1/recoveries/request',deviceAuth,run(async(req,res)=>{
    res.status(201).json({ok:true,recovery:await operations.requestRecovery(req.wisdoDevice,req.body||{})});
  }));
  app.post('/api/os/v1/recoveries/:id/approve',deviceAuth,run(async(req,res)=>{
    res.status(202).json({ok:true,recovery:await operations.approveRecovery(
      req.wisdoDevice,req.params.id,req.body?.confirmation
    )});
  }));
  app.get('/api/os/v1/recoveries',deviceAuth,run(async(req,res)=>{
    res.json({ok:true,recoveries:await operations.recoveries(req.wisdoDevice.owner_user_id)});
  }));
  app.get('/health/four-pillars',run(async(_req,res)=>{
    await pool.query('SELECT 1');
    res.json({ok:true,service:'four-pillar-operations',database:'reachable'});
  }));
  return operations;
}
