import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createDatabaseStateStore } from '../storage/stateStore.js';

const DAYS = Object.freeze(['SUN','MON','TUE','WED','THU','FRI','SAT']);
const ALL_DAYS = Object.freeze([0,1,2,3,4,5,6]);
const WEEKDAYS = Object.freeze([1,2,3,4,5]);
const clean = (value,max=120)=>String(value??'').replace(/\u0000/g,'').trim().slice(0,max);
const hash = (value)=>createHash('sha256').update(String(value)).digest('hex');
const nowIso = ()=>new Date().toISOString();

function initialState(){ return { schedules:{} }; }
function keyFor(userId,accountId){ return `${String(userId)}::${String(accountId)}`; }
function validTime(value){ return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value||'')); }
function timeMinute(value){ const [h,m]=String(value).split(':').map(Number); return h*60+m; }

function validTimezone(value){
  const tz=clean(value,80)||'UTC';
  try { new Intl.DateTimeFormat('en-US',{timeZone:tz}).format(new Date()); return tz; }
  catch { return 'UTC'; }
}

function normalizeDays(value){
  const rows=[...new Set((Array.isArray(value)?value:[]).map(Number).filter((n)=>Number.isInteger(n)&&n>=0&&n<=6))].sort((a,b)=>a-b);
  return rows.length?rows:[...ALL_DAYS];
}

export function normalizeSessionSchedule(input={},previous={}){
  const src=input&&typeof input==='object'?input:{};
  const prev=previous&&typeof previous==='object'?previous:{};
  const windows=(Array.isArray(src.windows)?src.windows:Array.isArray(prev.windows)?prev.windows:[])
    .slice(0,8)
    .map((row,index)=>({
      id:clean(row?.id,50)||`window-${index+1}`,
      start:validTime(row?.start)?String(row.start):'',
      end:validTime(row?.end)?String(row.end):'',
      days:normalizeDays(row?.days),
      label:clean(row?.label,60)||`ACTIVE WINDOW ${index+1}`,
    }))
    .filter((row)=>row.start&&row.end&&row.start!==row.end);
  return {
    version:1,
    enabled:src.enabled!==undefined?Boolean(src.enabled):Boolean(prev.enabled),
    timezone:validTimezone(src.timezone||prev.timezone||'UTC'),
    windows,
    blockOutsideWindows:true,
    createdAt:prev.createdAt||nowIso(),
    updatedAt:nowIso(),
    lastAppliedMode:prev.lastAppliedMode||null,
    lastTransitionAt:prev.lastTransitionAt||null,
    lastCommandId:prev.lastCommandId||null,
    lastCommandAt:prev.lastCommandAt||null,
    enforcementStatus:prev.enforcementStatus||'STANDBY',
    enforcementError:null,
  };
}

function localParts(date,timezone){
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:timezone,weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,
  }).formatToParts(date);
  const get=(type)=>parts.find((part)=>part.type===type)?.value||'';
  const day=DAYS.indexOf(get('weekday').toUpperCase());
  let hour=Number(get('hour')); if(hour===24) hour=0;
  const minute=Number(get('minute')); const second=Number(get('second'));
  return {day:day<0?0:day,hour,minute,second,minuteOfDay:hour*60+minute};
}

function windowActive(row,parts){
  const start=timeMinute(row.start),end=timeMinute(row.end),minute=parts.minuteOfDay;
  if(start<end) return row.days.includes(parts.day)&&minute>=start&&minute<end;
  const prevDay=(parts.day+6)%7;
  return (row.days.includes(parts.day)&&minute>=start)||(row.days.includes(prevDay)&&minute<end);
}

export function evaluateSessionSchedule(schedule,date=new Date()){
  const normalized=normalizeSessionSchedule(schedule,schedule);
  const parts=localParts(date,normalized.timezone);
  if(!normalized.enabled||!normalized.windows.length){
    return {mode:'DISABLED',active:false,window:null,local:parts};
  }
  const activeWindow=normalized.windows.find((row)=>windowActive(row,parts))||null;
  return {mode:activeWindow?'ACTIVE':'BLOCKED',active:Boolean(activeWindow),window:activeWindow,local:parts};
}

function publicSchedule(schedule,status={}){
  if(!schedule) return {
    configured:false,enabled:false,timezone:'UTC',windows:[],mode:'DISABLED',active:false,
    nextTransitionAt:null,secondsToBoundary:null,enforcementStatus:'STANDBY',lastCommandId:null,lastCommandAt:null,
  };
  return {
    configured:Boolean(schedule.windows?.length),
    enabled:Boolean(schedule.enabled),
    timezone:schedule.timezone,
    windows:schedule.windows||[],
    blockOutsideWindows:true,
    mode:status.mode||'DISABLED',
    active:Boolean(status.active),
    activeWindow:status.window||null,
    localMinuteOfDay:status.local?.minuteOfDay??null,
    localDay:status.local?.day??null,
    nextTransitionAt:status.nextTransitionAt||null,
    secondsToBoundary:status.secondsToBoundary??null,
    lastAppliedMode:schedule.lastAppliedMode||null,
    lastTransitionAt:schedule.lastTransitionAt||null,
    lastCommandId:schedule.lastCommandId||null,
    lastCommandAt:schedule.lastCommandAt||null,
    enforcementStatus:schedule.enforcementStatus||'STANDBY',
    enforcementError:schedule.enforcementError||null,
    updatedAt:schedule.updatedAt||null,
  };
}

