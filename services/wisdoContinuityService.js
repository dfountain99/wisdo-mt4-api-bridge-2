import crypto from 'node:crypto';
import { WisdoIntentService } from './wisdoIntentService.js';
import { WisdoProviderService } from './wisdoProviderService.js';

const clean=(v,n=300)=>String(v??'').trim().slice(0,n);
const obj=(v,f={})=>(v&&typeof v==='object'&&!Array.isArray(v)?v:f);
const now=()=>new Date().toISOString();
const hash=(v)=>crypto.createHash('sha256').update(String(v)).digest('hex');

const WORLD_COMMAND_MAP=Object.freeze({
  CLOSE_ALL_TRADES:'CLOSE_ALL',
  CLOSE_ALL_WINNERS:'CLOSE_PROFIT',
  EMERGENCY_STOP:'EMERGENCY_STOP',
  STOP_ENTRIES:'STOP_NEW_ENTRIES',
  START_ENTRIES:'RESUME_NEW_ENTRIES',
});

const BUILTIN_REFLEXES=Object.freeze([
  {key:'tighten-protection',name:'Tighten Protection',description:'Tighten the active campaign trailing distance by 0.25 ATR.',action:'SET_TRAIL_ATR',options:{trailDeltaAtr:-0.25}},
  {key:'trim-half',name:'Trim Half',description:'Trim 50% of the active campaign using broker-valid lot steps.',action:'TRIM_CAMPAIGN',options:{trimPercent:50,tickets:[]}},
  {key:'counter-on-stop',name:'Counter On Confirmed Reversal',description:'If the active campaign is stopped by the broker, arm HIGHTOWER to establish the opposite campaign only after its normal structural confirmation.',action:'ARM_COUNTER_ON_STOP',options:{counterPauseSeconds:0}},
  {key:'return-to-ea',name:'Return Stops To EA',description:'Clear runtime stop/trail overrides and return protection authority to the visible EA inputs.',action:'CLEAR_RUNTIME_OVERRIDES',options:{}},
]);

function riskLevel(intent={}){
  if(intent.intent==='COUNTER_ON_STOP'||intent.intent==='WIDEN_EXISTING_STOPS'||intent.intent==='ADD_POSITION_IF_VALID')return 3;
  if(intent.type==='BEHAVIOR')return 3;
  if(intent.type==='ACTION')return 2;
  return 0;
}

export class WisdoContinuityService {
  constructor({pool,worldCommandService,adaptiveFabricService,universalControlService,provider=null,logger=console}={}){
    if(!pool)throw new Error('WisdoContinuityService requires PostgreSQL.');
    if(!worldCommandService)throw new Error('WisdoContinuityService requires the verified World command service.');
    this.pool=pool;this.worldCommandService=worldCommandService;this.adaptiveFabricService=adaptiveFabricService;
    this.universalControlService=universalControlService;this.logger=logger;
    this.provider=provider||new WisdoProviderService();
    this.intentService=new WisdoIntentService({provider:this.provider});
    this.proposals=new Map();
  }

  workspaceId(owner){return `continuity:${String(owner)}`;}

  async workspace(owner){
    const id=this.workspaceId(owner);
    const r=await this.pool.query(`INSERT INTO wisdo_live_workspaces(workspace_id,owner_user_id,name,mode,layout,filters,active_context,status,created_at,updated_at)
      VALUES($1,$2,'WISDO Continuity','adaptive','{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'active',NOW(),NOW())
      ON CONFLICT(workspace_id) DO UPDATE SET status='active',updated_at=NOW()
      RETURNING *`,[id,String(owner)]);
    return r.rows[0];
  }

  async patchContext(owner,patch={}){
    const current=await this.workspace(owner);
    const next={...obj(current.active_context),...obj(patch)};
    const r=await this.pool.query(`UPDATE wisdo_live_workspaces SET active_context=$3::jsonb,updated_at=NOW() WHERE workspace_id=$1 AND owner_user_id=$2 RETURNING *`,
      [this.workspaceId(owner),String(owner),JSON.stringify(next)]);
    return r.rows[0];
  }

  async event(owner,eventType,payload={},sourceType='continuity',sourceId=null,severity='info',correlationId=null){
    await this.pool.query(`INSERT INTO wisdo_event_ledger(event_id,owner_user_id,source_type,source_id,event_type,severity,payload,correlation_id,created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,NOW())`,[crypto.randomUUID(),String(owner),sourceType,sourceId,eventType,severity,JSON.stringify(obj(payload)),correlationId]);
  }

