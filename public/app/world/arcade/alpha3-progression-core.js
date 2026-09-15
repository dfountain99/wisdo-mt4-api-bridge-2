export const ARCADE_ALPHA3_BUILD='ARCADE-ALPHA3';
export const ARCADE_ALPHA3_VERSION='3.0.1';
export const MAX_ARCADE_LEVEL=50;

export const FLOOR_LEVELS=Object.freeze({rookie:1,structure:1,risk:2,execution:3,psychology:4,professional:7,championship:10});

export const ACHIEVEMENTS=Object.freeze([
  Object.freeze({id:'first-run',name:'First Verified Session',description:'Complete your first verified trading simulation.',xp:60}),
  Object.freeze({id:'student-70',name:'Market Student',description:'Finish a verified session with 70+ overall mastery.',xp:80}),
  Object.freeze({id:'risk-90',name:'Risk Guardian',description:'Finish a verified session with 90+ risk discipline.',xp:100}),
  Object.freeze({id:'five-runs',name:'Five Sessions Deep',description:'Complete five verified trading simulations.',xp:120}),
  Object.freeze({id:'three-games',name:'Trading Lab Explorer',description:'Complete verified sessions in three different trading games.',xp:140}),
  Object.freeze({id:'three-day-streak',name:'Three-Day Discipline',description:'Complete verified trading practice on three consecutive UTC days.',xp:160}),
  Object.freeze({id:'mastery-90',name:'Market Mastery',description:'Reach 90+ best mastery in any trading game.',xp:220}),
  Object.freeze({id:'level-10',name:'Championship Access',description:'Reach Trading Arcade Level 10.',xp:300}),
]);

export const DAILY_CHALLENGE_TEMPLATES=Object.freeze([
  Object.freeze({id:'play-two',label:'Complete Two Verified Trading Sessions',metric:'sessions',target:2,rewardXp:70}),
  Object.freeze({id:'mastery-70',label:'Score 70+ Overall Mastery',metric:'mastery70',target:1,rewardXp:90}),
  Object.freeze({id:'risk-80',label:'Hold 80+ Risk Discipline',metric:'risk80',target:1,rewardXp:90}),
  Object.freeze({id:'positive-r',label:'Finish a Positive-R Session',metric:'positiveR',target:1,rewardXp:80}),
  Object.freeze({id:'two-games',label:'Practice Two Different Trading Games',metric:'distinctGames',target:2,rewardXp:100}),
  Object.freeze({id:'clean-run',label:'Complete a No-Violation Session',metric:'cleanRuns',target:1,rewardXp:100}),
]);

function clamp(value,min,max){return Math.max(min,Math.min(max,Number(value)||0));}
function hashString(value){let h=2166136261>>>0;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;}

export function xpForLevel(level){const lv=Math.max(1,Math.min(MAX_ARCADE_LEVEL,Math.trunc(Number(level)||1)));return Math.round(125*Math.pow(lv-1,2));}
export function levelFromXp(totalXp){const xp=Math.max(0,Number(totalXp)||0);return Math.max(1,Math.min(MAX_ARCADE_LEVEL,Math.floor(Math.sqrt(xp/125))+1));}
export function levelProgress(totalXp){const xp=Math.max(0,Math.trunc(Number(totalXp)||0)),level=levelFromXp(xp),floor=xpForLevel(level),ceiling=level>=MAX_ARCADE_LEVEL?floor:xpForLevel(level+1),span=Math.max(1,ceiling-floor);return Object.freeze({level,totalXp:xp,levelXp:Math.max(0,xp-floor),nextLevelXp:level>=MAX_ARCADE_LEVEL?0:Math.max(0,ceiling-xp),levelProgress:level>=MAX_ARCADE_LEVEL?1:clamp((xp-floor)/span,0,1)});}
export function floorUnlockState(level){const lv=Math.max(1,Math.trunc(Number(level)||1));return Object.freeze(Object.fromEntries(Object.entries(FLOOR_LEVELS).map(([floor,requiredLevel])=>[floor,Object.freeze({floor,requiredLevel,unlocked:lv>=requiredLevel})])));}
export function masteryTier(bestMastery){const score=clamp(bestMastery,0,100);if(score>=92)return'MASTER';if(score>=80)return'ELITE';if(score>=65)return'SKILLED';if(score>=50)return'APPRENTICE';return'ROOKIE';}

