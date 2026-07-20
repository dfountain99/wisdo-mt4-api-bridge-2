import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { Mt4CommandService } from '../services/mt4CommandService.js';
import { RankService } from '../services/rankService.js';

function clone(value) { return structuredClone(value); }

class MemoryPersistence {
  constructor(state = {}) { this.state = clone(state); this.atomicUpdates = 0; }
  peek() { return clone(this.state); }
  async load() { return clone(this.state); }
  async save(next) { this.state = clone(next); return clone(this.state); }
  async atomicUpdate(updater) {
    this.atomicUpdates += 1;
    const working = clone(this.state);
    this.state = clone((await updater(working)) || working);
    return clone(this.state);
  }
}

class MemoryStore {
  constructor(initial) { this.state = clone(initial); }
  async read() { return clone(this.state); }
  async write(next) { this.state = clone(next); return clone(this.state); }
}

function commandService(state = {}) {
  return new Mt4CommandService({ persistenceAdapter: new MemoryPersistence({ commandQueue: [], commandAuditLog: [], ...state }) });
}

test('copy commands use deterministic dedupe identities instead of growing the live queue', async () => {
  const service = commandService();
  const payload = {
    accountId: 'follower-1', routeId: 'route-1', leaderAccountId: 'leader-1',
    sourceTicket: '998877', signalId: 'signal-1', symbol: 'XAUUSD', lots: 0.01,
  };
  const first = await service.queueCommandForAccount('user-1', 'follower-1', 'COPY_OPEN_TRADE', payload);
  const second = await service.queueCommandForAccount('user-1', 'follower-1', 'COPY_OPEN_TRADE', payload);
  assert.equal(first.id, second.id);
  const state = await service.load({ cloneResult: false });
  assert.equal(state.commandQueue.filter((row) => row.status === 'pending').length, 1);
  assert.match(first.dedupeKey, /^copy:/);
});

test('normal entry queues are bounded while close authority remains available', async () => {
  const service = commandService();
  service.activeQueueLimits = () => ({ global: 25, perUser: 25, perAccount: 25, critical: 10, scan: 500 });
  for (let index = 0; index < 25; index += 1) {
    await service.queueCommandForAccount('user-1', 'follower-1', 'COPY_OPEN_TRADE', {
      accountId: 'follower-1', routeId: 'route-1', sourceTicket: `ticket-${index}`, signalId: `sig-${index}`,
    });
  }
  await assert.rejects(
    () => service.queueCommandForAccount('user-1', 'follower-1', 'COPY_OPEN_TRADE', {
      accountId: 'follower-1', routeId: 'route-1', sourceTicket: 'overflow-ticket', signalId: 'overflow-signal',
    }),
    (error) => error?.code === 'WISDO_MT4_QUEUE_CAPACITY',
  );
  const close = await service.queueCommandForAccount('user-1', 'follower-1', 'COPY_CLOSE_TRADE', {
    accountId: 'follower-1', routeId: 'route-1', sourceTicket: 'ticket-1', signalId: 'sig-1',
    immediate: true, priority: 10000,
  });
  assert.equal(close.command, 'COPY_CLOSE_TRADE');
  assert.equal(service.isCriticalCommand(close), true);
});

test('legacy or corrupted command state is scan-limited and compacted to queue-only storage', () => {
  const service = commandService();
  service.activeQueueLimits = () => ({ global: 80, perUser: 50, perAccount: 30, critical: 20, scan: 400 });
  const commandQueue = Array.from({ length: 20000 }, (_, index) => ({
    id: `legacy-${index}`, userId: `user-${index % 8}`, accountId: `account-${index % 15}`,
    command: 'COPY_OPEN_TRADE', payload: { signalId: `sig-${index}` }, status: 'pending',
    priority: 10, createdAt: new Date(Date.now() - index).toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(),
  }));
  const compacted = service.pruneCommandState({ commandQueue, commandsByUserId: { giant: commandQueue }, commandAuditLog: [] });
  assert.equal(compacted.queueCompaction.scanned, 400);
  assert.ok(compacted.commandQueue.length <= 80);
  assert.equal('commandsByUserId' in compacted, false);
  assert.equal('commandsByAccountId' in compacted, false);
});

test('50 percent growth milestones persist individually until each greeting is acknowledged', async () => {
  let snapshot = { accountId: 'acct-1', snapshot: { accountNumber: '10001', balance: 1000, equity: 1000, floatingPL: 0 } };
  const rankService = new RankService({
    config: {}, logger: { warn() {}, info() {} },
    mt4SyncService: {
      repository: { async getLatestMt4SnapshotForAccount() { return clone(snapshot); } },
      async getLatestSnapshot() { return clone(snapshot); },
    },
  });
  rankService.store = new MemoryStore({ ranksByUserId: {}, growthMilestonesByAccountId: {} });

  await rankService.processSnapshot('discord-1', 'acct-1');
  snapshot = { accountId: 'acct-1', snapshot: { accountNumber: '10001', balance: 1000, equity: 2600, floatingPL: 1600 } };
  const events = await rankService.processSnapshot('discord-1', 'acct-1');
  const milestoneEvent = events.find((event) => event.type === 'growth_milestone');
  assert.deepEqual(milestoneEvent.crossedMilestones, [50, 100, 150]);

  let recognition = await rankService.getRecognitionStatus('discord-1', 'acct-1');
  assert.equal(recognition.selected.pendingMilestone.milestonePercent, 50);
  assert.match(recognition.selected.pendingMilestone.message, /50%/);

  await rankService.acknowledgeGrowthMilestone('discord-1', 'acct-1', 50);
  recognition = await rankService.getRecognitionStatus('discord-1', 'acct-1');
  assert.equal(recognition.selected.pendingMilestone.milestonePercent, 100);
  assert.match(recognition.selected.pendingMilestone.message, /100%/);

  await rankService.acknowledgeGrowthMilestone('discord-1', 'acct-1', 100);
  recognition = await rankService.getRecognitionStatus('discord-1', 'acct-1');
  assert.equal(recognition.selected.pendingMilestone.milestonePercent, 150);
});


