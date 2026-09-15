import { createWorldEventPublisher } from './worldEventPublisher.js';

function enabledFromEnv() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.WISDO_WORLD_EVENTS_ENABLED || '').toLowerCase());
}

function ownerTopic(event = {}) {
  const owner = String(event.leaderUserId || event.ownerUserId || '').trim();
  return owner ? `account.${owner}` : '';
}

function publicTopic(event = {}) {
  const visibility = String(event.visibility || '').toUpperCase();
  return visibility === 'PUBLIC_WORLD' ? 'instance.wisdo.central.1' : '';
}

async function publishProjected(publisher, type, event, eventIdSuffix) {
  if (!event?.eventId) return null;
  const results = [];
  const privateTopic = ownerTopic(event);
  if (privateTopic) {
    results.push(await publisher.publish(type, event, {
      topic: privateTopic,
      partitionKey: String(event.leaderUserId || ''),
      eventId: `${event.eventId}:${eventIdSuffix}:owner`,
      source: 'wisdo-world-event-engine',
    }));
  }
  const sharedTopic = publicTopic(event);
  if (sharedTopic) {
    const publicEvent = {
      eventId: event.eventId,
      eventType: type,
      signalId: event.signalId,
      serverTimestamp: event.serverTimestamp,
      tradeTimestamp: event.tradeTimestamp,
      expiresAt: event.expiresAt,
      decisionWindowSeconds: event.decisionWindowSeconds,
      botId: event.botId,
      botName: event.botName,
      strategyName: event.strategyName,
      symbol: event.symbol,
      direction: event.direction,
      entryPrice: event.entryPrice,
      signalType: event.signalType,
      visibility: event.visibility,
      tradeId: event.tradeId,
      campaignId: event.campaignId,
      presentationKey: event.presentationKey,
      tradeStatus: event.tradeStatus,
      presentationStatus: event.presentationStatus,
      closedAt: event.closedAt,
      updatedAt: event.updatedAt,
      botAction: true,
      personalAccountActionImplied: false,
    };
    results.push(await publisher.publish(type, publicEvent, {
      topic: sharedTopic,
      partitionKey: 'wisdo.central.1',
      eventId: `${event.eventId}:${eventIdSuffix}:public`,
      source: 'wisdo-world-event-engine',
    }));
  }
  return results;
}

export function installWorldDurableEventBridge(eventEngine, {
  publisher = createWorldEventPublisher(),
  enabled = enabledFromEnv(),
  logger = console,
} = {}) {
  if (!enabled) return { enabled: false, reason: 'WISDO_WORLD_EVENTS_ENABLED=false' };
  if (!eventEngine || eventEngine.__wisdoDurableEventBridgeInstalled) {
    return { enabled: Boolean(eventEngine?.__wisdoDurableEventBridgeInstalled), reason: 'already_installed_or_missing_engine' };
  }
  Object.defineProperty(eventEngine, '__wisdoDurableEventBridgeInstalled', { value: true, configurable: true });

  const originalCreated = eventEngine.ingestCreated?.bind(eventEngine);
  if (originalCreated) {
    eventEngine.ingestCreated = async (signal, options = {}) => {
      const saved = await originalCreated(signal, options);
      if (saved) await publishProjected(publisher, 'bot.signal.created', saved, 'created').catch((error) => {
        logger?.warn?.('Durable World signal create publish failed.', { eventId: saved.eventId, message: error.message });
      });
      return saved;
    };
  }

  const originalClosed = eventEngine.ingestClosed?.bind(eventEngine);
  if (originalClosed) {
    eventEngine.ingestClosed = async (close = {}) => {
      const saved = await originalClosed(close);
      if (saved) await publishProjected(publisher, 'bot.signal.updated', saved, 'closed').catch((error) => {
        logger?.warn?.('Durable World signal close publish failed.', { eventId: saved.eventId, message: error.message });
      });
      return saved;
    };
  }

  const originalExpire = eventEngine.expireEvent?.bind(eventEngine);
  if (originalExpire) {
    eventEngine.expireEvent = async (eventId) => {
      const saved = await originalExpire(eventId);
      if (saved) await publishProjected(publisher, 'bot.signal.expired', saved, 'expired').catch((error) => {
        logger?.warn?.('Durable World signal expiry publish failed.', { eventId: saved.eventId, message: error.message });
      });
      return saved;
    };
  }

  return {
    enabled: true,
    authority: 'server-confirmed-world-event-engine',
    financialExecution: false,
    durableOutbox: true,
  };
}
