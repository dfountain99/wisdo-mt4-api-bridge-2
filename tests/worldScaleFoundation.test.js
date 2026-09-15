import test from 'node:test';
import assert from 'node:assert/strict';
import { issueWorldRealtimeTicket, verifyWorldRealtimeTicket, ticketHasScope } from '../services/worldRealtimeTicketService.js';
import { WorldRealtimeFabric } from '../services/worldRealtimeFabric.js';

const SECRET = 'wisdo-world-realtime-test-secret-0123456789';

test('World realtime tickets are signed, scoped, and expire', () => {
  const token = issueWorldRealtimeTicket({
    userId: 'user-123',
    worldId: 'wisdo.central',
    instanceId: 'central:test',
    scopes: ['world:events:read', 'world:presence:write'],
    ttlSeconds: 60,
  }, SECRET);

  const verified = verifyWorldRealtimeTicket(token, SECRET);
  assert.equal(verified.ok, true);
  assert.equal(verified.ticket.sub, 'user-123');
  assert.equal(verified.ticket.instanceId, 'central:test');
  assert.equal(ticketHasScope(verified.ticket, 'world:events:read'), true);
  assert.equal(ticketHasScope(verified.ticket, 'world:presence:read'), false);

  const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
  assert.equal(verifyWorldRealtimeTicket(tampered, SECRET).ok, false);

  const expired = verifyWorldRealtimeTicket(token, SECRET, { nowMs: Date.now() + 120000 });
  assert.equal(expired.ok, false);
  assert.equal(expired.error, 'expired_ticket');
});

test('World realtime fabric delivers local events once in memory mode', async () => {
  const fabric = new WorldRealtimeFabric({ redisEnabled: false, requireRedis: false, presenceTtlSeconds: 30 });
  const events = [];
  const unsubscribe = await fabric.subscribe('instance.central:test', (event) => events.push(event));

  const result = await fabric.publish({
    topic: 'instance.central:test',
    type: 'bot.signal.created',
    symbol: 'XAUUSD',
  });

  assert.equal(result.redisPublished, false);
  assert.equal(result.localPublished, true);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'bot.signal.created');
  assert.equal(events[0].symbol, 'XAUUSD');

  await unsubscribe();
  await fabric.close();
});

test('World presence is ephemeral and instance-scoped in memory fallback', async () => {
  const fabric = new WorldRealtimeFabric({ redisEnabled: false, requireRedis: false, presenceTtlSeconds: 30 });
  await fabric.setPresence({
    instanceId: 'central:test',
    userId: 'user-123',
    state: { position: { x: 1, y: 0, z: 2 }, locomotionState: 'walk' },
  });
  await fabric.setPresence({
    instanceId: 'home:other',
    userId: 'user-456',
    state: { position: { x: 9, y: 0, z: 9 }, locomotionState: 'idle' },
  });

  const central = await fabric.listPresence('central:test');
  assert.equal(central.length, 1);
  assert.equal(central[0].userId, 'user-123');
  assert.deepEqual(central[0].position, { x: 1, y: 0, z: 2 });

  await fabric.removePresence('central:test', 'user-123');
  assert.equal((await fabric.listPresence('central:test')).length, 0);
  await fabric.close();
});
