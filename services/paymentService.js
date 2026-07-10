import Stripe from 'stripe';

import { logger } from '../logger.js';

function maskCheckoutId(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return 'unknown';
  }

  return `${normalized.slice(0, 6)}***${normalized.slice(-4)}`;
}

export class PaymentService {
  constructor(config, repository) {
    this.config = config;
    this.repository = repository;
    this.botStoreService = null;
    this.stripe = config.store.stripeSecretKey
      ? new Stripe(config.store.stripeSecretKey)
      : null;
  }

  setBotStoreService(botStoreService) {
    this.botStoreService = botStoreService;
  }

  isConfigured() {
    return Boolean(this.stripe && this.config.api.publicBaseUrl && !this.config.api.publicBaseUrl.includes('YOUR_DOMAIN'));
  }

  hasWebhookConfig() {
    return Boolean(this.isConfigured() && this.config.store.stripeWebhookSecret);
  }

  getSuccessUrl() {
    return `${this.config.api.publicBaseUrl}${this.config.store.stripeSuccessPath}?session_id={CHECKOUT_SESSION_ID}`;
  }

  getCancelUrl() {
    return `${this.config.api.publicBaseUrl}${this.config.store.stripeCancelPath}`;
  }

  async createCheckoutSession({ quote, member, guildId }) {
    if (!this.isConfigured()) {
      const error = new Error(
        'Stripe checkout is not configured yet. Add STRIPE_SECRET_KEY and a real PUBLIC_BASE_URL first.',
      );
      error.expose = true;
      throw error;
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: this.getSuccessUrl(),
      cancel_url: this.getCancelUrl(),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: this.config.store.currency,
            unit_amount: Math.round(quote.finalPriceUsd * 100),
            product_data: {
              name:
                quote.botNames.length === 1
                  ? `Culture Coin Bot: ${quote.botNames[0]}`
                  : `Culture Coin Bot Bundle (${quote.botNames.length})`,
              description: `Discord delivery for ${quote.botNames.join(', ')}`,
            },
          },
        },
      ],
      metadata: {
        quoteId: quote.quoteId,
        discordUserId: quote.discordUserId,
        guildId: guildId || '',
        botIds: quote.botIds.join(','),
        botNames: quote.botNames.join(' | '),
      },
      customer_email: member?.user?.email || undefined,
      client_reference_id: quote.discordUserId,
    });

    logger.info('Stripe checkout session created', {
      quoteId: quote.quoteId,
      discordUserId: quote.discordUserId,
      sessionId: maskCheckoutId(session.id),
    });

    return session;
  }

  async handleWebhook(rawBody, signature) {
    if (!this.hasWebhookConfig()) {
      const error = new Error('Stripe webhook is not configured.');
      error.expose = true;
      throw error;
    }

    let event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.store.stripeWebhookSecret,
      );
    } catch (error) {
      logger.warn('Stripe webhook signature verification failed', {
        message: error.message,
      });
      const exposedError = new Error('Invalid Stripe webhook signature');
      exposedError.expose = true;
      throw exposedError;
    }

    if (event.type === 'checkout.session.completed') {
      await this.handleCheckoutCompleted(event.data.object);
    }

    return {
      ok: true,
      received: true,
      eventType: event.type,
    };
  }

  async handleCheckoutCompleted(session) {
    if (!this.botStoreService) {
      logger.warn('Stripe checkout completed but no bot store service was attached.');
      return;
    }

    await this.botStoreService.handleCompletedCheckoutSession(session);
  }
}