  async recentEnvironment(owner){
    const [rooms,components,devices]=await Promise.all([
      this.pool.query(`SELECT * FROM wisdo_room_states WHERE owner_user_id=$1 AND last_seen_at>NOW()-INTERVAL '2 minutes' ORDER BY occupied DESC,last_seen_at DESC LIMIT 20`,[String(owner)]),
      this.pool.query(`SELECT component_id,device_id,component_type,name,aliases,capabilities,state,metadata,status,last_seen_at FROM wisdo_components WHERE owner_user_id=$1 AND status='online' AND last_seen_at>NOW()-INTERVAL '2 minutes' ORDER BY last_seen_at DESC LIMIT 100`,[String(owner)]),
      this.pool.query(`SELECT d.device_id,d.device_type,d.device_name,d.status,d.capabilities,d.last_seen_at,v.room_id,v.listening,v.muted,v.last_heartbeat_at
        FROM wisdo_devices d LEFT JOIN wisdo_voice_devices v ON v.device_id=d.device_id
        WHERE d.owner_user_id=$1 AND d.status='active' ORDER BY COALESCE(v.last_heartbeat_at,d.last_seen_at) DESC NULLS LAST LIMIT 30`,[String(owner)]),
    ]);
    return {rooms:rooms.rows,components:components.rows,devices:devices.rows};
  }

  async scenes(owner){
    const r=await this.pool.query(`SELECT memory_id,content,metadata,created_at,updated_at FROM wisdo_kernel_memory
      WHERE owner_user_id=$1 AND memory_type='presence_scene' ORDER BY updated_at DESC LIMIT 100`,[String(owner)]);
    return r.rows;
  }

  async customReflexes(owner){
    const r=await this.pool.query(`SELECT memory_id,content,metadata,created_at,updated_at FROM wisdo_kernel_memory
      WHERE owner_user_id=$1 AND memory_type='reflex' ORDER BY updated_at DESC LIMIT 100`,[String(owner)]);
    return r.rows;
  }

  resolveCampaign(world,context={}){
    const id=clean(context.activeCampaignId||world?.selectedCampaignId||'');
    return world?.campaigns?.find((row)=>String(row.campaignId)===id)||world?.campaigns?.[0]||null;
  }

  resolveFocus(world,context={}){
    const campaign=this.resolveCampaign(world,context);
    const ticket=clean(context.focusedTicket||'');
    const position=world?.campaigns?.flatMap((row)=>row.positions||[]).find((row)=>String(row.ticket)===ticket)||null;
    return {campaign,position,symbol:clean(context.focusedSymbol||position?.symbol||campaign?.symbol||world?.campaignControl?.symbol||'',32).toUpperCase()||null};
  }

  waitingState(world,behaviors=[],receipts=[],context={}){
    const counter=world?.campaignControl?.counterOnStop;
    if(counter?.pending)return {type:'market_confirmation',label:'HIGHTOWER is waiting for confirmed opposite structure before opening the counter campaign.',source:'ea',sinceCampaign:counter.sourceCampaignId,lastStopTicket:counter.lastStopTicket};
    if(counter?.armed)return {type:'broker_event',label:'Counter-on-stop is armed. WISDO is waiting for a real broker stop-out on this campaign.',source:'ea',sinceCampaign:counter.sourceCampaignId};
    const intentAt=Date.parse(context.currentIntent?.updatedAt||0);
    const related=intentAt?receipts.find((row)=>Date.parse(row.requestedAt||0)>=intentAt-1000):null;
    if(related&&['pending','delivered','queued','processing'].includes(String(related.status||'').toLowerCase()))
      return {type:'ea_acknowledgement',label:`Waiting for verified EA receipt: ${related.command||'command'}.`,source:'command',commandId:related.commandId};
    const pending=receipts.find((row)=>['pending','delivered','queued','processing'].includes(String(row.status||'').toLowerCase()));
    if(pending)return {type:'ea_acknowledgement',label:`Waiting for verified EA receipt: ${pending.command||'command'}.`,source:'command',commandId:pending.commandId};
    if(context.waitingFor?.type==='confirmation')return {type:'confirmation',label:'WISDO understood the instruction. Nothing is sent until you confirm the live plan.',source:'continuity',proposalId:context.waitingFor.proposalId||null};
    const active=behaviors.find((row)=>row.status==='active');
    if(active)return {type:'behavior_trigger',label:`Standing instruction active: ${active.name}. WISDO is waiting for its verified trigger.`,source:'behavior',behaviorId:active.behavior_id};
    return null;
  }

