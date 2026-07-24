import { randomUUID } from 'node:crypto';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';

import { logger } from '../logger.js';
import { formatUsd, parseBotSelection, pluralize } from '../utils/store.js';

function createUserError(message) {
  const error = new Error(message);
  error.expose = true;
  return error;
}

function buildStoreEmbed(title, color, lines) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(lines.join('\n'))
    .setTimestamp(new Date());
}

export class BotStoreService {
  constructor({
    config,
    repository,
    operatorDeskService,
    botCatalogService,
    botPricingService,
    paymentService,
    client,
  }) {
    this.config = config;
    this.repository = repository;
    this.operatorDeskService = operatorDeskService;
    this.botCatalogService = botCatalogService;
    this.botPricingService = botPricingService;
    this.paymentService = paymentService;
    this.client = client;
  }

  async initialize() {
    if (!this.config.store.enabled) {
      return { enabled: false };
    }

    if (this.config.store.autoSyncOnStart) {
      return this.syncCatalog();
    }

    return { enabled: true, synced: 0, discovered: 0 };
  }

  isCultureCoinMember(member) {
    return this.operatorDeskService.memberHasCultureCoin(member);
  }

  async syncCatalog() {
    return this.botCatalogService.syncLocalInventory();
  }

  async getCatalog() {
    return this.botCatalogService.getCatalog();
  }

  async listBots(filters = {}) {
    const [catalogBots, storedBots] = await Promise.all([
      this.botCatalogService?.getCatalog ? this.botCatalogService.getCatalog() : [],
      this.repository.getAllBots ? this.repository.getAllBots() : [],
    ]);
    const byId = new Map();

    for (const bot of catalogBots || []) byId.set(bot.id, bot);
    for (const bot of storedBots || []) byId.set(bot.id, { ...(byId.get(bot.id) || {}), ...bot });

    return [...byId.values()]
      .filter((bot) => filters.includeInactive || bot.active !== false)
      .filter((bot) => !filters.category || String(bot.category || bot.style || '').toLowerCase() === String(filters.category).toLowerCase())
      .filter((bot) => !filters.accessTier || String(bot.accessTier || 'public') === String(filters.accessTier))
      .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
  }

  async getBot(botId) {
    const stored = this.repository.getBot ? await this.repository.getBot(botId) : null;
    if (stored) return stored;
    const catalog = await this.listBots({ includeInactive: true });
    return catalog.find((bot) => String(bot.id) === String(botId)) || null;
  }

  async createBot(bot = {}, actorUserId = null) {
    if (typeof bot === 'string') {
      return this.createBot(actorUserId || {}, bot);
    }
    const now = new Date().toISOString();
    const id = String(bot.id || bot.slug || bot.name || `bot_${randomUUID()}`)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || `bot_${randomUUID()}`;
    const record = {
      ...bot,
      id,
      active: bot.active !== false,
      accessTier: bot.accessTier || 'public',
      versions: Array.isArray(bot.versions) ? bot.versions : [],
      currentVersionId: bot.currentVersionId || bot.version || null,
      createdAt: bot.createdAt || now,
      updatedAt: now,
      audit: [
        ...(Array.isArray(bot.audit) ? bot.audit : []),
        this.buildMarketplaceAudit('bot.created', actorUserId, { botId: id }),
      ],
    };

    await this.repository.saveBot(record);
    return record;
  }

  async updateBot(botId, updates = {}, actorUserId = null) {
    if (typeof updates === 'string') {
      return this.updateBot(updates, actorUserId || {}, botId);
    }
    const existing = await this.getBot(botId);
    if (!existing) throw createUserError('Bot metadata was not found.');

    const record = {
      ...existing,
      ...updates,
      id: existing.id,
      versions: updates.versions !== undefined ? updates.versions : existing.versions || [],
      updatedAt: new Date().toISOString(),
      audit: [
        ...(Array.isArray(existing.audit) ? existing.audit : []),
        this.buildMarketplaceAudit('bot.updated', actorUserId, { botId, fields: Object.keys(updates) }),
      ],
    };

    await this.repository.saveBot(record);
    return record;
  }

