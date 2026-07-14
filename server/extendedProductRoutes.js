import crypto from 'node:crypto';
import webpush from 'web-push';

import {
  SquarePaymentGateway,
  decodeSquarePaymentNote,
  encodeSquarePaymentNote,
  squarePlanVariationForCycle,
} from '../services/squarePaymentService.js';

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
import {
  AI_WEBINAR_DISCLAIMER,
  AI_WEBINAR_VERSION,
  buildFallbackWebinar,
  buildWebinarPrompt,
  createWebinarSession,
  gradeWebinarQuiz,
  hydrateWebinarCharts,
  isPublishedStrategy,
  normalizeGeneratedWebinar,
  normalizeStrategyInput,
  publicStrategy,
} from '../services/aiWebinarService.js';
import { HistoricalMarketDataService } from '../services/historicalMarketDataService.js';
import { verifyLeadAccessToken } from '../services/growthFunnelService.js';

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
  state.aiWebinarStrategies ||= {};
  state.aiWebinarStrategyVersions ||= {};
  state.aiWebinarSessions ||= {};
  state.aiWebinarSessionsByUser ||= {};
  state.wisdoAssistantThreads ||= {};
  state.wisdoAssistantUsage ||= {};
  state.funnelLeadsById ||= {};
  state.funnelEvents ||= [];
  state.supportTickets ||= {};
  state.firms ||= {};
  state.affiliates ||= {};
  state.affiliateConversions ||= {};
  state.squareCheckoutIntents ||= {};
  state.squareWebhookEvents ||= {};
  state.squareOrphanSubscriptions ||= {};
  state.payments ||= {};
  state.memberships ||= {};
  state.subscriptionsById ||= {};
  state.affiliatesById ||= {};
  state.affiliatePayouts ||= [];
  state.admin_logs ||= [];
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

function compactSubscriptionPayload(userId, price = {}) {
  return {
    u: String(userId || ''),
    p: price.plan,
    c: price.billingCycle,
    q: Number(price.accountQuantity || 1),
    a: Boolean(price.addons?.analyzer),
    d: Boolean(price.addons?.dedicatedEnv),
    e: Number(price.addons?.extraEnvAccounts || 0),
    t: Number(price.total || 0),
  };
}
function priceFromSquarePayload(payload = {}) {
  return {
    plan: payload.p || 'starter',
    billingCycle: payload.c || 'monthly',
    accountQuantity: Number(payload.q || 1),
    addons: {
      analyzer: Boolean(payload.a),
      dedicatedEnv: Boolean(payload.d),
      extraEnvAccounts: Number(payload.e || 0),
    },
    total: Number(payload.t || 0),
  };
}
function normalizeSquareSubscriptionStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'active') return 'active';
  if (['canceled', 'cancelled', 'deactivated'].includes(status)) return 'cancelled';
  if (status === 'paused') return 'paused';
  if (status === 'pending') return 'pending';
  return status || 'pending';
}
function squarePaymentObject(event = {}) {
  return event.data?.object?.payment || null;
}
function squareSubscriptionObject(event = {}) {
  return event.data?.object?.subscription || null;
}

function subscriptionFor(state, userId) {
  return Object.values(state.subscriptions).find((subscription) => String(subscription.user_id || subscription.userId) === String(userId) && !['cancelled', 'expired'].includes(subscription.status)) || null;
}

