import crypto from 'node:crypto';

const clean=(v,n=2000)=>String(v??'').trim().slice(0,n);
const obj=(v,f={})=>(v&&typeof v==='object'&&!Array.isArray(v)?v:f);
const list=v=>Array.isArray(v)?v:[];
const num=(v,f=null)=>Number.isFinite(Number(v))?Number(v):f;

const HIGH_RISK=new Set(['close_all','close_losing','market_order','change_risk','set_max_lot','set_max_trades']);
const MEDIUM_RISK=new Set(['close_profitable','pause_entries','resume_entries','trail_stop','move_break_even','set_profit_target','buy_only','sell_only','both_directions','set_bot_mode','apply_behavior','undo_behavior']);

function riskFor(action){return HIGH_RISK.has(action)?5:MEDIUM_RISK.has(action)?3:1;}
function findNumber(text,patterns){for(const p of patterns){const m=text.match(p);if(m)return Number(m[1]);}return null;}
function durationFrom(text){
  const m=text.match(/(?:for|until the next)\s+(\d+(?:\.\d+)?)\s*(minute|minutes|hour|hours|day|days)/i);
  if(!m)return null; const unit=m[2].toLowerCase(); const mult=unit.startsWith('minute')?60:unit.startsWith('hour')?3600:86400;
  return Math.round(Number(m[1])*mult);
}
function parseSymbols(raw){
  const upper=raw.toUpperCase();
  const candidates=[...upper.matchAll(/\b[A-Z]{3,12}(?:[._-][A-Z0-9]{1,8})?\b/g)].map(m=>m[0]);
  const stop=new Set(['COACH','WISDO','DEADSHOT','HIGHTOWER','AEGIS','BOT','ALL','ONLY','WHEN','THEN','MAKE','TRAIL','STOP','PROFIT','CLOSE','PAUSE','RESUME','BUY','SELL','MODE','RISK','MAX','LOT','TRADES','ACCOUNT','CHART','PERCENT','PERCENTAGE','PIPS','PIP','POINTS','POINT','FOR','HOUR','HOURS','MINUTE','MINUTES','DAY','DAYS','TAKE','AT','UP','BY','THE','MY','ON','TO','FROM','WITH','IN','AFTER','BEFORE']);
  return [...new Set(candidates.filter(x=>!stop.has(x)))].slice(0,20);
}
function parseBot(raw){const m=raw.match(/\b(deadshot|hightower|aegis|phoenix|copier|reporter|wisdo)\b/i);return m?m[1].toLowerCase():'';}
function parseAccount(raw){const m=raw.match(/(?:account|login)\s*(?:number\s*)?(\d{4,20})/i);return m?m[1]:'';}
function parseAction(raw){
  const s=raw.toLowerCase();
  if(/undo|revert|go back|restore (?:the )?(?:last|previous)/.test(s))return 'undo_behavior';
  if(/close (?:all|every)|flatten|liquidate/.test(s))return 'close_all';
  if(/close .*profit|take (?:the )?winners|secure .*profit|collect .*profit/.test(s))return 'close_profitable';
  if(/close .*los|cut .*los/.test(s))return 'close_losing';
  if(/break\s*even|breakeven/.test(s))return 'move_break_even';
  if(/trail/.test(s))return 'trail_stop';
  if(/profit target|take profit|profit take|close .* at \$/.test(s))return 'set_profit_target';
  if(/pause|freeze|stop (?:new )?(?:entries|trading)/.test(s))return 'pause_entries';
  if(/resume|unpause|start (?:new )?(?:entries|trading)/.test(s))return 'resume_entries';
  if(/buy only|only buy/.test(s))return 'buy_only';
  if(/sell only|only sell/.test(s))return 'sell_only';
  if(/both directions|buy and sell/.test(s))return 'both_directions';
  if(/max(?:imum)?\s+lot/.test(s))return 'set_max_lot';
  if(/max(?:imum)?\s+(?:open\s+)?trades/.test(s))return 'set_max_trades';
  if(/risk/.test(s)&&/%|percent/.test(s))return 'change_risk';
  if(/aggressive|conservative|protect mode|recovery mode|scalp mode|swing mode|super trader/.test(s))return 'set_bot_mode';
  if(/status|how .* doing|what .* doing/.test(s))return 'bot_status';
  return 'apply_behavior';
}
function parseParameters(raw,action){
  const s=raw.toLowerCase();
  const percent=findNumber(s,[/(?:up|profit|gain|reaches?|hits?)\s*(\d+(?:\.\d+)?)\s*(?:%|percent|percentage)/,/(\d+(?:\.\d+)?)\s*(?:%|percent|percentage)/]);
  const money=findNumber(s,[/\$\s*(\d+(?:\.\d+)?)/,/(\d+(?:\.\d+)?)\s*(?:dollars?|bucks?)/]);
  const pips=findNumber(s,[/(\d+(?:\.\d+)?)\s*pips?/]);
  const points=findNumber(s,[/(\d+(?:\.\d+)?)\s*points?/]);
  const lots=findNumber(s,[/(?:max(?:imum)?\s+lot|lot(?:s| size)?)\s*(?:of|to|at|=)?\s*(\d+(?:\.\d+)?)/]);
  const trades=findNumber(s,[/(?:max(?:imum)?\s+(?:open\s+)?trades?)\s*(?:of|to|at|=)?\s*(\d+)/]);
  const trailDistancePercent=findNumber(s,[/trail(?:ing)?(?: it| stop)?(?: by)?\s*(\d+(?:\.\d+)?)\s*%/]);
  const mode=(s.match(/\b(aggressive|conservative|protect|recovery|scalp|swing|super trader)\s*mode\b/)||[])[1]||'';
  return {
    start_profit_percent: action==='trail_stop'?percent:null,
    target_money: action==='set_profit_target'?money:null,
    trigger_money: action==='move_break_even'?money:null,
    trigger_pips: action==='move_break_even'?pips:null,
    trail_distance_percent: trailDistancePercent,
    trail_distance_pips: action==='trail_stop'?pips:null,
    trail_distance_points: action==='trail_stop'?points:null,
    risk_percent: action==='change_risk'?percent:null,
    max_lot: action==='set_max_lot'?lots:null,
    max_trades: action==='set_max_trades'?trades:null,
    mode,
    expires_in_seconds: durationFrom(raw),
  };
}
function actionIntent(action){
  return ({change_risk:'set_risk_percent',set_max_lot:'set_max_lot',set_max_trades:'set_max_trades'})[action]||action;
}

