import { ACADEMY_DOMAINS, ACADEMY_LEVELS } from './academyCatalogService.js';

export const EDUCATION_PILLARS = [
  { id: 'trading-academy', title: 'Trading Academy', description: 'Beginner through professional market education, execution, risk, psychology, and research.' },
  { id: 'wisdo-university', title: 'WISDO University', description: 'Command Center, Culture Lanes, Reporter operations, account health, DF Sauce scenarios, and HIGHTOWER operating principles without exposing proprietary source.' },
  { id: 'resource-center', title: 'Resource Center', description: 'Original checklists, worksheets, journals, calculators, glossaries, and study guides.' },
  { id: 'ai-webinar-room', title: 'AI Webinar Room', description: 'On-demand AI video lessons generated from user questions, Academy content, and admin-approved strategy knowledge.' },
];

const RESOURCE_TYPES = [
  ['guide', 'Study Guide', 18],
  ['checklist', 'Decision Checklist', 8],
  ['worksheet', 'Practice Worksheet', 14],
  ['flashcards', 'Flash Card Pack', 10],
  ['journal', 'Journal Template', 12],
  ['cheat-sheet', 'Cheat Sheet', 6],
];

const TOOL_DEFINITIONS = [
  { id: 'position-size', title: 'Position Size Calculator', fields: ['accountBalance', 'riskPercent', 'stopDistance', 'valuePerPoint'], description: 'Size from maximum account loss and invalidation distance.' },
  { id: 'risk-reward', title: 'Risk-to-Reward Calculator', fields: ['entry', 'stop', 'target'], description: 'Compare planned loss distance with planned reward distance.' },
  { id: 'margin', title: 'Margin Calculator', fields: ['contractSize', 'lots', 'price', 'leverage'], description: 'Estimate margin required before broker-specific adjustments.' },
  { id: 'pip-value', title: 'Pip / Point Value Calculator', fields: ['lots', 'valuePerLot'], description: 'Estimate value per pip or point for the selected contract.' },
  { id: 'profit-loss', title: 'Profit and Loss Calculator', fields: ['direction', 'entry', 'exit', 'lots', 'contractSize'], description: 'Estimate gross P/L before spread, commission, swap, and slippage.' },
  { id: 'drawdown', title: 'Drawdown Calculator', fields: ['peakEquity', 'currentEquity'], description: 'Measure decline from the account equity peak and required recovery.' },
  { id: 'compounding', title: 'Compounding Calculator', fields: ['principal', 'ratePercent', 'periods', 'contribution'], description: 'Model hypothetical compounding without implying guaranteed returns.' },
  { id: 'risk-of-ruin', title: 'Risk-of-Ruin Scenario', fields: ['winRate', 'averageWin', 'averageLoss', 'riskPercent'], description: 'Illustrate how expectancy and position risk interact. Educational approximation only.' },
];

const LIVE_LEARNING = [
  { id: 'orientation-ai', type: 'ai-webinar-template', title: 'WISDO Orientation and Safety Setup', level: 'starter', durationMinutes: 8, status: 'on-demand', description: 'Generate a personalized video lesson for account connection, Reporter health, Culture Lane permissions, and emergency controls.' },
  { id: 'candles-ai', type: 'ai-webinar-template', title: 'Candlesticks: Reading Price in Context', level: 'starter', durationMinutes: 10, status: 'on-demand', description: 'Create an AI-led lesson on OHLC, body and wick behavior, context, volatility, and invalidation.' },
  { id: 'risk-ai', type: 'ai-webinar-template', title: 'Risk and Money Management Clinic', level: 'foundation', durationMinutes: 12, status: 'on-demand', description: 'Generate a lesson for position sizing, drawdown, exposure, margin, and household-finance boundaries.' },
  { id: 'automation-ai', type: 'ai-webinar-template', title: 'Automation Reliability Before Optimization', level: 'intermediate', durationMinutes: 12, status: 'on-demand', description: 'Teach idempotency, event ledgers, retries, command completion, close authority, and crash recovery.' },
  { id: 'market-framework-ai', type: 'ai-webinar-template', title: 'Forex and Metals Market Framework', level: 'intermediate', durationMinutes: 10, status: 'on-demand', description: 'Build a reusable lesson for sessions, macro catalysts, liquidity, structure, and execution risk.' },
  { id: 'strategy-ai', type: 'ai-webinar-template', title: 'Approved Strategy Deep Dive', level: 'advanced', durationMinutes: 15, status: 'admin-knowledge', description: 'Generate a versioned AI webinar from an admin-published strategy without inventing missing rules or exposing protected source code.' },
];

