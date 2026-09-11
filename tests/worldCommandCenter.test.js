import test from 'node:test';
import assert from 'node:assert/strict';

import { WorldCampaignStateService } from '../services/worldCampaignStateService.js';
import { WorldCommandCenterService } from '../services/worldCommandCenterService.js';

function accountFixture(overrides = {}) {
  const now = new Date().toISOString();
  return {
    accountId: 'acct-5301063',
    ownerUserId: 'owner-1',
    discordUserId: 'owner-1',
    accountNumber: '5301063',
    nickname: 'Primary Live',
    isPrimary: true,
    shared: false,
    lastSyncAt: now,
    latestSnapshot: {
      receivedAt: now,
      snapshot: {
        accountNumber: '5301063',
        isDemo: false,
        balance: 5000,
        equity: 5427.18,
        floatingPL: 427.18,
        margin: 315,
        freeMargin: 5112.18,
        marginLevel: 1723,
        currency: 'USD',
        terminalConnected: true,
        expertEnabled: true,
        eaName: 'HIGHTOWER SOVEREIGN',
        symbolMetadata: { XAUUSD: { digits: 2, pointSize: 0.01 } },
        openTrades: [
          { ticket: 101, symbol: 'XAUUSD', type: 'BUY', lots: 0.1, openPrice: 2368, currentPrice: 2374, stopLoss: 2369, takeProfit: 2382, profit: 200, magicNumber: 26080204, comment: 'HIGHTOWER', openTime: new Date(Date.now() - 180000).toISOString(), classification: 'PRIMARY' },
          { ticket: 102, symbol: 'XAUUSD', type: 'BUY', lots: 0.1, openPrice: 2370, currentPrice: 2374, stopLoss: 2369, takeProfit: 2382, profit: 140, magicNumber: 26080204, comment: 'HIGHTOWER', openTime: new Date(Date.now() - 120000).toISOString(), classification: 'ADD' },
          { ticket: 103, symbol: 'XAUUSD', type: 'BUY', lots: 0.1, openPrice: 2371, currentPrice: 2374, stopLoss: 2369, takeProfit: 2382, profit: 87.18, magicNumber: 26080204, comment: 'HIGHTOWER', openTime: new Date(Date.now() - 60000).toISOString(), classification: 'ADD' },
        ],
      },
    },
    ...overrides,
  };
}

function repositoryFixture(accounts = [accountFixture()]) {
  return {
    async getAccessibleMt4Accounts(userId) {
      return accounts.filter((account) => account.discordUserId === userId || account.shared);
    },
  };
}

function commandServiceFixture() {
  const rows = [];
  return {
    rows,
    async queueCommandForAccount(userId, accountId, command, payload = {}) {
      const existing = rows.find((row) => row.payload?.clientCommandId === payload.clientCommandId && row.accountId === accountId && row.command === command);
      if (existing) return existing;
      const record = { id: `wisdo_${payload.clientCommandId}`, userId, accountId, command, payload, status: 'pending', createdAt: new Date().toISOString(), requiresConfirmation: command.includes('CLOSE') || command.includes('EMERGENCY') };
      rows.push(record);
      return record;
    },
    async load() { return { commandQueue: structuredClone(rows), commandAuditLog: [] }; },
  };
}

test('Campaign Core model represents the real XAUUSD campaign geometry from Reporter data', async () => {
  const repository = repositoryFixture();
  const mt4SyncService = { repository };
  const service = new WorldCampaignStateService({ mt4SyncService });
  const snapshot = await service.snapshot('owner-1');
  assert.equal(snapshot.campaigns.length, 1);
  const campaign = snapshot.campaigns[0];
  assert.equal(campaign.symbol, 'XAUUSD');
  assert.equal(campaign.direction, 'BUY');
  assert.equal(campaign.positionCount, 3);
  assert.equal(campaign.primaryEntry, 2368);
  assert.equal(campaign.averageEntry, 2369.6666666666665);
  assert.equal(campaign.currentPrice, 2374);
  assert.equal(campaign.takeProfit, 2382);
  assert.equal(campaign.stopLoss, 2369);
  assert.equal(campaign.magicNumber, '26080204');
  assert.equal(campaign.canTargetByMagic, true);
  assert.equal(campaign.positions[0].classification, 'PRIMARY');
  assert.equal(campaign.positions[1].classification, 'ADD');
  assert.equal(campaign.instrumentMetadata.displayUnit, 'PIPS');
  assert.equal(snapshot.executionHealth.commandLinkReady, true);
  assert.equal(snapshot.financial.floatingPL, 427.18);
});

