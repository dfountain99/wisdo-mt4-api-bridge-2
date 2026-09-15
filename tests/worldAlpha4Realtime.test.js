import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { issueWorldRealtimeTicket, verifyWorldRealtimeTicket } from '../services/worldRealtimeTicketService.js';
import { publicWorldInstance, resolveWorldInstance, worldRealtimeScopesForInstance } from '../services/worldInstanceService.js';
import { installWorldDurableEventBridge } from '../services/worldDurableEventBridge.js';

const SECRET = 'world-alpha4-test-secret-abcdefghijklmnopqrstuvwxyz';

test('World instance resolver binds private homes to the authenticated owner', () => {
  const home = resolveWorldInstance({ scene: 'home', userId: 'member-42' });
  assert.equal(home.worldId, 'wisdo.home');
  assert.equal(home.instanceId, 'user.member-42.home');
  assert.equal(home.visibility, 'private');
  assert.equal(home.ownerUserId, 'member-42');
  assert.equal(home.shared, false);
  assert.ok(home.topics.includes('account.member-42'));
  assert.ok(worldRealtimeScopesForInstance(home).includes('world:property:owner'));
  assert.deepEqual(publicWorldInstance(home), {
    scene: 'home', worldId: 'wisdo.home', instanceId: 'user.member-42.home', visibility: 'private', maxPlayers: 8, shared: false,
  });
});

test('World instance resolver creates stable shared Central and destination instances', () => {
  const central = resolveWorldInstance({ scene: 'central', userId: 'member-9' });
  const tower = resolveWorldInstance({ scene: 'trading-tower', userId: 'member-9' });
  assert.equal(central.instanceId, 'wisdo.central.1');
  assert.equal(central.shared, true);
  assert.ok(central.topics.includes('instance.wisdo.central.1'));
  assert.ok(central.topics.includes('account.member-9'));
  assert.equal(tower.worldId, 'wisdo.trading-tower');
  assert.equal(tower.instanceId, 'wisdo.trading-tower.1');
  assert.equal(tower.shared, true);
});

test('World realtime ticket is short-lived, scoped and instance-bound', () => {
  const instance = resolveWorldInstance({ scene: 'central', userId: 'member-77' });
  const token = issueWorldRealtimeTicket({
    userId: 'member-77', worldId: instance.worldId, instanceId: instance.instanceId,
    scopes: worldRealtimeScopesForInstance(instance), ttlSeconds: 60,
    metadata: { scene: 'central', displayName: 'Operator 77' },
  }, SECRET);
  const verified = verifyWorldRealtimeTicket(token, SECRET);
  assert.equal(verified.ok, true);
  assert.equal(verified.ticket.sub, 'member-77');
  assert.equal(verified.ticket.instanceId, 'wisdo.central.1');
  assert.ok(verified.ticket.scopes.includes('world:events:read'));
  assert.equal(verified.ticket.metadata.displayName, 'Operator 77');
});

test('durable bridge emits owner events and only publishes public signals to the shared instance', async () => {
  const published = [];
  const publisher = { publish: async (type, payload, options) => { published.push({ type, payload, options }); return { eventId: options.eventId }; } };
  const ownerEvent = {
    eventId: 'world-signal:s1', leaderUserId: 'u1', visibility: 'ACCOUNT_OWNER', symbol: 'XAUUSD', direction: 'BUY',
  };
  const publicEvent = { ...ownerEvent, eventId: 'world-signal:s2', visibility: 'PUBLIC_WORLD' };
  const engine = {
    ingestCreated: async (signal) => signal,
    ingestClosed: async (signal) => signal,
    expireEvent: async () => null,
  };
  const bridge = installWorldDurableEventBridge(engine, { publisher, enabled: true, logger: { warn() {} } });
  assert.equal(bridge.enabled, true);
  await engine.ingestCreated(ownerEvent);
  assert.equal(published.length, 1);
  assert.equal(published[0].options.topic, 'account.u1');
  await engine.ingestCreated(publicEvent);
  assert.equal(published.length, 3);
  assert.deepEqual(published.slice(1).map((row) => row.options.topic).sort(), ['account.u1', 'instance.wisdo.central.1']);
  assert.equal(published[2].payload.personalAccountActionImplied, false);
});

test('realtime server exposes signed gateway migration without moving trading authority', async () => {
  const source = await fs.readFile(new URL('../server/worldRealtimeRoutes.js', import.meta.url), 'utf8');
  assert.match(source, /\/api\/world\/realtime\/config/);
  assert.match(source, /\/api\/world\/realtime\/ticket/);
  assert.match(source, /issueWorldRealtimeTicket/);
  assert.match(source, /financialAuthority: 'wisdo-core-only'/);
  assert.doesNotMatch(source, /mt4CommandService|brokerPassword|CLOSE_ALL/);
});

test('distributed gateway subscribes to instance plus private owner topics and restricts CORS', async () => {
  const source = await fs.readFile(new URL('../scripts/startWorldRealtimeGateway.js', import.meta.url), 'utf8');
  assert.match(source, /`instance\.\$\{ticket\.instanceId\}`/);
  assert.match(source, /`account\.\$\{ticket\.sub\}`/);
  assert.match(source, /`user\.\$\{ticket\.sub\}`/);
  assert.match(source, /WISDO_WORLD_ALLOWED_ORIGINS/);
  assert.match(source, /Access-Control-Allow-Origin/);
  assert.doesNotMatch(source, /mt4CommandService|brokerPassword|OrderSend/);
});

test('browser multiplayer runtime uses the shared realtime client rather than a second network stack', async () => {
  const client = await fs.readFile(new URL('../public/app/world/world-realtime-client.js', import.meta.url), 'utf8');
  const multiplayer = await fs.readFile(new URL('../public/app/world/world-multiplayer-runtime.js', import.meta.url), 'utf8');
  assert.match(client, /\/api\/world\/realtime\/config/);
  assert.match(client, /\/api\/world\/realtime\/ticket/);
  assert.match(client, /external-gateway/);
  assert.match(client, /core-fallback/);
  assert.match(client, /wisdo:world-realtime-event/);
  assert.match(multiplayer, /createWorldRealtimeClient/);
  assert.match(multiplayer, /wisdo:world-player-state/);
  assert.doesNotMatch(multiplayer, /new EventSource\(`/);
});
