import { extractWisdoWakeCommand } from './wisdoIntentService.js';

export const COACH_RESPONSES = Object.freeze({
  wake: "I'm listening. What can I help you with?",
  ready: 'What else can I help you with today?',
  unavailable: 'I understand what you want to do, but I cannot complete that action at this time. What else can I help you with today?',
  unsupported: 'I cannot perform that action yet. I did not make any changes. What else can I help you with today?',
  failed: 'I heard your request, but something went wrong while processing it. I have not changed your trading setup.',
  offline: 'I understood the request, but the trading connection is currently offline. I did not apply the change.',
  demoOnly: 'Demo-only protection blocked that action because the selected account is live or could not be proven to be a demo account. I did not make any changes.',
});

function accountId(a){return String(a?.accountId||a?.account_id||a?.id||'');}
function accountLabel(a){return a?.alias||a?.accountName||a?.account_number||a?.accountNumber||accountId(a);}
function isLive(a){return /live|real/i.test(String(a?.environment||a?.accountType||a?.type||''));}
function connected(a,staleMs){const date=a?.lastSyncAt||a?.last_sync_at||a?.updatedAt||a?.updated_at;return a?.status!=='offline'&&Boolean(date)&&Date.now()-new Date(date).getTime()<=staleMs;}

export class WisdoConversationService {
  constructor({intentService,contextService,safetyService,confirmationService,planService,executionService,educationService=null,auditService=null,capabilityService=null,adaptiveFabricService=null,getAuthorizedAccounts=async()=>[],getActiveAccount=async()=>null,menuProvider=async()=>({}),staleMs=Number(process.env.WISDO_TRADING_OFFLINE_MS||300000)}={}){Object.assign(this,{intentService,contextService,safetyService,confirmationService,planService,executionService,educationService,auditService,capabilityService,adaptiveFabricService,getAuthorizedAccounts,getActiveAccount,menuProvider,staleMs});}

  async ensureSession({userId,deviceId=null,discordUserId=null,channel='device',sessionId=null,wakeMatched=false}){
    let session=sessionId?await this.contextService.get(sessionId,userId):await this.contextService.latest(userId,deviceId);
    if(!session&&(wakeMatched||channel!=='discord'))session=await this.contextService.start({userId,deviceId,discordUserId,channel});
    return session;
  }

  async resolveAccount(userId,intent,context={},requestedAccountId=null){
    const accounts=await this.getAuthorizedAccounts(userId);
    if(requestedAccountId){const selected=accounts.find((a)=>accountId(a)===String(requestedAccountId));this.safetyService.assertAccountAccess([requestedAccountId],accounts);return {account:selected,accounts};}
    const contextId=context.activeAccountId||await this.getActiveAccount(userId);
    if(contextId){const selected=accounts.find((a)=>accountId(a)===String(contextId));if(selected)return {account:selected,accounts};}
    if(accounts.length===1)return {account:accounts[0],accounts};
    if(accounts.length>1&&intent.type==='ACTION')return {account:null,accounts,ambiguous:true};
    return {account:accounts[0]||null,accounts};
  }

