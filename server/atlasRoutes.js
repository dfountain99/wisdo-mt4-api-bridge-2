import { WisdoAtlasService } from '../services/wisdoAtlasService.js';
function bearer(req){const v=String(req.headers.authorization||'');return v.toLowerCase().startsWith('bearer ')?v.slice(7).trim():'';}
export function registerAtlasRoutes(app,{commandBusService,pool,logger}={}){
  const service=new WisdoAtlasService({pool:pool||commandBusService?.pool,logger});
  async function auth(req,res,next){try{const d=await commandBusService.authenticateDevice(req.headers['x-wisdo-device-id'],bearer(req));if(!d)return res.status(401).json({ok:false,error:'Invalid device credentials.'});req.wisdoDevice=d;next();}catch(e){next(e);}}
  app.get('/health/atlas',async(_q,res,next)=>{try{const x=await service.pool.query('SELECT 1 ok');res.json({ok:Boolean(x.rows[0]?.ok),service:'wisdo-atlas',version:'2.0.1'});}catch(e){next(e);}});
  app.post('/api/atlas/v1/catalog',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,symbols:await service.upsertCatalog(req.wisdoDevice.owner_user_id,req.body||{})});}catch(e){next(e);}});
  app.get('/api/atlas/v1/symbols',auth,async(req,res,next)=>{try{res.json({ok:true,symbols:await service.listCompatible(req.wisdoDevice.owner_user_id,{account_id:req.query.account_id||null,broker:req.query.broker||null,asset_class:req.query.asset_class||null,trade_enabled:req.query.trade_enabled==null?true:req.query.trade_enabled==='true',visible:req.query.visible==null?true:req.query.visible==='true'})});}catch(e){next(e);}});
  app.post('/api/atlas/v1/resolve',auth,async(req,res,next)=>{try{res.json({ok:true,result:await service.resolve(req.wisdoDevice.owner_user_id,req.body||{})});}catch(e){next(e);}});
  app.post('/api/atlas/v1/aliases',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,alias:await service.saveAlias(req.wisdoDevice.owner_user_id,req.body||{})});}catch(e){next(e);}});
  app.post('/api/atlas/v1/groups',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,group:await service.saveGroup(req.wisdoDevice.owner_user_id,req.body||{})});}catch(e){next(e);}});
  return service;
}