export class WorldSessionScheduleService {
  constructor({mt4CommandService=null,campaignState=null,eventEngine=null,logger=console,intervalMs=15_000}={}){
    if(!mt4CommandService?.queueCommandForAccount) throw new TypeError('WorldSessionScheduleService requires MT4 command service.');
    if(!campaignState?.snapshot) throw new TypeError('WorldSessionScheduleService requires campaign state service.');
    this.mt4CommandService=mt4CommandService;
    this.campaignState=campaignState;
    this.eventEngine=eventEngine;
    this.logger=logger;
    this.store=createDatabaseStateStore('world_command_sessions',initialState);
    this.proposals=new Map();
    this.nextCache=new Map();
    this.ticking=false;
    this.timer=setInterval(()=>this.tick().catch((error)=>this.logger?.warn?.('WISDO session enforcement tick failed.',{message:error.message})),Math.max(5000,Number(intervalMs)||15000));
    this.timer.unref?.();
  }

  cleanupProposals(){
    const now=Date.now();
    for(const [id,row] of this.proposals) if(row.expiresAtMs<=now||row.usedAt) this.proposals.delete(id);
  }

  async record(userId,accountId){
    const state=await this.store.readHot();
    return state.schedules?.[keyFor(userId,accountId)]||null;
  }

  nextTransition(schedule,now=new Date()){
    const initial=evaluateSessionSchedule(schedule,now);
    if(initial.mode==='DISABLED') return null;
    const bucket=Math.floor(now.getTime()/60_000);
    const cacheKey=`${schedule.updatedAt}:${initial.mode}:${bucket}`;
    const cached=this.nextCache.get(cacheKey);
    if(cached&&cached>now.getTime()) return new Date(cached);
    const base=now.getTime();
    for(let minute=1;minute<=8*24*60;minute+=1){
      const candidate=new Date(base+minute*60_000);
      if(evaluateSessionSchedule(schedule,candidate).mode!==initial.mode){
        const ts=candidate.getTime();
        this.nextCache.clear();
        this.nextCache.set(cacheKey,ts);
        return candidate;
      }
    }
    return null;
  }

  statusFor(schedule,now=new Date()){
    if(!schedule) return publicSchedule(null);
    const status=evaluateSessionSchedule(schedule,now);
    const next=this.nextTransition(schedule,now);
    return publicSchedule(schedule,{
      ...status,
      nextTransitionAt:next?.toISOString()||null,
      secondsToBoundary:next?Math.max(0,Math.floor((next.getTime()-now.getTime())/1000)):null,
    });
  }

  async status(userId,accountId){
    const schedule=await this.record(userId,accountId);
    return this.statusFor(schedule);
  }

  async propose(userId,{accountId='',schedule={}}={}){
    this.cleanupProposals();
    const current=await this.record(userId,accountId);
    const normalized=normalizeSessionSchedule({...schedule,enabled:true},current||{});
    if(!normalized.windows.length){ const error=new Error('Add at least one active trading window before arming WISDO Time.'); error.statusCode=400; throw error; }
    const proposalId=`session-schedule:${randomUUID()}`;
    const token=randomBytes(24).toString('base64url');
    const expiresAtMs=Date.now()+60_000;
    this.proposals.set(proposalId,{
      proposalId,userId:String(userId),accountId:String(accountId),schedule:normalized,
      tokenHash:hash(token),expiresAtMs,usedAt:null,
    });
    return {
      proposalId,confirmationToken:token,holdRequiredMs:1200,
      expiresAt:new Date(expiresAtMs).toISOString(),
      accountId:String(accountId),
      schedule:publicSchedule(normalized,this.statusFor(normalized)),
      executionNotice:'Nothing has been sent to MT4. Hold to arm this recurring server-side schedule.',
    };
  }

