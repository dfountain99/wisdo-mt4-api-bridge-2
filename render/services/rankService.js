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

const MILESTONE_STEP = 50;

function nowIso() { return new Date().toISOString(); }
function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function accountGrowthKey(discordUserId, accountId) { return `${String(discordUserId || '')}:${String(accountId || 'primary')}`; }

function growthMessage(percent, accountLabel = 'your account') {
  const label = accountLabel || 'your account';
  const messages = {
    50: `Momentum recognized. ${label} has grown 50% from its WISDO baseline. Protect the progress and keep execution disciplined.`,
    100: `Account doubled. ${label} has reached 100% growth from baseline. WISDO recognizes a complete capital expansion cycle.`,
    150: `Compounding tier unlocked. ${label} has reached 150% growth. Preserve the base that created this expansion.`,
    200: `Major growth authority reached. ${label} is now 200% above baseline. This is a protection-first milestone.`,
    250: `Quarter-thousand growth recognized. ${label} has crossed 250% growth from its recorded baseline.`,
    300: `Triple-growth cycle confirmed. ${label} has reached 300% growth. Secure the lane before increasing pressure.`,
    500: `Crown milestone recognized. ${label} has reached 500% growth from baseline.`,
    1000: `Hightower milestone recognized. ${label} has reached 1,000% growth from baseline.`,
  };
  return messages[percent] || `${label} has crossed a new WISDO growth level: ${percent}% above its recorded equity baseline.`;
}

export class RankService {
  constructor({ config, mt4SyncService, logger }) {
    this.config = config;
    this.mt4SyncService = mt4SyncService;
    this.logger = logger;
    this.store = createDatabaseStateStore('rank_state', () => ({ ranksByUserId: {}, growthMilestonesByAccountId: {} }));
    this.minEquityHighPercent = Number(process.env.RANK_MIN_EQUITY_HIGH_PERCENT || 5);
    this.greenStreakTarget = Number(process.env.RANK_STREAK_GREEN_UPDATES || 3);
    this.processingByAccount = new Map();
    this.lastProcessAtByAccount = new Map();
  }

  async load() {
    const data = await this.store.read();
    return {
      ranksByUserId: data.ranksByUserId || {},
      growthMilestonesByAccountId: data.growthMilestonesByAccountId || {},
    };
  }

  async save(data) {
    return this.store.write({
      ranksByUserId: data.ranksByUserId || {},
      growthMilestonesByAccountId: data.growthMilestonesByAccountId || {},
    });
  }

  async latestSnapshotFor(discordUserId, accountId = null) {
    if (accountId && this.mt4SyncService?.repository?.getLatestMt4SnapshotForAccount) {
      const accountSnapshot = await this.mt4SyncService.repository.getLatestMt4SnapshotForAccount(discordUserId, accountId);
      if (accountSnapshot?.snapshot) return accountSnapshot;
    }
    return this.mt4SyncService.getLatestSnapshot(discordUserId);
  }

  async processSnapshot(discordUserId, accountId = null) {
    const key = accountGrowthKey(discordUserId, accountId || 'primary');
    // Callers that receive high-frequency Reporter heartbeats must throttle before
    // invoking RankService. Keep the service itself immediate so explicit account
    // refreshes and milestone checks cannot silently miss a newly crossed level.
    const minIntervalMs = Math.max(0, Math.min(300_000, Number(process.env.WISDO_RANK_PROCESS_MIN_INTERVAL_MS || 0)));
    const lastAt = number(this.lastProcessAtByAccount.get(key));
    if (minIntervalMs > 0 && Date.now() - lastAt < minIntervalMs) return [];
    if (this.processingByAccount.has(key)) return this.processingByAccount.get(key);
    const maxEntries = Math.max(100, Math.min(5000, Number(process.env.WISDO_RANK_PROCESS_CACHE_MAX || 1000)));
    while (this.lastProcessAtByAccount.size >= maxEntries && !this.lastProcessAtByAccount.has(key)) {
      const oldest = this.lastProcessAtByAccount.keys().next().value;
      if (oldest === undefined) break;
      this.lastProcessAtByAccount.delete(oldest);
    }
    while (this.processingByAccount.size >= Math.min(maxEntries, 250) && !this.processingByAccount.has(key)) {
      const oldest = this.processingByAccount.keys().next().value;
      if (oldest === undefined) break;
      this.processingByAccount.delete(oldest);
    }
    this.lastProcessAtByAccount.set(key, Date.now());
    const work = this.processSnapshotNow(discordUserId, accountId).finally(() => this.processingByAccount.delete(key));
    this.processingByAccount.set(key, work);
    return work;
  }

