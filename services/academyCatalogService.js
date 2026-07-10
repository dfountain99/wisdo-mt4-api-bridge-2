import crypto from 'node:crypto';

const LEVELS = [
  { id: 'starter', title: 'Starter', order: 1, description: 'No assumed experience. Vocabulary, mechanics, and safe practice.' },
  { id: 'foundation', title: 'Foundation', order: 2, description: 'Core decision frameworks, repeatable routines, and risk control.' },
  { id: 'intermediate', title: 'Intermediate', order: 3, description: 'Applied analysis, execution quality, and multi-factor reasoning.' },
  { id: 'advanced', title: 'Advanced', order: 4, description: 'Portfolio context, market regimes, and professional workflow.' },
  { id: 'professional', title: 'Professional', order: 5, description: 'Research, governance, systems thinking, and operating discipline.' },
];

const LESSON_PATTERNS = [
  ['Essentials', 'Build the language, purpose, and safety boundaries of {domain}.'],
  ['Market Mechanics', 'Explain how orders, participants, liquidity, and price formation affect {domain}.'],
  ['Visual Recognition', 'Recognize the most important visual and data patterns used in {domain}.'],
  ['Decision Framework', 'Turn observations into a structured decision process for {domain}.'],
  ['Risk First', 'Define loss limits, invalidation, and exposure controls for {domain}.'],
  ['Money Management', 'Connect position sizing, cash reserves, and compounding discipline to {domain}.'],
  ['Execution Lab', 'Practice entries, exits, order selection, and slippage awareness in {domain}.'],
  ['Scenario Replay', 'Work through changing conditions and explain what would invalidate the plan.'],
  ['Mistake Clinic', 'Diagnose common mistakes, behavioral traps, and process failures in {domain}.'],
  ['Journal Workshop', 'Create a journal template and review loop for {domain}.'],
  ['Data and Evidence', 'Measure performance, uncertainty, and sample quality in {domain}.'],
  ['Strategy Comparison', 'Compare multiple approaches and identify when each approach is unsuitable.'],
  ['Regime Adaptation', 'Adjust the process for trend, range, volatility, news, and liquidity regimes.'],
  ['Portfolio Context', 'Understand correlation, concentration, and account-level consequences.'],
  ['Technology and Tools', 'Use charts, scanners, automation, and alerts without outsourcing judgment.'],
  ['Ethics and Compliance', 'Review legal, ethical, and platform-specific responsibilities.'],
  ['Capital Preservation', 'Prioritize survival, drawdown recovery math, and risk-of-ruin reduction.'],
  ['Case Study', 'Analyze a complete example from planning through post-trade review.'],
  ['Assessment', 'Demonstrate knowledge through scenario questions and a practical checklist.'],
  ['Capstone', 'Build a personal operating plan that integrates {domain} with the wider trading system.'],
];

