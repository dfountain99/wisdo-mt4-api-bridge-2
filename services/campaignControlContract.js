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
});
const num = (v, fallback = 0) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
export function normalizeCampaignControl(value) {
  if (!value || value.version !== 1 || !/^[A-Za-z0-9_.#-]{1,24}$/.test(value.symbol || '') || !Number.isInteger(value.magic) || value.magic <= 0) return null;
  const levels = (Array.isArray(value.levels) ? value.levels : []).slice(0, 16)
    .filter(x => Number.isFinite(x.price) && x.price > 0 && Number.isInteger(x.id) && x.id > 0)
    .map(x => ({ id: x.id, price: x.price, kind: 'confirmed-pivot' }));
  return { version: 1, symbol: value.symbol, magic: value.magic,
    ageSeconds: value.ageSeconds >= 0 ? num(value.ageSeconds, 999999) : 999999, enabled: value.enabled === true,
    campaignId: num(value.campaignId), phase: num(value.phase), direction: num(value.direction),
    rail: num(value.rail), goal: num(value.goal), paused: value.paused === true,
    remainingSeconds: Math.max(0, num(value.remainingSeconds)), banked: num(value.banked),
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
  if ([1, 3, 6, 7, 12].includes(definition.code) && (!Number.isInteger(duration) || duration < 1 || duration > 604800)) fail('Choose a duration between 1 second and 7 days.');
  if ([2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14].includes(definition.code) && c.phase !== 1) fail('This instruction requires an active campaign.');
  const burstCount = Number(body.burstCount || 0);
  if (definition.code === 12 && (!Number.isInteger(burstCount) || burstCount < 1 || burstCount > 10)) fail('A SONIC window allows 1 to 10 entries, each subject to the normal EA gates.');
  const tickets = [...new Set(Array.isArray(body.tickets) ? body.tickets.map(Number) : [])];
  if ([8, 10, 11, 13, 14].includes(definition.code) && (!tickets.length || tickets.length > 12 || tickets.some(t => !c.positions.some(p => p.ticket === t && p.role !== 0)))) fail('Select up to 12 collectors or runners in this campaign; HOLD assignments stay protected.');
  let level = null;
  if ([8, 9].includes(definition.code)) {
    level = c.levels.find(x => x.id === Number(body.levelId));
    if (!level || (body.levelPrice != null && Number(body.levelPrice) !== level.price)) fail('Structure level changed. Preview again.');
    if (definition.code === 9 && c.direction * (level.price - c.rail) <= 0) fail('The campaign rail can only tighten.');
  }
  return { operation: definition.code, burstCount, durationSeconds: duration, eaCampaignId: c.campaignId,
    symbol: c.symbol, magicNumber: c.magic, tickets: tickets.join(','),
    levelId: level?.id || 0, levelPrice: level?.price || 0 };
}
