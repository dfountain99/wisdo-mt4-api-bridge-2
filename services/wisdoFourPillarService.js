import { randomUUID } from 'node:crypto';

const trim = (value, length = 160) => String(value ?? '').trim().slice(0, length);
const problem = (message, statusCode = 400, code = 'invalid_request') => Object.assign(new Error(message), { statusCode, code });
const categories = new Set(['motion', 'person', 'vehicle', 'animal', 'package', 'sound', 'tamper', 'unknown']);
const severities = new Set(['info', 'attention', 'critical']);
const safeNumber = (value, low, high) => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) ? null : Math.max(low, Math.min(high, Number(value)));
const limited = (value, limit = 500) => trim(value, limit);

function sanitizeMetrics(input = {}) {
  const metrics = {
    cpuPercent: safeNumber(input.cpuPercent, 0, 100),
    memoryPercent: safeNumber(input.memoryPercent, 0, 100),
    diskPercent: safeNumber(input.diskPercent, 0, 100),
    uptimeSeconds: safeNumber(input.uptimeSeconds, 0, 315360000),
    mt4Running: input.mt4Running === true ? true : input.mt4Running === false ? false : null,
    mt5Running: input.mt5Running === true ? true : input.mt5Running === false ? false : null,
  };
  if (input.hostname) metrics.hostname = limited(input.hostname, 120);
  return metrics;
}

function publicAccount(row) {
  const snapshot = row.latest_snapshot && typeof row.latest_snapshot === 'object' ? row.latest_snapshot : null;
  const ageMs = row.last_sync_at ? Math.max(0, Date.now() - new Date(row.last_sync_at).getTime()) : null;
  return {
    accountId: row.account_id,
    accountNumber: row.account_number,
    brokerServer: row.broker_server,
    connectionStatus: ageMs === null ? 'unavailable' : ageMs <= 90000 ? 'live' : ageMs <= 300000 ? 'stale' : 'offline',
    lastSyncAt: row.last_sync_at || null,
    // An observation is not an execution receipt. Never synthesize balances or trades.
    observation: snapshot,
    observationAuthority: 'mt4_reporter_snapshot_not_broker_execution_receipt',
  };
}

export class WisdoFourPillarService {
  constructor({ pool, commandBusService }) {
    if (!pool || !commandBusService) throw new Error('PostgreSQL pool and command bus are required.');
    this.pool = pool;
    this.commandBusService = commandBusService;
  }

  assertIdentity(device) {
    if (!device?.owner_user_id || !device?.device_id || !['desktop-agent','pi-edge'].includes(device.device_type)) {
      throw problem('An enrolled device is required.', 403, 'enrolled_device_required');
    }
    return String(device.owner_user_id);
  }

  async recordNode(device, input = {}) {
    const owner = this.assertIdentity(device);
    const wanted = trim(input.role, 30);
    const role = device.device_type === 'pi-edge' ? 'edge' : wanted === 'vps' && device.capabilities?.windows === true ? 'vps' : 'desktop';
    if (wanted && !['vps', 'desktop', 'edge'].includes(wanted)) throw problem('Unrecognized node role.');
    if (wanted === 'vps' && role !== 'vps') throw problem('A VPS role requires an enrolled Windows desktop agent.', 409, 'vps_agent_required');
    if (input.nodeId && String(input.nodeId) !== String(device.device_id)) throw problem('A device cannot report for another device.', 403, 'node_spoofing');
    const result = await this.pool.query(`
      INSERT INTO wisdo_os_nodes(owner_user_id,node_id,device_id,node_name,node_role,metrics,reported_at,last_seen_at)
      VALUES ($1,$2,$2,$3,$4,$5::jsonb,NOW(),NOW())
      ON CONFLICT(owner_user_id,node_id) DO UPDATE SET node_name=EXCLUDED.node_name,node_role=EXCLUDED.node_role,
        metrics=EXCLUDED.metrics,reported_at=NOW(),last_seen_at=NOW()
      RETURNING owner_user_id,node_id,device_id,node_name,node_role,metrics,reported_at,last_seen_at
    `, [owner, device.device_id, trim(input.name || device.device_name || device.device_id, 150), role, JSON.stringify(sanitizeMetrics(input.metrics))]);
    return result.rows[0];
  }