const DOMAINS = [
  ['candlesticks-price-bars', 'Candlesticks and Price Bars', 'Foundations', ['candles', 'ohlc', 'chart reading']],
  ['market-structure', 'Market Structure', 'Technical Analysis', ['swing highs', 'swing lows', 'trend', 'range']],
  ['support-resistance', 'Support, Resistance, and Zones', 'Technical Analysis', ['levels', 'zones', 'retests']],
  ['trend-analysis', 'Trend Analysis', 'Technical Analysis', ['trend', 'moving averages', 'momentum']],
  ['range-consolidation', 'Ranges and Consolidation', 'Technical Analysis', ['range', 'breakout', 'mean reversion']],
  ['breakouts-fakeouts', 'Breakouts and Fakeouts', 'Technical Analysis', ['breakout', 'trap', 'confirmation']],
  ['chart-patterns', 'Chart Patterns', 'Technical Analysis', ['patterns', 'continuation', 'reversal']],
  ['indicators-oscillators', 'Indicators and Oscillators', 'Technical Analysis', ['indicator', 'oscillator', 'divergence']],
  ['volume-order-flow', 'Volume and Order Flow', 'Market Microstructure', ['volume', 'delta', 'auction']],
  ['market-profile', 'Market Profile and Auction Theory', 'Market Microstructure', ['profile', 'value area', 'auction']],
  ['liquidity-microstructure', 'Liquidity and Market Microstructure', 'Market Microstructure', ['liquidity', 'spread', 'depth']],
  ['order-types-execution', 'Order Types and Execution', 'Execution', ['market order', 'limit', 'stop', 'slippage']],
  ['trade-management', 'Trade Management', 'Execution', ['stop loss', 'take profit', 'trailing']],
  ['position-sizing', 'Position Sizing', 'Risk and Money Management', ['risk per trade', 'lot size', 'volatility']],
  ['drawdown-risk-of-ruin', 'Drawdown and Risk of Ruin', 'Risk and Money Management', ['drawdown', 'risk of ruin', 'recovery']],
  ['portfolio-risk', 'Portfolio Risk', 'Risk and Money Management', ['correlation', 'concentration', 'exposure']],
  ['cash-flow-budgeting', 'Cash Flow and Trading Budgets', 'Personal Finance', ['budget', 'cash reserve', 'trading capital']],
  ['emergency-funds-debt', 'Emergency Funds and Debt Strategy', 'Personal Finance', ['debt', 'emergency fund', 'cash flow']],
  ['saving-compounding', 'Saving, Compounding, and Wealth Building', 'Personal Finance', ['saving', 'compounding', 'wealth']],
  ['retirement-investing', 'Retirement and Long-Term Investing', 'Personal Finance', ['retirement', 'indexing', 'asset allocation']],
  ['behavioral-finance', 'Behavioral Finance', 'Psychology', ['bias', 'decision making', 'emotion']],
  ['trading-psychology', 'Trading Psychology', 'Psychology', ['discipline', 'fear', 'greed']],
  ['performance-routines', 'Performance Routines', 'Psychology', ['routine', 'focus', 'review']],
  ['journaling-review', 'Journaling and Performance Review', 'Professional Practice', ['journal', 'metrics', 'review']],
  ['trading-plan', 'Building a Trading Plan', 'Professional Practice', ['plan', 'rules', 'checklist']],
  ['backtesting-validation', 'Backtesting and Strategy Validation', 'Research', ['backtest', 'validation', 'bias']],
  ['statistics-probability', 'Statistics and Probability for Traders', 'Research', ['probability', 'expectancy', 'distribution']],
  ['quant-research', 'Quantitative Research', 'Research', ['factor', 'model', 'research']],
  ['algorithmic-trading', 'Algorithmic Trading', 'Technology', ['automation', 'algorithm', 'execution']],
  ['data-engineering', 'Trading Data Engineering', 'Technology', ['data', 'pipeline', 'quality']],
  ['ai-for-trading', 'AI for Trading Research', 'Technology', ['ai', 'machine learning', 'research']],
  ['cybersecurity-operations', 'Trading Cybersecurity and Operations', 'Technology', ['security', 'credentials', 'continuity']],
  ['forex-foundations', 'Foreign Exchange Markets', 'Asset Classes', ['forex', 'currency', 'pip']],
  ['equities-foundations', 'Equity Markets', 'Asset Classes', ['stocks', 'shares', 'earnings']],
  ['futures-foundations', 'Futures Markets', 'Asset Classes', ['futures', 'contract', 'margin']],
  ['options-foundations', 'Options Markets', 'Asset Classes', ['options', 'greeks', 'volatility']],
  ['bonds-rates', 'Bonds and Interest Rates', 'Asset Classes', ['bonds', 'yield', 'duration']],
  ['commodities', 'Commodity Markets', 'Asset Classes', ['gold', 'oil', 'agriculture']],
  ['crypto-digital-assets', 'Crypto and Digital Assets', 'Asset Classes', ['crypto', 'blockchain', 'custody']],
  ['indices-etfs', 'Indices and ETFs', 'Asset Classes', ['index', 'etf', 'sector']],
  ['real-estate-reits', 'Real Estate and REITs', 'Asset Classes', ['real estate', 'reit', 'income']],
  ['macro-economics', 'Macroeconomics', 'Fundamental Analysis', ['growth', 'inflation', 'rates']],
  ['central-banks', 'Central Banks and Monetary Policy', 'Fundamental Analysis', ['central bank', 'rates', 'liquidity']],
  ['economic-calendar', 'Economic Calendar and News Risk', 'Fundamental Analysis', ['news', 'calendar', 'volatility']],
  ['company-fundamentals', 'Company Fundamental Analysis', 'Fundamental Analysis', ['financial statements', 'valuation', 'earnings']],
  ['sector-industry-analysis', 'Sector and Industry Analysis', 'Fundamental Analysis', ['sector', 'industry', 'cycle']],
  ['geopolitics-markets', 'Geopolitics and Markets', 'Fundamental Analysis', ['geopolitics', 'risk', 'capital flows']],
  ['day-trading', 'Day Trading', 'Strategies', ['intraday', 'session', 'execution']],
  ['swing-trading', 'Swing Trading', 'Strategies', ['swing', 'multi-day', 'trend']],
  ['position-trading', 'Position Trading', 'Strategies', ['position', 'macro', 'long horizon']],
  ['scalping', 'Scalping', 'Strategies', ['scalping', 'spread', 'latency']],
  ['mean-reversion', 'Mean Reversion Strategies', 'Strategies', ['mean reversion', 'range', 'statistics']],
  ['momentum-trend-following', 'Momentum and Trend Following', 'Strategies', ['momentum', 'trend', 'breakout']],
  ['arbitrage-relative-value', 'Arbitrage and Relative Value', 'Strategies', ['spread', 'pairs', 'relative value']],
  ['income-strategies', 'Income-Oriented Strategies', 'Strategies', ['income', 'dividend', 'premium']],
  ['hedging-protection', 'Hedging and Protection', 'Strategies', ['hedge', 'protection', 'tail risk']],
  ['copy-trading', 'Copy Trading and Culture Lanes', 'WISDO Systems', ['copy trading', 'leader', 'follower']],
  ['broker-prop-firms', 'Brokers and Prop Firms', 'Professional Practice', ['broker', 'prop firm', 'rules']],
  ['tax-recordkeeping', 'Tax Awareness and Recordkeeping', 'Professional Practice', ['tax', 'records', 'reporting']],
  ['regulation-ethics', 'Regulation, Ethics, and Disclosure', 'Professional Practice', ['regulation', 'ethics', 'disclosure']],
  ['business-of-trading', 'The Business of Trading', 'Professional Practice', ['business', 'operations', 'capital']],
  ['df-sauce-campaign-character', 'DF Sauce Campaign Character', 'WISDO Systems', ['campaign', 'structure', 'decision replay']],
  ['wisdo-copier-operations', 'WISDO Copier Operations', 'WISDO Systems', ['reporter', 'relay', 'close authority']],
  ['wisdo-account-health', 'WISDO Account Health Governor', 'WISDO Systems', ['equity', 'margin', 'drawdown']],
  ['wisdo-command-center', 'WISDO Command Center', 'WISDO Systems', ['command center', 'accounts', 'controls']],
];

