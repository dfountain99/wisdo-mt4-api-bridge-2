import crypto from 'node:crypto';
import { createWorldRealtimeFabric } from '../services/worldRealtimeFabric.js';
import { createWorldEventOutboxRepository } from '../storage/worldEventOutboxRepository.js';

const workerId = process.env.WISDO_WORLD_WORKER_ID || `world-worker-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
const pollMs = Math.max(100, Number(process.env.WISDO_WORLD_WORKER_POLL_MS || 500));
const batchSize = Math.min(100, Math.max(1, Number(process.env.WISDO_WORLD_WORKER_BATCH || 25)));
const leaseSeconds = Math.min(300, Math.max(5, Number(process.env.WISDO_WORLD_WORKER_LEASE_SECONDS || 30)));
const maxAttempts = Math.min(50, Math.max(1, Number(process.env.WISDO_WORLD_EVENT_MAX_ATTEMPTS || 12)));
const fabric = createWorldRealtimeFabric({ requireRedis: true });
const outbox = createWorldEventOutboxRepository();
let stopping = false;
let timer = null;
let inFlight = false;

function delayFor(attempts) {
  const base = Math.min(60000, 500 * (2 ** Math.min(8, Math.max(0, Number(attempts || 1) - 1))));
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

async function drainOnce() {
  if (stopping || inFlight) return;
  inFlight = true;
  try {
    const rows = await outbox.claimBatch({ workerId, limit: batchSize, leaseSeconds });
    for (const row of rows) {
      if (stopping) break;
      try {
        const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
        await fabric.publish({
          ...payload,
          eventId: row.event_id,
          topic: row.topic,
          type: row.event_type,
          partitionKey: row.partition_key || payload.partitionKey || null,
          attempts: row.attempts,
          durableCreatedAt: row.created_at,
        });
        await outbox.markDispatched(row.event_id);
      } catch (error) {
        console.warn('WISDO World event dispatch failed.', { eventId: row.event_id, topic: row.topic, attempts: row.attempts, message: error.message });
        await outbox.markFailed(row.event_id, error, { retryDelayMs: delayFor(row.attempts), maxAttempts });
      }
    }
  } catch (error) {
    console.error('WISDO World worker poll failed.', { message: error.message });
  } finally {
    inFlight = false;
  }
}

async function start() {
  await outbox.ensureSchema();
  const connected = await fabric.connect();
  if (!connected) throw new Error('World worker requires Redis connectivity.');
  console.log('WISDO World worker online.', { workerId, pollMs, batchSize, leaseSeconds });
  await drainOnce();
  timer = setInterval(() => drainOnce().catch(() => undefined), pollMs);
  timer.unref?.();
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  if (timer) clearInterval(timer);
  console.log(`WISDO World worker shutting down (${signal}).`);
  const deadline = Date.now() + 8000;
  while (inFlight && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
  await fabric.close().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((error) => {
  console.error('WISDO World worker failed to start.', { message: error.message });
  process.exit(1);
});
