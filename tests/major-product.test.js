import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';

import { computePrice, registerMajorUpgradeRoutes } from '../server/majorUpgradeRoutes.js';
import { registerExtendedProductRoutes } from '../server/extendedProductRoutes.js';
import { decodeSignedSession, encodeSignedSession, encryptCredential, decryptCredential, verifyHmacSha256 } from '../server/security.js';
import { Mt4CommandService } from '../services/mt4CommandService.js';
import { ChartRenderService } from '../services/chartRenderService.js';

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

  const pine = await fetch(`${fixture.base}/academy/df-sauce-campaign-character.pine`);
  assert.equal(pine.status, 200);
  const pineText = await pine.text();
  assert.match(pineText, /DF Sauce Campaign Character/);
  assert.match(pineText, /holdBarsNeeded/);
  assert.match(pineText, /campaignFlipped/);
  assert.ok(pineText.split('\n').length > 300);

  const profile = await jsonFetch(`${fixture.base}/api/v2/profile`, { method: 'PATCH', headers, body: JSON.stringify({ full_name: 'Operator Live', theme: 'violet', background: 'motion-b' }) });
  assert.equal(profile.payload.profile.theme, 'violet');
  assert.equal(profile.payload.profile.background, 'motion-b');

  const me = await jsonFetch(`${fixture.base}/api/v2/me`, { headers });
  assert.equal(me.payload.profile.theme, 'violet');
  assert.equal(me.payload.profile.background, 'motion-b');
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

  const duplicate = await jsonFetch(`${fixture.base}/api/public/webhooks/broker-trade`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wisdo-signature': openBody.signature }, body: openBody.raw });
  assert.equal(duplicate.payload.queued[0].skipped, 'duplicate_open');

  const closeBody = signedBody({ account_id: master.payload.account.id, action: 'close', ticket: 'T100', symbol: 'BROKER_ALIAS_CHANGED', price: 2410, pnl: 200 });
  const close = await jsonFetch(`${fixture.base}/api/public/webhooks/broker-trade`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wisdo-signature': closeBody.signature }, body: closeBody.raw });
  assert.equal(close.response.status, 200);
  assert.equal(close.payload.queued[0].followerSymbol, 'XAUUSD.A');
  const finalState = fixture.getState();
  const copies = Object.values(finalState.trades).filter((trade) => trade.copier_rule_id === rule.payload.rule.id);
  assert.equal(copies.length, 1);
  assert.equal(copies[0].status, 'closed');

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
