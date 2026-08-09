const DEFAULT_WAKE_PHRASES = Object.freeze([
  'hey coach', 'hey wisdom', 'hey wisdo', 'hey wiz', 'hey operator',
  'hey trading assistant', 'trading assistant', 'coach', 'wisdom', 'wisdo',
  'operator', 'yo wisdom', 'yo wisdo', 'wizzo', 'wizdo', 'wiz do',
  'wise do', 'wise doe',
]);

const NUMBER_WORDS = Object.freeze({ zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, twentyfive: 25, fifty: 50, hundred: 100 });

export const INTENT_SCHEMA_VERSION = '1.0';
const MODEL_COMMAND_ALLOWLIST = new Set(['CLOSE_ALL_TRADES','CLOSE_ALL_WINNERS','CLOSE_ALL_LOSERS','EMERGENCY_STOP','PAUSE_COPIER','RESUME_COPIER','STOP_ENTRIES','START_ENTRIES','SET_EQUITY_FLOOR','WISDO_PRESERVE_RUNNER','WISDO_TRAIL_RUNNER','WISDO_STOP_AFTER_NEXT','WISDO_STOP_AFTER_CURRENT','WISDO_SET_NEWS_AVOIDANCE','WISDO_LADDER_ACTION','WISDO_EXPLAIN_TRADE']);

export function configuredWakePhrases(value = process.env.WISDO_WAKE_PHRASES) {
  const custom = String(value || '').split(/[;,]/).map((v) => v.trim().toLowerCase()).filter(Boolean);
  return [...new Set([...DEFAULT_WAKE_PHRASES, ...custom])].sort((a, b) => b.length - a.length);
}

