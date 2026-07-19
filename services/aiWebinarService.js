import crypto from 'node:crypto';

export const AI_WEBINAR_VERSION = '1.2.0';
export const AI_WEBINAR_DISCLAIMER = 'WISDO AI Webinar lessons are educational only. Trading involves risk, results are not guaranteed, and the lesson is not individualized financial advice.';

const LEVELS = new Set(['starter', 'foundation', 'intermediate', 'advanced', 'professional']);
const STATUSES = new Set(['draft', 'review', 'approved', 'published', 'archived']);
const CHART_SCENARIOS = new Set(['reversal', 'breakout', 'pullback', 'range', 'invalidation', 'risk-reward']);
const CHART_DIRECTIONS = new Set(['bullish', 'bearish', 'neutral']);
const CHART_INTERVALS = new Set(['1', '3', '5', '15', '30', '45', '60', '120', '180', '240', 'D', 'W', 'M']);

function nowIso() { return new Date().toISOString(); }
function clean(value = '', max = 8000) { return String(value || '').replace(/\u0000/g, '').trim().slice(0, max); }
function list(value, maxItems = 30, maxLength = 1200) {
  const rows = Array.isArray(value) ? value : String(value || '').split(/\r?\n|;/);
  return rows.map((item) => clean(item, maxLength)).filter(Boolean).slice(0, maxItems);
}
function slug(value = '') {
  return clean(value, 180).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || `strategy-${Date.now()}`;
}
function makeId(prefix = 'webinar') { return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }
function clamp(value, min, max, fallback = min) { const number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback; }
function sentence(value = '', fallback = '') { const text = clean(value, 1200) || fallback; return /[.!?]$/.test(text) ? text : `${text}.`; }
function round(value, digits = 2) { const factor = 10 ** digits; return Math.round(Number(value) * factor) / factor; }

function normalizeChartInterval(value = '') {
  const raw = clean(value, 20).toUpperCase().replace(/MINUTES?|MINS?/g, '').replace(/HOURS?|HRS?/g, 'H').trim();
  const aliases = { '1H': '60', '2H': '120', '3H': '180', '4H': '240', '1D': 'D', 'DAILY': 'D', '1W': 'W', 'WEEKLY': 'W', '1M': 'M', 'MONTHLY': 'M' };
  const normalized = aliases[raw] || raw;
  return CHART_INTERVALS.has(normalized) ? normalized : '15';
}
function normalizeTradingViewSymbol(value = '', fallbackMarket = '') {
  const raw = clean(value || fallbackMarket, 80).toUpperCase().replace(/\s+/g, '');
  if (/^[A-Z0-9._-]{1,24}:[A-Z0-9._!-]{1,36}$/.test(raw)) return raw;
  const compact = raw.replace(/[^A-Z0-9]/g, '');
  const aliases = {
    GOLD: 'OANDA:XAUUSD', XAU: 'OANDA:XAUUSD', XAUUSD: 'OANDA:XAUUSD',
    EURUSD: 'OANDA:EURUSD', GBPUSD: 'OANDA:GBPUSD', USDJPY: 'OANDA:USDJPY',
    BTC: 'COINBASE:BTCUSD', BTCUSD: 'COINBASE:BTCUSD', ETH: 'COINBASE:ETHUSD', ETHUSD: 'COINBASE:ETHUSD',
    US30: 'CAPITALCOM:US30', DOW: 'CAPITALCOM:US30', NAS100: 'OANDA:NAS100USD', NQ: 'CME_MINI:NQ1!',
    SPX500: 'OANDA:SPX500USD', SP500: 'OANDA:SPX500USD', ES: 'CME_MINI:ES1!',
  };
  return aliases[compact] || 'OANDA:XAUUSD';
}
function inferScenario(value = '') {
  const text = clean(value, 1000).toLowerCase();
  if (/breakout|break out|neck break/.test(text)) return 'breakout';
  if (/pullback|retracement|retest/.test(text)) return 'pullback';
  if (/range|consolidation|sideways/.test(text)) return 'range';
  if (/invalid|stop|failed setup|fakeout|false break/.test(text)) return 'invalidation';
  if (/risk.?reward|target|take profit/.test(text)) return 'risk-reward';
  return 'reversal';
}
function inferDirection(value = '') {
  const text = clean(value, 1000).toLowerCase();
  if (/bear|sell|short|downtrend/.test(text)) return 'bearish';
  if (/bull|buy|long|uptrend/.test(text)) return 'bullish';
  return 'bullish';
}

