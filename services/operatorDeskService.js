import { randomUUID } from 'node:crypto';

import {
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { logger } from '../logger.js';
import { OperatorDeskRepository } from '../storage/operatorDeskRepository.js';
import {
  buildArchivedChannelName,
  buildDeskChannelName,
  buildDeskTopic,
  buildVoiceChannelName,
  chunkNames,
  extractDeskUserId,
  formatCurrency,
  formatPercent,
  normalizeYesNo,
  parseNumericValue,
  parseStructuredInput,
} from '../utils/operatorDesk.js';
import {
  getDateKey,
  getDateLabel,
  getTimeLabel,
  getTimestampLabel,
  getWeekRange,
} from '../utils/time.js';

const STUDENT_TEXT_ALLOW = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.UseApplicationCommands,
];

const STAFF_TEXT_ALLOW = [
  ...STUDENT_TEXT_ALLOW,
  PermissionFlagsBits.ManageMessages,
];

const VOICE_ALLOW = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.Speak,
  PermissionFlagsBits.Stream,
];

const EVERYONE_DENY = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.Speak,
];

const GUIDE_MESSAGE = [
  'Welcome to your Culture Coin Operator Desk.',
  '',
  'This is your private 1-on-1 trading desk between you and Coach.',
  '',
  'This channel is private. Only you and Coach can see it.',
  '',
  'Start here:',
  '',
  '1. Run /setup-profile one time.',
  '2. Every trading day, run /clock-in before trading.',
  '3. During trading, run /log-ea when your bot does something important.',
  '4. At the end of trading, run /clock-out.',
  '5. At the end of the week, run /weekly-review.',
  '',
  'The bot will auto-fill most of the repeated information for you so you do not have to copy and paste long templates every day.',
  '',
  'Rule:',
  'No clock-in, no trading review.',
].join('\n');

const TEMPLATE_MESSAGE = [
  '\u{1F4CC} CULTURE COIN OPERATOR DESK TEMPLATE',
  '',
  'Student Name:',
  'Account Size:',
  'Bot/EA Used:',
  'Trading Pair:',
  'Weekly Goal:',
  'Daily Goal:',
  'Max Daily Loss:',
  'Trading Session:',
  'Coach Notes:',
  '',
  '━━━━━━━━━━━━━━━━━━',
  '',
  '\u{1F7E2} DAILY CLOCK-IN',
  '',
  'Date:',
  'Starting Balance:',
  'Daily Target:',
  'Max Loss:',
  'EA Settings:',
  'Market Bias:',
  'News Checked:',
  'Screenshot Attached:',
  'Mindset Check:',
  'Clock-In Time:',
  '',
  '━━━━━━━━━━━━━━━━━━',
  '',
  '\u{1F916} EA ACTIVITY LOG',
  '',
  'Time:',
  'Balance:',
  'Equity:',
  'Open Trades:',
  'EA Action:',
  'Market Behavior:',
  'Student Action:',
  'Question for Coach:',
  'Screenshot:',
  '',
  '━━━━━━━━━━━━━━━━━━',
  '',
  '\u{1F534} DAILY CLOCK-OUT',
  '',
  'Date:',
  'Starting Balance:',
  'Ending Balance:',
  'Profit/Loss:',
  'Goal Hit:',
  'Rules Followed:',
  'Mistake Made:',
  'Lesson Learned:',
  "Tomorrow's Adjustment:",
  'Clock-Out Time:',
  '',
  '━━━━━━━━━━━━━━━━━━',
  '',
  '\u{1F4CA} WEEKLY REVIEW',
  '',
  'Week Of:',
  'Starting Balance:',
  'Ending Balance:',
  'Weekly Profit/Loss:',
  'Best Day:',
  'Worst Day:',
  'Biggest Lesson:',
  'Coach Feedback Needed:',
  'Next Week Goal:',
].join('\n');

function createUserError(message) {
  const error = new Error(message);
  error.expose = true;
  return error;
}

function getOptionalFieldValue(fields, fieldId) {
  try {
    return fields.getTextInputValue(fieldId).trim();
  } catch {
    return '';
  }
}

function inputRow({ id, label, style, required = true, value, placeholder, maxLength }) {
  const input = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(style)
    .setRequired(required);

  if (value) {
    input.setValue(String(value).slice(0, 4000));
  }

  if (placeholder) {
    input.setPlaceholder(String(placeholder).slice(0, 100));
  }

  if (maxLength) {
    input.setMaxLength(maxLength);
  }

  return new ActionRowBuilder().addComponents(input);
}

function buildEmbed(title, color, lines, footer) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(lines.join('\n'))
    .setTimestamp(new Date());

  if (footer) {
    embed.setFooter({ text: footer });
  }

  return embed;
}

function compareDateKeys(a, b) {
  return new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime();
}

function calculateConsecutiveStreak(dateKeys) {
  if (!dateKeys.length) {
    return 0;
  }

  const ordered = [...dateKeys].sort(compareDateKeys);
  let streak = 0;
  let longest = 0;
  let previous = null;

  for (const key of ordered) {
    const current = new Date(`${key}T00:00:00`);

    if (!previous) {
      streak = 1;
    } else {
      const diffDays = (current.getTime() - previous.getTime()) / 86_400_000;
      streak = diffDays === 1 ? streak + 1 : 1;
    }

    longest = Math.max(longest, streak);
    previous = current;
  }

  return longest;
}

function calculateAccountHealth(account = {}) {
  const snapshot = account.latestSnapshot?.snapshot || account.snapshot || {};
  const equity = Number(snapshot.equity ?? account.equity ?? 0);
  const balance = Number(snapshot.balance ?? account.balance ?? 0);
  const marginLevel = Number(snapshot.marginLevel ?? account.marginLevel ?? 0);
  const openTrades = Number(snapshot.openTradeCount ?? account.openTrades ?? 0);
  const lastSyncAt = account.lastSyncAt || account.latestSnapshot?.receivedAt || snapshot.receivedAt || '';
  const lastSyncMs = lastSyncAt ? new Date(lastSyncAt).getTime() : 0;
  const staleMinutes = lastSyncMs > 0 ? Math.round((Date.now() - lastSyncMs) / 60000) : null;
  const issues = [];

  if (!lastSyncMs) issues.push('no_snapshot');
  if (staleMinutes !== null && staleMinutes > 15) issues.push('stale_snapshot');
  if (balance > 0 && equity > 0 && equity / balance < 0.8) issues.push('drawdown_warning');
  if (marginLevel > 0 && marginLevel < 250) issues.push('margin_warning');
  if (openTrades > Number(account.maxOpenTrades || account.copyRisk?.maxOpenTrades || 10)) issues.push('open_trade_limit');

  return {
    status: issues.length === 0 ? 'healthy' : issues.includes('drawdown_warning') || issues.includes('margin_warning') ? 'warning' : 'attention',
    issues,
    equity,
    balance,
    drawdownPercent: balance > 0 && equity > 0 ? Number((((balance - equity) / balance) * 100).toFixed(2)) : 0,
    marginLevel,
    openTrades,
    lastSyncAt,
    staleMinutes,
  };
}

export class OperatorDeskService {
  constructor(config) {
    this.config = config;
    this.repository = new OperatorDeskRepository(config.dataDir);
    this.mt4SyncService = null;
  }

  async initialize() {
    await this.repository.initialize();
  }

  attachMt4SyncService(mt4SyncService) {
    this.mt4SyncService = mt4SyncService;
  }

  async getFreshMt4SnapshotForUser(discordUserId) {
    if (!this.mt4SyncService) {
      return null;
    }

    return this.mt4SyncService.getFreshSnapshot(discordUserId);
  }

  async getDesk(discordUserId) {
    const [deskRecord, accounts, selectedAccount] = await Promise.all([
      this.repository.getDesk(discordUserId),
      this.listAccounts(discordUserId),
      this.getSelectedAccount(discordUserId),
    ]);

    return {
      deskId: deskRecord?.channelId || `desk:${discordUserId}`,
      discordUserId,
      deskRecord,
      accounts,
      selectedAccount,
      selectedAccountId: selectedAccount?.accountId || null,
      health: selectedAccount ? calculateAccountHealth(selectedAccount) : { status: 'attention', issues: ['no_selected_account'] },
      updatedAt: new Date().toISOString(),
      persistence: {
        adapter: process.env.DATABASE_URL ? 'postgres' : 'volatile-memory',
        stores: ['postgres:wisdo_live_desks', 'postgres:wisdo_live_mt4'],
      },
    };
  }

  async listAccounts(discordUserId) {
    const accounts = this.repository.getAccessibleMt4Accounts
      ? await this.repository.getAccessibleMt4Accounts(discordUserId)
      : await this.repository.getMt4Accounts(discordUserId);

    return accounts.map((account) => ({
      ...account,
      health: calculateAccountHealth(account),
    }));
  }

  async getSelectedAccount(discordUserId) {
    const primary = this.repository.getPrimaryMt4Connection
      ? await this.repository.getPrimaryMt4Connection(discordUserId)
      : await this.repository.getMt4Connection(discordUserId);

    if (!primary?.accountId) return primary || null;

    const account = this.repository.getMt4ConnectionByAccountId
      ? await this.repository.getMt4ConnectionByAccountId(discordUserId, primary.accountId)
      : primary;

    return account ? { ...account, health: calculateAccountHealth(account) } : null;
  }

  async setSelectedAccount(discordUserId, accountId) {
    const selected = await this.repository.setPrimaryMt4Account(discordUserId, accountId);
    if (!selected) {
      throw createUserError('That MT4 account is not connected to this desk.');
    }

    return {
      ...selected,
      health: calculateAccountHealth(selected),
      audit: {
        action: 'operator_desk.selected_account.set',
        actorUserId: discordUserId,
        accountId,
        createdAt: new Date().toISOString(),
      },
    };
  }