  async answer(input={}){
    const {userId,deviceId=null,discordUserId=null,channel='device'}=input;
    const wake=extractWisdoWakeCommand(input.text||'');
    const session=await this.ensureSession({userId,deviceId,discordUserId,channel,sessionId:input.sessionId,wakeMatched:wake.matched});
    if(!session)return this.result(null,'idle','',false);
    if(wake.wakeOnly){await this.saveExchange(session,userId,input.text,COACH_RESPONSES.wake,{type:'CONVERSATION',intent:'WAKE_ONLY',confidence:1},'listening');return this.result(session,'listening',COACH_RESPONSES.wake);}
    const text=wake.matched?wake.command:String(input.text||'').trim();
    if(!text){await this.saveExchange(session,userId,input.text,COACH_RESPONSES.wake,null,'listening');return this.result(session,'listening',COACH_RESPONSES.wake);}
    try{
      const context={...(session.context||{}),activePlanId:session.active_plan_id||session.context?.activePlanId,planMode:Boolean(session.active_plan_id||session.context?.planMode)};
      const intent=await this.intentService.parse(text,context);
      await this.contextService.message({sessionId:session.session_id,userId,role:'user',content:String(input.text||text),intent});
      const handled=await this.handle({input,text,intent,session,context});
      await this.contextService.message({sessionId:session.session_id,userId,role:'assistant',content:handled.text,intent,responseState:handled.state});
      await this.auditService?.record({userId,sessionId:session.session_id,actorType:'conversation',eventType:`conversation.${handled.state}`,correlationId:handled.commandId||handled.planId||session.session_id,detail:{intent,response:handled.text}});
      return this.result(session,handled.state,handled.text,true,{...handled,intent});
    }catch(error){
      await this.auditService?.record({userId,sessionId:session.session_id,actorType:'system',eventType:'conversation.failed',detail:{code:error.code||'',message:error.message}}).catch(()=>undefined);
      const text=error.code==='confirmation_pending'?'A trading instruction is already awaiting confirmation. Say “Confirm Coach, execute” or “cancel” before creating another one. I did not queue a second instruction.':error.code==='trading_offline'?COACH_RESPONSES.offline:error.code==='demo_only_live_blocked'||error.code==='voice_execution_disabled'?COACH_RESPONSES.demoOnly:error.code==='unsupported_action'?COACH_RESPONSES.unsupported:COACH_RESPONSES.failed;
      await this.contextService.message({sessionId:session.session_id,userId,role:'assistant',content:text,responseState:'failed'}).catch(()=>undefined);
      return this.result(session,'failed',text,true,{error:{code:error.code||'processing_failed'}});
    }
  }

  result(session,state,text,responded=true,extra={}){return {ok:state!=='failed',responded,sessionId:session?.session_id||null,state,text,audioRequested:Boolean(text),...extra};}
  async saveExchange(session,userId,user,assistant,intent,state){await this.contextService.message({sessionId:session.session_id,userId,role:'user',content:String(user||''),intent});await this.contextService.message({sessionId:session.session_id,userId,role:'assistant',content:assistant,intent,responseState:state});await this.contextService.touch(session.session_id,userId);}

  async handle({input,text,intent,session,context}){
    const userId=input.userId;
    if(intent.type==='GOODBYE'){await this.contextService.close(session.session_id,userId,'closed');return {state:'completed',text:`Okay. ${COACH_RESPONSES.ready}`};}
    if(intent.type==='CANCEL'){await this.confirmationService.cancel(userId,session.session_id);return {state:'cancelled',text:`I cancelled the pending instruction. I did not make any changes. ${COACH_RESPONSES.ready}`};}
    if(intent.type==='CONFIRMATION')return this.confirm({input,text,intent,session});
    if(intent.type==='BEHAVIOR')return this.behavior({input,text,intent,session,context});
    if(intent.type==='PLAN')return this.plan({input,text,intent,session,context});
    if(intent.type==='QUERY')return this.query({input,intent,session,context});
    if(intent.type==='ACTION')return this.action({input,text,intent,session,context});
    if(intent.intent==='GENERAL_CONVERSATION'){
      if(/\b(what(?:s| is)?|tell me) (?:today(?:s)? )?date\b|\bwhat day is (?:it|today)\b/i.test(text)){
        const zone=process.env.WISDO_TIME_ZONE||'America/New_York';
        const date=new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(new Date());
        return {state:'completed',text:`Today is ${date}. ${COACH_RESPONSES.ready}`};
      }
      if(this.intentService.provider?.configured?.()){
        try{const recent=await this.contextService.recent(session.session_id,userId,16);const answer=await this.intentService.provider.respond({text,context,recent});if(answer)return {state:'completed',text:`${answer} ${COACH_RESPONSES.ready}`};}
        catch(error){await this.auditService?.record({userId,sessionId:session.session_id,actorType:'provider',eventType:'conversation.ai_unavailable',detail:{message:error.message}}).catch(()=>undefined);return {state:'unavailable',text:'My AI knowledge service is temporarily unavailable, but your WISDO device and trading safeguards are still connected. I did not make any trading changes.'};}
      }
    }
    if(intent.confidence<0.7)return {state:'clarification',text:'I want to make sure I understand. Are you asking about an account, a trading action, todayâ€™s plan, or education?'};
    return {state:'completed',text:`I understand. Tell me what you would like to know or change in your trading system. ${COACH_RESPONSES.ready}`};
  }