function average(values = []) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}
function candleAtr(candles = []) {
  const ranges = candles.map((bar, index) => {
    const previousClose = index ? candles[index - 1].close : bar.open;
    return Math.max(bar.high - bar.low, Math.abs(bar.high - previousClose), Math.abs(bar.low - previousClose));
  }).filter((value) => Number.isFinite(value) && value > 0);
  return average(ranges) || Math.max(0.00001, Math.abs((candles.at(-1)?.close || 1) - (candles[0]?.open || 1)) / Math.max(1, candles.length));
}
function scenarioScore(window = [], scenario = 'reversal', direction = 'bullish') {
  if (window.length < 48) return -Infinity;
  const sign = direction === 'bearish' ? -1 : 1;
  const atr = candleAtr(window);
  const close = (index) => Number(window[Math.max(0, Math.min(window.length - 1, index))]?.close || 0);
  const firstLeg = (close(24) - close(4)) * sign / atr;
  const middleLeg = (close(40) - close(24)) * sign / atr;
  const finalLeg = (close(window.length - 3) - close(40)) * sign / atr;
  const before = window.slice(5, 36);
  const after = window.slice(36);
  const beforeHigh = Math.max(...before.map((bar) => bar.high));
  const beforeLow = Math.min(...before.map((bar) => bar.low));
  const afterHigh = Math.max(...after.map((bar) => bar.high));
  const afterLow = Math.min(...after.map((bar) => bar.low));
  const beforeRange = Math.max(atr, beforeHigh - beforeLow);
  if (scenario === 'breakout') {
    const breakDistance = sign > 0 ? afterHigh - beforeHigh : beforeLow - afterLow;
    const compression = atr / beforeRange;
    return breakDistance / atr + compression * 8 + finalLeg * 0.35;
  }
  if (scenario === 'pullback') return firstLeg - middleLeg + finalLeg;
  if (scenario === 'range') {
    const net = Math.abs(close(window.length - 3) - close(4));
    const touches = window.filter((bar) => Math.abs(bar.high - beforeHigh) <= atr * 0.5 || Math.abs(bar.low - beforeLow) <= atr * 0.5).length;
    return touches * 0.4 + beforeRange / atr - net / atr * 1.5;
  }
  if (scenario === 'invalidation') {
    const falseBreak = sign > 0 ? Math.max(0, afterHigh - beforeHigh) : Math.max(0, beforeLow - afterLow);
    const reversal = sign > 0 ? Math.max(0, beforeHigh - close(window.length - 3)) : Math.max(0, close(window.length - 3) - beforeLow);
    return falseBreak / atr + reversal / atr;
  }
  if (scenario === 'risk-reward') return Math.abs(finalLeg) + Math.abs(firstLeg) * 0.35;
  return -firstLeg + finalLeg * 1.25;
}
function selectHistoricalWindow(candles = [], scenario = 'reversal', direction = 'bullish', count = 64) {
  if (candles.length <= count) return candles.map((bar, index) => ({ ...bar, index }));
  let best = candles.slice(-count);
  let bestScore = -Infinity;
  const step = Math.max(1, Math.floor((candles.length - count) / 80));
  for (let start = 0; start <= candles.length - count; start += step) {
    const window = candles.slice(start, start + count);
    const score = scenarioScore(window, scenario, direction);
    if (score > bestScore) { bestScore = score; best = window; }
  }
  return best.map((bar, index) => ({ ...bar, index, label: bar.label || bar.time || `Bar ${index + 1}` }));
}
function precisionFor(candles = []) {
  const price = Math.abs(Number(candles.at(-1)?.close || 0));
  if (price >= 10000) return 1;
  if (price >= 100) return 2;
  if (price >= 10) return 3;
  return 5;
}
function findConfirmationIndex(candles, scenario, direction, atr) {
  const sign = direction === 'bearish' ? -1 : 1;
  if (scenario === 'breakout' || scenario === 'invalidation') {
    const base = candles.slice(5, 36);
    const high = Math.max(...base.map((bar) => bar.high));
    const low = Math.min(...base.map((bar) => bar.low));
    const found = candles.findIndex((bar, index) => index >= 36 && (sign > 0 ? bar.close > high + atr * 0.1 : bar.close < low - atr * 0.1));
    return found >= 0 ? found : 38;
  }
  const search = candles.slice(20, 46);
  const pivotOffset = direction === 'bearish'
    ? search.reduce((best, bar, index) => bar.high > search[best].high ? index : best, 0)
    : search.reduce((best, bar, index) => bar.low < search[best].low ? index : best, 0);
  const pivot = 20 + pivotOffset;
  for (let index = pivot + 1; index < Math.min(candles.length - 6, pivot + 12); index += 1) {
    const move = (candles[index].close - candles[pivot].close) * sign;
    if (move >= atr * 0.8) return index;
  }
  return Math.min(candles.length - 8, pivot + 5);
}