  async state(owner,{accountId=''}={}){
    const workspace=await this.workspace(owner);const context=obj(workspace.active_context);
    const selectedAccount=clean(accountId||context.activeAccountId||'');
    const [world,behaviors,receipts,env,scenes,reflexes,events]=await Promise.all([
      this.worldCommandService.state(String(owner),{accountId:selectedAccount}),
      this.adaptiveFabricService?.listBehaviors(String(owner),{limit:100}).catch(()=>[])||[],
      this.worldCommandService.receipts(String(owner),{accountId:selectedAccount,limit:30}),
      this.recentEnvironment(owner),
      this.scenes(owner),
      this.customReflexes(owner),
      this.pool.query(`SELECT event_id,source_type,source_id,event_type,severity,payload,correlation_id,created_at FROM wisdo_event_ledger WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT 30`,[String(owner)]).then(r=>r.rows),
    ]);
    const focus=this.resolveFocus(world,context);
    const liveRooms=env.rooms.filter((room)=>room.occupied);
    const primary=context.primaryDeviceId?env.devices.find((d)=>String(d.device_id)===String(context.primaryDeviceId)):env.devices[0]||null;
    const waiting=this.waitingState(world,behaviors,receipts,context);
    const verified=receipts.filter((row)=>['completed','failed','expired','cancelled'].includes(String(row.status||'').toLowerCase())).slice(0,12);
    return {
      ok:true,
      now:{
        generatedAt:world.generatedAt,
        account:world.account,
        financial:world.financial,
        campaign:focus.campaign,
        position:focus.position,
        symbol:focus.symbol,
        campaignControl:world.campaignControl,
        executionHealth:world.executionHealth,
        bot:world.bot,
        operatingMode:context.operatingMode||'DESK',
        room:liveRooms[0]||null,
      },
      intent:context.currentIntent||null,
      waiting,
      standing:{
        counterOnStop:world.campaignControl?.counterOnStop||null,
        behaviors:behaviors.filter((row)=>['active','shadow','paused','draft'].includes(row.status)).slice(0,30),
        presenceScenes:scenes,
      },
      verified,
      continuity:{
        focus:{campaignId:focus.campaign?.campaignId||null,ticket:focus.position?.ticket||null,symbol:focus.symbol},
        primaryDevice:primary,
        devices:env.devices,
        onlineComponents:env.components,
        occupiedRooms:liveRooms,
        customReflexes:reflexes,
        builtInReflexes:BUILTIN_REFLEXES,
      },
      events,
      world,
    };
  }

  semanticShortcut(text,state){
    const t=clean(text,1000).toLowerCase().replace(/\s+/g,' ');
    const focus=state.continuity.focus;const floating=Number(state.now.campaign?.floatingMoney??state.now.financial?.floatingPL??0);
    if(/\b(?:tighten|bring|pull)\b.*\b(?:loss|protection|stop|trail)\b|\b(?:protect|lock)\b.*\b(?:more|tighter|this|it)\b/.test(t)){
      if(floating<=0 && /\b(?:protect this|protect it|make (?:this|it) safer)\b/.test(t))return {type:'CLARIFICATION',intent:'PROTECTION_AMBIGUOUS',confidence:1,parameters:{},rawText:text};
      return {type:'ACTION',intent:'SET_TRAIL_ATR',commandName:'WISDO_CAMPAIGN',confidence:.99,parameters:{action:'SET_TRAIL_ATR',trailDeltaAtr:-0.25},rawText:text};
    }
    if(/\b(?:give|leave)\b.*\b(?:this|it|trade|campaign|trail)\b.*\b(?:room|space|breathing)\b/.test(t))
      return {type:'ACTION',intent:'SET_TRAIL_ATR',commandName:'WISDO_CAMPAIGN',confidence:.96,parameters:{action:'SET_TRAIL_ATR',trailDeltaAtr:0.25},rawText:text};
    if(/\b(?:take|trim|cut)\b.*\bhalf\b/.test(t))
      return {type:'ACTION',intent:'TRIM_CAMPAIGN',commandName:'WISDO_CAMPAIGN',confidence:.99,parameters:{action:'TRIM_CAMPAIGN',trimPercent:50,tickets:[]},rawText:text};
    if(/\b(?:make|turn)\b.*\b(?:this|it)\b.*\brunner\b/.test(t)&&focus.ticket)
      return {type:'ACTION',intent:'ASSIGN_RUNNER',commandName:'WISDO_CAMPAIGN',confidence:.99,parameters:{action:'ASSIGN_RUNNER',tickets:[Number(focus.ticket)]},rawText:text};
    if(/\b(?:make|turn)\b.*\b(?:this|it)\b.*\bcollector\b/.test(t)&&focus.ticket)
      return {type:'ACTION',intent:'ASSIGN_COLLECTOR',commandName:'WISDO_CAMPAIGN',confidence:.99,parameters:{action:'ASSIGN_COLLECTOR',tickets:[Number(focus.ticket)]},rawText:text};
    if(/\bclose\b.*\b(?:this|it|position|trade)\b/.test(t)&&focus.ticket)
      return {type:'WORLD_ACTION',intent:'CLOSE_POSITION',confidence:.99,parameters:{action:'CLOSE_POSITION',positionId:String(focus.ticket)},rawText:text};
    return null;
  }

