import crypto from 'node:crypto';

import { computeCultureLaneVault } from './cultureLaneOperatingSystemService.js';

function nowIso() { return new Date().toISOString(); }
function makeId(prefix) { return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`; }
function clean(value = '') { return String(value ?? '').trim(); }
function number(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }

export function ensureWisdoCoachState(state = {}) {
  state.wisdoCoachMessagesById ||= {};
  state.wisdoCoachThreadsById ||= {};
  state.wisdoSharedLearningMemoryById ||= {};
  state.wisdoCoachPreferencesByUserId ||= {};
  state.wisdoAiWorkQueueById ||= {};
  return state;
}

function recentLaneTrades(state, lane, limit = 40) {
  const accountIds = new Set([lane.leaderAccountId, ...(lane.followerAccountIds || [])].map(String));
  return Object.values(state.trades || {})
    .filter((trade) => accountIds.has(String(trade.account_id || trade.accountId || '')))
    .sort((a, b) => new Date(b.close_time || b.updated_at || b.open_time || 0) - new Date(a.close_time || a.updated_at || a.open_time || 0))
    .slice(0, limit);
}

function buildDeterministicInsight({ vault, trades, lane }) {
  const closed = trades.filter((trade) => ['closed', 'complete', 'completed'].includes(String(trade.status || '').toLowerCase()) || trade.close_time);
  const winners = closed.filter((trade) => number(trade.profit) > 0);
  const losers = closed.filter((trade) => number(trade.profit) < 0);
  const symbolStats = new Map();
  for (const trade of closed) {
    const symbol = clean(trade.symbol || 'UNKNOWN').toUpperCase();
    const row = symbolStats.get(symbol) || { symbol, trades: 0, pnl: 0 };
    row.trades += 1;
    row.pnl += number(trade.profit) + number(trade.swap) + number(trade.commission);
    symbolStats.set(symbol, row);
  }
  const symbols = [...symbolStats.values()].sort((a, b) => b.pnl - a.pnl);
  const winRate = closed.length ? (winners.length / closed.length) * 100 : 0;
  const risks = [];
  if (vault.disconnectedAccountIds?.length) risks.push(`${vault.disconnectedAccountIds.length} lane account(s) are not sending fresh data.`);
  if (number(vault.currentDrawdownPercent) >= 10) risks.push(`Current lane drawdown is ${number(vault.currentDrawdownPercent).toFixed(2)}%.`);
  if (number(vault.openTrades) >= 10) risks.push(`The lane is carrying ${number(vault.openTrades)} simultaneous positions.`);
  if (!risks.length) risks.push('No immediate structural warning is visible in the latest lane snapshot.');
  const education = closed.length
    ? `The current sample contains ${closed.length} closed trades with a ${winRate.toFixed(1)}% win rate. Review expectancy and average loss as carefully as win rate.`
    : 'There are not enough confirmed closed trades for a dependable historical lesson yet. Keep the lane on demo until the sample grows.';
  const summary = `${lane.name || 'This Culture Lane'} has combined equity ${number(vault.equity).toFixed(2)}, floating P/L ${number(vault.floatingProfit).toFixed(2)}, and ${number(vault.openTrades)} open trade(s).`;
  return {
    headline: vault.disconnectedAccountIds?.length ? 'WISDO sees a connection risk' : number(vault.combinedProfit) >= 0 ? 'WISDO sees the lane holding positive ground' : 'WISDO sees pressure on the lane',
    summary,
    education,
    risks,
    nextActions: [
      vault.disconnectedAccountIds?.length ? 'Restore every stale connection before relying on automatic Harvest or copy execution.' : 'Confirm the leader and receivers are using the intended symbol and lot policy.',
      symbols.length ? `Review ${symbols[0].symbol}, currently the strongest closed-trade contributor in this sample.` : 'Build a larger confirmed trade sample before changing the lane profile.',
      'Treat this as education and decision support, not a guaranteed trade instruction.',
    ],
    notificationSeverity: vault.disconnectedAccountIds?.length || number(vault.currentDrawdownPercent) >= 10 ? 'warning' : 'info',
    shouldNotify: Boolean(vault.disconnectedAccountIds?.length || number(vault.currentDrawdownPercent) >= 10),
    chatMessage: summary,
    confidence: Math.min(100, Math.max(10, closed.length * 4)),
  };
}

function sharedMemory(state, laneId, limit = 20) {
  const memories = Object.values(state.wisdoSharedLearningMemoryById || {})
    .filter((row) => !row.laneId || String(row.laneId) === String(laneId))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, limit);
  return memories.map((row) => ({ source: row.source, title: row.title, content: row.content, confidence: row.confidence }));
}

function buildGrounding(state, laneId, userId, question = '') {
  ensureWisdoCoachState(state);
  const lane = state.cultureLanesById?.[laneId];
  if (!lane) throw new Error('Culture Lane not found.');
  const vault = computeCultureLaneVault(state, laneId, userId);
  if (!vault) throw new Error('Culture Lane is not accessible.');
  const trades = recentLaneTrades(state, lane);
  const timeline = Object.values(state.laneTimelineEventsById || {})
    .filter((row) => String(row.laneId) === String(laneId))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 25);
  const passports = Object.values(state.tradePassportsById || {})
    .filter((row) => String(row.laneId) === String(laneId))
    .sort((a, b) => new Date(b.finalizedAt || b.createdAt || 0) - new Date(a.finalizedAt || a.createdAt || 0))
    .slice(0, 20);
  return { lane, vault, trades, timeline, passports, sharedMemory: sharedMemory(state, laneId), question: clean(question) };
}

async function requestOpenAiInsight(grounding, { mode = 'snapshot', model = process.env.WISDO_AI_MODEL || 'gpt-5-mini', fetchImpl = fetch } = {}) {
  const apiKey = clean(process.env.OPENAI_API_KEY);
  if (!apiKey) return null;
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      headline: { type: 'string' },
      summary: { type: 'string' },
      education: { type: 'string' },
      risks: { type: 'array', items: { type: 'string' } },
      nextActions: { type: 'array', items: { type: 'string' } },
      notificationSeverity: { type: 'string', enum: ['info', 'warning', 'critical'] },
      shouldNotify: { type: 'boolean' },
      chatMessage: { type: 'string' },
      confidence: { type: 'number' },
    },
    required: ['headline', 'summary', 'education', 'risks', 'nextActions', 'notificationSeverity', 'shouldNotify', 'chatMessage', 'confidence'],
  };
  const instructions = `You are WISDO, an educational multi-account trading operations coach. Analyze only the supplied lane snapshot, confirmed trades, timeline, passports, and shared WISDO learning memory. Explain what is happening in plain language. Teach risk, execution, and market-process concepts. Never promise profit, never invent market facts, never claim a trade will win, and never issue or execute a trade. Clearly separate observation from education and suggestion. The current mode is ${mode}.`;
  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      instructions,
      input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(grounding) }] }],
      text: { format: { type: 'json_schema', name: 'wisdo_lane_coach', strict: true, schema } },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI HTTP ${response.status}`);
  const outputText = payload.output_text || (payload.output || []).flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;
  if (!outputText) throw new Error('WISDO AI returned no structured output.');
  return JSON.parse(outputText);
}

