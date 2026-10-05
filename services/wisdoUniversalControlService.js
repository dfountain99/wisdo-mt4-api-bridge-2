import { compatibilityPlan, normalizeUniversalDevice, WISDO_ADAPTERS, WISDO_DEVICE_CLASSES, WISDO_PROTOCOLS } from './wisdoUniversalDeviceFabricService.js';
import crypto from 'node:crypto';

const clean=(v,n=300)=>String(v??'').trim().slice(0,n);
const obj=(v,f={})=>(v&&typeof v==='object'&&!Array.isArray(v)?v:f);

export function smartHomeRiskFloor(component={},action=''){
  const type=String(component.component_type||component.type||'').toLowerCase();
  const name=String(component.name||'').toLowerCase();
  const metadata=obj(component.metadata);
  const deviceClass=String(metadata.device_class||metadata.deviceClass||'').toLowerCase();
  const verb=String(action||'').toLowerCase();
  if(verb==='unlock')return 5;
  if(type==='alarm_control_panel'||verb==='disarm'||verb==='arm_away'||verb==='arm_home')return 5;
  if(type==='siren')return 4;
  if(type==='cover'&&(deviceClass==='garage'||/garage/.test(name))&&['open','close','stop','set_position'].includes(verb))return 4;
  if(type==='lock'&&verb==='lock')return 2;
  if(type==='scene'&&/emergency/.test(name))return 4;
  if(type==='cover'||type==='climate'||type==='water_heater')return 2;
  return 1;
}

export class WisdoUniversalControlService {
  constructor({pool, commandBusService, logger=console}={}) {
    this.pool=pool; this.commandBusService=commandBusService; this.logger=logger;
  }

  async registerComponent(device,input={}) {
    const componentId=clean(input.component_id||input.componentId||crypto.randomUUID(),200);
    const status=['online','offline','unavailable'].includes(String(input.status||'').toLowerCase())?String(input.status).toLowerCase():'online';
    const normalized=normalizeUniversalDevice(input);
    const homeManaged=input.requiresApproval===true||normalized.metadata.smart_home===true||WISDO_ADAPTERS.some((adapter)=>adapter.id===normalized.adapterId);
    const approvalStatus=homeManaged?'pending':'approved';
    const homeId=clean(input.home_id||input.homeId||normalized.metadata.home_id||'',200)||null;
    const result=await this.pool.query(`INSERT INTO wisdo_components
      (component_id,owner_user_id,device_id,component_type,name,aliases,capabilities,state,metadata,status,
       approval_status,home_id,adapter_id,protocols,last_seen_at,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14::jsonb,NOW(),NOW(),NOW())
      ON CONFLICT(component_id) DO UPDATE SET device_id=EXCLUDED.device_id,component_type=EXCLUDED.component_type,
      name=EXCLUDED.name,aliases=EXCLUDED.aliases,capabilities=EXCLUDED.capabilities,state=EXCLUDED.state,
      metadata=EXCLUDED.metadata,status=EXCLUDED.status,home_id=COALESCE(EXCLUDED.home_id,wisdo_components.home_id),
      adapter_id=EXCLUDED.adapter_id,protocols=EXCLUDED.protocols,last_seen_at=NOW(),updated_at=NOW()
      RETURNING *`,[
      componentId,device.owner_user_id,device.device_id,normalized.componentType,
      clean(input.name||componentId,200),JSON.stringify(input.aliases||[]),JSON.stringify(normalized.capabilities),
      JSON.stringify(obj(input.state)),JSON.stringify(normalized.metadata),status,approvalStatus,homeId,
      normalized.adapterId,JSON.stringify(normalized.protocols)]);
    return result.rows[0];
  }

  async listComponents(device,filters={}) {
    const result=await this.pool.query(`SELECT * FROM wisdo_components WHERE owner_user_id=$1
      AND ($2='' OR component_type=$2) AND ($3='' OR status=$3)
      AND ($4='' OR approval_status=$4) AND ($5='' OR home_id=$5)
      ORDER BY approval_status,component_type,name`,
      [device.owner_user_id,clean(filters.type,60),clean(filters.status,30),clean(filters.approval||filters.approval_status,30),clean(filters.home_id||filters.homeId,200)]);
    return result.rows;
  }