function slug(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function courseId(domainId, levelId, patternIndex) {
  return `${domainId}--${levelId}--${String(patternIndex + 1).padStart(2, '0')}`;
}

function stableNumber(input, min, max) {
  const hex = crypto.createHash('sha256').update(String(input)).digest('hex').slice(0, 8);
  return min + (Number.parseInt(hex, 16) % (max - min + 1));
}

export const ACADEMY_LEVELS = LEVELS;
export const ACADEMY_DOMAINS = DOMAINS.map(([id, title, category, tags]) => ({ id, title, category, tags }));
export const ACADEMY_COURSE_COUNT = ACADEMY_DOMAINS.length * LEVELS.length * LESSON_PATTERNS.length;

export function getAcademySummary() {
  const categories = [...new Set(ACADEMY_DOMAINS.map((domain) => domain.category))].sort();
  return {
    courseCount: ACADEMY_COURSE_COUNT,
    domainCount: ACADEMY_DOMAINS.length,
    levelCount: LEVELS.length,
    categories,
    levels: LEVELS,
    featuredDomains: ACADEMY_DOMAINS.filter((domain) => ['candlesticks-price-bars', 'position-sizing', 'trading-psychology', 'macro-economics', 'df-sauce-campaign-character', 'wisdo-command-center'].includes(domain.id)),
  };
}

function buildCourse(domain, level, patternIndex) {
  const [patternTitle, patternSummary] = LESSON_PATTERNS[patternIndex];
  const id = courseId(domain.id, level.id, patternIndex);
  const duration = stableNumber(id, 12, 48);
  const title = `${domain.title}: ${patternTitle}`;
  const summary = patternSummary.replaceAll('{domain}', domain.title.toLowerCase());
  const objectives = [
    `Explain the key concepts and vocabulary used in ${domain.title}.`,
    `Apply a ${level.title.toLowerCase()}-level decision checklist without promising or assuming profits.`,
    `Identify invalidation, uncertainty, and the account-level risk before acting.`,
    `Document the decision and review the result using evidence rather than emotion.`,
  ];
  const practice = [
    'Observe a replay or example without placing a live trade.',
    'Write the thesis, invalidation, maximum loss, and no-trade conditions.',
    'Compare two alternative actions and explain why one is safer.',
    'Complete the reflection and knowledge check before advancing.',
  ];
  return {
    id,
    slug: slug(title),
    domainId: domain.id,
    domainTitle: domain.title,
    category: domain.category,
    tags: domain.tags,
    level: level.id,
    levelTitle: level.title,
    title,
    summary,
    durationMinutes: duration,
    objectives,
    practice,
    riskNotice: 'Educational only. Trading and investing involve risk of loss, and no lesson guarantees results.',
    sequence: level.order * 100 + patternIndex + 1,
  };
}

export function getAcademyCourse(id) {
  const [domainId, levelId, number] = String(id || '').split('--');
  const domain = ACADEMY_DOMAINS.find((item) => item.id === domainId);
  const level = LEVELS.find((item) => item.id === levelId);
  const patternIndex = Number(number) - 1;
  if (!domain || !level || patternIndex < 0 || patternIndex >= LESSON_PATTERNS.length) return null;
  const course = buildCourse(domain, level, patternIndex);
  return {
    ...course,
    modules: [
      { id: `${course.id}-orientation`, title: 'Orientation', body: course.summary },
      { id: `${course.id}-concepts`, title: 'Core concepts', body: `Learn the vocabulary, mechanics, participants, and common misconceptions connected to ${domain.title}.` },
      { id: `${course.id}-risk`, title: 'Risk and money management', body: `Define the maximum acceptable loss, capital allocation, and conditions that cancel the idea before considering execution.` },
      { id: `${course.id}-lab`, title: 'Interactive lab', body: `Use chart replay, scenario choices, and account-impact examples to practice ${domain.title} without relying on hindsight.` },
      { id: `${course.id}-review`, title: 'Review and assessment', body: 'Complete a knowledge check, write a journal entry, and identify the next weakness to study.' },
    ],
    knowledgeCheck: [
      { question: `What evidence would invalidate a decision involving ${domain.title}?`, choices: ['A predefined condition', 'A feeling after entry', 'A social-media post', 'Nothing can invalidate it'], answer: 0 },
      { question: 'What should be defined before position size?', choices: ['Maximum acceptable loss', 'Profit target only', 'How exciting the setup feels', 'The number of followers'], answer: 0 },
      { question: 'What is the purpose of review?', choices: ['Improve process using evidence', 'Prove every loss was unfair', 'Increase risk after a win', 'Avoid recording mistakes'], answer: 0 },
    ],
  };
}

export function searchAcademyCourses({ query = '', category = '', domainId = '', level = '', page = 1, limit = 24 } = {}) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 24));
  const safePage = Math.max(1, Number(page) || 1);
  let domains = ACADEMY_DOMAINS;
  if (category) domains = domains.filter((domain) => domain.category === category);
  if (domainId) domains = domains.filter((domain) => domain.id === domainId);
  const levels = level ? LEVELS.filter((item) => item.id === level) : LEVELS;
  const all = [];
  for (const domain of domains) {
    for (const levelItem of levels) {
      for (let index = 0; index < LESSON_PATTERNS.length; index += 1) {
        const course = buildCourse(domain, levelItem, index);
        if (normalizedQuery) {
          const haystack = `${course.title} ${course.summary} ${course.category} ${course.tags.join(' ')}`.toLowerCase();
          if (!haystack.includes(normalizedQuery)) continue;
        }
        all.push(course);
      }
    }
  }
  const total = all.length;
  const start = (safePage - 1) * safeLimit;
  return { total, page: safePage, limit: safeLimit, pages: Math.max(1, Math.ceil(total / safeLimit)), courses: all.slice(start, start + safeLimit) };
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function buildPersonalizedPath(profile = {}) {
  const experience = LEVELS.some((item) => item.id === profile.experience) ? profile.experience : 'starter';
  const goals = normalizeList(profile.goals);
  const markets = normalizeList(profile.markets);
  const interests = normalizeList(profile.interests);
  const seedTerms = [...goals, ...markets, ...interests].join(' ').toLowerCase();
  const preferred = ACADEMY_DOMAINS.filter((domain) => {
    const haystack = `${domain.title} ${domain.category} ${domain.tags.join(' ')}`.toLowerCase();
    return seedTerms && seedTerms.split(/\s+/).some((token) => token.length > 2 && haystack.includes(token));
  });
  const essentials = ['candlesticks-price-bars', 'order-types-execution', 'position-sizing', 'drawdown-risk-of-ruin', 'trading-plan', 'journaling-review', 'wisdo-command-center'];
  const orderedDomains = [...new Map([
    ...essentials.map((id) => ACADEMY_DOMAINS.find((domain) => domain.id === id)),
    ...preferred,
    ...ACADEMY_DOMAINS,
  ].filter(Boolean).map((domain) => [domain.id, domain])).values()];
  const levelIndex = LEVELS.findIndex((item) => item.id === experience);
  const levelIds = LEVELS.slice(Math.max(0, levelIndex - 1), Math.min(LEVELS.length, levelIndex + 2)).map((item) => item.id);
  const courses = [];
  for (const domain of orderedDomains) {
    for (const levelId of levelIds) {
      for (const patternIndex of [0, 4, 5, 7, 8, 9, 16, 18, 19]) {
        const level = LEVELS.find((item) => item.id === levelId);
        courses.push(buildCourse(domain, level, patternIndex));
        if (courses.length >= 36) break;
      }
      if (courses.length >= 36) break;
    }
    if (courses.length >= 36) break;
  }
  return {
    profile: {
      experience,
      goals,
      markets,
      interests,
      weeklyMinutes: Math.max(30, Math.min(1200, Number(profile.weeklyMinutes) || 180)),
      learningStyle: String(profile.learningStyle || 'interactive'),
    },
    path: courses,
    explanation: 'The path begins with market language, order mechanics, risk, money management, and command-center safety, then adds the markets and strategies selected by the learner.',
  };
}

