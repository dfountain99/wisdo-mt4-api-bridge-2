/**
 * WISDO Robot Studio MQL source reconstruction (nonexecuting, lossless by default).
 *
 * This is NOT a full MQL4/MQL5 compiler or control-flow graph. It reads source,
 * identifies common trading constructs and literal input/extern declarations,
 * and allows ONLY precise input-default edits to the original source.
 * Any source that cannot be mapped is kept byte-for-byte as an opaque segment.
 */
export const MAX_SOURCE_BYTES = 4 * 1024 * 1024;

/** Decode common MetaTrader source encodings; reject undecodable files to avoid corruption. */
export function decodeMqlFile(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > MAX_SOURCE_BYTES) throw new Error('Source exceeds the 4 MB browser import limit.');
  if (bytes.byteLength === 0) throw new Error('Source file is empty.');
  let encoding = 'utf-8', offset = 0, bom = false;
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    encoding = 'utf-8'; offset = 3; bom = true;
  } else if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    encoding = 'utf-16le'; offset = 2; bom = true;
  } else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    encoding = 'utf-16be'; offset = 2; bom = true;
  } else {
    // Older MQL sources sometimes contain UTF-16 without a BOM.
    const sampled = Math.min(bytes.length, 512);
    let even = 0, odd = 0, pairs = 0;
    for (let i = 0; i + 1 < sampled; i += 2) {
      pairs++;
      if (bytes[i] === 0) even++;
      if (bytes[i + 1] === 0) odd++;
    }
    if (pairs >= 8 && odd / pairs > 0.3 && even / pairs < 0.08) encoding = 'utf-16le';
    if (pairs >= 8 && even / pairs > 0.3 && odd / pairs < 0.08) encoding = 'utf-16be';
  }
  try {
    const text = new TextDecoder(encoding, { fatal: true }).decode(bytes.subarray(offset));
    if (text.includes('\0')) throw new Error('Binary NUL characters were detected.');
    if (!text.trim()) throw new Error('Source file has no code.');
    return { text, encoding, bom };
  } catch (error) {
    throw new Error('Source encoding was not readable without data loss (UTF-8/UTF-16 supported): ' + error.message);
  }
}

/** Preserve the imported encoding and BOM when exporting modified source. */
export function encodeMqlSource(text, codec = {}) {
  const encoding = codec.encoding || 'utf-8';
  const bom = codec.bom === true;
  if (typeof text !== 'string') throw new Error('Source text is required.');
  if (encoding === 'utf-8') {
    const encoded = new TextEncoder().encode(text);
    if (!bom) return encoded;
    const withBom = new Uint8Array(encoded.length + 3);
    withBom.set([0xEF, 0xBB, 0xBF]);
    withBom.set(encoded, 3);
    return withBom;
  }
  if (encoding !== 'utf-16le' && encoding !== 'utf-16be') throw new Error('Unsupported source encoding.');
  const out = new Uint8Array(text.length * 2 + (bom ? 2 : 0));
  if (bom) out.set(encoding === 'utf-16le' ? [0xFF, 0xFE] : [0xFE, 0xFF]);
  const offset = bom ? 2 : 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (encoding === 'utf-16le') { out[offset + 2*i] = code & 255; out[offset + 2*i + 1] = code >>> 8; }
    else { out[offset + 2*i] = code >>> 8; out[offset + 2*i + 1] = code & 255; }
  }
  return out;
}


