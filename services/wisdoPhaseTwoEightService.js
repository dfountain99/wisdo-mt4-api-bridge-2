import crypto from 'node:crypto';

const clean=(v,n=1000)=>String(v??'').trim().slice(0,n);
const json=(v,f={})=>(v&&typeof v==='object'&&!Array.isArray(v)?v:f);
const list=v=>Array.isArray(v)?v:[];
const now=()=>new Date().toISOString();

function classifyRisk(intent=''){
  const s=intent.toLowerCase();
  if(/close all|liquidate|maximum risk|withdraw|delete|emergency/.test(s)) return 5;
  if(/close|modify stop|trail|risk|lot|profit target|pause (all|every)/.test(s)) return 4;
  if(/pause|resume|behavior|mode|target/.test(s)) return 3;
  if(/open|show|switch|filter|navigate/.test(s)) return 1;
  return 0;
}
function parseIntent(text=''){
  const raw=clean(text,2000); const low=raw.toLowerCase();
  let action='status';
  if(/close all|close every/.test(low)) action='close_all';
  else if(/close (the )?profitable|take profit/.test(low)) action='close_profitable';
  else if(/pause/.test(low)) action='pause_entries';
  else if(/resume/.test(low)) action='resume_entries';
  else if(/trail/.test(low)) action='modify_stop';
  else if(/open|show|pull up|navigate/.test(low)) action='website.navigate';
  const symbol=(raw.match(/\b[A-Z]{3,12}(?:[._-][A-Z0-9]+)?\b/)||[])[0]||'';
  const percent=Number((low.match(/(\d+(?:\.\d+)?)\s*%/)||[])[1]||0);
  const money=Number((low.match(/\$\s*(\d+(?:\.\d+)?)/)||[])[1]||0);
  const bot=(raw.match(/\b(deadshot|hightower|aegis|wisdo)\b/i)||[])[1]||'';
  return {raw,action,symbol:symbol.toUpperCase(),bot_family:bot,parameters:{percent:percent||undefined,money:money||undefined},risk_level:classifyRisk(raw)};
}