function normalize(value = '') { return String(value || '').trim().toLowerCase(); }
function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function round(value, digits = 2) { const factor = 10 ** digits; return Math.round((number(value) + Number.EPSILON) * factor) / factor; }

export function buildResourceCatalog() {
  const rows = [];
  for (const domain of ACADEMY_DOMAINS) {
    for (const [type, typeTitle, minutes] of RESOURCE_TYPES) {
      const level = domain.category === 'Foundations' ? 'starter' : domain.category === 'WISDO Systems' ? 'intermediate' : 'foundation';
      rows.push({
        id: `${domain.id}-${type}`,
        pillar: domain.category === 'WISDO Systems' ? 'wisdo-university' : 'resource-center',
        domainId: domain.id,
        title: `${domain.title}: ${typeTitle}`,
        description: `Original WISDO ${typeTitle.toLowerCase()} covering ${domain.tags.join(', ')}, decision quality, invalidation, risk, and review.`,
        type,
        difficulty: level,
        estimatedMinutes: minutes,
        tags: domain.tags,
        downloadable: ['checklist', 'worksheet', 'journal', 'cheat-sheet'].includes(type),
      });
    }
  }
  return rows;
}

export function searchEducationResources({ query = '', type = '', difficulty = '', domainId = '', page = 1, limit = 30 } = {}) {
  const q = normalize(query);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 30));
  const safePage = Math.max(1, Number(page) || 1);
  let rows = buildResourceCatalog();
  if (q) rows = rows.filter((row) => `${row.title} ${row.description} ${row.tags.join(' ')}`.toLowerCase().includes(q));
  if (type) rows = rows.filter((row) => row.type === type);
  if (difficulty) rows = rows.filter((row) => row.difficulty === difficulty);
  if (domainId) rows = rows.filter((row) => row.domainId === domainId);
  const total = rows.length;
  const start = (safePage - 1) * safeLimit;
  return { total, page: safePage, limit: safeLimit, pages: Math.max(1, Math.ceil(total / safeLimit)), resources: rows.slice(start, start + safeLimit) };
}

export function getEducationHubSummary() {
  const resources = buildResourceCatalog();
  return {
    pillars: EDUCATION_PILLARS,
    courseCount: ACADEMY_DOMAINS.length * ACADEMY_LEVELS.length * 20,
    domainCount: ACADEMY_DOMAINS.length,
    resourceCount: resources.length,
    toolCount: TOOL_DEFINITIONS.length,
    liveLearningCount: LIVE_LEARNING.length,
    resourceTypes: RESOURCE_TYPES.map(([id, title]) => ({ id, title })),
  };
}

export function getTradingTools() { return TOOL_DEFINITIONS; }
export function getLiveLearning() { return LIVE_LEARNING; }

