function day(value,timeZone='America/New_York'){return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(value);}

export class PresenceEngine{
  constructor({timeZone='America/New_York',awayMs=6*60*60*1000,cooldownMs=30*60*1000}={}){Object.assign(this,{timeZone,awayMs,cooldownMs});}
  evaluate(record={},event={},now=new Date()){
    const nowMs=now.getTime(),lastSeen=Date.parse(record.lastSeenAt||0)||0,lastGreeting=Date.parse(record.lastGreetingAt||0)||0,eventId=String(event.eventId||'');
    if(eventId&&(record.dismissedNotices||[]).includes(eventId))return {show:false,reason:'dismissed'};
    if(lastGreeting&&nowMs-lastGreeting<this.cooldownMs&&!event.force)return {show:false,reason:'cooldown'};
    let type=null;if(!record.firstSeenAt)type='FIRST_LOGIN';else if(record.lastDailyGreetingDate!==day(now,this.timeZone))type='DAILY_GREETING';else if(lastSeen&&nowMs-lastSeen>=this.awayMs)type='RETURN_AFTER_AWAY';else if(event.type)type=String(event.type).toUpperCase();
    if(!type)return {show:false,reason:'no_qualifying_event'};
    return {show:true,type,eventId:eventId||`${type}:${day(now,this.timeZone)}`,absenceMs:lastSeen?nowMs-lastSeen:null,patch:{firstSeenAt:record.firstSeenAt||now.toISOString(),lastSeenAt:now.toISOString(),lastLoginAt:now.toISOString(),lastDailyGreetingDate:day(now,this.timeZone),lastGreetingType:type,lastGreetingAt:now.toISOString()}};
  }
}
