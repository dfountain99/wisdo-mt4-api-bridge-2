import crypto from 'node:crypto';

const fail=(statusCode,code,message)=>Object.assign(new Error(message),{statusCode,code});
const uid=value=>String(value??'').trim().slice(0,200);
const MAX_MEMBERS=4;

export class StreetSprintPartyService {
  constructor({pool}={}){
    if(!pool?.query||!pool?.connect)throw new TypeError('StreetSprintPartyService requires a PostgreSQL pool.');
    this.pool=pool;
    this.schemaPromise=null;
  }
  async schema(){
    if(!this.schemaPromise)this.schemaPromise=this.pool.query(`
      CREATE TABLE IF NOT EXISTS wisdo_race_parties (
        id UUID PRIMARY KEY, owner_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'waiting',
        duration_minutes INTEGER NOT NULL CHECK(duration_minutes IN (5,15)),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS wisdo_race_party_members (
        party_id UUID NOT NULL REFERENCES wisdo_race_parties(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('invited','joined','ready')),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(party_id,user_id)
      );
      CREATE INDEX IF NOT EXISTS wisdo_race_party_members_user ON wisdo_race_party_members(user_id,updated_at DESC);
    `).catch(error=>{this.schemaPromise=null;throw error});
    return this.schemaPromise;
  }
  async transaction(fn){
    await this.schema();const client=await this.pool.connect();
    try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}
    catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }
  async get(partyId,userId,client=this.pool,{lock=false}={}){
    const id=String(partyId||'');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw fail(400,'invalid_party','Invalid party ID.');
    const result=await client.query(`SELECT * FROM wisdo_race_parties WHERE id=$1 ${lock?'FOR UPDATE':''}`,[id]);
    const party=result.rows[0];
    if(!party||new Date(party.expires_at).getTime()<=Date.now())throw fail(404,'party_not_found','Party not found or expired.');
    const members=(await client.query(`SELECT user_id,status FROM wisdo_race_party_members WHERE party_id=$1 ORDER BY updated_at ASC`,[id])).rows;
    if(!members.some(row=>row.user_id===uid(userId)))throw fail(404,'party_not_found','Party not found.');
    return {id:party.id,ownerId:party.owner_id,status:party.status,durationMinutes:party.duration_minutes,expiresAt:party.expires_at,members};
  }
  async create(userId,durationMinutes=5){
    const owner=uid(userId),duration=Number(durationMinutes);
    if(!owner)throw fail(401,'authentication_required','Sign in first.');
    if(![5,15].includes(duration))throw fail(400,'invalid_duration','Choose a 5 or 15 minute race.');
    const id=crypto.randomUUID();
    return this.transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`wisdo-race-owner:${owner}`]);
      const existing=await client.query(`SELECT id FROM wisdo_race_parties WHERE owner_id=$1 AND status='waiting' AND expires_at>NOW() LIMIT 1`,[owner]);
      if(existing.rows.length)throw fail(409,'party_already_open','Close your existing party before making another.');
      await client.query(`INSERT INTO wisdo_race_parties(id,owner_id,duration_minutes,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '30 minutes')`,[id,owner,duration]);
      await client.query(`INSERT INTO wisdo_race_party_members(party_id,user_id,status) VALUES($1,$2,'joined')`,[id,owner]);
      return this.get(id,owner,client);
    });
  }
  async list(userId){
    await this.schema();const user=uid(userId);
    const rows=await this.pool.query(`SELECT p.id FROM wisdo_race_parties p JOIN wisdo_race_party_members m ON m.party_id=p.id WHERE m.user_id=$1 AND p.status='waiting' AND p.expires_at>NOW() ORDER BY p.created_at DESC LIMIT 20`,[user]);
    return Promise.all(rows.rows.map(row=>this.get(row.id,user)));
  }
  async invite(id,ownerId,targetId){
    const target=uid(targetId),owner=uid(ownerId);
    if(!target||target!==String(targetId??'').trim()||/[\u0000-\u001f]/.test(target)||target===owner)throw fail(400,'invalid_invitee','Choose another valid WISDO user ID.');
    return this.transaction(async client=>{
      const party=await this.get(id,owner,client,{lock:true});
      if(party.ownerId!==owner)throw fail(403,'party_owner_required','Only the host can invite players.');
      if(party.status!=='waiting')throw fail(409,'party_closed','This party is closed.');
      if(party.members.length>=MAX_MEMBERS&&!party.members.some(row=>row.user_id===target))throw fail(409,'party_full','Party is full.');
      await client.query(`INSERT INTO wisdo_race_party_members(party_id,user_id,status) VALUES($1,$2,'invited') ON CONFLICT(party_id,user_id) DO NOTHING`,[id,target]);
      return this.get(id,owner,client);
    });
  }
  async join(id,userId){
    return this.transaction(async client=>{
      const party=await this.get(id,userId,client,{lock:true});
      if(party.status!=='waiting')throw fail(409,'party_closed','This party is closed.');
      const member=party.members.find(row=>row.user_id===uid(userId));
      if(member.status==='invited')await client.query(`UPDATE wisdo_race_party_members SET status='joined',updated_at=NOW() WHERE party_id=$1 AND user_id=$2`,[id,uid(userId)]);
      return this.get(id,userId,client);
    });
  }
  async ready(id,userId,isReady){
    return this.transaction(async client=>{
      const party=await this.get(id,userId,client,{lock:true});
      if(party.status!=='waiting')throw fail(409,'party_closed','This party is closed.');
      if(!party.members.some(row=>row.user_id===uid(userId)&&row.status!=='invited'))throw fail(403,'invite_not_accepted','Accept the invitation first.');
      await client.query(`UPDATE wisdo_race_party_members SET status=$3,updated_at=NOW() WHERE party_id=$1 AND user_id=$2`,[id,uid(userId),isReady===true?'ready':'joined']);
      return this.get(id,userId,client);
    });
  }
  async leave(id,userId){
    return this.transaction(async client=>{
      const party=await this.get(id,userId,client,{lock:true});
      if(party.ownerId===uid(userId))await client.query(`UPDATE wisdo_race_parties SET status='closed' WHERE id=$1`,[id]);
      else await client.query(`DELETE FROM wisdo_race_party_members WHERE party_id=$1 AND user_id=$2`,[id,uid(userId)]);
      return {closed:party.ownerId===uid(userId)};
    });
  }
}
