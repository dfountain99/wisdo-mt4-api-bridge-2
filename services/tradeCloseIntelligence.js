import crypto from 'node:crypto';

const CLOSE_COMMANDS = new Set([
  'CLOSE_ALL_TRADES',
  'CLOSE_ALL_PROFITS',
  'CLOSE_ALL_WINNERS',
  'CLOSE_ALL_LOSERS',
  'EMERGENCY_CLOSE_ALL',
  'COPY_CLOSE_TRADE',
]);

function nowIso() { return new Date().toISOString(); }
function num(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, num(value, min))); }
function id(prefix) { return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }
function tradePnl(trade = {}) { return num(trade.pnl ?? trade.profit) + num(trade.swap) + num(trade.commission); }
function accountBase(account = {}) { return Math.max(1, num(account.equity, num(account.balance, 1))); }
function closedAt(trade = {}) { return new Date(trade.closed_at || trade.closeTime || trade.updated_at || trade.opened_at || 0).getTime(); }
function isoDate(date) { return date.toISOString().slice(0, 10); }

export function isCloseCommand(command = '') {
  return CLOSE_COMMANDS.has(String(command || '').toUpperCase());
}

export function closeModeForCommand(command = '') {
  const normalized = String(command || '').toUpperCase();
  if (['CLOSE_ALL_PROFITS', 'CLOSE_ALL_WINNERS'].includes(normalized)) return 'profitable';
  if (normalized === 'CLOSE_ALL_LOSERS') return 'losing';
  if (normalized === 'COPY_CLOSE_TRADE') return 'ticket';
  return 'all';
}

export function commandForCloseMode(mode = 'all') {
  const normalized = String(mode || '').toLowerCase();
  if (['profit', 'profits', 'profitable', 'winner', 'winners'].includes(normalized)) return 'CLOSE_ALL_PROFITS';
  if (['loss', 'losses', 'losing', 'loser', 'losers'].includes(normalized)) return 'CLOSE_ALL_LOSERS';
  return 'CLOSE_ALL_TRADES';
}

export function closeModeLabel(mode = 'all') {
  return ({ all: 'Close All', profitable: 'Profit Secure', losing: 'Close Losing Only', ticket: 'Ticket Close' })[String(mode || '').toLowerCase()] || 'Close All';
}

export function ensureCloseIntelligenceState(state = {}) {
  state.compoundCloseTrackersById ||= {};
  state.accountControlSettingsById ||= {};
  state.deletedTradingAccounts ||= {};
  state.notificationOutboxById ||= {};
  return state;
}

function periodStats(trades, sinceMs = 0) {
  const closed = trades.filter((trade) => String(trade.status || '').toLowerCase() === 'closed' && closedAt(trade) >= sinceMs);
  const pnls = closed.map(tradePnl);
  const wins = pnls.filter((value) => value > 0);
  const losses = pnls.filter((value) => value < 0);
  const grossProfit = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  return {
    trades: closed.length,
    pnl: pnls.reduce((sum, value) => sum + value, 0),
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    average: closed.length ? pnls.reduce((sum, value) => sum + value, 0) / closed.length : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 9.99 : 0,
  };
}

function buildDailySeries(trades, days = 7) {
  const rows = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const pnl = trades
      .filter((trade) => String(trade.status || '').toLowerCase() === 'closed' && closedAt(trade) >= date.getTime() && closedAt(trade) < next.getTime())
      .reduce((sum, trade) => sum + tradePnl(trade), 0);
    rows.push({ label: isoDate(date), pnl: Number(pnl.toFixed(2)) });
  }
  let cumulative = 0;
  return rows.map((row) => ({ ...row, cumulative: Number((cumulative += row.pnl).toFixed(2)) }));
}

function startOfWeek(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay();
  value.setDate(value.getDate() - ((day + 6) % 7));
  return value;
}

function buildWeeklySeries(trades, weeks = 8) {
  const thisWeek = startOfWeek(new Date());
  const rows = [];
  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const date = new Date(thisWeek);
    date.setDate(date.getDate() - offset * 7);
    const next = new Date(date);
    next.setDate(next.getDate() + 7);
    const pnl = trades
      .filter((trade) => String(trade.status || '').toLowerCase() === 'closed' && closedAt(trade) >= date.getTime() && closedAt(trade) < next.getTime())
      .reduce((sum, trade) => sum + tradePnl(trade), 0);
    rows.push({ label: isoDate(date), pnl: Number(pnl.toFixed(2)) });
  }
  let cumulative = 0;
  return rows.map((row) => ({ ...row, cumulative: Number((cumulative += row.pnl).toFixed(2)) }));
}

