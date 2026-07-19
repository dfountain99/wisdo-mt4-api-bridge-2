export class AnnouncementService {
  constructor({ config, client, logger }) {
    this.config = config;
    this.client = client;
    this.logger = logger;
    this.enabled = String(process.env.RANK_ANNOUNCEMENTS_ENABLED || 'true').toLowerCase() === 'true';
    this.channelId = process.env.RANK_ANNOUNCEMENT_CHANNEL_ID || '';
  }

  isReady() {
    return this.enabled && Boolean(this.channelId);
  }

  async postRankEvents(events = []) {
    if (!this.isReady()) {
      return;
    }

    if (!events.length) {
      return;
    }

    const channel = await this.client.channels.fetch(this.channelId).catch(() => null);

    if (!channel?.isTextBased()) {
      this.logger?.warn?.('Rank announcement channel is not available.', {
        channelId: this.channelId,
      });
      return;
    }

    for (const event of events) {
      const content = this.formatEvent(event);

      if (!content) {
        continue;
      }

      await channel.send({
        content,
        allowedMentions: {
          users: [event.discordUserId],
        },
      }).catch((error) => {
        this.logger?.error?.('Rank announcement failed', {
          message: error.message,
          stack: error.stack,
        });
      });
    }
  }

  formatEvent(event) {
    if (event.type === 'rank_up') {
      return [
        `${event.rank.emoji} **RANK UP!**`,
        '',
        `<@${event.discordUserId}> just ranked up to **${event.rank.name}**.`,
        '',
        `Previous Rank: **${event.previousRank?.name || 'Unranked'}**`,
        `Starting Equity: **$${formatMoney(event.baselineEquity)}**`,
        `Current Equity: **$${formatMoney(event.currentEquity)}**`,
        `Growth: **+${formatPercent(event.growthPercent)}%**`,
        `Daily Closed P/L: **$${formatMoney(event.dailyClosedPL)}**`,
        '',
        'WISDO says: protect the growth, don’t give the crown back.',
      ].join('\n');
    }

    if (event.type === 'equity_high') {
      return [
        '📈 **NEW EQUITY HIGH!**',
        '',
        `<@${event.discordUserId}> just pushed to a new account high.`,
        '',
        `Previous High: **$${formatMoney(event.previousHigh)}**`,
        `New High: **$${formatMoney(event.currentEquity)}**`,
        `High Break: **+${formatPercent(event.highGainPercent)}%**`,
        `Growth From Baseline: **+${formatPercent(event.growthPercent)}%**`,
        '',
        'Momentum is building. Stay disciplined.',
      ].join('\n');
    }

    if (event.type === 'green_streak') {
      return [
        '🔥 **STREAK ALERT!**',
        '',
        `<@${event.discordUserId}> has **${event.greenStreak} green equity updates in a row**.`,
        '',
        `Current Equity: **$${formatMoney(event.currentEquity)}**`,
        `Growth From Baseline: **+${formatPercent(event.growthPercent)}%**`,
        `Daily Closed P/L: **$${formatMoney(event.dailyClosedPL)}**`,
        '',
        'Consistency is becoming a weapon.',
      ].join('\n');
    }

    return null;
  }
}

function formatMoney(value) {
  const number = Number(value || 0);

  return number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  const number = Number(value || 0);

  return number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}