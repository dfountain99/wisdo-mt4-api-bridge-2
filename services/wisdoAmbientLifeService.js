import crypto from 'node:crypto';

const clean=(value,max=300)=>String(value??'').trim().slice(0,max);
const obj=(value,fallback={})=>(value&&typeof value==='object'&&!Array.isArray(value)?value:fallback);
const arr=(value)=>Array.isArray(value)?value:[];
const upper=(value)=>clean(value,80).toUpperCase();

const DEFAULT_POLICIES=Object.freeze([
  {id:'presence_no_live_trading',effect:'deny',reason:'Presence and unattended automations can never mutate live trading.',match:{source:['presence','schedule','automation'],stepType:['trading']}},
  {id:'automation_no_unlock',effect:'deny',reason:'Unattended routines cannot unlock doors, disarm alarms, or open garages.',match:{source:['presence','schedule','automation'],stepType:['home'],actions:['unlock','disarm','open']},sensitiveOnly:true},
  {id:'guest_camera_privacy',effect:'deny',reason:'Camera actions are blocked while Guest Mode is active.',match:{stepType:['home'],deviceClasses:['CAMERA'],guestPresent:true}},
  {id:'physical_security_confirmation',effect:'confirm',reason:'Physical-security actions require explicit confirmation.',match:{stepType:['home'],minimumRisk:4}},
  {id:'trading_confirmation',effect:'confirm',reason:'Every trading mutation requires explicit confirmation.',match:{stepType:['trading']}},
]);

const ROLE_CAPS=Object.freeze({
  OWNER:['home.low','home.security','home.camera','workstation','mode','trading'],
  ADULT:['home.low','home.security','workstation','mode'],
  CHILD:['home.low','mode'],
  GUEST:['home.low'],
  TECHNICIAN:['home.low'],
});

const TRADING_ACTIONS=Object.freeze({
  pause_entries:{intent:'STOP_NEW_ENTRIES',commandName:'STOP_ENTRIES',parameters:{}},
  resume_entries:{intent:'RESUME_TRADING',commandName:'START_ENTRIES',parameters:{}},
  guard_mode:{intent:'GUARD_MODE',commandName:'SET_CONTROL_MODE',parameters:{mode:'GUARD',allowNewTrades:false,guardMode:true,maxTrades:1,riskPercent:0.25}},
  pause_copier:{intent:'PAUSE_COPIER',commandName:'PAUSE_COPIER',parameters:{}},
  resume_copier:{intent:'RESUME_COPIER',commandName:'RESUME_COPIER',parameters:{}},
  close_winners:{intent:'CLOSE_PROFITABLE_TRADES',commandName:'CLOSE_ALL_WINNERS',parameters:{percent:100}},
});

function isSensitiveHome(preview={},step={}){
  const action=clean(step.action).toLowerCase();
  if(['unlock','disarm','arm_away','arm_home'].includes(action))return true;
  if(preview.risk_level>=4)return true;
  return arr(preview.targets).some((target)=>{
    const cls=upper(target.metadata?.wisdo_device_class||target.component_type);
    return ['LOCK','GARAGE','ALARM','SIREN','CAMERA'].includes(cls);
  });
}

function permissionFor(step,preview={}){
  if(step.type==='trading')return 'trading';
  if(step.type==='workstation')return 'workstation';
  if(step.type==='mode')return 'mode';
  if(step.type==='home'){
    const classes=arr(preview.targets).map((target)=>upper(target.metadata?.wisdo_device_class||target.component_type));
    if(classes.includes('CAMERA'))return 'home.camera';
    if(isSensitiveHome(preview,step))return 'home.security';
    return 'home.low';
  }
  return 'mode';
}

function matchPolicy(policy,{source,step,preview,context}){
  const match=obj(policy.match);
  const stepType=clean(step.type).toLowerCase();
  const action=clean(step.action).toLowerCase();
  if(arr(match.source).length&&!arr(match.source).map(String).includes(source))return false;
  if(arr(match.stepType).length&&!arr(match.stepType).map((v)=>String(v).toLowerCase()).includes(stepType))return false;
  if(arr(match.actions).length&&!arr(match.actions).map((v)=>String(v).toLowerCase()).includes(action))return false;
  if(Number.isFinite(Number(match.minimumRisk))&&Number(preview?.risk_level||0)<Number(match.minimumRisk))return false;
  if(match.guestPresent===true&&!context.guestPresent)return false;
  if(arr(match.deviceClasses).length){
    const classes=arr(preview?.targets).map((target)=>upper(target.metadata?.wisdo_device_class||target.component_type));
    if(!classes.some((cls)=>arr(match.deviceClasses).map(upper).includes(cls)))return false;
  }
  if(policy.sensitiveOnly===true&&!isSensitiveHome(preview,step))return false;
  return true;
}