function directionScore(stats, base) {
  if (!stats.trades) return 0;
  const pnlPct = (stats.pnl / Math.max(1, base)) * 100;
  const factorTerm = stats.profitFactor > 0 ? Math.log2(Math.min(10, stats.profitFactor) + 1) * 8 : -8;
  return Math.round(clamp(pnlPct * 14 + (stats.winRate - 50) * 0.7 + factorTerm, -100, 100));
}

export function buildTrendAnalytics(state = {}, userId, accountId = '') {
  ensureCloseIntelligenceState(state);
  const uid = String(userId || '');
  const accountKey = String(accountId || '');
  const accounts = Object.values(state.tradingAccounts || {}).filter((account) => String(account.user_id || account.ownerUserId || '') === uid && (!accountKey || String(account.id) === accountKey));
  const accountIds = new Set(accounts.map((account) => String(account.id)));
  const trades = Object.values(state.trades || {}).filter((trade) => String(trade.user_id || '') === uid && (!accountKey || accountIds.has(String(trade.account_id))));
  const base = accounts.reduce((sum, account) => sum + accountBase(account), 0) || 1;
  const now = Date.now();
  const day = periodStats(trades, now - 24 * 60 * 60 * 1000);
  const week = periodStats(trades, now - 7 * 24 * 60 * 60 * 1000);
  const month = periodStats(trades, now - 30 * 24 * 60 * 60 * 1000);
  const all = periodStats(trades, 0);
  const open = trades.filter((trade) => ['open', 'closing'].includes(String(trade.status || '').toLowerCase()));
  const floating = open.reduce((sum, trade) => sum + tradePnl(trade), 0);
  const negativePressure = Math.max(0, -floating / base * 100);
  const telemetry = [...accountIds].flatMap((idValue) => state.accountTelemetry?.[idValue] || []).sort((a, b) => new Date(a.receivedAt || 0) - new Date(b.receivedAt || 0));
  let peak = 0;
  let maxDrawdown = 0;
  for (const point of telemetry) {
    const equity = num(point.equity);
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, ((peak - equity) / peak) * 100);
  }
  const dailySeries = buildDailySeries(trades, 7);
  const weeklySeries = buildWeeklySeries(trades, 8);
  const positiveDays = dailySeries.filter((row) => row.pnl > 0).length;
  const activeDays = dailySeries.filter((row) => row.pnl !== 0).length;
  const consistency = activeDays ? (positiveDays / activeDays) * 100 : 0;
  const compoundScore = Math.round(clamp(
    month.winRate * 0.3 + Math.min(100, month.profitFactor * 25) * 0.25 + consistency * 0.2 + Math.max(0, 100 - maxDrawdown * 5) * 0.25,
    0,
    100,
  ));
  const riskPressure = Math.round(clamp(negativePressure * 8 + maxDrawdown * 4 + Math.min(30, open.length * 2), 0, 100));
  return {
    generatedAt: nowIso(),
    accountId: accountKey || null,
    accountCount: accounts.length,
    daily: day,
    weekly: week,
    monthly: month,
    allTime: all,
    openTradeCount: open.length,
    floatingPnl: Number(floating.toFixed(2)),
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    gauges: {
      dailyTrend: directionScore(day, base),
      weeklyTrend: directionScore(week, base),
      compoundScore,
      winRate: Number(month.winRate.toFixed(1)),
      profitFactor: Number(month.profitFactor.toFixed(2)),
      riskPressure,
      consistency: Number(consistency.toFixed(1)),
    },
    dailySeries,
    weeklySeries,
    dataSource: trades.length || telemetry.length ? 'mt4_reporter_history' : 'waiting_for_mt4_history',
  };
}

export function createCloseTracker(state = {}, { userId, accountId, mode = 'all', commandId = '', requestSource = 'website' } = {}) {
  ensureCloseIntelligenceState(state);
  const tracker = {
    id: id('compound_close'),
    user_id: String(userId || ''),
    account_id: String(accountId || ''),
    mode: String(mode || 'all'),
    label: closeModeLabel(mode),
    command_id: String(commandId || ''),
    status: 'queued',
    request_source: requestSource,
    before: buildTrendAnalytics(state, userId, accountId),
    result: null,
    after: null,
    requested_at: nowIso(),
    completed_at: null,
    updated_at: nowIso(),
  };
  state.compoundCloseTrackersById[tracker.id] = tracker;
  return tracker;
}

export function attachCloseTrackerCommand(state = {}, trackerId, commandId) {
  ensureCloseIntelligenceState(state);
  const tracker = state.compoundCloseTrackersById[String(trackerId || '')];
  if (!tracker) return null;
  tracker.command_id = String(commandId || '');
  tracker.updated_at = nowIso();
  return tracker;
}

