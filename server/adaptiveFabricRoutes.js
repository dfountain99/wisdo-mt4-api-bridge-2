import { WisdoAdaptiveFabricService } from '../services/wisdoAdaptiveFabricService.js';
function bearer(req){const v=String(req.headers.authorization||'');return v.toLowerCase().startsWith('bearer ')?v.slice(7).trim():'';}
export function registerAdaptiveFabricRoutes(app,{commandBusService,pool,logger}={}){
  const service=new WisdoAdaptiveFabricService({pool:pool||commandBusService?.pool,logger});
  async function auth(req,res,next){try{const d=await commandBusService.authenticateDevice(req.headers['x-wisdo-device-id'],bearer(req));if(!d)return res.status(401).json({ok:false,error:'Invalid device credentials.'});req.wisdoDevice=d;next();}catch(e){next(e);}}
  app.get('/health/adaptive-fabric',async(_q,res,next)=>{try{const x=await service.pool.query('SELECT 1 ok');res.json({ok:Boolean(x.rows[0]?.ok),service:'wisdo-adaptive-fabric',version:'2.0.0'});}catch(e){next(e);}});
  app.post('/api/fabric/v1/capabilities/register',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,capability:await service.registerCapability(req.wisdoDevice.owner_user_id,req.body||{})});}catch(e){next(e);}});
  app.get('/api/fabric/v1/capabilities',auth,async(req,res,next)=>{try{res.json({ok:true,capabilities:await service.listCapabilities(req.wisdoDevice.owner_user_id,req.query||{})});}catch(e){next(e);}});
  app.post('/api/fabric/v1/behaviors/compile',auth,async(req,res,next)=>{try{const intent=service.analyzeIntent(req.body?.text,req.body?.context||{});const behavior=service.compileBehavior(intent,{...(req.body?.options||{}),owner_user_id:req.wisdoDevice.owner_user_id});const caps=await service.listCapabilities(req.wisdoDevice.owner_user_id);const validation=service.validateBehavior(behavior,caps);res.json({ok:true,intent,behavior,validation});}catch(e){next(e);}});
  app.post('/api/fabric/v1/behaviors',auth,async(req,res,next)=>{try{const caps=await service.listCapabilities(req.wisdoDevice.owner_user_id);const validation=service.validateBehavior(req.body?.behavior||{},caps);const saved=await service.saveBehavior(req.wisdoDevice.owner_user_id,req.body.behavior,validation);res.status(201).json({ok:true,behavior:saved,validation});}catch(e){next(e);}});
  app.get('/api/fabric/v1/behaviors/effective',auth,async(req,res,next)=>{try{res.json({ok:true,behaviors:await service.resolveEffectiveBehaviors(req.wisdoDevice.owner_user_id,req.query||{})});}catch(e){next(e);}});
  app.post('/api/fabric/v1/promises',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,promise:await service.createPromise(req.wisdoDevice.owner_user_id,req.body||{})});}catch(e){next(e);}});
  app.post('/api/fabric/v1/voices',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,voice:await service.createVoiceGenome(req.wisdoDevice.owner_user_id,req.body||{})});}catch(e){next(e);}});
  app.get('/api/fabric/v1/analysis/weakest-symbol',auth,async(req,res,next)=>{try{res.json({ok:true,result:await service.analyzeWeakestSymbol(req.wisdoDevice.owner_user_id,{window_days:Number(req.query.window_days||7),minimum_trades:Number(req.query.minimum_trades||1),account_id:req.query.account_id||null,bot_family:req.query.bot_family||null})});}catch(e){next(e);}});
  return service;
}
