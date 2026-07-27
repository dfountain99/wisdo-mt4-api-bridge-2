import { WisdoPhaseTwoEightService } from '../services/wisdoPhaseTwoEightService.js';
function bearer(req){const v=String(req.headers.authorization||'');return v.toLowerCase().startsWith('bearer ')?v.slice(7).trim():'';}
export function registerPhaseTwoEightRoutes(app,{commandBusService,pool,logger}={}){
 const service=new WisdoPhaseTwoEightService({pool,logger});
 async function auth(req,res,next){try{const d=await commandBusService.authenticateDevice(req.headers['x-wisdo-device-id'],bearer(req));if(!d)return res.status(401).json({ok:false,error:'Invalid device credentials.'});req.wisdoDevice=d;next();}catch(e){next(e);}}
 app.get('/health/phase-2-8',async(_q,res,next)=>{try{res.json(await service.health());}catch(e){next(e);}});
 app.post('/api/kernel/v1/intents',auth,async(req,res,next)=>{try{res.status(202).json(await service.processIntent(req.wisdoDevice,req.body||{}));}catch(e){next(e);}});
 app.get('/api/kernel/v1/digital-twin',auth,async(req,res,next)=>{try{res.json({ok:true,twin:await service.digitalTwin(req.wisdoDevice.owner_user_id)});}catch(e){next(e);}});
 app.post('/api/kernel/v1/memory',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,memory:await service.remember(req.wisdoDevice.owner_user_id,req.body||{})});}catch(e){next(e);}});
 app.get('/api/kernel/v1/memory',auth,async(req,res,next)=>{try{res.json({ok:true,memories:await service.memories(req.wisdoDevice.owner_user_id,req.query.limit)});}catch(e){next(e);}});
 app.post('/api/kernel/v1/behaviors/compile',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,behavior:await service.compileBehavior(req.wisdoDevice,req.body||{})});}catch(e){next(e);}});
 app.post('/api/kernel/v1/workspaces',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,workspace:await service.saveWorkspace(req.wisdoDevice.owner_user_id,req.body||{})});}catch(e){next(e);}});
 app.get('/api/kernel/v1/explanations/:correlationId',auth,async(req,res,next)=>{try{res.json({ok:true,explanation:await service.explain(req.wisdoDevice.owner_user_id,req.params.correlationId)});}catch(e){next(e);}});
 return service;
}
