// Campaign protocol v1: the EA owns prices, assignments and the final decision.
export const CAMPAIGN_ACTIONS = Object.freeze({
  PAUSE_FOR: { code: 1, label: 'Pause entries for a duration' },
  AFTER_COMPOUND: { code: 2, label: 'After each compound milestone, wait for a new opposite candle' },
  AFTER_WIN: { code: 3, label: 'After each profitable close, pause entries' },
  EVALUATE_ENTRY: { code: 4, label: 'Evaluate current entry logic on the next tick' },
  CANCEL_GOAL: { code: 5, label: 'Cancel the standing intention' },
  END_AFTER: { code: 6, label: 'Close this campaign after a duration and pause entries' },
  AFTER_CAMPAIGN: { code: 7, label: 'After this campaign ends, pause entries for a duration' },
  ARM_SONIC: { code: 12, label: 'Arm a bounded SONIC window under normal EA entry gates' },
  TRAIL_STRUCTURE: { code: 13, label: 'Use Structure Keeper on selected trades' },
  TRAIL_PROFIT: { code: 14, label: 'Use Profit Vault on selected trades' },
  MOVE_TARGET: { code: 8, label: 'Move selected targets to a confirmed structure level' },
  PROTECT_RAIL: { code: 9, label: 'Tighten the campaign rail to confirmed structure' },
  ASSIGN_RUNNER: { code: 10, label: 'Assign selected trades as runners' },
  ASSIGN_COLLECTOR: { code: 11, label: 'Assign selected trades as collectors' },
  SET_STOP_ATR: { code: 15, label: 'Apply a live ATR stop policy now' },
  SET_TRAIL_ATR: { code: 16, label: 'Apply a live ATR trailing policy now' },
  TRIM_CAMPAIGN: { code: 17, label: 'Trim a percentage from the active campaign' },
  ADD_IF_VALID: { code: 18, label: 'Ask HIGHTOWER to add one position under normal entry gates' },
  CLEAR_RUNTIME_OVERRIDES: { code: 19, label: 'Return live stop and trail settings to the visible EA inputs' },
  WIDEN_EXISTING_STOPS: { code: 20, label: 'Intentionally widen existing live broker stops' },
  COUNTER_IF_VALID: { code: 21, label: 'Arm an opposite HIGHTOWER campaign after a verified stop event' },
  DIRECTIONAL_ENTRY_IF_VALID: { code: 22, label: 'Ask HIGHTOWER to open a requested BUY or SELL under normal safety gates' },
  ARM_TWO_MIN_SCALP: { code: 23, label: 'Arm the two-minute scalp watchdog; each new entry resets the clock' },
  SET_TRADING_SCHEDULE: { code: 24, label: 'Apply broker-time active trading windows for new entries' },
  CLEAR_TRADING_SCHEDULE: { code: 25, label: 'Restore the EA trading-window inputs' },
});
const num = (v, fallback = 0) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const bool = (v) => v === true;
const hour = (v) => Math.max(0, Math.min(23, Math.trunc(num(v, 0))));
const minute = (v) => Math.max(0, Math.min(59, Math.trunc(num(v, 0))));
const dayMinute = (v) => Math.max(0, Math.min(1439, Math.trunc(num(v, 0))));
const SESSION_NAMES = Object.freeze(['ASIA','LONDON','NEW YORK','LONDON/NY OVERLAP','ROLLOVER','OTHER']);
export function normalizeCampaignControl(value) {
  if (!value || value.version !== 1 || !/^[A-Za-z0-9_.#-]{1,24}$/.test(value.symbol || '') || !Number.isInteger(value.magic) || value.magic <= 0) return null;
  const levels = (Array.isArray(value.levels) ? value.levels : []).slice(0, 16)
    .filter(x => Number.isFinite(x.price) && x.price > 0 && Number.isInteger(x.id) && x.id > 0)
    .map(x => ({ id: x.id, price: x.price, kind: 'confirmed-pivot' }));
  const sessionReported = Number.isFinite(value.sessionId) && Number.isFinite(value.windowMode);
  const sessionId = Math.max(0, Math.min(5, Math.trunc(num(value.sessionId, 5))));
  const windowMode = Math.max(0, Math.min(2, Math.trunc(num(value.windowMode, 0))));
  const windowCount = windowMode === 2 ? Math.max(1, Math.min(2, Math.trunc(num(value.windowCount, 2)))) : 1;
  const w1StartMinute = Number.isFinite(value.window1StartMinute) ? dayMinute(value.window1StartMinute) : hour(value.window1Start) * 60;
  const w1EndMinute = Number.isFinite(value.window1EndMinute) ? dayMinute(value.window1EndMinute) : hour(value.window1End) * 60;
  const w2StartMinute = Number.isFinite(value.window2StartMinute) ? dayMinute(value.window2StartMinute) : hour(value.window2Start) * 60;
  const w2EndMinute = Number.isFinite(value.window2EndMinute) ? dayMinute(value.window2EndMinute) : hour(value.window2End) * 60;
  const configuredWindows = windowMode === 0
    ? [{ startMinute: 0, endMinute: 0, startHour: 0, endHour: 0, label: 'ALL HOURS' }]
    : windowMode === 1
      ? [{ startMinute: 420, endMinute: 1260, startHour: 7, endHour: 21, label: 'LONDON + NEW YORK' }]
      : [
          { startMinute: w1StartMinute, endMinute: w1EndMinute, startHour: Math.floor(w1StartMinute / 60), endHour: Math.floor(w1EndMinute / 60), label: 'WINDOW 1' },
          ...(windowCount > 1 ? [{ startMinute: w2StartMinute, endMinute: w2EndMinute, startHour: Math.floor(w2StartMinute / 60), endHour: Math.floor(w2EndMinute / 60), label: 'WINDOW 2' }] : []),
        ];
  return { version: 1, symbol: value.symbol, magic: value.magic,
    ageSeconds: value.ageSeconds >= 0 ? num(value.ageSeconds, 999999) : 999999, enabled: value.enabled === true,
    campaignId: num(value.campaignId), phase: num(value.phase), direction: num(value.direction),
    rail: num(value.rail), goal: num(value.goal), paused: value.paused === true,
    remainingSeconds: Math.max(0, num(value.remainingSeconds)), banked: num(value.banked),
    progress: {
      campaignBase: Math.max(0, num(value.campaignBase)),
      realized: num(value.campaignRealized),
      floating: num(value.campaignFloating),
      milestonePercent: Math.max(0, num(value.milestonePercent)),
      targetEquity: Math.max(0, num(value.targetEquity)),
    },
    session: {
      reported: sessionReported,
      id: sessionId,
      name: SESSION_NAMES[sessionId] || 'OTHER',
      quality: Math.max(0, num(value.sessionQuality, 0)),
      brokerHour: hour(value.brokerHour),
      brokerMinute: minute(value.brokerMinute),
      windowMode,
      windowCount,
      scheduleOverride: sessionReported ? bool(value.scheduleOverride) : null,
      scheduleEnforced: sessionReported ? bool(value.scheduleEnforced) : null,
      windowAllowed: sessionReported ? bool(value.windowAllowed) : null,
      entryAllowed: sessionReported ? bool(value.entryAllowed) : null,
      windows: configuredWindows,
    },
    marketSense: {
      intentScore: Math.max(0, Math.min(1, num(value.intentScore))),
      continuationProbability: Math.max(0, Math.min(1, num(value.continuationProbability))),
      reversalProbability: Math.max(0, Math.min(1, num(value.reversalProbability))),
      pressureBias: Math.max(-2, Math.min(2, num(value.pressureBias))),
      flowLeg: Math.max(0, Math.trunc(num(value.flowLeg))),
      continuationDefense: bool(value.continuationDefense),
    },
    runtime: {
      overrideMask: Math.max(0, Math.trunc(num(value.runtimeOverrideMask))),
      scope: Math.max(0, Math.min(2, Math.trunc(num(value.runtimeScope)))),
      stopAtr: Math.max(0.05, num(value.runtimeStopAtr, 1.5)),
      trailStartAtr: Math.max(0.05, num(value.runtimeTrailStartAtr, 1)),
      trailDistanceAtr: Math.max(0.05, num(value.runtimeTrailDistanceAtr, 0.75)),
      trailStepAtr: Math.max(0.01, num(value.runtimeTrailStepAtr, 0.15)),
    },
    burstRemaining: num(value.burstRemaining),
    acknowledgements: (Array.isArray(value.acknowledgements) ? value.acknowledgements : []).slice(0, 12).filter(x => Number.isSafeInteger(x.id) && x.id > 0).map(x => ({ id: x.id, status: num(x.status), changed: num(x.changed), requested: num(x.requested) })),
    ackId: num(value.ackId), ackStatus: num(value.ackStatus), pendingId: num(value.pendingId),
    levels, positions: (Array.isArray(value.positions) ? value.positions : []).slice(0, 100)
      .filter(x => Number.isInteger(x.ticket) && x.ticket > 0 && [0, 1, 2].includes(x.role))
      .map(x => ({ ticket: x.ticket, role: x.role })),
  };
}
function fail(message) { const error = new Error(message); error.statusCode = 409; throw error; }
export function campaignPacket(action, body, state) {
  const c = state.campaignControl;
  if (!c || !c.live) fail('A fresh campaign EA connection is required.');
  if (c.pendingId && c.pendingId !== c.ackId) fail('The EA is still processing an earlier command.');
  if (Number(body.eaCampaignId) !== c.campaignId) fail('Campaign changed. Preview the current campaign again.');
  const definition = CAMPAIGN_ACTIONS[action];
  if (!definition) fail('Unsupported campaign instruction.');
  const duration = Number(body.durationSeconds || 0);
  if ([1, 3, 6, 7, 12, 23].includes(definition.code) && (!Number.isInteger(duration) || duration < 1 || duration > 604800)) fail('Choose a duration between 1 second and 7 days.');
  if (definition.code === 23 && duration !== 120) fail('The two-minute scalp game plan uses a fixed 120-second reset window.');
  let scheduleMode = Number(body.scheduleMode ?? 0);
  let scheduleWindowCount = Number(body.scheduleWindowCount ?? 1);
  let window1StartMinute = Number(body.window1StartMinute ?? 0);
  let window1EndMinute = Number(body.window1EndMinute ?? 0);
  let window2StartMinute = Number(body.window2StartMinute ?? 0);
  let window2EndMinute = Number(body.window2EndMinute ?? 0);
  if (definition.code === 24) {
    if (![0, 1, 2].includes(scheduleMode) || !Number.isInteger(scheduleMode)) fail('Trading schedule mode must be ALL HOURS, LONDON + NEW YORK, or CUSTOM.');
    if (scheduleMode === 2) {
      if (![1, 2].includes(scheduleWindowCount) || !Number.isInteger(scheduleWindowCount)) fail('Custom schedule supports one or two active windows.');
      for (const value of [window1StartMinute, window1EndMinute, ...(scheduleWindowCount === 2 ? [window2StartMinute, window2EndMinute] : [])]) {
        if (!Number.isInteger(value) || value < 0 || value > 1439) fail('Trading schedule times must be broker-clock minutes from 00:00 through 23:59.');
      }
      if (window1StartMinute === window1EndMinute) fail('Window 1 start and end cannot match; use ALL HOURS for a full-day schedule.');
      if (scheduleWindowCount === 2 && window2StartMinute === window2EndMinute) fail('Window 2 start and end cannot match.');
    } else {
      scheduleWindowCount = 1;
      if (scheduleMode === 0) { window1StartMinute = 0; window1EndMinute = 0; window2StartMinute = 0; window2EndMinute = 0; }
      if (scheduleMode === 1) { window1StartMinute = 420; window1EndMinute = 1260; window2StartMinute = 0; window2EndMinute = 0; }
    }
  }
  if ([2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 23].includes(definition.code) && c.phase !== 1) fail('This instruction requires an active campaign.');
  const burstCount = Number(body.burstCount || 0);
  if (definition.code === 12 && (!Number.isInteger(burstCount) || burstCount < 1 || burstCount > 10)) fail('A SONIC window allows 1 to 10 entries, each subject to the normal EA gates.');
  const tickets = [...new Set(Array.isArray(body.tickets) ? body.tickets.map(Number) : [])];
  if ([8, 10, 11, 13, 14].includes(definition.code) && (!tickets.length || tickets.length > 12 || tickets.some(t => !c.positions.some(p => p.ticket === t && p.role !== 0)))) fail('Select up to 12 collectors or runners in this campaign; HOLD assignments stay protected.');
  if (definition.code === 17 && (tickets.length > 12 || tickets.some(t => !c.positions.some(p => p.ticket === t)))) fail('Trim targets must be active positions from this campaign.');
  let stopAtr = Number(body.stopAtr || 0);
  if ([15, 20].includes(definition.code) && (!Number.isFinite(stopAtr) || stopAtr < 0.05 || stopAtr > 20)) fail('ATR stop multiplier must be between 0.05 and 20.');
  let trailStartAtr = Number(body.trailStartAtr || 0);
  let trailDistanceAtr = Number(body.trailDistanceAtr || 0);
  let trailStepAtr = Number(body.trailStepAtr || 0);
  if (definition.code === 16) {
    if (Number.isFinite(Number(body.trailDeltaAtr)) && Number(body.trailDeltaAtr) !== 0) trailDistanceAtr = Number(c.runtime?.trailDistanceAtr || 0.75) + Number(body.trailDeltaAtr);
    if (!trailDistanceAtr) trailDistanceAtr = Number(c.runtime?.trailDistanceAtr || 0.75);
    if (!trailStartAtr) trailStartAtr = Number(c.runtime?.trailStartAtr || 1);
    if (!trailStepAtr) trailStepAtr = Number(c.runtime?.trailStepAtr || 0.15);
    if (![trailStartAtr, trailDistanceAtr].every(v => Number.isFinite(v) && v >= 0.05 && v <= 20) || !Number.isFinite(trailStepAtr) || trailStepAtr < 0.01 || trailStepAtr > 5) fail('ATR trail values are outside the supported live range.');
  }
  const trimPercent = Number(body.trimPercent || 0);
  if (definition.code === 17 && (!Number.isFinite(trimPercent) || trimPercent < 1 || trimPercent > 99)) fail('Trim percent must be between 1 and 99.');
  let counterDirection = Number(body.counterDirection || 0);
  let referencePrice = Number(body.referencePrice || 0);
  let requestedDirection = Number(body.requestedDirection || 0);
  if (definition.code === 21) {
    if (![1, -1].includes(counterDirection)) fail('Counter direction must be BUY or SELL.');
    if (!Number.isFinite(referencePrice) || referencePrice <= 0) fail('A verified stop/close reference price is required before HIGHTOWER can arm a counter campaign.');
    if (c.phase !== 0 && c.phase !== 3) fail('Counter intent can only arm after the prior campaign is flat or already waiting for reversal proof.');
    if (c.positions?.length) fail('Counter intent requires the prior campaign to be flat before arming opposite exposure.');
  }
  if (definition.code === 22) {
    if (![1, -1].includes(requestedDirection)) fail('Requested entry direction must be BUY or SELL.');
    if (c.phase !== 0) fail('A direct directional entry can only start from a flat HIGHTOWER campaign.');
    if (c.positions?.length) fail('A direct directional entry requires the current HIGHTOWER lane to be flat.');
    const requestedSymbol=String(body.requestedSymbol||'').trim().toUpperCase();
    if (requestedSymbol && requestedSymbol !== String(c.symbol||'').toUpperCase()) fail('Requested symbol does not match the bound HIGHTOWER campaign lane.');
  }
  const runtimeScope = [15, 16].includes(definition.code) ? (body.persistRuntime === true ? 2 : 1) : 0;
  let level = null;
  if ([8, 9].includes(definition.code)) {
    level = c.levels.find(x => x.id === Number(body.levelId));
    if (!level || (body.levelPrice != null && Number(body.levelPrice) !== level.price)) fail('Structure level changed. Preview again.');
    if (definition.code === 9 && c.direction * (level.price - c.rail) <= 0) fail('The campaign rail can only tighten.');
  }
  return { operation: definition.code, burstCount, durationSeconds: duration, eaCampaignId: c.campaignId,
    symbol: c.symbol, magicNumber: c.magic, tickets: tickets.join(','),
    levelId: level?.id || 0, levelPrice: level?.price || 0,
    stopAtr, trailStartAtr, trailDistanceAtr, trailStepAtr, trimPercent, runtimeScope, counterDirection, referencePrice, requestedDirection,
    scheduleMode, scheduleWindowCount, window1StartMinute, window1EndMinute, window2StartMinute, window2EndMinute };
}