  async processSnapshotNow(discordUserId, accountId = null) {
    const latestSnapshot = await this.latestSnapshotFor(discordUserId, accountId);
    if (!latestSnapshot?.snapshot) return [];

    const snapshot = latestSnapshot.snapshot;
    const resolvedAccountId = String(latestSnapshot.accountId || accountId || snapshot.accountId || snapshot.accountNumber || 'primary');
    const accountLabel = String(snapshot.accountNickname || snapshot.nickname || snapshot.accountNumber || resolvedAccountId);
    const currentEquity = number(snapshot.equity);
    const currentBalance = number(snapshot.balance, currentEquity);
    const dailyClosedPL = number(snapshot.dailyClosedPL ?? snapshot.daily_closed_pl);
    const floatingPL = number(snapshot.floatingPL ?? snapshot.floating_pl);
    if (currentEquity <= 0) return [];

    const data = await this.load();
    const now = nowIso();
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
    const previousHigh = number(existing.highestEquity, currentEquity);
    const baselineEquity = number(existing.baselineEquity, currentEquity);
    const previousEquity = number(existing.lastEquity, currentEquity);
    const growthPercent = baselineEquity > 0 ? ((currentEquity - baselineEquity) / baselineEquity) * 100 : 0;
    const currentRank = getRankForGrowth(growthPercent);
    const previousRank = getRankByKey(previousRankKey);
    const events = [];

    existing.highestEquity = Math.max(previousHigh, currentEquity);
    existing.currentRankKey = currentRank.key;
    existing.lastEquity = currentEquity;
    existing.growthPercent = growthPercent;
    existing.updatedAt = now;
    if (currentEquity > previousEquity) existing.greenStreak = Number(existing.greenStreak || 0) + 1;
    else if (currentEquity < previousEquity) existing.greenStreak = 0;

    if (rankIndex(currentRank.key) > rankIndex(previousRankKey)) {
      events.push({ type: 'rank_up', discordUserId, accountId: resolvedAccountId, rank: currentRank, previousRank, baselineEquity, currentEquity, growthPercent, dailyClosedPL, floatingPL, timestamp: now });
      existing.lastAnnouncedRankKey = currentRank.key;
    }

    const highGainPercent = previousHigh > 0 ? ((currentEquity - previousHigh) / previousHigh) * 100 : 0;
    if (currentEquity > previousHigh && highGainPercent >= this.minEquityHighPercent) {
      events.push({ type: 'equity_high', discordUserId, accountId: resolvedAccountId, previousHigh, currentEquity, highGainPercent, growthPercent, dailyClosedPL, timestamp: now });
    }

    if (existing.greenStreak > 0 && existing.greenStreak % this.greenStreakTarget === 0 && currentEquity > previousEquity) {
      events.push({ type: 'green_streak', discordUserId, accountId: resolvedAccountId, greenStreak: existing.greenStreak, currentEquity, growthPercent, dailyClosedPL, timestamp: now });
    }

    data.ranksByUserId[discordUserId] = existing;

    const milestoneKey = accountGrowthKey(discordUserId, resolvedAccountId);
    const milestoneRecord = data.growthMilestonesByAccountId[milestoneKey] || {
      discordUserId: String(discordUserId),
      accountId: resolvedAccountId,
      accountLabel,
      accountNumber: String(snapshot.accountNumber || ''),
      baselineEquity: number(snapshot.startingEquity ?? snapshot.initialEquity ?? snapshot.startingBalance ?? snapshot.initialBalance ?? currentBalance, currentEquity),
      highestEquity: currentEquity,
      highestMilestonePercent: 0,
      acknowledgedMilestonePercent: 0,
      pendingMilestones: [],
      createdAt: now,
    };
    if (milestoneRecord.baselineEquity <= 0) milestoneRecord.baselineEquity = currentBalance > 0 ? currentBalance : currentEquity;
    const accountGrowthPercent = milestoneRecord.baselineEquity > 0
      ? ((currentEquity - milestoneRecord.baselineEquity) / milestoneRecord.baselineEquity) * 100
      : 0;
    const reachedMilestone = Math.max(0, Math.floor(accountGrowthPercent / MILESTONE_STEP) * MILESTONE_STEP);
    const priorMilestone = number(milestoneRecord.highestMilestonePercent);

    milestoneRecord.accountLabel = accountLabel;
    milestoneRecord.accountNumber = String(snapshot.accountNumber || milestoneRecord.accountNumber || '');
    milestoneRecord.currentEquity = currentEquity;
    milestoneRecord.currentBalance = currentBalance;
    milestoneRecord.floatingPL = floatingPL;
    milestoneRecord.growthPercent = accountGrowthPercent;
    milestoneRecord.highestEquity = Math.max(number(milestoneRecord.highestEquity, currentEquity), currentEquity);
    milestoneRecord.lastSeenAt = now;

    milestoneRecord.pendingMilestones = Array.isArray(milestoneRecord.pendingMilestones)
      ? milestoneRecord.pendingMilestones.filter((item) => number(item?.milestonePercent) > number(milestoneRecord.acknowledgedMilestonePercent))
      : [];
    if (reachedMilestone > priorMilestone) {
      const crossedMilestones = Array.from(
        { length: Math.floor((reachedMilestone - priorMilestone) / MILESTONE_STEP) },
        (_, index) => priorMilestone + ((index + 1) * MILESTONE_STEP),
      );
      const pendingPercents = new Set(milestoneRecord.pendingMilestones.map((item) => number(item?.milestonePercent)));
      for (const milestonePercent of crossedMilestones) {
        if (milestonePercent <= number(milestoneRecord.acknowledgedMilestonePercent) || pendingPercents.has(milestonePercent)) continue;
        milestoneRecord.pendingMilestones.push({
          milestonePercent,
          message: growthMessage(milestonePercent, accountLabel),
          reachedAt: now,
          accountId: resolvedAccountId,
          accountLabel,
          accountNumber: String(snapshot.accountNumber || milestoneRecord.accountNumber || ''),
          baselineEquity: milestoneRecord.baselineEquity,
          currentEquity,
          currentBalance,
          floatingPL,
          growthPercent: accountGrowthPercent,
        });
      }
      milestoneRecord.pendingMilestones.sort((a, b) => number(a.milestonePercent) - number(b.milestonePercent));
      milestoneRecord.highestMilestonePercent = reachedMilestone;
      milestoneRecord.lastMilestoneAt = now;
      milestoneRecord.lastMessage = growthMessage(reachedMilestone, accountLabel);
      events.push({
        type: 'growth_milestone',
        discordUserId,
        accountId: resolvedAccountId,
        accountLabel,
        milestonePercent: reachedMilestone,
        crossedMilestones,
        baselineEquity: milestoneRecord.baselineEquity,
        currentEquity,
        currentBalance,
        floatingPL,
        growthPercent: accountGrowthPercent,
        message: milestoneRecord.lastMessage,
        timestamp: now,
      });
    }

    data.growthMilestonesByAccountId[milestoneKey] = milestoneRecord;
    await this.save(data);
    return events;
  }

