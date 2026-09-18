const ACTIONS=Object.freeze({
  close_full_basket:{family:'basket_exit',commandName:'CLOSE_ALL_TRADES',risk:'dangerous'},
  protect_profit_full_basket:{family:'basket_exit',commandName:'CLOSE_ALL_TRADES',risk:'dangerous'},
  pause_entries:{family:'entry_state',commandName:'STOP_ENTRIES',risk:'controlled'},
  resume_entries:{family:'entry_state',commandName:'START_ENTRIES',risk:'controlled'},
  guard_mode:{family:'control_mode',commandName:'SET_CONTROL_MODE',risk:'controlled'},
  notify:{family:'notification',commandName:null,risk:'read_only'},
});
const OPPOSITES=new Set(['pause_entries:resume_entries','resume_entries:pause_entries']);
const CURRENCIES=new Set(['USD','EUR','GBP','JPY','CHF','AUD','NZD','CAD']);

function clean(value=''){return String(value??'').trim();}
function lower(value=''){return clean(value).toLowerCase().replace(/[’']/g,'').replace(/\s+/g,' ');}
function durationSeconds(text='') { const match=lower(text).match(/(\d+(?:\.\d+)?)\s*(second|minute|hour|day)s?/);if(!match)return null;return Math.round(Number(match[1])*({second:1,minute:60,hour:3600,day:86400}[match[2]])); }
function amount(text=''){const match=String(text).match(/\$\s*([\d,]+(?:\.\d+)?)/);return match?Number(match[1].replaceAll(',','')):null;}
function percent(text=''){const match=lower(text).match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/);return match?Number(match[1]):null;}
function comparator(text=''){const t=lower(text);if(/(?:below|under|less than|drops? below)/.test(t))return '<';if(/(?:at most|no more than)/.test(t))return '<=';if(/(?:at least|no less than)/.test(t))return '>=';return '>';}
function exactMention(raw,candidates=[]){const haystack=lower(raw);const matches=candidates.filter(Boolean).filter((candidate)=>{const value=lower(candidate);return value.length>1&&new RegExp(`(?:^|[^a-z0-9])${value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:$|[^a-z0-9])`,'i').test(haystack);});return [...new Set(matches.map(String))];}

export function registeredBehaviorActions(){return ACTIONS;}

export function extractBehaviorScope(raw='',context={}) {
  const text=String(raw),upper=text.toUpperCase();
  const accountCandidates=(context.accounts||[]).flatMap((a)=>[a.accountId,a.account_id,a.id,a.nickname,a.alias,a.accountName]).filter(Boolean);
  const botCandidates=(context.bots||context.botLanes||[]).flatMap((b)=>[b.botId,b.bot_id,b.name,b.nickname,b.botName,b.bot_family]).filter(Boolean);
  const symbolCandidates=(context.symbols||context.available_symbols||[]).map(String);
  const accounts=exactMention(text,accountCandidates),bots=exactMention(text,botCandidates),symbols=exactMention(text,symbolCandidates).map((v)=>v.toUpperCase());
  const explicitBot=(lower(text).match(/\b(?:bot|ea|lane)(?: named)?\s+([a-z0-9:_-]+)/)||[])[1];if(explicitBot)bots.push(explicitBot);
  const explicitSymbol=(upper.match(/\b(?:XAUUSD|XAGUSD|BTCUSD|ETHUSD|US30|NAS100|USTEC|SPX500|[A-Z]{6})(?:[._-][A-Z0-9]+)?\b/)||[])[0];
  const base=explicitSymbol?.slice(0,6);const looksForex=base&&CURRENCIES.has(base.slice(0,3))&&CURRENCIES.has(base.slice(3,6));
  if(explicitSymbol&&(looksForex||/^(XAU|XAG|BTC|ETH|US30|NAS|USTEC|SPX)/.test(explicitSymbol)))symbols.push(explicitSymbol);
  const magic=(lower(text).match(/magic(?: number)?\s*(\d+)/)||[])[1]||null;
  const campaign=(lower(text).match(/campaign(?: named)?\s+([a-z0-9:_-]+)/)||[])[1]||null;
  const level=campaign?'campaign':magic?'magic':symbols.length?'symbol':bots.length?'bot_family':accounts.length?'account':'account';
  return {level,account_ref:accounts[0]||context.account_id||null,bot_ref:bots[0]||context.bot_family||null,symbol:[...new Set(symbols)][0]||context.symbol||context.last_symbol||null,magic_number:magic?Number(magic):context.magic_number||null,campaign_id:campaign||context.campaign_id||null,ambiguities:{accounts:accounts.length>1?accounts:[],bots:bots.length>1?bots:[],symbols:[...new Set(symbols)].length>1?[...new Set(symbols)]:[]}};
}

function parseMetricClause(text='') {
  const t=lower(text),op=comparator(t);
  if(/basket.*profit|profit.*basket/.test(t))return {type:'metric',metric:'basket_profit_money',operator:op,value:amount(text)??Number((t.match(/(\d+(?:\.\d+)?)/)||[])[1])};
  if(/drawdown/.test(t))return {type:'metric',metric:'drawdown_percent',operator:op,value:percent(t)};
  if(/spread/.test(t))return {type:'metric',metric:'spread_points',operator:op,value:Number((t.match(/(\d+(?:\.\d+)?)/)||[])[1])};
  if(/equity/.test(t))return {type:'metric',metric:'equity',operator:op,value:amount(text)??Number((t.match(/(\d+(?:\.\d+)?)/)||[])[1])};
  if(/open trades?|positions?/.test(t))return {type:'metric',metric:'open_trade_count',operator:op,value:Number((t.match(/(\d+)/)||[])[1])};
  if(/basket.*(?:positive|profitable)|(?:positive|profitable).*basket/.test(t))return {type:'metric',metric:'basket_profit_money',operator:'>',value:0};
  return null;
}

function parseActions(text='') {
  const t=lower(text),matches=[];const add=(pattern,action)=>{const index=t.search(pattern);if(index>=0)matches.push({index,action});};
  add(/protect (?:my |the )?profit|lock (?:in )?profit/,{type:'protect_profit_full_basket',parameters:{require_positive_basket:true,atomic:true}});
  add(/close (?:the |my )?(?:full |whole |entire )?(?:basket|all trades|everything)|flatten/,{type:'close_full_basket',parameters:{atomic:true}});
  add(/pause|stop new entr|stop adding|block new entr/,{type:'pause_entries',parameters:{}});
  add(/resume|start new entr|allow new entr/,{type:'resume_entries',parameters:{}});
  add(/guard mode|safe mode|defensive mode/,{type:'guard_mode',parameters:{mode:'GUARD',allowNewTrades:false,maxTrades:1,riskPercent:.25}});
  add(/notify|alert|tell me|message me|wake me/,{type:'notify',parameters:{}});
  return matches.sort((a,b)=>a.index-b.index).map(({action})=>action).filter((action,index,list)=>list.findIndex((item)=>item.type===action.type)===index);
}

export class WisdoBehaviorCompilerService {
  compile(raw='',context={}) {
    const source=clean(raw),text=lower(source),scope=extractBehaviorScope(source,context);const errors=[],warnings=[];
    if(!source)errors.push('Behavior text is required.');
    for(const [kind,values] of Object.entries(scope.ambiguities))if(values.length)errors.push(`More than one ${kind} scope matched: ${values.join(', ')}.`);
    const actions=parseActions(source),action=actions[0]||null;if(!action)errors.push('No registered behavior action was found.');const actionTypes=new Set(actions.map((item)=>item.type));if(actionTypes.has('pause_entries')&&actionTypes.has('resume_entries'))errors.push('One behavior cannot both pause and resume entries.');if([...actionTypes].some((type)=>type.includes('basket'))&&actionTypes.has('resume_entries'))errors.push('A full-basket exit cannot share a behavior with resume entries.');
    let trigger={type:'manual'};
    const every=text.match(/\bevery\s+(.+?)(?=\s+(?:if|when|unless|until|then|close|pause|resume|protect|notify|alert)|$)/);
    const interval=every?durationSeconds(every[1]):null;
    if(interval)trigger={type:'interval',interval_seconds:interval};
    else if(/\b(?:new|another)\b.{0,30}\b(?:entry|entries|position|trade)\b|\b(?:entry|position|trade) opens?\b/.test(text))trigger={type:'event',event:'new_entry'};
    const timerReset=/(?:every|each) new entr(?:y|ies).*(?:reset|restart).*(?:timer|clock)|(?:reset|restart).*(?:timer|clock).*(?:every|each) new entr(?:y|ies)/.test(text);
    if(timerReset)trigger={type:'resettable_inactivity_timer',event:'new_entry',timeout_seconds:durationSeconds(text)};
    if(trigger.type==='manual'){
      const lead=(text.match(/(?:if|when)\s+(.+?)(?=\s+(?:then|close|pause|resume|protect|notify|alert|guard)\b)/)||[])[1];
      const metric=parseMetricClause(lead||text);if(metric)trigger=metric;
    }
    if(trigger.type==='manual'&&!/\bnow\b|immediately|manual/.test(text))warnings.push('No automatic trigger was found; this behavior is manual.');
    if(trigger.type==='resettable_inactivity_timer'&&!trigger.timeout_seconds)errors.push('The resettable timer needs an exact duration.');
    const unless=(text.match(/\bunless\s+(.+?)(?=\s+until\b|$)/)||[])[1];
    const unlessCondition=unless?parseMetricClause(unless):null;if(unless&&!unlessCondition)errors.push('The UNLESS condition could not be compiled safely.');
    const until=(text.match(/\buntil\s+(.+)$/)||[])[1];
    const terminationMetric=until?parseMetricClause(until):null;
    const termination=until?(/end of (?:the )?(?:day|session)|today/.test(until)?{type:'end_of_trading_day'}:terminationMetric):null;if(until&&!termination)errors.push('The UNTIL condition could not be compiled safely.');
    const conditions=[];
    const ifClause=interval?(text.match(/\bif\s+(.+?)(?=\s+(?:then|close|pause|resume|protect|notify|alert|guard)\b)/)||[])[1]:null;const ifCondition=ifClause?parseMetricClause(ifClause):null;if(ifClause&&!ifCondition)errors.push('The IF condition could not be compiled safely.');if(ifCondition)conditions.push(ifCondition);
    if(actions.some((item)=>item.type==='protect_profit_full_basket'))conditions.push({type:'metric',metric:'basket_profit_money',operator:'>',value:0});
    return {schema_version:'2.0',name:this.title(action,trigger),purpose:source,scope,trigger,conditions,unless:unlessCondition?[unlessCondition]:[],actions,termination,mode:/\b(simulate|simulation|shadow|paper test|preview)\b/.test(text)?'shadow':'active',verification:{required:actions.some((item)=>Boolean(ACTIONS[item.type]?.commandName)),receipt:'mt4_reporter',success:actions.some((item)=>item.type.includes('basket'))?'all_target_tickets_closed':'command_completed'},failure_plan:{retry:'bounded',max_attempts:3,on_exhausted:'notify_and_disarm'},source:{type:'natural_language',spoken_text:source,confidence:errors.length?0.4:0.96},validation:{valid:errors.length===0,errors,warnings}};
  }

  title(action,trigger){const a=action?.type?.replaceAll('_',' ')||'custom behavior',t=trigger?.type?.replaceAll('_',' ')||'manual';return `${a.replace(/\b\w/g,(c)=>c.toUpperCase())} · ${t.replace(/\b\w/g,(c)=>c.toUpperCase())}`;}

  conflicts(candidate,existing=[]) {
    const found=[];for(const row of existing){const other=row.definition||row;if(!this.scopeOverlaps(candidate.scope,other.scope))continue;for(const a of candidate.actions||[])for(const b of other.actions||[]){const opposite=OPPOSITES.has(`${a.type}:${b.type}`);const exits=a.type.includes('basket')&&b.type==='resume_entries';if(opposite||exits)found.push({behaviorId:row.behavior_id||other.behavior_id||null,severity:'blocking',reason:`${a.type} conflicts with ${b.type} in the same scope.`});}}
    return found;
  }

  scopeOverlaps(a={},b={}) { for(const key of ['account_id','account_ref','bot_family','bot_ref','symbol','magic_number','campaign_id'])if(a[key]!=null&&b[key]!=null&&String(a[key]).toLowerCase()!==String(b[key]).toLowerCase())return false;return true; }

  evaluate(behavior,snapshot={},event={}) {
    const definition=behavior.definition||behavior,trigger=definition.trigger||{},trades=Array.isArray(snapshot.openTrades)?snapshot.openTrades:[];
    const values={basket_profit_money:trades.reduce((n,t)=>n+Number(t.profit||0)+Number(t.swap||0)+Number(t.commission||0),0),drawdown_percent:Number(snapshot.balance)>0?Math.max(0,(Number(snapshot.balance)-Number(snapshot.equity))/Number(snapshot.balance)*100):0,spread_points:Number(snapshot.spreadPoints??snapshot.spread??0),equity:Number(snapshot.equity||0),open_trade_count:trades.length};
    const compare=(condition)=>{const actual=values[condition.metric];if(!Number.isFinite(actual)||!Number.isFinite(Number(condition.value)))return false;return condition.operator==='<'?actual<condition.value:condition.operator==='<='?actual<=condition.value:condition.operator==='>='?actual>=condition.value:actual>condition.value;};
    const triggerMatched=trigger.type==='metric'?compare(trigger):trigger.type==='event'?event.type===trigger.event:trigger.type==='manual'?Boolean(event.manual):trigger.type==='interval'?Boolean(event.interval_due):false;
    const conditionsMatched=(definition.conditions||[]).every(compare),unlessMatched=(definition.unless||[]).some(compare),termination=definition.termination||null,terminated=termination?.type==='metric'?compare(termination):termination?.type==='end_of_trading_day'?event.type==='end_of_trading_day':false,wouldFire=triggerMatched&&conditionsMatched&&!unlessMatched&&!terminated;
    return {wouldFire,mode:definition.mode||'active',triggerMatched,conditionsMatched,unlessMatched,terminated,metrics:values,actions:definition.actions||[],explanation:terminated?'The UNTIL condition ended the behavior.':!triggerMatched?'Trigger has not matched.':unlessMatched?'An UNLESS guard blocked the action.':!conditionsMatched?'A required condition blocked the action.':wouldFire?'Behavior would execute.':'Behavior remains armed.'};
  }

  commandFor(action={}) { const contract=ACTIONS[action.type];return contract?.commandName?{intent:action.type.toUpperCase(),commandName:contract.commandName,parameters:{...(action.parameters||{})},safetyLevel:contract.risk==='dangerous'?'DANGEROUS':'CONTROLLED'}:null; }
}