export function buildFallbackTutorReply({ message = '', profile = {}, course = null } = {}) {
  const text = String(message || '').trim();
  const level = LEVELS.find((item) => item.id === profile.experience)?.title || 'Starter';
  const context = course ? `You are studying “${course.title}.”` : 'You are working inside the WISDO Academy.';
  const lower = text.toLowerCase();
  if (!text) return `${context} Ask about a concept, strategy, account risk, money management, or a step you do not understand.`;
  if (lower.includes('candlestick')) return `At the ${level} level, start with open, high, low, and close. A candle summarizes what price did during one interval; it does not predict the next candle by itself. Practice identifying body size, wick size, location, and surrounding structure before naming a pattern.`;
  if (lower.includes('risk') || lower.includes('money management')) return `Start with the amount you can lose without damaging the account or your household finances. Define invalidation first, size the position from that loss limit, include spread and slippage, and stop trading when daily or campaign limits are reached. This is education, not personalized financial advice.`;
  if (lower.includes('strategy')) return `A strategy needs a defined market, timeframe, setup, trigger, invalidation, position-size rule, exit rule, and evidence from a sufficiently large sample. WISDO should adapt the lesson depth to your experience, but it should never skip the risk and review steps.`;
  return `${context} Here is a safe way to study your question: define the term, observe it in several market conditions, write the invalidation and risk, practice in replay, then review the outcome without changing rules after the fact. Your current learning level is ${level}.`;
}