function validateStep(step={}){
  const type=clean(step.type).toLowerCase();
  if(!['home','workstation','trading','mode'].includes(type))throw Object.assign(new Error('Mission step type must be home, workstation, trading, or mode.'),{statusCode:400});
  if(type==='home'&&!clean(step.action))throw Object.assign(new Error('Home mission steps require an action.'),{statusCode:400});
  if(type==='workstation'&&!clean(step.intent||step.action))throw Object.assign(new Error('Workstation mission steps require an intent.'),{statusCode:400});
  if(type==='trading'&&!TRADING_ACTIONS[clean(step.action).toLowerCase()])throw Object.assign(new Error('Unsupported trading mission action.'),{statusCode:400,code:'mission_trading_action_unsupported'});
  if(type==='mode'&&!clean(step.mode||step.action))throw Object.assign(new Error('Mode mission steps require a mode.'),{statusCode:400});
  return {...step,type};
}

export class WisdoAmbientLifeService {
  constructor({pool,universalControlService,commandBusService,tradingExecutionService=null,logger=console}={}){
    Object.assign(this,{pool,universalControlService,commandBusService,tradingExecutionService,logger});
  }

  actorDevice(actor){return {owner_user_id:String(actor.owner_user_id||actor.userId||''),device_id:String(actor.device_id||actor.deviceId||'ambient-life-os')};}

  async createZone(actor,input={}){
    const zoneId=clean(input.zoneId||input.zone_id||crypto.randomUUID(),200);
    const homeId=clean(input.homeId||input.home_id,200);
    if(!homeId)throw Object.assign(new Error('homeId is required.'),{statusCode:400});
    await this.universalControlService.assertOwnedHome(this.actorDevice(actor),homeId);
    const name=clean(input.name||'Room',120);
    return (await this.pool.query(`INSERT INTO wisdo_life_zones(zone_id,owner_user_id,home_id,name,zone_type,privacy_level,metadata,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,NOW(),NOW())
      ON CONFLICT(owner_user_id,home_id,name) DO UPDATE SET zone_type=EXCLUDED.zone_type,privacy_level=EXCLUDED.privacy_level,metadata=EXCLUDED.metadata,updated_at=NOW()
      RETURNING *`,[zoneId,this.actorDevice(actor).owner_user_id,homeId,name,clean(input.zoneType||input.zone_type||'room',40),Math.max(0,Math.min(5,Number(input.privacyLevel??input.privacy_level??1))),JSON.stringify(obj(input.metadata))])).rows[0];
  }

  async listZones(actor,homeId=''){
    return (await this.pool.query(`SELECT * FROM wisdo_life_zones WHERE owner_user_id=$1 AND ($2='' OR home_id=$2) ORDER BY home_id,name`,[this.actorDevice(actor).owner_user_id,clean(homeId,200)])).rows;
  }

  async saveHouseholdMember(actor,input={}){
    const owner=this.actorDevice(actor).owner_user_id;
    const memberId=clean(input.memberId||input.member_id||crypto.randomUUID(),200);
    const role=upper(input.role||'GUEST');
    if(!ROLE_CAPS[role])throw Object.assign(new Error('Unsupported household role.'),{statusCode:400});
    const permissions={...obj(input.permissions)};
    return (await this.pool.query(`INSERT INTO wisdo_household_members(member_id,owner_user_id,home_id,display_name,role,permissions,status,expires_at,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,'active',$7,NOW(),NOW())
      ON CONFLICT(member_id) DO UPDATE SET display_name=EXCLUDED.display_name,role=EXCLUDED.role,permissions=EXCLUDED.permissions,status='active',expires_at=EXCLUDED.expires_at,updated_at=NOW()
      RETURNING *`,[memberId,owner,clean(input.homeId||input.home_id,200)||null,clean(input.displayName||input.display_name||'Household member',120),role,JSON.stringify(permissions),input.expiresAt||input.expires_at||null])).rows[0];
  }