test('all long-lived request and Discord maps have hard size limits', () => {
  const mt4 = fs.readFileSync(path.resolve('services/mt4SyncService.js'), 'utf8');
  const api = fs.readFileSync(path.resolve('server/apiServer.js'), 'utf8');
  const site = fs.readFileSync(path.resolve('server/deadshotSite.js'), 'utf8');
  const discord = fs.readFileSync(path.resolve('services/discordSignalGridService.js'), 'utf8');
  assert.match(mt4, /WISDO_MT4_RATE_LIMIT_CACHE_MAX/);
  assert.match(mt4, /WISDO_PAIRING_RECOVERY_MAX/);
  assert.match(api, /WISDO_REPORTER_HEARTBEAT_CACHE_MAX/);
  assert.match(site, /WISDO_FUNNEL_RATE_CACHE_MAX/);
  assert.match(discord, /WISDO_DISCORD_GRID_TIMER_MAX/);
});

test('member workspace loads the live recognition layer and suppresses the legacy greeting modal', () => {
  const routes = fs.readFileSync(path.resolve('server/majorUpgradeRoutes.js'), 'utf8');
  const workspace = fs.readFileSync(path.resolve('public/js/workspace.js'), 'utf8');
  const recognition = fs.readFileSync(path.resolve('public/js/wisdo-recognition.js'), 'utf8');
  const worker = fs.readFileSync(path.resolve('public/service-worker.js'), 'utf8');
  assert.match(routes, /\/js\/wisdo-recognition\.js/);
  assert.match(routes, /!window\.WISDO_RECOGNITION_V2/);
  assert.match(workspace, /wisdo:accounts-ready/);
  assert.match(workspace, /wisdo:account-selected/);
  assert.match(recognition, /Floating P\/L/);
  assert.match(recognition, /Growth milestone/);
  assert.match(worker, /wisdo-static-v7\.0\.[56]-(?:heap-transport|snapshot-churn)/);
  assert.match(worker, /\/js\/wisdo-recognition\.js/);
});

import { WisdoPhase1Repository } from '../services/repositories/wisdoPhase1Repository.js';

class BufferedDurablePersistence {
  constructor(committed = {}) { this.committed = clone(committed); this.staged = clone(committed); this.flushes = 0; }
  async load() { return clone(this.committed); }
  async save(next) { this.staged = clone(next); return clone(this.staged); }
  async flushNow() { this.flushes += 1; this.committed = clone(this.staged); return clone(this.committed); }
  async atomicUpdate(updater) { const working = clone(this.staged); this.staged = clone((await updater(working)) || working); return clone(this.staged); }
}

test('Culture Lane configuration is committed before success and restores after a simulated redeploy', async () => {
  const adapter = new BufferedDurablePersistence();
  const firstRepository = new WisdoPhase1Repository({ persistenceAdapter: adapter });
  const state = await firstRepository.loadState();
  state.cultureLanesById.lane_alpha = {
    laneId: 'lane_alpha', ownerUserId: 'user-1', name: 'Alpha Lane',
    leaderAccountId: 'lead-1', followerAccountIds: ['follow-1'], accountIds: ['lead-1', 'follow-1'], status: 'active',
  };
  state.symbolPoliciesByLaneId.lane_alpha = { laneId: 'lane_alpha', autoMatch: true, aliases: { SPXUSD: 'US500' } };
  state.copierRules.rule_alpha = { id: 'rule_alpha', user_id: 'user-1', culture_lane_id: 'lane_alpha', master_id: 'lead-1', slave_id: 'follow-1', is_active: true };
  await firstRepository.saveState(state);
  assert.equal(adapter.flushes, 1);

  const restartedRepository = new WisdoPhase1Repository({ persistenceAdapter: adapter });
  const restored = await restartedRepository.loadState();
  assert.equal(restored.cultureLanesById.lane_alpha.name, 'Alpha Lane');
  assert.equal(restored.copierRules.rule_alpha.slave_id, 'follow-1');
  assert.equal(restored.symbolPoliciesByLaneId.lane_alpha.aliases.SPXUSD, 'US500');
});

test('Culture Lane routes use confirmed durable mutations and active relay routes restore on boot', () => {
  const routes = fs.readFileSync(path.resolve('server/majorUpgradeRoutes.js'), 'utf8');
  const api = fs.readFileSync(path.resolve('server/apiServer.js'), 'utf8');
  const repository = fs.readFileSync(path.resolve('services/repositories/wisdoPhase1Repository.js'), 'utf8');
  assert.match(routes, /function mutateCultureLane\(/);
  assert.match(routes, /Culture Lane durable save timed out/);
  assert.match(routes, /Culture Lane relay restoration completed/);
  assert.match(routes, /activeLaneRules/);
  assert.match(api, /saveEcosystemState\.durable/);
  assert.match(repository, /cultureLaneConfigurationDigest/);
  assert.match(repository, /adapter\.flushNow/);
});
