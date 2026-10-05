const ACTIONS = Object.freeze({ AUTO:'AUTO', PAUSE:'PAUSE', RESUME:'RESUME', SKIP:'SKIP', ARM_LEVEL:'ARM_LEVEL', VISUAL:'VISUAL' });

function numberAfter(text, expression) {
  const match = text.match(expression);
  return match ? Number(match[1].replaceAll(',', '')) : null;
}

export function compileWisdoCommand(transcript = '') {
  const text = String(transcript).trim().toLowerCase();
  if (!text) throw new Error('A voice or text command is required.');
  if (/\b(auto mode|normal behavior|go automatic)\b/.test(text)) return { action:ACTIONS.AUTO, args:[], confirmation:false };
  if (/\b(pause|stop new trades|hold trading)\b/.test(text)) return { action:ACTIONS.PAUSE, args:[], confirmation:false };
  if (/\b(resume|continue trading)\b/.test(text)) return { action:ACTIONS.RESUME, args:[], confirmation:false };
  const skip = numberAfter(text, /\bskip\s+(\d+)\s+(?:trade|signal)/);
  if (skip !== null) return { action:ACTIONS.SKIP, args:[Math.max(0, Math.floor(skip))], confirmation:false };
  if (/\b(blank|clean|gameplay)\s+(?:chart|mode)\b/.test(text)) return { action:ACTIONS.VISUAL, args:['GAMEPLAY'], confirmation:false };
  if (/\b(visual insight|show indicators|show heatmap)\b/.test(text)) return { action:ACTIONS.VISUAL, args:['INSIGHT'], confirmation:false };
  const level = numberAfter(text, /(?:level|at|near)\s+\$?([0-9][0-9,.]*)/);
  if (level !== null && /\b(wait|activate|arm|start trading|look for signals)\b/.test(text)) {
    const tolerance = numberAfter(text, /(?:within|tolerance)\s+(\d+(?:\.\d+)?)\s*(?:point|pip)?/i) ?? 100;
    return { action:ACTIONS.ARM_LEVEL, args:[level, tolerance], requireFvg:/\bfair value gap|\bfvg\b/.test(text), confirmation:false };
  }
  return { action:'UNRESOLVED', args:[], confirmation:true, reason:'Command needs clarification; no trading change was queued.' };
}

export function toMt4Line(plan) {
  if (!plan || plan.action === 'UNRESOLVED') throw new Error(plan?.reason || 'Unresolved command.');
  return [plan.action, ...plan.args].join('|');
}

export function assertExecutionAllowed({ demoOnly = true, accountMode = 'DEMO', confirmed = false } = {}) {
  if (demoOnly && String(accountMode).toUpperCase() !== 'DEMO') throw new Error('DEMO_ONLY blocks live-account voice execution.');
  if (!confirmed) throw new Error('Execution requires an authenticated confirmation token.');
}
