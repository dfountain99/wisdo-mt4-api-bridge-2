import crypto from 'node:crypto';

const DEFAULT_API_VERSION = '2026-05-20';
const MAX_PAYMENT_NOTE_LENGTH = 500;

function firstNonEmpty(...values) {
  return values.map((value) => String(value ?? '').trim()).find(Boolean) || '';
}

function normalizeCurrency(value = 'USD') {
  const currency = String(value || 'USD').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : 'USD';
}

function normalizeEnvironment(value = 'sandbox') {
  return String(value || '').trim().toLowerCase() === 'production' ? 'production' : 'sandbox';
}

function squareBaseUrl(environment) {
  return normalizeEnvironment(environment) === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload || {}), 'utf8').toString('base64url');
}

function decodePayload(value) {
  try {
    return JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function encodeSquarePaymentNote(type, payload = {}) {
  const normalizedType = String(type || 'payment').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) || 'payment';
  const note = `WISDO1|${normalizedType}|${encodePayload(payload)}`;
  if (note.length > MAX_PAYMENT_NOTE_LENGTH) {
    const error = new Error(`Square payment metadata exceeds ${MAX_PAYMENT_NOTE_LENGTH} characters.`);
    error.expose = true;
    throw error;
  }
  return note;
}

export function decodeSquarePaymentNote(note) {
  const [prefix, type, encoded] = String(note || '').split('|');
  if (prefix !== 'WISDO1' || !type || !encoded) return null;
  const payload = decodePayload(encoded);
  return payload ? { type, payload } : null;
}

export function verifySquareWebhookSignature({ rawBody, signature, signatureKey, notificationUrl }) {
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  const provided = String(signature || '').trim();
  const key = String(signatureKey || '');
  const url = String(notificationUrl || '');
  if (!body || !provided || !key || !url) return false;

  const expected = crypto
    .createHmac('sha256', key)
    .update(`${url}${body}`, 'utf8')
    .digest('base64');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');
  return expectedBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export function squarePlanVariationForCycle(cycle, env = process.env) {
  const normalized = ['monthly', 'quarterly', 'semiannual', 'annual'].includes(cycle) ? cycle : 'monthly';
  const key = {
    monthly: 'SQUARE_SUBSCRIPTION_PLAN_MONTHLY_ID',
    quarterly: 'SQUARE_SUBSCRIPTION_PLAN_QUARTERLY_ID',
    semiannual: 'SQUARE_SUBSCRIPTION_PLAN_SEMIANNUAL_ID',
    annual: 'SQUARE_SUBSCRIPTION_PLAN_ANNUAL_ID',
  }[normalized];
  return firstNonEmpty(env[key], env.SQUARE_SUBSCRIPTION_PLAN_ID);
}

export class SquarePaymentGateway {
  constructor(config = {}, options = {}) {
    const store = config.store || {};
    this.configStore = store;
    this.publicBaseUrl = firstNonEmpty(config.api?.publicBaseUrl, process.env.PUBLIC_BASE_URL).replace(/\/$/, '');
    this.accessToken = firstNonEmpty(store.squareAccessToken, process.env.SQUARE_ACCESS_TOKEN);
    this.applicationId = firstNonEmpty(store.squareApplicationId, process.env.SQUARE_APPLICATION_ID);
    this.locationId = firstNonEmpty(store.squareLocationId, process.env.SQUARE_LOCATION_ID);
    this.environment = normalizeEnvironment(firstNonEmpty(store.squareEnvironment, process.env.SQUARE_ENVIRONMENT, 'sandbox'));
    this.apiVersion = firstNonEmpty(store.squareApiVersion, process.env.SQUARE_API_VERSION, DEFAULT_API_VERSION);
    this.webhookSignatureKey = firstNonEmpty(store.squareWebhookSignatureKey, process.env.SQUARE_WEBHOOK_SIGNATURE_KEY);
    this.webhookPath = firstNonEmpty(store.squareWebhookPath, process.env.SQUARE_WEBHOOK_PATH, '/api/public/webhooks/square');
    this.webhookNotificationUrl = firstNonEmpty(
      store.squareWebhookNotificationUrl,
      process.env.SQUARE_WEBHOOK_NOTIFICATION_URL,
      this.publicBaseUrl ? `${this.publicBaseUrl}${this.webhookPath.startsWith('/') ? this.webhookPath : `/${this.webhookPath}`}` : '',
    );
    this.currency = normalizeCurrency(firstNonEmpty(store.currency, process.env.STORE_CURRENCY, 'USD'));
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  isConfigured() {
    return Boolean(
      this.fetchImpl
      && this.accessToken
      && this.locationId
      && this.publicBaseUrl
      && !this.publicBaseUrl.includes('YOUR_DOMAIN'),
    );
  }

  hasWebhookConfig() {
    return Boolean(this.isConfigured() && this.webhookSignatureKey && this.webhookNotificationUrl);
  }

  apiBaseUrl() {
    return squareBaseUrl(this.environment);
  }

  subscriptionPlanVariationForCycle(cycle) {
    const store = this.configStore || {};
    const normalized = ['monthly', 'quarterly', 'semiannual', 'annual'].includes(cycle) ? cycle : 'monthly';
    const map = {
      monthly: store.squareSubscriptionPlanMonthlyId,
      quarterly: store.squareSubscriptionPlanQuarterlyId,
      semiannual: store.squareSubscriptionPlanSemiannualId,
      annual: store.squareSubscriptionPlanAnnualId,
    };
    return firstNonEmpty(map[normalized], store.squareSubscriptionPlanId, squarePlanVariationForCycle(normalized));
  }

  async request(path, { method = 'GET', body } = {}) {
    if (!this.accessToken) {
      const error = new Error('Square is not configured. Add SQUARE_ACCESS_TOKEN first.');
      error.expose = true;
      throw error;
    }
    const response = await this.fetchImpl(`${this.apiBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Square-Version': this.apiVersion,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const details = Array.isArray(payload.errors)
        ? payload.errors.map((item) => item.detail || item.code).filter(Boolean).join('; ')
        : '';
      const error = new Error(details || `Square request failed with HTTP ${response.status}.`);
      error.status = response.status;
      error.squareErrors = payload.errors || [];
      error.expose = response.status < 500;
      throw error;
    }
    return payload;
  }

  async createPaymentLink({
    name,
    amountCents,
    note,
    redirectUrl,
    buyerEmail,
    subscriptionPlanVariationId = '',
    idempotencyKey = crypto.randomUUID(),
  }) {
    if (!this.isConfigured()) {
      const error = new Error('Square checkout is not configured. Add SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, and PUBLIC_BASE_URL.');
      error.expose = true;
      throw error;
    }
    const amount = Math.max(1, Math.round(Number(amountCents || 0)));
    const checkoutOptions = {};
    if (redirectUrl) checkoutOptions.redirect_url = String(redirectUrl);
    if (subscriptionPlanVariationId) checkoutOptions.subscription_plan_id = String(subscriptionPlanVariationId);

    const payload = await this.request('/v2/online-checkout/payment-links', {
      method: 'POST',
      body: {
        idempotency_key: String(idempotencyKey).slice(0, 192),
        description: String(name || 'WISDO checkout').slice(0, 4096),
        quick_pay: {
          name: String(name || 'WISDO purchase').slice(0, 255),
          price_money: { amount, currency: this.currency },
          location_id: this.locationId,
        },
        ...(Object.keys(checkoutOptions).length ? { checkout_options: checkoutOptions } : {}),
        ...(buyerEmail ? { pre_populated_data: { buyer_email: String(buyerEmail).slice(0, 255) } } : {}),
        ...(note ? { payment_note: String(note).slice(0, MAX_PAYMENT_NOTE_LENGTH) } : {}),
      },
    });

    const link = payload.payment_link;
    if (!link?.url) {
      const error = new Error('Square did not return a checkout URL.');
      error.expose = true;
      throw error;
    }
    return {
      id: link.id,
      url: link.url,
      longUrl: link.long_url || link.url,
      orderId: link.order_id || payload.related_resources?.orders?.[0]?.id || null,
      provider: 'square',
      environment: this.environment,
      raw: payload,
    };
  }

  async createOneTimePaymentLink(input) {
    return this.createPaymentLink(input);
  }

  async createSubscriptionPaymentLink(input) {
    if (!input.subscriptionPlanVariationId) {
      const error = new Error(`Square subscription plan variation is missing for the ${input.billingCycle || 'selected'} billing cycle.`);
      error.expose = true;
      throw error;
    }
    return this.createPaymentLink(input);
  }

  async cancelSubscription(subscriptionId) {
    return this.request(`/v2/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { method: 'POST', body: {} });
  }

  async resumeSubscription(subscriptionId) {
    return this.request(`/v2/subscriptions/${encodeURIComponent(subscriptionId)}/resume`, { method: 'POST', body: {} });
  }

  verifyWebhook(rawBody, signature) {
    return verifySquareWebhookSignature({
      rawBody,
      signature,
      signatureKey: this.webhookSignatureKey,
      notificationUrl: this.webhookNotificationUrl,
    });
  }
}
