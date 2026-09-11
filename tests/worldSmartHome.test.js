import test from 'node:test';
import assert from 'node:assert/strict';

import { WorldDataAdapterService } from '../services/worldDataAdapterService.js';
import { worldCatalog } from '../server/worldRoutes.js';

function fixture() {
  const userId = 'world-user-1';
  const account = {
    accountId: 'acct-1',
    discordUserId: userId,
    ownerUserId: userId,
    accountNumber: '5301063',
    nickname: 'Primary Gold',
    brokerServer: 'Broker-Live',
    isPrimary: true,
    latestSnapshot: {
      receivedAt: new Date().toISOString(),
      snapshot: {
        accountNumber: '5301063',
        accountName: 'Primary Gold',
        brokerServer: 'Broker-Live',
        isDemo: false,
        balance: 4382.25,
        equity: 4729.5,
        floatingPL: 347.25,
        dailyClosedPL: 122.4,
        margin: 190,
        freeMargin: 4539.5,
        marginLevel: 2489.2,
        terminalConnected: true,
        expertEnabled: true,
        openTradeCount: 1,
        openTrades: [{
          ticket: 101,
          symbol: 'XAUUSD',
          type: 'buy',
          lots: 0.1,
          openPrice: 2367.42,
          currentPrice: 2371.19,
          stopLoss: 2359.1,
          takeProfit: 2388.0,
          profit: 37.7,
          swap: 0,
          commission: -0.07,
          magicNumber: 26080204,
          comment: 'HIGHTOWER',
          openTime: new Date(Date.now() - 60_000).toISOString(),
        }],
      },
    },
  };
  const history = [
    { receivedAt: new Date(Date.now() - 120_000).toISOString(), snapshot: { balance: 4300, equity: 4325, floatingPL: 25 } },
    { receivedAt: new Date(Date.now() - 60_000).toISOString(), snapshot: { balance: 4382.25, equity: 4729.5, floatingPL: 347.25 } },
  ];
  const repository = {
    async getAccessibleMt4Accounts(requestUserId) {
      assert.equal(requestUserId, userId);
      return [account];
    },
    async setPrimaryMt4Account(requestUserId, accountId) {
      assert.equal(requestUserId, userId);
      assert.equal(accountId, 'acct-1');
      return true;
    },
  };
  const mt4SyncService = {
    repository,
    async getSnapshotHistory(requestUserId, limit) {
      assert.equal(requestUserId, userId);
      assert.equal(limit, 40);
      return history;
    },
  };
  return { userId, account, repository, mt4SyncService };
}

test('WorldDataAdapter exposes real authorized account state without execution authority', async () => {
  const { userId, mt4SyncService } = fixture();
  const adapter = new WorldDataAdapterService({ mt4SyncService });
  const snapshot = await adapter.snapshot(userId);

  assert.equal(snapshot.source, 'authorized-wisdo-services');
  assert.equal(snapshot.executionFromWorldEnabled, false);
  assert.equal(snapshot.activeAccount.accountId, 'acct-1');
  assert.equal(snapshot.financial.balance, 4382.25);
  assert.equal(snapshot.financial.equity, 4729.5);
  assert.equal(snapshot.financial.floatingPL, 347.25);
  assert.equal(snapshot.positions.length, 1);
  assert.equal(snapshot.positions[0].symbol, 'XAUUSD');
  assert.equal(snapshot.positions[0].floatingPL, 37.63);
  assert.equal(snapshot.reporters.length, 1);
  assert.equal(snapshot.reporters[0].status, 'live');
  assert.equal(snapshot.reporters[0].canExecuteTradesFromWorld, false);
  assert.equal(snapshot.history.length, 2);
});

test('World never guesses an active account from list order', async () => {
  const { userId, account, mt4SyncService } = fixture();
  account.isPrimary = false;
  const adapter = new WorldDataAdapterService({ mt4SyncService });
  const snapshot = await adapter.snapshot(userId);

  assert.equal(snapshot.accounts.length, 1);
  assert.equal(snapshot.activeAccount, null);
  assert.equal(snapshot.financial, null);
  assert.deepEqual(snapshot.positions, []);
  assert.deepEqual(snapshot.history, []);
  assert.equal(snapshot.activeAccountRequired, true);
});

test('World account selection delegates to existing authorized selection service', async () => {
  const { userId, mt4SyncService } = fixture();
  const adapter = new WorldDataAdapterService({ mt4SyncService });
  const selected = await adapter.selectAccount(userId, 'acct-1');
  assert.equal(selected.accountId, 'acct-1');
  assert.equal(selected.isPrimary, true);
});

test('World catalog declares Smart Home-first architecture and no execution shortcut', () => {
  const catalog = worldCatalog();
  assert.equal(catalog.architecture, 'persistent-smart-home-civilization');
  assert.equal(catalog.defaultSpawn, 'home');
  assert.equal(catalog.executionFromWorldEnabled, false);
  assert.ok(catalog.homeRooms.some((room) => room.id === 'trading-room'));
  assert.ok(catalog.homeRooms.some((room) => room.id === 'reporter-room'));
  assert.ok(catalog.homeRooms.some((room) => room.id === 'performance-room'));
});
