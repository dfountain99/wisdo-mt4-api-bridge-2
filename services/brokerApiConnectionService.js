import crypto from 'node:crypto';
import tls from 'node:tls';

import { decryptCredential, encryptCredential } from '../server/security.js';

function nowIso() { return new Date().toISOString(); }
function makeId(prefix) { return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`; }
function clean(value = '') { return String(value ?? '').trim(); }
function number(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }

export function ensureBrokerApiState(state = {}) {
  state.brokerApiConnectionsById ||= {};
  state.brokerApiOAuthStatesById ||= {};
  state.brokerApiSyncEventsById ||= {};
  return state;
}

export function sanitizeBrokerApiConnection(record = {}) {
  const safe = { ...record };
  delete safe.encryptedCredentials;
  delete safe.accessToken;
  delete safe.refreshToken;
  delete safe.apiSecretHash;
  return safe;
}

function metaApiHost(region = 'new-york') {
  const normalized = clean(region).toLowerCase().replace(/[^a-z0-9-]/g, '') || 'new-york';
  return `https://mt-client-api-v1.${normalized}.agiliumtrade.ai`;
}

async function fetchJson(url, options = {}, timeoutMs = 15000, fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.message || payload?.error || `Provider HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchMetaApiSnapshot({ token, accountId, region = 'new-york', refresh = true, fetchImpl = fetch }) {
  const accessToken = clean(token);
  const providerAccountId = clean(accountId);
  if (!accessToken) throw new Error('MetaApi token is required.');
  if (!providerAccountId) throw new Error('MetaApi account ID is required.');
  const base = `${metaApiHost(region)}/users/current/accounts/${encodeURIComponent(providerAccountId)}`;
  const headers = { accept: 'application/json', 'auth-token': accessToken };
  const query = refresh ? '?refreshTerminalState=true' : '';
  const [information, positions, orders] = await Promise.all([
    fetchJson(`${base}/account-information${query}`, { headers }, 20000, fetchImpl),
    fetchJson(`${base}/positions${query}`, { headers }, 20000, fetchImpl).catch(() => []),
    fetchJson(`${base}/orders${query}`, { headers }, 20000, fetchImpl).catch(() => []),
  ]);
  return {
    provider: 'metaapi',
    providerAccountId,
    region: clean(region) || 'new-york',
    information,
    positions: Array.isArray(positions) ? positions : [],
    orders: Array.isArray(orders) ? orders : [],
    receivedAt: nowIso(),
  };
}

function mapMetaApiPosition(position = {}) {
  const side = String(position.type || '').toUpperCase().includes('SELL') ? 'sell' : 'buy';
  return {
    ticket: clean(position.id),
    position_id: clean(position.id),
    symbol: clean(position.symbol).toUpperCase(),
    side,
    type: side,
    lots: number(position.volume),
    volume: number(position.volume),
    open_price: number(position.openPrice),
    current_price: number(position.currentPrice),
    stop_loss: number(position.stopLoss),
    take_profit: number(position.takeProfit),
    profit: number(position.profit ?? position.unrealizedProfit),
    swap: number(position.swap),
    commission: number(position.commission),
    magic: number(position.magic),
    open_time: position.time || position.brokerTime || null,
    updated_at: position.updateTime || nowIso(),
    source: 'broker_api_metaapi',
  };
}

export function applyMetaApiSnapshot(state, { userId, snapshot, deskRole = 'private', nickname = '' }) {
  ensureBrokerApiState(state);
  const info = snapshot.information || {};
  const accountNumber = clean(info.login || snapshot.providerAccountId);
  const accountId = `api_metaapi_${snapshot.providerAccountId}`;
  const previous = state.tradingAccounts?.[accountId] || {};
  state.tradingAccounts ||= {};
  const openTrades = snapshot.positions.map(mapMetaApiPosition);
  const floating = openTrades.reduce((sum, row) => sum + number(row.profit), 0);
  const account = {
    ...previous,
    id: accountId,
    user_id: clean(userId),
    platform: String(info.platform || 'mt5').toLowerCase(),
    broker: clean(info.broker || previous.broker || 'MetaApi connected broker'),
    server: clean(info.server || previous.server || snapshot.region),
    account_number: accountNumber,
    nickname: clean(nickname || previous.nickname || `${info.broker || 'MetaApi'} ${accountNumber}`),
    desk_role: clean(deskRole || previous.desk_role || 'private'),
    role: ['lead', 'dual'].includes(clean(deskRole)) ? 'master' : 'follower',
    sharing_mode: previous.sharing_mode || 'private',
    status: 'connected',
    api_connected: true,
    api_execution_enabled: false,
    execution_transport: 'monitor_only',
    reporter_connected: false,
    terminal_connected: true,
    expert_enabled: true,
    balance: number(info.balance),
    equity: number(info.equity),
    margin: number(info.margin),
    free_margin: number(info.freeMargin),
    margin_level: number(info.marginLevel),
    floating_pl: floating,
    open_trades: openTrades.length,
    currency: clean(info.currency || 'USD'),
    leverage: number(info.leverage),
    trade_allowed: info.tradeAllowed !== false,
    account_type: clean(info.type),
    source: 'broker_api_metaapi',
    broker_api_provider: 'metaapi',
    broker_api_provider_account_id: snapshot.providerAccountId,
    last_sync_at: snapshot.receivedAt,
    created_at: previous.created_at || nowIso(),
    updated_at: nowIso(),
  };
  state.tradingAccounts[accountId] = account;
  state.accountTelemetry ||= {};
  state.accountTelemetry[accountId] = {
    accountId,
    source: 'broker_api_metaapi',
    receivedAt: snapshot.receivedAt,
    balance: account.balance,
    equity: account.equity,
    margin: account.margin,
    freeMargin: account.free_margin,
    floatingPL: account.floating_pl,
    openTrades,
    orders: snapshot.orders,
  };
  state.trades ||= {};
  for (const trade of openTrades) {
    const key = `${accountId}:${trade.ticket}`;
    state.trades[key] = { ...state.trades[key], ...trade, id: key, account_id: accountId, user_id: clean(userId), status: 'open' };
  }
  return account;
}

export async function connectMetaApiAccount({ state, userId, token, accountId, region, deskRole, nickname, fetchImpl = fetch }) {
  ensureBrokerApiState(state);
  const snapshot = await fetchMetaApiSnapshot({ token, accountId, region, fetchImpl });
  const connectionId = makeId('broker_metaapi');
  const encryptedCredentials = encryptCredential({ token: clean(token), accountId: clean(accountId), region: clean(region) || 'new-york' });
  const connection = {
    id: connectionId,
    userId: clean(userId),
    provider: 'metaapi',
    providerAccountId: clean(accountId),
    region: clean(region) || 'new-york',
    status: 'connected',
    encryptedCredentials,
    lastSyncAt: snapshot.receivedAt,
    lastError: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  state.brokerApiConnectionsById[connectionId] = connection;
  const account = applyMetaApiSnapshot(state, { userId, snapshot, deskRole, nickname });
  account.broker_api_connection_id = connectionId;
  return { connection, account, snapshot };
}

export async function refreshMetaApiConnection({ state, connectionId, fetchImpl = fetch }) {
  ensureBrokerApiState(state);
  const connection = state.brokerApiConnectionsById[connectionId];
  if (!connection || connection.provider !== 'metaapi') throw new Error('MetaApi connection not found.');
  const credentials = decryptCredential(connection.encryptedCredentials);
  try {
    const snapshot = await fetchMetaApiSnapshot({ ...credentials, fetchImpl });
    const account = applyMetaApiSnapshot(state, {
      userId: connection.userId,
      snapshot,
      deskRole: state.tradingAccounts?.[`api_metaapi_${connection.providerAccountId}`]?.desk_role || 'private',
      nickname: state.tradingAccounts?.[`api_metaapi_${connection.providerAccountId}`]?.nickname || '',
    });
    account.broker_api_connection_id = connection.id;
    connection.status = 'connected';
    connection.lastSyncAt = snapshot.receivedAt;
    connection.lastError = '';
    connection.updatedAt = nowIso();
    return { connection, account, snapshot };
  } catch (error) {
    connection.status = 'error';
    connection.lastError = error.message;
    connection.updatedAt = nowIso();
    throw error;
  }
}

function writeCtraderFrame(socket, message) {
  const payload = Buffer.from(JSON.stringify(message), 'utf8');
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(payload.length, 0);
  socket.write(Buffer.concat([length, payload]));
}

function createCtraderReader(socket, onMessage) {
  let buffer = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const size = buffer.readUInt32BE(0);
      if (size <= 0 || size > 10 * 1024 * 1024) throw new Error(`Invalid cTrader frame size ${size}.`);
      if (buffer.length < 4 + size) return;
      const body = buffer.subarray(4, 4 + size).toString('utf8');
      buffer = buffer.subarray(4 + size);
      try { onMessage(JSON.parse(body)); } catch { /* ignore malformed provider event */ }
    }
  });
}

async function discoverCtraderEnvironment({ accessToken, clientId, clientSecret, environment = 'live', timeoutMs = 12000 }) {
  const host = environment === 'demo' ? 'demo.ctraderapi.com' : 'live.ctraderapi.com';
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port: 5036, servername: host, rejectUnauthorized: true });
    const timer = setTimeout(() => { socket.destroy(); reject(new Error(`cTrader ${environment} account discovery timed out.`)); }, timeoutMs);
    const finish = (fn, value) => { clearTimeout(timer); socket.destroy(); fn(value); };
    createCtraderReader(socket, (message) => {
      if (message.payloadType === 2101) {
        writeCtraderFrame(socket, { clientMsgId: makeId('ctrader_accounts'), payloadType: 2149, payload: { accessToken } });
        return;
      }
      if (message.payloadType === 2150) {
        const rows = message.payload?.ctidTraderAccount || message.payload?.ctidTraderAccounts || [];
        finish(resolve, rows.map((row) => ({ ...row, environment })));
        return;
      }
      if (message.payloadType === 50 || message.payloadType === 2142) {
        finish(reject, new Error(message.payload?.description || message.payload?.errorCode || 'cTrader Open API error.'));
      }
    });
    socket.once('secureConnect', () => {
      writeCtraderFrame(socket, { clientMsgId: makeId('ctrader_app'), payloadType: 2100, payload: { clientId, clientSecret } });
    });
    socket.once('error', (error) => finish(reject, error));
  });
}

export async function discoverCtraderAccounts({ accessToken, clientId, clientSecret }) {
  if (!clean(accessToken)) throw new Error('cTrader access token is required.');
  if (!clean(clientId) || !clean(clientSecret)) throw new Error('CTRADER_CLIENT_ID and CTRADER_CLIENT_SECRET are required.');
  const results = await Promise.allSettled([
    discoverCtraderEnvironment({ accessToken, clientId, clientSecret, environment: 'live' }),
    discoverCtraderEnvironment({ accessToken, clientId, clientSecret, environment: 'demo' }),
  ]);
  const accounts = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  if (!accounts.length) {
    const errors = results.filter((result) => result.status === 'rejected').map((result) => result.reason?.message).filter(Boolean);
    throw new Error(errors.join(' | ') || 'No cTrader accounts were authorized.');
  }
  return accounts;
}

export function createCtraderOAuthState(state, { userId, returnTo = '/app/accounts' }) {
  ensureBrokerApiState(state);
  const oauthState = crypto.randomBytes(24).toString('base64url');
  state.brokerApiOAuthStatesById[oauthState] = {
    id: oauthState,
    userId: clean(userId),
    returnTo: clean(returnTo) || '/app/accounts',
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    createdAt: nowIso(),
  };
  return oauthState;
}

export function consumeCtraderOAuthState(state, oauthState) {
  ensureBrokerApiState(state);
  const record = state.brokerApiOAuthStatesById[clean(oauthState)];
  if (!record) return null;
  delete state.brokerApiOAuthStatesById[clean(oauthState)];
  if (new Date(record.expiresAt).getTime() < Date.now()) return null;
  return record;
}

export async function exchangeCtraderAuthorizationCode({ code, clientId, clientSecret, redirectUri, fetchImpl = fetch }) {
  const query = new URLSearchParams({
    grant_type: 'authorization_code',
    code: clean(code),
    redirect_uri: clean(redirectUri),
    client_id: clean(clientId),
    client_secret: clean(clientSecret),
  });
  return fetchJson(`https://openapi.ctrader.com/apps/token?${query}`, { headers: { accept: 'application/json' } }, 15000, fetchImpl);
}

