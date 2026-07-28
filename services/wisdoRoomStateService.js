const clean=(v,n=200)=>String(v??'').trim().slice(0,n);
const obj=(v,f={})=>(v&&typeof v==='object'&&!Array.isArray(v)?v:f);
export class WisdoRoomStateService{
 constructor({pool,logger=console}={}){this.pool=pool;this.logger=logger;}
 async upsert(device,roomId,input={}){
  const id=clean(roomId||input.room_id||input.roomId,120);if(!id){const e=new Error('room_id is required.');e.statusCode=400;throw e;}
  const state=obj(input);
  const r=await this.pool.query(`INSERT INTO wisdo_room_states(room_id,owner_user_id,source_device_id,occupied,face_count,ambient_sound,lighting,active_devices,state,last_seen_at,created_at,updated_at)
   VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,NOW(),NOW(),NOW())
   ON CONFLICT(owner_user_id,room_id) DO UPDATE SET source_device_id=EXCLUDED.source_device_id,occupied=EXCLUDED.occupied,face_count=EXCLUDED.face_count,ambient_sound=EXCLUDED.ambient_sound,lighting=EXCLUDED.lighting,active_devices=EXCLUDED.active_devices,state=EXCLUDED.state,last_seen_at=NOW(),updated_at=NOW() RETURNING *`,[
   id,device.owner_user_id,device.device_id,Boolean(state.occupied),Number(state.face_count||0),JSON.stringify(obj(state.ambient_sound)),JSON.stringify(obj(state.lighting)),JSON.stringify(obj(state.active_devices)),JSON.stringify(state)]);
  await this.pool.query(`INSERT INTO wisdo_event_ledger(event_id,owner_user_id,source_type,source_id,event_type,severity,payload,created_at) VALUES(gen_random_uuid()::text,$1,'room',$2,$3,'info',$4::jsonb,NOW())`,[device.owner_user_id,id,state.presence?.event||'room_state.updated',JSON.stringify({occupied:Boolean(state.occupied),face_count:Number(state.face_count||0)})]);
  return r.rows[0];
 }
 async list(device){return (await this.pool.query(`SELECT * FROM wisdo_room_states WHERE owner_user_id=$1 ORDER BY updated_at DESC`,[device.owner_user_id])).rows;}
 async get(device,roomId){return (await this.pool.query(`SELECT * FROM wisdo_room_states WHERE owner_user_id=$1 AND room_id=$2`,[device.owner_user_id,clean(roomId,120)])).rows[0]||null;}
 async health(){const r=await this.pool.query(`SELECT count(*)::int count,count(*) FILTER (WHERE occupied)::int occupied FROM wisdo_room_states WHERE last_seen_at>NOW()-INTERVAL '5 minutes'`);return {ok:true,service:'wisdo-room-intelligence',version:'3.3.0',online_rooms:r.rows[0].count,occupied_rooms:r.rows[0].occupied};}
}