  async action({input,text,intent,session,context}){
    if(intent.confidence<this.intentService.confidenceThreshold||Object.values(intent.parameters||{}).some((v)=>v===null))return {state:'clarification',text:`I understood ${intent.intent.toLowerCase().replaceAll('_',' ')}, but I need the exact value before I can continue.`};
    const resolved=await this.resolveAccount(input.userId,intent,context,input.accountId);
    if(resolved.ambiguous)return {state:'clarification',text:`You have multiple authorized accounts. Which account should I use: ${resolved.accounts.map(accountLabel).join(', ')}?`};
    if(!resolved.account)return {state:'unavailable',text:COACH_RESPONSES.unavailable};
    if(intent.requiresCapability&&!this.capabilityService?.supported(resolved.account,intent.intent))return {state:'unsupported',text:`${this.capabilityService?.unsupportedMessage(intent.intent)||COACH_RESPONSES.unsupported} ${COACH_RESPONSES.ready}`};
    if(!connected(resolved.account,this.staleMs))throw Object.assign(new Error('Trading connection offline.'),{code:'trading_offline'});
    const id=accountId(resolved.account);
    const requestedRisk=Number(intent.parameters?.globals?.WISDO_RISK_PERCENT);
    const currentRisk=Number(resolved.account.riskPercent??resolved.account.risk?.value);
    const riskChange=intent.intent==='SET_RISK_PERCENT';
    const safetyLevel=this.safetyService.classify(intent,{multipleAccounts:false,increasesRisk:riskChange&&(!Number.isFinite(currentRisk)||requestedRisk>currentRisk)});
    if(this.safetyService.requiresConfirmation(safetyLevel)){
      const pending=await this.confirmationService.create({userId:input.userId,sessionId:session.session_id,deviceId:input.deviceId,actionType:intent.intent,accountIds:[id],parameters:{intent,rawText:text},safetyLevel});
      const phrase=safetyLevel==='DANGEROUS'?'Confirm Coach, execute':'Confirm Coach, execute';
      return {state:'awaiting_confirmation',confirmationId:pending.confirmation_id,text:`Coach understood your request to ${intent.intent.toLowerCase().replaceAll('_',' ')} on account ${accountLabel(resolved.account)}. Say â€œ${phrase}â€ to continue.`};
    }
    const queued=await this.executionService.queue({userId:input.userId,deviceId:input.deviceId,accountId:id,intent:intent.intent,commandName:intent.commandName,parameters:intent.parameters,rawText:text,safetyLevel,confirmationStatus:'NOT_REQUIRED'});
    return {state:'queued',commandId:queued.id,text:this.executionService.responseFor(queued)};
  }

