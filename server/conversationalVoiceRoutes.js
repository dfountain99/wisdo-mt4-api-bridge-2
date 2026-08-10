import { WisdoProviderService } from '../services/wisdoProviderService.js';
import { WisdoIntentService } from '../services/wisdoIntentService.js';
import { WisdoContextService } from '../services/wisdoContextService.js';
import { WisdoSafetyService } from '../services/wisdoSafetyService.js';
import { WisdoConfirmationService } from '../services/wisdoConfirmationService.js';
import { WisdoPlanService } from '../services/wisdoPlanService.js';
import { WisdoExecutionService } from '../services/wisdoExecutionService.js';
import { WisdoDeviceService } from '../services/wisdoDeviceService.js';
import { WisdoEducationService } from '../services/wisdoEducationService.js';
import { WisdoAuditService } from '../services/wisdoAuditService.js';
import { WisdoConversationService } from '../services/wisdoConversationService.js';
import { WisdoPlanMonitorService } from '../services/wisdoPlanMonitorService.js';
import { WisdoNotificationService } from '../services/wisdoNotificationService.js';
import { WisdoAudioService } from '../services/wisdoAudioService.js';
import { WisdoCapabilityContractService } from '../services/wisdoCapabilityContractService.js';
import { createHash } from 'node:crypto';

function bearer(req){const v=String(req.headers.authorization||'');return v.toLowerCase().startsWith('bearer ')?v.slice(7).trim():'';}