function persistCoachMessage(state, { userId, laneId, mode, question, insight, aiGenerated }) {
  ensureWisdoCoachState(state);
  const id = makeId('coach');
  const record = {
    id,
    userId: clean(userId),
    laneId: clean(laneId),
    mode,
    question: clean(question),
    ...insight,
    aiGenerated: Boolean(aiGenerated),
    createdAt: nowIso(),
  };
  state.wisdoCoachMessagesById[id] = record;
  const memoryId = makeId('memory');
  state.wisdoSharedLearningMemoryById[memoryId] = {
    id: memoryId,
    userId: clean(userId),
    laneId: clean(laneId),
    source: mode === 'academy' ? 'academy_ai' : 'lane_intelligence_ai',
    title: insight.headline,
    content: `${insight.summary}\n${insight.education}`,
    confidence: number(insight.confidence, 25),
    createdAt: nowIso(),
  };
  return record;
}

export async function generateWisdoCoachMessage(state, { userId, laneId, mode = 'snapshot', question = '', fetchImpl = fetch }) {
  const grounding = buildGrounding(state, laneId, userId, question);
  const fallback = buildDeterministicInsight(grounding);
  let insight = fallback;
  let aiGenerated = false;
  try {
    const generated = await requestOpenAiInsight(grounding, { mode, fetchImpl });
    if (generated) { insight = { ...fallback, ...generated }; aiGenerated = true; }
  } catch (error) {
    insight = { ...fallback, aiError: error.message };
  }
  return persistCoachMessage(state, { userId, laneId, mode, question, insight, aiGenerated });
}