export function applyCtraderAuthorization(state, { userId, tokenPayload, accounts }) {
  ensureBrokerApiState(state);
  state.tradingAccounts ||= {};
  const connectionId = makeId('broker_ctrader');
  const encryptedCredentials = encryptCredential({
    accessToken: tokenPayload.accessToken,
    refreshToken: tokenPayload.refreshToken,
    expiresIn: tokenPayload.expiresIn,
  });
  const connection = {
    id: connectionId,
    userId: clean(userId),
    provider: 'ctrader',
    status: 'connected',
    encryptedCredentials,
    accountIds: [],
    lastSyncAt: nowIso(),
    lastError: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const imported = [];
  for (const row of accounts || []) {
    const providerAccountId = clean(row.ctidTraderAccountId || row.ctidTradingAccountId || row.accountId);
    if (!providerAccountId) continue;
    const accountId = `api_ctrader_${providerAccountId}`;
    const login = clean(row.traderLogin || row.login || providerAccountId);
    const previous = state.tradingAccounts[accountId] || {};
    const account = {
      ...previous,
      id: accountId,
      user_id: clean(userId),
      platform: 'ctrader',
      broker: clean(row.brokerTitle || row.brokerName || previous.broker || 'cTrader broker'),
      server: row.environment === 'demo' ? 'cTrader Demo' : 'cTrader Live',
      account_number: login,
      nickname: previous.nickname || `${row.environment === 'demo' ? 'Demo' : 'Live'} cTrader ${login}`,
      desk_role: previous.desk_role || 'private',
      role: previous.role || 'follower',
      sharing_mode: previous.sharing_mode || 'private',
      status: 'connected',
      api_connected: true,
      api_execution_enabled: false,
      execution_transport: 'monitor_only',
      reporter_connected: false,
      terminal_connected: true,
      expert_enabled: true,
      balance: number(previous.balance),
      equity: number(previous.equity),
      floating_pl: number(previous.floating_pl),
      open_trades: number(previous.open_trades),
      currency: previous.currency || '',
      source: 'broker_api_ctrader',
      broker_api_provider: 'ctrader',
      broker_api_provider_account_id: providerAccountId,
      broker_api_connection_id: connectionId,
      api_environment: row.environment,
      last_sync_at: nowIso(),
      created_at: previous.created_at || nowIso(),
      updated_at: nowIso(),
    };
    state.tradingAccounts[accountId] = account;
    connection.accountIds.push(accountId);
    imported.push(account);
  }
  state.brokerApiConnectionsById[connectionId] = connection;
  return { connection, accounts: imported };
}

export function createBrokerWebhookConnection(state, { userId, label = 'Broker API Bridge' }) {
  ensureBrokerApiState(state);
  const id = makeId('broker_bridge');
  const secret = crypto.randomBytes(32).toString('base64url');
  const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
  state.brokerApiConnectionsById[id] = {
    id,
    userId: clean(userId),
    provider: 'wisdo_broker_webhook',
    label: clean(label) || 'Broker API Bridge',
    status: 'awaiting_snapshot',
    apiSecretHash: secretHash,
    lastSyncAt: null,
    lastError: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  return { connection: state.brokerApiConnectionsById[id], secret };
}

export function verifyBrokerWebhookSecret(connection, suppliedSecret) {
  const expected = Buffer.from(clean(connection?.apiSecretHash), 'hex');
  const actual = Buffer.from(crypto.createHash('sha256').update(clean(suppliedSecret)).digest('hex'), 'hex');
  return expected.length > 0 && expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function applyBrokerWebhookSnapshot(state, { connection, snapshot }) {
  ensureBrokerApiState(state);
  const accountNumber = clean(snapshot.accountNumber || snapshot.login || snapshot.accountId);
  if (!accountNumber) throw new Error('Broker snapshot requires accountNumber.');
  const provider = clean(snapshot.provider || snapshot.platform || 'broker');
  const accountId = clean(snapshot.wisdoAccountId) || `api_${provider}_${accountNumber}_${crypto.createHash('sha1').update(clean(snapshot.server || snapshot.broker)).digest('hex').slice(0, 8)}`;
  state.tradingAccounts ||= {};
  const previous = state.tradingAccounts[accountId] || {};
  const positions = Array.isArray(snapshot.positions) ? snapshot.positions : [];
  const account = {
    ...previous,
    id: accountId,
    user_id: connection.userId,
    platform: clean(snapshot.platform || provider).toLowerCase(),
    broker: clean(snapshot.broker || previous.broker || provider),
    server: clean(snapshot.server || previous.server || 'API'),
    account_number: accountNumber,
    nickname: clean(snapshot.nickname || previous.nickname || `${snapshot.broker || provider} ${accountNumber}`),
    desk_role: clean(snapshot.deskRole || previous.desk_role || 'private'),
    role: previous.role || 'follower',
    sharing_mode: previous.sharing_mode || 'private',
    status: 'connected',
    api_connected: true,
    api_execution_enabled: false,
    execution_transport: 'monitor_only',
    reporter_connected: false,
    terminal_connected: snapshot.terminalConnected !== false,
    expert_enabled: snapshot.executionEnabled !== false,
    balance: number(snapshot.balance),
    equity: number(snapshot.equity),
    margin: number(snapshot.margin),
    free_margin: number(snapshot.freeMargin),
    floating_pl: number(snapshot.floatingPL ?? positions.reduce((sum, row) => sum + number(row.profit), 0)),
    open_trades: positions.length,
    currency: clean(snapshot.currency || previous.currency || 'USD'),
    source: 'broker_api_webhook',
    broker_api_provider: provider,
    broker_api_connection_id: connection.id,
    last_sync_at: nowIso(),
    created_at: previous.created_at || nowIso(),
    updated_at: nowIso(),
  };
  state.tradingAccounts[accountId] = account;
  state.accountTelemetry ||= {};
  state.accountTelemetry[accountId] = { ...snapshot, accountId, source: 'broker_api_webhook', receivedAt: nowIso(), openTrades: positions };
  connection.status = 'connected';
  connection.lastSyncAt = nowIso();
  connection.updatedAt = nowIso();
  connection.accountIds = [...new Set([...(connection.accountIds || []), accountId])];
  return account;
}
