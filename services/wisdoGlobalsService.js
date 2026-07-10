function num(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool01(value) {
  return value ? 1 : 0;
}

export const WISDO_GLOBAL_DICTIONARY = Object.freeze({
  WISDO_ACTIVE: 'Master switch. 1 lets WISDO instructions be honored by the EA/reporter bridge.',
  WISDO_PAUSE_TRADING: '1 pauses new EA entries. 0 allows normal entry logic again.',
  WISDO_ALLOW_BUYS: '1 allows buy entries. 0 blocks buy entries.',
  WISDO_ALLOW_SELLS: '1 allows sell entries. 0 blocks sell entries.',
  WISDO_CLOSE_ALL: 'One-shot request for MT4 to close all open trades when confirmed.',
  WISDO_TAKE_WINNERS: 'One-shot request to secure profitable trades.',
  WISDO_CUT_LOSERS: 'One-shot request to cut losing trades according to EA rules.',
  WISDO_RISK_PERCENT: 'Risk percentage override.',
  WISDO_MAX_TRADES: 'Maximum allowed open trades.',
  WISDO_MAX_LOT: 'Maximum allowed lot size.',
  WISDO_SYMBOL_FILTER: 'Symbol filter override, such as XAUUSD only.',
  WISDO_SESSION_FILTER: 'Trading session filter, such as London or New York.',
  WISDO_EQUITY_FLOOR: 'Equity protection floor.',
  WISDO_BALANCE_LOCK: 'Balance/equity lock reference used by protection logic.',
  WISDO_PROTECT_PROFIT: '1 puts profit protection first.',
  WISDO_TRAIL_BASKET: '1 allows basket trailing logic when supported by EA.',
  WISDO_TAKEOVER_MODE: '1 activates WISDO operator mode.',
  WISDO_WALK_AWAY_MODE: '1 tells WISDO/EA that user is away and protection is priority.',
  WISDO_COPY_MODE: 'Copy trading mode.',
  WISDO_MIRROR_LEADER_ID: 'Leader/user/account id to mirror.',
  WISDO_DRAWDOWN_LIMIT: 'Maximum drawdown percentage before protection action.',
  WISDO_DAILY_GAIN_TARGET: 'Daily gain target.',
  WISDO_DAILY_LOSS_LIMIT: 'Daily loss limit.',
  WISDO_HARVEST_MODE: '1 activates profit harvest mode.',
  WISDO_LADDER_LIMIT: 'Maximum ladder count.',
  WISDO_LADDER_STEP: 'Ladder lot/step value.',
  WISDO_GOLD_RUSH_MODE: '1 activates gold-rush behavior when supported.',
  WISDO_COVENANT_COMPLETE: 'Completion state flag after target/covenant condition.',
});

export class WisdoGlobalsService {
  constructor() {
    this.dictionary = WISDO_GLOBAL_DICTIONARY;
  }

  list() {
    return Object.entries(this.dictionary).map(([key, description]) => ({ key, description }));
  }

  buildSetGlobalsCommand(globals = {}, meta = {}) {
    return {
      command: 'SET_GLOBALS',
      payload: {
        globals: Object.fromEntries(Object.entries(globals).filter(([k]) => this.dictionary[k] || k.startsWith('WISDO_'))),
        meta: {
          source: 'wisdo_global_doctrine',
          createdAt: new Date().toISOString(),
          ...meta,
        },
      },
    };
  }

  fromIntent(intent, values = {}) {
    const amount = num(values.value ?? values.amount ?? values.percent, null);
    const symbol = String(values.symbol || '').trim().toUpperCase();
    const leaderId = String(values.leaderId || values.masterUserId || '').trim();
    const mode = String(values.mode || '').trim();

    switch (intent) {
      case 'pause': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_PAUSE_TRADING: 1 });
      case 'resume': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_PAUSE_TRADING: 0 });
      case 'buy_only': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_ALLOW_BUYS: 1, WISDO_ALLOW_SELLS: 0 });
      case 'sell_only': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_ALLOW_BUYS: 0, WISDO_ALLOW_SELLS: 1 });
      case 'both_directions': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_ALLOW_BUYS: 1, WISDO_ALLOW_SELLS: 1 });
      case 'close_all': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_CLOSE_ALL: 1 });
      case 'take_winners': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_TAKE_WINNERS: 1, WISDO_PROTECT_PROFIT: 1 });
      case 'cut_losers': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_CUT_LOSERS: 1 });
      case 'protect_profit': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_PROTECT_PROFIT: 1, WISDO_TRAIL_BASKET: 1 });
      case 'takeover': return this.buildSetGlobalsCommand({
        WISDO_ACTIVE: 1,
        WISDO_TAKEOVER_MODE: bool01(values.enabled !== false),
        WISDO_WALK_AWAY_MODE: bool01(values.walkAway !== false),
        WISDO_PROTECT_PROFIT: 1,
        ...(amount !== null ? { WISDO_EQUITY_FLOOR: amount } : {}),
        ...(num(values.maxDrawdownPercent, null) !== null ? { WISDO_DRAWDOWN_LIMIT: num(values.maxDrawdownPercent) } : {}),
      });
      case 'risk_percent': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_RISK_PERCENT: amount ?? 1 });
      case 'max_trades': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_MAX_TRADES: amount ?? 1 });
      case 'max_lot': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_MAX_LOT: amount ?? 0.01 });
      case 'symbol_filter': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_SYMBOL_FILTER: symbol || 'ALL' });
      case 'daily_gain': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_DAILY_GAIN_TARGET: amount ?? 0 });
      case 'daily_loss': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_DAILY_LOSS_LIMIT: amount ?? 0 });
      case 'harvest': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_HARVEST_MODE: 1, WISDO_PROTECT_PROFIT: 1 });
      case 'ladder_limit': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_LADDER_LIMIT: amount ?? 1 });
      case 'ladder_step': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_LADDER_STEP: amount ?? 0.01 });
      case 'copy_mode': return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1, WISDO_COPY_MODE: mode || 'manual', ...(leaderId ? { WISDO_MIRROR_LEADER_ID: leaderId } : {}) });
      default: return this.buildSetGlobalsCommand({ WISDO_ACTIVE: 1 }, { unknownIntent: intent });
    }
  }
}
