import {getSessionUser} from './security.js';
import {WisdoSettingsHubService} from '../services/wisdoSettingsHubService.js';

function user(req){
  const session=getSessionUser(req);
  if(session?.id)return session;
  if((process.env.NODE_ENV==='test'||String(process.env.WISDO_ALLOW_TEST_IDENTITY||'').toLowerCase()==='true')&&req.headers['x-wisdo-test-user'])
    return {id:String(req.headers['x-wisdo-test-user']),username:'Test Operator',roles:['admin']};
  return null;
}
function auth(req,res,next){const current=user(req);if(!current)return res.status(401).json({ok:false,error:'Authentication required.'});req.wisdoUser=current;next();}
function fail(res,error){res.status(Number(error.statusCode||error.status||400)).json({ok:false,error:error.message,code:error.code||null});}

export function registerSettingsHubRoutes(app,{pool,commandBusService,universalControlService,mt4SyncService,logger=console}={}){
  const service=new WisdoSettingsHubService({pool,commandBusService,universalControlService,mt4SyncService,logger});

  app.get('/api/settings/v1',auth,async(req,res)=>{try{res.json({ok:true,...await service.snapshot(req.wisdoUser.id)});}catch(error){fail(res,error);}});
  app.patch('/api/settings/v1/:section',auth,async(req,res)=>{try{res.json({ok:true,section:req.params.section,value:await service.patch(req.wisdoUser.id,req.params.section,req.body||{})});}catch(error){fail(res,error);}});

  app.post('/api/settings/v1/scenes',auth,async(req,res)=>{try{res.status(201).json({ok:true,scene:await service.saveScene(req.wisdoUser.id,req.body||{})});}catch(error){fail(res,error);}});
  app.delete('/api/settings/v1/scenes/:sceneId',auth,async(req,res)=>{try{await service.deleteScene(req.wisdoUser.id,req.params.sceneId);res.json({ok:true});}catch(error){fail(res,error);}});
  app.post('/api/settings/v1/scenes/:sceneId/run',auth,async(req,res)=>{try{res.status(202).json({ok:true,...await service.runScene(req.wisdoUser.id,req.params.sceneId,{issuedByDeviceId:null,presence:false})});}catch(error){fail(res,error);}});

  app.post('/api/settings/v1/smart-home/execute',auth,async(req,res)=>{try{res.status(202).json({ok:true,executions:await service.executeComponent(req.wisdoUser.id,req.body||{})});}catch(error){fail(res,error);}});
  app.post('/api/settings/v1/smart-home/home-assistant/connect',auth,async(req,res)=>{try{res.status(202).json({ok:true,...await service.configureHomeAssistant(req.wisdoUser.id,req.body||{})});}catch(error){fail(res,error);}});

  app.post('/api/settings/v1/workstations/configure',auth,async(req,res)=>{try{res.status(202).json({ok:true,command:await service.configureWorkstation(req.wisdoUser.id,req.body||{})});}catch(error){fail(res,error);}});
  app.post('/api/settings/v1/workstations/:deviceId/prepare',auth,async(req,res)=>{try{res.status(202).json({ok:true,command:await service.prepareWorkstation(req.wisdoUser.id,req.params.deviceId)});}catch(error){fail(res,error);}});

  app.post('/api/settings/v1/mt4/select',auth,async(req,res)=>{try{await service.selectMt4Account(req.wisdoUser.id,req.body?.accountId);res.json({ok:true});}catch(error){fail(res,error);}});
  app.post('/api/settings/v1/presence/test-arrival',auth,async(req,res)=>{try{
    const snapshot=await service.snapshot(req.wisdoUser.id);
    const edge=snapshot.devices.find(d=>d.device_id===String(req.body?.edgeDeviceId||snapshot.settings.presence.edgeDeviceId||''))||null;
    res.status(202).json({ok:true,actions:await service.handlePresenceArrival({ownerUserId:req.wisdoUser.id,roomId:req.body?.roomId||snapshot.settings.presence.roomId,sourceDevice:edge})});
  }catch(error){fail(res,error);}});

  app.get('/health/settings-hub',async(_req,res)=>{try{
    const rows=await pool.query(`SELECT
      (SELECT count(*)::int FROM wisdo_user_runtime_settings) settings_users,
      (SELECT count(*)::int FROM wisdo_smart_home_scenes WHERE enabled) enabled_scenes,
      (SELECT count(*)::int FROM wisdo_components WHERE status='online' AND last_seen_at>NOW()-INTERVAL '150 seconds') fresh_components`);
    res.json({ok:true,service:'wisdo-settings-smart-home',version:'18.0.0',...rows.rows[0]});
  }catch(error){res.status(503).json({ok:false,service:'wisdo-settings-smart-home',error:error.message});}});

  return service;
}
