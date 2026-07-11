import crypto from 'node:crypto';
import Stripe from 'stripe';
import webpush from 'web-push';

import { computePrice } from './majorUpgradeRoutes.js';
import { getSessionUser } from './security.js';
import {
  ACADEMY_COURSE_COUNT,
  ACADEMY_DOMAINS,
  ACADEMY_LEVELS,
  buildFallbackTutorReply,
  buildInteractiveLesson,
  buildPersonalizedPath,
  getAcademyCourse,
  getAcademySummary,
  getDfSauceScenario,
  searchAcademyCourses,
} from '../services/academyCatalogService.js';
import {
  calculateTradingTool,
  getEducationHubSummary,
  getLiveLearning,
  getTradingTools,
  searchEducationResources,
  suggestedQuestionsForPage,
} from '../services/educationHubService.js';

const ACADEMY_TRACKS = [
  { id: 'foundation', title: 'Trading and Investing Foundations', lessons: ['candlesticks-price-bars', 'market-structure', 'order-types-execution', 'position-sizing', 'trading-plan'] },
  { id: 'risk-money', title: 'Risk, Money, and Wealth Management', lessons: ['drawdown-risk-of-ruin', 'portfolio-risk', 'cash-flow-budgeting', 'saving-compounding', 'retirement-investing'] },
  { id: 'markets', title: 'Global Markets and Asset Classes', lessons: ['forex-foundations', 'equities-foundations', 'futures-foundations', 'options-foundations', 'bonds-rates', 'commodities', 'crypto-digital-assets'] },
  { id: 'strategies', title: 'Trading Strategies and Research', lessons: ['day-trading', 'swing-trading', 'momentum-trend-following', 'mean-reversion', 'backtesting-validation', 'statistics-probability'] },
  { id: 'professional', title: 'Professional Trading Practice', lessons: ['journaling-review', 'performance-routines', 'tax-recordkeeping', 'regulation-ethics', 'business-of-trading'] },
  { id: 'wisdo', title: 'WISDO Systems and DF Sauce', lessons: ['wisdo-command-center', 'copy-trading', 'wisdo-copier-operations', 'wisdo-account-health', 'df-sauce-campaign-character'] },
];

