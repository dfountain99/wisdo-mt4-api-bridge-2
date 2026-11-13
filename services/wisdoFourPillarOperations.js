import crypto from 'node:crypto';

const EVENTS = new Set(['motion','person','vehicle','animal','package','sound','tamper','unknown']);
const ROLES = new Set(['vps','desktop','edge','worker']);
const ID = /^[A-Za-z0-9_.:-]{1,160}$/;

function failure(message, statusCode = 400, code = 'invalid_input') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
function identifier(value, label) {
  const out = String(value ?? '').trim();
  if (!ID.test(out)) throw failure(label + ' must be 1-160 safe characters.');
  return out;
}
function actorId(actor) {
  const id = String(actor?.owner_user_id || '').trim();
  if (!id) throw failure('Authenticated owner is required.', 401, 'unauthenticated');
  return id;
}
function needsCapability(actor, capability) {
  actorId(actor);
  if (actor.capabilities?.[capability] !== true) {
    throw failure('Enrolled device lacks required capability: ' + capability, 403, 'capability_denied');
  }
}
function boundedNumber(value, label, min, max) {
  if (value === null || value === '' || !Number.isFinite(Number(value))) {
    throw failure(label + ' must be a finite number.');
  }
  const number = Number(value);
  if (number < min || number > max) throw failure(label + ' is outside allowed range.');
  return number;
}
function freshness(value, ttlMs = 120_000, nowMs = Date.now()) {
  const observed = new Date(value || 0).getTime();
  if (!Number.isFinite(observed) || observed <= 0) return {state:'unavailable', ageMs:null};
  const ageMs = Math.max(0, nowMs - observed);
  return {state:ageMs <= ttlMs ? 'online' : 'stale', ageMs};
}
function cleanMetrics(input) {
  const metrics = {};
  for (const name of ['cpuPercent','memoryPercent','diskPercent']) {
    if (input[name] !== undefined) metrics[name] = boundedNumber(input[name], name, 0, 100);
  }
  if (input.terminalCount !== undefined) metrics.terminalCount = boundedNumber(input.terminalCount,'terminalCount',0,1000);
  if (input.reporterConnected !== undefined) {
    if (typeof input.reporterConnected !== 'boolean') throw failure('reporterConnected must be boolean.');
    metrics.reporterConnected = input.reporterConnected;
    metrics.reporterConnectionEvidence = 'agent_report_only';
  }
  return metrics;
}
function safeEventDetails(input) {
  const details = {};
  for (const name of ['zone','model','source']) {
    if (input[name] !== undefined) {
      if (typeof input[name] !== 'string' || input[name].length > 120) throw failure(name + ' must be text of at most 120 characters.');
      details[name] = input[name].trim();
    }
  }
  // Never accept uploaded faces, raw frames, image links or personally identifying text.
  return details;
}
export { freshness, cleanMetrics, safeEventDetails };

export class WisdoFourPillarOperations {
  constructor({ pool, commandBusService } = {}) {
    if (!pool || !commandBusService) throw new Error('PostgreSQL and command bus are required.');
    this.pool = pool;
    this.commandBusService = commandBusService;
  }

  async heartbeat(actor, input = {}) {
    needsCapability(actor, 'os_telemetry');
    const nodeId = identifier(input.nodeId, 'nodeId');
    const nodeRole = String(input.role || '').trim();
    if (!ROLES.has(nodeRole)) throw failure('role must be vps, desktop, edge or worker.');
    const name = String(input.name || nodeId).trim().slice(0,120);
    const metrics = cleanMetrics(input.metrics || {});
    const result = await this.pool.query(
      "INSERT INTO wisdo_os_nodes(owner_user_id,node_id,device_id,node_name,node_role,metrics,reported_at,last_seen_at) " +
      "VALUES($1,$2,$3,$4,$5,$6::jsonb,NOW(),NOW()) " +
      "ON CONFLICT(owner_user_id,node_id) DO UPDATE SET node_name=EXCLUDED.node_name,node_role=EXCLUDED.node_role, " +
      "metrics=EXCLUDED.metrics,reported_at=NOW(),last_seen_at=NOW() " +
      "WHERE wisdo_os_nodes.device_id=EXCLUDED.device_id " +
      "RETURNING owner_user_id,node_id,device_id,node_name,node_role,metrics,reported_at,last_seen_at",
      [actorId(actor),nodeId,actor.device_id,name,nodeRole,JSON.stringify(metrics)]
    );
    if (!result.rows[0]) throw failure('Node belongs to a different enrolled device.',403,'node_ownership_conflict');
    return {...result.rows[0], telemetrySource:'authenticated_edge_report', executionVerified:false};
  }