  async createHome(device,input={}) {
    const name=clean(input.name||'Home',120);
    if(!name){const error=new Error('home name is required.');error.statusCode=400;throw error;}
    const homeId=clean(input.home_id||input.homeId||crypto.randomUUID(),200);
    const row=(await this.pool.query(`INSERT INTO wisdo_homes(home_id,owner_user_id,name,status,metadata,created_at,updated_at)
      VALUES($1,$2,$3,'active',$4::jsonb,NOW(),NOW())
      ON CONFLICT(owner_user_id,name) DO UPDATE SET metadata=EXCLUDED.metadata,status='active',updated_at=NOW()
      RETURNING *`,[homeId,device.owner_user_id,name,JSON.stringify(obj(input.metadata))])).rows[0];
    return row;
  }

  async listHomes(device) {
    return (await this.pool.query(`SELECT * FROM wisdo_homes WHERE owner_user_id=$1 AND status='active' ORDER BY name`,[device.owner_user_id])).rows;
  }

  async assertOwnedHome(device,homeId) {
    const id=clean(homeId,200);
    if(!id){const error=new Error('homeId is required before a discovered device can be approved.');error.statusCode=400;error.code='home_binding_required';throw error;}
    const row=(await this.pool.query(`SELECT home_id FROM wisdo_homes WHERE home_id=$1 AND owner_user_id=$2 AND status='active' LIMIT 1`,[id,device.owner_user_id])).rows[0];
    if(!row){const error=new Error('The requested home does not belong to this owner or is inactive.');error.statusCode=403;error.code='home_not_owned';throw error;}
    return id;
  }

  async assertOwnedEdge(device,edgeDeviceId) {
    const id=clean(edgeDeviceId||device.device_id,200);
    const row=(await this.pool.query(`SELECT device_id FROM wisdo_devices WHERE device_id=$1 AND owner_user_id=$2 AND status='active' LIMIT 1`,[id,device.owner_user_id])).rows[0];
    if(!row){const error=new Error('The requested edge device is not an active device owned by this user.');error.statusCode=403;error.code='edge_not_owned';throw error;}
    return id;
  }

  async bindAdapter(device,input={}) {
    const homeId=await this.assertOwnedHome(device,input.home_id||input.homeId);
    const edgeDeviceId=await this.assertOwnedEdge(device,input.edge_device_id||input.edgeDeviceId||device.device_id);
    const adapterId=clean(input.adapter_id||input.adapterId,120);
    if(!WISDO_ADAPTERS.some((adapter)=>adapter.id===adapterId)){const error=new Error('Unknown adapterId.');error.statusCode=400;throw error;}
    const sourceInstanceId=clean(input.source_instance_id||input.sourceInstanceId||'',200);
    if(!sourceInstanceId){const error=new Error('sourceInstanceId is required.');error.statusCode=400;throw error;}
    const bindingId=clean(input.binding_id||input.bindingId||crypto.randomUUID(),200);
    return (await this.pool.query(`INSERT INTO wisdo_adapter_bindings(binding_id,owner_user_id,home_id,edge_device_id,adapter_id,source_instance_id,status,metadata,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,'active',$7::jsonb,NOW(),NOW())
      ON CONFLICT(owner_user_id,edge_device_id,adapter_id,source_instance_id)
      DO UPDATE SET home_id=EXCLUDED.home_id,status='active',metadata=EXCLUDED.metadata,updated_at=NOW()
      RETURNING *`,[bindingId,device.owner_user_id,homeId,edgeDeviceId,adapterId,sourceInstanceId,JSON.stringify(obj(input.metadata))])).rows[0];
  }

  async listAdapterBindings(device) {
    return (await this.pool.query(`SELECT * FROM wisdo_adapter_bindings WHERE owner_user_id=$1 AND status='active' ORDER BY adapter_id,created_at`,[device.owner_user_id])).rows;
  }

  async assertComponentBinding(device,componentId,homeId) {
    const row=(await this.pool.query(`SELECT c.component_id,c.device_id,c.adapter_id,c.metadata->>'source_instance_id' AS source_instance_id,
      EXISTS(SELECT 1 FROM wisdo_adapter_bindings b WHERE b.owner_user_id=c.owner_user_id AND b.home_id=$1
        AND b.edge_device_id=c.device_id AND b.adapter_id=c.adapter_id AND b.source_instance_id=c.metadata->>'source_instance_id' AND b.status='active') AS source_bound
      FROM wisdo_components c WHERE c.component_id=$2 AND c.owner_user_id=$3 LIMIT 1`,
      [homeId,clean(componentId,200),device.owner_user_id])).rows[0];
    if(!row){const error=new Error('Component was not found.');error.statusCode=404;throw error;}
    if(row.source_instance_id && !row.source_bound){const error=new Error('The component source adapter is not bound to this owned home.');error.statusCode=409;error.code='adapter_binding_required';throw error;}
    return row;
  }