export function buildTeachingChart({ symbol, market, interval, scenarioType, direction, title, notes = [] } = {}) {
  const tradingViewSymbol = normalizeTradingViewSymbol(symbol, market);
  const safeInterval = normalizeChartInterval(interval);
  const safeScenario = CHART_SCENARIOS.has(clean(scenarioType, 30).toLowerCase()) ? clean(scenarioType, 30).toLowerCase() : inferScenario(title);
  const safeDirection = CHART_DIRECTIONS.has(clean(direction, 30).toLowerCase()) ? clean(direction, 30).toLowerCase() : inferDirection(title);
  return {
    provider: 'real_historical_required',
    simulated: false,
    historical: true,
    dataStatus: 'pending',
    symbol: tradingViewSymbol,
    interval: safeInterval,
    title: clean(title, 180) || `${safeScenario.replace('-', ' ')} historical chart example`,
    scenarioType: safeScenario,
    direction: safeDirection,
    notice: 'WISDO is waiting for verified historical OHLC candles. It will not generate a fake chart.',
    candles: [],
    zones: [],
    levels: [],
    markers: [],
    steps: [],
    notes: list(notes, 6, 300),
  };
}

export function buildHistoricalTeachingChart(plan = {}, marketData = {}) {
  const safeScenario = CHART_SCENARIOS.has(clean(plan.scenarioType, 30).toLowerCase()) ? clean(plan.scenarioType, 30).toLowerCase() : 'reversal';
  const safeDirection = CHART_DIRECTIONS.has(clean(plan.direction, 30).toLowerCase()) ? clean(plan.direction, 30).toLowerCase() : 'bullish';
  const candles = selectHistoricalWindow(marketData.candles || [], safeScenario, safeDirection, 64);
  if (candles.length < 32) throw new Error('At least 32 verified historical candles are required for an AI chart lesson.');
  const atr = candleAtr(candles);
  const digits = precisionFor(candles);
  const price = (value) => round(value, digits);
  const sign = safeDirection === 'bearish' ? -1 : 1;
  const confirmationIndex = findConfirmationIndex(candles, safeScenario, safeDirection, atr);
  const entryIndex = Math.min(candles.length - 6, confirmationIndex + 2);
  const contextStart = Math.max(0, confirmationIndex - 18);
  const contextEnd = Math.min(candles.length - 1, confirmationIndex + 2);
  const context = candles.slice(contextStart, contextEnd + 1);
  const extremeLow = Math.min(...context.map((bar) => bar.low));
  const extremeHigh = Math.max(...context.map((bar) => bar.high));
  const entry = candles[entryIndex].close;
  const stop = safeDirection === 'bearish' ? extremeHigh + atr * 0.25 : extremeLow - atr * 0.25;
  const risk = Math.max(atr * 0.5, Math.abs(entry - stop));
  const target = entry + sign * risk * 2;
  const zoneLow = safeDirection === 'bearish' ? extremeHigh - atr * 1.2 : extremeLow - atr * 0.15;
  const zoneHigh = safeDirection === 'bearish' ? extremeHigh + atr * 0.15 : extremeLow + atr * 1.2;
  const rangeStart = candles[0].time || candles[0].label;
  const rangeEnd = candles.at(-1).time || candles.at(-1).label;
  const scenarioLabel = safeScenario.replace('-', ' ');
  return {
    ...plan,
    provider: marketData.provider || 'historical_market_data',
    simulated: false,
    historical: true,
    dataStatus: 'ready',
    sourceName: marketData.sourceName || marketData.provider || 'Historical market data',
    sourceUrl: marketData.sourceUrl || null,
    providerSymbol: marketData.providerSymbol || plan.symbol,
    exchange: marketData.exchange || null,
    timezone: marketData.timezone || 'UTC',
    fetchedAt: marketData.fetchedAt || nowIso(),
    rangeStart,
    rangeEnd,
    notice: `Real historical example from ${marketData.sourceName || marketData.provider || 'the configured market-data provider'} covering ${rangeStart} through ${rangeEnd}. WISDO annotations are educational observations, not a live signal.`,
    candles,
    zones: [{ fromIndex: contextStart, toIndex: contextEnd, low: price(Math.min(zoneLow, zoneHigh)), high: price(Math.max(zoneLow, zoneHigh)), label: safeDirection === 'bearish' ? 'Observed historical supply area' : 'Observed historical demand area' }],
    levels: [
      { role: 'entry', price: price(entry), label: 'Educational confirmation entry' },
      { role: 'stop', price: price(stop), label: 'Historical-example invalidation' },
      { role: 'target', price: price(target), label: 'Educational 2R projection' },
    ],
    markers: [
      { index: Math.max(0, confirmationIndex - 5), role: 'context', label: 'Historical context' },
      { index: confirmationIndex, role: 'confirmation', label: 'Observed confirmation' },
      { index: entryIndex, role: 'entry', label: 'Educational decision point' },
    ],
    steps: [
      { stepId: 'context', title: '1. Read the real context', fromIndex: Math.max(0, confirmationIndex - 30), toIndex: Math.min(candles.length, confirmationIndex + 3), narration: `Zoom out first. This is a real historical ${scenarioLabel} window. Identify structure before studying the marked area.` },
      { stepId: 'confirmation', title: '2. Zoom into the observed confirmation', fromIndex: Math.max(0, confirmationIndex - 12), toIndex: Math.min(candles.length, confirmationIndex + 10), narration: 'Zoom in on the actual candles around the marked area. Explain what changed and what evidence was still missing before confirmation.' },
      { stepId: 'risk', title: '3. Map invalidation and risk', fromIndex: Math.max(0, entryIndex - 10), toIndex: Math.min(candles.length, entryIndex + 16), narration: 'Use the historical candles to define an educational entry, invalidation, and 2R projection. These levels explain process; they are not a recommendation.' },
      { stepId: 'review', title: '4. Reveal the historical follow-through', fromIndex: Math.max(0, confirmationIndex - 20), toIndex: candles.length, narration: 'Zoom back out and review what actually happened after the decision point. Separate process quality from whether this single example won or lost.' },
    ],
  };
}

