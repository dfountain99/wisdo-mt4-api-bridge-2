import crypto from 'node:crypto';

const FINANCIAL_ACTIONS = new Set(['close_all','close_profitable','close_losing','modify_stop','set_profit_target','change_risk','trail_stop']);
const IMMUTABLE_BLOCKS = new Set(['disable_authentication','disable_audit','bypass_risk_governor','expose_broker_password','remove_emergency_stop']);
const scopeRank = { platform:0, user:10, lane:20, account:30, bot_family:40, symbol:50, timeframe:60, instance:70, temporary:80 };
const CURRENCY_CODES = new Set(['USD','EUR','GBP','JPY','CHF','AUD','NZD','CAD','SGD','HKD','NOK','SEK','DKK','PLN','TRY','ZAR','MXN','CNH','CNY','RUB','BRL']);

function id(prefix) { return `${prefix}_${crypto.randomUUID()}`; }
function clean(v='') { return String(v ?? '').trim(); }
function lower(v='') { return clean(v).toLowerCase(); }
function json(v,f={}) { return v && typeof v === 'object' ? v : f; }

export class WisdoAdaptiveFabricService {
  constructor({ pool, logger }={}) { if (!pool) throw new Error('PostgreSQL pool is required.'); this.pool=pool; this.logger=logger||console; }

  async registerCapability(owner, input={}) {
    const key=clean(input.key); if(!key) throw new Error('Capability key is required.');
    const row=await this.pool.query(`INSERT INTO wisdo_capabilities(capability_id,owner_user_id,provider_type,provider_id,capability_key,kind,risk_level,requires_confirmation,parameters,metadata,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,'active')
      ON CONFLICT(owner_user_id,provider_type,provider_id,capability_key) DO UPDATE SET kind=EXCLUDED.kind,risk_level=EXCLUDED.risk_level,requires_confirmation=EXCLUDED.requires_confirmation,parameters=EXCLUDED.parameters,metadata=EXCLUDED.metadata,status='active',updated_at=NOW() RETURNING *`,
      [id('cap'),owner,clean(input.provider_type||'system'),clean(input.provider_id||'render'),key,clean(input.kind||'observe'),clean(input.risk_level||'low'),Boolean(input.requires_confirmation),JSON.stringify(json(input.parameters)),JSON.stringify(json(input.metadata))]);
    return row.rows[0];
  }

  async listCapabilities(owner, scope={}) {
    const r=await this.pool.query(`SELECT * FROM wisdo_capabilities WHERE owner_user_id=$1 AND status='active' AND ($2='' OR provider_type=$2) AND ($3='' OR provider_id=$3) ORDER BY capability_key`,[owner,clean(scope.provider_type),clean(scope.provider_id)]); return r.rows;
  }

  analyzeIntent(text, context={}) {
    const raw=clean(text), t=lower(text); let intent='custom_behavior'; const params={};
    if(/weakest pair|worst pair/.test(t)) intent='analyze_weakest_symbol';
    else if(/trail.*stop|trailing stop/.test(t)) { intent='trail_stop'; const m=t.match(/(?:up|profit|gain).*?(\d+(?:\.\d+)?)\s*%/); if(m) params.start_profit_percent=Number(m[1]); }
    else if(/profit take|take profit|close.*profit/.test(t)) intent='set_profit_target';
    else if(/wake me/.test(t) && /profit/.test(t)) intent='create_profit_wake_promise';
    else if(/pause/.test(t)) intent='pause_entries'; else if(/resume/.test(t)) intent='resume_entries';
    const money=t.match(/\$\s*([\d,]+(?:\.\d+)?)/); if(money) params.money=Number(money[1].replaceAll(',',''));
    const pct=t.match(/(\d+(?:\.\d+)?)\s*%/); if(pct && params.start_profit_percent==null) params.percent=Number(pct[1]);
    const availableSymbols=Array.isArray(context.available_symbols)?context.available_symbols:[];
    const availableMatch=availableSymbols.find(candidate=>raw.toLowerCase().includes(String(candidate).toLowerCase()));
    const tokens=raw.match(/\b[A-Z0-9][A-Z0-9._-]{2,23}\b/gi)||[];
    const explicitMarket=tokens.find(token=>{
      const upper=token.toUpperCase();
      const base=upper.match(/^([A-Z]{6})/)?.[1];
      const forex=base&&CURRENCY_CODES.has(base.slice(0,3))&&CURRENCY_CODES.has(base.slice(3,6));
      return forex||/^(XAUUSD|XAGUSD|GOLD|SILVER|US30|DJ30|NAS100|NASDAQ|USTEC|SPXUSD|SPX500|SP500|BTCUSD|ETHUSD|USOIL|UKOIL|WTI|BRENT)/.test(upper)||(/[A-Z]/.test(upper)&&/\d/.test(upper));
    });
    const symbol=clean(availableMatch||explicitMarket||context.last_symbol||context.canonical_symbol||'').toUpperCase()||null;
    return { raw, intent, parameters:params, references:{symbol, bot_family:context.bot_family||null, account_id:context.account_id||null, instance_id:context.instance_id||null}, confidence:symbol||!/(that one|it only|that pair)/i.test(raw)?0.91:0.58 };
  }