  async listHousehold(actor,homeId=''){
    return (await this.pool.query(`SELECT * FROM wisdo_household_members WHERE owner_user_id=$1 AND status='active' AND (expires_at IS NULL OR expires_at>NOW()) AND ($2='' OR home_id=$2) ORDER BY role,display_name`,[this.actorDevice(actor).owner_user_id,clean(homeId,200)])).rows;
  }

  async savePolicy(actor,input={}){
    const policyId=clean(input.policyId||input.policy_id||crypto.randomUUID(),200);
    const effect=clean(input.effect||'deny',30).toLowerCase();
    if(!['deny','confirm'].includes(effect))throw Object.assign(new Error('Policy effect must be deny or confirm.'),{statusCode:400});
    return (await this.pool.query(`INSERT INTO wisdo_life_policies(policy_id,owner_user_id,home_id,name,effect,match,reason,enabled,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,NOW(),NOW())
      ON CONFLICT(policy_id) DO UPDATE SET name=EXCLUDED.name,effect=EXCLUDED.effect,match=EXCLUDED.match,reason=EXCLUDED.reason,enabled=EXCLUDED.enabled,updated_at=NOW()
      RETURNING *`,[policyId,this.actorDevice(actor).owner_user_id,clean(input.homeId||input.home_id,200)||null,clean(input.name||'House rule',120),effect,JSON.stringify(obj(input.match)),clean(input.reason||'',400),input.enabled!==false])).rows[0];
  }

  async listPolicies(actor,homeId=''){
    const custom=(await this.pool.query(`SELECT * FROM wisdo_life_policies WHERE owner_user_id=$1 AND enabled=true AND ($2='' OR home_id IS NULL OR home_id=$2) ORDER BY created_at`,[this.actorDevice(actor).owner_user_id,clean(homeId,200)])).rows;
    return {defaults:DEFAULT_POLICIES,custom};
  }

  async createMission(actor,input={}){
    const owner=this.actorDevice(actor).owner_user_id;
    const missionId=clean(input.missionId||input.mission_id||crypto.randomUUID(),200);
    const steps=arr(input.steps).slice(0,40).map(validateStep);
    if(!steps.length)throw Object.assign(new Error('Mission requires at least one step.'),{statusCode:400});
    return (await this.pool.query(`INSERT INTO wisdo_ambient_missions(mission_id,owner_user_id,home_id,name,description,steps,allowed_sources,status,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,'active',NOW(),NOW())
      ON CONFLICT(mission_id) DO UPDATE SET home_id=EXCLUDED.home_id,name=EXCLUDED.name,description=EXCLUDED.description,steps=EXCLUDED.steps,allowed_sources=EXCLUDED.allowed_sources,status='active',updated_at=NOW()
      RETURNING *`,[missionId,owner,clean(input.homeId||input.home_id,200)||null,clean(input.name||'WISDO Mission',120),clean(input.description||'',500),JSON.stringify(steps),JSON.stringify(arr(input.allowedSources||input.allowed_sources).length?arr(input.allowedSources||input.allowed_sources):['manual','voice'])])).rows[0];
  }

  async listMissions(actor){
    return (await this.pool.query(`SELECT * FROM wisdo_ambient_missions WHERE owner_user_id=$1 AND status='active' ORDER BY updated_at DESC`,[this.actorDevice(actor).owner_user_id])).rows;
  }

  async mission(actor,missionId){
    const row=(await this.pool.query(`SELECT * FROM wisdo_ambient_missions WHERE mission_id=$1 AND owner_user_id=$2 AND status='active' LIMIT 1`,[clean(missionId,200),this.actorDevice(actor).owner_user_id])).rows[0];
    if(!row)throw Object.assign(new Error('Mission not found.'),{statusCode:404});
    return row;
  }

  async memberRole(actor,context={}){
    if(context.role&&ROLE_CAPS[upper(context.role)])return {role:upper(context.role),permissions:obj(context.permissions)};
    if(context.memberId){
      const row=(await this.pool.query(`SELECT role,permissions FROM wisdo_household_members WHERE member_id=$1 AND owner_user_id=$2 AND status='active' AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1`,[clean(context.memberId,200),this.actorDevice(actor).owner_user_id])).rows[0];
      if(row)return {role:upper(row.role),permissions:obj(row.permissions)};
    }
    return {role:'OWNER',permissions:{}};
  }