export function registerConversationalVoiceRoutes(app,{commandBusService,voiceService,mt4CommandService,mt4SyncService,copyTradingService,commandRegistryAudit=null,logger=console}={}){
  const pool=commandBusService.pool;
  const provider=new WisdoProviderService();
  const intentService=new WisdoIntentService({provider});
  const contextService=new WisdoContextService({pool});
  const safetyService=new WisdoSafetyService();
  const confirmationService=new WisdoConfirmationService({pool});
  const planService=new WisdoPlanService({pool});
  const notificationService=new WisdoNotificationService({pool});
  const deviceService=new WisdoDeviceService({pool});
  const educationService=new WisdoEducationService({pool});
  const auditService=new WisdoAuditService({pool});
  const getAuthorizedAccounts=async(userId)=>mt4SyncService?.repository?.getAccessibleMt4Accounts?mt4SyncService.repository.getAccessibleMt4Accounts(userId):[];
  const executionService=new WisdoExecutionService({pool,mt4CommandService,copyTradingService,safetyService,auditService,getAuthorizedAccounts});
  const planMonitorService=new WisdoPlanMonitorService({pool,executionService,planService,notificationService,logger});
  mt4SyncService?.attachWisdoPlanMonitorService?.(planMonitorService);
  const capabilityService=new WisdoCapabilityContractService();
  const conversationService=new WisdoConversationService({intentService,contextService,safetyService,confirmationService,planService,executionService,educationService,auditService,capabilityService,getAuthorizedAccounts,getActiveAccount:async(userId)=>(await getAuthorizedAccounts(userId)).find((a)=>a.isPrimary)?.accountId||null,menuProvider:async(userId)=>{const stack=app.router?.stack||app._router?.stack||[];const website=stack.flatMap((layer)=>{const path=layer.route?.path;return typeof path==='string'&&path.startsWith('/member/')?[path]:[];});const accounts=await getAuthorizedAccounts(userId);const capabilities=accounts.flatMap((a)=>Object.keys(a.capabilities||{}).filter((key)=>a.capabilities[key]));return educationService.menu({routes:website,commands:commandRegistryAudit?.names||[],capabilities});}});
  const audioService=new WisdoAudioService({pool,provider,conversationService,logger});

  async function auth(req,res,next){try{const device=await commandBusService.authenticateDevice(req.headers['x-wisdo-device-id'],bearer(req));if(!device)return res.status(401).json({ok:false,error:'Invalid voice device credentials.'});if(device.device_type!=='pi-edge')return res.status(403).json({ok:false,error:'This endpoint requires an enrolled voice device.'});req.wisdoDevice=device;next();}catch(e){next(e);}}
  async function answer(req,res,next){try{const deviceRow=await deviceService.get(req.wisdoDevice)||await deviceService.register(req.wisdoDevice,{});deviceService.assertPermission(deviceRow,'conversation');const result=await conversationService.answer({userId:req.wisdoDevice.owner_user_id,deviceId:req.wisdoDevice.device_id,channel:'device',sessionId:req.body?.sessionId,text:req.body?.text||req.body?.transcript,accountId:req.body?.accountId});
      if(req.body?.includeAudio&&result.text&&voiceService){try{const speech=await voiceService.synthesize({text:result.text,profile:req.body?.voiceProfile});res.setHeader('X-Wisdo-Audio-Available','true');result.audio={contentType:speech.contentType,base64:speech.audio.toString('base64')};}catch(error){logger.warn?.('Conversational response speech unavailable',{message:error.message});result.audio=null;}}
      res.status(result.state==='queued'?202:200).json(result);
    }catch(e){next(e);}}

  async function bindPlanSession(req,res){
    const userId=req.wisdoDevice.owner_user_id;
    const plan=await planService.get(userId,req.params.planId);
    if(!plan){res.status(404).json({ok:false,error:'Plan not found.'});return null;}
    const session=await contextService.get(req.body?.sessionId,userId);
    if(!session||session.status!=='active'){res.status(409).json({ok:false,error:'An active conversation session is required.'});return null;}
    await contextService.touch(session.session_id,userId,{activePlanId:plan.planId,context:{planMode:true}});
    return {userId,plan,session};
  }

  app.post('/api/voice/v1/devices/register',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,device:await deviceService.register(req.wisdoDevice,req.body||{})});}catch(e){next(e);}});
  app.post('/api/voice/v1/devices/heartbeat',auth,async(req,res,next)=>{try{res.json({ok:true,device:await deviceService.heartbeat(req.wisdoDevice,req.body||{})});}catch(e){next(e);}});
  app.post('/api/voice/v1/sessions',auth,async(req,res,next)=>{try{const session=await contextService.start({userId:req.wisdoDevice.owner_user_id,deviceId:req.wisdoDevice.device_id,channel:'device',context:req.body?.context||{}});res.status(201).json({ok:true,session});}catch(e){next(e);}});
  app.post('/api/voice/v1/conversation',auth,answer);
  app.post('/api/voice/v1/speech-request',auth,answer);
  app.post('/api/voice/v1/utterances',auth,async(req,res)=>{try{const deviceRow=await deviceService.get(req.wisdoDevice)||await deviceService.register(req.wisdoDevice,{});deviceService.assertPermission(deviceRow,'conversation');const output=await audioService.submit(req.wisdoDevice,req.body||{});res.status(output.duplicate?200:202).json({ok:true,...output});}catch(e){logger.warn?.('Voice utterance processing failed',{deviceId:req.wisdoDevice?.device_id,code:e.code||'processing_failed',message:e.message});const known=['empty_transcription','audio_duration_limit','audio_size_limit','unsupported_audio_type','invalid_audio','idempotency_required'].includes(e.code);res.status(known?(e.statusCode||422):503).json({ok:false,error:known?e.message:'Voice processing is temporarily unavailable.',code:e.code||'voice_processing_unavailable',localResponse:'I could not transcribe that safely. I did not make any trading changes.'});}});
  app.get('/api/voice/v1/deliveries/next',auth,async(req,res,next)=>{try{const waitMs=Math.max(0,Math.min(20000,Number(req.query.waitMs||0)));const deadline=Date.now()+waitMs;let delivery=null;do{delivery=await audioService.offer(req.wisdoDevice);if(delivery||Date.now()>=deadline)break;await new Promise((resolve)=>setTimeout(resolve,Math.min(500,Math.max(1,deadline-Date.now()))));}while(Date.now()<deadline);if(!delivery)return res.status(204).end();const audio=Buffer.from(delivery.audio_data||[]);res.json({ok:true,delivery:{deliveryId:delivery.delivery_id,sessionId:delivery.session_id,priority:delivery.priority,contentType:delivery.content_type,audioSizeBytes:delivery.audio_size_bytes,sha256:createHash('sha256').update(audio).digest('hex'),audioBase64:audio.toString('base64'),expiresAt:delivery.expires_at,responseText:delivery.response_text}});}catch(e){next(e);}});
  app.post('/api/voice/v1/deliveries/:deliveryId/receipt',auth,async(req,res,next)=>{try{res.json({ok:true,delivery:await audioService.receipt(req.wisdoDevice,req.params.deliveryId,req.body?.status,req.body||{})});}catch(e){next(e);}});
  app.post('/api/voice/v1/playback/interrupt',auth,async(req,res,next)=>{try{const current=await pool.query(`SELECT delivery_id FROM wisdo_speech_deliveries WHERE device_id=$1 AND owner_user_id=$2 AND status IN ('OFFERED','DELIVERED','PLAYING') ORDER BY priority DESC,created_at DESC LIMIT 1`,[req.wisdoDevice.device_id,req.wisdoDevice.owner_user_id]);if(!current.rows[0])return res.json({ok:true,interrupted:false});const delivery=await audioService.receipt(req.wisdoDevice,current.rows[0].delivery_id,'CANCELLED',{errorCode:'interrupted',errorMessage:req.body?.reason||'Playback interrupted by the device.'});res.json({ok:true,interrupted:true,delivery});}catch(e){next(e);}});
  app.get('/api/voice/v1/sessions/:sessionId',auth,async(req,res,next)=>{try{const session=await contextService.get(req.params.sessionId,req.wisdoDevice.owner_user_id);if(!session)return res.status(404).json({ok:false,error:'Session not found.'});res.json({ok:true,session,messages:await contextService.recent(session.session_id,req.wisdoDevice.owner_user_id,25)});}catch(e){next(e);}});
  app.delete('/api/voice/v1/sessions/:sessionId',auth,async(req,res,next)=>{try{res.json({ok:true,session:await contextService.close(req.params.sessionId,req.wisdoDevice.owner_user_id,'cancelled')});}catch(e){next(e);}});

  app.post('/api/voice/v1/plans',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,plan:await planService.create(req.wisdoDevice.owner_user_id,req.body||{})});}catch(e){next(e);}});
  app.get('/api/voice/v1/plans/active',auth,async(req,res,next)=>{try{res.json({ok:true,plan:await planService.active(req.wisdoDevice.owner_user_id)});}catch(e){next(e);}});
  app.get('/api/voice/v1/plans/:planId',auth,async(req,res,next)=>{try{const plan=await planService.get(req.wisdoDevice.owner_user_id,req.params.planId);if(!plan)return res.status(404).json({ok:false,error:'Plan not found.'});res.json({ok:true,plan,unsupportedRules:planService.unsupportedRules(plan)});}catch(e){next(e);}});
  app.patch('/api/voice/v1/plans/:planId',auth,async(req,res,next)=>{try{res.json({ok:true,plan:await planService.modify(req.wisdoDevice.owner_user_id,req.params.planId,req.body||{},req.body?.rawText||'')});}catch(e){next(e);}});
  app.get('/api/voice/v1/plans/:planId/review',auth,async(req,res,next)=>{try{const plan=await planService.get(req.wisdoDevice.owner_user_id,req.params.planId);if(!plan)return res.status(404).json({ok:false,error:'Plan not found.'});res.json({ok:true,plan,readBack:planService.readBack(plan),unsupportedRules:planService.unsupportedRules(plan)});}catch(e){next(e);}});
  app.post('/api/voice/v1/plans/:planId/confirm',auth,async(req,res,next)=>{try{const bound=await bindPlanSession(req,res);if(!bound)return;const pending=await confirmationService.pending(bound.userId,bound.session.session_id);if(!pending||String(pending.plan_id||'')!==String(bound.plan.planId))return res.status(409).json({ok:false,error:'No matching unexpired confirmation exists for this plan.'});const result=await conversationService.answer({userId:bound.userId,deviceId:req.wisdoDevice.device_id,channel:'device',sessionId:bound.session.session_id,text:req.body?.phrase||"Confirm Coach, activate today's plan"});res.status(result.state==='active'?200:409).json(result);}catch(e){next(e);}});
  app.post('/api/voice/v1/plans/:planId/pause',auth,async(req,res,next)=>{try{const bound=await bindPlanSession(req,res);if(!bound)return;res.status(202).json(await conversationService.answer({userId:bound.userId,deviceId:req.wisdoDevice.device_id,channel:'device',sessionId:bound.session.session_id,text:'pause the plan'}));}catch(e){next(e);}});
  app.post('/api/voice/v1/plans/:planId/resume',auth,async(req,res,next)=>{try{const bound=await bindPlanSession(req,res);if(!bound)return;res.status(202).json(await conversationService.answer({userId:bound.userId,deviceId:req.wisdoDevice.device_id,channel:'device',sessionId:bound.session.session_id,text:'resume the plan'}));}catch(e){next(e);}});
  app.post('/api/voice/v1/plans/:planId/cancel',auth,async(req,res,next)=>{try{res.json({ok:true,plan:await planService.transition(req.wisdoDevice.owner_user_id,req.params.planId,'CANCELLED')});}catch(e){next(e);}});
  app.post('/api/voice/v1/plans/:planId/duplicate',auth,async(req,res,next)=>{try{res.status(201).json({ok:true,plan:await planService.duplicate(req.wisdoDevice.owner_user_id,req.params.planId,req.body?.name)});}catch(e){next(e);}});
  app.get('/api/voice/v1/plans/:planId/history',auth,async(req,res,next)=>{try{res.json({ok:true,versions:await planService.history(req.wisdoDevice.owner_user_id,req.params.planId)});}catch(e){next(e);}});
  app.get('/api/voice/v1/plans/:planId/summary',auth,async(req,res,next)=>{try{const summary=await planService.summary(req.wisdoDevice.owner_user_id,req.params.planId);if(!summary)return res.status(404).json({ok:false,error:'Plan not found.'});res.json({ok:true,summary});}catch(e){next(e);}});
  app.post('/api/voice/v1/plans/:planId/reset',auth,async(req,res,next)=>{try{const plan=await planService.resetForNextTradingDay(req.wisdoDevice.owner_user_id,req.params.planId);if(!plan)return res.status(409).json({ok:false,error:'Plan is not eligible for a safe trading-day reset.'});res.status(201).json({ok:true,plan,note:'Reset created a draft. It did not reopen trading or activate rules.'});}catch(e){next(e);}});
  app.get('/api/voice/v1/plans/:planId/progress',auth,async(req,res,next)=>{try{const plan=await planService.get(req.wisdoDevice.owner_user_id,req.params.planId);if(!plan)return res.status(404).json({ok:false,error:'Plan not found.'});const [rules,events]=await Promise.all([pool.query(`SELECT * FROM wisdo_plan_rules WHERE owner_user_id=$1 AND plan_id=$2 ORDER BY updated_at`,[req.wisdoDevice.owner_user_id,req.params.planId]),pool.query(`SELECT * FROM wisdo_plan_execution_events WHERE owner_user_id=$1 AND plan_id=$2 ORDER BY created_at DESC LIMIT 100`,[req.wisdoDevice.owner_user_id,req.params.planId])]);res.json({ok:true,plan,rules:rules.rows,events:events.rows});}catch(e){next(e);}});
  app.get('/api/voice/v1/confirmations/pending',auth,async(req,res,next)=>{try{res.json({ok:true,confirmation:await confirmationService.pending(req.wisdoDevice.owner_user_id,String(req.query.sessionId||''))});}catch(e){next(e);}});
  app.get('/api/voice/v1/commands/:commandId',auth,async(req,res,next)=>{try{res.json({ok:true,...await executionService.status(req.wisdoDevice.owner_user_id,req.params.commandId)});}catch(e){next(e);}});
  app.get('/api/voice/v1/education/progress',auth,async(req,res,next)=>{try{res.json({ok:true,progress:await educationService.progress(req.wisdoDevice.owner_user_id)});}catch(e){next(e);}});
  app.patch('/api/voice/v1/education/progress',auth,async(req,res,next)=>{try{res.json({ok:true,progress:await educationService.update(req.wisdoDevice.owner_user_id,req.body||{})});}catch(e){next(e);}});
  app.get('/api/voice/v1/operations',auth,async(req,res,next)=>{try{const user=req.wisdoDevice.owner_user_id;const [devices,sessions,plans,confirmations,receipts,audit,utterances,deliveries]=await Promise.all([pool.query(`SELECT * FROM wisdo_voice_devices WHERE owner_user_id=$1 ORDER BY updated_at DESC`,[user]),pool.query(`SELECT * FROM wisdo_conversation_sessions WHERE owner_user_id=$1 ORDER BY updated_at DESC LIMIT 20`,[user]),pool.query(`SELECT * FROM wisdo_daily_plans WHERE owner_user_id=$1 ORDER BY updated_at DESC LIMIT 20`,[user]),pool.query(`SELECT * FROM wisdo_pending_confirmations WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT 20`,[user]),pool.query(`SELECT * FROM wisdo_command_receipts WHERE owner_user_id=$1 ORDER BY received_at DESC LIMIT 100`,[user]),pool.query(`SELECT * FROM wisdo_conversation_audit WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT 100`,[user]),pool.query(`SELECT utterance_id,device_id,status,duration_ms,transcript,error_code,created_at FROM wisdo_voice_utterances WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT 50`,[user]),pool.query(`SELECT delivery_id,device_id,status,priority,attempts,error_code,created_at,played_at FROM wisdo_speech_deliveries WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT 50`,[user])]);res.json({ok:true,devices:devices.rows,sessions:sessions.rows,plans:plans.rows,confirmations:confirmations.rows,receipts:receipts.rows,audit:audit.rows,utterances:utterances.rows,deliveries:deliveries.rows});}catch(e){next(e);}});

  return {conversationService,intentService,contextService,safetyService,confirmationService,planService,executionService,planMonitorService,deviceService,educationService,audioService};
}
