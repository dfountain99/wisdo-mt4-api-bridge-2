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


function domainSpecificTeaching(domain, level) {
  const tagText = domain.tags.join(', ');
  if (domain.id === 'candlesticks-price-bars') {
    return {
      vocabulary: [
        { term: 'Open', meaning: 'The first traded price in the selected time interval.' },
        { term: 'High', meaning: 'The highest traded price during that interval.' },
        { term: 'Low', meaning: 'The lowest traded price during that interval.' },
        { term: 'Close', meaning: 'The final traded price when the interval ends.' },
        { term: 'Body', meaning: 'The distance between open and close; it shows net movement, not certainty.' },
        { term: 'Wick', meaning: 'Price explored beyond the body before the interval closed.' },
      ],
      workedExample: 'A candle opens at 100, trades to 106, falls to 98, and closes at 104. Its body is 4 points, upper wick is 2 points, and lower wick is 2 points. The candle shows the path inside one interval; it does not prove the next candle will rise.',
      misconception: 'A candle pattern is not a standalone prediction. Location, market structure, volatility, liquidity, timeframe, and risk determine whether it has decision value.',
      lab: 'Label the open, high, low, close, body, and wicks on three candles. Then compare the same candle shape at support, in the middle of a range, and after an extended trend.',
    };
  }
  if (domain.id === 'algorithmic-trading' || domain.id === 'data-engineering' || domain.id === 'cybersecurity-operations') {
    return {
      vocabulary: [
        { term: 'Signal', meaning: 'A defined condition that creates a proposed action.' },
        { term: 'Execution', meaning: 'The process that converts an approved action into an order.' },
        { term: 'State', meaning: 'The stored facts the system depends on, such as open tickets, account equity, and route status.' },
        { term: 'Idempotency', meaning: 'Repeating the same event does not create duplicate trades or duplicate records.' },
        { term: 'Fail-safe', meaning: 'A known recovery behavior when data, connectivity, or execution is unavailable.' },
      ],
      workedExample: 'A lead trade event should be detected once, validated against a Culture Lane, queued to one follower account, confirmed by the Reporter, stored in the trade ledger, and closed by the original follower ticket. Every stage needs a traceable status.',
      misconception: 'High win rate does not make an unstable system safe. Reliability, loss size, slippage, drawdown, duplicate protection, and close authority are separate engineering requirements.',
      lab: 'Draw the full event chain from lead snapshot to follower close. For every step, write the expected input, output, timeout, retry policy, and recovery state.',
    };
  }
  if (domain.id === 'drawdown-risk-of-ruin' || domain.id === 'position-sizing' || domain.id === 'trade-management') {
    return {
      vocabulary: [
        { term: 'Risk per trade', meaning: 'The amount of account value that can be lost if invalidation is reached.' },
        { term: 'Drawdown', meaning: 'The decline from an account equity peak to a later low.' },
        { term: 'Risk of ruin', meaning: 'The probability of losing enough capital that the strategy or account cannot continue normally.' },
        { term: 'Expectancy', meaning: 'Average outcome per trade after wins, losses, costs, and frequency are included.' },
      ],
      workedExample: 'A system can win 80% of the time and still lose money if its average loss is much larger than its average win. Another system can win 40% and remain profitable when wins are sufficiently larger than losses and drawdown is controlled.',
      misconception: 'Explosive wins should never be treated as a reason to remove loss limits. Positive skew is useful only when the account survives normal losing sequences.',
      lab: 'Compare three position sizes across the same ten-trade losing sequence. Record ending equity, maximum drawdown, margin pressure, and the number of losses required to recover.',
    };
  }
  return {
    vocabulary: domain.tags.slice(0, 5).map((term) => ({ term, meaning: `A core ${level.title.toLowerCase()} concept used when studying ${domain.title}.` })),
    workedExample: `Compare two examples of ${domain.title}: one where the evidence, invalidation, and risk are defined before action, and one where the decision is made after price has already moved. Identify which facts were available at decision time.`,
    misconception: `${domain.title} should not be reduced to a single indicator, social-media rule, or guaranteed outcome. It must be evaluated inside market context and account-level risk.`,
    lab: `Use replay or historical data to find five different examples of ${tagText}. Record the environment, evidence, invalidation, maximum loss, alternative action, and result without changing the original rules.`,
  };
}