  async nodes(ownerUserId) {
    const owner = String(ownerUserId || '').trim();
    if (!owner) throw failure('Owner is required.',401);
    const rows = (await this.pool.query(
      "SELECT n.node_id,n.device_id,n.node_name,n.node_role,n.metrics,n.last_seen_at,d.status AS device_status " +
      "FROM wisdo_os_nodes n JOIN wisdo_devices d ON d.device_id=n.device_id AND d.owner_user_id=n.owner_user_id " +
      "WHERE n.owner_user_id=$1 ORDER BY n.last_seen_at DESC LIMIT 100", [owner]
    )).rows;
    return rows.map(row => {
      const observed = freshness(row.last_seen_at);
      return { nodeId:row.node_id,deviceId:row.device_id,name:row.node_name,role:row.node_role,
        status:row.device_status === 'active' ? observed.state : 'revoked',
        ageMs:observed.ageMs,lastSeenAt:row.last_seen_at,metrics:row.metrics,
        evidence:'authenticated_edge_heartbeat',brokerExecutionVerified:false };
    });
  }

  async recordSentinelEvent(actor, input = {}) {
    needsCapability(actor, 'camera_events');
    const componentId = identifier(input.componentId,'componentId');
    const sourceEventId = identifier(input.sourceEventId,'sourceEventId');
    const eventType = String(input.eventType || '').trim().toLowerCase();
    if (!EVENTS.has(eventType)) throw failure('Unsupported eventType.');
    const occurred = Date.parse(input.occurredAt);
    const now = Date.now();
    if (!Number.isFinite(occurred) || occurred < now - 7*86_400_000 || occurred > now + 120_000) {
      throw failure('occurredAt must be a real timestamp within 7 days and no more than 2 minutes ahead.');
    }
    const confidence = input.confidence === undefined || input.confidence === null
      ? null : boundedNumber(input.confidence,'confidence',0,1);
    const allowed = await this.pool.query(
      "SELECT component_id FROM wisdo_components WHERE component_id=$1 AND owner_user_id=$2 " +
      "AND device_id=$3 AND approval_status='approved' AND status='online' " +
      "AND component_type IN ('camera','binary_sensor','sensor') LIMIT 1",
      [componentId,actorId(actor),actor.device_id]
    );
    if (!allowed.rows[0]) {
      throw failure('Camera is not an approved online component owned by this authenticated source.',403,'camera_not_approved');
    }
    const severity = eventType === 'tamper' ? 'critical'
      : ['person','vehicle','package'].includes(eventType) ? 'attention' : 'info';
    const result = await this.pool.query(
      "INSERT INTO wisdo_sentinel_events(owner_user_id,component_id,source_event_id,source_device_id,event_type,confidence,severity,occurred_at,details) " +
      "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) " +
      "ON CONFLICT(owner_user_id,component_id,source_event_id) DO NOTHING " +
      "RETURNING owner_user_id,component_id,source_event_id,event_type,confidence,severity,occurred_at,received_at,details",
      [actorId(actor),componentId,sourceEventId,actor.device_id,eventType,confidence,severity,new Date(occurred).toISOString(),
        JSON.stringify(safeEventDetails(input.details || {}))]
    );
    if (result.rows[0]) return {recorded:true,duplicate:false,event:result.rows[0],responseAction:'none'};
    const existing = await this.pool.query(
      "SELECT owner_user_id,component_id,source_event_id,event_type,confidence,severity,occurred_at,received_at,details " +
      "FROM wisdo_sentinel_events WHERE owner_user_id=$1 AND component_id=$2 AND source_event_id=$3",
      [actorId(actor),componentId,sourceEventId]
    );
    return {recorded:false,duplicate:true,event:existing.rows[0] || null,responseAction:'none'};
  }

  async sentinelEvents(ownerUserId, {limit = 50, componentId = ''} = {}) {
    const owner = String(ownerUserId || '').trim();
    if (!owner) throw failure('Owner is required.',401);
    const count = Math.max(1,Math.min(100,Number(limit) || 50));
    const camera = componentId ? identifier(componentId,'componentId') : '';
    return (await this.pool.query(
      "SELECT e.component_id,c.name AS camera_name,e.source_event_id,e.event_type,e.confidence,e.severity,e.occurred_at,e.received_at,e.details " +
      "FROM wisdo_sentinel_events e JOIN wisdo_components c ON c.component_id=e.component_id AND c.owner_user_id=e.owner_user_id " +
      "WHERE e.owner_user_id=$1 AND ($2='' OR e.component_id=$2) " +
      "ORDER BY e.received_at DESC LIMIT $3", [owner,camera,count]
    )).rows;
  }