export function registerExtendedProductRoutes(app, { config, loadEcosystemState, saveEcosystemState, logger, paymentService = null }) {
  const square = new SquarePaymentGateway(config);
  const historicalMarketData = new HistoricalMarketDataService(config, { logger });
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
    res.json({ ok: true, provider: 'square', subscription: subscriptionFor(state, req.wisdoUser.id) });
  });

  app.post('/api/v2/billing/checkout', requireUser, async (req, res) => {
    const price = computePrice(req.body || {});
    if (!square.isConfigured()) {
      return res.status(503).json({
        ok: false,
        provider: 'square',
        providerReady: false,
        error: 'Square checkout is not configured. Add SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, and PUBLIC_BASE_URL.',
        price,
      });
    }
    const planVariationId = square.subscriptionPlanVariationForCycle(price.billingCycle);
    if (!planVariationId) {
      const variable = {
        monthly: 'SQUARE_SUBSCRIPTION_PLAN_MONTHLY_ID',
        quarterly: 'SQUARE_SUBSCRIPTION_PLAN_QUARTERLY_ID',
        semiannual: 'SQUARE_SUBSCRIPTION_PLAN_SEMIANNUAL_ID',
        annual: 'SQUARE_SUBSCRIPTION_PLAN_ANNUAL_ID',
      }[price.billingCycle] || 'SQUARE_SUBSCRIPTION_PLAN_ID';
      return res.status(503).json({
        ok: false,
        provider: 'square',
        providerReady: false,
        error: `Square subscription checkout needs ${variable}.`,
        price,
      });
    }

    try {
      const note = encodeSquarePaymentNote('subscription', compactSubscriptionPayload(req.wisdoUser.id, price));
      const checkout = await square.createSubscriptionPaymentLink({
        name: `WISDO ${price.plan} · ${price.accountQuantity} account${price.accountQuantity === 1 ? '' : 's'}`,
        amountCents: price.total,
        note,
        redirectUrl: `${baseUrl(req, config)}/checkout/success?provider=square`,
        buyerEmail: req.wisdoUser.email,
        subscriptionPlanVariationId: planVariationId,
        billingCycle: price.billingCycle,
      });
      const subscription = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
        const existing = Object.values(state.subscriptions).find((row) => String(row.user_id || row.userId) === String(req.wisdoUser.id)) || {
          id: id('sub'),
          user_id: String(req.wisdoUser.id),
          created_at: nowIso(),
        };
        Object.assign(existing, {
          provider: 'square',
          status: 'checkout_pending',
          plan: price.plan,
          billing_cycle: price.billingCycle,
          account_quantity: price.accountQuantity,
          addon_analyzer: Boolean(price.addons?.analyzer),
          addon_dedicated_env: Boolean(price.addons?.dedicatedEnv),
          addon_extra_env_accounts: Number(price.addons?.extraEnvAccounts || 0),
          price_cents: price.total,
          square_payment_link_id: checkout.id,
          square_order_id: checkout.orderId,
          square_plan_variation_id: planVariationId,
          updated_at: nowIso(),
        });
        state.subscriptions[existing.id] = existing;
        const intentKey = checkout.orderId || checkout.id;
        state.squareCheckoutIntents[intentKey] = {
          id: id('square_intent'),
          type: 'subscription',
          user_id: String(req.wisdoUser.id),
          subscription_id: existing.id,
          payment_link_id: checkout.id,
          order_id: checkout.orderId,
          price,
          created_at: nowIso(),
        };
        audit(state, req.wisdoUser.id, 'square.checkout.created', 'Subscription', existing.id, { paymentLinkId: checkout.id, orderId: checkout.orderId });
        return existing;
      });
      return res.json({ ok: true, provider: 'square', providerReady: true, url: checkout.url, paymentLinkId: checkout.id, orderId: checkout.orderId, price, subscription });
    } catch (error) {
      logger?.error?.('Square subscription checkout failed', { message: error.message, status: error.status });
      return res.status(error.expose ? 400 : 502).json({ ok: false, provider: 'square', error: error.message, price });
    }
  });

  app.post('/api/v2/billing/portal', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const subscription = subscriptionFor(state, req.wisdoUser.id);
    if (!subscription) return res.status(404).json({ ok: false, provider: 'square', error: 'No subscription is connected to this account.' });
    res.json({ ok: true, provider: 'square', managedInApp: true, url: '/app/settings/billing', subscription });
  });

  app.post('/api/v2/subscription/cancel', requireUser, async (req, res) => {
    try {
      const result = await mutate(loadEcosystemState, saveEcosystemState, async (state) => {
        const subscription = subscriptionFor(state, req.wisdoUser.id);
        if (!subscription) return null;
        if (subscription.square_subscription_id && square.isConfigured()) {
          await square.cancelSubscription(subscription.square_subscription_id);
        }
        subscription.cancel_at_period_end = true;
        subscription.updated_at = nowIso();
        audit(state, req.wisdoUser.id, 'square.subscription.cancel_requested', 'Subscription', subscription.id, { squareSubscriptionId: subscription.square_subscription_id || null });
        return subscription;
      });
      if (!result) return res.status(404).json({ ok: false, error: 'Active subscription not found.' });
      res.json({ ok: true, provider: 'square', subscription: result });
    } catch (error) {
      res.status(error.expose ? 400 : 502).json({ ok: false, provider: 'square', error: error.message });
    }
  });

  app.post('/api/v2/subscription/resume', requireUser, async (req, res) => {
    try {
      const result = await mutate(loadEcosystemState, saveEcosystemState, async (state) => {
        const subscription = Object.values(state.subscriptions).find((row) => String(row.user_id || row.userId) === String(req.wisdoUser.id));
        if (!subscription) return null;
        if (subscription.square_subscription_id && square.isConfigured()) {
          await square.resumeSubscription(subscription.square_subscription_id);
        }
        subscription.cancel_at_period_end = false;
        if (subscription.status === 'cancelled') subscription.status = 'active';
        subscription.updated_at = nowIso();
        audit(state, req.wisdoUser.id, 'square.subscription.resume_requested', 'Subscription', subscription.id, { squareSubscriptionId: subscription.square_subscription_id || null });
        return subscription;
      });
      if (!result) return res.status(404).json({ ok: false, error: 'Subscription not found.' });
      res.json({ ok: true, provider: 'square', subscription: result });
    } catch (error) {
      res.status(error.expose ? 400 : 502).json({ ok: false, provider: 'square', error: error.message });
    }
  });

  const squareWebhookHandler = async (req, res) => {
    if (!square.hasWebhookConfig()) {
      return res.status(503).json({ ok: false, provider: 'square', error: 'Square webhook is not configured. Add SQUARE_WEBHOOK_SIGNATURE_KEY and SQUARE_WEBHOOK_NOTIFICATION_URL.' });
    }
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const signature = req.headers['x-square-hmacsha256-signature'];
    if (!square.verifyWebhook(rawBody, signature)) {
      return res.status(403).json({ ok: false, provider: 'square', error: 'Invalid Square webhook signature.' });
    }
    const event = req.body && typeof req.body === 'object' ? req.body : JSON.parse(rawBody.toString('utf8'));
    const eventId = String(event.event_id || event.id || '');
    const payment = squarePaymentObject(event);
    const squareSubscription = squareSubscriptionObject(event);

    if (payment?.status === 'COMPLETED' && paymentService?.handleCompletedPayment) {
      await paymentService.handleCompletedPayment(payment);
    }

    await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      if (eventId && state.squareWebhookEvents[eventId]) return true;
      const eventType = String(event.type || 'unknown');
      const note = decodeSquarePaymentNote(payment?.note);
      let targetSubscription = null;
      let actorUserId = 'system';

      if (note?.type === 'subscription') {
        const userId = String(note.payload?.u || '');
        const price = priceFromSquarePayload(note.payload || {});
        actorUserId = userId || actorUserId;
        targetSubscription = Object.values(state.subscriptions).find((row) => String(row.user_id || row.userId) === userId)
          || Object.values(state.subscriptions).find((row) => row.square_order_id && row.square_order_id === payment?.order_id)
          || { id: id('sub'), user_id: userId, created_at: nowIso() };
        Object.assign(targetSubscription, {
          provider: 'square',
          status: payment?.status === 'COMPLETED' ? 'active' : targetSubscription.status,
          plan: price.plan,
          billing_cycle: price.billingCycle,
          account_quantity: price.accountQuantity,
          addon_analyzer: price.addons.analyzer,
          addon_dedicated_env: price.addons.dedicatedEnv,
          addon_extra_env_accounts: price.addons.extraEnvAccounts,
          price_cents: price.total || Number(payment?.amount_money?.amount || targetSubscription.price_cents || 0),
          square_payment_id: payment?.id || targetSubscription.square_payment_id,
          square_order_id: payment?.order_id || targetSubscription.square_order_id,
          square_customer_id: payment?.customer_id || targetSubscription.square_customer_id,
          updated_at: nowIso(),
        });
        const orphan = state.squareOrphanSubscriptions[targetSubscription.square_customer_id] || null;
        if (orphan) {
          targetSubscription.square_subscription_id = orphan.id;
          targetSubscription.status = normalizeSquareSubscriptionStatus(orphan.status);
          delete state.squareOrphanSubscriptions[targetSubscription.square_customer_id];
        }
        state.subscriptions[targetSubscription.id] = targetSubscription;
      } else if (note?.type === 'legacy_checkout' && payment?.status === 'COMPLETED') {
        const userId = String(note.payload?.u || '');
        const productId = String(note.payload?.p || '');
        const membershipProduct = Number(note.payload?.m || 0) === 1;
        const affiliateId = String(note.payload?.a || '');
        const referralCode = String(note.payload?.r || '');
        const splitPercent = Math.max(1, Math.min(80, Number(note.payload?.s || 30)));
        const amountCents = Number(payment?.amount_money?.amount || 0);
        actorUserId = userId || actorUserId;
        if (payment?.id) {
          state.payments[payment.id] = {
            id: payment.id,
            provider: 'square',
            userId,
            productId,
            amountTotal: amountCents,
            status: 'COMPLETED',
            membershipProduct,
            affiliateId,
            referralCode,
            squareOrderId: payment.order_id || null,
            squareCustomerId: payment.customer_id || null,
            createdAt: nowIso(),
          };
        }
        if (affiliateId) {
          state.affiliatePayouts.push({
            id: id('affiliate_payout'),
            affiliateId,
            referralCode,
            buyerUserId: userId,
            paymentId: payment.id,
            grossAmount: amountCents / 100,
            splitPercent,
            payoutAmount: (amountCents / 100) * (splitPercent / 100),
            status: 'earned_pending_review',
            provider: 'square',
            createdAt: nowIso(),
          });
          if (state.affiliatesById?.[affiliateId]) {
            state.affiliatesById[affiliateId].status = 'active';
            state.affiliatesById[affiliateId].squarePaymentId = payment.id;
            state.affiliatesById[affiliateId].updatedAt = nowIso();
          }
        }
        if (membershipProduct && userId) {
          state.memberships[userId] = {
            ...(state.memberships[userId] || {}),
            userId,
            status: 'square_active',
            source: 'square_checkout',
            productId,
            squarePaymentId: payment.id,
            squareOrderId: payment.order_id || null,
            squareCustomerId: payment.customer_id || null,
            updatedAt: nowIso(),
          };
          const legacySubId = payment.subscription_id || payment.order_id || payment.id;
          state.subscriptionsById[legacySubId] = {
            ...(state.subscriptionsById[legacySubId] || {}),
            id: legacySubId,
            userId,
            productId,
            status: 'active',
            provider: 'square',
            squarePaymentId: payment.id,
            squareOrderId: payment.order_id || null,
            squareCustomerId: payment.customer_id || null,
            updatedAt: nowIso(),
          };
          state.admin_logs.push({ id: id('admin_log'), action: 'square_membership_activated', userId, productId, paymentId: payment.id, createdAt: nowIso() });
        } else {
          state.admin_logs.push({ id: id('admin_log'), action: 'square_one_time_product_paid', userId, productId, paymentId: payment.id, createdAt: nowIso() });
        }
        audit(state, userId, 'square.legacy_checkout.completed', membershipProduct ? 'Membership' : 'Payment', payment.id || productId, { productId, affiliateId, squareOrderId: payment.order_id || null });
      } else if (note?.type === 'link_access' && payment?.status === 'COMPLETED') {
        const accessId = String(note.payload?.a || '');
        const userId = String(note.payload?.u || '');
        actorUserId = userId || actorUserId;
        const access = state.paidLinkAccessById?.[accessId];
        if (access) {
          access.status = 'active';
          access.source = 'square';
          access.squarePaymentId = payment.id;
          access.squareOrderId = payment.order_id || access.squareOrderId || null;
          access.squareCustomerId = payment.customer_id || null;
          access.activatedAt = nowIso();
          access.updatedAt = nowIso();
          audit(state, userId, 'square.link_access.activated', 'PaidLinkAccess', accessId, { squarePaymentId: payment.id });
        }
      } else if (note?.type === 'affiliate_activation' && payment?.status === 'COMPLETED') {
        const userId = String(note.payload?.u || '');
        actorUserId = userId || actorUserId;
        const affiliate = Object.values(state.affiliates).find((row) => String(row.user_id || row.userId) === userId) || {
          id: id('affiliate'),
          user_id: userId,
          created_at: nowIso(),
        };
        Object.assign(affiliate, {
          status: 'active',
          referrer_code: String(note.payload?.r || affiliate.referrer_code || ''),
          activated_at: nowIso(),
          provider: 'square',
          square_payment_id: payment.id,
          square_order_id: payment.order_id || null,
          square_customer_id: payment.customer_id || null,
          updated_at: nowIso(),
        });
        state.affiliates[affiliate.id] = affiliate;
        audit(state, userId, 'square.affiliate.activated', 'Affiliate', affiliate.id, { squarePaymentId: payment.id });
      }

      if (squareSubscription?.id) {
        const legacyMembership = Object.values(state.memberships).find((row) => row.squareSubscriptionId === squareSubscription.id)
          || Object.values(state.memberships).find((row) => row.squareCustomerId && row.squareCustomerId === squareSubscription.customer_id);
        if (legacyMembership) {
          legacyMembership.squareSubscriptionId = squareSubscription.id;
          legacyMembership.squareCustomerId = squareSubscription.customer_id || legacyMembership.squareCustomerId;
          legacyMembership.status = ['ACTIVE','PENDING'].includes(String(squareSubscription.status || '').toUpperCase()) ? 'square_active' : 'inactive';
          legacyMembership.source = 'square_subscription';
          legacyMembership.updatedAt = nowIso();
        }
        targetSubscription = Object.values(state.subscriptions).find((row) => row.square_subscription_id === squareSubscription.id)
          || Object.values(state.subscriptions).find((row) => row.square_customer_id && row.square_customer_id === squareSubscription.customer_id)
          || targetSubscription;
        if (targetSubscription) {
          targetSubscription.square_subscription_id = squareSubscription.id;
          targetSubscription.square_customer_id = squareSubscription.customer_id || targetSubscription.square_customer_id;
          targetSubscription.status = normalizeSquareSubscriptionStatus(squareSubscription.status);
          targetSubscription.cancel_at_period_end = Boolean(squareSubscription.canceled_date);
          targetSubscription.current_period_end = squareSubscription.charged_through_date || targetSubscription.current_period_end;
          targetSubscription.updated_at = nowIso();
          state.subscriptions[targetSubscription.id] = targetSubscription;
          actorUserId = String(targetSubscription.user_id || targetSubscription.userId || actorUserId);
        } else {
          state.squareOrphanSubscriptions[squareSubscription.customer_id || squareSubscription.id] = squareSubscription;
        }
      }

      if (payment && ['FAILED', 'CANCELED'].includes(String(payment.status || '').toUpperCase()) && note?.type === 'subscription' && targetSubscription) {
        targetSubscription.status = 'past_due';
        targetSubscription.updated_at = nowIso();
      }
      if (eventId) state.squareWebhookEvents[eventId] = { eventType, received_at: nowIso() };
      if (targetSubscription) audit(state, actorUserId, `square.${eventType}`, 'Subscription', targetSubscription.id, { squareEventId: eventId, squarePaymentId: payment?.id || null, squareSubscriptionId: squareSubscription?.id || null });
      return true;
    });
    res.json({ received: true, provider: 'square' });
  };

  app.post('/api/public/webhooks/square', squareWebhookHandler);
  app.post('/api/square/webhook', squareWebhookHandler);

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
  app.get('/api/v2/education/live-learning', requireUser, (req, res) => res.json({ ok: true, sessions: getLiveLearning(), aiWebinarRoom: true, providerReady: Boolean(process.env.OPENAI_API_KEY), providerUrl: '/app/education#ai-webinar-room', videoProviderReady: Boolean(process.env.WISDO_AI_VIDEO_PROVIDER_URL) }));


  function clientWebinarSession(row) {
    if (!row) return null;
    return {
      ...row,
      webinar: {
        ...row.webinar,
        quiz: (row.webinar?.quiz || []).map(({ answerIndex, ...question }) => question),
      },
    };
  }

  async function generateWebinarContent({ request, strategy, learnerProfile, course }) {
    const fallbackInput = { question: request.question, topic: request.topic, level: request.level, durationMinutes: request.durationMinutes, chartSymbol: request.chartSymbol, chartInterval: request.chartInterval, strategy, learnerProfile, course };
    let webinar = buildFallbackWebinar(fallbackInput);
    let provider = 'adaptive_fallback';
    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = buildWebinarPrompt(fallbackInput);
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            model: process.env.WISDO_AI_MODEL || 'gpt-4.1-mini',
            messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
            response_format: { type: 'json_object' },
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(45000),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
          const content = payload.choices?.[0]?.message?.content || '{}';
          webinar = normalizeGeneratedWebinar(JSON.parse(content), fallbackInput);
          provider = 'openai';
        } else {
          logger?.warn?.('AI Webinar provider rejected request', { status: response.status, message: payload.error?.message });
        }
      } catch (error) {
        logger?.warn?.('AI Webinar fallback activated', { message: error.message });
      }
    }
    await hydrateWebinarCharts(webinar, historicalMarketData);
    return { webinar, provider };
  }

  app.get('/api/v2/webinar-ai/config', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const strategies = Object.values(state.aiWebinarStrategies).filter(isPublishedStrategy).map(publicStrategy).sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    res.json({
      ok: true,
      version: AI_WEBINAR_VERSION,
      mode: 'on_demand_ai_video_with_real_historical_chart_teacher',
      browserNarrationReady: true,
      chartTeacherReady: true,
      tradingViewReady: true,
      realHistoricalExamplesRequired: true,
      historicalDataProviderReady: historicalMarketData.isConfigured('OANDA:XAUUSD', '15'),
      historicalDataProviders: historicalMarketData.configuredProviders('OANDA:XAUUSD', '15'),
      aiProviderReady: Boolean(process.env.OPENAI_API_KEY),
      externalVideoProviderReady: Boolean(process.env.WISDO_AI_VIDEO_PROVIDER_URL),
      canTeachStrategies: isAdmin(state, req.wisdoUser),
      strategies,
      templates: getLiveLearning(),
      disclaimer: AI_WEBINAR_DISCLAIMER,
    });
  });

  app.get('/api/v2/webinar-ai/library', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const userId = String(req.wisdoUser.id);
    const ids = state.aiWebinarSessionsByUser[userId] || [];
    const sessions = ids.map((sessionId) => state.aiWebinarSessions[sessionId]).filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ ok: true, sessions: sessions.slice(0, 100).map(clientWebinarSession) });
  });

  app.post('/api/v2/webinar-ai/generate', requireUser, async (req, res) => {
    const request = {
      question: String(req.body?.question || '').trim().slice(0, 4000),
      topic: String(req.body?.topic || '').trim().slice(0, 500),
      level: String(req.body?.level || 'starter').toLowerCase(),
      durationMinutes: Math.max(3, Math.min(30, Number(req.body?.durationMinutes || 8) || 8)),
      strategyId: String(req.body?.strategyId || ''),
      courseId: String(req.body?.courseId || ''),
      chartSymbol: String(req.body?.chartSymbol || '').trim().slice(0, 80),
      chartInterval: String(req.body?.chartInterval || '').trim().slice(0, 20),
    };
    if (!request.question && !request.topic) return res.status(400).json({ ok: false, error: 'Tell WISDO what the webinar should teach.' });
    const state = ensure(await loadEcosystemState());
    const strategy = request.strategyId ? state.aiWebinarStrategies[request.strategyId] : null;
    if (request.strategyId && (!strategy || !isPublishedStrategy(strategy))) return res.status(409).json({ ok: false, error: 'That strategy is not published for AI teaching.' });
    const learnerProfile = state.learnerProfiles[req.wisdoUser.id] || { experience: request.level, goals: [], markets: [], interests: [], learningStyle: 'interactive' };
    const course = request.courseId ? getAcademyCourse(request.courseId) : null;
    const generated = await generateWebinarContent({ request, strategy, learnerProfile, course });
    const session = createWebinarSession({ userId: req.wisdoUser.id, request, webinar: generated.webinar, provider: generated.provider, strategy, course });
    await mutate(loadEcosystemState, saveEcosystemState, (nextState) => {
      nextState.aiWebinarSessions[session.sessionId] = session;
      const rows = nextState.aiWebinarSessionsByUser[req.wisdoUser.id] ||= [];
      rows.unshift(session.sessionId);
      nextState.aiWebinarSessionsByUser[req.wisdoUser.id] = [...new Set(rows)].slice(0, 200);
      audit(nextState, req.wisdoUser.id, 'ai_webinar.generated', 'AiWebinarSession', session.sessionId, { provider: generated.provider, strategyId: strategy?.strategyId || null, courseId: course?.id || null });
      return true;
    });
    res.status(201).json({ ok: true, session: clientWebinarSession(session) });
  });

  app.get('/api/v2/webinar-ai/sessions/:sessionId', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const session = state.aiWebinarSessions[req.params.sessionId];
    if (!session || String(session.userId) !== String(req.wisdoUser.id)) return res.status(404).json({ ok: false, error: 'AI webinar not found.' });
    res.json({ ok: true, session: clientWebinarSession(session) });
  });

  app.patch('/api/v2/webinar-ai/sessions/:sessionId/progress', requireUser, async (req, res) => {
    const progress = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const session = state.aiWebinarSessions[req.params.sessionId];
      if (!session || String(session.userId) !== String(req.wisdoUser.id)) return null;
      session.progress = {
        ...session.progress,
        sceneIndex: Math.max(0, Math.min((session.webinar?.scenes?.length || 1) - 1, Number(req.body?.sceneIndex ?? session.progress?.sceneIndex ?? 0) || 0)),
        watchedSeconds: Math.max(0, Number(req.body?.watchedSeconds ?? session.progress?.watchedSeconds ?? 0) || 0),
        completed: req.body?.completed == null ? Boolean(session.progress?.completed) : Boolean(req.body.completed),
        updatedAt: nowIso(),
      };
      session.updatedAt = nowIso();
      return session.progress;
    });
    if (!progress) return res.status(404).json({ ok: false, error: 'AI webinar not found.' });
    res.json({ ok: true, progress });
  });

  app.post('/api/v2/webinar-ai/sessions/:sessionId/quiz', requireUser, async (req, res) => {
    const result = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const session = state.aiWebinarSessions[req.params.sessionId];
      if (!session || String(session.userId) !== String(req.wisdoUser.id)) return null;
      const grade = gradeWebinarQuiz(session, req.body?.answers || {});
      session.progress = { ...session.progress, quizScore: grade.score, completed: grade.passed || Boolean(session.progress?.completed), updatedAt: nowIso() };
      session.updatedAt = nowIso();
      audit(state, req.wisdoUser.id, 'ai_webinar.quiz_submitted', 'AiWebinarSession', session.sessionId, { score: grade.score, passed: grade.passed });
      return grade;
    });
    if (!result) return res.status(404).json({ ok: false, error: 'AI webinar not found.' });
    res.json({ ok: true, ...result, results: result.results.map(({ correctIndex, ...row }) => row) });
  });

  app.post('/api/v2/webinar-ai/sessions/:sessionId/questions', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const session = state.aiWebinarSessions[req.params.sessionId];
    if (!session || String(session.userId) !== String(req.wisdoUser.id)) return res.status(404).json({ ok: false, error: 'AI webinar not found.' });
    const question = String(req.body?.question || '').trim().slice(0, 4000);
    if (!question) return res.status(400).json({ ok: false, error: 'Enter a follow-up question.' });
    const lessonContext = (session.webinar?.scenes || []).map((scene) => `${scene.title}: ${scene.narration}`).join('\n').slice(0, 18000);
    let answer = `Based on this webinar, focus on the approved process: identify the condition, wait for confirmation, define invalidation, control risk, and practice in simulation before live execution. Your question was: ${question}`;
    let provider = 'adaptive_fallback';
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model: process.env.WISDO_AI_MODEL || 'gpt-4.1-mini', temperature: 0.2, messages: [
            { role: 'system', content: `You are the WISDO AI Webinar follow-up coach. Answer only from the lesson context and approved strategy version. If the answer is not present, say the admin has not taught that rule yet. Never invent a rule, promise profit, or direct a live trade. ${AI_WEBINAR_DISCLAIMER}` },
            { role: 'user', content: `Lesson context:\n${lessonContext}\n\nQuestion: ${question}` },
          ] }),
          signal: AbortSignal.timeout(30000),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.choices?.[0]?.message?.content) { answer = payload.choices[0].message.content; provider = 'openai'; }
      } catch (error) { logger?.warn?.('AI Webinar follow-up fallback', { message: error.message }); }
    }
    const row = { questionId: id('webinar_question'), question, answer, provider, createdAt: nowIso() };
    await mutate(loadEcosystemState, saveEcosystemState, (nextState) => {
      const target = nextState.aiWebinarSessions[req.params.sessionId];
      if (!target || String(target.userId) !== String(req.wisdoUser.id)) return false;
      target.questions ||= [];
      target.questions.push(row);
      target.questions = target.questions.slice(-100);
      target.updatedAt = nowIso();
      return true;
    });
    res.json({ ok: true, question: row });
  });

  app.post('/api/v2/webinar-ai/sessions/:sessionId/render-video', requireUser, async (req, res) => {
    const providerUrl = String(process.env.WISDO_AI_VIDEO_PROVIDER_URL || '').trim();
    if (!providerUrl) return res.status(503).json({ ok: false, browserNarrationReady: true, error: 'External MP4 rendering is not configured. The interactive narrated webinar is ready now.' });
    const state = ensure(await loadEcosystemState());
    const session = state.aiWebinarSessions[req.params.sessionId];
    if (!session || String(session.userId) !== String(req.wisdoUser.id)) return res.status(404).json({ ok: false, error: 'AI webinar not found.' });
    try {
      const response = await fetch(providerUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(process.env.WISDO_AI_VIDEO_PROVIDER_KEY ? { authorization: `Bearer ${process.env.WISDO_AI_VIDEO_PROVIDER_KEY}` } : {}) },
        body: JSON.stringify({ sessionId: session.sessionId, title: session.webinar.title, presenter: session.webinar.presenter, scenes: session.webinar.scenes, callbackUrl: `${baseUrl(req, config)}/api/public/webhooks/ai-webinar-video`, callbackHeader: process.env.WISDO_AI_VIDEO_WEBHOOK_SECRET ? { 'x-wisdo-video-secret': process.env.WISDO_AI_VIDEO_WEBHOOK_SECRET } : undefined }),
        signal: AbortSignal.timeout(45000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return res.status(502).json({ ok: false, error: payload.error || payload.message || 'Video provider rejected the render request.' });
      const externalVideo = { status: payload.status || 'queued', jobId: payload.jobId || payload.id || null, url: payload.url || null, provider: payload.provider || 'configured_provider', requestedAt: nowIso() };
      await mutate(loadEcosystemState, saveEcosystemState, (nextState) => { nextState.aiWebinarSessions[session.sessionId].externalVideo = externalVideo; return true; });
      res.json({ ok: true, externalVideo });
    } catch (error) { res.status(502).json({ ok: false, error: error.message }); }
  });

  app.post('/api/public/webhooks/ai-webinar-video', async (req, res) => {
    const secret = String(process.env.WISDO_AI_VIDEO_WEBHOOK_SECRET || '');
    if (!secret) return res.status(503).json({ ok: false, error: 'AI video webhook secret is not configured.' });
    if (String(req.headers['x-wisdo-video-secret'] || '') !== secret) return res.status(401).json({ ok: false, error: 'Invalid video webhook secret.' });
    const sessionId = String(req.body?.sessionId || '');
    const updated = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const session = state.aiWebinarSessions[sessionId];
      if (!session) return null;
      session.externalVideo = { ...(session.externalVideo || {}), status: String(req.body?.status || 'ready'), url: req.body?.url || session.externalVideo?.url || null, jobId: req.body?.jobId || session.externalVideo?.jobId || null, updatedAt: nowIso() };
      session.updatedAt = nowIso();
      return session.externalVideo;
    });
    if (!updated) return res.status(404).json({ ok: false, error: 'AI webinar not found.' });
    res.json({ ok: true });
  });

  app.get('/api/v2/admin/webinar-ai/strategies', requireUser, adminGuard, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const strategies = Object.values(state.aiWebinarStrategies).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    res.json({ ok: true, strategies, versionHistory: state.aiWebinarStrategyVersions });
  });

  app.post('/api/v2/admin/webinar-ai/strategies', requireUser, adminGuard, async (req, res) => {
    const strategy = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const normalized = normalizeStrategyInput({ ...(req.body || {}), status: 'draft' });
      if (state.aiWebinarStrategies[normalized.strategyId]) return null;
      normalized.createdBy = String(req.wisdoUser.id);
      normalized.updatedBy = String(req.wisdoUser.id);
      state.aiWebinarStrategies[normalized.strategyId] = normalized;
      audit(state, req.wisdoUser.id, 'ai_webinar.strategy_created', 'AiWebinarStrategy', normalized.strategyId, { status: normalized.status, version: normalized.version });
      return normalized;
    });
    if (!strategy) return res.status(409).json({ ok: false, error: 'A strategy with that ID already exists.' });
    res.status(201).json({ ok: true, strategy });
  });

  app.patch('/api/v2/admin/webinar-ai/strategies/:strategyId', requireUser, adminGuard, async (req, res) => {
    const strategy = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const previous = state.aiWebinarStrategies[req.params.strategyId];
      if (!previous) return null;
      const next = normalizeStrategyInput({ ...req.body, strategyId: previous.strategyId }, previous);
      next.updatedBy = String(req.wisdoUser.id);
      // Published knowledge is immutable until the edited version is reviewed and published again.
      if (previous.status === 'published') {
        next.status = 'review';
        delete next.publishedAt;
        delete next.approvedBy;
      } else if (next.status === 'published') {
        next.status = previous.status === 'approved' ? 'approved' : 'review';
      }
      state.aiWebinarStrategies[previous.strategyId] = next;
      audit(state, req.wisdoUser.id, 'ai_webinar.strategy_updated', 'AiWebinarStrategy', previous.strategyId, { status: next.status, version: next.version });
      return next;
    });
    if (!strategy) return res.status(404).json({ ok: false, error: 'Strategy not found.' });
    res.json({ ok: true, strategy });
  });

  app.post('/api/v2/admin/webinar-ai/strategies/:strategyId/publish', requireUser, adminGuard, async (req, res) => {
    const result = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const strategy = state.aiWebinarStrategies[req.params.strategyId];
      if (!strategy) return { error: 'not_found' };
      const ruleCount = (strategy.entryRules?.length || 0) + (strategy.confirmationRules?.length || 0) + (strategy.exitRules?.length || 0) + (strategy.riskRules?.length || 0);
      if (!strategy.summary || ruleCount < 3 || !(strategy.invalidationRules?.length)) return { error: 'incomplete' };
      strategy.status = 'published';
      strategy.approvedBy = String(req.wisdoUser.id);
      strategy.publishedAt = nowIso();
      strategy.updatedAt = nowIso();
      strategy.updatedBy = String(req.wisdoUser.id);
      const snapshot = structuredClone(strategy);
      const versions = state.aiWebinarStrategyVersions[strategy.strategyId] ||= [];
      versions.push({ ...snapshot, versionSnapshotAt: nowIso() });
      state.aiWebinarStrategyVersions[strategy.strategyId] = versions.slice(-50);
      audit(state, req.wisdoUser.id, 'ai_webinar.strategy_published', 'AiWebinarStrategy', strategy.strategyId, { version: strategy.version });
      return { strategy };
    });
    if (result.error === 'not_found') return res.status(404).json({ ok: false, error: 'Strategy not found.' });
    if (result.error === 'incomplete') return res.status(409).json({ ok: false, error: 'Add a summary, at least three teaching rules, and at least one invalidation rule before publishing.' });
    res.json({ ok: true, strategy: result.strategy });
  });

  function assistantUserContext(state, user, page, selectedAccountId = '', lead = null) {
    const userId = String(user?.id || (lead?.id ? `lead:${lead.id}` : 'public'));
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
      funnelLead: lead ? { id: lead.id, name: lead.name || '', stage: lead.stage || 'new', platform: lead.platform || '', campaign: lead.campaign || '', engagementCount: Number(lead.engagementCount || 0), marketingConsent: Boolean(lead.marketingConsent) } : null,
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
    const leadPayload = verifyLeadAccessToken(req.body?.leadToken || '');
    const lead = leadPayload ? state.funnelLeadsById?.[leadPayload.leadId] || null : null;
    const context = assistantUserContext(state, user, page, req.body?.selectedAccountId, lead);
    const message = String(req.body?.message || '').trim().slice(0, 8000);
    if (!message) return res.status(400).json({ ok: false, error: 'Ask WISDO a question.' });
    const userId = String(user?.id || (lead?.id ? `lead:${lead.id}` : `public:${req.ip || 'unknown'}`));
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
    const portableLeadQuery = lead?.id && req.body?.leadToken ? `?leadToken=${encodeURIComponent(req.body.leadToken)}` : '';
    const actionLinks = (lead?.id && !user ? [
      { id: 'education', label: 'Open Education Room', href: `/education${portableLeadQuery}` },
      { id: 'webinar', label: 'Open Webinar', href: `/webinar/replay${portableLeadQuery}` },
      { id: 'pricing', label: 'Compare Access', href: `/pricing${portableLeadQuery}` },
      { id: 'support', label: 'Open Support', href: '/contact' },
    ] : [
      { id: 'education', label: 'Open Education Hub', href: '/app/education' },
      { id: 'accounts', label: 'Open Accounts', href: '/app/accounts' },
      { id: 'copier', label: 'Open Copier Engine', href: '/app/copier-engine' },
      { id: 'support', label: 'Open Support', href: '/contact' },
    ]).filter((item) => message.toLowerCase().includes(item.id) || item.id === 'support' || item.id === 'education').slice(0, 3);
    const riskyIntent = /(close|flatten|pause|resume|enable|disable|risk setting|copier setting|payment|checkout)/i.test(message);
    await mutate(loadEcosystemState, saveEcosystemState, (nextState) => {
      const thread = nextState.wisdoAssistantThreads[userId] ||= [];
      thread.push({ id: id('wisdo_ai'), role: 'user', content: message, page, createdAt: nowIso() });
      thread.push({ id: id('wisdo_ai'), role: 'assistant', content: answer, provider, page, createdAt: nowIso() });
      nextState.wisdoAssistantThreads[userId] = thread.slice(-120);
      nextState.wisdoAssistantUsage[userId] = { day: today, count: usage.count + 1 };
      if (lead?.id) {
        const currentLead = nextState.funnelLeadsById?.[lead.id];
        if (currentLead) {
          currentLead.lastEngagedAt = nowIso();
          currentLead.lastEngagementType = 'ai_question';
          currentLead.engagementCount = Number(currentLead.engagementCount || 0) + 1;
          if (!['signed_up', 'customer'].includes(currentLead.stage)) currentLead.stage = 'engaged';
          currentLead.updatedAt = nowIso();
          nextState.funnelEvents.unshift({ id: id('funnel_event'), type: 'ai_question', leadId: currentLead.id, campaign: currentLead.campaign || '', source: currentLead.source || '', createdAt: nowIso() });
          nextState.funnelEvents = nextState.funnelEvents.slice(0, 5000);
        }
      }
      return true;
    });
    res.json({ ok: true, answer, provider, context, actionLinks, confirmationRequired: riskyIntent, confirmationMessage: riskyIntent ? 'Use the visible account-specific control and confirmation screen. Wisdo AI did not execute this action.' : null, usage: { day: today, count: usage.count + 1, limit } });
  }

  app.get('/api/wisdo-ai/history', async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const user = currentUser(req);
    const leadPayload = verifyLeadAccessToken(req.query.leadToken || '');
    const lead = leadPayload ? state.funnelLeadsById?.[leadPayload.leadId] || null : null;
    const threadKey = String(user?.id || (lead?.id ? `lead:${lead.id}` : ''));
    if (!threadKey) return res.json({ ok: true, messages: [] });
    return res.json({ ok: true, messages: (state.wisdoAssistantThreads[threadKey] || []).slice(-60) });
  });
  app.delete('/api/wisdo-ai/history', async (req, res) => {
    const user = currentUser(req);
    const state = ensure(await loadEcosystemState());
    const leadPayload = verifyLeadAccessToken(req.body?.leadToken || req.query?.leadToken || '');
    const lead = leadPayload ? state.funnelLeadsById?.[leadPayload.leadId] || null : null;
    const threadKey = String(user?.id || (lead?.id ? `lead:${lead.id}` : ''));
    if (!threadKey) return res.status(401).json({ ok: false, error: 'Lead access or login required.' });
    await mutate(loadEcosystemState, saveEcosystemState, (nextState) => {
      nextState.wisdoAssistantThreads[threadKey] = [];
      return true;
    });
    return res.json({ ok: true });
  });

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
    const leadPayload = verifyLeadAccessToken(req.query.leadToken || '');
    const lead = leadPayload ? state.funnelLeadsById?.[leadPayload.leadId] || null : null;
    res.json({ ok: true, context: assistantUserContext(state, user, req.query.currentPage || req.headers.referer || '/', req.query.selectedAccountId, lead) });
  });
  app.post('/api/wisdo-ai/chat', async (req, res) => handleAssistantChat(req, res, false));
  app.post('/api/v2/wisdo-ai/chat', requireUser, async (req, res) => handleAssistantChat(req, res, true));

  app.get('/api/v2/academy/tracks', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const progress = state.academyProgress[req.wisdoUser.id] || { completed_lessons: [], score: 0, badges: [] };
    const learnerProfile = state.learnerProfiles[req.wisdoUser.id] || null;
    res.json({ ok: true, tracks: ACADEMY_TRACKS, progress, learnerProfile, canTeachStrategies: isAdmin(state, req.wisdoUser), summary: getAcademySummary() });
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
    const feeCents = Math.round(Number(config?.affiliate?.activationFeeAmount || 125) * 100);
    if (!square.isConfigured()) {
      return res.status(503).json({ ok: false, provider: 'square', providerReady: false, error: 'Square checkout is not configured.', feeCents });
    }
    try {
      const referrerCode = String(req.body?.referrer_code || '');
      const checkout = await square.createOneTimePaymentLink({
        name: 'WISDO Affiliate Activation',
        amountCents: feeCents,
        note: encodeSquarePaymentNote('affiliate_activation', { u: String(req.wisdoUser.id), r: referrerCode }),
        redirectUrl: `${baseUrl(req, config)}/app/affiliate?activated=1&provider=square`,
        buyerEmail: req.wisdoUser.email,
      });
      await mutate(loadEcosystemState, saveEcosystemState, (state) => {
        const key = checkout.orderId || checkout.id;
        state.squareCheckoutIntents[key] = {
          id: id('square_intent'),
          type: 'affiliate_activation',
          user_id: String(req.wisdoUser.id),
          referrer_code: referrerCode,
          amount_cents: feeCents,
          payment_link_id: checkout.id,
          order_id: checkout.orderId,
          created_at: nowIso(),
        };
        return true;
      });
      res.json({ ok: true, provider: 'square', providerReady: true, url: checkout.url, paymentLinkId: checkout.id, orderId: checkout.orderId, feeCents });
    } catch (error) {
      logger?.error?.('Square affiliate checkout failed', { message: error.message });
      res.status(error.expose ? 400 : 502).json({ ok: false, provider: 'square', error: error.message, feeCents });
    }
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