  parseComponentAction(text){
    const t=clean(text,1000).replace(/\s+/g,' ');
    const m=t.match(/^\s*(?:wisdo[, ]+)?(?:please\s+)?(wake|turn on|power on|turn off|power off|lock|unlock)\s+(.+)$/i);
    if(!m)return null;
    const verb=m[1].toLowerCase();
    const action=verb==='wake'?'wake':verb==='lock'?'lock':verb==='unlock'?'unlock':/off/.test(verb)?'power_off':'power_on';
    const target=clean(m[2].replace(/^(?:my|the)\s+/i,''),160);
    return {action,target,parameters:{},riskLevel:action==='unlock'?3:1};
  }

  parsePresenceScene(text){
    const t=clean(text,1000).replace(/\s+/g,' ');
    const m=t.match(/\b(?:when|if)\s+i\s+(enter|walk into|come into|leave|walk out of)\s+(.+?)\s+(wake|turn on|power on|turn off|power off)\s+(.+)$/i);
    if(!m)return null;
    const event=/leave|out/i.test(m[1])?'exit':'enter';
    const room=clean(m[2].replace(/^(?:my|the)\s+/i,''),120);
    const verb=m[3].toLowerCase();
    const action=/off/.test(verb)?'power_off':/wake/.test(verb)?'wake':'power_on';
    const target=clean(m[4].replace(/^(?:my|the)\s+/i,''),160);
    return {event,room,target,action,parameters:{}};
  }

  async validatePresenceScene(owner,scene){
    if(!this.universalControlService)throw Object.assign(new Error('Universal control plane is unavailable.'),{statusCode:503,code:'control_plane_unavailable'});
    const targets=await this.universalControlService.resolveComponentsForOwner(owner,{alias:scene.target});
    if(!targets.length)throw Object.assign(new Error(`No recently-online component matches "${scene.target}". Register its agent before creating this scene.`),{statusCode:409,code:'component_not_online'});
    const capable=targets.filter((target)=>Array.isArray(target.capabilities?.actions)?target.capabilities.actions.includes(scene.action):Boolean(target.capabilities?.[scene.action]));
    if(!capable.length)throw Object.assign(new Error(`The matched component does not advertise "${scene.action}".`),{statusCode:409,code:'component_capability_missing'});
    return capable;
  }

  proposal(owner,type,payload,holdRequiredMs=1200){
    const proposalId=`continuity:${crypto.randomUUID()}`;const token=crypto.randomBytes(24).toString('base64url');
    this.proposals.set(proposalId,{proposalId,owner:String(owner),type,payload,tokenHash:hash(token),expiresAt:Date.now()+45000,holdRequiredMs});
    return {proposalId,confirmationToken:token,type,holdRequiredMs,expiresAt:new Date(Date.now()+45000).toISOString(),payload};
  }

  async recordInterpretation(owner,text,intent,context,plan,status='planned'){
    const requestId=crypto.randomUUID(),correlationId=crypto.randomUUID();
    await this.pool.query(`INSERT INTO wisdo_intent_requests(request_id,owner_user_id,issued_by_device_id,correlation_id,utterance,parsed_intent,context,risk_level,status,created_at,updated_at)
      VALUES($1,$2,NULL,$3,$4,$5::jsonb,$6::jsonb,$7,$8,NOW(),NOW())`,[requestId,String(owner),correlationId,clean(text,4000),JSON.stringify(obj(intent)),JSON.stringify(obj(context)),riskLevel(intent),status]);
    if(plan)await this.pool.query(`INSERT INTO wisdo_action_plans(plan_id,owner_user_id,request_id,correlation_id,plan_definition,safety_checks,status,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,NOW(),NOW())`,[crypto.randomUUID(),String(owner),requestId,correlationId,JSON.stringify(obj(plan)),JSON.stringify({verified_command_path:true,ea_ack_required:true}),status]);
    return {requestId,correlationId};
  }