  hasPermission(roleInfo,permission,context={}){
    const role=upper(roleInfo.role||'GUEST');
    const base=new Set(ROLE_CAPS[role]||[]);
    const overrides=obj(roleInfo.permissions);
    if(overrides[permission]===true)return true;
    if(overrides[permission]===false)return false;
    if(permission==='trading'&&context.allowTrading===true&&role==='ADULT')return true;
    return base.has(permission);
  }

  async previewStep(actor,step,context={}){
    const normalized=validateStep(step);
    if(normalized.type==='home'){
      try{
        const preview=await this.universalControlService.preview(this.actorDevice(actor),{action:normalized.action,target:obj(normalized.target),parameters:obj(normalized.parameters),riskLevel:normalized.riskLevel??1});
        return {kind:'home',preview,riskLevel:Number(preview.risk_level||0),available:true};
      }catch(error){return {kind:'home',available:false,riskLevel:5,error:error.message,code:error.code||'home_unavailable'};}
    }
    if(normalized.type==='workstation'){
      const target=await this.commandBusService.resolveTarget(this.actorDevice(actor).owner_user_id,obj(normalized.target,{type:'desktop'}));
      const required=clean(normalized.requiredCapability||normalized.intent||normalized.action,120);
      const caps=obj(target?.capabilities);
      const available=Boolean(target)&&(!required||caps[required]===true);
      return {kind:'workstation',available,riskLevel:1,target,requiredCapability:required,error:available?null:(!target?'No enrolled workstation matched.':`Workstation does not advertise ${required}.`)};
    }
    if(normalized.type==='trading'){
      const action=clean(normalized.action).toLowerCase();
      const spec=TRADING_ACTIONS[action];
      const accountId=clean(normalized.accountId||normalized.account_id||context.accountId||'',200);
      return {kind:'trading',available:Boolean(this.tradingExecutionService&&accountId),riskLevel:action==='close_winners'?4:3,accountId,spec,error:this.tradingExecutionService?(!accountId?'Trading mission requires accountId.':null):'Trading mission adapter is unavailable.'};
    }
    return {kind:'mode',available:true,riskLevel:0,mode:clean(normalized.mode||normalized.action,80)};
  }

  async simulateMission(actor,missionOrId,input={}){
    const mission=typeof missionOrId==='string'?await this.mission(actor,missionOrId):missionOrId;
    const context={...obj(input.context),source:clean(input.source||input.context?.source||'manual',30).toLowerCase()};
    const allowedSources=arr(mission.allowed_sources||mission.allowedSources).map((value)=>String(value).toLowerCase());
    const sourceAllowed=!allowedSources.length||allowedSources.includes(context.source);
    const roleInfo=await this.memberRole(actor,context);
    const policies=await this.listPolicies(actor,mission.home_id||mission.homeId||'');
    const allPolicies=[...policies.defaults,...policies.custom.map((row)=>({id:row.policy_id,effect:row.effect,reason:row.reason,match:row.match}))];
    const steps=[];
    let blocked=!sourceAllowed;
    let requiresConfirmation=false;
    for(let index=0;index<arr(mission.steps).length;index++){
      const step=validateStep(mission.steps[index]);
      const detail=await this.previewStep(actor,step,context);
      const permission=permissionFor(step,detail.preview||{});
      const allowedByRole=this.hasPermission(roleInfo,permission,context);
      const policyHits=allPolicies.filter((policy)=>matchPolicy(policy,{source:context.source,step,preview:detail.preview||{risk_level:detail.riskLevel,targets:[]},context}));
      const deny=policyHits.find((policy)=>policy.effect==='deny');
      const confirm=policyHits.some((policy)=>policy.effect==='confirm');
      const stepBlocked=!detail.available||!allowedByRole||Boolean(deny);
      const stepConfirm=!stepBlocked&&(confirm||detail.riskLevel>=4||step.type==='trading');
      if(stepBlocked)blocked=true;
      if(stepConfirm)requiresConfirmation=true;
      steps.push({
        index,type:step.type,action:step.action||step.intent||step.mode,status:stepBlocked?'blocked':stepConfirm?'confirmation_required':'ready',
        permission,role:roleInfo.role,riskLevel:detail.riskLevel,available:detail.available,
        reason:!detail.available?detail.error:!allowedByRole?`${roleInfo.role} does not have ${permission} permission.`:deny?.reason||policyHits.filter((p)=>p.effect==='confirm').map((p)=>p.reason).join(' ')||null,
        detail,step,
      });
    }
    return {missionId:mission.mission_id||mission.missionId||null,name:mission.name||'Mission',source:context.source,role:roleInfo.role,sourceAllowed,blocked,requiresConfirmation,steps,policyVersion:'23.0'};
  }