  async snapshot(owner) {
    const id = trim(owner, 200);
    if (!id) throw problem('Authentication required.', 401, 'authentication_required');
    const [nodes, accounts, commands, cameras, events, recoveries] = await Promise.all([
      this.pool.query(`
        SELECT node_id,device_id,node_name,node_role,metrics,reported_at,last_seen_at,
          (last_seen_at > NOW() - INTERVAL '90 seconds') AS live
        FROM wisdo_os_nodes WHERE owner_user_id=$1 ORDER BY last_seen_at DESC LIMIT 100`, [id]),
      this.pool.query(`
        SELECT account_id,account_number,broker_server,last_sync_at,latest_snapshot
        FROM wisdo_mt4_accounts WHERE discord_user_id=$1 ORDER BY last_sync_at DESC NULLS LAST LIMIT 100`, [id]),
      this.pool.query(`
        SELECT id,account_id,command,status,created_at,delivered_at,completed_at,failed_at
        FROM wisdo_mt4_commands WHERE user_id=$1 ORDER BY created_at DESC LIMIT 40`, [id]),
      this.pool.query(`
        SELECT component_id,name,status,approval_status,home_id,last_seen_at
        FROM wisdo_components WHERE owner_user_id=$1 AND component_type='camera'
        ORDER BY name LIMIT 100`, [id]),
      this.pool.query(`
        SELECT component_id,source_event_id,event_type,confidence,severity,occurred_at,received_at,details
        FROM wisdo_sentinel_events WHERE owner_user_id=$1 ORDER BY received_at DESC LIMIT 40`, [id]),
      this.pool.query(`
        SELECT recovery_id,target_device_id,action,status,queued_command_id,error_message,created_at,expires_at
        FROM wisdo_os_recoveries WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT 40`, [id]),
    ]);
    return {
      observedAt: new Date().toISOString(),
      source: 'postgresql_authoritative_observations',
      nodes: nodes.rows,
      vps: nodes.rows.filter((node) => node.node_role === 'vps'),
      trading: { accounts: accounts.rows.map(publicAccount), commands: commands.rows },
      sentinel: { cameras: cameras.rows, events: events.rows },
      recoveries: recoveries.rows,
    };
  }

  async reportSentinelEvent(device, input = {}) {
    const owner = this.assertIdentity(device);
    if (device.device_type !== 'pi-edge') throw problem('Only an enrolled edge sensor can report camera detections.', 403, 'edge_required');
    const componentId = trim(input.componentId, 200);
    const sourceId = trim(input.sourceEventId, 200);
    const kind = trim(input.eventType, 40).toLowerCase();
    const severity = trim(input.severity || 'info', 30).toLowerCase();
    const when = new Date(input.occurredAt);
    if (!componentId || !sourceId || !categories.has(kind) || !severities.has(severity)) throw problem('componentId, sourceEventId, valid eventType and severity required.');
    if (!Number.isFinite(when.getTime()) || when.getTime() > Date.now() + 300000 || when.getTime() < Date.now() - 7 * 86400000) {
      throw problem('Camera event timestamp must be within the preceding seven days.', 400, 'invalid_event_timestamp');
    }
    const component = await this.pool.query(`
      SELECT component_id FROM wisdo_components
      WHERE owner_user_id=$1 AND component_id=$2 AND device_id=$3
        AND component_type='camera' AND approval_status='approved' AND status='online'
      LIMIT 1`, [owner, componentId, device.device_id]);
    if (!component.rows.length) throw problem('An approved, online camera bound to this edge device is required.', 403, 'camera_not_approved');
    const info = {};
    for (const key of ['provider','sourceEntityId','sensorEntityId','label']) {
      if (input.details && typeof input.details[key] === 'string') info[key] = limited(input.details[key], 160);
    }
    const result = await this.pool.query(`
      INSERT INTO wisdo_sentinel_events(owner_user_id,component_id,source_event_id,source_device_id,event_type,confidence,severity,occurred_at,details)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
      ON CONFLICT(owner_user_id,component_id,source_event_id) DO NOTHING
      RETURNING owner_user_id,component_id,source_event_id,event_type,confidence,severity,occurred_at,received_at,details`,
      [owner,componentId,sourceId,device.device_id,kind,safeNumber(input.confidence,0,1),severity,when.toISOString(),JSON.stringify(info)]);
    return { accepted: result.rows.length === 1, duplicate: result.rows.length === 0, event: result.rows[0] || null };
  }

