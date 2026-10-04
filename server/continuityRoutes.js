import { getSessionUser } from './security.js';
import { WisdoContinuityService } from '../services/wisdoContinuityService.js';

function userId(user){return String(user?.id||user?.discord_id||user?.discordId||'');}
function status(error){return Number(error?.statusCode||error?.status||500);}

export function registerContinuityRoutes(app,{pool,worldCommandService,adaptiveFabricService,universalControlService,logger=console}={}){
  const service=new WisdoContinuityService({pool,worldCommandService,adaptiveFabricService,universalControlService,logger});
  const auth=(req,res,next)=>{let user=getSessionUser(req);if(!user&&(process.env.NODE_ENV==='test'||String(process.env.WISDO_ALLOW_TEST_IDENTITY||'').toLowerCase()==='true')&&req.headers['x-wisdo-test-user'])user={id:String(req.headers['x-wisdo-test-user']),username:'Test Operator',roles:['admin']};if(!user)return res.status(401).json({ok:false,error:'Authentication required.'});req.wisdoContinuityUser=user;next();};
  const wrap=(fn)=>async(req,res,next)=>{try{return await fn(req,res);}catch(error){if(error?.statusCode||error?.status)return res.status(status(error)).json({ok:false,error:error.message,code:error.code||null});next(error);}};

  app.get('/api/wisdo/continuity/state',auth,wrap(async(req,res)=>res.json(await service.state(userId(req.wisdoContinuityUser),{accountId:req.query.accountId||''}))));
  app.post('/api/wisdo/continuity/interpret',auth,wrap(async(req,res)=>res.json(await service.interpret(userId(req.wisdoContinuityUser),req.body||{}))));
  app.post('/api/wisdo/continuity/execute',auth,wrap(async(req,res)=>res.json(await service.execute(userId(req.wisdoContinuityUser),req.body||{}))));
  app.post('/api/wisdo/continuity/focus',auth,wrap(async(req,res)=>res.json(await service.focus(userId(req.wisdoContinuityUser),req.body||{}))));
  app.post('/api/wisdo/continuity/mode',auth,wrap(async(req,res)=>res.json(await service.setMode(userId(req.wisdoContinuityUser),req.body?.mode))));
  app.post('/api/wisdo/continuity/handoff',auth,wrap(async(req,res)=>res.json({ok:true,device:await service.handoff(userId(req.wisdoContinuityUser),req.body?.deviceId)})));
  app.get('/api/wisdo/continuity/reflexes',auth,wrap(async(req,res)=>{const state=await service.state(userId(req.wisdoContinuityUser),{accountId:req.query.accountId||''});res.json({ok:true,builtIn:state.continuity.builtInReflexes,custom:state.continuity.customReflexes});}));
  app.post('/api/wisdo/continuity/reflexes',auth,wrap(async(req,res)=>res.status(201).json({ok:true,reflex:await service.saveReflex(userId(req.wisdoContinuityUser),req.body||{})})));
  app.post('/api/wisdo/continuity/reflexes/:key/run',auth,wrap(async(req,res)=>res.json(await service.runReflex(userId(req.wisdoContinuityUser),req.params.key,req.body||{}))));

  app.get('/health/continuity',async(_req,res,next)=>{try{const db=await pool.query('SELECT 1 ok');res.json({ok:Boolean(db.rows[0]?.ok),service:'wisdo-continuity',version:'17.0.0',truth_model:'proposal -> verified executor -> receipt'});}catch(error){next(error);}});
  return service;
}
