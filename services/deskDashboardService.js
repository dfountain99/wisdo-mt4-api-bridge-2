import fs from 'node:fs/promises';
import path from 'node:path';

import { atomicWriteJson } from '../storage/atomicJsonFile.js';

export class DeskDashboardService {
  constructor({
    config,
    client,
    operatorDeskService,
    mt4SyncService,
    chartRenderService,
    logger,
  }) {
    this.config = config;
    this.client = client;
    this.operatorDeskService = operatorDeskService;
    this.mt4SyncService = mt4SyncService;
    this.chartRenderService = chartRenderService;
    this.logger = logger;

    this.dataDir = config.dataDir || 'data/operator-desks';
    this.filePath = path.join(this.dataDir, 'desk-dashboards.json');

    this.minUpdateMs = Number(process.env.WISDO_DASHBOARD_UPDATE_SECONDS || 30) * 1000;
    this.inFlight = new Set();
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const data = JSON.parse(raw);

      return {
        dashboardsByUserId: data.dashboardsByUserId || {},
      };
    } catch {
      return {
        dashboardsByUserId: {},
      };
    }
  }

  async save(data) {
    await atomicWriteJson(this.filePath, data);
  }

  async updateDashboardForUser(discordUserId, options = {}) {
    if (!discordUserId) {
      return null;
    }

    if (this.inFlight.has(discordUserId)) {
      return null;
    }

    this.inFlight.add(discordUserId);

    try {
      const force = options.force === true;
      const state = await this.load();
      const existing = state.dashboardsByUserId[discordUserId];

      if (!force && existing?.lastUpdatedAt) {
        const ageMs = Date.now() - new Date(existing.lastUpdatedAt).getTime();

        if (ageMs < this.minUpdateMs) {
          return {
            status: 'skipped-rate-limit',
            ageMs,
          };
        }
      }

      const guildId = this.config.discordGuildId || this.config.guildId;
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(discordUserId).catch(() => null);

      if (!member) {
        return {
          status: 'member-not-found',
        };
      }

      const deskChannel = await this.operatorDeskService.getDeskChannelForUser(
        guild,
        discordUserId,
      );

      if (!deskChannel) {
        return {
          status: 'desk-not-found',
        };
      }

      const latestSnapshot = await this.mt4SyncService.getLatestSnapshot(discordUserId);
      const snapshotHistory = await this.mt4SyncService.getSnapshotHistory(discordUserId, 30);

      if (!latestSnapshot?.snapshot) {
        const payload = {
          content: buildNoSnapshotMessage(member),
        };

        const message = await this.upsertDashboardMessage({
          deskChannel,
          existing,
          payload,
        });

        state.dashboardsByUserId[discordUserId] = {
          channelId: deskChannel.id,
          messageId: message.id,
          lastUpdatedAt: new Date().toISOString(),
        };

        await this.save(state);

        return {
          status: 'updated-no-snapshot',
          channelId: deskChannel.id,
          messageId: message.id,
        };
      }

      const chart = await this.chartRenderService.renderAccountChart({
        discordUserId,
        snapshotHistory,
        studentName: member.user.username,
      });

      const payload = {
        content: buildDashboardMessage({
          member,
          latestSnapshot,
          freshness: this.mt4SyncService.getFreshnessInfo(latestSnapshot),
        }),
        files: [
          {
            attachment: chart.filePath,
            name: chart.fileName,
          },
        ],
      };

      const message = await this.upsertDashboardMessage({
        deskChannel,
        existing,
        payload,
      });

      state.dashboardsByUserId[discordUserId] = {
        channelId: deskChannel.id,
        messageId: message.id,
        lastUpdatedAt: new Date().toISOString(),
      };

      await this.save(state);

      return {
        status: 'updated',
        channelId: deskChannel.id,
        messageId: message.id,
      };
    } catch (error) {
      this.logger?.error?.('Desk dashboard update failed', {
        discordUserId,
        message: error.message,
        stack: error.stack,
      });

      return {
        status: 'error',
        error: error.message,
      };
    } finally {
      this.inFlight.delete(discordUserId);
    }
  }

  async upsertDashboardMessage({
    deskChannel,
    existing,
    payload,
  }) {
    const channel = await this.client.channels.fetch(deskChannel.id);

    if (!channel?.isTextBased()) {
      throw new Error('Desk channel is not text based.');
    }

    if (existing?.messageId) {
      const oldMessage = await channel.messages.fetch(existing.messageId).catch(() => null);

      if (oldMessage) {
        await oldMessage.edit(payload);
        return oldMessage;
      }
    }

    const message = await channel.send(payload);

    await message.pin().catch(() => null);

    return message;
  }
}

function buildNoSnapshotMessage(member) {
  return [
    '📊 **WISDO Live Account Tracker**',
    '',
    `Student: <@${member.id}>`,
    '',
    'Status: **Waiting for MT4 connection**',
    '',
    'No MT4 snapshot has been received yet.',
    '',
    'Student setup:',
    '`/connect-mt4`',
    '',
    'Then attach the CultureCoin MT4 Reporter to a chart.',
  ].join('\n');
}

function buildDashboardMessage({
  member,
  latestSnapshot,
  freshness,
}) {
  const snapshot = latestSnapshot.snapshot;
  const receivedAt = latestSnapshot.receivedAt
    ? new Date(latestSnapshot.receivedAt)
    : new Date();

  const status = freshness?.isFresh ? '🟢 Connected' : '🟡 Stale';
  const age = freshness?.ageMinutes !== null && freshness?.ageMinutes !== undefined
    ? `${freshness.ageMinutes.toFixed(1)} min ago`
    : 'unknown';

  return [
    '📊 **WISDO Live Account Tracker**',
    '',
    `Student: <@${member.id}>`,
    `Status: **${status}**`,
    `Account: \`${snapshot.accountNumber || 'unknown'}\``,
    `Server: \`${snapshot.brokerServer || 'unknown'}\``,
    `EA: \`${snapshot.eaName || 'unknown'} ${snapshot.eaVersion || ''}\``,
    '',
    `Balance: **$${formatMoney(snapshot.balance)}**`,
    `Equity: **$${formatMoney(snapshot.equity)}**`,
    `Floating P/L: **$${formatMoney(snapshot.floatingPL)}**`,
    `Daily Closed P/L: **$${formatMoney(snapshot.dailyClosedPL)}**`,
    '',
    `Open Trades: **${snapshot.openTradeCount || 0}**`,
    `Buy Trades: **${snapshot.buyTradeCount || 0}**`,
    `Sell Trades: **${snapshot.sellTradeCount || 0}**`,
    `Total Lots: **${formatNumber(snapshot.totalLots)}**`,
    '',
    `Last Sync: **${age}**`,
    `Updated: <t:${Math.floor(receivedAt.getTime() / 1000)}:R>`,
    '',
    '_This dashboard auto-refreshes from the MT4 Reporter._',
  ].join('\n');
}

function formatMoney(value) {
  const number = Number(value || 0);

  return number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumber(value) {
  const number = Number(value || 0);

  return number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}