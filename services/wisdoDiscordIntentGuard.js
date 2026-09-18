const COURSE_PATTERN = /\b(course|curriculum|class|lesson|training program|learning path|workshop|academy)\b/i;
const COURSE_CREATE_PATTERN = /\b(build|create|make|design|develop|organize|outline|plan|teach|turn|convert)\b/i;
const NON_EXECUTION_PATTERN = /\b(explain|teach|learn|study|brainstorm|discuss|talk about|course|curriculum|class|lesson|workshop|promote|promotion|content|screen share|screen guide|document|procedure)\b/i;

export function normalizeWisdoIntentText(value) {
  return String(value || '').toLowerCase().replace(/[^\w\s.%'-]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function classifyWisdoKnowledgeIntent(value) {
  const input = normalizeWisdoIntentText(value);
  if (COURSE_PATTERN.test(input) && COURSE_CREATE_PATTERN.test(input)) {
    return { intent: 'course_forge', confidence: 100, input, executionAllowed: false };
  }
  if (NON_EXECUTION_PATTERN.test(input)) {
    return { intent: 'knowledge_conversation', confidence: 95, input, executionAllowed: false };
  }
  return null;
}

export function isExplicitGuardModeRequest(value) {
  const input = normalizeWisdoIntentText(value);
  return /\b(guard mode|safe mode|defensive mode)\b/.test(input)
    || /\b(put|place|switch|set|activate|enable|turn)\b.{0,40}\b(account|mt4|trading|bot|ea)\b.{0,25}\b(guard|safe|defensive)\b/.test(input)
    || /\bprotect\b.{0,25}\b(my |the )?(account|mt4|trading account)\b/.test(input)
    || /\b(stop|pause|block)\b.{0,20}\bnew trades\b/.test(input);
}

export function isExplicitMt4Mutation(value, intent = '') {
  const input = normalizeWisdoIntentText(value);
  if (classifyWisdoKnowledgeIntent(input)) return false;
  if (intent === 'mt4_guard_mode') return isExplicitGuardModeRequest(input);
  const explicitPhrase = /\b(emergency stop|kill switch|panic stop|close everything|pause (my )?(mt4|trading|bot|ea)|resume (my )?(mt4|trading|bot|ea)|buy only|sell only|both directions|set (my )?(risk|max trades|equity floor|daily (gain|goal|loss limit))|close (my )?(trades|positions|profits|winners|losses|losers)|cut (my )?(losses|losers)|take (my )?(profits|winners)|reset (my )?(account|mt4)|disconnect (my )?(account|mt4)|enable (my )?(ea|bot|trading)|disable (my )?(ea|bot|trading))\b/.test(input);
  if (explicitPhrase) return true;
  const action = /\b(set|change|increase|decrease|lower|reduce|pause|resume|enable|disable|close|cut|trim|collect|bank|allow|block|reset|disconnect|unlink|hedge)\b/.test(input);
  const target = /\b(mt4|account|trade|trades|position|positions|risk|equity|bot|ea|hedge|ladder|anchor|drawdown)\b/.test(input);
  return action && target;
}

export function extractCourseSeed(value) {
  const input = normalizeWisdoIntentText(value)
    .replace(/^(hey\s+(coach|wisdo|wisdom|operator)\s*)/, '')
    .replace(/\b(let(?:'|\s)?s\s+)?(build|create|make|design|develop|organize|outline|plan)\b/g, '')
    .replace(/\b(a|an|the|course|curriculum|class|training program|learning path)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const topic = input || 'trading foundations';
  return { topic, title: `${topic.replace(/\b\w/g, (letter) => letter.toUpperCase())} Course` };
}