export async function hydrateWebinarCharts(webinar = {}, marketDataService) {
  const scenes = Array.isArray(webinar.scenes) ? webinar.scenes : [];
  const cache = new Map();
  for (const scene of scenes) {
    if (!scene.chart) continue;
    const chart = scene.chart;
    const key = `${chart.symbol}|${chart.interval}`;
    try {
      let data = cache.get(key);
      if (!data) {
        data = await marketDataService.getCandles({ symbol: chart.symbol, interval: chart.interval, outputSize: 320 });
        cache.set(key, data);
      }
      scene.chart = buildHistoricalTeachingChart(chart, data);
    } catch (error) {
      scene.chart = {
        ...chart,
        provider: 'real_historical_unavailable',
        simulated: false,
        historical: true,
        dataStatus: 'unavailable',
        dataError: clean(error.message, 1000),
        candles: [], zones: [], levels: [], markers: [], steps: [],
        notice: `${clean(error.message, 700)} Open the Live TradingView view to study the current market. AI Markup stays disabled because WISDO will not invent candles.`,
      };
    }
  }
  return webinar;
}

function normalizeChartPlan(input = {}, context = {}) {
  if (!input && !context.force) return null;
  return buildTeachingChart({
    symbol: input.symbol,
    market: input.market || context.market,
    interval: input.interval || context.interval,
    scenarioType: input.scenarioType || context.scenarioType,
    direction: input.direction || context.direction,
    title: input.title || context.title,
    notes: input.notes || context.notes,
  });
}