  compileBehavior(intentResult, options={}) {
    const r=intentResult, p=r.parameters||{}, ref=r.references||{};
    const scope={ level: ref.instance_id?'instance':ref.symbol?'symbol':ref.bot_family?'bot_family':'user', owner_user_id:options.owner_user_id, bot_family:ref.bot_family||options.bot_family||null, account_id:ref.account_id||null, symbol:ref.symbol||null, timeframe:options.timeframe||null, instance_id:ref.instance_id||null };
    let trigger={type:'manual'}, actions=[];
    if(r.intent==='trail_stop'){ trigger={type:'metric_threshold',metric:'profit_percent',operator:'>=',value:p.start_profit_percent??20}; actions=[{type:'trail_stop',method:options.trail_method||'volatility_adjusted',distance_percent:options.distance_percent??5}]; }
    else if(r.intent==='set_profit_target'){ trigger={type:'metric_threshold',metric:'basket_profit_money',operator:'>=',value:p.money??options.target_money??100}; actions=[{type:'close_full_basket',only_profitable:true}]; }
    else if(r.intent==='create_profit_wake_promise'){ trigger={type:'metric_threshold',metric:'portfolio_profit_money',operator:'>=',value:p.money??3500}; actions=[{type:'play_music',query:options.music||'James Brown'},{type:'speak_summary'},{type:'activate_experience',experience:'victory'}]; }
    else actions=[{type:r.intent,parameters:p}];
    return { behavior_id:id('behavior'), name:options.name||this.titleFor(r), purpose:options.purpose||r.raw, scope, trigger, conditions:options.conditions||[], actions, exceptions:options.exceptions||['emergency_stop','identity_not_verified','permission_denied'], safety:{approval_required:actions.some(a=>FINANCIAL_ACTIONS.has(a.type)),shadow_first:actions.some(a=>FINANCIAL_ACTIONS.has(a.type)),reversible:true}, lifecycle:{state:'draft',temporary:Boolean(options.temporary),expires_at:options.expires_at||null,rollback:'restore_inherited_policy'}, success_metrics:options.success_metrics||[], source:{type:'voice',spoken_text:r.raw,confidence:r.confidence} };
  }

  titleFor(r){ return ({trail_stop:'Profit Trail Overlay',set_profit_target:'Scoped Profit Take',create_profit_wake_promise:'Profit Wake Promise',analyze_weakest_symbol:'Weakness Analysis'})[r.intent]||'Custom Wisdo Behavior'; }

  validateBehavior(behavior, capabilities=[]) {
    const errors=[], warnings=[]; const actions=behavior.actions||[]; const keys=new Set(capabilities.map(c=>c.capability_key));
    for(const a of actions){ if(IMMUTABLE_BLOCKS.has(a.type)) errors.push(`Action ${a.type} violates the safety constitution.`); if(!keys.has(a.type) && !['speak_summary','activate_experience','play_music','close_full_basket'].includes(a.type)) warnings.push(`Capability ${a.type} is not currently registered.`); }
    if(!behavior.scope?.owner_user_id) errors.push('Behavior owner is required.');
    if(behavior.source?.confidence<0.75) errors.push('Conversational reference confidence is too low; clarification is required.');
    if(actions.some(a=>FINANCIAL_ACTIONS.has(a.type)) && behavior.safety?.approval_required!==true) errors.push('Financial behaviors require explicit approval.');
    return {valid:errors.length===0,errors,warnings,risk_level:actions.some(a=>FINANCIAL_ACTIONS.has(a.type))?'high':'low'};
  }

