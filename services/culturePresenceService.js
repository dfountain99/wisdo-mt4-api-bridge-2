import crypto from 'node:crypto';

export const EXPERIENCE_RANKS = Object.freeze(['AWAKENED','BUILDER','ARCHITECT','MENTOR','MASTER','LEGEND','LEGACY']);
export const ACCESS_RANKS = Object.freeze(['AWAKENED','BUILDER','ARCHITECT','MENTOR','MASTER','LEGEND','LEGACY']);
export const WISDO_MODES = Object.freeze(['focus','teach','build','harvest','mission','legacy']);

export const ACCESS_PRODUCTS = Object.freeze([
  { key:'wisdo_core', name:'Wisdo Core', minAccessRank:'AWAKENED' },
  { key:'focus_mode', name:'Focus Mode', minAccessRank:'AWAKENED' },
  { key:'teach_mode', name:'Teach Mode', minAccessRank:'BUILDER' },
  { key:'build_mode', name:'Build Mode', minAccessRank:'BUILDER' },
  { key:'harvest_mode', name:'Harvest Mode', minAccessRank:'ARCHITECT' },
  { key:'mission_mode', name:'Mission Mode', minAccessRank:'ARCHITECT' },
  { key:'advanced_presence', name:'Advanced Presence', minAccessRank:'MENTOR' },
  { key:'culture_band', name:'Culture Band Eligibility', minAccessRank:'MASTER' },
  { key:'culture_dock', name:'Culture Dock Eligibility', minAccessRank:'LEGEND' },
  { key:'holographic_mode', name:'Holographic Mode Eligibility', minAccessRank:'LEGACY' },
  { key:'legacy_mode', name:'Legacy Mode', minAccessRank:'LEGACY' },
]);

export const ACCESS_UPGRADES = Object.freeze([
  { sku:'access_builder', accessRank:'BUILDER', name:'Builder Access Upgrade', amountCents:2900 },
  { sku:'access_architect', accessRank:'ARCHITECT', name:'Architect Access Upgrade', amountCents:5900 },
  { sku:'access_mentor', accessRank:'MENTOR', name:'Mentor Access Upgrade', amountCents:9900 },
  { sku:'access_master', accessRank:'MASTER', name:'Master Access Upgrade', amountCents:14900 },
  { sku:'access_legend', accessRank:'LEGEND', name:'Legend Access Upgrade', amountCents:24900 },
  { sku:'access_legacy', accessRank:'LEGACY', name:'Legacy Access Upgrade', amountCents:39900 },
]);

function now(){ return new Date().toISOString(); }
function rankIndex(rank, list=ACCESS_RANKS){ const i=list.indexOf(String(rank||'').toUpperCase()); return i < 0 ? 0 : i; }
function cleanText(value,max=64){ return String(value||'').trim().replace(/\s+/g,' ').slice(0,max); }
export function normalizeCultureId(value){ return String(value||'').trim().replace(/^@+/,'').toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,24); }
export function validateCultureId(value){ const id=normalizeCultureId(value); if(id.length<3) return {ok:false,error:'Culture ID must contain at least 3 characters.'}; if(!/^[a-z][a-z0-9_]*$/.test(id)) return {ok:false,error:'Culture ID must start with a letter and use only letters, numbers, or underscores.'}; if(['admin','wisdo','support','system','culture','cemculture'].includes(id)) return {ok:false,error:'That Culture ID is reserved.'}; return {ok:true,value:id}; }
function permanentNumber(userId){ const digest=crypto.createHash('sha256').update(String(userId)).digest('hex'); return String(parseInt(digest.slice(0,10),16)%100000000).padStart(8,'0'); }

export function ensurePresenceState(state={}){
  state.culturePresenceByUserId ||= {};
  state.cultureIdOwnerByName ||= {};
  state.cultureAccessPurchasesById ||= {};
  state.cultureIdentityHistoryByUserId ||= {};
  state.cultureTeachSessionsByUserId ||= {};
  return state;
}

