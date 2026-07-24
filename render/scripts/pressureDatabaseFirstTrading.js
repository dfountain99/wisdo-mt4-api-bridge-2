import { Mt4SyncService } from '../services/mt4SyncService.js';

const iterations = Math.max(100, Number(process.argv[2] || 5000));
const tradeCount = Math.max(1, Number(process.argv[3] || 100));
process.env.WISDO_REPLAY_EXISTING_TRADES_ON_FIRST_SYNC = 'false';
process.env.WISDO_MT4_SYNC_MIN_INTERVAL_MS = '100';

const pairingCode = 'CEM-DB708A';
const pairing = {
  pairingCode,
  discordUserId: 'pressure-user',
  channelId: 'pressure-channel',
  status: 'connected',
  accountNumber: '5205295',
  brokerServer: 'Coinexx-Demo',
  accountRole: 'private',
  copyPermission: 'private',
  createdAt: '2026-07-20T00:00:00.000Z',
  connectedAt: '2026-07-20T00:00:00.000Z',
  expiresAt: '2036-07-20T00:00:00.000Z',
};

const rowState = {
  connection: null,
  settings: { accountRole: 'private', copyPermission: 'private' },
  latestSnapshot: null,
  tracking: null,
  activeAccountId: null,
};
let commits = 0;
const repository = {
  async getPairingCode(code) { return code === pairingCode ? pairing : null; },
  async getMt4SnapshotContext() { return rowState; },
  async persistMt4Snapshot(payload) {
    commits += 1;
    rowState.connection = payload.connectionRecord;
    rowState.settings = payload.settings;
    rowState.latestSnapshot = payload.latestSnapshotRecord;
    rowState.tracking = payload.tracking;
    rowState.activeAccountId ||= payload.connectionRecord.accountId;
    return payload.latestSnapshotRecord;
  },
  getMt4AccountId(accountNumber, server) { return `${accountNumber}:${server}`; },
  async getMt4State() { throw new Error('database-first heartbeat must not load the full MT4 namespace'); },
  async updateMt4State() { throw new Error('database-first heartbeat must not update the full MT4 namespace'); },
};

const service = new Mt4SyncService({ api: { mt4SyncApiKey: '' }, wisdo: { mt4StaleMinutes: 5 } }, repository);
const openTrades = Array.from({ length: tradeCount }, (_, index) => ({
  ticket: String(index + 1), symbol: 'EURUSD', type: index % 2 ? 'sell' : 'buy', lots: 0.01,
  openPrice: 1.1, currentPrice: 1.101, stopLoss: 0, takeProfit: 0, profit: 0.25,
  swap: 0, commission: 0, openTime: '2026-07-20T00:00:00.000Z',
}));

for (let index = 0; index < iterations; index += 1) {
  service.requestTimestamps.clear();
  await service.receiveSnapshot({
    pairingCode, accountNumber: '5205295', accountName: 'Database Pressure', brokerServer: 'Coinexx-Demo',
    balance: 10000 + index, equity: 10010 + index, margin: 100, freeMargin: 9910 + index,
    marginLevel: 10000, floatingPL: 10, dailyClosedPL: 0, openTradeCount: tradeCount,
    buyTradeCount: Math.ceil(tradeCount / 2), sellTradeCount: Math.floor(tradeCount / 2), totalLots: tradeCount * 0.01,
    terminalConnected: true, expertEnabled: true, timestamp: new Date(1721433600000 + index * 15000).toISOString(),
    openTrades,
  });
  if (index % 250 === 0 && global.gc) global.gc();
}
if (global.gc) global.gc();
const memory = process.memoryUsage();
console.log(JSON.stringify({
  ok: true,
  version: '7.0.8',
  iterations,
  tradeCount,
  commits,
  heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
  rssMb: Number((memory.rss / 1024 / 1024).toFixed(2)),
  fullNamespaceLoads: 0,
  fullNamespaceWrites: 0,
}));
