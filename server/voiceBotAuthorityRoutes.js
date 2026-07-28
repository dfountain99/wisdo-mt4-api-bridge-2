import { WisdoVoiceBotAuthorityService } from '../services/wisdoVoiceBotAuthorityService.js';
function bearer(req){const v=String(req.headers.authorization||'');return v.toLowerCase().startsWith('bearer ')?v.slice(7).trim():'';}
export function registerVoiceBotAuthorityRoutes(app,{commandBusService,pool,logger}={}){
  const service=new WisdoVoiceBotAuthorityService({pool,commandBusService,logger});
  async function auth(req,res,next){try{const d=await commandBusService.authenticateDevice(req.headers['x-wisdo-device-id'],bearer(req));if(!d)return res.status(401).json({ok:false,error:'Invalid device credentials.'});req.wisdoDevice=d;next();}catch(e){next(e);}}
  app.get('/health/voice-bot-authority',async(_req,res,next)=>{try{res.json(await service.health());}catch(e){next(e);}});
  app.post('/api/kernel/v1/voice-control',auth,async(req,res,next)=>{try{const result=await service.request(req.wisdoDevice,req.body||{});res.status(result.status==='awaiting_confirmation'?202:result.ok?202:409).json(result);}catch(e){next(e);}});
  app.post('/api/kernel/v1/voice-control/:sessionId/confirm',auth,async(req,res,next)=>{try{res.status(202).json(await service.confirm(req.wisdoDevice,req.params.sessionId));}catch(e){next(e);}});
  app.post('/api/kernel/v1/voice-control/:sessionId/cancel',auth,async(req,res,next)=>{try{res.json(await service.cancel(req.wisdoDevice,req.params.sessionId));}catch(e){next(e);}});
  app.get('/api/kernel/v1/voice-control/history',auth,async(req,res,next)=>{try{res.json({ok:true,behaviors:await service.history(req.wisdoDevice,req.query.limit)});}catch(e){next(e);}});
  return service;
}
