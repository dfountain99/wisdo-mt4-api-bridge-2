import test from 'node:test';
import assert from 'node:assert/strict';

import { WorldMarketStateService, movementForTrade, resolveInstrumentMetadata } from '../services/worldMarketStateService.js';

function worldRepositoryFixture(profiles = {}) {
  const state = { worldProfilesByUserId: structuredClone(profiles) };
  return {
    async loadState() { return state; },
  };
}

function mt4RepositoryFixture() {
  const state = {
    connectionsByAccountId: {},
    latestSnapshotsByAccountId: {},
  };
  return {
    state,
    async getMt4State() { return structuredClone(state); },
    setAccount({ accountId, userId, trades = [], receivedAt = new Date().toISOString(), metadata = {} }) {
      state.connectionsByAccountId[accountId] = { accountId, discordUserId: userId, lastSyncAt: receivedAt };
      state.latestSnapshotsByAccountId[accountId] = {
        accountId,
        discordUserId: userId,
        receivedAt,
        snapshot: {
          openTrades: trades,
          symbolMetadata: metadata,
        },
      };
    },
  };
}

function trade({ ticket, symbol, direction, entry, current, lots = 0.1, openTime = new Date(Date.now() - 60_000).toISOString(), magicNumber = 1001, comment = 'PRIMARY' }) {
  return { ticket, symbol, type: direction, openPrice: entry, currentPrice: current, lots, openTime, magicNumber, comment };
}

const profiles = {
  A: { callsign: 'USER A', avatarStyle: 'vanguard', worldTradeVisibility: 'MEMBERS' },
  B: { callsign: 'USER B', avatarStyle: 'sentinel', worldTradeVisibility: 'MEMBERS' },
  C: { callsign: 'USER C', avatarStyle: 'architect', worldTradeVisibility: 'MEMBERS' },
};

test('instrument movement uses Reporter metadata and never hardcodes 0.0001', () => {
  const fx = resolveInstrumentMetadata({ symbolMetadata: { EURUSD: { digits: 5, pointSize: 0.00001 } } }, {}, 'EURUSD');
  assert.equal(fx.pipSize, 0.0001);
  assert.equal(fx.displayUnit, 'PIPS');
  const move = movementForTrade({ direction: 'BUY', entryPrice: 1.1000, currentPrice: 1.1015 }, fx);
  assert.ok(Math.abs(move.value - 15) < 1e-8);

  const unknown = resolveInstrumentMetadata({}, {}, 'XAUUSD');
  assert.equal(unknown.displayUnit, 'PRICE Δ');
  const raw = movementForTrade({ direction: 'BUY', entryPrice: 2368.4, currentPrice: 2370.1 }, unknown);
  assert.ok(Math.abs(raw.value - 1.7) < 1e-8);
});

