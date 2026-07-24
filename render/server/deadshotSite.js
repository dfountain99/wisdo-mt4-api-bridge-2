import crypto from 'node:crypto';
import { SquarePaymentGateway, encodeSquarePaymentNote } from '../services/squarePaymentService.js';
import { NotificationDeliveryService } from '../services/notificationDeliveryService.js';
import { GrowthFunnelService } from '../services/growthFunnelService.js';
import { encodeSignedSession, decodeSignedSession, safeReturnPath } from './security.js';

const SESSION_COOKIE = 'cc_user';

const PRODUCTS = [
  {
    id: 'free-reporter',
    name: 'Free Reporter Access',
    price: 0,
    interval: null,
    mode: 'free',
    badge: 'Free',
    description: 'Market reports, alerts, bot commentary, risk warnings, and limited dashboard visibility.',
    features: ['Culture Coin Reporter', 'Market alerts', 'Bot commentary', 'Risk warnings', 'No trade copying'],
  },
  {
    id: 'culture-coin-monthly',
    name: 'Culture Coin Monthly Membership',
    price: 197,
    interval: 'month',
    mode: 'subscription',
    badge: 'Most Popular',
    description: 'Unlock trade copier access, account connection, risk controls, and member command dashboard.',
    features: ['Reporter', 'Trade copier access', 'Trading account connection', 'Risk controls', 'Trade history'],
  },
  {
    id: 'culture-coin-annual',
    name: 'Culture Coin Annual Membership',
    price: 1497,
    interval: 'year',
    mode: 'subscription',
    badge: 'Best Value',
    description: 'Annual Culture Coin membership with copier access and command-center controls.',
    features: ['Everything monthly includes', 'Annual access', 'Priority onboarding', 'Locked-in membership lane'],
  },
  {
    id: 'pro-bot-control',
    name: 'Pro Bot Control Add-on',
    price: 297,
    interval: 'month',
    mode: 'subscription',
    badge: 'Bot Upgrade',
    description: 'Advanced bot mode switching, Discord command console, and strategy-control pages.',
    features: ['Bot control center', 'Discord console', 'Advanced strategy cards', 'Emergency control panel'],
  },
  {
    id: 'vip-command-center',
    name: 'VIP Command Center',
    price: 497,
    interval: 'month',
    mode: 'subscription',
    badge: 'VIP',
    description: 'Full command-center experience for serious operators and multi-account users.',
    features: ['Everything in Culture Coin', 'VIP bot controls', 'Priority support', 'Advanced copier gates'],
  },
  {
    id: 'setup-fee',
    name: 'One-Time Setup Fee',
    price: 297,
    interval: null,
    mode: 'payment',
    badge: 'Setup',
    description: 'Guided setup for Discord, MT4/MT5 bridge, reporter, pairing code, and risk defaults.',
    features: ['Setup walkthrough', 'Discord connection', 'MT4/MT5 pairing', 'Risk preset setup'],
  },
  {
    id: 'webinar-special',
    name: 'Webinar Special Offer',
    price: 97,
    interval: null,
    mode: 'payment',
    badge: 'Limited',
    description: 'Fast-start offer from the webinar replay page.',
    features: ['Replay access', 'Setup checklist', 'Reporter access', 'Upgrade credit'],
  },
];

const PUBLIC_NAV = [
  ['/', 'Home'],
  ['/tunnel', 'Tunnel'],
  ['/webinar/register', 'Webinar'],
  ['/growth', 'Start Free'],
  ['/pricing', 'Pricing'],
  ['/faq', 'FAQ'],
  ['/contact', 'Support'],
];

const PORTAL_NAV = [
  ['/app/dashboard', 'Overview'],
  ['/app/presence', 'Presence Awareness'],
  ['/app/notifications', 'Live Notifications'],
  ['/app/connect-account', 'Account Connection'],
  ['/app/advanced-link', 'Advanced Link'],
  ['/app/community-reporters', 'Community Reporters'],
  ['/app/discord-copier', 'Discord Copier Channel'],
  ['/app/education', 'Education Portal'],
  ['/app/seminars', 'Seminars'],
  ['/app/account-configuration', 'Account Configuration'],
  ['/app/wisdo-command-center', 'Wisdo Command Center'],
  ['/app/copier-engine', 'Copier Engine'],
  ['/app/copier-logs', 'Copier Logs'],
  ['/app/account-trades', 'Account Trades'],
  ['/app/performance', 'Performance'],
  ['/app/reporter', 'Culture Coin Reporter'],
  ['/app/subscriptions', 'My Subscriptions'],
  ['/app/membership', 'Membership Status'],
  ['/app/billing', 'Billing'],
  ['/app/profile', 'Profile'],
];

const ADMIN_NAV = [
  ['/admin', 'Overview'],
  ['/admin/users', 'Users'],
  ['/admin/active-members', 'Active Members'],
  ['/admin/inactive-members', 'Inactive Members'],
  ['/admin/subscriptions', 'Subscriptions'],
  ['/admin/payments', 'Payments'],
  ['/admin/products', 'Products'],
  ['/admin/leads', 'Tunnel Leads'],
  ['/admin/growth-funnel', 'Growth Funnel'],
  ['/admin/copier-access', 'Copier Access'],
  ['/admin/reporter-settings', 'Reporter Settings'],
  ['/admin/notifications', 'Notifications'],
  ['/admin/feedback', 'Support Feedback'],
  ['/admin/support-tickets', 'Support Tickets'],
  ['/admin/licenses', 'Licenses'],
];

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function money(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}


function formBoolean(value) {
  return ['1', 'true', 'yes', 'on', 'checked'].includes(String(value || '').trim().toLowerCase());
}

function parseCookies(req) {
  const header = req.headers?.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function setCookie(res, name, value, options = {}) {
  const attrs = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (options.maxAge !== undefined) attrs.push(`Max-Age=${options.maxAge}`);
  const shouldSecure = options.secure === true || (options.secure !== false && (String(process.env.PUBLIC_BASE_URL || '').startsWith('https://') || process.env.NODE_ENV === 'production'));
  if (shouldSecure) attrs.push('Secure');
  res.append('Set-Cookie', attrs.join('; '));
}

function clearCookie(res, name) {
  res.append('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`);
}

function encodeSession(user) {
  return encodeSignedSession(user);
}

function decodeSession(value) {
  return decodeSignedSession(value);
}

function getSessionUser(req) {
  return decodeSession(parseCookies(req)[SESSION_COOKIE] || '');
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function userDisplay(user = {}) {
  return user.global_name || user.globalName || user.name || user.username || user.email || user.id || 'Culture Coin Operator';
}

function ensureState(state) {
  state.usersById ||= {};
  state.profiles ||= {};
  state.memberships ||= {};
  state.products ||= {};
  state.payments ||= {};
  state.leads ||= [];
  state.connected_accounts ||= {};
  state.trade_copier_access ||= {};
  state.reporter_events ||= [];
  state.trade_history ||= [];
  state.discord_connections ||= {};
  state.pairing_codes ||= [];
  state.trading_accounts ||= {};
  state.account_configurations ||= {};
  state.notification_events ||= [];
  state.notificationOutboxById ||= {};
  state.notificationDeliveryLogById ||= {};
  state.notificationPreferencesByUserId ||= {};
  state.funnelCampaignsById ||= {};
  state.funnelVisitsById ||= {};
  state.funnelLeadsById ||= {};
  state.funnelEvents ||= [];
  state.sync_events ||= [];
  state.copier_events ||= [];
  state.feedback ||= [];
  state.referrals ||= [];
  state.supportTickets ||= [];
  state.admin_logs ||= [];
  state.tradeCopyAttempts ||= [];
  state.pending_mt4_confirmations ||= {};
  state.lastAccountMetrics ||= {};
  state.metricHistory ||= {};
  state.subscriptionsById ||= {};
  state.squareCheckoutIntents ||= {};
  state.affiliatesById ||= {};
  state.affiliatePayouts ||= [];
  for (const product of PRODUCTS) state.products[product.id] ||= product;
  return state;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password || ''), salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored = '') {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = hashPassword(password, salt).split(':')[1];
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(candidate));
}

async function getDiscordRoleActive(config, userId) {
  if (!config?.discordToken || !config?.guildId || !config?.cultureCoinRoleId || !userId) return { checked: false, active: false };
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${config.guildId}/members/${userId}`, {
      headers: { Authorization: `Bot ${config.discordToken}` },
    });
    if (!response.ok) return { checked: true, active: false, status: response.status };
    const member = await response.json();
    return { checked: true, active: Array.isArray(member.roles) && member.roles.includes(config.cultureCoinRoleId) };
  } catch (error) {
    return { checked: false, active: false, error: error.message };
  }
}


async function grantDiscordCultureCoinRole(config, discordUserId) {
  const token = config?.discordToken || process.env.DISCORD_TOKEN || '';
  const guildId = config?.guildId || process.env.GUILD_ID || '';
  const roleId = config?.cultureCoinRoleId || process.env.CULTURE_COIN_ROLE_ID || '';
  if (!token || !guildId || !roleId || !discordUserId) return { ok: false, skipped: true, reason: 'Discord role grant is not configured or user has not linked Discord.' };
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`, {
      method: 'PUT',
      headers: { Authorization: `Bot ${token}` },
    });
    return { ok: response.ok, status: response.status, reason: response.ok ? 'Culture Coin role granted.' : await response.text().catch(() => 'Discord role grant failed') };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function hasActivePaidRecord(state, userId) {
  const membership = state.memberships?.[userId];
  if (['active', 'manual_active', 'discord_role_active', 'square_active'].includes(membership?.status)) return true;
  const subs = Object.values(state.subscriptionsById || {}).filter((sub) => String(sub.userId || sub.discordUserId || sub.customerUserId || '') === String(userId));
  return subs.some((sub) => ['active', 'trialing'].includes(String(sub.status || '').toLowerCase()));
}

function hasInactivePaidRecord(state, userId) {
  const membership = state.memberships?.[userId];
  if (['inactive', 'paused', 'cancelled', 'canceled', 'past_due', 'unpaid'].includes(membership?.status)) return true;
  const subs = Object.values(state.subscriptionsById || {}).filter((sub) => String(sub.userId || sub.discordUserId || sub.customerUserId || '') === String(userId));
  return subs.some((sub) => ['canceled', 'cancelled', 'past_due', 'unpaid', 'paused', 'incomplete_expired'].includes(String(sub.status || '').toLowerCase()));
}

async function resolveMembership({ req, config, state }) {
  ensureState(state);
  const user = getSessionUser(req);
  const fallbackId = String(req.query.userId || req.body?.userId || '').trim();
  const userId = String(user?.id || fallbackId || '').trim();
  const admin = Boolean(userId && config?.ownerUserId && String(userId) === String(config.ownerUserId));

  if (!userId) {
    return {
      user: null,
      userId: '',
      role: 'guest',
      status: 'guest',
      subscription_status: 'inactive',
      tradeCopyUnlocked: false,
      canCopyTrades: false,
      reporterAccess: true,
      reason: 'Not logged in',
      source: 'public',
    };
  }

  const linkedDiscordUserId = user?.discordUserId || state.discord_connections?.[userId]?.discordUserId || (user?.provider === 'discord' ? userId : '');
  const identityIds = unique([userId, linkedDiscordUserId, user?.discordUserId, user?.provider === 'discord' ? userId : '']);
  const mt4LiveForMembership = readMt4LiveState(state);
  const discordRole = await getDiscordRoleActive(config, linkedDiscordUserId);
  const manual = state.memberships?.[userId];
  const activeByPayment = hasActivePaidRecord(state, userId);
  const inactivePaid = hasInactivePaidRecord(state, userId);
  const copierAccess = state.trade_copier_access?.[userId];
  const copierEnabled = copierAccess?.enabled !== false;
  const mt4AccountConnected = identityIds.some((lookupId) => mt4LiveForMembership.connections?.[lookupId] || mt4LiveForMembership.latestSnapshots?.[lookupId] || mt4LiveForMembership.activeAccountByUserId?.[lookupId]) || Object.values(mt4LiveForMembership.connectionsByAccountId || {}).some((record) => identityIds.includes(String(record.discordUserId || record.userId || record.ownerUserId || '').trim()));
  const accountConnected = Boolean(Object.values(state.connected_accounts?.[userId] || {}).length) || Boolean(copierAccess?.accountConnected) || mt4AccountConnected;

  if (admin) {
    return {
      user,
      userId,
      role: 'admin',
      status: 'admin',
      subscription_status: 'active',
      tradeCopyUnlocked: true,
      canCopyTrades: true,
      reporterAccess: true,
      source: 'owner',
      copierEnabled: true,
      accountConnected,
    };
  }

  const active = activeByPayment || discordRole.active || ['active', 'manual_active'].includes(manual?.status);
  const role = active ? 'culture_coin_member_active' : inactivePaid ? 'culture_coin_member_inactive' : 'free_user';
  return {
    user,
    userId,
    role,
    status: role,
    subscription_status: active ? 'active' : inactivePaid ? 'inactive' : 'free',
    tradeCopyUnlocked: Boolean(active && copierEnabled && accountConnected),
    canCopyTrades: Boolean(active && copierEnabled && accountConnected),
    reporterAccess: true,
    source: activeByPayment ? 'billing' : discordRole.active ? 'discord_role' : manual?.source || 'free',
    discordRoleChecked: discordRole.checked,
    discordRoleActive: discordRole.active,
    copierEnabled,
    accountConnected,
    membership: manual || null,
    linkedDiscordUserId,
  };
}


function hashPairingCode(code = '') {
  return crypto.createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex');
}

function generatePairingCode() {
  const a = crypto.randomBytes(2).toString('hex').toUpperCase();
  const b = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `CEM-${a}-${b}`;
}

function pickWinAnimation(type = '', severity = '') {
  const configured = String(process.env.WISDO_WIN_GIF_URLS || '').split(',').map((v) => v.trim()).filter(Boolean);
  const defaults = [
    'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif',
    'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif',
  ];
  const pool = configured.length ? configured : defaults;
  const key = `${type}:${severity}:${new Date().getUTCMinutes()}`;
  const index = Math.abs([...key].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % pool.length;
  return pool[index];
}

function isWinningNotification(type = '', title = '') {
  const text = `${type} ${title}`.toLowerCase();
  return text.includes('profit') || text.includes('growth') || text.includes('goal') || text.includes('command executed') || text.includes('closed');
}

function sendDiscordNotificationWebhook(event) {
  const webhook = process.env.DISCORD_NOTIFICATION_WEBHOOK_URL || process.env.WISDO_NOTIFICATION_WEBHOOK_URL || '';
  if (!webhook) return;
  const color = event.severity === 'warning' ? 16766720 : event.severity === 'danger' ? 15548997 : 5763719;
  const imageUrl = event.metadata?.winGifUrl || '';
  fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'Wisdo Command Center',
      content: `${getNotificationIcon(event.type, event.severity)} **${event.title}**`,
      embeds: [{
        title: event.title,
        description: event.message || 'Wisdo notification update.',
        color,
        footer: { text: `${event.source || 'website'} • ${event.type || 'notification'}` },
        ...(imageUrl ? { image: { url: imageUrl } } : {}),
      }],
    }),
  }).catch(() => {});
}

function createNotificationEvent(state, { userId, tradingAccountId = '', discordConnectionId = '', type = 'Sync Completed Alert', title = 'Wisdo Sync', message = '', severity = 'info', source = 'website', metadata = {} }) {
  ensureState(state);
  const enrichedMetadata = { ...(metadata || {}) };
  if (isWinningNotification(type, title) && !enrichedMetadata.winGifUrl) enrichedMetadata.winGifUrl = pickWinAnimation(type, severity);
  const event = { id: id('notice'), userId: userId || 'system', tradingAccountId, discordConnectionId, type, title, message, severity, source, read_status: 'unread', metadata: enrichedMetadata, createdAt: nowIso() };
  state.notification_events.push(event);
  sendDiscordNotificationWebhook(event);
  return event;
}

function createSyncEvent(state, { userId, source = 'website', target = 'discord', action = 'sync', payload = {}, status = 'completed', error_message = '' }) {
  ensureState(state);
  const event = { id: id('sync'), userId: userId || 'system', source, target, action, payload, status, error_message, createdAt: nowIso() };
  state.sync_events.push(event);
  createNotificationEvent(state, {
    userId,
    type: status === 'completed' ? 'Sync Completed Alert' : 'Risk Warning Alert',
    title: status === 'completed' ? 'Sync Completed' : 'Sync Needs Attention',
    message: status === 'completed'
      ? `${source} updated ${target}: ${action}`
      : `${source} could not sync ${action}: ${error_message || 'unknown error'}`,
    severity: status === 'completed' ? 'success' : 'warning',
    source,
    metadata: { target, action, payload },
  });
  return event;
}

function getUserNotifications(state, userId, limit = 20) {
  ensureState(state);
  return state.notification_events
    .filter((event) => !userId || String(event.userId) === String(userId) || event.userId === 'system')
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

function getUserCopierLogs(state, userId, limit = 30) {
  ensureState(state);
  return [
    ...(state.copier_events || []),
    ...(state.tradeCopyAttempts || []).map((attempt) => ({ ...attempt, status: attempt.allowed ? 'allowed' : 'blocked', type: 'copy_attempt' })),
  ]
    .filter((event) => !userId || String(event.userId) === String(userId) || event.userId === 'guest')
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

function getPrimaryTradingAccount(state, userId) {
  ensureState(state);
  const connected = Object.values(state.connected_accounts?.[userId] || {});
  const configured = Object.values(state.trading_accounts?.[userId] || {});
  return configured[0] || connected[0] || null;
}

function getAccountConfiguration(state, userId) {
  ensureState(state);
  const account = getPrimaryTradingAccount(state, userId);
  const key = account?.accountId || account?.id || 'default';
  state.account_configurations[userId] ||= {};
  state.account_configurations[userId][key] ||= {
    trading_account_id: key,
    risk_mode: 'normal',
    bot_mode: 'trend_protect',
    allowed_symbols: ['XAUUSD', 'GBPJPY', 'NASUSD'],
    max_lot: 0.05,
    max_daily_drawdown: 12,
    daily_profit_target: 5,
    emergency_stop_enabled: true,
    discord_alerts_enabled: true,
    auto_sync_enabled: true,
    notification_frequency: 'normal',
    updated_at: nowIso(),
  };
  return { account, accountId: key, config: state.account_configurations[userId][key] };
}


function unique(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function userLookupIds(membership = {}) {
  return unique([
    membership.userId,
    membership.linkedDiscordUserId,
    membership.user?.discordUserId,
    membership.user?.id,
    membership.user?.provider === 'discord' ? membership.user?.id : '',
  ]);
}


function normalizeAccountId(value = '') {
  return String(value || '').trim();
}

function userOwnsMt4Record(record = {}, lookupIds = []) {
  const owner = String(record.discordUserId || record.userId || record.ownerUserId || '').trim();
  return Boolean(owner && lookupIds.includes(owner));
}

function accountShareAllowsUser(mt4 = {}, membership = {}, accountId = '', options = {}) {
  const lookupIds = userLookupIds(membership);
  const selected = normalizeAccountId(accountId);
  if (!selected) return false;
  const allowedControls = ['control_allowed', 'copy_allowed', 'admin', 'owner'];
  return Object.values(mt4.accountSharesById || {}).some((share) => {
    if (normalizeAccountId(share.accountId) !== selected) return false;
    if (String(share.status || 'active').toLowerCase() !== 'active') return false;
    const targetMatches = lookupIds.includes(String(share.targetUserId || '').trim());
    const ownerMatches = lookupIds.includes(String(share.ownerUserId || '').trim());
    if (!targetMatches && !ownerMatches) return false;
    if (!options.requireControl) return true;
    return ownerMatches || allowedControls.includes(String(share.permission || '').toLowerCase());
  });
}

function isAccountAccessibleForMember(mt4 = {}, membership = {}, accountId = '', options = {}) {
  const selected = normalizeAccountId(accountId);
  if (!selected) return false;
  const lookupIds = userLookupIds(membership);
  const record = mt4.connectionsByAccountId?.[selected];
  if (!record) return false;
  if (membership?.role === 'admin') return true;
  if (userOwnsMt4Record(record, lookupIds)) return true;
  return accountShareAllowsUser(mt4, membership, selected, options);
}

function getRequestedAccountId(input = {}) {
  return normalizeAccountId(input.accountId || input.selectedAccountId || input.activeAccountId || input.targetAccountId || '');
}

function normalizeLiveSnapshot(snapshotRecord = null) {
  const snapshot = snapshotRecord?.snapshot || snapshotRecord || {};
  const balance = Number(snapshot.balance ?? 0);
  const equity = Number(snapshot.equity ?? balance ?? 0);
  const floatingPL = Number(snapshot.floatingPL ?? snapshot.floatingProfit ?? snapshot.profit ?? (equity - balance) ?? 0);
  const dailyClosedPL = Number(snapshot.dailyClosedPL ?? snapshot.closedPLToday ?? snapshot.dailyProfit ?? 0);
  const marginLevel = Number(snapshot.marginLevel ?? 0);
  const maxDrawdown = Number(snapshot.maxDrawdown ?? snapshot.drawdown ?? (floatingPL < 0 && balance ? Math.abs(floatingPL / balance) * 100 : 0));
  const openTrades = Array.isArray(snapshot.openTrades) ? snapshot.openTrades : [];
  const closedTradesToday = Array.isArray(snapshot.closedTradesToday) ? snapshot.closedTradesToday : [];
  const openTradeCount = Number(snapshot.openTradeCount ?? openTrades.length ?? 0);
  return {
    balance,
    equity,
    floatingPL,
    dailyClosedPL,
    margin: Number(snapshot.margin ?? 0),
    freeMargin: Number(snapshot.freeMargin ?? 0),
    marginLevel,
    drawdownPercent: Math.max(0, maxDrawdown),
    openTradeCount,
    buyTradeCount: Number(snapshot.buyTradeCount ?? openTrades.filter((t) => String(t.type).toLowerCase().includes('buy')).length ?? 0),
    sellTradeCount: Number(snapshot.sellTradeCount ?? openTrades.filter((t) => String(t.type).toLowerCase().includes('sell')).length ?? 0),
    totalLots: Number(snapshot.totalLots ?? openTrades.reduce((sum, t) => sum + Number(t.lots || 0), 0)),
    symbols: Array.isArray(snapshot.symbols) && snapshot.symbols.length ? snapshot.symbols : unique(openTrades.map((t) => t.symbol)),
    openTrades,
    closedTradesToday,
    accountNumber: snapshot.accountNumber || snapshotRecord?.accountNumber || '',
    brokerServer: snapshot.brokerServer || snapshot.server || snapshotRecord?.brokerServer || snapshotRecord?.server || '',
    eaName: snapshot.eaName || snapshotRecord?.eaName || '',
    eaVersion: snapshot.eaVersion || snapshotRecord?.eaVersion || '',
    terminalConnected: snapshot.terminalConnected !== false,
    expertEnabled: snapshot.expertEnabled !== false,
    timestamp: snapshot.timestamp || snapshotRecord?.receivedAt || snapshotRecord?.lastSyncAt || '',
  };
}

function readMt4LiveState(state = {}) {
  return state.__mt4Live || state.mt4Live || {};
}

function getLiveAccountData(state, membership, selectedAccountId = '') {
  ensureState(state);
  const ids = userLookupIds(membership);
  const mt4 = readMt4LiveState(state);
  const requestedAccountId = normalizeAccountId(selectedAccountId);
  let connection = null;
  let snapshotRecord = null;
  let accountId = '';
  let selectionMatched = false;

  if (requestedAccountId) {
    if (isAccountAccessibleForMember(mt4, membership, requestedAccountId, { requireControl: true }) || membership?.role === 'admin') {
      accountId = requestedAccountId;
      connection = mt4.connectionsByAccountId?.[accountId] || null;
      snapshotRecord = mt4.latestSnapshotsByAccountId?.[accountId] || null;
      selectionMatched = true;
    }
  }

  if (!accountId) {
    for (const lookupId of ids) {
      const activeId = normalizeAccountId(mt4.activeAccountByUserId?.[lookupId]);
      if (!accountId && activeId && isAccountAccessibleForMember(mt4, membership, activeId, { requireControl: true })) accountId = activeId;
      if (!connection && mt4.connections?.[lookupId]) connection = mt4.connections[lookupId];
      if (!snapshotRecord && mt4.latestSnapshots?.[lookupId]) snapshotRecord = mt4.latestSnapshots[lookupId];
    }
  }

  if (accountId) {
    connection = mt4.connectionsByAccountId?.[accountId] || connection || null;
    snapshotRecord = mt4.latestSnapshotsByAccountId?.[accountId] || snapshotRecord || null;
  }

  if (!snapshotRecord || !connection || !accountId) {
    const candidates = Object.entries(mt4.connectionsByAccountId || {})
      .filter(([candidateId, record]) => userOwnsMt4Record(record, ids) || accountShareAllowsUser(mt4, membership, candidateId, { requireControl: true }));
    if (candidates.length) {
      accountId ||= candidates[0][0];
      connection ||= candidates[0][1];
      snapshotRecord ||= mt4.latestSnapshotsByAccountId?.[accountId] || null;
    }
  }

  const ecosystemAccounts = ids.flatMap((lookupId) => Object.values(state.connected_accounts?.[lookupId] || {}));
  const configuredAccounts = ids.flatMap((lookupId) => Object.values(state.trading_accounts?.[lookupId] || {}));
  const account = connection || configuredAccounts.find((a) => normalizeAccountId(a.accountId || a.id) === accountId) || ecosystemAccounts.find((a) => normalizeAccountId(a.accountId || a.id) === accountId) || configuredAccounts[0] || ecosystemAccounts[0] || getPrimaryTradingAccount(state, membership.userId);
  const metricsKey = accountId || account?.accountId || account?.id || ids[0] || 'default';
  const storedMetrics = ids.map((lookupId) => state.lastAccountMetrics?.[lookupId]?.[metricsKey] || state.lastAccountMetrics?.[lookupId]?.default || state.lastAccountMetrics?.[`${lookupId}:${metricsKey}`] || state.lastAccountMetrics?.[`${lookupId}:default`]).find(Boolean);
  const live = snapshotRecord ? normalizeLiveSnapshot(snapshotRecord) : storedMetrics ? normalizeLiveSnapshot(storedMetrics.metrics || storedMetrics) : null;
  const lastSyncAt = snapshotRecord?.receivedAt || connection?.lastSyncAt || account?.lastSyncAt || storedMetrics?.createdAt || account?.connectedAt || '';
  return {
    live: Boolean(snapshotRecord || storedMetrics),
    source: snapshotRecord ? 'mt4_bridge' : storedMetrics ? (storedMetrics.source || 'bridge_metrics') : account ? 'connected_account_no_snapshot' : 'none',
    accountId: accountId || account?.accountId || account?.id || metricsKey,
    requestedAccountId,
    selectionMatched,
    account: account || null,
    snapshotRecord: snapshotRecord || null,
    metrics: live || normalizeLiveSnapshot({ balance: 0, equity: 0, floatingPL: 0, dailyClosedPL: 0, openTradeCount: 0, openTrades: [], closedTradesToday: [] }),
    lastSyncAt,
    stale: lastSyncAt ? Date.now() - new Date(lastSyncAt).getTime() > 90_000 : true,
  };
}
function dailyGoalProgress(liveData, accountConfig = {}) {
  const targetPct = Number(accountConfig.daily_profit_target ?? accountConfig.dailyGoal ?? 5);
  const balance = Number(liveData?.metrics?.balance || 0);
  const daily = Number(liveData?.metrics?.dailyClosedPL || 0) + Math.max(0, Number(liveData?.metrics?.floatingPL || 0));
  if (!balance || !targetPct) return 0;
  const targetMoney = balance * (targetPct / 100);
  return Math.max(0, Math.min(100, (daily / targetMoney) * 100));
}

function fmtSignedMoney(value) {
  const n = Number(value || 0);
  return `${n >= 0 ? '+' : '-'}${money(Math.abs(n)).slice(1)}`;
}

async function registerMt4PairingCode(mt4SyncService, { code, userId, discordUserId = '', channelId = '', accountNickname = '', source = 'website' }) {
  if (!mt4SyncService?.repository?.updateMt4State) return { ok: false, skipped: true, reason: 'MT4 repository not available in this runtime.' };
  const ownerId = String(discordUserId || userId || '').trim();
  if (!ownerId) return { ok: false, skipped: true, reason: 'No website or Discord user id available for MT4 pairing.' };
  const now = nowIso();
  const ttlHours = Number(mt4SyncService?.config?.api?.mt4PairingCodeTtlHours || 24);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  await mt4SyncService.repository.updateMt4State((mt4) => {
    mt4.pairingCodes ||= {};
    mt4.pairingCodes[code] = {
      ...(mt4.pairingCodes[code] || {}),
      pairingCode: code,
      discordUserId: ownerId,
      websiteUserId: userId || '',
      channelId,
      status: 'pending',
      createdAt: mt4.pairingCodes[code]?.createdAt || now,
      expiresAt,
      connectedAt: null,
      accountNumber: null,
      requestedByUserId: userId || ownerId,
      accountNickname: accountNickname || 'Culture Coin Reporter Bridge',
      accountRole: 'private',
      copyPermission: 'private',
      accountId: null,
      source,
    };
    return mt4;
  });
  return { ok: true, registered: true, ownerId, websiteUserId: userId || '', expiresAt };
}

function canExecuteTradingAction(membership) {
  return Boolean(
    membership?.userId &&
    membership.subscription_status === 'active' &&
    ['culture_coin_member_active', 'admin'].includes(membership.role) &&
    membership.copierEnabled !== false &&
    (membership.accountConnected || membership.role === 'admin')
  );
}

function textIncludesAny(text, needles = []) {
  const normalized = String(text || '').toLowerCase();
  return needles.some((needle) => normalized.includes(String(needle).toLowerCase()));
}

function extractPercentFromText(text = '') {
  const match = String(text).match(/(\d{1,3})(?:\s*)%/);
  if (!match) return 0;
  return Math.max(1, Math.min(100, Number(match[1])));
}

function normalizeWisdoIntent(input = {}) {
  const action = String(input.action || input.intent || input.command || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const rawText = String(input.rawText || input.rawCommand || input.text || input.message || input.prompt || '').trim();
  const text = rawText.toLowerCase();
  const percent = Number(input.percent || input.closePercent || input.partialPercent || extractPercentFromText(rawText) || 0);

  const base = {
    rawText,
    originalAction: action || rawText || 'unknown',
    percent: percent || undefined,
    source: input.source || 'website',
  };

  if (['cem_set_globals','set_globals','bot_globals','risk_update'].includes(action) || String(input.command || '').toUpperCase() === 'CEM_SET_GLOBALS') {
    const globals = Array.isArray(input.globals) ? input.globals : [];
    const singleName = input.globalName || input.globalKey || input.key || input.name || '';
    return {
      command: 'CEM_SET_GLOBALS',
      globals,
      ...(singleName ? { globalName: singleName, value: Number(input.value ?? 0) } : {}),
      ...base,
    };
  }

  if (['close_symbol_profit','close_symbol_profits','close_pair_profit','close_pair_profits','close_pair_winners'].includes(action)) {
    return { command: 'CLOSE_BY_SYMBOL', closeMode: 'winners', symbol: input.symbol || input.targetSymbol || '', targetSymbol: input.targetSymbol || input.symbol || '', ...base };
  }
  if (['close_symbol','close_pair','close_symbol_all','close_pair_all'].includes(action)) {
    return { command: 'CLOSE_BY_SYMBOL', closeMode: input.closeMode || 'basket', symbol: input.symbol || input.targetSymbol || '', targetSymbol: input.targetSymbol || input.symbol || '', ...base };
  }
  if (['pause_symbol','pause_pair'].includes(action)) {
    const symbol = input.symbol || input.targetSymbol || '';
    return { command: 'CEM_SET_GLOBALS', globals: [{ name: `CEM.WISDO.__ACCOUNT__.${symbol || 'GLOBAL'}.0.PauseSymbol`, value: 1 }], symbol, targetSymbol: symbol, ...base };
  }
  if (['resume_symbol','resume_pair'].includes(action)) {
    const symbol = input.symbol || input.targetSymbol || '';
    return { command: 'CEM_SET_GLOBALS', globals: [{ name: `CEM.WISDO.__ACCOUNT__.${symbol || 'GLOBAL'}.0.PauseSymbol`, value: 0 }], symbol, targetSymbol: symbol, ...base };
  }
  if (['close_profitable','close_profits','close_winners','take_profit','take_profits','collect_profits'].includes(action) || (textIncludesAny(text, ['close','collect','secure','grab','take']) && textIncludesAny(text, ['profitable','profit','profits','winner','winners','winning']))) {
    return { command: percent && percent < 100 ? 'TRIM_PROFITS' : 'CLOSE_ALL_PROFITS', closeMode: 'winners', ...base };
  }
  if (['trim_profits','partial_close_winners','close_half_profit'].includes(action) || textIncludesAny(text, ['trim profits','partial close','close half','take half','secure 50'])) {
    return { command: 'TRIM_PROFITS', closeMode: 'winners', percent: percent || 50, ...base };
  }
  if (['close_all','close_all_trades'].includes(action) || textIncludesAny(text, ['close all trades','close everything','flatten account','flatten all','kill all trades'])) {
    return { command: 'CLOSE_ALL_TRADES', closeMode: 'all', ...base };
  }
  if (['emergency_close','panic_close','emergency_close_all'].includes(action) || (textIncludesAny(text, ['emergency','panic','hard stop']) && textIncludesAny(text, ['close','flatten','kill']))) {
    return { command: 'EMERGENCY_CLOSE_ALL', closeMode: 'all', priority: 500, ttlMinutes: 1, ...base };
  }
  if (['close_losers','close_losses','close_losing'].includes(action) || (textIncludesAny(text, ['close']) && textIncludesAny(text, ['loser','losers','loss','losses','losing']))) {
    return { command: 'CLOSE_ALL_LOSERS', closeMode: 'losers', ...base };
  }
  if (['pause_copier','copier_pause','pause_bot','pause_trading','stop_entries'].includes(action) || (textIncludesAny(text, ['pause','stop entries','stop trading','freeze']) && !textIncludesAny(text, ['resume','start']))) {
    return { command: action.includes('copier') ? 'PAUSE_COPIER' : 'PAUSE_TRADING', ...base };
  }
  if (['resume_copier','copier_resume','resume_bot','resume_trading','start_entries'].includes(action) || textIncludesAny(text, ['resume','start entries','start trading','unpause'])) {
    return { command: action.includes('copier') ? 'RESUME_COPIER' : 'RESUME_TRADING', ...base };
  }
  if (['walk_away','walk_away_mode'].includes(action) || textIncludesAny(text, ['walk away','walkaway'])) {
    return { command: 'WALK_AWAY_MODE', ...base };
  }
  if (['lock_profit','set_equity_floor'].includes(action) || textIncludesAny(text, ['lock profit','equity floor','protect profit'])) {
    return { command: 'LOCK_PROFIT', ...base };
  }
  if (['buy','sell','market_order','open_trade','place_trade','take_trade'].includes(action) || /\b(buy|sell)\b/.test(text)) {
    const side = String(input.side || input.direction || (text.includes('sell') ? 'sell' : text.includes('buy') ? 'buy' : '')).toLowerCase();
    return { command: 'MARKET_ORDER', side, symbol: input.symbol || input.targetSymbol || '', lots: Number(input.lots || input.lot || input.volume || 0) || undefined, stopLoss: input.stopLoss || input.sl || undefined, takeProfit: input.takeProfit || input.tp || undefined, ...base };
  }
  return { command: 'CEM_SET_GLOBALS', globals: [{ name: 'CEM.WISDO.__ACCOUNT__.GLOBAL.0.LastTextIntent', value: Date.now() }], ...base, note: 'Unknown text intent recorded as CEM global heartbeat; no trade execution command inferred.' };
}

function mapActionToMt4Command(actionOrBody = {}) {
  const normalized = normalizeWisdoIntent(actionOrBody);
  return {
    command: normalized.command,
    payload: {
      ...actionOrBody,
      ...normalized,
      command: normalized.command,
      source: actionOrBody.source || normalized.source || 'website',
      immediate: actionOrBody.immediate !== false,
      priority: Number(normalized.priority || actionOrBody.priority || (normalized.command === 'EMERGENCY_CLOSE_ALL' ? 500 : 100)),
      ttlMinutes: Number(normalized.ttlMinutes || actionOrBody.ttlMinutes || (normalized.command === 'EMERGENCY_CLOSE_ALL' ? 1 : 2)),
    },
  };
}

function mt4ConfirmationPhrase(command, liveData = {}) {
  const c = String(command || '').toUpperCase();
  const acct = liveData?.metrics?.accountNumber || liveData?.account?.accountNumber || liveData?.accountId || '';
  const suffix = acct ? ` ${String(acct).slice(-4)}` : '';
  if (c.includes('PROFIT') || c.includes('WINNER')) return `CONFIRM CLOSE PROFITS${suffix}`.trim();
  if (c.includes('LOSER') || c.includes('LOSS')) return `CONFIRM CLOSE LOSERS${suffix}`.trim();
  if (c.includes('EMERGENCY')) return `CONFIRM EMERGENCY CLOSE${suffix}`.trim();
  if (c.includes('CLOSE')) return `CONFIRM CLOSE${suffix}`.trim();
  if (c.includes('LOCK') || c.includes('WALK_AWAY')) return `CONFIRM PROTECT${suffix}`.trim();
  if (c.includes('MARKET_ORDER')) return `CONFIRM TRADE${suffix}`.trim();
  return `CONFIRM ${c.split('_')[0] || 'COMMAND'}${suffix}`.trim();
}

function pruneMt4Confirmations(state) {
  state.pending_mt4_confirmations ||= {};
  const now = Date.now();
  for (const [key, record] of Object.entries(state.pending_mt4_confirmations)) {
    if (!record || record.status !== 'pending' || new Date(record.expiresAt || 0).getTime() < now) {
      delete state.pending_mt4_confirmations[key];
    }
  }
}

function createMt4Confirmation(state, { membership = {}, accountId = null, mapped = {}, payload = {}, liveData = {}, origin = 'website' }) {
  pruneMt4Confirmations(state);
  const confirmationId = id('mt4_confirm');
  const phrase = mt4ConfirmationPhrase(mapped.command, liveData);
  const expiresAt = new Date(Date.now() + 90_000).toISOString();
  const record = {
    id: confirmationId,
    userId: String(membership.userId || ''),
    accountId,
    command: mapped.command,
    phrase,
    payload,
    origin,
    status: 'pending',
    createdAt: nowIso(),
    expiresAt,
  };
  state.pending_mt4_confirmations[confirmationId] = record;
  return record;
}

function consumeMt4Confirmation(state, { membership = {}, body = {}, command = '', accountId = null }) {
  pruneMt4Confirmations(state);
  const confirmationId = String(body.confirmationId || body.confirmId || '').trim();
  if (!confirmationId) return false;
  const record = state.pending_mt4_confirmations?.[confirmationId];
  if (!record || record.status !== 'pending') return false;
  if (String(record.userId || '') !== String(membership.userId || '')) return false;
  if (String(record.command || '').toUpperCase() !== String(command || '').toUpperCase()) return false;
  if (record.accountId && accountId && String(record.accountId) !== String(accountId)) return false;

  const typed = String(body.confirmationPhrase || body.phrase || body.confirmText || '').trim().toUpperCase();
  const expected = String(record.phrase || '').trim().toUpperCase();
  const confirmedFlag = body.confirmation === 'confirmed' || body.confirmed === true;
  if (!confirmedFlag && typed !== expected) return false;

  record.status = 'confirmed';
  record.confirmedAt = nowIso();
  return true;
}

function confirmationRequiredResponse(record, mapped) {
  return {
    ok: true,
    queued: false,
    status: 'confirmation_required',
    confirmationRequired: true,
    confirmationId: record.id,
    confirmationPhrase: record.phrase,
    phrase: record.phrase,
    expiresAt: record.expiresAt,
    mt4Command: mapped.command,
    mapped,
    message: `Type ${record.phrase} to confirm ${mapped.command}.`,
  };
}

async function queueMt4ReporterCommand({ mt4CommandService, membership, state, liveData, body = {}, origin = 'website' }) {
  if (!mt4CommandService?.queueCommand) return { ok: false, error: 'MT4 command service is not available in this runtime.' };
  const mapped = mapActionToMt4Command({ ...(body || {}), source: origin });
  const requestedAccountId = getRequestedAccountId(body || {});
  const liveAccountId = liveData?.accountId && liveData.accountId !== 'default' ? liveData.accountId : '';
  const accountId = requestedAccountId || liveAccountId || liveData?.account?.accountId || liveData?.account?.id || null;
  const accountNumber = liveData?.metrics?.accountNumber || liveData?.account?.accountNumber || body.accountNumber || null;
  const payload = {
    ...mapped.payload,
    accountId,
    accountNumber,
    requestedBy: membership.userId,
    origin,
    queuedAt: nowIso(),
  };

  // Full rebuild fix: confirmation_required is a UI/API state, not a command to push
  // into the MT4 reporter queue. Validate first, create a confirmation ticket when
  // a dangerous command needs confirmation, and only queue the real command after
  // confirmation is consumed.
  if (consumeMt4Confirmation(state, { membership, body, command: mapped.command, accountId })) {
    payload.confirmation = 'confirmed';
    payload.confirmationId = body.confirmationId || body.confirmId;
  }

  const validation = mt4CommandService.validateCommand?.(membership.userId, accountId, mapped.command, payload);
  if (validation && !validation.ok) {
    if (validation.errors?.includes('confirmation_required')) {
      const confirmation = createMt4Confirmation(state, { membership, accountId, mapped, payload, liveData, origin });
      return confirmationRequiredResponse(confirmation, mapped);
    }
    return { ok: false, queued: false, status: 'validation_failed', error: `Invalid MT4 command: ${validation.errors.join(', ')}`, validation, mapped };
  }

  try {
    const record = accountId
      ? await mt4CommandService.queueCommandForAccount(membership.userId, accountId, mapped.command, payload)
      : await mt4CommandService.queueCommand(membership.userId, mapped.command, payload);
    return { ok: true, queued: true, status: 'queued_waiting_for_mt4_poll', record, mapped, pollUrl: '/mt4-command-poll', completeUrl: '/mt4-command-complete', executionMode: 'immediate_queue_waiting_for_reporter_poll' };
  } catch (error) {
    if (error?.validation?.errors?.includes('confirmation_required')) {
      const confirmation = createMt4Confirmation(state, { membership, accountId, mapped, payload, liveData, origin });
      return confirmationRequiredResponse(confirmation, mapped);
    }
    return { ok: false, queued: false, status: 'queue_failed', error: error.message, validation: error.validation, mapped };
  }
}

function pageTitle(page) {
  const titleMap = {
    dashboard: 'Overview', notifications: 'Live Notifications', subscriptions: 'My Subscriptions', membership: 'Culture Coin Membership Status',
    'connect-account': 'Account Connection', 'advanced-link': 'Advanced Broker Link', 'community-reporters': 'Community Reporters', 'discord-copier': 'Discord Copier Channel', 'account-configuration': 'Account Configuration', 'wisdo-command-center': 'Wisdo Command Center',
    'copier-engine': 'CEM Culture Relay Engine', 'copier-logs': 'Copier Logs', 'account-trades': 'Account Trades', performance: 'Performance', education: 'Wisdo Education Portal', seminars: 'Wisdo Seminars',
    reporter: 'Culture Coin Reporter', billing: 'Billing Settings', profile: 'Profile Settings', support: 'Support Feedback',
  };
  return titleMap[page] || 'Dashboard';
}


function baseCss() {
  return `<style>
    :root{--bg:#05070b;--panel:#0b1018;--panel2:#101827;--glass:rgba(15,23,42,.72);--line:rgba(148,163,184,.18);--text:#f8fafc;--muted:#94a3b8;--green:#22c55e;--green2:#39ff88;--gold:#f5c542;--purple:#8b5cf6;--cyan:#22d3ee;--red:#ef4444;--orange:#f97316;--shadow:0 24px 80px rgba(0,0,0,.44)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,Segoe UI,Arial,sans-serif;overflow-x:hidden}body:before{content:'';position:fixed;inset:0;z-index:-2;background:radial-gradient(circle at 16% 0%,rgba(34,197,94,.18),transparent 32%),radial-gradient(circle at 86% 12%,rgba(139,92,246,.2),transparent 34%),radial-gradient(circle at 60% 100%,rgba(245,197,66,.12),transparent 32%),linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px);background-size:auto,auto,auto,42px 42px,42px 42px}a{color:inherit}.container{width:min(1180px,calc(100% - 32px));margin:0 auto}.nav{position:sticky;top:0;z-index:50;border-bottom:1px solid var(--line);background:rgba(5,7,11,.76);backdrop-filter:blur(18px)}.nav-inner{height:76px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:12px;text-decoration:none;font-weight:950;letter-spacing:-.04em}.brand-mark{width:42px;height:42px;border:1px solid rgba(245,197,66,.35);border-radius:15px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(245,197,66,.18),rgba(139,92,246,.16));box-shadow:0 0 35px rgba(245,197,66,.12)}.brand-mark:after{content:'◈';color:var(--gold);font-size:22px}.brand small{display:block;color:var(--muted);font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase}.nav-links{display:flex;gap:6px;align-items:center}.nav-links a{padding:10px 12px;border-radius:12px;text-decoration:none;color:#dbeafe;font-size:14px;font-weight:750}.nav-links a:hover,.nav-links a.active{background:rgba(255,255,255,.06)}.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;border:1px solid var(--line);border-radius:14px;padding:12px 16px;text-decoration:none;font-weight:900;cursor:pointer;background:rgba(255,255,255,.05);color:var(--text);transition:.2s ease}.btn:hover{transform:translateY(-1px);background:rgba(255,255,255,.09)}.btn.primary{background:linear-gradient(135deg,var(--green2),var(--green));border-color:rgba(34,197,94,.35);color:#021006;box-shadow:0 0 38px rgba(34,197,94,.24)}.btn.gold{background:linear-gradient(135deg,var(--gold),#a66b10);border-color:rgba(245,197,66,.4);color:#100b02;box-shadow:0 0 38px rgba(245,197,66,.18)}.btn.danger{background:linear-gradient(135deg,#ff5d5d,var(--red));border-color:rgba(239,68,68,.48);color:white;box-shadow:0 0 38px rgba(239,68,68,.2)}.btn.locked{opacity:.62;cursor:not-allowed}.hero{padding:92px 0 56px}.hero-grid{display:grid;grid-template-columns:1.02fr .98fr;gap:42px;align-items:center}.eyebrow{display:inline-flex;gap:8px;align-items:center;border:1px solid rgba(34,197,94,.3);background:rgba(34,197,94,.08);color:#a7f3d0;border-radius:999px;padding:8px 12px;font-size:12px;text-transform:uppercase;letter-spacing:.16em;font-weight:900}.hero h1{font-family:Sora,Inter,sans-serif;font-size:clamp(44px,7vw,78px);line-height:.95;margin:22px 0 18px;letter-spacing:-.07em}.lead{color:#cbd5e1;font-size:18px;line-height:1.75;max-width:760px}.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.trust-strip{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.chip,.tag{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:#dbeafe;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:800}.chip.green{border-color:rgba(34,197,94,.26);color:#bbf7d0}.chip.gold{border-color:rgba(245,197,66,.3);color:#fde68a}.section{padding:54px 0}.section-head{max-width:780px;margin-bottom:24px}.section-head h2{font-family:Sora,Inter,sans-serif;font-size:clamp(30px,4vw,48px);line-height:1.02;letter-spacing:-.05em;margin:0 0 12px}.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.card{border:1px solid var(--line);background:linear-gradient(180deg,rgba(16,24,39,.82),rgba(8,13,22,.82));border-radius:24px;padding:22px;box-shadow:var(--shadow);backdrop-filter:blur(18px)}.card.glow{box-shadow:0 0 45px rgba(34,197,94,.15),var(--shadow);border-color:rgba(34,197,94,.28)}.card.gold{border-color:rgba(245,197,66,.35);box-shadow:0 0 42px rgba(245,197,66,.12),var(--shadow)}.card.purple{border-color:rgba(139,92,246,.38);box-shadow:0 0 42px rgba(139,92,246,.14),var(--shadow)}.card.red{border-color:rgba(239,68,68,.34);box-shadow:0 0 42px rgba(239,68,68,.12),var(--shadow)}.card h3{margin:0 0 10px;font-family:Sora,Inter,sans-serif;letter-spacing:-.03em}.card p{color:#aab7c9;line-height:1.62}.metric{font-family:JetBrains Mono,ui-monospace,monospace;font-size:32px;font-weight:950;letter-spacing:-.04em}.metric.green{color:var(--green2)}.metric.red{color:#ff7a7a}.metric.gold{color:var(--gold)}.preview{position:relative;overflow:hidden;min-height:540px}.preview:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 20% 20%,rgba(34,197,94,.18),transparent 32%),radial-gradient(circle at 88% 8%,rgba(139,92,246,.2),transparent 30%);pointer-events:none}.terminal-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.pulse{display:inline-flex;align-items:center;gap:8px}.pulse i{width:10px;height:10px;border-radius:999px;background:var(--green2);box-shadow:0 0 18px var(--green2);animation:pulse 1.4s infinite}@keyframes pulse{0%,100%{opacity:.75;transform:scale(.95)}50%{opacity:1;transform:scale(1.15)}}.chart{height:180px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(180deg,rgba(34,197,94,.16),transparent),repeating-linear-gradient(90deg,transparent,transparent 38px,rgba(255,255,255,.035) 39px),repeating-linear-gradient(0deg,transparent,transparent 32px,rgba(255,255,255,.035) 33px);position:relative;overflow:hidden}.chart:after{content:'';position:absolute;left:0;right:0;bottom:28%;height:3px;background:linear-gradient(90deg,var(--green),var(--gold),var(--purple));clip-path:polygon(0 65%,8% 45%,16% 55%,26% 25%,36% 42%,47% 16%,55% 46%,66% 30%,76% 14%,88% 35%,100% 8%);filter:drop-shadow(0 0 10px rgba(34,197,94,.65));animation:scanline 3s ease-in-out infinite}@keyframes scanline{50%{transform:translateY(-10px)}}.gauge{height:10px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.gauge span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--green2),var(--gold));box-shadow:0 0 25px rgba(34,197,94,.45)}.danger-zone .gauge span{background:linear-gradient(90deg,var(--orange),var(--red))}.app-shell{display:grid;grid-template-columns:280px 1fr;min-height:calc(100vh - 76px)}.side{position:sticky;top:76px;height:calc(100vh - 76px);border-right:1px solid var(--line);background:rgba(5,7,11,.7);backdrop-filter:blur(18px);padding:20px;overflow:auto}.side a{display:block;text-decoration:none;color:#dbeafe;font-weight:850;border-radius:14px;padding:12px 14px;margin:5px 0}.side a:hover,.side a.active{background:linear-gradient(90deg,rgba(34,197,94,.16),rgba(139,92,246,.1));color:white}.main{padding:28px;width:min(100%,1380px)}.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}.status-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(34,197,94,.3);background:rgba(34,197,94,.08);color:#bbf7d0;border-radius:999px;padding:8px 12px;font-weight:900;font-size:12px}.locked-panel{position:relative;overflow:hidden}.locked-panel:after{content:'Locked until Culture Coin membership is active';position:absolute;inset:auto 16px 16px 16px;border:1px solid rgba(245,197,66,.38);background:rgba(5,7,11,.78);backdrop-filter:blur(14px);border-radius:16px;padding:12px;color:#fde68a;font-weight:900}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:13px 10px;border-bottom:1px solid var(--line);text-align:left}.table th{font-size:12px;color:#fde68a;text-transform:uppercase;letter-spacing:.12em}.form{display:grid;gap:12px}.field{display:grid;gap:7px}.field label{font-size:12px;color:#cbd5e1;font-weight:900;text-transform:uppercase;letter-spacing:.12em}.field input,.field select,.field textarea{width:100%;border:1px solid var(--line);background:rgba(255,255,255,.05);color:white;border-radius:14px;padding:13px 14px}.footer{border-top:1px solid var(--line);padding:34px 0;color:#94a3b8}.faq details{border:1px solid var(--line);background:rgba(255,255,255,.04);border-radius:18px;padding:18px}.faq details+details{margin-top:10px}.faq summary{cursor:pointer;font-weight:950}.launch-overlay{position:fixed;inset:0;z-index:999;display:none;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 30%,rgba(34,197,94,.18),transparent 28%),rgba(5,7,11,.92);backdrop-filter:blur(18px)}.launch-overlay.active{display:flex}.launch-card{width:min(680px,calc(100% - 28px));border:1px solid rgba(245,197,66,.28);background:rgba(11,16,24,.84);border-radius:28px;padding:28px;box-shadow:0 0 80px rgba(34,197,94,.16)}.ship-stage{height:180px;position:relative;overflow:hidden;border:1px solid var(--line);border-radius:22px;background:linear-gradient(180deg,rgba(255,255,255,.04),transparent),repeating-linear-gradient(90deg,transparent,transparent 36px,rgba(255,255,255,.035) 37px)}.coin-ship{position:absolute;left:20px;top:66px;width:54px;height:54px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff4b8,var(--gold) 42%,#8a5a0d 72%);box-shadow:0 0 28px rgba(245,197,66,.7),0 0 60px rgba(139,92,246,.25);animation:commandLaunch 2.8s ease-in-out infinite}.coin-ship:before{content:'';position:absolute;left:-62px;top:22px;width:70px;height:10px;border-radius:999px;background:linear-gradient(90deg,transparent,var(--green2),var(--purple));filter:blur(1px)}.coin-ship:after{content:'C';position:absolute;inset:0;display:grid;place-items:center;color:#130f04;font-weight:950;font-size:24px}@keyframes commandLaunch{0%{transform:translate(-80px,40px) scale(.72)}45%{transform:translate(260px,-20px) scale(1)}100%{transform:translate(690px,-70px) scale(.78)}}.stepper{display:grid;gap:9px;margin-top:16px}.stepper div{display:flex;align-items:center;gap:10px;color:#94a3b8}.stepper div.done{color:#bbf7d0}.stepper i{width:12px;height:12px;border-radius:999px;background:#334155}.stepper .done i{background:var(--green2);box-shadow:0 0 16px var(--green2)}.toast{position:fixed;right:20px;bottom:20px;z-index:900;display:none;border:1px solid rgba(34,197,94,.35);background:rgba(11,16,24,.92);backdrop-filter:blur(16px);border-radius:18px;padding:16px;box-shadow:var(--shadow)}.toast.show{display:block}.skip{position:absolute;right:16px;top:16px}.mobile-menu{display:none}.dropdown{position:relative}.drop-trigger{display:inline-flex;align-items:center;gap:6px}.drop-trigger:after{content:'⌄';font-size:12px;color:var(--green2)}.drop-menu{position:absolute;top:calc(100% + 10px);left:0;min-width:240px;display:none;padding:10px;border:1px solid var(--line);border-radius:18px;background:rgba(11,16,24,.96);box-shadow:var(--shadow);backdrop-filter:blur(18px)}.dropdown:hover .drop-menu,.dropdown:focus-within .drop-menu{display:grid;gap:4px}.drop-menu a{display:flex;align-items:flex-start;flex-direction:column;gap:3px;padding:12px;border-radius:14px}.drop-menu a strong{font-size:13px}.drop-menu a small{color:var(--muted);font-weight:700;line-height:1.35}.nav-cta{display:flex;align-items:center;gap:10px}.command-band{border:1px solid rgba(34,197,94,.24);background:linear-gradient(90deg,rgba(34,197,94,.12),rgba(139,92,246,.1),rgba(245,197,66,.08));border-radius:26px;padding:18px}.feature-row{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;align-items:stretch}.lock-notice{border:1px solid rgba(245,197,66,.36);background:linear-gradient(135deg,rgba(245,197,66,.11),rgba(139,92,246,.08));border-radius:22px;padding:18px;margin-top:16px}.subtle-divider{height:1px;background:linear-gradient(90deg,transparent,var(--line),transparent);margin:18px 0}.btn[disabled]{opacity:.65;cursor:not-allowed;transform:none!important}.mini-stat{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--line);border-radius:16px;padding:12px;background:rgba(255,255,255,.035)}.command-console{display:grid;grid-template-columns:1.05fr .95fr;gap:16px;align-items:start}.console-panel{border:1px solid rgba(34,197,94,.24);border-radius:22px;background:linear-gradient(180deg,rgba(2,6,23,.88),rgba(15,23,42,.68));padding:16px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.03)}.console-screen{min-height:310px;border-radius:18px;border:1px solid var(--line);background:rgba(0,0,0,.35);padding:14px;overflow:auto;font-family:'JetBrains Mono',ui-monospace,monospace}.console-line{display:grid;grid-template-columns:92px 1fr;gap:10px;padding:10px 0;border-bottom:1px solid rgba(148,163,184,.1);font-size:13px}.console-line:last-child{border-bottom:0}.console-line .stamp{color:var(--muted)}.console-line .success{color:var(--green2)}.console-line .warn{color:var(--gold)}.console-line .danger{color:#fca5a5}.command-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.command-tile{border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.045);padding:14px;transition:.2s ease}.command-tile:hover{border-color:rgba(34,197,94,.35);transform:translateY(-1px)}.command-tile strong{display:block;margin-bottom:4px}.command-tile small{color:var(--muted);line-height:1.4}.notify-filters{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}.notify-filters .chip{cursor:pointer}.sync-radar{display:grid;gap:10px}.sync-radar .mini-stat strong{font-family:'JetBrains Mono',ui-monospace,monospace}.locked-overlay{position:relative;overflow:hidden}.locked-overlay:after{content:'Locked until active Culture Coin membership';position:absolute;inset:auto 12px 12px 12px;border:1px solid rgba(245,197,66,.35);background:rgba(5,7,11,.82);backdrop-filter:blur(12px);border-radius:16px;padding:10px;text-align:center;color:var(--gold);font-weight:900}.command-input{display:flex;gap:10px;margin-top:12px}.command-input input{flex:1}.mobile-pill-nav{display:none}
.chart:before{content:'';position:absolute;inset:-40% -20%;background:conic-gradient(from 180deg,transparent,rgba(34,197,94,.16),rgba(245,197,66,.12),rgba(139,92,246,.14),transparent);animation:chartOrbit 7s linear infinite;opacity:.75}.chart span{position:absolute;bottom:0;width:11%;border-radius:999px 999px 0 0;background:linear-gradient(180deg,var(--green2),rgba(34,197,94,.14));box-shadow:0 0 24px rgba(34,197,94,.34);animation:chartGrow 2.8s ease-in-out infinite;z-index:1}.chart span:nth-of-type(1){left:10%;animation-delay:.05s}.chart span:nth-of-type(2){left:32%;background:linear-gradient(180deg,var(--gold),rgba(245,197,66,.12));box-shadow:0 0 24px rgba(245,197,66,.28);animation-delay:.25s}.chart span:nth-of-type(3){left:55%;background:linear-gradient(180deg,var(--purple),rgba(139,92,246,.12));box-shadow:0 0 24px rgba(139,92,246,.3);animation-delay:.45s}.chart span:nth-of-type(4){left:78%;background:linear-gradient(180deg,var(--cyan),rgba(34,211,238,.1));box-shadow:0 0 24px rgba(34,211,238,.28);animation-delay:.65s}.chart .chart-status{position:absolute;left:14px;top:12px;z-index:3;border:1px solid rgba(34,197,94,.28);background:rgba(5,7,11,.62);backdrop-filter:blur(12px);border-radius:999px;padding:6px 10px;font-size:11px;font-weight:950;color:#bbf7d0}.chart .chart-spark{position:absolute;inset:0;z-index:2;background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);transform:translateX(-100%);animation:chartSweep 3.2s ease-in-out infinite}@keyframes chartGrow{0%,100%{transform:scaleY(.82);filter:saturate(.88)}50%{transform:scaleY(1.08);filter:saturate(1.28)}}@keyframes chartSweep{0%{transform:translateX(-100%)}60%,100%{transform:translateX(100%)}}@keyframes chartOrbit{to{transform:rotate(360deg)}}.command-confirm{margin-top:12px;border:1px solid rgba(34,197,94,.25);background:rgba(34,197,94,.07);border-radius:16px;padding:12px;color:#bbf7d0;font-weight:850}.win-gif{margin-top:10px;max-width:180px;border-radius:14px;border:1px solid var(--line);box-shadow:0 0 24px rgba(34,197,94,.18)}
.account-health-card{position:relative;overflow:hidden}.account-health-card:before{content:'';position:absolute;inset:-45%;background:conic-gradient(from 220deg,transparent,var(--healthColor,rgba(34,197,94,.22)),transparent 42%);animation:healthSpin 9s linear infinite;opacity:.62}.account-health-card>*{position:relative;z-index:1}.health-blue{--healthColor:rgba(34,211,238,.3);border-color:rgba(34,211,238,.38);box-shadow:0 0 44px rgba(34,211,238,.14),var(--shadow)}.health-green{--healthColor:rgba(34,197,94,.32);border-color:rgba(34,197,94,.42);box-shadow:0 0 44px rgba(34,197,94,.18),var(--shadow)}.health-gold{--healthColor:rgba(245,197,66,.35);border-color:rgba(245,197,66,.52);box-shadow:0 0 54px rgba(245,197,66,.22),var(--shadow)}.health-red{--healthColor:rgba(239,68,68,.35);border-color:rgba(239,68,68,.52);box-shadow:0 0 54px rgba(239,68,68,.22),var(--shadow)}.health-gray{--healthColor:rgba(148,163,184,.18);border-color:rgba(148,163,184,.25)}@keyframes healthSpin{to{transform:rotate(360deg)}}.health-ring{width:110px;height:110px;border-radius:50%;display:grid;place-items:center;margin:auto;background:conic-gradient(var(--ringColor,var(--green2)) var(--ringValue,55%),rgba(255,255,255,.08) 0);box-shadow:inset 0 0 0 12px rgba(5,7,11,.82),0 0 35px rgba(34,197,94,.12)}.health-ring strong{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:23px}.pair-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.pair-card{border:1px solid var(--line);background:linear-gradient(180deg,rgba(15,23,42,.82),rgba(2,6,23,.76));border-radius:22px;padding:16px;position:relative;overflow:hidden}.pair-card:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 12% 0%,rgba(34,197,94,.16),transparent 30%),radial-gradient(circle at 90% 12%,rgba(139,92,246,.15),transparent 32%);opacity:.8}.pair-card>*{position:relative;z-index:1}.pair-card.profit{border-color:rgba(34,197,94,.34)}.pair-card.loss{border-color:rgba(239,68,68,.34)}.pair-card.gold{border-color:rgba(245,197,66,.42)}.pair-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.pair-symbol{font-family:Sora,Inter,sans-serif;font-size:22px;font-weight:900;letter-spacing:-.04em}.pair-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.pair-actions .btn{padding:9px 8px;font-size:12px;border-radius:12px}.strength-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.strength-card{border:1px solid var(--line);border-radius:20px;padding:14px;background:rgba(255,255,255,.035)}.strength-bar{height:12px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.strength-bar span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--red),var(--orange),var(--green2),var(--gold));box-shadow:0 0 18px rgba(34,197,94,.24)}.equity-line{height:86px;border:1px solid var(--line);border-radius:18px;background:repeating-linear-gradient(90deg,transparent,transparent 34px,rgba(255,255,255,.035) 35px),linear-gradient(180deg,rgba(34,197,94,.1),transparent);position:relative;overflow:hidden}.equity-line:after{content:'';position:absolute;inset:10px 0 20px;background:linear-gradient(90deg,var(--cyan),var(--green2),var(--gold));clip-path:polygon(0 80%,10% 70%,20% 76%,32% 45%,44% 55%,56% 32%,68% 40%,80% 22%,90% 28%,100% 12%);filter:drop-shadow(0 0 12px rgba(34,197,94,.6));animation:equityDrift 2.8s ease-in-out infinite}@keyframes equityDrift{50%{transform:translateY(-6px)}}.command-diagnostics{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:12px}.command-diagnostics .mini-stat{background:rgba(34,197,94,.045)}
@media (max-width:960px){.hero-grid,.grid,.grid2,.grid4,.command-console,.command-grid{grid-template-columns:1fr}.nav-links{display:flex;order:3;width:100%;overflow-x:auto;padding-bottom:8px}.dropdown{position:static}.drop-menu{position:static;display:none;min-width:220px}.dropdown:focus-within .drop-menu,.dropdown:hover .drop-menu{display:grid}.nav-cta{margin-left:auto}.mobile-menu{display:inline-flex}.app-shell{grid-template-columns:1fr}.side{position:relative;top:0;height:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.main{padding:18px}.topbar{align-items:flex-start;flex-direction:column}.preview{min-height:auto}.hero{padding-top:56px}.nav-inner{height:auto;min-height:70px;padding:10px 0;flex-wrap:wrap}.brand{min-width:0}.brand span:last-child{font-size:14px}.actions{width:100%}.nav-cta.actions{width:auto}}@media (prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.001ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}.launch-overlay{display:none!important}}.account-switcher-card{margin:0 0 16px;border-color:rgba(34,197,94,.28);background:linear-gradient(135deg,rgba(34,197,94,.10),rgba(139,92,246,.08),rgba(8,13,22,.88))}.account-switcher-layout{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;align-items:end}.account-switcher-card select{min-width:100%;font-size:14px}.mobile-command-dock{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.mobile-command-dock .btn{padding:10px 12px}.account-switcher-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.account-switcher-warning{border:1px solid rgba(239,68,68,.34);background:rgba(239,68,68,.09);border-radius:14px;padding:10px;margin-top:10px;color:#fecaca}.range-row{display:grid;grid-template-columns:1fr 86px;gap:10px;align-items:center}.range-row input[type=range]{width:100%}@media(max-width:720px){.account-switcher-layout{grid-template-columns:1fr}.account-switcher-card{position:sticky;top:126px;z-index:35}.mobile-command-dock .btn{flex:1 1 calc(50% - 8px);min-height:44px}.portal-subnav{overflow:auto;flex-wrap:nowrap;padding-bottom:4px}.portal-subnav a{white-space:nowrap}.copy-engine-form.grid4,.copy-engine-form.grid2{grid-template-columns:1fr!important}}
    /* Wisdo TradersConnect-style product pass */
    :root{--tc-bg:oklch(0.19 0.02 190);--tc-fg:oklch(0.98 0.01 180);--tc-card:oklch(0.22 0.025 190);--tc-primary:oklch(0.82 0.18 165);--tc-muted:oklch(0.72 0.02 190);--tc-border:oklch(0.32 0.03 190 / 60%);--tc-glow:0 20px 60px -20px oklch(0.82 0.18 165 / 40%);--tc-hero:radial-gradient(ellipse at top,oklch(0.28 0.05 180) 0%,oklch(0.16 0.02 190) 60%)}
    .tc-page{background:var(--tc-hero);color:var(--tc-fg);overflow:hidden}.tc-section{padding:96px 0;position:relative}.tc-hero{position:relative;padding:96px 0 56px}.tc-rays{position:absolute;inset:0;pointer-events:none}.tc-rays i{position:absolute;top:0;bottom:0;width:1px;background:linear-gradient(transparent,oklch(0.82 0.18 165 / 22%),transparent)}.tc-rays i:nth-child(1){left:15%}.tc-rays i:nth-child(2){left:25%}.tc-rays i:nth-child(3){left:50%}.tc-rays i:nth-child(4){left:75%}.tc-rays i:nth-child(5){left:85%}.tc-hero-grid{display:grid;grid-template-columns:1fr 1fr;gap:54px;align-items:start}.tc-kicker{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--tc-border);background:oklch(0.22 0.025 190 / 60%);color:var(--tc-primary);border-radius:999px;padding:9px 13px;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.18em}.tc-display{font-size:clamp(48px,7.2vw,92px);line-height:1.03;font-weight:800;letter-spacing:-.07em;margin:22px 0 0}.tc-display em,.tc-title em{font-style:normal;color:var(--tc-primary)}.tc-copy{color:var(--tc-muted);font-size:18px;line-height:1.7;max-width:650px}.tc-micro{color:var(--tc-muted);font-size:13px;margin-top:12px}.tc-dash-wrap{position:relative;margin-top:58px}.tc-dashboard{border:1px solid var(--tc-border);background:linear-gradient(180deg,oklch(0.22 0.025 190 / 92%),oklch(0.14 0.02 190 / 95%));border-radius:28px;box-shadow:0 30px 80px -30px oklch(0 0 0 / 70%);padding:18px;min-height:430px}.tc-dashboard-shell{display:grid;grid-template-columns:190px 1fr;gap:16px}.tc-side{border-right:1px solid var(--tc-border);padding:12px}.tc-side div{padding:10px 12px;border-radius:14px;color:var(--tc-muted);font-weight:800}.tc-side div.active{background:oklch(0.82 0.18 165 / 14%);color:var(--tc-primary)}.tc-mini-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}.tc-mini,.tc-table-card,.tc-card,.tc-tool,.tc-price{border:1px solid var(--tc-border);border-radius:22px;background:oklch(0.22 0.025 190 / 62%);padding:18px}.tc-mini span,.tc-tool span{display:block;color:var(--tc-muted);font-size:12px;text-transform:uppercase;letter-spacing:.12em}.tc-mini strong,.tc-tool strong{display:block;color:var(--tc-primary);font-size:24px;margin-top:6px}.tc-table{width:100%;border-collapse:collapse;color:var(--tc-muted)}.tc-table th,.tc-table td{text-align:left;padding:14px;border-bottom:1px solid var(--tc-border)}.tc-table th{font-size:11px;text-transform:uppercase;letter-spacing:.15em}.tc-status{display:inline-flex;border-radius:999px;padding:5px 9px;background:oklch(0.82 0.18 165 / 14%);color:var(--tc-primary);font-size:12px;font-weight:900}.tc-phone{position:absolute;right:-18px;top:-56px;width:224px;border:1px solid var(--tc-border);border-radius:34px;background:oklch(0.13 0.02 190);box-shadow:var(--tc-glow);padding:12px}.tc-phone-screen{border-radius:25px;background:linear-gradient(180deg,oklch(0.22 0.025 190),oklch(0.15 0.02 190));padding:18px;min-height:360px}.tc-gauge{width:118px;height:118px;margin:20px auto;border-radius:999px;background:conic-gradient(var(--tc-primary) 0 74%,oklch(0.32 0.03 190) 74% 100%);display:grid;place-items:center}.tc-gauge b{background:oklch(0.15 0.02 190);border-radius:999px;width:86px;height:86px;display:grid;place-items:center}.tc-marquee{border-top:1px solid var(--tc-border);border-bottom:1px solid var(--tc-border);padding:40px 0;background:oklch(0.22 0.025 190 / 18%);overflow:hidden}.tc-track{display:flex;gap:46px;white-space:nowrap;animation:tcMarquee 30s linear infinite;color:oklch(0.72 0.02 190 / 80%);font-size:20px;font-weight:800}.tc-track span:hover{color:var(--tc-fg)}@keyframes tcMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}.tc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-top:1px solid var(--tc-border);border-bottom:1px solid var(--tc-border);background:oklch(0.22 0.025 190 / 20%)}.tc-stat{text-align:center;padding:34px 14px}.tc-stat strong{display:block;color:var(--tc-primary);font-size:34px}.tc-title{font-size:clamp(36px,5vw,60px);line-height:1.08;letter-spacing:-.055em;margin:18px 0 12px}.tc-features{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.tc-card{position:relative;overflow:hidden;transition:.2s}.tc-card:hover{border-color:oklch(0.82 0.18 165 / 55%);transform:translateY(-2px)}.tc-icon{width:48px;height:48px;border-radius:16px;background:oklch(0.82 0.18 165 / 14%);color:var(--tc-primary);display:grid;place-items:center;font-size:22px;font-weight:900}.tc-orbit{height:520px;position:relative;display:grid;place-items:center}.tc-orbit .ring{position:absolute;border:1px solid oklch(0.82 0.18 165 / 22%);border-radius:999px}.tc-orbit .ring:nth-child(1){width:140px;height:140px}.tc-orbit .ring:nth-child(2){width:220px;height:220px}.tc-orbit .ring:nth-child(3){width:310px;height:310px}.tc-orbit .ring:nth-child(4){width:410px;height:410px}.tc-orbit .ring:nth-child(5){width:500px;height:500px}.tc-orbit .core{width:96px;height:96px;border-radius:999px;background:var(--tc-primary);box-shadow:0 0 70px oklch(0.82 0.18 165 / 70%);display:grid;place-items:center;color:#052017;font-weight:950}.tc-dot{position:absolute;width:10px;height:10px;background:var(--tc-primary);border-radius:999px;box-shadow:0 0 24px var(--tc-primary)}.tc-tools{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}.tc-prices{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.tc-price.popular{border:2px solid var(--tc-primary);box-shadow:var(--tc-glow)}.tc-price h3{font-size:24px}.tc-price .amount{font-size:40px;color:var(--tc-primary);font-weight:900;letter-spacing:-.05em}.tc-list{list-style:none;margin:20px 0;padding:0;display:grid;gap:10px;color:var(--tc-muted)}.tc-list li:before{content:'✓';color:var(--tc-primary);font-weight:900;margin-right:8px}.tc-faq{display:grid;gap:12px;max-width:850px;margin:0 auto}.tc-faq details{border:1px solid var(--tc-border);border-radius:18px;background:oklch(0.22 0.025 190 / 46%);padding:18px}.tc-faq summary{cursor:pointer;font-weight:900}.tc-faq p{color:var(--tc-muted);line-height:1.65}.tc-product-hero{padding:86px 0;background:var(--tc-hero)}.tc-product-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:28px;align-items:center}.tc-compare-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.tc-compare-card{border:1px solid var(--tc-border);border-radius:20px;background:oklch(0.22 0.025 190 / 58%);padding:18px}.tc-config{display:grid;grid-template-columns:1fr 1fr;gap:14px}.tc-config input,.tc-config select{width:100%;border:1px solid var(--tc-border);background:oklch(0.18 0.02 190);color:var(--tc-fg);border-radius:14px;padding:12px}.tc-config label{color:var(--tc-muted);font-weight:800;font-size:13px}.tc-total{font-size:42px;color:var(--tc-primary);font-weight:950}.tc-spark{height:70px;border-radius:18px;background:linear-gradient(135deg,oklch(0.82 0.18 165 / 22%),transparent),repeating-linear-gradient(90deg,transparent 0 24px,oklch(0.82 0.18 165 / 10%) 25px 26px)}
    @media(max-width:900px){.tc-hero-grid,.tc-product-grid,.tc-features,.tc-prices,.tc-config{grid-template-columns:1fr}.tc-mini-grid,.tc-stats,.tc-tools,.tc-compare-grid{grid-template-columns:repeat(2,1fr)}.tc-dashboard-shell{grid-template-columns:1fr}.tc-side{display:none}.tc-phone{position:relative;right:auto;top:auto;width:100%;margin-top:18px}.tc-display{font-size:46px}.tc-orbit{height:340px}.tc-orbit .ring:nth-child(n+4){display:none}}
</style>`;
}

function launchMarkup() {
  return `<div id="launchOverlay" class="launch-overlay" aria-live="polite"><button class="btn skip" data-skip-launch>Skip</button><div class="launch-card"><div class="eyebrow">Command Launch Sequence</div><h2 style="font-family:Sora,Inter,sans-serif;margin:14px 0 8px">Connecting...</h2><p class="muted" id="launchText">Culture Coin command ship is syncing your account.</p><div class="ship-stage"><div class="coin-ship"></div></div><div class="stepper" id="launchSteps"><div><i></i> Connecting</div><div><i></i> Authenticating</div><div><i></i> Syncing membership</div><div><i></i> Checking subscription</div><div><i></i> Connecting Discord</div><div><i></i> Connecting trading bridge</div><div><i></i> Launching dashboard</div><div><i></i> Command Center Online</div></div></div></div><div id="onlineToast" class="toast"><strong>Command Center Online</strong><div class="muted">Access reflects the real membership check. Locked features stay locked until active.</div></div>`;
}

function siteScript() {
  return `<script>
    const overlay=document.getElementById('launchOverlay');
    const toast=document.getElementById('onlineToast');
    const steps=[...document.querySelectorAll('#launchSteps div')];
    const launchText=document.getElementById('launchText');
    async function runCommandLaunch(opts={}){
      if(!overlay || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      overlay.classList.add('active');
      const labels=['Connecting','Authenticating','Syncing membership','Checking subscription','Connecting Discord','Connecting trading bridge','Launching dashboard','Command Center Online'];
      let member=null;
      const timeout=new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),4200));
      const check=fetch('/api/deadshot/me').then(r=>r.json()).catch(()=>({ok:false}));
      for(let i=0;i<labels.length;i++){
        steps[i]?.classList.add('done');
        if(launchText) launchText.textContent=labels[i]+'...';
        if(i===3){ member=await Promise.race([check, timeout]); }
        await new Promise(r=>setTimeout(r, i===3?260:360));
      }
      if(launchText) launchText.textContent=(member?.membership?.tradeCopyUnlocked?'Copier controls unlocked.':'Dashboard online. Copier controls locked unless membership/account checks pass.');
      await new Promise(r=>setTimeout(r,520));
      overlay.classList.remove('active');
      toast?.classList.add('show'); setTimeout(()=>toast?.classList.remove('show'),4600);
    }
    document.querySelectorAll('[data-launch]').forEach(el=>el.addEventListener('click',()=>sessionStorage.setItem('deadshotLaunch','1')));
    document.querySelector('[data-skip-launch]')?.addEventListener('click',()=>overlay?.classList.remove('active'));
    if(new URLSearchParams(location.search).has('launch') || sessionStorage.getItem('deadshotLaunch')==='1'){
      sessionStorage.removeItem('deadshotLaunch'); runCommandLaunch();
    }
    document.querySelectorAll('[data-checkout]').forEach(btn=>btn.addEventListener('click',async()=>{
      btn.disabled=true; const old=btn.textContent; btn.textContent='Opening secure checkout...';
      const res=await fetch('/api/checkout/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId:btn.dataset.checkout})});
      const json=await res.json().catch(()=>({ok:false,error:'Bad response'}));
      if(json.url){ location.href=json.url; return; }
      if(json.checkoutMode==='manual_invoice_pending'){ alert(json.message || 'Order saved as manual invoice pending. Access unlocks after payment confirmation.'); btn.textContent=old; btn.disabled=false; return; }
      alert(json.error||'Checkout is not configured yet.'); btn.textContent=old; btn.disabled=false;
    }));
    async function pollCommandStatus(commandId, label){
      if(!commandId) return;
      const box=document.getElementById('commandConfirmBox');
      for(let i=0;i<35;i++){
        await new Promise(r=>setTimeout(r,1000));
        const res=await fetch('/api/command/status?commandId='+encodeURIComponent(commandId)+'&accountId='+encodeURIComponent(cemActiveAccountId()));
        const json=await res.json().catch(()=>({ok:false}));
        const status=json.command?.status || json.status;
        if(box) box.innerHTML='<strong>'+label+'</strong><br>Status: '+(status||'waiting')+'<br><span class="muted">MT4 reporter polls /mt4-command-poll. Last update checks every second.</span>';
        if(status==='completed' || status==='failed' || status==='expired'){
          alert(status==='completed' ? '✅ Command complete in MT4: '+(json.command?.result?.message||label) : '⚠️ Command ended as '+status+': '+(json.command?.errorMessage||json.command?.result?.message||''));
          location.reload();
          return;
        }
      }
    }
    async function confirmMt4IfRequired(json, endpoint, body, label){
      if(!json?.confirmationRequired) return json;
      const phrase=json.confirmationPhrase || json.phrase || 'CONFIRM';
      const box=document.getElementById('commandConfirmBox');
      if(box) box.innerHTML='<strong>Confirmation required</strong><br>'+json.mt4Command+' requires confirmation.<br><span class="muted">Type: '+phrase+'</span>';
      const typed=prompt('MT4 confirmation required for '+(json.mt4Command||label)+'. Type exactly: '+phrase);
      if(!typed || typed.trim().toUpperCase()!==String(phrase).trim().toUpperCase()){
        return {ok:false,error:'Confirmation phrase did not match. Command was not queued.',cancelled:true};
      }
      const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body, confirmation:'confirmed', confirmationId:json.confirmationId, confirmationPhrase:typed})});
      return res.json().catch(()=>({ok:false,error:'Bad confirmation response'}));
    }
    document.querySelectorAll('[data-copy-action]').forEach(btn=>btn.addEventListener('click',async()=>{
      if(btn.classList.contains('locked')){ alert('Copier controls are locked. Reporter still works, but copy trading requires active Culture Coin membership and a connected account.'); return; }
      const action=btn.dataset.copyAction;
      const symbol=btn.dataset.symbol||'';
      const closeMode=btn.dataset.closeMode||'';
      btn.disabled=true; const old=btn.textContent; btn.textContent='Queueing to MT4...';
      const body={action, symbol, targetSymbol:symbol, closeMode, accountId:cemActiveAccountId(), immediate:true};
      const res=await fetch('/api/trade-copy/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      let json=await res.json().catch(()=>({ok:false,error:'Bad response'}));
      json=await confirmMt4IfRequired(json,'/api/trade-copy/action',body,action);
      if(!json.ok){ alert('Blocked: '+(json.error||'Command blocked')); btn.textContent=old; btn.disabled=false; return; }
      const box=document.getElementById('commandConfirmBox');
      if(box) box.innerHTML='<strong>Command queued for MT4</strong><br>'+json.mt4Command+' • '+json.commandId+'<br><span class="muted">Waiting for Culture Coin Reporter to poll '+(json.pollUrl||'/mt4-command-poll')+'</span>';
      btn.textContent=old; btn.disabled=false;
      pollCommandStatus(json.commandId, json.mt4Command || action);
    }));
    document.querySelectorAll('[data-wisdo-send]').forEach(btn=>btn.addEventListener('click',async()=>{
      const input=document.querySelector('[data-wisdo-text]');
      const rawText=input?.value?.trim()||'';
      if(!rawText){ alert('Type a Wisdo command first, like: hey coach close all profitable trades'); return; }
      btn.disabled=true; const old=btn.textContent; btn.textContent='Deciphering...';
      const body={rawText, source:'website_wake_word', accountId:cemActiveAccountId(), immediate:true};
      const res=await fetch('/api/wisdo/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      let json=await res.json().catch(()=>({ok:false,error:'Bad response'}));
      json=await confirmMt4IfRequired(json,'/api/wisdo/command',body,rawText);
      if(!json.ok){ alert('Blocked: '+(json.error||'Command blocked')); btn.textContent=old; btn.disabled=false; return; }
      const box=document.getElementById('commandConfirmBox');
      if(box) box.innerHTML='<strong>Wake-word command queued</strong><br>“'+rawText.replace(/[<>]/g,'')+'” → '+json.mt4Command+'<br><span class="muted">Waiting for MT4 completion confirmation.</span>';
      btn.textContent=old; btn.disabled=false;
      pollCommandStatus(json.commandId, json.mt4Command || rawText);
    }));
    document.querySelectorAll('[data-connect-demo],[data-connect-demo-bridge]').forEach(btn=>btn.addEventListener('click',async()=>{
      btn.disabled=true; const old=btn.textContent; btn.textContent='Generating live pairing...';
      const res=await fetch('/api/pairing/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:'website_live_pairing'})});
      const json=await res.json().catch(()=>({ok:false,error:'Bad response'}));
      if(json.ok){ alert('Pairing code generated: '+json.code+' — paste this into the MT4 Reporter.'); location.href='/app/connect-account?launch=1'; return; }
      alert(json.error||'Live pairing failed.'); btn.textContent=old; btn.disabled=false;
    }));
    document.querySelectorAll('[data-pairing-generate]').forEach(btn=>btn.addEventListener('click',async()=>{
      btn.disabled=true; const old=btn.textContent; btn.textContent='Generating code...';
      const res=await fetch('/api/pairing/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:'website'})});
      const json=await res.json().catch(()=>({ok:false,error:'Bad response'}));
      const box=document.getElementById('pairingResult');
      if(box){ box.style.display='block'; box.innerHTML=json.ok ? '<strong>Pairing Code:</strong> '+json.code+'<br><span class="muted">Expires at '+json.expiresAt+'. Use /pair connect code:'+json.code+' in Discord.</span>' : '<strong>Pairing failed:</strong> '+(json.error||'Unknown error'); }
      btn.textContent=old; btn.disabled=false;
    }));
    document.querySelectorAll('[data-pairing-sync]').forEach(btn=>btn.addEventListener('click',async()=>{
      btn.disabled=true; const old=btn.textContent; btn.textContent='Syncing...';
      const res=await fetch('/api/pairing/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:'website'})});
      const json=await res.json().catch(()=>({ok:false,error:'Bad response'}));
      alert(json.ok ? 'Website + Discord sync event recorded.' : (json.error||'Sync failed'));
      if(json.ok) location.reload(); else { btn.textContent=old; btn.disabled=false; }
    }));
    document.querySelectorAll('[data-mark-notifications-read]').forEach(btn=>btn.addEventListener('click',async()=>{
      const res=await fetch('/api/notifications/read',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({all:true})});
      const json=await res.json().catch(()=>({ok:false}));
      alert(json.ok ? 'Notifications marked read.' : 'Could not mark notifications read.');
    }));

    function cemUpdateWorldClock(){
      document.querySelectorAll('[data-clock-zone]').forEach((el)=>{
        const zone=el.dataset.clockZone;
        try{ el.textContent = new Intl.DateTimeFormat('en-US',{timeZone:zone==='local'?undefined:zone,hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true}).format(new Date()); }
        catch{ el.textContent='--:--'; }
      });
    }
    cemUpdateWorldClock(); setInterval(cemUpdateWorldClock,1000);
    function cemFormJson(form){ const o=Object.fromEntries(new FormData(form).entries()); form.querySelectorAll('input[type="checkbox"]').forEach((i)=>{o[i.name]=i.checked;}); return o; }
    function cemShow(id,json){ const el=document.getElementById(id); if(el){ el.style.display='block'; el.textContent=typeof json==='string'?json:JSON.stringify(json,null,2); } }
    function cemDiscoverOwner(accountId){ return (window.CEM_DISCOVER_OWNERS||{})[accountId] || ''; }
    function cemActiveAccountId(){
      const select=document.querySelector('[data-active-account-select]');
      return (select&&select.value) || new URLSearchParams(location.search).get('accountId') || '';
    }
    async function cemActivateAccount(accountId){
      if(!accountId) return;
      const status=document.querySelector('[data-account-switch-status]');
      if(status) status.textContent='Switching selected account…';
      const res=await fetch('/api/deadshot/active-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId})});
      const json=await res.json().catch(()=>({ok:false,error:'Bad response'}));
      if(!json.ok){ if(status) status.textContent=json.error||'Could not switch account'; alert(json.error||'Could not switch account'); return; }
      const url=new URL(location.href); url.searchParams.set('accountId',accountId); location.href=url.toString();
    }
    document.querySelectorAll('[data-active-account-select]').forEach((select)=>select.addEventListener('change',(e)=>cemActivateAccount(e.target.value)));
    document.querySelectorAll('[data-mobile-command]').forEach((btn)=>btn.addEventListener('click',()=>{
      const action=btn.dataset.mobileCommand;
      document.querySelector('[data-copy-action="'+action+'"]')?.click();
    }));
    function cemRiskDial(){
      const type=document.getElementById('appCalcType')?.value||'percent'; const leadRisk=Number(document.getElementById('appLeadRisk')?.value||1); const recvRisk=Number(document.getElementById('appReceiverRisk')?.value||1); const leadLot=Number(document.getElementById('appLeadLot')?.value||0.01); const recvLot=Number(document.getElementById('appReceiverLot')?.value||0.01);
      let mode='fixed_lot', mult=1, fixed=recvLot, text='Fixed Culture Lot: receiver uses '+recvLot.toFixed(2)+' lots.';
      if(type==='percent'){ mode='equity_ratio'; mult=leadRisk>0?recvRisk/leadRisk:1; text='Balance Bridge: lead risk '+leadRisk+'% → receiver risk '+recvRisk+'%; setting '+(mult*100).toFixed(2)+'%.'; }
      if(type==='lot'){ mode='multiplier'; mult=leadLot>0?recvLot/leadLot:1; text='Lane Multiplier: lead lot '+leadLot+' → receiver lot '+recvLot+'; setting '+(mult*100).toFixed(2)+'%.'; }
      document.getElementById('appRouteMode') && (document.getElementById('appRouteMode').value=mode); document.getElementById('appMultiplier') && (document.getElementById('appMultiplier').value=mult.toFixed(4)); document.getElementById('appFixedLot') && (document.getElementById('appFixedLot').value=fixed.toFixed(2)); document.getElementById('appRiskDialText') && (document.getElementById('appRiskDialText').textContent=text+' SL/TP and pending orders remain off unless you turn them on.');
    }
    document.querySelector('[data-apply-risk-dial]')?.addEventListener('click', cemRiskDial);
    document.getElementById('appDiscoverSelect')?.addEventListener('change',(e)=>{ const owner=cemDiscoverOwner(e.target.value); const box=document.getElementById('appDiscoverOwner'); if(box) box.value=owner; });
    document.querySelectorAll('[data-pick-lead]').forEach((b)=>b.addEventListener('click',()=>{ const s=document.getElementById('appLeaderSelect'); if(s){s.value=b.dataset.pickLead; document.getElementById('add-lane')?.scrollIntoView({behavior:'smooth'});} }));
    document.querySelectorAll('[data-request-reporter]').forEach((b)=>b.addEventListener('click',()=>{ const s=document.getElementById('appDiscoverSelect'); const o=document.getElementById('appDiscoverOwner'); if(s)s.value=b.dataset.requestReporter; if(o)o.value=b.dataset.owner||cemDiscoverOwner(b.dataset.requestReporter); document.getElementById('discover')?.scrollIntoView({behavior:'smooth'}); }));
    document.getElementById('appRouteForm')?.addEventListener('submit',async(e)=>{ e.preventDefault(); const raw=cemFormJson(e.target); const owner=cemDiscoverOwner(raw.leaderAccountId); if(owner){ const r=await fetch('/api/me/access-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId:raw.leaderAccountId,ownerUserId:owner,permission:'copy_allowed',note:'Requested from Add Culture Lane dropdown'})}); const j=await r.json().catch(()=>({ok:false,error:'bad response'})); cemShow('appRouteOut',j); if(j.ok)setTimeout(()=>location.reload(),900); return; } const body={leaderAccountId:raw.leaderAccountId,followerAccountId:raw.followerAccountId,status:raw.status,risk:raw}; const r=await fetch('/api/me/copy-routes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const j=await r.json().catch(()=>({ok:false,error:'bad response'})); cemShow('appRouteOut',j); if(j.ok)setTimeout(()=>location.reload(),800); });
    document.getElementById('appBrokerForm')?.addEventListener('submit',async(e)=>{ e.preventDefault(); const raw=cemFormJson(e.target); const r=await fetch('/api/me/broker-link-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(raw)}); const j=await r.json().catch(()=>({ok:false,error:'bad response'})); cemShow('appBrokerOut',j); if(j.ok)setTimeout(()=>location.reload(),900); });
    document.getElementById('affiliateSignupForm')?.addEventListener('submit',async(e)=>{ e.preventDefault(); const raw=cemFormJson(e.target); const r=await fetch('/api/affiliates/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(raw)}); const j=await r.json().catch(()=>({ok:false,error:'bad response'})); cemShow('affiliateSignupOut',j); if(j.checkoutUrl) location.href=j.checkoutUrl; });
    document.getElementById('appRequestForm')?.addEventListener('submit',async(e)=>{ e.preventDefault(); const raw=cemFormJson(e.target); if(!raw.ownerUserId) raw.ownerUserId=cemDiscoverOwner(raw.accountId); const r=await fetch('/api/me/access-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(raw)}); const j=await r.json().catch(()=>({ok:false,error:'bad response'})); cemShow('appRequestOut',j); if(j.ok)setTimeout(()=>location.reload(),900); });
    document.getElementById('appDiscordChannelForm')?.addEventListener('submit',async(e)=>{ e.preventDefault(); const r=await fetch('/api/discord/copier-channel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cemFormJson(e.target))}); const j=await r.json().catch(()=>({ok:false,error:'bad response'})); cemShow('appDiscordChannelOut',j); });
    document.querySelectorAll('[data-save-role]').forEach((b)=>b.addEventListener('click',async()=>{ const id=b.dataset.saveRole; const role=document.getElementById('role-'+id)?.value||'private'; const r=await fetch('/api/me/accounts/'+encodeURIComponent(id)+'/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountRole:role,copyPermission:role==='leader'?'signal_only':role==='follower'?'copy_allowed':role==='both'?'copy_allowed':'private',visibility:role==='private'?'private':'desk'})}); alert(JSON.stringify(await r.json().catch(()=>({ok:false})),null,2)); location.reload(); }));
    document.querySelectorAll('[data-edit-risk]').forEach((b)=>b.addEventListener('click',()=>{ const id=b.dataset.editRisk; const s=document.getElementById('appFollowerSelect'); if(s) s.value=id; document.getElementById('risk-dial')?.scrollIntoView({behavior:'smooth'}); }));
    document.querySelectorAll('[data-delete-route]').forEach((b)=>b.addEventListener('click',async()=>{ if(!confirm('Delete this Culture Lane?'))return; const r=await fetch('/api/me/copy-routes/'+encodeURIComponent(b.dataset.deleteRoute),{method:'DELETE'}); alert(JSON.stringify(await r.json().catch(()=>({ok:false})),null,2)); location.reload(); }));
    document.querySelectorAll('[data-cancel-broker]').forEach((b)=>b.addEventListener('click',async()=>{ const r=await fetch('/api/me/broker-link-requests/'+encodeURIComponent(b.dataset.cancelBroker),{method:'DELETE'}); alert(JSON.stringify(await r.json().catch(()=>({ok:false})),null,2)); location.reload(); }));
    document.querySelectorAll('[data-approve-request]').forEach((b)=>b.addEventListener('click',async()=>{ const r=await fetch('/api/me/access-requests/'+encodeURIComponent(b.dataset.approveRequest)+'/approve',{method:'POST'}); alert(JSON.stringify(await r.json().catch(()=>({ok:false})),null,2)); location.reload(); }));
    document.querySelectorAll('[data-reject-request]').forEach((b)=>b.addEventListener('click',async()=>{ const r=await fetch('/api/me/access-requests/'+encodeURIComponent(b.dataset.rejectRequest)+'/reject',{method:'POST'}); alert(JSON.stringify(await r.json().catch(()=>({ok:false})),null,2)); location.reload(); }));
  </script><script src="/js/wisdo-assistant.js" defer></script>`;
}

function publicNavHtml(active = '/') {
  const isActive = (href) => active === href ? 'active' : '';
  return `
    <a class="${isActive('/')}" href="/">Home</a>
    <a class="${isActive('/copier')}" href="/copier">Copier</a>
    <a class="${isActive('/analyzer')}" href="/analyzer">Analyzer</a>
    <a class="${isActive('/compare')}" href="/compare">Compare</a>
    <a class="${isActive('/pricing')}" href="/pricing">Pricing</a>
    <div class="dropdown"><a class="drop-trigger ${isActive('/education')}" href="/education">Learn</a><div class="drop-menu">
      <a href="/webinar/register"><strong>Seminar</strong><small>Wisdo onboarding and command-center training</small></a>
      <a href="/affiliate"><strong>Affiliate Signup</strong><small>Activation payment and payout split tracking</small></a>
      <a href="/faq"><strong>FAQ</strong><small>Pricing, copier, account linking, and risk rules</small></a>
      <a href="/risk-disclosure"><strong>Risk Disclosure</strong><small>Trading risk and software limitations</small></a>
    </div></div>`;
}


function presenceAwarenessClient(){
  return `<style>
  .presence-orb{position:fixed;right:18px;bottom:18px;z-index:70;width:min(360px,calc(100vw - 36px));background:rgba(5,14,25,.96);border:1px solid rgba(57,255,136,.28);border-radius:20px;padding:14px;box-shadow:0 20px 70px #000a;backdrop-filter:blur(18px)}
  .presence-orb.collapsed .presence-body{display:none}.presence-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.presence-dot{width:10px;height:10px;border-radius:50%;background:var(--green2);box-shadow:0 0 18px var(--green2);display:inline-block;margin-right:7px}.presence-body{margin-top:10px}.presence-meta{display:flex;flex-wrap:wrap;gap:7px;margin:9px 0}.presence-chip{font-size:11px;padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.06);color:var(--muted)}.presence-actions{display:flex;gap:8px;flex-wrap:wrap}.presence-actions a,.presence-actions button{font-size:12px;padding:8px 10px}.presence-toggle{background:none;border:0;color:var(--muted);cursor:pointer;font-size:18px}
  </style><div class="presence-orb collapsed" id="wisdoPresenceOrb"><div class="presence-head"><strong><span class="presence-dot"></span><span id="presenceTitle">Wisdo Presence</span></strong><button class="presence-toggle" id="presenceToggle" aria-label="Toggle Presence">⌃</button></div><div class="presence-body"><p id="presenceGreeting" class="muted" style="margin:4px 0 8px">Recognizing your workspace…</p><div class="presence-meta"><span class="presence-chip" id="presenceMode">Mode: --</span><span class="presence-chip" id="presenceDevice">Device: --</span><span class="presence-chip" id="presenceAccount">Account: none</span></div><div class="presence-actions"><a class="btn primary" id="presenceResume" href="/app/dashboard">Resume workspace</a><a class="btn" href="/app/presence">Presence Center</a><button class="btn" id="presenceFocus">Focus mode</button></div></div></div>
  <script>(function(){
    const orb=document.getElementById('wisdoPresenceOrb'); if(!orb)return;
    const path=location.pathname+location.search; const params=new URLSearchParams(location.search); const accountId=params.get('accountId')||'';
    const ua=navigator.userAgent||''; const deviceType=/Mobile|Android|iPhone|iPad/i.test(ua)?'mobile':'desktop';
    const deviceName=deviceType==='mobile'?'Mobile command device':'Web command desk';
    const payload=()=>({currentPage:path,currentAccountId:accountId,deviceType,deviceName,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'',locale:navigator.language||'',status:document.hidden?'away':'online'});
    async function post(url,body){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error('presence unavailable');return r.json()}
    async function sync(){try{await post('/api/presence/heartbeat',payload());const r=await fetch('/api/presence/me');const j=await r.json();const p=j.presence||{};document.getElementById('presenceGreeting').textContent=p.greeting||'Wisdo is aware and ready.';document.getElementById('presenceTitle').textContent='@'+(p.cultureId||'member')+' • online';document.getElementById('presenceMode').textContent='Mode: '+(p.activeMode||'focus');document.getElementById('presenceDevice').textContent='Device: '+(p.deviceType||deviceType);document.getElementById('presenceAccount').textContent='Account: '+(p.currentAccountId||'none');const resume=document.getElementById('presenceResume');resume.href=p.resumePath||'/app/dashboard';if((p.resumePath||'')===path)resume.textContent='Current workspace';}catch(e){orb.style.display='none'}}
    document.getElementById('presenceToggle').onclick=()=>{orb.classList.toggle('collapsed');document.getElementById('presenceToggle').textContent=orb.classList.contains('collapsed')?'⌃':'⌄'};
    document.getElementById('presenceFocus').onclick=async()=>{try{await post('/api/presence/mode',{mode:'focus'});sync()}catch(e){alert(e.message)}};
    document.addEventListener('visibilitychange',()=>post('/api/presence/status',payload()).catch(()=>{}));
    window.addEventListener('beforeunload',()=>{try{navigator.sendBeacon('/api/presence/status',new Blob([JSON.stringify({...payload(),status:'away'})],{type:'application/json'}))}catch{}});
    sync(); setInterval(sync,60000);
  })();</script>`;
}

function shell({ title, body, active = '/', mode = 'public', membership = null }) {
  const nav = mode === 'portal' ? PORTAL_NAV : mode === 'admin' ? ADMIN_NAV : PUBLIC_NAV;
  const navHtml = mode === 'public'
    ? publicNavHtml(active)
    : nav.map(([href, label]) => `<a class="${active === href ? 'active' : ''}" href="${href}">${esc(label)}</a>`).join('');
  const portal = mode === 'portal' || mode === 'admin';
  const loggedIn = Boolean(membership?.userId || membership?.user);
  const portalStatus = membership ? `<span class="status-pill"><span class="pulse"><i></i></span>${membership.canCopyTrades ? 'Copier Unlocked' : 'Reporter Only'}</span>` : '';
  const authActions = loggedIn
    ? `${portalStatus}<a class="btn primary" href="/app/dashboard" data-launch>Dashboard</a><a class="btn" href="/logout">Logout</a>`
    : `${portalStatus}<a class="btn" href="/login">Login</a><a class="btn primary" href="/app/dashboard" data-launch>Command Center</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Culture Coin / Deadshot</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@600;800&family=Sora:wght@700;800&display=swap" rel="stylesheet">${baseCss()}${worldClockCss()}</head><body>${launchMarkup()}<header class="nav"><div class="container nav-inner"><a class="brand" href="/"><span class="brand-mark"></span><span>Wisdo <b style="color:var(--green2)">Connect</b><small>Connect. Copy. Control.</small></span></a><nav class="nav-links">${!portal ? navHtml : ''}</nav><div class="nav-cta actions" style="margin:0">${authActions}</div></div></header>${worldClockMarkup()}${portal ? `<div class="app-shell"><aside class="side">${navHtml}</aside><main class="main">${body}</main></div>` : body}<footer class="footer"><div class="container"><div class="grid2"><div><strong>Culture Coin / Wisdo Trading Command Center</strong><p>Premium bot control, MT4/MT5 bridge, Culture Coin Reporter, Discord commands, and subscription-gated trade copying.</p><div class="trust-strip"><a class="chip" href="/pricing">Plans</a><a class="chip" href="/faq">Risk FAQ</a><a class="chip" href="/contact">Support</a><a class="chip" href="/app/reporter">Reporter</a></div></div><div><p><strong>Risk disclosure:</strong> Trading involves substantial risk. This software does not guarantee profits, prevent losses, or provide financial advice. Copier access is blocked unless membership checks pass on the backend.</p><p class="muted">Reporter access can stay visible, but trade copying requires active membership, copier enabled, confirmation for dangerous commands, and a connected trading account.</p></div></div></div></footer>${siteScript()}${portal ? presenceAwarenessClient() : ''}</body></html>`;
}

function sectionHead(eyebrow, title, copy) {
  return `<div class="section-head"><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2><p class="lead">${esc(copy)}</p></div>`;
}

function tcDashboardVisual() {
  return `<div class="tc-dash-wrap"><div class="tc-dashboard"><div class="tc-dashboard-shell"><div class="tc-side"><div class="active">Dashboard</div><div>Copier Engine</div><div>Accounts</div><div>Trades</div><div>Performance</div><div>Seminar</div></div><div><div class="tc-mini-grid"><div class="tc-mini"><span>Portfolio Value</span><strong>$2,266,367</strong></div><div class="tc-mini"><span>Masters</span><strong>1</strong></div><div class="tc-mini"><span>Followers</span><strong>8</strong></div><div class="tc-mini"><span>Open Positions</span><strong>19</strong></div></div><div class="tc-table-card"><h3>Copier Engine</h3><table class="tc-table"><thead><tr><th>Account</th><th>Copy From</th><th>Risk</th><th>Status</th></tr></thead><tbody><tr><td>5205295 • Coinexx</td><td>Wisdo Master</td><td>Auto Governor</td><td><span class="tc-status">Active</span></td></tr><tr><td>5217952 • Coinexx</td><td>Community Reporter</td><td>Equity Ratio</td><td><span class="tc-status">Ready</span></td></tr><tr><td>Mobile Desk</td><td>Selected Account</td><td>Close All Guard</td><td><span class="tc-status">Confirmation</span></td></tr></tbody></table></div></div></div></div><div class="tc-phone"><div class="tc-phone-screen"><span class="tc-kicker">Mobile</span><h3>Performance</h3><div class="tc-gauge"><b>14.8%</b></div><div class="tc-mini"><span>Equity</span><strong>$92,435</strong></div><div class="tc-mini" style="margin-top:10px"><span>Open Trades</span><strong>7</strong></div><div class="tc-spark" style="margin-top:12px"></div><span class="tc-status" style="margin-top:14px">AI Analysis • Bullish</span></div></div></div>`;
}

function tcMarquee() {
  const names = ['MetaTrader 4','MetaTrader 5','cTrader','Match Trader','TradeLocker','DXtrade','NinjaTrader','Tradovate','ProjectX','Rithmic'];
  const row = names.concat(names).map((n) => `<span>${esc(n)}</span>`).join('');
  return `<section class="tc-marquee"><div class="container"><p class="tc-micro" style="text-align:center;text-transform:uppercase;letter-spacing:.2em">Our Supported Platforms</p><div class="tc-track">${row}</div></div></section>`;
}

function tcStatsBar() {
  return `<section class="tc-stats"><div class="tc-stat"><strong>20ms</strong><span>Avg copy speed</span></div><div class="tc-stat"><strong>100M+</strong><span>Trades copied vision</span></div><div class="tc-stat"><strong>99.9%</strong><span>Uptime target</span></div><div class="tc-stat"><strong>Live</strong><span>Trusted by traders</span></div></section>`;
}

function tcFeatureCards() {
  const cards = [
    ['↔','TC COPIER','Instantly mirror trades from master to follower accounts with flexible risk settings.','Choose fixed lot, multiplier, equity allocation, symbol mapping, trading hours, confirmations, and account-level relay controls.','/copier'],
    ['〽','TC ANALYZER','Connect all accounts and get a complete picture of trading results.','View ROI, win rate, drawdown, open exposure, pair strength, and account health across the whole desk.','/analyzer'],
    ['⚖','TC COMPARE','Find the right broker, prop firm, or account environment for your goals.','Compare drawdown limits, payout rules, refund policies, platforms, and supported copier routes side by side.','/compare'],
  ];
  return `<section class="tc-section"><div class="container"><span class="tc-kicker">Wisdo Connect</span><h2 class="tc-title">We built to reduce complexity in modern trading and support smarter decisions</h2><div class="tc-features">${cards.map(([icon,tag,title,copy,href])=>`<article class="tc-card"><div class="tc-icon">${icon}</div><p class="tc-micro">${tag}</p><h3>${esc(title)}</h3><p class="tc-copy">${esc(copy)}</p><a class="btn" href="${href}">Learn more →</a></article>`).join('')}</div></div></section>`;
}

function tcOrbitalSection() {
  return `<section class="tc-section" style="background:oklch(0.22 0.025 190 / 20%);border-top:1px solid var(--tc-border);border-bottom:1px solid var(--tc-border)"><div class="container"><div style="text-align:center;max-width:900px;margin:0 auto"><span class="tc-kicker">Command Network</span><h2 class="tc-title">Every account, every strategy, every insight — <em>all connected</em>, all in one place</h2></div><div class="tc-orbit"><div class="ring"></div><div class="ring"></div><div class="ring"></div><div class="ring"></div><div class="ring"></div><div class="core">Wisdo</div><i class="tc-dot" style="transform:translate(155px,-18px)"></i><i class="tc-dot" style="transform:translate(-205px,32px)"></i><i class="tc-dot" style="transform:translate(64px,196px)"></i><i class="tc-dot" style="transform:translate(-76px,-142px)"></i><i class="tc-dot" style="transform:translate(236px,118px)"></i><i class="tc-dot" style="transform:translate(-246px,-118px)"></i></div></div></section>`;
}

function tcToolsGrid() {
  const tools = [
    ['🌐','Portfolio Visibility','360°','View performance across all linked accounts in one place'],
    ['📈','Execution Reliability','99.9%','Cloud-optimized infrastructure for copier execution and data sync'],
    ['🧱','Automation Coverage','80%','Automate copying, analytics, alerts, and routine desk tasks'],
    ['⏱','Risk & Consistency','24/7','Continuous monitoring across sessions and account health states'],
    ['🛡','Smart Copier','5 layers','Equity protection, trading hours, symbol filters, confirmations, and account gates'],
    ['🔔','Real-Time Alerts','0 delay','Instant notifications for drawdown, trades, and command completion'],
    ['〽','Analyzer Insights','45%','Improve strategy consistency through better data tracking'],
    ['⚖','Comparison Engine','50+','Compare brokers and prop firms side by side'],
    ['⚡','Multi-Account ROI','Live','Aggregate ROI across connected accounts in real time'],
    ['🔒','Secure Infrastructure','100%','Confirmation-required dangerous commands and scoped account queues'],
  ];
  return `<section class="tc-section"><div class="container"><div class="tc-product-grid"><div><span class="tc-kicker">Smarter trading starts with smarter tools</span><h2 class="tc-title">A live command center for copier control, account health, and growth.</h2></div><div style="text-align:right"><a class="btn primary" href="/pricing">See plans →</a></div></div><div class="tc-tools">${tools.map(([i,l,v,d])=>`<div class="tc-tool"><div class="tc-icon">${i}</div><span>${esc(l)}</span><strong>${esc(v)}</strong><p class="tc-micro">${esc(d)}</p></div>`).join('')}</div></div></section>`;
}

function tcLandingPricingTeaser() {
  return `<section class="tc-section" style="background:oklch(0.22 0.025 190 / 20%);border-top:1px solid var(--tc-border);border-bottom:1px solid var(--tc-border)"><div class="container"><div style="text-align:center;max-width:820px;margin:0 auto 28px"><span class="tc-kicker">Simple. Transparent. Flexible.</span><h2 class="tc-title">Pricing built to scale with your trading journey</h2></div>${tcPricingCards()}<p class="tc-micro" style="text-align:center;margin-top:22px">★★★★★ Excellent · secure checkout · risk-controlled command flow</p></div></section>`;
}

function tcPricingCards() {
  const plans = [
    ['standard','Standard','CFD','Flexible · From $10/mo',['Ideal for retail traders','Equity Protection','No limits — pay per account'],'/pricing'],
    ['premium','Premium','CFD PRO','Ultra-low latency · $15/mo',['Everything in Standard','Ideal for advanced traders','Low latency + HFT support','Priority support','Premium notifications coming soon'],'/pricing'],
    ['futures','Futures','FUTURES','10-day trial · From $30/mo',['Built-in 10-day free trial','Tiered or flat-price plans','Scale futures accounts anytime'],'/pricing'],
  ];
  return `<div class="tc-prices">${plans.map(([id,name,tag,price,features,href])=>`<article class="tc-price ${id==='premium'?'popular':''}">${id==='premium'?'<span class="tc-status">Most Popular</span>':''}<p class="tc-micro">${tag}</p><h3>${name}</h3><div class="amount">${price}</div><ul class="tc-list">${features.map(f=>`<li>${esc(f)}</li>`).join('')}</ul><a class="btn primary" href="${href}">Get started →</a></article>`).join('')}</div>`;
}

function tcLandingFaqTeaser() {
  return `<section class="tc-section"><div class="container"><div style="text-align:center"><span class="tc-kicker">Pricing questions</span><h2 class="tc-title">Frequently asked questions</h2></div>${tcFaqItems(true)}</div></section>`;
}

function tcFaqItems(firstOpen = false) {
  const items = [
    ['Can I switch plans later?','Yes. Upgrade, downgrade, or change billing cycles from the billing dashboard. Changes apply on your next billing date.'],
    ['What happens after the free trial?','You move to the selected plan automatically. Cancel before the trial ends and you will not be charged.'],
    ['Do you offer refunds?','New subscriptions can use the satisfaction review window listed in billing and support.'],
    ['Is there a setup fee?','No forced setup fee. Guided setup and activation offers can be sold separately.'],
    ['What payment methods do you accept?','Square hosted checkout displays the eligible payment methods enabled for your Square account, region, and the customer device.'],
    ['Can I cancel anytime?','Yes. Cancellation is handled through the billing portal, and copier permissions follow membership state.'],
  ];
  return `<div class="tc-faq">${items.map(([q,a],idx)=>`<details ${idx===0&&firstOpen?'open':''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>`;
}

function tcLandingPage() {
  return `<main class="tc-page"><section class="tc-hero"><div class="tc-rays"><i></i><i></i><i></i><i></i><i></i></div><div class="container"><div class="tc-hero-grid"><div><span class="tc-kicker">Connect • Copy • Control • Smarter</span><h1 class="tc-display">One intelligent platform for your <em>trading journey</em></h1></div><div style="padding-top:42px"><p class="tc-copy">Connect your trading accounts, mirror proven strategies with precision, control MT4/MT5 from the web and Discord, and track performance across every account — instantly.</p><div class="actions"><a class="btn primary" href="/pricing">See plans →</a><a class="btn" href="/copier">Explore</a><a class="btn" href="/app/dashboard" data-launch>Open Dashboard</a></div><p class="tc-micro">Start free today · Cancel anytime · Confirmation guard for dangerous commands</p></div></div>${tcDashboardVisual()}</div></section>${tcMarquee()}${tcStatsBar()}${tcFeatureCards()}${tcOrbitalSection()}${tcToolsGrid()}${tcLandingPricingTeaser()}${tcLandingFaqTeaser()}</main>`;
}

function tcProductPage(kind) {
  const map = {
    copier: ['TC Copier','Connect. Copy. Control.','Mirror trades across accounts with account selectors, mobile close-all controls, symbol mapping, confirmation prompts, and active-member gates.',['Master → follower mapping','Risk by multiplier, fixed lot, equity ratio, balance ratio','Mobile account dropdown and close all','Confirmation-required emergency commands','MT4 reporter poll + command completion status']],
    analyzer: ['WISDO Insight Engine','Know the health of every account.','Track equity, drawdown, open exposure, symbols, session behavior, and command history from one dashboard.',['Portfolio ROI and equity curve','Win rate, drawdown, open risk','Symbol heatmap and session heatmap','Per-account health states: red, orange, blue, green, gold','Exportable trade logs']],
    compare: ['TC Compare','Choose the right trading environment.','Compare brokers, prop rules, supported platforms, drawdown limits, payout rules, and copier compatibility.',['Broker and prop firm comparison','Supported platform filters','Drawdown and payout tables','Refund and rule notes','Best-fit account environment checklist']],
  };
  const [label,title,copy,features] = map[kind] || map.copier;
  return `<main class="tc-page"><section class="tc-product-hero"><div class="container tc-product-grid"><div><span class="tc-kicker">${esc(label)}</span><h1 class="tc-display">${esc(title)}</h1><p class="tc-copy">${esc(copy)}</p><div class="actions"><a class="btn primary" href="/pricing">See plans →</a><a class="btn" href="/app/dashboard" data-launch>Open dashboard</a></div></div><div class="tc-card"><h3>Included Modules</h3><ul class="tc-list">${features.map(f=>`<li>${esc(f)}</li>`).join('')}</ul></div></div></section>${kind==='compare'?tcCompareInteractive():tcProductDeepDive(kind)}</main>`;
}

function tcProductDeepDive(kind) {
  const cards = kind === 'analyzer'
    ? [['Account Health','Balance, equity, floating P/L, margin level, and drawdown state.'],['Performance','ROI, win rate, strongest pairs, weakest pairs, and session timing.'],['Alerts','Trade opens, closes, drawdown, command completion, and account disconnection.']]
    : [['Account Selector','Users can switch through all accounts connected to their desk from desktop or mobile.'],['Relay Rules','Leader/follower routes support risk, symbol aliasing, trading hours, and active reporter discovery.'],['Command Queue','Website and Discord actions queue real MT4 commands and wait for Reporter polling.']];
  return `<section class="tc-section"><div class="container"><span class="tc-kicker">Product Layer</span><h2 class="tc-title">Built for live use, not demo buttons.</h2><div class="tc-features">${cards.map(([t,c])=>`<article class="tc-card"><div class="tc-icon">✓</div><h3>${esc(t)}</h3><p class="tc-copy">${esc(c)}</p></article>`).join('')}</div></div></section>`;
}

function tcCompareInteractive() {
  const firms = [['Coinexx Demo','Broker','MT4/MT5','Flexible leverage'],['Prop Firm A','Prop','MT5','Daily drawdown rules'],['Futures Desk','Futures','Tradovate','Trial + scale tiers']];
  return `<section class="tc-section"><div class="container"><span class="tc-kicker">Interactive Comparison</span><h2 class="tc-title">Broker and funding environment shortlist</h2><div class="tc-compare-grid">${firms.map(([n,t,p,r])=>`<div class="tc-compare-card"><h3>${esc(n)}</h3><p class="tc-micro">${esc(t)} • ${esc(p)}</p><p class="tc-copy">${esc(r)}</p><span class="tc-status">Compare</span></div>`).join('')}</div></div></section>`;
}

function tcPricingPage() {
  return `<main class="tc-page"><section class="tc-product-hero"><div class="container"><div style="text-align:center;max-width:900px;margin:0 auto"><span class="tc-kicker">Pricing Configurator</span><h1 class="tc-display">Transparent pricing built to scale with your trading journey</h1><p class="tc-copy" style="margin-left:auto;margin-right:auto">Choose CFD or futures, account quantity, billing cycle, analyzer add-on, and dedicated environment options.</p></div></div></section><section class="tc-section"><div class="container">${tcPricingCards()}<div class="tc-card" style="margin-top:22px"><h3>Live Price Configurator</h3><div class="tc-config"><label>Product<select id="tcProduct"><option value="cfd">CFD</option><option value="futures">Futures</option></select></label><label>Plan<select id="tcPlan"><option value="standard">Standard</option><option value="premium" selected>Premium</option></select></label><label>Accounts<input id="tcQty" type="number" min="1" max="100" value="1"></label><label>Billing<select id="tcCycle"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="semiannual">Semiannual</option><option value="annual">Annual</option></select></label><label>Analyzer Add-on<select id="tcAnalyzer"><option value="0">No</option><option value="1">Yes</option></select></label><label>Dedicated Environment<select id="tcEnv"><option value="0">No</option><option value="1">Yes</option></select></label></div><div style="margin-top:18px"><span class="tc-micro">Estimated total</span><div class="tc-total" id="tcTotal">$15/mo</div><p class="tc-micro" id="tcBreakdown">Premium · 1 account · monthly</p></div><a class="btn primary" href="/offer">Continue to checkout →</a></div></div></section><script>(function(){function g(id){return document.getElementById(id)}function calc(){var product=g('tcProduct').value,plan=g('tcPlan').value,qty=Number(g('tcQty').value||1),cycle=g('tcCycle').value,an=g('tcAnalyzer').value==='1',env=g('tcEnv').value==='1';var base=product==='futures'?3000:(plan==='premium'?1500:1000);var months={monthly:1,quarterly:3,semiannual:5,annual:10}[cycle]||1;var addons=(an?2999:0)+(env?3000:0);var total=(base*qty+addons)*months;g('tcTotal').textContent='$'+(total/100).toLocaleString()+'/'+(cycle==='monthly'?'mo':'cycle');g('tcBreakdown').textContent=(product==='futures'?'Futures':plan)+' · '+qty+' account(s) · '+cycle+(an?' · Analyzer':'')+(env?' · Dedicated env':'')}['tcProduct','tcPlan','tcQty','tcCycle','tcAnalyzer','tcEnv'].forEach(function(id){g(id).addEventListener('input',calc);g(id).addEventListener('change',calc)});calc();})();</script>${tcLandingFaqTeaser()}</main>`;
}

function tcFaqPage() {
  return `<main class="tc-page"><section class="tc-product-hero"><div class="container" style="text-align:center"><span class="tc-kicker">FAQ</span><h1 class="tc-display">Pricing questions</h1><p class="tc-copy" style="margin-left:auto;margin-right:auto">Clear answers for membership, copier access, confirmation prompts, setup fees, and cancellation.</p></div></section><section class="tc-section"><div class="container">${tcFaqItems(true)}</div></section></main>`;
}

function legalPage(kind) {
  const titles = { terms:'Terms of Use', privacy:'Privacy Policy', risk:'Risk Disclosure' };
  const copy = kind === 'risk'
    ? 'Trading foreign exchange, futures, CFDs, and automated strategies involves substantial risk of loss. Wisdo is a command and education platform, not financial advice, and does not guarantee profits or prevent losses.'
    : kind === 'privacy'
      ? 'Wisdo should store only the account, billing, and connection data required to operate the service. Broker credentials must be encrypted and never exposed to the browser.'
      : 'Use of Wisdo requires safe command behavior, account-owner authorization, confirmation of dangerous actions, and compliance with broker/platform rules.';
  return `<main class="tc-page"><section class="tc-product-hero"><div class="container"><span class="tc-kicker">Legal</span><h1 class="tc-display">${esc(titles[kind] || titles.terms)}</h1><p class="tc-copy">${esc(copy)}</p><div class="tc-card"><h3>Important</h3><p class="tc-copy">This is a product-ready placeholder. Replace it with attorney-reviewed final language before launch.</p></div></div></section></main>`;
}

function homePage() {
  return `<main><section class="hero"><div class="container hero-grid"><div><span class="eyebrow">MT4/MT5 • Discord • Risk Control</span><h1>Run your trading bots from one live command center.</h1><p class="lead">Culture Coin / Deadshot connects webinar onboarding, paid memberships, Discord login, MT4/MT5 account connection, Culture Coin Reporter, trade copier access, bot controls, and emergency risk commands into one clean premium platform.</p><div class="actions"><a class="btn primary" href="/tunnel">Enter The Tunnel</a><a class="btn gold" href="/webinar/register">Watch Webinar</a><a class="btn" href="/app/dashboard" data-launch>Open Dashboard</a></div><div class="trust-strip"><span class="chip green">Live equity tracking</span><span class="chip">Discord command console</span><span class="chip gold">Membership-gated copier</span><span class="chip">Square checkout ready</span></div></div><div class="card preview glow">${dashboardPreview()}</div></div></section><section class="section"><div class="container">${sectionHead('Problem', 'Bots are powerful, but scattered control is dangerous.', 'A trader should not need to jump between Discord, MT4, payment tools, spreadsheets, and random web pages just to know if they are active, safe, connected, or allowed to copy trades.')}<div class="grid"><div class="card red"><h3>Invisible risk</h3><p>Drawdown, margin level, open trades, and copier permissions need to be visible before anyone touches live execution.</p></div><div class="card purple"><h3>Disconnected commands</h3><p>Discord commands need status, audit history, and backend permission checks.</p></div><div class="card gold"><h3>Membership confusion</h3><p>Paid website subscription or manually granted Discord role can activate Culture Coin access, but inactive users must never copy trades.</p></div></div></div></section><section class="section"><div class="container">${sectionHead('Solution', 'A premium trading operator desk.', 'The public site sells through the webinar funnel. The member portal controls accounts, reporter access, subscriptions, copier gates, and bot operations. The admin desk controls users, payments, licenses, leads, and access.')}<div class="grid4"><div class="card"><h3>Reporter for everyone</h3><p>Free and inactive users still receive market alerts, bot commentary, trade ideas, and risk warnings.</p></div><div class="card glow"><h3>Copier only for active members</h3><p>Every copy action checks auth, subscription/role, copier enablement, and account connection before execution.</p></div><div class="card purple"><h3>Command launch animation</h3><p>Successful login and connection events trigger an original Culture Coin command-ship launch sequence.</p></div><div class="card gold"><h3>Square subscriptions</h3><p>Recurring memberships, one-time products, hosted checkout, in-app subscription controls, and signed Square webhook syncing.</p></div></div></div></section>${pricingSection()}<section class="section"><div class="container">${sectionHead('Dashboard first', 'Built to feel alive.', 'Live gauges, bot status pulse, command console, reporter cards, emergency buttons, and locked/upgrade states give users clarity without copying any other brand.')}<div class="feature-row"><div class="card preview">${dashboardPreview(true)}</div><div class="card purple"><span class="eyebrow">Connection Flow</span><h3>Command Launch lights up only after checks pass.</h3><div class="subtle-divider"></div><div class="mini-stat"><span>Authentication</span><strong>Required</strong></div><div class="mini-stat"><span>Membership</span><strong>Square or Discord role</strong></div><div class="mini-stat"><span>Reporter</span><strong>Always visible after login</strong></div><div class="mini-stat"><span>Trade copier</span><strong>Backend gated</strong></div></div></div></div></section></main>`;
}

function dashboardPreview(full = false, liveData = null, membership = null, accountConfig = {}) {
  const metrics = liveData?.metrics || { equity: 4283.19, balance: 4500, floatingPL: -216.81, drawdownPercent: 11.2, openTradeCount: 4, buyTradeCount: 2, sellTradeCount: 2 };
  const isLive = Boolean(liveData?.live);
  const goal = dailyGoalProgress(liveData || { metrics }, accountConfig) || (isLive ? 0 : 68);
  const drawdownWidth = Math.max(0, Math.min(100, Number(metrics.drawdownPercent || 0) * 3.4));
  const symbols = (metrics.symbols || []).slice(0, 4);
  return `<div class="terminal-top"><div><span class="eyebrow">${isLive ? 'Live Command Center' : 'Preview Command Center'}</span><h3 style="margin:10px 0 0">Deadshot Live Desk</h3></div><span class="pulse"><i></i> ${isLive ? (liveData.stale ? 'Stale Bridge' : 'Live Bridge') : 'Preview'}</span></div><div class="grid2"><div class="card"><p class="muted">Equity</p><div class="metric ${Number(metrics.equity) >= Number(metrics.balance) ? 'green' : 'gold'}">${money(metrics.equity)}</div><div class="gauge"><span style="width:${Math.max(3, Math.min(100, goal))}%"></span></div></div><div class="card danger-zone"><p class="muted">Floating P/L</p><div class="metric ${Number(metrics.floatingPL) >= 0 ? 'green' : 'red'}">${fmtSignedMoney(metrics.floatingPL)}</div><div class="gauge"><span style="width:${drawdownWidth || 4}%;background:linear-gradient(90deg,var(--orange),var(--red))"></span></div></div></div><div class="chart" style="margin:16px 0"><div class="chart-status">Equity growth animation</div><div class="chart-spark"></div><span style="height:${20 + Math.min(60, goal)}%"></span><span style="height:${35 + Math.min(45, Number(metrics.openTradeCount || 0) * 7)}%"></span><span style="height:${25 + Math.min(50, Math.abs(Number(metrics.floatingPL || 0)) / 8)}%"></span><span style="height:${40 + Math.min(50, Number(metrics.marginLevel || 0) / 20)}%"></span></div><div class="grid4"><div class="card"><h3>Open Trades</h3><span class="tag">${Number(metrics.openTradeCount || 0)}</span></div><div class="card"><h3>Reporter</h3><span class="tag">Live</span></div><div class="card"><h3>Copier</h3><span class="tag">${membership?.canCopyTrades ? 'Unlocked' : 'Gated'}</span></div><div class="card"><h3>Symbols</h3><span class="tag">${symbols.length ? esc(symbols.join(', ')) : 'Waiting'}</span></div></div>${full ? `<div class="actions"><button class="btn danger ${membership?.canCopyTrades ? '' : 'locked'}" data-copy-action="close_all">Close All</button><button class="btn ${membership?.canCopyTrades ? '' : 'locked'}" data-copy-action="close_profitable">Close Profitable</button><button class="btn gold ${membership?.canCopyTrades ? '' : 'locked'}" data-copy-action="pause_copier">Pause Bot</button><button class="btn primary ${membership?.canCopyTrades ? '' : 'locked'}" data-copy-action="resume_copier">Resume</button></div>` : ''}`;
}

function pricingSection() {
  const cards = PRODUCTS.filter((p) => ['free-reporter','culture-coin-monthly','vip-command-center'].includes(p.id)).map(productCard).join('');
  return `<section class="section"><div class="container">${sectionHead('Pricing', 'Choose your command level.', 'Start with the free reporter, unlock Culture Coin trade copying, or upgrade into the full VIP command center.')}<div class="grid">${cards}</div></div></section>`;
}

function productCard(p) {
  const price = p.price === 0 ? 'Free' : `${money(p.price)}${p.interval ? `/${p.interval === 'month' ? 'mo' : 'yr'}` : ''}`;
  return `<div class="card ${p.id.includes('monthly') ? 'glow' : p.id.includes('vip') ? 'purple' : ''}"><span class="tag">${esc(p.badge)}</span><h3>${esc(p.name)}</h3><div class="metric ${p.price ? 'green' : ''}">${price}</div><p>${esc(p.description)}</p><ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>${p.mode === 'free' ? '<a class="btn" href="/signup">Create Free Account</a>' : `<button class="btn primary" data-checkout="${esc(p.id)}">Start Checkout</button>`}</div>`;
}

function tunnelPage() {
  return `<main><section class="hero"><div class="container hero-grid"><div><span class="eyebrow">Trading On Automatic Tunnel</span><h1>See the command center before you connect a live account.</h1><p class="lead">This funnel educates users first: what the reporter does, what copier access unlocks, how membership controls permissions, and how Deadshot protects trading actions behind real account checks.</p><div class="actions"><a class="btn primary" href="/webinar/register">Register For Webinar</a><a class="btn" href="/webinar/replay">Watch Replay</a></div></div><div class="card gold"><h3>What the webinar covers</h3><p>Reporter alerts, active member gates, Discord commands, MT4/MT5 bridge connection, emergency close controls, and the difference between seeing reports and copying trades.</p><div class="trust-strip"><span class="chip green">No fake profit claims</span><span class="chip gold">Clear risk rules</span><span class="chip">Beginner friendly</span></div></div></div></section><section class="section"><div class="container"><div class="grid"><div class="card"><h3>1. Learn</h3><p>Understand the reporter, dashboard, risk controls, and copier rules.</p></div><div class="card"><h3>2. Activate</h3><p>Subscribe on the website or receive the Discord Culture Coin role manually.</p></div><div class="card"><h3>3. Launch</h3><p>Connect Discord, connect the bridge, then unlock controls only after real checks pass.</p></div></div></div></section></main>`;
}

function attributionInputs(req = {}, defaults = {}) {
  const query = req.query || {};
  const fields = {
    source: query.utm_source || query.source || defaults.source || 'website',
    medium: query.utm_medium || query.medium || defaults.medium || '',
    campaign: query.utm_campaign || query.campaign || defaults.campaign || 'wisdo-growth',
    content: query.utm_content || query.content || defaults.content || '',
    term: query.utm_term || query.term || defaults.term || '',
    referralCode: query.ref || query.referralCode || defaults.referralCode || '',
    landingPath: req.originalUrl || defaults.landingPath || '',
  };
  return Object.entries(fields).map(([name, value]) => `<input type="hidden" name="${name}" value="${esc(value)}">`).join('');
}

function webinarRegistrationPage(req = {}) {
  return `<main><section class="hero"><div class="container hero-grid"><div><span class="eyebrow">Free Command Webinar</span><h1>Build control before you scale automation.</h1><p class="lead">Register to receive a personal learning room with the command webinar, setup links, teaching videos, and a portable WISDO AI guide that follows your progress across the funnel.</p><div class="trust-strip"><span class="chip green">Instant email confirmation</span><span class="chip">Optional text confirmation</span><span class="chip gold">No profit guarantees</span></div></div><form class="card form" method="post" action="/api/leads">${attributionInputs(req,{source:'webinar',campaign:'wisdo-command-webinar'})}<div class="field"><label>Name</label><input name="name" required placeholder="Your name"></div><div class="field"><label>Email</label><input type="email" name="email" required placeholder="you@example.com"></div><div class="field"><label>Phone optional</label><input name="phone" inputmode="tel" autocomplete="tel" placeholder="(555) 555-5555"></div><div class="field"><label>Trading platform</label><select name="platform"><option>MT4</option><option>MT5</option><option>Both</option><option>Not sure yet</option></select></div><label class="field" style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" name="smsConsent" value="true" style="width:auto;margin-top:4px"><span>Text me my registration confirmation and setup link. Message and data rates may apply. Reply STOP to opt out.</span></label><label class="field" style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" name="marketingConsent" value="true" style="width:auto;margin-top:4px"><span>Send me the four-part WISDO education series with Reporter setup, copier safety, videos, and AI-guided next steps. I can unsubscribe anytime.</span></label><label aria-hidden="true" style="position:absolute;left:-9999px"><span>Website</span><input name="companyWebsite" tabindex="-1" autocomplete="off"></label><button class="btn primary" type="submit">Reserve My Seat</button><p class="muted">The registration email is transactional. SMS is sent only when a valid phone number and explicit consent are provided.</p></form></div></section><script>fetch('/api/funnel/visit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path:location.pathname+location.search,referrer:document.referrer,userAgent:navigator.userAgent,source:new URLSearchParams(location.search).get('utm_source')||'webinar',medium:new URLSearchParams(location.search).get('utm_medium')||'',campaign:new URLSearchParams(location.search).get('utm_campaign')||'wisdo-command-webinar',content:new URLSearchParams(location.search).get('utm_content')||'',term:new URLSearchParams(location.search).get('utm_term')||'',referralCode:new URLSearchParams(location.search).get('ref')||''})}).catch(()=>{});</script></main>`;
}

function growthFunnelPage(req = {}) {
  return `<main><section class="hero"><div class="container hero-grid"><div><span class="eyebrow">WISDO Free Operator Starter</span><h1>Connect your first account with control.</h1><p class="lead">Get a personal command-center learning room, emailed webinars, Reporter setup information, copier-safety videos, and a portable WISDO AI guide.</p><div class="actions"><a class="btn" href="/webinar/replay">Preview Training</a><a class="btn gold" href="/pricing">Compare Access</a></div><div class="trust-strip"><span class="chip green">Personal learning room</span><span class="chip">Tracked referral credit</span><span class="chip gold">Optional SMS</span></div></div><form class="card form" method="post" action="/api/funnel/leads">${attributionInputs(req,{source:'growth-page',campaign:'1000-lead-engine'})}<div class="field"><label>Name</label><input name="name" required></div><div class="field"><label>Email</label><input type="email" name="email" required></div><div class="field"><label>Phone optional</label><input name="phone" inputmode="tel" autocomplete="tel"></div><div class="field"><label>Platform</label><select name="platform"><option>MT4</option><option>MT5</option><option>Both</option><option>Learning first</option></select></div><label class="field" style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" name="smsConsent" value="true" style="width:auto;margin-top:4px"><span>Send my access link by text. Message and data rates may apply. Reply STOP to opt out.</span></label><label class="field" style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" name="marketingConsent" value="true" checked style="width:auto;margin-top:4px"><span>Send training and product follow-up by email.</span></label><label aria-hidden="true" style="position:absolute;left:-9999px"><span>Website</span><input name="companyWebsite" tabindex="-1" autocomplete="off"></label><button class="btn primary" type="submit">Get Free Access</button><p class="muted">Monthly lead volume depends on traffic and conversion rate. The dashboard tracks progress toward the configured 1,000-lead target.</p></form></div></section><section class="section"><div class="container"><div class="grid"><div class="card"><h3>1. Capture</h3><p>Landing pages preserve source, campaign, referral code, and UTM attribution.</p></div><div class="card"><h3>2. Confirm</h3><p>Signup and lead confirmations send through Resend and optional consent-based Twilio SMS.</p></div><div class="card"><h3>3. Convert</h3><p>Webinar, free Reporter access, membership, and affiliate links move each lead to the next measurable stage.</p></div></div></div></section><script>fetch('/api/funnel/visit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path:location.pathname+location.search,referrer:document.referrer,userAgent:navigator.userAgent,source:new URLSearchParams(location.search).get('utm_source')||'direct',medium:new URLSearchParams(location.search).get('utm_medium')||'',campaign:new URLSearchParams(location.search).get('utm_campaign')||'1000-lead-engine',content:new URLSearchParams(location.search).get('utm_content')||'',term:new URLSearchParams(location.search).get('utm_term')||'',referralCode:new URLSearchParams(location.search).get('ref')||''})}).catch(()=>{});</script></main>`;
}

function webinarReplayPage() {
  const modules = [
    ['Account Relay Basics', 'How a selected desk account becomes the only command target for website buttons, mobile close-all, Discord wake words, and MT4 reporter polling.'],
    ['Reporter vs Copier', 'Reporter reads and educates. Copier relays only after membership, account ownership/share, and active account checks pass.'],
    ['Automatic Relay Setup', 'Create Culture Lanes, choose lead/receiver accounts, apply risk dials, protect equity, and pause/resume per lane.'],
    ['Mobile Operator Desk', 'Switch account, close profits, close all selected trades, pause relay, and verify completion from a phone.'],
    ['Risk Protection', 'Max lot, max open trades, drawdown caps, equity floor, symbol allowlist, copied SL/TP, and pending-order controls.'],
    ['Affiliate Activation', 'Sign up, pay activation today, receive a referral code, and track earned split payouts from real checkout metadata.'],
  ];
  return `<main><section class="section"><div class="container">${sectionHead('Wisdo Seminar + Education Portal', 'Connect. Copy. Control.', 'The replay page is no longer a placeholder. It now explains how the live ecosystem should connect accounts, relay commands, educate users, and convert members without fake demo promises.')}<div class="grid2"><div class="card glow"><span class="eyebrow">Seminar Room</span><h3>Launch Training Flow</h3><p class="muted">Use this section for the recorded/live class, onboarding checklist, and account-relay walkthrough. The CTA sends users into paid activation or the free reporter path.</p><div class="command-diagnostics"><div class="mini-stat"><span>Step 1</span><strong>Create profile</strong></div><div class="mini-stat"><span>Step 2</span><strong>Pay/role activate</strong></div><div class="mini-stat"><span>Step 3</span><strong>Pair MT4 reporter</strong></div><div class="mini-stat"><span>Step 4</span><strong>Select relay account</strong></div></div><div class="actions"><button class="btn primary" data-checkout="culture-coin-monthly">Activate Membership</button><a class="btn" href="/app/connect-account">Connect Reporter</a><a class="btn gold" href="/affiliate">Affiliate Signup</a></div></div><div class="card purple"><span class="eyebrow">Education Answers</span><h3>What Wisdo should teach automatically</h3><p>When a user asks about setup, risk, copier rules, live vs demo, broker suffixes, or why a command was blocked, the portal should answer using these modules and route them to the exact fix page.</p><div class="trust-strip"><span class="chip green">No demo command claims</span><span class="chip gold">Real account gates</span><span class="chip">Mobile-first</span></div></div></div><div class="grid" style="margin-top:16px">${modules.map(([title, body])=>`<div class="card"><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`).join('')}</div></div></section></main>`;
}

function leadLearningPortalPage({ lead = {}, access = {}, resources = [] } = {}) {
  const videos = resources.filter((item) => item.type === 'video');
  const cards = resources.map((item) => `<article class="card ${item.type === 'ai' ? 'purple' : item.type === 'webinar' ? 'glow' : ''}"><span class="tag">${esc(item.type || 'resource')}</span><h3>${esc(item.title || 'WISDO lesson')}</h3><p>${esc(item.description || '')}</p><div class="mini-stat"><span>Format</span><strong>${esc(item.duration || '')}</strong></div><a class="btn ${item.type === 'ai' ? 'gold' : 'primary'}" href="${esc(item.trackedUrl || item.href || '#')}">${item.type === 'ai' ? 'Open portable AI' : item.type === 'video' ? 'Open video' : 'Open lesson'}</a></article>`).join('');
  const tokenJson = JSON.stringify(access.token || '');
  return `<main><section class="hero"><div class="container hero-grid"><div><span class="eyebrow">Personal WISDO Learning Room</span><h1>${esc(lead.name ? `${lead.name}, your training path is ready.` : 'Your WISDO training path is ready.')}</h1><p class="lead">Your webinar, setup information, teaching videos, and portable WISDO AI guide are connected through this personal learning link.</p><div class="trust-strip"><span class="chip green">Personal resource link</span><span class="chip gold">Portable page-aware AI</span><span class="chip">Education before execution</span></div><div class="actions"><a class="btn primary" href="${esc(resources.find((item) => item.id === 'command-webinar')?.trackedUrl || '/webinar/replay')}">Start the webinar</a><button class="btn gold" type="button" onclick="document.querySelector('.wisdo-ai-launch')?.click()">Ask WISDO AI</button><a class="btn" href="/signup?leadToken=${encodeURIComponent(access.token || '')}">Create free account</a></div></div><div class="card glow"><span class="eyebrow">Your progress</span><h3>Learn → Test → Connect</h3><div class="command-diagnostics"><div class="mini-stat"><span>1</span><strong>Watch the command webinar</strong></div><div class="mini-stat"><span>2</span><strong>Review Reporter setup</strong></div><div class="mini-stat"><span>3</span><strong>Learn copier safety</strong></div><div class="mini-stat"><span>4</span><strong>Ask AI for your checklist</strong></div></div><p class="muted">Use demo accounts for first tests. The AI can teach and troubleshoot, but cannot execute trades or silently change copier settings.</p></div></div></section><section class="section"><div class="container">${sectionHead('Your training library', 'Webinars, videos, information, and AI in one place.', 'Every resource click and lesson completion helps WISDO understand where leads need more education.')}<div class="grid">${cards}</div></div></section>${videos.length ? `<section class="section"><div class="container">${sectionHead('Video classroom', 'Watch inside your learning room.', 'These visual lessons are tracked only for funnel progress and educational follow-up.')}<div class="grid2">${videos.map((video) => `<article class="card"><h3>${esc(video.title)}</h3><p>${esc(video.description)}</p><video controls playsinline preload="metadata" style="width:100%;border-radius:16px;background:#02050a" data-funnel-video="${esc(video.id)}"><source src="${esc(video.href)}" type="video/mp4"></video></article>`).join('')}</div></div></section>` : ''}<section class="section"><div class="container"><div class="card purple"><span class="eyebrow">Portable WISDO AI</span><h2>Carry the same learning context to every page.</h2><p>Open the floating <strong>W</strong> assistant on this page, the webinar, pricing, or education. Your personal lead token is stored in this browser so WISDO can remember your funnel stage and recommend the next safe lesson.</p><div class="actions"><button class="btn gold" type="button" onclick="document.querySelector('.wisdo-ai-launch')?.click()">Open WISDO AI</button><a class="btn" href="${esc(access.unsubscribeUrl || '#')}">Manage email training</a></div></div></div></section><script>(()=>{const token=${tokenJson};if(token){localStorage.setItem('wisdo.leadToken',token);}const send=(type,resourceId,metadata={})=>fetch('/api/funnel/engagement',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,type,resourceId,metadata})}).catch(()=>{});send('portal_open','personal-learning-room',{path:location.pathname});document.querySelectorAll('[data-funnel-video]').forEach((video)=>{let started=false;video.addEventListener('play',()=>{if(started)return;started=true;send('video_started',video.dataset.funnelVideo,{currentTime:video.currentTime});});video.addEventListener('ended',()=>send('video_completed',video.dataset.funnelVideo,{duration:video.duration}));});})();</script></main>`;
}

function affiliatePage() {
  return `<main><section class="hero"><div class="container hero-grid"><div><span class="eyebrow">Wisdo Affiliate Desk</span><h1>Sign up, activate today, and earn split payouts.</h1><p class="lead">Affiliates get a referral code after signup. The activation checkout carries affiliateId, referralCode, and splitPercent metadata into Square/manual invoices so payout ledgers can be reviewed.</p><div class="trust-strip"><span class="chip green">Activation due today</span><span class="chip gold">Default split configurable</span><span class="chip">Payout review ledger</span></div></div><form id="affiliateSignupForm" class="card form"><div class="field"><label>Name</label><input name="name" required></div><div class="field"><label>Email</label><input type="email" name="email" required></div><div class="field"><label>Phone</label><input name="phone"></div><div class="field"><label>Payout Handle</label><input name="payoutHandle" placeholder="Cash App / PayPal / business email"></div><div class="field"><label>Payout Split %</label><div class="range-row"><input type="range" min="10" max="80" value="30" name="splitPercent" oninput="this.nextElementSibling.value=this.value"><output>30</output></div></div><div class="field"><label>Activation Product</label><select name="activationProductId"><option value="setup-fee">One-Time Setup Fee</option><option value="culture-coin-monthly">Monthly Membership</option><option value="webinar-special">Webinar Special</option></select></div><button class="btn primary" type="submit">Create Affiliate + Pay Activation</button><pre class="live-out" id="affiliateSignupOut"></pre></form></div></section></main>`;
}

function offerPage() {
  return `<main><section class="hero"><div class="container hero-grid"><div><span class="eyebrow">Offer Stack</span><h1>Activate your Culture Coin operator desk.</h1><p class="lead">Pick a recurring membership, add one-time setup, then enter the command center. Square securely hosts checkout. Available payment methods are shown by Square based on your Square account, customer device, and region.</p><div class="actions"><button class="btn primary" data-checkout="culture-coin-monthly">Monthly Membership</button><button class="btn gold" data-checkout="setup-fee">Add Setup</button></div></div><div class="card purple"><h3>Included with active membership</h3><ul><li>Culture Coin Reporter</li><li>Trade copier access</li><li>Trading account connection</li><li>Bot controls</li><li>Discord command console</li><li>Risk controls</li><li>Trade history</li></ul></div></div></section></main>`;
}

function pricingPage() {
  return `<main><section class="section"><div class="container">${sectionHead('Plans', 'Reporter first. Copier only when active.', 'Free and inactive users can view reports and alerts. Active Culture Coin members can copy trades, connect accounts, use bot controls, and access risk settings.')}<div class="grid">${PRODUCTS.map(productCard).join('')}</div></div></section></main>`;
}

function loginPage(error = '') {
  return `<main><section class="hero"><div class="container hero-grid"><div><span class="eyebrow">Secure Login</span><h1>Enter the command center.</h1><p class="lead">Use email, Google, or Discord. After login, the Command Launch animation runs and waits for the real membership check before unlocking trade-copy controls.</p><div class="trust-strip"><span class="chip green">Secure sessions</span><span class="chip">Discord role sync</span><span class="chip gold">Square billing link</span></div>${error ? `<div class="card red"><strong>Login issue:</strong> ${esc(error)}</div>` : ''}</div><div class="card"><form class="form" method="post" action="/auth/email/login"><div class="field"><label>Email</label><input type="email" name="email" required></div><div class="field"><label>Password</label><input type="password" name="password" required></div><button class="btn primary" data-launch type="submit">Login</button></form><div class="actions"><a class="btn" href="/auth/google" data-launch>Continue with Google</a><a class="btn" href="/auth/discord" data-launch>Continue with Discord</a></div><p class="muted">No account yet? <a href="/signup">Create one.</a></p></div></div></section></main>`;
}

function signupPage(error = '') {
  return `<main><section class="hero"><div class="container hero-grid"><div><span class="eyebrow">Free Account</span><h1>Create your Culture Coin profile.</h1><p class="lead">Free users can view the Reporter and market alerts. Copier controls stay locked until active membership is confirmed by billing or Discord role.</p>${error ? `<div class="card red">${esc(error)}</div>` : ''}</div><form class="card form" method="post" action="/auth/email/signup"><input type="hidden" name="source" value="website-signup"><div class="field"><label>Name</label><input name="name" required></div><div class="field"><label>Email</label><input type="email" name="email" required></div><div class="field"><label>Phone optional</label><input name="phone" inputmode="tel" autocomplete="tel"></div><div class="field"><label>Password</label><input type="password" name="password" required minlength="8"></div><label class="field" style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" name="smsConsent" value="true" style="width:auto;margin-top:4px"><span>Text me my welcome and setup link. Message and data rates may apply. Reply STOP to opt out.</span></label><label class="field" style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" name="marketingConsent" value="true" style="width:auto;margin-top:4px"><span>Email me WISDO training and product updates.</span></label><button class="btn primary" data-launch type="submit">Create Account</button><p class="muted">A transactional welcome email is sent after signup. Text messages require a valid phone number and explicit consent.</p></form></div></section></main>`;
}

function faqPage() {
  const items = [
    ['Can free users see the Culture Coin Reporter?', 'Yes. Free and inactive users can see reports, alerts, bot commentary, market information, and upgrade prompts.'],
    ['Can inactive users copy trades?', 'No. Every copy action is blocked unless authentication, active subscription or Discord role, copier enablement, and account connection checks pass.'],
    ['Can Discord manually activate a member?', 'Yes. If the user has the configured Culture Coin Discord role, the website treats them as active even if the subscription did not originate on the website.'],
    ['Does the animation unlock access?', 'No. It is only a transition. Controls unlock only after the backend membership check succeeds.'],
    ['Which payment methods will Square show?', 'Square displays the payment methods enabled and eligible for your account, region, and the customer’s device during hosted checkout.'],
  ].map(([q,a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
  return `<main><section class="section"><div class="container">${sectionHead('FAQ', 'Clear rules build trust.', 'This platform separates information access from live execution access.')}<div class="faq">${items}</div></div></section></main>`;
}

function contactPage() {
  return `<main><section class="section"><div class="container">${sectionHead('Support', 'Need help connecting?', 'Submit a support request for billing, Discord role, MT4/MT5 bridge, reporter, or copier access.')}<form class="card form" method="post" action="/api/support/tickets"><div class="field"><label>Name</label><input name="name" required></div><div class="field"><label>Email</label><input type="email" name="email" required></div><div class="field"><label>Topic</label><select name="topic"><option>Billing</option><option>Discord role</option><option>MT4/MT5 bridge</option><option>Trade copier</option><option>Reporter</option></select></div><div class="field"><label>Message</label><textarea name="message" rows="5" required></textarea></div><button class="btn primary" type="submit">Send Ticket</button></form></div></section></main>`;
}

function successPage() {
  return `<main><section class="hero"><div class="container hero-grid"><div><span class="eyebrow">Payment Success</span><h1>Command Center activation received.</h1><p class="lead">Your billing event will sync membership through signed Square webhooks when the Square production settings are configured. Next, connect Discord and your trading bridge.</p><div class="actions"><a class="btn primary" href="/auth/success?provider=checkout">Launch Dashboard</a><a class="btn" href="/app/connect-account">Connect Trading Account</a></div></div><div class="card glow">${dashboardPreview()}</div></div></section></main>`;
}

function cancelPage() {
  return `<main><section class="hero"><div class="container"><span class="eyebrow">Checkout Cancelled</span><h1>No payment was completed.</h1><p class="lead">You can continue using Free Reporter Access and upgrade later.</p><div class="actions"><a class="btn primary" href="/pricing">Return To Pricing</a><a class="btn" href="/app/reporter">Open Reporter</a></div></div></section></main>`;
}


function pct(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function accountHealthState(liveData, accountConfig = {}) {
  const metrics = liveData?.metrics || {};
  const progress = dailyGoalProgress(liveData, accountConfig);
  const drawdown = Number(metrics.drawdownPercent || 0);
  const floating = Number(metrics.floatingPL || 0);
  const equity = Number(metrics.equity || 0);
  const balance = Number(metrics.balance || 0);
  if (!liveData?.live) return { key: 'gray', label: 'Reporter Not Linked', detail: 'Waiting for MT4/MT5 bridge snapshot', ring: 8, color: 'var(--muted)' };
  if (drawdown >= 10 || floating < 0) return { key: 'red', label: 'Drawdown Watch', detail: 'Drawdown/red protection state is active', ring: pct(100 - drawdown * 4, 20), color: 'var(--red)' };
  if (progress >= 100) return { key: 'gold', label: 'Daily Goal Crushed', detail: 'Account is over 100% of today\'s goal', ring: 100, color: 'var(--gold)' };
  if (floating > 0 || equity >= balance) return { key: 'green', label: 'Profit Momentum', detail: 'Equity/floating profit is positive', ring: pct(Math.max(36, progress || 62)), color: 'var(--green2)' };
  return { key: 'blue', label: 'Bridge Linked', detail: 'Account is connected and reporting', ring: 44, color: 'var(--cyan)' };
}

function symbolPerformance(metrics = {}) {
  const openTrades = Array.isArray(metrics.openTrades) ? metrics.openTrades : [];
  const closedTrades = Array.isArray(metrics.closedTradesToday) ? metrics.closedTradesToday : [];
  const map = new Map();
  const touch = (symbol) => {
    const key = String(symbol || 'UNKNOWN').toUpperCase();
    if (!map.has(key)) map.set(key, { symbol: key, openCount: 0, closedCount: 0, buyCount: 0, sellCount: 0, lots: 0, floating: 0, closedPL: 0, totalPL: 0, tickets: [] });
    return map.get(key);
  };
  for (const trade of openTrades) {
    const row = touch(trade.symbol);
    const type = String(trade.type || '').toLowerCase();
    row.openCount += 1;
    row.buyCount += type.includes('buy') ? 1 : 0;
    row.sellCount += type.includes('sell') ? 1 : 0;
    row.lots += Number(trade.lots || 0);
    row.floating += Number(trade.profit || 0) + Number(trade.swap || 0) + Number(trade.commission || 0);
    row.tickets.push(trade.ticket);
  }
  for (const trade of closedTrades) {
    const row = touch(trade.symbol);
    row.closedCount += 1;
    row.closedPL += Number(trade.profit || 0) + Number(trade.swap || 0) + Number(trade.commission || 0);
  }
  for (const sym of metrics.symbols || []) touch(sym);
  return [...map.values()].map((row) => ({ ...row, lots: Number(row.lots.toFixed(2)), totalPL: Number((row.floating + row.closedPL).toFixed(2)), strength: pct(50 + ((row.floating + row.closedPL) * 2), 50) })).sort((a,b)=>Number(b.totalPL)-Number(a.totalPL));
}

function renderAccountHealthPanel(liveData, membership, accountConfig = {}) {
  const metrics = liveData?.metrics || {};
  const health = accountHealthState(liveData, accountConfig);
  const progress = dailyGoalProgress(liveData, accountConfig);
  return `<div class="card account-health-card health-${health.key}"><div class="terminal-top"><div><span class="eyebrow">Account Health</span><h3>${esc(health.label)}</h3><p class="muted">${esc(health.detail)}</p></div><span class="tag">${liveData?.live ? (liveData.stale ? 'Stale' : 'Live') : 'Waiting'}</span></div><div class="grid2"><div><div class="health-ring" style="--ringValue:${pct(health.ring)}%;--ringColor:${health.color}"><strong>${Math.round(pct(health.ring))}%</strong></div></div><div><div class="mini-stat"><span>Balance</span><strong>${money(metrics.balance)}</strong></div><div class="mini-stat"><span>Equity</span><strong>${money(metrics.equity)}</strong></div><div class="mini-stat"><span>Floating</span><strong>${fmtSignedMoney(metrics.floatingPL)}</strong></div><div class="mini-stat"><span>Daily goal</span><strong>${Math.round(progress)}%</strong></div></div></div><div class="equity-line" style="margin-top:14px"></div><div class="command-diagnostics"><div class="mini-stat"><span>Reporter</span><strong>${liveData?.live ? 'linked' : 'waiting'}</strong></div><div class="mini-stat"><span>Copier</span><strong>${membership.canCopyTrades ? 'unlocked' : 'locked'}</strong></div><div class="mini-stat"><span>Margin</span><strong>${Number(metrics.marginLevel || 0).toFixed(0)}%</strong></div></div></div>`;
}

function renderSymbolStrengthPanel(liveData) {
  const rows = symbolPerformance(liveData?.metrics || {});
  const strongest = rows[0];
  const weakest = rows.slice().reverse()[0];
  const body = rows.length ? rows.slice(0, 8).map((row) => `<div class="strength-card"><div class="pair-top"><strong>${esc(row.symbol)}</strong><span class="metric ${row.totalPL >= 0 ? 'green' : 'red'}" style="font-size:18px">${fmtSignedMoney(row.totalPL)}</span></div><div class="strength-bar" style="margin-top:10px"><span style="width:${Math.max(4, row.strength)}%"></span></div><p class="muted">${row.openCount} open • Buy ${row.buyCount} / Sell ${row.sellCount} • Lots ${row.lots.toFixed(2)}</p></div>`).join('') : '<div class="strength-card"><strong>No active symbols yet</strong><p class="muted">When the reporter sends open trades, strongest and weakest pair gauges appear here.</p></div>';
  return `<div class="card"><div class="terminal-top"><div><span class="eyebrow">Pair Strength Radar</span><h3>Strongest and weakest active pairs</h3><p class="muted">Gauges are calculated from floating and today\'s closed P/L per symbol.</p></div><div><span class="tag">Strong: ${esc(strongest?.symbol || '--')}</span> <span class="tag">Weak: ${esc(weakest?.symbol || '--')}</span></div></div><div class="strength-grid">${body}</div></div>`;
}

function renderPairControlGrid(liveData, membership) {
  const rows = symbolPerformance(liveData?.metrics || {}).filter((row) => row.openCount > 0 || row.closedCount > 0);
  if (!rows.length) return `<div class="card"><span class="eyebrow">Pair Controls</span><h3>No trading pairs detected yet.</h3><p class="muted">Pair cards appear when the Culture Coin Reporter snapshot includes open or recently closed trades.</p></div>`;
  return `<div class="card"><div class="terminal-top"><div><span class="eyebrow">Individual Pair Controls</span><h3>Every active pair gets its own controls</h3><p class="muted">Buttons still pass through backend membership gates before MT4 receives anything.</p></div><span class="tag">${rows.length} pairs</span></div><div class="pair-grid">${rows.map((row) => { const cls = row.totalPL > 0 ? (row.totalPL >= 100 ? 'gold' : 'profit') : row.totalPL < 0 ? 'loss' : ''; return `<div class="pair-card ${cls}"><div class="pair-top"><div><div class="pair-symbol">${esc(row.symbol)}</div><p class="muted">${row.openCount} open • ${row.buyCount} buy / ${row.sellCount} sell • ${row.lots.toFixed(2)} lots</p></div><div class="metric ${row.totalPL >= 0 ? row.totalPL >= 100 ? 'gold' : 'green' : 'red'}" style="font-size:22px">${fmtSignedMoney(row.totalPL)}</div></div><div class="gauge"><span style="width:${Math.max(5, row.strength)}%"></span></div><div class="pair-actions"><button class="btn ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="close_symbol_profits" data-symbol="${esc(row.symbol)}" data-close-mode="winners">Close wins</button><button class="btn danger ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="close_symbol" data-symbol="${esc(row.symbol)}" data-close-mode="basket">Close pair</button><button class="btn gold ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="pause_symbol" data-symbol="${esc(row.symbol)}">Pause pair</button><button class="btn primary ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="resume_symbol" data-symbol="${esc(row.symbol)}">Resume pair</button></div></div>`; }).join('')}</div></div>`;
}

function dashboardMetrics(membership, liveData, accountConfig = {}) {
  const metrics = liveData?.metrics || {};
  const progress = dailyGoalProgress(liveData, accountConfig);
  const drawdownWidth = Math.max(0, Math.min(100, Number(metrics.drawdownPercent || 0) * 3.4));
  const liveBadge = liveData?.live ? (liveData.stale ? 'Bridge stale' : 'Live bridge') : 'Waiting for MT4/MT5 snapshot';
  const health = accountHealthState(liveData, accountConfig);
  return `${renderAccountHealthPanel(liveData, membership, accountConfig)}<div class="grid4" style="margin-top:16px"><div class="card"><p class="muted">Balance</p><div class="metric">${money(metrics.balance)}</div><p class="muted">${esc(liveBadge)}</p></div><div class="card ${health.key === 'green' ? 'glow' : health.key === 'gold' ? 'gold' : ''}"><p class="muted">Equity</p><div class="metric ${Number(metrics.equity) >= Number(metrics.balance) ? 'green' : 'gold'}">${money(metrics.equity)}</div><p class="muted">Floating ${fmtSignedMoney(metrics.floatingPL)}</p></div><div class="card gold"><p class="muted">Daily Goal</p><div class="metric gold">${Math.round(progress)}%</div><div class="gauge"><span style="width:${Math.max(2, progress)}%"></span></div><p class="muted">Closed today ${fmtSignedMoney(metrics.dailyClosedPL)}</p></div><div class="card red"><p class="muted">Drawdown</p><div class="metric red">${Number(metrics.drawdownPercent || 0).toFixed(1)}%</div><div class="gauge"><span style="width:${drawdownWidth || 2}%;background:linear-gradient(90deg,var(--orange),var(--red))"></span></div><p class="muted">Margin level ${Number(metrics.marginLevel || 0).toFixed(0)}%</p></div></div><div class="grid4" style="margin-top:16px"><div class="card"><h3>Open Trades</h3><span class="tag">${Number(metrics.openTradeCount || 0)} open</span><p class="muted">Buy ${Number(metrics.buyTradeCount || 0)} / Sell ${Number(metrics.sellTradeCount || 0)} • Lots ${Number(metrics.totalLots || 0).toFixed(2)}</p></div><div class="card"><h3>Membership</h3><span class="tag">${esc(membership.role)}</span><p class="muted">Source: ${esc(membership.source || 'none')}</p></div><div class="card"><h3>Reporter</h3><span class="tag">Available</span><p>Reports stay visible for free and inactive users.</p></div><div class="card ${membership.canCopyTrades ? 'glow' : 'gold'}"><h3>Copier Engine</h3><span class="tag">${membership.canCopyTrades ? 'Unlocked' : 'Locked'}</span><p>${membership.canCopyTrades ? 'Backend checks passed.' : 'Upgrade/reactivate or connect account to unlock.'}</p></div></div>${renderSymbolStrengthPanel(liveData)}`;
}

function reporterCards(membership) {
  return `<div class="grid"><div class="card glow"><h3>Market Alert</h3><p>XAUUSD momentum is expanding. Wait for risk confirmation before allowing copier actions.</p><span class="tag">Reporter visible</span></div><div class="card purple"><h3>Bot Commentary</h3><p>Deadshot is reading trend continuation. Consolidation mode should be considered if the range tightens.</p><span class="tag">AI/Bot Note</span></div><div class="card red"><h3>Risk Warning</h3><p>Drawdown meter is elevated. Inactive users can read this warning but cannot execute commands.</p><span class="tag">Execution gated</span></div></div>${!membership.canCopyTrades ? `<div class="card gold" style="margin-top:16px"><h3>Trade copying locked</h3><p>Your reporter remains active, but live copier controls are blocked until Culture Coin membership is active and a trading account is connected.</p><div class="actions"><a class="btn primary" href="/pricing">Upgrade</a><a class="btn" href="/app/billing">Fix Billing</a></div></div>` : ''}`;
}

function accessLockNotice(membership) {
  if (membership.canCopyTrades) return '';
  const cta = membership.role === 'culture_coin_member_inactive'
    ? '<a class="btn primary" href="/app/billing">Reactivate billing</a>'
    : '<a class="btn primary" href="/pricing">Upgrade to Culture Coin</a>';
  return `<div class="lock-notice"><h3>Copier and live bot execution are locked.</h3><p>Your Culture Coin Reporter remains available, but copy-trade and live command actions require active Culture Coin status, copier access enabled, and a connected trading account.</p><div class="actions">${cta}<a class="btn" href="/app/reporter">Open Reporter</a><a class="btn" href="/app/connect-account">Connect Account</a></div></div>`;
}

function notificationChat(state, membership) {
  const rows = getUserNotifications(state, membership.userId, 12);
  const fallback = rows.length ? rows : [
    { type: 'Culture Coin Reporter Alert', title: 'Reporter Online', message: 'Culture Coin Reporter is available. Copier Engine stays locked until active membership checks pass.', severity: 'info', source: 'system', createdAt: nowIso() },
    { type: 'Sync Completed Alert', title: 'Website + Discord Sync Ready', message: 'Pairing codes, account configuration changes, and copier status updates are stored for both website and Discord.', severity: 'success', source: 'wisdo', createdAt: nowIso() },
    { type: 'Blocked Action Alert', title: 'Inactive Copier Gate Ready', message: 'If an inactive user attempts a copier action through the backend, the attempt is blocked, logged, and surfaced here.', severity: 'warning', source: 'gate', createdAt: nowIso() },
  ];
  const unread = fallback.filter((event) => event.read_status !== 'read').length;
  return `<div class="card purple"><div class="terminal-top"><div><span class="eyebrow">Wisdo Live Notification Chat</span><h3>Website + Discord command feed</h3><p class="muted">Same event stream for profit movement, account sync, copier locks, reporter alerts, billing, and commands.</p></div><span class="tag">${unread} unread</span></div><div class="notify-filters"><span class="chip green">All</span><span class="chip">Profit</span><span class="chip gold">Risk</span><span class="chip">Copier</span><span class="chip">Reporter</span><span class="chip">Sync</span><span class="chip">Billing</span><span class="chip">Commands</span></div><div class="console-screen">${fallback.map((event) => `<div class="console-line"><span class="stamp">${esc(String(event.createdAt || '').slice(11,19) || 'now')}</span><span><strong class="${event.severity === 'warning' ? 'warn' : event.severity === 'danger' ? 'danger' : 'success'}">${getNotificationIcon(event.type,event.severity)} ${esc(event.title || event.type)}</strong><br><small>${esc(event.message || '')}</small><br><small class="muted">${esc(event.source || 'system')} • ${esc(event.type || '')}</small>${event.metadata?.winGifUrl ? `<br><img class="win-gif" src="${esc(event.metadata.winGifUrl)}" alt="Win animation">` : ''}</span></div>`).join('')}</div><div class="actions"><button class="btn" data-mark-notifications-read>Mark all read</button><button class="btn" onclick="navigator.clipboard?.writeText(document.querySelector('.console-screen')?.innerText||'')">Copy chat</button><a class="btn" href="/app/connect-account">Open related account</a><a class="btn primary" href="/app/wisdo-command-center">Open Wisdo</a></div></div>`;
}


function accountTradesPage(liveData, membership, state) {
  const openTrades = liveData?.metrics?.openTrades || [];
  const closed = liveData?.metrics?.closedTradesToday || [];
  const rows = [
    ...openTrades.map((trade) => ({ time: trade.openTime || liveData.lastSyncAt || '', symbol: trade.symbol, action: `${trade.type || 'trade'} ${trade.lots || ''}`.trim(), status: 'Open', pl: Number(trade.profit || 0) + Number(trade.swap || 0) + Number(trade.commission || 0), ticket: trade.ticket, magic: trade.magicNumber, price: trade.currentPrice || trade.openPrice })),
    ...closed.map((trade) => ({ time: trade.closeTime || trade.openTime || liveData.lastSyncAt || '', symbol: trade.symbol, action: `${trade.type || 'trade'} closed`.trim(), status: 'Closed today', pl: Number(trade.profit || 0) + Number(trade.swap || 0) + Number(trade.commission || 0), ticket: trade.ticket, magic: trade.magicNumber, price: trade.closePrice || trade.openPrice })),
  ].slice(0, 90);
  const empty = liveData?.live
    ? '<tr><td colspan="8">Bridge is live, but there are no open or closed trades in the latest reporter snapshot.</td></tr>'
    : '<tr><td colspan="8">No real MT4/MT5 trade snapshot yet. Pair the Culture Coin Reporter to replace this empty state with live account trades.</td></tr>';
  return `${renderPairControlGrid(liveData, membership)}<div class="card" style="margin-top:16px"><div class="terminal-top"><div><span class="eyebrow">Account Trades</span><h3>Live MT4/MT5 trades from the paired reporter</h3><p class="muted">Source: ${esc(liveData.source)} • Last sync: ${esc(liveData.lastSyncAt || 'waiting')}</p></div><span class="tag">${Number(liveData?.metrics?.openTradeCount || 0)} open</span></div><table class="table"><thead><tr><th>Time</th><th>Ticket</th><th>Symbol</th><th>Action</th><th>Status</th><th>Magic</th><th>Price</th><th>P/L</th></tr></thead><tbody>${rows.map((r)=>`<tr><td>${esc(String(r.time || '').replace('T',' ').slice(0,19))}</td><td>${esc(r.ticket || '--')}</td><td><strong>${esc(r.symbol || '--')}</strong></td><td>${esc(r.action || '--')}</td><td>${esc(r.status)}</td><td>${esc(r.magic || '--')}</td><td>${esc(r.price || '--')}</td><td class="metric ${Number(r.pl || 0) >= 0 ? 'green' : 'red'}" style="font-size:18px">${fmtSignedMoney(r.pl)}</td></tr>`).join('') || empty}</tbody></table>${!membership.canCopyTrades ? accessLockNotice(membership) : ''}</div>`;
}

function performancePage(liveData, membership, state, accountConfig = {}) {
  const metrics = liveData?.metrics || {};
  const history = Object.values(readMt4LiveState(state).snapshotHistory || {}).filter((record) => {
    const ids = userLookupIds(membership);
    return ids.includes(String(record.discordUserId || record.userId || ''));
  }).slice(0, 50);
  const closed = metrics.closedTradesToday || [];
  const wins = closed.filter((t) => Number(t.profit || 0) > 0).length;
  const losses = closed.filter((t) => Number(t.profit || 0) < 0).length;
  const winRate = closed.length ? Math.round((wins / closed.length) * 100) : 0;
  const grossWin = closed.filter((t)=>Number(t.profit||0)>0).reduce((sum,t)=>sum+Number(t.profit||0),0);
  const grossLoss = Math.abs(closed.filter((t)=>Number(t.profit||0)<0).reduce((sum,t)=>sum+Number(t.profit||0),0));
  const profitFactor = grossLoss ? (grossWin / grossLoss).toFixed(2) : grossWin ? '∞' : '0.00';
  const progress = dailyGoalProgress(liveData, accountConfig);
  const symbols = symbolPerformance(metrics);
  const strongest = symbols[0];
  const weakest = symbols.slice().reverse()[0];
  return `<div class="grid2"><div class="card glow"><span class="eyebrow">Performance</span><h3>Live equity and goal performance</h3><p class="muted">This page reads paired bridge telemetry, open-trade symbols, and snapshot history.</p><div class="chart"><div class="chart-status">Performance pulse</div><div class="chart-spark"></div><span style="height:${20 + Math.min(70, progress)}%"></span><span style="height:${30 + Math.min(60, Math.abs(Number(metrics.floatingPL || 0))/10)}%"></span><span style="height:${20 + Math.min(70, Number(metrics.openTradeCount || 0)*8)}%"></span><span style="height:${30 + Math.min(55, Number(metrics.marginLevel || 0)/20)}%"></span></div><div class="grid2"><div><p class="muted">Win Rate Today</p><div class="metric ${winRate ? 'green' : ''}">${winRate}%</div></div><div><p class="muted">Profit Factor</p><div class="metric gold">${esc(profitFactor)}</div></div></div></div><div class="card"><h3>Analyzer summary</h3><div class="mini-stat"><span>Equity</span><strong>${money(metrics.equity)}</strong></div><div class="mini-stat"><span>Floating P/L</span><strong>${fmtSignedMoney(metrics.floatingPL)}</strong></div><div class="mini-stat"><span>Daily goal progress</span><strong>${Math.round(progress)}%</strong></div><div class="mini-stat"><span>Open trades</span><strong>${Number(metrics.openTradeCount || 0)}</strong></div><div class="mini-stat"><span>Strongest pair</span><strong>${esc(strongest?.symbol || '--')} ${strongest ? fmtSignedMoney(strongest.totalPL) : ''}</strong></div><div class="mini-stat"><span>Weakest pair</span><strong>${esc(weakest?.symbol || '--')} ${weakest ? fmtSignedMoney(weakest.totalPL) : ''}</strong></div><div class="mini-stat"><span>Snapshot history</span><strong>${history.length}</strong></div><div class="mini-stat"><span>Risk score</span><strong>${membership.canCopyTrades ? 'Managed' : 'Reporter only'}</strong></div></div></div><div style="margin-top:16px">${renderSymbolStrengthPanel(liveData)}</div><div style="margin-top:16px">${renderAccountHealthPanel(liveData, membership, accountConfig)}</div>${!liveData.live ? `<div class="lock-notice"><h3>No live performance snapshot yet.</h3><p>When the Culture Coin Reporter posts to the MT4 sync endpoint, this page will show real balance, equity, floating profit, drawdown, open trades, closed trades, and symbols.</p><a class="btn primary" href="/app/connect-account">Connect Reporter</a></div>` : ''}`;
}

function accountConfigurationForm(state, membership) {
  const { account, config } = getAccountConfiguration(state, membership.userId);
  return `<form class="card form" method="post" action="/api/account/configuration"><span class="eyebrow">Two-Way Account Configuration</span><h3>Website changes sync to Discord. Discord changes sync back here.</h3><div class="grid2"><div class="field"><label>Account nickname</label><input name="nickname" value="${esc(account?.nickname || account?.name || 'Culture Coin Reporter Bridge')}"></div><div class="field"><label>Broker</label><input name="broker" value="${esc(account?.broker || 'Coinexx / Broker')}"></div><div class="field"><label>Platform</label><select name="platform"><option ${config.platform === 'MT4' ? 'selected' : ''}>MT4</option><option ${config.platform === 'MT5' ? 'selected' : ''}>MT5</option></select></div><div class="field"><label>Risk mode</label><select name="risk_mode"><option ${config.risk_mode === 'normal' ? 'selected' : ''}>normal</option><option ${config.risk_mode === 'conservative' ? 'selected' : ''}>conservative</option><option ${config.risk_mode === 'aggressive' ? 'selected' : ''}>aggressive</option></select></div><div class="field"><label>Bot mode</label><select name="bot_mode"><option ${config.bot_mode === 'trend_protect' ? 'selected' : ''}>trend_protect</option><option ${config.bot_mode === 'consolidation' ? 'selected' : ''}>consolidation</option><option ${config.bot_mode === 'protect' ? 'selected' : ''}>protect</option><option ${config.bot_mode === 'manual_assist' ? 'selected' : ''}>manual_assist</option></select></div><div class="field"><label>Notification frequency</label><select name="notification_frequency"><option ${config.notification_frequency === 'quiet' ? 'selected' : ''}>quiet</option><option ${config.notification_frequency === 'normal' ? 'selected' : ''}>normal</option><option ${config.notification_frequency === 'aggressive' ? 'selected' : ''}>aggressive</option><option ${config.notification_frequency === 'critical_only' ? 'selected' : ''}>critical_only</option></select></div><div class="field"><label>Daily profit target %</label><div class="range-row"><input name="daily_profit_target" type="range" min="0.5" max="25" step="0.5" value="${esc(config.daily_profit_target)}" oninput="this.nextElementSibling.value=this.value"><output>${esc(config.daily_profit_target)}</output></div></div><div class="field"><label>Max daily drawdown %</label><div class="range-row"><input name="max_daily_drawdown" type="range" min="1" max="50" step="0.5" value="${esc(config.max_daily_drawdown)}" oninput="this.nextElementSibling.value=this.value"><output>${esc(config.max_daily_drawdown)}</output></div></div><div class="field"><label>Max lot</label><div class="range-row"><input name="max_lot" type="range" min="0.01" max="5" step="0.01" value="${esc(config.max_lot)}" oninput="this.nextElementSibling.value=this.value"><output>${esc(config.max_lot)}</output></div></div><div class="field"><label>Allowed symbols</label><input name="allowed_symbols" value="${esc((config.allowed_symbols || []).join(', '))}"></div></div><div class="actions"><button class="btn primary" type="submit">Save + Sync MT4/Discord</button><a class="btn" href="/api/discord/sync">Manual resync</a></div></form>`;
}


function appMoneyMetric(label, value, tone = '') {
  return `<div class="app-metric ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
}

function appProgress(value, tone = 'green') {
  return `<div class="app-progress ${tone}"><span style="width:${pct(value)}%"></span></div>`;
}

function appLiveBadge(liveData = {}) {
  if (!liveData.live) return `<span class="app-badge gray">Reporter waiting</span>`;
  if (liveData.stale) return `<span class="app-badge gold">Bridge stale</span>`;
  return `<span class="app-badge green">Live bridge</span>`;
}

function appOpenTradeRows(metrics = {}, limit = 8) {
  const rows = Array.isArray(metrics.openTrades) ? metrics.openTrades.slice(0, limit) : [];
  if (!rows.length) return `<tr><td colspan="6">No open trades in the current reporter snapshot.</td></tr>`;
  return rows.map((t) => {
    const pl = Number(t.profit || 0) + Number(t.swap || 0) + Number(t.commission || 0);
    return `<tr><td>${esc(t.symbol || '--')}</td><td>${esc(t.type || t.side || '--')}</td><td>${esc(t.lots || t.lot || '--')}</td><td>${esc(t.ticket || '--')}</td><td>${esc(t.openPrice || t.price || '--')}</td><td class="${pl >= 0 ? 'green' : 'red'}">${fmtSignedMoney(pl)}</td></tr>`;
  }).join('');
}

function appAccountRail(state, membership, selectedAccountId = '') {
  const data = getPortalRelayData(state, membership);
  const activeId = normalizeAccountId(selectedAccountId || data.accessible[0]?.accountId || '');
  const cards = data.accessible.slice(0, 5).map((a) => {
    const s = a.snapshot || {};
    const isActive = String(a.accountId) === String(activeId);
    return `<a class="app-account-pill ${isActive ? 'active' : ''}" href="/app/dashboard?accountId=${encodeURIComponent(a.accountId)}"><strong>${esc(a.nickname || a.accountNumber || 'Reporter')}</strong><span>${esc(a.brokerServer || a.server || 'broker')} • ${money(s.equity || a.equity || 0)}</span></a>`;
  }).join('');
  return `<section class="app-account-rail"><div><span class="eyebrow">Account Desk</span><h3>Switch every control by account</h3><p class="muted">The selected accountId travels with close buttons, copier routes, Discord copier actions, WISDO wake words, and mobile controls.</p></div><div class="app-account-scroll">${cards || '<div class="app-account-pill"><strong>No accounts yet</strong><span>Generate a pairing code to connect MT4 Reporter.</span></div>'}</div></section>`;
}

function appDashboardProductPage(liveData, membership, state, accountConfig = {}) {
  const metrics = liveData?.metrics || {};
  const health = accountHealthState(liveData, accountConfig);
  const progress = dailyGoalProgress(liveData, accountConfig);
  const symbols = symbolPerformance(metrics);
  const openCount = Number(metrics.openTradeCount || 0);
  const floating = Number(metrics.floatingPL || 0);
  const balance = Number(metrics.balance || 0);
  const equity = Number(metrics.equity || 0);
  const margin = Number(metrics.marginLevel || 0);
  const strongest = symbols[0];
  const weakest = symbols.slice().reverse()[0];
  return `${appAccountRail(state, membership, liveData.accountId)}
  <section class="app-hero-card"><div><div class="app-hero-top"><span class="eyebrow">Wisdo Command Center</span>${appLiveBadge(liveData)}</div><h2>Live account command deck</h2><p class="muted">Premium member dashboard for account switching, instant MT4 controls, health gauges, pair controls, and command completion feedback.</p><div class="app-command-row"><button class="btn danger ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="close_all">Close All Selected</button><button class="btn gold ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="close_profitable">Close Profits</button><button class="btn ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="pause_copier">Pause Relay</button><a class="btn primary" href="/app/copier-engine${liveData.accountId ? `?accountId=${encodeURIComponent(liveData.accountId)}` : ''}">Build Relay</a></div><div id="commandConfirmBox" class="command-confirm">Ready. Dangerous commands will request phrase confirmation before MT4 queue.</div></div><div class="app-health-orb health-${health.key}"><div class="health-ring" style="--ringValue:${pct(health.ring)}%;--ringColor:${health.color}"><strong>${Math.round(pct(health.ring))}%</strong></div><h3>${esc(health.label)}</h3><p>${esc(health.detail)}</p></div></section>
  <section class="app-stat-grid">${appMoneyMetric('Balance', money(balance))}${appMoneyMetric('Equity', money(equity), equity >= balance ? 'green' : 'gold')}${appMoneyMetric('Floating P/L', fmtSignedMoney(floating), floating >= 0 ? 'green' : 'red')}${appMoneyMetric('Margin Level', `${margin.toFixed(0)}%`, margin >= 500 ? 'green' : margin >= 300 ? 'gold' : 'red')}${appMoneyMetric('Open Trades', String(openCount))}${appMoneyMetric('Daily Goal', `${Math.round(progress)}%`, progress >= 100 ? 'gold' : 'green')}</section>
  <section class="grid2 app-panel-row"><div class="app-panel"><div class="terminal-top"><div><span class="eyebrow">Pair Command Grid</span><h3>Control open pairs from desktop or mobile</h3></div><span class="tag">${symbols.length} pairs</span></div>${renderPairControlGrid(liveData, membership)}</div><div class="app-panel"><span class="eyebrow">Performance Pulse</span><h3>Strongest / weakest map</h3><div class="app-mini-stack">${appMoneyMetric('Strongest Pair', `${strongest?.symbol || '--'} ${strongest ? fmtSignedMoney(strongest.totalPL) : ''}`, 'green')}${appMoneyMetric('Weakest Pair', `${weakest?.symbol || '--'} ${weakest ? fmtSignedMoney(weakest.totalPL) : ''}`, 'red')}${appMoneyMetric('Snapshot Source', liveData.source || 'none')}${appMoneyMetric('Last Sync', liveData.lastSyncAt || 'waiting')}</div>${appProgress(progress, progress >= 100 ? 'gold' : 'green')}</div></section>
  <section class="app-panel"><div class="terminal-top"><div><span class="eyebrow">Open Trades</span><h3>Live MT4 orders on selected account</h3></div><a class="btn" href="/app/account-trades${liveData.accountId ? `?accountId=${encodeURIComponent(liveData.accountId)}` : ''}">Full Trade Log</a></div><table class="table app-table"><thead><tr><th>Symbol</th><th>Type</th><th>Lot</th><th>Ticket</th><th>Price</th><th>P/L</th></tr></thead><tbody>${appOpenTradeRows(metrics, 12)}</tbody></table></section>
  ${!liveData.live ? `<div class="lock-notice"><h3>Waiting for real MT4/MT5 telemetry</h3><p>No fake demo metrics are shown. Generate a pairing code and let the Culture Coin MT4 Reporter send the first real snapshot.</p><div class="actions"><a class="btn primary" href="/app/connect-account">Connect real bridge</a><a class="btn" href="/app/education">Open setup class</a></div></div>` : ''}`;
}

function appCopierProductPage(page, membership, state, selectedAccountId = '') {
  const data = getPortalRelayData(state, membership);
  const leaderPool = [...data.accessible.filter((a)=>['leader','both','private'].includes(String(a.accountRole||'private')) || a.shared), ...data.discoverable];
  const followerPool = data.owned.filter((a)=>['follower','both','private'].includes(String(a.accountRole||'private')) || a.pendingReporter);
  const liveData = getLiveAccountData(state, membership, selectedAccountId);
  const leaderOptions = accountOptions(leaderPool);
  const followerOptions = accountOptions(followerPool);
  const routeRows = data.routes.slice(0, 12).map((r)=>`<tr><td>${esc(r.leaderAccountId)}</td><td>${esc(r.followerAccountId)}</td><td>${esc(r.status || 'active')}</td><td>${esc(r.risk?.mode || r.mode || 'multiplier')}</td><td><button class="btn danger" data-delete-route="${esc(r.id)}">Delete</button></td></tr>`).join('');
  const accountCards = data.accessible.slice(0, 6).map((a)=>{ const s=a.snapshot||{}; return `<div class="app-copy-card"><span class="app-badge ${a.shared?'purple':a.pendingReporter?'gold':'green'}">${a.shared?'Shared':'Desk'}</span><h3>${esc(accountTitle(a))}</h3><p class="muted">Role: ${esc(a.accountRole || 'private')} • Copy permission: ${esc(a.copyPermission || 'private')}</p><div class="app-mini-stack">${appMoneyMetric('Equity', money(s.equity || a.equity || 0))}${appMoneyMetric('Floating', fmtSignedMoney(s.floatingPL || 0), Number(s.floatingPL || 0) >= 0 ? 'green' : 'red')}${appMoneyMetric('Open', String(Number(s.openTradeCount || 0)))}</div>${!a.shared ? `<div class="copy-engine-form"><label>Desk Role<select id="role-${esc(a.accountId)}"><option value="private" ${String(a.accountRole)==='private'?'selected':''}>Private Desk</option><option value="leader" ${String(a.accountRole)==='leader'?'selected':''}>Culture Lead</option><option value="follower" ${String(a.accountRole)==='follower'?'selected':''}>Mirror Receiver</option><option value="both" ${String(a.accountRole)==='both'?'selected':''}>Dual Lane</option></select></label><button class="btn" data-save-role="${esc(a.accountId)}">Save Role</button></div>` : `<button class="btn" data-pick-lead="${esc(a.accountId)}">Use As Lead</button>`}</div>`; }).join('');
  return `${appAccountRail(state, membership, selectedAccountId || liveData.accountId)}
  <section class="app-hero-card"><div><span class="eyebrow">Copier Engine</span><h2>Master → receiver relay builder</h2><p class="muted">Choose the Culture Lead, choose the Mirror Receiver, set risk mode, map symbols, protect equity, and keep every route attached to the selected account.</p><div class="app-command-row"><button class="btn ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="pause_copier">Pause Relay</button><button class="btn primary ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="resume_copier">Resume Relay</button><a class="btn" href="/app/discord-copier">Signal Grid</a><a class="btn gold" href="/app/education">Copier Class</a></div><div id="commandConfirmBox" class="command-confirm">Copier actions are account-scoped and backend-gated.</div></div><div class="app-route-visual"><div class="node">Lead</div><div class="beam"></div><div class="node receiver">Receiver</div><p>Copy. Control. Confirm.</p></div></section>
  <section class="app-panel" id="add-lane"><div class="terminal-top"><div><span class="eyebrow">Add Culture Lane</span><h3>Create live master/follower mapping</h3></div><span class="tag ${membership.canCopyTrades?'green':'gold'}">${membership.canCopyTrades?'Unlocked':'Reporter only'}</span></div><form id="appRouteForm" class="copy-engine-form app-form-grid"><label>Culture Lead<select id="appLeaderSelect" name="leaderAccountId">${leaderOptions || '<option value="">No lead accounts yet</option>'}</select></label><label>Mirror Receiver<select id="appFollowerSelect" name="followerAccountId">${followerOptions || '<option value="">No receiver accounts yet</option>'}</select></label><label>Route Status<select name="status"><option value="active">Active</option><option value="paused">Paused</option></select></label><label>Risk Mode<select id="appRouteMode" name="mode"><option value="equity_ratio">Balance Bridge</option><option value="multiplier">Lot Multiplier</option><option value="fixed_lot">Fixed Lot</option><option value="same_lot">Match Lead Lot</option></select></label><label>Multiplier<input id="appMultiplier" name="multiplier" value="1.0000"></label><label>Fixed Lot<input id="appFixedLot" name="fixedLot" value="0.01"></label><label>Allowed Symbols<input name="allowedSymbols" value="XAUUSD,GBPJPY,NAS100"></label><label>Symbol Mapping<textarea name="symbolMapping" placeholder="XAUUSD=XAUUSDm\nGOLD=XAUUSD"></textarea></label><label><input type="checkbox" name="copySLTP"> Copy SL/TP</label><label><input type="checkbox" name="copyPendingOrders"> Copy Pending Orders</label><button class="btn primary" type="submit">Save Culture Lane</button></form><pre class="live-out" id="appRouteOut"></pre></section>
  <section class="app-panel" id="risk-dial"><span class="eyebrow">Risk Dial</span><h3>Fast copier sizing calculator</h3><div class="copy-engine-form app-form-grid"><label>Calculator Type<select id="appCalcType"><option value="percent">Percent Bridge</option><option value="lot">Lot Bridge</option></select></label><label>Lead Risk %<input id="appLeadRisk" type="number" step="0.01" value="1"></label><label>Receiver Risk %<input id="appReceiverRisk" type="number" step="0.01" value="1"></label><label>Lead Lot<input id="appLeadLot" type="number" step="0.01" value="0.01"></label><label>Receiver Lot<input id="appReceiverLot" type="number" step="0.01" value="0.01"></label><button class="btn gold" data-apply-risk-dial type="button">Apply Risk Dial</button></div><p id="appRiskDialText" class="muted">Choose percent or lot bridge, then apply to the lane form above.</p></section>
  <section class="app-card-grid">${accountCards || '<div class="app-copy-card"><h3>No reporter accounts yet</h3><p class="muted">Pair MT4 Reporter from Account Connection.</p></div>'}</section>
  <section class="app-panel"><h3>Active Culture Lanes</h3><table class="table app-table"><thead><tr><th>Lead</th><th>Receiver</th><th>Status</th><th>Risk</th><th></th></tr></thead><tbody>${routeRows || '<tr><td colspan="5">No Culture Lanes yet.</td></tr>'}</tbody></table></section>`;
}

function appPerformanceProductPage(liveData, membership, state, accountConfig = {}) {
  const metrics = liveData?.metrics || {};
  const history = Object.values(readMt4LiveState(state).snapshotHistory || {}).filter((record) => userLookupIds(membership).includes(String(record.discordUserId || record.userId || ''))).slice(0, 80);
  const symbols = symbolPerformance(metrics);
  const progress = dailyGoalProgress(liveData, accountConfig);
  const closed = metrics.closedTradesToday || [];
  const wins = closed.filter((t)=>Number(t.profit||0)>0).length;
  const winRate = closed.length ? Math.round((wins/closed.length)*100) : 0;
  const bars = history.slice(0, 18).map((h, i)=>{ const snap=normalizeLiveSnapshot(h.snapshot || h.metrics || h); const val=Math.max(8, Math.min(96, 35 + Number(snap.floatingPL||0)/20 + i)); return `<span style="height:${val}%"></span>`; }).join('') || '<span style="height:28%"></span><span style="height:44%"></span><span style="height:62%"></span><span style="height:54%"></span>';
  return `${appAccountRail(state, membership, liveData.accountId)}
  <section class="app-hero-card"><div><span class="eyebrow">Analyzer</span><h2>Performance cockpit</h2><p class="muted">ROI, equity pressure, strongest pairs, weakest pairs, win rate, profit factor, and MT4 reporter history in one place.</p><div class="app-command-row"><a class="btn" href="/app/account-trades">Trade Log</a><a class="btn" href="/app/copier-engine">Copier Rules</a><button class="btn gold ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="lock_profit">Lock Profit</button></div><div id="commandConfirmBox" class="command-confirm">Analyzer can trigger protection commands after confirmation.</div></div><div class="app-gauge-card"><div class="health-ring" style="--ringValue:${pct(progress)}%;--ringColor:var(--gold)"><strong>${Math.round(progress)}%</strong></div><p>Daily goal progress</p></div></section>
  <section class="app-stat-grid">${appMoneyMetric('Equity', money(metrics.equity))}${appMoneyMetric('Floating', fmtSignedMoney(metrics.floatingPL), Number(metrics.floatingPL||0)>=0?'green':'red')}${appMoneyMetric('Win Rate', `${winRate}%`, winRate>=50?'green':'gold')}${appMoneyMetric('Snapshots', String(history.length))}${appMoneyMetric('Open Trades', String(Number(metrics.openTradeCount||0)))}${appMoneyMetric('Drawdown', `${Number(metrics.drawdownPercent||0).toFixed(1)}%`, Number(metrics.drawdownPercent||0)>8?'red':'green')}</section>
  <section class="grid2 app-panel-row"><div class="app-panel"><span class="eyebrow">Equity Flow</span><h3>Live bridge pulse</h3><div class="app-equity-bars">${bars}</div>${appProgress(progress, progress>=100?'gold':'green')}</div><div class="app-panel">${renderSymbolStrengthPanel(liveData)}</div></section>
  <section class="app-panel"><h3>Symbol Heatmap</h3><div class="app-card-grid">${symbols.slice(0,10).map((s)=>`<div class="app-copy-card ${s.totalPL>=0?'profit':'loss'}"><strong>${esc(s.symbol)}</strong><div class="metric ${s.totalPL>=0?'green':'red'}">${fmtSignedMoney(s.totalPL)}</div><p class="muted">${s.openCount} open • ${s.lots.toFixed(2)} lots</p>${appProgress(s.strength, s.totalPL>=0?'green':'red')}</div>`).join('') || '<div class="app-copy-card"><h3>No pair data yet</h3><p class="muted">Open and closed trades will create the heatmap.</p></div>'}</div></section>`;
}

function appDiscordCopierProductPage(page, membership, state, selectedAccountId = '') {
  const data = getPortalRelayData(state, membership);
  const discoverOptions = accountOptions(data.discoverable);
  const routes = data.routes || [];
  const channel = data.discordChannels || {};
  const cards = data.discoverable.slice(0, 8).map((a)=>`<div class="app-signal-card"><span class="app-badge green">Community Reporter</span><h3>${esc(a.nickname || a.maskedAccountNumber || 'Reporter')}</h3><p class="muted">${esc(a.brokerServer || a.server || '')} • ${esc(a.accountRole || 'leader')} • Owner ${esc(String(a.ownerUserId||'').slice(-8))}</p><button class="btn primary" data-request-reporter="${esc(a.accountId)}" data-owner="${esc(a.ownerUserId || '')}">Request Copy Access</button></div>`).join('');
  const routeCards = routes.slice(0,6).map((r)=>`<div class="app-signal-card"><span class="app-badge gold">Live Lane</span><h3>${esc(r.leaderAccountId)} → ${esc(r.followerAccountId)}</h3><p class="muted">${esc(r.status || 'active')} • ${esc(r.risk?.mode || 'risk')}</p><a class="btn" href="/app/copier-engine">Edit Lane</a></div>`).join('');
  return `${appAccountRail(state, membership, selectedAccountId)}
  <section class="app-hero-card"><div><span class="eyebrow">Discord Copier</span><h2>Signal grid without spam</h2><p class="muted">Discord signal cards can update a live website grid. Users can request access, mirror approved reporters, and watch expiration state without channel spam.</p><div class="app-command-row"><a class="btn primary" href="/app/copier-engine">Create Culture Lane</a><button class="btn ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="pause_copier">Pause Copier</button><a class="btn gold" href="/app/seminars">Signal Training</a></div><div id="commandConfirmBox" class="command-confirm">Discord copier controls stay gated by membership and selected account.</div></div><div class="app-route-visual"><div class="node">Discord</div><div class="beam"></div><div class="node receiver">MT4</div><p>Grid updated. Trade cards expire.</p></div></section>
  <section class="app-panel"><div class="terminal-top"><div><span class="eyebrow">Live Signal Grid</span><h3>Open reporter lanes and copy requests</h3></div><span class="tag">${data.discoverable.length} reporters</span></div><div class="app-card-grid">${routeCards || cards || '<div class="app-signal-card"><h3>No public reporters yet</h3><p class="muted">When active reporters choose leader/both visibility, they appear here.</p></div>'}</div></section>
  <section class="grid2 app-panel-row"><div class="app-panel" id="discover"><h3>Request Reporter Access</h3><form id="appRequestForm" class="copy-engine-form"><label>Community Reporter<select id="appDiscoverSelect" name="accountId">${discoverOptions || '<option value="">No community reporters yet</option>'}</select></label><label>Owner User ID<input id="appDiscoverOwner" name="ownerUserId" value=""></label><label>Permission<select name="permission"><option value="copy_allowed">Copy Allowed</option><option value="signal_only">Signal Only</option><option value="control_allowed">Control Allowed</option></select></label><label>Note<textarea name="note" placeholder="I want to mirror this reporter on my desk."></textarea></label><button class="btn primary" type="submit">Send Access Request</button></form><pre class="live-out" id="appRequestOut"></pre></div><div class="app-panel" id="discord-channel"><h3>Discord Channel Settings</h3><form id="appDiscordChannelForm" class="copy-engine-form"><label>Signal Grid Channel ID<input name="signalGridChannelId" value="${esc(channel.signalGridChannelId||'')}"></label><label>Copy Alerts Channel ID<input name="copyAlertChannelId" value="${esc(channel.copyAlertChannelId||'')}"></label><label>Connection Channel ID<input name="connectionChannelId" value="${esc(channel.connectionChannelId||'')}"></label><label>Rank Up Channel ID<input name="rankChannelId" value="${esc(channel.rankChannelId||'')}"></label><button class="btn primary" type="submit">Save Discord Channels</button></form><pre class="live-out" id="appDiscordChannelOut"></pre></div></section>`;
}

function appEducationSeminarPage(page, membership, state) {
  const modules = [
    ['Start Here', 'Connect MT4 Reporter, select account, understand command confirmations.'],
    ['Copier Engine', 'Build lead/receiver lanes, risk bridge, symbol mapping, and equity protection.'],
    ['Discord Signal Grid', 'Mirror This Trade buttons, expiration rules, and no-spam updates.'],
    ['Risk & Reversal', 'How Deadshot/Wisdo protects accounts, reverses, and handles emergency commands.'],
    ['Affiliate Launch', 'Activation payment, referral split, rank ladder, and payout readiness.'],
    ['Seminar Replay', 'Replay-ready webinar tunnel, education answers, and launch checklist.'],
  ];
  return `<section class="app-hero-card"><div><span class="eyebrow">Wisdo Education Portal</span><h2>Train users before they touch live controls</h2><p class="muted">A member-ready education and seminar portal for onboarding, copier setup, MT4 Reporter connection, Discord signal grid usage, and affiliate activation.</p><div class="app-command-row"><a class="btn primary" href="/webinar/register">Register Seminar</a><a class="btn" href="/webinar/replay">Replay Room</a><a class="btn gold" href="/affiliate">Affiliate Activation</a><a class="btn" href="/app/connect-account">Connect Account</a></div></div><div class="app-gauge-card"><div class="health-ring" style="--ringValue:76%;--ringColor:var(--green2)"><strong>6</strong></div><p>Launch modules</p></div></section>
  <section class="app-card-grid">${modules.map(([title, copy], i)=>`<div class="app-copy-card"><span class="app-badge ${i===0?'green':i===4?'gold':''}">Module ${i+1}</span><h3>${esc(title)}</h3><p class="muted">${esc(copy)}</p><div class="app-progress"><span style="width:${20+i*12}%"></span></div></div>`).join('')}</section>
  <section class="grid2 app-panel-row"><div class="app-panel"><span class="eyebrow">Ask Wisdo Education</span><h3>Built-in answers for members</h3><p class="muted">Add this to the future AI support layer: “How do I connect MT4?”, “Why is copier locked?”, “How do I switch account?”, “How do I close all trades on mobile?”</p><div class="command-input"><input data-wisdo-text placeholder="Ask: how do I connect my reporter?"><button class="btn primary" data-wisdo-send>Ask Wisdo</button></div><div id="commandConfirmBox" class="command-confirm">Education mode is safe. Trading commands still require membership and confirmation.</div></div><div class="app-panel"><span class="eyebrow">Seminar Funnel</span><h3>Replay → activation → dashboard</h3><p class="muted">The seminar path should push users through account linking, subscription, affiliate activation, copier setup, and the education checklist before live execution.</p><ol class="muted"><li>Watch replay</li><li>Pay activation / subscribe</li><li>Connect Discord + MT4 Reporter</li><li>Choose account from dropdown</li><li>Build copier lane</li><li>Confirm live controls</li></ol></div></section>`;
}

function portalContent(page, membership, state, selectedAccountId = '') {
  ensureState(state);
  const lockedClass = membership.canCopyTrades ? '' : 'locked-panel';
  const liveData = getLiveAccountData(state, membership, selectedAccountId);
  const { config: accountConfig } = getAccountConfiguration(state, membership.userId);
  if (page === 'dashboard') return appDashboardProductPage(liveData, membership, state, accountConfig);
  if (page === 'performance') return appPerformanceProductPage(liveData, membership, state, accountConfig);
  if (page === 'copier-engine' || page === 'advanced-link') return appCopierProductPage(page, membership, state, selectedAccountId) + accessLockNotice(membership);
  if (page === 'discord-copier' || page === 'community-reporters') return appDiscordCopierProductPage(page, membership, state, selectedAccountId) + accessLockNotice(membership);
  if (page === 'education' || page === 'seminars') return appEducationSeminarPage(page, membership, state);
  if (page === 'notifications') return notificationChat(state, membership);
  if (page === 'reporter') return reporterCards(membership);
  if (page === 'connect-account') return `<div class="grid2"><div class="card glow"><h3>Pair Website + Discord + MT4/MT5</h3><p>Generate a one-time pairing code from the website or Discord. When either side pairs, the other side sees the sync event.</p><div class="actions"><button class="btn primary" data-pairing-generate>Generate Pairing Code</button><button class="btn" data-pairing-sync>Sync Discord Pairing Code</button><a class="btn gold" href="/app/account-configuration">Configure Account</a></div><div id="pairingResult" class="lock-notice" style="display:none"></div></div><div class="card"><h3>Connection Status</h3><div class="mini-stat"><span>Discord</span><strong>${membership.linkedDiscordUserId ? 'Connected' : 'Not connected'}</strong></div><div class="mini-stat"><span>MT4/MT5 Bridge</span><strong>${membership.accountConnected ? 'Connected' : 'Waiting'}</strong></div><div class="mini-stat"><span>Reporter</span><strong>Available</strong></div><div class="mini-stat"><span>Copier Engine</span><strong>${membership.canCopyTrades ? 'Unlocked' : 'Locked'}</strong></div></div></div>${notificationChat(state, membership)}`;
  if (page === 'account-configuration') return `${accountConfigurationForm(state, membership)}${notificationChat(state, membership)}`;
  if (page === 'wisdo-command-center') return `<div class="command-console"><div class="console-panel ${membership.canCopyTrades ? '' : 'locked-overlay'}"><div class="terminal-top"><div><span class="eyebrow">Wisdo Command Center</span><h3>Two-way website + Discord trading commands</h3><p class="muted">Every command writes a sync event. Website changes update Discord. Discord changes update the website. Trading execution still requires active Culture Coin membership.</p></div><span class="status-pill"><span class="pulse"><i></i></span>${membership.canCopyTrades ? 'Execution Ready' : 'Reporter Only'}</span></div><div class="command-grid"><button class="command-tile btn ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="close_profitable"><strong>Close Profitable</strong><small>MT4 command: CLOSE_ALL_PROFITS.</small></button><button class="command-tile btn ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="close_losers"><strong>Close Losing</strong><small>MT4 command: CLOSE_ALL_LOSERS.</small></button><button class="command-tile btn ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="lock_profit"><strong>Lock Profit</strong><small>Sets the WISDO equity floor.</small></button><button class="command-tile btn gold ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="walk_away"><strong>Walk Away</strong><small>Protect mode through reporter globals.</small></button><button class="command-tile btn ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="pause_copier"><strong>Pause Copier</strong><small>Stop new copier actions while Reporter stays online.</small></button><button class="command-tile btn primary ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="resume_copier"><strong>Resume Copier</strong><small>Resume copying only when checks pass.</small></button><button class="command-tile btn ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="close_all"><strong>Close All</strong><small>MT4 command: CLOSE_ALL_TRADES.</small></button><button class="command-tile btn danger ${membership.canCopyTrades ? '' : 'locked'}" data-copy-action="emergency_close"><strong>Emergency Close</strong><small>Critical immediate command.</small></button></div><div class="subtle-divider"></div><div class="sync-radar"><div class="mini-stat"><span>Website → Discord</span><strong>Active sync events</strong></div><div class="mini-stat"><span>Discord → Website</span><strong>Pair + command APIs</strong></div><div class="mini-stat"><span>Reporter</span><strong>Available</strong></div><div class="mini-stat"><span>Copier Engine</span><strong>${membership.canCopyTrades ? 'Unlocked' : 'Locked'}</strong></div></div><div class="command-input"><input data-wisdo-text placeholder="Try: hey coach close all profitable trades"><button class="btn primary ${membership.canCopyTrades ? '' : 'locked'}" data-wisdo-send>Send to MT4</button></div><div id="commandConfirmBox" class="command-confirm">Ready. Website buttons and wake words now queue executable MT4 reporter commands and wait for completion.</div></div>${notificationChat(state, membership)}</div>${accessLockNotice(membership)}`;
  if (['copier-engine','advanced-link','community-reporters','discord-copier'].includes(page)) return appRelayEnginePage(page, membership, state, selectedAccountId) + accessLockNotice(membership);
  if (page === 'copier-logs') { const logs = getUserCopierLogs(state, membership.userId); return `<div class="card"><span class="eyebrow">Copier Logs</span><h3>Allowed, failed, and blocked copy actions</h3><table class="table"><thead><tr><th>Time</th><th>Action</th><th>Status</th><th>Reason</th></tr></thead><tbody>${logs.map((l)=>`<tr><td>${esc(l.createdAt)}</td><td>${esc(l.action || l.type)}</td><td>${esc(l.status || (l.allowed ? 'allowed' : 'blocked'))}</td><td>${esc(l.reason || '')}</td></tr>`).join('') || '<tr><td colspan="4">No copier logs yet.</td></tr>'}</tbody></table></div>`; }
  if (page === 'account-trades') return accountTradesPage(liveData, membership, state);
  if (page === 'performance') return performancePage(liveData, membership, state, accountConfig);
  if (page === 'subscriptions' || page === 'billing') return `<div class="grid"><div class="card"><h3>Active Plan</h3><div class="metric">${membership.role.includes('active') ? 'Culture Coin' : 'Free/Inactive'}</div><p>Status source: ${esc(membership.source || 'none')}</p></div><div class="card"><h3>Billing Portal</h3><p>Manage Square subscription status here. Checkout and payment receipts remain available through Square.</p><button class="btn primary" data-checkout="culture-coin-monthly">Subscribe / Reactivate</button></div><div class="card gold"><h3>Discord Role Sync</h3><p>Manual Culture Coin role in Discord can activate membership even without website payment.</p></div></div>`;
  if (page === 'membership') return `<div class="grid2"><div class="card glow"><h3>Current Role</h3><div class="metric green">${esc(membership.role)}</div><p>Copier Engine: ${membership.canCopyTrades ? 'Unlocked' : 'Locked'}</p></div><div class="card"><h3>Access Rules</h3><ul><li>Reporter: available to free, inactive, and active users</li><li>Copier Engine: active Culture Coin member only</li><li>Bot execution: active Culture Coin member only</li><li>Admin override: available from admin desk</li></ul></div></div>`;
  return `<div class="card"><h3>${esc(pageTitle(page))}</h3><p>Profile data, OAuth connections, Discord ID, notification settings, and command preferences.</p></div>`;
}


function worldClockCss() {
  return `<style>.world-clock{position:sticky;top:76px;z-index:41;margin:0;background:rgba(2,8,14,.86);border-bottom:1px solid rgba(245,197,66,.18);backdrop-filter:blur(16px)}.world-clock .clock-inner{width:min(1180px,calc(100% - 32px));margin:0 auto;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:9px 0}.clock-cell{display:flex;gap:8px;align-items:center;border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.045);border-radius:999px;padding:7px 10px;font-size:12px}.clock-cell strong{color:#fff}.clock-cell span{color:#94a3b8;font-family:JetBrains Mono,ui-monospace,monospace}.clock-cell.gold{border-color:rgba(245,197,66,.28);color:#fde68a}.copy-engine-form label{display:flex;flex-direction:column;gap:7px;color:#cbd5e1;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.copy-engine-form input,.copy-engine-form select,.copy-engine-form textarea{width:100%;background:#070d15;color:#fff;border:1px solid rgba(245,197,66,.32);border-radius:12px;padding:11px 12px}.copy-engine-form textarea{min-height:84px}.route-step{border:1px solid rgba(245,197,66,.18);background:rgba(255,255,255,.035);border-radius:18px;padding:16px;margin:10px 0}.mini-table{width:100%;border-collapse:collapse}.mini-table th,.mini-table td{border-bottom:1px solid rgba(255,255,255,.08);padding:10px;text-align:left;vertical-align:top}.live-out{display:none;white-space:pre-wrap;background:#020812;border:1px solid rgba(245,197,66,.22);border-radius:14px;padding:12px;margin-top:10px;max-height:260px;overflow:auto}.portal-subnav{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 18px}.portal-subnav a{border:1px solid rgba(245,197,66,.24);border-radius:999px;padding:8px 10px;text-decoration:none;background:rgba(255,255,255,.045);font-weight:900;font-size:12px}.danger-note{border-color:rgba(239,68,68,.34)!important;background:rgba(239,68,68,.08)!important}.app-shell{background:radial-gradient(circle at top right,rgba(34,197,94,.10),transparent 38%),radial-gradient(circle at 10% 10%,rgba(34,211,238,.08),transparent 30%),var(--bg)}.side a{position:relative}.side a.active:before{content:'';position:absolute;left:-10px;top:50%;width:5px;height:22px;border-radius:999px;background:var(--green2);transform:translateY(-50%);box-shadow:0 0 20px rgba(57,255,136,.7)}.app-account-rail,.app-hero-card,.app-panel,.app-copy-card,.app-signal-card{border:1px solid rgba(148,163,184,.16);background:linear-gradient(180deg,rgba(15,23,42,.76),rgba(2,8,14,.76));box-shadow:0 22px 70px rgba(0,0,0,.34);border-radius:24px}.app-account-rail{display:grid;grid-template-columns:1fr 1.35fr;gap:20px;padding:20px;margin:0 0 18px}.app-account-scroll{display:flex;gap:10px;overflow:auto;padding-bottom:4px}.app-account-pill{min-width:230px;text-decoration:none;border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:14px;background:rgba(255,255,255,.035);display:flex;flex-direction:column;gap:4px}.app-account-pill.active{border-color:rgba(57,255,136,.7);box-shadow:0 0 0 1px rgba(57,255,136,.22),0 20px 55px rgba(34,197,94,.10)}.app-account-pill span{color:var(--muted);font-size:12px}.app-hero-card{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:24px;padding:26px;margin-bottom:18px;overflow:hidden;position:relative}.app-hero-card:before{content:'';position:absolute;inset:-80px -80px auto auto;width:280px;height:280px;background:radial-gradient(circle,rgba(57,255,136,.18),transparent 65%);filter:blur(8px)}.app-hero-card h2{font-family:Sora,Inter,sans-serif;font-size:clamp(34px,5vw,62px);letter-spacing:-.06em;line-height:.96;margin:8px 0 12px}.app-hero-top,.app-command-row,.terminal-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.app-command-row{justify-content:flex-start;margin-top:16px}.app-health-orb,.app-gauge-card,.app-route-visual{display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;border:1px solid rgba(255,255,255,.10);border-radius:22px;background:rgba(255,255,255,.04);padding:18px;position:relative;z-index:1}.app-route-visual .node{width:96px;height:96px;border-radius:999px;background:rgba(57,255,136,.14);border:1px solid rgba(57,255,136,.5);display:flex;align-items:center;justify-content:center;font-weight:900}.app-route-visual .receiver{background:rgba(245,197,66,.12);border-color:rgba(245,197,66,.45)}.app-route-visual .beam{width:4px;height:58px;background:linear-gradient(var(--green2),var(--gold));box-shadow:0 0 25px rgba(57,255,136,.5);border-radius:999px}.app-stat-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:18px}.app-metric{border:1px solid rgba(148,163,184,.14);border-radius:20px;background:rgba(255,255,255,.035);padding:16px}.app-metric span{display:block;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}.app-metric strong{font-size:24px;letter-spacing:-.04em}.app-metric.green strong,.green{color:var(--green2)!important}.app-metric.gold strong,.gold{color:var(--gold)!important}.app-metric.red strong,.red{color:var(--red)!important}.app-panel{padding:20px;margin-bottom:18px}.app-panel .card{background:rgba(255,255,255,.03)}.app-panel-row{align-items:stretch}.app-mini-stack{display:grid;gap:10px}.app-progress{height:10px;border-radius:999px;background:rgba(148,163,184,.14);overflow:hidden;margin-top:12px}.app-progress span{display:block;height:100%;background:linear-gradient(90deg,var(--green),var(--green2));border-radius:999px}.app-progress.gold span{background:linear-gradient(90deg,var(--gold),#fff2a6)}.app-progress.red span{background:linear-gradient(90deg,var(--orange),var(--red))}.app-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px}.app-copy-card,.app-signal-card{padding:18px}.app-copy-card.profit,.app-signal-card.profit{border-color:rgba(57,255,136,.32)}.app-copy-card.loss{border-color:rgba(239,68,68,.30)}.app-badge{display:inline-flex;border:1px solid rgba(148,163,184,.22);border-radius:999px;padding:6px 9px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;background:rgba(255,255,255,.04)}.app-badge.green{color:var(--green2);border-color:rgba(57,255,136,.35)}.app-badge.gold{color:var(--gold);border-color:rgba(245,197,66,.35)}.app-badge.gray{color:var(--muted)}.app-badge.purple{color:#c4b5fd;border-color:rgba(139,92,246,.35)}.app-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:end}.app-table td,.app-table th{font-size:13px}.app-equity-bars{height:260px;display:flex;align-items:end;gap:8px;padding:18px;border:1px solid rgba(255,255,255,.08);border-radius:22px;background:linear-gradient(180deg,rgba(57,255,136,.06),rgba(255,255,255,.025))}.app-equity-bars span{flex:1;min-width:8px;border-radius:999px 999px 4px 4px;background:linear-gradient(180deg,var(--green2),rgba(34,197,94,.25));box-shadow:0 0 24px rgba(57,255,136,.12)}@media(max-width:1000px){.app-hero-card,.app-account-rail{grid-template-columns:1fr}.app-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.app-card-grid,.app-form-grid{grid-template-columns:1fr}.app-command-row .btn{flex:1 1 150px}.app-account-pill{min-width:210px}}</style>`;
}

function worldClockMarkup() {
  return `<div class="world-clock"><div class="clock-inner"><div class="clock-cell gold"><strong>CEM World Clock</strong><span data-clock-zone="local">--:--</span></div><div class="clock-cell"><strong>New York</strong><span data-clock-zone="America/New_York">--:--</span></div><div class="clock-cell"><strong>London</strong><span data-clock-zone="Europe/London">--:--</span></div><div class="clock-cell"><strong>Tokyo</strong><span data-clock-zone="Asia/Tokyo">--:--</span></div><div class="clock-cell"><strong>Sydney</strong><span data-clock-zone="Australia/Sydney">--:--</span></div><div class="clock-cell"><strong>UTC/Broker</strong><span data-clock-zone="UTC">--:--</span></div></div></div>`;
}

function userKeyFromMembership(membership = {}) {
  return String(membership.userId || membership.linkedDiscordUserId || membership.user?.id || 'website-buyer');
}

function mt4StateFromPortal(state = {}) {
  return state.__mt4Live || {};
}

function hydratePortalAccount(mt4 = {}, record = {}, viewerUserId = '', flags = {}) {
  const accountId = String(record.accountId || record.id || `${record.accountNumber || ''}:${record.server || record.brokerServer || ''}`);
  const settings = mt4.accountSettingsByAccountId?.[accountId] || {};
  const snapRecord = mt4.latestSnapshotsByAccountId?.[accountId] || {};
  const snap = snapRecord.snapshot || snapRecord || {};
  return {
    ...record,
    ...settings,
    ...flags,
    accountId,
    ownerUserId: String(record.discordUserId || record.userId || record.ownerUserId || ''),
    accountNumber: record.accountNumber || snap.accountNumber || '',
    brokerServer: record.brokerServer || record.server || snap.brokerServer || snap.server || '',
    nickname: settings.nickname || record.nickname || record.accountNickname || snap.accountName || record.accountNumber || 'Reporter Account',
    accountRole: String(settings.accountRole || record.accountRole || 'private').toLowerCase(),
    copyPermission: String(settings.copyPermission || record.copyPermission || 'private').toLowerCase(),
    copyRisk: settings.copyRisk || record.copyRisk || {},
    latestSnapshot: snapRecord,
    snapshot: snap,
    viewerUserId,
  };
}

function getPortalRelayData(state = {}, membership = {}) {
  const mt4 = mt4StateFromPortal(state);
  const userId = userKeyFromMembership(membership);
  const lookupIds = userLookupIds(membership);
  const all = Object.values(mt4.connectionsByAccountId || {}).map((record) => hydratePortalAccount(mt4, record, userId));
  const owned = all.filter((a) => lookupIds.includes(String(a.ownerUserId || a.discordUserId || a.userId || '').trim()));
  const shares = Object.values(mt4.accountSharesById || {}).filter((s) => {
    if (String(s.status || 'active') !== 'active') return false;
    return lookupIds.includes(String(s.ownerUserId || '').trim()) || lookupIds.includes(String(s.targetUserId || '').trim());
  });
  const shared = shares.filter((s) => lookupIds.includes(String(s.targetUserId || '').trim())).map((s) => {
    const rec = mt4.connectionsByAccountId?.[s.accountId];
    return rec ? hydratePortalAccount(mt4, rec, userId, { shared: true, sharePermission: s.permission }) : null;
  }).filter(Boolean);
  const accessibleIds = new Set([...owned, ...shared].map((a) => String(a.accountId)));
  const discoverable = all.filter((a) => {
    if (accessibleIds.has(String(a.accountId))) return false;
    const role = String(a.accountRole || '').toLowerCase();
    const visibility = String(a.visibility || a.copyPermission || '').toLowerCase();
    const canShow = ['leader','both'].includes(role) || ['signal_only','copy_allowed','control_allowed','public','desk'].includes(visibility);
    return canShow && !lookupIds.includes(String(a.ownerUserId || '').trim());
  }).map((a) => ({ ...a, discoverable: true, maskedAccountNumber: a.accountNumber ? `••••${String(a.accountNumber).slice(-4)}` : 'Community Reporter' }));
  return {
    userId,
    lookupIds,
    owned,
    shared,
    accessible: [...owned, ...shared],
    discoverable,
    shares,
    requests: Object.values(mt4.accountAccessRequestsById || {}).filter((r) => lookupIds.includes(String(r.ownerUserId || '').trim()) || lookupIds.includes(String(r.requesterUserId || '').trim())).sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0)),
    brokerRequests: Object.values(mt4.brokerLinkRequestsById || {}).filter((r) => lookupIds.includes(String(r.userId || '').trim())).sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0)),
    routes: Object.values(mt4.copyRoutesById || {}).filter((r) => lookupIds.includes(String(r.ownerUserId || '').trim())),
    discordChannels: state.discordChannelSettingsByUserId?.[userId] || state.discordGlobalChannels || {},
  };
}
function accountTitle(a = {}) {
  const type = a.accountType || a.type || (a.isDemo ? 'demo' : 'live');
  const broker = a.brokerServer || a.server || a.brokerName || 'broker pending';
  return `${a.nickname || a.accountNumber || a.accountId || 'Account'} · ${String(type).toUpperCase()} · ${broker}`;
}

function accountOptions(accounts = [], selected = '') {
  return accounts.map((a) => `<option value="${esc(a.accountId)}" ${String(selected)===String(a.accountId)?'selected':''}>${esc(accountTitle(a))}${a.shared?' · shared':''}${a.discoverable?' · community':''}${a.pendingReporter?' · pairing needed':''}</option>`).join('');
}

function riskModeLabel(mode='fixed_lot') {
  const m=String(mode||'fixed_lot');
  if(m==='risk_percent') return 'Culture % Risk';
  if(m==='multiplier') return 'Lane Multiplier';
  if(m==='same_lot') return 'Match Lead Lot';
  if(m==='equity_ratio') return 'Balance Bridge';
  return 'Fixed Culture Lot';
}

function statusTag(value='', tone='') { return `<span class="tag ${tone}">${esc(value || 'pending')}</span>`; }

function appRelayEnginePage(page, membership, state, selectedAccountId = '') {
  const data = getPortalRelayData(state, membership);
  const leaderPool = [...data.accessible.filter((a)=>['leader','both','private'].includes(String(a.accountRole||'private')) || a.shared), ...data.discoverable];
  const followerPool = data.owned.filter((a)=>['follower','both','private'].includes(String(a.accountRole||'private')) || a.pendingReporter);
  const ownedOptions = accountOptions(data.owned);
  const leaderOptions = accountOptions(leaderPool);
  const followerOptions = accountOptions(followerPool);
  const discoverOptions = accountOptions(data.discoverable);
  const accountCards = data.accessible.map((a)=>{
    const snap = a.snapshot || {};
    const risk = a.copyRisk || {};
    return `<div class="card"><div class="actions" style="margin:0 0 8px"><span class="tag ${a.shared?'purple':a.pendingReporter?'gold':'green'}">${a.shared?'Shared Reporter':a.pendingReporter?'Pending Reporter':'Desk Reporter'}</span><span class="tag">${esc(a.accountRole || 'private')}</span></div><h3>${esc(accountTitle(a))}</h3><p class="muted">Owner ${esc(String(a.ownerUserId||data.userId).slice(-8))} • ${a.pendingReporter?'Waiting for MT4 Reporter pairing':'Reporter/snapshot ready when synced'}</p><div class="metric ${Number(snap.equity||0)>=Number(snap.balance||0)?'green':'gold'}">${a.pendingReporter?'Pairing Needed':money(snap.equity || a.equity || 0)}</div><p class="muted">Balance ${money(snap.balance || a.balance || 0)} • Floating ${money(snap.floatingPL || 0)} • Open ${Number(snap.openTradeCount || 0)}</p><p class="muted">Risk: ${riskModeLabel(risk.mode)} • fixed ${Number(risk.fixedLot || 0.01).toFixed(2)} • max ${Number(risk.maxLot || 0.05).toFixed(2)} • SL/TP ${risk.copySLTP?'on':'off'} • pending ${risk.copyPendingOrders?'on':'off'}</p>${!a.shared?`<div class="copy-engine-form"><label>Role<select id="role-${esc(a.accountId)}"><option value="private" ${String(a.accountRole)==='private'?'selected':''}>Private Desk</option><option value="leader" ${String(a.accountRole)==='leader'?'selected':''}>Culture Lead</option><option value="follower" ${String(a.accountRole)==='follower'?'selected':''}>Mirror Receiver</option><option value="both" ${String(a.accountRole)==='both'?'selected':''}>Dual Lane</option></select></label><button class="btn" data-save-role="${esc(a.accountId)}">Save Role</button><button class="btn" data-edit-risk="${esc(a.accountId)}">Edit Risk</button></div>`:`<button class="btn" data-pick-lead="${esc(a.accountId)}">Use As Culture Lead</button>`}</div>`;
  }).join('');
  const discoverCards = data.discoverable.slice(0, 12).map((a)=>`<div class="card"><span class="tag green">Active Community Reporter</span><h3>${esc(a.nickname || a.maskedAccountNumber || a.accountId)}</h3><p class="muted">${esc(a.brokerServer || a.server || '')} • ${esc(a.accountRole || 'leader')} • Owner ${esc(String(a.ownerUserId||'').slice(-8))}</p><p>Request access, then the owner can approve from their desk. Approved reporters appear in your Culture Lead dropdown.</p><button class="btn primary" data-request-reporter="${esc(a.accountId)}" data-owner="${esc(a.ownerUserId || '')}">Request Copy Access</button></div>`).join('');
  const routesRows = data.routes.map((r)=>`<tr><td>${esc(r.leaderAccountId)}</td><td>${esc(r.followerAccountId)}</td><td>${statusTag(r.status || 'active','green')}</td><td>${riskModeLabel(r.risk?.mode)}<br><span class="muted">fixed ${Number(r.risk?.fixedLot||0.01).toFixed(2)} • mult ${Number(r.risk?.multiplier||1).toFixed(2)} • max ${Number(r.risk?.maxLot||0.05).toFixed(2)} • pending ${r.risk?.copyPendingOrders?'on':'off'} • SL/TP ${r.risk?.copySLTP?'on':'off'}</span></td><td><button class="btn" data-delete-route="${esc(r.routeId)}">Delete</button></td></tr>`).join('');
  const requestsRows = data.requests.map((r)=>{ const inbound=String(r.ownerUserId)===data.userId; return `<tr><td>${inbound?'Inbound':'Outbound'}</td><td>${esc(r.accountId)}</td><td>${esc(inbound?r.requesterUserId:r.ownerUserId)}</td><td>${esc(r.permission||'copy_allowed')}</td><td>${statusTag(r.status||'pending',String(r.status)==='approved'?'green':'gold')}</td><td>${inbound && String(r.status||'pending')==='pending'?`<button class="btn primary" data-approve-request="${esc(r.requestId)}">Approve</button><button class="btn" data-reject-request="${esc(r.requestId)}">Reject</button>`:'—'}</td></tr>`}).join('');
  const brokerRows = data.brokerRequests.map((r)=>`<tr><td>${esc(r.platform||'MT4')}</td><td>${esc(r.brokerName||'')}</td><td>${esc(r.brokerLogin||r.accountNumber||'')}<br><span class="muted">${esc(r.brokerServer||'')}</span></td><td>${esc(r.desiredRole||'private')}</td><td>${statusTag(r.status||'pairing_required','gold')}</td><td><code>${esc(r.pairingCode||'')}</code><br>${r.requestId?`<button class="btn" data-cancel-broker="${esc(r.requestId)}">Cancel</button>`:''}</td></tr>`).join('');
  const channel = data.discordChannels || {};
  return `<div class="topbar"><div><span class="eyebrow">CEM Culture Relay Engine</span><h1 style="font-family:Sora,Inter,sans-serif;margin:12px 0 4px;letter-spacing:-.05em">Full Website Copy + Linking OS</h1><p class="muted">Every left-side /app route now lands in the live portal. Copier Engine uses CEM names with the TraderConnect-style path: choose Culture Lead, choose Mirror Receiver, calculate risk, set rules, map symbols, protect equity, and test the lane.</p></div><span class="status-pill"><span class="pulse"><i></i></span>${membership.canCopyTrades?'Copier Unlocked':'Reporter Only / Copier Locked'}</span></div><div class="portal-subnav"><a href="#add-lane">Add Culture Lane</a><a href="#broker-link">Advanced Broker Link</a><a href="#discover">Community Reporters</a><a href="#discord-channel">Discord Copier Channel</a><a href="#protection">Protection</a><a href="/app/account-trades">Trades</a><a href="/app/performance">YTD Equity</a></div>
  <div class="grid4"><div class="card"><p class="muted">Desk Accounts</p><div class="metric green">${data.owned.length}</div></div><div class="card"><p class="muted">Accessible Leads</p><div class="metric gold">${leaderPool.length}</div></div><div class="card"><p class="muted">Community Reporters</p><div class="metric">${data.discoverable.length}</div></div><div class="card"><p class="muted">Active Culture Lanes</p><div class="metric green">${data.routes.length}</div></div></div>
  <section class="card glow" id="add-lane" style="margin-top:16px"><span class="eyebrow">1. Add Culture Lane</span><h3>Choose copy-from and copy-to accounts</h3><p class="muted">Dropdowns include your linked desk accounts, approved shared reporters, and community reporters that can request access. Community reporters create an access request first; owned/shared reporters create the live copy route.</p><form id="appRouteForm" class="copy-engine-form grid2"><label>Copy From / Culture Lead<select name="leaderAccountId" id="appLeaderSelect">${leaderOptions || '<option value="">No leaders yet</option>'}</select></label><label>Copy To / Mirror Receiver<select name="followerAccountId" id="appFollowerSelect">${followerOptions || '<option value="">No receiver accounts yet</option>'}</select></label><label>Risk Mode<select name="mode" id="appRouteMode"><option value="fixed_lot">Fixed Culture Lot</option><option value="multiplier">Lane Multiplier</option><option value="same_lot">Match Lead Lot</option><option value="equity_ratio">Balance Bridge</option><option value="risk_percent">Culture % Risk</option></select></label><label>Status<select name="status"><option value="active">Active</option><option value="paused">Paused</option></select></label><label>Fixed Lot<input name="fixedLot" id="appFixedLot" value="0.01"></label><label>Multiplier<input name="multiplier" id="appMultiplier" value="1"></label><label>Max Lot<input name="maxLot" value="0.05"></label><label>Max Open Trades<input name="maxOpenTrades" value="5"></label><label>Allowed Symbols<input name="allowedSymbolsCsv" placeholder="XAUUSD,NAS100,GBPJPY"></label><label>Equity Floor<input name="equityFloor" value="0"></label><label><input type="checkbox" name="copySLTP"> Copy SL/TP</label><label><input type="checkbox" name="copyPendingOrders"> Copy pending orders</label><button class="btn primary" type="submit">Create / Update Culture Lane</button></form><pre class="live-out" id="appRouteOut"></pre></section>
  <section class="card" id="risk-dial" style="margin-top:16px"><span class="eyebrow">2. WISDO Risk Dial</span><h3>TraderConnect-style calculator, CEM language</h3><div class="copy-engine-form grid4"><label>Calculator Type<select id="appCalcType"><option value="percent">Percentage risk</option><option value="lot">Lot based risk</option><option value="fixed">Fixed lot every trade</option></select></label><label>Lead Risk %<input id="appLeadRisk" value="1"></label><label>Receiver Risk %<input id="appReceiverRisk" value="1"></label><label>Lead Lot<input id="appLeadLot" value="0.01"></label><label>Receiver Lot<input id="appReceiverLot" value="0.01"></label><button class="btn primary" type="button" data-apply-risk-dial>Apply Risk Dial</button></div><p id="appRiskDialText" class="muted">Defaults: copy stop loss OFF, copy take profit OFF, copy pending orders OFF. Receiver closes when the Culture Lead closes.</p></section>
  <section class="card full" style="margin-top:16px"><h3>Desk / Shared Account Cards</h3><div class="grid">${accountCards || '<div class="card">No linked accounts yet. Use Advanced Broker Link or /connect-mt4.</div>'}</div></section>
  <section class="card" id="broker-link" style="margin-top:16px"><span class="eyebrow">Advanced Link</span><h3>Broker login staging made live</h3><p class="muted">Type broker name, server, and account/login number. Do not enter broker passwords. WISDO creates a live pending account card and pairing code immediately; final verification happens when MT4 Reporter syncs.</p><form id="appBrokerForm" class="copy-engine-form grid2"><label>Platform<select name="platform"><option>MT4</option><option>MT5</option></select></label><label>Broker Name<input name="brokerName" placeholder="Coinexx"></label><label>Broker Server<input name="brokerServer" placeholder="Coinexx-Demo"></label><label>Broker Login / Account Number<input name="brokerLogin" placeholder="1234567"></label><label>Demo or Live<select name="accountType"><option value="demo">Demo</option><option value="live">Live</option></select></label><label>Desired Role<select name="desiredRole"><option value="leader">Culture Lead</option><option value="follower">Mirror Receiver</option><option value="both">Dual Lane</option><option value="private">Private Desk</option></select></label><label>Connection Mode<select name="connectionMode"><option value="reporter_pairing">Reporter Pairing</option><option value="vps_assisted">VPS Assisted</option><option value="manual_review">Manual Review</option></select></label><label>Bot Name<input name="botName" placeholder="HighTower / Deadshot / Wisdo EA"></label><label>Setup Notes<textarea name="note" placeholder="Pairs, risk goal, VPS notes"></textarea></label><button class="btn primary" type="submit">Create Live Pending Reporter</button></form><pre class="live-out" id="appBrokerOut"></pre><table class="mini-table"><thead><tr><th>Platform</th><th>Broker</th><th>Login</th><th>Role</th><th>Status</th><th>Pairing</th></tr></thead><tbody>${brokerRows || '<tr><td colspan="6">No broker link requests yet.</td></tr>'}</tbody></table></section>
  <section class="card" id="discover" style="margin-top:16px"><span class="eyebrow">Community Reporter Discovery</span><h3>Find other users' active reporters</h3><form id="appRequestForm" class="copy-engine-form grid2"><label>Other Active Reporter<select name="accountId" id="appDiscoverSelect">${discoverOptions || '<option value="">No community reporters visible</option>'}</select></label><label>Owner Discord/User ID<input name="ownerUserId" id="appDiscoverOwner" placeholder="auto-filled from reporter"></label><label>Permission<select name="permission"><option value="copy_allowed">Copy Allowed</option><option value="signal_only">Signal Only</option><option value="view_only">View Only</option><option value="control_allowed">Control Allowed</option></select></label><label>Message<input name="note" placeholder="Let me copy your XAU bot lane"></label><button class="btn primary" type="submit">Request Culture Access</button></form><pre class="live-out" id="appRequestOut"></pre><div class="grid" style="margin-top:14px">${discoverCards || '<div class="card">No public reporters yet. Leaders appear after they set role to Culture Lead or Dual Lane.</div>'}</div></section>
  <section class="card" id="discord-channel" style="margin-top:16px"><span class="eyebrow">Discord Copier Channel</span><h3>Trading signals + connection channel</h3><p class="muted">Save the Discord channels used for Culture Signal Cards, rank-ups, pairing/connect help, and copier notifications. TradeSignalService can read this saved channel when env SIGNAL_CHANNEL_ID is not set.</p><form id="appDiscordChannelForm" class="copy-engine-form grid2"><label>Trading Signals Channel ID<input name="tradingSignalsChannelId" value="${esc(channel.tradingSignalsChannelId||channel.signalChannelId||'')}" placeholder="Discord channel ID"></label><label>Connection / Pairing Channel ID<input name="connectionChannelId" value="${esc(channel.connectionChannelId||'')}" placeholder="Discord channel ID"></label><label>Rank Up Channel ID<input name="rankChannelId" value="${esc(channel.rankChannelId||'')}" placeholder="Discord channel ID"></label><label>Signal Thread / Notes<input name="notes" value="${esc(channel.notes||'')}" placeholder="Optional"></label><button class="btn primary" type="submit">Save Discord Copier Channels</button></form><pre class="live-out" id="appDiscordChannelOut"></pre><p class="muted">Discord side should support: /connect-mt4, /my-accounts, /set-account-role, signal cards, Mirror This Trade buttons, Create Culture Lane buttons, and completion notifications.</p></section>
  <section class="card" id="protection" style="margin-top:16px"><span class="eyebrow">TraderConnect-inspired controls</span><h3>Protection, mapping, analytics</h3><div class="grid"><div class="card"><h3>Symbol Translator</h3><p>XAUUSD → XAUUSDm, GOLD → XAUUSD, NAS100 → USTEC. Broker suffix handling stays in MT4 Reporter.</p></div><div class="card"><h3>Covenant Guard</h3><p>Max lot, max trades, equity floor, daily loss %, drawdown %, buys/sells on/off, and pause copier.</p></div><div class="card"><h3>Culture Ledger</h3><p>ROI, win rate, drawdown, YTD equity line, open trades, copied trade history, copied/skipped/blocked logs.</p></div></div></section>
  <section class="card" style="margin-top:16px"><h3>Active Culture Lanes</h3><table class="mini-table"><thead><tr><th>Lead</th><th>Receiver</th><th>Status</th><th>Risk</th><th></th></tr></thead><tbody>${routesRows || '<tr><td colspan="5">No Culture Lanes yet.</td></tr>'}</tbody></table></section>
  <section class="card" style="margin-top:16px"><h3>Access Requests</h3><table class="mini-table"><thead><tr><th>Type</th><th>Account</th><th>Other User</th><th>Permission</th><th>Status</th><th>Action</th></tr></thead><tbody>${requestsRows || '<tr><td colspan="6">No access requests yet.</td></tr>'}</tbody></table></section>
  <script>window.CEM_DISCOVER_OWNERS=${JSON.stringify(Object.fromEntries(data.discoverable.map((a)=>[String(a.accountId),String(a.ownerUserId||'')])))};</script>`;
}

function portalAccountDock(page, membership, state, selectedAccountId = '') {
  const data = getPortalRelayData(state, membership);
  const mt4 = mt4StateFromPortal(state);
  const lookupIds = userLookupIds(membership);
  const activeFromState = lookupIds.map((lookupId) => normalizeAccountId(mt4.activeAccountByUserId?.[lookupId])).find(Boolean) || '';
  const activeId = normalizeAccountId(selectedAccountId || activeFromState || data.accessible[0]?.accountId || '');
  const activeAccount = data.accessible.find((a) => String(a.accountId) === String(activeId));
  const options = accountOptions(data.accessible, activeId);
  const missing = activeId && !activeAccount;
  const stats = activeAccount?.snapshot || {};
  return `<section class="card account-switcher-card"><div class="account-switcher-layout"><div><span class="eyebrow">Active Desk Account</span><h3>Switch the account every button controls</h3><p class="muted">Select the live, demo, shared, or receiver account on this desk. Copier buttons, WISDO wake words, pair controls, close-all, and queue status now carry this accountId into the backend.</p><label class="copy-engine-form"><select data-active-account-select>${options || '<option value="">No connected desk accounts yet</option>'}</select></label><div class="account-switcher-meta"><span class="tag ${activeAccount?.shared?'purple':'green'}">${activeAccount ? (activeAccount.shared ? 'Shared Control' : 'Owner Control') : 'No Account Selected'}</span><span class="tag">${esc(activeAccount?.brokerServer || activeAccount?.server || 'broker waiting')}</span><span class="tag">${activeAccount?.accountNumber ? `••••${esc(String(activeAccount.accountNumber).slice(-4))}` : esc(activeId || 'waiting')}</span><span class="tag">${activeAccount?.pendingReporter ? 'Pairing Needed' : 'Reporter Ready When Synced'}</span></div>${missing ? '<div class="account-switcher-warning">The accountId in the URL is not owned or shared with this user, so WISDO will not relay commands to it.</div>' : ''}</div><div><div class="mini-stat"><span>Selected equity</span><strong>${money(stats.equity || activeAccount?.equity || 0)}</strong></div><div class="mini-stat"><span>Floating P/L</span><strong>${fmtSignedMoney(stats.floatingPL || 0)}</strong></div><div class="mini-stat"><span>Open trades</span><strong>${Number(stats.openTradeCount || 0)}</strong></div><div class="mobile-command-dock"><button class="btn danger ${membership.canCopyTrades ? '' : 'locked'}" data-mobile-command="close_all">Close All Selected</button><button class="btn gold ${membership.canCopyTrades ? '' : 'locked'}" data-mobile-command="close_profitable">Close Profits</button><button class="btn ${membership.canCopyTrades ? '' : 'locked'}" data-mobile-command="pause_copier">Pause Relay</button><a class="btn primary" href="/app/copier-engine${activeId ? `?accountId=${encodeURIComponent(activeId)}` : ''}">Relay Setup</a></div><p class="muted" data-account-switch-status>Mobile ready: selected account controls stay attached on every /app page.</p></div></div></section>`;
}

function portalPage(page, membership, state, selectedAccountId = '') {
  return `<div class="topbar"><div><span class="eyebrow">Member Portal</span><h1 style="font-family:Sora,Inter,sans-serif;margin:12px 0 4px;letter-spacing:-.05em">${esc(pageTitle(page))}</h1><p class="muted">Welcome, ${esc(userDisplay(membership.user || {}))}. Access status: ${esc(membership.role)}. Main trading sections: Copier Engine, Copier Logs, Account Trades, and Performance.</p></div><span class="status-pill"><span class="pulse"><i></i></span>${membership.canCopyTrades ? 'Copier Unlocked' : 'Reporter Only / Copier Locked'}</span></div>${portalAccountDock(page, membership, state, selectedAccountId)}${portalContent(page, membership, state, selectedAccountId)}`;
}

function adminPage(page, state) {
  ensureState(state);
  const users = Object.values(state.usersById || {});
  const memberships = Object.entries(state.memberships || {});
  const tickets = state.supportTickets || [];
  const leads = state.leads || [];
  const active = memberships.filter(([,m]) => String(m.status).includes('active'));
  const inactive = memberships.filter(([,m]) => !String(m.status).includes('active'));
  const stats = `<div class="grid4"><div class="card"><p class="muted">Users</p><div class="metric">${users.length}</div></div><div class="card glow"><p class="muted">Active Members</p><div class="metric green">${active.length}</div></div><div class="card gold"><p class="muted">Inactive Members</p><div class="metric gold">${inactive.length}</div></div><div class="card"><p class="muted">Webinar Leads</p><div class="metric">${leads.length}</div></div></div>`;
  if (page === 'leads') return `${stats}<div class="card" style="margin-top:16px"><h3>Tunnel/Webinar Leads</h3><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Source</th><th>Created</th></tr></thead><tbody>${leads.map(l=>`<tr><td>${esc(l.name)}</td><td>${esc(l.email)}</td><td>${esc(l.phone)}</td><td>${esc(l.source)}</td><td>${esc(l.createdAt)}</td></tr>`).join('') || '<tr><td colspan="5">No leads yet.</td></tr>'}</tbody></table></div>`;
  if (page === 'support-tickets') return `${stats}<div class="card" style="margin-top:16px"><h3>Support Tickets</h3><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Topic</th><th>Message</th><th>Status</th></tr></thead><tbody>${tickets.map(t=>`<tr><td>${esc(t.name)}</td><td>${esc(t.email)}</td><td>${esc(t.topic)}</td><td>${esc(t.message)}</td><td>${esc(t.status)}</td></tr>`).join('') || '<tr><td colspan="5">No tickets yet.</td></tr>'}</tbody></table></div>`;
  if (page === 'products') return `${stats}<div class="grid" style="margin-top:16px">${PRODUCTS.map(productCard).join('')}</div>`;
  if (page === 'users' || page === 'active-members' || page === 'inactive-members') {
    const rows = (page === 'active-members' ? active : page === 'inactive-members' ? inactive : memberships).map(([userId,m]) => `<tr><td>${esc(userId)}</td><td>${esc(m.status)}</td><td>${esc(m.source)}</td><td><form method="post" action="/api/admin/membership"><input type="hidden" name="userId" value="${esc(userId)}"><button class="btn primary" name="status" value="manual_active">Activate</button><button class="btn" name="status" value="paused">Pause</button><button class="btn danger" name="status" value="cancelled">Cancel</button></form></td></tr>`).join('');
    return `${stats}<div class="card" style="margin-top:16px"><h3>${esc(page)}</h3><table class="table"><thead><tr><th>User</th><th>Status</th><th>Source</th><th>Actions</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No membership records yet.</td></tr>'}</tbody></table></div>`;
  }
  return `${stats}<div class="grid2" style="margin-top:16px"><div class="card purple"><h3>Access Control</h3><p>Admins can manually activate, pause, or cancel membership. Billing webhook sync can also update status automatically.</p></div><div class="card"><h3>${esc(page || 'Admin dashboard')}</h3><p>Admin module for subscriptions, payments, products, copier access, reporter settings, support, and licenses.</p></div></div>`;
}

function growthFunnelAdminPage(dashboard = {}, delivery = {}, state = {}) {
  const sourceRows = Object.entries(dashboard.bySource || {}).sort((a, b) => b[1] - a[1]).map(([source, count]) => `<tr><td>${esc(source)}</td><td>${Number(count)}</td></tr>`).join('');
  const leadRows = (dashboard.recentLeads || []).map((lead) => `<tr><td>${esc(lead.name || '')}</td><td>${esc(lead.email || '')}</td><td>${esc(lead.phone ? `••••${String(lead.phone).replace(/\D/g,'').slice(-4)}` : '')}</td><td>${esc(lead.source || '')}</td><td>${esc(lead.campaign || '')}</td><td>${esc(lead.stage || 'new')}</td><td>${esc(lead.createdAt || '')}</td></tr>`).join('');
  const outbox = Object.values(state.notificationOutboxById || {});
  const pending = outbox.filter((item) => ['pending','retrying'].includes(item.status)).length;
  const failed = outbox.filter((item) => item.status === 'failed').length;
  const scheduledTraining = outbox.filter((item) => item.category === 'marketing_education' && ['pending','retrying'].includes(item.status)).length;
  const sentTraining = outbox.filter((item) => item.category === 'marketing_education' && item.status === 'sent').length;
  const stageRows = Object.entries(dashboard.byStage || {}).sort((a,b)=>b[1]-a[1]).map(([stage,count])=>`<tr><td>${esc(stage)}</td><td>${Number(count)}</td></tr>`).join('');
  const engagementRows = Object.entries(dashboard.engagementByType || {}).sort((a,b)=>b[1]-a[1]).map(([type,count])=>`<tr><td>${esc(type)}</td><td>${Number(count)}</td></tr>`).join('');
  return `<div class="grid4"><div class="card glow"><p class="muted">Monthly lead target</p><div class="metric green">${Number(dashboard.target || 1000).toLocaleString()}</div><p>${Number(dashboard.leads || 0)} captured this month</p></div><div class="card"><p class="muted">Projected leads</p><div class="metric ${dashboard.onPace ? 'green' : 'gold'}">${Number(dashboard.projected || 0).toLocaleString()}</div><p>Pace target today: ${Number(dashboard.paceTarget || 0)}</p></div><div class="card"><p class="muted">Visitors / conversion</p><div class="metric">${Number(dashboard.visits || 0).toLocaleString()}</div><p>${Number(dashboard.conversionRate || 0).toFixed(1)}% actual conversion</p></div><div class="card gold"><p class="muted">Daily requirement</p><div class="metric gold">${Number(dashboard.dailyLeadTarget || 0)}</div><p>${Number(dashboard.dailyVisitorTarget || 0)} visitors/day at ${Number(dashboard.configuredConversion || 0).toFixed(1)}%</p></div></div><div class="grid2" style="margin-top:16px"><section class="card"><h3>Funnel Pace</h3><div class="mini-stat"><span>Remaining lead gap</span><strong>${Number(dashboard.gap || 0).toLocaleString()}</strong></div><div class="mini-stat"><span>Required monthly visitors</span><strong>${Number(dashboard.requiredVisitors || 0).toLocaleString()}</strong></div><div class="mini-stat"><span>Month</span><strong>${esc(dashboard.month || '')}</strong></div><div class="mini-stat"><span>Status</span><strong>${dashboard.onPace ? 'On pace' : 'Below pace'}</strong></div><p class="muted">This is a measurable target model, not a guarantee. Traffic, offer quality, follow-up, and conversion determine the outcome.</p></section><section class="card"><h3>Email + SMS Delivery</h3><div class="mini-stat"><span>Resend email</span><strong>${delivery.emailConfigured ? 'Configured' : 'Needs environment keys'}</strong></div><div class="mini-stat"><span>Twilio SMS</span><strong>${delivery.smsConfigured ? 'Configured' : 'Needs environment keys'}</strong></div><div class="mini-stat"><span>Pending/retrying</span><strong>${pending}</strong></div><div class="mini-stat"><span>Failed</span><strong>${failed}</strong></div><form method="post" action="/api/notifications/retry"><button class="btn primary" type="submit">Retry Pending Notifications</button></form></section></div><div class="grid2" style="margin-top:16px"><section class="card"><h3>Lead Sources</h3><table class="table"><thead><tr><th>Source</th><th>Leads</th></tr></thead><tbody>${sourceRows || '<tr><td colspan="2">No source data yet.</td></tr>'}</tbody></table></section><section class="card"><h3>Campaign Links</h3><p>Use UTM links to measure every channel:</p><pre>${esc(`${process.env.PUBLIC_BASE_URL || 'https://your-domain.com'}/growth?utm_source=discord&utm_medium=community&utm_campaign=1000-lead-engine`)}</pre><pre>${esc(`${process.env.PUBLIC_BASE_URL || 'https://your-domain.com'}/growth?utm_source=instagram&utm_medium=social&utm_campaign=1000-lead-engine`)}</pre><pre>${esc(`${process.env.PUBLIC_BASE_URL || 'https://your-domain.com'}/growth?utm_source=affiliate&utm_medium=referral&utm_campaign=1000-lead-engine&ref=CODE`)}</pre></section></div><div class="grid4" style="margin-top:16px"><div class="card"><p class="muted">Engaged leads</p><div class="metric green">${Number(dashboard.engagedLeads || 0)}</div><p>Opened lessons, videos, resources, or AI.</p></div><div class="card"><p class="muted">Signed-up leads</p><div class="metric">${Number(dashboard.signedUpLeads || 0)}</div><p>Linked to a WISDO account.</p></div><div class="card gold"><p class="muted">Training opt-ins</p><div class="metric gold">${Number(dashboard.marketingOptIns || 0)}</div><p>Consent-based educational follow-up.</p></div><div class="card purple"><p class="muted">Scheduled / sent lessons</p><div class="metric">${scheduledTraining} / ${sentTraining}</div><p>Drip-sequence delivery state.</p></div></div><div class="grid2" style="margin-top:16px"><section class="card"><h3>Lead Stages</h3><table class="table"><thead><tr><th>Stage</th><th>Leads</th></tr></thead><tbody>${stageRows || '<tr><td colspan="2">No stage data yet.</td></tr>'}</tbody></table></section><section class="card"><h3>Learning Engagement</h3><table class="table"><thead><tr><th>Event</th><th>Count</th></tr></thead><tbody>${engagementRows || '<tr><td colspan="2">No engagement yet.</td></tr>'}</tbody></table></section></div><section class="card" style="margin-top:16px"><h3>Recent Funnel Leads</h3><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Source</th><th>Campaign</th><th>Stage</th><th>Created</th></tr></thead><tbody>${leadRows || '<tr><td colspan="7">No funnel leads yet.</td></tr>'}</tbody></table></section>`;
}

function adminDeniedPage() {
  return `<main class="main"><div class="card red"><span class="eyebrow">Admin Protected</span><h1 style="font-family:Sora,Inter,sans-serif">Admin access required.</h1><p>Set OWNER_USER_ID to your Discord/user ID and log in as that user, or activate an admin session before opening the admin desk.</p><div class="actions"><a class="btn primary" href="/login">Login</a><a class="btn" href="/app/dashboard">Return to dashboard</a></div></div></main>`;
}

function publicRoute(pageFn, active) {
  return (req, res) => res.send(shell({ title: 'Wisdo Trading Command Center', body: pageFn(req), active, mode: 'public' }));
}

async function withState(loadEcosystemState) {
  return ensureState(await loadEcosystemState());
}


function discordCommandAuthorized(req) {
  const secret = process.env.DISCORD_COMMAND_API_SECRET || '';
  if (!secret) return true;
  return String(req.headers?.['x-discord-command-secret'] || '') === secret;
}

function findUserIdByDiscordId(state, discordUserId = '') {
  ensureState(state);
  const wanted = String(discordUserId || '').trim();
  if (!wanted) return '';
  for (const [userId, connection] of Object.entries(state.discord_connections || {})) {
    if (String(connection.discordUserId || connection.discord_user_id || '') === wanted) return userId;
  }
  if (state.usersById?.[wanted]?.provider === 'discord') return wanted;
  const match = Object.values(state.usersById || {}).find((user) => String(user.discordUserId || user.discord_id || '') === wanted || (user.provider === 'discord' && String(user.id) === wanted));
  return match?.id || '';
}

function getNotificationIcon(type = '', severity = '') {
  const text = `${type} ${severity}`.toLowerCase();
  if (text.includes('blocked') || text.includes('locked')) return '🔒';
  if (text.includes('profit') || text.includes('equity')) return '🟢';
  if (text.includes('goal')) return '🏁';
  if (text.includes('drawdown') || text.includes('recovery')) return '🟡';
  if (text.includes('risk') || text.includes('warning')) return '🚨';
  if (text.includes('command')) return '⚡';
  if (text.includes('sync')) return '🔄';
  if (text.includes('account')) return '🔗';
  if (text.includes('subscription') || text.includes('membership')) return '💳';
  return '🤖';
}

function formatDiscordNotification(event) {
  const icon = getNotificationIcon(event.type, event.severity);
  return `${icon} **${event.title || event.type}**\n${event.message || ''}`.trim();
}

function createPairingRecord(state, { userId = '', discordUserId = '', discordUsername = '', source = 'website', code = '', expiresAt = '' }) {
  ensureState(state);
  const rawCode = String(code || generatePairingCode()).trim();
  const record = {
    id: id('pair'),
    code_hash: hashPairingCode(rawCode),
    created_by_user_id: userId || '',
    created_by_discord_id: discordUserId || '',
    discord_username: discordUsername || '',
    expires_at: expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    used_at: null,
    status: 'pending',
    attempts: 0,
    source,
    created_at: nowIso(),
  };
  state.pairing_codes.push(record);
  return { code: rawCode, record };
}

function findPairingRecord(state, code = '') {
  ensureState(state);
  const codeHash = hashPairingCode(code);
  return state.pairing_codes.find((entry) => entry.code_hash === codeHash) || null;
}

function pairingRecordStatus(record) {
  if (!record) return 'invalid';
  if (record.status === 'used' || record.used_at) return 'used';
  if (record.status === 'revoked') return 'revoked';
  if (new Date(record.expires_at).getTime() < Date.now()) return 'expired';
  return 'pending';
}

function linkDiscordConnection(state, { userId, discordUserId, discordUsername = '', guildId = '', source = 'pairing' }) {
  ensureState(state);
  if (!userId || !discordUserId) return null;
  const connection = {
    id: state.discord_connections[userId]?.id || id('discord'),
    userId,
    discordUserId: String(discordUserId),
    discord_username: discordUsername || state.discord_connections[userId]?.discord_username || '',
    guild_id: guildId || process.env.GUILD_ID || '',
    connected_at: state.discord_connections[userId]?.connected_at || nowIso(),
    last_synced_at: nowIso(),
    status: 'connected',
    source,
  };
  state.discord_connections[userId] = connection;
  const user = state.usersById?.[userId];
  if (user) user.discordUserId = String(discordUserId);
  createSyncEvent(state, { userId, source, target: 'website_discord', action: 'discord_linked', payload: { discordUserId, discordUsername }, status: 'completed' });
  return connection;
}

function updateAccountConfigFromBody(existing = {}, body = {}) {
  const allowedSymbols = String(body.allowed_symbols || body.allowedSymbols || existing.allowed_symbols?.join?.(',') || '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  return {
    ...existing,
    nickname: String(body.nickname || existing.nickname || 'Culture Coin Reporter Bridge').trim(),
    broker: String(body.broker || existing.broker || 'Coinexx / Broker').trim(),
    platform: String(body.platform || existing.platform || 'MT4').toUpperCase() === 'MT5' ? 'MT5' : 'MT4',
    risk_mode: String(body.risk_mode || existing.risk_mode || 'normal').toLowerCase(),
    bot_mode: String(body.bot_mode || existing.bot_mode || 'trend_protect').toLowerCase(),
    allowed_symbols: allowedSymbols.length ? allowedSymbols : existing.allowed_symbols || ['XAUUSD', 'GBPJPY', 'NASUSD'],
    max_lot: Number(body.max_lot ?? body.maxLot ?? existing.max_lot ?? 0.05),
    max_daily_drawdown: Number(body.max_daily_drawdown ?? body.maxDailyDrawdown ?? existing.max_daily_drawdown ?? 12),
    daily_profit_target: Number(body.daily_profit_target ?? body.dailyProfitTarget ?? existing.daily_profit_target ?? 5),
    copier_enabled: String(body.copier_enabled ?? body.copierEnabled ?? existing.copier_enabled ?? 'true') !== 'false',
    reporter_enabled: String(body.reporter_enabled ?? body.reporterEnabled ?? existing.reporter_enabled ?? 'true') !== 'false',
    discord_alerts_enabled: String(body.discord_alerts_enabled ?? body.discordAlertsEnabled ?? existing.discord_alerts_enabled ?? 'true') !== 'false',
    emergency_stop_enabled: String(body.emergency_stop_enabled ?? body.emergencyStopEnabled ?? existing.emergency_stop_enabled ?? 'true') !== 'false',
    auto_sync_enabled: String(body.auto_sync_enabled ?? body.autoSyncEnabled ?? existing.auto_sync_enabled ?? 'true') !== 'false',
    notification_frequency: String(body.notification_frequency || existing.notification_frequency || 'normal').toLowerCase(),
    updated_at: nowIso(),
  };
}

function enumValue(value, map, fallback) {
  const key = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : fallback;
}

function buildAccountConfigurationGlobals(updated = {}) {
  const riskMode = enumValue(updated.risk_mode, { conservative: 1, normal: 2, aggressive: 3 }, 2);
  const botMode = enumValue(updated.bot_mode, { trend_protect: 10, consolidation: 20, protect: 30, manual_assist: 40 }, 10);
  const notificationFrequency = enumValue(updated.notification_frequency, { quiet: 1, normal: 2, aggressive: 3, critical_only: 4 }, 2);
  const globals = [
    { name: 'CEM.WISDO.__ACCOUNT__.GLOBAL.0.RiskMode', value: riskMode },
    { name: 'CEM.WISDO.__ACCOUNT__.GLOBAL.0.BotMode', value: botMode },
    { name: 'CEM.WISDO.__ACCOUNT__.GLOBAL.0.MaxLot', value: Number(updated.max_lot || 0) },
    { name: 'CEM.WISDO.__ACCOUNT__.GLOBAL.0.MaxDailyDrawdownPct', value: Number(updated.max_daily_drawdown || 0) },
    { name: 'CEM.WISDO.__ACCOUNT__.GLOBAL.0.DailyProfitTargetPct', value: Number(updated.daily_profit_target || 0) },
    { name: 'CEM.WISDO.__ACCOUNT__.GLOBAL.0.CopierEnabled', value: updated.copier_enabled ? 1 : 0 },
    { name: 'CEM.WISDO.__ACCOUNT__.GLOBAL.0.ReporterEnabled', value: updated.reporter_enabled ? 1 : 0 },
    { name: 'CEM.WISDO.__ACCOUNT__.GLOBAL.0.DiscordAlertsEnabled', value: updated.discord_alerts_enabled ? 1 : 0 },
    { name: 'CEM.WISDO.__ACCOUNT__.GLOBAL.0.EmergencyStopEnabled', value: updated.emergency_stop_enabled ? 1 : 0 },
    { name: 'CEM.WISDO.__ACCOUNT__.GLOBAL.0.AutoSyncEnabled', value: updated.auto_sync_enabled ? 1 : 0 },
    { name: 'CEM.WISDO.__ACCOUNT__.GLOBAL.0.NotificationFrequency', value: notificationFrequency },
  ];
  for (const symbol of updated.allowed_symbols || []) {
    globals.push({ name: `CEM.WISDO.__ACCOUNT__.${String(symbol).toUpperCase()}.0.SymbolAllowed`, value: 1 });
  }
  return globals;
}

function isKnownExecutableAction(action = '') {
  return [
    'close_symbol_profit','close_symbol_profits','close_pair_profit','close_pair_profits','close_pair_winners',
    'close_symbol','close_pair','close_symbol_all','close_pair_all','pause_symbol','pause_pair','resume_symbol','resume_pair',
    'close_profitable','close_profits','close_winners','take_profit','take_profits','collect_profits','trim_profits','partial_close_winners','close_half_profit',
    'close_all','close_all_trades','emergency_close','panic_close','emergency_close_all','close_losers','close_losses','close_losing',
    'pause_copier','copier_pause','pause_bot','pause_trading','stop_entries','resume_copier','copier_resume','resume_bot','resume_trading','start_entries',
    'walk_away','walk_away_mode','lock_profit','set_equity_floor','buy','sell','market_order','open_trade','place_trade','take_trade',
    'cem_set_globals','set_globals','bot_globals','risk_update','bot_mode','risk_mode'
  ].includes(String(action || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''));
}

async function getCommandStatusForMembership(mt4CommandService, membership, commandId, accountId = null) {
  if (!mt4CommandService?.getCommandStatus) return null;
  for (const lookupId of userLookupIds(membership)) {
    const direct = await mt4CommandService.getCommandStatus(lookupId, commandId, accountId);
    if (direct) return direct;
    if (accountId) {
      const fallback = await mt4CommandService.getCommandStatus(lookupId, commandId, null);
      if (fallback) return fallback;
    }
  }
  return null;
}

async function getQueueStatusForMembership(mt4CommandService, membership, accountId = null) {
  if (!mt4CommandService?.getQueueStatus) return null;
  const seen = new Map();
  let total = 0;
  let pending = 0;
  let delivered = 0;
  let completed = 0;
  let failed = 0;
  let expired = 0;
  for (const lookupId of userLookupIds(membership)) {
    const queue = await mt4CommandService.getQueueStatus(lookupId, accountId);
    for (const command of queue?.recent || []) {
      if (!command?.id || seen.has(command.id)) continue;
      seen.set(command.id, command);
    }
    total += Number(queue?.total || 0);
    pending += Number(queue?.pending || 0);
    delivered += Number(queue?.delivered || 0);
    completed += Number(queue?.completed || 0);
    failed += Number(queue?.failed || 0);
    expired += Number(queue?.expired || 0);
  }
  return { total, pending, delivered, completed, failed, expired, recent: [...seen.values()].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 20) };
}

function evaluateMetricNotifications(state, { userId, tradingAccountId = 'default', metrics = {}, source = 'bridge' }) {
  ensureState(state);
  state.lastAccountMetrics ||= {};
  const key = `${userId}:${tradingAccountId}`;
  const prev = state.lastAccountMetrics[key] || {};
  const current = {
    balance: Number(metrics.balance ?? prev.balance ?? 0),
    equity: Number(metrics.equity ?? prev.equity ?? 0),
    floatingPL: Number(metrics.floatingPL ?? metrics.floatingProfit ?? metrics.profit ?? prev.floatingPL ?? prev.profit ?? 0),
    profit: Number(metrics.profit ?? metrics.floatingPL ?? metrics.floatingProfit ?? prev.profit ?? prev.floatingPL ?? 0),
    drawdown: Number(metrics.drawdown ?? metrics.drawdownPercent ?? prev.drawdown ?? 0),
    dailyClosedPL: Number(metrics.dailyClosedPL ?? prev.dailyClosedPL ?? 0),
    dailyGoalProgress: Number(metrics.dailyGoalProgress ?? metrics.goalProgress ?? prev.dailyGoalProgress ?? 0),
    margin: Number(metrics.margin ?? prev.margin ?? 0),
    freeMargin: Number(metrics.freeMargin ?? prev.freeMargin ?? 0),
    marginLevel: Number(metrics.marginLevel ?? prev.marginLevel ?? 0),
    openTradeCount: Number(metrics.openTradeCount ?? (Array.isArray(metrics.openTrades) ? metrics.openTrades.length : prev.openTradeCount) ?? 0),
    buyTradeCount: Number(metrics.buyTradeCount ?? prev.buyTradeCount ?? 0),
    sellTradeCount: Number(metrics.sellTradeCount ?? prev.sellTradeCount ?? 0),
    totalLots: Number(metrics.totalLots ?? prev.totalLots ?? 0),
    symbols: Array.isArray(metrics.symbols) ? metrics.symbols : (prev.symbols || []),
    openTrades: Array.isArray(metrics.openTrades) ? metrics.openTrades : (prev.openTrades || []),
    closedTradesToday: Array.isArray(metrics.closedTradesToday) ? metrics.closedTradesToday : (prev.closedTradesToday || []),
    accountNumber: metrics.accountNumber || prev.accountNumber || '',
    brokerServer: metrics.brokerServer || prev.brokerServer || '',
    copierStatus: metrics.copierStatus || prev.copierStatus || 'unknown',
    botMode: metrics.botMode || prev.botMode || 'trend_protect',
    updatedAt: nowIso(),
  };
  const created = [];
  const cooldownKey = (type) => `${key}:${type}`;
  state.notificationCooldowns ||= {};
  const canSend = (type, ms = 5 * 60 * 1000) => {
    const last = state.notificationCooldowns[cooldownKey(type)] || 0;
    if (Date.now() - last < ms) return false;
    state.notificationCooldowns[cooldownKey(type)] = Date.now();
    return true;
  };
  if (prev.equity !== undefined && current.equity > Number(prev.equity) && canSend('Equity Growth Alert')) {
    created.push(createNotificationEvent(state, { userId, tradingAccountId, type: 'Equity Growth Alert', title: 'Equity Growth', message: `Account equity increased to ${money(current.equity)}. Wisdo sees positive account momentum.`, severity: 'success', source, metadata: { previous: prev.equity, current: current.equity } }));
  }
  if (prev.profit !== undefined && current.profit > Number(prev.profit) && current.profit > 0 && canSend('Profit Moving Alert')) {
    created.push(createNotificationEvent(state, { userId, tradingAccountId, type: 'Profit Moving Alert', title: 'Profit Moving', message: `Account is up ${money(current.profit)} and moving in the right direction. Daily goal progress: ${Math.round(current.dailyGoalProgress)}%.`, severity: 'success', source, metadata: { previous: prev.profit, current: current.profit } }));
  }
  if (prev.drawdown !== undefined && current.drawdown < Number(prev.drawdown) && canSend('Drawdown Recovery Alert')) {
    created.push(createNotificationEvent(state, { userId, tradingAccountId, type: 'Drawdown Recovery Alert', title: 'Drawdown Recovery', message: `Drawdown improved from ${money(prev.drawdown)} to ${money(current.drawdown)}. Wisdo is watching for safe continuation.`, severity: 'warning', source, metadata: { previous: prev.drawdown, current: current.drawdown } }));
  }
  const thresholds = [25, 50, 75, 90, 100];
  for (const threshold of thresholds) {
    if (Number(prev.dailyGoalProgress || 0) < threshold && current.dailyGoalProgress >= threshold && canSend(`Daily Goal Progress Alert ${threshold}`, 60 * 1000)) {
      created.push(createNotificationEvent(state, { userId, tradingAccountId, type: 'Daily Goal Progress Alert', title: 'Goal Progress', message: `You crossed ${threshold}% toward today’s profit target. Copier status: ${current.copierStatus}. Risk mode is being monitored.`, severity: threshold >= 90 ? 'success' : 'info', source, metadata: { threshold, current: current.dailyGoalProgress } }));
    }
  }
  if (prev.botMode && current.botMode !== prev.botMode && canSend('Bot Mode Changed Alert', 60 * 1000)) {
    created.push(createNotificationEvent(state, { userId, tradingAccountId, type: 'Bot Mode Changed Alert', title: 'Bot Mode Changed', message: `Bot mode changed from ${prev.botMode} to ${current.botMode}.`, severity: 'info', source, metadata: { previous: prev.botMode, current: current.botMode } }));
  }
  state.lastAccountMetrics[key] = current;
  state.lastAccountMetrics[userId] ||= {};
  state.lastAccountMetrics[userId][tradingAccountId] = { metrics: current, source, createdAt: current.updatedAt };
  return created;
}

async function createSquareCheckout({ config, state, userId, product, req, affiliateContext = {} }) {
  const square = new SquarePaymentGateway(config);
  if (!square.isConfigured()) return null;
  const baseUrl = String(config?.api?.publicBaseUrl || process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const membershipProduct = Boolean(product.id.includes('culture-coin') || product.id.includes('vip') || product.id.includes('pro-bot'));
  const billingCycle = product.interval === 'year' ? 'annual' : 'monthly';
  const note = encodeSquarePaymentNote('legacy_checkout', {
    u: String(userId || ''),
    p: product.id,
    m: membershipProduct ? 1 : 0,
    a: affiliateContext.affiliateId || '',
    r: affiliateContext.referralCode || '',
    s: affiliateContext.splitPercent ? Number(affiliateContext.splitPercent) : 0,
  });
  const input = {
    name: product.name,
    amountCents: Math.round(Number(product.price || 0) * 100),
    note,
    redirectUrl: `${baseUrl}/checkout/success?provider=square&launch=1`,
    buyerEmail: getSessionUser(req)?.email || undefined,
  };
  let checkout;
  if (product.mode === 'subscription') {
    const planVariationId = square.subscriptionPlanVariationForCycle(billingCycle);
    if (!planVariationId) {
      const variable = billingCycle === 'annual' ? 'SQUARE_SUBSCRIPTION_PLAN_ANNUAL_ID' : 'SQUARE_SUBSCRIPTION_PLAN_MONTHLY_ID';
      const error = new Error(`Square subscription checkout needs ${variable}.`);
      error.expose = true;
      throw error;
    }
    checkout = await square.createSubscriptionPaymentLink({
      ...input,
      subscriptionPlanVariationId: planVariationId,
      billingCycle,
    });
  } else {
    checkout = await square.createOneTimePaymentLink(input);
  }
  const intentKey = checkout.orderId || checkout.id;
  state.squareCheckoutIntents[intentKey] = {
    id: id('square_checkout'),
    type: 'legacy_checkout',
    userId: String(userId || ''),
    productId: product.id,
    membershipProduct,
    affiliateId: affiliateContext.affiliateId || '',
    referralCode: affiliateContext.referralCode || '',
    splitPercent: Number(affiliateContext.splitPercent || 0),
    paymentLinkId: checkout.id,
    orderId: checkout.orderId,
    createdAt: nowIso(),
  };
  return checkout.url;
}

// Square webhooks are registered in extendedProductRoutes after the raw request
// body capture middleware. This compatibility export intentionally registers no
// duplicate webhook route.
export function registerDeadshotWebhookRoutes() {}

export function registerDeadshotCommandCenterRoutes(app, { config, loadEcosystemState, saveEcosystemState, mt4SyncService, mt4CommandService, logger }) {
  const publicBaseUrl = String(config?.api?.publicBaseUrl || process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const notificationDeliveryService = new NotificationDeliveryService({ loadEcosystemState, saveEcosystemState, logger, publicBaseUrl });
  const growthFunnelService = new GrowthFunnelService({ loadEcosystemState, saveEcosystemState, logger });
  const funnelRateLimits = new Map();
  notificationDeliveryService.startRetryLoop();

  const loadLiveState = async () => {
    const state = ensureState(await loadEcosystemState());
    try {
      state.__mt4Live = mt4SyncService?.repository?.loadMt4State ? await mt4SyncService.repository.loadMt4State() : {};
    } catch (error) {
      logger?.warn?.('Could not load MT4 live state for Deadshot portal', { message: error.message });
      state.__mt4Live = {};
    }
    return state;
  };
  const renderPublic = (pageFn, active = '/') => async (req, res) => {
    const state = await withState(loadEcosystemState);
    const membership = await resolveMembership({ req, config, state });
    res.send(shell({ title: 'Wisdo Trading Command Center', body: pageFn(req, membership, state), active, mode: 'public', membership }));
  };
  // Public frontend routes replacing the old frontend experience.
  app.get('/', renderPublic(() => tcLandingPage(), '/'));
  app.get('/tunnel', renderPublic(() => tunnelPage(), '/tunnel'));
  app.get('/webinar', (req, res) => res.redirect('/webinar/register'));
  app.get('/webinar/register', renderPublic((req) => webinarRegistrationPage(req), '/webinar/register'));
  app.get('/growth', renderPublic((req) => growthFunnelPage(req), '/growth'));
  app.get('/funnel/:campaign', (req, res, next) => req.params.campaign === 'unsubscribe' ? next() : res.redirect(`/growth?utm_campaign=${encodeURIComponent(req.params.campaign)}`));
  app.get('/webinar/replay', renderPublic(() => webinarReplayPage(), '/webinar/register'));
  app.get('/education', renderPublic(() => webinarReplayPage(), '/webinar/register'));
  app.get('/seminar', renderPublic(() => webinarReplayPage(), '/webinar/register'));
  app.get('/learn/:token', async (req, res) => {
    const accessRecord = await growthFunnelService.getLeadByToken(req.params.token);
    if (!accessRecord) return res.status(404).send(shell({ title: 'Learning link unavailable', body: `<main><section class="hero"><div class="container"><div class="card red"><h1>This learning link is invalid or expired.</h1><p>Register again to receive a fresh webinar and education link.</p><a class="btn primary" href="/growth">Get a new learning link</a></div></div></section></main>`, active: '/growth', mode: 'public' }));
    const access = growthFunnelService.createAccessBundle(accessRecord.lead, publicBaseUrl);
    growthFunnelService.recordEngagement({ token: req.params.token, type: 'portal_open', resourceId: 'personal-learning-room', metadata: { path: req.originalUrl } }).catch(() => null);
    return res.send(shell({ title: 'Personal WISDO Learning Room', body: leadLearningPortalPage({ lead: accessRecord.lead, access, resources: access.resources }), active: '/education', mode: 'public' }));
  });
  app.get('/api/funnel/portal/:token', async (req, res) => {
    const accessRecord = await growthFunnelService.getLeadByToken(req.params.token);
    if (!accessRecord) return res.status(404).json({ ok: false, error: 'Learning link is invalid or expired.' });
    const access = growthFunnelService.createAccessBundle(accessRecord.lead, publicBaseUrl);
    return res.json({ ok: true, lead: { id: accessRecord.lead.id, name: accessRecord.lead.name, stage: accessRecord.lead.stage, platform: accessRecord.lead.platform }, access, resources: access.resources });
  });
  app.post('/api/funnel/engagement', async (req, res) => {
    try {
      const result = await growthFunnelService.recordEngagement({ token: req.body?.token, type: req.body?.type, resourceId: req.body?.resourceId, metadata: req.body?.metadata });
      return res.status(201).json({ ok: true, eventId: result.event.id, stage: result.lead.stage });
    } catch (error) {
      return res.status(400).json({ ok: false, error: error.message });
    }
  });
  app.get('/r/lead/:token/:resourceId', async (req, res) => {
    const accessRecord = await growthFunnelService.getLeadByToken(req.params.token);
    if (!accessRecord) return res.redirect('/growth?error=Learning+link+expired');
    const resource = growthFunnelService.resourceCatalog().find((item) => item.id === req.params.resourceId);
    if (!resource) return res.redirect(`/learn/${encodeURIComponent(req.params.token)}`);
    await growthFunnelService.recordEngagement({ token: req.params.token, type: resource.type === 'video' ? 'video_link_opened' : 'resource_click', resourceId: resource.id, metadata: { destination: resource.href } }).catch(() => null);
    const destination = new URL(resource.href, publicBaseUrl || `${req.protocol}://${req.get('host')}`);
    if (destination.origin === new URL(publicBaseUrl || `${req.protocol}://${req.get('host')}`).origin && !destination.pathname.startsWith('/media/')) destination.searchParams.set('leadToken', req.params.token);
    return res.redirect(destination.pathname + destination.search + destination.hash);
  });
  app.get('/funnel/unsubscribe', async (req, res) => {
    try {
      const lead = await growthFunnelService.unsubscribeLead(req.query.token);
      const cancelled = await notificationDeliveryService.cancelLeadMarketing({ leadId: lead.id, email: lead.email });
      return res.send(shell({ title: 'Email preferences updated', body: `<main><section class="hero"><div class="container"><div class="card glow"><h1>Educational follow-up stopped.</h1><p>${cancelled} scheduled training email(s) were cancelled. Transactional account and security messages may still be sent when necessary.</p><a class="btn primary" href="/growth">Return to WISDO</a></div></div></section></main>`, active: '/growth', mode: 'public' }));
    } catch (error) {
      return res.status(400).send(shell({ title: 'Email preference error', body: `<main><section class="hero"><div class="container"><div class="card red"><h1>We could not update this link.</h1><p>${esc(error.message)}</p><a class="btn" href="/contact">Contact support</a></div></div></section></main>`, active: '/growth', mode: 'public' }));
    }
  });
  app.get('/affiliate', renderPublic(() => affiliatePage(), '/pricing'));
  app.get('/offer', renderPublic(() => offerPage(), '/pricing'));
  app.get('/checkout', (req, res) => res.redirect('/offer'));
  app.get('/pricing', renderPublic(() => tcPricingPage(), '/pricing'));
  app.get('/copier', renderPublic(() => tcProductPage('copier'), '/copier'));
  app.get('/analyzer', renderPublic(() => tcProductPage('analyzer'), '/analyzer'));
  app.get('/compare', renderPublic(() => tcProductPage('compare'), '/compare'));
  app.get('/terms', renderPublic(() => legalPage('terms'), '/terms'));
  app.get('/privacy', renderPublic(() => legalPage('privacy'), '/privacy'));
  app.get('/risk-disclosure', renderPublic(() => legalPage('risk'), '/risk-disclosure'));
  app.get('/faq', renderPublic(() => tcFaqPage(), '/faq'));
  app.get('/contact', renderPublic(() => contactPage(), '/contact'));
  app.get('/support', (req, res) => res.redirect('/contact'));
  app.get('/login', async (req, res) => {
    const state = await withState(loadEcosystemState);
    const membership = await resolveMembership({ req, config, state });
    if (membership.userId && !req.query.error) return res.redirect('/app/dashboard');
    res.send(shell({ title: 'Login', body: loginPage(String(req.query.error || '')), active: '/login', mode: 'public', membership }));
  });
  app.get('/signup', async (req, res) => {
    const state = await withState(loadEcosystemState);
    const membership = await resolveMembership({ req, config, state });
    if (membership.userId && !req.query.error) return res.redirect('/app/dashboard');
    res.send(shell({ title: 'Signup', body: signupPage(String(req.query.error || '')), active: '/login', mode: 'public', membership }));
  });
  app.get('/checkout/success', renderPublic(() => successPage(), '/pricing'));
  app.get('/checkout/cancel', renderPublic(() => cancelPage(), '/pricing'));
  app.get('/auth/success', (req, res) => { const target=safeReturnPath(req.query.returnTo,'/app/dashboard'); const join=target.includes('?')?'&':'?'; res.redirect(`${target}${join}launch=1`); });
  app.get('/auth/debug', (req, res) => res.send(shell({ title: 'OAuth Status', active: '/login', mode: 'public', body: `<main><section class="section"><div class="container">${sectionHead('OAuth Status', 'Connection keys and redirects.', 'Use this premium setup screen instead of the legacy debug page. No secret values are exposed.')}<div class="grid2"><div class="card"><h3>Discord redirect</h3><p class="muted">${esc(String(config?.api?.publicBaseUrl || process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, ''))}/auth/discord/callback</p></div><div class="card"><h3>Google redirect</h3><p class="muted">${esc(String(config?.api?.publicBaseUrl || process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, ''))}/auth/google/callback</p></div><div class="card glow"><h3>Discord OAuth</h3><p>${process.env.CLIENT_ID ? 'CLIENT_ID configured' : 'CLIENT_ID missing'}</p><p>${process.env.CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET ? 'Client secret configured' : 'Client secret missing'}</p></div><div class="card purple"><h3>Google OAuth</h3><p>${process.env.GOOGLE_CLIENT_ID ? 'GOOGLE_CLIENT_ID configured' : 'GOOGLE_CLIENT_ID missing'}</p><p>${process.env.GOOGLE_CLIENT_SECRET ? 'Google secret configured' : 'Google secret missing'}</p></div></div></div></section></main>` })));
  app.get('/setup/oauth', (req, res) => res.redirect('/auth/debug'));

  // Email auth.
  app.post('/auth/email/signup', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const phone = String(req.body?.phone || '').trim();
    const smsConsent = formBoolean(req.body?.smsConsent);
    const marketingConsent = formBoolean(req.body?.marketingConsent);
    if (!email || password.length < 8) return res.redirect('/signup?error=Email and 8 character password required');
    const existing = Object.values(state.usersById).find((u) => normalizeEmail(u.email) === email);
    if (existing) return res.redirect('/signup?error=Account already exists');
    const user = { id: id('user'), email, phone, username: req.body?.name || email.split('@')[0], provider: 'email', smsConsent, marketingConsent, createdAt: nowIso() };
    state.usersById[user.id] = { ...user, passwordHash: hashPassword(password) };
    state.profiles[user.id] = { name: user.username, email, phone, smsConsent, marketingConsent, createdAt: nowIso() };
    state.notificationPreferencesByUserId[user.id] = { emailTransactional: true, emailMarketing: marketingConsent, smsTransactional: smsConsent, smsMarketing: false, phone, updatedAt: nowIso() };
    await saveEcosystemState(state);

    const attribution = {
      name: user.username,
      email,
      phone,
      platform: req.body?.platform || '',
      stage: 'signed_up',
      source: req.body?.source || 'website-signup',
      medium: req.body?.medium || '',
      campaign: req.body?.campaign || 'website-signup',
      content: req.body?.content || '',
      term: req.body?.term || '',
      referralCode: req.body?.referralCode || req.body?.ref || '',
      landingPath: req.body?.landingPath || '/signup',
      smsConsent,
      marketingConsent,
      signupUserId: user.id,
    };
    await growthFunnelService.recordLead(attribution).catch((error) => logger?.warn?.('Signup funnel attribution failed.', { userId: user.id, message: error.message }));
    await growthFunnelService.linkSignup({ email, phone, userId: user.id }).catch(() => null);
    await notificationDeliveryService.queueSignupWelcome({ user, phone, smsConsent, source: attribution.source }).catch((error) => logger?.warn?.('Signup welcome delivery failed.', { userId: user.id, message: error.message }));

    setCookie(res, SESSION_COOKIE, encodeSession(user), { maxAge: 60 * 60 * 24 * 30 });
    const target=safeReturnPath(req.body?.returnTo,'/app/dashboard');
    res.redirect(`/auth/success?provider=email_signup&returnTo=${encodeURIComponent(target)}`);
  });

  app.post('/auth/email/login', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    const email = normalizeEmail(req.body?.email);
    const userRecord = Object.values(state.usersById).find((u) => normalizeEmail(u.email) === email && u.passwordHash);
    if (!userRecord || !verifyPassword(req.body?.password, userRecord.passwordHash)) return res.redirect('/login?error=Invalid email or password');
    const { passwordHash, ...user } = userRecord;
    setCookie(res, SESSION_COOKIE, encodeSession(user), { maxAge: 60 * 60 * 24 * 30 });
    const target=safeReturnPath(req.body?.returnTo,'/app/dashboard');
    res.redirect(`/auth/success?provider=email&returnTo=${encodeURIComponent(target)}`);
  });

  app.get('/logout', (req, res) => { clearCookie(res, SESSION_COOKIE); clearCookie(res, 'oauth_state'); res.redirect('/login'); });

  // Discord OAuth login / linking. Manual Discord role can keep Culture Coin active.
  app.get('/auth/discord', (req, res) => {
    const clientId = process.env.CLIENT_ID || config?.discord?.clientId || config?.clientId || '';
    const baseUrl = String(config?.api?.publicBaseUrl || process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    if (!clientId) return res.redirect('/login?error=Discord OAuth is missing CLIENT_ID');
    const state = crypto.randomBytes(16).toString('hex');
    const returnTo = safeReturnPath(req.query.returnTo, '/app/dashboard');
    setCookie(res, 'oauth_state', state, { maxAge: 600 });
    setCookie(res, 'oauth_return_to', returnTo, { maxAge: 600 });
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: `${baseUrl}/auth/discord/callback`, response_type: 'code', scope: 'identify email guilds.members.read', state, prompt: 'none' });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
  });

  app.get('/auth/discord/callback', async (req, res) => {
    try {
      const clientId = process.env.CLIENT_ID || config?.discord?.clientId || config?.clientId || '';
      const clientSecret = process.env.CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || '';
      const baseUrl = String(config?.api?.publicBaseUrl || process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      const cookies = parseCookies(req);
      if (!clientId || !clientSecret) return res.redirect('/login?error=Discord OAuth secrets missing');
      if (!req.query.code || cookies.oauth_state !== req.query.state) return res.redirect('/login?error=Invalid Discord OAuth state');
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: String(req.query.code), client_id: clientId, client_secret: clientSecret, redirect_uri: `${baseUrl}/auth/discord/callback`, grant_type: 'authorization_code' }) });
      const token = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !token.access_token) return res.redirect(`/login?error=${encodeURIComponent(token.error_description || token.error || 'Discord token failed')}`);
      const profileRes = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${token.access_token}` } });
      const profile = await profileRes.json().catch(() => ({}));
      if (!profileRes.ok || !profile.id) return res.redirect('/login?error=Discord profile failed');
      const stateStore = ensureState(await loadEcosystemState());
      const existingUser = getSessionUser(req);
      const userId = existingUser?.id || profile.id;
      const user = { ...(existingUser || {}), id: userId, discordUserId: profile.id, email: profile.email || existingUser?.email || '', username: profile.global_name || profile.username || existingUser?.username || 'Discord Operator', global_name: profile.global_name, provider: existingUser?.provider || 'discord', avatar: profile.avatar, createdAt: existingUser?.createdAt || nowIso() };
      const isNewUser = !stateStore.usersById[user.id];
      stateStore.usersById[user.id] = { ...(stateStore.usersById[user.id] || {}), ...user };
      stateStore.discord_connections[user.id] = { userId: user.id, discordUserId: profile.id, username: profile.username, globalName: profile.global_name, linkedAt: nowIso() };
      stateStore.profiles[user.id] = { ...(stateStore.profiles[user.id] || {}), name: user.username, email: user.email, discordUserId: profile.id, provider: user.provider, updatedAt: nowIso() };
      await saveEcosystemState(stateStore);
      if (isNewUser && user.email) {
        await growthFunnelService.recordLead({ name: user.username, email: user.email, stage: 'signed_up', source: 'discord-oauth', campaign: 'oauth-signup', signupUserId: user.id }).catch(() => null);
        await notificationDeliveryService.queueSignupWelcome({ user, smsConsent: false, source: 'discord-oauth' }).catch((error) => logger?.warn?.('Discord signup welcome delivery failed.', { userId: user.id, message: error.message }));
      }
      setCookie(res, SESSION_COOKIE, encodeSession(user), { maxAge: 60 * 60 * 24 * 30 });
      clearCookie(res, 'oauth_state');
      const returnTo=safeReturnPath(cookies.oauth_return_to,'/app/dashboard');
      clearCookie(res, 'oauth_return_to');
      res.redirect(`/auth/success?provider=discord&returnTo=${encodeURIComponent(returnTo)}`);
    } catch (error) {
      logger?.error?.('Discord OAuth failed', { message: error.message });
      res.redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }
  });

  // Google OAuth login.
  app.get('/auth/google', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const baseUrl = String(config?.api?.publicBaseUrl || process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    if (!clientId) return res.redirect('/login?error=Google OAuth is missing GOOGLE_CLIENT_ID');
    const state = crypto.randomBytes(16).toString('hex');
    const returnTo = safeReturnPath(req.query.returnTo, '/app/dashboard');
    setCookie(res, 'google_oauth_state', state, { maxAge: 600 });
    setCookie(res, 'google_oauth_return_to', returnTo, { maxAge: 600 });
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: `${baseUrl}/auth/google/callback`, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  app.get('/auth/google/callback', async (req, res) => {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID || '';
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
      const baseUrl = String(config?.api?.publicBaseUrl || process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      const cookies = parseCookies(req);
      if (!clientId || !clientSecret) return res.redirect('/login?error=Google OAuth secrets missing');
      if (!req.query.code || cookies.google_oauth_state !== req.query.state) return res.redirect('/login?error=Invalid Google OAuth state');
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: String(req.query.code), client_id: clientId, client_secret: clientSecret, redirect_uri: `${baseUrl}/auth/google/callback`, grant_type: 'authorization_code' }) });
      const token = await tokenRes.json();
      if (!tokenRes.ok || !token.access_token) return res.redirect('/login?error=Google token failed');
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
      const profile = await profileRes.json();
      const user = { id: `google_${profile.id}`, email: profile.email, username: profile.name || profile.email, provider: 'google', avatar: profile.picture, createdAt: nowIso() };
      const stateStore = ensureState(await loadEcosystemState());
      const isNewUser = !stateStore.usersById[user.id];
      stateStore.usersById[user.id] ||= user;
      stateStore.profiles[user.id] = { ...(stateStore.profiles[user.id] || {}), name: user.username, email: user.email, provider: 'google', updatedAt: nowIso() };
      await saveEcosystemState(stateStore);
      if (isNewUser && user.email) {
        await growthFunnelService.recordLead({ name: user.username, email: user.email, stage: 'signed_up', source: 'google-oauth', campaign: 'oauth-signup', signupUserId: user.id }).catch(() => null);
        await notificationDeliveryService.queueSignupWelcome({ user, smsConsent: false, source: 'google-oauth' }).catch((error) => logger?.warn?.('Google signup welcome delivery failed.', { userId: user.id, message: error.message }));
      }
      setCookie(res, SESSION_COOKIE, encodeSession(user), { maxAge: 60 * 60 * 24 * 30 });
      clearCookie(res, 'google_oauth_state');
      const returnTo=safeReturnPath(cookies.google_oauth_return_to,'/app/dashboard');
      clearCookie(res, 'google_oauth_return_to');
      res.redirect(`/auth/success?provider=google&returnTo=${encodeURIComponent(returnTo)}`);
    } catch (error) {
      logger?.error?.('Google OAuth failed', { message: error.message });
      res.redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }
  });

  // Lead/support APIs.
  const captureLead = async (req, res, redirectTo = '/webinar/replay?registered=1') => {
    try {
      if (String(req.body?.companyWebsite || '').trim()) {
        if (String(req.headers.accept || '').includes('application/json')) return res.status(202).json({ ok: true, accepted: true });
        return res.redirect(redirectTo);
      }
      const rateKey = String(req.ip || req.socket?.remoteAddress || 'unknown');
      const now = Date.now();
      const recent = (funnelRateLimits.get(rateKey) || []).filter((time) => now - time < 60_000);
      if (recent.length >= 10) throw new Error('Too many submissions. Try again in one minute.');
      recent.push(now);
      const funnelRateLimitMax = Math.max(100, Math.min(5000, Number(process.env.WISDO_FUNNEL_RATE_CACHE_MAX || 1000)));
      if (!funnelRateLimits.has(rateKey)) {
        for (const [key, times] of funnelRateLimits) {
          if (!times.some((time) => now - time < 60_000)) funnelRateLimits.delete(key);
        }
        while (funnelRateLimits.size >= funnelRateLimitMax) {
          const oldest = funnelRateLimits.keys().next().value;
          if (oldest === undefined) break;
          funnelRateLimits.delete(oldest);
        }
      }
      funnelRateLimits.set(rateKey, recent);
      const smsConsent = formBoolean(req.body?.smsConsent);
      const marketingConsent = formBoolean(req.body?.marketingConsent);
      const result = await growthFunnelService.recordLead({
        name: req.body?.name,
        email: req.body?.email,
        phone: req.body?.phone,
        platform: req.body?.platform,
        source: req.body?.source || 'website',
        medium: req.body?.medium,
        campaign: req.body?.campaign || 'wisdo-growth',
        content: req.body?.content,
        term: req.body?.term,
        referralCode: req.body?.referralCode || req.body?.ref,
        landingPath: req.body?.landingPath || req.originalUrl,
        smsConsent,
        marketingConsent,
      });
      const access = growthFunnelService.createAccessBundle(result.lead, publicBaseUrl);
      await notificationDeliveryService.queueLeadConfirmation({
        lead: result.lead,
        smsConsent,
        marketingConsent,
        portalUrl: access.portalUrl || `${publicBaseUrl}${access.portalPath}`,
        resources: access.resources,
        unsubscribeUrl: access.unsubscribeUrl,
      }).catch((error) => logger?.warn?.('Lead confirmation delivery failed.', { leadId: result.lead.id, message: error.message }));
      if (String(req.headers.accept || '').includes('application/json')) return res.status(result.created ? 201 : 200).json({ ok: true, created: result.created, lead: result.lead, accessUrl: access.portalUrl || access.portalPath });
      return res.redirect(`${access.portalPath}?registered=1`);
    } catch (error) {
      if (String(req.headers.accept || '').includes('application/json')) return res.status(400).json({ ok: false, error: error.message });
      return res.redirect(`/growth?error=${encodeURIComponent(error.message)}`);
    }
  };

  app.post('/api/leads', (req, res) => captureLead(req, res, '/webinar/replay?registered=1'));
  app.post('/api/funnel/leads', (req, res) => captureLead(req, res, '/webinar/replay?registered=1&source=growth'));
  app.post('/api/funnel/visit', async (req, res) => {
    const visit = await growthFunnelService.recordVisit({ ...(req.body || {}), userAgent: req.get('user-agent') || req.body?.userAgent || '' }).catch((error) => ({ error: error.message }));
    if (visit?.error) return res.status(400).json({ ok: false, error: visit.error });
    return res.status(201).json({ ok: true, visitId: visit.id });
  });
  app.get('/api/funnel/dashboard', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    const membership = await resolveMembership({ req, config, state });
    if (membership.role !== 'admin') return res.status(403).json({ ok: false, error: 'Admin access required' });
    const dashboard = await growthFunnelService.dashboard();
    const delivery = notificationDeliveryService.providerHealth();
    return res.json({ ok: true, dashboard, delivery });
  });
  app.post('/api/notifications/retry', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    const membership = await resolveMembership({ req, config, state });
    if (membership.role !== 'admin') return res.status(403).json({ ok: false, error: 'Admin access required' });
    const results = await notificationDeliveryService.retryPending(50);
    if (!String(req.headers.accept || '').includes('application/json')) return res.redirect('/admin/growth-funnel?retried=1');
    return res.json({ ok: true, attempted: results.length, results });
  });
  app.post('/api/support/tickets', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    state.supportTickets.push({ id: id('ticket'), name: req.body?.name || '', email: req.body?.email || '', topic: req.body?.topic || '', message: req.body?.message || '', status: 'open', createdAt: nowIso() });
    await saveEcosystemState(state);
    res.redirect('/contact?sent=1');
  });

  // Membership summary used by launch animation and gates.
  app.get('/api/deadshot/me', async (req, res) => {
    const state = await loadLiveState();
    const membership = await resolveMembership({ req, config, state });
    const liveAccount = membership.userId ? getLiveAccountData(state, membership) : null;
    res.json({ ok: true, user: membership.user, membership, liveAccount, products: PRODUCTS });
  });

  // Account status and two-way website + Discord configuration sync.
  app.get('/api/account/status', async (req, res) => {
    const state = await loadLiveState();
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required' });
    const { account, accountId, config: accountConfig } = getAccountConfiguration(state, membership.userId);
    const liveAccount = getLiveAccountData(state, membership);
    res.json({ ok: true, membership, account, accountId, configuration: accountConfig, liveAccount, notifications: getUserNotifications(state, membership.userId, 10) });
  });

  app.get('/api/account/health', async (req, res) => {
    const state = await loadLiveState();
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required' });
    const { config: accountConfig } = getAccountConfiguration(state, membership.userId);
    const liveAccount = getLiveAccountData(state, membership);
    res.json({ ok: true, health: accountHealthState(liveAccount, accountConfig), liveAccount, canCopyTrades: membership.canCopyTrades });
  });

  app.get('/api/account/pairs', async (req, res) => {
    const state = await loadLiveState();
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required' });
    const liveAccount = getLiveAccountData(state, membership);
    res.json({ ok: true, live: liveAccount.live, pairs: symbolPerformance(liveAccount.metrics), canCopyTrades: membership.canCopyTrades });
  });

  app.post('/api/account/configuration', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required' });
    const { accountId, config: current } = getAccountConfiguration(state, membership.userId);
    const updated = updateAccountConfigFromBody(current, req.body || {});
    state.account_configurations[membership.userId][accountId] = updated;
    state.trading_accounts[membership.userId] ||= {};
    state.trading_accounts[membership.userId][accountId] = {
      ...(state.trading_accounts[membership.userId][accountId] || {}),
      id: accountId,
      user_id: membership.userId,
      nickname: updated.nickname,
      broker: updated.broker,
      platform: updated.platform,
      connection_status: membership.accountConnected ? 'connected' : 'pending',
      copier_enabled: updated.copier_enabled,
      reporter_enabled: updated.reporter_enabled,
      risk_profile: updated.risk_mode,
      daily_goal: updated.daily_profit_target,
      max_drawdown: updated.max_daily_drawdown,
      lot_mode: 'controlled',
      updated_at: nowIso(),
    };
    state.trade_copier_access[membership.userId] = { ...(state.trade_copier_access[membership.userId] || {}), enabled: updated.copier_enabled, updatedAt: nowIso() };
    const liveData = getLiveAccountData(state, membership);
    const globals = buildAccountConfigurationGlobals(updated);
    let queuedConfigCommand = null;
    if (canExecuteTradingAction(membership)) {
      queuedConfigCommand = await queueMt4ReporterCommand({
        mt4CommandService,
        membership,
        state,
        liveData,
        body: {
          action: 'cem_set_globals',
          command: 'CEM_SET_GLOBALS',
          globals,
          reason: 'account_configuration_updated',
          immediate: true,
          priority: 140,
          ttlMinutes: 5,
        },
        origin: 'website_account_configuration',
      });
    }
    createSyncEvent(state, { userId: membership.userId, source: 'website', target: queuedConfigCommand?.ok ? 'discord_mt4_bridge' : 'discord', action: 'account_configuration_updated', payload: { ...updated, globalsQueued: Boolean(queuedConfigCommand?.ok), commandId: queuedConfigCommand?.record?.id || '' }, status: 'completed' });
    createNotificationEvent(state, { userId: membership.userId, type: queuedConfigCommand?.ok ? 'Command Executed Alert' : 'Sync Completed Alert', title: queuedConfigCommand?.ok ? 'Risk + Bot Settings Queued' : 'Website Control Saved', message: queuedConfigCommand?.ok ? `Risk mode ${updated.risk_mode}, bot mode ${updated.bot_mode}, max lot ${updated.max_lot}, drawdown ${updated.max_daily_drawdown}%, and goal ${updated.daily_profit_target}% were queued to MT4 as CEM globals.` : `Account configuration saved and synced to Discord. MT4 execution stays locked until active membership and connected bridge checks pass.`, severity: queuedConfigCommand?.ok ? 'success' : 'info', source: 'website', metadata: { ...updated, globals, commandId: queuedConfigCommand?.record?.id || '', queueError: queuedConfigCommand?.error || '' } });
    await saveEcosystemState(state);
    if (req.accepts('html')) return res.redirect('/app/account-configuration?sync=1');
    res.json({ ok: true, configuration: updated, globals, queuedCommand: queuedConfigCommand?.record || null });
  });

  // Pairing routes: website-generated and Discord-generated pairing codes share one state table.
  app.post('/api/pairing/generate', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    const membership = await resolveMembership({ req, config, state });
    const discordUserId = String(req.body?.discordUserId || membership.linkedDiscordUserId || '').trim();
    const source = String(req.body?.source || (discordUserId && !membership.userId ? 'discord' : 'website')).toLowerCase();
    if (source !== 'discord' && !membership.userId) return res.status(401).json({ ok: false, error: 'Login required to generate a website pairing code.' });
    const ownerUserId = membership.userId || findUserIdByDiscordId(state, discordUserId) || '';
    const { code, record } = createPairingRecord(state, { userId: ownerUserId, discordUserId, discordUsername: req.body?.discordUsername || '', source });
    const mt4Registration = await registerMt4PairingCode(mt4SyncService, { code, userId: ownerUserId || record.created_by_user_id || '', discordUserId: discordUserId || record.created_by_discord_id || '', accountNickname: req.body?.accountNickname || 'Culture Coin Reporter Bridge', source });
    if (mt4Registration?.expiresAt) record.expires_at = mt4Registration.expiresAt;
    createNotificationEvent(state, { userId: ownerUserId || 'system', type: 'Pairing Code Generated Alert', title: 'Pairing Code Generated', message: `A ${source} pairing code was generated, registered with the MT4/MT5 bridge, and expires at ${record.expires_at}.`, severity: 'info', source, metadata: { recordId: record.id, mt4Registration } });
    await saveEcosystemState(state);
    res.json({ ok: true, code, expiresAt: record.expires_at, source, recordId: record.id, mt4Registration });
  });

  app.post('/api/pairing/verify', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    const membership = await resolveMembership({ req, config, state });
    const code = String(req.body?.code || '').trim();
    const discordUserId = String(req.body?.discordUserId || '').trim();
    const record = findPairingRecord(state, code);
    if (record) record.attempts = Number(record.attempts || 0) + 1;
    const status = pairingRecordStatus(record);
    if (status !== 'pending') {
      await saveEcosystemState(state);
      return res.status(400).json({ ok: false, error: `Pairing code is ${status}.`, status });
    }
    const userId = membership.userId || record.created_by_user_id || findUserIdByDiscordId(state, discordUserId);
    const finalDiscordId = discordUserId || record.created_by_discord_id || membership.linkedDiscordUserId || '';
    if (!userId || !finalDiscordId) return res.status(400).json({ ok: false, error: 'Pairing requires both a website user and Discord user.' });
    record.used_at = nowIso();
    record.status = 'used';
    const connection = linkDiscordConnection(state, { userId, discordUserId: finalDiscordId, discordUsername: req.body?.discordUsername || record.discord_username || '', guildId: req.body?.guildId || config?.guildId || '', source: 'pairing' });
    createNotificationEvent(state, { userId, type: 'Sync Completed Alert', title: 'Website + Discord Paired', message: 'Website and Discord identities are now synced. Account configuration changes will create sync events on both sides.', severity: 'success', source: 'pairing', metadata: { discordUserId: finalDiscordId } });
    await saveEcosystemState(state);
    res.json({ ok: true, connection, status: 'connected' });
  });

  app.post('/api/pairing/sync', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required' });
    const linkedDiscordUserId = membership.linkedDiscordUserId || state.discord_connections?.[membership.userId]?.discordUserId || '';
    const pendingCodes = (state.pairing_codes || [])
      .filter((entry) => pairingRecordStatus(entry) === 'pending' && (entry.created_by_user_id === membership.userId || (linkedDiscordUserId && entry.created_by_discord_id === linkedDiscordUserId)))
      .map((entry) => ({ id: entry.id, source: entry.source, created_at: entry.created_at, expires_at: entry.expires_at, status: pairingRecordStatus(entry) }));
    createSyncEvent(state, { userId: membership.userId, source: req.body?.source || 'website', target: 'discord', action: 'manual_pairing_sync', payload: { linkedDiscordUserId, pendingCodes }, status: 'completed' });
    await saveEcosystemState(state);
    res.json({ ok: true, status: 'synced', discordConnected: Boolean(linkedDiscordUserId), pendingCodes, message: linkedDiscordUserId ? 'Website and Discord pairing state synced.' : 'Website sync recorded. Connect Discord to mirror codes both ways.' });
  });

  app.get('/api/pairing/status', async (req, res) => {
    const state = await withState(loadEcosystemState);
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required' });
    const codes = (state.pairing_codes || []).filter((code) => code.created_by_user_id === membership.userId || code.created_by_discord_id === membership.linkedDiscordUserId).map((code) => ({ id: code.id, status: pairingRecordStatus(code), expires_at: code.expires_at, used_at: code.used_at, source: code.source, created_at: code.created_at }));
    res.json({ ok: true, discordConnection: state.discord_connections?.[membership.userId] || null, codes });
  });

  // Discord-facing sync endpoints used by the Discord command center. They write the same state that the website reads.
  app.post('/api/discord/pairing-code', async (req, res) => {
    if (!discordCommandAuthorized(req)) return res.status(401).json({ ok: false, error: 'Discord command API secret failed' });
    const state = ensureState(await loadEcosystemState());
    const discordUserId = String(req.body?.discordUserId || '').trim();
    if (!discordUserId) return res.status(400).json({ ok: false, error: 'discordUserId required' });
    const linkedUserId = findUserIdByDiscordId(state, discordUserId) || '';
    const { code, record } = createPairingRecord(state, { userId: linkedUserId, discordUserId, discordUsername: req.body?.discordUsername || '', source: 'discord' });
    const mt4Registration = await registerMt4PairingCode(mt4SyncService, { code, userId: linkedUserId, discordUserId, accountNickname: req.body?.accountNickname || 'Discord Generated Reporter Bridge', source: 'discord' });
    if (mt4Registration?.expiresAt) record.expires_at = mt4Registration.expiresAt;
    createNotificationEvent(state, { userId: linkedUserId || 'system', type: 'Pairing Code Generated Alert', title: 'Discord Pairing Code Generated', message: 'A Discord pairing code was generated and registered with the MT4/MT5 bridge. The website Account Connection page can sync it when the Discord identity is paired.', severity: 'info', source: 'discord', metadata: { recordId: record.id, mt4Registration } });
    await saveEcosystemState(state);
    res.json({ ok: true, code, expiresAt: record.expires_at, recordId: record.id, mt4Registration });
  });

  app.post('/api/discord/connect', async (req, res) => {
    if (!discordCommandAuthorized(req)) return res.status(401).json({ ok: false, error: 'Discord command API secret failed' });
    const state = ensureState(await loadEcosystemState());
    const code = String(req.body?.code || '').trim();
    const discordUserId = String(req.body?.discordUserId || '').trim();
    const record = findPairingRecord(state, code);
    if (record) record.attempts = Number(record.attempts || 0) + 1;
    const status = pairingRecordStatus(record);
    if (status !== 'pending') { await saveEcosystemState(state); return res.status(400).json({ ok: false, error: `Pairing code is ${status}.`, status }); }
    const userId = record.created_by_user_id || findUserIdByDiscordId(state, discordUserId);
    if (!userId || !discordUserId) return res.status(400).json({ ok: false, error: 'Discord pairing requires a website-generated code and Discord user id.' });
    record.status = 'used'; record.used_at = nowIso();
    const connection = linkDiscordConnection(state, { userId, discordUserId, discordUsername: req.body?.discordUsername || '', guildId: req.body?.guildId || config?.guildId || '', source: 'discord' });
    await saveEcosystemState(state);
    res.json({ ok: true, connection, message: 'Discord connected to website account.' });
  });

  app.get('/api/discord/status', async (req, res) => {
    const state = await loadLiveState();
    const discordUserId = String(req.query.discordUserId || '').trim();
    const membership = await resolveMembership({ req, config, state });
    const userId = membership.userId || findUserIdByDiscordId(state, discordUserId);
    if (!userId) return res.json({ ok: true, connected: false, status: 'unpaired' });
    const connection = state.discord_connections?.[userId] || null;
    const fakeReq = { ...req, query: { userId }, body: {}, headers: req.headers };
    const resolved = await resolveMembership({ req: fakeReq, config, state });
    const liveAccount = getLiveAccountData(state, resolved);
    res.json({ ok: true, connected: Boolean(connection), userId, connection, membership: resolved, liveAccount });
  });

  app.post('/api/discord/sync', async (req, res) => {
    if (req.body?.source === 'discord' && !discordCommandAuthorized(req)) return res.status(401).json({ ok: false, error: 'Discord command API secret failed' });
    const state = ensureState(await loadEcosystemState());
    const discordUserId = String(req.body?.discordUserId || '').trim();
    const membership = await resolveMembership({ req, config, state });
    const userId = membership.userId || findUserIdByDiscordId(state, discordUserId);
    if (!userId) return res.status(404).json({ ok: false, error: 'No paired website account found for this Discord user.' });
    const action = String(req.body?.action || 'discord_manual_sync');
    const payload = req.body?.payload || {};
    createSyncEvent(state, { userId, source: req.body?.source || 'discord', target: req.body?.target || 'website', action, payload, status: 'completed' });
    if (action === 'account_configuration_updated') {
      const { accountId, config: accountConfig } = getAccountConfiguration(state, userId);
      state.account_configurations[userId][accountId] = updateAccountConfigFromBody(accountConfig, payload);
    }
    await saveEcosystemState(state);
    res.json({ ok: true, status: 'synced', userId, action });
  });

  app.get('/api/discord/sync', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.redirect('/login?error=Login required before syncing Discord');
    createSyncEvent(state, { userId: membership.userId, source: 'website', target: 'discord', action: 'manual_resync_link_clicked', payload: {}, status: 'completed' });
    await saveEcosystemState(state);
    res.redirect('/app/account-configuration?sync=1');
  });

  app.delete('/api/discord/disconnect', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required' });
    delete state.discord_connections[membership.userId];
    createNotificationEvent(state, { userId: membership.userId, type: 'Risk Warning Alert', title: 'Discord Disconnected', message: 'Discord was disconnected from the website command center.', severity: 'warning', source: 'website' });
    await saveEcosystemState(state);
    res.json({ ok: true, status: 'disconnected' });
  });

  app.post('/api/discord/disconnect', async (req, res) => {
    if (!discordCommandAuthorized(req)) return res.status(401).json({ ok: false, error: 'Discord command API secret failed' });
    const state = ensureState(await loadEcosystemState());
    const discordUserId = String(req.body?.discordUserId || '').trim();
    const userId = findUserIdByDiscordId(state, discordUserId);
    if (!userId) return res.status(404).json({ ok: false, error: 'No paired website account found for this Discord user.' });
    delete state.discord_connections[userId];
    createNotificationEvent(state, { userId, type: 'Risk Warning Alert', title: 'Discord Disconnected', message: 'Discord disconnected from the website command center.', severity: 'warning', source: 'discord' });
    await saveEcosystemState(state);
    res.json({ ok: true, status: 'disconnected' });
  });

  app.get('/api/discord/notifications', async (req, res) => {
    const state = await withState(loadEcosystemState);
    const discordUserId = String(req.query.discordUserId || '').trim();
    const userId = findUserIdByDiscordId(state, discordUserId);
    if (!userId) return res.status(404).json({ ok: false, error: 'Discord user is not paired to a website account.' });
    res.json({ ok: true, notifications: getUserNotifications(state, userId, Number(req.query.limit || 8)).map((event) => ({ ...event, discordMessage: formatDiscordNotification(event) })) });
  });

  app.post('/api/discord/command-event', async (req, res) => {
    if (!discordCommandAuthorized(req)) return res.status(401).json({ ok: false, error: 'Discord command API secret failed' });
    const state = ensureState(await loadEcosystemState());
    const discordUserId = String(req.body?.discordUserId || '').trim();
    const userId = findUserIdByDiscordId(state, discordUserId);
    if (!userId) return res.status(403).json({ ok: false, error: 'Discord user is not paired to a website account.' });
    const fakeReq = { ...req, query: { userId }, body: {}, headers: req.headers };
    const resolved = await resolveMembership({ req: fakeReq, config, state });
    const action = String(req.body?.action || 'discord_command');
    let mapped = mapActionToMt4Command({ action, ...(req.body?.payload || {}), source: 'discord' });
    const tradingAction = Boolean(req.body?.execute === true || req.body?.mt4 === true || isKnownExecutableAction(action) || mapped.command !== 'CEM_SET_GLOBALS');
    if (tradingAction && !canExecuteTradingAction(resolved)) {
      const attempt = { id: id('discord_blocked'), userId, action, allowed: false, role: resolved.role, subscription_status: resolved.subscription_status, source: 'discord', createdAt: nowIso(), reason: 'Culture Coin membership/account gate blocked this Discord trading command.' };
      state.tradeCopyAttempts.push(attempt);
      createNotificationEvent(state, { userId, type: 'Blocked Action Alert', title: 'Copier Blocked', message: 'Culture Coin Reporter is active, but trade copying requires active Culture Coin membership, copier enabled, and a connected account.', severity: 'warning', source: 'discord', metadata: attempt });
      await saveEcosystemState(state);
      return res.status(403).json({ ok: false, error: attempt.reason, attempt });
    }
    let queued = null;
    if (tradingAction) {
      const liveData = getLiveAccountData(state, resolved);
      queued = await queueMt4ReporterCommand({ mt4CommandService, membership: resolved, state, liveData, body: { action, ...(req.body?.payload || {}), immediate: true }, origin: 'discord' });
      if (queued?.confirmationRequired) {
        mapped = queued.mapped;
        createNotificationEvent(state, { userId, type: 'Command Confirmation Required', title: 'MT4 Confirmation Required', message: `${mapped.command} needs confirmation before it can be queued to MT4.`, severity: 'warning', source: 'discord', metadata: { ...(req.body?.payload || {}), confirmationId: queued.confirmationId, phrase: queued.phrase, mt4Command: mapped.command } });
        await saveEcosystemState(state);
        return res.status(202).json({ ...queued, action, status: 'confirmation_required' });
      }
      if (!queued?.ok) return res.status(503).json({ ok: false, error: queued?.error || 'MT4 command service unavailable', mt4Command: mapped.command });
      mapped = queued.mapped;
    }
    createSyncEvent(state, { userId, source: 'discord', target: tradingAction ? 'mt4_bridge' : 'website', action: tradingAction ? mapped.command : action, payload: req.body?.payload || {}, status: 'completed' });
    createNotificationEvent(state, { userId, type: 'Command Executed Alert', title: 'Discord Control', message: tradingAction ? `Discord command ${action} was mapped to ${mapped.command} and queued for MT4.` : `User triggered ${action} from Discord. Website state was updated.`, severity: 'success', source: 'discord', metadata: { ...(req.body?.payload || {}), commandId: queued?.record?.id, mt4Command: mapped.command } });
    await saveEcosystemState(state);
    res.json({ ok: true, status: tradingAction ? 'queued_waiting_for_mt4_poll' : 'synced', action, mt4Command: mapped.command, commandId: queued?.record?.id });
  });

  // Notification chat routes shared by the dashboard and Discord notification bridge.
  app.get('/api/notifications', async (req, res) => {
    const state = await withState(loadEcosystemState);
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required' });
    const type = String(req.query.type || '').toLowerCase();
    let rows = getUserNotifications(state, membership.userId, Number(req.query.limit || 50));
    if (type && type !== 'all') rows = rows.filter((event) => String(event.type || '').toLowerCase().includes(type) || String(event.severity || '').toLowerCase().includes(type));
    res.json({ ok: true, notifications: rows });
  });

  app.post('/api/notifications', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    const membership = await resolveMembership({ req, config, state });
    const userId = membership.userId || req.body?.userId || findUserIdByDiscordId(state, req.body?.discordUserId || '') || 'system';
    const event = createNotificationEvent(state, { userId, tradingAccountId: req.body?.tradingAccountId || '', discordConnectionId: req.body?.discordConnectionId || '', type: req.body?.type || 'Culture Coin Reporter Alert', title: req.body?.title || 'Wisdo Alert', message: req.body?.message || '', severity: req.body?.severity || 'info', source: req.body?.source || 'website', metadata: req.body?.metadata || {} });
    await saveEcosystemState(state);
    res.json({ ok: true, notification: event, discordMessage: formatDiscordNotification(event) });
  });

  app.patch('/api/notifications/read', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required' });
    for (const event of state.notification_events || []) {
      if ((req.body?.all && String(event.userId) === String(membership.userId)) || String(event.id) === String(req.body?.id || '')) event.read_status = 'read';
    }
    await saveEcosystemState(state);
    res.json({ ok: true });
  });

  app.post('/api/notifications/test', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required' });
    const event = createNotificationEvent(state, { userId: membership.userId, type: 'Profit Moving Alert', title: 'Profit Moving', message: 'Account is up +$42.18 and moving in the right direction. Daily goal progress: 37%.', severity: 'success', source: 'test' });
    await saveEcosystemState(state);
    res.json({ ok: true, notification: event });
  });

  app.post('/api/account/metrics', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    const membership = await resolveMembership({ req, config, state });
    const userId = membership.userId || String(req.body?.userId || '').trim();
    if (!userId) return res.status(401).json({ ok: false, error: 'userId or login required' });
    const created = evaluateMetricNotifications(state, { userId, tradingAccountId: req.body?.tradingAccountId || 'default', metrics: req.body?.metrics || req.body || {}, source: req.body?.source || 'bridge' });
    await saveEcosystemState(state);
    res.json({ ok: true, notificationsCreated: created.length, notifications: created });
  });
  // The legacy remodel route is intentionally opt-in. Registering it by default
  // intercepts the authoritative /mt4-sync route and performs a second full
  // ecosystem-state write on every Reporter heartbeat.
  if (String(process.env.ENABLE_LEGACY_DEADSHOT_MT4_SYNC || 'false').toLowerCase() === 'true') {
    app.post(config?.api?.mt4SyncPath || '/mt4-sync', async (req, res) => {
      try {
        if (!mt4SyncService?.receiveSnapshot) return res.status(501).json({ ok: false, error: 'MT4 sync service is not available. Use npm run start:web after the live repository patch or run npm start.' });
        const result = await mt4SyncService.receiveSnapshot(req.body, req.headers);
        if (result?.coalesced) return res.status(202).json(result);
        const state = ensureState(await loadEcosystemState());
        const bridgeUserId = String(result?.discordUserId || req.body?.userId || '').trim();
        const userId = findUserIdByDiscordId(state, bridgeUserId) || bridgeUserId;
        const accountId = String(result?.accountId || req.body?.tradingAccountId || req.body?.accountId || 'default');
        state.connected_accounts[userId] ||= {};
        state.connected_accounts[userId][accountId] = {
          accountId,
          platform: req.body?.platform || 'MT4/MT5',
          name: req.body?.accountName || req.body?.nickname || 'Culture Coin Reporter Bridge',
          broker: req.body?.broker || req.body?.brokerServer || '',
          accountNumber: req.body?.accountNumber || '',
          status: 'connected_live_bridge',
          lastSyncAt: nowIso(),
          bridgeUserId,
        };
        state.trade_copier_access[userId] = { ...(state.trade_copier_access[userId] || {}), enabled: state.trade_copier_access[userId]?.enabled !== false, accountConnected: true, updatedAt: nowIso() };
        const created = evaluateMetricNotifications(state, { userId, tradingAccountId: accountId, metrics: req.body || {}, source: 'mt4_bridge' });
        if (!state.admin_logs.some((log) => log.action === 'live_bridge_connected' && log.userId === userId && log.accountId === accountId)) {
          createNotificationEvent(state, { userId, tradingAccountId: accountId, type: 'Account Connected Alert', title: 'Trading Bridge Connected', message: 'Culture Coin Reporter sent a real MT4/MT5 snapshot. Dashboard balance, equity, floating P/L, and trades now read from live telemetry.', severity: 'success', source: 'mt4_bridge', metadata: { accountId, bridgeUserId } });
        }
        state.admin_logs.push({ id: id('admin_log'), action: 'live_bridge_sync', userId, accountId, bridgeUserId, createdAt: nowIso(), notificationsCreated: created.length });
        await saveEcosystemState(state);
        res.json({ ...result, websiteSynced: true, websiteUserId: userId, notificationsCreated: created.length });
      } catch (error) {
        logger?.error?.('Deadshot MT4 sync failed', { message: error.message, stack: error.stack });
        res.status(error.statusCode || 500).json({ ok: false, error: error.message });
      }
    });
  }


  // Copier API aliases. Execution remains backend-gated.
  app.get('/api/copier/status', async (req, res) => {
    const state = await withState(loadEcosystemState);
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required' });
    res.json({ ok: true, status: membership.canCopyTrades ? 'unlocked' : 'locked', membership, copier: state.trade_copier_access?.[membership.userId] || null });
  });

  app.post('/api/copier/validate-access', async (req, res) => {
    const state = await withState(loadEcosystemState);
    const membership = await resolveMembership({ req, config, state });
    const allowed = canExecuteTradingAction(membership);
    res.status(allowed ? 200 : 403).json({ ok: allowed, allowed, membership, error: allowed ? '' : 'Trade copying requires active Culture Coin membership, copier enabled, and a connected trading account.' });
  });

  app.get('/api/copier/logs', async (req, res) => {
    const state = await withState(loadEcosystemState);
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required' });
    res.json({ ok: true, logs: getUserCopierLogs(state, membership.userId, Number(req.query.limit || 50)) });
  });

  app.post('/api/copier/action', async (req, res) => {
    return res.redirect(307, '/api/trade-copy/action');
  });


  app.post('/api/deadshot/active-account', async (req, res) => {
    const state = await loadLiveState();
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required' });
    const accountId = getRequestedAccountId(req.body || {});
    if (!accountId) return res.status(400).json({ ok: false, error: 'accountId required' });
    let mt4 = {};
    try {
      mt4 = mt4SyncService?.repository?.loadMt4State ? await mt4SyncService.repository.loadMt4State() : readMt4LiveState(state);
    } catch { mt4 = readMt4LiveState(state); }
    if (!isAccountAccessibleForMember(mt4, membership, accountId, { requireControl: true }) && membership.role !== 'admin') return res.status(403).json({ ok: false, error: 'That account is not linked to your desk or shared with control/copy permission.' });
    if (mt4SyncService?.repository?.updateMt4State) {
      await mt4SyncService.repository.updateMt4State((draft) => {
        draft.activeAccountByUserId ||= {};
        for (const lookupId of userLookupIds(membership)) draft.activeAccountByUserId[lookupId] = accountId;
        return draft;
      });
    } else {
      state.mt4Live ||= {};
      state.mt4Live.activeAccountByUserId ||= {};
      for (const lookupId of userLookupIds(membership)) state.mt4Live.activeAccountByUserId[lookupId] = accountId;
      await saveEcosystemState(state);
    }
    createNotificationEvent(state, { userId: membership.userId, type: 'Sync Completed Alert', title: 'Active Account Switched', message: `Website desk selected account ${accountId}. Mobile and desktop command buttons now relay to that account.`, severity: 'success', source: 'website', metadata: { accountId } });
    await saveEcosystemState(state);
    res.json({ ok: true, accountId, message: 'Active account selected for website, mobile controls, WISDO commands, and copier relay.' });
  });

  app.post('/api/affiliates/signup', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    state.affiliatesById ||= {};
    state.affiliatePayouts ||= [];
    const membership = await resolveMembership({ req, config, state });
    const name = String(req.body?.name || membership.user?.username || '').trim();
    const email = normalizeEmail(req.body?.email || membership.user?.email || '');
    const phone = String(req.body?.phone || '').trim();
    const payoutHandle = String(req.body?.payoutHandle || req.body?.cashApp || req.body?.paypal || '').trim();
    const splitPercent = Math.max(1, Math.min(80, Number(req.body?.splitPercent || process.env.WISDO_AFFILIATE_DEFAULT_SPLIT || 30)));
    const activationProductId = String(req.body?.activationProductId || 'setup-fee');
    const affiliateId = id('affiliate');
    const referralCode = String(req.body?.referralCode || `${(name || email || affiliateId).replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`);
    state.affiliatesById[affiliateId] = { affiliateId, userId: membership.userId || '', name, email, phone, payoutHandle, splitPercent, referralCode, activationProductId, status: 'activation_due', createdAt: nowIso(), signupSource: 'website_affiliate_portal' };
    const product = PRODUCTS.find((p) => p.id === activationProductId) || PRODUCTS.find((p) => p.id === 'setup-fee');
    let checkoutUrl = '';
    if (membership.userId && product) checkoutUrl = await createSquareCheckout({ config, state, userId: membership.userId, product, req, affiliateContext: { affiliateId, referralCode, splitPercent, signupType: 'affiliate_activation' } });
    if (!checkoutUrl && product) {
      const paymentId = id('payment');
      state.payments[paymentId] = { id: paymentId, productId: product.id, affiliateId, userId: membership.userId || 'guest', amount: product.price, status: 'manual_affiliate_activation_pending', accessGranted: false, createdAt: nowIso() };
    }
    await saveEcosystemState(state);
    res.json({ ok: true, affiliateId, referralCode, splitPercent, status: 'activation_due', checkoutUrl, message: checkoutUrl ? 'Affiliate created. Send user to checkoutUrl to pay activation today.' : 'Affiliate created with manual activation due because Square is not configured.' });
  });


  // Checkout/session API with Square or manual-invoice fallback.
  app.post('/api/checkout/session', async (req, res) => {
    try {
      const state = ensureState(await loadEcosystemState());
      const membership = await resolveMembership({ req, config, state });
      const product = PRODUCTS.find((p) => p.id === req.body?.productId);
      if (!product) return res.status(404).json({ ok: false, error: 'Product not found' });
      if (product.mode === 'free') return res.json({ ok: true, url: '/signup' });
      if (!membership.userId) return res.status(401).json({ ok: false, error: 'Create an account or login before checkout so billing can activate the correct member.', url: `/signup?product=${encodeURIComponent(product.id)}` });
      const url = await createSquareCheckout({ config, state, userId: membership.userId, product, req });
      if (url) return res.json({ ok: true, url });
      // Manual-invoice fallback: records a real pending order; access stays locked until payment is confirmed.
      const paymentId = id('payment');
      state.payments[paymentId] = { id: paymentId, productId: product.id, userId: membership.userId || 'guest', amount: product.price, status: 'manual_invoice_pending', accessGranted: false, createdAt: nowIso() };
      await saveEcosystemState(state);
      res.json({ ok: true, checkoutMode: 'manual_invoice_pending', paymentId, message: 'Live price/order saved. Square is not configured, so access remains locked until admin confirms payment.' });
    } catch (error) {
      logger?.error?.('Checkout session failed', { message: error.message });
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  async function guardLegacyTradingAction(req, res, next, actionName, requireConnectedAccount = true) {
    const state = ensureState(await loadEcosystemState());
    const membership = await resolveMembership({ req, config, state });
    const allowedByMembership = membership.subscription_status === 'active' && ['culture_coin_member_active', 'admin'].includes(membership.role);
    const allowed = allowedByMembership && (!requireConnectedAccount || membership.accountConnected || membership.role === 'admin');
    if (allowed) return next();
    const attempt = {
      id: id('blocked_legacy_action'),
      userId: membership.userId || req.body?.userId || req.params?.discordUserId || 'guest',
      action: actionName,
      allowed: false,
      role: membership.role,
      subscription_status: membership.subscription_status,
      source: membership.source,
      createdAt: nowIso(),
      reason: !allowedByMembership ? 'Culture Coin membership is not active for this trading action' : 'Trading account is not connected for this trading action',
    };
    state.tradeCopyAttempts.push(attempt);
    createNotificationEvent(state, { userId: attempt.userId, type: 'Blocked Action Alert', title: 'Legacy Trading Action Blocked', message: attempt.reason, severity: 'warning', source: 'backend_gate', metadata: attempt });
    await saveEcosystemState(state);
    return res.status(403).json({ ok: false, error: attempt.reason, attempt });
  }

  async function processWisdoWakeCommand(req, res, defaults = {}) {
    const state = await loadLiveState();
    const body = { ...defaults, ...(req.body || {}) };
    const discordUserId = String(body.discordUserId || '').trim();
    const pairedUserId = discordUserId ? findUserIdByDiscordId(state, discordUserId) : '';
    const membershipReq = pairedUserId && !getSessionUser(req) ? { ...req, query: { ...(req.query || {}), userId: pairedUserId }, body: {}, headers: req.headers } : req;
    const membership = await resolveMembership({ req: membershipReq, config, state });
    const allowed = canExecuteTradingAction(membership);
    const rawText = body.rawText || body.rawCommand || body.text || defaults.rawText || '';
    const mapped = mapActionToMt4Command({ ...body, rawText, source: body.source || 'wisdo_wake_word' });
    const attempt = { id: id('wisdo_attempt'), userId: membership.userId || 'guest', action: mapped.command, rawText, allowed, role: membership.role, subscription_status: membership.subscription_status, source: 'wisdo', createdAt: nowIso(), reason: allowed ? 'Accepted into immediate MT4 command queue' : 'Culture Coin membership/account gate blocked Wisdo execution.' };
    state.tradeCopyAttempts.push(attempt);
    const requestedAccountId = getRequestedAccountId(body || req.query || {});
    const liveData = getLiveAccountData(state, membership, requestedAccountId);
    if (requestedAccountId && !liveData.selectionMatched) {
      attempt.allowed = false;
      attempt.reason = 'Selected account is not owned/shared with this user, so WISDO refused to relay the command.';
    }
    let queued = null;
    if (attempt.allowed) queued = await queueMt4ReporterCommand({ mt4CommandService, membership, state, liveData, body: { ...body, rawText, action: mapped.command, accountId: liveData.accountId, immediate: true }, origin: 'wisdo_wake_word' });
    if (queued?.confirmationRequired) {
      attempt.status = 'confirmation_required';
      attempt.reason = 'Confirmation required before MT4 queue';
      createNotificationEvent(state, { userId: attempt.userId, type: 'Command Confirmation Required', title: 'Wisdo Confirmation Required', message: `${queued.mt4Command} needs confirmation before it can be queued to MT4.`, severity: 'warning', source: 'wisdo', metadata: { ...attempt, confirmationId: queued.confirmationId, phrase: queued.phrase, mt4Command: queued.mt4Command } });
      createSyncEvent(state, { userId: attempt.userId, source: 'wisdo', target: 'website', action: 'confirmation_required', payload: attempt, status: 'confirmation_required' });
      await saveEcosystemState(state);
      return res.status(202).json({ ...queued, attempt });
    }
    createNotificationEvent(state, { userId: attempt.userId, type: attempt.allowed ? 'Command Executed Alert' : 'Blocked Action Alert', title: attempt.allowed ? 'Wisdo Wake Word Queued' : 'Wisdo Command Blocked', message: attempt.allowed ? `“${rawText || mapped.command}” was deciphered as ${mapped.command} and queued for the MT4 reporter.` : attempt.reason, severity: attempt.allowed ? 'success' : 'warning', source: 'wisdo', metadata: { ...attempt, queuedCommandId: queued?.record?.id } });
    createSyncEvent(state, { userId: attempt.userId, source: 'wisdo', target: 'mt4_bridge', action: mapped.command, payload: attempt, status: attempt.allowed ? 'completed' : 'blocked' });
    await saveEcosystemState(state);
    if (!attempt.allowed) return res.status(403).json({ ok: false, error: attempt.reason, attempt, mt4Command: mapped.command });
    if (!queued?.ok) return res.status(503).json({ ok: false, error: queued?.error || 'MT4 command service unavailable', mt4Command: mapped.command });
    return res.json({ ok: true, status: 'queued_waiting_for_mt4_poll', mt4Command: mapped.command, commandId: queued.record.id, pollUrl: queued.pollUrl, completeUrl: queued.completeUrl, attempt });
  }

  app.post('/api/wisdo/command', (req, res) => processWisdoWakeCommand(req, res));
  app.post('/api/wisdo/protect', (req, res) => processWisdoWakeCommand(req, res, { action: 'lock_profit', rawText: 'hey coach lock profit' }));
  app.post('/api/wisdo/harvest', (req, res) => processWisdoWakeCommand(req, res, { action: 'close_profitable', rawText: 'hey coach close all profitable trades' }));
  app.post('/api/copy-links', (req, res, next) => guardLegacyTradingAction(req, res, next, 'legacy_copy_link_create', false));
  app.post('/api/trade-link/start', (req, res, next) => guardLegacyTradingAction(req, res, next, 'legacy_trade_link_start', false));
  app.post('/api/accounts/:discordUserId/session-rules', (req, res, next) => guardLegacyTradingAction(req, res, next, 'legacy_session_rule_command', true));

  // Backward-compatible guard: old demo bridge buttons now refuse to create fake accounts.
  app.post('/api/deadshot/connect-demo-bridge', async (req, res) => {
    const state = await loadLiveState();
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required before connecting a trading bridge.' });
    createNotificationEvent(state, { userId: membership.userId, type: 'Risk Warning Alert', title: 'Demo Bridge Disabled', message: 'Fake demo bridge creation is disabled. Generate a real pairing code and let MT4 Reporter send live telemetry.', severity: 'warning', source: 'website', metadata: { route: '/api/deadshot/connect-demo-bridge' } });
    await saveEcosystemState(state);
    res.status(410).json({ ok: false, error: 'Demo bridge is disabled. Use /api/pairing/generate, paste the code into MT4 Reporter, and wait for a real account snapshot.' });
  });

  // Core copier gate. Reporter is allowed, execution is not.
  app.post('/api/trade-copy/action', async (req, res) => {
    const state = await loadLiveState();
    const membership = await resolveMembership({ req, config, state });
    const attempt = { id: id('copy_attempt'), userId: membership.userId || 'guest', action: req.body?.action || 'unknown', allowed: false, role: membership.role, source: membership.source, createdAt: nowIso(), reason: '' };
    if (!membership.userId) attempt.reason = 'User is not authenticated';
    else if (membership.subscription_status !== 'active' && membership.role !== 'admin') attempt.reason = 'Culture Coin subscription/role status is not active';
    else if (!['culture_coin_member_active', 'admin'].includes(membership.role)) attempt.reason = 'Culture Coin membership is not active';
    else if (!membership.copierEnabled) attempt.reason = 'Copier is disabled for this user';
    else if (!membership.accountConnected) attempt.reason = 'Trading account is not connected';
    else { attempt.allowed = true; attempt.reason = 'Accepted into command queue'; }
    state.tradeCopyAttempts.push(attempt);
    const requestedAccountId = getRequestedAccountId(req.body || req.query || {});
    const liveData = getLiveAccountData(state, membership, requestedAccountId);
    if (requestedAccountId && !liveData.selectionMatched) {
      attempt.allowed = false;
      attempt.reason = 'Selected account is not owned/shared with this user, so the copier refused to relay the command.';
    }
    attempt.accountId = liveData.accountId;
    let queued = null;
    let mapped = mapActionToMt4Command(req.body || {});
    if (attempt.allowed) {
      queued = await queueMt4ReporterCommand({ mt4CommandService, membership, state, liveData, body: { ...(req.body || {}), accountId: liveData.accountId, immediate: true }, origin: 'website_button' });
      if (queued?.confirmationRequired) {
        mapped = queued.mapped;
        attempt.status = 'confirmation_required';
        attempt.reason = 'Confirmation required before MT4 queue';
        attempt.mt4Command = queued.mt4Command;
        attempt.confirmationId = queued.confirmationId;
        attempt.confirmationPhrase = queued.phrase;
      } else if (!queued?.ok) {
        attempt.allowed = false;
        attempt.reason = queued?.error || 'MT4 command service unavailable';
      } else {
        mapped = queued.mapped;
        attempt.commandId = queued.record.id;
        attempt.mt4Command = queued.mapped.command;
        attempt.pollUrl = queued.pollUrl;
      }
    }
    createNotificationEvent(state, {
      userId: attempt.userId,
      type: attempt.allowed ? 'Command Executed Alert' : 'Blocked Action Alert',
      title: attempt.allowed ? 'MT4 Command Queued' : 'Copier Blocked',
      message: attempt.allowed
        ? `${mapped.command} was accepted into the immediate queue. Waiting for the MT4 reporter to poll /mt4-command-poll and complete at /mt4-command-complete.`
        : 'Culture Coin Reporter is active, but trade copying requires an active Culture Coin membership, copier enabled, and a connected trading account.',
      severity: attempt.allowed ? 'success' : 'warning',
      source: 'website',
      metadata: attempt,
    });
    createSyncEvent(state, { userId: attempt.userId, source: 'website', target: attempt.allowed ? 'mt4_bridge' : 'discord', action: attempt.allowed ? mapped.command : 'blocked_copier_attempt', payload: attempt, status: attempt.allowed ? 'completed' : 'blocked' });
    await saveEcosystemState(state);
    if (queued?.confirmationRequired) return res.status(202).json({ ...queued, attempt });
    if (!attempt.allowed) return res.status(403).json({ ok: false, error: attempt.reason, attempt, mt4Command: mapped.command });
    res.json({ ok: true, status: 'queued_waiting_for_mt4_poll', attempt, mt4Command: mapped.command, commandId: queued.record.id, pollUrl: queued.pollUrl, completeUrl: queued.completeUrl, immediate: true });
  });

  app.post('/api/command/confirm', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required' });
    const confirmationId = String(req.body?.confirmationId || '').trim();
    const confirmation = state.pending_mt4_confirmations?.[confirmationId];
    if (!confirmation || confirmation.status !== 'pending') return res.status(404).json({ ok: false, error: 'Confirmation not found or already used.' });
    if (String(confirmation.userId || '') !== String(membership.userId)) return res.status(403).json({ ok: false, error: 'Confirmation belongs to another user.' });
    const phrase = String(req.body?.confirmationPhrase || req.body?.phrase || '').trim().toUpperCase();
    if (phrase !== String(confirmation.phrase || '').trim().toUpperCase()) return res.status(400).json({ ok: false, error: 'Confirmation phrase did not match.' });
    const liveData = getLiveAccountData(state, membership, confirmation.accountId);
    const queued = await queueMt4ReporterCommand({
      mt4CommandService,
      membership,
      state,
      liveData,
      body: { ...(confirmation.payload || {}), action: confirmation.command, command: confirmation.command, confirmation: 'confirmed', confirmationId, confirmationPhrase: phrase, immediate: true },
      origin: confirmation.origin || 'website_confirmation',
    });
    await saveEcosystemState(state);
    if (!queued?.ok || queued?.confirmationRequired) return res.status(400).json({ ok: false, error: queued?.error || 'Command still requires confirmation.', queued });
    res.json({ ok: true, status: 'queued_waiting_for_mt4_poll', mt4Command: queued.mapped.command, commandId: queued.record.id, pollUrl: queued.pollUrl, completeUrl: queued.completeUrl, record: queued.record });
  });

  app.get('/api/command/status', async (req, res) => {
    const state = await loadLiveState();
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required' });
    const commandId = String(req.query.commandId || '').trim();
    if (!commandId) return res.status(400).json({ ok: false, error: 'commandId required' });
    const liveData = getLiveAccountData(state, membership, getRequestedAccountId(req.query || {}));
    const command = await getCommandStatusForMembership(mt4CommandService, membership, commandId, liveData.accountId);
    res.json({ ok: Boolean(command), status: command?.status || 'not_found', command, pollUrl: '/mt4-command-poll', note: 'Immediate queue means the command is first in line; MT4 still must poll the server from the reporter timer. Status lookup checks website, Discord, and bridge-linked identities.' });
  });

  app.get('/api/command/queue-status', async (req, res) => {
    const state = await loadLiveState();
    const membership = await resolveMembership({ req, config, state });
    if (!membership.userId) return res.status(401).json({ ok: false, error: 'Login required' });
    const liveData = getLiveAccountData(state, membership, getRequestedAccountId(req.query || {}));
    const queue = await getQueueStatusForMembership(mt4CommandService, membership, liveData.accountId);
    res.json({ ok: Boolean(queue), queue, pollUrl: '/mt4-command-poll' });
  });

  // Admin membership controls.
  app.post('/api/admin/membership', async (req, res) => {
    const state = ensureState(await loadEcosystemState());
    const adminMembership = await resolveMembership({ req, config, state });
    if (adminMembership.role !== 'admin') return res.status(403).json({ ok: false, error: 'Admin access required' });
    const userId = String(req.body?.userId || '').trim();
    const status = String(req.body?.status || '').trim();
    if (!userId || !status) return res.status(400).json({ ok: false, error: 'userId and status required' });
    state.memberships[userId] = { ...(state.memberships[userId] || {}), userId, status, source: 'admin_manual', updatedAt: nowIso() };
    const discordUserId = state.discord_connections?.[userId]?.discordUserId || (String(userId).match(/^\d+$/) ? userId : '');
    const roleGrant = status === 'manual_active' ? await grantDiscordCultureCoinRole(config, discordUserId) : { ok: false, skipped: true, reason: 'Role grant only runs on manual_active.' };
    state.admin_logs.push({ id: id('admin_log'), action: 'membership_update', adminUserId: adminMembership.userId, userId, status, roleGrant, createdAt: nowIso() });
    await saveEcosystemState(state);
    res.redirect('/admin/users');
  });

  // Portal routes.
  app.get(['/app', '/dashboard', '/member', '/member/home'], (req, res) => res.redirect('/app/dashboard'));
  for (const page of ['dashboard','notifications','subscriptions','membership','connect-account','advanced-link','community-reporters','discord-copier','education','seminars','account-configuration','wisdo-command-center','copier-engine','copier-logs','account-trades','performance','reporter','billing','profile']) {
    app.get(`/app/${page}`, async (req, res) => {
      const state = await loadLiveState();
      const membership = await resolveMembership({ req, config, state });
      if (membership.role === 'guest') return res.redirect('/login?error=Please login first');
      const selectedAccountId = getRequestedAccountId(req.query || {});
      res.send(shell({ title: pageTitle(page), body: portalPage(page, membership, state, selectedAccountId), active: `/app/${page}`, mode: 'portal', membership }));
    });
  }
  // Friendly aliases from the old website to the new structure.
  const memberAliases = {
    '/member/subscriptions': '/app/subscriptions', '/member/payment-plans': '/app/subscriptions', '/member/link-account': '/app/connect-account', '/member/accounts': '/app/connect-account', '/member/copy': '/app/copier-engine', '/member/copy-pro': '/app/copier-engine', '/member/wisdo': '/app/wisdo-command-center', '/member/risk-profile': '/app/account-configuration', '/member/trade-results': '/app/account-trades', '/member/settings': '/app/profile', '/member/support': '/contact',
    '/app/copier': '/app/copier-engine', '/app/copy': '/app/copier-engine', '/app/copy-pro': '/app/copier-engine', '/app/trade-copier': '/app/copier-engine', '/copier-engine': '/app/copier-engine', '/app/trade-results': '/app/account-trades', '/app/trade-history': '/app/account-trades', '/app/discord': '/app/discord-copier', '/app/academy': '/app/education', '/app/seminar': '/app/seminars', '/app/discord-connect': '/app/discord-copier', '/app/trading-signals': '/app/discord-copier', '/app/bot-control': '/app/wisdo-command-center', '/app/risk': '/app/account-configuration', '/app/dashboard/memeber': '/app/dashboard', '/app/dashboard/member': '/app/dashboard', '/app/memeber': '/app/dashboard', '/app/member': '/app/dashboard', '/app/members': '/app/dashboard'
  };
  for (const [from, to] of Object.entries(memberAliases)) app.get(from, (req, res) => res.redirect(to));

  // Admin routes.
  app.get('/admin', async (req, res) => { const state = await withState(loadEcosystemState); const membership = await resolveMembership({ req, config, state }); if (membership.role !== 'admin') return res.status(403).send(shell({ title: 'Admin Protected', body: adminDeniedPage(), active: '/admin', mode: 'public' })); res.send(shell({ title: 'Admin', body: adminPage('dashboard', state), active: '/admin', mode: 'admin' })); });
  app.get('/admin/growth-funnel', async (req, res) => {
    const state = await withState(loadEcosystemState);
    const membership = await resolveMembership({ req, config, state });
    if (membership.role !== 'admin') return res.status(403).send(shell({ title: 'Admin Protected', body: adminDeniedPage(), active: '/admin', mode: 'public' }));
    const dashboard = await growthFunnelService.dashboard();
    const delivery = notificationDeliveryService.providerHealth();
    return res.send(shell({ title: 'Admin Growth Funnel', body: growthFunnelAdminPage(dashboard, delivery, state), active: '/admin/growth-funnel', mode: 'admin' }));
  });
  for (const page of ['users','active-members','inactive-members','subscriptions','payments','products','leads','copier-access','reporter-settings','notifications','feedback','support-tickets','licenses']) {
    app.get(`/admin/${page}`, async (req, res) => { const state = await withState(loadEcosystemState); const membership = await resolveMembership({ req, config, state }); if (membership.role !== 'admin') return res.status(403).send(shell({ title: 'Admin Protected', body: adminDeniedPage(), active: '/admin', mode: 'public' })); res.send(shell({ title: `Admin ${page}`, body: adminPage(page, state), active: `/admin/${page}`, mode: 'admin' })); });
  }

  // Block old frontend surfaces from rendering the previous website design.
  app.get(/^\/member\/.+/, (req, res) => res.redirect('/app/dashboard'));
  app.get(/^\/admin\/.+/, async (req, res) => {
    const state = await withState(loadEcosystemState);
    const membership = await resolveMembership({ req, config, state });
    if (membership.role !== 'admin') return res.status(403).send(shell({ title: 'Admin Protected', body: adminDeniedPage(), active: '/admin', mode: 'public' }));
    return res.redirect('/admin');
  });
  app.get('/feed', (req, res) => res.redirect('/tunnel'));
  app.get(/^\/r\/.+/, (req, res) => res.redirect('/tunnel'));
  app.get(/^\/u\/.+/, (req, res) => res.redirect('/tunnel'));
  app.get(/^\/join\/.+/, (req, res) => res.redirect('/tunnel'));
}