  async behavior({input,text,intent,session,context}){
    if(!this.adaptiveFabricService)return {state:'unsupported',text:COACH_RESPONSES.unsupported};
    if(intent.confidence<this.intentService.confidenceThreshold||Object.values(intent.parameters||{}).some((value)=>value===null))return {state:'clarification',text:'I understand the behavior, but I need the exact timer duration and timeout action before I can build it.'};
    const resolved=await this.resolveAccount(input.userId,intent,context,input.accountId);
    if(resolved.ambiguous)return {state:'clarification',text:`You have multiple authorized accounts. Which account should this behavior control: ${resolved.accounts.map(accountLabel).join(', ')}?`};
    if(!resolved.account)return {state:'unavailable',text:COACH_RESPONSES.unavailable};
    if(!connected(resolved.account,this.staleMs))throw Object.assign(new Error('Trading connection offline.'),{code:'trading_offline'});
    const id=accountId(resolved.account);
    this.safetyService.assertAccountAccess([id],resolved.accounts);
    this.safetyService.assertVoiceExecutionMode([resolved.account]);
    const compiled=this.adaptiveFabricService.compileBehavior({...intent,references:{account_id:id}}, {owner_user_id:input.userId});
    const capabilities=await this.adaptiveFabricService.listCapabilities(input.userId).catch(()=>[]);
    const validation=this.adaptiveFabricService.validateBehavior(compiled,capabilities);
    if(!validation.valid)return {state:'unsupported',text:`I could not safely compile that behavior: ${validation.errors.join(' ')} I did not make any changes.`};
    const saved=await this.adaptiveFabricService.saveBehavior(input.userId,compiled,validation);
    const pending=await this.confirmationService.create({userId:input.userId,sessionId:session.session_id,deviceId:input.deviceId,actionType:'ACTIVATE_BEHAVIOR',accountIds:[id],parameters:{behaviorId:saved.behavior_id,behavior:compiled},safetyLevel:'DANGEROUS'});
    const seconds=Number(intent.parameters.timeoutSeconds);
    return {state:'awaiting_confirmation',behaviorId:saved.behavior_id,confirmationId:pending.confirmation_id,text:`I built a resettable ${seconds}-second entry timer for account ${accountLabel(resolved.account)}. Every newly detected entry restarts it. If it expires with no newer entry, WISDO may close the full basket only when the basket is in profit. No partial close is allowed. Say “Confirm Coach, execute” within 60 seconds to activate it.`};
  }

  async confirm({input,text,session}){
    const confirmed=await this.confirmationService.confirm({userId:input.userId,sessionId:session.session_id,deviceId:input.deviceId,phrase:text});
    if(!confirmed)return {state:'clarification',text:'There is no matching unexpired confirmation for this session. I did not make any changes.'};
    if(confirmed.plan_id){const target=confirmed.action_type==='PAUSE_PLAN'?'PAUSED':'ACTIVE';if(target==='ACTIVE'){const authorized=await this.getAuthorizedAccounts(input.userId);this.safetyService.assertAccountAccess(confirmed.account_ids,authorized);const selected=authorized.filter((a)=>confirmed.account_ids.includes(accountId(a)));this.safetyService.assertVoiceExecutionMode(selected);if(selected.some((a)=>!connected(a,this.staleMs)))throw Object.assign(new Error('Trading connection offline.'),{code:'trading_offline'});}const plan=await this.planService.transition(input.userId,confirmed.plan_id,target,input.userId);const rules=target==='ACTIVE'?await this.planService.materialize(input.userId,plan.planId):[];const activationCommands=[];for(const rule of rules.filter((r)=>r.supported&&r.parameters?.immediate)){for(const id of plan.accountIds){const globals=rule.rule_type==='RISK_PERCENT'?{WISDO_RISK_PERCENT:rule.parameters.value}:{WISDO_ALLOW_BUYS:rule.parameters.directions.includes('BUY')?1:0,WISDO_ALLOW_SELLS:rule.parameters.directions.includes('SELL')?1:0};const queued=await this.executionService.queue({userId:input.userId,deviceId:input.deviceId,accountId:id,intent:rule.rule_type,commandName:'CEM_SET_GLOBALS',parameters:{globals,planRuleId:rule.rule_id},rawText:`Daily Plan activation: ${rule.rule_type}`,safetyLevel:'CONTROLLED',planId:plan.planId,confirmationStatus:'CONFIRMED'});activationCommands.push(queued.id);}}await this.confirmationService.consume(confirmed.confirmation_id);const unsupported=rules.filter((r)=>!r.supported).map((r)=>r.rule_type);return {state:target.toLowerCase(),planId:plan.planId,commandIds:activationCommands,text:target==='PAUSED'?`Confirmed. Todayâ€™s plan is paused. ${COACH_RESPONSES.ready}`:`Confirmed. Todayâ€™s plan is active. ${activationCommands.length} immediate setup command${activationCommands.length===1?' was':'s were'} queued; completion still requires verified Reporter receipts. Conditional rules are being monitored.${unsupported.length?` These rules still require an EA or Reporter upgrade: ${unsupported.join(', ')}.`:''} ${COACH_RESPONSES.ready}`};}
    if(confirmed.action_type==='ACTIVATE_BEHAVIOR'){
      const authorized=await this.getAuthorizedAccounts(input.userId);this.safetyService.assertAccountAccess(confirmed.account_ids,authorized);const selected=authorized.filter((a)=>confirmed.account_ids.includes(accountId(a)));this.safetyService.assertVoiceExecutionMode(selected);if(selected.some((a)=>!connected(a,this.staleMs)))throw Object.assign(new Error('Trading connection offline.'),{code:'trading_offline'});
      const behaviorId=confirmed.parameters?.behaviorId;const activated=await this.adaptiveFabricService?.activateBehavior(input.userId,behaviorId,input.userId);if(!activated)throw Object.assign(new Error('Behavior could not be activated.'),{code:'behavior_activation_failed'});await this.confirmationService.consume(confirmed.confirmation_id);return {state:'active',behaviorId,text:'Confirmed. The resettable entry timer is active. WISDO will monitor Reporter snapshots, reset on each new entry, require a profitable basket before acting, close only the full basket, and wait for verified MT4 receipts.'};
    }
    const stored=confirmed.parameters||{};const actionIntent=stored.intent;const id=confirmed.account_ids?.[0];
    const queued=await this.executionService.queue({userId:input.userId,deviceId:input.deviceId,accountId:id,intent:actionIntent.intent,commandName:actionIntent.commandName,parameters:actionIntent.parameters,rawText:stored.rawText||'',safetyLevel:confirmed.safety_level,confirmationStatus:'CONFIRMED'});
    await this.confirmationService.consume(confirmed.confirmation_id);
    return {state:'queued',commandId:queued.id,text:this.executionService.responseFor(queued)};
  }

