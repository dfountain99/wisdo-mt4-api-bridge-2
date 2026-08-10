import { createHash, randomUUID } from 'node:crypto';

export const COMMAND_STATES = Object.freeze(['PENDING','DELIVERED','ACKNOWLEDGED','COMPLETED','FAILED','EXPIRED','CANCELLED']);
const TRANSITIONS = Object.freeze({ PENDING:['DELIVERED','CANCELLED','EXPIRED','FAILED'], DELIVERED:['ACKNOWLEDGED','COMPLETED','FAILED','EXPIRED'], ACKNOWLEDGED:['COMPLETED','FAILED','EXPIRED'], COMPLETED:[], FAILED:[], EXPIRED:[], CANCELLED:[] });

function clean(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])); return value; }
function digest(value) { return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }

export function createCommandEnvelope(input = {}, now = new Date()) {
  const action = clean(input.action || input.command || input.intent, 120).toUpperCase();
  const accountId = clean(input.accountId, 200);
  const requestedByUserId = clean(input.requestedByUserId || input.userId, 200);
  if (!action || !accountId || !requestedByUserId) throw Object.assign(new Error('action, accountId, and requestedByUserId are required.'), { code:'invalid_command_envelope', statusCode:400, expose:true });
  const identity = { requestedByUserId, source:clean(input.source || 'system', 40), accountId, reporterInstanceId:clean(input.reporterInstanceId, 200) || null, laneId:clean(input.laneId, 200) || null, symbol:clean(input.symbol, 80) || null, magicNumber:input.magicNumber ?? null, action, parameters:input.parameters && typeof input.parameters === 'object' ? input.parameters : {} };
  const idempotencyKey = clean(input.idempotencyKey, 250) || digest(identity);
  return { commandId:clean(input.commandId, 100) || randomUUID(), idempotencyKey, ...identity, safetyLevel:clean(input.safetyLevel || 'LOW', 40).toUpperCase(), status:'PENDING', createdAt:now.toISOString(), expiresAt:new Date(now.getTime() + Math.max(10_000, Number(input.ttlMs || 120_000))).toISOString(), deliveredAt:null, acknowledgedAt:null, completedAt:null, result:null, errorCode:null, retryCount:0 };
}

export function transitionCommand(envelope, nextStatus, detail = {}, now = new Date()) {
  const current = clean(envelope?.status).toUpperCase();
  const next = clean(nextStatus).toUpperCase();
  if (!COMMAND_STATES.includes(next) || !TRANSITIONS[current]?.includes(next)) throw Object.assign(new Error(`Invalid command transition ${current} -> ${next}.`), { code:'invalid_command_transition', statusCode:409, expose:true });
  const patch = { ...envelope, status:next };
  if (next === 'DELIVERED') patch.deliveredAt = now.toISOString();
  if (next === 'ACKNOWLEDGED') patch.acknowledgedAt = now.toISOString();
  if (['COMPLETED','FAILED','EXPIRED','CANCELLED'].includes(next)) patch.completedAt = now.toISOString();
  if (detail.result !== undefined) patch.result = detail.result;
  if (detail.errorCode !== undefined) patch.errorCode = detail.errorCode;
  if (detail.retry) patch.retryCount = Number(envelope.retryCount || 0) + 1;
  return patch;
}

export function commandStatusLabel(status) { return ({PENDING:'Queued',DELIVERED:'Delivered to MT4',ACKNOWLEDGED:'Acknowledged by MT4',COMPLETED:'Executed',FAILED:'Failed',EXPIRED:'Expired',CANCELLED:'Cancelled'})[clean(status).toUpperCase()] || 'Requested'; }
