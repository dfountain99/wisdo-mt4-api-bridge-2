import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';

function nowIso() {
  return new Date().toISOString();
}

function money(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0.0%';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function compactId(value = '') {
  return String(value || '').replace(/[^a-zA-Z0-9_:-]/g, '_').slice(0, 70);
}

function discordTs(value = '', style = 'R') {
  const time = new Date(value || Date.now()).getTime();
  if (!Number.isFinite(time)) return 'n/a';
  return `<t:${Math.floor(time / 1000)}:${style}>`;
}

export class DiscordSignalGridService {
  constructor({ client = null, signalGridService, signalCopyService = null, logger = console } = {}) {
    this.client = client;
    this.signalGridService = signalGridService;
    this.signalCopyService = signalCopyService;
    this.logger = logger;
    this.refreshTimers = new Map();
  }

  websiteUrl(path = '/') {
    const base = String(process.env.PUBLIC_BASE_URL || process.env.WEBSITE_URL || 'http://localhost:3000').replace(/\/$/, '');
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async getUserAccess(userId = '') {
    const roleSync = this.signalCopyService?.roleSyncService;
    if (!roleSync) return { userId, accessLevel: 'none', wisdoRoles: [], matchedDiscordRoles: [], gates: { admin: false, copier: false } };
    const status = await roleSync.getAccessForUser(userId);
    return roleSync.publicAccess ? roleSync.publicAccess(status) : status;
  }

  async ensurePinnedGridMessage(guildId = '', channelId = '') {
    const channel = await this.fetchChannel(channelId);
    if (!channel?.send) throw new Error('Signal channel was not found or cannot be written.');

    const saved = await this.signalGridService.configureChannel({ guildId, channelId, actorUserId: 'system' });
    const current = saved.pinnedMessageId && channel.messages?.fetch
      ? await channel.messages.fetch(saved.pinnedMessageId).catch(() => null)
      : null;
    if (current) {
      if (!current.pinned && current.pin) await current.pin().catch(() => null);
      return current;
    }

    const payload = await this.renderGridPayload(channelId);
    const message = await channel.send({ embeds: payload.embeds, components: payload.components });
    if (message.pin) await message.pin().catch(() => null);
    await this.signalGridService.updateChannelRender(channelId, {
      guildId,
      pinnedMessageId: message.id,
      status: 'active',
      lastRenderHash: payload.renderHash,
      lastRenderedAt: nowIso(),
    });
    await this.audit('signal_grid.pinned_message_created', 'SignalGridChannel', channelId, { messageId: message.id });
    return message;
  }

  async renderGridEmbed(channelId = '') {
    const payload = await this.renderGridPayload(channelId);
    return payload.embeds[0];
  }

  async renderGridPayload(channelId = '') {
    const grid = await this.signalGridService.getDiscordGrid(channelId);
    const lines = [];
    for (const section of grid.sections.slice(0, 6)) {
      lines.push(`**${section.name}**`);
      for (const cell of section.rows.slice(0, 8)) {
        const state = ['inactive', 'expired', 'offline'].includes(cell.status)
          ? 'inactive'
          : `${pct(cell.basketGrowthPercent)} | ${cell.botName} | ${Number(cell.openTradeCount || 0)} trades`;
        lines.push(`${cell.emoji} **${cell.symbol}** ${state}`);
      }
    }
    if (!lines.length) lines.push('No live signal cells yet. The grid will update when MT4 Reporter sends a fresh basket.');

    const embed = new EmbedBuilder()
      .setTitle('WISDO SIGNAL GRID')
      .setDescription(lines.join('\n').slice(0, 3900))
      .setColor(0x2f80ed)
      .addFields(
        { name: 'Last update', value: `<t:${Math.floor(Date.now() / 1000)}:t>`, inline: true },
        { name: 'Mode', value: 'Risk-Based Copy Only', inline: true },
        { name: 'Percent mode', value: String(grid.settings.percentMode || 'balance'), inline: true },
      )
      .setFooter({ text: 'One pinned live grid. Normal updates edit this message; user actions reply privately.' })
      .setTimestamp(new Date());

    const cells = grid.cells.slice(0, 25);
    const active = grid.cells.find((cell) => !['inactive', 'expired', 'offline'].includes(cell.status)) || grid.cells[0];
    const pairOptions = cells.map((cell) => ({
      label: `${cell.symbol} - ${cell.botName}`.slice(0, 100),
      description: `${cell.status} ${pct(cell.basketGrowthPercent)} ${money(cell.floatingPnl)}`.slice(0, 100),
      value: String(cell.id || cell.signalId).slice(0, 100),
      emoji: cell.emoji,
    }));
    const botOptions = [...new Map(grid.cells.map((cell) => [String(cell.botId || cell.botName), cell])).values()].slice(0, 25).map((cell) => ({
      label: String(cell.botName || cell.botId).slice(0, 100),
      description: `${cell.symbol} ${cell.status} ${pct(cell.basketGrowthPercent)}`.slice(0, 100),
      value: String(cell.botId || cell.botName).slice(0, 100),
    }));

    const rows = [];
    if (pairOptions.length) {
      rows.push(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('signal_grid_select_pair')
          .setPlaceholder(pairOptions.length >= 25 ? 'Select pair (first 25; use /signals filters)' : 'Select Pair')
          .addOptions(pairOptions),
      ));
    }
    if (botOptions.length) {
      rows.push(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('signal_grid_select_bot')
          .setPlaceholder(botOptions.length >= 25 ? 'Select bot (first 25; use /signals filters)' : 'Select Bot')
          .addOptions(botOptions),
      ));
    }
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(active ? `signal_grid_view_basket:${compactId(active.id)}` : 'signal_grid_view_basket').setLabel('View Active Basket').setStyle(ButtonStyle.Secondary).setDisabled(!active),
      new ButtonBuilder().setCustomId(active ? `signal_grid_preview_copy:${compactId(active.id)}` : 'signal_grid_preview_copy').setLabel('Preview Copy').setStyle(ButtonStyle.Secondary).setDisabled(!active),
      new ButtonBuilder().setCustomId('signal_grid_refresh_access').setLabel('Refresh My Access').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setLabel('Website Grid').setStyle(ButtonStyle.Link).setURL(this.websiteUrl('/member/signal-grid')),
    ));

    return {
      embeds: [embed],
      components: rows.slice(0, 5),
      renderHash: grid.renderHash,
      grid,
    };
  }

  async updatePinnedGridMessage(channelId = '') {
    const state = await this.signalGridService.repository.loadState();
    const record = state.signalGridChannelsById?.[String(channelId)];
    const channel = await this.fetchChannel(channelId);
    if (!record?.pinnedMessageId || !channel?.messages?.fetch) return this.repairMissingPinnedMessage(channelId);

    const message = await channel.messages.fetch(record.pinnedMessageId).catch(() => null);
    if (!message || message.pinned === false) return this.repairMissingPinnedMessage(channelId);

    const payload = await this.renderGridPayload(channelId);
    if (record.lastRenderHash === payload.renderHash) return { skipped: true, reason: 'render_hash_unchanged', messageId: message.id };
    await message.edit({ embeds: payload.embeds, components: payload.components });
    await this.signalGridService.updateChannelRender(channelId, {
      lastRenderHash: payload.renderHash,
      lastRenderedAt: nowIso(),
      status: 'active',
    });
    return { ok: true, edited: true, messageId: message.id, renderHash: payload.renderHash };
  }

  scheduleGridRefresh(channelId = '') {
    const key = String(channelId || '');
    clearTimeout(this.refreshTimers.get(key));
    const timer = setTimeout(() => {
      this.updatePinnedGridMessage(key).catch((error) => {
        this.logger?.warn?.('Signal grid pinned update failed', { channelId: key, message: error.message });
      });
      this.refreshTimers.delete(key);
    }, 2500);
    timer.unref?.();
    this.refreshTimers.set(key, timer);
    return { scheduled: true, channelId: key };
  }

  async handleGridSelectInteraction(interaction) {
    const selected = interaction.values?.[0] || '';
    if (interaction.customId === 'signal_grid_select_bot') {
      const cells = await this.signalGridService.getBotSignalStatus(selected);
      const active = cells.find((cell) => !['inactive', 'expired', 'offline'].includes(cell.status)) || cells[0];
      return this.sendEphemeralSignalDetail(interaction, active?.id || active?.signalId || '', { selectedBotId: selected });
    }
    return this.sendEphemeralSignalDetail(interaction, selected);
  }

  async handleCopyButtonInteraction(interaction) {
    const userId = interaction.user?.id || '';
    const [action, rawId = ''] = String(interaction.customId || '').split(':');
    try {
      if (action === 'signal_grid_view_basket') return this.sendEphemeralSignalDetail(interaction, rawId);
      if (action === 'signal_grid_preview_copy') return this.sendEphemeralCopyPreview(interaction, rawId);
      if (action === 'signal_grid_copy_basket') return this.sendLiveCopyConfirmation(interaction, rawId);
      if (action === 'signal_grid_confirm_live') return this.executeCopyBasket(interaction, rawId, { paperMode: false });
      if (action === 'signal_grid_paper') return this.executeCopyBasket(interaction, rawId, { paperMode: true });
      if (action === 'signal_grid_copy_bot') return this.sendBotSubscriptionConfirmation(interaction, rawId);
      if (action === 'signal_grid_copy_bot_paper') return this.executeBotSubscription(interaction, rawId, { paperMode: true });
      if (action === 'signal_grid_confirm_bot_live') return this.executeBotSubscription(interaction, rawId, { paperMode: false });
      if (action === 'signal_grid_stop_copy') return this.stopCopyingBot(interaction, rawId);
      if (action === 'signal_grid_education') return this.safeReply(interaction, { ephemeral: true, content: `Open bot education: ${this.websiteUrl(`/member/education?bot=${encodeURIComponent(rawId)}`)}` });
      if (action === 'signal_grid_website' || action === 'signal_grid_open_website') return this.safeReply(interaction, { ephemeral: true, content: `Open the live Wisdo Signal Grid: ${this.websiteUrl('/member/signal-grid')}` });
      if (action === 'signal_grid_refresh_access') return this.refreshAccess(interaction);
      return this.safeReply(interaction, { ephemeral: true, content: 'Select a pair first. All copy actions happen privately through Wisdo risk-based copy rules.' });
    } catch (error) {
      await this.logInteraction({ userId, action: 'signal_grid.discord_interaction_failed', result: 'error', reason: error.message, metadata: { customId: interaction.customId } });
      return this.safeReply(interaction, { ephemeral: true, content: `Signal Grid interaction failed privately: ${error.message}. Website fallback: ${this.websiteUrl('/member/signal-grid')}` });
    }
  }

  async sendEphemeralSignalDetail(interaction, signalId = '', context = {}) {
    const userId = interaction.user?.id || '';
    const detail = await this.signalGridService.getSignalDetail(userId, signalId);
    if (!detail?.signal) return this.safeReply(interaction, { ephemeral: true, content: 'Signal cell was not found or has expired.' });
    const signal = detail.signal;
    const preview = this.signalCopyService
      ? await this.signalCopyService.previewCopySignal(userId, '', signal.id, { paperMode: true }).catch((error) => ({ allowed: false, blockedReasons: [error.message] }))
      : { allowed: false, blockedReasons: ['Copy service unavailable.'] };
    const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(signal.lastUpdateAt || Date.now()).getTime()) / 1000));
    await this.logInteraction({ userId, action: 'signal_grid.detail_opened', signalId: signal.id, botId: signal.botId, symbol: signal.symbol, result: 'ok', metadata: context });

    const embed = new EmbedBuilder()
      .setTitle(`${signal.botName} - ${signal.symbol}`)
      .setColor(signal.tone === 'red' ? 0xeb5757 : signal.tone === 'yellow' ? 0xf2c94c : signal.tone === 'blue' ? 0x2f80ed : 0x27ae60)
      .setDescription([
        `Bot: **${signal.botName}**`,
        `Pair: **${signal.symbol}** | Direction: **${signal.direction}**`,
        `Status: **${signal.status}** | Basket growth: **${pct(signal.basketGrowthPercent)}**`,
        `Floating P/L: **${money(signal.floatingPnl)}** | Open trades: **${Number(signal.openTradeCount || 0)}**`,
        `Average entry: **${signal.averageEntry || 'n/a'}**`,
        `Session: **${signal.session || 'n/a'}** | Volatility: **${signal.volatilityState || 'normal'}**`,
        `Signal age: **${ageSeconds}s** | Expiration: **${signal.expiresAt ? discordTs(signal.expiresAt) : 'n/a'}**`,
        `Provider/source: **${signal.provider || detail.source?.name || 'MT4 Reporter'}**`,
        `Copy availability: **${preview.allowed ? 'available' : 'blocked'}**`,
        `Required membership/role: **${signal.copyRequirement || 'CULTURE COIN MEMBER+'}**`,
        `Required education: **${signal.educationRequired ? 'yes' : 'no'}**`,
        `Selected account: **${preview.accountId || 'none'}**`,
        `Risk setting: **${preview.risk?.mode || 'missing'}** | Projected lot: **${preview.projectedLot || 'n/a'}**`,
        preview.allowed ? 'No blocked reason.' : `Blocked reason: **${(preview.blockedReasons || []).join('; ') || 'requirements not met'}**`,
      ].join('\n'))
      .setFooter({ text: 'Risk-based copy only. Wisdo never blind-copies source lot size.' });

    const rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`signal_grid_preview_copy:${compactId(signal.id)}`).setLabel('Preview Copy').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`signal_grid_copy_basket:${compactId(signal.id)}`).setLabel('Copy This Basket').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`signal_grid_paper:${compactId(signal.id)}`).setLabel('Paper Copy').setStyle(ButtonStyle.Secondary),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`signal_grid_copy_bot:${compactId(signal.botId)}`).setLabel('Copy Future Bot').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`signal_grid_copy_bot_paper:${compactId(signal.botId)}`).setLabel('Paper Bot Copy').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`signal_grid_stop_copy:${compactId(signal.botId)}`).setLabel('Stop Copying Bot').setStyle(ButtonStyle.Danger),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Open Website Grid').setStyle(ButtonStyle.Link).setURL(this.websiteUrl('/member/signal-grid')),
        new ButtonBuilder().setLabel('Open Bot Education').setStyle(ButtonStyle.Link).setURL(this.websiteUrl(`/member/education?bot=${encodeURIComponent(signal.botId)}`)),
        new ButtonBuilder().setLabel('Open Risk Settings').setStyle(ButtonStyle.Link).setURL(this.websiteUrl('/member/risk-profile')),
        new ButtonBuilder().setLabel('Command Center').setStyle(ButtonStyle.Link).setURL(this.websiteUrl('/member/command-center')),
      ),
    ];
    return this.safeReply(interaction, { ephemeral: true, embeds: [embed], components: rows });
  }

  async sendEphemeralCopyPreview(interaction, signalId = '') {
    const userId = interaction.user?.id || '';
    const preview = this.signalCopyService
      ? await this.signalCopyService.previewCopySignal(userId, '', signalId, { paperMode: true }).catch((error) => ({ allowed: false, blockedReasons: [error.message], ok: false }))
      : { allowed: false, blockedReasons: ['Copy service unavailable.'] };
    await this.logInteraction({ userId, action: 'signal_grid.copy_previewed', signalId, botId: preview.botId, symbol: preview.symbol, result: preview.allowed ? 'allowed' : 'blocked', reason: (preview.blockedReasons || []).join('; ') });
    const embed = new EmbedBuilder()
      .setTitle(`Copy Preview - ${preview.symbol || signalId}`)
      .setColor(preview.allowed ? 0x27ae60 : 0xeb5757)
      .setDescription([
        `Source basket: **${preview.botId || 'n/a'} / ${preview.symbol || 'n/a'}**`,
        `Source direction: **${preview.direction || 'n/a'}**`,
        `Source floating P/L: **${money(preview.floatingPnl)}**`,
        `User account: **${preview.accountId || 'none selected'}**`,
        `User risk per trade: **${preview.risk?.riskPercent ?? 'n/a'}%**`,
        `Translated lot size: **${preview.projectedLot || 'n/a'}**`,
        `Max loss estimate: **${money((Number(preview.projectedLot || 0) || 0) * 100)}**`,
        'Margin estimate: **not available until broker telemetry provides margin model**',
        `Why: ${preview.riskWarning || 'Wisdo translates source risk into your risk settings.'}`,
        `${(preview.blockedReasons || []).length ? `Blocked: **${preview.blockedReasons.join('; ')}**` : 'Copy is allowed after confirmation.'}`,
      ].join('\n'));
    return this.safeReply(interaction, { ephemeral: true, embeds: [embed], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`signal_grid_copy_basket:${compactId(signalId)}`).setLabel('Continue to Live Confirmation').setStyle(ButtonStyle.Success).setDisabled(!preview.allowed),
      new ButtonBuilder().setCustomId(`signal_grid_paper:${compactId(signalId)}`).setLabel('Paper Copy').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setLabel('Risk Settings').setStyle(ButtonStyle.Link).setURL(this.websiteUrl('/member/risk-profile')),
    )] });
  }

  async sendLiveCopyConfirmation(interaction, signalId = '') {
    const userId = interaction.user?.id || '';
    const preview = this.signalCopyService
      ? await this.signalCopyService.previewCopySignal(userId, '', signalId, {}).catch((error) => ({ allowed: false, blockedReasons: [error.message] }))
      : { allowed: false, blockedReasons: ['Copy service unavailable.'] };
    if (!preview.allowed) {
      await this.logInteraction({ userId, action: 'signal_grid.copy_blocked', signalId, botId: preview.botId, symbol: preview.symbol, result: 'blocked', reason: (preview.blockedReasons || []).join('; ') });
      return this.safeReply(interaction, { ephemeral: true, content: `Copy blocked privately: ${(preview.blockedReasons || []).join('; ') || 'requirements not met'}` });
    }
    const ending = String(preview.accountId || '').slice(-4) || '----';
    return this.safeReply(interaction, { ephemeral: true, content: `Confirm live copy on account ending ${ending}. Wisdo will use projected lot ${preview.projectedLot}, not source lot size.`, components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`signal_grid_confirm_live:${compactId(signalId)}`).setLabel(`Confirm Live Copy ${ending}`).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`signal_grid_paper:${compactId(signalId)}`).setLabel('Paper Copy Instead').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setLabel('Open Website Grid').setStyle(ButtonStyle.Link).setURL(this.websiteUrl('/member/signal-grid')),
    )] });
  }

  async executeCopyBasket(interaction, signalId = '', options = {}) {
    const userId = interaction.user?.id || '';
    const result = this.signalCopyService
      ? await this.signalCopyService.copySignalBasket(userId, '', signalId, { paperMode: Boolean(options.paperMode), acceptedRiskDisclaimer: true }).catch((error) => ({ ok: false, error: error.message }))
      : { ok: false, error: 'Copy service unavailable.' };
    await this.logInteraction({ userId, action: options.paperMode ? 'signal_grid.paper_copy_clicked' : 'signal_grid.live_copy_clicked', signalId, botId: result.preview?.botId, symbol: result.preview?.symbol, result: result.ok ? 'ok' : 'blocked', reason: result.error || result.preview?.blockedReasons?.join('; ') || '' });
    return this.safeReply(interaction, { ephemeral: true, content: result.ok ? `${options.paperMode ? 'Paper copy recorded' : 'Live copy queued'} privately through Wisdo risk engine. ${result.command?.id || ''}` : `Copy blocked privately: ${result.error || result.preview?.blockedReasons?.join('; ') || 'requirements not met'}` });
  }

  async sendBotSubscriptionConfirmation(interaction, botId = '') {
    return this.safeReply(interaction, { ephemeral: true, content: `Confirm live copy subscription for future ${botId} trades. This uses your selected account and risk settings for every future signal.`, components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`signal_grid_confirm_bot_live:${compactId(botId)}`).setLabel('Confirm Live Bot Copy').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`signal_grid_copy_bot_paper:${compactId(botId)}`).setLabel('Paper Bot Copy').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`signal_grid_stop_copy:${compactId(botId)}`).setLabel('Stop Copying Bot').setStyle(ButtonStyle.Secondary),
    )] });
  }

  async executeBotSubscription(interaction, botId = '', options = {}) {
    const userId = interaction.user?.id || '';
    const result = this.signalCopyService
      ? await this.signalCopyService.subscribeToBotSignals(userId, '', botId, { paperMode: Boolean(options.paperMode), acceptedRiskDisclaimer: true }).catch((error) => ({ error: error.message }))
      : { error: 'Copy service unavailable.' };
    await this.logInteraction({ userId, action: 'signal_grid.bot_subscribe_clicked', botId, result: result?.id ? 'ok' : 'blocked', reason: result.error || '' });
    if (!result?.id) return this.safeReply(interaction, { ephemeral: true, content: `Subscription blocked privately: ${result.error || 'requirements not met'}` });
    return this.safeReply(interaction, { ephemeral: true, content: `${options.paperMode ? 'Paper' : 'Live'} bot copy subscription active for ${botId}.`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`signal_grid_stop_copy:${compactId(botId)}`).setLabel('Stop Copying This Bot').setStyle(ButtonStyle.Danger))] });
  }

  async stopCopyingBot(interaction, botId = '') {
    const userId = interaction.user?.id || '';
    const sub = this.signalCopyService ? await this.signalCopyService.unsubscribeFromBotSignals(userId, botId) : null;
    await this.logInteraction({ userId, action: 'signal_grid.bot_stop_clicked', botId, result: sub ? 'ok' : 'not_found', reason: sub ? '' : 'subscription not found' });
    return this.safeReply(interaction, { ephemeral: true, content: sub ? `Stopped copying ${botId}. Public grid was not changed.` : `No active ${botId} copy subscription was found.` });
  }

  async refreshAccess(interaction) {
    const userId = interaction.user?.id || '';
    const roleSync = this.signalCopyService?.roleSyncService;
    let access = await this.getUserAccess(userId);
    let refreshed = null;
    if (roleSync?.syncUserRolesFromDiscord) {
      refreshed = await roleSync.syncUserRolesFromDiscord(userId, userId, { actorUserId: userId, manual: true }).catch((error) => ({ error: error.message }));
      if (!refreshed?.error) access = roleSync.publicAccess(refreshed);
    }
    await this.logInteraction({ userId, action: 'signal_grid.role_refresh_requested', result: refreshed?.error ? 'stale' : 'ok', reason: refreshed?.error || '' });
    const locked = [];
    if (!access.gates?.copier) locked.push('live copy');
    if (!access.gates?.admin) locked.push('admin setup');
    return this.safeReply(interaction, { ephemeral: true, content: [
      `Discord roles: ${(access.matchedDiscordRoles || access.discordRoles || []).join(', ') || 'none mapped'}`,
      `Wisdo roles: ${(access.wisdoRoles || access.internalRoles || []).join(', ') || 'none'}`,
      `Access level: ${access.accessLevel || 'none'}`,
      `Premium/copier eligible: ${access.gates?.copier ? 'yes' : 'no'}`,
      `${access.stale || refreshed?.error ? `Stale warning: ${refreshed?.error || 'using cached/fallback roles'}` : 'Role sync fresh.'}`,
      `Still locked: ${locked.join(', ') || 'nothing obvious'}`,
    ].join('\n') });
  }

  async repairMissingPinnedMessage(channelId = '') {
    const state = await this.signalGridService.repository.loadState();
    const record = state.signalGridChannelsById?.[String(channelId)] || {};
    await this.signalGridService.updateChannelRender(channelId, { pinnedMessageId: '', status: 'repairing' });
    const message = await this.ensurePinnedGridMessage(record.guildId || '', channelId);
    await this.audit('signal_grid.pinned_message_repaired', 'SignalGridChannel', channelId, { messageId: message.id });
    return { ok: true, repaired: true, messageId: message.id };
  }

  async fetchChannel(channelId = '') {
    const id = String(channelId || '').trim();
    if (!id || !this.client?.channels?.fetch) return null;
    return this.client.channels.fetch(id).catch(() => null);
  }

  async logInteraction(event = {}) {
    try {
      return await this.signalGridService.logInteraction?.(event);
    } catch (error) {
      this.logger?.warn?.('Signal Grid interaction log failed', { message: error.message, action: event.action });
      return null;
    }
  }

  async audit(action, targetType, targetId, metadata = {}) {
    await this.signalGridService.repository.addAuditLog?.({ adminId: 'system', action, targetType, targetId, data: metadata });
  }

  async safeReply(interaction, payload) {
    if (interaction.deferred || interaction.replied) return interaction.editReply(payload).catch(() => null);
    return interaction.reply(payload).catch(async (error) => {
      this.logger?.warn?.('Signal Grid ephemeral reply failed', { message: error.message, customId: interaction.customId });
      return null;
    });
  }
}