  async interpret(owner,{text,accountId='',campaignId='',ticket=''}={}){
    const raw=clean(text,4000);if(!raw)throw Object.assign(new Error('Tell WISDO what you want.'),{statusCode:400});
    if(accountId||campaignId||ticket)await this.patchContext(owner,{...(accountId?{activeAccountId:String(accountId)}:{}),...(campaignId?{activeCampaignId:String(campaignId)}:{}),...(ticket?{focusedTicket:String(ticket)}:{})});
    const state=await this.state(owner,{accountId});
    const componentAction=this.parseComponentAction(raw);
    if(componentAction){
      if(!this.universalControlService)throw Object.assign(new Error('Universal control plane is unavailable.'),{statusCode:503,code:'control_plane_unavailable'});
      const targets=await this.universalControlService.resolveComponentsForOwner(owner,{alias:componentAction.target});
      if(!targets.length)throw Object.assign(new Error(`No recently-online component matches "${componentAction.target}". Nothing was sent.`),{statusCode:409,code:'component_not_online'});
      const capable=targets.filter((target)=>Array.isArray(target.capabilities?.actions)?target.capabilities.actions.includes(componentAction.action):Boolean(target.capabilities?.[componentAction.action]));
      if(!capable.length)throw Object.assign(new Error(`The matched component does not advertise "${componentAction.action}". Nothing was sent.`),{statusCode:409,code:'component_capability_missing'});
      const p=this.proposal(owner,'component_action',{...componentAction,targetIds:capable.map((x)=>x.component_id)},componentAction.riskLevel>=3?1800:700);
      const intent={type:'ACTION',intent:'COMPONENT_ACTION',confidence:1,parameters:componentAction,rawText:raw};
      await this.patchContext(owner,{currentIntent:{text:raw,kind:'component_action',meaning:componentAction,updatedAt:now()},waitingFor:{type:'confirmation',proposalId:p.proposalId}});
      await this.recordInterpretation(owner,raw,intent,state.now,{type:'component_action',...componentAction},'awaiting_confirmation');
      return {ok:true,kind:'continuity_proposal',proposal:p,meaning:`${componentAction.action} ${componentAction.target} using its registered WISDO component.`};
    }
    const scene=this.parsePresenceScene(raw);
    if(scene){
      const targets=await this.validatePresenceScene(owner,scene);
      const p=this.proposal(owner,'presence_scene',{scene,targetIds:targets.map((x)=>x.component_id)},1200);
      const intent={type:'BEHAVIOR',intent:'PRESENCE_SCENE',confidence:1,parameters:scene,rawText:raw};
      await this.patchContext(owner,{currentIntent:{text:raw,kind:'presence_scene',meaning:`On ${scene.event} of ${scene.room}, ${scene.action} ${scene.target}.`,updatedAt:now()},waitingFor:{type:'confirmation',proposalId:p.proposalId}});
      await this.recordInterpretation(owner,raw,intent,state.now,{type:'presence_scene',scene},'awaiting_confirmation');
      return {ok:true,kind:'continuity_proposal',proposal:p,meaning:`When you ${scene.event==='enter'?'enter':'leave'} ${scene.room}, WISDO will send ${scene.action} to the verified ${scene.target} component.`};
    }
    const shortcut=this.semanticShortcut(raw,state);
    const context={
      activeAccountId:state.now.account?.accountId||null,
      activeCampaignId:state.now.campaign?.campaignId||null,
      selectedTicket:state.now.position?.ticket||null,
      symbol:state.now.symbol,
      floatingPL:state.now.campaign?.floatingMoney??state.now.financial?.floatingPL??null,
      availableCommands:Object.entries(state.world.capabilities||{}).filter(([,v])=>v.available).map(([k])=>k),
      campaignActions:Object.entries(state.world.capabilities||{}).filter(([k,v])=>v.available&&v.command==='WISDO_CAMPAIGN').map(([k])=>k),
      counterOnStop:state.now.campaignControl?.counterOnStop||null,
      operatingMode:state.now.operatingMode,
    };
    const intent=shortcut||await this.intentService.parse(raw,context);
    if(intent.type==='CLARIFICATION'||intent.confidence<this.intentService.confidenceThreshold){
      await this.patchContext(owner,{currentIntent:{text:raw,kind:'clarification',meaning:'WISDO needs one missing detail before changing live state.',updatedAt:now()},waitingFor:{type:'clarification'}});
      await this.recordInterpretation(owner,raw,intent,context,null,'clarification');
      return {ok:true,kind:'clarification',intent,message:'I understand the outcome, but one live detail is ambiguous. Select the trade/campaign or say exactly what should become tighter, wider, closed, or reassigned. Nothing was sent.'};
    }
    if(intent.type==='WORLD_ACTION'||(intent.type==='ACTION'&&intent.commandName)){
      const action=intent.type==='WORLD_ACTION'?intent.parameters.action:(intent.commandName==='WISDO_CAMPAIGN'?intent.parameters?.action:WORLD_COMMAND_MAP[intent.commandName]);
      if(!action){
        await this.recordInterpretation(owner,raw,intent,context,null,'unsupported');
        return {ok:true,kind:'unavailable',intent,message:`WISDO understood "${intent.intent}", but that outcome is not on the verified Live Manager execution path. Nothing was sent.`};
      }
      const options={...(intent.parameters||{}),accountId:state.now.account?.accountId,campaignId:state.now.campaign?.campaignId,positionId:intent.parameters?.positionId||state.now.position?.ticket||undefined};
      const p=await this.worldCommandService.propose(String(owner),{action,...options});
      const meaning={action,label:p.label,scope:p.scope,accountId:p.account?.accountId,campaignId:p.campaign?.campaignId||state.now.campaign?.campaignId||null,positionId:p.position?.ticket||options.positionId||null,parameters:intent.parameters};
      await this.patchContext(owner,{currentIntent:{text:raw,kind:'command',meaning,updatedAt:now()},waitingFor:{type:p.holdRequiredMs?'confirmation':'execution',proposalId:p.proposalId}});
      await this.recordInterpretation(owner,raw,intent,context,{type:'world_command',action,meaning},'awaiting_confirmation');
      return {ok:true,kind:'world_proposal',intent,meaning,proposal:p};
    }
    if(intent.type==='BEHAVIOR'){
      if(!this.adaptiveFabricService)return {ok:true,kind:'unavailable',intent,message:'The standing-intention engine is unavailable. Nothing was saved or sent.'};
      let behavior=this.adaptiveFabricService.compileNaturalBehavior(intent.parameters?.naturalLanguage||raw,{owner_user_id:String(owner),account_id:state.now.account?.accountId,selected_ticket:state.now.position?.ticket,last_symbol:state.now.symbol},{owner_user_id:String(owner),account_id:state.now.account?.accountId});
      behavior={...behavior,scope:{...behavior.scope,account_id:state.now.account?.accountId||behavior.scope?.account_id||null}};
      const capabilities=await this.adaptiveFabricService.listCapabilities(String(owner)).catch(()=>[]);
      const validation=this.adaptiveFabricService.validateBehavior(behavior,capabilities);
      if(!validation.valid){
        await this.recordInterpretation(owner,raw,intent,context,{type:'behavior',validation},'unsupported');
        return {ok:true,kind:'unavailable',intent,message:`That standing intention cannot execute yet: ${validation.errors.join(' ')} Nothing was activated.`};
      }
      const conflicts=await this.adaptiveFabricService.conflicts(String(owner),behavior);
      if(conflicts.some((x)=>x.severity==='blocking'))return {ok:true,kind:'clarification',intent,conflicts,message:`That conflicts with an active standing instruction: ${conflicts.map((x)=>x.reason).join(' ')}`};
      const saved=await this.adaptiveFabricService.saveBehavior(String(owner),behavior,validation);
      const p=this.proposal(owner,'activate_behavior',{behaviorId:saved.behavior_id,name:saved.name},1800);
      await this.patchContext(owner,{currentIntent:{text:raw,kind:'standing_behavior',meaning:{behaviorId:saved.behavior_id,name:saved.name,definition:behavior},updatedAt:now()},waitingFor:{type:'confirmation',proposalId:p.proposalId}});
      await this.recordInterpretation(owner,raw,intent,context,{type:'behavior',behaviorId:saved.behavior_id},'awaiting_confirmation');
      return {ok:true,kind:'continuity_proposal',intent,proposal:p,meaning:`Standing instruction compiled: ${saved.name}. It is saved as a draft until you confirm it.`};
    }
    if(/\b(?:im leaving|i am leaving|away mode|watch this for me)\b/i.test(raw)){
      await this.patchContext(owner,{operatingMode:'AWAY',currentIntent:{text:raw,kind:'mode',meaning:'Keep monitoring while AWAY; route truth to available connected devices.',updatedAt:now()},waitingFor:null});
      await this.event(owner,'continuity.mode.changed',{mode:'AWAY'},'continuity');
      return {ok:true,kind:'completed',message:'AWAY mode is active. WISDO will keep the trading state and standing instructions alive; device delivery is used only where a real connected device is available.'};
    }
    await this.recordInterpretation(owner,raw,intent,context,null,'no_action');
    return {ok:true,kind:'conversation',intent,message:'WISDO understood this as conversation, not an executable instruction. No trading or device change was made.'};
  }