  async saveBehavior(owner, behavior, validation) {
    if(!validation.valid) throw new Error(validation.errors.join(' '));
    const version=1; const r=await this.pool.query(`INSERT INTO wisdo_behaviors(behavior_id,owner_user_id,name,purpose,scope_level,scope,definition,status,current_version,source_type,source_text,risk_level,approval_required)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,'draft',$8,$9,$10,$11,$12) RETURNING *`,[behavior.behavior_id,owner,behavior.name,behavior.purpose,behavior.scope.level,JSON.stringify(behavior.scope),JSON.stringify(behavior),version,behavior.source.type,behavior.source.spoken_text,validation.risk_level,behavior.safety.approval_required]);
    await this.pool.query(`INSERT INTO wisdo_behavior_versions(behavior_id,version,definition,change_summary,created_by) VALUES($1,1,$2::jsonb,'Initial compiled behavior',$3)`,[behavior.behavior_id,JSON.stringify(behavior),owner]);
    return r.rows[0];
  }

  async resolveEffectiveBehaviors(owner, context={}) {
    const r=await this.pool.query(`SELECT * FROM wisdo_behaviors WHERE owner_user_id=$1 AND status='active'`,[owner]);
    return r.rows.filter(row=>this.scopeMatches(row.scope||{},context)).sort((a,b)=>(scopeRank[a.scope_level]||0)-(scopeRank[b.scope_level]||0));
  }
  scopeMatches(s,c){ return (!s.bot_family||lower(s.bot_family)===lower(c.bot_family))&&(!s.account_id||clean(s.account_id)===clean(c.account_id))&&(!s.symbol||lower(s.symbol)===lower(c.symbol))&&(!s.timeframe||lower(s.timeframe)===lower(c.timeframe))&&(!s.instance_id||clean(s.instance_id)===clean(c.instance_id)); }

  async createPromise(owner, input={}) {
    const pid=id('promise'); const r=await this.pool.query(`INSERT INTO wisdo_promises(promise_id,owner_user_id,name,condition_definition,action_definition,cancel_definition,state,expires_at,metadata) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,'armed',$7,$8::jsonb) RETURNING *`,[pid,owner,clean(input.name||'Custom Promise'),JSON.stringify(json(input.condition)),JSON.stringify(input.actions||[]),JSON.stringify(json(input.cancel)),input.expires_at||null,JSON.stringify(json(input.metadata))]); return r.rows[0];
  }

  async createVoiceGenome(owner,input={}) {
    const source=clean(input.source_type||'builtin'); if(['user_owned','licensed'].includes(source)&&!input.consent?.verified) throw new Error('Verified voice consent is required.');
    if(source==='style_original') input.identity={...(input.identity||{}),impersonates_real_person:false,representation:'original_style_designed_voice'};
    const vid=id('voice'); const r=await this.pool.query(`INSERT INTO wisdo_voice_genomes(voice_id,owner_user_id,name,source_type,identity,vocal_character,delivery,consent,assignments,status) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,'active') RETURNING *`,[vid,owner,clean(input.name||'Wisdo Voice'),source,JSON.stringify(json(input.identity)),JSON.stringify(json(input.vocal_character)),JSON.stringify(json(input.delivery)),JSON.stringify(json(input.consent)),JSON.stringify(input.assignments||[])]); return r.rows[0];
  }

  async analyzeWeakestSymbol(owner,{window_days=7,minimum_trades=1,account_id=null,bot_family=null}={}) {
    const r=await this.pool.query(`SELECT symbol,COUNT(*)::int trades,COALESCE(SUM(profit),0)::float net_profit,COALESCE(AVG(CASE WHEN profit>0 THEN 1.0 ELSE 0 END),0)::float win_rate,COALESCE(SUM(CASE WHEN profit>0 THEN profit ELSE 0 END),0)::float gross_profit,ABS(COALESCE(SUM(CASE WHEN profit<0 THEN profit ELSE 0 END),0))::float gross_loss FROM wisdo_trade_history WHERE owner_user_id=$1 AND closed_at>=NOW()-($2||' days')::interval AND ($3::text IS NULL OR account_id=$3) AND ($4::text IS NULL OR bot_family=$4) GROUP BY symbol HAVING COUNT(*)>=$5 ORDER BY net_profit ASC LIMIT 1`,[owner,window_days,account_id,bot_family,minimum_trades]);
    const row=r.rows[0]; if(!row) return null; return {...row,profit_factor:row.gross_loss?row.gross_profit/row.gross_loss:null,window_days,minimum_trades};
  }
}