  async truth(ownerUserId,runId,eventType,detail={}){
    return (await this.pool.query(`INSERT INTO wisdo_mission_truth_events(event_id,run_id,owner_user_id,event_type,detail,created_at)
      VALUES($1,$2,$3,$4,$5::jsonb,NOW()) RETURNING *`,[crypto.randomUUID(),runId,String(ownerUserId),clean(eventType,80),JSON.stringify(obj(detail))])).rows[0];
  }

  async executeMission(actor,missionId,input={}){
    const owner=this.actorDevice(actor).owner_user_id;
    const mission=await this.mission(actor,missionId);
    const simulation=await this.simulateMission(actor,mission,{source:input.source||'manual',context:obj(input.context)});
    const runId=crypto.randomUUID();
    await this.pool.query(`INSERT INTO wisdo_mission_runs(run_id,mission_id,owner_user_id,source,context,status,simulation,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,NOW(),NOW())`,[runId,mission.mission_id,owner,simulation.source,JSON.stringify(obj(input.context)),simulation.blocked?'blocked':simulation.requiresConfirmation&&!input.confirmationVerified?'awaiting_confirmation':'executing',JSON.stringify(simulation)]);
    await this.truth(owner,runId,'simulation.completed',{blocked:simulation.blocked,requiresConfirmation:simulation.requiresConfirmation,steps:simulation.steps.map((s)=>({index:s.index,status:s.status,reason:s.reason}))});
    if(simulation.blocked){
      await this.truth(owner,runId,'run.blocked',{reason:'Mission simulation contained blocked steps.'});
      return {runId,status:'blocked',simulation,results:[]};
    }
    if(simulation.requiresConfirmation&&input.confirmationVerified!==true){
      await this.truth(owner,runId,'run.awaiting_confirmation',{reason:'One or more steps require explicit confirmation.'});
      return {runId,status:'awaiting_confirmation',simulation,results:[]};
    }
    const results=[];
    for(const item of simulation.steps){
      try{
        let result;
        if(item.type==='home'){
          const executions=await this.universalControlService.execute(this.actorDevice(actor),{action:item.step.action,target:obj(item.step.target),parameters:obj(item.step.parameters),riskLevel:item.riskLevel,confirmationVerified:true});
          result={state:'queued',executionIds:executions.filter((x)=>x.status==='queued').map((x)=>x.execution_id)};
        }else if(item.type==='workstation'){
          const command=await this.commandBusService.issueSystemCommand(owner,{intent:item.step.intent||item.step.action,source:`mission:${runId}`,target:obj(item.step.target,{type:'desktop'}),requiredCapability:item.step.requiredCapability||item.step.intent||item.step.action,parameters:{...obj(item.step.parameters),missionRunId:runId},expiresInSeconds:item.step.expiresInSeconds||120,priority:item.step.priority||80});
          result={state:'queued',commandId:command.command_id};
        }else if(item.type==='trading'){
          const spec=item.detail.spec;
          const command=await this.tradingExecutionService.queue({userId:owner,deviceId:this.actorDevice(actor).device_id,accountId:item.detail.accountId,intent:spec.intent,commandName:spec.commandName,parameters:{...spec.parameters,...obj(item.step.parameters),idempotencyKey:`mission:${runId}:${item.index}`},rawText:`WISDO Ambient Mission: ${mission.name}`,safetyLevel:item.riskLevel>=4?'DANGEROUS':'CONTROLLED',planId:runId,confirmationStatus:'CONFIRMED'});
          result={state:'queued',commandId:command.id||command.command_id};
        }else{
          const mode=item.detail.mode;
          const row=(await this.pool.query(`INSERT INTO wisdo_life_context(owner_user_id,home_id,current_mode,context,updated_at)
            VALUES($1,$2,$3,$4::jsonb,NOW()) ON CONFLICT(owner_user_id,home_id) DO UPDATE SET current_mode=EXCLUDED.current_mode,context=EXCLUDED.context,updated_at=NOW() RETURNING *`,[owner,mission.home_id||null,mode,JSON.stringify({source:`mission:${runId}`})])).rows[0];
          result={state:'completed',mode:row.current_mode};
        }
        results.push({index:item.index,type:item.type,...result});
        await this.truth(owner,runId,`step.${result.state}`,{index:item.index,type:item.type,action:item.action,...result});
      }catch(error){
        results.push({index:item.index,type:item.type,state:'failed',error:error.message,code:error.code||null});
        await this.truth(owner,runId,'step.failed',{index:item.index,type:item.type,action:item.action,error:error.message,code:error.code||null});
        if(item.step.continueOnFailure!==true)break;
      }
    }
    const failed=results.some((r)=>r.state==='failed');
    const queued=results.some((r)=>r.state==='queued');
    const status=failed?'failed':queued?'queued':'completed';
    await this.pool.query(`UPDATE wisdo_mission_runs SET status=$1,result=$2::jsonb,updated_at=NOW(),completed_at=CASE WHEN $1='completed' THEN NOW() ELSE completed_at END WHERE run_id=$3 AND owner_user_id=$4`,[status,JSON.stringify(results),runId,owner]);
    await this.truth(owner,runId,`run.${status}`,{results});
    return {runId,status,simulation,results};
  }

