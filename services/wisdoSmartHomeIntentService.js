const clean=(value)=>String(value||'').trim().replace(/\s+/g,' ');
const normalized=(value)=>clean(value).toLowerCase().replace(/[?!.]+$/,'');
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)));

const SCENES=new Set(['focus','relax','movie','trading','morning','date night','party','sleep','emergency']);

function selector(type='',alias=''){
  const target={};
  if(type)target.type=type;
  if(alias)target.alias=clean(alias).toLowerCase();
  return target;
}
function action(actionName,target,parameters={},riskLevel=1,confidence=.98){
  return {type:'HOME_ACTION',intent:'SMART_HOME_CONTROL',confidence,parameters:{action:actionName,target,parameters,riskLevel}};
}
function query(target,confidence=.96){
  return {type:'HOME_QUERY',intent:'SMART_HOME_STATUS',confidence,parameters:{target}};
}
function stripArticle(value=''){return clean(value).replace(/^(?:the|my)\s+/i,'');}
function deviceAlias(value,words=[]){
  let out=stripArticle(value);
  for(const word of words)out=out.replace(new RegExp('\\b'+word+'s?\\b','ig'),' ');
  return clean(out)||clean(value);
}

export function parseSmartHomeIntent(raw=''){
  const ask=normalized(raw);
  if(!ask)return null;

  let match=ask.match(/^(?:(?:activate|run|start|set|turn on)\s+(?:my\s+)?)?(focus|relax|movie|trading|morning|date night|party|sleep|emergency)(?:\s+(?:mode|scene))$/);
  if(!match)match=ask.match(/^(?:activate|run|start|set|turn on)\s+(?:my\s+)?(focus|relax|movie|trading|morning|date night|party|sleep|emergency)$/);
  if(match&&SCENES.has(match[1])){
    const scene=match[1];
    return action('activate',selector('scene',scene),{},scene==='emergency'?4:1,.995);
  }

  match=ask.match(/^(?:open|close)\s+(?:the\s+)?(.+?garage(?:\s+door)?)$/);
  if(match)return action(ask.startsWith('open')?'open':'close',selector('cover',stripArticle(match[1])),{},4,.995);

  match=ask.match(/^(lock|unlock)\s+(?:the\s+)?(.+?)(?:\s+lock)?$/);
  if(match)return action(match[1],selector('lock',deviceAlias(match[2],['lock'])),{},match[1]==='unlock'?5:2,.995);

  match=ask.match(/^arm\s+(?:the\s+)?(?:alarm|security)(?:\s+(away|home|stay))?$/);
  if(match)return action(match[1]==='home'||match[1]==='stay'?'arm_home':'arm_away',selector('alarm_control_panel','security'),{},5,.995);
  if(/^(?:disarm|turn off)\s+(?:the\s+)?(?:alarm|security)$/.test(ask))
    return action('disarm',selector('alarm_control_panel','security'),{},5,.995);

  match=ask.match(/^(?:set|make)\s+(?:the\s+)?(.+?)(?:\s+thermostat)?\s+(?:to\s+)?(\d{2,3})(?:\s*degrees?)?$/);
  if(match&&/(thermostat|temperature|heat|air|ac|climate)/.test(ask)){
    const name=deviceAlias(match[1],['thermostat','temperature','heat','air','ac','climate']);
    return action('set_temperature',selector('climate',name==='the'||!name?'':name),{temperature:clamp(match[2],45,95)},2,.99);
  }
  match=ask.match(/^set\s+(?:the\s+)?(?:thermostat|temperature)\s+(?:to\s+)?(\d{2,3})(?:\s*degrees?)?$/);
  if(match)return action('set_temperature',selector('climate'),{temperature:clamp(match[1],45,95)},2,.995);

  match=ask.match(/^(?:open|close)\s+(?:the\s+)?(.+?)\s+(blinds?|shades?|curtains?)$/);
  if(match)return action(ask.startsWith('open')?'open':'close',selector('cover',clean(match[1]+' '+match[2])),{},2,.99);
  match=ask.match(/^set\s+(?:the\s+)?(.+?)\s+(blinds?|shades?|curtains?)\s+(?:to\s+)?(\d{1,3})\s*(?:%|percent)$/);
  if(match)return action('set_position',selector('cover',clean(match[1]+' '+match[2])),{position:clamp(match[3],0,100)},2,.99);

  match=ask.match(/^(?:set|dim|brighten)\s+(?:the\s+)?(.+?lights?|.+?lamps?)\s+(?:to\s+)?(\d{1,3})\s*(?:%|percent)$/);
  if(match)return action('set_brightness',selector('light',stripArticle(match[1])),{brightness_pct:clamp(match[2],0,100)},1,.995);
  match=ask.match(/^(?:make|set)\s+(?:the\s+)?(.+?lights?|.+?lamps?)\s+(?:to\s+)?([a-z][a-z ]{1,30})$/);
  if(match&&!/\b(on|off|percent|degrees?)$/.test(match[2]))return action('set_color',selector('light',stripArticle(match[1])),{color_name:clean(match[2])},1,.97);

  match=ask.match(/^(?:turn|switch)\s+(on|off)\s+(?:the\s+)?(.+?lights?|.+?lamps?)$/);
  if(match)return action(match[1]==='on'?'turn_on':'turn_off',selector('light',stripArticle(match[2])),{},1,.995);
  match=ask.match(/^(?:turn|switch)\s+(?:the\s+)?(.+?lights?|.+?lamps?)\s+(on|off)$/);
  if(match)return action(match[2]==='on'?'turn_on':'turn_off',selector('light',stripArticle(match[1])),{},1,.995);

  match=ask.match(/^(?:turn|switch)\s+(on|off)\s+(?:the\s+)?(.+?fan)$/);
  if(match)return action(match[1]==='on'?'turn_on':'turn_off',selector('fan',stripArticle(match[2])),{},1,.99);
  match=ask.match(/^set\s+(?:the\s+)?(.+?fan)\s+(?:to\s+)?(\d{1,3})\s*(?:%|percent)$/);
  if(match)return action('set_percentage',selector('fan',stripArticle(match[1])),{percentage:clamp(match[2],0,100)},1,.99);

  match=ask.match(/^(?:turn|switch)\s+(on|off)\s+(?:the\s+)?(.+?(?:tv|television|speaker|speakers))$/);
  if(match)return action(match[1]==='on'?'turn_on':'turn_off',selector('media_player',stripArticle(match[2])),{},1,.99);
  match=ask.match(/^(?:pause|resume|play|stop)\s+(?:the\s+)?(.+?(?:music|speaker|speakers|tv|television))$/);
  if(match){const verb=ask.split(' ')[0];return action(verb==='resume'?'play':verb,selector('media_player',stripArticle(match[1])),{},1,.97);}
  match=ask.match(/^set\s+(?:the\s+)?(.+?(?:speaker|speakers|tv|television))\s+volume\s+(?:to\s+)?(\d{1,3})\s*(?:%|percent)$/);
  if(match)return action('set_volume',selector('media_player',stripArticle(match[1])),{volume_pct:clamp(match[2],0,100)},1,.99);

  match=ask.match(/^(start|pause|stop|dock)\s+(?:the\s+)?(.+?vacuum)$/);
  if(match)return action(match[1],selector('vacuum',stripArticle(match[2])),{},1,.99);

  if(/^(?:turn on|sound|activate)\s+(?:the\s+)?siren$/.test(ask))return action('turn_on',selector('siren'),{},4,.995);
  if(/^(?:turn off|stop|silence)\s+(?:the\s+)?siren$/.test(ask))return action('turn_off',selector('siren'),{},3,.995);

  match=ask.match(/^(?:what is|whats|what's)\s+(?:the\s+)?status\s+of\s+(.+)$/);
  if(match)return query(selector('',stripArticle(match[1])));
  match=ask.match(/^is\s+(?:the\s+)?(.+?)\s+(?:on|off|open|closed|locked|unlocked|home|away)$/);
  if(match)return query(selector('',stripArticle(match[1])));

  match=ask.match(/^(?:turn|switch)\s+(on|off)\s+(?:the\s+)?(.+)$/);
  if(match)return action(match[1]==='on'?'turn_on':'turn_off',selector('',stripArticle(match[2])),{},1,.93);

  return null;
}

export const WISDO_SMART_HOME_SCENES=Object.freeze([...SCENES]);