  async addBotVersion(botId, version = {}, actorUserId = null) {
    if (typeof version === 'string') {
      return this.addBotVersion(version, actorUserId || {}, botId);
    }
    const existing = await this.getBot(botId);
    if (!existing) throw createUserError('Bot metadata was not found.');

    const versionId = String(version.versionId || version.id || `ver_${Date.now()}`);
    const nextVersion = {
      ...version,
      versionId,
      status: version.status || 'active',
      createdAt: version.createdAt || new Date().toISOString(),
    };
    const versions = [...(Array.isArray(existing.versions) ? existing.versions : [])]
      .filter((item) => String(item.versionId || item.id) !== versionId);
    versions.push(nextVersion);

    return this.updateBot(botId, {
      versions,
      currentVersionId: version.makeCurrent === false ? existing.currentVersionId || null : versionId,
    }, actorUserId);
  }

  async rollbackBotVersion(botId, versionId, actorUserId = null) {
    if (actorUserId && typeof botId === 'string' && typeof versionId === 'string') {
      const maybeAdminId = botId;
      const maybeBotId = versionId;
      const maybeVersionId = actorUserId;
      if (await this.getBot(maybeBotId)) return this.rollbackBotVersion(maybeBotId, maybeVersionId, maybeAdminId);
    }
    const existing = await this.getBot(botId);
    if (!existing) throw createUserError('Bot metadata was not found.');
    const target = (existing.versions || []).find((version) => String(version.versionId || version.id) === String(versionId));
    if (!target) throw createUserError('Bot version was not found.');

    return this.updateBot(botId, {
      currentVersionId: String(target.versionId || target.id),
      rollbackFromVersionId: existing.currentVersionId || null,
      rolledBackAt: new Date().toISOString(),
    }, actorUserId);
  }

  async getBotAccess(discordUserId, botId = null) {
    const licenses = await this.getLicensesForUser(discordUserId);
    return licenses
      .filter((license) => ['active', 'pending-delivery'].includes(license.status))
      .filter((license) => !botId || String(license.botId) === String(botId));
  }

  async grantBotAccess(input = {}) {
    const {
      discordUserId,
      userId,
      botId,
      source = 'admin-grant',
      expiresAt = null,
      actorUserId = null,
      adminId = null,
    } = typeof input === 'object'
      ? input
      : { actorUserId: input, discordUserId: arguments[1], botId: arguments[2] };
    const bot = await this.getBot(botId);
    if (!bot) throw createUserError('Bot metadata was not found.');

    const license = {
      licenseId: randomUUID(),
      discordUserId: String(discordUserId || userId || ''),
      botId: bot.id,
      botName: bot.name || bot.id,
      source,
      status: 'active',
      grantedByUserId: (actorUserId || adminId) ? String(actorUserId || adminId) : null,
      expiresAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      audit: [this.buildMarketplaceAudit('bot_access.granted', actorUserId || adminId, { discordUserId: discordUserId || userId, botId: bot.id })],
    };

    await this.repository.saveLicense(license);
    return license;
  }

  async recordBotPurchase(input = {}) {
    const {
      discordUserId,
      userId,
      botId,
      botIds = botId ? [botId] : [],
      amountTotalUsd = 0,
      amount = amountTotalUsd,
      paymentStatus = 'paid',
      paymentRef = null,
      source = 'manual',
      actorUserId = null,
    } = typeof input === 'object'
      ? input
      : { discordUserId: input, botIds: [arguments[1]], paymentRef: arguments[2] };
    const ids = Array.isArray(botIds) ? botIds : [botIds];
    const bots = [];
    for (const botId of ids.filter(Boolean)) {
      const bot = await this.getBot(botId);
      if (bot) bots.push(bot);
    }

    const order = {
      orderId: randomUUID(),
      quoteId: null,
      discordUserId: String(discordUserId || userId || ''),
      botIds: bots.map((bot) => bot.id),
      botNames: bots.map((bot) => bot.name || bot.id),
      amountTotalUsd: Number(amount || 0),
      paymentRef,
      paymentStatus,
      status: paymentStatus === 'paid' ? 'paid' : 'pending',
      source,
      createdAt: new Date().toISOString(),
      paidAt: paymentStatus === 'paid' ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
      audit: [this.buildMarketplaceAudit('bot_purchase.recorded', actorUserId, { discordUserId: discordUserId || userId, botIds: ids, paymentRef })],
    };

    await this.repository.saveOrder(order);
    const licenses = [];
    if (order.status === 'paid') {
      for (const bot of bots) {
        licenses.push(await this.grantBotAccess({
          discordUserId: discordUserId || userId,
          botId: bot.id,
          source: 'purchase',
          actorUserId,
        }));
      }
    }

    return { order, licenses };
  }