export function defaultPresence(user={}){
  const fallback=normalizeCultureId(user.username||user.name||`member${String(user.id||'').slice(-6)}`) || `member${String(user.id||'000000').slice(-6)}`;
  return {
    userId:String(user.id), cultureNumber:permanentNumber(user.id), cultureId:fallback,
    displayName:cleanText(user.username||user.name||'Culture Member',48), title:'Awakened', verified:false,
    experienceRank:'AWAKENED', accessRank:'AWAKENED', accessSource:'earned', activeMode:'focus',
    preferredGreeting:'Welcome back', trustedDeviceIds:[], disciplineStreak:0, missionsCompleted:0,
    learningLevel:1, lastWorkspace:'/app/dashboard', lastSeenAt:now(), lastActiveAt:now(),
    presenceStatus:'online', deviceType:'unknown', deviceName:'Unknown device', sessionStartedAt:now(),
    timezone:'', locale:'', currentAccountId:'', currentPage:'/app/dashboard', awarenessEvents:[],
    createdAt:now(), updatedAt:now(),
  };
}

export function getOrCreatePresence(state,user){ ensurePresenceState(state); const uid=String(user.id); let row=state.culturePresenceByUserId[uid]; if(!row){ row=defaultPresence(user); let candidate=row.cultureId; let n=2; while(state.cultureIdOwnerByName[candidate]&&state.cultureIdOwnerByName[candidate]!==uid) candidate=`${row.cultureId.slice(0,20)}${n++}`; row.cultureId=candidate; state.culturePresenceByUserId[uid]=row; state.cultureIdOwnerByName[candidate]=uid; } return row; }

export function updateIdentity(state,user,input={}){
  const row=getOrCreatePresence(state,user); const uid=String(user.id); const nextId=input.cultureId===undefined?row.cultureId:validateCultureId(input.cultureId).value;
  if(input.cultureId!==undefined){ const validation=validateCultureId(input.cultureId); if(!validation.ok) throw new Error(validation.error); const owner=state.cultureIdOwnerByName[validation.value]; if(owner&&owner!==uid) throw new Error('That Culture ID is already owned by another member.'); if(validation.value!==row.cultureId){ state.cultureIdentityHistoryByUserId[uid] ||= []; state.cultureIdentityHistoryByUserId[uid].push({cultureId:row.cultureId,changedAt:now()}); delete state.cultureIdOwnerByName[row.cultureId]; state.cultureIdOwnerByName[validation.value]=uid; row.cultureId=validation.value; }}
  if(input.displayName!==undefined) row.displayName=cleanText(input.displayName,48)||row.displayName;
  if(input.title!==undefined) row.title=cleanText(input.title,40)||row.title;
  if(input.preferredGreeting!==undefined) row.preferredGreeting=cleanText(input.preferredGreeting,100)||'Welcome back';
  row.updatedAt=now(); return row;
}

