import crypto from 'node:crypto';

export const AI_WEBINAR_VERSION = '1.1.0';
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

function hashSeed(value = '') {
  let hash = 2166136261;
  for (const character of String(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
function seededRandom(seedValue = 1) {
  let state = seedValue >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function normalizeChartInterval(value = '') {
  const raw = clean(value, 20).toUpperCase().replace(/MINUTES?|MINS?/g, '').replace(/HOURS?|HRS?/g, 'H').trim();
  const aliases = { '1H': '60', '2H': '120', '3H': '180', '4H': '240', '1D': 'D', 'DAILY': 'D', '1W': 'W', 'WEEKLY': 'W', '1M': 'M', 'MONTHLY': 'M' };
  const normalized = aliases[raw] || raw;
  return CHART_INTERVALS.has(normalized) ? normalized : '15';
}
function normalizeTradingViewSymbol(value = '', fallbackMarket = '') {
  const raw = clean(value || fallbackMarket, 80).toUpperCase().replace(/\s+/g, '');
  if (/^[A-Z0-9._-]{1,24}:[A-Z0-9._-]{1,36}$/.test(raw)) return raw;
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
function chartBase(symbol = '') {
  const compact = String(symbol).split(':').at(-1) || '';
  if (compact.includes('BTC')) return { price: 65000, step: 160, digits: 0 };
  if (compact.includes('ETH')) return { price: 3500, step: 16, digits: 1 };
  if (compact.includes('XAU')) return { price: 2350, step: 2.4, digits: 2 };
  if (compact.includes('JPY')) return { price: 156, step: 0.18, digits: 3 };
  if (compact.includes('EUR') || compact.includes('GBP')) return { price: compact.includes('GBP') ? 1.28 : 1.08, step: 0.0012, digits: 5 };
  if (compact.includes('US30')) return { price: 39000, step: 85, digits: 0 };
  if (compact.includes('NAS') || compact.includes('NQ')) return { price: 20000, step: 48, digits: 1 };
  if (compact.includes('SPX') || compact.includes('ES')) return { price: 5600, step: 11, digits: 1 };
  return { price: 100, step: 0.8, digits: 2 };
}
function inferScenario(value = '') {
  const text = clean(value, 1000).toLowerCase();
  if (/breakout|break out|neck break/.test(text)) return 'breakout';
  if (/pullback|retracement|retest/.test(text)) return 'pullback';
  if (/range|consolidation|sideways/.test(text)) return 'range';
  if (/invalid|stop|failed setup/.test(text)) return 'invalidation';
  if (/risk.?reward|target|take profit/.test(text)) return 'risk-reward';
  return 'reversal';
}
function inferDirection(value = '') {
  const text = clean(value, 1000).toLowerCase();
  if (/bear|sell|short|downtrend/.test(text)) return 'bearish';
  if (/bull|buy|long|uptrend/.test(text)) return 'bullish';
  return 'bullish';
}

export function buildTeachingChart({ symbol, market, interval, scenarioType, direction, title, seed, notes = [] } = {}) {
  const tradingViewSymbol = normalizeTradingViewSymbol(symbol, market);
  const safeInterval = normalizeChartInterval(interval);
  const safeScenario = CHART_SCENARIOS.has(clean(scenarioType, 30).toLowerCase()) ? clean(scenarioType, 30).toLowerCase() : inferScenario(title);
  const safeDirection = CHART_DIRECTIONS.has(clean(direction, 30).toLowerCase()) ? clean(direction, 30).toLowerCase() : inferDirection(title);
  const directionSign = safeDirection === 'bearish' ? -1 : 1;
  const { price: startingPrice, step, digits } = chartBase(tradingViewSymbol);
  const random = seededRandom(hashSeed(`${seed || title || safeScenario}:${tradingViewSymbol}:${safeInterval}`));
  const candles = [];
  let previousClose = startingPrice;
  const count = 64;
  for (let index = 0; index < count; index += 1) {
    let phaseDrift = 0;
    if (safeScenario === 'range') phaseDrift = Math.sin(index / 3.2) * step * 0.42;
    else if (safeScenario === 'breakout') phaseDrift = index < 35 ? Math.sin(index / 3) * step * 0.2 : directionSign * step * (index === 35 ? 1.6 : 0.42);
    else if (safeScenario === 'pullback') phaseDrift = index < 25 ? directionSign * step * 0.30 : index < 39 ? -directionSign * step * 0.34 : directionSign * step * 0.45;
    else if (safeScenario === 'invalidation') phaseDrift = index < 31 ? -directionSign * step * 0.22 : index < 42 ? directionSign * step * 0.28 : -directionSign * step * 0.55;
    else if (safeScenario === 'risk-reward') phaseDrift = index < 28 ? -directionSign * step * 0.20 : directionSign * step * 0.38;
    else phaseDrift = index < 27 ? -directionSign * step * 0.24 : index < 34 ? -directionSign * step * 0.05 : directionSign * step * 0.42;
    const noise = (random() - 0.5) * step * 0.42;
    const open = previousClose;
    const close = Math.max(step * 2, open + phaseDrift + noise);
    const wick = step * (0.28 + random() * 0.45);
    const high = Math.max(open, close) + wick;
    const low = Math.max(step, Math.min(open, close) - wick * (0.8 + random() * 0.45));
    previousClose = close;
    candles.push({ index, label: `Bar ${index + 1}`, open: round(open, digits), high: round(high, digits), low: round(low, digits), close: round(close, digits) });
  }
  const extremeWindow = candles.slice(20, 38);
  const extremeLow = Math.min(...extremeWindow.map((bar) => bar.low));
  const extremeHigh = Math.max(...extremeWindow.map((bar) => bar.high));
  const confirmationIndex = safeScenario === 'breakout' ? 36 : safeScenario === 'pullback' ? 40 : 35;
  const entryIndex = Math.min(count - 12, confirmationIndex + 3);
  const entry = candles[entryIndex].close;
  const stop = safeDirection === 'bearish' ? extremeHigh + step * 0.55 : extremeLow - step * 0.55;
  const risk = Math.max(step, Math.abs(entry - stop));
  const target = entry + directionSign * risk * 2;
  const zoneLow = safeDirection === 'bearish' ? extremeHigh - step * 1.7 : extremeLow - step * 0.15;
  const zoneHigh = safeDirection === 'bearish' ? extremeHigh + step * 0.15 : extremeLow + step * 1.7;
  const price = (value) => round(value, digits);
  const scenarioLabel = safeScenario.replace('-', ' ');
  return {
    provider: 'tradingview_dual_mode',
    simulated: true,
    symbol: tradingViewSymbol,
    interval: safeInterval,
    title: clean(title, 180) || `${scenarioLabel} chart example`,
    scenarioType: safeScenario,
    direction: safeDirection,
    notice: 'The AI markup uses simulated teaching candles. The TradingView tab opens the real market chart for visual comparison; it is not a live trade signal.',
    candles,
    zones: [{ fromIndex: 20, toIndex: 39, low: price(Math.min(zoneLow, zoneHigh)), high: price(Math.max(zoneLow, zoneHigh)), label: safeDirection === 'bearish' ? 'Example supply area' : 'Example demand area' }],
    levels: [
      { role: 'entry', price: price(entry), label: 'Example entry after confirmation' },
      { role: 'stop', price: price(stop), label: 'Example invalidation' },
      { role: 'target', price: price(target), label: 'Example 2R objective' },
    ],
    markers: [
      { index: Math.max(0, confirmationIndex - 5), role: 'context', label: 'Context forms' },
      { index: confirmationIndex, role: 'confirmation', label: 'Confirmation' },
      { index: entryIndex, role: 'entry', label: 'Practice entry' },
    ],
    steps: [
      { stepId: 'context', title: '1. Read context', fromIndex: 4, toIndex: 39, narration: `Zoom out first. Identify the ${scenarioLabel} context and the area where price may require confirmation.` },
      { stepId: 'confirmation', title: '2. Zoom into confirmation', fromIndex: 22, toIndex: 46, narration: 'Now zoom in. Study the candles around the marked area and wait for the lesson confirmation instead of reacting to the first touch.' },
      { stepId: 'risk', title: '3. Map entry and invalidation', fromIndex: 28, toIndex: 55, narration: 'Compare the educational entry, invalidation, and objective. The trade idea must be defined before size or execution is considered.' },
      { stepId: 'review', title: '4. Review follow-through', fromIndex: 18, toIndex: 64, narration: 'Zoom back out and review what happened after confirmation. Judge the process, not only the outcome.' },
    ],
    notes: list(notes, 6, 300),
  };
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
    seed: input.seed || context.seed,
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
    system: `You are WISDO AI Webinar Director. Create an on-demand educational webinar as strict JSON. Teach clearly for the learner level. Use only the supplied approved strategy knowledge when a strategy is present. Never invent missing strategy rules, reveal protected source code, promise returns, or give personalized live buy/sell instructions. Include risk, invalidation, common mistakes, at least one on-chart worked example, and a quiz. For a chart-example scene, provide only a safe chart plan; WISDO generates simulated teaching candles and opens the matching real TradingView chart.`,
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
    mediaMode: 'interactive_ai_video_with_chart_teacher',
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