  buildMarketplaceAudit(action, actorUserId = null, details = {}) {
    return {
      auditId: `store_audit_${randomUUID()}`,
      action,
      actorUserId: actorUserId ? String(actorUserId) : null,
      details,
      createdAt: new Date().toISOString(),
    };
  }

  async getLicensesForUser(discordUserId) {
    return this.repository.getLicensesForUser(discordUserId);
  }

  isDeliverableLicense(license) {
    return ['active', 'pending-delivery'].includes(license.status);
  }

  async getFreeClaimRecord(discordUserId) {
    const licenses = await this.getLicensesForUser(discordUserId);
    return (
      licenses.find(
        (license) =>
          license.source === 'free-claim' && ['active', 'pending-delivery'].includes(license.status),
      ) || null
    );
  }

  async hasFreeClaimAvailable(member) {
    if (!this.config.store.cultureCoinFreeBotEnabled) {
      return false;
    }

    if (!this.isCultureCoinMember(member)) {
      return false;
    }

    const claim = await this.getFreeClaimRecord(member.id);
    return !claim;
  }

  async resolveBotSelection(input) {
    const terms = parseBotSelection(input);
    if (terms.length === 0) {
      throw createUserError('Please provide at least one bot name.');
    }

    const bots = [];
    const ambiguities = [];

    for (const term of terms) {
      const { bot, matches } = await this.botCatalogService.resolveBotInput(term);
      if (!bot && matches.length === 0) {
        throw createUserError(`I could not find a bot matching "${term}". Try /bots first.`);
      }

      if (!bot && matches.length > 1) {
        ambiguities.push({
          term,
          matches: matches.slice(0, 5).map((match) => match.name),
        });
        continue;
      }

      bots.push(bot);
    }

    if (ambiguities.length > 0) {
      const detail = ambiguities
        .map((item) => `"${item.term}" matched: ${item.matches.join(', ')}`)
        .join('\n');
      throw createUserError(`I need a cleaner bot name before I lock this in:\n${detail}`);
    }

    return [...new Map(bots.map((bot) => [bot.id, bot])).values()];
  }

  async createQuote({ member, selection, requestedOfferUsd = null, negotiationMessage = '', forceFreeClaim = false }) {
    const bots = await this.resolveBotSelection(selection);
    const ownedLicenses = await this.getLicensesForUser(member.id);
    const ownedBotIds = new Set(
      ownedLicenses
        .filter((license) => this.isDeliverableLicense(license))
        .map((license) => license.botId),
    );
    const unownedBots = bots.filter((bot) => !ownedBotIds.has(bot.id));

    if (unownedBots.length === 0) {
      throw createUserError('You already have licenses for those bots. Run /my-bots if you need a resend.');
    }

    const quote = this.botPricingService.createQuote({
      discordUserId: member.id,
      bots: unownedBots,
      isCultureCoinMember: this.isCultureCoinMember(member),
      freeClaimAvailable: await this.hasFreeClaimAvailable(member),
      requestedOfferUsd,
      negotiationMessage,
      forceFreeClaim,
    });

    await this.repository.saveQuote({
      ...quote,
      guildId: member.guild.id,
    });

    return quote;
  }