  async approveComponent(device,componentId,input={}) {
    const homeId=await this.assertOwnedHome(device,input.home_id||input.homeId);
    await this.assertComponentBinding(device,componentId,homeId);
    const result=await this.pool.query(`UPDATE wisdo_components
      SET approval_status='approved',home_id=$1,approved_at=NOW(),approved_by=$2,revoked_at=NULL,updated_at=NOW()
      WHERE component_id=$3 AND owner_user_id=$4 AND approval_status IN ('pending','revoked')
      RETURNING *`,[homeId,device.device_id,clean(componentId,200),device.owner_user_id]);
    if(!result.rows[0]){const error=new Error('Component was not found or is already approved.');error.statusCode=404;throw error;}
    return result.rows[0];
  }

  async approveComponents(device,input={}) {
    const homeId=await this.assertOwnedHome(device,input.home_id||input.homeId);
    const ids=[...new Set((Array.isArray(input.componentIds)?input.componentIds:[]).map((value)=>clean(value,200)).filter(Boolean))].slice(0,250);
    if(!ids.length){const error=new Error('componentIds are required.');error.statusCode=400;throw error;}
    for(const id of ids)await this.assertComponentBinding(device,id,homeId);
    const rows=(await this.pool.query(`UPDATE wisdo_components
      SET approval_status='approved',home_id=$1,approved_at=NOW(),approved_by=$2,revoked_at=NULL,updated_at=NOW()
      WHERE owner_user_id=$3 AND component_id=ANY($4::text[]) AND approval_status IN ('pending','revoked')
      RETURNING *`,[homeId,device.device_id,device.owner_user_id,ids])).rows;
    return rows;
  }

  async revokeComponent(device,componentId) {
    const result=await this.pool.query(`UPDATE wisdo_components
      SET approval_status='revoked',revoked_at=NOW(),approved_at=NULL,approved_by=$1,updated_at=NOW()
      WHERE component_id=$2 AND owner_user_id=$3 RETURNING *`,[device.device_id,clean(componentId,200),device.owner_user_id]);
    if(!result.rows[0]){const error=new Error('Component was not found.');error.statusCode=404;throw error;}
    return result.rows[0];
  }

  async updateComponentProfile(device,componentId,input={}) {
    const name=clean(input.name||'',200);
    const room=clean(input.room||input.room_id||input.roomId||'',120);
    const aliases=[...new Set((Array.isArray(input.aliases)?input.aliases:[])
      .map((value)=>clean(value,120).toLowerCase()).filter(Boolean))].slice(0,24);
    if(!name&&!room&&!aliases.length){const error=new Error('Provide a name, room, or alias.');error.statusCode=400;throw error;}
    const result=await this.pool.query(`UPDATE wisdo_components
      SET name=CASE WHEN $1='' THEN name ELSE $1 END,
          aliases=CASE WHEN $2::jsonb='[]'::jsonb THEN aliases ELSE $2::jsonb END,
          metadata=CASE WHEN $3='' THEN metadata ELSE jsonb_set(metadata,'{room_id}',to_jsonb($3::text),true) END,
          updated_at=NOW()
      WHERE component_id=$4 AND owner_user_id=$5
      RETURNING *`,[name,JSON.stringify(aliases),room,clean(componentId,200),device.owner_user_id]);
    if(!result.rows[0]){const error=new Error('Component was not found.');error.statusCode=404;throw error;}
    return result.rows[0];
  }

