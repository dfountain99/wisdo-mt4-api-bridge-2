import crypto from 'node:crypto';

export const AI_WEBINAR_VERSION = '1.0.0';
export const AI_WEBINAR_DISCLAIMER = 'WISDO AI Webinar lessons are educational only. Trading involves risk, results are not guaranteed, and the lesson is not individualized financial advice.';

const LEVELS = new Set(['starter', 'foundation', 'intermediate', 'advanced', 'professional']);
const STATUSES = new Set(['draft', 'review', 'approved', 'published', 'archived']);

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

function scene(id, title, narration, bullets = [], visual = 'lesson-board', durationSeconds = 55) {
  return {
    sceneId: id,
    title: clean(title, 180),
    narration: sentence(narration),
    bullets: list(bullets, 6, 300),
    visual,
    durationSeconds: clamp(durationSeconds, 20, 180, 55),
  };
}

export function buildFallbackWebinar({ question = '', topic = '', level = 'starter', durationMinutes = 8, strategy = null, learnerProfile = null } = {}) {
  const safeLevel = LEVELS.has(level) ? level : 'starter';
  const titleTopic = clean(topic || question, 180) || 'WISDO Trading Foundation';
  const duration = clamp(durationMinutes, 3, 30, 8);
  const facts = strategyFacts(strategy);
  const market = learnerProfile?.markets?.[0] || strategy?.markets?.[0] || 'your selected market';
  const strategyTitle = strategy?.title || '';
  const scenes = [
    scene('scene-1', `Welcome: ${titleTopic}`, `This lesson answers: ${question || titleTopic}. It is designed for a ${safeLevel} learner and uses ${market} examples.`, ['What you will learn', 'How to practice safely', 'What not to assume'], 'title-card', 45),
    scene('scene-2', 'Core idea', `Start with the decision problem, not the indicator. Define what evidence must be visible before an action is considered.`, ['Context first', 'Evidence before entry', 'Invalidation must be known'], 'concept-map', 60),
    scene('scene-3', strategyTitle ? `${strategyTitle}: approved framework` : 'Step-by-step framework', strategyTitle ? `This section uses the published ${strategyTitle} strategy version ${strategy.version || '1.0'}.` : `Use a repeatable process: identify context, wait for confirmation, define risk, execute only in practice mode, and review the outcome.`, facts.slice(0, 6).length ? facts.slice(0, 6) : ['Identify market condition', 'Wait for confirmation', 'Define invalidation', 'Size risk before entry'], 'strategy-board', 75),
    scene('scene-4', 'Worked example', `Imagine price reaches an important area in ${market}. Do not act only because price touched the area. Wait for the approved confirmation, identify where the idea becomes invalid, and compare the possible loss with the planned learning objective.`, ['Mark the context', 'Name the confirmation', 'Name the invalidation', 'Use paper practice first'], 'chart-example', 75),
    scene('scene-5', 'Risk and common mistakes', `A good explanation is incomplete without risk. The most common mistakes are entering before confirmation, increasing size to recover a loss, ignoring spread or news, and treating a lesson as a guaranteed signal.`, strategy?.riskRules?.slice(0, 4) || ['Use controlled practice risk', 'Set a daily stop rule', 'Avoid revenge trading', 'Never assume guaranteed returns'], 'risk-panel', 70),
    scene('scene-6', 'Knowledge check', `Pause and explain the setup in your own words. What condition must exist, what confirms the idea, and what would prove the idea wrong?`, ['Condition', 'Confirmation', 'Invalidation', 'Risk boundary'], 'quiz-card', 55),
    scene('scene-7', 'Next action', `Replay this lesson, complete the quiz, and practice the process in simulation or paper mode before considering live execution.`, ['Save the lesson', 'Take the quiz', 'Practice one example', 'Ask a follow-up question'], 'summary-card', 45),
  ];
  const secondsTarget = duration * 60;
  const currentSeconds = scenes.reduce((sum, item) => sum + item.durationSeconds, 0);
  if (currentSeconds < secondsTarget) scenes[2].durationSeconds = clamp(scenes[2].durationSeconds + (secondsTarget - currentSeconds), 20, 180, 75);
  return {
    title: `${titleTopic} · AI Webinar`,
    subtitle: strategyTitle ? `Taught from approved ${strategyTitle} v${strategy.version || '1.0'} knowledge` : 'Personalized WISDO lesson',
    objective: `Help a ${safeLevel} learner understand ${titleTopic} and practice it safely.`,
    level: safeLevel,
    estimatedMinutes: duration,
    presenter: 'WISDO AI Educator',
    scenes,
    quiz: [
      { questionId: 'q1', prompt: 'What should come before an entry decision?', options: ['A clear market context and approved confirmation', 'A profit target only', 'A larger lot size', 'A social media opinion'], answerIndex: 0, explanation: 'Context and confirmation come before execution.' },
      { questionId: 'q2', prompt: 'What is invalidation?', options: ['Evidence that proves the trade idea is no longer valid', 'A guaranteed stop-out', 'A reward target', 'A broker login'], answerIndex: 0, explanation: 'Invalidation defines when the original idea is wrong.' },
      { questionId: 'q3', prompt: 'How should a new concept be practiced first?', options: ['Simulation or paper mode', 'Maximum live leverage', 'Without a stop rule', 'By copying every signal'], answerIndex: 0, explanation: 'Practice mode lets the learner test the process without unnecessary live risk.' },
    ],
    takeaway: `Use evidence, invalidation, and controlled practice. Do not treat the webinar as a guaranteed trade signal.`,
    disclaimer: strategy?.requiredDisclaimer || AI_WEBINAR_DISCLAIMER,
  };
}