  async plan({input,text,intent,session,context}){
    let plan=context.activePlanId?await this.planService.get(input.userId,context.activePlanId):await this.planService.active(input.userId);
    if(intent.intent==='CREATE_DAILY_PLAN'){if(!plan||['COMPLETED','CANCELLED','FAILED'].includes(plan.status))plan=await this.planService.create(input.userId);await this.contextService.touch(session.session_id,input.userId,{activePlanId:plan.planId,context:{planMode:true}});return {state:'plan_building',planId:plan.planId,text:"I'm ready. Tell me your complete plan for today."};}
    if(!plan)return {state:'clarification',text:'There is no active Daily Plan. Say â€œCoach, letâ€™s build todayâ€™s trading planâ€ to begin.'};
    if(intent.intent==='PAUSE_PLAN'||intent.intent==='RESUME_PLAN'){const action=intent.intent;const pending=await this.confirmationService.create({userId:input.userId,sessionId:session.session_id,deviceId:input.deviceId,actionType:action,accountIds:plan.accountIds,planId:plan.planId,parameters:{version:plan.version},safetyLevel:'CONTROLLED'});return {state:'awaiting_confirmation',planId:plan.planId,confirmationId:pending.confirmation_id,text:`Coach understood your request to ${action==='PAUSE_PLAN'?'pause':'resume'} todayâ€™s plan. Say â€œConfirm Coach, executeâ€ to continue.`};}
    if(intent.intent==='CANCEL_PLAN'){plan=await this.planService.transition(input.userId,plan.planId,'CANCELLED');return {state:'cancelled',planId:plan.planId,text:`Todayâ€™s plan is cancelled. No new plan actions will be issued. ${COACH_RESPONSES.ready}`};}
    if(intent.intent==='REVIEW_PLAN')return {state:'awaiting_confirmation',planId:plan.planId,text:this.planService.readBack(plan)};
    if(plan.status==='AWAITING_CONFIRMATION'){await this.confirmationService.cancel(input.userId,session.session_id);plan=await this.planService.transition(input.userId,plan.planId,'DRAFT');}
    const patch={...(intent.parameters||{})};
    if(input.accountId)patch.accountIds=[String(input.accountId)];
    if(!input.accountId){const authorized=await this.getAuthorizedAccounts(input.userId);const named=authorized.filter((a)=>{const label=String(accountLabel(a)||'').toLowerCase();return label.length>2&&text.toLowerCase().includes(label);});if(named.length===1)patch.accountIds=[accountId(named[0])];}
    if(intent.intent==='MODIFY_PLAN'&&patch.value!==null){const pending=session.pending_clarification||{};if(!pending.field)return {state:'clarification',text:'Which plan setting should be changed: risk, maximum trades, profit target, drawdown limit, or runner count?'};}
    plan=await this.planService.modify(input.userId,plan.planId,patch,text);
    if(!plan.accountIds.length)return {state:'plan_building',planId:plan.planId,text:'Which authorized account should this plan control? Please name the account and whether it is demo or live.'};
    const accounts=await this.getAuthorizedAccounts(input.userId);this.safetyService.assertAccountAccess(plan.accountIds,accounts);
    const live=accounts.some((a)=>plan.accountIds.includes(accountId(a))&&isLive(a));
    const updated=await this.planService.transition(input.userId,plan.planId,'AWAITING_CONFIRMATION');
    const pending=await this.confirmationService.create({userId:input.userId,sessionId:session.session_id,deviceId:input.deviceId,actionType:'ACTIVATE_DAILY_PLAN',accountIds:plan.accountIds,planId:plan.planId,parameters:{version:plan.version},safetyLevel:live?'DANGEROUS':'CONTROLLED'});
    return {state:'awaiting_confirmation',planId:updated.planId,confirmationId:pending.confirmation_id,text:this.planService.readBack(updated)};
  }

