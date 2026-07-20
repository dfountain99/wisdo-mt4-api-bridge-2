import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { CopyTradingService } from '../services/copyTradingService.js';

function clone(value) { return structuredClone(value); }

class CountingPersistence {
  constructor(state = {}) {
    this.state = clone(state);
    this.loads = 0;
    this.saves = 0;
    this.atomicUpdates = 0;
  }
  async load({ cloneResult = true } = {}) {
    this.loads += 1;
    return cloneResult ? clone(this.state) : this.state;
  }
  async save(next, { cloneInput = true, cloneResult = true } = {}) {
    this.saves += 1;
    this.state = cloneInput ? clone(next) : next;
    return cloneResult ? clone(this.state) : this.state;
  }
  async atomicUpdate(updater, { normalize = (value) => value, cloneResult = true } = {}) {
    this.atomicUpdates += 1;
    const working = normalize(clone(this.state));
    this.state = normalize((await updater(working)) || working);
    return cloneResult ? clone(this.state) : this.state;
  }
}

function legacyCommand(index, overrides = {}) {
  return {
    id: overrides.id || `legacy-${index}`,
    status: overrides.status || 'pending',
    followerUserId: overrides.followerUserId || 'follower-1',
    followerAccountId: overrides.followerAccountId || 'account-1',
    followerAccountNumber: '10001',
    masterUserId: 'master-1',
    command: overrides.command || 'COPY_OPEN_TRADE',
    payload: {
      signalId: `signal-${index}`,
      sourceTicket: `ticket-${index}`,
      symbol: 'EURUSD',
      side: 'buy',
      lots: 0.01,
      ...(overrides.payload || {}),
    },
    createdAt: new Date(1_700_000_000_000 + index).toISOString(),
  };
}

function withEnv(values, fn) {
  const before = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}

test('legacy duplicate copy-command maps migrate to one bounded canonical queue', async () => withEnv({
  WISDO_COPY_COMMAND_ACTIVE_LIMIT: '40',
  WISDO_COPY_COMMAND_PER_USER_LIMIT: '30',
  WISDO_COPY_COMMAND_PER_ACCOUNT_LIMIT: '25',
  WISDO_COPY_COMMAND_CRITICAL_LIMIT: '10',
}, async () => {
  const commands = Array.from({ length: 300 }, (_, index) => legacyCommand(index));
  const adapter = new CountingPersistence({
    mastersByUserId: {},
    followersByUserId: {},
    copyCommandsByUserId: { 'follower-1': commands },
    copyCommandsByAccountId: { 'account-1': commands },
  });
  const service = new CopyTradingService({ persistenceAdapter: adapter });
  const hot = await service.loadHot();
  assert.ok(hot.copyCommandQueue.length <= 25, 'per-account queue limit should bound offline followers');
  assert.equal('copyCommandsByUserId' in adapter.state, false);
  assert.equal('copyCommandsByAccountId' in adapter.state, false);
  assert.equal(new Set(hot.copyCommandQueue.map((row) => row.id)).size, hot.copyCommandQueue.length);
  assert.equal(adapter.saves, 1, 'legacy state should be migrated once');
}));

test('one thousand simultaneous idle copy polls share one hot load and perform zero mutations', async () => {
  const adapter = new CountingPersistence({ copyCommandQueue: [], copyCommandHistory: [] });
  const service = new CopyTradingService({ persistenceAdapter: adapter });
  const results = await Promise.all(Array.from({ length: 1000 }, () => service.getPendingCopyCommand('follower-1', 'account-1')));
  assert.equal(results.every((value) => value === null), true);
  assert.equal(adapter.loads, 1);
  assert.equal(adapter.atomicUpdates, 0);
  assert.equal(adapter.saves, 0);
});

test('duplicate copy opens collapse while close authority remains queueable', async () => withEnv({
  WISDO_COPY_COMMAND_ACTIVE_LIMIT: '25',
  WISDO_COPY_COMMAND_PER_ACCOUNT_LIMIT: '10',
  WISDO_COPY_COMMAND_CRITICAL_LIMIT: '10',
}, async () => {
  const adapter = new CountingPersistence({
    mastersByUserId: { master: { discordUserId: 'master', accountNumber: '1', status: 'active' } },
    followersByUserId: { follower: [{ followerUserId: 'follower', masterUserId: 'master', followerAccountId: 'acct', followerAccountNumber: '2', status: 'active', paused: false, riskMode: 'fixed_lot', fixedLot: 0.01, maxLot: 1, maxOpenTrades: 50, copySLTP: true, symbolFilter: [] }] },
    copyCommandQueue: [],
  });
  const service = new CopyTradingService({ persistenceAdapter: adapter });
  const open = { masterUserId: 'master', sourceTicket: '77', symbol: 'EURUSD', side: 'buy', lots: 0.1, action: 'open', signalId: 'same-open' };
  await service.queueMasterSignalsBatch(Array.from({ length: 100 }, () => open));
  let hot = await service.loadHot();
  assert.equal(hot.copyCommandQueue.filter((row) => row.command === 'COPY_OPEN_TRADE').length, 1);
  await service.queueMasterSignal({ ...open, action: 'close', signalId: 'same-close' });
  hot = await service.loadHot();
  assert.equal(hot.copyCommandQueue.some((row) => row.command === 'COPY_CLOSE_TRADE'), true);
}));

test('MT4 transport source enforces compact JSON responses and avoids cached HTML routes', () => {
  const api = fs.readFileSync(path.resolve('server/apiServer.js'), 'utf8');
  const worker = fs.readFileSync(path.resolve('public/service-worker.js'), 'utf8');
  assert.match(api, /WISDO_MT4_COMMAND_RESPONSE_MAX_BYTES/);
  assert.match(api, /X-Wisdo-MT4-Route/);
  assert.match(api, /pollAfterMs/);
  assert.match(api, /MT4_COMMAND_FIELDS/);
  assert.doesNotMatch(worker, /const SHELL\s*=\s*\[\s*['"]\/['"]/);
  assert.match(worker, /request\.mode === 'navigate'/);
  assert.match(worker, /url\.pathname\.startsWith\('\/js\/'\)/);
});

test('Reporter v1.59 uses one account polling lease and server-paced low-frequency polling', () => {
  const reporter = fs.readFileSync(path.resolve('mql4/CultureCoin_MT4_Reporter.mq4'), 'utf8');
  assert.match(reporter, /#property version\s+"1\.59"/);
  assert.match(reporter, /CommandPollEverySeconds = 2/);
  assert.match(reporter, /CommandsPerPollTick = 1/);
  assert.match(reporter, /AcquireOrRefreshReporterLease/);
  assert.match(reporter, /Another Reporter instance owns this account polling lease/);
  assert.match(reporter, /pollAfterMs/);
  assert.match(reporter, /if\(loops > 2\) loops = 2/);
});

test('persistence hot-path APIs can return authoritative state without a second structured clone', () => {
  const source = fs.readFileSync(path.resolve('services/persistenceAdapter.js'), 'utf8');
  assert.match(source, /cloneResult = true/);
  assert.match(source, /cloneInput = true/);
  assert.match(source, /cloneResult \? clone\(this\.runtime\.state\) : this\.runtime\.state/);
  assert.match(source, /bufferedUpdate\(updater, \{ normalize = \(value\) => value, cloneResult = true \}/);
});