test('Command Center exposes only commands backed by a verified execution contract', async () => {
  const repository = repositoryFixture();
  const commandService = commandServiceFixture();
  const service = new WorldCommandCenterService({ mt4SyncService: { repository }, mt4CommandService: commandService });
  const state = await service.state('owner-1');
  assert.equal(state.capabilities.CLOSE_ALL.available, true);
  assert.equal(state.capabilities.CLOSE_POSITION.available, true);
  assert.equal(state.capabilities.CLOSE_CAMPAIGN.available, true);
  assert.equal(state.capabilities.PAUSE_BOT.available, true);
  assert.equal(state.capabilities.TRAIL_TIGHTER.connected, false);
  assert.equal(state.capabilities.BREAK_EVEN.connected, false);
  assert.equal(state.capabilities.STOP_ADDS.connected, false);
});

test('dangerous World command is proposal-only until deliberate hold confirmation then queues one idempotent MT4 command', async () => {
  const repository = repositoryFixture();
  const commandService = commandServiceFixture();
  const service = new WorldCommandCenterService({ mt4SyncService: { repository }, mt4CommandService: commandService });
  const proposal = await service.propose('owner-1', { action: 'CLOSE_CAMPAIGN', accountId: 'acct-5301063', campaignId: 'derived:XAUUSD:BUY:26080204:HIGHTOWER', clientCommandId: 'campaign-close-1' });
  assert.equal(commandService.rows.length, 0, 'proposal must never queue execution');
  assert.equal(proposal.affectedCount, 3);
  assert.equal(proposal.safetyLevel, 3);
  assert.equal(proposal.holdRequiredMs, 1800);

  await assert.rejects(() => service.execute('owner-1', { proposalId: proposal.proposalId, confirmationToken: proposal.confirmationToken, heldForMs: 500 }), /Hold confirmation/);
  assert.equal(commandService.rows.length, 0);

  const receipt = await service.execute('owner-1', { proposalId: proposal.proposalId, confirmationToken: proposal.confirmationToken, heldForMs: 1900 });
  assert.equal(receipt.status, 'pending');
  assert.equal(commandService.rows.length, 1);
  assert.equal(commandService.rows[0].command, 'CLOSE_BY_MAGIC');
  assert.equal(commandService.rows[0].payload.magicNumber, '26080204');
  assert.equal(commandService.rows[0].payload.confirmation, 'confirmed');
  assert.equal(commandService.rows[0].payload.commandId, 'campaign-close-1');
});

test('shared view-only account cannot arm World execution', async () => {
  const shared = accountFixture({ shared: true, ownerUserId: 'owner-1', discordUserId: 'owner-1', sharePermission: 'view_only', isPrimary: true });
  const repository = {
    async getAccessibleMt4Accounts(userId) { return userId === 'viewer-2' ? [{ ...shared, authorized: true }] : []; },
  };
  const service = new WorldCommandCenterService({ mt4SyncService: { repository }, mt4CommandService: commandServiceFixture() });
  const state = await service.state('viewer-2');
  assert.equal(state.capabilities.CLOSE_ALL.available, false);
  await assert.rejects(() => service.propose('viewer-2', { action: 'CLOSE_ALL', accountId: shared.accountId }), /not authorized for control/i);
});

test('Reporter disconnect disables live controls instead of queuing blind commands', async () => {
  const staleTime = new Date(Date.now() - 10 * 60_000).toISOString();
  const account = accountFixture({ lastSyncAt: staleTime, latestSnapshot: { ...accountFixture().latestSnapshot, receivedAt: staleTime } });
  const repository = repositoryFixture([account]);
  const service = new WorldCommandCenterService({ mt4SyncService: { repository }, mt4CommandService: commandServiceFixture() });
  const state = await service.state('owner-1');
  assert.equal(state.executionHealth.commandLinkReady, false);
  assert.equal(state.capabilities.EMERGENCY_STOP.available, false);
});
