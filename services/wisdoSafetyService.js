const DANGEROUS = new Set(['CLOSE_ALL_TRADES','CLOSE_LOSING_TRADES','EMERGENCY_STOP','INCREASE_RISK','SET_FIXED_LOT','SET_MAX_OPEN_TRADES','RAISE_TRADE_LIMIT','ACTIVATE_LIVE_PLAN','MULTI_ACCOUNT_ACTION']);
const CONTROLLED = new Set(['STOP_NEW_ENTRIES','RESUME_TRADING','PAUSE_COPIER','RESUME_COPIER','BUY_ONLY','SELL_ONLY','BOTH_DIRECTIONS','SET_RISK_PERCENT','SET_EQUITY_FLOOR','CLOSE_PROFITABLE_TRADES']);

export function voiceExecutionMode(value=process.env.WISDO_VOICE_EXECUTION_MODE){return String(value||'DISABLED').trim().toUpperCase();}
export function isProvenDemoAccount(account={}){const values=[account.environment,account.accountType,account.account_type,account.type,account.brokerServer,account.broker_server,account.server,account.metadata?.environment,account.metadata?.accountType].map((v)=>String(v||'').toLowerCase());return values.some((value)=>/demo|practice|paper|sandbox|test/.test(value))&&!values.some((value)=>/\blive\b|\breal\b/.test(value));}

export class WisdoSafetyService {
  classify(intent, context = {}) {
    const names = [intent?.intent, intent?.commandName].map((value) => String(value || '').toUpperCase());
    if (names.some((name) => DANGEROUS.has(name) || name === 'CLOSE_ALL_LOSERS') || context.livePlan || context.multipleAccounts || (names.includes('SET_RISK_PERCENT') && context.increasesRisk)) return 'DANGEROUS';
    if (names.some((name) => CONTROLLED.has(name)) || intent?.type === 'ACTION') return 'CONTROLLED';
    return 'READ_ONLY';
  }

  requiresConfirmation(level) { return level === 'CONTROLLED' || level === 'DANGEROUS'; }
  requiresStrongConfirmation(level) { return level === 'DANGEROUS'; }

  assertVoiceExecutionMode(accounts,mode=voiceExecutionMode()) {
    if(mode==='DISABLED')throw Object.assign(new Error('Voice execution is disabled for this deployment.'),{code:'voice_execution_disabled',statusCode:409});
    if(mode==='DEMO_ONLY'&&(!accounts?.length||accounts.some((account)=>!isProvenDemoAccount(account))))throw Object.assign(new Error('Demo-only protection blocked this voice action because every target was not proven to be a demo account. No changes were made.'),{code:'demo_only_live_blocked',statusCode:409});
    return true;
  }

  assertAccountAccess(accountIds, authorizedAccounts) {
    const allowed = new Set((authorizedAccounts || []).filter((account) => {
      if (!account || typeof account !== 'object' || !account.shared) return true;
      return ['control_allowed', 'admin'].includes(String(account.sharePermission || '').toLowerCase());
    }).map((a) => String(a.accountId || a.account_id || a.id || a)));
    const denied = (accountIds || []).map(String).filter((id) => !allowed.has(id));
    if (denied.length) { const error = new Error('One or more accounts are not authorized for this user.'); error.code = 'unauthorized_account'; error.accountIds = denied; throw error; }
    return true;
  }
}
