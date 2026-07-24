import { Mt4SyncService } from '../services/mt4SyncService.js';
import { ingestReporterSnapshotToProductState } from '../server/majorUpgradeRoutes.js';

const cycles = Math.max(10, Number(process.argv[2] || 1000));
const accountId = '5205295:Coinexx-Demo';
const owner = '518140439489019906';
const makeTrade = (ticket, overrides = {}) => ({
  ticket: String(ticket),
  symbol: 'EURUSD',
  type: Number(ticket) % 2 ? 'buy' : 'sell',
  lots: 0.01,
  openPrice: 1.1,
  currentPrice: 1.11,
  stopLoss: 0,
  takeProfit: 0,
  profit: 1,
  swap: 0,
  commission: 0,
  openTime: '2026-07-20T00:00:00.000Z',
  ...overrides,
});

const openTrades = Array.from({ length: 100 }, (_, index) => makeTrade(index + 1));
const closedTradesToday = Array.from({ length: 100 }, (_, index) => makeTrade(index + 101, {
  closeTime: '2026-07-20T01:00:00.000Z',
  closePrice: 1.12,
}));

const signalService = {
  async createSignalsBatch(rows) { return rows.map((row) => ({ signalId: `sig-${row.trade.ticket}` })); },
  queueSignalClosuresBatch() {},
};
const repository = {
  async getMt4State() { return {}; },
  async updateMt4State(updater) { return updater({ signalTrackingByAccountId: {} }); },
};
const mt4 = new Mt4SyncService({ api: { publicBaseUrl: '', port: 10000, mt4SyncPath: '/mt4-sync', mt4SyncApiKey: '' } }, repository);
mt4.attachTradeSignalService(signalService);

let tracking = {
  schemaVersion: 1,
  openKeys: openTrades.map((row) => [accountId, row.ticket, row.openTime, row.symbol, row.type].join('|')),
  tradeKeyToSignalId: Object.fromEntries(openTrades.map((row) => [[accountId, row.ticket, row.openTime, row.symbol, row.type].join('|'), `sig-${row.ticket}`])),
};

const productState = {
  tradingAccounts: {}, accountTelemetry: {}, trades: {}, alerts: {}, liveTradeEventKeys: {},
  accountHealthState: {}, relayDiagnostics: [], leaderCloseDetectionByTicket: {},
};
for (let index = 0; index < 4000; index += 1) {
  const id = `legacy-${index}`;
  productState.trades[id] = { id, account_id: `other-${index % 20}`, external_ticket: String(index), status: 'closed', updated_at: new Date(index).toISOString() };
}

for (let cycle = 0; cycle < cycles; cycle += 1) {
  const format = cycle % 2 ? '2026.07.20 00:00:00' : '2026-07-20T00:00:00.000Z';
  const snapshotOpenTrades = openTrades.map((row) => ({ ...row, openTime: format, currentPrice: 1.11 + (cycle % 5) * 0.00001 }));
  const signalResult = await mt4.processTradeSignals({
    connectionRecord: { accountId, discordUserId: owner, accountNumber: '5205295', accountRole: 'leader' },
    latestSnapshotRecord: { snapshot: { openTrades: snapshotOpenTrades } },
    priorTracking: tracking,
  });
  if (signalResult.opened !== 0 || signalResult.closed !== 0) {
    throw new Error(`False signal churn at cycle ${cycle}: opened=${signalResult.opened}, closed=${signalResult.closed}`);
  }
  tracking = signalResult.tracking;

  await ingestReporterSnapshotToProductState({
    connectionRecord: { accountId, discordUserId: owner, accountNumber: '5205295', brokerServer: 'Coinexx-Demo' },
    latestSnapshotRecord: {
      receivedAt: new Date(1_721_435_400_000 + cycle * 2000).toISOString(),
      snapshot: {
        balance: 1000, equity: 1001, margin: 10, freeMargin: 991, marginLevel: 10010,
        floatingPL: 1, dailyClosedPL: 5, openTradeCount: 100,
        openTrades: snapshotOpenTrades, closedTradesToday,
        terminalConnected: true, expertEnabled: true,
      },
    },
    signalSummary: { opened: 0, closed: 0 },
    loadEcosystemState: async () => productState,
    saveEcosystemState: async () => productState,
  });

  if (cycle % 100 === 0 && global.gc) global.gc();
}

if (global.gc) global.gc();
const memory = process.memoryUsage();
const accountTrades = Object.values(productState.trades).filter((row) => row.account_id === accountId).length;
console.log(JSON.stringify({
  ok: true,
  cycles,
  accountTrades,
  trackedOpenTickets: tracking.openKeys.length,
  heapUsedMB: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
  heapTotalMB: Number((memory.heapTotal / 1024 / 1024).toFixed(2)),
  rssMB: Number((memory.rss / 1024 / 1024).toFixed(2)),
}, null, 2));
