import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';

import { computePrice, registerMajorUpgradeRoutes } from '../server/majorUpgradeRoutes.js';
import { registerExtendedProductRoutes } from '../server/extendedProductRoutes.js';
import { reconcileCopiedTradeCompletion } from '../server/apiServer.js';
import { decodeSignedSession, encodeSignedSession, encryptCredential, decryptCredential, verifyHmacSha256 } from '../server/security.js';
import { Mt4CommandService } from '../services/mt4CommandService.js';
import { CopyTradingService } from '../services/copyTradingService.js';
import { ChartRenderService } from '../services/chartRenderService.js';
import { ACADEMY_COURSE_COUNT, getAcademyCourse, searchAcademyCourses } from '../services/academyCatalogService.js';

process.env.NODE_ENV = 'test';
process.env.WISDO_ALLOW_TEST_IDENTITY = 'true';
process.env.SESSION_SECRET = 'test-session-secret-abcdefghijklmnopqrstuvwxyz';
process.env.ENCRYPTION_KEY = 'test-encryption-key-abcdefghijklmnopqrstuvwxyz';
process.env.BROKER_WEBHOOK_SECRET = 'test-broker-secret';
process.env.CRON_SECRET = 'test-cron-secret';

async function tempConfig() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wisdo-v5-'));
  return {
    dataDir,
    persistence: { mode: 'json', storagePath: dataDir },
    api: { publicBaseUrl: 'http://127.0.0.1' },
    affiliate: { defaultCommissionPercent: 30, activationFeeAmount: 125 },
  };
}

