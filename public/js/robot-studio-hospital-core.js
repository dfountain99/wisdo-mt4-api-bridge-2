/**
 * WISDO Bot Hospital — source-aware X-ray, nonexecuting.
 * Deliberately NOT a full MQL parser/compiler. Function-call links are
 * reference evidence, never represented as proven execution ordering.
 * The original source is authoritative; unmapped logic is never rewritten.
 */
import { analyzeMqlSource, patchImportedSource } from './robot-studio-import-core.js';

const MODULES = Object.freeze([
  ['structure', 'Market structure & entry', 'activity', /\b(bos|breakout|structure|zigzag|swing|trend|arrow|reversal|fvg|reclaim|channel|oracle|marketdna|signal|entry|weight)\b/i],
  ['sonic', 'SONIC & ladder', 'zap', /\b(sonic|ladder|pyramid|grid|scale|nitro|evidence|addtrade|addon|rapid|spacing)\b/i],
  ['campaign', 'Campaign & state', 'git-branch', /\b(campaign|compound|state|phase|milestone|guardian|station|kingdom|evolution)\b/i],
  ['risk', 'Risk & margin', 'shield', /\b(risk|margin|equity|balance|exposure|drawdown|lot|firewall|safety)\b/i],
  ['protection', 'Stops & protection', 'lock', /\b(stop|trail|break.?even|protect|atr|ratchet|buffer|sl)\b/i],
  ['collection', 'Profit & exits', 'target', /\b(profit|collect|harvest|close|exit|takeprofit|tp|vault|peel|runner|settle)\b/i],
  ['session', 'Session & schedule', 'clock', /\b(time|hour|timer|session|cooldown|minute|schedule|pause)\b/i],
  ['bridge', 'Account, server & dashboard', 'radio', /\b(api|bridge|server|voice|discord|web|command|account|report|dash|panel|draw|object|ui)\b/i],
  ['custom', 'Other custom functions', 'code', /./]
]);
// Word boundaries do not split PascalCase or snake_case. Expand at lexical
// case changes and underscores before categorizing, preserving raw names.
const words = (s) => String(s).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').replace(/[_\d]+/g, ' ');
export function classifyHospitalSymbol(symbol) {
  const name = words(symbol);
  for (const [id, , , re] of MODULES) if (re.test(name)) return id;
  return 'custom';
}