  async onboardingSnapshot(device) {
    const [homes,bindings,components,edges]=await Promise.all([
      this.listHomes(device),
      this.listAdapterBindings(device),
      this.pool.query(`SELECT * FROM wisdo_components WHERE owner_user_id=$1 ORDER BY approval_status,component_type,name`,[device.owner_user_id]),
      this.pool.query(`SELECT device_id,device_name,device_type,status,capabilities,last_seen_at FROM wisdo_devices WHERE owner_user_id=$1 AND status='active' ORDER BY device_name`,[device.owner_user_id]),
    ]);
    const rows=components.rows;
    const normalizeName=(value)=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const duplicateMap=new Map();
    for(const component of rows){
      const metadata=obj(component.metadata);
      const deviceClass=String(metadata.wisdo_device_class||component.component_type||'generic').toLowerCase();
      const key=`${deviceClass}:${normalizeName(component.name)}`;
      if(!normalizeName(component.name))continue;
      const list=duplicateMap.get(key)||[];list.push(component);duplicateMap.set(key,list);
    }
    const possibleDuplicates=[...duplicateMap.entries()].filter(([,items])=>items.length>1).map(([key,items])=>({
      key,
      reason:'Same normalized device class and name. Review before approving; WISDO will not auto-merge.',
      componentIds:items.map((item)=>item.component_id),
      names:items.map((item)=>item.name),
      adapters:[...new Set(items.map((item)=>item.adapter_id).filter(Boolean))],
    }));
    const sourceMap=new Map();
    for(const component of rows){
      const metadata=obj(component.metadata);
      const sourceInstanceId=clean(metadata.source_instance_id||'',200);
      if(!sourceInstanceId)continue;
      const key=`${component.device_id||''}:${component.adapter_id||''}:${sourceInstanceId}`;
      if(!sourceMap.has(key))sourceMap.set(key,{
        edgeDeviceId:component.device_id||'',
        adapterId:component.adapter_id||'unknown',
        sourceInstanceId,
        homeId:component.home_id||null,
        componentCount:0,
        pendingCount:0,
        approvedCount:0,
      });
      const group=sourceMap.get(key);group.componentCount+=1;
      if(component.approval_status==='pending')group.pendingCount+=1;
      if(component.approval_status==='approved')group.approvedCount+=1;
    }
    const sources=[...sourceMap.values()].map((source)=>({
      ...source,
      bound:bindings.some((binding)=>binding.edge_device_id===source.edgeDeviceId&&binding.adapter_id===source.adapterId&&binding.source_instance_id===source.sourceInstanceId&&binding.status==='active'),
    }));
    return {
      version:'22.0',
      homes,
      adapterBindings:bindings,
      edgeDevices:edges.rows,
      pending:rows.filter((row)=>row.approval_status==='pending'),
      approved:rows.filter((row)=>row.approval_status==='approved'),
      revoked:rows.filter((row)=>row.approval_status==='revoked'),
      unavailable:rows.filter((row)=>row.status==='unavailable'||row.status==='offline'),
      sources,
      possibleDuplicates,
      policy:{
        discoveryDoesNotAuthorize:true,
        proximityDoesNotAuthorize:true,
        autoMergeDuplicates:false,
        physicalSecurityRequiresConfirmation:true,
      }
    };
  }

  compatibility(input={}) { return compatibilityPlan(input); }
  fabricManifest() { return {version:'21.0',deviceClasses:WISDO_DEVICE_CLASSES,protocols:WISDO_PROTOCOLS,adapters:WISDO_ADAPTERS}; }

  async resolveComponents(device,selector={}) {
    const raw=clean(selector.id||selector.alias||selector.name||'',200).toLowerCase();
    const type=clean(selector.type||'',60);
    const account=clean(selector.account_id||selector.accountId||'',200);
    const symbol=clean(selector.symbol||'',100).toUpperCase();
    const lane=clean(selector.lane_id||selector.laneId||'',200);
    const result=await this.pool.query(`SELECT * FROM wisdo_components WHERE owner_user_id=$1 AND status='online' AND approval_status='approved'
      AND ($2='' OR component_type=$2)
      AND ($3='' OR lower(component_id)= $3 OR lower(name)= $3 OR aliases ? $3)
      AND ($4='' OR metadata->>'account_id'=$4)
      AND ($5='' OR upper(metadata->>'canonical_symbol')=$5 OR upper(metadata->>'broker_symbol')=$5)
      AND ($6='' OR metadata->>'lane_id'=$6)
      ORDER BY last_seen_at DESC LIMIT 250`,[device.owner_user_id,type,raw,account,symbol,lane]);
    return result.rows;
  }

