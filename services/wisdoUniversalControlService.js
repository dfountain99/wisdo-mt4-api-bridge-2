import crypto from 'node:crypto';

const clean=(v,n=300)=>String(v??'').trim().slice(0,n);
const obj=(v,f={})=>(v&&typeof v==='object'&&!Array.isArray(v)?v:f);

export class WisdoUniversalControlService {
  constructor({pool, commandBusService, logger=console}={}) {
    this.pool=pool; this.commandBusService=commandBusService; this.logger=logger;
  }

  async registerComponent(device,input={}) {
    const componentId=clean(input.component_id||input.componentId||crypto.randomUUID(),200);
    const result=await this.pool.query(`INSERT INTO wisdo_components
      (component_id,owner_user_id,device_id,component_type,name,aliases,capabilities,state,metadata,status,last_seen_at,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,'online',NOW(),NOW(),NOW())
      ON CONFLICT(component_id) DO UPDATE SET device_id=EXCLUDED.device_id,component_type=EXCLUDED.component_type,
      name=EXCLUDED.name,aliases=EXCLUDED.aliases,capabilities=EXCLUDED.capabilities,state=EXCLUDED.state,
      metadata=EXCLUDED.metadata,status='online',last_seen_at=NOW(),updated_at=NOW() RETURNING *`,[
      componentId,device.owner_user_id,device.device_id,clean(input.component_type||input.componentType||'generic',60),
      clean(input.name||componentId,200),JSON.stringify(input.aliases||[]),JSON.stringify(obj(input.capabilities)),
      JSON.stringify(obj(input.state)),JSON.stringify(obj(input.metadata))]);
    return result.rows[0];
  }

  async listComponents(device,filters={}) {
    const result=await this.pool.query(`SELECT * FROM wisdo_components WHERE owner_user_id=$1
      AND ($2='' OR component_type=$2) AND ($3='' OR status=$3) ORDER BY component_type,name`,
      [device.owner_user_id,clean(filters.type,60),clean(filters.status,30)]);
    return result.rows;
  }

  async resolveComponents(device,selector={}) {
    const raw=clean(selector.id||selector.alias||selector.name||'',200).toLowerCase();
    const type=clean(selector.type||'',60);
    const account=clean(selector.account_id||selector.accountId||'',200);
    const symbol=clean(selector.symbol||'',100).toUpperCase();
    const lane=clean(selector.lane_id||selector.laneId||'',200);
    const result=await this.pool.query(`SELECT * FROM wisdo_components WHERE owner_user_id=$1 AND status='online'
      AND ($2='' OR component_type=$2)
      AND ($3='' OR lower(component_id)= $3 OR lower(name)= $3 OR aliases ? $3)
      AND ($4='' OR metadata->>'account_id'=$4)
      AND ($5='' OR upper(metadata->>'canonical_symbol')=$5 OR upper(metadata->>'broker_symbol')=$5)
      AND ($6='' OR metadata->>'lane_id'=$6)
      ORDER BY last_seen_at DESC LIMIT 250`,[device.owner_user_id,type,raw,account,symbol,lane]);
    return result.rows;
  }

  async execute(device,input={}) {
    const action=clean(input.action||input.intent,120);
    if(!action){const e=new Error('action is required.');e.statusCode=400;throw e;}
    const targets=await this.resolveComponents(device,obj(input.target));
    if(!targets.length){const e=new Error('No online component matched the requested scope.');e.statusCode=404;throw e;}
    const executions=[];
    for(const target of targets){
      const caps=obj(target.capabilities,{actions:[]});
      const allowed=Array.isArray(caps.actions)?caps.actions.includes(action):Boolean(caps[action]);
      if(!allowed){executions.push({component_id:target.component_id,status:'unsupported',action});continue;}
      const id=crypto.randomUUID();
      const row=(await this.pool.query(`INSERT INTO wisdo_control_executions
        (execution_id,owner_user_id,issued_by_device_id,component_id,action,parameters,risk_level,status,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,'queued',NOW(),NOW()) RETURNING *`,[
        id,device.owner_user_id,device.device_id,target.component_id,action,JSON.stringify(obj(input.parameters)),
        Math.max(0,Math.min(5,Number(input.risk_level??input.riskLevel??1)))])).rows[0];
      executions.push(row);
    }
    return executions;
  }

  async publishWebsiteAction(device,input={}) {
    const eventId=crypto.randomUUID();
    const action=clean(input.action,120);
    if(!action){const e=new Error('website action is required.');e.statusCode=400;throw e;}
    const result=await this.pool.query(`INSERT INTO wisdo_browser_events
      (event_id,owner_user_id,issued_by_device_id,target_session_id,action,payload,status,expires_at,created_at)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,'pending',NOW()+INTERVAL '5 minutes',NOW()) RETURNING *`,[
      eventId,device.owner_user_id,device.device_id,clean(input.session_id||input.sessionId||'',200)||null,action,JSON.stringify(obj(input.payload))]);
    return result.rows[0];
  }

  async pollWebsiteActions(device,sessionId) {
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      const rows=(await client.query(`SELECT * FROM wisdo_browser_events WHERE owner_user_id=$1 AND status='pending'
        AND expires_at>NOW() AND (target_session_id IS NULL OR target_session_id=$2)
        ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 25`,[device.owner_user_id,clean(sessionId,200)])).rows;
      if(rows.length) await client.query(`UPDATE wisdo_browser_events SET status='delivered',delivered_at=NOW()
        WHERE event_id=ANY($1::text[])`,[rows.map(r=>r.event_id)]);
      await client.query('COMMIT'); return rows;
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }

  async health(){
    const [components,queued,browser]=await Promise.all([
      this.pool.query(`SELECT count(*)::int AS count FROM wisdo_components WHERE status='online'`),
      this.pool.query(`SELECT count(*)::int AS count FROM wisdo_control_executions WHERE status IN ('queued','leased','executing')`),
      this.pool.query(`SELECT count(*)::int AS count FROM wisdo_browser_events WHERE status='pending' AND expires_at>NOW()`),
    ]);
    return {ok:true,service:'wisdo-universal-control-plane',version:'3.0.0',online_components:components.rows[0].count,active_executions:queued.rows[0].count,pending_browser_events:browser.rows[0].count};
  }
}
