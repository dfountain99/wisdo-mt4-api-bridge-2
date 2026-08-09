import { createHash, randomUUID } from 'node:crypto';

function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable(value[k])])); return value; }
export function confirmationActionHash(action) { return createHash('sha256').update(JSON.stringify(stable(action))).digest('hex'); }

export class WisdoConfirmationService {
  constructor({ pool, ttlMs = Number(process.env.WISDO_CONFIRMATION_TTL_MS || 120000) } = {}) { this.pool = pool; this.ttlMs = ttlMs; }

  async create({ userId, sessionId, deviceId = null, actionType, accountIds = [], botId = null, planId = null, parameters = {}, safetyLevel }) {
    const confirmationId = randomUUID();
    const action = { actionType, accountIds: [...accountIds].map(String).sort(), botId, planId, parameters };
    const r = await this.pool.query(`INSERT INTO wisdo_pending_confirmations(confirmation_id,owner_user_id,session_id,device_id,action_type,action_hash,account_ids,bot_id,plan_id,parameters,safety_level,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12) RETURNING *`, [confirmationId,userId,sessionId,deviceId,actionType,confirmationActionHash(action),action.accountIds,botId,planId,JSON.stringify(parameters),safetyLevel,new Date(Date.now()+this.ttlMs)]);
    return r.rows[0];
  }

  async pending(userId, sessionId) { await this.pool.query(`UPDATE wisdo_pending_confirmations SET status='EXPIRED' WHERE owner_user_id=$1 AND session_id=$2 AND status='PENDING' AND expires_at<=NOW()`,[userId,sessionId]); const r=await this.pool.query(`SELECT * FROM wisdo_pending_confirmations WHERE owner_user_id=$1 AND session_id=$2 AND status='PENDING' AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1`,[userId,sessionId]); return r.rows[0]||null; }

  async confirm({ userId, sessionId, deviceId = null, phrase, expectedAction = null }) {
    if (!/^confirm coach,? (execute|activate todays plan)$/i.test(String(phrase || '').trim().replace(/[â€™']/g, ''))) return null;
    const pending = await this.pending(userId, sessionId);
    if (!pending || (pending.device_id && String(pending.device_id) !== String(deviceId || ''))) return null;
    if (expectedAction && confirmationActionHash(expectedAction) !== pending.action_hash) return null;
    const r = await this.pool.query(`UPDATE wisdo_pending_confirmations SET status='CONFIRMED',confirmed_at=NOW() WHERE confirmation_id=$1 AND status='PENDING' AND expires_at>NOW() RETURNING *`, [pending.confirmation_id]);
    return r.rows[0] || null;
  }

  async consume(confirmationId) { const r = await this.pool.query(`UPDATE wisdo_pending_confirmations SET status='CONSUMED',consumed_at=NOW() WHERE confirmation_id=$1 AND status='CONFIRMED' RETURNING *`, [confirmationId]); return r.rows[0] || null; }
  async cancel(userId, sessionId) { await this.pool.query(`UPDATE wisdo_pending_confirmations SET status='CANCELLED' WHERE owner_user_id=$1 AND session_id=$2 AND status='PENDING'`, [userId,sessionId]); }
}