  async execute(owner,{proposalId,confirmationToken,heldForMs=0}={}){
    const p=this.proposals.get(clean(proposalId,220));
    if(!p||p.owner!==String(owner)||p.expiresAt<=Date.now())throw Object.assign(new Error('Continuity proposal expired. Review the live state again.'),{statusCode:409,code:'proposal_expired'});
    if(hash(clean(confirmationToken,300))!==p.tokenHash)throw Object.assign(new Error('Invalid confirmation token.'),{statusCode:403});
    if(Number(heldForMs)<p.holdRequiredMs)throw Object.assign(new Error(`Hold confirmation for at least ${p.holdRequiredMs}ms.`),{statusCode:409,code:'hold_required'});
    this.proposals.delete(p.proposalId);
    if(p.type==='component_action'){
      const executions=await this.universalControlService.executeForOwner(String(owner),{target:{alias:p.payload.target},action:p.payload.action,parameters:p.payload.parameters||{},risk_level:p.payload.riskLevel||1},null);
      await this.event(owner,'continuity.component.commanded',{action:p.payload.action,target:p.payload.target,executions:executions.map((x)=>({executionId:x.execution_id,componentId:x.component_id,status:x.status}))},'component');
      await this.patchContext(owner,{waitingFor:null});
      return {ok:true,status:'queued',message:`${p.payload.action} was queued only to the verified online component. Completion still requires the component agent result.`,executions};
    }
    if(p.type==='activate_behavior'){
      const row=await this.adaptiveFabricService.activateBehavior(String(owner),p.payload.behaviorId,String(owner));
      if(!row)throw Object.assign(new Error('Standing instruction is no longer a confirmable draft.'),{statusCode:409});
      await this.event(owner,'continuity.behavior.activated',{behaviorId:row.behavior_id,name:row.name},'behavior',row.behavior_id);
      await this.patchContext(owner,{waitingFor:null});
      return {ok:true,status:'active',message:`${row.name} is active. It will issue actions only when its verified trigger becomes true.`,behavior:row};
    }
    if(p.type==='presence_scene'){
      const scene=p.payload.scene;const id=`scene:${crypto.randomUUID()}`;
      await this.pool.query(`INSERT INTO wisdo_kernel_memory(memory_id,owner_user_id,memory_type,content,importance,confidence,source,metadata,created_at,updated_at)
        VALUES($1,$2,'presence_scene',$3,90,100,'user',$4::jsonb,NOW(),NOW())`,[id,String(owner),`${scene.event} ${scene.room} → ${scene.action} ${scene.target}`,JSON.stringify(scene)]);
      await this.event(owner,'continuity.presence_scene.armed',{sceneId:id,...scene},'continuity',id);
      await this.patchContext(owner,{waitingFor:null});
      return {ok:true,status:'active',message:`Presence scene active: ${scene.event} ${scene.room} → ${scene.action} ${scene.target}.`,sceneId:id};
    }
    throw Object.assign(new Error('Unsupported Continuity proposal.'),{statusCode:409});
  }