export function normalizeStrategyInput(input = {}, previous = {}) {
  const title = clean(input.title ?? previous.title, 180) || 'Untitled WISDO Strategy';
  const statusInput = clean(input.status ?? previous.status, 30).toLowerCase();
  const status = STATUSES.has(statusInput) ? statusInput : (previous.status || 'draft');
  return {
    ...previous,
    strategyId: clean(input.strategyId ?? previous.strategyId, 120) || slug(title),
    slug: slug(input.slug ?? previous.slug ?? title),
    title,
    summary: clean(input.summary ?? previous.summary, 4000),
    audience: clean(input.audience ?? previous.audience, 500) || 'WISDO members',
    level: LEVELS.has(clean(input.level ?? previous.level, 30).toLowerCase()) ? clean(input.level ?? previous.level, 30).toLowerCase() : 'foundation',
    markets: list(input.markets ?? previous.markets, 20, 120),
    timeframes: list(input.timeframes ?? previous.timeframes, 20, 120),
    marketConditions: list(input.marketConditions ?? previous.marketConditions),
    entryRules: list(input.entryRules ?? previous.entryRules),
    confirmationRules: list(input.confirmationRules ?? previous.confirmationRules),
    exitRules: list(input.exitRules ?? previous.exitRules),
    invalidationRules: list(input.invalidationRules ?? previous.invalidationRules),
    riskRules: list(input.riskRules ?? previous.riskRules),
    commonMistakes: list(input.commonMistakes ?? previous.commonMistakes),
    examples: list(input.examples ?? previous.examples, 30, 2400),
    faq: list(input.faq ?? previous.faq, 40, 2400),
    sourceNotes: clean(input.sourceNotes ?? previous.sourceNotes, 24000),
    requiredDisclaimer: clean(input.requiredDisclaimer ?? previous.requiredDisclaimer, 2400) || AI_WEBINAR_DISCLAIMER,
    status,
    version: clean(input.version ?? previous.version, 50) || '1.0',
    allowPersonalizedWebinars: input.allowPersonalizedWebinars == null ? previous.allowPersonalizedWebinars !== false : Boolean(input.allowPersonalizedWebinars),
    updatedAt: nowIso(),
    createdAt: previous.createdAt || nowIso(),
  };
}

export function isPublishedStrategy(strategy = {}) {
  return strategy.status === 'published' && Boolean(strategy.publishedAt);
}

export function publicStrategy(strategy = {}) {
  return {
    strategyId: strategy.strategyId,
    slug: strategy.slug,
    title: strategy.title,
    summary: strategy.summary,
    audience: strategy.audience,
    level: strategy.level,
    markets: strategy.markets || [],
    timeframes: strategy.timeframes || [],
    version: strategy.version,
    publishedAt: strategy.publishedAt || null,
    requiredDisclaimer: strategy.requiredDisclaimer || AI_WEBINAR_DISCLAIMER,
  };
}

function strategyFacts(strategy = {}) {
  if (!strategy?.strategyId) return [];
  return [
    ...list(strategy.marketConditions, 4),
    ...list(strategy.entryRules, 4),
    ...list(strategy.confirmationRules, 3),
    ...list(strategy.exitRules, 4),
    ...list(strategy.invalidationRules, 3),
    ...list(strategy.riskRules, 4),
  ].filter(Boolean);
}

function scene(id, title, narration, bullets = [], visual = 'lesson-board', durationSeconds = 55, chart = null) {
  return {
    sceneId: id,
    title: clean(title, 180),
    narration: sentence(narration),
    bullets: list(bullets, 6, 300),
    visual,
    durationSeconds: clamp(durationSeconds, 20, 180, 55),
    ...(chart ? { chart } : {}),
  };
}