async function createTestServer(seed = {}, options = {}) {
  const config = await tempConfig();
  const commands = new Mt4CommandService(config);
  let state = structuredClone(seed);
  const app = express();
  app.use(express.json({ verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
  app.use(express.urlencoded({ extended: true }));
  registerMajorUpgradeRoutes(app, {
    config,
    loadEcosystemState: async () => structuredClone(state),
    saveEcosystemState: async (next) => { state = structuredClone(next); },
    mt4SyncService: options.mt4SyncService || { repository: { getMt4State: async () => ({ connectionsByAccountId: {} }), getMt4AccountId: (accountNumber, server = '') => `${accountNumber}:${server || 'server'}` } },
    mt4CommandService: commands,
    copyTradingService: {},
    logger: { info() {}, warn() {}, error() {} },
  });
  registerExtendedProductRoutes(app, {
    config,
    loadEcosystemState: async () => structuredClone(state),
    saveEcosystemState: async (next) => { state = structuredClone(next); },
    logger: { info() {}, warn() {}, error() {} },
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  return {
    base: `http://127.0.0.1:${address.port}`,
    server,
    commands,
    getState: () => structuredClone(state),
    config,
  };
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function signedBody(body) {
  const raw = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', process.env.BROKER_WEBHOOK_SECRET).update(raw).digest('hex');
  return { raw, signature };
}

test('pricing configurator computes CFD, futures, cycles, and add-ons on the server', () => {
  const result = computePrice({
    productType: 'cfd',
    plan: 'premium',
    accountQuantity: 3,
    billingCycle: 'annual',
    addons: { analyzer: true, dedicatedEnv: true, extraEnvAccounts: 2 },
  });
  assert.equal(result.basePerMonth, 4500);
  assert.equal(result.addonsMonthly, 7999);
  assert.equal(result.perMonth, 12499);
  assert.equal(result.total, 124990);
  assert.equal(result.months, 10);
  assert.equal(computePrice({ productType: 'futures', accountQuantity: 2 }).basePerMonth, 6000);
});

test('sessions, HMAC verification, and broker credentials are cryptographically protected', () => {
  const token = encodeSignedSession({ id: 'user-1', username: 'Operator' });
  assert.equal(decodeSignedSession(token).id, 'user-1');
  assert.equal(decodeSignedSession(`${token}tampered`), null);
  const encrypted = encryptCredential({ login: '123', password: 'secret' });
  assert.notEqual(encrypted.includes('secret'), true);
  assert.deepEqual(decryptCredential(encrypted), { login: '123', password: 'secret' });
  const raw = Buffer.from('{"ok":true}');
  const signature = crypto.createHmac('sha256', 'webhook').update(raw).digest('hex');
  assert.equal(verifyHmacSha256({ rawBody: raw, signature, secretValue: 'webhook' }), true);
});

test('account command copies remain synchronized and ticket closes require confirmation', async () => {
  const config = await tempConfig();
  const service = new Mt4CommandService(config);
  await assert.rejects(
    service.queueCommandForAccount('user-1', 'acct-1', 'CLOSE_BY_TICKET', { accountId: 'acct-1', ticket: '1' }),
    /confirmation_required/,
  );
  const command = await service.queueCommandForAccount('user-1', 'acct-1', 'CLOSE_BY_TICKET', { accountId: 'acct-1', ticket: '1', confirmation: 'confirmed' });
  await service.markCommandDelivered('user-1', command.id, 'acct-1');
  const data = await service.load();
  const copies = service.findCommandCopies(data, command.id);
  assert.ok(copies.length >= 3);
  assert.ok(copies.every((copy) => copy.status === 'delivered'));
});

test('concurrent MT4 command writes are serialized without losing commands or temp-file rename failures', async () => {
  const config = await tempConfig();
  const service = new Mt4CommandService(config);
  const total = 40;
  await Promise.all(Array.from({ length: total }, (_, sequence) => service.queueCommandForAccount(
    'user-race',
    'acct-race',
    'SYNC_ACCOUNT',
    { accountId: 'acct-race', sequence },
  )));
  const data = await service.load();
  assert.equal(data.commandQueue.length, total);
  assert.equal(new Set(data.commandQueue.map((command) => command.payload.sequence)).size, total);
  const files = await fs.readdir(config.dataDir);
  assert.equal(files.some((name) => name.includes('mt4-commands.json.') && name.endsWith('.tmp')), false);
});

test('lead closes bypass pause and entry filters and carry the original follower ticket', async () => {
  const config = await tempConfig();
  const service = new CopyTradingService(config);
  await service.registerMaster({ discordUserId: 'lead-1', accountNumber: '10001', displayName: 'Lead' });
  await service.followMaster({
    followerUserId: 'follower-1',
    masterUserId: 'lead-1',
    followerAccountNumber: '20002',
    followerAccountId: 'acct-follower',
    symbolFilter: ['EURUSD'],
    maxOpenTrades: 1,
  });

  const open = await service.queueMasterSignal({
    masterUserId: 'lead-1',
    masterAccountNumber: '10001',
    sourceTicket: 'LEAD-77',
    symbol: 'EURUSD',
    side: 'buy',
    lots: 0.1,
    action: 'open',
  });
  const openCommand = await service.getPendingCopyCommand('follower-1', 'acct-follower');
  assert.ok(openCommand);
  await service.markCopyCommandCompleted('follower-1', openCommand.id, { success: true, ticket: 90077 }, 'acct-follower');

  const data = await service.load();
  data.followersByUserId['follower-1'][0].paused = true;
  data.followersByUserId['follower-1'][0].symbolFilter = ['GBPUSD'];
  data.followersByUserId['follower-1'][0].openTrades = 99;
  await service.save(data);

  const close = await service.queueMasterSignal({
    masterUserId: 'lead-1',
    masterAccountNumber: '10001',
    sourceTicket: 'LEAD-77',
    symbol: 'BROKER_ALIAS_CHANGED',
    side: 'buy',
    lots: 0.1,
    action: 'close',
    signalId: open.signal.signalId,
  });
  assert.equal(close.followerCount, 1);
  const closeCommand = await service.getPendingCopyCommand('follower-1', 'acct-follower');
  assert.equal(closeCommand.command, 'COPY_CLOSE_TRADE');
  assert.equal(closeCommand.payload.sourceTicket, 'LEAD-77');
  assert.equal(closeCommand.payload.followerTicket, '90077');
  assert.equal(closeCommand.riskDecision.reason, 'close_authority');
});

test('portable chart renderer produces a valid PNG without native canvas dependencies', async () => {
  const config = await tempConfig();
  const renderer = new ChartRenderService(config);
  const result = await renderer.renderAccountChart({
    discordUserId: 'user-1',
    snapshotHistory: [
      { receivedAt: new Date().toISOString(), snapshot: { balance: 1000, equity: 1010, floatingPL: 10 } },
      { receivedAt: new Date().toISOString(), snapshot: { balance: 1010, equity: 1025, floatingPL: 15 } },
    ],
  });
  const bytes = await fs.readFile(result.filePath);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(bytes.length > 1000);
});

test('Reporter v1.55 closes by follower ticket first and never reports a missing close as success', async () => {
  const reporter = await fs.readFile(new URL('../mql4/CultureCoin_MT4_Reporter.mq4', import.meta.url), 'utf8');
  assert.match(reporter, /#property version\s+"1\.55"/);
  assert.match(reporter, /JsonGetInt\(commandJson, "followerTicket", -1\)/);
  assert.match(reporter, /JsonGetString\(commandJson, "leaderTicket", ""\)/);
  assert.match(reporter, /FindUniqueCopiedTradeByContext/);
  assert.match(reporter, /Close not executed: no unique copied trade matched/);
  assert.doesNotMatch(reporter, /No copied trade found for source " \+ sourceTicket;\s*return true;/);
});

test('copy command completion stores follower tickets and only marks a mirrored trade closed after MT4 success', async () => {
  let state = {
    trades: {
      master_1: { id: 'master_1', account_id: 'lead-account', external_ticket: 'T100', copier_rule_id: null, status: 'closed' },
      copy_1: { id: 'copy_1', account_id: 'follower-account', copier_rule_id: 'rule-1', source_trade_id: 'master_1', external_ticket: null, status: 'closing' },
    },
  };
  const load = async () => structuredClone(state);
  const save = async (next) => { state = structuredClone(next); };
  const openCommand = {
    id: 'open-command',
    command: 'COPY_OPEN_TRADE',
    accountId: 'follower-account',
    payload: { routeId: 'rule-1', leaderAccountId: 'lead-account', followerAccountId: 'follower-account', sourceTicket: 'T100' },
  };
  await reconcileCopiedTradeCompletion(load, save, openCommand, { success: true, ticket: 77100 });
  assert.equal(state.trades.copy_1.external_ticket, '77100');
  assert.equal(state.trades.copy_1.status, 'open');

  const closeCommand = { ...openCommand, id: 'close-command', command: 'COPY_CLOSE_TRADE' };
  await reconcileCopiedTradeCompletion(load, save, closeCommand, { success: true, ticket: 77100 });
  assert.equal(state.trades.copy_1.status, 'closed');
  assert.equal(state.trades.copy_1.close_command_id, 'close-command');
});


test('member experience unifies Reporter accounts, account onboarding, Academy routing, and appearance settings', async (t) => {
  const reporterAccount = {
    accountId: '5301063:Coinexx-Demo',
    accountNumber: '5301063',
    server: 'Coinexx-Demo',
    brokerServer: 'Coinexx-Demo',
    nickname: 'Live follower',
    accountRole: 'follower',
    balance: 24000,
    equity: 24350,
    floatingPL: 350,
    openTrades: 2,
    lastSyncAt: new Date().toISOString(),
    terminalConnected: true,
    expertEnabled: true,
    isPrimary: true,
  };
  let pairingSequence = 0;
  const mt4SyncService = {
    repository: {
      getMt4AccountId: (accountNumber, server = '') => `${accountNumber}:${server || 'server'}`,
      getAccessibleMt4Accounts: async () => [reporterAccount],
      getMt4State: async () => ({ connectionsByAccountId: { [reporterAccount.accountId]: reporterAccount } }),
    },
    issuePairingCode: async () => ({ pairingCode: `PAIR-${++pairingSequence}`, status: 'pending' }),
  };
  const fixture = await createTestServer({}, { mt4SyncService });
  t.after(() => fixture.server.close());
  const headers = { 'content-type': 'application/json', 'x-wisdo-test-user': 'operator-live' };

  const accounts = await jsonFetch(`${fixture.base}/api/v2/accounts?includeReporter=1`, { headers });
  assert.equal(accounts.response.status, 200);
  assert.equal(accounts.payload.accounts.length, 1);
  assert.equal(accounts.payload.accounts[0].id, reporterAccount.accountId);
  assert.equal(accounts.payload.accounts[0].reporter_connected, true);
  assert.equal(accounts.payload.accounts[0].equity, 24350);

  const created = await jsonFetch(`${fixture.base}/api/v2/accounts`, { method: 'POST', headers, body: JSON.stringify({ platform: 'mt4', broker: 'Coinexx', account_number: '990011', server: 'Coinexx-Live', role: 'master' }) });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.account.id, '990011:Coinexx-Live');
  assert.equal(created.payload.account.status, 'awaiting_reporter');
  assert.equal(created.payload.account.pairing_code, 'PAIR-1');
  assert.match(created.payload.message, /Paste the pairing code/i);

  const dashboard = await fetch(`${fixture.base}/app/dashboard?launch=1`, { headers: { ...headers, accept: 'text/html' } });
  const dashboardHtml = await dashboard.text();
  assert.equal(dashboard.status, 200);
  assert.match(dashboardHtml, /id="wisdo-boot"/);
  assert.match(dashboardHtml, /Command Center Startup/);
  assert.match(dashboardHtml, /data-wisdo-dashboard-launch/);

  const workspaceCode = await fs.readFile(new URL('../public/js/workspace.js', import.meta.url), 'utf8');
  assert.match(workspaceCode, /Waking WISDO Core/);
  assert.match(workspaceCode, /Synchronizing connected Reporter accounts/);
  assert.match(workspaceCode, /Command Center Online/);

  const education = await fetch(`${fixture.base}/app/education?bot=df-sauce-final-ai`, { headers: { ...headers, accept: 'text/html' } });
  const educationHtml = await education.text();
  assert.equal(education.status, 200);
  assert.match(educationHtml, /df-sauce-academy\.js/);
  assert.match(educationHtml, /workspace\.js/);
  assert.doesNotMatch(educationHtml, /Legacy Command Center/);

  const legacyEducation = await fetch(`${fixture.base}/member/education?bot=df-sauce-final-ai`, { headers: { ...headers, accept: 'text/html' }, redirect: 'manual' });
  assert.equal(legacyEducation.status, 302);
  assert.equal(legacyEducation.headers.get('location'), '/app/education?bot=df-sauce-final-ai');

  const commandCenter = await fetch(`${fixture.base}/app/command-center`, { headers: { ...headers, accept: 'text/html' } });
  const commandCenterHtml = await commandCenter.text();
  assert.equal(commandCenter.status, 200);
  assert.match(commandCenterHtml, /Command Center/);
  assert.match(commandCenterHtml, /window\.WISDO_PAGE="command-center"/);

  const appRoot = await fetch(`${fixture.base}/app`, { headers: { ...headers, accept: 'text/html' }, redirect: 'manual' });
  assert.equal(appRoot.status, 302);
  assert.equal(appRoot.headers.get('location'), '/app/command-center');

  const legacyCenter = await fetch(`${fixture.base}/member/command-center`, { headers: { ...headers, accept: 'text/html' }, redirect: 'manual' });
  assert.equal(legacyCenter.status, 302);
  assert.equal(legacyCenter.headers.get('location'), '/app/command-center');

  const protectedSource = await fetch(`${fixture.base}/academy/df-sauce-campaign-character.pine`);
  assert.equal(protectedSource.status, 404);
  await assert.rejects(fs.access(new URL('../public/academy/df-sauce-campaign-character.pine', import.meta.url)));


  const profile = await jsonFetch(`${fixture.base}/api/v2/profile`, { method: 'PATCH', headers, body: JSON.stringify({ full_name: 'Operator Live', theme: 'violet', background: 'motion-b' }) });
  assert.equal(profile.payload.profile.theme, 'violet');
  assert.equal(profile.payload.profile.background, 'motion-b');

  const me = await jsonFetch(`${fixture.base}/api/v2/me`, { headers });
  assert.equal(me.payload.profile.theme, 'violet');
  assert.equal(me.payload.profile.background, 'motion-b');
});

test('adaptive Academy exposes 6,500 protected courses, personalized paths, tutor replies, and scenario labs', async (t) => {
  assert.ok(ACADEMY_COURSE_COUNT >= 5000);
  const sample = searchAcademyCourses({ query: 'candlestick', level: 'starter', limit: 10 });
  assert.ok(sample.total >= 20);
  assert.ok(sample.courses.every((course) => course.level === 'starter'));
  assert.ok(getAcademyCourse(sample.courses[0].id)?.modules?.length >= 5);

  const fixture = await createTestServer({});
  t.after(() => fixture.server.close());
  const headers = { 'content-type': 'application/json', 'x-wisdo-test-user': 'academy-user' };

  const catalog = await jsonFetch(`${fixture.base}/api/v2/academy/catalog?query=risk&level=starter&limit=12`, { headers });
  assert.equal(catalog.response.status, 200);
  assert.ok(catalog.payload.summary.courseCount >= 5000);
  assert.ok(catalog.payload.courses.length > 0);

  const profile = await jsonFetch(`${fixture.base}/api/v2/academy/profile`, {
    method: 'PATCH', headers, body: JSON.stringify({ experience: 'starter', goals: 'learn forex, protect capital', markets: 'forex, gold', interests: 'candlesticks, money management', weeklyMinutes: 240, learningStyle: 'interactive' }),
  });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.payload.profile.experience, 'starter');
  assert.equal(profile.payload.path.path.length, 36);

  const tutor = await jsonFetch(`${fixture.base}/api/v2/academy/tutor`, { method: 'POST', headers, body: JSON.stringify({ message: 'What is a candlestick and how should I manage risk while practicing?' }) });
  assert.equal(tutor.response.status, 200);
  assert.match(tutor.payload.answer, /open, high, low, and close|risk/i);
  assert.doesNotMatch(tutor.payload.answer, /holdBarsNeeded|emaFastLen|campaignFlipped/);
  assert.ok(Array.isArray(tutor.payload.recommendations));
  const tutorHistory = await jsonFetch(`${fixture.base}/api/v2/academy/tutor/history`, { headers });
  assert.equal(tutorHistory.response.status, 200);
  assert.equal(tutorHistory.payload.messages.length, 2);
  const clearTutorHistory = await jsonFetch(`${fixture.base}/api/v2/academy/tutor/history`, { method: 'DELETE', headers });
  assert.equal(clearTutorHistory.payload.ok, true);

  const scenario = await jsonFetch(`${fixture.base}/api/v2/academy/df-sauce/scenarios/campaign-exit`, { headers });
  assert.equal(scenario.response.status, 200);
  assert.equal(scenario.payload.scenario.candles.length, 72);
  assert.ok(scenario.payload.scenario.checkpoints.length >= 4);
  assert.match(scenario.payload.scenario.coachNotes.join(' '), /does not expose proprietary/i);

  const tv = await jsonFetch(`${fixture.base}/api/v2/academy/tradingview-config`, { headers });
  assert.equal(tv.response.status, 200);
  assert.equal(tv.payload.privateChartConfigured, false);

  const academyClient = await fs.readFile(new URL('../public/js/df-sauce-academy.js', import.meta.url), 'utf8');
  assert.doesNotMatch(academyClient, /holdBarsNeeded|emaFastLen|campaignFlipped|copy-pine|\.pine/);
  assert.match(academyClient, /6,500|6500/);
  assert.match(academyClient, /Ask WISDO Tutor/);
});

test('copier options use explicit capabilities from one Reporter-backed response', async (t) => {
  const fixture = await createTestServer({
    tradingAccounts: {
      private_1: { id: 'private_1', user_id: 'operator-cap', platform: 'mt4', account_number: '100', server: 'Demo', desk_role: 'private', sharing_mode: 'private', status: 'connected', reporter_connected: true },
      lead_1: { id: 'lead_1', user_id: 'operator-cap', platform: 'mt4', account_number: '101', server: 'Demo', desk_role: 'lead', sharing_mode: 'private', status: 'connected', reporter_connected: true },
      receiver_1: { id: 'receiver_1', user_id: 'operator-cap', platform: 'mt4', account_number: '102', server: 'Demo', desk_role: 'receiver', sharing_mode: 'private', status: 'connected', reporter_connected: true, terminal_connected: true, expert_enabled: true },
      community_1: { id: 'community_1', user_id: 'other-user', platform: 'mt4', account_number: '103', server: 'Demo', desk_role: 'lead', sharing_mode: 'community', community_visible: true, status: 'connected', reporter_connected: true },
    },
  });
  t.after(() => fixture.server.close());
  const headers = { 'content-type': 'application/json', 'x-wisdo-test-user': 'operator-cap' };
  const options = await jsonFetch(`${fixture.base}/api/copier/options`, { headers });
  assert.equal(options.response.status, 200);
  assert.equal(options.payload.source, 'reporter-backed-account-registry');
  assert.equal(options.payload.summary.owned, 3);
  assert.equal(options.payload.summary.leads, 2);
  assert.equal(options.payload.summary.receivers, 1);
  assert.equal(options.payload.summary.privateDesks, 1);
  assert.equal(options.payload.summary.executableReceivers, 1);
  assert.equal(options.payload.receivers[0].canReceive, true);
  assert.equal(options.payload.receivers[0].canExecute, true);
  assert.equal(options.payload.leads.some((account) => account.access === 'community' && account.isCommunity), true);
  assert.equal(options.payload.privateDesks[0].capabilityWarnings.length > 0, true);

  const legacyAlias = await jsonFetch(`${fixture.base}/api/v2/copier/options`, { headers });
  assert.equal(legacyAlias.response.status, 200);
  assert.equal(legacyAlias.payload.generatedAt.length > 0, true);
  const directAlias = await jsonFetch(`${fixture.base}/copier/options`, { headers });
  assert.equal(directAlias.response.status, 200);
  assert.equal(directAlias.payload.source, 'reporter-backed-account-registry');

  const workspace = await fs.readFile(new URL('../public/js/workspace.js', import.meta.url), 'utf8');
  assert.match(workspace, /api\/copier\/options/);
  assert.match(workspace, /account\.canExecute/);
  assert.doesNotMatch(workspace.slice(workspace.indexOf('async function drawRules'), workspace.indexOf('async function drawTrades')), /api\/v2\/community\/leads/);
});

test('major product routes persist accounts and lanes, preserve auth state, and relay idempotent open/close webhooks', async (t) => {
  const seededUser = { id: 'email-user', email: 'member@example.com', passwordHash: 'old' };
  const fixture = await createTestServer({ usersById: { 'email-user': seededUser } });
  t.after(() => fixture.server.close());
  const headers = { 'content-type': 'application/json', 'x-wisdo-test-user': 'operator-1' };

  for (const route of ['/', '/copier', '/analyzer', '/compare', '/pricing', '/academy', '/blog', '/terms', '/privacy', '/risk-disclosure', '/contact']) {
    const response = await fetch(`${fixture.base}${route}`);
    assert.equal(response.status, 200, route);
  }
  const login = await fetch(`${fixture.base}/login?returnTo=${encodeURIComponent('/app/advanced-link?leaderAccountId=A&autoMatchSymbols=on')}`);
  const loginHtml = await login.text();
  assert.match(loginHtml, /leaderAccountId%3DA%26autoMatchSymbols%3Don/);
  const denied = await fetch(`${fixture.base}/app/dashboard`, { headers: { accept: 'text/html' }, redirect: 'manual' });
  assert.equal(denied.status, 302);
  assert.match(denied.headers.get('location'), /^\/login\?returnTo=/);

  const master = await jsonFetch(`${fixture.base}/api/v2/accounts`, { method: 'POST', headers, body: JSON.stringify({ platform: 'mt4', broker: 'Coinexx', account_number: '5205295', server: 'Coinexx-Demo', role: 'master', credentials: { login: '5205295', password: 'secret' } }) });
  const follower = await jsonFetch(`${fixture.base}/api/v2/accounts`, { method: 'POST', headers, body: JSON.stringify({ platform: 'mt4', broker: 'Coinexx', account_number: '5301063', server: 'Coinexx-Demo', role: 'slave' }) });
  assert.equal(master.response.status, 201);
  assert.equal(follower.response.status, 201);
  assert.equal('encrypted_credentials' in master.payload.account, false);
  assert.match(fixture.getState().tradingAccounts[master.payload.account.id].encrypted_credentials, /^gcm1\./);

  const rule = await jsonFetch(`${fixture.base}/api/v2/copier-rules`, { method: 'POST', headers, body: JSON.stringify({
    master_id: master.payload.account.id,
    slave_id: follower.payload.account.id,
    risk_type: 'equity_ratio',
    risk_value: 1,
    allowed_symbols: ['XAUUSD', 'GBPJP'],
    symbol_mapping: { GOLD: 'XAUUSD.a' },
    max_open_trades: 10,
    max_spread_points: 50,
    max_slippage_points: 5,
  }) });
  assert.equal(rule.response.status, 201);
  assert.deepEqual(rule.payload.rule.allowed_symbols, ['XAUUSD', 'GBPJPY']);

  const openBody = signedBody({ account_id: master.payload.account.id, action: 'open', ticket: 'T100', symbol: 'GOLD', side: 'buy', lots: 0.2, price: 2400, spread: 20 });
  const open = await jsonFetch(`${fixture.base}/api/public/webhooks/broker-trade`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wisdo-signature': openBody.signature }, body: openBody.raw });
  assert.equal(open.response.status, 200);
  assert.equal(open.payload.queued[0].followerSymbol, 'XAUUSD.A');
  assert.ok(open.payload.queued[0].commandId);
  assert.equal(fixture.getState().alerts['operator-1'][0].type, 'trade_opened');
  const queuedOpenCommand = (await fixture.commands.load()).commandQueue.find((command) => command.id === open.payload.queued[0].commandId);
  assert.equal(queuedOpenCommand.payload.sourceTicket, 'T100');
  assert.equal(queuedOpenCommand.payload.leaderTicket, 'T100');
  await fixture.commands.markCommandCompleted('operator-1', queuedOpenCommand.id, { success: true, ticket: 77100 }, follower.payload.account.id);

  const duplicate = await jsonFetch(`${fixture.base}/api/public/webhooks/broker-trade`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wisdo-signature': openBody.signature }, body: openBody.raw });
  assert.equal(duplicate.payload.queued[0].skipped, 'duplicate_open');

  const closeBody = signedBody({ account_id: master.payload.account.id, action: 'close', ticket: 'T100', symbol: 'BROKER_ALIAS_CHANGED', price: 2410, pnl: 200 });
  const close = await jsonFetch(`${fixture.base}/api/public/webhooks/broker-trade`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wisdo-signature': closeBody.signature }, body: closeBody.raw });
  assert.equal(close.response.status, 200);
  assert.equal(close.payload.queued[0].followerSymbol, 'XAUUSD.A');
  const queuedCloseCommand = (await fixture.commands.load()).commandQueue.find((command) => command.id === close.payload.queued[0].commandId);
  assert.equal(queuedCloseCommand.payload.sourceTicket, 'T100');
  assert.equal(queuedCloseCommand.payload.followerTicket, '77100');
  const finalState = fixture.getState();
  const copies = Object.values(finalState.trades).filter((trade) => trade.copier_rule_id === rule.payload.rule.id);
  assert.equal(copies.length, 1);
  assert.equal(copies[0].status, 'closing');

  const badWebhook = await fetch(`${fixture.base}/api/public/webhooks/broker-trade`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wisdo-signature': 'bad' }, body: openBody.raw });
  assert.equal(badWebhook.status, 401);

  const resetRequest = await jsonFetch(`${fixture.base}/api/auth/password-reset/request`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'member@example.com' }) });
  assert.ok(resetRequest.payload.developmentToken);
  const reset = await jsonFetch(`${fixture.base}/api/auth/password-reset/complete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: resetRequest.payload.developmentToken, password: 'new-password-123' }) });
  assert.equal(reset.payload.updated, true);
  assert.notEqual(fixture.getState().usersById['email-user'].passwordHash, 'old');

  const community = await jsonFetch(`${fixture.base}/api/v2/accounts/${master.payload.account.id}/community`, { method: 'PATCH', headers, body: JSON.stringify({ community_visible: true, community_name: 'Gold Culture Lead' }) });
  assert.equal(community.payload.account.community_visible, true);
  const communityLeads = await jsonFetch(`${fixture.base}/api/v2/community/leads`, { headers: { 'x-wisdo-test-user': 'another-user' } });
  assert.equal(communityLeads.payload.leads[0].access, 'community');

  const academy = await jsonFetch(`${fixture.base}/api/v2/academy/lessons/close-authority/complete`, { method: 'POST', headers, body: JSON.stringify({ score: 100 }) });
  assert.ok(academy.payload.progress.badges.includes('Copier Certified'));
  const support = await jsonFetch(`${fixture.base}/api/v2/support/tickets`, { method: 'POST', headers, body: JSON.stringify({ subject: 'Relay check', body: 'Command did not complete', account_id: follower.payload.account.id, priority: 'high' }) });
  assert.equal(support.response.status, 201);
  const pushKey = await jsonFetch(`${fixture.base}/api/v2/push/public-key`, { headers });
  assert.equal(pushKey.response.status, 503);
  assert.equal(pushKey.payload.providerReady, false);

  const pushTest = await jsonFetch(`${fixture.base}/api/v2/alerts/test-push`, { method: 'POST', headers, body: '{}' });
  assert.equal(pushTest.response.status, 503);
  assert.equal(pushTest.payload.providerReady, false);

  const billing = await jsonFetch(`${fixture.base}/api/v2/billing/checkout`, { method: 'POST', headers, body: JSON.stringify({ productType: 'cfd', plan: 'standard', accountQuantity: 1 }) });
  assert.equal(billing.response.status, 503);
  const users = await jsonFetch(`${fixture.base}/api/v2/admin/users`, { headers });
  assert.equal(users.response.status, 200);

  const deleted = await jsonFetch(`${fixture.base}/api/v2/copier-rules/${rule.payload.rule.id}`, { method: 'DELETE', headers });
  assert.equal(deleted.payload.ok, true);
  assert.equal(Object.keys(fixture.getState().copierRules).length, 0);
});