export function buildInteractiveLesson(course, profile = {}) {
  if (!course) return null;
  const domain = ACADEMY_DOMAINS.find((item) => item.id === course.domainId);
  const level = LEVELS.find((item) => item.id === course.level) || LEVELS[0];
  const teaching = domainSpecificTeaching(domain, level);
  const learnerGoal = normalizeList(profile.goals).join(', ') || 'build repeatable skill while protecting capital';
  const markets = normalizeList(profile.markets).join(', ') || 'multiple markets';
  return {
    id: `${course.id}-interactive-session`,
    courseId: course.id,
    title: course.title,
    learnerContext: { experience: level.id, learningStyle: profile.learningStyle || 'interactive', goals: learnerGoal, markets },
    scenes: [
      {
        id: 'diagnostic',
        title: 'Start with what you already know',
        explanation: `This lesson begins at the ${level.title} level. Before adding terminology, explain what you currently believe ${domain.title} means and where you have seen it in ${markets}.`,
        demonstration: 'WISDO compares your explanation with the lesson vocabulary and adjusts the next reply through the AI tutor.',
        activity: `Write one thing you know, one thing you are unsure about, and one result you want from this lesson. Your larger goal is: ${learnerGoal}.`,
        checkpoint: { question: 'What should happen before a lesson increases in difficulty?', choices: ['Confirm current understanding', 'Assume expert knowledge', 'Skip risk', 'Place a live trade'], answer: 0 },
      },
      {
        id: 'language',
        title: 'Build the working language',
        explanation: 'Terms matter because vague language creates vague rules. Learn each term, then explain it in your own words and point to an example.',
        demonstration: teaching.workedExample,
        activity: teaching.vocabulary.map((item) => `${item.term}: ${item.meaning}`).join('\n'),
        vocabulary: teaching.vocabulary,
        checkpoint: { question: `Which approach best demonstrates understanding of ${domain.title}?`, choices: ['Define it and identify it in context', 'Memorize a name only', 'Assume it predicts profit', 'Ignore invalidation'], answer: 0 },
      },
      {
        id: 'context',
        title: 'Read context before action',
        explanation: teaching.misconception,
        demonstration: `Study how ${domain.title} changes across trend, range, high volatility, low liquidity, news, and different timeframes. The same visible pattern can have different meaning in each environment.`,
        activity: 'Create a two-column comparison: evidence that supports the idea and evidence that cancels it. Include a no-trade condition.',
        checkpoint: { question: 'What gives an observation decision value?', choices: ['Context plus a defined rule', 'Its name alone', 'A recent win', 'A promise of high accuracy'], answer: 0 },
      },
      {
        id: 'risk',
        title: 'Connect the idea to money and survival',
        explanation: 'Before execution, define invalidation, maximum acceptable loss, sizing method, correlated exposure, daily stop, and the condition that turns the system off.',
        demonstration: 'A valid market idea can still be an invalid account decision when the lot size, margin usage, spread, slippage, or combined open risk is too large.',
        activity: teaching.lab,
        checkpoint: { question: 'What comes before calculating lot size?', choices: ['Maximum acceptable loss and invalidation distance', 'Desired profit', 'Excitement', 'Number of signals'], answer: 0 },
      },
      {
        id: 'practice',
        title: 'Practice, explain, and review',
        explanation: 'Use replay, paper practice, or historical examples. Record the decision before revealing the next candle, then review process quality separately from profit or loss.',
        demonstration: `Complete at least five examples of ${domain.title}. Ask WISDO to challenge your reasoning, generate a contrasting example, or explain the same concept visually, verbally, or step by step.`,
        activity: 'Submit your thesis, invalidation, risk, decision, confidence, and review. Then ask the tutor which part of the reasoning is weakest.',
        checkpoint: { question: 'What should be graded after practice?', choices: ['Decision process and rule adherence', 'Profit only', 'How confident you felt', 'Whether the market agreed immediately'], answer: 0 },
      },
    ],
    finalChallenge: `Build a one-page operating checklist for ${domain.title} that works in ${markets}, includes failure conditions, and supports the goal to ${learnerGoal}.`,
    aiPrompts: [
      `Teach this course using a simple example from ${markets}.`,
      'Ask me one question at a time and do not advance until I explain the answer.',
      'Create a replay scenario, pause before the outcome, and grade my decision process.',
      'Show me how this concept can fail and how risk controls protect the account.',
    ],
  };
}

