import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'node:crypto';

export const defaults = {room:'Trading room',greeting:'Welcome home.',arrivalEnabled:false,requireDoor:true,awaySeconds:60,awayAction:'notify',phoneSource:'',doorSource:'',occupancySource:''};
const states={phone:['home','away','unknown'],door:['open','closed','unknown'],occupancy:['occupied','vacant','unknown']};
const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
const hash=token=>createHash('sha256').update(token).digest('hex');
export function validateSettings(input={}){
  const out={...defaults};
  for(const key of ['room','greeting']){if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>(key==='room'?80:180))throw fail('Enter a room and a greeting (up to 180 characters).');out[key]=input[key].trim();}
  for(const key of ['arrivalEnabled','requireDoor']){if(typeof input[key]!=='boolean')throw fail('Invalid presence option.');out[key]=input[key];}
  if(!Number.isInteger(input.awaySeconds)||input.awaySeconds<15||input.awaySeconds>900)throw fail('Away delay must be 15–900 seconds.');
  if(!['notify','review','none'].includes(input.awayAction))throw fail('Presence cannot authorize trading.');
  out.awaySeconds=input.awaySeconds;out.awayAction=input.awayAction;
  for(const key of ['phoneSource','doorSource','occupancySource']){out[key]=String(input[key]||'');if(out[key]&&!/^[0-9a-f-]{36}$/.test(out[key]))throw fail('Invalid source.');}
  return out;
}

// Sensor evidence changes awareness only. This module has no trading command dependency.
export function evaluatePresence(settings, sources, previous={}, now=Date.now()){
  const runtime={...previous,notices:[...(previous.notices||[])]};
  const source=(id,kind)=>sources.find(x=>x.source_id===id&&x.kind===kind&&!x.revoked);
  const fresh=(row,ms)=>row&&now-Date.parse(row.last_seen_at)>=0&&now-Date.parse(row.last_seen_at)<ms;
  const phone=source(settings.phoneSource,'phone'),door=source(settings.doorSource,'door'),desk=source(settings.occupancySource,'occupancy');
  const phoneAt=Date.parse(phone?.state_since),doorAt=Date.parse(door?.state_since);
  const phoneKey=Number.isFinite(phoneAt)?new Date(phoneAt).toISOString():'';
  const deskAt=Date.parse(desk?.state_since),deskKey=Number.isFinite(deskAt)?new Date(deskAt).toISOString():'';
  const arrived=fresh(phone,180000)&&phone.state==='home'&&now-phoneAt<180000;
  const entered=fresh(door,180000)&&door.state==='open'&&now-doorAt<180000&&Math.abs(doorAt-phoneAt)<180000;
  const add=(type,text)=>runtime.notices.push({id:randomUUID(),type,text,at:new Date(now).toISOString(),status:'recorded'});
  if(settings.arrivalEnabled&&arrived&&(!settings.requireDoor||entered)&&runtime.arrivalKey!==phoneKey&&now-(runtime.lastGreetingAt||0)>300000){
    add('arrival',settings.greeting);runtime.arrivalKey=phoneKey;runtime.lastGreetingAt=now;
  }
  runtime.deskState=!fresh(desk,90000)||desk.state==='unknown'?'unknown':desk.state;
  if(runtime.deskState==='vacant'&&now-deskAt>=settings.awaySeconds*1000&&runtime.awayKey!==deskKey){
    runtime.awayKey=deskKey;
    if(settings.awayAction!=='none')add('away',settings.awayAction==='review'?'Desk vacant. Review your trading mode in Command Center; trading has not changed.':'Desk vacant. Your trading settings have not changed.');
  }
  runtime.notices=runtime.notices.slice(-30);
  return runtime;
}

// Health describes observed evidence only; it never certifies a person's identity
// or authorizes a trading command. Phone/door sources are event-driven, while
// occupancy sources require recurring heartbeats.
export function sourceHealth(settings, sources, now=Date.now()){
  const kinds=[['phone','phoneSource',180000],['door','doorSource',180000],['occupancy','occupancySource',90000]];
  return Object.fromEntries(kinds.map(([kind,key,freshMs])=>{
    const selectedId=settings[key];
    if(!selectedId)return [kind,{status:'not_configured',state:'unknown',lastSeenAt:null,ageSeconds:null}];
    const row=sources.find(x=>x.source_id===selectedId&&x.kind===kind);
    if(!row||row.revoked)return [kind,{status:'unavailable',state:'unknown',lastSeenAt:null,ageSeconds:null}];
    const observed=Date.parse(row.last_seen_at);
    if(!Number.isFinite(observed)||observed>now+10000)return [kind,{status:'awaiting_event',state:'unknown',lastSeenAt:null,ageSeconds:null}];
    const ageSeconds=Math.max(0,Math.floor((now-observed)/1000));
    return [kind,{
      status:now-observed<freshMs?'recent':kind==='occupancy'?'heartbeat_stale':'event_old',
      state:row.state||'unknown',
      lastSeenAt:new Date(observed).toISOString(),
      ageSeconds,
    }];
  }));
}