export function buildWebinarPrompt({ question, topic, level, durationMinutes, strategy, learnerProfile, course } = {}) {
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
    system: `You are WISDO AI Webinar Director. Create an on-demand educational webinar as strict JSON. Teach clearly for the learner level. Use only the supplied approved strategy knowledge when a strategy is present. Never invent missing strategy rules, reveal protected source code, promise returns, or give personalized live buy/sell instructions. Include risk, invalidation, common mistakes, a worked example, and a quiz. The browser will turn scenes into a narrated AI video lesson.`,
    user: JSON.stringify({
      requestedQuestion: clean(question, 4000),
      topic: clean(topic, 500),
      level: LEVELS.has(level) ? level : 'starter',
      durationMinutes: clamp(durationMinutes, 3, 30, 8),
      learnerProfile: learnerProfile || null,
      courseContext: course ? { id: course.id, title: course.title, summary: course.summary, objectives: course.objectives } : null,
      approvedStrategyKnowledge: approvedKnowledge,
      outputSchema: {
        title: 'string', subtitle: 'string', objective: 'string', level: 'string', estimatedMinutes: 'number', presenter: 'string',
        scenes: [{ sceneId: 'string', title: 'string', narration: 'string', bullets: ['string'], visual: 'title-card|concept-map|strategy-board|chart-example|risk-panel|quiz-card|summary-card', durationSeconds: 'number 20-180' }],
        quiz: [{ questionId: 'string', prompt: 'string', options: ['four strings'], answerIndex: 'number 0-3', explanation: 'string' }],
        takeaway: 'string', disclaimer: 'string',
      },
    }),
  };
}

export function normalizeGeneratedWebinar(payload = {}, fallbackInput = {}) {
  const fallback = buildFallbackWebinar(fallbackInput);
  const scenes = Array.isArray(payload.scenes) ? payload.scenes.slice(0, 18).map((item, index) => scene(
    clean(item.sceneId, 80) || `scene-${index + 1}`,
    clean(item.title, 180) || `Lesson scene ${index + 1}`,
    clean(item.narration, 3000) || fallback.scenes[Math.min(index, fallback.scenes.length - 1)].narration,
    item.bullets,
    clean(item.visual, 50) || 'lesson-board',
    item.durationSeconds,
  )) : fallback.scenes;
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
      question: clean(request.question, 4000), topic: clean(request.topic, 500), level: clean(request.level, 30) || 'starter', durationMinutes: clamp(request.durationMinutes, 3, 30, 8), strategyId: strategy?.strategyId || null, courseId: course?.id || null,
    },
    webinar,
    provider,
    mediaMode: 'interactive_ai_video',
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
