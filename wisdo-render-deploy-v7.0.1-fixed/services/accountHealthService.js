function n(value, fallback = 0) { const x = Number(value); return Number.isFinite(x) ? x : fallback; }
function money(v) { return `$${n(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export class AccountHealthService {
  constructor({ mt4SyncService = null, wisdoMemoryService = null } = {}) {
    this.mt4SyncService = mt4SyncService;
    this.wisdoMemoryService = wisdoMemoryService;
  }

  scoreAccount(account = {}) {
    let score = 100;
    const balance = n(account.lastKnownBalance ?? account.balance, 0);
    const equity = n(account.lastKnownEquity ?? account.equity, balance);
    const openTrades = n(account.openTradeCount, 0);
    const marginLevel = n(account.marginLevel, 9999);
    const dd = balance > 0 && equity < balance ? ((balance - equity) / balance) * 100 : n(account.drawdownPercent, 0);
    const floating = n(account.floatingPL, 0);

    if (account.terminalConnected === false) score -= 25;
    if (account.expertEnabled === false) score -= 20;
    if (dd > 0) score -= Math.min(40, dd * 1.5);
    if (openTrades > 10) score -= 15;
    else if (openTrades > 5) score -= 7;
    if (marginLevel < 100) score -= 30;
    else if (marginLevel < 250) score -= 15;
    if (floating < 0 && balance > 0 && Math.abs(floating) / balance > 0.1) score -= 12;
    score = Math.max(0, Math.min(100, Math.round(score)));
    const state = score >= 80 ? 'strong' : score >= 60 ? 'stable' : score >= 40 ? 'caution' : score >= 20 ? 'danger' : 'emergency';
    const color = score >= 80 ? '🟢' : score >= 60 ? '🟡' : score >= 40 ? '🟠' : '🔴';
    const reasons = [];
    reasons.push(`Equity ${money(equity)} vs balance ${money(balance)}`);
    reasons.push(`Drawdown ${dd.toFixed(2)}%`);
    reasons.push(`Open trades ${openTrades}`);
    if (account.terminalConnected === false) reasons.push('MT4 terminal appears disconnected');
    if (account.expertEnabled === false) reasons.push('Expert Advisor is disabled');
    if (marginLevel && marginLevel < 250) reasons.push(`Margin level is low at ${marginLevel.toFixed(2)}%`);
    return {
      score,
      state,
      color,
      balance,
      equity,
      floating,
      drawdownPercent: Number(dd.toFixed(2)),
      openTrades,
      marginLevel,
      reasons,
      coachRead: this.coachRead(score, account),
    };
  }

  coachRead(score, account = {}) {
    if (score >= 80) return 'Account is strong. Let the bot work and keep protecting profit.';
    if (score >= 60) return 'Account is stable. Avoid emotional overrides and watch the active trades.';
    if (score >= 40) return 'Caution zone. Reduce exposure, avoid adding trades, and consider protect-profit or takeover mode.';
    if (score >= 20) return 'Danger zone. Pause new entries and consider cutting risk according to your plan.';
    return 'Emergency zone. Protect capital first. Do not increase exposure.';
  }

  async summarizeUser(discordUserId) {
    const active = this.wisdoMemoryService?.resolveActiveAccount
      ? await this.wisdoMemoryService.resolveActiveAccount(discordUserId)
      : null;
    if (!active) return { ok: false, message: 'No active account found. Connect MT4 and choose an active account first.' };
    return { ok: true, account: active, health: this.scoreAccount(active) };
  }
}