function maskMql(source) {
  let mode = 'code', result = '';
  for (let i = 0; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (mode === 'code') {
      if (c === '/' && n === '/') { result += '  '; i++; mode = 'line'; continue; }
      if (c === '/' && n === '*') { result += '  '; i++; mode = 'block'; continue; }
      if (c === '"' || c === "'") { result += ' '; mode = c; continue; }
      result += c;
    } else if (mode === 'line') {
      result += c === '\n' || c === '\r' ? c : ' ';
      if (c === '\r' || c === '\n') mode = 'code';
    } else if (mode === 'block') {
      if (c === '*' && n === '/') { result += '  '; i++; mode = 'code'; }
      else result += c === '\r' || c === '\n' ? c : ' ';
    } else if (c === '\\' && i + 1 < source.length) {
      result += ' '; i++; result += source[i] === '\r' || source[i] === '\n' ? source[i] : ' ';
    } else if (c === mode) { result += ' '; mode = 'code'; }
    else result += c === '\r' || c === '\n' ? c : ' ';
  }
  return result;
}
function makeLocator(mask) {
  const depths = new Uint16Array(mask.length + 1), lineStarts = [0];
  let level = 0;
  for (let i = 0; i < mask.length; i++) {
    depths[i] = level;
    if (mask[i] === '{') level++;
    else if (mask[i] === '}') level = Math.max(0, level - 1);
    if (mask[i] === '\n') lineStarts.push(i + 1);
  }
  depths[mask.length] = level;
  function line(offset) {
    let lo = 0, hi = lineStarts.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (lineStarts[mid] <= offset) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  return { depths, line, totalLines: lineStarts.length, finalDepth: level };
}
function parseEnums(source, mask, locator) {
  const enums = [];
  const re = /\benum\s+([A-Za-z_]\w*)\s*\{/g;
  let found;
  while ((found = re.exec(mask))) {
    if (locator.depths[found.index] !== 0) continue;
    const open = mask.indexOf('{', found.index), close = mask.indexOf('}', open + 1);
    if (close < 0) continue;
    const body = mask.slice(open + 1, close);
    const options = [];
    let previous = null;
    for (const token of body.split(',')) {
      const m = /^\s*([A-Za-z_]\w*)\s*(?:=\s*([-+]?\d+))?\s*$/.exec(token);
      // Option names are editable regardless of computed numeric values.
      if (!m) continue;
      const numeric = m[2] === undefined ? (previous === null ? null : previous + 1) : Number(m[2]);
      if (Number.isSafeInteger(numeric)) previous = numeric;
      else previous = null;
      options.push({ name: m[1], numeric: previous });
    }
    enums.push({ name: found[1], line: locator.line(found.index), options, start: found.index, end: close + 1 });
    re.lastIndex = close + 1;
  }
  return enums;
}
function matchParen(mask, open) {
  if (mask[open] !== '(') return -1;
  let level = 1;
  for (let i = open + 1; i < mask.length; i++) {
    if (mask[i] === '(') level++;
    if (mask[i] === ')' && --level === 0) return i;
    // previous -- only applies to close parenthesis (handled below instead)
  }
  return -1;
}
// Parentheses and braces scanner with deterministic bounds.
function balancedEnd(mask, start, left, right) {
  if (mask[start] !== left) return -1;
  let depth = 0;
  for (let i = start; i < mask.length; i++) {
    if (mask[i] === left) depth++;
    else if (mask[i] === right && --depth === 0) return i;
  }
  return -1;
}
function parseFunctions(source, mask, loc) {
  const result = [];
  const defs = /\b([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*\(/g;
  let m;
  while ((m = defs.exec(mask))) {
    if (loc.depths[m.index] !== 0) continue;
    const beforeLine = mask.lastIndexOf('\n', m.index - 1) + 1;
    if (mask.slice(beforeLine, m.index).includes('#')) continue;
    const openParen = mask.indexOf('(', m.index), closeParen = balancedEnd(mask, openParen, '(', ')');
    if (closeParen < 0) continue;
    let bodyStart = closeParen + 1;
    while (/\s/.test(mask[bodyStart] || '')) bodyStart++;
    if (mask[bodyStart] !== '{' || loc.depths[bodyStart] !== 0) continue;
    const end = balancedEnd(mask, bodyStart, '{', '}');
    if (end < 0) continue;
    const name = m[2];
    result.push({
      id: 'function-' + m.index, name, type: m[1],
      line: loc.line(m.index), endLine: loc.line(end),
      bodyStart, bodyEnd: end + 1,
      category: classifyHospitalSymbol(name),
      calls: [], inbound: 0
    });
    defs.lastIndex = end + 1;
  }
  const names = new Set(result.map(f => f.name));
  const incoming = new Map();
  for (const f of result) {
    const body = mask.slice(f.bodyStart + 1, f.bodyEnd - 1);
    const callRe = /\b([A-Za-z_]\w*)\s*\(/g, found = new Set();
    let call;
    while ((call = callRe.exec(body))) if (names.has(call[1])) found.add(call[1]);
    f.calls = [...found].slice(0, 250);
    for (const called of f.calls) incoming.set(called, (incoming.get(called) || 0) + 1);
  }
  for (const f of result) f.inbound = incoming.get(f.name) || 0;
  return result;
}
function hospitalReport(source, mask, base, funcs, enums, loc) {
  const findings = [];
  function note(severity, title, detail, count = 0) { findings.push({ severity, title, detail, count }); }
  const includeLines = source.split(/\r?\n/).filter(x => /^\s*#\s*include\b/.test(x));
  if (includeLines.length) note('review', 'External include dependencies', includeLines.length + ' include directive(s) found. This file alone cannot verify their existence or compatibility.', includeLines.length);
  const imports = source.split(/\r?\n/).filter(x => /^\s*#\s*import\b/.test(x));
  if (imports.length) note('review', 'External imports', imports.length + ' import directive(s). Review linked libraries and execution permissions.', imports.length);
  const customCount = (mask.match(/\biCustom\s*\(/g) || []).length;
  if (customCount) note('review', 'Custom indicator dependency', customCount + ' iCustom call(s) found. Related indicator files may be needed.', customCount);
  const orderCalls = (mask.match(/\b(?:OrderSend|OrderSendAsync|OrderModify|OrderClose|OrderDelete)\s*\(/g) || []).length;
  if (orderCalls) note('review', 'Trade execution paths', orderCalls + ' direct order API call(s) detected. No broker execution, spread or risk validation has been performed.', orderCalls);
  if (!funcs.some(f => ['OnTick','OnTimer','OnStart','start','OnCalculate'].includes(f.name)))
    note('review', 'No recognized event entry function', 'The importer did not identify an entry-point definition. Libraries and indicators can be valid without one.');
  if (loc.finalDepth) note('review', 'Brace balance needs review', 'The lexical scan finished with unmatched opening braces. This is not a compiler diagnosis.');
  const enumInputs = base.inputs.filter(x => enums.some(e => e.name === x.type && e.options.some(o => o.name === x.original)));
  note('info', 'Visual input coverage', base.inputs.filter(x => x.kind !== 'readonly').length + ' scalar inputs and ' + enumInputs.length + ' recognized enum dropdowns can be edited with exact-source patches.');
  note('info', 'Compiler required', 'No MQL compiler, terminal strategy tester, market-data backtest or semantic equivalence proof ran in the browser.');
  return findings;
}
export function analyzeHospitalSource(source, filename) {
  const base = analyzeMqlSource(source, filename);
  const masked = maskMql(source), locator = makeLocator(masked);
  const enums = parseEnums(source, masked, locator);
  const functions = parseFunctions(source, masked, locator);
  const enumByName = new Map(enums.map(e => [e.name, e]));
  const inputs = base.inputs.map(item => {
    const definition = enumByName.get(item.type);
    const options = definition?.options.map(o => o.name) || [];
    const enumEditable = options.includes(item.original);
    return { ...item, category: classifyHospitalSymbol(item.name),
      hospitalKind: enumEditable ? 'enum' : item.kind,
      options: enumEditable ? options : [] };
  });
  // Source-level references, not runtime values: expose the function(s) that
  // mention each input so a human can inspect the actual dependency before edits.
  const inputNames = new Set(inputs.map(i => i.name));
  const usage = new Map(inputs.map(i => [i.name, []]));
  for (const fn of functions) {
    const used = new Set();
    const identifiers = /\b[A-Za-z_]\w*\b/g;
    const body = masked.slice(fn.bodyStart + 1, fn.bodyEnd - 1);
    let match;
    while ((match = identifiers.exec(body))) if (inputNames.has(match[0])) used.add(match[0]);
    fn.usesInputs = [...used];
    for (const name of used) usage.get(name).push(fn.name);
  }
  for (const input of inputs) input.usedBy = [...new Set(usage.get(input.name) || [])];
  const groups = MODULES.map(([id, title, icon]) => {
    const members = functions.filter(f => f.category === id);
    const controls = inputs.filter(i => i.category === id);
    const categoryNames = new Set(members.map(f => f.name));
    const outgoing = [...new Set(members.flatMap(f => f.calls.filter(n => !categoryNames.has(n))))];
    return { id, title, icon, functions: members, inputs: controls, outgoing, total: members.length + controls.length };
  });
  const diagnostics = hospitalReport(source, masked, base, functions, enums, locator);
  return {
    filename, platform: base.platform, source, base, enums, functions, inputs,
    groups, diagnostics,
    stats: { lines: locator.totalLines, functions: functions.length, enums: enums.length,
      editable: inputs.filter(i => i.hospitalKind !== 'readonly').length,
      unresolved: inputs.filter(i => i.hospitalKind === 'readonly').length,
      references: functions.reduce((n, f) => n + f.calls.length, 0) }
  };
}
function editedLiteral(hospital, input, newValue) {
  if (input.hospitalKind === 'enum') {
    if (!input.options.includes(newValue)) throw new Error(input.name + ': unknown enum member.');
    return newValue;
  }
  if (input.hospitalKind === 'readonly') throw new Error(input.name + ': complex expression cannot be safely patched.');
  const changed = patchImportedSource(hospital.base, { [input.id]: newValue });
  const old = hospital.source;
  const start = input.start, tailLength = old.length - input.end;
  if (changed.slice(0, start) !== old.slice(0, start) ||
      changed.slice(changed.length - tailLength) !== old.slice(input.end))
    throw new Error('Source-map mismatch, edit rejected.');
  return changed.slice(start, changed.length - tailLength);
}
export function getHospitalChanges(hospital, updates = {}) {
  if (!hospital || typeof hospital.source !== 'string') throw new Error('Import source before editing.');
  const inputs = new Map(hospital.inputs.map(i => [i.id, i]));
  const changes = [];
  for (const [key, next] of Object.entries(updates)) {
    const input = inputs.get(key);
    if (!input) throw new Error('Unknown mapped hospital input: ' + key);
    const value = editedLiteral(hospital, input, next);
    if (value !== input.original) changes.push({
      name: input.name, line: input.line, from: input.original, to: value,
      start: input.start, end: input.end, category: input.category,
      referencedBy: input.usedBy || []
    });
  }
  return changes.sort((a, b) => b.start - a.start);
}
export function patchHospitalSource(hospital, updates = {}) {
  const patches = getHospitalChanges(hospital, updates);
  let code = hospital.source;
  for (const p of patches) {
    if (p.start < 0 || p.end > code.length || code.slice(p.start, p.end) !== p.from)
      throw new Error('Source changed since import. Edit aborted.');
    code = code.slice(0, p.start) + p.to + code.slice(p.end);
  }
  return code;
}
export function hospitalManifest(hospital, updates = {}) {
  const changes = getHospitalChanges(hospital, updates);
  return {
    schema: 'wisdo-bot-hospital-diagnosis-v1', filename: hospital.filename,
    platform: hospital.platform, analyzedAt: new Date().toISOString(),
    stats: hospital.stats, modules: hospital.groups.map(g => ({
      category: g.id, title: g.title,
      functions: g.functions.map(f => ({ name: f.name, line: f.line, calls: f.calls })),
      exposedInputs: g.inputs.map(i => i.name)
    })), diagnostics: hospital.diagnostics,
    changes: changes.map(({ name, line, from, to, category, referencedBy }) => ({ name, line, from, to, category, referencedBy })),
    compiled: false, backtested: false, equivalentToOriginal: changes.length === 0 ? 'source-unchanged' : 'not-verified'
  };
}