function seededRandom(seedText) {
  let state = Number.parseInt(crypto.createHash('sha256').update(seedText).digest('hex').slice(0, 8), 16) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export function getDfSauceScenario(scenarioId = 'bull-campaign') {
  const definitions = {
    'bull-campaign': { label: 'Bull campaign formation', drift: 0.34, eventAt: 34, direction: 'buy', decision: 'wait', lesson: 'Wait for structure and campaign confirmation before adding risk.' },
    'bear-campaign': { label: 'Bear campaign formation', drift: -0.34, eventAt: 34, direction: 'sell', decision: 'wait', lesson: 'A bearish environment is not an automatic short; wait for the planned trigger.' },
    'false-break': { label: 'False break and recovery', drift: 0.04, eventAt: 42, direction: 'neutral', decision: 'wait', lesson: 'A break without acceptance can be a trap. Protect capital until the market proves direction.' },
    'range-day': { label: 'Range-day character', drift: 0, eventAt: 38, direction: 'neutral', decision: 'wait', lesson: 'Trend tactics can fail inside balance. Reduce assumptions and wait near range boundaries.' },
    'campaign-exit': { label: 'Campaign invalidation', drift: 0.22, eventAt: 54, direction: 'close', decision: 'close', lesson: 'When the campaign invalidates, close authority matters more than entry filters.' },
    'news-volatility': { label: 'News-volatility expansion', drift: 0.05, eventAt: 45, direction: 'neutral', decision: 'wait', lesson: 'News can widen spread and invalidate normal execution assumptions.' },
  };
  const definition = definitions[scenarioId] || definitions['bull-campaign'];
  const random = seededRandom(scenarioId);
  const candles = [];
  let close = 100;
  for (let index = 0; index < 72; index += 1) {
    const eventBoost = index > definition.eventAt ? definition.drift : definition.drift * 0.35;
    const volatility = scenarioId === 'news-volatility' && Math.abs(index - definition.eventAt) < 4 ? 3.5 : 1.1;
    const change = (random() - 0.48) * volatility + eventBoost;
    const open = close;
    close = Math.max(50, open + change);
    const high = Math.max(open, close) + random() * volatility;
    const low = Math.min(open, close) - random() * volatility;
    candles.push({ index, open: Number(open.toFixed(3)), high: Number(high.toFixed(3)), low: Number(low.toFixed(3)), close: Number(close.toFixed(3)), volume: Math.round(100 + random() * 900) });
  }
  const checkpoints = [
    { index: 12, state: 'observe', title: 'Read the environment', prompt: 'Is the market trending, balancing, or unstable?', correctDecision: 'wait' },
    { index: 28, state: 'structure', title: 'Read structure', prompt: 'What evidence supports or contradicts the developing character?', correctDecision: 'wait' },
    { index: definition.eventAt, state: 'decision', title: 'Campaign decision', prompt: 'Choose the safest action using the visible evidence and your risk limit.', correctDecision: definition.decision },
    { index: 64, state: 'review', title: 'Review the campaign', prompt: 'Did the market confirm, invalidate, or remain uncertain?', correctDecision: definition.direction === 'close' ? 'close' : 'wait' },
  ];
  return {
    id: scenarioId,
    label: definition.label,
    candles,
    checkpoints,
    coachNotes: [
      'The lab teaches observation, decision quality, invalidation, and risk discipline.',
      'It intentionally does not expose proprietary indicator source code or exact implementation parameters.',
      definition.lesson,
    ],
  };
}
