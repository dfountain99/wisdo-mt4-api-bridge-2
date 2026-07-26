import { WisdoUniversalControlService } from '../services/wisdoUniversalControlService.js';
function bearer(req){const v=String(req.headers.authorization||'');return v.toLowerCase().startsWith('bearer ')?v.slice(7).trim():'';}
export function registerUniversalControlRoutes(app,{commandBusService,pool,logger}={}){
 const service=new WisdoUniversalControlService({pool,commandBusService,logger});
 async function auth(req,res,next){try{const d=await commandBusService.authenticateDevice(req.headers['x-wisdo-device-id'],bearer(req));if(!d)return res.status(401).json({ok:false,error:'Invalid device credentials.'});req.wisdoDevice=d;next();}catch(e){next(e);}}
 app.get('/health/control-plane',async(_q,res,next)=>{try{res.json(await service.health());}catch(e){next(e);}});
 app.post('/api/control/v1/components/register',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,component:await service.registerComponent(req.wisdoDevice,req.body||{})});}catch(e){next(e);}});
 app.get('/api/control/v1/components',auth,async(req,res,next)=>{try{res.json({ok:true,components:await service.listComponents(req.wisdoDevice,req.query||{})});}catch(e){next(e);}});
 app.post('/api/control/v1/resolve',auth,async(req,res,next)=>{try{res.json({ok:true,components:await service.resolveComponents(req.wisdoDevice,req.body||{})});}catch(e){next(e);}});
 app.post('/api/control/v1/execute',auth,async(req,res,next)=>{try{res.status(202).json({ok:true,executions:await service.execute(req.wisdoDevice,req.body||{})});}catch(e){next(e);}});
 app.post('/api/control/v1/website/actions',auth,async(req,res,next)=>{try{res.status(202).json({ok:true,event:await service.publishWebsiteAction(req.wisdoDevice,req.body||{})});}catch(e){next(e);}});
 app.get('/api/control/v1/website/actions',auth,async(req,res,next)=>{try{res.json({ok:true,events:await service.pollWebsiteActions(req.wisdoDevice,req.query.session_id||'')});}catch(e){next(e);}});
 return service;
}