export function listWisdoCoachMessages(state, { userId, laneId = '', limit = 50 } = {}) {
  ensureWisdoCoachState(state);
  return Object.values(state.wisdoCoachMessagesById)
    .filter((row) => String(row.userId) === String(userId) && (!laneId || String(row.laneId) === String(laneId)))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, Math.max(1, Math.min(200, number(limit, 50))));
}

export function setWisdoCoachPreferences(state, userId, input = {}) {
  ensureWisdoCoachState(state);
  const current = state.wisdoCoachPreferencesByUserId[userId] || {};
  const row = {
    ...current,
    userId: clean(userId),
    enabled: input.enabled !== false,
    inApp: input.inApp !== false,
    email: Boolean(input.email),
    sms: Boolean(input.sms),
    discordDm: Boolean(input.discordDm),
    minimumSeverity: ['info', 'warning', 'critical'].includes(input.minimumSeverity) ? input.minimumSeverity : (current.minimumSeverity || 'warning'),
    updatedAt: nowIso(),
  };
  state.wisdoCoachPreferencesByUserId[userId] = row;
  return row;
}

export function enqueueCoachNotifications(state, message) {
  ensureWisdoCoachState(state);
  const preferences = state.wisdoCoachPreferencesByUserId?.[message.userId] || {};
  const severityRank = { info: 1, warning: 2, critical: 3 };
  const minimumSeverity = preferences.minimumSeverity || 'warning';
  if (preferences.enabled === false || !message.shouldNotify || (severityRank[message.notificationSeverity] || 1) < (severityRank[minimumSeverity] || 2)) return [];
  const profile = state.profiles?.[message.userId] || {};
  state.notificationOutboxById ||= {};
  const events = [];
  const create = (channel, to) => {
    if (!to) return;
    const id = makeId('notify');
    const record = {
      id,
      channel,
      to,
      userId: message.userId,
      category: 'wisdo_coach',
      template: 'wisdo_lane_coach',
      subject: message.headline,
      html: `<h1>${message.headline}</h1><p>${message.summary}</p><p>${message.education}</p><p>Educational decision support only. Trading involves risk.</p>`,
      text: `${message.headline}\n\n${message.summary}\n\n${message.education}\n\nEducational decision support only. Trading involves risk.`,
      dedupeKey: `coach:${message.id}:${channel}`,
      metadata: { laneId: message.laneId, coachMessageId: message.id, severity: message.notificationSeverity },
      status: 'pending',
      attempts: 0,
      nextAttemptAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.notificationOutboxById[id] = record;
    events.push(record);
  };
  if (preferences.email) create('email', profile.email);
  if (preferences.sms) create('sms', profile.phone || profile.phone_number);
  if (preferences.discordDm && profile.discord_id) create('discord_dm', profile.discord_id);
  return events;
}