  async arm(userId,{proposalId='',confirmationToken='',heldForMs=0}={}){
    this.cleanupProposals();
    const proposal=this.proposals.get(String(proposalId));
    if(!proposal||proposal.userId!==String(userId)){ const error=new Error('Session schedule proposal expired or not found.'); error.statusCode=409; throw error; }
    if(hash(clean(confirmationToken,200))!==proposal.tokenHash){ const error=new Error('Invalid schedule confirmation token.'); error.statusCode=403; throw error; }
    if(Number(heldForMs)<1200){ const error=new Error('Hold confirmation for at least 1200ms to arm WISDO Time.'); error.statusCode=409; throw error; }
    const key=keyFor(userId,proposal.accountId);
    let saved;
    await this.store.update((state)=>{
      const previous=state.schedules?.[key]||{};
      saved=normalizeSessionSchedule({...proposal.schedule,enabled:true},previous);
      state.schedules||={};
      state.schedules[key]=saved;
      return state;
    });
    proposal.usedAt=nowIso();
    await this.enforceOne(String(userId),String(proposal.accountId),saved,{force:true}).catch(()=>null);
    return this.status(userId,proposal.accountId);
  }

  async disable(userId,accountId){
    const key=keyFor(userId,accountId);
    let saved=null;
    await this.store.update((state)=>{
      const previous=state.schedules?.[key];
      if(!previous) return state;
      saved={...previous,enabled:false,updatedAt:nowIso(),enforcementStatus:'DISABLED',enforcementError:null};
      state.schedules[key]=saved;
      return state;
    });
    return this.statusFor(saved);
  }

  async updateScheduleRecord(userId,accountId,patch={}){
    const key=keyFor(userId,accountId);
    await this.store.update((state)=>{
      const previous=state.schedules?.[key];
      if(!previous) return state;
      state.schedules[key]={...previous,...patch,updatedAt:patch.updatedAt||previous.updatedAt};
      return state;
    });
  }

  async enforceOne(userId,accountId,schedule,{force=false}={}){
    if(!schedule?.enabled||!schedule.windows?.length) return;
    const status=evaluateSessionSchedule(schedule,new Date());
    const desired=status.active?'ACTIVE':'BLOCKED';
    if(!force&&schedule.lastAppliedMode===desired) return;
    const snapshot=await this.campaignState.snapshot(userId,{accountId});
    if(!snapshot.account){
      await this.updateScheduleRecord(userId,accountId,{enforcementStatus:'WAITING_ACCOUNT',enforcementError:'Authorized account is unavailable.'});
      return;
    }
    if(!snapshot.executionHealth?.commandLinkReady){
      await this.updateScheduleRecord(userId,accountId,{enforcementStatus:'WAITING_LINK',enforcementError:'Reporter command link is not live.'});
      return;
    }
    if(desired==='ACTIVE'&&snapshot.bot?.enabled===false){
      await this.updateScheduleRecord(userId,accountId,{enforcementStatus:'BLOCKED_BY_BOT',enforcementError:'Bot is paused/disabled; schedule will not resume the bot.'});
      return;
    }
    const command=desired==='ACTIVE'?'START_ENTRIES':'STOP_ENTRIES';
    const payload={
      source:'wisdo_time_schedule',immediate:true,priority:170,ttlMinutes:2,
      confirmation:'armed_session_schedule',sessionMode:desired,scheduleUpdatedAt:schedule.updatedAt,
      clientCommandId:`wisdo-time-${randomUUID()}`,
    };
    const campaign=snapshot.campaigns?.[0];
    if(campaign?.magicNumber!=null) payload.magicNumber=campaign.magicNumber;
    if(campaign?.strategyName) payload.botName=campaign.strategyName;
    const record=await this.mt4CommandService.queueCommandForAccount(userId,snapshot.account.accountId,command,payload);
    await this.updateScheduleRecord(userId,accountId,{
      lastAppliedMode:desired,lastTransitionAt:nowIso(),lastCommandId:record.id||null,lastCommandAt:nowIso(),
      enforcementStatus:'QUEUED',enforcementError:null,
    });
    this.eventEngine?.publish?.('command.schedule_transition',{userId},{
      eventId:`world-session:${record.id||randomUUID()}`,
      detail:{commandId:record.id||null,accountId:snapshot.account.accountId,sessionMode:desired,command},
    });
  }

  async tick(){
    if(this.ticking) return;
    this.ticking=true;
    try{
      const state=await this.store.readHot();
      const entries=Object.entries(state.schedules||{});
      for(const [key,schedule] of entries){
        if(!schedule?.enabled) continue;
        const split=key.indexOf('::');
        if(split<1) continue;
        const userId=key.slice(0,split),accountId=key.slice(split+2);
        try{ await this.enforceOne(userId,accountId,schedule); }
        catch(error){
          await this.updateScheduleRecord(userId,accountId,{enforcementStatus:'ERROR',enforcementError:clean(error.message,220)});
          this.logger?.warn?.('WISDO Time could not apply a session transition.',{userId,accountId,message:error.message});
        }
      }
    }finally{ this.ticking=false; }
  }

  async close(){ clearInterval(this.timer); await this.store.close?.(); }
}

export { ALL_DAYS, WEEKDAYS };