  async tradingAccounts(ownerUserId) {
    const owner = String(ownerUserId || '').trim();
    if (!owner) throw failure('Owner is required.',401);
    const [accounts, commands] = await Promise.all([
      this.pool.query(
        "SELECT account_id,account_number,broker_server,status,last_sync_at,latest_snapshot IS NOT NULL AS snapshot_present " +
        "FROM wisdo_mt4_accounts WHERE discord_user_id=$1 ORDER BY last_sync_at DESC NULLS LAST LIMIT 100", [owner]
      ),
      this.pool.query(
        "SELECT account_id,status,COUNT(*)::int AS count FROM wisdo_mt4_commands " +
        "WHERE user_id=$1 AND created_at>NOW()-INTERVAL '7 days' GROUP BY account_id,status", [owner]
      )
    ]);
    return {accounts:accounts.rows.map(row => {
      const observed = freshness(row.last_sync_at,90_000);
      return {accountId:row.account_id,accountNumber:row.account_number,brokerServer:row.broker_server,
        registrationStatus:row.status,lastSyncAt:row.last_sync_at,reporterFreshness:observed.state,ageMs:observed.ageMs,
        snapshotPresent:row.snapshot_present,provenance:'mt4_reporter_snapshot',brokerOrderReceiptVerified:false};
    }), commandCounts7d:commands.rows, executionTruth:'command_receipts_only_not_http_acceptance'};
  }

  async requestRecovery(actor, input = {}) {
    needsCapability(actor,'ops_operator');
    const targetId = identifier(input.targetDeviceId,'targetDeviceId');
    const target = await this.pool.query(
      "SELECT device_id,capabilities FROM wisdo_devices WHERE owner_user_id=$1 AND device_id=$2 " +
      "AND device_type='desktop-agent' AND status='active' AND last_seen_at>NOW()-INTERVAL '90 seconds' LIMIT 1",
      [actorId(actor),targetId]
    );
    if (!target.rows[0] || target.rows[0].capabilities?.restart_wisdo_worker !== true) {
      throw failure('Target is not a currently connected approved recovery worker.',409,'recovery_target_unavailable');
    }
    const recoveryId = crypto.randomUUID();
    const rows = await this.pool.query(
      "INSERT INTO wisdo_os_recoveries(recovery_id,owner_user_id,requested_by_device_id,target_device_id,action,status,expires_at) " +
      "VALUES($1,$2,$3,$4,'restart_wisdo_worker','pending',NOW()+INTERVAL '2 minutes') " +
      "RETURNING recovery_id,target_device_id,action,status,expires_at",
      [recoveryId,actorId(actor),actor.device_id,targetId]
    );
    return {...rows.rows[0], confirmationRequired:'RESTART WORKER ' + targetId};
  }