export function buildFallbackWebinar({ question = '', topic = '', level = 'starter', durationMinutes = 8, strategy = null, learnerProfile = null, chartSymbol = '', chartInterval = '' } = {}) {
  const safeLevel = LEVELS.has(level) ? level : 'starter';
  const titleTopic = clean(topic || question, 180) || 'WISDO Trading Foundation';
  const duration = clamp(durationMinutes, 3, 30, 8);
  const facts = strategyFacts(strategy);
  const market = chartSymbol || learnerProfile?.markets?.[0] || strategy?.markets?.[0] || 'XAUUSD';
  const timeframe = chartInterval || strategy?.timeframes?.[0] || '15';
  const strategyTitle = strategy?.title || '';
  const teachingChart = buildTeachingChart({ market, interval: timeframe, scenarioType: inferScenario(`${titleTopic} ${question}`), direction: inferDirection(`${titleTopic} ${question}`), title: `${titleTopic} worked chart example`, seed: `${strategy?.strategyId || 'academy'}:${titleTopic}`, notes: facts.slice(0, 4) });
  const scenes = [
    scene('scene-1', `Welcome: ${titleTopic}`, `This lesson answers: ${question || titleTopic}. It is designed for a ${safeLevel} learner and uses ${market} examples.`, ['What you will learn', 'How to practice safely', 'What not to assume'], 'title-card', 45),
    scene('scene-2', 'Core idea', 'Start with the decision problem, not the indicator. Define what evidence must be visible before an action is considered.', ['Context first', 'Evidence before entry', 'Invalidation must be known'], 'concept-map', 60),
    scene('scene-3', strategyTitle ? `${strategyTitle}: approved framework` : 'Step-by-step framework', strategyTitle ? `This section uses the published ${strategyTitle} strategy version ${strategy.version || '1.0'}.` : 'Use a repeatable process: identify context, wait for confirmation, define risk, execute only in practice mode, and review the outcome.', facts.slice(0, 6).length ? facts.slice(0, 6) : ['Identify market condition', 'Wait for confirmation', 'Define invalidation', 'Size risk before entry'], 'strategy-board', 75),
    scene('scene-4', 'On-chart worked example', `WISDO will open the ${teachingChart.symbol} ${teachingChart.interval} chart, compare the live TradingView view with an AI-marked teaching example, and zoom into context, confirmation, entry, invalidation, and follow-through.`, ['Open the real TradingView chart', 'Zoom into the setup area', 'Mark confirmation and invalidation', 'Review the full move'], 'chart-example', 105, teachingChart),
    scene('scene-5', 'Risk and common mistakes', 'A good explanation is incomplete without risk. The most common mistakes are entering before confirmation, increasing size to recover a loss, ignoring spread or news, and treating a lesson as a guaranteed signal.', strategy?.riskRules?.slice(0, 4) || ['Use controlled practice risk', 'Set a daily stop rule', 'Avoid revenge trading', 'Never assume guaranteed returns'], 'risk-panel', 70),
    scene('scene-6', 'Knowledge check', 'Pause and explain the setup in your own words. What condition must exist, what confirms the idea, and what would prove the idea wrong?', ['Condition', 'Confirmation', 'Invalidation', 'Risk boundary'], 'quiz-card', 55),
    scene('scene-7', 'Next action', 'Replay this lesson, complete the quiz, and practice the process in simulation or paper mode before considering live execution.', ['Save the lesson', 'Take the quiz', 'Practice one example', 'Ask a follow-up question'], 'summary-card', 45),
  ];
  const secondsTarget = duration * 60;
  const currentSeconds = scenes.reduce((sum, item) => sum + item.durationSeconds, 0);
  if (currentSeconds < secondsTarget) scenes[2].durationSeconds = clamp(scenes[2].durationSeconds + (secondsTarget - currentSeconds), 20, 180, 75);
  return {
    title: `${titleTopic} · AI Webinar`,
    subtitle: strategyTitle ? `Taught from approved ${strategyTitle} v${strategy.version || '1.0'} knowledge` : 'Personalized WISDO lesson',
    objective: `Help a ${safeLevel} learner understand ${titleTopic} and practice it safely with on-chart examples.`,
    level: safeLevel,
    estimatedMinutes: duration,
    presenter: 'WISDO AI Educator',
    scenes,
    quiz: [
      { questionId: 'q1', prompt: 'What should come before an entry decision?', options: ['A clear market context and approved confirmation', 'A profit target only', 'A larger lot size', 'A social media opinion'], answerIndex: 0, explanation: 'Context and confirmation come before execution.' },
      { questionId: 'q2', prompt: 'What is invalidation?', options: ['Evidence that proves the trade idea is no longer valid', 'A guaranteed stop-out', 'A reward target', 'A broker login'], answerIndex: 0, explanation: 'Invalidation defines when the original idea is wrong.' },
      { questionId: 'q3', prompt: 'How should a new concept be practiced first?', options: ['Simulation or paper mode', 'Maximum live leverage', 'Without a stop rule', 'By copying every signal'], answerIndex: 0, explanation: 'Practice mode lets the learner test the process without unnecessary live risk.' },
    ],
    takeaway: 'Use evidence, invalidation, controlled practice, and chart review. Do not treat the webinar as a guaranteed trade signal.',
    disclaimer: strategy?.requiredDisclaimer || AI_WEBINAR_DISCLAIMER,
  };
}

