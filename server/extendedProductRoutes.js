import crypto from 'node:crypto';
import Stripe from 'stripe';
import webpush from 'web-push';

import { computePrice } from './majorUpgradeRoutes.js';
import { getSessionUser } from './security.js';

const ACADEMY_TRACKS = [
  { id: 'foundation', title: 'Trading Foundation', lessons: ['market-structure', 'orders-and-risk', 'account-health'] },
  { id: 'df-sauce', title: 'DF Sauce', lessons: ['launch-zones', 'flowspine', 'un-reversal', 'campaign-character'] },
  { id: 'bot-flight-school', title: 'Bot Flight School', lessons: ['reporter-pairing', 'culture-lanes', 'mobile-controls', 'relay-logs'] },
  { id: 'copier-masterclass', title: 'Copier Masterclass', lessons: ['risk-modes', 'symbol-mapping', 'equity-protection', 'close-authority'] },
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
    const leads = Object.values(state.tradingAccounts).filter((account) => account.role === 'master' && (String(account.user_id) === String(req.wisdoUser.id) || account.community_visible || shares.has(account.id))).map((account) => ({ ...account, encrypted_credentials: undefined, access: String(account.user_id) === String(req.wisdoUser.id) ? 'owned' : shares.has(account.id) ? 'shared' : 'community' }));
    res.json({ ok: true, leads });
  });
  app.patch('/api/v2/accounts/:id/community', requireUser, async (req, res) => {
    const account = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const row = state.tradingAccounts[req.params.id];
      if (!row || String(row.user_id) !== String(req.wisdoUser.id)) return null;
      row.community_visible = bool(req.body?.community_visible);
      row.community_name = String(req.body?.community_name || row.community_name || row.nickname || row.broker || '').trim();
      row.updated_at = nowIso();
      audit(state, req.wisdoUser.id, 'account.community_visibility', 'TradingAccount', row.id, { community_visible: row.community_visible });
      return { ...row, encrypted_credentials: undefined };
    });
    if (!account) return res.status(404).json({ ok: false, error: 'Account not found.' });
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

  app.get('/api/v2/academy/tracks', requireUser, async (req, res) => {
    const state = ensure(await loadEcosystemState());
    const progress = state.academyProgress[req.wisdoUser.id] || { completed_lessons: [], score: 0, badges: [] };
    res.json({ ok: true, tracks: ACADEMY_TRACKS, progress });
  });
  app.post('/api/v2/academy/lessons/:lessonId/complete', requireUser, async (req, res) => {
    const progress = await mutate(loadEcosystemState, saveEcosystemState, (state) => {
      const row = state.academyProgress[req.wisdoUser.id] ||= { user_id: req.wisdoUser.id, completed_lessons: [], quiz_scores: {}, badges: [], score: 0, updated_at: nowIso() };
      if (!row.completed_lessons.includes(req.params.lessonId)) row.completed_lessons.push(req.params.lessonId);
      if (req.body?.score != null) row.quiz_scores[req.params.lessonId] = Math.max(0, Math.min(100, Number(req.body.score) || 0));
      row.score = Object.values(row.quiz_scores).reduce((sum, value) => sum + Number(value || 0), 0);
      if (row.completed_lessons.length >= 4 && !row.badges.includes('WISDO Foundation')) row.badges.push('WISDO Foundation');
      if (row.completed_lessons.includes('close-authority') && !row.badges.includes('Copier Certified')) row.badges.push('Copier Certified');
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
