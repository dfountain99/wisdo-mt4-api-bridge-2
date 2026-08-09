import { randomUUID } from 'node:crypto';

export class WisdoContextService {
  constructor({ pool, idleTimeoutMs = Number(process.env.WISDO_CONVERSATION_IDLE_MS || 300000) } = {}) { this.pool = pool; this.idleTimeoutMs = idleTimeoutMs; }

  async start({ userId, deviceId = null, discordUserId = null, channel = 'device', context = {} }) {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + this.idleTimeoutMs);
    const result = await this.pool.query(`INSERT INTO wisdo_conversation_sessions(session_id,owner_user_id,device_id,discord_user_id,channel,context,expires_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING *`, [sessionId, userId, deviceId, discordUserId, channel, JSON.stringify(context), expiresAt]);
    return result.rows[0];
  }

  async get(sessionId, userId) {
    const result = await this.pool.query(`SELECT * FROM wisdo_conversation_sessions WHERE session_id=$1 AND owner_user_id=$2`, [sessionId, userId]);
    const row = result.rows[0] || null;
    if (row?.status === 'active' && new Date(row.expires_at).getTime() <= Date.now()) { await this.close(sessionId, userId, 'expired'); return { ...row, status: 'expired' }; }
    return row;
  }

  async latest(userId, deviceId = null) {
    const result = await this.pool.query(`SELECT * FROM wisdo_conversation_sessions WHERE owner_user_id=$1 AND status='active' AND expires_at>NOW() AND ($2::text IS NULL OR device_id=$2) ORDER BY last_interaction_at DESC LIMIT 1`, [userId, deviceId]);
    return result.rows[0] || null;
  }

  async touch(sessionId, userId, patch = {}) {
    const expiresAt = new Date(Date.now() + this.idleTimeoutMs);
    const result = await this.pool.query(`UPDATE wisdo_conversation_sessions SET context=context||$3::jsonb,pending_clarification=CASE WHEN $4::jsonb IS NULL THEN pending_clarification ELSE $4::jsonb END,active_plan_id=COALESCE($5,active_plan_id),last_interaction_at=NOW(),expires_at=$6,updated_at=NOW() WHERE session_id=$1 AND owner_user_id=$2 AND status='active' RETURNING *`, [sessionId, userId, JSON.stringify(patch.context || {}), patch.pendingClarification === undefined ? null : JSON.stringify(patch.pendingClarification), patch.activePlanId || null, expiresAt]);
    return result.rows[0] || null;
  }

  async message({ sessionId, userId, role, content, intent = null, responseState = null }) {
    const result = await this.pool.query(`INSERT INTO wisdo_conversation_messages(message_id,session_id,owner_user_id,role,content,intent,response_state) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING *`, [randomUUID(), sessionId, userId, role, content, intent ? JSON.stringify(intent) : null, responseState]);
    return result.rows[0];
  }

  async recent(sessionId, userId, limit = 12) { const r = await this.pool.query(`SELECT role,content,intent,response_state,created_at FROM wisdo_conversation_messages WHERE session_id=$1 AND owner_user_id=$2 ORDER BY created_at DESC LIMIT $3`, [sessionId, userId, Math.min(50, limit)]); return r.rows.reverse(); }
  async close(sessionId, userId, status = 'closed') { const r = await this.pool.query(`UPDATE wisdo_conversation_sessions SET status=$3,updated_at=NOW() WHERE session_id=$1 AND owner_user_id=$2 RETURNING *`, [sessionId, userId, status]); return r.rows[0] || null; }
}