export function computeRunXp({education={},verified={},cultureCoinAwarded=0}={}){
  const weighted=clamp(education.weighted,0,100),risk=clamp(education.riskDiscipline,0,100),completion=clamp(verified.completion,0,1),execution=clamp(education.execution,0,100);
  const positiveR=Number(verified.realizedR||0)>0?20:0,discipline=risk>=90?18:risk>=80?10:0,learning=Math.round(weighted*.55),executionXp=Math.round(execution*.20),completionXp=Math.round(completion*30),participation=15,coinSignal=Math.min(10,Math.max(0,Math.trunc(Number(cultureCoinAwarded)||0)));
  let xp=participation+learning+executionXp+completionXp+positiveR+discipline+coinSignal;
  if(Number(verified.trades||0)===0)xp=Math.min(xp,20);
  else if(Number(verified.goodEntries||0)===0)xp=Math.min(xp,35);
  return Math.max(10,Math.min(180,Math.round(xp)));
}

export function utcDateKey(value=new Date()){const date=value instanceof Date?value:new Date(value);if(Number.isNaN(date.getTime()))throw new TypeError('Invalid date.');return date.toISOString().slice(0,10);}
export function seasonId(value=new Date()){return `S${utcDateKey(value).slice(0,7)}`;}
export function dailyChallenges(value=new Date()){const key=utcDateKey(value),start=hashString(key)%DAILY_CHALLENGE_TEMPLATES.length,selected=[];for(let offset=0;selected.length<3;offset+=1){const challenge=DAILY_CHALLENGE_TEMPLATES[(start+offset*2)%DAILY_CHALLENGE_TEMPLATES.length];if(!selected.some((item)=>item.id===challenge.id))selected.push(challenge);}return Object.freeze(selected.map((challenge)=>Object.freeze({...challenge,date:key})));}
export function challengeMetricDelta(challenge,{education={},verified={},gameId='',distinctGamesToday=[]}={}){switch(challenge.metric){case'sessions':return 1;case'mastery70':return Number(education.weighted||0)>=70?1:0;case'risk80':return Number(education.riskDiscipline||0)>=80?1:0;case'positiveR':return Number(verified.realizedR||0)>0?1:0;case'distinctGames':return new Set([...(distinctGamesToday||[]),String(gameId)]).size;case'cleanRuns':return Number(verified.riskViolations||0)===0&&Number(verified.chaseEntries||0)===0?1:0;default:return 0;}}
export function achievementCandidates({finalized=0,distinctGames=0,streak=0,level=1,bestMastery=0,education={}}={}){const ids=[];if(finalized>=1)ids.push('first-run');if(Number(education.weighted||0)>=70)ids.push('student-70');if(Number(education.riskDiscipline||0)>=90)ids.push('risk-90');if(finalized>=5)ids.push('five-runs');if(distinctGames>=3)ids.push('three-games');if(streak>=3)ids.push('three-day-streak');if(Math.max(Number(bestMastery||0),Number(education.weighted||0))>=90)ids.push('mastery-90');if(level>=10)ids.push('level-10');return Object.freeze(ids);}
export function enrichCatalogForLevel(catalog=[],level=1){const floors=floorUnlockState(level);return catalog.map((game)=>{const gate=floors[game.floor]||Object.freeze({requiredLevel:1,unlocked:true}),baseStatus=game.status,locked=baseStatus==='playable'&&!gate.unlocked;return Object.freeze({...game,baseStatus,locked,requiredLevel:gate.requiredLevel,status:locked?'locked':baseStatus});});}