test('World market skyline creates exactly one billboard per authorized active symbol', async () => {
  const mt4 = mt4RepositoryFixture();
  mt4.setAccount({
    accountId: 'acct-A', userId: 'A',
    trades: [trade({ ticket: 1, symbol: 'XAUUSD', direction: 'BUY', entry: 2368.4, current: 2368.4 })],
    metadata: { XAUUSD: { digits: 2, pointSize: 0.01 } },
  });
  const service = new WorldMarketStateService({ worldRepository: worldRepositoryFixture(profiles), mt4Repository: mt4, refreshMs: 30000 });
  await service.refresh({ broadcast: false });
  let view = service.snapshotForViewer({ userId: 'viewer' });
  assert.equal(view.markets.length, 1);
  assert.equal(view.markets[0].symbol, 'XAUUSD');
  assert.equal(view.markets[0].participants.length, 1);

  mt4.setAccount({
    accountId: 'acct-B', userId: 'B',
    trades: [trade({ ticket: 2, symbol: 'XAUUSD', direction: 'SELL', entry: 2368.7, current: 2368.4 })],
    metadata: { XAUUSD: { digits: 2, pointSize: 0.01 } },
  });
  await service.refresh({ broadcast: false });
  view = service.snapshotForViewer({ userId: 'viewer' });
  assert.equal(view.markets.length, 1, 'second XAUUSD trader must not create a second billboard');
  assert.equal(view.markets[0].buyParticipants, 1);
  assert.equal(view.markets[0].sellParticipants, 1);
  assert.equal(view.markets[0].participants.length, 2);

  mt4.setAccount({
    accountId: 'acct-C', userId: 'C',
    trades: [trade({ ticket: 3, symbol: 'EURUSD', direction: 'BUY', entry: 1.1, current: 1.101 })],
    metadata: { EURUSD: { digits: 5, pointSize: 0.00001 } },
  });
  await service.refresh({ broadcast: false });
  view = service.snapshotForViewer({ userId: 'viewer' });
  assert.deepEqual(new Set(view.markets.map((row) => row.symbol)), new Set(['XAUUSD', 'EURUSD']));

  mt4.setAccount({ accountId: 'acct-A', userId: 'A', trades: [], metadata: { XAUUSD: { digits: 2, pointSize: 0.01 } } });
  await service.refresh({ broadcast: false });
  view = service.snapshotForViewer({ userId: 'viewer' });
  assert.equal(view.markets.find((row) => row.symbol === 'XAUUSD').participants.length, 1, 'XAUUSD remains because USER B is still active');

  mt4.setAccount({ accountId: 'acct-B', userId: 'B', trades: [], metadata: { XAUUSD: { digits: 2, pointSize: 0.01 } } });
  await service.refresh({ broadcast: false });
  view = service.snapshotForViewer({ userId: 'viewer' });
  assert.equal(view.markets.some((row) => row.symbol === 'XAUUSD'), false, 'final XAUUSD close powers down that billboard');
  assert.equal(view.markets.some((row) => row.symbol === 'EURUSD'), true, 'EURUSD remains active');
});

test('same Operator same symbol direction and campaign aggregates visually without losing position count', async () => {
  const mt4 = mt4RepositoryFixture();
  mt4.setAccount({
    accountId: 'acct-A', userId: 'A',
    trades: [
      trade({ ticket: 11, symbol: 'XAUUSD', direction: 'BUY', entry: 2368, current: 2370, lots: 0.1, magicNumber: 77, comment: 'CAMPAIGN' }),
      trade({ ticket: 12, symbol: 'XAUUSD', direction: 'BUY', entry: 2369, current: 2370, lots: 0.2, magicNumber: 77, comment: 'CAMPAIGN' }),
    ],
    metadata: { XAUUSD: { digits: 2, pointSize: 0.01 } },
  });
  const service = new WorldMarketStateService({ worldRepository: worldRepositoryFixture(profiles), mt4Repository: mt4 });
  await service.refresh({ broadcast: false });
  const market = service.snapshotForViewer({ userId: 'viewer' }).markets[0];
  assert.equal(market.participants.length, 1);
  assert.equal(market.participants[0].positionCount, 2);
  assert.ok(Math.abs(market.participants[0].avgEntry - 2368.6666666667) < 0.0001);
  assert.equal('lots' in market.participants[0], false);
  assert.equal('accountId' in market.participants[0], false);
});

test('World market privacy is server-side and defaults closed', async () => {
  const mt4 = mt4RepositoryFixture();
  mt4.setAccount({ accountId: 'private', userId: 'P', trades: [trade({ ticket: 91, symbol: 'BTCUSD', direction: 'BUY', entry: 60000, current: 60100 })] });
  const service = new WorldMarketStateService({
    worldRepository: worldRepositoryFixture({ P: { callsign: 'PRIVATE OPERATOR' } }),
    mt4Repository: mt4,
  });
  await service.refresh({ broadcast: false });
  assert.equal(service.snapshotForViewer({ userId: 'viewer' }).markets.length, 0);
  const ownerView = service.snapshotForViewer({ userId: 'P' });
  assert.equal(ownerView.markets.length, 1);
  const participant = ownerView.markets[0].participants[0];
  for (const forbidden of ['accountId', 'accountNumber', 'balance', 'equity', 'lots', 'floatingPL', 'broker', 'strategy']) {
    assert.equal(forbidden in participant, false, `public market projection must not include ${forbidden}`);
  }
});