function nowIso() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }
function bool(value) { return value === true || ['true', '1', 'yes', 'on'].includes(String(value || '').toLowerCase()); }
function safeRole(value) { return ['user', 'premium', 'admin'].includes(value) ? value : 'user'; }
function currentUser(req) {
  const session = getSessionUser(req);
  if (session?.id) return session;
  if ((process.env.NODE_ENV === 'test' || bool(process.env.WISDO_ALLOW_TEST_IDENTITY)) && req.headers['x-wisdo-test-user']) {
    return { id: String(req.headers['x-wisdo-test-user']), username: 'Test Operator', roles: ['admin'] };
  }
  return null;
}
function ensure(state = {}) {
  state.usersById ||= {};
  state.profiles ||= {};
  state.userRoles ||= {};
  state.tradingAccounts ||= {};
  state.accountShares ||= {};
  state.subscriptions ||= {};
  state.alerts ||= {};
  state.pushSubscriptions ||= {};
  state.academyProgress ||= {};
  state.learnerProfiles ||= {};
  state.academyTutorThreads ||= {};
  state.educationBookmarks ||= {};
  state.wisdoAssistantThreads ||= {};
  state.wisdoAssistantUsage ||= {};
  state.supportTickets ||= {};
  state.firms ||= {};
  state.affiliates ||= {};
  state.affiliateConversions ||= {};
  state.auditLog ||= [];
  return state;
}
function isAdmin(state, user) {
  const roles = new Set([...(user?.roles || []), ...(state.userRoles?.[user?.id] || [])]);
  return roles.has('admin') || user?.role === 'admin' || String(process.env.OWNER_USER_ID || '') === String(user?.id || '');
}
function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Authentication required.', loginUrl: `/login?returnTo=${encodeURIComponent(req.originalUrl || '/app/dashboard')}` });
  req.wisdoUser = user;
  next();
}
function requireAdmin(load) {
  return async (req, res, next) => {
    const state = ensure(await load());
    if (!isAdmin(state, req.wisdoUser || currentUser(req))) return res.status(403).json({ ok: false, error: 'Admin role required.' });
    next();
  };
}
async function mutate(load, save, fn) {
  const state = ensure(await load());
  const value = await fn(state);
  await save(state);
  return value;
}
function audit(state, userId, action, targetType, targetId, data = {}) {
  state.auditLog.unshift({ id: id('audit'), userId: String(userId || 'system'), action, targetType, targetId: String(targetId || ''), data, createdAt: nowIso() });
  state.auditLog = state.auditLog.slice(0, 2500);
}
function baseUrl(req, config) {
  return String(config?.api?.publicBaseUrl || process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}
function stripeClient() {
  return process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
}
function subscriptionFor(state, userId) {
  return Object.values(state.subscriptions).find((subscription) => String(subscription.user_id || subscription.userId) === String(userId) && !['cancelled', 'expired'].includes(subscription.status)) || null;
}

export function registerExtendedProductRoutes(app, { config, loadEcosystemState, saveEcosystemState, logger }) {
  const adminGuard = requireAdmin(loadEcosystemState);

  app.get('/api/v2/firms/:id', async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const firm = state.firms[req.params.id];
    if (!firm) return res.status(404).json({ ok: false, error: 'Firm not found.' });
    res.json({ ok: true, firm });
  });
  app.post('/api/v2/firms/compare', async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 8) : [];
    res.json({ ok: true, firms: ids.map((firmId) => state.firms[firmId]).filter(Boolean) });
  });

  app.get('/api/v2/community/leads', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const shares = new Set(Object.values(state.accountShares).filter((share) => String(share.shared_with_user_id) === String(req.wisdoUser.id) && share.status !== 'revoked').map((share) => share.account_id));
    const leads = Object.values(state.tradingAccounts).filter((account) => ['lead','dual'].includes(String(account.desk_role || (account.role === 'master' ? 'lead' : '')).toLowerCase()) && (String(account.user_id) === String(req.wisdoUser.id) || account.sharing_mode === 'community' || account.community_visible || shares.has(account.id))).map((account) => ({ ...account, encrypted_credentials: undefined, access: String(account.user_id) === String(req.wisdoUser.id) ? 'owned' : shares.has(account.id) ? 'shared' : 'community' }));
    res.json({ ok: true, leads });
  });
  app.patch('/api/v2/accounts/:id/community', requireUser, async (req, res) => {
    const account = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const row = state.tradingAccounts[req.params.id];
      if (!row || String(row.user_id) !== String(req.wisdoUser.id)) return null;
      const canLead = ['lead','dual'].includes(String(row.desk_role || (row.role === 'master' ? 'lead' : '')).toLowerCase());
      if (!canLead && bool(req.body?.community_visible)) return { validationError: 'Assign this account as Culture Lead or Dual Role before listing it in the community.' };
      row.community_visible = canLead && bool(req.body?.community_visible);
      row.sharing_mode = row.community_visible ? 'community' : 'private';
      row.community_name = String(req.body?.community_name || row.community_name || row.nickname || row.broker || '').trim();
      row.updated_at = nowIso();
      audit(state, req.wisdoUser.id, 'account.community_visibility', 'TradingAccount', row.id, { community_visible: row.community_visible });
      return { ...row, encrypted_credentials: undefined };
    });
    if (!account) return res.status(404).json({ ok: false, error: 'Account not found.' });
    if (account.validationError) return res.status(400).json({ ok: false, error: account.validationError });
    res.json({ ok: true, account });
  });
  app.post('/api/v2/account-shares', requireUser, async (req, res) => {
    const share = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const account = state.tradingAccounts[req.body?.account_id];
      if (!account || String(account.user_id) !== String(req.wisdoUser.id)) return null;
      const row = { id: id('share'), account_id: account.id, owner_user_id: req.wisdoUser.id, shared_with_user_id: String(req.body.shared_with_user_id || ''), permission: req.body.permission === 'control' ? 'control' : 'copy', status: 'active', created_at: nowIso() };
      if (!row.shared_with_user_id) return null;
      state.accountShares[row.id] = row;
      audit(state, req.wisdoUser.id, 'account.shared', 'TradingAccount', account.id, { sharedWith: row.shared_with_user_id, permission: row.permission });
      return row;
    });
    if (!share) return res.status(400).json({ ok: false, error: 'A valid owned account and target user are required.' });
    res.status(201).json({ ok: true, share });
  });
  app.delete('/api/v2/account-shares/:id', requireUser, async (req, res) => {
    const removed = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const row = state.accountShares[req.params.id];
      if (!row || String(row.owner_user_id) !== String(req.wisdoUser.id)) return null;
      delete state.accountShares[req.params.id];
      return row;
    });
    if (!removed) return res.status(404).json({ ok: false, error: 'Share not found.' });
    res.json({ ok: true, removed });
  });

  app.get('/api/v2/subscription', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    res.json({ ok: true, subscription: subscriptionFor(state, req.wisdoUser.id) });
  });
  app.post('/api/v2/billing/checkout', requireUser, async (req, res) => {
    const stripe = stripeClient();
    const price = computePrice(req.body || {});
    if (!stripe) return res.status(503).json({ ok: false, providerReady: false, error: 'Stripe is not configured.', price });
    const base = baseUrl(req, config);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: String(req.wisdoUser.id),
      customer_email: req.wisdoUser.email || undefined,
      success_url: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: price.total, product_data: { name: `WISDO ${price.plan} · ${price.accountQuantity} account${price.accountQuantity === 1 ? '' : 's'}`, description: `${price.cycleLabel}; Analyzer ${price.addons.analyzer ? 'on' : 'off'}; Dedicated environment ${price.addons.dedicatedEnv ? 'on' : 'off'}` }, recurring: { interval: 'month', interval_count: price.months } } }],
      metadata: { wisdo_user_id: String(req.wisdoUser.id), configuration: Buffer.from(JSON.stringify(price)).toString('base64url') },
      subscription_data: { metadata: { wisdo_user_id: String(req.wisdoUser.id), configuration: Buffer.from(JSON.stringify(price)).toString('base64url') } },
    });
    res.json({ ok: true, providerReady: true, url: session.url, sessionId: session.id, price });
  });
  app.post('/api/v2/billing/portal', requireUser, async (req, res) => {
    const stripe = stripeClient();
    const state = ensure(await loadEcosystemState());
    const subscription = subscriptionFor(state, req.wisdoUser.id);
    if (!stripe || !subscription?.stripe_customer_id) return res.status(409).json({ ok: false, error: 'No Stripe customer is connected to this account.' });
    const portal = await stripe.billingPortal.sessions.create({ customer: subscription.stripe_customer_id, return_url: `${baseUrl(req, config)}/app/settings/billing` });
    res.json({ ok: true, url: portal.url });
  });
  app.post('/api/v2/subscription/cancel', requireUser, async (req, res) => {
    const stripe = stripeClient();
    const result = await mutate(loadEcosystemState, saveEcosystemState, async (state) => {
      const subscription = subscriptionFor(state, req.wisdoUser.id);
      if (!subscription) return null;
      if (stripe && subscription.stripe_subscription_id) await stripe.subscriptions.update(subscription.stripe_subscription_id, { cancel_at_period_end: true });
      subscription.cancel_at_period_end = true;
      subscription.updated_at = nowIso();
      return subscription;
    });
    if (!result) return res.status(404).json({ ok: false, error: 'Active subscription not found.' });
    res.json({ ok: true, subscription: result });
  });
  app.post('/api/v2/subscription/resume', requireUser, async (req, res) => {
    const stripe = stripeClient();
    const result = await mutate(loadEcosystemState, saveEcosystemState, async (state) => {
      const subscription = Object.values(state.subscriptions).find((row) => String(row.user_id || row.userId) === String(req.wisdoUser.id));
      if (!subscription) return null;
      if (stripe && subscription.stripe_subscription_id) await stripe.subscriptions.update(subscription.stripe_subscription_id, { cancel_at_period_end: false });
      subscription.cancel_at_period_end = false;
      if (subscription.status === 'cancelled') subscription.status = 'active';
      subscription.updated_at = nowIso();
      return subscription;
    });
    if (!result) return res.status(404).json({ ok: false, error: 'Subscription not found.' });
    res.json({ ok: true, subscription: result });
  });
  app.post('/api/public/webhooks/stripe', async (req, res) => {
    const stripe = stripeClient();
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ ok: false, error: 'Stripe webhook is not configured.' });
    let event;
    try { event = stripe.webhooks.constructEvent(req.rawBody || Buffer.from(JSON.stringify(req.body || {})), req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); }
    catch (error) { return res.status(400).json({ ok: false, error: `Invalid Stripe signature: ${error.message}` }); }
    await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const object = event.data.object || {};
      const userId = object.metadata?.wisdo_user_id || object.client_reference_id;
      if (!userId) return true;
      let configuration = {};
      try { configuration = JSON.parse(Buffer.from(object.metadata?.configuration || '', 'base64url').toString('utf8')); } catch {}
      const existing = Object.values(state.subscriptions).find((row) => String(row.user_id || row.userId) === String(userId)) || { id: id('sub'), user_id: String(userId), created_at: nowIso() };
      if (event.type === 'checkout.session.completed') {
        existing.stripe_customer_id = object.customer;
        existing.stripe_subscription_id = object.subscription;
        existing.status = 'active';
        Object.assign(existing, { plan: configuration.plan, billing_cycle: configuration.billingCycle, account_quantity: configuration.accountQuantity, addon_analyzer: configuration.addons?.analyzer, addon_dedicated_env: configuration.addons?.dedicatedEnv, price_cents: configuration.total });
      } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
        existing.stripe_subscription_id = object.id;
        existing.stripe_customer_id = object.customer;
        existing.status = event.type.endsWith('deleted') ? 'cancelled' : object.status;
        existing.cancel_at_period_end = Boolean(object.cancel_at_period_end);
        existing.current_period_end = object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : existing.current_period_end;
      } else if (event.type === 'invoice.payment_failed') existing.status = 'past_due';
      else if (event.type === 'invoice.paid') existing.status = 'active';
      existing.updated_at = nowIso();
      state.subscriptions[existing.id] = existing;
      audit(state, userId, `stripe.${event.type}`, 'Subscription', existing.id, { stripeEventId: event.id });
      return true;
    });
    res.json({ received: true });
  });

  app.get('/api/v2/push/public-key', requireUser, (req, res) => {
    const publicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim();
    if (!publicKey) return res.status(503).json({ ok: false, providerReady: false, error: 'VAPID_PUBLIC_KEY is not configured.' });
    res.json({ ok: true, providerReady: true, publicKey });
  });

  app.post('/api/v2/push-subscriptions', requireUser, async (req, res) => {
    const row = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const endpoint = String(req.body?.endpoint || '');
      if (!endpoint) return null;
      const row = { id: id('push'), user_id: req.wisdoUser.id, endpoint, keys: req.body.keys || {}, user_agent: req.headers['user-agent'] || '', created_at: nowIso() };
      state.pushSubscriptions[row.id] = row;
      return row;
    });
    if (!row) return res.status(400).json({ ok: false, error: 'Push endpoint is required.' });
    res.status(201).json({ ok: true, subscription: row });
  });
  app.delete('/api/v2/push-subscriptions/:id', requireUser, async (req, res) => {
    const removed = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const row = state.pushSubscriptions[req.params.id];
      if (!row || String(row.user_id) !== String(req.wisdoUser.id)) return null;
      delete state.pushSubscriptions[req.params.id];
      return row;
    });
    if (!removed) return res.status(404).json({ ok: false, error: 'Push subscription not found.' });
    res.json({ ok: true });
  });
  app.post('/api/v2/alerts/test-push', requireUser, async (req, res) => {
    const publicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim();
    const privateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim();
    if (!publicKey || !privateKey) return res.status(503).json({ ok: false, providerReady: false, error: 'VAPID keys are not configured.' });
    const state = ensure(await loadEcosystemState());
    const subscriptions = Object.values(state.pushSubscriptions).filter((row) => String(row.user_id) === String(req.wisdoUser.id));
    if (!subscriptions.length) return res.status(409).json({ ok: false, providerReady: true, error: 'No browser push subscription is registered.' });
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@wisdo.app', publicKey, privateKey);
    const payload = JSON.stringify({ title: 'WISDO push connected', body: 'Browser alerts are ready for relay, risk, billing, and system events.', url: '/app/alerts', tag: 'wisdo-push-test' });
    const results = await Promise.allSettled(subscriptions.map((row) => webpush.sendNotification({ endpoint: row.endpoint, keys: row.keys }, payload)));
    const delivered = results.filter((result) => result.status === 'fulfilled').length;
    res.status(delivered ? 200 : 502).json({ ok: delivered > 0, providerReady: true, delivered, attempted: subscriptions.length });
  });
  app.post('/api/v2/alerts/test-email', requireUser, async (req, res) => {
    const apiKey = process.env.RESEND_API_KEY;
    const to = req.wisdoUser.email || req.body?.email;
    if (!apiKey || !to) return res.status(503).json({ ok: false, error: 'RESEND_API_KEY and a user email are required.' });
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || 'WISDO <notifications@wisdo.app>', to: [to], subject: 'WISDO notification test', html: '<h1>WISDO alerts are connected.</h1><p>Your account can receive relay, risk, billing, and system notifications.</p>' }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(502).json({ ok: false, error: payload.message || 'Resend request failed.' });
    res.json({ ok: true, id: payload.id });
  });


  app.get('/api/v2/education/hub', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const userId = String(req.wisdoUser.id);
    res.json({
      ok: true,
      ...getEducationHubSummary(),
      tools: getTradingTools(),
      liveLearning: getLiveLearning(),
      bookmarks: state.educationBookmarks[userId] || [],
      learnerProfile: state.learnerProfiles[userId] || null,
      progress: state.academyProgress[userId] || { completed_lessons: [], quiz_scores: {}, badges: [], score: 0 },
    });
  });

  app.get('/api/v2/education/resources', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const result = searchEducationResources(req.query || {});
    const bookmarks = new Set(state.educationBookmarks[String(req.wisdoUser.id)] || []);
    res.json({ ok: true, ...result, resources: result.resources.map((item) => ({ ...item, bookmarked: bookmarks.has(item.id) })) });
  });

  app.post('/api/v2/education/resources/:resourceId/bookmark', requireUser, async (req, res) => {
    const userId = String(req.wisdoUser.id);
    const bookmark = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const rows = new Set(state.educationBookmarks[userId] || []);
      const enabled = req.body?.enabled !== false;
      if (enabled) rows.add(req.params.resourceId); else rows.delete(req.params.resourceId);
      state.educationBookmarks[userId] = [...rows].slice(0, 2000);
      audit(state, userId, enabled ? 'education.resource.bookmarked' : 'education.resource.unbookmarked', 'EducationResource', req.params.resourceId);
      return { enabled, bookmarks: state.educationBookmarks[userId] };
    });
    res.json({ ok: true, ...bookmark });
  });

  app.get('/api/v2/education/tools', requireUser, (req, res) => res.json({ ok: true, tools: getTradingTools() }));
  app.post('/api/v2/education/tools/:toolId/calculate', requireUser, (req, res) => {
    try { res.json({ ok: true, ...calculateTradingTool(req.params.toolId, req.body || {}) }); }
    catch (error) { res.status(400).json({ ok: false, error: error.message }); }
  });
  app.get('/api/v2/education/live-learning', requireUser, (req, res) => res.json({ ok: true, sessions: getLiveLearning(), providerReady: Boolean(process.env.WISDO_WEBINAR_PROVIDER_URL), providerUrl: process.env.WISDO_WEBINAR_PROVIDER_URL || null }));

  function assistantUserContext(state, user, page, selectedAccountId = '') {
    const userId = String(user?.id || 'public');
    const accounts = Object.values(state.tradingAccounts || {}).filter((row) => String(row.user_id) === userId);
    const selected = accounts.find((row) => String(row.id) === String(selectedAccountId)) || accounts[0] || null;
    const trades = Object.values(state.trades || {}).filter((row) => String(row.user_id) === userId);
    const alerts = state.alerts?.[userId] || [];
    const rules = Object.values(state.copierRules || {}).filter((row) => String(row.user_id) === userId);
    const progress = state.academyProgress?.[userId] || { completed_lessons: [], badges: [], score: 0 };
    const profile = state.learnerProfiles?.[userId] || null;
    const issues = [];
    if (selected && !selected.reporter_connected) issues.push('Reporter is not currently fresh.');
    if (selected && selected.terminal_connected === false) issues.push('MT4 terminal reports disconnected.');
    if (selected && selected.expert_enabled === false) issues.push('MT4 AutoTrading / Expert execution is disabled.');
    if (rules.some((row) => row.status === 'active' && !row.last_relay_at)) issues.push('An active Culture Lane has not recorded a relay yet.');
    return {
      userId,
      membershipTier: state.subscriptions?.[userId]?.plan || state.subscriptions?.[userId]?.status || 'basic',
      currentPage: String(page || '/'),
      selectedAccount: selected ? { id: selected.id, platform: selected.platform, broker: selected.broker, accountNumber: selected.account_number, status: selected.status, balance: Number(selected.balance || 0), equity: Number(selected.equity || 0), floatingPL: Number(selected.floating_pl || 0), openTrades: Number(selected.open_trades || 0), reporterConnected: Boolean(selected.reporter_connected), terminalConnected: selected.terminal_connected !== false, expertEnabled: selected.expert_enabled !== false } : null,
      connectedAccounts: accounts.map((row) => ({ id: row.id, nickname: row.nickname, accountNumber: row.account_number, status: row.status, canLead: row.canLead, canReceive: row.canReceive, canExecute: row.canExecute })),
      copierStatus: { activeRules: rules.filter((row) => row.status === 'active' || row.is_active).length, totalRules: rules.length },
      activeTrades: trades.filter((row) => row.status === 'open').length,
      closedTrades: trades.filter((row) => row.status === 'closed').length,
      unreadAlerts: alerts.filter((row) => !row.read_at).length,
      lessonProgress: { completed: progress.completed_lessons?.length || 0, badges: progress.badges || [], score: progress.score || 0, profile },
      issues,
      permissions: { explain: true, navigate: true, calculate: true, createSupportTicket: Boolean(user?.id), changeSettings: 'confirmation_required', closeTrades: 'confirmation_required', enableRelay: 'confirmation_required', payments: 'external_secure_checkout_only' },
      suggestedQuestions: suggestedQuestionsForPage(page),
    };
  }

  function fallbackAssistantReply(message, context) {
    const text = String(message || '').toLowerCase();
    const page = String(context.currentPage || '/');
    if (text.includes('close') || text.includes('pause') || text.includes('enable') || text.includes('relay')) return 'I can explain the control and take you to the correct account screen, but I will not execute a trade or change a Culture Lane without a visible account-specific confirmation. Review the selected account, Reporter health, route, and command status first.';
    if (text.includes('candlestick')) return 'A candlestick records open, high, low, and close for one interval. Start by reading body direction, wick exploration, body-to-range ratio, location inside structure, and volatility. Do not treat a candle name as a prediction. Open WISDO Academy and use the candle replay before studying named patterns.';
    if (text.includes('risk') || text.includes('money')) return 'Define maximum acceptable loss before lot size. Then include stop distance, point value, spread, slippage, correlated open risk, daily loss limits, margin headroom, and household cash boundaries. The Position Size and Drawdown tools in the Education Hub can demonstrate the math.';
    if (text.includes('copier') || page.includes('copier')) return `Your copier review order is: confirm lead capability, receiver capability, Reporter freshness, AutoTrading, route status, allowed symbols, open-event detection, command delivery, and MT4 completion. ${context.issues.length ? `Current issues: ${context.issues.join(' ')}` : 'No immediate account-health issue is visible in this context.'}`;
    if (text.includes('lesson') || page.includes('education')) return 'Your lesson should begin with a diagnostic, a worked example, a replay decision, a money-risk exercise, and a checkpoint. WISDO can adjust the explanation to your experience, forex/metals focus, automation goals, and interactive learning preference.';
    return `I can explain this page, diagnose visible account status, open the right learning or calculator screen, and prepare support details. ${context.issues.length ? `I can already see: ${context.issues.join(' ')}` : 'No immediate account-health warning is visible.'}`;
  }

  async function handleAssistantChat(req, res, authenticatedOnly = false) {
    const user = currentUser(req);
    if (authenticatedOnly && !user) return res.status(401).json({ ok: false, error: 'Authentication required.' });
    const state = ensure(await loadEcosystemState());
    const page = String(req.body?.currentPage || req.headers.referer || '/').slice(0, 500);
    const context = assistantUserContext(state, user, page, req.body?.selectedAccountId);
    const message = String(req.body?.message || '').trim().slice(0, 8000);
    if (!message) return res.status(400).json({ ok: false, error: 'Ask WISDO a question.' });
    const userId = String(user?.id || `public:${req.ip || 'unknown'}`);
    const today = nowIso().slice(0, 10);
    const usage = state.wisdoAssistantUsage[userId] || { day: today, count: 0 };
    if (usage.day !== today) { usage.day = today; usage.count = 0; }
    const premium = String(context.membershipTier).toLowerCase().includes('premium') || String(context.membershipTier).toLowerCase().includes('active');
    const limit = user ? (premium ? 200 : 40) : 12;
    if (usage.count >= limit) return res.status(429).json({ ok: false, error: 'Daily Wisdo AI limit reached for this membership tier.', usage: { ...usage, limit } });
    let answer = '';
    let provider = 'wisdo_fallback';
    const history = (state.wisdoAssistantThreads[userId] || []).slice(-12);
    if (process.env.OPENAI_API_KEY) {
      try {
        const system = `You are Wisdo AI, a page-aware assistant for a trading education and account-control platform. Use the supplied page and account context. Explain, teach, calculate, navigate, and troubleshoot. Never promise profit, provide individualized buy/sell instructions, expose private DF Sauce or HIGHTOWER source code, collect card details, or claim an account action occurred unless the platform confirms it. Closing trades, changing copier settings, enabling automation, or payments require a visible account-specific confirmation through the normal UI. Prefer ordered diagnosis and exact next-screen links. Context: ${JSON.stringify(context)}`;
        const content = [{ type: 'text', text: message }];
        if (String(req.body?.attachment?.dataUrl || '').startsWith('data:image/')) content.push({ type: 'image_url', image_url: { url: String(req.body.attachment.dataUrl).slice(0, 2_500_000) } });
        const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.WISDO_AI_MODEL || 'gpt-4.1-mini', temperature: 0.2, messages: [{ role: 'system', content: system }, ...history.map((row) => ({ role: row.role, content: row.content })), { role: 'user', content }] }) });
        const payload = await response.json().catch(() => ({}));
        if (response.ok) { answer = payload.choices?.[0]?.message?.content || ''; provider = 'openai'; }
      } catch (error) { logger?.warn?.('Wisdo AI provider fallback', { message: error.message }); }
    }
    if (!answer) answer = fallbackAssistantReply(message, context);
    const actionLinks = [
      { id: 'education', label: 'Open Education Hub', href: '/app/education' },
      { id: 'accounts', label: 'Open Accounts', href: '/app/accounts' },
      { id: 'copier', label: 'Open Copier Engine', href: '/app/copier-engine' },
      { id: 'support', label: 'Open Support', href: '/contact' },
    ].filter((item) => message.toLowerCase().includes(item.id) || item.id === 'support' || item.id === 'education').slice(0, 3);
    const riskyIntent = /(close|flatten|pause|resume|enable|disable|risk setting|copier setting|payment|checkout)/i.test(message);
    await mutate(loadEcosystemState, saveEcosystemState, (nextState) => {
      const thread = nextState.wisdoAssistantThreads[userId] ||= [];
      thread.push({ id: id('wisdo_ai'), role: 'user', content: message, page, createdAt: nowIso() });
      thread.push({ id: id('wisdo_ai'), role: 'assistant', content: answer, provider, page, createdAt: nowIso() });
      nextState.wisdoAssistantThreads[userId] = thread.slice(-120);
      nextState.wisdoAssistantUsage[userId] = { day: today, count: usage.count + 1 };
      return true;
    });
    res.json({ ok: true, answer, provider, context, actionLinks, confirmationRequired: riskyIntent, confirmationMessage: riskyIntent ? 'Use the visible account-specific control and confirmation screen. Wisdo AI did not execute this action.' : null, usage: { day: today, count: usage.count + 1, limit } });
  }

  app.get('/api/v2/wisdo-ai/history', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    res.json({ ok: true, messages: (state.wisdoAssistantThreads[String(req.wisdoUser.id)] || []).slice(-60) });
  });
  app.delete('/api/v2/wisdo-ai/history', requireUser, async (req, res) => {
    await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      state.wisdoAssistantThreads[String(req.wisdoUser.id)] = [];
      audit(state, req.wisdoUser.id, 'wisdo.ai.history.cleared', 'WisdoAssistantThread', req.wisdoUser.id);
      return true;
    });
    res.json({ ok: true });
  });

  app.get('/api/wisdo-ai/context', async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const user = currentUser(req);
    res.json({ ok: true, context: assistantUserContext(state, user, req.query.currentPage || req.headers.referer || '/', req.query.selectedAccountId) });
  });
  app.post('/api/wisdo-ai/chat', async (req, res) => handleAssistantChat(req, res, false));
  app.post('/api/v2/wisdo-ai/chat', requireUser, async (req, res) => handleAssistantChat(req, res, true));

  app.get('/api/v2/academy/tracks', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const progress = state.academyProgress[req.wisdoUser.id] || { completed_lessons: [], score: 0, badges: [] };
    const learnerProfile = state.learnerProfiles[req.wisdoUser.id] || null;
    res.json({ ok: true, tracks: ACADEMY_TRACKS, progress, learnerProfile, summary: getAcademySummary() });
  });

  app.get('/api/v2/academy/catalog', requireUser, (req, res) => {
    const result = searchAcademyCourses({
      query: req.query.query,
      category: req.query.category,
      domainId: req.query.domainId,
      level: req.query.level,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ ok: true, ...result, summary: getAcademySummary() });
  });

  app.get('/api/v2/academy/courses/:courseId', requireUser, (req, res) => {
    const course = getAcademyCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: 'Academy course not found.' });
    res.json({ ok: true, course });
  });

  app.get('/api/v2/academy/courses/:courseId/session', requireUser, async (req, res) => {
    const course = getAcademyCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: 'Academy course not found.' });
    const state = ensure(await loadEcosystemState());
    const profile = state.learnerProfiles[req.wisdoUser.id] || { experience: 'starter', goals: [], markets: [], interests: [], learningStyle: 'interactive' };
    const lesson = buildInteractiveLesson(course, profile);
    res.json({ ok: true, course, lesson, aiTutorReady: Boolean(process.env.OPENAI_API_KEY || process.env.GOOGLE_AI_API_KEY), tutorEndpoint: '/api/v2/academy/tutor' });
  });

  app.get('/api/v2/academy/profile', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const profile = state.learnerProfiles[req.wisdoUser.id] || {
      userId: req.wisdoUser.id,
      experience: 'starter', goals: [], markets: [], interests: [], weeklyMinutes: 180, learningStyle: 'interactive',
    };
    res.json({ ok: true, profile });
  });

  app.patch('/api/v2/academy/profile', requireUser, async (req, res) => {
    const profile = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const levels = new Set(ACADEMY_LEVELS.map((level) => level.id));
      const list = (value) => Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 30) : String(value || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 30);
      const previous = state.learnerProfiles[req.wisdoUser.id] || {};
      const next = {
        ...previous,
        userId: req.wisdoUser.id,
        experience: levels.has(req.body?.experience) ? req.body.experience : (previous.experience || 'starter'),
        goals: list(req.body?.goals ?? previous.goals),
        markets: list(req.body?.markets ?? previous.markets),
        interests: list(req.body?.interests ?? previous.interests),
        weeklyMinutes: Math.max(30, Math.min(1200, Number(req.body?.weeklyMinutes ?? previous.weeklyMinutes ?? 180) || 180)),
        learningStyle: ['interactive', 'visual', 'reading', 'audio', 'mixed'].includes(req.body?.learningStyle) ? req.body.learningStyle : (previous.learningStyle || 'interactive'),
        updatedAt: nowIso(),
        createdAt: previous.createdAt || nowIso(),
      };
      state.learnerProfiles[req.wisdoUser.id] = next;
      audit(state, req.wisdoUser.id, 'academy.profile.updated', 'LearnerProfile', req.wisdoUser.id, { experience: next.experience, markets: next.markets });
      return next;
    });
    const personalized = buildPersonalizedPath(profile);
    res.json({ ok: true, ...personalized, profile });
  });

  app.post('/api/v2/academy/path', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const profile = { ...(state.learnerProfiles[req.wisdoUser.id] || {}), ...(req.body || {}) };
    res.json({ ok: true, ...buildPersonalizedPath(profile) });
  });

  app.get('/api/v2/academy/df-sauce/scenarios/:scenarioId', requireUser, (req, res) => {
    res.json({ ok: true, scenario: getDfSauceScenario(req.params.scenarioId) });
  });

  app.get('/api/v2/academy/tradingview-config', requireUser, (req, res) => {
    const privateUrl = String(process.env.WISDO_DF_SAUCE_TRADINGVIEW_URL || '').trim();
    res.json({
      ok: true,
      privateChartConfigured: Boolean(privateUrl),
      genericWatchRoomUrl: 'https://s.tradingview.com/widgetembed/?frameElementId=wisdo_tv&symbol=OANDA%3AXAUUSD&interval=15&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=0b1420&studies=%5B%5D&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&hideideas=1',
    });
  });

  app.get('/api/v2/academy/tradingview', requireUser, (req, res) => {
    const privateUrl = String(process.env.WISDO_DF_SAUCE_TRADINGVIEW_URL || '').trim();
    const fallback = 'https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD';
    res.redirect(privateUrl || fallback);
  });

  app.get('/api/v2/academy/tutor/history', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    res.json({ ok: true, messages: (state.academyTutorThreads[req.wisdoUser.id] || []).slice(-50) });
  });

  app.delete('/api/v2/academy/tutor/history', requireUser, async (req, res) => {
    await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      state.academyTutorThreads[req.wisdoUser.id] = [];
      audit(state, req.wisdoUser.id, 'academy.tutor.cleared', 'AcademyTutorThread', req.wisdoUser.id);
      return true;
    });
    res.json({ ok: true });
  });

  app.post('/api/v2/academy/tutor', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const profile = state.learnerProfiles[req.wisdoUser.id] || { experience: 'starter', goals: [], markets: [], interests: [] };
    const course = req.body?.courseId ? getAcademyCourse(req.body.courseId) : null;
    const message = String(req.body?.message || '').slice(0, 8000).trim();
    if (!message) return res.status(400).json({ ok: false, error: 'Ask WISDO a trading, investing, finance, or platform question.' });
    const selectedAccountId = String(req.body?.selectedAccountId || '');
    const selectedAccount = selectedAccountId && String(state.tradingAccounts?.[selectedAccountId]?.user_id) === String(req.wisdoUser.id)
      ? state.tradingAccounts[selectedAccountId]
      : null;
    const accountContext = selectedAccount ? {
      platform: selectedAccount.platform,
      broker: selectedAccount.broker,
      accountNumber: selectedAccount.account_number,
      status: selectedAccount.status,
      balance: Number(selectedAccount.balance || 0),
      equity: Number(selectedAccount.equity || 0),
      floatingPL: Number(selectedAccount.floating_pl || 0),
      openTrades: Number(selectedAccount.open_trades || 0),
      reporterConnected: Boolean(selectedAccount.reporter_connected),
    } : null;
    const history = (state.academyTutorThreads[req.wisdoUser.id] || []).slice(-10);
    const system = `You are WISDO Academy Tutor, an adaptive trading, investing, personal-finance, and money-management educator. Match the learner's experience, goals, learning style, and selected market. Explain concepts in ordered steps, define unfamiliar terms, ask one useful diagnostic question, and recommend chart replay, simulation, journaling, or paper-practice. Never promise profits, issue personalized buy/sell instructions, or replace a licensed financial, tax, or legal professional. When account metrics are supplied, explain educational risk implications without directing a live trade. Do not reveal, reproduce, infer, request, or reconstruct proprietary DF Sauce source code, exact private indicator parameters, private alerts, or hidden implementation details. Learner profile: ${JSON.stringify(profile)}. Course context: ${JSON.stringify(course ? { title: course.title, summary: course.summary, objectives: course.objectives } : null)}. Selected account context: ${JSON.stringify(accountContext)}.`;
    let answer = '';
    let provider = 'adaptive_fallback';
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            model: process.env.WISDO_AI_MODEL || 'gpt-4.1-mini',
            messages: [{ role: 'system', content: system }, ...history.map((row) => ({ role: row.role === 'assistant' ? 'assistant' : 'user', content: String(row.content || '').slice(0, 4000) })), { role: 'user', content: message }],
            temperature: 0.25,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok) { answer = payload.choices?.[0]?.message?.content || ''; provider = 'openai'; }
        else logger?.warn?.('Academy tutor provider rejected request', { status: response.status, message: payload.error?.message });
      } catch (error) { logger?.warn?.('Academy tutor fallback', { message: error.message }); }
    }
    if (!answer) answer = buildFallbackTutorReply({ message, profile, course, accountContext });
    const keyword = message.toLowerCase().match(/candlestick|risk|money|forex|stock|futures|options|crypto|psychology|backtest|copier|drawdown|portfolio|retirement|budget|order|trend|range/)?.[0] || '';
    const recommendations = keyword ? searchAcademyCourses({ query: keyword, level: profile.experience || 'starter', limit: 4 }).courses.map((item) => ({ id: item.id, title: item.title, level: item.level, category: item.category })) : [];
    await mutate(loadEcosystemState, saveEcosystemState, (nextState) => {
      const thread = nextState.academyTutorThreads[req.wisdoUser.id] ||= [];
      thread.push({ id: id('academy_msg'), role: 'user', content: message, courseId: course?.id || null, selectedAccountId: selectedAccount?.id || null, createdAt: nowIso() });
      thread.push({ id: id('academy_msg'), role: 'assistant', content: answer, provider, courseId: course?.id || null, createdAt: nowIso() });
      nextState.academyTutorThreads[req.wisdoUser.id] = thread.slice(-100);
      audit(nextState, req.wisdoUser.id, 'academy.tutor.answered', 'AcademyTutorThread', req.wisdoUser.id, { provider, courseId: course?.id || null, selectedAccountId: selectedAccount?.id || null });
      return true;
    });
    res.json({ ok: true, provider, answer, profile, course, accountContext, recommendations });
  });

  app.post('/api/v2/academy/lessons/:lessonId/complete', requireUser, async (req, res) => {
    const progress = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const row = state.academyProgress[req.wisdoUser.id] ||= { user_id: req.wisdoUser.id, completed_lessons: [], quiz_scores: {}, badges: [], score: 0, updated_at: nowIso() };
      if (!row.completed_lessons.includes(req.params.lessonId)) row.completed_lessons.push(req.params.lessonId);
      if (req.body?.score != null) row.quiz_scores[req.params.lessonId] = Math.max(0, Math.min(100, Number(req.body.score) || 0));
      row.score = Object.values(row.quiz_scores).reduce((sum, value) => sum + Number(value || 0), 0);
      if (row.completed_lessons.length >= 4 && !row.badges.includes('WISDO Foundation')) row.badges.push('WISDO Foundation');
      if (row.completed_lessons.includes('close-authority') && !row.badges.includes('Copier Certified')) row.badges.push('Copier Certified');
      if (row.completed_lessons.length >= 25 && !row.badges.includes('Academy Pathfinder')) row.badges.push('Academy Pathfinder');
      row.updated_at = nowIso();
      return row;
    });
    res.json({ ok: true, progress });
  });

  app.get('/api/v2/support/tickets', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    res.json({ ok: true, tickets: Object.values(state.supportTickets).filter((ticket) => String(ticket.user_id) === String(req.wisdoUser.id)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) });
  });
  app.post('/api/v2/support/tickets', requireUser, async (req, res) => {
    const ticket = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const subject = String(req.body?.subject || '').trim();
      const body = String(req.body?.body || '').trim();
      if (!subject || !body) return null;
      const row = { id: id('ticket'), user_id: req.wisdoUser.id, subject, body, category: String(req.body?.category || 'general'), priority: ['low', 'normal', 'high', 'urgent'].includes(req.body?.priority) ? req.body.priority : 'normal', status: 'open', account_id: req.body?.account_id || null, command_id: req.body?.command_id || null, created_at: nowIso(), updated_at: nowIso() };
      state.supportTickets[row.id] = row;
      return row;
    });
    if (!ticket) return res.status(400).json({ ok: false, error: 'Subject and message are required.' });
    res.status(201).json({ ok: true, ticket });
  });

  app.post('/api/v2/affiliate/activate', requireUser, async (req, res) => {
    const stripe = stripeClient();
    const feeCents = Math.round(Number(config?.affiliate?.activationFeeAmount || 125) * 100);
    if (!stripe) return res.status(503).json({ ok: false, error: 'Stripe is not configured.', feeCents });
    const session = await stripe.checkout.sessions.create({ mode: 'payment', client_reference_id: String(req.wisdoUser.id), customer_email: req.wisdoUser.email || undefined, success_url: `${baseUrl(req, config)}/app/affiliate?activated=1`, cancel_url: `${baseUrl(req, config)}/app/affiliate?activated=0`, line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: feeCents, product_data: { name: 'WISDO Affiliate Activation' } } }], metadata: { wisdo_user_id: String(req.wisdoUser.id), type: 'affiliate_activation', referrer_code: String(req.body?.referrer_code || '') } });
    res.json({ ok: true, url: session.url, feeCents });
  });

  app.post('/api/v2/ai/analyzer-chat', requireUser, async (req, res) => {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12) : [];
    const prompt = messages.map((message) => `${message.role || 'user'}: ${String(message.content || '').slice(0, 4000)}`).join('\n');
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.WISDO_AI_MODEL || 'gpt-4.1-mini', messages: [{ role: 'system', content: 'You are the WISDO trading education and account-risk analyst. Do not promise returns. Ground every answer in supplied account data and emphasize risk controls.' }, { role: 'user', content: prompt }], temperature: 0.2 }) });
        const data = await response.json();
        if (response.ok) return res.json({ ok: true, provider: 'openai', answer: data.choices?.[0]?.message?.content || '' });
      } catch (error) { logger?.warn?.('AI gateway fallback', { message: error.message }); }
    }
    res.json({ ok: true, provider: 'rule_fallback', answer: 'The AI provider is not connected. Review the selected account’s equity, current drawdown, open risk, copier routes, symbol exposure, and daily-loss protection before changing risk.' });
  });

  app.get('/api/v2/admin/users', requireUser, adminGuard, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const query = String(req.query.search || '').toLowerCase();
    const users = Object.values(state.usersById).map((user) => ({ ...user, passwordHash: undefined, roles: state.userRoles[user.id] || ['user'] })).filter((user) => !query || `${user.email || ''} ${user.username || ''} ${user.id}`.toLowerCase().includes(query)).slice(0, Math.min(500, Number(req.query.limit || 100)));
    res.json({ ok: true, users });
  });
  app.post('/api/v2/admin/users/:id/roles', requireUser, adminGuard, async (req, res) => {
    const roles = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const current = new Set(state.userRoles[req.params.id] || ['user']);
      const role = safeRole(req.body?.role);
      if (req.body?.action === 'revoke') current.delete(role); else current.add(role);
      if (!current.size) current.add('user');
      state.userRoles[req.params.id] = [...current];
      audit(state, req.wisdoUser.id, `role.${req.body?.action === 'revoke' ? 'revoked' : 'granted'}`, 'User', req.params.id, { role });
      return state.userRoles[req.params.id];
    });
    res.json({ ok: true, roles });
  });
  app.get('/app/admin', requireUser, adminGuard, (req, res) => res.redirect('/admin/health'));

  const cronGuard = (req, res, next) => {
    const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!process.env.CRON_SECRET || supplied !== process.env.CRON_SECRET) return res.status(401).json({ ok: false, error: 'Invalid cron token.' });
    next();
  };
  app.post('/api/public/cron/close-expired-trials', cronGuard, async (req, res) => {
    const expired = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const rows = [];
      for (const subscription of Object.values(state.subscriptions)) {
        if (subscription.status === 'trialing' && subscription.trial_ends_at && new Date(subscription.trial_ends_at) <= new Date()) {
          subscription.status = 'expired'; subscription.updated_at = nowIso(); rows.push(subscription.id);
        }
      }
      return rows;
    });
    res.json({ ok: true, expired: expired.length, subscriptionIds: expired });
  });

  logger?.info?.('WISDO extended product routes registered', { billing: true, community: true, academy: true, support: true, admin: true });
}
