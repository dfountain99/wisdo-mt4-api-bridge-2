import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function json(value, fallback = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  return value;
}

function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

export class WisdoCommandBusService {
  constructor({ config = {}, logger = console, mt4CommandService = null } = {}) {
    this.logger = logger;
    this.mt4CommandService = mt4CommandService;
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: String(process.env.WISDO_DB_SSL || 'true').toLowerCase() === 'true'
        ? { rejectUnauthorized: false }
        : false,
      max: Math.max(1, Number(process.env.DB_POOL_MAX || 2)),
      statement_timeout: Math.max(1000, Number(process.env.WISDO_DB_STATEMENT_TIMEOUT_MS || 4000)),
      query_timeout: Math.max(1000, Number(process.env.WISDO_DB_QUERY_TIMEOUT_MS || 5000)),
      application_name: 'wisdo-command-bus',
    });
    this.commandLeaseSeconds = Math.max(5, Number(process.env.WISDO_COMMAND_LEASE_SECONDS || 30));
    this.maxAttempts = Math.max(1, Number(process.env.WISDO_COMMAND_MAX_ATTEMPTS || 5));
  }

  async authenticateDevice(deviceId, token, expectedType = null) {
    const id = clean(deviceId, 200);
    if (!id || !token) return null;
    const result = await this.pool.query(
      `SELECT device_id, owner_user_id, device_type, device_name, status, capabilities
         FROM wisdo_devices
        WHERE device_id = $1 AND token_hash = $2 AND status = 'active'
        LIMIT 1`,
      [id, hashToken(token)],
    );
    const device = result.rows[0] || null;
    if (!device) return null;
    if (expectedType && device.device_type !== expectedType) return null;
    await this.pool.query(
      `UPDATE wisdo_devices SET last_seen_at = NOW(), updated_at = NOW() WHERE device_id = $1`,
      [id],
    );
    return device;
  }

  async enrollDevice({ enrollmentCode, deviceId, deviceName, deviceType, token, capabilities = {} }) {
    const expectedCode = clean(process.env.WISDO_DEVICE_ENROLLMENT_CODE, 500);
    if (!expectedCode || !timingSafeEqualText(enrollmentCode, expectedCode)) {
      const error = new Error('Invalid enrollment code.'); error.statusCode = 403; throw error;
    }
    const ownerUserId = clean(process.env.WISDO_DEVICE_OWNER_USER_ID || '518140439489019906', 200);
    const id = clean(deviceId, 200);
    const type = clean(deviceType, 50);
    if (!id || !token || !['pi-edge','desktop-agent'].includes(type)) {
      const error = new Error('deviceId, token, and supported deviceType are required.'); error.statusCode = 400; throw error;
    }
    const result = await this.pool.query(
      `INSERT INTO wisdo_devices
        (device_id, owner_user_id, device_type, device_name, token_hash, status, capabilities, last_seen_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'active',$6::jsonb,NOW(),NOW(),NOW())
       ON CONFLICT (device_id) DO UPDATE SET
         owner_user_id = EXCLUDED.owner_user_id,
         device_type = EXCLUDED.device_type,
         device_name = EXCLUDED.device_name,
         token_hash = EXCLUDED.token_hash,
         status = 'active', capabilities = EXCLUDED.capabilities,
         last_seen_at = NOW(), updated_at = NOW()
       RETURNING device_id, owner_user_id, device_type, device_name, status, capabilities`,
      [id, ownerUserId, type, clean(deviceName || id, 200), hashToken(token), JSON.stringify(json(capabilities))],
    );
    return result.rows[0];
  }

  async registerBot(device, input = {}) {
    if (device.device_type !== 'desktop-agent') {
      const error = new Error('Only desktop agents can register bots.'); error.statusCode = 403; throw error;
    }
    const botId = clean(input.botId || crypto.randomUUID(), 200);
    const aliases = Array.isArray(input.aliases) ? input.aliases.map((x) => clean(x, 100)).filter(Boolean).slice(0, 20) : [];
    const result = await this.pool.query(
      `INSERT INTO wisdo_bots
        (bot_id, owner_user_id, desktop_device_id, bot_name, aliases, account_id, terminal_name, status, capabilities, metadata, last_seen_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,'online',$8::jsonb,$9::jsonb,NOW(),NOW(),NOW())
       ON CONFLICT (bot_id) DO UPDATE SET
        desktop_device_id=EXCLUDED.desktop_device_id, bot_name=EXCLUDED.bot_name,
        aliases=EXCLUDED.aliases, account_id=EXCLUDED.account_id, terminal_name=EXCLUDED.terminal_name,
        status='online', capabilities=EXCLUDED.capabilities, metadata=EXCLUDED.metadata,
        last_seen_at=NOW(), updated_at=NOW()
       RETURNING *`,
      [botId, device.owner_user_id, device.device_id, clean(input.botName || botId, 200), JSON.stringify(aliases), clean(input.accountId, 200) || null, clean(input.terminalName, 200) || null, JSON.stringify(json(input.capabilities)), JSON.stringify(json(input.metadata))],
    );
    return result.rows[0];
  }

  async resolveTarget(ownerUserId, target = {}) {
    const type = clean(target.type || 'bot', 50);
    const raw = clean(target.id || target.alias || '', 200);
    if (type === 'desktop') {
      const result = await this.pool.query(`SELECT device_id FROM wisdo_devices WHERE owner_user_id=$1 AND device_type='desktop-agent' AND status='active' AND ($2='' OR device_id=$2 OR lower(device_name)=lower($2)) ORDER BY last_seen_at DESC LIMIT 1`, [ownerUserId, raw]);
      return result.rows[0] ? { type, id: result.rows[0].device_id, desktopDeviceId: result.rows[0].device_id } : null;
    }
    if (type === 'bot') {
      const result = await this.pool.query(
        `SELECT bot_id, desktop_device_id, bot_name, account_id, capabilities
           FROM wisdo_bots
          WHERE owner_user_id=$1 AND status='online'
            AND ($2='' OR bot_id=$2 OR lower(bot_name)=lower($2) OR aliases ? lower($2))
          ORDER BY last_seen_at DESC LIMIT 1`, [ownerUserId, raw]);
      const bot = result.rows[0];
      return bot ? { type, id: bot.bot_id, desktopDeviceId: bot.desktop_device_id, accountId: bot.account_id, botName: bot.bot_name, capabilities: bot.capabilities } : null;
    }
    return { type, id: raw || null, desktopDeviceId: null };
  }

  async issueCommand(device, input = {}) {
    const intent = clean(input.intent, 120);
    if (!intent) { const error = new Error('intent is required.'); error.statusCode = 400; throw error; }
    const target = await this.resolveTarget(device.owner_user_id, json(input.target, { type: 'bot' }));
    if (!target) { const error = new Error('No online target matched that bot or device.'); error.statusCode = 404; throw error; }
    const commandId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + Math.max(10, Number(input.expiresInSeconds || 120)) * 1000);
    const result = await this.pool.query(
      `INSERT INTO wisdo_commands
        (command_id, owner_user_id, issued_by_device_id, source, intent, target_type, target_id, desktop_device_id, account_id, parameters, spoken_text, status, priority, attempts, expires_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,'pending',$12,0,$13,NOW(),NOW())
       RETURNING *`,
      [commandId, device.owner_user_id, device.device_id, clean(input.source || 'voice', 40), intent, target.type, target.id, target.desktopDeviceId, target.accountId || null, JSON.stringify(json(input.parameters)), clean(input.spokenText, 1000) || null, Math.max(0, Math.min(100, Number(input.priority || 50))), expiresAt],
    );
    await this.audit(commandId, 'issued', device.device_id, { target });
    return result.rows[0];
  }

  async leaseCommands(device, limit = 10) {
    if (device.device_type !== 'desktop-agent') return [];
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT * FROM wisdo_commands
          WHERE desktop_device_id=$1
            AND status IN ('pending','leased')
            AND attempts < $2
            AND expires_at > NOW()
            AND (lease_expires_at IS NULL OR lease_expires_at < NOW())
          ORDER BY priority DESC, created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $3`, [device.device_id, this.maxAttempts, Math.max(1, Math.min(50, Number(limit || 10)))]);
      const ids = result.rows.map((row) => row.command_id);
      if (ids.length) {
        await client.query(
          `UPDATE wisdo_commands SET status='leased', leased_by_device_id=$1,
             lease_expires_at=NOW()+($2 || ' seconds')::interval,
             attempts=attempts+1, updated_at=NOW()
           WHERE command_id = ANY($3::uuid[])`, [device.device_id, String(this.commandLeaseSeconds), ids]);
      }
      await client.query('COMMIT');
      return result.rows.map((row) => ({ ...row, status: 'leased' }));
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async completeCommand(device, commandId, input = {}) {
    const status = ['completed','failed','rejected'].includes(input.status) ? input.status : 'completed';
    const result = await this.pool.query(
      `UPDATE wisdo_commands SET status=$1, result=$2::jsonb, result_message=$3,
         completed_at=NOW(), lease_expires_at=NULL, updated_at=NOW()
       WHERE command_id=$4 AND leased_by_device_id=$5
       RETURNING *`, [status, JSON.stringify(json(input.result)), clean(input.message, 1000) || null, clean(commandId, 100), device.device_id]);
    if (!result.rows[0]) { const error = new Error('Command not found or not leased by this device.'); error.statusCode = 404; throw error; }
    await this.audit(commandId, status, device.device_id, { message: input.message, result: input.result });
    return result.rows[0];
  }

  async getCommand(device, commandId) {
    const result = await this.pool.query(`SELECT * FROM wisdo_commands WHERE command_id=$1 AND owner_user_id=$2 LIMIT 1`, [clean(commandId, 100), device.owner_user_id]);
    return result.rows[0] || null;
  }

  async listBots(device) {
    const result = await this.pool.query(`SELECT bot_id, bot_name, aliases, account_id, terminal_name, status, capabilities, last_seen_at FROM wisdo_bots WHERE owner_user_id=$1 ORDER BY bot_name`, [device.owner_user_id]);
    return result.rows;
  }

  async audit(commandId, eventType, actorId, detail = {}) {
    await this.pool.query(`INSERT INTO wisdo_command_audit (command_id,event_type,actor_id,detail,created_at) VALUES ($1,$2,$3,$4::jsonb,NOW())`, [commandId, eventType, clean(actorId, 200), JSON.stringify(json(detail))]);
  }

  async health() {
    const result = await this.pool.query(`SELECT
      (SELECT count(*)::int FROM wisdo_devices WHERE status='active') active_devices,
      (SELECT count(*)::int FROM wisdo_bots WHERE status='online') online_bots,
      (SELECT count(*)::int FROM wisdo_commands WHERE status IN ('pending','leased')) active_commands`);
    return { ok: true, database: 'connected', ...result.rows[0] };
  }
}