  async runTruth(actor,runId){
    const owner=this.actorDevice(actor).owner_user_id;
    const [run,events]=await Promise.all([
      this.pool.query(`SELECT * FROM wisdo_mission_runs WHERE run_id=$1 AND owner_user_id=$2 LIMIT 1`,[clean(runId,200),owner]),
      this.pool.query(`SELECT * FROM wisdo_mission_truth_events WHERE run_id=$1 AND owner_user_id=$2 ORDER BY created_at,event_id`,[clean(runId,200),owner]),
    ]);
    if(!run.rows[0])throw Object.assign(new Error('Mission run not found.'),{statusCode:404});
    return {run:run.rows[0],events:events.rows};
  }

  async compileLocalManifest(actor,missionId){
    const mission=await this.mission(actor,missionId);
    const simulation=await this.simulateMission(actor,mission,{source:'manual',context:{role:'OWNER'}});
    const eligible=!simulation.blocked&&!simulation.requiresConfirmation&&simulation.steps.every((item)=>item.type==='home'||item.type==='mode')&&simulation.steps.every((item)=>item.riskLevel<=2);
    const manifest={version:'23.0',missionId:mission.mission_id,name:mission.name,homeId:mission.home_id,eligible,steps:eligible?simulation.steps.map((item)=>({type:item.type,action:item.step.action||item.step.mode,target:item.step.target||null,parameters:item.step.parameters||{},riskLevel:item.riskLevel})):[],generatedAt:new Date().toISOString()};
    const canonical=JSON.stringify(manifest);
    const hash=crypto.createHash('sha256').update(canonical).digest('hex');
    const secret=clean(process.env.WISDO_LOCAL_ROUTINE_SIGNING_SECRET,1000);
    const signature=secret?crypto.createHmac('sha256',secret).update(canonical).digest('hex'):null;
    const row=(await this.pool.query(`INSERT INTO wisdo_local_routine_manifests(manifest_id,owner_user_id,mission_id,home_id,manifest,manifest_hash,signature,status,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,NOW(),NOW()) RETURNING *`,[crypto.randomUUID(),this.actorDevice(actor).owner_user_id,mission.mission_id,mission.home_id||null,canonical,hash,signature,eligible&&signature?'signed':'not_deployable'])).rows[0];
    return {eligible,signatureReady:Boolean(signature),manifestHash:hash,record:row};
  }

  async dashboard(actor){
    const owner=this.actorDevice(actor).owner_user_id;
    const [missions,zones,household,policies,runs,truth]=await Promise.all([
      this.listMissions(actor),this.listZones(actor),this.listHousehold(actor),this.listPolicies(actor),
      this.pool.query(`SELECT * FROM wisdo_mission_runs WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT 20`,[owner]),
      this.pool.query(`SELECT * FROM wisdo_mission_truth_events WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT 40`,[owner]),
    ]);
    return {version:'23.0',missions,zones,household,policies,runs:runs.rows,truth:truth.rows,capabilities:{missionSimulation:true,crossDomainExecution:true,truthLedger:true,householdRoles:true,roomZones:true,localManifestCompiler:true,offlineEdgeRunner:false}};
  }
}

export {DEFAULT_POLICIES,ROLE_CAPS,TRADING_ACTIONS};