export function setPresenceMode(state,user,mode){ const row=getOrCreatePresence(state,user); const normalized=String(mode||'').toLowerCase(); if(!WISDO_MODES.includes(normalized)) throw new Error('Unknown Wisdo mode.'); const product=ACCESS_PRODUCTS.find(p=>p.key===`${normalized}_mode`); if(product&&!hasAccessRank(row.accessRank,product.minAccessRank)) throw new Error(`${product.name} requires ${product.minAccessRank} access.`); row.activeMode=normalized; row.updatedAt=now(); return row; }
export function hasAccessRank(current,required){ return rankIndex(current)>=rankIndex(required); }
export function unlockedProducts(row){ return ACCESS_PRODUCTS.map(product=>({...product,unlocked:hasAccessRank(row.accessRank,product.minAccessRank)})); }
export function buildPresenceSnapshot(state,user){ const row=getOrCreatePresence(state,user); return {...row,unlockedProducts:unlockedProducts(row),identityHistory:[...(state.cultureIdentityHistoryByUserId[String(user.id)]||[])].slice(-20).reverse(),availableUpgrades:ACCESS_UPGRADES.filter(x=>rankIndex(x.accessRank)>rankIndex(row.accessRank))}; }
export function grantAccessUpgrade(state,user,{accessRank,source='purchase',purchaseId=null}){ const row=getOrCreatePresence(state,user); const target=String(accessRank||'').toUpperCase(); if(!ACCESS_RANKS.includes(target)) throw new Error('Unknown access rank.'); if(rankIndex(target)<rankIndex(row.accessRank)) throw new Error('Access upgrades cannot reduce the current access rank.'); row.accessRank=target; row.accessSource=source; row.accessPurchaseId=purchaseId; row.accessGrantedAt=now(); row.updatedAt=now(); return row; }
export function recordAccessPurchase(state,user,{sku,provider='manual',paymentId='',amountCents=null,status='completed'}){ const upgrade=ACCESS_UPGRADES.find(x=>x.sku===sku); if(!upgrade) throw new Error('Unknown access upgrade.'); const id=paymentId||crypto.randomUUID(); const purchase={id,userId:String(user.id),sku,accessRank:upgrade.accessRank,amountCents:amountCents??upgrade.amountCents,provider,status,createdAt:now()}; state.cultureAccessPurchasesById[id]=purchase; if(status==='completed') grantAccessUpgrade(state,user,{accessRank:upgrade.accessRank,source:'purchase',purchaseId:id}); return purchase; }
export function createTeachSession(state,user,input={}){ const row=getOrCreatePresence(state,user); if(!hasAccessRank(row.accessRank,'BUILDER')) throw new Error('Teach Mode requires Builder access.'); const uid=String(user.id); state.cultureTeachSessionsByUserId[uid] ||= []; const session={id:crypto.randomUUID(),topic:cleanText(input.topic||'Trading discipline',80),accountId:cleanText(input.accountId||'',80),lessonGoal:cleanText(input.lessonGoal||'Review decisions and identify one improvement.',180),status:'active',score:null,createdAt:now(),updatedAt:now()}; state.cultureTeachSessionsByUserId[uid].push(session); row.activeMode='teach'; row.updatedAt=now(); return session; }


export function updatePresenceAwareness(state,user,input={}){
  const row=getOrCreatePresence(state,user);
  const page=String(input.currentPage||input.page||row.currentPage||'/app/dashboard').trim();
  if(page.startsWith('/app/')){ row.currentPage=page.slice(0,180); row.lastWorkspace=row.currentPage; }
  row.currentAccountId=cleanText(input.currentAccountId||input.accountId||row.currentAccountId||'',80);
  row.deviceType=cleanText(input.deviceType||row.deviceType||'unknown',30);
  row.deviceName=cleanText(input.deviceName||row.deviceName||'Unknown device',80);
  row.timezone=cleanText(input.timezone||row.timezone||'',60);
  row.locale=cleanText(input.locale||row.locale||'',30);
  row.presenceStatus=['online','away','focused','offline'].includes(String(input.status||'').toLowerCase())?String(input.status).toLowerCase():'online';
  row.lastSeenAt=now(); row.lastActiveAt=now(); row.updatedAt=now();
  row.awarenessEvents ||= [];
  const event={at:now(),page:row.currentPage,accountId:row.currentAccountId,mode:row.activeMode,status:row.presenceStatus,deviceType:row.deviceType};
  const last=row.awarenessEvents[row.awarenessEvents.length-1];
  if(!last||last.page!==event.page||last.accountId!==event.accountId||last.mode!==event.mode||last.status!==event.status) row.awarenessEvents.push(event);
  row.awarenessEvents=row.awarenessEvents.slice(-50);
  return row;
}

export function presenceGreeting(row={},date=new Date()){
  const hour=date.getHours();
  const daypart=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
  const name=row.displayName||row.cultureId||'Culture Member';
  const custom=String(row.preferredGreeting||'').trim();
  return custom&&custom!=='Welcome back'?`${custom}, ${name}.`:`${daypart}, ${name}. Wisdo is aware and ready.`;
}

export function buildAwarenessSnapshot(state,user){
  const row=getOrCreatePresence(state,user);
  return {...buildPresenceSnapshot(state,user),greeting:presenceGreeting(row),resumePath:row.lastWorkspace||'/app/dashboard',recentAwareness:[...(row.awarenessEvents||[])].slice(-10).reverse()};
}