export function finalizeCloseTracker(state = {}, { command, result = {}, userId = '', accountId = '' } = {}) {
  ensureCloseIntelligenceState(state);
  if (!command || !isCloseCommand(command.command)) return null;
  const commandId = String(command.id || '');
  const payload = command.payload || {};
  const trackerId = String(payload.compoundTrackerId || '');
  const tracker = (trackerId && state.compoundCloseTrackersById[trackerId]) || Object.values(state.compoundCloseTrackersById).find((row) => String(row.command_id || '') === commandId);
  if (!tracker) return null;
  const success = result?.success !== false;
  tracker.status = success ? 'completed' : 'failed';
  tracker.result = {
    success,
    message: String(result?.message || (success ? 'MT4 completed the close command.' : 'MT4 could not complete the close command.')),
    closedCount: num(result?.closedCount ?? result?.closed ?? result?.processed),
    failedCount: num(result?.failedCount ?? result?.failed),
    realizedPnl: num(result?.realizedPnl ?? result?.profit ?? result?.pnl),
    raw: result,
  };
  tracker.after = buildTrendAnalytics(state, userId || tracker.user_id, accountId || tracker.account_id);
  tracker.completed_at = nowIso();
  tracker.updated_at = tracker.completed_at;
  return tracker;
}

export function listCloseTrackers(state = {}, userId, accountId = '', limit = 20) {
  ensureCloseIntelligenceState(state);
  return Object.values(state.compoundCloseTrackersById)
    .filter((row) => String(row.user_id) === String(userId) && (!accountId || String(row.account_id) === String(accountId)))
    .sort((a, b) => new Date(b.requested_at || 0) - new Date(a.requested_at || 0))
    .slice(0, Math.max(1, Math.min(100, Number(limit) || 20)));
}

export function queueCloseEmail(state = {}, { userId, email, tracker, command, result } = {}) {
  ensureCloseIntelligenceState(state);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@') || !tracker) return null;
  const success = result?.success !== false;
  const subject = `${tracker.label} ${success ? 'completed' : 'failed'} — WISDO`;
  const after = tracker.after || tracker.before || {};
  const summary = `${tracker.label} on account ${tracker.account_id}. ${tracker.result?.message || ''} Daily trend ${after.gauges?.dailyTrend ?? 0}; weekly trend ${after.gauges?.weeklyTrend ?? 0}; compound score ${after.gauges?.compoundScore ?? 0}/100.`;
  const recordId = id('notify');
  state.notificationOutboxById[recordId] = {
    id: recordId,
    channel: 'email',
    to: normalizedEmail,
    userId: String(userId || ''),
    category: 'transactional',
    template: 'mt4_close_intelligence',
    subject,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827"><h1>${subject}</h1><p>${summary}</p><ul><li>Closed: ${tracker.result?.closedCount ?? 0}</li><li>Failed: ${tracker.result?.failedCount ?? 0}</li><li>Realized result: ${tracker.result?.realizedPnl ?? 0}</li><li>Monthly win rate: ${after.gauges?.winRate ?? 0}%</li><li>Risk pressure: ${after.gauges?.riskPressure ?? 0}/100</li></ul><p>Open WISDO to review the attached Compound Tracker analysis and MT4 history.</p><p style="font-size:12px;color:#6b7280">Trading involves risk. This message reports execution and historical analytics; it does not guarantee future results.</p></div>`,
    text: summary,
    dedupeKey: `mt4-close-email:${command?.id || tracker.id}`,
    metadata: { trackerId: tracker.id, commandId: command?.id || '', accountId: tracker.account_id, mode: tracker.mode },
    status: 'pending',
    attempts: 0,
    nextAttemptAt: nowIso(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  return state.notificationOutboxById[recordId];
}

export function closeNotificationText(tracker = {}) {
  const after = tracker.after || tracker.before || {};
  const result = tracker.result || {};
  const icon = result.success === false ? '⚠️' : '✅';
  return [
    `${icon} **${tracker.label || 'Close command'} ${result.success === false ? 'failed' : 'completed'}**`,
    `Account: \`${tracker.account_id || 'unknown'}\``,
    result.message || '',
    `Closed: **${result.closedCount || 0}** · Failed: **${result.failedCount || 0}** · Realized: **${num(result.realizedPnl).toFixed(2)}**`,
    `Daily trend: **${after.gauges?.dailyTrend ?? 0}** · Weekly trend: **${after.gauges?.weeklyTrend ?? 0}** · Compound score: **${after.gauges?.compoundScore ?? 0}/100**`,
  ].filter(Boolean).join('\n');
}