  async preview(device,input={}) {
    const action=clean(input.action||input.intent,120);
    if(!action){const e=new Error('action is required.');e.statusCode=400;throw e;}
    const targets=await this.resolveComponents(device,obj(input.target));
    if(!targets.length){const e=new Error('No online component matched the requested scope.');e.statusCode=404;throw e;}
    const requestedRisk=Math.max(0,Math.min(5,Number(input.risk_level??input.riskLevel??1)));
    const details=targets.map((target)=>{
      const caps=obj(target.capabilities,{actions:[]});
      const allowed=Array.isArray(caps.actions)?caps.actions.includes(action):Boolean(caps[action]);
      const riskLevel=Math.max(requestedRisk,smartHomeRiskFloor(target,action));
      return {component_id:target.component_id,name:target.name,component_type:target.component_type,allowed,risk_level:riskLevel,state:obj(target.state),metadata:obj(target.metadata)};
    });
    return {action,targets:details,risk_level:Math.max(...details.map((item)=>item.risk_level),0),requires_confirmation:details.some((item)=>item.allowed&&item.risk_level>=4)};
  }

  async execute(device,input={}) {
    const preview=await this.preview(device,input);
    if(preview.requires_confirmation&&input.confirmationVerified!==true){
      const e=new Error('This smart-home action requires explicit confirmation before it can be queued.');
      e.statusCode=409;e.code='home_confirmation_required';e.preview=preview;throw e;
    }
    const executions=[];
    for(const target of preview.targets){
      if(!target.allowed){executions.push({component_id:target.component_id,status:'unsupported',action:preview.action,risk_level:target.risk_level});continue;}
      const id=crypto.randomUUID();
      const row=(await this.pool.query(`INSERT INTO wisdo_control_executions
        (execution_id,owner_user_id,issued_by_device_id,component_id,action,parameters,risk_level,status,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,'queued',NOW(),NOW()) RETURNING *`,[
        id,device.owner_user_id,device.device_id,target.component_id,preview.action,JSON.stringify(obj(input.parameters)),
        target.risk_level])).rows[0];
      executions.push(row);
    }
    return executions;
  }

  async leaseExecutions(device,limit=10) {
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const rows=(await client.query(`SELECT e.*,c.name AS component_name,c.component_type,c.capabilities,c.metadata AS component_metadata,c.protocols,c.adapter_id,c.home_id
        FROM wisdo_control_executions e
        JOIN wisdo_components c ON c.component_id=e.component_id
        WHERE e.owner_user_id=$1 AND c.device_id=$2 AND c.status='online' AND c.approval_status='approved'
          AND (e.status='queued' OR (e.status='leased' AND e.leased_at < NOW()-INTERVAL '45 seconds'))
        ORDER BY e.risk_level DESC,e.created_at ASC
        FOR UPDATE OF e SKIP LOCKED LIMIT $3`,[device.owner_user_id,device.device_id,Math.max(1,Math.min(50,Number(limit||10)))])).rows;
      if(rows.length)await client.query(`UPDATE wisdo_control_executions SET status='leased',leased_at=NOW(),updated_at=NOW() WHERE execution_id=ANY($1::text[])`,[rows.map((row)=>row.execution_id)]);
      await client.query('COMMIT');
      return rows.map((row)=>({...row,status:'leased'}));
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }

  async completeExecution(device,executionId,input={}) {
    const status=['completed','failed','rejected'].includes(String(input.status||''))?String(input.status):'failed';
    const result=await this.pool.query(`UPDATE wisdo_control_executions e
      SET status=$1,result=$2::jsonb,error=$3,completed_at=NOW(),updated_at=NOW()
      FROM wisdo_components c
      WHERE e.execution_id=$4 AND e.component_id=c.component_id
        AND e.owner_user_id=$5 AND c.device_id=$6 AND e.status='leased'
      RETURNING e.*`,[status,JSON.stringify(obj(input.result)),clean(input.error||input.message||'',500)||null,clean(executionId,200),device.owner_user_id,device.device_id]);
    if(!result.rows[0]){const error=new Error('Control execution is not leased to this device.');error.statusCode=409;throw error;}
    return result.rows[0];
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
      this.pool.query(`SELECT count(*)::int AS count FROM wisdo_components WHERE status='online' AND approval_status='approved'`),
      this.pool.query(`SELECT count(*)::int AS count FROM wisdo_control_executions WHERE status IN ('queued','leased','executing')`),
      this.pool.query(`SELECT count(*)::int AS count FROM wisdo_browser_events WHERE status='pending' AND expires_at>NOW()`),
    ]);
    const pending=await this.pool.query(`SELECT count(*)::int AS count FROM wisdo_components WHERE approval_status='pending'`);
    return {ok:true,service:'wisdo-universal-control-plane',version:'4.0.0',approved_online_components:components.rows[0].count,pending_approval_components:pending.rows[0].count,active_executions:queued.rows[0].count,pending_browser_events:browser.rows[0].count};
  }
}
