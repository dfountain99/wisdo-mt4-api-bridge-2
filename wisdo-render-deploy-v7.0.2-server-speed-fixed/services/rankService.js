import { createDatabaseStateStore } from '../storage/stateStore.js';

const RANKS = [
  { key: 'UNRANKED', name: 'Unranked', emoji: '🌱', minGrowth: 0 },
  { key: 'BRONZE', name: 'Bronze Trader', emoji: '🥉', minGrowth: 5 },
  { key: 'SILVER', name: 'Silver Trader', emoji: '🥈', minGrowth: 15 },
  { key: 'GOLD', name: 'Gold Trader', emoji: '🥇', minGrowth: 30 },
  { key: 'PLATINUM', name: 'Platinum Trader', emoji: '💿', minGrowth: 60 },
  { key: 'DIAMOND', name: 'Diamond Trader', emoji: '💎', minGrowth: 100 },
  { key: 'ELITE', name: 'Elite Trader', emoji: '⚔️', minGrowth: 200 },
  { key: 'CROWN', name: 'Crown Trader', emoji: '👑', minGrowth: 500 },
  { key: 'HIGHTOWER', name: 'Hightower', emoji: '🏯', minGrowth: 1000 },
];

export class RankService {
  constructor({ config, mt4SyncService, logger }) {
    this.config = config;
    this.mt4SyncService = mt4SyncService;
    this.logger = logger;
    this.store = createDatabaseStateStore('rank_state', () => ({ ranksByUserId: {} }));
    this.minEquityHighPercent = Number(process.env.RANK_MIN_EQUITY_HIGH_PERCENT || 5);
    this.greenStreakTarget = Number(process.env.RANK_STREAK_GREEN_UPDATES || 3);
  }

  async load() {
    const data = await this.store.read();
    return { ranksByUserId: data.ranksByUserId || {} };
  }

  async save(data) {
    return this.store.write(data);
  }

  async processSnapshot(discordUserId) {
    const latestSnapshot = await this.mt4SyncService.getLatestSnapshot(discordUserId);

    if (!latestSnapshot?.snapshot) {
      return [];
    }

    const snapshot = latestSnapshot.snapshot;
    const currentEquity = Number(snapshot.equity || 0);
    const dailyClosedPL = Number(snapshot.dailyClosedPL || 0);
    const floatingPL = Number(snapshot.floatingPL || 0);

    if (currentEquity <= 0) {
      return [];
    }

    const data = await this.load();
    const now = new Date().toISOString();

    const existing = data.ranksByUserId[discordUserId] || {
      discordUserId,
      baselineEquity: currentEquity,
      highestEquity: currentEquity,
      currentRankKey: 'UNRANKED',
      lastAnnouncedRankKey: 'UNRANKED',
      greenStreak: 0,
      lastEquity: currentEquity,
      lastEquityHighAnnouncedAt: null,
      createdAt: now,
    };

    const previousRankKey = existing.currentRankKey || 'UNRANKED';
    const previousHigh = Number(existing.highestEquity || currentEquity);
    const baselineEquity = Number(existing.baselineEquity || currentEquity);
    const previousEquity = Number(existing.lastEquity || currentEquity);

    const growthPercent = baselineEquity > 0
      ? ((currentEquity - baselineEquity) / baselineEquity) * 100
      : 0;

    const currentRank = getRankForGrowth(growthPercent);
    const previousRank = getRankByKey(previousRankKey);

    const events = [];

    existing.highestEquity = Math.max(previousHigh, currentEquity);
    existing.currentRankKey = currentRank.key;
    existing.lastEquity = currentEquity;
    existing.growthPercent = growthPercent;
    existing.updatedAt = now;

    if (currentEquity > previousEquity) {
      existing.greenStreak = Number(existing.greenStreak || 0) + 1;
    } else if (currentEquity < previousEquity) {
      existing.greenStreak = 0;
    }

    if (rankIndex(currentRank.key) > rankIndex(previousRankKey)) {
      events.push({
        type: 'rank_up',
        discordUserId,
        rank: currentRank,
        previousRank,
        baselineEquity,
        currentEquity,
        growthPercent,
        dailyClosedPL,
        floatingPL,
        timestamp: now,
      });

      existing.lastAnnouncedRankKey = currentRank.key;
    }

    const highGainPercent = previousHigh > 0
      ? ((currentEquity - previousHigh) / previousHigh) * 100
      : 0;

    if (currentEquity > previousHigh && highGainPercent >= this.minEquityHighPercent) {
      events.push({
        type: 'equity_high',
        discordUserId,
        previousHigh,
        currentEquity,
        highGainPercent,
        growthPercent,
        dailyClosedPL,
        timestamp: now,
      });
    }

    if (
      existing.greenStreak > 0 &&
      existing.greenStreak % this.greenStreakTarget === 0 &&
      currentEquity > previousEquity
    ) {
      events.push({
        type: 'green_streak',
        discordUserId,
        greenStreak: existing.greenStreak,
        currentEquity,
        growthPercent,
        dailyClosedPL,
        timestamp: now,
      });
    }

    data.ranksByUserId[discordUserId] = existing;

    await this.save(data);

    return events;
  }

  async getRankStatus(discordUserId) {
    const data = await this.load();
    const record = data.ranksByUserId[discordUserId] || null;

    if (!record) {
      return null;
    }

    const currentRank = getRankByKey(record.currentRankKey);
    const nextRank = getNextRank(record.currentRankKey);

    return {
      ...record,
      currentRank,
      nextRank,
    };
  }
}

function getRankForGrowth(growthPercent) {
  let selected = RANKS[0];

  for (const rank of RANKS) {
    if (growthPercent >= rank.minGrowth) {
      selected = rank;
    }
  }

  return selected;
}

function getRankByKey(key) {
  return RANKS.find((rank) => rank.key === key) || RANKS[0];
}

function getNextRank(key) {
  const index = rankIndex(key);
  return RANKS[index + 1] || null;
}

function rankIndex(key) {
  return Math.max(0, RANKS.findIndex((rank) => rank.key === key));
}