const KEYWORDS = [
  ['tick', 'OnTick', 'OnTick() · Tick event'],
  ['timer', 'OnTimer', 'OnTimer() · Scheduled event'],
  ['init', 'OnInit', 'OnInit() · Initialization'],
  ['deinit', 'OnDeinit', 'OnDeinit() · Cleanup'],
  ['start', 'OnStart', 'OnStart() · Script entry'],
  ['calculate', 'OnCalculate', 'OnCalculate() · Indicator event'],
  ['tester', 'OnTester', 'OnTester() · Strategy tester']
];
const SIGNALS = [
  ['EMA / MA', /\biMA\s*\(/g],
  ['RSI', /\biRSI\s*\(/g],
  ['MACD', /\biMACD\s*\(/g],
  ['Bollinger Bands', /\biBands\s*\(/g],
  ['ATR', /\biATR\s*\(/g],
  ['Stochastic', /\biStochastic\s*\(/g],
  ['Custom indicator', /\biCustom\s*\(/g],
  ['Indicator buffer', /\bCopyBuffer\s*\(/g],
  ['Ichimoku', /\biIchimoku\s*\(/g],
  ['ADX', /\biADX\s*\(/g],
  ['Fractals', /\biFractals\s*\(/g],
  ['ZigZag reference', /\bZigZag\b/g]
];
const EXECUTIONS = [
  ['MQL4 OrderSend', /\bOrderSend\s*\(/g],
  ['MQL4 OrderClose', /\bOrderClose\s*\(/g],
  ['MQL4 OrderModify', /\bOrderModify\s*\(/g],
  ['MQL4 OrderDelete', /\bOrderDelete\s*\(/g],
  ['MQL5 CTrade Buy', /\b[A-Za-z_]\w*\s*\.\s*Buy\s*\(/g],
  ['MQL5 CTrade Sell', /\b[A-Za-z_]\w*\s*\.\s*Sell\s*\(/g],
  ['MQL5 PositionClose', /\b[A-Za-z_]\w*\s*\.\s*PositionClose\s*\(/g],
  ['MQL5 PositionModify', /\b[A-Za-z_]\w*\s*\.\s*PositionModify\s*\(/g],
  ['MQL5 trade request', /\bOrderSendAsync\s*\(|\bOrderSend\s*\(/g]
];

function maskSource(source) {
  // Equal-length view: blank quoted strings and comments while retaining newlines,
  // so tokens in explanatory comments cannot become fake strategy blocks.
  let out = '';
  let mode = 'code';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (mode === 'code') {
      if (ch === '/' && next === '/') { out += '  '; i++; mode = 'line'; continue; }
      if (ch === '/' && next === '*') { out += '  '; i++; mode = 'block'; continue; }
      if (ch === '"' || ch === "'") { out += ' '; mode = ch; continue; }
      out += ch;
    } else if (mode === 'line') {
      out += ch === '\n' || ch === '\r' ? ch : ' ';
      if (ch === '\n' || ch === '\r') mode = 'code';
    } else if (mode === 'block') {
      if (ch === '*' && next === '/') { out += '  '; i++; mode = 'code'; }
      else out += ch === '\n' || ch === '\r' ? ch : ' ';
    } else {
      if (ch === '\\' && next !== undefined) {
        out += ' ';
        i++;
        out += source[i] === '\n' || source[i] === '\r' ? source[i] : ' ';
      } else if (ch === mode) { out += ' '; mode = 'code'; }
      else out += ch === '\n' || ch === '\r' ? ch : ' ';
    }
  }
  return out;
}

function lineNumber(text, offset) {
  let result = 1;
  for (let i = 0; i < offset; i++) if (text[i] === '\n') result++;
  return result;
}

function insideGlobal(mask) {
  // Precompute scope from curly braces; quoted strings/comments are blank.
  const level = new Uint16Array(mask.length + 1);
  let nesting = 0;
  for (let i = 0; i < mask.length; i++) {
    level[i] = nesting;
    if (mask[i] === '{') nesting++;
    else if (mask[i] === '}') nesting = Math.max(0, nesting - 1);
  }
  level[mask.length] = nesting;
  return level;
}

function decodeLiteral(type, expression) {
  const value = expression.trim();
  if (/^(?:bool)$/i.test(type) && /^(true|false)$/i.test(value)) {
    return { kind: 'bool', value: value.toLowerCase() === 'true' };
  }
  if (/^(int|long|short|uint|ulong|ushort|char|uchar)$/i.test(type) && /^[-+]?\d+$/.test(value)) {
    const n = Number(value);
    if (Number.isSafeInteger(n)) return { kind: 'integer', value: n };
  }
  if (/^(double|float)$/i.test(type) && /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(value)) {
    const n = Number(value);
    if (Number.isFinite(n)) return { kind: 'decimal', value: n };
  }
  if (/^string$/i.test(type) && /^"(?:[^"\\]|\\.)*"$/s.test(value)) {
    try { return { kind: 'string', value: JSON.parse(value) }; } catch { /* preserve MQL-specific literals */ }
  }
  return { kind: 'readonly', value };
}

function encodeLiteral(kind, value) {
  if (kind === 'bool') {
    if (typeof value !== 'boolean') throw new Error('Expected a true/false switch.');
    return value ? 'true' : 'false';
  }
  if (kind === 'integer') {
    if (!Number.isSafeInteger(Number(value)) || String(value).trim() === '') throw new Error('Expected a whole number.');
    return String(Number(value));
  }
  if (kind === 'decimal') {
    const n = Number(value);
    if (!Number.isFinite(n) || String(value).trim() === '') throw new Error('Expected a finite number.');
    return String(n);
  }
  if (kind === 'string') {
    const s = String(value);
    if (s.length > 180 || /[\r\n\0]/.test(s)) throw new Error('String input must contain at most 180 characters on one line.');
    return JSON.stringify(s);
  }
  throw new Error('This source expression cannot be safely edited in the visual editor.');
}

function parseInputs(source, mask) {
  const nesting = insideGlobal(mask);
  const re = /\b(input|sinput|extern)\s*(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*=/g;
  const inputs = [];
  let match;
  while ((match = re.exec(mask))) {
    const offset = match.index;
    if (nesting[offset] !== 0) continue;
    // Skip a matching word inside a preprocessor directive.
    const startLine = mask.lastIndexOf('\n', offset - 1) + 1;
    if (mask.slice(startLine, offset).includes('#')) continue;
    const rhsStart = re.lastIndex;
    let semi = mask.indexOf(';', rhsStart);
    if (semi < 0 || semi - rhsStart > 1000) continue;
    if (nesting[semi] !== 0) continue;
    const before = source.slice(rhsStart, semi);
    const leading = (before.match(/^\s*/) || [''])[0].length;
    const trailing = (before.match(/\s*$/) || [''])[0].length;
    const valueStart = rhsStart + leading;
    const valueEnd = semi - trailing;
    const expression = source.slice(valueStart, valueEnd);
    if (!expression) continue;
    const [, modifier, type, name] = match;
    const decoded = decodeLiteral(type, expression);
    inputs.push({
      id: 'input-' + offset, name, modifier, type,
      original: expression, kind: decoded.kind, value: decoded.value,
      start: valueStart, end: valueEnd,
      line: lineNumber(source, offset)
    });
  }
  return inputs;
}


function parseSimpleConditions(source, mask) {
  // Deliberately limited: only a single bare identifier compared to a numeric
  // literal. Complex expressions remain opaque, not guessed or rewritten.
  const re = /\bif\s*\(\s*([A-Za-z_]\w*)\s*(<=|>=|==|!=|<|>)\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)\s*\)/g;
  const results = [];
  let match;
  while ((match = re.exec(mask))) {
    const expression = match[0];
    const opStart = match.index + expression.indexOf(match[2], expression.indexOf(match[1]) + match[1].length);
    const valueStart = match.index + expression.indexOf(match[3], expression.indexOf(match[2], expression.indexOf(match[1]) + match[1].length) + match[2].length);
    results.push({
      id: 'condition-' + match.index, lhs: match[1],
      operator: match[2], value: Number(match[3]),
      valueOriginal: match[3], operatorStart: opStart, operatorEnd: opStart + match[2].length,
      valueStart, valueEnd: valueStart + match[3].length, line: lineNumber(source, match.index)
    });
  }
  return results;
}

/**
 * Recognize high-confidence single-statement guard -> trade-call edges.
 * Nested/custom/multi-statement bodies are deliberately not guessed.
 * This does not make those actions rewritable; only the mapped comparison changes.
 */
function traceDirectTradeEdges(source, mask, conditions) {
  const links = [];
  const actionRE = /^(?:(OrderSend|OrderClose|OrderModify|OrderDelete|OrderSendAsync)\s*|([A-Za-z_]\w*)\s*\.\s*(Buy|Sell|PositionClose|PositionModify)\s*)\(/;
  for (const condition of conditions) {
    let p = mask.indexOf(')', condition.valueEnd);
    if (p < 0) continue;
    p++;
    while (/\s/.test(mask[p] || '')) p++;
    const braced = mask[p] === '{';
    if (braced) {
      p++;
      while (/\s/.test(mask[p] || '')) p++;
    }
    const action = actionRE.exec(mask.slice(p, p + 150));
    if (!action) continue;
    const actionName = action[1] || (action[2] + '.' + action[3]);
    let depth = 1, at = p + action[0].length;
    while (depth > 0 && at < mask.length && at < p + 10000) {
      if (mask[at] === '(') depth++;
      if (mask[at] === ')') depth--;
      at++;
    }
    if (depth !== 0) continue;
    while (/\s/.test(mask[at] || '')) at++;
    if (mask[at] !== ';') continue;
    at++;
    while (/\s/.test(mask[at] || '')) at++;
    if (braced && mask[at] !== '}') continue;
    links.push({
      id: 'wire-' + condition.id, from: condition.id, action: actionName,
      kind: 'direct-true-branch', line: lineNumber(source, p),
      confidence: 'single direct trade call'
    });
  }
  return links;
}

function detectionsFromRegex(mask, source, definitions, prefix, description) {
  const found = [];
  for (const [key, regex] of definitions) {
    regex.lastIndex = 0;
    let match;
    let count = 0;
    let first = -1;
    while ((match = regex.exec(mask))) {
      count++;
      if (first === -1) first = match.index;
      if (count >= 5000) break;
    }
    if (count) found.push({
      id: prefix + '-' + found.length, category: prefix, label: key, detail: description(count),
      count, line: lineNumber(source, first), editable: false
    });
  }
  return found;
}

function extractSpecial(mask, source, platform) {
  const nodes = [];
  for (const [key, name, label] of KEYWORDS) {
    const re = new RegExp('\\b' + name + '\\s*\\(', 'g');
    const match = re.exec(mask);
    if (match) nodes.push({ id: 'event-' + key, category: 'event', label, count: 1, line: lineNumber(source, match.index), detail: 'Recognized handler · internal logic retained in original code.', editable: false });
  }
  nodes.push(...detectionsFromRegex(mask, source, SIGNALS, 'signal', (n) => n + ' reference(s) found · read-only discovery'));
  nodes.push(...detectionsFromRegex(mask, source, EXECUTIONS, 'execution', (n) => n + ' call(s) found · read-only discovery'));
  const ifCount = (mask.match(/\bif\s*\(/g) || []).length;
  if (ifCount) nodes.push({ id: 'guard-if', category: 'guard', label: 'Conditional branches', detail: ifCount + ' if-statement(s) · dependencies may be nested', count: ifCount, line: 1, editable: false });
  if (/\b(?:iATR|StopLoss|stoploss|SL|TrailingStop|stopLoss)\b/.test(mask)) {
    nodes.push({ id: 'risk-protection', category: 'guard', label: 'Potential risk or stop logic', detail: 'Detected by names only · inspect original implementation', count: 1, line: 1, editable: false });
  }
  const includes = [...source.matchAll(/^\s*#\s*(?:include|import)\b[^\r\n]*/gm)].map((m) => m[0].trim()).slice(0, 30);
  if (includes.length) nodes.push({
    id: 'external-source', category: 'external', label: 'External code dependencies',
    detail: includes.length + ' include/import directive(s) · cannot analyze external files from this upload',
    count: includes.length, line: 1, editable: false
  });
  if (!nodes.some((node) => node.category === 'execution')) nodes.push({
    id: 'opaque-source', category: 'external', label: 'Custom/unknown execution logic',
    detail: 'No standard order placement call identified. Keep code unchanged.',
    count: 0, line: 1, editable: false
  });
  return { nodes, includes };
}

export function analyzeMqlSource(source, filename) {
  if (typeof source !== 'string' || !source.trim()) throw new Error('Choose a non-empty MQL4/MQL5 source file.');
  if (new TextEncoder().encode(source).byteLength > MAX_SOURCE_BYTES) throw new Error('Source exceeds the 4 MB browser import limit.');
  if (!/\.mq[45]$/i.test(filename || '')) throw new Error('Select a .mq4 or .mq5 SOURCE file (.ex4/.ex5 binaries are unsupported).');
  if (source.includes('\0')) throw new Error('A binary file was detected. Source code is required; compiled .ex4/.ex5 files cannot be reconstructed.');
  const platform = /\.mq4$/i.test(filename) ? 'MT4' : 'MT5';
  const mask = maskSource(source);
  const inputs = parseInputs(source, mask);
  const conditions = parseSimpleConditions(source, mask);
  const links = traceDirectTradeEdges(source, mask, conditions);
  const { nodes, includes } = extractSpecial(mask, source, platform);
  const inputNodes = inputs.map((input) => ({
    id: input.id, category: 'parameter', label: input.name,
    detail: input.type + ' · ' + input.modifier + ' · ' + (input.kind === 'readonly' ? 'computed default / review required' : 'editable literal'),
    count: 1, line: input.line, editable: input.kind !== 'readonly'
  }));
  const conditionNodes = conditions.map((condition) => ({
    id: condition.id, category: 'condition',
    label: condition.lhs + ' ' + condition.operator + ' ' + condition.valueOriginal,
    detail: 'Simple numeric condition · edit the operator or threshold below',
    count: 1, line: condition.line, editable: true
  }));
  const notices = [
    'This is a best-effort source explorer, not a full MQL parser. Discovered blocks are not a verified executable control-flow graph.',
    'Only mapped scalar input defaults and simple identifier-versus-number if-comparisons can update source. Complex logic stays read-only.',
    'Dragging blocks changes workspace arrangement ONLY, not execution order or trade logic.',
    'All unmapped logic and comments remain in the original source when exporting.'
  ];
  if (includes.length) notices.push('External includes/imports are not bundled. Keep their dependencies when compiling.');
  if (!inputs.length) notices.push('No directly editable scalar input/extern literals were found.');
  if (platform === 'MT5') notices.push('MQL5 uses different order and indicator APIs than MQL4; no automatic MT4/MT5 conversion is performed.');
  return {
    filename, source, platform, inputs, conditions, links,
    nodes: [...inputNodes, ...conditionNodes, ...nodes],
    notices, stats: {
      lines: source.split(/\r?\n/).length,
      inputs: inputs.length,
      editableInputs: inputs.filter((i) => i.kind !== 'readonly').length,
      editableConditions: conditions.length,
      blocks: inputNodes.length + conditionNodes.length + nodes.length
    }
  };
}

export function patchImportedSource(analysis, updates = {}) {
  if (!analysis || typeof analysis.source !== 'string' || !Array.isArray(analysis.inputs)) {
    throw new Error('Analyze an original source file before editing.');
  }
  const ids = new Set([...analysis.inputs.map((input) => input.id), ...(analysis.conditions || []).map((condition) => condition.id)]);
  for (const id of Object.keys(updates)) if (!ids.has(id)) throw new Error('Unknown input block: ' + id);
  const patches = [];
  for (const input of analysis.inputs) {
    if (!Object.prototype.hasOwnProperty.call(updates, input.id)) continue;
    if (input.kind === 'readonly') throw new Error(input.name + ': expression is read-only.');
    const value = encodeLiteral(input.kind, updates[input.id]);
    if (value !== input.original) patches.push({ start: input.start, end: input.end, value });
  }
  for (const condition of (analysis.conditions || [])) {
    if (!Object.prototype.hasOwnProperty.call(updates, condition.id)) continue;
    const update = updates[condition.id];
    if (!update || typeof update !== 'object') throw new Error('Invalid comparison block update.');
    const operator = update.operator ?? condition.operator;
    const value = update.value ?? condition.value;
    if (!['<', '>', '<=', '>=', '==', '!='].includes(operator)) throw new Error('Invalid comparison operator.');
    if (typeof value !== 'number' && typeof value !== 'string') throw new Error('Expected a numeric comparison threshold.');
    if (String(value).trim() === '' || !Number.isFinite(Number(value))) throw new Error('Expected a finite comparison threshold.');
    const rhs = String(Number(value));
    if (operator !== condition.operator) patches.push({ start: condition.operatorStart, end: condition.operatorEnd, value: operator });
    if (rhs !== condition.valueOriginal) patches.push({ start: condition.valueStart, end: condition.valueEnd, value: rhs });
  }
  patches.sort((a, b) => b.start - a.start);
  let result = analysis.source;
  for (const patch of patches) {
    if (patch.start < 0 || patch.end > result.length || patch.end <= patch.start) throw new Error('Source mapping is invalid; no changes applied.');
    result = result.slice(0, patch.start) + patch.value + result.slice(patch.end);
  }
  return result;
}

export function getSourceChanges(analysis, updates = {}) {
  const changed = [];
  for (const input of analysis.inputs) {
    if (!Object.prototype.hasOwnProperty.call(updates, input.id)) continue;
    const newValue = encodeLiteral(input.kind, updates[input.id]);
    if (newValue !== input.original) changed.push({
      name: input.name, from: input.original, to: newValue, line: input.line
    });
  }
  for (const condition of (analysis.conditions || [])) {
    if (!Object.prototype.hasOwnProperty.call(updates, condition.id)) continue;
    const update = updates[condition.id];
    if (!update || typeof update !== 'object') throw new Error('Invalid comparison block update.');
    const operator = update.operator ?? condition.operator;
    if (!['<', '>', '<=', '>=', '==', '!='].includes(operator) || !Number.isFinite(Number(update.value ?? condition.value)) || String(update.value ?? condition.value).trim() === '') throw new Error('Invalid comparison edit.');
    const threshold = String(Number(update.value ?? condition.value));
    if (operator !== condition.operator || threshold !== condition.valueOriginal) changed.push({
      name: 'IF ' + condition.lhs, from: condition.operator + ' ' + condition.valueOriginal,
      to: operator + ' ' + threshold, line: condition.line
    });
  }
  return changed;
}
