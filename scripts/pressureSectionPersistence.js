import { PostgresKeyValuePersistenceAdapter } from '../services/persistenceAdapter.js';

const cycles = Math.max(100, Number(process.argv[2] || 5000));
const tradeCount = Math.max(1000, Number(process.argv[3] || 20000));
const hugeTrades = Object.fromEntries(Array.from({ length: tradeCount }, (_, index) => [
  `trade-${index}`,
  {
    id: `trade-${index}`,
    account_id: `account-${index % 25}`,
    external_ticket: String(index),
    symbol: index % 2 ? 'XAUUSD' : 'EURUSD',
    status: 'closed',
    profit: index % 11,
    opened_at: '2026-07-20T00:00:00.000Z',
  },
]));

const adapter = new PostgresKeyValuePersistenceAdapter({
  databaseUrl: 'postgres://pressure-test-not-used',
  namespace: `v707_pressure_${process.pid}`,
  defaultState: () => ({}),
  bufferWrites: true,
});
adapter.runtime.state = {
  trades: hugeTrades,
  accountTelemetry: {},
  tradingAccounts: {},
  cultureLanesById: {},
};
adapter.runtime.loadedAt = Date.now();
adapter.runtime.source = 'hot-cache';
adapter.scheduleFlush = () => {};

const originalTrades = adapter.runtime.state.trades;
for (let index = 0; index < cycles; index += 1) {
  await adapter.bufferedUpdate((state) => {
    state.accountTelemetry['5205295:Coinexx-Demo'] = {
      equity: 1000 + (index % 100),
      balance: 1000,
      openTradeCount: 100,
      updatedAt: index,
    };
    return state;
  }, { cloneResult: false });
  if (adapter.runtime.state.trades !== originalTrades) throw new Error(`Large trade section cloned at cycle ${index}`);
  if (index % 250 === 0 && global.gc) global.gc();
}
if (global.gc) global.gc();
const memory = process.memoryUsage();
const heapUsedMB = memory.heapUsed / 1024 / 1024;
if (heapUsedMB > 52) throw new Error(`Section persistence pressure exceeded safe heap: ${heapUsedMB.toFixed(2)} MB`);
console.log(JSON.stringify({
  ok: true,
  cycles,
  tradeCount,
  dirtySections: [...adapter.runtime.dirtySections.keys()],
  tradesReferencePreserved: adapter.runtime.state.trades === originalTrades,
  heapUsedMB: Number(heapUsedMB.toFixed(2)),
  heapTotalMB: Number((memory.heapTotal / 1024 / 1024).toFixed(2)),
  rssMB: Number((memory.rss / 1024 / 1024).toFixed(2)),
}, null, 2));