export class WisdoVoiceBotAuthorityService{
  constructor({pool,commandBusService,logger=console}={}){this.pool=pool;this.commandBusService=commandBusService;this.logger=logger;}
  analyze(text=''){
    const raw=clean(text,4000); const action=parseAction(raw); const symbols=parseSymbols(raw); const bot_family=parseBot(raw); const account_id=parseAccount(raw);
    const parameters=parseParameters(raw,action); const risk_level=riskFor(action);
    const scope={bot_family,account_id,symbols,all_bots:/\b(?:all|every)\s+(?:my\s+)?bots?\b/i.test(raw),current_context:/\b(?:that one|this one|current|selected)\b/i.test(raw)};
    return {raw,action,intent:actionIntent(action),scope,parameters,risk_level,requires_confirmation:risk_level>=5,temporary:Boolean(parameters.expires_in_seconds)};
  }
  async context(owner){
    const r=await this.pool.query(`SELECT context FROM wisdo_voice_control_context WHERE owner_user_id=$1 LIMIT 1`,[owner]).catch(()=>({rows:[]}));
    return obj(r.rows[0]?.context);
  }
  async saveContext(owner,context){
    await this.pool.query(`INSERT INTO wisdo_voice_control_context(owner_user_id,context,updated_at) VALUES($1,$2::jsonb,NOW()) ON CONFLICT(owner_user_id) DO UPDATE SET context=EXCLUDED.context,updated_at=NOW()`,[owner,JSON.stringify(context)]);
  }
  async resolveTargets(device,analysis,input={}){
    const owner=device.owner_user_id; const ctx=await this.context(owner); const explicit=obj(input.target);
    const bot=clean(explicit.bot_family||explicit.botFamily||explicit.alias||analysis.scope.bot_family||ctx.bot_family||'',100).toLowerCase();
    const account=clean(explicit.account_id||explicit.accountId||analysis.scope.account_id||ctx.account_id||'',200);
    const symbols=list(explicit.symbols).length?explicit.symbols:analysis.scope.symbols.length?analysis.scope.symbols:list(ctx.symbols);
    const symbol=symbols[0]?String(symbols[0]).toUpperCase():'';
    let rows=(await this.pool.query(`SELECT bot_id,bot_name,account_id,desktop_device_id,capabilities,metadata,status,last_seen_at
      FROM wisdo_bots WHERE owner_user_id=$1 AND status='online'
      AND ($2='' OR lower(bot_name)=lower($2) OR lower(bot_id)=lower($2) OR aliases ? lower($2))
      AND ($3='' OR account_id=$3)
      ORDER BY last_seen_at DESC LIMIT 250`,[owner,bot,account])).rows;
    // A desktop/terminal adapter may represent several chart EAs. If a named family
    // is not separately registered, route to the account terminal and preserve the
    // family/symbol scope in the behavior payload for Reporter-side enforcement.
    if(!rows.length && bot){
      rows=(await this.pool.query(`SELECT bot_id,bot_name,account_id,desktop_device_id,capabilities,metadata,status,last_seen_at
        FROM wisdo_bots WHERE owner_user_id=$1 AND status='online' AND ($2='' OR account_id=$2)
        ORDER BY last_seen_at DESC LIMIT 250`,[owner,account])).rows;
    }
    const targets=analysis.scope.all_bots?rows:rows.slice(0,Math.max(1,Number(input.max_targets||50)));
    if(targets.length)await this.saveContext(owner,{bot_family:bot||targets[0].bot_name,account_id:account||targets[0].account_id,symbols:symbol?[symbol]:[],target_ids:targets.map(x=>x.bot_id),updated_at:new Date().toISOString()});
    return targets;
  }
  async createBehavior(device,analysis,targets,status='active'){
    const id=crypto.randomUUID(); const definition={source_text:analysis.raw,action:analysis.action,intent:analysis.intent,scope:analysis.scope,parameters:analysis.parameters,target_bot_ids:targets.map(x=>x.bot_id),rollback:{type:'restore_previous_overlay'},safety:{risk_level:analysis.risk_level,confirmation_required:analysis.requires_confirmation}};
    const expiresAt=analysis.parameters.expires_in_seconds?new Date(Date.now()+analysis.parameters.expires_in_seconds*1000):null;
    await this.pool.query(`INSERT INTO wisdo_voice_behaviors(behavior_id,owner_user_id,created_by_device_id,name,definition,status,version,expires_at,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5::jsonb,$6,1,$7,NOW(),NOW())`,[id,device.owner_user_id,device.device_id,clean(analysis.raw,160),JSON.stringify(definition),status,expiresAt]);
    return {behavior_id:id,definition,status,expires_at:expiresAt};
  }
  async dispatch(device,analysis,targets,behavior){
    const commands=[];
    for(const target of targets){
      const command=await this.commandBusService.issueCommand(device,{intent:analysis.intent,target:{type:'bot',id:target.bot_id},parameters:{...analysis.parameters,behavior_id:behavior?.behavior_id||null,scope:analysis.scope,symbol:(analysis.scope.symbols||[])[0]||'',bot_family:analysis.scope.bot_family||'',compiled_action:analysis.action,spoken_text:analysis.raw},spokenText:analysis.raw,source:'voice_authority',priority:analysis.risk_level>=5?95:70,expiresInSeconds:Math.max(120,analysis.parameters.expires_in_seconds||120)});
      commands.push(command);
    }
    if(behavior)await this.pool.query(`UPDATE wisdo_voice_behaviors SET status='deployed',deployment=$2::jsonb,updated_at=NOW() WHERE behavior_id=$1`,[behavior.behavior_id,JSON.stringify({command_ids:commands.map(x=>x.command_id),target_ids:targets.map(x=>x.bot_id)})]);
    return commands;
  }
  async request(device,input={}){
    const analysis=this.analyze(input.text||input.utterance||input.intent||''); if(!analysis.raw){const e=new Error('spoken instruction is required.');e.statusCode=400;throw e;}
    if(/^(confirm|yes confirm|do it|execute it)$/i.test(analysis.raw)&&input.session_id)return this.confirm(device,input.session_id);
    if(/^(cancel|never mind|do not do it)$/i.test(analysis.raw)&&input.session_id)return this.cancel(device,input.session_id);
    if(analysis.action==='apply_behavior' && !Array.isArray(input.actions)){
      return {ok:false,status:'blocked',code:'missing_behavior_primitive',reply:'I understood the outcome, but no connected adapter exposes the primitive needed to construct it safely.',analysis,missing_capability:'behavior_primitive'};
    }
    const targets=await this.resolveTargets(device,analysis,input);
    if(!targets.length){return {ok:false,status:'blocked',code:'no_matching_bot',reply:'I could not find an online bot matching that account, symbol, or bot name.',analysis,missing_capability:'bot_registration'};}
    const capabilityGaps=targets.filter(t=>{const c=obj(t.capabilities);const a=list(c.actions);return a.length&&!a.includes(analysis.intent)&&c[analysis.intent]!==true&&!a.includes('apply_behavior');}).map(t=>t.bot_id);
    if(capabilityGaps.length===targets.length){return {ok:false,status:'blocked',code:'unsupported_capability',reply:`The selected bot${targets.length>1?'s':''} did not advertise ${analysis.intent}.`,analysis,target_ids:targets.map(x=>x.bot_id),missing_capability:analysis.intent};}
    if(analysis.requires_confirmation&&!input.confirmed){
      const sessionId=crypto.randomUUID(); const expires=new Date(Date.now()+60000);
      await this.pool.query(`INSERT INTO wisdo_voice_control_sessions(session_id,owner_user_id,device_id,utterance,analysis,target_ids,status,expires_at,created_at,updated_at) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,'awaiting_confirmation',$7,NOW(),NOW())`,[sessionId,device.owner_user_id,device.device_id,analysis.raw,JSON.stringify(analysis),JSON.stringify(targets.map(x=>x.bot_id)),expires]);
      return {ok:true,status:'awaiting_confirmation',session_id:sessionId,expires_at:expires,analysis,target_ids:targets.map(x=>x.bot_id),reply:`I am ready to ${analysis.action.replaceAll('_',' ')} on ${targets.length} bot${targets.length===1?'':'s'}. Say confirm within sixty seconds.`};
    }
    const behavior=await this.createBehavior(device,analysis,targets,'active'); const commands=await this.dispatch(device,analysis,targets,behavior);
    return {ok:true,status:'dispatched',analysis,behavior,commands,command_ids:commands.map(x=>x.command_id),reply:`I sent ${analysis.action.replaceAll('_',' ')} to ${commands.length} bot${commands.length===1?'':'s'}. I will confirm when execution completes.`};
  }
  async confirm(device,sessionId){
    const row=(await this.pool.query(`SELECT * FROM wisdo_voice_control_sessions WHERE session_id=$1 AND owner_user_id=$2 AND status='awaiting_confirmation' AND expires_at>NOW() FOR UPDATE`,[clean(sessionId,200),device.owner_user_id])).rows[0];
    if(!row){const e=new Error('The confirmation expired or was not found.');e.statusCode=404;throw e;}
    const analysis=obj(row.analysis); const ids=list(row.target_ids);
    const targets=(await this.pool.query(`SELECT * FROM wisdo_bots WHERE owner_user_id=$1 AND bot_id=ANY($2::text[]) AND status='online'`,[device.owner_user_id,ids])).rows;
    if(!targets.length){const e=new Error('The target bots are no longer online.');e.statusCode=409;throw e;}
    const behavior=await this.createBehavior(device,analysis,targets,'active'); const commands=await this.dispatch(device,analysis,targets,behavior);
    await this.pool.query(`UPDATE wisdo_voice_control_sessions SET status='confirmed',confirmed_at=NOW(),updated_at=NOW() WHERE session_id=$1`,[row.session_id]);
    return {ok:true,status:'dispatched',session_id:row.session_id,analysis,behavior,commands,command_ids:commands.map(x=>x.command_id),reply:`Confirmed. I sent ${analysis.action.replaceAll('_',' ')} to ${commands.length} bot${commands.length===1?'':'s'}.`};
  }
  async cancel(device,sessionId){await this.pool.query(`UPDATE wisdo_voice_control_sessions SET status='canceled',updated_at=NOW() WHERE session_id=$1 AND owner_user_id=$2`,[clean(sessionId,200),device.owner_user_id]);return {ok:true,status:'canceled',reply:'Canceled. No bot changes were sent.'};}
  async history(device,limit=50){return (await this.pool.query(`SELECT behavior_id,name,definition,status,version,deployment,expires_at,created_at,updated_at FROM wisdo_voice_behaviors WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT $2`,[device.owner_user_id,Math.max(1,Math.min(200,num(limit,50)))])).rows;}
  async health(){const r=await this.pool.query(`SELECT count(*)::int total,count(*) FILTER(WHERE status='deployed')::int deployed FROM wisdo_voice_behaviors`);return {ok:true,service:'wisdo-voice-bot-authority',version:'3.4.0',behaviors:r.rows[0]?.total||0,deployed:r.rows[0]?.deployed||0};}
}
