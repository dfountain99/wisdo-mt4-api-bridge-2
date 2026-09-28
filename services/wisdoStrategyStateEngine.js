// WISDO Strategy State Engine V1
// Pure compiler: user intent + campaign telemetry + hard limits -> proposed EA actions.
// This module never queues or executes an MT4 command.

export const WISDO_STATES = Object.freeze({
  WATCHING: 'WATCHING',
  BUILDING: 'BUILDING',
  PRESSING: 'PRESSING',
  HARVESTING: 'HARVESTING',
  DEFENDING: 'DEFENDING',
  COMPLETE: 'COMPLETE',
});

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value ?? 0)));
const finite = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeStrategyState(raw = {}) {
  const state = Object.values(WISDO_STATES).includes(String(raw.state || '').toUpperCase())
    ? String(raw.state).toUpperCase()
    : WISDO_STATES.WATCHING;
  return {
    version: 1,
    state,
    dimensions: {
      participation: clamp(raw.dimensions?.participation ?? 35),
      pressure: clamp(raw.dimensions?.pressure ?? 20),
      patience: clamp(raw.dimensions?.patience ?? 70),
      protection: clamp(raw.dimensions?.protection ?? 35),
      harvest: clamp(raw.dimensions?.harvest ?? 15),
    },
    objective: {
      type: String(raw.objective?.type || 'campaign').toLowerCase(),
      value: finite(raw.objective?.value),
    },
    entry: {
      enabled: raw.entry?.enabled !== false,
      nextQualified: Boolean(raw.entry?.nextQualified),
      pullback: Boolean(raw.entry?.pullback),
      reclaim: Boolean(raw.entry?.reclaim),
      continuation: Boolean(raw.entry?.continuation),
      boostCapacity: Math.max(0, Math.min(10, Math.floor(finite(raw.entry?.boostCapacity, 0)))),
    },
    limits: {
      maxExposurePct: clamp(raw.limits?.maxExposurePct ?? 100, 0, 100),
      maxBoostEntries: Math.max(0, Math.min(10, Math.floor(finite(raw.limits?.maxBoostEntries, 3)))),
    },
    updatedAt: raw.updatedAt || null,
  };
}

const stateProfiles = {
  WATCHING: { participation: 25, pressure: 10, patience: 85, protection: 35, harvest: 10 },
  BUILDING: { participation: 65, pressure: 45, patience: 60, protection: 40, harvest: 15 },
  PRESSING: { participation: 85, pressure: 80, patience: 35, protection: 45, harvest: 20 },
  HARVESTING: { participation: 20, pressure: 10, patience: 35, protection: 75, harvest: 85 },
  DEFENDING: { participation: 0, pressure: 0, patience: 20, protection: 95, harvest: 80 },
  COMPLETE: { participation: 0, pressure: 0, patience: 100, protection: 100, harvest: 100 },
};

export function transitionStrategy(current, nextState, patch = {}) {
  const next = String(nextState || '').toUpperCase();
  if (!stateProfiles[next]) throw new Error('unsupported_strategy_state');
  const base = normalizeStrategyState(current);
  return normalizeStrategyState({
    ...base,
    ...patch,
    state: next,
    dimensions: { ...base.dimensions, ...stateProfiles[next], ...(patch.dimensions || {}) },
    entry: { ...base.entry, ...(patch.entry || {}) },
    limits: { ...base.limits, ...(patch.limits || {}) },
    objective: { ...base.objective, ...(patch.objective || {}) },
    updatedAt: new Date().toISOString(),
  });
}

export function applyStrategyIntent(current, intent = {}) {
  const base = normalizeStrategyState(current);
  const type = String(intent.type || intent.action || '').toUpperCase();
  if (type === 'SET_STATE') return transitionStrategy(base, intent.state);
  if (type === 'PRESS_HARDER') return transitionStrategy(base, WISDO_STATES.PRESSING, {
    dimensions: { pressure: clamp(base.dimensions.pressure + finite(intent.amount, 15)) },
  });
  if (type === 'DEFEND') return transitionStrategy(base, WISDO_STATES.DEFENDING, { entry: { enabled: false, boostCapacity: 0 } });
  if (type === 'STOP_ADDING') return normalizeStrategyState({ ...base, entry: { ...base.entry, enabled: false, nextQualified: false, boostCapacity: 0 }, updatedAt: new Date().toISOString() });
  if (type === 'RESUME_ADDING') return normalizeStrategyState({ ...base, entry: { ...base.entry, enabled: true }, updatedAt: new Date().toISOString() });
  if (type === 'ADD_ENTRY') return normalizeStrategyState({ ...base, entry: { ...base.entry, enabled: true, nextQualified: true }, updatedAt: new Date().toISOString() });
  if (type === 'BOOST_ENTRY') {
    const requested = Math.max(1, Math.floor(finite(intent.count, 1)));
    const capacity = Math.min(requested, base.limits.maxBoostEntries);
    return normalizeStrategyState({ ...base, entry: { ...base.entry, enabled: true, nextQualified: true, boostCapacity: capacity }, updatedAt: new Date().toISOString() });
  }
  if (type === 'SET_OBJECTIVE') return normalizeStrategyState({ ...base, objective: { type: intent.objectiveType || base.objective.type, value: finite(intent.value, base.objective.value) }, updatedAt: new Date().toISOString() });
  throw new Error('unsupported_strategy_intent');
}

export function compileStrategyToEa(previousRaw, nextRaw, telemetry = {}) {
  const previous = normalizeStrategyState(previousRaw);
  const next = normalizeStrategyState(nextRaw);
  const actions = [];
  const exposurePct = clamp(telemetry.exposurePct ?? 0);
  const exposureRemainingPct = Math.max(0, next.limits.maxExposurePct - exposurePct);
  const canAdd = next.entry.enabled && exposureRemainingPct > 0;

  if (previous.entry.enabled !== next.entry.enabled) {
    actions.push({ action: next.entry.enabled ? 'START_ENTRIES' : 'STOP_ENTRIES', reason: 'strategy_entry_authority_changed' });
  }
  if (next.entry.nextQualified && !previous.entry.nextQualified && canAdd) {
    actions.push({ action: 'EVALUATE_ENTRY', mode: 'next_qualified', reason: 'strategy_requested_add' });
  }
  if (next.entry.boostCapacity > previous.entry.boostCapacity && canAdd) {
    actions.push({
      action: 'BOOST_ENTRY',
      mode: 'qualified_only',
      maxAdditionalEntries: Math.min(next.entry.boostCapacity, next.limits.maxBoostEntries),
      exposureRemainingPct,
      reason: 'strategy_pressure_boost',
    });
  }
  if (next.state === WISDO_STATES.DEFENDING && previous.state !== next.state) {
    actions.push({ action: 'PROTECT_RAIL', reason: 'strategy_entered_defending' });
  }
  if (next.state === WISDO_STATES.HARVESTING && previous.state !== next.state) {
    actions.push({ action: 'HARVEST_PROFIT', reason: 'strategy_entered_harvesting' });
  }

  return {
    version: 1,
    previous,
    next,
    telemetry: { exposurePct, exposureRemainingPct },
    actions,
    requiresPreview: actions.length > 0,
    executionPolicy: 'propose_preview_hold_confirm_ea_ack',
  };
}