  async focus(owner,input={}){
    const state=await this.state(owner,{accountId:input.accountId||''});
    const patch={};
    if(input.campaignId){
      const campaign=state.world.campaigns.find((row)=>String(row.campaignId)===String(input.campaignId));
      if(!campaign)throw Object.assign(new Error('Campaign is no longer active.'),{statusCode:409});
      patch.activeCampaignId=String(campaign.campaignId);patch.focusedSymbol=campaign.symbol;patch.focusedTicket=null;
    }
    if(input.ticket){
      const position=state.world.campaigns.flatMap((row)=>row.positions||[]).find((row)=>String(row.ticket)===String(input.ticket));
      if(!position)throw Object.assign(new Error('Position is no longer open.'),{statusCode:409});
      const campaign=state.world.campaigns.find((row)=>row.positions?.some((p)=>String(p.ticket)===String(input.ticket)));
      patch.focusedTicket=String(position.ticket);patch.focusedSymbol=position.symbol;patch.activeCampaignId=campaign?.campaignId||patch.activeCampaignId;
    }
    if(input.symbol)patch.focusedSymbol=clean(input.symbol,32).toUpperCase();
    if(input.accountId)patch.activeAccountId=String(input.accountId);
    await this.patchContext(owner,patch);await this.event(owner,'continuity.focus.changed',patch);
    return this.state(owner,{accountId:input.accountId||''});
  }

  async setMode(owner,mode){
    const next=clean(mode,20).toUpperCase();if(!['DESK','AWAY','MOBILE'].includes(next))throw Object.assign(new Error('Mode must be DESK, AWAY, or MOBILE.'),{statusCode:400});
    await this.patchContext(owner,{operatingMode:next});await this.event(owner,'continuity.mode.changed',{mode:next});
    return this.state(owner);
  }