  async updateAccountSnapshot(discordUserId, accountId, snapshot = {}) {
    const now = new Date().toISOString();
    let updated = null;

    await this.repository.updateMt4State((state) => {
      const connection = state.connectionsByAccountId?.[accountId];
      if (!connection || String(connection.discordUserId) !== String(discordUserId)) return state;

      const normalized = {
        accountId,
        discordUserId: String(discordUserId),
        snapshot: {
          ...snapshot,
          accountNumber: snapshot.accountNumber || connection.accountNumber,
          brokerServer: snapshot.brokerServer || snapshot.server || connection.brokerServer || connection.server || '',
        },
        receivedAt: snapshot.receivedAt || now,
        source: snapshot.source || 'operator_desk_service',
      };

      state.latestSnapshotsByAccountId ||= {};
      state.latestSnapshots ||= {};
      state.snapshotHistory ||= [];
      state.latestSnapshotsByAccountId[accountId] = normalized;
      state.latestSnapshots[String(discordUserId)] = normalized;
      state.snapshotHistory.unshift(normalized);
      state.snapshotHistory = state.snapshotHistory.slice(0, 1000);
      connection.lastSyncAt = normalized.receivedAt;
      updated = this.hydrateAccountState(state, connection, discordUserId);
      return state;
    });

    if (!updated) {
      throw createUserError('That MT4 account is not connected to this desk.');
    }

    return updated;
  }

  hydrateAccountState(state, connection, discordUserId) {
    if (this.repository.hydrateMt4Account) {
      const account = this.repository.hydrateMt4Account(state, connection, discordUserId, { shared: false });
      return { ...account, health: calculateAccountHealth(account) };
    }

    const latestSnapshot = state.latestSnapshotsByAccountId?.[connection.accountId] || null;
    const account = { ...connection, latestSnapshot };
    return { ...account, health: calculateAccountHealth(account) };
  }

  async getAccountHealth(discordUserId, accountId = null) {
    const account = accountId
      ? await this.repository.getMt4ConnectionByAccountId(discordUserId, accountId)
      : await this.getSelectedAccount(discordUserId);

    return account
      ? calculateAccountHealth(account)
      : { status: 'attention', issues: ['account_not_found'] };
  }

  async getLatestMt4SnapshotForUser(discordUserId) {
    if (!this.mt4SyncService) {
      return null;
    }

    return this.mt4SyncService.getLatestSnapshot(discordUserId);
  }

  getTemplateMessage() {
    return TEMPLATE_MESSAGE;
  }

  getGuideMessage() {
    return GUIDE_MESSAGE;
  }

  getCultureCoinRole(guild) {
    if (this.config.cultureCoinRoleId && guild.roles.cache.has(this.config.cultureCoinRoleId)) {
      return guild.roles.cache.get(this.config.cultureCoinRoleId);
    }

    return (
      guild.roles.cache.find(
        (role) => role.name.toLowerCase() === this.config.cultureCoinRoleName.toLowerCase(),
      ) || null
    );
  }

  getCoachRole(guild) {
    if (this.config.coachRoleId && guild.roles.cache.has(this.config.coachRoleId)) {
      return guild.roles.cache.get(this.config.coachRoleId);
    }

    return (
      guild.roles.cache.find(
        (role) => role.name.toLowerCase() === this.config.coachRoleName.toLowerCase(),
      ) || null
    );
  }

  getOwnerIds(guild) {
    return [...new Set([guild.ownerId, this.config.ownerUserId].filter(Boolean))];
  }

  isStaff(member) {
    if (!member) {
      return false;
    }

    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return true;
    }

    if (this.getOwnerIds(member.guild).includes(member.id)) {
      return true;
    }