  async query({input,intent,context}){
    if(intent.intent==='PLAN_PROGRESS'){const p=await this.planService.active(input.userId);return {state:'completed',planId:p?.planId,text:p?`Todayâ€™s plan is ${p.status.toLowerCase()}. ${this.planService.readBack(p).replace(/ Say .*/,'')} ${COACH_RESPONSES.ready}`:`There is no active Daily Plan. ${COACH_RESPONSES.ready}`};}
    if(intent.intent==='DYNAMIC_MENU'){const menu=await this.menuProvider(input.userId);const items=[...(menu.website||[]),...(menu.commands||[]),...(menu.capabilities||[])].slice(0,12);return {state:'completed',text:`Your available menu includes ${items.join(', ')||'account status, trading controls, Daily Plans, copier controls, and education'}. ${COACH_RESPONSES.ready}`,menu};}
    if(intent.intent==='EDUCATION'){const p=await this.educationService?.progress(input.userId);return {state:'completed',text:p?.current_lesson?`You are currently on ${p.current_lesson}. ${COACH_RESPONSES.ready}`:`Your education portal is ready. Choose a course or ask me to explain risk percentage, bots, or the copier. ${COACH_RESPONSES.ready}`};}
    const resolved=await this.resolveAccount(input.userId,intent,context,input.accountId);if(!resolved.account)return {state:'unavailable',text:COACH_RESPONSES.unavailable};const a=resolved.account;const snapshot=a.latestSnapshot||a.latest_snapshot||a.snapshot||{};return {state:'completed',text:`Account ${accountLabel(a)} has balance ${snapshot.balance??'unavailable'}, equity ${snapshot.equity??'unavailable'}, floating profit or loss ${snapshot.profit??snapshot.floatingProfit??'unavailable'}, and ${snapshot.openTrades?.length??snapshot.openTradeCount??'an unknown number of'} open trades. The connection is ${connected(a,this.staleMs)?'online':'offline'}. ${COACH_RESPONSES.ready}`,accountId:accountId(a)};
  }
}