  async approveRecovery(actor, recoveryId, confirmation) {
    needsCapability(actor,'ops_operator');
    const id = String(recoveryId || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw failure('Invalid recoveryId.');
    const row = (await this.pool.query(
      "SELECT target_device_id,status,expires_at FROM wisdo_os_recoveries " +
      "WHERE recovery_id=$1 AND owner_user_id=$2 AND requested_by_device_id=$3",
      [id,actorId(actor),actor.device_id]
    )).rows[0];
    if (!row) throw failure('Recovery request not found.',404,'recovery_not_found');
    if (row.status !== 'pending' || Date.parse(row.expires_at) <= Date.now()) {
      throw failure('Recovery request is no longer pending.',409,'recovery_expired_or_used');
    }
    if (confirmation !== 'RESTART WORKER ' + row.target_device_id) {
      throw failure('Confirmation phrase does not match the exact target.',403,'confirmation_mismatch');
    }
    const claimed = (await this.pool.query(
      "UPDATE wisdo_os_recoveries SET status='approved',approved_at=NOW() " +
      "WHERE recovery_id=$1 AND owner_user_id=$2 AND requested_by_device_id=$3 " +
      "AND status='pending' AND expires_at>NOW() RETURNING target_device_id",
      [id,actorId(actor),actor.device_id]
    )).rows[0];
    if (!claimed) throw failure('Recovery already claimed or expired.',409,'recovery_race_lost');
    try {
      const command = await this.commandBusService.issueSystemCommand(actorId(actor),{
        intent:'restart_wisdo_worker',source:'os_supervised_recovery',
        target:{type:'desktop',id:claimed.target_device_id},
        requiredCapability:'restart_wisdo_worker',expiresInSeconds:60,priority:85,
        parameters:{recoveryId:id}
      });
      await this.pool.query(
        "UPDATE wisdo_os_recoveries SET status='queued',queued_command_id=$2 WHERE recovery_id=$1 AND owner_user_id=$3",
        [id,command.command_id,actorId(actor)]
      );
      return {recoveryId:id,status:'queued',commandId:command.command_id,
        executionStatus:'pending_agent_receipt',executionConfirmed:false};
    } catch(error) {
      await this.pool.query(
        "UPDATE wisdo_os_recoveries SET status='failed',error_message=$2 WHERE recovery_id=$1 AND owner_user_id=$3",
        [id,String(error.message || 'dispatch failed').slice(0,300),actorId(actor)]
      );
      throw error;
    }
  }

  async recoveries(ownerUserId) {
    const owner = String(ownerUserId || '').trim();
    if (!owner) throw failure('Owner is required.',401);
    return (await this.pool.query(
      "SELECT r.recovery_id,r.target_device_id,r.action,r.status,r.queued_command_id,r.expires_at,r.created_at, " +
      "c.status AS command_status,c.result_message AS command_result " +
      "FROM wisdo_os_recoveries r LEFT JOIN wisdo_commands c ON c.command_id::text=r.queued_command_id " +
      "AND c.owner_user_id=r.owner_user_id WHERE r.owner_user_id=$1 ORDER BY r.created_at DESC LIMIT 50",
      [owner]
    )).rows;
  }


  async prepareVps(ownerUserId, deviceId) {
    const owner = String(ownerUserId || '').trim();
    if (!owner) throw failure('Signed-in member is required.', 401);
    const id = identifier(deviceId, 'deviceId');
    const result = await this.pool.query(
      "SELECT d.device_id,d.capabilities,d.last_seen_at FROM wisdo_devices d " +
      "JOIN wisdo_os_nodes n ON n.owner_user_id=d.owner_user_id AND n.device_id=d.device_id " +
      "WHERE d.owner_user_id=$1 AND d.device_id=$2 AND d.device_type='desktop-agent' AND d.status='active' " +
      "AND n.node_role='vps' AND d.last_seen_at>NOW()-INTERVAL '90 seconds' LIMIT 1",
      [owner,id]
    );
    const device = result.rows[0];
    if (!device || device.capabilities?.prepare_trading_workspace !== true) {
      throw failure('No live, authorized VPS desktop with a configured MT4 terminal.', 409, 'vps_not_available');
    }
    const queued = await this.commandBusService.issueSystemCommand(owner,{
      intent:'prepare_trading_workspace',
      source:'confirmed_member_vps_control',
      target:{type:'desktop',id},
      requiredCapability:'prepare_trading_workspace',
      expiresInSeconds:90,
      priority:75,
      parameters:{},
    });
    return {status:'queued',commandId:queued.command_id,executionConfirmed:false,
      executionTruth:'wait_for_enrolled_desktop_agent_receipt'};
  }

  async commandStatus(ownerUserId, commandId) {
    const owner = String(ownerUserId || '').trim();
    if (!owner) throw failure('Signed-in member is required.', 401);
    const id = String(commandId || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) throw failure('Invalid command identifier.');
    const result = await this.pool.query(
      "SELECT command_id,intent,target_id,status,result_message,created_at,completed_at " +
      "FROM wisdo_commands WHERE command_id=$1::uuid AND owner_user_id=$2 LIMIT 1",
      [id,owner]
    );
    if (!result.rows[0]) throw failure('Command not found for this account.', 404, 'command_not_found');
    return {...result.rows[0],executionConfirmed:result.rows[0].status==='completed',
      authority:'enrolled_agent_command_receipt'};
  }

  async overview(ownerUserId) {
    const [nodes,trading,sentinel,recoveries] = await Promise.all([
      this.nodes(ownerUserId),this.tradingAccounts(ownerUserId),
      this.sentinelEvents(ownerUserId,{limit:20}),this.recoveries(ownerUserId)
    ]);
    const advisories = [];
    for (const node of nodes.filter(n => n.status !== 'online')) {
      advisories.push({kind:'node_not_reporting',targetId:node.nodeId,status:node.status,
        action:'inspect_agent',automaticallyExecuted:false});
    }
    for (const account of trading.accounts.filter(a => a.reporterFreshness !== 'online')) {
      advisories.push({kind:'reporter_not_fresh',targetId:account.accountId,
        status:account.reporterFreshness,action:'inspect_reporter',automaticallyExecuted:false});
    }
    for (const event of sentinel.filter(e => e.event_type === 'tamper')) {
      advisories.push({kind:'camera_tamper_reported',targetId:event.component_id,
        eventId:event.source_event_id,action:'review_camera',automaticallyExecuted:false});
    }
    return {ok:true,generatedAt:new Date().toISOString(),evidence:'postgres_persisted_observations',
      nodes,trading,sentinel:{recentEvents:sentinel},recoveries,
      automation:{advisories:advisories.slice(0,100),automaticTradeExecution:false,
        autonomousSirenActivation:false,workerRecovery:'explicit_confirmation_only'}};
  }
}