export class PresenceStudioService{
  constructor(pool){this.pool=pool;}
  async ensure(owner){await this.pool.query('INSERT INTO wisdo_presence_studio(owner_user_id) VALUES($1) ON CONFLICT DO NOTHING',[owner]);}
  async snapshot(owner){
    await this.ensure(owner);
    const [p,s]=await Promise.all([this.pool.query('SELECT settings,runtime FROM wisdo_presence_studio WHERE owner_user_id=$1',[owner]),this.pool.query('SELECT source_id,name,kind,revoked,last_seen_at,state,state_since FROM wisdo_presence_sources WHERE owner_user_id=$1 ORDER BY created_at',[owner])]);
    const settings={...defaults,...p.rows[0].settings};
    return {settings,sources:s.rows,sourceHealth:sourceHealth(settings,s.rows),runtime:{...p.rows[0].runtime,deskState:evaluatePresence(settings,s.rows,p.rows[0].runtime).deskState}};
  }
  async save(owner,input){
    const settings=validateSettings(input);await this.ensure(owner);
    for(const [key,kind] of [['phoneSource','phone'],['doorSource','door'],['occupancySource','occupancy']])if(settings[key]){
      const result=await this.pool.query('SELECT source_id FROM wisdo_presence_sources WHERE source_id=$1 AND owner_user_id=$2 AND kind=$3 AND revoked=false',[settings[key],owner,kind]);
      if(!result.rows.length)throw fail('Choose one of your active sources.',403);
    }
    await this.pool.query('UPDATE wisdo_presence_studio SET settings=$2::jsonb,updated_at=now() WHERE owner_user_id=$1',[owner,JSON.stringify(settings)]);return settings;
  }
  async createSource(owner,input){
    if(!states[input.kind]||typeof input.name!=='string'||!input.name.trim()||input.name.length>80)throw fail('Choose a source type and name (up to 80 characters).');
    await this.ensure(owner);
    const token=randomBytes(32).toString('hex'),id=randomUUID();
    const result=await this.pool.query('INSERT INTO wisdo_presence_sources(source_id,owner_user_id,name,kind,token_hash) SELECT $1,$2,$3,$4,$5 WHERE (SELECT count(*) FROM wisdo_presence_sources WHERE owner_user_id=$2 AND revoked=false)<20 RETURNING source_id',[id,owner,input.name.trim(),input.kind,hash(token)]);
    if(!result.rows.length)throw fail('Revoke an unused source before adding more.',409);
    return {sourceId:id,token,kind:input.kind};
  }
  async revoke(owner,id){
    const result=await this.pool.query('UPDATE wisdo_presence_sources SET revoked=true WHERE source_id=$1 AND owner_user_id=$2 RETURNING source_id',[id,owner]);
    if(!result.rows.length)throw fail('Source not found.',404);
  }
  async ingest(id,token,event){
    if(!/^[0-9a-f-]{36}$/.test(id)||!/^[a-f0-9]{64}$/.test(token))throw fail('Invalid source credentials.',401);
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const found=await client.query('SELECT * FROM wisdo_presence_sources WHERE source_id=$1 AND revoked=false',[id]);
      const source=found.rows[0];
      if(!source||!timingSafeEqual(Buffer.from(source.token_hash,'hex'),Buffer.from(hash(token),'hex')))throw fail('Invalid source credentials.',401);
      if(!states[source.kind].includes(event.state)||typeof event.eventId!=='string'||!/^[-a-zA-Z0-9_:]{1,100}$/.test(event.eventId))throw fail('Invalid event state or eventId.');
      const observed=Date.parse(event.observedAt),now=Date.now();
      if(!Number.isFinite(observed)||observed>now+10000||now-observed>90000)throw fail('Stale event. Send a current observation.');
      const profile=await client.query('SELECT settings,runtime FROM wisdo_presence_studio WHERE owner_user_id=$1 FOR UPDATE',[source.owner_user_id]);
      const current=await client.query('SELECT * FROM wisdo_presence_sources WHERE source_id=$1 FOR UPDATE',[id]);
      if(current.rows[0].revoked)throw fail('Source revoked.',401);
      if(current.rows[0].last_event_id===event.eventId||observed<=Date.parse(current.rows[0].last_seen_at)){
        await client.query('COMMIT');return {duplicate:true};
      }
      // A disconnected occupancy source cannot establish vacancy during the missing interval.
      await client.query(`UPDATE wisdo_presence_sources SET state_since=CASE WHEN state IS DISTINCT FROM $2 OR ($5='occupancy' AND last_seen_at<$3::timestamptz-interval '90 seconds') THEN $3::timestamptz ELSE state_since END,state=$2,last_seen_at=$3,last_event_id=$4 WHERE source_id=$1`,[id,event.state,new Date(observed).toISOString(),event.eventId,source.kind]);
      const sources=await client.query('SELECT source_id,kind,state,state_since,last_seen_at,revoked FROM wisdo_presence_sources WHERE owner_user_id=$1',[source.owner_user_id]);
      const runtime=evaluatePresence({...defaults,...profile.rows[0].settings},sources.rows,profile.rows[0].runtime,now);
      await client.query('UPDATE wisdo_presence_studio SET runtime=$2::jsonb,updated_at=now() WHERE owner_user_id=$1',[source.owner_user_id,JSON.stringify(runtime)]);
      await client.query('COMMIT');return {accepted:true,tradingChanged:false};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
}
