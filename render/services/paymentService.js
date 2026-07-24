import { logger } from '../logger.js';
import {
  SquarePaymentGateway,
  decodeSquarePaymentNote,
  encodeSquarePaymentNote,
} from './squarePaymentService.js';

function maskCheckoutId(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return 'unknown';
  return `${normalized.slice(0, 6)}***${normalized.slice(-4)}`;
}

function paymentFromEvent(event = {}) {
  return event.data?.object?.payment || event.data?.object || null;
}

export class PaymentService {
  constructor(config, repository, options = {}) {
    this.config = config;
    this.repository = repository;
    this.botStoreService = null;
    this.square = new SquarePaymentGateway(config, options);
  }

  setBotStoreService(botStoreService) {
    this.botStoreService = botStoreService;
  }

  isConfigured() {
    return this.square.isConfigured();
  }

  hasWebhookConfig() {
    return this.square.hasWebhookConfig();
  }

  getSuccessUrl() {
    return `${this.square.publicBaseUrl}${this.config.store.squareSuccessPath || '/store/success'}?provider=square`;
  }

  getCancelUrl() {
    return `${this.square.publicBaseUrl}${this.config.store.squareCancelPath || '/store/cancel'}?provider=square`;
  }

  async createOneTimeCheckout({ name, amountCents, type, payload, buyerEmail, redirectPath = '/checkout/success' }) {
    if (!this.isConfigured()) {
      const error = new Error('Square checkout is not configured yet. Add SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, and PUBLIC_BASE_URL first.');
      error.expose = true;
      throw error;
    }
    return this.square.createOneTimePaymentLink({
      name,
      amountCents,
      note: encodeSquarePaymentNote(type, payload),
      redirectUrl: `${this.square.publicBaseUrl}${redirectPath}${redirectPath.includes('?') ? '&' : '?'}provider=square`,
      buyerEmail,
    });
  }

  async createCheckoutSession({ quote, member, guildId }) {
    if (!this.isConfigured()) {
      const error = new Error(
        'Square checkout is not configured yet. Add SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, and a real PUBLIC_BASE_URL first.',
      );
      error.expose = true;
      throw error;
    }

    const note = encodeSquarePaymentNote('bot_purchase', {
      q: quote.quoteId,
      u: quote.discordUserId,
      g: guildId || '',
    });
    const checkout = await this.square.createOneTimePaymentLink({
      name: quote.botNames.length === 1
        ? `Culture Coin Bot: ${quote.botNames[0]}`
        : `Culture Coin Bot Bundle (${quote.botNames.length})`,
      amountCents: Math.round(quote.finalPriceUsd * 100),
      note,
      redirectUrl: this.getSuccessUrl(),
      buyerEmail: member?.user?.email,
    });

    logger.info('Square checkout link created', {
      quoteId: quote.quoteId,
      discordUserId: quote.discordUserId,
      paymentLinkId: maskCheckoutId(checkout.id),
      orderId: maskCheckoutId(checkout.orderId),
    });

    return checkout;
  }

  async handleWebhook(rawBody, signature) {
    if (!this.hasWebhookConfig()) {
      const error = new Error('Square webhook is not configured.');
      error.expose = true;
      throw error;
    }
    if (!this.square.verifyWebhook(rawBody, signature)) {
      logger.warn('Square webhook signature verification failed');
      const error = new Error('Invalid Square webhook signature');
      error.expose = true;
      throw error;
    }

    const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      const error = new Error('Invalid Square webhook JSON');
      error.expose = true;
      throw error;
    }

    const payment = paymentFromEvent(event);
    if (String(event.type || '').startsWith('payment.') && payment?.status === 'COMPLETED') {
      await this.handleCompletedPayment(payment);
    }

    return {
      ok: true,
      received: true,
      eventType: event.type,
      eventId: event.event_id || null,
    };
  }

  async handleCompletedPayment(payment) {
    const metadata = decodeSquarePaymentNote(payment.note);
    if (!metadata || metadata.type !== 'bot_purchase') return;
    if (!this.botStoreService) {
      logger.warn('Square bot payment completed but no bot store service was attached.');
      return;
    }

    const quoteId = metadata.payload?.q;
    if (!quoteId) {
      logger.warn('Square bot payment completed without quote metadata.', { paymentId: payment.id });
      return;
    }
    await this.botStoreService.handleCompletedCheckoutSession({
      id: payment.id,
      amount_total: Number(payment.amount_money?.amount || 0),
      payment_status: 'paid',
      provider: 'square',
      order_id: payment.order_id || null,
      customer: payment.customer_id || null,
      metadata: {
        quoteId,
        discordUserId: metadata.payload?.u || '',
        guildId: metadata.payload?.g || '',
      },
    });
  }
}