  async deliverBotLicense({
    guild,
    discordUserId,
    bot,
    source,
    quoteId = null,
    orderId = null,
    existingLicense = null,
  }) {
    const licenseRecord =
      existingLicense || (await this.repository.findLicenseForUserBot(discordUserId, bot.id));
    const installGuidePath = await this.botCatalogService.ensureInstallGuide();
    const attachments = [
      new AttachmentBuilder(bot.deliveryPath, { name: bot.deliveryFileName }),
      new AttachmentBuilder(installGuidePath, { name: 'CULTURE_COIN_BOT_INSTALL.txt' }),
    ];

    const deskChannel = guild ? await this.operatorDeskService.getDeskChannelForUser(guild, discordUserId) : null;
    const user = await this.client.users.fetch(discordUserId).catch(() => null);
    const deliveryMessage = [
      `Your Culture Coin bot delivery is ready: **${bot.name}**`,
      '',
      `License source: ${source === 'free-claim' ? 'Culture Coin free bot claim' : 'Paid purchase'}`,
      'Files are attached below.',
      'Keep this file private and do not reshare it.',
    ].join('\n');

    let deliveredVia = 'none';
    let deliveryChannelId = null;

    if (deskChannel) {
      await deskChannel.send({
        content: `<@${discordUserId}> ${deliveryMessage}`,
        files: attachments,
      });
      deliveredVia = 'desk';
      deliveryChannelId = deskChannel.id;
    } else if (user) {
      await user.send({
        content: deliveryMessage,
        files: attachments,
      });
      deliveredVia = 'dm';
    } else {
      throw createUserError('Payment was recorded, but I could not reach the user for delivery.');
    }

    const license = {
      licenseId: licenseRecord?.licenseId || randomUUID(),
      discordUserId,
      botId: bot.id,
      botName: bot.name,
      source,
      quoteId,
      orderId,
      status: 'active',
      deliveredAt: new Date().toISOString(),
      deliveredVia,
      deliveryChannelId,
      createdAt: licenseRecord?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.repository.saveLicense(license);
    return license;
  }

  async claimFreeBot(member, selection) {
    if (!(await this.hasFreeClaimAvailable(member))) {
      if (!this.isCultureCoinMember(member)) {
        throw createUserError('This free bot claim is only for Culture Coin members.');
      }

      throw createUserError('Your one free Culture Coin bot has already been claimed.');
    }

    const quote = await this.createQuote({
      member,
      selection,
      forceFreeClaim: true,
    });

    if (!quote.freeClaimApplied || quote.botIds.length !== 1) {
      throw createUserError('The free claim can only be used on one eligible bot at a time.');
    }

    const bot = await this.repository.getBot(quote.botIds[0]);
    const reservationResult = await this.repository.reserveFreeClaimLicense({
      discordUserId: member.id,
      botId: bot.id,
      botName: bot.name,
      quoteId: quote.quoteId,
    });

    if (!reservationResult.ok) {
      throw createUserError('Your one free Culture Coin bot has already been claimed.');
    }

    let license;
    try {
      license = await this.deliverBotLicense({
        guild: member.guild,
        discordUserId: member.id,
        bot,
        source: 'free-claim',
        quoteId: quote.quoteId,
        existingLicense: reservationResult.reservation,
      });
    } catch (error) {
      await this.repository.saveLicense({
        ...reservationResult.reservation,
        status: 'delivery-failed',
        updatedAt: new Date().toISOString(),
      });
      throw error;
    }

    return { quote, bot, license };
  }

  async negotiate(member, selection, requestedOfferUsd = null, negotiationMessage = '') {
    const quote = await this.createQuote({
      member,
      selection,
      requestedOfferUsd,
      negotiationMessage,
    });

    return {
      quote,
      message: this.botPricingService.buildWisdoNegotiationMessage(quote),
    };
  }

  async createPurchase(member, selection) {
    const quote = await this.createQuote({ member, selection });

    if (quote.finalPriceUsd <= 0) {
      throw createUserError('This selection prices to zero. Use /claim-free-bot for your member free-bot claim.');
    }

    let checkoutSession = null;
    if (this.paymentService?.isConfigured()) {
      checkoutSession = await this.paymentService.createCheckoutSession({
        quote,
        member,
        guildId: member.guild.id,
      });
    }

    return {
      quote,
      checkoutSession,
    };
  }

  async handleCompletedCheckoutSession(session) {
    const quoteId = session.metadata?.quoteId;
    if (!quoteId) {
      logger.warn('Square checkout completed without quote metadata.', {
        sessionId: session.id,
      });
      return;
    }

    const quote = await this.repository.getQuote(quoteId);
    if (!quote) {
      logger.warn('Square checkout completed for unknown quote.', {
        quoteId,
      });
      return;
    }

    const existingOrder = await this.repository.findOrderByCheckoutSessionId(session.id);
    if (existingOrder?.status === 'paid') {
      return existingOrder;
    }

    const order = {
      orderId: existingOrder?.orderId || randomUUID(),
      quoteId,
      discordUserId: quote.discordUserId,
      botIds: quote.botIds,
      botNames: quote.botNames,
      checkoutSessionId: session.id,
      amountTotalUsd:
        typeof session.amount_total === 'number' ? session.amount_total / 100 : quote.finalPriceUsd,
      paymentStatus: session.payment_status || 'paid',
      status: 'paid',
      createdAt: existingOrder?.createdAt || new Date().toISOString(),
      paidAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.repository.saveOrder(order);

    const guild =
      quote.guildId && this.client.guilds.cache.has(quote.guildId)
        ? this.client.guilds.cache.get(quote.guildId)
        : quote.guildId
          ? await this.client.guilds.fetch(quote.guildId).catch(() => null)
          : null;

    for (const botId of quote.botIds) {
      const bot = await this.repository.getBot(botId);
      if (!bot) {
        continue;
      }

      await this.deliverBotLicense({
        guild,
        discordUserId: quote.discordUserId,
        bot,
        source: 'purchase',
        quoteId,
        orderId: order.orderId,
      });
    }

    return order;
  }

  buildCatalogEmbed(member, bots) {
    const freeClaimText = this.isCultureCoinMember(member)
      ? 'Culture Coin perk: one free bot claim is available if you have not used it yet.'
      : 'Culture Coin perk: join Culture Coin to unlock one free bot plus deeper bot pricing.';

    return buildStoreEmbed(
      'Culture Coin Bot Catalog',
      0x1abc9c,
      [
        `Active bots: ${bots.length}`,
        `Base price: ${formatUsd(this.config.store.basePriceUsd)}`,
        `Culture Coin member price: ${formatUsd(this.config.store.cultureCoinPriceUsd)}`,
        `Bundle deal: ${this.config.store.buyThreeGetThreeEnabled ? 'Buy 3 Get 3 Free' : 'Off'}`,
        '',
        freeClaimText,
        '',
        ...bots.slice(0, 20).map((bot) => `- **${bot.name}** — ${bot.style} — ${bot.summary}`),
        ...(bots.length > 20 ? ['', `Showing 20 of ${bots.length}. Use /bot-info for a specific one.`] : []),
      ],
    );
  }

  buildBotInfoEmbed(bot, member, freeClaimAvailable) {
    return buildStoreEmbed(
      `Bot Info: ${bot.name}`,
      0x3498db,
      [
        `Style: ${bot.style}`,
        `Best for: ${bot.audience}`,
        `Description: ${bot.description}`,
        '',
        `Standard price: ${formatUsd(bot.basePriceUsd ?? this.config.store.basePriceUsd)}`,
        `Culture Coin price: ${formatUsd(bot.cultureCoinPriceUsd ?? this.config.store.cultureCoinPriceUsd)}`,
        `Free-claim eligible: ${bot.freeClaimEligible !== false ? 'Yes' : 'No'}`,
        `Bundle eligible: ${bot.bundleEligible !== false ? 'Yes' : 'No'}`,
        `Your free claim available: ${freeClaimAvailable ? 'Yes' : 'No'}`,
      ],
    );
  }

  buildQuoteEmbed(title, quote, leadText) {
    return buildStoreEmbed(title, 0xf39c12, [
      leadText,
      '',
      ...this.botPricingService.buildQuoteSummaryLines(quote),
    ]);
  }

  async buildMyBotsEmbed(discordUserId) {
    const licenses = (await this.getLicensesForUser(discordUserId)).filter(
      (license) => license.status === 'active',
    );
    return buildStoreEmbed(
      'My Culture Coin Bots',
      0x9b59b6,
      licenses.length
        ? licenses.map(
            (license) =>
              `- **${license.botName}** — ${license.source === 'free-claim' ? 'Free Claim' : 'Purchase'} — delivered ${new Date(license.deliveredAt).toLocaleString('en-US')}`,
          )
        : ['No bot deliveries are on file yet.'],
    );
  }

  buildCultureCoinInfoEmbed(member, freeClaimAvailable) {
    const supportContact =
      this.config.store.supportContact ||
      (this.config.ownerUserId ? `<@${this.config.ownerUserId}>` : 'Coach/Admin');

    return buildStoreEmbed(
      'Culture Coin Membership',
      0xe67e22,
      [
        'Culture Coin gives members the deeper lane.',
        '',
        '- Private operator desk with Coach',
        '- One free bot claim',
        `- Member bot pricing at ${formatUsd(this.config.store.cultureCoinPriceUsd)}`,
        '- WISDO desk workflow and accountability system',
        '',
        `Your free claim available: ${freeClaimAvailable ? 'Yes' : 'No'}`,
        this.config.store.joinCultureCoinUrl
          ? `Join link: ${this.config.store.joinCultureCoinUrl}`
          : `Join Culture Coin through ${supportContact}.`,
      ],
    );
  }

  async buildStoreStatus() {
    const [bots, quotes, orders, licenses] = await Promise.all([
      this.repository.getAllBots(),
      this.repository.getAllQuotes(),
      this.repository.getAllOrders(),
      this.repository.getAllLicenses(),
    ]);

    return buildStoreEmbed(
      'Bot Store Status',
      0x34495e,
      [
        `Store enabled: ${this.config.store.enabled ? 'Yes' : 'No'}`,
        `Active bots: ${bots.filter((bot) => bot.active !== false).length}`,
        `Total catalog records: ${bots.length}`,
        `Open quotes: ${quotes.filter((quote) => quote.status === 'open').length}`,
        `Paid orders: ${orders.filter((order) => order.status === 'paid').length}`,
        `Active licenses: ${licenses.filter((license) => license.status === 'active').length}`,
        `Square checkout configured: ${this.paymentService?.isConfigured() ? 'Yes' : 'No'}`,
        `Welcome DM enabled: ${this.config.store.welcomeDmEnabled ? 'Yes' : 'No'}`,
      ],
    );
  }

  async ensureCultureCoinDesk(member) {
    try {
      const result = await this.operatorDeskService.ensureDeskForMember(member);
      const deskReady = ['created', 'existing'].includes(result.status);

      if (!deskReady) {
        logger.warn('Culture Coin member does not have an active desk after automation.', {
          userId: member.id,
          status: result.status,
        });
      }

      return {
        deskReady,
        result,
      };
    } catch (error) {
      logger.error('Automatic desk creation failed', {
        userId: member.id,
        guildId: member.guild.id,
        message: error.message,
      });
      return {
        deskReady: false,
        result: null,
      };
    }
  }

  async sendWarmWelcome(member, reason = 'joined', options = {}) {
    const { deskReady = null } = options;
    const record = (await this.repository.getWelcomeRecord(member.id)) || {
      discordUserId: member.id,
      joinedWelcomeSentAt: null,
      cultureCoinWelcomeSentAt: null,
      lastReason: null,
      lastDeliveryMethod: null,
      updatedAt: null,
    };

    const alreadySent =
      reason === 'culture-coin'
        ? Boolean(record.cultureCoinWelcomeSentAt)
        : Boolean(record.joinedWelcomeSentAt);

    if (alreadySent) {
      return record;
    }

    const isCultureCoinMember = this.isCultureCoinMember(member);
    const freeClaimAvailable = await this.hasFreeClaimAvailable(member);
    const message = [
      `Welcome to **${member.guild.name}**, ${member.user.username}.`,
      '',
      isCultureCoinMember
        ? 'You are already in the Culture Coin lane, so your next move is easy: pick your free bot, get your private desk dialed in, and start operating clean.'
        : 'You got two clean options here: browse the bot vault right now, or join Culture Coin for the deeper lane.',
      '',
      'Start here:',
      '- Run `/bots` to see the MT4 bot catalog.',
      '- Run `/bot-info bot:<name>` for a closer read on any bot.',
      isCultureCoinMember
        ? '- Run `/claim-free-bot bot:<name>` to use your free Culture Coin bot.'
        : '- Run `/buy-bot bots:<name>` if you want to purchase a bot now.',
      '- Run `/culture-coin-info` to see the membership perks and pricing.',
      '',
      isCultureCoinMember && freeClaimAvailable
        ? 'Culture Coin perk ready: your one free bot claim is still open.'
        : 'Culture Coin members get one free bot plus discounted pricing.',
      ...(isCultureCoinMember && deskReady === false
        ? [
            '',
            'Desk note: if your private desk is not visible yet, tell Coach/Admin to run `/create-desk member:@you`.',
          ]
        : []),
    ].join('\n');

    const deliveredMethods = [];

    if (this.config.store.welcomeDmEnabled) {
      await member.send(message).then(
        () => {
          deliveredMethods.push('dm');
        },
        (error) => {
          logger.warn('Could not send welcome DM', {
            userId: member.id,
            message: error.message,
          });
        },
      );
    }

    if (this.config.store.welcomeChannelId) {
      const channel = member.guild.channels.cache.get(this.config.store.welcomeChannelId);
      if (channel?.isTextBased()) {
        await channel
          .send(
            `Welcome <@${member.id}>. Run \`/bots\` to browse the vault or \`/culture-coin-info\` to step into the Culture Coin lane.`,
          )
          .then(
            () => {
              deliveredMethods.push('channel');
            },
            (error) => {
              logger.warn('Could not send welcome channel message', {
                userId: member.id,
                channelId: channel.id,
                message: error.message,
              });
            },
          );
      }
    }

    if (deliveredMethods.length === 0) {
      logger.warn('Warm welcome was not delivered anywhere.', {
        userId: member.id,
        reason,
      });
      return {
        ...record,
        lastReason: reason,
        lastDeliveryMethod: null,
        updatedAt: new Date().toISOString(),
      };
    }

    const nextRecord = {
      ...record,
      joinedWelcomeSentAt:
        reason === 'joined' ? new Date().toISOString() : record.joinedWelcomeSentAt,
      cultureCoinWelcomeSentAt:
        reason === 'culture-coin' ? new Date().toISOString() : record.cultureCoinWelcomeSentAt,
      lastReason: reason,
      lastDeliveryMethod: deliveredMethods.join('+'),
      updatedAt: new Date().toISOString(),
    };

    await this.repository.saveWelcomeRecord(nextRecord);
    return nextRecord;
  }

  async handleGuildMemberJoin(member) {
    if (this.isCultureCoinMember(member)) {
      const deskStatus = await this.ensureCultureCoinDesk(member);
      await this.sendWarmWelcome(member, 'culture-coin', {
        deskReady: deskStatus.deskReady,
      });
      return;
    }

    await this.sendWarmWelcome(member, 'joined');
  }

  async handleCultureCoinRoleActivated(member) {
    const deskStatus = await this.ensureCultureCoinDesk(member);
    await this.sendWarmWelcome(member, 'culture-coin', {
      deskReady: deskStatus.deskReady,
    });
  }
}