  async getRankStatus(discordUserId) {
    const data = await this.load();
    const record = data.ranksByUserId[discordUserId] || null;
    if (!record) return null;
    return { ...record, currentRank: getRankByKey(record.currentRankKey), nextRank: getNextRank(record.currentRankKey) };
  }

  async getRecognitionStatus(discordUserId, accountId = null) {
    const data = await this.load();
    const prefix = `${String(discordUserId || '')}:`;
    const accounts = Object.values(data.growthMilestonesByAccountId || {})
      .filter((record) => String(record.discordUserId || '') === String(discordUserId || ''))
      .filter((record) => !accountId || String(record.accountId || '') === String(accountId))
      .map((record) => {
        const queued = Array.isArray(record.pendingMilestones)
          ? record.pendingMilestones
            .filter((item) => number(item?.milestonePercent) > number(record.acknowledgedMilestonePercent))
            .sort((a, b) => number(a.milestonePercent) - number(b.milestonePercent))
          : [];
        const fallbackPending = number(record.highestMilestonePercent) > number(record.acknowledgedMilestonePercent)
          ? {
              milestonePercent: number(record.highestMilestonePercent),
              message: record.lastMessage || growthMessage(number(record.highestMilestonePercent), record.accountLabel),
              reachedAt: record.lastMilestoneAt || record.lastSeenAt,
              accountId: record.accountId,
              accountLabel: record.accountLabel,
              accountNumber: record.accountNumber,
              baselineEquity: record.baselineEquity,
              currentEquity: record.currentEquity,
              currentBalance: record.currentBalance,
              floatingPL: record.floatingPL,
              growthPercent: record.growthPercent,
            }
          : null;
        return { ...record, pendingMilestone: queued[0] || fallbackPending };
      })
      .sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0));
    return {
      discordUserId: String(discordUserId || ''),
      rank: await this.getRankStatus(discordUserId),
      accounts,
      selected: accountId ? accounts.find((record) => String(record.accountId) === String(accountId)) || null : accounts[0] || null,
      keyPrefix: prefix,
    };
  }

  async acknowledgeGrowthMilestone(discordUserId, accountId, milestonePercent) {
    const data = await this.load();
    const key = accountGrowthKey(discordUserId, accountId);
    const record = data.growthMilestonesByAccountId[key];
    if (!record) return null;
    record.acknowledgedMilestonePercent = Math.max(number(record.acknowledgedMilestonePercent), Math.min(number(milestonePercent), number(record.highestMilestonePercent)));
    record.pendingMilestones = Array.isArray(record.pendingMilestones)
      ? record.pendingMilestones.filter((item) => number(item?.milestonePercent) > record.acknowledgedMilestonePercent)
      : [];
    record.acknowledgedAt = nowIso();
    await this.save(data);
    return record;
  }
}

function getRankForGrowth(growthPercent) {
  let selected = RANKS[0];
  for (const rank of RANKS) if (growthPercent >= rank.minGrowth) selected = rank;
  return selected;
}
function getRankByKey(key) { return RANKS.find((rank) => rank.key === key) || RANKS[0]; }
function getNextRank(key) { const index = rankIndex(key); return RANKS[Math.min(index + 1, RANKS.length - 1)] || RANKS[RANKS.length - 1]; }
function rankIndex(key) { return Math.max(0, RANKS.findIndex((rank) => rank.key === key)); }