    const coachRole = this.getCoachRole(member.guild);
    return Boolean(coachRole && member.roles.cache.has(coachRole.id));
  }

  memberHasCultureCoin(member) {
    const role = this.getCultureCoinRole(member.guild);
    return Boolean(role && member.roles.cache.has(role.id));
  }

  buildStaffOverwrites(guild, allowPermissions) {
    const targets = new Map();
    const coachRole = this.getCoachRole(guild);

    if (coachRole) {
      targets.set(coachRole.id, coachRole.id);
    }

    for (const role of guild.roles.cache.values()) {
      if (role.id === guild.roles.everyone.id) {
        continue;
      }

      if (role.permissions.has(PermissionFlagsBits.Administrator)) {
        targets.set(role.id, role.id);
      }
    }

    for (const ownerId of this.getOwnerIds(guild)) {
      targets.set(ownerId, ownerId);
    }

    return [...targets.values()].map((id) => ({
      id,
      allow: allowPermissions,
    }));
  }

  buildCategoryOverwrites(guild) {
    const allow = [...new Set([...STAFF_TEXT_ALLOW, ...VOICE_ALLOW])];

    return [
      {
        id: guild.roles.everyone.id,
        deny: EVERYONE_DENY,
      },
      ...this.buildStaffOverwrites(guild, allow),
    ];
  }

  buildDeskTextOverwrites(member) {
    return [
      {
        id: member.guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      ...this.buildStaffOverwrites(member.guild, STAFF_TEXT_ALLOW),
      {
        id: member.id,
        allow: STUDENT_TEXT_ALLOW,
      },
    ];
  }

  buildDeskVoiceOverwrites(member) {
    return [
      {
        id: member.guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
      },
      ...this.buildStaffOverwrites(member.guild, VOICE_ALLOW),
      {
        id: member.id,
        allow: VOICE_ALLOW,
      },
    ];
  }

  async syncCategory(channel, permissionOverwrites) {
    try {
      await channel.edit({ permissionOverwrites });
    } catch (error) {
      logger.error('Permission failure', {
        channelId: channel.id,
        message: error.message,
      });
      throw createUserError(
        'Could not create desk. Please check bot permissions and role configuration.',
      );
    }
  }

  async ensureCategory(guild, name) {
    await guild.channels.fetch();

    const existing = guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildCategory && channel.name === name,
    );
    const permissionOverwrites = this.buildCategoryOverwrites(guild);

    if (existing) {
      logger.info('Category found', { guildId: guild.id, categoryId: existing.id, name });
      await this.syncCategory(existing, permissionOverwrites);
      return existing;
    }

    try {
      const category = await guild.channels.create({
        name,
        type: ChannelType.GuildCategory,
        permissionOverwrites,
      });

      logger.info('Category created', { guildId: guild.id, categoryId: category.id, name });
      return category;
    } catch (error) {
      logger.error('Permission failure', {
        action: 'create-category',
        guildId: guild.id,
        message: error.message,
      });
      throw createUserError(
        'Could not create desk. Please check bot permissions and role configuration.',
      );
    }
  }

  async ensureDeskCategory(guild) {
    return this.ensureCategory(guild, this.config.categoryName);
  }

  async ensureArchiveCategory(guild) {
    if (!this.config.archiveCategoryName) {
      return null;
    }

    return this.ensureCategory(guild, this.config.archiveCategoryName);
  }

  getDeskTextChannels(guild) {
    return [...guild.channels.cache.values()].filter(
      (channel) => channel.type === ChannelType.GuildText && extractDeskUserId(channel.topic),
    );
  }

  getDeskTextChannelsByUserId(guild, userId) {
    return this.getDeskTextChannels(guild).filter(
      (channel) => extractDeskUserId(channel.topic) === userId,
    );
  }

  pickPrimaryDeskChannel(channels) {
    return [...channels].sort((left, right) => {
      const leftArchived = left.name.startsWith('archived-') ? 1 : 0;
      const rightArchived = right.name.startsWith('archived-') ? 1 : 0;
      return leftArchived - rightArchived;
    })[0] || null;
  }

  async findDeskContextByChannel(channel) {
    if (!channel) {
      return null;
    }

    const topicUserId = extractDeskUserId(channel.topic);
    if (topicUserId) {
      return {
        deskUserId: topicUserId,
        deskChannel: channel,
      };
    }

    const storedDesk = await this.repository.findDeskByChannelId(channel.id);
    if (storedDesk) {
      return {
        deskUserId: storedDesk.discordUserId,
        deskChannel: channel,
      };
    }

    return null;
  }

  async requireDeskContext(interaction, options = {}) {
    const { allowStaff = true, requireDeskOwner = false } = options;
    const deskContext = await this.findDeskContextByChannel(interaction.channel);

    if (!deskContext) {
      await this.safeReply(interaction, {
        content: 'Please use this command inside your private Culture Coin Operator Desk.',
        ephemeral: true,
      });
      return null;
    }

    const isStaff = this.isStaff(interaction.member);
    const isDeskOwner = interaction.user.id === deskContext.deskUserId;

    if (requireDeskOwner && !isDeskOwner) {
      await this.safeReply(interaction, {
        content: 'Only the student assigned to this desk can use that command.',
        ephemeral: true,
      });
      return null;
    }

    if (!isDeskOwner && !(allowStaff && isStaff)) {
      await this.safeReply(interaction, {
        content: 'Please use this command inside your private Culture Coin Operator Desk.',
        ephemeral: true,
      });
      return null;
    }

    return {
      ...deskContext,
      isStaff,
      isDeskOwner,
    };
  }

  async assertAdminOrCoach(interaction) {
    if (this.isStaff(interaction.member)) {
      return true;
    }

    await this.safeReply(interaction, {
      content: 'This command is only available to Coach/Admin.',
      ephemeral: true,
    });

    return false;
  }

  async safeReply(interaction, payload) {
    try {
      if (interaction.deferred && !interaction.replied) {
        const editPayload = { ...payload };
        delete editPayload.ephemeral;
        return await interaction.editReply(editPayload);
      }

      if (interaction.replied) {
        return await interaction.followUp(payload);
      }

      return await interaction.reply(payload);
    } catch (error) {
      this.logger?.warn?.('Failed to reply to Discord interaction.', {
        command: interaction?.commandName,
        error: error.message,
        code: error.code,
      });
      return null;
    }
  }

  async createGuideMessage(channel) {
    const message = await channel.send({ content: this.getGuideMessage() });
    await message.pin();
    return message;
  }

  async syncProfileChannel(userId, channelId, username) {
    const existing = await this.repository.getProfile(userId);
    if (!existing) {
      return null;
    }

    const profile = {
      ...existing,
      username,
      channelId,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.saveProfile(profile);
    return profile;
  }

  async saveDeskRecord(member, updates) {
    const existing = await this.repository.getDesk(member.id);
    const now = new Date().toISOString();

    const desk = {
      discordUserId: member.id,
      username: member.user.username,
      channelId: updates.channelId ?? existing?.channelId ?? null,
      voiceChannelId: updates.voiceChannelId ?? existing?.voiceChannelId ?? null,
      guideMessageId: updates.guideMessageId ?? existing?.guideMessageId ?? null,
      status: updates.status ?? existing?.status ?? 'active',
      channelName: updates.channelName ?? existing?.channelName ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      archivedAt: updates.archivedAt ?? existing?.archivedAt ?? null,
      deletedAt: updates.deletedAt ?? existing?.deletedAt ?? null,
    };

    await this.repository.saveDesk(desk);
    await this.syncProfileChannel(member.id, desk.channelId, member.user.username);
    return desk;
  }

  async ensureVoiceChannel(member, category, existingVoiceChannelId = null) {
    if (!this.config.createPrivateVoiceChannels) {
      return null;
    }

    await member.guild.channels.fetch();

    let voiceChannel =
      (existingVoiceChannelId && member.guild.channels.cache.get(existingVoiceChannelId)) || null;

    if (voiceChannel && voiceChannel.type !== ChannelType.GuildVoice) {
      voiceChannel = null;
    }

    if (!voiceChannel) {
      try {
        voiceChannel = await member.guild.channels.create({
          name: buildVoiceChannelName(member.user.username, member.id),
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites: this.buildDeskVoiceOverwrites(member),
        });
      } catch (error) {
        logger.error('Permission failure', {
          action: 'create-voice-channel',
          guildId: member.guild.id,
          userId: member.id,
          message: error.message,
        });
        throw createUserError(
          'Could not create desk. Please check bot permissions and role configuration.',
        );
      }

      return voiceChannel;
    }

    await voiceChannel.edit({
      name: buildVoiceChannelName(member.user.username, member.id),
      parent: category.id,
      permissionOverwrites: this.buildDeskVoiceOverwrites(member),
    });

    return voiceChannel;
  }

  async ensureDeskForMember(member) {
    if (member.user.bot) {
      return { status: 'skipped-bot' };
    }

    if (!this.memberHasCultureCoin(member)) {
      logger.info('Member skipped because missing Culture Coin', { userId: member.id });
      return { status: 'ineligible' };
    }

    await member.guild.channels.fetch();

    const existingChannels = this.getDeskTextChannelsByUserId(member.guild, member.id);
    const existingDesk = this.pickPrimaryDeskChannel(existingChannels);

    if (existingDesk) {
      const existingRecord = await this.repository.getDesk(member.id);
      const isArchived = existingDesk.name.startsWith('archived-');
      let voiceChannel = null;

      if (this.config.createPrivateVoiceChannels && !isArchived) {
        const category =
          existingDesk.parent?.type === ChannelType.GuildCategory
            ? existingDesk.parent
            : await this.ensureDeskCategory(member.guild);
        voiceChannel = await this.ensureVoiceChannel(member, category, existingRecord?.voiceChannelId);
      }

      if (!isArchived) {
        await existingDesk.edit({
          name: buildDeskChannelName(member.user.username, member.id),
          parent: existingDesk.parentId || (await this.ensureDeskCategory(member.guild)).id,
          topic: buildDeskTopic(member.id),
          permissionOverwrites: this.buildDeskTextOverwrites(member),
        });
      }

      await this.saveDeskRecord(member, {
        channelId: existingDesk.id,
        voiceChannelId: voiceChannel?.id ?? existingRecord?.voiceChannelId ?? null,
        guideMessageId: existingRecord?.guideMessageId ?? null,
        status: isArchived ? 'archived' : 'active',
        channelName: existingDesk.name,
      });

      logger.info('Desk skipped because existing', {
        userId: member.id,
        channelId: existingDesk.id,
      });

      return {
        status: isArchived ? 'archived-existing' : 'existing',
        channel: existingDesk,
        voiceChannel,
      };
    }

    const category = await this.ensureDeskCategory(member.guild);

    let deskChannel;
    try {
      deskChannel = await member.guild.channels.create({
        name: buildDeskChannelName(member.user.username, member.id),
        type: ChannelType.GuildText,
        parent: category.id,
        topic: buildDeskTopic(member.id),
        permissionOverwrites: this.buildDeskTextOverwrites(member),
      });
    } catch (error) {
      logger.error('Permission failure', {
        action: 'create-text-channel',
        guildId: member.guild.id,
        userId: member.id,
        message: error.message,
      });
      throw createUserError(
        'Could not create desk. Please check bot permissions and role configuration.',
      );
    }

    let guideMessage = null;
    try {
      guideMessage = await this.createGuideMessage(deskChannel);
    } catch (error) {
      logger.warn('Could not pin guide message', {
        channelId: deskChannel.id,
        message: error.message,
      });
    }

    const voiceChannel = await this.ensureVoiceChannel(member, category);

    await this.saveDeskRecord(member, {
      channelId: deskChannel.id,
      voiceChannelId: voiceChannel?.id ?? null,
      guideMessageId: guideMessage?.id ?? null,
      status: 'active',
      channelName: deskChannel.name,
    });

    logger.info('Desk created', {
      userId: member.id,
      channelId: deskChannel.id,
      voiceChannelId: voiceChannel?.id ?? null,
    });

    return {
      status: 'created',
      channel: deskChannel,
      voiceChannel,
      guideMessage,
    };
  }

  async analyzeDeskSystem(guild) {
    await guild.members.fetch();
    await guild.channels.fetch();

    const cultureCoinRole = this.getCultureCoinRole(guild);
    const category = guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildCategory && channel.name === this.config.categoryName,
    );

    const members = cultureCoinRole
      ? [...guild.members.cache.values()].filter(
          (member) => !member.user.bot && member.roles.cache.has(cultureCoinRole.id),
        )
      : [];

    const deskChannels = this.getDeskTextChannels(guild);
    const counts = new Map();

    for (const channel of deskChannels) {
      const userId = extractDeskUserId(channel.topic);
      if (!userId) {
        continue;
      }

      counts.set(userId, (counts.get(userId) || 0) + 1);
    }

    const membersWithDesks = members.filter((member) => counts.has(member.id));
    const missingMembers = members.filter((member) => !counts.has(member.id));
    const duplicateWarnings = [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([userId, count]) => {
        const member = guild.members.cache.get(userId);
        return `${member?.user.username || userId} (${count} desks)`;
      });

    return {
      cultureCoinRoleFound: Boolean(cultureCoinRole),
      categoryFound: Boolean(category),
      totalCultureCoinMembers: members.length,
      totalDeskChannels: deskChannels.length,
      membersWithDesks: membersWithDesks.length,
      membersMissingDesks: missingMembers.length,
      eligibleMembers: members,
      missingMembers,
      existingMembers: membersWithDesks,
      duplicateWarnings,
      voiceChannelsEnabled: this.config.createPrivateVoiceChannels,
    };
  }

  async createAllDesks(guild, { dryRun = false } = {}) {
    const beforeSummary = await this.analyzeDeskSystem(guild);

    if (!beforeSummary.cultureCoinRoleFound) {
      throw createUserError('Culture Coin role could not be found. Please check role configuration.');
    }

    if (dryRun) {
      return {
        dryRun: true,
        beforeSummary,
        summary: beforeSummary,
        created: [],
        skipped: beforeSummary.existingMembers,
        errors: [],
      };
    }

    const created = [];
    const skipped = [];
    const errors = [];

    for (const member of beforeSummary.eligibleMembers) {
      try {
        const result = await this.ensureDeskForMember(member);

        if (result.status === 'created') {
          created.push(member);
        } else {
          skipped.push(member);
        }
      } catch (error) {
        errors.push({
          member,
          message: error.message,
        });
      }
    }

    return {
      dryRun: false,
      beforeSummary,
      summary: await this.analyzeDeskSystem(guild),
      created,
      skipped,
      errors,
    };
  }

  async removeDeskForMember(member, mode = 'archive') {
    await member.guild.channels.fetch();

    const textChannels = this.getDeskTextChannelsByUserId(member.guild, member.id);
    const deskRecord = await this.repository.getDesk(member.id);
    const voiceChannel =
      (deskRecord?.voiceChannelId && member.guild.channels.cache.get(deskRecord.voiceChannelId)) || null;

    if (!textChannels.length && !voiceChannel) {
      return { status: 'not-found' };
    }

    if (mode === 'archive') {
      const archiveCategory = await this.ensureArchiveCategory(member.guild);

      for (const channel of textChannels) {
        await channel.edit({
          name: channel.name.startsWith('archived-') ? channel.name : buildArchivedChannelName(channel.name),
          parent: archiveCategory?.id || channel.parentId,
        });

        await channel.permissionOverwrites.edit(member.id, {
          ViewChannel: false,
          SendMessages: false,
          ReadMessageHistory: false,
          AttachFiles: false,
          EmbedLinks: false,
          UseApplicationCommands: false,
        });
      }

      if (voiceChannel) {
        await voiceChannel.edit({
          name: voiceChannel.name.startsWith('archived-')
            ? voiceChannel.name
            : buildArchivedChannelName(voiceChannel.name),
          parent: archiveCategory?.id || voiceChannel.parentId,
        });

        await voiceChannel.permissionOverwrites.edit(member.id, {
          ViewChannel: false,
          Connect: false,
          Speak: false,
          Stream: false,
        });
      }

      await this.saveDeskRecord(member, {
        channelId: textChannels[0]?.id ?? deskRecord?.channelId ?? null,
        voiceChannelId: voiceChannel?.id ?? deskRecord?.voiceChannelId ?? null,
        status: 'archived',
        channelName: textChannels[0]?.name ?? deskRecord?.channelName ?? null,
        archivedAt: new Date().toISOString(),
      });

      return {
        status: 'archived',
        textChannels,
        voiceChannel,
      };
    }

    for (const channel of textChannels) {
      await channel.delete('Culture Coin Operator Desk deleted by Coach/Admin');
    }

    if (voiceChannel) {
      await voiceChannel.delete('Culture Coin Operator Desk voice channel deleted by Coach/Admin');
    }

    await this.saveDeskRecord(member, {
      channelId: deskRecord?.channelId ?? null,
      voiceChannelId: deskRecord?.voiceChannelId ?? null,
      status: 'deleted',
      channelName: deskRecord?.channelName ?? null,
      deletedAt: new Date().toISOString(),
    });

    return {
      status: 'deleted',
      textChannels,
      voiceChannel,
    };
  }

  formatDeskStatus(summary) {
    return [
      `Culture Coin role found: ${summary.cultureCoinRoleFound ? 'Yes' : 'No'}`,
      `Category found: ${summary.categoryFound ? 'Yes' : 'No'}`,
      `Voice channels enabled: ${summary.voiceChannelsEnabled ? 'Yes' : 'No'}`,
      `Total Culture Coin members: ${summary.totalCultureCoinMembers}`,
      `Total existing desk channels: ${summary.totalDeskChannels}`,
      `Members with desks: ${summary.membersWithDesks}`,
      `Members missing desks: ${summary.membersMissingDesks}`,
      `Duplicate desk warnings: ${summary.duplicateWarnings.length ? chunkNames(summary.duplicateWarnings) : 'None'}`,
      `Missing members: ${chunkNames(summary.missingMembers.map((member) => member.user.username))}`,
    ].join('\n');
  }

  formatCreateAllResult(result) {
    const basis = result.beforeSummary || result.summary;
    const lines = [
      `Dry run: ${result.dryRun ? 'Yes' : 'No'}`,
      `Total Culture Coin members: ${basis.totalCultureCoinMembers}`,
      `Members with desks: ${basis.membersWithDesks}`,
      `Members missing desks: ${basis.membersMissingDesks}`,
      `Would receive desks: ${chunkNames(basis.missingMembers.map((member) => member.user.username))}`,
    ];

    if (!result.dryRun) {
      lines.push(`Desks created: ${chunkNames(result.created.map((member) => member.user.username))}`);
      lines.push(`Skipped: ${chunkNames(result.skipped.map((member) => member.user.username))}`);
      lines.push(
        `Errors: ${
          result.errors.length
            ? chunkNames(result.errors.map(({ member }) => member.user.username))
            : 'None'
        }`,
      );
    }

    return lines.join('\n');
  }

  async getDeskChannelForUser(guild, userId) {
    await guild.channels.fetch();

    const channels = this.getDeskTextChannelsByUserId(guild, userId);
    const primary = this.pickPrimaryDeskChannel(channels);

    if (primary) {
      return primary;
    }

    const stored = await this.repository.getDesk(userId);
    return (stored?.channelId && guild.channels.cache.get(stored.channelId)) || null;
  }

  async getStudentDisplay(guild, userId) {
    const member = guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
    return {
      member,
      username: member?.user.username || userId,
      mention: member ? `<@${member.id}>` : userId,
    };
  }

  buildProfileModal(customId, profile = {}) {
    return new ModalBuilder()
      .setCustomId(customId)
      .setTitle('Culture Coin Profile')
      .addComponents(
        inputRow({
          id: 'accountSize',
          label: 'Account Size',
          style: TextInputStyle.Short,
          value: profile.accountSize || '',
          placeholder: '1000',
        }),
        inputRow({
          id: 'botEaUsed',
          label: 'Bot/EA Used',
          style: TextInputStyle.Short,
          value: profile.botEaUsed || '',
          placeholder: 'Sniper EA',
        }),
        inputRow({
          id: 'tradingPair',
          label: 'Trading Pair',
          style: TextInputStyle.Short,
          value: profile.tradingPair || '',
          placeholder: 'XAUUSD',
        }),
        inputRow({
          id: 'goals',
          label: 'Goals',
          style: TextInputStyle.Paragraph,
          value:
            profile.weeklyGoal || profile.dailyGoal
              ? `Weekly Goal: ${profile.weeklyGoal || ''}\nDaily Goal: ${profile.dailyGoal || ''}`.trim()
              : '',
          placeholder: 'Weekly Goal: 8%\nDaily Goal: 1.5%',
        }),
        inputRow({
          id: 'sessionSetup',
          label: 'Risk + Session Setup',
          style: TextInputStyle.Paragraph,
          value:
            profile.maxDailyLoss || profile.tradingSession || profile.brokerTime
              ? `Max Daily Loss: ${profile.maxDailyLoss || ''}\nTrading Session: ${
                  profile.tradingSession || ''
                }\nBroker Time: ${profile.brokerTime || ''}`.trim()
              : '',
          placeholder: 'Max Daily Loss: 2%\nTrading Session: London\nBroker Time: GMT+2',
        }),
      );
  }

  buildClockInModal(profile = {}, existingLog = null, mt4SnapshotRecord = null) {
    if (mt4SnapshotRecord?.snapshot) {
      return new ModalBuilder()
        .setCustomId('clock-in:mt4')
        .setTitle('Daily Trading Clock-In')
        .addComponents(
          inputRow({
            id: 'marketBias',
            label: 'Market Bias',
            style: TextInputStyle.Paragraph,
            value: existingLog?.marketBias || '',
            placeholder: 'Bullish on gold above support',
          }),
          inputRow({
            id: 'newsChecked',
            label: 'News Checked?',
            style: TextInputStyle.Short,
            value: existingLog?.newsChecked || '',
            placeholder: 'yes or no',
          }),
          inputRow({
            id: 'mindsetCheck',
            label: 'Mindset Check',
            style: TextInputStyle.Paragraph,
            value: existingLog?.mindsetCheck || '',
            placeholder: 'Focused, calm, patient',
          }),
          inputRow({
            id: 'screenshotAttached',
            label: 'Screenshot Attached?',
            style: TextInputStyle.Short,
            value: existingLog?.screenshotAttached || '',
            placeholder: 'yes or no',
          }),
          inputRow({
            id: 'sessionNote',
            label: 'Optional Note',
            style: TextInputStyle.Paragraph,
            required: false,
            value: existingLog?.sessionNote || '',
            placeholder: 'Anything Coach should know before the session starts',
          }),
        );
    }

    return new ModalBuilder()
      .setCustomId('clock-in:manual')
      .setTitle('Daily Trading Clock-In')
      .addComponents(
        inputRow({
          id: 'startingBalance',
          label: 'Starting Balance',
          style: TextInputStyle.Short,
          value: existingLog?.startingBalance || '',
          placeholder: '1000',
        }),
        inputRow({
          id: 'todayTarget',
          label: 'Today Target',
          style: TextInputStyle.Short,
          value: existingLog?.dailyTarget || profile.dailyGoal || '',
          placeholder: '150',
        }),
        inputRow({
          id: 'todayMaxLoss',
          label: 'Today Max Loss',
          style: TextInputStyle.Short,
          value: existingLog?.maxLoss || profile.maxDailyLoss || '',
          placeholder: '50',
        }),
        inputRow({
          id: 'marketBias',
          label: 'Market Bias',
          style: TextInputStyle.Paragraph,
          value: existingLog?.marketBias || '',
          placeholder: 'Bullish on gold above support',
        }),
        inputRow({
          id: 'checks',
          label: 'Session Checks',
          style: TextInputStyle.Paragraph,
          value:
            existingLog?.newsChecked || existingLog?.mindsetCheck || existingLog?.screenshotAttached
              ? `News Checked: ${existingLog?.newsChecked || ''}\nMindset Check: ${
                  existingLog?.mindsetCheck || ''
                }\nScreenshot Attached: ${existingLog?.screenshotAttached || ''}`.trim()
              : '',
          placeholder: 'News Checked: yes\nMindset Check: focused and calm\nScreenshot Attached: yes',
        }),
      );
  }

  buildLogEaModal(existingLog = null, mt4SnapshotRecord = null) {
    if (mt4SnapshotRecord?.snapshot) {
      return new ModalBuilder()
        .setCustomId('log-ea:mt4')
        .setTitle('EA Activity Log')
        .addComponents(
          inputRow({
            id: 'eaAction',
            label: 'EA Action',
            style: TextInputStyle.Paragraph,
            value: existingLog?.eaAction || '',
            placeholder: 'Moved stop loss to break-even',
          }),
          inputRow({
            id: 'marketBehavior',
            label: 'Market Behavior',
            style: TextInputStyle.Paragraph,
            value: existingLog?.marketBehavior || '',
            placeholder: 'Price rejected session high',
          }),
          inputRow({
            id: 'studentAction',
            label: 'Student Action',
            style: TextInputStyle.Paragraph,
            value: existingLog?.studentAction || '',
            placeholder: 'Reduced lot size and monitored drawdown',
          }),
          inputRow({
            id: 'questionForCoach',
            label: 'Question for Coach',
            style: TextInputStyle.Paragraph,
            required: false,
            value: existingLog?.questionForCoach || '',
            placeholder: 'Should I pause the bot after the next news event?',
          }),
          inputRow({
            id: 'sessionNote',
            label: 'Optional Note',
            style: TextInputStyle.Paragraph,
            required: false,
            value: existingLog?.sessionNote || '',
            placeholder: 'Any extra note for Coach or the desk',
          }),
        );
    }

    return new ModalBuilder()
      .setCustomId('log-ea:manual')
      .setTitle('EA Activity Log')
      .addComponents(
        inputRow({
          id: 'accountSnapshot',
          label: 'Balance / Equity / Open Trades',
          style: TextInputStyle.Paragraph,
          value:
            existingLog?.balance || existingLog?.equity || existingLog?.openTrades
              ? `Balance: ${existingLog?.balance || ''}\nEquity: ${existingLog?.equity || ''}\nOpen Trades: ${
                  existingLog?.openTrades || ''
                }`.trim()
              : '',
          placeholder: 'Balance: 1000\nEquity: 1015\nOpen Trades: 2',
        }),
        inputRow({
          id: 'eaAction',
          label: 'EA Action',
          style: TextInputStyle.Paragraph,
          value: existingLog?.eaAction || '',
          placeholder: 'Moved stop loss to break-even',
        }),
        inputRow({
          id: 'marketBehavior',
          label: 'Market Behavior',
          style: TextInputStyle.Paragraph,
          value: existingLog?.marketBehavior || '',
          placeholder: 'Price rejected session high',
        }),
        inputRow({
          id: 'studentAction',
          label: 'Student Action',
          style: TextInputStyle.Paragraph,
          value: existingLog?.studentAction || '',
          placeholder: 'Reduced lot size and monitored drawdown',
        }),
        inputRow({
          id: 'questionForCoach',
          label: 'Question for Coach',
          style: TextInputStyle.Paragraph,
          required: false,
          value: existingLog?.questionForCoach || '',
          placeholder: 'Should I pause the bot after the next news event?',
        }),
      );
  }

  buildClockOutModal(existingLog = null, mt4SnapshotRecord = null) {
    if (mt4SnapshotRecord?.snapshot) {
      return new ModalBuilder()
        .setCustomId('clock-out:mt4')
        .setTitle('Daily Trading Clock-Out')
        .addComponents(
          inputRow({
            id: 'rulesFollowed',
            label: 'Rules Followed?',
            style: TextInputStyle.Short,
            value: existingLog?.rulesFollowed || '',
            placeholder: 'yes or no',
          }),
          inputRow({
            id: 'mistakeMade',
            label: 'Mistake Made',
            style: TextInputStyle.Paragraph,
            value: existingLog?.mistakeMade || '',
            placeholder: 'Entered too early before confirmation',
          }),
          inputRow({
            id: 'lessonLearned',
            label: 'Lesson Learned',
            style: TextInputStyle.Paragraph,
            value: existingLog?.lessonLearned || '',
            placeholder: 'Wait for session range confirmation first',
          }),
          inputRow({
            id: 'tomorrowsAdjustment',
            label: 'Tomorrow Adjustment',
            style: TextInputStyle.Paragraph,
            value: existingLog?.tomorrowsAdjustment || '',
            placeholder: 'Reduce risk during news windows',
          }),
        );
    }

    return new ModalBuilder()
      .setCustomId('clock-out:manual')
      .setTitle('Daily Trading Clock-Out')
      .addComponents(
        inputRow({
          id: 'endingBalance',
          label: 'Ending Balance',
          style: TextInputStyle.Short,
          value: existingLog?.endingBalance || '',
          placeholder: '1080',
        }),
        inputRow({
          id: 'disciplineReview',
          label: 'Goal Hit + Rules Followed',
          style: TextInputStyle.Paragraph,
          value:
            existingLog?.goalHit || existingLog?.rulesFollowed
              ? `Goal Hit: ${existingLog?.goalHit || ''}\nRules Followed: ${
                  existingLog?.rulesFollowed || ''
                }`.trim()
              : '',
          placeholder: 'Goal Hit: yes\nRules Followed: yes',
        }),
        inputRow({
          id: 'mistakeMade',
          label: 'Mistake Made',
          style: TextInputStyle.Paragraph,
          value: existingLog?.mistakeMade || '',
          placeholder: 'Entered too early before confirmation',
        }),
        inputRow({
          id: 'lessonLearned',
          label: 'Lesson Learned',
          style: TextInputStyle.Paragraph,
          value: existingLog?.lessonLearned || '',
          placeholder: 'Wait for session range confirmation first',
        }),
        inputRow({
          id: 'tomorrowsAdjustment',
          label: 'Tomorrow Adjustment',
          style: TextInputStyle.Paragraph,
          value: existingLog?.tomorrowsAdjustment || '',
          placeholder: 'Reduce risk during news windows',
        }),
      );
  }

  buildWeeklyReviewModal(existingLog = null) {
    return new ModalBuilder()
      .setCustomId('weekly-review')
      .setTitle('Weekly Compound Review')
      .addComponents(
        inputRow({
          id: 'biggestLesson',
          label: 'Biggest Lesson',
          style: TextInputStyle.Paragraph,
          value: existingLog?.biggestLesson || '',
          placeholder: 'Patience protected the account this week',
        }),
        inputRow({
          id: 'coachFeedbackNeeded',
          label: 'Coach Feedback Needed',
          style: TextInputStyle.Paragraph,
          value: existingLog?.coachFeedbackNeeded || '',
          placeholder: 'Need help refining entries after EA alerts',
        }),
        inputRow({
          id: 'nextWeekGoal',
          label: 'Next Week Goal',
          style: TextInputStyle.Paragraph,
          value: existingLog?.nextWeekGoal || '',
          placeholder: 'Stay within max loss and hit all clock-outs',
        }),
      );
  }

  buildCoachNoteModal(member) {
    return new ModalBuilder()
      .setCustomId(`coach-note:${member.id}`)
      .setTitle(`Coach Note: ${member.user.username}`)
      .addComponents(
        inputRow({
          id: 'whatWentWell',
          label: 'What Student Did Well',
          style: TextInputStyle.Paragraph,
          placeholder: 'Managed risk and followed the plan',
        }),
        inputRow({
          id: 'correction',
          label: 'What Needs Correction',
          style: TextInputStyle.Paragraph,
          placeholder: 'Needs to avoid forcing entries after losses',
        }),
        inputRow({
          id: 'riskWarning',
          label: 'Risk Warning',
          style: TextInputStyle.Paragraph,
          placeholder: 'Do not increase risk to recover losses',
        }),
        inputRow({
          id: 'botSkillLesson',
          label: 'Bot Skill Lesson',
          style: TextInputStyle.Paragraph,
          placeholder: 'Review how the EA reacts around session opens',
        }),
        inputRow({
          id: 'actionAndGrade',
          label: 'Action Step + Coach Grade',
          style: TextInputStyle.Paragraph,
          placeholder: 'Action Step Before Next Session: Review yesterday chart\nCoach Grade: B+',
        }),
      );
  }

  parseProfileFields(fields) {
    const goals = parseStructuredInput(getOptionalFieldValue(fields, 'goals'), [
      { key: 'weeklyGoal', labels: ['weekly goal'] },
      { key: 'dailyGoal', labels: ['daily goal'] },
    ]);

    const sessionSetup = parseStructuredInput(getOptionalFieldValue(fields, 'sessionSetup'), [
      { key: 'maxDailyLoss', labels: ['max daily loss'] },
      { key: 'tradingSession', labels: ['trading session'] },
      { key: 'brokerTime', labels: ['broker time'] },
    ]);

    return {
      accountSize: getOptionalFieldValue(fields, 'accountSize'),
      botEaUsed: getOptionalFieldValue(fields, 'botEaUsed'),
      tradingPair: getOptionalFieldValue(fields, 'tradingPair'),
      weeklyGoal: goals.weeklyGoal || '',
      dailyGoal: goals.dailyGoal || '',
      maxDailyLoss: sessionSetup.maxDailyLoss || '',
      tradingSession: sessionSetup.tradingSession || '',
      brokerTime: sessionSetup.brokerTime || '',
    };
  }

  async submitProfile(interaction) {
    const context = await this.requireDeskContext(interaction, {
      requireDeskOwner: true,
    });

    if (!context) {
      return null;
    }

    const now = new Date().toISOString();
    const existing = await this.repository.getProfile(context.deskUserId);
    const values = this.parseProfileFields(interaction.fields);

    const profile = {
      discordUserId: context.deskUserId,
      username: interaction.user.username,
      channelId: interaction.channel.id,
      ...values,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await this.repository.saveProfile(profile);
    await this.repository.addLog({
      id: randomUUID(),
      discordUserId: context.deskUserId,
      username: interaction.user.username,
      channelId: interaction.channel.id,
      date: getDateKey(),
      timestamp: now,
      logType: 'profile',
      ...values,
    });

    return profile;
  }

  buildProfileEmbed(profile, student) {
    return buildEmbed(
      '\u{1F9FE} CULTURE COIN PROFILE',
      0x1f6feb,
      [
        `**Student:** ${student.mention}`,
        `**Account Size:** ${profile.accountSize || 'Not set'}`,
        `**Bot/EA Used:** ${profile.botEaUsed || 'Not set'}`,
        `**Trading Pair:** ${profile.tradingPair || 'Not set'}`,
        `**Weekly Goal:** ${profile.weeklyGoal || 'Not set'}`,
        `**Daily Goal:** ${profile.dailyGoal || 'Not set'}`,
        `**Max Daily Loss:** ${profile.maxDailyLoss || 'Not set'}`,
        `**Trading Session:** ${profile.tradingSession || 'Not set'}`,
        `**Broker Time:** ${profile.brokerTime || 'Not set'}`,
        `**Last Updated:** ${getTimestampLabel(new Date(profile.updatedAt))}`,
      ],
    );
  }

  async getProfileForDesk(interaction) {
    const context = await this.requireDeskContext(interaction, { allowStaff: true });
    if (!context) {
      return null;
    }

    return {
      context,
      profile: await this.repository.getProfile(context.deskUserId),
    };
  }

  async getDailyLog(userId, dateKey, logType) {
    const logs = await this.repository.getAllLogs();
    return (
      logs
        .filter(
          (log) =>
            log.discordUserId === userId &&
            log.date === dateKey &&
            log.logType === logType,
        )
        .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))[0] || null
    );
  }

  async getWeeklyReviewLog(userId, weekStart) {
    const logs = await this.repository.getAllLogs();
    return (
      logs
        .filter(
          (log) =>
            log.discordUserId === userId &&
            log.logType === 'weekly-review' &&
            log.weekStart === weekStart,
        )
        .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))[0] || null
    );
  }

  async getLogsForRange(userId, startKey, endKey, logTypes) {
    const logs = await this.repository.getAllLogs();
    return logs.filter((log) => {
      if (log.discordUserId !== userId) {
        return false;
      }

      if (!log.date) {
        return false;
      }

      if (log.date < startKey || log.date > endKey) {
        return false;
      }

      return logTypes.includes(log.logType);
    });
  }

  async sendOrEditDeskMessage(channel, messageId, payload) {
    if (messageId) {
      try {
        const existing = await channel.messages.fetch(messageId);
        const updated = await existing.edit(payload);
        return { message: updated, updated: true };
      } catch {
        // Fall through.
      }
    }

    const message = await channel.send(payload);
    return { message, updated: false };
  }

  buildMt4Fields(record) {
    if (!record?.snapshot) {
      return [];
    }

    const snapshot = record.snapshot;
    return [
      `**Equity:** ${formatCurrency(snapshot.equity)}`,
      `**Floating P/L:** ${formatCurrency(snapshot.floatingPL)}`,
      `**Open Trades:** ${snapshot.openTradeCount ?? 'N/A'}`,
      `**Symbols:** ${snapshot.symbols?.length ? snapshot.symbols.join(', ') : 'N/A'}`,
      `**Last Sync:** ${getTimestampLabel(new Date(record.receivedAt))}`,
    ];
  }

  async submitClockIn(interaction) {
    const context = await this.requireDeskContext(interaction, { allowStaff: true });
    if (!context) {
      return null;
    }

    const student = await this.getStudentDisplay(interaction.guild, context.deskUserId);
    const profile = await this.repository.getProfile(context.deskUserId);
    const dateKey = getDateKey();
    const timestamp = new Date();
    const existingLog = await this.getDailyLog(context.deskUserId, dateKey, 'clock-in');
    const mt4Fresh = await this.getFreshMt4SnapshotForUser(context.deskUserId);
    const mt4Latest = mt4Fresh || (await this.getLatestMt4SnapshotForUser(context.deskUserId));
    const isMt4Mode = interaction.customId.includes(':mt4') && Boolean(mt4Latest?.snapshot);

    const checks = isMt4Mode
      ? {
          newsChecked: getOptionalFieldValue(interaction.fields, 'newsChecked'),
          mindsetCheck: getOptionalFieldValue(interaction.fields, 'mindsetCheck'),
          screenshotAttached: getOptionalFieldValue(interaction.fields, 'screenshotAttached'),
        }
      : parseStructuredInput(getOptionalFieldValue(interaction.fields, 'checks'), [
          { key: 'newsChecked', labels: ['news checked'] },
          { key: 'mindsetCheck', labels: ['mindset check'] },
          { key: 'screenshotAttached', labels: ['screenshot attached'] },
        ]);

    const startingBalanceValue = isMt4Mode
      ? mt4Latest?.snapshot?.balance ?? null
      : parseNumericValue(getOptionalFieldValue(interaction.fields, 'startingBalance'));
    const startingBalance =
      isMt4Mode && startingBalanceValue !== null
        ? String(startingBalanceValue)
        : getOptionalFieldValue(interaction.fields, 'startingBalance') || existingLog?.startingBalance || '';
    const dailyTarget = isMt4Mode
      ? existingLog?.dailyTarget || profile?.dailyGoal || ''
      : getOptionalFieldValue(interaction.fields, 'todayTarget');
    const maxLoss = isMt4Mode
      ? existingLog?.maxLoss || profile?.maxDailyLoss || ''
      : getOptionalFieldValue(interaction.fields, 'todayMaxLoss');
    const marketBias = getOptionalFieldValue(interaction.fields, 'marketBias');
    const sessionNote = getOptionalFieldValue(interaction.fields, 'sessionNote');

    const record = {
      id: existingLog?.id || randomUUID(),
      discordUserId: context.deskUserId,
      username: student.username,
      channelId: interaction.channel.id,
      date: dateKey,
      timestamp: timestamp.toISOString(),
      logType: 'clock-in',
      dataSource: isMt4Mode ? 'mt4+manual' : 'manual',
      startingBalance,
      startingBalanceValue,
      dailyTarget,
      dailyTargetValue: parseNumericValue(dailyTarget),
      maxLoss,
      maxLossValue: parseNumericValue(maxLoss),
      marketBias,
      newsChecked: normalizeYesNo(checks.newsChecked),
      mindsetCheck: checks.mindsetCheck || 'N/A',
      screenshotAttached: normalizeYesNo(checks.screenshotAttached),
      sessionNote: sessionNote || existingLog?.sessionNote || '',
      botEaUsed: profile?.botEaUsed || 'Not set',
      tradingPair: profile?.tradingPair || 'Not set',
      weeklyGoal: profile?.weeklyGoal || 'Not set',
      tradingSession: profile?.tradingSession || 'Not set',
      brokerTime: profile?.brokerTime || 'Not set',
      maxDailyLoss: profile?.maxDailyLoss || maxLoss || 'Not set',
      mt4SnapshotReceivedAt: mt4Latest?.receivedAt || null,
      mt4Balance: mt4Latest?.snapshot?.balance ?? null,
      mt4Equity: mt4Latest?.snapshot?.equity ?? null,
      mt4FloatingPl: mt4Latest?.snapshot?.floatingPL ?? null,
      mt4OpenTrades: mt4Latest?.snapshot?.openTradeCount ?? null,
      mt4Symbols: mt4Latest?.snapshot?.symbols || [],
      submittedByUserId: interaction.user.id,
      messageId: existingLog?.messageId || null,
    };

    const embed = buildEmbed(
      '\u{1F7E2} DAILY TRADING CLOCK-IN',
      0x2ecc71,
      [
        `**Student:** ${student.mention}`,
        `**Date:** ${getDateLabel(timestamp)}`,
        `**Clock-In Time:** ${getTimeLabel(timestamp)}`,
        `**Starting Balance:** ${formatCurrency(record.startingBalance)}`,
        `**Today Target:** ${formatCurrency(record.dailyTarget)}`,
        `**Today Max Loss:** ${formatCurrency(record.maxLoss)}`,
        `**Bot/EA:** ${record.botEaUsed}`,
        `**Trading Pair:** ${record.tradingPair}`,
        `**Trading Session:** ${record.tradingSession}`,
        `**Broker Time:** ${record.brokerTime}`,
        ...this.buildMt4Fields(mt4Latest),
        `**Market Bias:** ${record.marketBias || 'N/A'}`,
        `**News Checked:** ${record.newsChecked}`,
        `**Mindset Check:** ${record.mindsetCheck}`,
        `**Screenshot Attached:** ${record.screenshotAttached}`,
        ...(record.sessionNote ? [`**Note:** ${record.sessionNote}`] : []),
        '',
        '**Status:** Clocked in and ready to operate.',
      ],
      existingLog ? 'Updated existing clock-in for today.' : null,
    );

    const messageResult = await this.sendOrEditDeskMessage(interaction.channel, existingLog?.messageId, {
      embeds: [embed],
    });

    record.messageId = messageResult.message.id;

    await this.repository.upsertLog(
      (log) =>
        log.discordUserId === context.deskUserId &&
        log.date === dateKey &&
        log.logType === 'clock-in',
      record,
    );

    return {
      record,
      updated: existingLog !== null || messageResult.updated,
    };
  }

  async submitEaLog(interaction) {
    const context = await this.requireDeskContext(interaction, { allowStaff: true });
    if (!context) {
      return null;
    }

    const student = await this.getStudentDisplay(interaction.guild, context.deskUserId);
    const profile = await this.repository.getProfile(context.deskUserId);
    const timestamp = new Date();
    const mt4Fresh = await this.getFreshMt4SnapshotForUser(context.deskUserId);
    const mt4Latest = mt4Fresh || (await this.getLatestMt4SnapshotForUser(context.deskUserId));
    const isMt4Mode = interaction.customId.includes(':mt4') && Boolean(mt4Latest?.snapshot);
    const manualSnapshot = parseStructuredInput(getOptionalFieldValue(interaction.fields, 'accountSnapshot'), [
      { key: 'balance', labels: ['balance'] },
      { key: 'equity', labels: ['equity'] },
      { key: 'openTrades', labels: ['open trades'] },
    ]);

    const record = {
      id: randomUUID(),
      discordUserId: context.deskUserId,
      username: student.username,
      channelId: interaction.channel.id,
      date: getDateKey(timestamp),
      timestamp: timestamp.toISOString(),
      logType: 'ea-log',
      dataSource: isMt4Mode ? 'mt4+manual' : 'manual',
      balance: isMt4Mode ? String(mt4Latest?.snapshot?.balance ?? '') : manualSnapshot.balance || '',
      balanceValue: isMt4Mode ? mt4Latest?.snapshot?.balance ?? null : parseNumericValue(manualSnapshot.balance),
      equity: isMt4Mode ? String(mt4Latest?.snapshot?.equity ?? '') : manualSnapshot.equity || '',
      equityValue: isMt4Mode ? mt4Latest?.snapshot?.equity ?? null : parseNumericValue(manualSnapshot.equity),
      floatingPl: mt4Latest?.snapshot?.floatingPL ?? null,
      openTrades: isMt4Mode ? String(mt4Latest?.snapshot?.openTradeCount ?? '') : manualSnapshot.openTrades || '',
      buyTradeCount: mt4Latest?.snapshot?.buyTradeCount ?? null,
      sellTradeCount: mt4Latest?.snapshot?.sellTradeCount ?? null,
      totalLots: mt4Latest?.snapshot?.totalLots ?? null,
      symbols: mt4Latest?.snapshot?.symbols || [],
      eaAction: getOptionalFieldValue(interaction.fields, 'eaAction'),
      marketBehavior: getOptionalFieldValue(interaction.fields, 'marketBehavior'),
      studentAction: getOptionalFieldValue(interaction.fields, 'studentAction'),
      questionForCoach: getOptionalFieldValue(interaction.fields, 'questionForCoach') || 'N/A',
      sessionNote: getOptionalFieldValue(interaction.fields, 'sessionNote'),
      tradingPair: profile?.tradingPair || 'Not set',
      botEaUsed: profile?.botEaUsed || 'Not set',
      mt4SnapshotReceivedAt: mt4Latest?.receivedAt || null,
      submittedByUserId: interaction.user.id,
    };

    const embed = buildEmbed(
      '\u{1F916} EA ACTIVITY LOG',
      0xf39c12,
      [
        `**Student:** ${student.mention}`,
        `**Date:** ${getDateLabel(timestamp)}`,
        `**Time:** ${getTimeLabel(timestamp)}`,
        `**Bot/EA:** ${record.botEaUsed}`,
        `**Trading Pair:** ${record.tradingPair}`,
        `**Balance:** ${formatCurrency(record.balance)}`,
        `**Equity:** ${formatCurrency(record.equity)}`,
        ...(record.floatingPl !== null ? [`**Floating P/L:** ${formatCurrency(record.floatingPl)}`] : []),
        `**Open Trades:** ${record.openTrades || 'N/A'}`,
        ...(record.buyTradeCount !== null ? [`**Buy Trades:** ${record.buyTradeCount}`] : []),
        ...(record.sellTradeCount !== null ? [`**Sell Trades:** ${record.sellTradeCount}`] : []),
        ...(record.totalLots !== null ? [`**Total Lots:** ${record.totalLots}`] : []),
        ...(record.symbols.length ? [`**Symbols:** ${record.symbols.join(', ')}`] : []),
        ...(record.mt4SnapshotReceivedAt ? [`**Last Sync:** ${getTimestampLabel(new Date(record.mt4SnapshotReceivedAt))}`] : []),
        `**EA Action:** ${record.eaAction}`,
        `**Market Behavior:** ${record.marketBehavior}`,
        `**Student Action:** ${record.studentAction}`,
        `**Question for Coach:** ${record.questionForCoach}`,
        ...(record.sessionNote ? [`**Note:** ${record.sessionNote}`] : []),
      ],
    );

    const message = await interaction.channel.send({ embeds: [embed] });
    record.messageId = message.id;
    await this.repository.addLog(record);
    return record;
  }

  async submitClockOut(interaction) {
    const context = await this.requireDeskContext(interaction, { allowStaff: true });
    if (!context) {
      return null;
    }

    const student = await this.getStudentDisplay(interaction.guild, context.deskUserId);
    const profile = await this.repository.getProfile(context.deskUserId);
    const timestamp = new Date();
    const dateKey = getDateKey(timestamp);
    const clockIn = await this.getDailyLog(context.deskUserId, dateKey, 'clock-in');
    const existingClockOut = await this.getDailyLog(context.deskUserId, dateKey, 'clock-out');
    const mt4Fresh = await this.getFreshMt4SnapshotForUser(context.deskUserId);
    const mt4Latest = mt4Fresh || (await this.getLatestMt4SnapshotForUser(context.deskUserId));
    const isMt4Mode = interaction.customId.includes(':mt4') && Boolean(mt4Latest?.snapshot);

    const discipline = isMt4Mode
      ? {
          goalHit: '',
          rulesFollowed: getOptionalFieldValue(interaction.fields, 'rulesFollowed'),
        }
      : parseStructuredInput(getOptionalFieldValue(interaction.fields, 'disciplineReview'), [
          { key: 'goalHit', labels: ['goal hit'] },
          { key: 'rulesFollowed', labels: ['rules followed'] },
        ]);

    const endingBalanceValue = isMt4Mode
      ? mt4Latest?.snapshot?.balance ?? null
      : parseNumericValue(getOptionalFieldValue(interaction.fields, 'endingBalance'));
    const endingBalance =
      isMt4Mode && endingBalanceValue !== null
        ? String(endingBalanceValue)
        : getOptionalFieldValue(interaction.fields, 'endingBalance') || existingClockOut?.endingBalance || '';
    const startingBalance = clockIn?.startingBalance || 'N/A';
    const startingBalanceValue = parseNumericValue(clockIn?.startingBalance);
    const dailyTarget = clockIn?.dailyTarget || profile?.dailyGoal || 'N/A';
    const dailyTargetValue = parseNumericValue(clockIn?.dailyTarget || profile?.dailyGoal);
    const profitLossValue =
      startingBalanceValue !== null && endingBalanceValue !== null
        ? endingBalanceValue - startingBalanceValue
        : null;
    const profitLossPercentValue =
      profitLossValue !== null && startingBalanceValue
        ? (profitLossValue / startingBalanceValue) * 100
        : null;
    const calculatedGoalReached =
      profitLossValue !== null && dailyTargetValue !== null ? profitLossValue >= dailyTargetValue : null;

    const record = {
      id: existingClockOut?.id || randomUUID(),
      discordUserId: context.deskUserId,
      username: student.username,
      channelId: interaction.channel.id,
      date: dateKey,
      timestamp: timestamp.toISOString(),
      logType: 'clock-out',
      dataSource: isMt4Mode ? 'mt4+manual' : 'manual',
      startingBalance,
      startingBalanceValue,
      endingBalance,
      endingBalanceValue,
      endingEquity: mt4Latest?.snapshot?.equity ?? null,
      floatingPl: mt4Latest?.snapshot?.floatingPL ?? null,
      openTrades: mt4Latest?.snapshot?.openTradeCount ?? null,
      dailyClosedPl: mt4Latest?.snapshot?.dailyClosedPL ?? null,
      symbols: mt4Latest?.snapshot?.symbols || [],
      profitLoss: profitLossValue,
      profitLossPercent: profitLossPercentValue,
      dailyTarget,
      dailyTargetValue,
      goalHit: isMt4Mode
        ? calculatedGoalReached === null
          ? 'N/A'
          : calculatedGoalReached
            ? 'Yes'
            : 'No'
        : normalizeYesNo(discipline.goalHit),
      calculatedGoalReached,
      rulesFollowed: normalizeYesNo(discipline.rulesFollowed),
      mistakeMade: getOptionalFieldValue(interaction.fields, 'mistakeMade'),
      lessonLearned: getOptionalFieldValue(interaction.fields, 'lessonLearned'),
      tomorrowsAdjustment: getOptionalFieldValue(interaction.fields, 'tomorrowsAdjustment'),
      botEaUsed: profile?.botEaUsed || 'Not set',
      tradingPair: profile?.tradingPair || 'Not set',
      warning: clockIn ? null : 'No clock-in found for today.',
      mt4SnapshotReceivedAt: mt4Latest?.receivedAt || null,
      submittedByUserId: interaction.user.id,
      messageId: existingClockOut?.messageId || null,
    };

    const embed = buildEmbed(
      '\u{1F534} DAILY TRADING CLOCK-OUT',
      0xe74c3c,
      [
        `**Student:** ${student.mention}`,
        `**Date:** ${getDateLabel(timestamp)}`,
        `**Clock-Out Time:** ${getTimeLabel(timestamp)}`,
        `**Starting Balance:** ${formatCurrency(record.startingBalance)}`,
        `**Ending Balance:** ${formatCurrency(record.endingBalance)}`,
        ...(record.endingEquity !== null ? [`**Ending Equity:** ${formatCurrency(record.endingEquity)}`] : []),
        ...(record.floatingPl !== null ? [`**Floating P/L:** ${formatCurrency(record.floatingPl)}`] : []),
        ...(record.dailyClosedPl !== null ? [`**Daily Closed P/L:** ${formatCurrency(record.dailyClosedPl)}`] : []),
        ...(record.openTrades !== null ? [`**Open Trades:** ${record.openTrades}`] : []),
        ...(record.symbols.length ? [`**Symbols:** ${record.symbols.join(', ')}`] : []),
        ...(record.mt4SnapshotReceivedAt ? [`**Last Sync:** ${getTimestampLabel(new Date(record.mt4SnapshotReceivedAt))}`] : []),
        `**Profit/Loss:** ${formatCurrency(record.profitLoss)}`,
        `**Profit/Loss %:** ${formatPercent(record.profitLossPercent)}`,
        `**Daily Target:** ${formatCurrency(record.dailyTarget)}`,
        `**Goal Hit:** ${record.goalHit}`,
        `**Rules Followed:** ${record.rulesFollowed}`,
        `**Mistake Made:** ${record.mistakeMade}`,
        `**Lesson Learned:** ${record.lessonLearned}`,
        `**Tomorrow Adjustment:** ${record.tomorrowsAdjustment}`,
        '',
        '**Status:** Clocked out. Session recorded.',
        ...(record.warning ? ['', `**Warning:** ${record.warning}`] : []),
      ],
      existingClockOut ? 'Updated existing clock-out for today.' : null,
    );

    const messageResult = await this.sendOrEditDeskMessage(interaction.channel, existingClockOut?.messageId, {
      embeds: [embed],
    });

    record.messageId = messageResult.message.id;

    await this.repository.upsertLog(
      (log) =>
        log.discordUserId === context.deskUserId &&
        log.date === dateKey &&
        log.logType === 'clock-out',
      record,
    );

    return {
      record,
      updated: existingClockOut !== null || messageResult.updated,
    };
  }

  async buildWeeklyStats(userId) {
    const week = getWeekRange();
    const logs = await this.getLogsForRange(userId, week.startKey, week.endKey, ['clock-in', 'clock-out']);

    const clockIns = logs
      .filter((log) => log.logType === 'clock-in')
      .sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
    const clockOuts = logs
      .filter((log) => log.logType === 'clock-out')
      .sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));

    const clockInDates = [...new Set(clockIns.map((log) => log.date))];
    const clockOutDates = [...new Set(clockOuts.map((log) => log.date))];
    const completedDates = clockInDates.filter((date) => clockOutDates.includes(date));
    const missedClockOuts = clockInDates.filter((date) => !clockOutDates.includes(date));

    const startingBalance =
      clockIns[0]?.startingBalanceValue ??
      clockIns[0]?.startingBalance ??
      clockOuts[0]?.startingBalanceValue ??
      clockOuts[0]?.startingBalance ??
      null;

    const endingBalance =
      clockOuts.at(-1)?.endingBalanceValue ??
      clockOuts.at(-1)?.endingBalance ??
      clockIns.at(-1)?.startingBalanceValue ??
      clockIns.at(-1)?.startingBalance ??
      null;

    const startingBalanceValue = parseNumericValue(startingBalance);
    const endingBalanceValue = parseNumericValue(endingBalance);
    const weeklyProfitLoss =
      startingBalanceValue !== null && endingBalanceValue !== null
        ? endingBalanceValue - startingBalanceValue
        : null;
    const weeklyGrowth =
      weeklyProfitLoss !== null && startingBalanceValue
        ? (weeklyProfitLoss / startingBalanceValue) * 100
        : null;

    const rankedDays = clockOuts
      .filter((log) => typeof log.profitLoss === 'number' && Number.isFinite(log.profitLoss))
      .sort((left, right) => right.profitLoss - left.profitLoss);

    const bestDay = rankedDays[0]
      ? `${getDateLabel(new Date(`${rankedDays[0].date}T00:00:00`))} (${formatCurrency(rankedDays[0].profitLoss)})`
      : 'N/A';
    const worstDay = rankedDays.at(-1)
      ? `${getDateLabel(new Date(`${rankedDays.at(-1).date}T00:00:00`))} (${formatCurrency(rankedDays.at(-1).profitLoss)})`
      : 'N/A';

    return {
      week,
      clockIns,
      clockOuts,
      clockInCount: clockIns.length,
      clockOutCount: clockOuts.length,
      missedClockOuts: missedClockOuts.length,
      disciplineStreak: calculateConsecutiveStreak(completedDates),
      startingBalance,
      endingBalance,
      weeklyProfitLoss,
      weeklyGrowth,
      bestDay,
      worstDay,
    };
  }

  async submitWeeklyReview(interaction) {
    const context = await this.requireDeskContext(interaction, { allowStaff: true });
    if (!context) {
      return null;
    }

    const student = await this.getStudentDisplay(interaction.guild, context.deskUserId);
    const stats = await this.buildWeeklyStats(context.deskUserId);
    const existing = await this.getWeeklyReviewLog(context.deskUserId, stats.week.startKey);
    const timestamp = new Date();

    const record = {
      id: existing?.id || randomUUID(),
      discordUserId: context.deskUserId,
      username: student.username,
      channelId: interaction.channel.id,
      weekStart: stats.week.startKey,
      weekEnd: stats.week.endKey,
      logType: 'weekly-review',
      startingBalance: stats.startingBalance,
      endingBalance: stats.endingBalance,
      weeklyProfitLoss: stats.weeklyProfitLoss,
      weeklyGrowth: stats.weeklyGrowth,
      bestDay: stats.bestDay,
      worstDay: stats.worstDay,
      clockInCount: stats.clockInCount,
      clockOutCount: stats.clockOutCount,
      missedClockOuts: stats.missedClockOuts,
      disciplineStreak: stats.disciplineStreak,
      biggestLesson: getOptionalFieldValue(interaction.fields, 'biggestLesson'),
      coachFeedbackNeeded: getOptionalFieldValue(interaction.fields, 'coachFeedbackNeeded'),
      nextWeekGoal: getOptionalFieldValue(interaction.fields, 'nextWeekGoal'),
      date: getDateKey(timestamp),
      timestamp: timestamp.toISOString(),
      submittedByUserId: interaction.user.id,
      messageId: existing?.messageId || null,
    };

    const embed = buildEmbed(
      '\u{1F4CA} WEEKLY COMPOUND REVIEW',
      0x3498db,
      [
        `**Student:** ${student.mention}`,
        `**Week Of:** ${getDateLabel(stats.week.start)} - ${getDateLabel(stats.week.end)}`,
        `**Starting Balance:** ${formatCurrency(record.startingBalance)}`,
        `**Ending Balance:** ${formatCurrency(record.endingBalance)}`,
        `**Weekly Profit/Loss:** ${formatCurrency(record.weeklyProfitLoss)}`,
        `**Weekly Growth %:** ${formatPercent(record.weeklyGrowth)}`,
        `**Best Day:** ${record.bestDay}`,
        `**Worst Day:** ${record.worstDay}`,
        `**Clock-Ins:** ${record.clockInCount}`,
        `**Clock-Outs:** ${record.clockOutCount}`,
        `**Missed Clock-Outs:** ${record.missedClockOuts}`,
        `**Discipline Streak:** ${record.disciplineStreak}`,
        '',
        `**Biggest Lesson:** ${record.biggestLesson}`,
        `**Coach Feedback Needed:** ${record.coachFeedbackNeeded}`,
        `**Next Week Goal:** ${record.nextWeekGoal}`,
      ],
      existing ? 'Updated existing weekly review for this week.' : null,
    );

    const messageResult = await this.sendOrEditDeskMessage(interaction.channel, existing?.messageId, {
      embeds: [embed],
    });

    record.messageId = messageResult.message.id;

    await this.repository.upsertLog(
      (log) =>
        log.discordUserId === context.deskUserId &&
        log.logType === 'weekly-review' &&
        log.weekStart === stats.week.startKey,
      record,
    );

    return {
      record,
      updated: existing !== null || messageResult.updated,
    };
  }

  async submitCoachNote(interaction, studentUserId) {
    if (!this.isStaff(interaction.member)) {
      throw createUserError('This command is only available to Coach/Admin.');
    }

    const deskChannel = await this.getDeskChannelForUser(interaction.guild, studentUserId);
    if (!deskChannel) {
      throw createUserError("Could not find that student's private desk.");
    }

    const student = await this.getStudentDisplay(interaction.guild, studentUserId);
    const actionAndGrade = parseStructuredInput(getOptionalFieldValue(interaction.fields, 'actionAndGrade'), [
      { key: 'actionStep', labels: ['action step before next session'] },
      { key: 'coachGrade', labels: ['coach grade'] },
    ]);

    const timestamp = new Date();
    const record = {
      id: randomUUID(),
      coachUserId: interaction.user.id,
      studentUserId,
      channelId: deskChannel.id,
      date: getDateKey(timestamp),
      timestamp: timestamp.toISOString(),
      logType: 'coach-note',
      whatWentWell: getOptionalFieldValue(interaction.fields, 'whatWentWell'),
      correction: getOptionalFieldValue(interaction.fields, 'correction'),
      riskWarning: getOptionalFieldValue(interaction.fields, 'riskWarning'),
      botSkillLesson: getOptionalFieldValue(interaction.fields, 'botSkillLesson'),
      actionStep: actionAndGrade.actionStep || '',
      coachGrade: actionAndGrade.coachGrade || '',
    };

    const embed = buildEmbed(
      '\u{1F468}\u200D\u{1F3EB} COACH OVERVIEW NOTES',
      0x9b59b6,
      [
        `**Student:** ${student.mention}`,
        `**Date:** ${getDateLabel(timestamp)}`,
        `**Coach:** <@${interaction.user.id}>`,
        `**What Student Did Well:** ${record.whatWentWell}`,
        `**What Needs Correction:** ${record.correction}`,
        `**Risk Warning:** ${record.riskWarning}`,
        `**Bot Skill Lesson:** ${record.botSkillLesson}`,
        `**Action Step Before Next Session:** ${record.actionStep || 'N/A'}`,
        `**Coach Grade:** ${record.coachGrade || 'N/A'}`,
      ],
    );

    const message = await deskChannel.send({ embeds: [embed] });
    record.messageId = message.id;
    await this.repository.addLog(record);

    return {
      record,
      deskChannel,
    };
  }
}

export { createUserError };