export function normalizeWisdoSpeech(value = '') {
  return String(value).normalize('NFKC').toLowerCase().replace(/[â€™']/g, '').replace(/[^a-z0-9.$%_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractWisdoWakeCommand(value = '', phrases = configuredWakePhrases()) {
  const normalized = normalizeWisdoSpeech(value);
  for (const phrase of phrases) {
    const wake = normalizeWisdoSpeech(phrase);
    if (normalized === wake) return { matched: true, wakePhrase: phrase, command: '', wakeOnly: true };
    if (normalized.startsWith(`${wake} `)) return { matched: true, wakePhrase: phrase, command: normalized.slice(wake.length).trim(), wakeOnly: false };
  }
  return { matched: false, wakePhrase: null, command: normalized, wakeOnly: false };
}

export function extractSpokenNumber(text = '') {
  const normalized = normalizeWisdoSpeech(text);
  const numeric = normalized.match(/(?:\$\s*)?(-?(?:\d+(?:\.\d+)?|\.\d+))/);
  if (numeric) return Number(numeric[1]);
  for (const [word, number] of Object.entries(NUMBER_WORDS)) if (normalized.replace(/[- ]/g, '').includes(word)) return number;
  return null;
}

function moneyAfter(text, pattern) {
  const match = text.match(new RegExp(`${pattern}[^0-9$]{0,24}\\$?\\s*(\\d+(?:\\.\\d+)?)`, 'i'));
  return match ? Number(match[1]) : null;
}

function percentAfter(text, pattern) {
  const match = text.match(new RegExp(`${pattern}[^0-9]{0,24}(\\d+(?:\\.\\d+)?)\\s*(?:%|percent)`, 'i'));
  if (match) return Number(match[1]);
  const words = text.match(new RegExp(`${pattern}.{0,24}?(zero|one|two|three|four|five|six|seven|eight|nine|ten|twenty|twenty[- ]?five|fifty|hundred)[- ]*(?:%|percent)`, 'i'));
  return words ? extractSpokenNumber(words[1]) : null;
}

function percentBefore(text, pattern) {
  const match=text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:%|percent)[^a-z0-9]{0,8}${pattern}`,'i'));
  if(match)return Number(match[1]);
  const words=text.match(new RegExp(`(zero|one|two|three|four|five|six|seven|eight|nine|ten|twenty|twenty[- ]?five|fifty|hundred)[- ]*(?:%|percent)[^a-z0-9]{0,8}${pattern}`,'i'));
  return words?extractSpokenNumber(words[1]):null;
}

function command(intent, commandName, parameters = {}, confidence = 0.95, extra = {}) {
  return { schemaVersion: INTENT_SCHEMA_VERSION, type: 'ACTION', intent, commandName, parameters, confidence, ...extra };
}

export function validateStructuredIntent(value) {
  if (!value || typeof value !== 'object') return { ok: false, errors: ['intent_object_required'] };
  const errors = [];
  if (!['ACTION', 'QUERY', 'PLAN', 'CONVERSATION', 'CONFIRMATION', 'CANCEL', 'GOODBYE', 'CLARIFICATION'].includes(value.type)) errors.push('invalid_type');
  if (!value.intent || typeof value.intent !== 'string') errors.push('intent_required');
  const confidence = Number(value.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) errors.push('invalid_confidence');
  if (value.type === 'ACTION' && (!value.commandName || !MODEL_COMMAND_ALLOWLIST.has(String(value.commandName).toUpperCase()) || typeof value.parameters !== 'object' || Array.isArray(value.parameters))) errors.push('invalid_action');
  return { ok: errors.length === 0, errors, value };
}

export class WisdoIntentService {
  constructor({ provider = null, confidenceThreshold = Number(process.env.WISDO_ACTION_CONFIDENCE || 0.72) } = {}) {
    this.provider = provider;
    this.confidenceThreshold = confidenceThreshold;
  }

  deterministic(text, context = {}) {
    const raw = String(text || '').trim();
    const ask = normalizeWisdoSpeech(raw);
    const base = { schemaVersion: INTENT_SCHEMA_VERSION, rawText: raw, confidence: 0.92, parameters: {} };
    if (!ask) return { ...base, type: 'CONVERSATION', intent: 'WAKE_ONLY', confidence: 1 };
    if (/^(goodbye|bye|thats all|that is all|end session)$/.test(ask)) return { ...base, type: 'GOODBYE', intent: 'END_SESSION', confidence: 1 };
    if (/^(cancel|never mind|cancel what i just said|forget that)$/.test(ask)) return { ...base, type: 'CANCEL', intent: 'CANCEL_PENDING', confidence: 1 };
    if (/confirm coach (execute|activate todays plan)/.test(ask)) return { ...base, type: 'CONFIRMATION', intent: ask.includes('activate') ? 'CONFIRM_PLAN' : 'CONFIRM_ACTION', confidence: 1 };
    if (/new plan|build todays trading plan|plan for today|new strategy for this session|change how we trade today/.test(ask)) return { ...base, type: 'PLAN', intent: 'CREATE_DAILY_PLAN', confidence: 0.98 };
    if (/pause (that |the )?plan/.test(ask)) return { ...base, type: 'PLAN', intent: 'PAUSE_PLAN', confidence: 0.98 };
    if (/resume|continue/.test(ask) && /plan|where we left off/.test(ask)) return { ...base, type: 'PLAN', intent: 'RESUME_PLAN', confidence: 0.95 };
    if (/cancel|end/.test(ask) && /plan/.test(ask)) return { ...base, type: 'PLAN', intent: 'CANCEL_PLAN', confidence: 0.97 };
    if (/review|show|read back/.test(ask) && /plan/.test(ask)) return { ...base, type: 'PLAN', intent: 'REVIEW_PLAN', confidence: 0.95 };
    if (/how close|plan progress|goal progress|active plan status/.test(ask)) return { ...base, type: 'QUERY', intent: 'PLAN_PROGRESS', confidence: 0.95 };
    if (/change that|set that|leave .* runners? instead|apply that|remove the .* restriction/.test(ask)) return { ...base, type: 'PLAN', intent: 'MODIFY_PLAN', confidence: context.activePlanId ? 0.9 : 0.45, parameters: { value: extractSpokenNumber(ask) } };
    const planSignals = /daily profit|drawdown|runner|trail|account|allow buys|allow sells|stop trading|copier|risk/.test(ask);
    if (context.planMode && planSignals) return { ...base, type: 'PLAN', intent: 'ADD_PLAN_DETAILS', confidence: 0.9, parameters: this.extractPlanFields(raw) };

    if (/close (all|everything)( trades)?/.test(ask)) return command('CLOSE_ALL_TRADES', 'CLOSE_ALL_TRADES', {}, 0.99, { rawText: raw });
    if (/close (profitable|winning)|take winners|harvest/.test(ask)) return command('CLOSE_PROFITABLE_TRADES', 'CLOSE_ALL_WINNERS', { percent: extractSpokenNumber(ask) ?? 100 }, 0.97, { rawText: raw });
    if (/close (losing|losers)|cut losses/.test(ask)) return command('CLOSE_LOSING_TRADES', 'CLOSE_ALL_LOSERS', { percent: extractSpokenNumber(ask) ?? 100 }, 0.97, { rawText: raw });
    if (/emergency stop/.test(ask)) return command('EMERGENCY_STOP', 'EMERGENCY_STOP', { pauseTrading: true }, 0.99, { rawText: raw });
    if (/pause (the )?copier/.test(ask)) return command('PAUSE_COPIER', 'PAUSE_COPIER', {}, 0.98, { rawText: raw });
    if (/resume (the )?copier/.test(ask)) return command('RESUME_COPIER', 'RESUME_COPIER', {}, 0.98, { rawText: raw });
    if (/pause trading|stop new entries|stop trading today/.test(ask)) return command('STOP_NEW_ENTRIES', 'STOP_ENTRIES', {}, 0.97, { rawText: raw });
    if (/resume trading|start new entries/.test(ask)) return command('RESUME_TRADING', 'START_ENTRIES', {}, 0.97, { rawText: raw });
    if (/buy only|only allow buys|block sells/.test(ask)) return command('BUY_ONLY', 'CEM_SET_GLOBALS', { globals: { WISDO_ALLOW_BUYS: 1, WISDO_ALLOW_SELLS: 0 } }, 0.97, { rawText: raw });
    if (/sell only|only allow sells|block buys/.test(ask)) return command('SELL_ONLY', 'CEM_SET_GLOBALS', { globals: { WISDO_ALLOW_BUYS: 0, WISDO_ALLOW_SELLS: 1 } }, 0.97, { rawText: raw });
    if (/both directions|allow buys and sells/.test(ask)) return command('BOTH_DIRECTIONS', 'CEM_SET_GLOBALS', { globals: { WISDO_ALLOW_BUYS: 1, WISDO_ALLOW_SELLS: 1 } }, 0.97, { rawText: raw });
    if (/risk/.test(ask) && /percent|%/.test(ask)) return command('SET_RISK_PERCENT', 'CEM_SET_GLOBALS', { globals: { WISDO_RISK_PERCENT: extractSpokenNumber(ask) } }, extractSpokenNumber(ask) === null ? 0.4 : 0.94, { rawText: raw });
    if (/fixed lot|lot size/.test(ask)) return command('SET_FIXED_LOT', 'CEM_SET_GLOBALS', { globals: { WISDO_FIXED_LOT: extractSpokenNumber(ask) } }, extractSpokenNumber(ask) === null ? 0.4 : 0.94, { rawText: raw });
    if (/max(imum)? (open )?trades/.test(ask)) return command('SET_MAX_OPEN_TRADES', 'CEM_SET_GLOBALS', { globals: { WISDO_MAX_TRADES: extractSpokenNumber(ask) } }, extractSpokenNumber(ask) === null ? 0.4 : 0.94, { rawText: raw });
    if (/equity floor/.test(ask)) return command('SET_EQUITY_FLOOR', 'SET_EQUITY_FLOOR', { value: extractSpokenNumber(ask) }, extractSpokenNumber(ask) === null ? 0.4 : 0.94, { rawText: raw });
    if (/leave|preserve/.test(ask)&&/runners?/.test(ask)) return command('PRESERVE_RUNNER','WISDO_PRESERVE_RUNNER',{count:extractSpokenNumber(ask)||1},0.96,{rawText:raw,requiresCapability:true});
    if (/trail/.test(ask)&&/runner/.test(ask)) return command('TRAIL_RUNNER_GIVEBACK','WISDO_TRAIL_RUNNER',{givebackPercent:extractSpokenNumber(ask)},extractSpokenNumber(ask)===null?0.4:0.95,{rawText:raw,requiresCapability:true});
    if (/stop after (the )?next trade/.test(ask)) return command('STOP_AFTER_NEXT_TRADE','WISDO_STOP_AFTER_NEXT',{scope:'account'},0.96,{rawText:raw,requiresCapability:true});
    if (/stop after (the )?current trade/.test(ask)) return command('STOP_AFTER_CURRENT_TRADE','WISDO_STOP_AFTER_CURRENT',{scope:'account'},0.96,{rawText:raw,requiresCapability:true});
    if (/news avoidance|avoid news/.test(ask)) return command('NEWS_AVOIDANCE','WISDO_SET_NEWS_AVOIDANCE',{minutesBefore:30,minutesAfter:30},0.92,{rawText:raw,requiresCapability:true});
    if (/ladder/.test(ask)&&/close|preserve|trail/.test(ask)) return command('LADDER_AWARE_ACTION','WISDO_LADDER_ACTION',{action:/close/.test(ask)?'close':/trail/.test(ask)?'trail':'preserve'},0.85,{rawText:raw,requiresCapability:true});
    if (/explain/.test(ask)&&/trade|ticket/.test(ask)) return command('TRADE_EXPLANATION','WISDO_EXPLAIN_TRADE',{ticket:String(extractSpokenNumber(ask)||'')},0.9,{rawText:raw,requiresCapability:true});
    if (/balance|equity|margin|drawdown|open trades|connection status|account status|how does my account/.test(ask)) return { ...base, type: 'QUERY', intent: 'ACCOUNT_STATUS', confidence: 0.94 };
    if (/menu|everything i can do|available on my dashboard/.test(ask)) return { ...base, type: 'QUERY', intent: 'DYNAMIC_MENU', confidence: 0.94 };
    if (/teach|education|lesson|quiz|explain risk|explain the copier/.test(ask)) return { ...base, type: 'QUERY', intent: 'EDUCATION', confidence: 0.9 };

    return { ...base, type: 'CONVERSATION', intent: 'GENERAL_CONVERSATION', confidence: 0.55 };
  }

  extractPlanFields(raw) {
    const text = normalizeWisdoSpeech(raw);
    const fields = {};
    const risk = percentAfter(text, 'risk') ?? percentBefore(text,'risk');
    const drawdown = percentAfter(text, 'drawdown') ?? percentBefore(text,'drawdown');
    const profit = moneyAfter(text, '(?:make|profit|goal|target)');
    const loss = moneyAfter(text, '(?:lose|loss|daily loss)');
    const runner = text.match(/leave\s+(\d+|one|two|three)\s+runners?/);
    if (risk !== null) fields.risk = { mode: 'PERCENT', value: risk };
    if (drawdown !== null) fields.limits = { ...(fields.limits || {}), maxDrawdownPercent: drawdown };
    if (loss !== null) fields.limits = { ...(fields.limits || {}), maxDailyLossUsd: loss };
    if (profit !== null) fields.targets = { dailyProfitUsd: profit };
    if (/gold|xauusd/.test(text)) fields.symbols = ['XAUUSD'];
    const account = text.match(/account\s+([a-z0-9:_-]+)/);
    if (account) fields.accountIds = [account[1]];
    if (/buys? and sells?|both directions/.test(text)) fields.directions = ['BUY', 'SELL'];
    else if (/buy only|only buys/.test(text)) fields.directions = ['BUY'];
    else if (/sell only|only sells/.test(text)) fields.directions = ['SELL'];
    if (runner) fields.runnerCount = extractSpokenNumber(runner[1]);
    fields.targetActions = [];
    if (/close profitable|close winners/.test(text)) fields.targetActions.push('CLOSE_PROFITABLE_TRADES');
    if (/runner/.test(text)) fields.targetActions.push('LEAVE_BEST_RUNNER');
    const trail = percentAfter(text, 'trail(?: it| the runner)? at');
    if (trail !== null) fields.targetActions.push(`TRAIL_RUNNER_${trail}_PERCENT`);
    if (/stop (new entries|trading)/.test(text)) fields.targetActions.push('STOP_NEW_ENTRIES');
    if (/pause (the )?copier/.test(text)) fields.targetActions.push('PAUSE_COPIER');
    return fields;
  }

  async parse(text, context = {}) {
    const deterministic = this.deterministic(text, context);
    if (deterministic.confidence >= this.confidenceThreshold || !this.provider) return deterministic;
    const generated = await this.provider.extractIntent?.({ text, context, schemaVersion: INTENT_SCHEMA_VERSION });
    const validation = validateStructuredIntent(generated);
    if (!validation.ok) return deterministic;
    const parameters = Object.fromEntries(Object.entries(generated.parameters || {}).filter(([, value]) => value !== null));
    return { ...generated, parameters, rawText: String(text) };
  }
}
