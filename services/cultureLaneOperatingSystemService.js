import { randomUUID } from 'node:crypto';

function nowIso() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}_${Date.now()}_${randomUUID().slice(0, 8)}`; }
function clean(value) { return String(value ?? '').trim(); }
function number(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, number(value, min))); }
function normalizeSymbol(value = '') { return clean(value).toUpperCase().replace(/[^A-Z0-9._-]/g, ''); }
function unique(values = []) { return [...new Set(values.map(clean).filter(Boolean))]; }

export function ensureCultureLaneState(state = {}) {
  state.cultureLanesById ||= {};
  state.brokerSymbolInventoriesByAccountId ||= {};
  state.symbolPoliciesByLaneId ||= {};
  state.harvestPoliciesByLaneId ||= {};
  state.harvestCyclesById ||= {};
  state.tradePassportsById ||= {};
  state.laneTimelineEventsById ||= {};
  state.laneGenomesById ||= {};
  state.laneDnaSnapshotsById ||= {};
  state.cultureIntelligenceReportsById ||= {};
  return state;
}

export function laneAccessibleTo(lane = {}, userId = '') {
  const uid = clean(userId);
  return clean(lane.ownerUserId || lane.owner_user_id) === uid || (lane.adminUserIds || []).map(clean).includes(uid);
}

export function createCultureLane(state, userId, input = {}) {
  ensureCultureLaneState(state);
  const laneId = clean(input.laneId || input.id) || id('lane');
  const leaderAccountId = clean(input.leaderAccountId || input.masterAccountId || input.master_id);
  const followerAccountIds = unique(input.followerAccountIds || input.receiverAccountIds || input.slaveAccountIds || []);
  if (!leaderAccountId) throw new Error('leaderAccountId is required.');
  if (!followerAccountIds.length) throw new Error('At least one follower account is required.');
  const lane = {
    laneId,
    ownerUserId: clean(userId),
    name: clean(input.name) || `Culture Lane ${Object.keys(state.cultureLanesById).length + 1}`,
    description: clean(input.description),
    profile: clean(input.profile) || 'custom',
    leaderAccountId,
    followerAccountIds,
    accountIds: unique([leaderAccountId, ...followerAccountIds]),
    status: clean(input.status) || 'paused',
    executionStatus: 'awaiting_health',
    riskBudget: input.riskBudget || {},
    notificationPolicy: input.notificationPolicy || {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  state.cultureLanesById[laneId] = lane;
  appendLaneTimelineEvent(state, laneId, 'lane.created', { userId: clean(userId), lane });
  createLaneGenome(state, laneId, userId, { reason: 'initial_lane_configuration' });
  return lane;
}

export function updateCultureLane(state, laneId, userId, patch = {}) {
  ensureCultureLaneState(state);
  const lane = state.cultureLanesById[clean(laneId)];
  if (!lane || !laneAccessibleTo(lane, userId)) return null;
  const allowed = ['name', 'description', 'profile', 'status', 'riskBudget', 'notificationPolicy'];
  for (const key of allowed) if (patch[key] !== undefined) lane[key] = patch[key];
  if (patch.leaderAccountId) lane.leaderAccountId = clean(patch.leaderAccountId);
  if (patch.followerAccountIds) lane.followerAccountIds = unique(patch.followerAccountIds);
  lane.accountIds = unique([lane.leaderAccountId, ...(lane.followerAccountIds || [])]);
  lane.updatedAt = nowIso();
  appendLaneTimelineEvent(state, lane.laneId, 'lane.updated', { userId: clean(userId), changedKeys: Object.keys(patch) });
  createLaneGenome(state, lane.laneId, userId, { reason: clean(patch.reason) || 'lane_updated' });
  return lane;
}

export function upsertBrokerSymbolInventory(state, userId, accountId, input = {}) {
  ensureCultureLaneState(state);
  const symbols = Array.isArray(input.symbols) ? input.symbols : [];
  const normalized = symbols.map((item) => {
    const source = typeof item === 'string' ? { symbol: item } : item || {};
    return {
      symbol: normalizeSymbol(source.symbol || source.name),
      digits: number(source.digits, null), point: number(source.point, null), contractSize: number(source.contractSize, null),
      minLot: number(source.minLot, null), maxLot: number(source.maxLot, null), lotStep: number(source.lotStep, null),
      tradeAllowed: source.tradeAllowed !== false, session: source.session || null, assetClass: clean(source.assetClass),
    };
  }).filter((item) => item.symbol);
  const record = {
    accountId: clean(accountId), ownerUserId: clean(userId), broker: clean(input.broker), server: clean(input.server),
    symbols: normalized, symbolCount: normalized.length, reporterVersion: clean(input.reporterVersion), receivedAt: nowIso(),
  };
  state.brokerSymbolInventoriesByAccountId[record.accountId] = record;
  return record;
}

export function setLaneSymbolPolicy(state, laneId, userId, input = {}) {
  ensureCultureLaneState(state);
  const lane = state.cultureLanesById[clean(laneId)];
  if (!lane || !laneAccessibleTo(lane, userId)) return null;
  const aliases = {};
  for (const [leader, follower] of Object.entries(input.aliases || input.symbolMapping || {})) {
    const a = normalizeSymbol(leader); const b = normalizeSymbol(follower);
    if (a && b) aliases[a] = b;
  }
  const policy = {
    laneId: lane.laneId,
    autoMatch: input.autoMatch !== false,
    aliases,
    allowedSymbols: unique(input.allowedSymbols || []).map(normalizeSymbol),
    blockedSymbols: unique(input.blockedSymbols || []).map(normalizeSymbol),
    blockedAssetClasses: unique(input.blockedAssetClasses || []),
    perSymbolLotMultiplier: input.perSymbolLotMultiplier || {},
    perSymbolMaxExposure: input.perSymbolMaxExposure || {},
    missingSymbolBehavior: clean(input.missingSymbolBehavior) || 'skip_and_notify',
    updatedByUserId: clean(userId), updatedAt: nowIso(),
  };
  state.symbolPoliciesByLaneId[lane.laneId] = policy;
  appendLaneTimelineEvent(state, lane.laneId, 'symbol_policy.updated', { userId: clean(userId), policy });
  createLaneGenome(state, lane.laneId, userId, { reason: 'symbol_policy_updated' });
  return policy;
}

export function resolveLaneSymbol(state, laneId, accountId, leaderSymbol) {
  ensureCultureLaneState(state);
  const leader = normalizeSymbol(leaderSymbol);
  const policy = state.symbolPoliciesByLaneId[clean(laneId)] || { autoMatch: true, aliases: {} };
  if ((policy.blockedSymbols || []).includes(leader)) return { eligible: false, reason: 'blocked_symbol', leaderSymbol: leader };
  if ((policy.allowedSymbols || []).length && !(policy.allowedSymbols || []).includes(leader)) return { eligible: false, reason: 'symbol_not_allowed', leaderSymbol: leader };
  const inventory = state.brokerSymbolInventoriesByAccountId[clean(accountId)];
  const offered = new Set((inventory?.symbols || []).filter((item) => item.tradeAllowed !== false).map((item) => item.symbol));
  const explicit = normalizeSymbol(policy.aliases?.[leader]);
  const autoCandidates = policy.autoMatch === false ? [] : [leader.replace('SPXUSD', 'US500'), leader.replace('NASUSD', 'NAS100'), leader.replace('XAUUSD', 'GOLD')];
  const candidates = unique([leader, explicit, ...autoCandidates]).filter(Boolean);
  const followerSymbol = candidates.find((candidate) => offered.has(candidate)) || (!inventory && explicit) || (!inventory && leader);
  if (!followerSymbol) return { eligible: false, reason: 'no_compatible_symbol', leaderSymbol: leader, accountId: clean(accountId), candidates };
  return { eligible: true, leaderSymbol: leader, followerSymbol, translated: followerSymbol !== leader, accountId: clean(accountId), candidates };
}

export function setHarvestPolicy(state, laneId, userId, input = {}) {
  ensureCultureLaneState(state);
  const lane = state.cultureLanesById[clean(laneId)];
  if (!lane || !laneAccessibleTo(lane, userId)) return null;
  const policy = {
    laneId: lane.laneId,
    enabled: input.enabled !== false,
    mode: clean(input.mode) || 'harvest_once',
    goalType: clean(input.goalType) || 'percent_gain',
    goalValue: Math.max(0, number(input.goalValue, 2)),
    referencePoint: clean(input.referencePoint) || 'start_of_day_balance',
    intelligent: input.intelligent === true,
    trailRetracePercent: clamp(input.trailRetracePercent ?? 0.5, 0.05, 25),
    resumeAfterHarvest: input.resumeAfterHarvest === true || clean(input.mode) === 'harvest_and_continue',
    stairSteps: (input.stairSteps || []).map((value) => Math.max(0, number(value))).filter(Boolean),
    hardDrawdownLimitPercent: input.hardDrawdownLimitPercent == null ? null : clamp(input.hardDrawdownLimitPercent, 0, 100),
    updatedByUserId: clean(userId), updatedAt: nowIso(),
  };
  state.harvestPoliciesByLaneId[lane.laneId] = policy;
  appendLaneTimelineEvent(state, lane.laneId, 'harvest_policy.updated', { userId: clean(userId), policy });
  createLaneGenome(state, lane.laneId, userId, { reason: 'harvest_policy_updated' });
  return policy;
}

function accountMetrics(state, accountId) {
  const account = state.tradingAccounts?.[accountId] || {};
  const telemetry = state.accountTelemetry?.[accountId] || {};
  const snapshot = telemetry.latest || telemetry.snapshot || account.snapshot || account;
  return {
    accountId,
    balance: number(snapshot.balance ?? account.balance),
    equity: number(snapshot.equity ?? account.equity ?? snapshot.balance ?? account.balance),
    floatingProfit: number(snapshot.floatingPL ?? snapshot.floating_profit ?? account.floatingPL),
    closedProfit: number(snapshot.closedProfitToday ?? snapshot.dailyClosedProfit ?? account.dailyProfit),
    openTrades: number(snapshot.openTradeCount ?? account.openTrades),
    connected: Boolean(account.reporter_connected || account.status === 'connected' || telemetry.receivedAt),
    lastSyncAt: telemetry.receivedAt || account.last_sync_at || account.updated_at || null,
  };
}

export function computeCultureLaneVault(state, laneId, userId) {
  ensureCultureLaneState(state);
  const lane = state.cultureLanesById[clean(laneId)];
  if (!lane || !laneAccessibleTo(lane, userId)) return null;
  const accounts = (lane.accountIds || []).map((accountId) => accountMetrics(state, accountId));
  const balance = accounts.reduce((sum, item) => sum + item.balance, 0);
  const equity = accounts.reduce((sum, item) => sum + item.equity, 0);
  const floatingProfit = accounts.reduce((sum, item) => sum + item.floatingProfit, 0);
  const closedProfit = accounts.reduce((sum, item) => sum + item.closedProfit, 0);
  const openTrades = accounts.reduce((sum, item) => sum + item.openTrades, 0);
  const disconnected = accounts.filter((item) => !item.connected).map((item) => item.accountId);
  const peakEquity = number(lane.peakEquity, equity);
  const calculatedPeakEquity = Math.max(peakEquity, equity);
  const drawdown = calculatedPeakEquity > 0 ? ((calculatedPeakEquity - equity) / calculatedPeakEquity) * 100 : 0;
  const executionStatus = disconnected.length ? (disconnected.length === accounts.length ? 'offline' : 'partially_disconnected') : 'healthy';
  const policy = state.harvestPoliciesByLaneId[lane.laneId] || null;
  return {
    laneId: lane.laneId, name: lane.name, status: lane.status, executionStatus,
    balance, equity, floatingProfit, closedProfit, combinedProfit: floatingProfit + closedProfit,
    dailyReturnPercent: balance > 0 ? ((closedProfit + floatingProfit) / balance) * 100 : 0,
    currentDrawdownPercent: Math.max(0, drawdown), peakEquity: calculatedPeakEquity, openTrades,
    connectedAccounts: accounts.length - disconnected.length, totalAccounts: accounts.length, disconnectedAccountIds: disconnected,
    accounts, harvestPolicy: policy, harvestCount: Object.values(state.harvestCyclesById).filter((cycle) => cycle.laneId === lane.laneId && cycle.status === 'completed').length,
    calculatedAt: nowIso(),
  };
}

export function evaluateLaneHarvest(state, laneId, userId) {
  const vault = computeCultureLaneVault(state, laneId, userId);
  if (!vault) return null;
  const policy = state.harvestPoliciesByLaneId[clean(laneId)] || { enabled: false };
  if (!policy.enabled) return { triggered: false, reason: 'disabled', vault, policy };
  let current = 0;
  if (policy.goalType === 'dollar_gain') current = vault.combinedProfit;
  else if (policy.goalType === 'equity_target') current = vault.equity;
  else if (policy.goalType === 'balance_target') current = vault.balance;
  else if (policy.goalType === 'floating_profit') current = vault.floatingProfit;
  else if (policy.goalType === 'closed_profit') current = vault.closedProfit;
  else current = vault.dailyReturnPercent;
  const triggered = current >= number(policy.goalValue);
  return { triggered, current, target: number(policy.goalValue), progressPercent: policy.goalValue > 0 ? clamp((current / policy.goalValue) * 100, 0, 999) : 0, vault, policy };
}

export function createHarvestCycle(state, laneId, userId, evaluation, commandIds = []) {
  ensureCultureLaneState(state);
  const cycle = {
    cycleId: id('harvest'), laneId: clean(laneId), requestedByUserId: clean(userId), status: commandIds.length ? 'commands_queued' : 'triggered',
    goalType: evaluation.policy.goalType, goalValue: evaluation.policy.goalValue, achievedValue: evaluation.current,
    commandIds, accountIds: evaluation.vault.accounts.map((item) => item.accountId), createdAt: nowIso(), updatedAt: nowIso(),
  };
  state.harvestCyclesById[cycle.cycleId] = cycle;
  appendLaneTimelineEvent(state, laneId, 'harvest.triggered', { cycle });
  return cycle;
}

export function appendLaneTimelineEvent(state, laneId, eventType, payload = {}) {
  ensureCultureLaneState(state);
  const event = { eventId: id('timeline'), laneId: clean(laneId), eventType: clean(eventType) || 'system.event', payload, createdAt: nowIso() };
  state.laneTimelineEventsById[event.eventId] = event;
  return event;
}

export function createTradePassport(state, laneId, userId, input = {}) {
  ensureCultureLaneState(state);
  const lane = state.cultureLanesById[clean(laneId)];
  if (!lane || !laneAccessibleTo(lane, userId)) return null;
  const passport = {
    passportId: clean(input.passportId) || id('passport'), laneId: lane.laneId, status: 'open',
    leaderOrder: input.leaderOrder || {}, followerOrders: input.followerOrders || [], symbolTranslations: input.symbolTranslations || [],
    lotTransformations: input.lotTransformations || [], riskCalculations: input.riskCalculations || [], acknowledgements: input.acknowledgements || [],
    harvestCycleId: clean(input.harvestCycleId), genomeId: clean(input.genomeId || lane.currentGenomeId), createdByUserId: clean(userId), createdAt: nowIso(), finalizedAt: null,
  };
  state.tradePassportsById[passport.passportId] = passport;
  appendLaneTimelineEvent(state, lane.laneId, 'passport.created', { passportId: passport.passportId });
  return passport;
}

export function finalizeTradePassport(state, passportId, userId, result = {}) {
  ensureCultureLaneState(state);
  const passport = state.tradePassportsById[clean(passportId)];
  const lane = passport && state.cultureLanesById[passport.laneId];
  if (!passport || !lane || !laneAccessibleTo(lane, userId) || passport.status === 'finalized') return null;
  passport.status = 'finalized';
  passport.result = result;
  passport.finalizedAt = nowIso();
  appendLaneTimelineEvent(state, passport.laneId, 'passport.finalized', { passportId: passport.passportId, result });
  return passport;
}

export function createLaneGenome(state, laneId, userId, input = {}) {
  ensureCultureLaneState(state);
  const lane = state.cultureLanesById[clean(laneId)];
  if (!lane || !laneAccessibleTo(lane, userId)) return null;
  const previous = Object.values(state.laneGenomesById).filter((item) => item.laneId === lane.laneId).sort((a, b) => b.sequence - a.sequence)[0];
  const genome = {
    genomeId: id('genome'), laneId: lane.laneId, sequence: number(previous?.sequence, 0) + 1,
    version: `v1.${number(previous?.sequence, 0)}`, reason: clean(input.reason) || 'manual_snapshot',
    configuration: {
      profile: lane.profile, riskBudget: lane.riskBudget, accountIds: lane.accountIds,
      symbolPolicy: state.symbolPoliciesByLaneId[lane.laneId] || null,
      harvestPolicy: state.harvestPoliciesByLaneId[lane.laneId] || null,
      notificationPolicy: lane.notificationPolicy || {},
    },
    approvedByUserId: clean(userId), effectiveAt: nowIso(), createdAt: nowIso(),
  };
  state.laneGenomesById[genome.genomeId] = genome;
  lane.currentGenomeId = genome.genomeId;
  return genome;
}

export function calculateLaneDna(state, laneId, userId) {
  const vault = computeCultureLaneVault(state, laneId, userId);
  if (!vault) return null;
  const passports = Object.values(state.tradePassportsById || {}).filter((item) => item.laneId === laneId && item.status === 'finalized');
  const harvests = Object.values(state.harvestCyclesById || {}).filter((item) => item.laneId === laneId);
  const sample = Math.max(1, passports.length);
  const wins = passports.filter((item) => number(item.result?.profit) > 0).length;
  const averageHoldMinutes = passports.reduce((sum, item) => sum + number(item.result?.durationMinutes), 0) / sample;
  const dna = {
    snapshotId: id('dna'), laneId: clean(laneId), aggression: clamp(vault.openTrades * 8 + vault.currentDrawdownPercent * 2, 0, 100),
    patience: clamp(100 - Math.min(100, averageHoldMinutes / 3), 0, 100), averageHoldMinutes,
    harvestAccuracy: harvests.length ? clamp((harvests.filter((item) => ['completed', 'commands_queued'].includes(item.status)).length / harvests.length) * 100, 0, 100) : 0,
    executionHealth: vault.totalAccounts ? (vault.connectedAccounts / vault.totalAccounts) * 100 : 0,
    winRate: passports.length ? (wins / passports.length) * 100 : 0,
    riskProfile: vault.currentDrawdownPercent > 15 ? 'aggressive' : vault.currentDrawdownPercent > 7 ? 'balanced' : 'controlled',
    sampleSize: passports.length, confidence: clamp(passports.length * 5, 5, 100), createdAt: nowIso(),
  };
  state.laneDnaSnapshotsById[dna.snapshotId] = dna;
  return dna;
}

export function buildCultureIntelligenceReport(state, laneId, userId) {
  const vault = computeCultureLaneVault(state, laneId, userId);
  if (!vault) return null;
  const dna = calculateLaneDna(state, laneId, userId);
  const observations = [];
  if (vault.disconnectedAccountIds.length) observations.push(`${vault.disconnectedAccountIds.length} account(s) are disconnected or stale.`);
  if (vault.currentDrawdownPercent >= 10) observations.push(`Lane drawdown is ${vault.currentDrawdownPercent.toFixed(2)}%.`);
  if (vault.combinedProfit > 0) observations.push(`Combined closed and floating profit is ${vault.combinedProfit.toFixed(2)}.`);
  if (!observations.length) observations.push('Lane telemetry is stable, but more finalized Trade Passports are needed for high-confidence recommendations.');
  const recommendations = [];
  if (vault.disconnectedAccountIds.length) recommendations.push({ type: 'reliability', text: 'Restore Reporter heartbeats before enabling automated Harvest execution.', autoApply: false });
  if (dna.confidence < 50) recommendations.push({ type: 'data_quality', text: 'Collect more finalized Trade Passports before changing risk or symbol allocation.', autoApply: false });
  const report = {
    reportId: id('intel'), laneId: clean(laneId), period: 'current', observations, recommendations,
    vaultSnapshot: vault, dnaSnapshotId: dna.snapshotId, generatedAt: nowIso(), generatedForUserId: clean(userId),
  };
  state.cultureIntelligenceReportsById[report.reportId] = report;
  appendLaneTimelineEvent(state, laneId, 'intelligence.generated', { reportId: report.reportId });
  return report;
}