export function getAcademyCourse(id) {
  const [domainId, levelId, number] = String(id || '').split('--');
  const domain = ACADEMY_DOMAINS.find((item) => item.id === domainId);
  const level = LEVELS.find((item) => item.id === levelId);
  const patternIndex = Number(number) - 1;
  if (!domain || !level || patternIndex < 0 || patternIndex >= LESSON_PATTERNS.length) return null;
  const course = buildCourse(domain, level, patternIndex);
  const teaching = domainSpecificTeaching(domain, level);
  return {
    ...course,
    teachingPreview: teaching,
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
  const reliabilityGoals = /(crash|stable|stability|reliable|automation|bot|system|win rate|explosive|drawdown|money management)/i.test(seedTerms)
    ? ['algorithmic-trading', 'data-engineering', 'cybersecurity-operations', 'backtesting-validation', 'statistics-probability', 'drawdown-risk-of-ruin', 'position-sizing', 'trade-management', 'performance-routines']
    : [];
  const marketGoals = [
    ...(seedTerms.includes('forex') ? ['forex-foundations', 'macro-economics', 'central-banks'] : []),
    ...(seedTerms.includes('metal') || seedTerms.includes('gold') ? ['commodities', 'macro-economics', 'news-event-risk'] : []),
  ];
  const orderedDomains = [...new Map([
    ...essentials.map((id) => ACADEMY_DOMAINS.find((domain) => domain.id === id)),
    ...reliabilityGoals.map((id) => ACADEMY_DOMAINS.find((domain) => domain.id === id)),
    ...marketGoals.map((id) => ACADEMY_DOMAINS.find((domain) => domain.id === id)),
    ...preferred,
    ...ACADEMY_DOMAINS,
  ].filter(Boolean).map((domain) => [domain.id, domain])).values()];
  const levelIndex = LEVELS.findIndex((item) => item.id === experience);
  const levelIds = LEVELS.slice(Math.max(0, levelIndex - 1), Math.min(LEVELS.length, levelIndex + 2)).map((item) => item.id);
  const courses = [];
  const lessonOrder = [0, 4, 5, 7, 8, 9, 16, 18, 19];
  // Round-robin across priority domains before adding deeper modules. This prevents
  // the first few subjects from consuming the entire path and guarantees that a
  // learner asking for automation, reliability, forex, metals, and money management
  // receives all of those areas in the initial 36-course sequence.
  for (const levelId of levelIds) {
    const level = LEVELS.find((item) => item.id === levelId);
    for (const patternIndex of lessonOrder) {
      for (const domain of orderedDomains) {
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
    firstCourseId: courses[0]?.id || null,
    autoOpenFirstLesson: Boolean(courses[0]),
    explanation: reliabilityGoals.length
      ? 'The path begins with market language and risk, then separates system reliability, data quality, backtesting, expectancy, drawdown control, and execution from the goal of finding high-upside opportunities. High win rate and explosive wins are treated as research goals, never guarantees.'
      : 'The path begins with market language, order mechanics, risk, money management, and command-center safety, then adds the markets and strategies selected by the learner.',
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