export function calculateTradingTool(toolId, input = {}) {
  const tool = TOOL_DEFINITIONS.find((item) => item.id === toolId);
  if (!tool) throw new Error('Unknown education tool.');
  let result = {};
  if (toolId === 'position-size') {
    const accountBalance = Math.max(0, number(input.accountBalance));
    const riskPercent = Math.max(0, number(input.riskPercent));
    const stopDistance = Math.max(0, number(input.stopDistance));
    const valuePerPoint = Math.max(0, number(input.valuePerPoint));
    const riskAmount = accountBalance * (riskPercent / 100);
    result = { riskAmount: round(riskAmount), lots: stopDistance > 0 && valuePerPoint > 0 ? round(riskAmount / (stopDistance * valuePerPoint), 4) : 0, formula: 'risk amount ÷ (stop distance × point value per lot)' };
  } else if (toolId === 'risk-reward') {
    const entry = number(input.entry); const stop = number(input.stop); const target = number(input.target);
    const risk = Math.abs(entry - stop); const reward = Math.abs(target - entry);
    result = { risk: round(risk, 5), reward: round(reward, 5), ratio: risk > 0 ? round(reward / risk, 2) : 0, formula: 'reward distance ÷ risk distance' };
  } else if (toolId === 'margin') {
    const contractSize = Math.max(0, number(input.contractSize)); const lots = Math.max(0, number(input.lots)); const price = Math.max(0, number(input.price, 1)); const leverage = Math.max(1, number(input.leverage, 1));
    result = { estimatedMargin: round((contractSize * lots * price) / leverage), formula: '(contract size × lots × price) ÷ leverage' };
  } else if (toolId === 'pip-value') {
    result = { valuePerPipOrPoint: round(Math.max(0, number(input.lots)) * Math.max(0, number(input.valuePerLot)), 4), formula: 'lots × value per lot' };
  } else if (toolId === 'profit-loss') {
    const direction = normalize(input.direction) === 'sell' ? -1 : 1; const entry = number(input.entry); const exit = number(input.exit); const lots = Math.max(0, number(input.lots)); const contractSize = Math.max(0, number(input.contractSize, 1));
    result = { grossProfitLoss: round((exit - entry) * direction * lots * contractSize), formula: '(exit − entry) × direction × lots × contract size' };
  } else if (toolId === 'drawdown') {
    const peak = Math.max(0, number(input.peakEquity)); const current = Math.max(0, number(input.currentEquity)); const decline = Math.max(0, peak - current); const drawdownPercent = peak > 0 ? (decline / peak) * 100 : 0; const recoveryPercent = current > 0 ? (decline / current) * 100 : 0;
    result = { decline: round(decline), drawdownPercent: round(drawdownPercent), recoveryPercent: round(recoveryPercent), formula: '(peak − current) ÷ peak' };
  } else if (toolId === 'compounding') {
    const principal = Math.max(0, number(input.principal)); const rate = number(input.ratePercent) / 100; const periods = Math.max(0, Math.min(1200, Math.floor(number(input.periods)))); const contribution = Math.max(0, number(input.contribution)); let value = principal;
    for (let i = 0; i < periods; i += 1) value = value * (1 + rate) + contribution;
    result = { projectedValue: round(value), totalContributions: round(principal + contribution * periods), periods, formula: 'previous value × (1 + rate) + contribution' };
  } else if (toolId === 'risk-of-ruin') {
    const winRate = Math.max(0.01, Math.min(0.99, number(input.winRate) / 100)); const averageWin = Math.max(0, number(input.averageWin)); const averageLoss = Math.max(0.0001, number(input.averageLoss)); const riskPercent = Math.max(0.01, number(input.riskPercent)); const expectancy = winRate * averageWin - (1 - winRate) * averageLoss; const lossUnitsTo50Pct = Math.log(0.5) / Math.log(Math.max(0.0001, 1 - riskPercent / 100));
    result = { expectancy: round(expectancy, 4), approximateConsecutiveLossesToHalf: round(lossUnitsTo50Pct, 1), riskFlag: riskPercent > 3 ? 'high' : riskPercent > 1 ? 'elevated' : 'controlled', formula: 'educational approximation; not a probability guarantee' };
  }
  return { tool, input, result, notice: 'Educational estimate only. Broker specifications, currency conversion, commissions, spread, swap, slippage, taxes, and platform rules can change the actual result.' };
}

export function suggestedQuestionsForPage(page = '/') {
  const path = String(page || '/');
  if (path.includes('/learn') || path.includes('/growth') || path.includes('/webinar')) return ['Build my personal WISDO learning plan.', 'What should I watch first?', 'Explain Reporter versus Copier.', 'Give me a demo-account setup checklist.'];
  if (path.includes('copier')) return ['Why is my Culture Lane not relaying?', 'Explain fixed lot versus equity ratio.', 'What prevents a follower from closing?', 'Show me the copier health checklist.'];
  if (path.includes('accounts')) return ['Why is my Reporter stale?', 'How do lead and receiver capabilities work?', 'What does Expert Enabled mean?', 'Help me pair a new MT4 account.'];
  if (path.includes('trades')) return ['Explain this trade ledger.', 'Why can open trades and closed history disagree?', 'How is net P/L calculated?', 'Show me a trade-review template.'];
  if (path.includes('analyzer')) return ['Explain drawdown and recovery math.', 'What does win rate miss?', 'How do I review expectancy?', 'Why is my equity curve empty?'];
  if (path.includes('education')) return ['Build my first lesson.', 'Quiz me on candlesticks.', 'Teach position sizing step by step.', 'Create a forex and gold study plan.'];
  if (path.includes('affiliate')) return ['Explain activation and commission holds.', 'What is eligible for payout?', 'How do refunds affect commissions?'];
  if (path.includes('settings')) return ['Change my learning preferences.', 'Explain account security.', 'Where do I set my theme?', 'How do I rotate credentials?'];
  return ['Explain this page.', 'What should I do next?', 'Show me account health issues.', 'Open my learning path.'];
}
