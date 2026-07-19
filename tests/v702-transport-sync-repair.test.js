import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { Mt4SyncService } from '../services/mt4SyncService.js';
import { TradeSignalService } from '../services/tradeSignalService.js';

function baseMt4State() {
  return {
    pairingCodes: {}, connections: {}, connectionsByAccountId: {}, latestSnapshots: {}, latestSnapshotsByAccountId: {},
    activeAccountByUserId: {}, accountSettingsByAccountId: {}, signalTrackingByAccountId: {}, snapshotHistory: [],
  };
}

class MemoryRepository {
  constructor() { this.state = baseMt4State(); this.recoverWrites = 0; }
  getMt4AccountId(accountNumber, server = '') { return `${accountNumber}:${server}`; }
  async getPairingCode(code) { return this.state.pairingCodes[code] || null; }
  async getMt4State() { return structuredClone(this.state); }
  async updateMt4State(updater) {
    this.recoverWrites += 1;
    const working = structuredClone(this.state);
    this.state = (await updater(working)) || working;
    return structuredClone(this.state);
  }
  async flushMt4State() { return this.state; }
}

function snapshot(pairingCode) {
  return {
    pairingCode,
    accountNumber: '5301211',
    accountName: 'Coinexx Demo',
    brokerServer: 'Coinexx-Demo',
    balance: 1000,
    equity: 1001,
    floatingPL: 1,
    dailyClosedPL: 0,
    openTradeCount: 0,
    buyTradeCount: 0,
    sellTradeCount: 0,
    totalLots: 0,
    openTrades: [],
    closedTradesToday: [],
    terminalConnected: true,
    expertEnabled: true,
  };
}

test('signed pairing code authenticates a Reporter with a stale API key and recovers only once', async () => {
  const previous = {
    MT4_PAIRING_SIGNING_SECRET: process.env.MT4_PAIRING_SIGNING_SECRET,
    MT4_ALLOW_PAIRING_CODE_AUTH: process.env.MT4_ALLOW_PAIRING_CODE_AUTH,
  };
  process.env.MT4_PAIRING_SIGNING_SECRET = 'stable-pairing-secret';
  process.env.MT4_ALLOW_PAIRING_CODE_AUTH = 'true';
  const repository = new MemoryRepository();
  const service = new Mt4SyncService({ api: { mt4SyncApiKey: 'current-api-key' }, wisdo: {} }, repository);
  const pairingCode = service.buildSignedPairingCode('518140439489019906');

  const first = await service.receiveSnapshot(snapshot(pairingCode), { 'x-culturecoin-apikey': 'stale-api-key' });
  assert.equal(first.ok, true);
  assert.equal(first.authMode, 'signed-pairing');
  const writesAfterFirst = repository.recoverWrites;

  const cached = await service.getOrRecoverPairingCode(pairingCode);
  assert.equal(cached.discordUserId, '518140439489019906');
  assert.equal(repository.recoverWrites, writesAfterFirst, 'cached pairing should not be recovered repeatedly');

  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test('stable pairing secret takes priority over the rotating Reporter API key', () => {
  const previous = process.env.MT4_PAIRING_SIGNING_SECRET;
  process.env.MT4_PAIRING_SIGNING_SECRET = 'stable-pairing-secret';
  const service = new Mt4SyncService({ api: { mt4SyncApiKey: 'rotating-api-key' }, wisdo: {} }, new MemoryRepository());
  const code = service.buildSignedPairingCode('518140439489019906');
  const [, , nonce, signature] = code.match(/^CEM-U(\d+)-(\d{6})-([A-F0-9]{8})$/);
  assert.equal(signature, service.signPairingPayload('518140439489019906', nonce, 'stable-pairing-secret'));
  if (previous === undefined) delete process.env.MT4_PAIRING_SIGNING_SECRET; else process.env.MT4_PAIRING_SIGNING_SECRET = previous;
});

test('previous API keys are accepted during controlled Reporter key rotation', () => {
  const previous = process.env.MT4_SYNC_PREVIOUS_API_KEYS;
  process.env.MT4_SYNC_PREVIOUS_API_KEYS = 'older-one,older-two';
  const service = new Mt4SyncService({ api: { mt4SyncApiKey: 'current-key' }, wisdo: {} }, new MemoryRepository());
  assert.equal(service.validateApiKey({ 'x-culturecoin-apikey': 'older-two' }).mode, 'api-key');
  if (previous === undefined) delete process.env.MT4_SYNC_PREVIOUS_API_KEYS; else process.env.MT4_SYNC_PREVIOUS_API_KEYS = previous;
});

test('101 trade signals persist as one batch without awaiting copier or Discord network work', async () => {
  const repository = { getActiveCopyRoutesForLeader: async () => [] };
  const service = new TradeSignalService({
    config: {}, client: null, repository, mt4CommandService: null, copyTradingService: null,
    operatorDeskService: null, logger: { info() {}, warn() {}, error() {} },
  });
  service.queueAutoCopyRoutes = async () => new Promise(() => {});
  service.postSignal = async () => new Promise(() => {});
  const inputs = Array.from({ length: 101 }, (_, index) => ({
    leaderUserId: 'user-1', leaderAccountId: '5301211:Coinexx-Demo', leaderAccountNumber: '5301211', leaderServer: 'Coinexx-Demo',
    trade: { ticket: 10000 + index, symbol: 'EURUSD', type: 'buy', lots: 0.01 },
    snapshot: { balance: 1000, equity: 1001 },
  }));

  const result = await Promise.race([
    service.createSignalsBatch(inputs),
    new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 250)),
  ]);
  assert.equal(result.timeout, undefined);
  assert.equal(result.length, 101);
  const stored = await service.load();
  assert.equal(stored.signalIds.length, 101);
});

test('deferred copier queue prioritizes batched closes and opens ahead of batched Discord presentation', () => {
  const source = fs.readFileSync(path.resolve('services/tradeSignalService.js'), 'utf8');
  assert.match(source, /auto-copy-close-batch'[\s\S]*?, 200\)/);
  assert.match(source, /auto-copy-open-batch'[\s\S]*?, 100\)/);
  assert.match(source, /signal-presentation-batch'[\s\S]*?, 10\)/);
  assert.match(source, /WISDO_SIGNAL_TASK_TIMEOUT_MS/);
  assert.match(source, /WISDO_SIGNAL_BACKGROUND_MAX_QUEUE/);
});

test('deployment pins Node and patches the ws null-handshake race after npm ci', () => {
  assert.equal(fs.readFileSync(path.resolve('.node-version'), 'utf8').trim(), '22.22.0');
  const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  assert.equal(packageJson.scripts.postinstall, 'node scripts/patchWsHandshake.js');
  assert.equal(packageJson.overrides.ws, '8.21.1');
  const wsSource = fs.readFileSync(path.resolve('node_modules/ws/lib/websocket.js'), 'utf8');
  assert.match(wsSource, /WISDO guard: request error and timeout can race/);
  assert.match(wsSource, /if \(!stream\) \{[\s\S]*emitErrorAndClose/);
});

test('command poll and completion use Reporter pairing authentication and recovery', () => {
  const source = fs.readFileSync(path.resolve('server/apiServer.js'), 'utf8');
  assert.match(source, /validateReporterAuth\(req\.headers, \{ pairingCode \}\)/);
  assert.match(source, /getOrRecoverPairingCode\(pairingCode\)/);
  assert.match(source, /MT4 sync request rejected/);
});