export function buildWebinarPrompt({ question, topic, level, durationMinutes, strategy, learnerProfile, course, chartSymbol, chartInterval } = {}) {
  const approvedKnowledge = strategy ? {
    strategyId: strategy.strategyId,
    title: strategy.title,
    version: strategy.version,
    summary: strategy.summary,
    markets: strategy.markets,
    timeframes: strategy.timeframes,
    marketConditions: strategy.marketConditions,
    entryRules: strategy.entryRules,
    confirmationRules: strategy.confirmationRules,
    exitRules: strategy.exitRules,
    invalidationRules: strategy.invalidationRules,
    riskRules: strategy.riskRules,
    commonMistakes: strategy.commonMistakes,
    examples: strategy.examples,
    faq: strategy.faq,
    requiredDisclaimer: strategy.requiredDisclaimer,
  } : null;
  return {
    system: `You are WISDO AI Webinar Director. Create an on-demand educational webinar as strict JSON. Teach clearly for the learner level. Use only the supplied approved strategy knowledge when a strategy is present. Never invent missing strategy rules, reveal protected source code, promise returns, or give personalized live buy/sell instructions. Include risk, invalidation, common mistakes, at least one on-chart worked example, and a quiz. For a chart-example scene, provide only a safe chart plan; WISDO loads verified historical OHLC candles from the configured market-data provider and opens the matching TradingView chart. If real candles are unavailable, WISDO must leave AI Markup disabled instead of inventing data.`,
    user: JSON.stringify({
      requestedQuestion: clean(question, 4000),
      topic: clean(topic, 500),
      level: LEVELS.has(level) ? level : 'starter',
      durationMinutes: clamp(durationMinutes, 3, 30, 8),
      requestedChart: { symbol: normalizeTradingViewSymbol(chartSymbol, learnerProfile?.markets?.[0] || strategy?.markets?.[0] || 'XAUUSD'), interval: normalizeChartInterval(chartInterval || strategy?.timeframes?.[0] || '15') },
      learnerProfile: learnerProfile || null,
      courseContext: course ? { id: course.id, title: course.title, summary: course.summary, objectives: course.objectives } : null,
      approvedStrategyKnowledge: approvedKnowledge,
      outputSchema: {
        title: 'string', subtitle: 'string', objective: 'string', level: 'string', estimatedMinutes: 'number', presenter: 'string',
        scenes: [{ sceneId: 'string', title: 'string', narration: 'string', bullets: ['string'], visual: 'title-card|concept-map|strategy-board|chart-example|risk-panel|quiz-card|summary-card', durationSeconds: 'number 20-180', chart: { symbol: 'TradingView symbol such as OANDA:XAUUSD', interval: '1|5|15|60|240|D', scenarioType: 'reversal|breakout|pullback|range|invalidation|risk-reward', direction: 'bullish|bearish|neutral', title: 'string', notes: ['string'] } }],
        quiz: [{ questionId: 'string', prompt: 'string', options: ['four strings'], answerIndex: 'number 0-3', explanation: 'string' }],
        takeaway: 'string', disclaimer: 'string',
      },
    }),
  };
}