  async listSentinelEvents(owner, limit = 50) {
    const result = await this.pool.query(`
      SELECT component_id,source_event_id,event_type,confidence,severity,occurred_at,received_at,details
      FROM wisdo_sentinel_events WHERE owner_user_id=$1 ORDER BY received_at DESC LIMIT $2`,
      [trim(owner,200), Math.max(1,Math.min(100,Number(limit)||50))]);
    return result.rows;
  }

  async requestRecovery(device, input = {}) {
    const owner = this.assertIdentity(device);
    const targetDeviceId = trim(input.targetDeviceId,200);
    if (!targetDeviceId) throw problem('targetDeviceId is required.');
    const target = await this.pool.query(`
      SELECT device_id,device_type,capabilities FROM wisdo_devices
      WHERE owner_user_id=$1 AND device_id=$2 AND status='active' LIMIT 1`, [owner,targetDeviceId]);
    const row = target.rows[0];
    if (!row || row.device_type !== 'desktop-agent' || row.capabilities?.restart_wisdo_worker !== true) {
      throw problem('Target must be an enrolled desktop agent advertising a configured WISDO worker restart.', 409, 'recovery_target_unavailable');
    }
    const record = await this.pool.query(`
      INSERT INTO wisdo_os_recoveries(recovery_id,owner_user_id,requested_by_device_id,target_device_id,action,status,expires_at)
      VALUES($1,$2,$3,$4,'restart_wisdo_worker','pending',NOW()+INTERVAL '5 minutes')
      RETURNING recovery_id,target_device_id,action,status,expires_at,created_at`,
      [randomUUID(),owner,device.device_id,targetDeviceId]);
    return record.rows[0];
  }

  async approveRecovery(owner, recoveryId) {
    const ownerId = trim(owner,200);
    const result = await this.pool.query(`
      UPDATE wisdo_os_recoveries SET status='approved',approved_at=NOW()
      WHERE recovery_id=$1 AND owner_user_id=$2 AND status='pending' AND expires_at>NOW()
      RETURNING recovery_id,target_device_id,action`,[trim(recoveryId,100),ownerId]);
    const row = result.rows[0];
    if (!row) throw problem('Recovery request is missing, already used, or expired.',409,'recovery_not_pending');
    try {
      const command = await this.commandBusService.issueSystemCommand(ownerId,{
        intent:'restart_wisdo_worker',
        target:{type:'desktop',id:row.target_device_id},
        requiredCapability:'restart_wisdo_worker',
        source:'operator_approved_recovery',
        parameters:{recoveryId:row.recovery_id},
        expiresInSeconds:90,
        priority:80,
      });
      const saved = await this.pool.query(`
        UPDATE wisdo_os_recoveries SET status='queued',queued_command_id=$1
        WHERE recovery_id=$2 AND owner_user_id=$3
        RETURNING recovery_id,target_device_id,status,queued_command_id`,
        [String(command.command_id),row.recovery_id,ownerId]);
      return saved.rows[0];
    } catch (error) {
      await this.pool.query(`UPDATE wisdo_os_recoveries SET status='failed',error_message=$1
        WHERE recovery_id=$2 AND owner_user_id=$3`,[trim(error.message,500),row.recovery_id,ownerId]);
      throw error;
    }
  }
}