  async handoff(owner,deviceId){
    const r=await this.pool.query(`SELECT d.*,v.last_heartbeat_at,v.room_id FROM wisdo_devices d LEFT JOIN wisdo_voice_devices v ON v.device_id=d.device_id
      WHERE d.owner_user_id=$1 AND d.device_id=$2 AND d.status='active' AND COALESCE(v.last_heartbeat_at,d.last_seen_at)>NOW()-INTERVAL '5 minutes'`,[String(owner),clean(deviceId,200)]);
    if(!r.rows[0])throw Object.assign(new Error('That device is not currently connected. Handoff was not changed.'),{statusCode:409,code:'device_not_live'});
    await this.patchContext(owner,{primaryDeviceId:r.rows[0].device_id});await this.event(owner,'continuity.device.handoff',{deviceId:r.rows[0].device_id});
    return r.rows[0];
  }

  async runReflex(owner,key,{accountId='',campaignId='',ticket=''}={}){
    const builtin=BUILTIN_REFLEXES.find((x)=>x.key===clean(key,120));
    let definition=builtin;
    if(!definition){
      const r=await this.pool.query(`SELECT * FROM wisdo_kernel_memory WHERE owner_user_id=$1 AND memory_type='reflex' AND (memory_id=$2 OR lower(content)=lower($2)) LIMIT 1`,[String(owner),clean(key,200)]);
      definition=r.rows[0]?.metadata||null;
    }
    if(!definition?.action)throw Object.assign(new Error('Reflex not found or does not contain a verified executable action.'),{statusCode:404});
    const state=await this.state(owner,{accountId});const focus=state.continuity.focus;
    const proposal=await this.worldCommandService.propose(String(owner),{action:definition.action,accountId:state.now.account?.accountId,campaignId:campaignId||state.now.campaign?.campaignId,positionId:ticket||focus.ticket||undefined,...obj(definition.options)});
    await this.patchContext(owner,{currentIntent:{text:`Reflex: ${definition.name||key}`,kind:'reflex',meaning:definition,updatedAt:now()},waitingFor:{type:proposal.holdRequiredMs?'confirmation':'execution',proposalId:proposal.proposalId}});
    return {ok:true,kind:'world_proposal',proposal,meaning:definition};
  }

  async saveReflex(owner,{name,text,aliases=[]}={}){
    const state=await this.state(owner);const raw=clean(text,2000);if(!raw)throw Object.assign(new Error('Reflex action text is required.'),{statusCode:400});
    const shortcut=this.semanticShortcut(raw,state);const context={activeAccountId:state.now.account?.accountId,activeCampaignId:state.now.campaign?.campaignId,selectedTicket:state.now.position?.ticket,symbol:state.now.symbol,campaignActions:Object.keys(state.world.capabilities||{})};
    const intent=shortcut||await this.intentService.parse(raw,context);
    const action=intent.type==='WORLD_ACTION'?intent.parameters?.action:(intent.commandName==='WISDO_CAMPAIGN'?intent.parameters?.action:WORLD_COMMAND_MAP[intent.commandName]);
    if(!action||!state.world.capabilities?.[action]?.connected)throw Object.assign(new Error('That reflex does not resolve to a verified Live Manager action. It was not saved.'),{statusCode:409});
    const id=`reflex:${crypto.randomUUID()}`,definition={key:id,name:clean(name,100)||raw,action,options:intent.parameters||{},aliases:Array.isArray(aliases)?aliases.map((x)=>clean(x,120)).filter(Boolean).slice(0,20):[]};
    await this.pool.query(`INSERT INTO wisdo_kernel_memory(memory_id,owner_user_id,memory_type,content,importance,confidence,source,metadata,created_at,updated_at)
      VALUES($1,$2,'reflex',$3,85,100,'user',$4::jsonb,NOW(),NOW())`,[id,String(owner),definition.name,JSON.stringify(definition)]);
    await this.event(owner,'continuity.reflex.saved',definition,'continuity',id);return definition;
  }

  async onRoomTransition({device,room,event}){
    const owner=String(device.owner_user_id);const scenes=await this.scenes(owner);
    for(const row of scenes){
      const scene=obj(row.metadata);if(clean(scene.room,120).toLowerCase()!==clean(room.room_id,120).toLowerCase()||scene.event!==event)continue;
      try{
        const executions=await this.universalControlService.executeForOwner(owner,{target:{alias:scene.target},action:scene.action,parameters:scene.parameters||{},risk_level:1},device.device_id);
        await this.event(owner,'continuity.presence_scene.executed',{sceneId:row.memory_id,roomId:room.room_id,event,executions:executions.map((x)=>({executionId:x.execution_id,componentId:x.component_id,status:x.status}))},'room',room.room_id);
      }catch(error){
        await this.event(owner,'continuity.presence_scene.failed',{sceneId:row.memory_id,roomId:room.room_id,event,code:error.code||null,error:error.message},'room',room.room_id,'warning');
      }
    }
  }
}

export { BUILTIN_REFLEXES };
