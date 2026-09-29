import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { normalizeCampaignControl } from '../services/campaignControlContract.js';
import { WorldCampaignStateService } from '../services/worldCampaignStateService.js';
import { WorldCommandCenterService } from '../services/worldCommandCenterService.js';

function accountFixture(overrides = {}) {
  const now = new Date().toISOString();
  return {
    accountId: 'acct-live-1',
    stableAccountId: 'stable-live-1',
    ownerUserId: 'owner-1',
    discordUserId: 'owner-1',
    accountNumber: '5301063',
    mt4Login: '5301063',
    nickname: 'Primary Live',
    isPrimary: true,
    shared: false,
    lastSyncAt: now,
    latestSnapshot: {
      receivedAt: now,
      snapshot: {
        accountNumber: '5301063',
        isDemo: false,
        balance: 1000,
        equity: 1025,
        floatingPL: 25,
        currency: 'USD',
        terminalConnected: true,
        expertEnabled: true,
        eaName: 'HIGHTOWER UNITY',
        eaVersion: '6.21',
        openTrades: [],
        closedTradesToday: [],
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
      const record = { id: `cmd-${rows.length + 1}`, userId, accountId, command, payload, status: 'pending', createdAt: new Date().toISOString() };
      rows.push(record);
      return record;
    },
    async load() { return { commandQueue: structuredClone(rows), commandAuditLog: [] }; },
  };
}

test('V12 normalizes bot-driven campaign progress, session windows, and market sense', () => {
  const control = normalizeCampaignControl({
    version: 1,
    symbol: 'XAUUSD',
    magic: 26080204,
    ageSeconds: 2,
    enabled: true,
    campaignId: 2001,
    phase: 1,
    direction: 1,
    rail: 2365.25,
    goal: 2,
    paused: false,
    remainingSeconds: 0,
    banked: 3,
    campaignBase: 1000,
    campaignRealized: 75,
    campaignFloating: 25,
    milestonePercent: 10,
    targetEquity: 1100,
    sessionId: 3,
    sessionQuality: 1.14,
    brokerHour: 13,
    brokerMinute: 42,
    windowMode: 2,
    window1Start: 7,
    window1End: 11,
    window2Start: 13,
    window2End: 16,
    scheduleEnforced: true,
    windowAllowed: true,
    entryAllowed: true,
    intentScore: 0.82,
    continuationProbability: 0.73,
    reversalProbability: 0.21,
    pressureBias: 0.44,
    flowLeg: 3,
    continuationDefense: false,
  });
  assert.equal(control.progress.campaignBase, 1000);
  assert.equal(control.progress.targetEquity, 1100);
  assert.equal(control.session.reported, true);
  assert.equal(control.session.name, 'LONDON/NY OVERLAP');
  assert.deepEqual(control.session.windows, [
    { startHour: 7, endHour: 11, label: 'WINDOW 1' },
    { startHour: 13, endHour: 16, label: 'WINDOW 2' },
  ]);
  assert.equal(control.marketSense.intentScore, 0.82);
  assert.equal(control.marketSense.flowLeg, 3);
  assert.equal(control.marketSense.continuationProbability, 0.73);
});

test('V12 World command names match Reporter and lock-profit is a verified command', async () => {
  const repository = repositoryFixture();
  const commandService = commandServiceFixture();
  const service = new WorldCommandCenterService({ mt4SyncService: { repository }, mt4CommandService: commandService });
  const state = await service.state('owner-1', { accountId: 'stable-live-1' });
  assert.equal(state.capabilities.PAUSE_BOT.command, 'PAUSE_TRADING');
  assert.equal(state.capabilities.RESUME_BOT.command, 'RESUME_TRADING');
  assert.equal(state.capabilities.STOP_NEW_ENTRIES.command, 'STOP_ENTRIES');
  assert.equal(state.capabilities.RESUME_NEW_ENTRIES.command, 'START_ENTRIES');
  assert.equal(state.capabilities.LOCK_PROFIT.command, 'LOCK_PROFIT');
  assert.equal(state.capabilities.LOCK_PROFIT.available, true);

  const proposal = await service.propose('owner-1', { action: 'LOCK_PROFIT', accountId: 'stable-live-1', clientCommandId: 'lock-profit-v12' });
  const receipt = await service.execute('owner-1', {
    proposalId: proposal.proposalId,
    confirmationToken: proposal.confirmationToken,
    heldForMs: 1900,
  });
  assert.equal(receipt.status, 'pending');
  assert.equal(commandService.rows.at(-1).command, 'LOCK_PROFIT');
});

test('V12 account state exposes stable MT4 identity and verified victory events', async () => {
  const now = new Date();
  const account = accountFixture({
    latestSnapshot: {
      receivedAt: now.toISOString(),
      snapshot: {
        accountNumber: '5301063',
        brokerServer: 'Broker-Live',
        isDemo: false,
        balance: 1000,
        equity: 1010,
        floatingPL: 10,
        currency: 'USD',
        terminalConnected: true,
        expertEnabled: true,
        eaName: 'HIGHTOWER UNITY',
        openTrades: [],
        closedTradesToday: [
          { ticket: 11, symbol: 'XAUUSD', type: 'BUY', lots: 0.1, profit: 30, swap: 0, commission: -2, closeTime: new Date(now.getTime() - 1000).toISOString(), magicNumber: 26080204 },
          { ticket: 12, symbol: 'XAUUSD', type: 'SELL', lots: 0.1, profit: -5, swap: 0, commission: -1, closeTime: now.toISOString(), magicNumber: 26080204 },
        ],
      },
    },
  });
  const service = new WorldCampaignStateService({ mt4SyncService: { repository: repositoryFixture([account]) } });
  const state = await service.snapshot('owner-1', { accountId: 'stable-live-1' });
  assert.equal(state.account.mt4Login, '5301063');
  assert.equal(state.account.accountNumberMasked, '****1063');
  assert.equal(state.executionHealth.commandLinkReady, true);
  assert.equal(state.victoryEvents.length, 1);
  assert.equal(state.victoryEvents[0].ticket, '11');
  assert.equal(state.victoryEvents[0].profit, 28);
});

test('V12 HIGHTOWER hard-gates new entries with broker windows and WISDO pause flag', async () => {
  const [ea, receiver, reporter] = await Promise.all([
    fs.readFile(new URL('../mql4/HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4', import.meta.url), 'utf8'),
    fs.readFile(new URL('../mql4/include/WISDO_H620Receiver.mqh', import.meta.url), 'utf8'),
    fs.readFile(new URL('../mql4/include/WISDO_ReporterCampaign.mqh', import.meta.url), 'utf8'),
  ]);
  assert.match(ea, /HT6DirectTradingWindowAllows/);
  assert.match(ea, /WISDO_TRADING_PAUSED/);
  assert.match(ea, /AllowNewEntries=\(DirectAllowNewEntries && directTimeWindowAllowed && !wisdoTradingPaused\)/);
  assert.match(receiver, /windowAllowed/);
  assert.match(receiver, /entryAllowed/);
  assert.match(receiver, /intentScore/);
  assert.match(reporter, /sessionId/);
  assert.match(reporter, /targetEquity/);
  assert.match(reporter, /continuationProbability/);
});

test('V12 visual shell uses bot-driven time rail and verified gesture proposal path', async () => {
  const [time, runtime, guardian, truth] = await Promise.all([
    fs.readFile(new URL('../public/app/world/command/wisdo-time-engine.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/app/world/command/guardian-command-deck.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/app/world/command/truth-dock.js', import.meta.url), 'utf8'),
  ]);
  assert.match(time, /wcV12DayTrack/);
  assert.match(time, /ACTIVE HOURS · BOT ALLOWS NEW ENTRIES/);
  assert.match(time, /NEW ENTRIES BLOCKED/);
  assert.match(runtime, /GESTURE RECOGNIZED/);
  assert.match(runtime, /runtime\.propose\(/);
  assert.match(runtime, /runtime\.execute\(/);
  assert.match(guardian, /STOP_NEW_ENTRIES/);
  assert.match(guardian, /CLOSE_PROFIT/);
  assert.match(truth, /VERIFIED WIN/);
  assert.match(truth, /protocolLabel/);
});