export class WisdoPhaseTwoEightService{
  constructor({pool,logger=console}={}){this.pool=pool;this.logger=logger;}
  async event(owner,eventType,payload={},correlationId=null,severity='info',sourceType='kernel',sourceId=null){
    const id=crypto.randomUUID(); await this.pool.query(`INSERT INTO wisdo_event_ledger(event_id,owner_user_id,source_type,source_id,event_type,severity,payload,correlation_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,NOW())`,[id,owner,sourceType,sourceId,eventType,severity,JSON.stringify(payload),correlationId]); return id;
  }
  async digitalTwin(owner){
    const q=async(sql,args=[owner])=>(await this.pool.query(sql,args)).rows;
    const [devices,bots,components,accounts,lanes,promises,voices,executions,browser]=await Promise.all([
      q(`SELECT device_id,device_name,device_type,status,last_seen_at,capabilities FROM wisdo_devices WHERE owner_user_id=$1 ORDER BY last_seen_at DESC`),
      q(`SELECT bot_id,bot_name,account_id,terminal_name,status,last_seen_at,capabilities FROM wisdo_bots WHERE owner_user_id=$1 ORDER BY last_seen_at DESC`),
      q(`SELECT component_id,component_type,name,status,last_seen_at,capabilities,state,metadata FROM wisdo_components WHERE owner_user_id=$1 ORDER BY last_seen_at DESC`),
      q(`SELECT account_id,broker,account_number,balance,equity,margin,free_margin,floating_profit,status,last_seen_at FROM wisdo_mt4_accounts WHERE owner_user_id=$1 ORDER BY last_seen_at DESC`).catch(()=>[]),
      q(`SELECT * FROM wisdo_culture_lanes WHERE owner_user_id=$1 ORDER BY updated_at DESC`).catch(()=>[]),
      q(`SELECT promise_id,name,state,condition_definition,action_definition,expires_at,updated_at FROM wisdo_promises WHERE owner_user_id=$1 AND state IN ('armed','active') ORDER BY updated_at DESC`).catch(()=>[]),
      q(`SELECT a.*,v.name,v.vocal_character,v.delivery FROM wisdo_voice_assignments a JOIN wisdo_voice_genomes v ON v.voice_id=a.voice_id WHERE a.owner_user_id=$1 AND a.status='active' ORDER BY a.priority DESC,a.updated_at DESC`).catch(()=>[]),
      q(`SELECT execution_id,component_id,action,status,result,error,created_at,completed_at FROM wisdo_control_executions WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT 50`),
      q(`SELECT event_id,action,status,created_at,delivered_at,acknowledged_at FROM wisdo_browser_events WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT 50`)
    ]);
    return {generated_at:now(),devices,bots,components,accounts,lanes,promises,voices,executions,browser,health:{devices_online:devices.filter(x=>x.status==='active'||x.status==='online').length,bots_online:bots.filter(x=>x.status==='online').length,components_online:components.filter(x=>x.status==='online').length}};
  }
  async remember(owner,input={}){const id=crypto.randomUUID();const row=(await this.pool.query(`INSERT INTO wisdo_kernel_memory(memory_id,owner_user_id,memory_type,content,importance,confidence,source,metadata,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,NOW(),NOW()) RETURNING *`,[id,owner,clean(input.memory_type||input.type||'observation',60),clean(input.content||input.text,4000),Math.max(0,Math.min(100,Number(input.importance||50))),Math.max(0,Math.min(100,Number(input.confidence||80))),clean(input.source||'user',60),JSON.stringify(json(input.metadata))])).rows[0];await this.event(owner,'memory.created',{memory_id:id,type:row.memory_type},null,'info','memory',id);return row;}
  async memories(owner,limit=100){return (await this.pool.query(`SELECT * FROM wisdo_kernel_memory WHERE owner_user_id=$1 ORDER BY importance DESC,updated_at DESC LIMIT $2`,[owner,Math.max(1,Math.min(500,Number(limit||100)))])).rows;}
  async saveWorkspace(owner,input={}){const id=clean(input.workspace_id||crypto.randomUUID(),200);return (await this.pool.query(`INSERT INTO wisdo_live_workspaces(workspace_id,owner_user_id,name,mode,layout,filters,active_context,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,'active',NOW(),NOW()) ON CONFLICT(workspace_id) DO UPDATE SET name=EXCLUDED.name,mode=EXCLUDED.mode,layout=EXCLUDED.layout,filters=EXCLUDED.filters,active_context=EXCLUDED.active_context,updated_at=NOW() RETURNING *`,[id,owner,clean(input.name||'Wisdo Workspace',200),clean(input.mode||'adaptive',60),JSON.stringify(json(input.layout)),JSON.stringify(json(input.filters)),JSON.stringify(json(input.active_context||input.context))])).rows[0];}
  async explain(owner,correlationId){const [intent,steps,events]=(await Promise.all([
    this.pool.query(`SELECT * FROM wisdo_intent_requests WHERE owner_user_id=$1 AND correlation_id=$2`,[owner,correlationId]),
    this.pool.query(`SELECT * FROM wisdo_action_plans WHERE owner_user_id=$1 AND correlation_id=$2 ORDER BY created_at`,[owner,correlationId]),
    this.pool.query(`SELECT * FROM wisdo_event_ledger WHERE owner_user_id=$1 AND correlation_id=$2 ORDER BY created_at`,[owner,correlationId])
  ])).map(x=>x.rows); return {correlation_id:correlationId,intent:intent[0]||null,plans:steps,events};}
  async processIntent(device,input={}){
    const owner=device.owner_user_id; const parsed=parseIntent(input.text||input.intent||''); if(!parsed.raw){const e=new Error('intent text is required.');e.statusCode=400;throw e;}
    const correlationId=crypto.randomUUID(),requestId=crypto.randomUUID();
    const selector=json(input.target,{type:parsed.bot_family?'bot':'',name:parsed.bot_family,symbol:parsed.symbol});
    const components=(await this.pool.query(`SELECT * FROM wisdo_components WHERE owner_user_id=$1 AND status='online' AND ($2='' OR component_type=$2 OR lower(name)=lower($2) OR aliases ? lower($2)) AND ($3='' OR upper(metadata->>'canonical_symbol')=$3 OR upper(metadata->>'broker_symbol')=$3) ORDER BY last_seen_at DESC LIMIT 250`,[owner,clean(selector.type||selector.name||'',60),clean(selector.symbol||'',100).toUpperCase()])).rows;
    const supported=components.filter(c=>{const caps=json(c.capabilities);return list(caps.actions).includes(parsed.action)||caps[parsed.action]===true;});
    const requiresApproval=parsed.risk_level>=3 && !input.approved;
    await this.pool.query(`INSERT INTO wisdo_intent_requests(request_id,owner_user_id,issued_by_device_id,correlation_id,utterance,parsed_intent,context,risk_level,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,NOW(),NOW())`,[requestId,owner,device.device_id,correlationId,parsed.raw,JSON.stringify(parsed),JSON.stringify(json(input.context)),parsed.risk_level,requiresApproval?'awaiting_approval':'planned']);
    const planId=crypto.randomUUID(); const plan={action:parsed.action,selector,matched:components.map(c=>c.component_id),supported:supported.map(c=>c.component_id),parameters:{...parsed.parameters,...json(input.parameters)}};
    await this.pool.query(`INSERT INTO wisdo_action_plans(plan_id,owner_user_id,request_id,correlation_id,plan_definition,safety_checks,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,NOW(),NOW())`,[planId,owner,requestId,correlationId,JSON.stringify(plan),JSON.stringify({ownership:true,capability_match:supported.length>0,requires_approval:requiresApproval,risk_level:parsed.risk_level}),requiresApproval?'awaiting_approval':supported.length?'ready':'blocked']);
    const executions=[];
    if(!requiresApproval && input.execute!==false){
      for(const c of supported){const id=crypto.randomUUID();const row=(await this.pool.query(`INSERT INTO wisdo_control_executions(execution_id,owner_user_id,issued_by_device_id,component_id,action,parameters,risk_level,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,'queued',NOW(),NOW()) RETURNING *`,[id,owner,device.device_id,c.component_id,parsed.action,JSON.stringify({...parsed.parameters,...json(input.parameters),correlation_id:correlationId}),parsed.risk_level])).rows[0];executions.push(row);}
      if(parsed.action==='website.navigate'){const ev=crypto.randomUUID();await this.pool.query(`INSERT INTO wisdo_browser_events(event_id,owner_user_id,issued_by_device_id,target_session_id,action,payload,status,expires_at,created_at) VALUES($1,$2,$3,$4,'workspace.intent',$5::jsonb,'pending',NOW()+INTERVAL '5 minutes',NOW())`,[ev,owner,device.device_id,clean(input.session_id||'',200)||null,JSON.stringify({utterance:parsed.raw,parsed,correlation_id:correlationId})]);}
      await this.pool.query(`UPDATE wisdo_action_plans SET status=$1,updated_at=NOW() WHERE plan_id=$2`,[executions.length?'dispatched':'blocked',planId]);
    }
    await this.event(owner,'intent.processed',{request_id:requestId,plan_id:planId,parsed,matched:components.length,supported:supported.length,requires_approval:requiresApproval},correlationId,requiresApproval?'warn':'info','intent',requestId);
    return {ok:true,request_id:requestId,plan_id:planId,correlation_id:correlationId,parsed,matched_components:components.length,supported_components:supported.length,requires_approval:requiresApproval,status:requiresApproval?'awaiting_approval':executions.length?'dispatched':'blocked',executions,explanation_url:`/api/kernel/v1/explanations/${correlationId}`};
  }
  async compileBehavior(device,input={}){
    const owner=device.owner_user_id,text=clean(input.text||input.description,4000);if(!text){const e=new Error('behavior description is required.');e.statusCode=400;throw e;}
    const parsed=parseIntent(text),id=crypto.randomUUID(),versionId=crypto.randomUUID(); const status=parsed.risk_level>=3&&!input.approved?'draft':'active';
    const definition={purpose:text,trigger:json(input.trigger,{type:'event_or_metric'}),scope:json(input.scope,{symbol:parsed.symbol||undefined,bot_family:parsed.bot_family||undefined}),actions:list(input.actions).length?input.actions:[{type:parsed.action,parameters:{...parsed.parameters,...json(input.parameters)}}],exceptions:list(input.exceptions),rollback:{type:'restore_inherited_policy'},risk_level:parsed.risk_level,created_from:'natural_language'};
    await this.pool.query(`INSERT INTO wisdo_behaviors(behavior_id,owner_user_id,name,purpose,scope,definition,status,risk_level,current_version,created_at,updated_at) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,1,NOW(),NOW()) RETURNING *`,[id,owner,clean(input.name||text.slice(0,80),200),text,JSON.stringify(definition.scope),JSON.stringify(definition),status,parsed.risk_level]);
    await this.pool.query(`INSERT INTO wisdo_behavior_versions(version_id,behavior_id,version,definition,change_summary,created_by,created_at) VALUES($1,$2,1,$3::jsonb,$4,$5,NOW())`,[versionId,id,JSON.stringify(definition),'Created by Phase 2–8 behavior compiler',device.device_id]);
    await this.event(owner,'behavior.compiled',{behavior_id:id,status,risk_level:parsed.risk_level},null,status==='draft'?'warn':'info','behavior',id); return {behavior_id:id,status,definition,requires_approval:status==='draft'};
  }
  async health(){const [mem,intents,plans,workspaces]=await Promise.all([this.pool.query(`SELECT count(*)::int count FROM wisdo_kernel_memory`),this.pool.query(`SELECT count(*)::int count FROM wisdo_intent_requests WHERE created_at>NOW()-INTERVAL '24 hours'`),this.pool.query(`SELECT count(*)::int count FROM wisdo_action_plans WHERE status IN ('ready','dispatched','awaiting_approval')`),this.pool.query(`SELECT count(*)::int count FROM wisdo_live_workspaces WHERE status='active'`)]);return {ok:true,service:'wisdo-phase-2-8-kernel',version:'3.1.0',memory_records:mem.rows[0].count,intents_24h:intents.rows[0].count,active_plans:plans.rows[0].count,active_workspaces:workspaces.rows[0].count};}
}