export function normalizeGeneratedWebinar(payload = {}, fallbackInput = {}) {
  const fallback = buildFallbackWebinar(fallbackInput);
  const fallbackMarket = fallbackInput.learnerProfile?.markets?.[0] || fallbackInput.strategy?.markets?.[0] || 'XAUUSD';
  const fallbackInterval = fallbackInput.strategy?.timeframes?.[0] || '15';
  const scenes = Array.isArray(payload.scenes) ? payload.scenes.slice(0, 18).map((item, index) => {
    const visual = clean(item.visual, 50) || 'lesson-board';
    const title = clean(item.title, 180) || `Lesson scene ${index + 1}`;
    const chart = visual === 'chart-example' || item.chart ? normalizeChartPlan(item.chart || {}, {
      force: true,
      market: fallbackMarket,
      interval: fallbackInterval,
      scenarioType: inferScenario(`${title} ${fallbackInput.topic || ''}`),
      direction: inferDirection(`${title} ${fallbackInput.question || ''}`),
      title,
      seed: `${fallbackInput.strategy?.strategyId || 'academy'}:${index}:${title}`,
      notes: item.bullets,
    }) : null;
    return scene(
      clean(item.sceneId, 80) || `scene-${index + 1}`,
      title,
      clean(item.narration, 3000) || fallback.scenes[Math.min(index, fallback.scenes.length - 1)].narration,
      item.bullets,
      visual,
      item.durationSeconds,
      chart,
    );
  }) : fallback.scenes;
  if (!scenes.some((item) => item.chart)) {
    const insertAt = Math.min(3, scenes.length);
    scenes.splice(insertAt, 0, fallback.scenes.find((item) => item.chart));
  }
  const quiz = Array.isArray(payload.quiz) ? payload.quiz.slice(0, 8).map((item, index) => ({
    questionId: clean(item.questionId, 80) || `q${index + 1}`,
    prompt: clean(item.prompt, 800),
    options: list(item.options, 4, 400).slice(0, 4),
    answerIndex: clamp(item.answerIndex, 0, 3, 0),
    explanation: clean(item.explanation, 1000),
  })).filter((item) => item.prompt && item.options.length === 4) : fallback.quiz;
  return {
    title: clean(payload.title, 220) || fallback.title,
    subtitle: clean(payload.subtitle, 500) || fallback.subtitle,
    objective: clean(payload.objective, 1200) || fallback.objective,
    level: LEVELS.has(clean(payload.level, 30).toLowerCase()) ? clean(payload.level, 30).toLowerCase() : fallback.level,
    estimatedMinutes: clamp(payload.estimatedMinutes, 3, 30, fallback.estimatedMinutes),
    presenter: clean(payload.presenter, 120) || 'WISDO AI Educator',
    scenes: scenes.length >= 4 ? scenes : fallback.scenes,
    quiz: quiz.length >= 2 ? quiz : fallback.quiz,
    takeaway: clean(payload.takeaway, 1600) || fallback.takeaway,
    disclaimer: clean(payload.disclaimer, 2400) || fallback.disclaimer,
  };
}

export function createWebinarSession({ userId, request = {}, webinar, provider = 'adaptive_fallback', strategy = null, course = null } = {}) {
  const sessionId = makeId('aiwebinar');
  return {
    sessionId,
    userId: String(userId || ''),
    request: {
      question: clean(request.question, 4000), topic: clean(request.topic, 500), level: clean(request.level, 30) || 'starter', durationMinutes: clamp(request.durationMinutes, 3, 30, 8), chartSymbol: normalizeTradingViewSymbol(request.chartSymbol, strategy?.markets?.[0] || 'XAUUSD'), chartInterval: normalizeChartInterval(request.chartInterval || strategy?.timeframes?.[0] || '15'), strategyId: strategy?.strategyId || null, courseId: course?.id || null,
    },
    webinar,
    provider,
    mediaMode: 'interactive_ai_video_with_real_historical_chart_teacher',
    externalVideo: null,
    progress: { sceneIndex: 0, completed: false, watchedSeconds: 0, quizScore: null, updatedAt: nowIso() },
    questions: [],
    status: 'ready',
    strategy: strategy ? publicStrategy(strategy) : null,
    course: course ? { id: course.id, title: course.title } : null,
    version: AI_WEBINAR_VERSION,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function gradeWebinarQuiz(session = {}, answers = {}) {
  const quiz = session.webinar?.quiz || [];
  let correct = 0;
  const results = quiz.map((item) => {
    const selectedIndex = Number(answers[item.questionId]);
    const passed = selectedIndex === Number(item.answerIndex);
    if (passed) correct += 1;
    return { questionId: item.questionId, selectedIndex, correctIndex: item.answerIndex, correct: passed, explanation: item.explanation };
  });
  const score = quiz.length ? Math.round((correct / quiz.length) * 100) : 0;
  return { score, correct, total: quiz.length, passed: score >= 70, results };
}
