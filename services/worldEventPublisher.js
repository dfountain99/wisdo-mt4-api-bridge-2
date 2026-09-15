import crypto from 'node:crypto';
import { createWorldEventOutboxRepository } from '../storage/worldEventOutboxRepository.js';

function clean(value, max = 200) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function defaultTopic(event = {}) {
  const instanceId = clean(event.instanceId, 160);
  if (instanceId) return `instance.${instanceId}`;
  const userId = clean(event.userId, 160);
  if (userId) return `user.${userId}`;
  return 'system.global';
}

export class WorldEventPublisher {
  constructor({ outbox = createWorldEventOutboxRepository(), source = 'wisdo-core' } = {}) {
    this.outbox = outbox;
    this.source = clean(source, 120) || 'wisdo-core';
  }

  async publish(type, payload = {}, options = {}) {
    const eventType = clean(type, 160);
    if (!eventType) throw new Error('World event type is required.');
    const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : { value: payload };
    const event = {
      ...body,
      eventId: clean(options.eventId || body.eventId, 160) || crypto.randomUUID(),
      type: eventType,
      topic: clean(options.topic || body.topic, 200) || defaultTopic(body),
      partitionKey: clean(options.partitionKey || body.partitionKey || body.instanceId || body.accountId || body.userId, 200) || null,
      source: clean(options.source || body.source, 120) || this.source,
      createdAt: body.createdAt || new Date().toISOString(),
    };
    return this.outbox.enqueue(event);
  }

  positionOpened(payload = {}, options = {}) {
    return this.publish('position.opened', payload, options);
  }

  positionClosed(payload = {}, options = {}) {
    return this.publish('position.closed', payload, options);
  }

  signalCreated(payload = {}, options = {}) {
    return this.publish('bot.signal.created', payload, options);
  }

  reporterOnline(payload = {}, options = {}) {
    return this.publish('reporter.online', payload, options);
  }

  reporterOffline(payload = {}, options = {}) {
    return this.publish('reporter.offline', payload, options);
  }
}

export function createWorldEventPublisher(options = {}) {
  return new WorldEventPublisher(options);
}
