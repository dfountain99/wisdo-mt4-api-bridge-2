import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { createCommandRegistry } from '../commands/index.js';
import { recordPresenceHeartbeat, ensurePresenceState } from '../services/culturePresenceService.js';
import { OperatorDeskService } from '../services/operatorDeskService.js';
import { wrapCommandWithInteractionGuard } from '../utils/discordInteractionGuard.js';

const root = path.resolve('.');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function registryContext() {
  return {
    service: null,
    config: {},
    mt4SyncService: null,
    mt4CommandService: null,
    wisdoAnalysisService: null,
    wisdoMemoryService: null,
    botStoreService: null,
    discordSignalGridService: null,
    logger: null,
  };
}

test('canonical Discord registry restores remodel commands without duplicates or Discord overflow', () => {
  const registry = createCommandRegistry(registryContext());
  assert.equal(registry.audit.commandCount, 77);
  assert.equal(new Set(registry.audit.names).size, registry.audit.commandCount);
  assert.ok(registry.audit.commandCount <= 100);
  for (const name of ['global-status', 'health', 'confirm', 'protect-profit', 'close-all-safe', 'academy', 'alerts', 'restore-desk']) {
    assert.ok(registry.commandMap.has(name), `missing /${name}`);
  }
});

test('interaction guard acknowledges slow commands then converts reply into editReply', async () => {
  const calls = [];
  const interaction = {
    deferred: false,
    replied: false,
    commandName: 'slow-test',
    isRepliable: () => true,
    async deferReply(options) { this.deferred = true; calls.push(['defer', options]); },
    async reply(payload) { this.replied = true; calls.push(['reply', payload]); },
    async editReply(payload) { this.replied = true; calls.push(['edit', payload]); },
    async followUp(payload) { calls.push(['follow', payload]); },
  };
  const guarded = wrapCommandWithInteractionGuard({
    data: { name: 'slow-test' },
    async execute(i) {
      await new Promise((resolve) => setTimeout(resolve, 275));
      await i.reply({ content: 'done', ephemeral: true });
    },
  }, { ackDelayMs: 250 });

  await guarded.execute(interaction);
  assert.equal(calls[0][0], 'defer');
  assert.equal(calls[1][0], 'edit');
  assert.deepEqual(calls[1][1], { content: 'done' });
});

test('presence greeting fires on first visit/day and after a real away interval, not every heartbeat', () => {
  const state = ensurePresenceState({});
  const user = { id: 'presence-user', username: 'Culture Member' };
  const first = recordPresenceHeartbeat(state, user, {
    eventType: 'page_load', status: 'online', sessionId: 'session-a', localDateKey: '2026-07-19', currentPage: '/app/dashboard',
  }, new Date('2026-07-19T13:00:00.000Z'));
  assert.equal(first.arrival.shouldGreet, true);
  assert.equal(first.arrival.reason, 'first_visit');

  const repeat = recordPresenceHeartbeat(state, user, {
    eventType: 'heartbeat', status: 'online', sessionId: 'session-a', localDateKey: '2026-07-19', currentPage: '/app/dashboard',
  }, new Date('2026-07-19T13:01:00.000Z'));
  assert.equal(repeat.arrival.shouldGreet, false);

  recordPresenceHeartbeat(state, user, {
    eventType: 'away', status: 'away', sessionId: 'session-a', localDateKey: '2026-07-19', currentPage: '/app/dashboard',
  }, new Date('2026-07-19T13:02:00.000Z'));
  const earlyReturn = recordPresenceHeartbeat(state, user, {
    eventType: 'resume', status: 'online', sessionId: 'session-a', localDateKey: '2026-07-19', currentPage: '/app/dashboard', awayThresholdMinutes: 15,
  }, new Date('2026-07-19T13:10:00.000Z'));
  assert.equal(earlyReturn.arrival.shouldGreet, false);

  recordPresenceHeartbeat(state, user, {
    eventType: 'away', status: 'away', sessionId: 'session-a', localDateKey: '2026-07-19', currentPage: '/app/dashboard',
  }, new Date('2026-07-19T13:10:00.000Z'));
  const returned = recordPresenceHeartbeat(state, user, {
    eventType: 'resume', status: 'online', sessionId: 'session-a', localDateKey: '2026-07-19', currentPage: '/app/dashboard', awayThresholdMinutes: 15,
  }, new Date('2026-07-19T13:28:00.000Z'));
  assert.equal(returned.arrival.shouldGreet, true);
  assert.equal(returned.arrival.reason, 'returned_after_away');
  assert.equal(returned.arrival.awayMinutes, 18);

  const nextDay = recordPresenceHeartbeat(state, user, {
    eventType: 'page_load', status: 'online', sessionId: 'session-b', localDateKey: '2026-07-20', currentPage: '/app/command-center',
  }, new Date('2026-07-20T12:00:00.000Z'));
  assert.equal(nextDay.arrival.shouldGreet, true);
  assert.equal(nextDay.arrival.reason, 'first_visit_today');
});

test('archived desk timestamp can be cleared during restore', async () => {
  const service = new OperatorDeskService({ dataDir: '/tmp/wisdo-test', cultureCoinRoleName: 'Culture Coin' });
  let saved = null;
  service.repository = {
    async getDesk() { return { channelId: 'desk-1', archivedAt: '2026-07-01T00:00:00.000Z', deletedAt: null, createdAt: '2026-06-01T00:00:00.000Z' }; },
    async saveDesk(record) { saved = record; },
    async getProfile() { return null; },
  };
  const member = { id: 'member-1', user: { username: 'Member' } };
  await service.saveDeskRecord(member, { status: 'active', archivedAt: null });
  assert.equal(saved.archivedAt, null);
});

test('authoritative MT4 route is the default and remodeled legacy route is opt-in', () => {
  const legacy = read('server/deadshotSite.js');
  const api = read('server/apiServer.js');
  assert.match(legacy, /ENABLE_LEGACY_DEADSHOT_MT4_SYNC/);
  assert.match(api, /Slow authoritative MT4 sync response/);
  assert.match(api, /Server-Timing/);
  assert.match(api, /app\.post\(config\.api\.mt4SyncPath \|\| '\/mt4-sync'/);
});

test('every remodeled app workspace loads the presence greeting experience', () => {
  const routes = read('server/majorUpgradeRoutes.js');
  assert.match(routes, /function presenceGreetingExperience\(\)/);
  assert.match(routes, /first session today/i);
  assert.match(routes, /returned_after_away/);
  assert.match(routes, /\$\{presenceGreetingExperience\(\)\}/);
});
