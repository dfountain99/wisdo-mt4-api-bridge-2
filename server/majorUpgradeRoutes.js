import crypto from 'node:crypto';
import { getSessionUser, verifyHmacSha256, encryptCredential, sessionSecurityStatus, safeReturnPath } from './security.js';

const PLATFORMS = ['mt4','mt5','ctrader','matchtrader','tradelocker','dxtrade','ninjatrader','tradovate','projectx','rithmic'];
const RISK_TYPES = ['fixed_lot','multiplier','equity_ratio','balance_ratio'];
const ACCOUNT_DESK_ROLES = ['private','lead','receiver','dual'];
const ACCOUNT_SHARING_MODES = ['private','shared','community'];
const BASE = { standard: 1000, premium: 1500, futures: 3000 };
const CYCLE_MONTHS = { monthly: 1, quarterly: 3, semiannual: 5, annual: 10 };
const CYCLE_LABEL = { monthly: 'Monthly', quarterly: 'Quarterly', semiannual: '6 months · 1 month free', annual: 'Annual · 2 months free' };
const ADDON = { analyzer: 2999, dedicatedEnv: 3000, extraEnvAccount: 1000 };
const SYMBOL_FIXES = { GBPJP: 'GBPJPY', USOUSD: 'USOIL', GOLD: 'XAUUSD', GOLDUSD: 'XAUUSD', NASDAQ: 'NAS100', USTEC: 'NAS100' };

const FIRMS = [
  { id:'firm_alpha', name:'Alpha Prop', type:'prop', max_drawdown_pct:10, daily_drawdown_pct:5, profit_split_pct:90, refund_policy:'Refund after first payout', min_trading_days:3, supported_platforms:['mt5','ctrader'], rating:4.7 },
  { id:'firm_futures', name:'Futures Forge', type:'prop', max_drawdown_pct:6, daily_drawdown_pct:3, profit_split_pct:90, refund_policy:'Activation refunded at payout', min_trading_days:5, supported_platforms:['ninjatrader','tradovate','rithmic'], rating:4.6 },
  { id:'broker_prime', name:'Prime Markets', type:'broker', max_drawdown_pct:null, daily_drawdown_pct:null, profit_split_pct:null, refund_policy:'N/A', min_trading_days:0, supported_platforms:['mt4','mt5','ctrader'], rating:4.5 },
  { id:'firm_scale', name:'Scale Capital', type:'prop', max_drawdown_pct:12, daily_drawdown_pct:5, profit_split_pct:85, refund_policy:'Challenge fee refunded', min_trading_days:0, supported_platforms:['mt5','tradelocker'], rating:4.4 },
];

const BLOG_POSTS = [
  { slug:'copy-trading-risk-engine', title:'How a copier risk engine should protect follower accounts', excerpt:'Fixed lots, ratios, equity protection, symbol mapping, and why closes must bypass entry filters.', date:'2026-07-10', body:'A reliable copier treats opening and closing as different safety problems. Entry rules can block new risk, but close instructions must remain deliverable so a follower is never trapped in a position. WISDO evaluates account health, route rules, trading hours, daily loss, and broker symbol mapping before an opening command is queued.' },
  { slug:'multi-account-command-center', title:'Designing a multi-account command center for mobile', excerpt:'Account switching, account-specific actions, confirmation gates, and live relay health.', date:'2026-07-08', body:'A mobile control surface must always make the selected account visible. Every high-risk command should carry an account ID, require a confirmation phrase, and report delivery plus completion separately.' },
  { slug:'df-sauce-interactive-education', title:'From passive videos to interactive DF Sauce training', excerpt:'Chart replay, campaign character, bot-brain explanations, and decision scoring.', date:'2026-07-05', body:'Interactive education lets a trader pause candle replay, identify the campaign character, choose buy, sell, wait, or close, then compare the answer with WISDO bot logic.' },
];

function nowIso(){ return new Date().toISOString(); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')){ const hash=crypto.pbkdf2Sync(String(password||''),salt,120000,32,'sha256').toString('hex'); return `${salt}:${hash}`; }
function id(prefix){ return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }
function esc(value=''){ return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function num(value, fallback=0){ const n=Number(value); return Number.isFinite(n)?n:fallback; }
function clamp(value,min,max){ return Math.max(min,Math.min(max,num(value,min))); }
function moneyCents(value){ return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(num(value)/100); }
function normalizeSymbol(value=''){ const raw=String(value).trim().toUpperCase().replace(/[^A-Z0-9._-]/g,''); const base=raw.replace(/[._-](PRO|RAW|ECN|M|MINI|CASH)$/,''); return SYMBOL_FIXES[base] || base; }
function parseBool(value){ return value===true || ['true','on','1','yes'].includes(String(value||'').toLowerCase()); }
function parseSymbols(value){ const list=Array.isArray(value)?value:String(value||'').split(/[;,\s]+/); return [...new Set(list.map(normalizeSymbol).filter(Boolean))]; }
function normalizeMap(value){ if(!value) return {}; if(typeof value==='object'&&!Array.isArray(value)) return Object.fromEntries(Object.entries(value).map(([k,v])=>[normalizeSymbol(k),normalizeSymbol(v)]).filter(([k,v])=>k&&v)); try{return normalizeMap(JSON.parse(value));}catch{return {};}}
function resolveFollowerSymbol(leaderSymbol, rule={}){ const leader=normalizeSymbol(leaderSymbol); const map=normalizeMap(rule.symbol_mapping||rule.symbolMapping); return normalizeSymbol(map[leader]||leader); }
function currentUser(req){ const session=getSessionUser(req); if(session?.id) return session; if((process.env.NODE_ENV==='test'||parseBool(process.env.WISDO_ALLOW_TEST_IDENTITY)) && req.headers['x-wisdo-test-user']) return {id:String(req.headers['x-wisdo-test-user']),username:'Test Operator',roles:['admin']}; return null; }
function wantsHtml(req){ return String(req.headers.accept||'').includes('text/html'); }
function requireUser(req,res,next){ const user=currentUser(req); if(!user){ const returnTo=safeReturnPath(req.originalUrl||req.url,'/app/dashboard'); if(wantsHtml(req)) return res.redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`); return res.status(401).json({ok:false,error:'Authentication required.'}); } req.wisdoUser=user; next(); }
function isAdmin(user){ return Boolean(user?.admin || user?.role==='admin' || (user?.roles||[]).includes('admin') || String(process.env.OWNER_USER_ID||'')===String(user?.id||'')); }
function requireAdmin(req,res,next){ if(!isAdmin(req.wisdoUser||currentUser(req))) return res.status(403).json({ok:false,error:'Admin role required.'}); next(); }

function ensureMajorState(state={}){
  state.profiles ||= {}; state.userRoles ||= {}; state.tradingAccounts ||= {}; state.accountShares ||= {}; state.copierRules ||= {}; state.trades ||= {}; state.subscriptions ||= {}; state.alerts ||= {}; state.firms ||= {}; state.passwordResetTokens ||= {}; state.marketCache ||= {}; state.pushSubscriptions ||= {}; state.aiThreads ||= {}; state.affiliates ||= {}; state.affiliateConversions ||= {}; state.auditLog ||= []; state.accountTelemetry ||= {}; state.liveTradeEventKeys ||= {}; state.accountHealthState ||= {}; state.relayDiagnostics ||= [];
  for(const firm of FIRMS) state.firms[firm.id] ||= firm;
  return state;
}
let ecosystemMutationQueue = Promise.resolve();
async function mutate(load,save,fn){
  const operation = ecosystemMutationQueue.then(async()=>{ const state=ensureMajorState(await load()); const result=await fn(state); await save(state); return result; });
  ecosystemMutationQueue = operation.catch(()=>undefined);
  return operation;
}
function settleWithin(promise, timeoutMs = 5000){
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ status: 'timeout' });
    }, Math.max(50, Number(timeoutMs) || 5000));
    Promise.resolve(promise).then((value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ status: 'fulfilled', value });
    }).catch((error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ status: 'rejected', error });
    });
  });
}
function audit(state,userId,action,targetType,targetId,data={}){ state.auditLog.unshift({id:id('audit'),userId:String(userId||'system'),action,targetType,targetId:String(targetId||''),data,createdAt:nowIso()}); state.auditLog=state.auditLog.slice(0,2000); }
function normalizeDeskRole(value, fallback = 'private'){
  const role=String(value||'').trim().toLowerCase().replace(/[\s-]+/g,'_');
  if(['lead','leader','master','culture_lead'].includes(role)) return 'lead';
  if(['receiver','follower','slave','mirror_receiver'].includes(role)) return 'receiver';
  if(['dual','both','lead_and_receiver','leader_and_follower'].includes(role)) return 'dual';
  if(['private','private_desk','desk','none'].includes(role)) return 'private';
  return ACCOUNT_DESK_ROLES.includes(fallback)?fallback:'private';
}
function normalizeSharingMode(value, fallback = 'private'){
  const mode=String(value||'').trim().toLowerCase();
  if(ACCOUNT_SHARING_MODES.includes(mode)) return mode;
  return ACCOUNT_SHARING_MODES.includes(fallback)?fallback:'private';
}
function legacyRoleForDeskRole(deskRole){ return ['lead','dual'].includes(normalizeDeskRole(deskRole))?'master':'slave'; }
function accountCanLead(account={}){ return ['lead','dual'].includes(normalizeDeskRole(account.desk_role||account.role, account.role==='master'?'lead':'private')); }
function accountCanReceive(account={}){ return ['receiver','dual'].includes(normalizeDeskRole(account.desk_role||account.role, account.role==='slave'?'receiver':'private')); }
function accountCanExecute(account={}){
  const platform=String(account.platform||'mt4').toLowerCase();
  const reporterReady=Boolean(account.reporter_connected||account.status==='connected');
  return accountCanReceive(account)&&['mt4','mt5'].includes(platform)&&reporterReady&&account.terminal_connected!==false&&account.expert_enabled!==false;
}
function decorateAccount(account={}){
  const deskRole=normalizeDeskRole(account.desk_role||account.role, account.role==='master'?'lead':account.role==='slave'?'receiver':'private');
  const sharingMode=normalizeSharingMode(account.sharing_mode, account.community_visible?'community':'private');
  const decorated={...account,desk_role:deskRole,sharing_mode:sharingMode,role:legacyRoleForDeskRole(deskRole),community_visible:sharingMode==='community'};
  const canLead=accountCanLead(decorated);
  const canReceive=accountCanReceive(decorated);
  const canExecute=accountCanExecute(decorated);
  const isShared=sharingMode==='shared';
  const isCommunity=sharingMode==='community';
  const capabilityWarnings=[];
  if(deskRole==='private') capabilityWarnings.push('Assign Culture Lead, Mirror Receiver, or Dual Role before using this account in a Culture Lane.');
  if(canReceive&&!decorated.reporter_connected) capabilityWarnings.push('Receiver role is assigned, but a fresh Reporter heartbeat is required for live execution.');
  if(canReceive&&decorated.terminal_connected===false) capabilityWarnings.push('MT4 terminal is offline.');
  if(canReceive&&decorated.expert_enabled===false) capabilityWarnings.push('AutoTrading / Expert execution is disabled.');
  return {...decorated,canLead,canReceive,canExecute,isShared,isCommunity,can_lead:canLead,can_receive:canReceive,can_execute:canExecute,is_shared:isShared,is_community:isCommunity,capabilities:{canLead,canReceive,canExecute,isShared,isCommunity},capabilityWarnings};
}
function ownAccount(state,userId,accountId){ const account=state.tradingAccounts[accountId]; return account && String(account.user_id)===String(userId); }
function canAccessLeader(state,userId,accountId){ const account=state.tradingAccounts[accountId]; if(!account||!accountCanLead(account))return false; if(String(account.user_id)===String(userId)||normalizeSharingMode(account.sharing_mode,account.community_visible?'community':'private')==='community')return true; return Object.values(state.accountShares||{}).some(share=>share.account_id===accountId&&String(share.shared_with_user_id)===String(userId)&&share.status!=='revoked'&&['copy','control'].includes(String(share.permission||'copy'))); }
function ownRule(state,userId,ruleId){ const rule=state.copierRules[ruleId]; return rule && String(rule.user_id)===String(userId); }

async function recoverCompletedFollowerTicket(mt4CommandService,{routeId,leaderTicket,followerAccountId}={}){
  if(!mt4CommandService?.load||!routeId||!leaderTicket||!followerAccountId)return null;
  try{
    const data=await mt4CommandService.load();
    const stores=[data.commandQueue||[],...Object.values(data.commandsByUserId||{}),...Object.values(data.commandsByAccountId||{})];
    const seen=new Set();
    const matches=[];
    for(const store of stores){
      for(const command of store||[]){
        if(!command?.id||seen.has(command.id))continue;
        seen.add(command.id);
        const payload=command.payload||{};
        if(command.command!=='COPY_OPEN_TRADE')continue;
        if(String(payload.routeId||'')!==String(routeId))continue;
        if(String(payload.followerAccountId||command.accountId||'')!==String(followerAccountId))continue;
        if(String(payload.sourceTicket||payload.leaderTicket||payload.copyKey||'')!==String(leaderTicket))continue;
        const ticket=command.result?.ticket||command.result?.followerTicket||null;
        if(ticket&&command.result?.success!==false)matches.push({ticket:String(ticket),completedAt:command.completedAt||command.createdAt||''});
      }
    }
    matches.sort((a,b)=>new Date(b.completedAt||0)-new Date(a.completedAt||0));
    return matches[0]?.ticket||null;
  }catch{return null;}
}

function normalizeServer(value=''){ return String(value||'').trim().toLowerCase().replace(/\s+/g,'_'); }
function reporterDeskRole(account={}, fallback='private'){
  const role=String(account.accountRole||account.role||account.deskRole||'').toLowerCase();
  if(['both','dual'].includes(role)) return 'dual';
  if(['leader','master','lead'].includes(role)) return 'lead';
  if(['follower','slave','receiver'].includes(role)) return 'receiver';
  return normalizeDeskRole(fallback,'private');
}
function reporterRole(account={}, fallback='slave'){ return legacyRoleForDeskRole(reporterDeskRole(account,fallback==='master'?'lead':fallback==='slave'?'receiver':'private')); }
function sanitizeAccount(account={}){ const safe=decorateAccount(account); delete safe.encrypted_credentials; return safe; }
async function synchronizeReporterAccounts({userId,mt4SyncService,loadEcosystemState,saveEcosystemState}){
  const repository=mt4SyncService?.repository;
  if(!repository){
    const state=ensureMajorState(await loadEcosystemState());
    return {accounts:Object.values(state.tradingAccounts).filter(row=>String(row.user_id)===String(userId)).map(sanitizeAccount).sort((a,b)=>new Date(b.last_sync_at||b.updated_at||0)-new Date(a.last_sync_at||a.updated_at||0)),importedReporterAccounts:0,reporterSourceAvailable:false};
  }
  let reporterAccounts=[];
  let reporterSourceAvailable=true;
  try{ reporterAccounts=repository.getAccessibleMt4Accounts?await repository.getAccessibleMt4Accounts(userId):await repository.getMt4Accounts?.(userId)||[]; }catch{ reporterAccounts=[]; reporterSourceAvailable=false; }
  let imported=0;
  const accounts=await mutate(loadEcosystemState,saveEcosystemState,state=>{
    const uid=String(userId);
    for(const reporter of reporterAccounts){
      const accountNumber=String(reporter.accountNumber||reporter.account_number||'').trim();
      const server=String(reporter.server||reporter.brokerServer||'').trim();
      if(!accountNumber) continue;
      const canonicalId=String(reporter.accountId||repository.getMt4AccountId?.(accountNumber,server)||`${accountNumber}:${server||'server'}`);
      const existingEntry=Object.entries(state.tradingAccounts).find(([key,row])=>String(row.user_id)===uid&&String(row.account_number||'')===accountNumber&&normalizeServer(row.server)===normalizeServer(server));
      const oldId=existingEntry?.[0];
      const previous=state.tradingAccounts[canonicalId]||existingEntry?.[1]||{};
      if(oldId&&oldId!==canonicalId){
        for(const rule of Object.values(state.copierRules)){ if(rule.master_id===oldId)rule.master_id=canonicalId; if(rule.slave_id===oldId)rule.slave_id=canonicalId; }
        for(const trade of Object.values(state.trades)){ if(trade.account_id===oldId)trade.account_id=canonicalId; }
        delete state.tradingAccounts[oldId];
      }
      const lastSync=reporter.lastSyncAt||reporter.latestSnapshot?.receivedAt||previous.last_sync_at||null;
      const fresh=lastSync?Date.now()-new Date(lastSync).getTime()<5*60*1000:false;
      const deskRole=normalizeDeskRole(previous.desk_role||reporterDeskRole(reporter,previous.role==='master'?'lead':previous.role==='slave'?'receiver':'private'),'private');
      const sharingMode=normalizeSharingMode(previous.sharing_mode,previous.community_visible?'community':'private');
      const next={...previous,id:canonicalId,user_id:uid,platform:String(reporter.platform||previous.platform||'mt4').toLowerCase(),broker:String(previous.broker||reporter.broker||server.split('-')[0]||'').trim(),account_number:accountNumber,server,nickname:String(previous.nickname||reporter.nickname||reporter.accountNickname||'').trim(),desk_role:deskRole,sharing_mode:sharingMode,role:legacyRoleForDeskRole(deskRole),community_visible:sharingMode==='community',status:reporter.pendingReporter?'awaiting_reporter':fresh?'connected':'stale',balance:num(reporter.balance??reporter.latestSnapshot?.snapshot?.balance??previous.balance),equity:num(reporter.equity??reporter.latestSnapshot?.snapshot?.equity??previous.equity),floating_pl:num(reporter.floatingPL??reporter.latestSnapshot?.snapshot?.floatingPL??previous.floating_pl),open_trades:num(reporter.openTrades??reporter.latestSnapshot?.snapshot?.openTradeCount??previous.open_trades),currency:String(reporter.currency||reporter.latestSnapshot?.snapshot?.currency||previous.currency||'USD'),reporter_connected:Boolean(!reporter.pendingReporter&&fresh),terminal_connected:reporter.terminalConnected!==false,expert_enabled:reporter.expertEnabled!==false,last_sync_at:lastSync,reporter_account_id:canonicalId,is_primary:Boolean(reporter.isPrimary),source:'mt4_reporter',updated_at:nowIso(),created_at:previous.created_at||reporter.connectedAt||nowIso()};
      if(!state.tradingAccounts[canonicalId]) imported++;
      state.tradingAccounts[canonicalId]=next;
    }
    return Object.values(state.tradingAccounts).filter(row=>String(row.user_id)===uid).map(sanitizeAccount).sort((a,b)=>new Date(b.last_sync_at||b.updated_at||0)-new Date(a.last_sync_at||a.updated_at||0));
  });
  return {accounts,importedReporterAccounts:imported,reporterSourceAvailable};
}


function stableLiveTradeId(accountId, ticket) {
  return `live_${crypto.createHash('sha256').update(`${String(accountId)}:${String(ticket)}`).digest('hex').slice(0, 20)}`;
}

function netTradePnl(trade = {}) {
  return num(trade.profit, 0) + num(trade.swap, 0) + num(trade.commission, 0);
}

function appendMemberAlert(state, userId, alert = {}, eventKey = '') {
  const uid = String(userId || '');
  if (!uid) return null;
  state.alerts[uid] ||= [];
  if (eventKey && state.liveTradeEventKeys[eventKey]) return null;
  const row = {
    id: alert.id || id('alert'),
    user_id: uid,
    type: alert.type || 'system',
    title: String(alert.title || 'WISDO update'),
    body: String(alert.body || ''),
    metadata: { ...(alert.metadata || {}), ...(eventKey ? { eventKey } : {}) },
    read_at: null,
    created_at: alert.created_at || nowIso(),
  };
  state.alerts[uid].unshift(row);
  state.alerts[uid] = state.alerts[uid].slice(0, 1000);
  if (eventKey) {
    state.liveTradeEventKeys[eventKey] = row.created_at;
    const entries = Object.entries(state.liveTradeEventKeys);
    if (entries.length > 5000) state.liveTradeEventKeys = Object.fromEntries(entries.sort((a,b)=>new Date(b[1])-new Date(a[1])).slice(0, 4000));
  }
  return row;
}

function upsertSnapshotTrade(state, { userId, accountId, trade, closed = false, receivedAt = nowIso() }) {
  const ticket = String(trade?.ticket ?? '').trim();
  if (!ticket || !accountId) return { trade: null, created: false, changedToClosed: false };
  const existing = Object.values(state.trades).find((row) => String(row.account_id) === String(accountId) && String(row.external_ticket || '') === ticket);
  const tradeId = existing?.id || stableLiveTradeId(accountId, ticket);
  const previousStatus = existing?.status || null;
  const row = {
    ...(existing || {}),
    id: tradeId,
    user_id: String(userId),
    account_id: String(accountId),
    copier_rule_id: existing?.copier_rule_id || null,
    source_trade_id: existing?.source_trade_id || null,
    external_ticket: ticket,
    symbol: normalizeSymbol(trade.symbol || existing?.symbol || ''),
    side: String(trade.type || existing?.side || 'buy').toLowerCase().includes('sell') ? 'sell' : 'buy',
    lot_size: num(trade.lots, existing?.lot_size || 0.01),
    open_price: num(trade.openPrice, existing?.open_price ?? null),
    close_price: closed ? num(trade.closePrice, existing?.close_price ?? null) : existing?.close_price ?? null,
    current_price: closed ? null : num(trade.currentPrice, existing?.current_price ?? null),
    stop_loss: num(trade.stopLoss, existing?.stop_loss ?? null),
    take_profit: num(trade.takeProfit, existing?.take_profit ?? null),
    commission: num(trade.commission, existing?.commission || 0),
    swap: num(trade.swap, existing?.swap || 0),
    pnl: closed ? netTradePnl(trade) : num(trade.profit, existing?.pnl ?? 0) + num(trade.swap, 0) + num(trade.commission, 0),
    status: closed ? 'closed' : 'open',
    opened_at: trade.openTime || existing?.opened_at || receivedAt,
    closed_at: closed ? (trade.closeTime || existing?.closed_at || receivedAt) : null,
    copy_latency_ms: existing?.copy_latency_ms ?? null,
    magic_number: trade.magicNumber ?? existing?.magic_number ?? null,
    comment: String(trade.comment || existing?.comment || ''),
    source: existing?.source || 'mt4_reporter_snapshot',
    last_seen_at: receivedAt,
    updated_at: receivedAt,
  };
  state.trades[tradeId] = row;
  return { trade: row, created: !existing, changedToClosed: closed && previousStatus !== 'closed' };
}

export async function ingestReporterSnapshotToProductState({ connectionRecord, latestSnapshotRecord, signalSummary = {}, loadEcosystemState, saveEcosystemState }) {
  if (!connectionRecord?.accountId || !latestSnapshotRecord?.snapshot) return { openUpserts: 0, closedUpserts: 0, alerts: 0 };
  return mutate(loadEcosystemState, saveEcosystemState, (state) => {
    const snapshot = latestSnapshotRecord.snapshot || {};
    const userId = String(connectionRecord.discordUserId || latestSnapshotRecord.discordUserId || '');
    const accountId = String(connectionRecord.accountId);
    const receivedAt = latestSnapshotRecord.receivedAt || nowIso();
    const account = state.tradingAccounts[accountId] || {};
    state.tradingAccounts[accountId] = {
      ...account,
      id: accountId,
      user_id: userId,
      platform: account.platform || 'mt4',
      broker: account.broker || String(connectionRecord.brokerServer || '').split('-')[0] || 'MT4',
      account_number: String(connectionRecord.accountNumber || account.account_number || ''),
      server: String(connectionRecord.brokerServer || account.server || ''),
      nickname: account.nickname || connectionRecord.nickname || connectionRecord.accountNickname || `${connectionRecord.accountNumber || ''} ${connectionRecord.brokerServer || ''}`.trim(),
      desk_role: account.desk_role || reporterDeskRole(connectionRecord, 'private'),
      sharing_mode: account.sharing_mode || 'private',
      role: account.role || reporterRole(connectionRecord, 'slave'),
      status: snapshot.terminalConnected === false ? 'error' : 'connected',
      balance: num(snapshot.balance, account.balance),
      equity: num(snapshot.equity, account.equity),
      floating_pl: num(snapshot.floatingPL, account.floating_pl),
      open_trades: num(snapshot.openTradeCount, account.open_trades),
      reporter_connected: true,
      terminal_connected: snapshot.terminalConnected !== false,
      expert_enabled: snapshot.expertEnabled !== false,
      last_sync_at: receivedAt,
      updated_at: receivedAt,
      created_at: account.created_at || receivedAt,
      source: 'mt4_reporter',
    };

    state.accountTelemetry[accountId] ||= [];
    const telemetryKey = `${receivedAt}:${snapshot.balance}:${snapshot.equity}:${snapshot.openTradeCount}`;
    if (!state.accountTelemetry[accountId].some((point) => point.key === telemetryKey)) {
      state.accountTelemetry[accountId].push({
        key: telemetryKey,
        receivedAt,
        balance: num(snapshot.balance),
        equity: num(snapshot.equity),
        floatingPL: num(snapshot.floatingPL),
        dailyClosedPL: num(snapshot.dailyClosedPL),
        margin: num(snapshot.margin),
        freeMargin: num(snapshot.freeMargin),
        marginLevel: num(snapshot.marginLevel),
        openTradeCount: num(snapshot.openTradeCount),
      });
      state.accountTelemetry[accountId] = state.accountTelemetry[accountId].sort((a,b)=>new Date(a.receivedAt)-new Date(b.receivedAt)).slice(-2500);
    }

    let openUpserts = 0;
    let closedUpserts = 0;
    let alerts = 0;
    for (const trade of Array.isArray(snapshot.openTrades) ? snapshot.openTrades : []) {
      const result = upsertSnapshotTrade(state, { userId, accountId, trade, closed: false, receivedAt });
      if (!result.trade) continue;
      openUpserts += 1;
      if (result.created) {
        const eventKey = `trade-open:${accountId}:${result.trade.external_ticket}:${result.trade.opened_at}`;
        if (appendMemberAlert(state, userId, {
          type: result.trade.copier_rule_id ? 'trade_copied' : 'trade_opened',
          title: result.trade.copier_rule_id ? 'Mirrored position confirmed' : 'Trade detected by Reporter',
          body: `${result.trade.side.toUpperCase()} ${result.trade.symbol} · ${result.trade.lot_size} lots · ticket ${result.trade.external_ticket}`,
          metadata: { accountId, tradeId: result.trade.id, ticket: result.trade.external_ticket, symbol: result.trade.symbol },
        }, eventKey)) alerts += 1;
      }
    }
    for (const trade of Array.isArray(snapshot.closedTradesToday) ? snapshot.closedTradesToday : []) {
      const result = upsertSnapshotTrade(state, { userId, accountId, trade, closed: true, receivedAt });
      if (!result.trade) continue;
      closedUpserts += 1;
      if (result.changedToClosed) {
        const eventKey = `trade-close:${accountId}:${result.trade.external_ticket}:${result.trade.closed_at}`;
        if (appendMemberAlert(state, userId, {
          type: 'trade_closed',
          title: 'Trade close confirmed',
          body: `${result.trade.symbol} ticket ${result.trade.external_ticket} closed · net P/L ${result.trade.pnl.toFixed(2)}`,
          metadata: { accountId, tradeId: result.trade.id, ticket: result.trade.external_ticket, symbol: result.trade.symbol, pnl: result.trade.pnl },
        }, eventKey)) alerts += 1;
      }
    }

    const health = {
      terminalConnected: snapshot.terminalConnected !== false,
      expertEnabled: snapshot.expertEnabled !== false,
      reporterVersion: snapshot.reporterVersion || snapshot.eaVersion || '',
    };
    const previousHealth = state.accountHealthState[accountId] || null;
    state.accountHealthState[accountId] = { ...health, updatedAt: receivedAt };
    if (!previousHealth) {
      if (appendMemberAlert(state, userId, {
        type: 'system',
        title: 'Reporter data pipeline online',
        body: `${state.tradingAccounts[accountId].nickname || accountId} is feeding Trades, Insight Engine, Alerts, and Copier diagnostics.`,
        metadata: { accountId, health },
      }, `reporter-online:${accountId}`)) alerts += 1;
    } else if (previousHealth.terminalConnected !== health.terminalConnected || previousHealth.expertEnabled !== health.expertEnabled) {
      const healthy = health.terminalConnected && health.expertEnabled;
      if (appendMemberAlert(state, userId, {
        type: healthy ? 'system' : 'drawdown',
        title: healthy ? 'Execution authority restored' : 'Execution authority needs attention',
        body: healthy ? 'MT4 terminal and AutoTrading are reporting ready.' : `Terminal ${health.terminalConnected ? 'online' : 'offline'} · AutoTrading ${health.expertEnabled ? 'on' : 'off'}.`,
        metadata: { accountId, health },
      }, `health-change:${accountId}:${health.terminalConnected}:${health.expertEnabled}:${receivedAt}`)) alerts += 1;
    }

    if (num(signalSummary.opened) > 0 || num(signalSummary.closed) > 0 || signalSummary.skipped) {
      state.relayDiagnostics.unshift({
        id: id('relaydiag'), userId, accountId, opened: num(signalSummary.opened), closed: num(signalSummary.closed), skipped: Boolean(signalSummary.skipped), reason: signalSummary.reason || null, createdAt: receivedAt,
      });
      state.relayDiagnostics = state.relayDiagnostics.slice(0, 2000);
    }
    return { openUpserts, closedUpserts, alerts, accountId, userId };
  });
}

async function synchronizeLiveTradeLedger({ userId, mt4SyncService, loadEcosystemState, saveEcosystemState }) {
  const repository = mt4SyncService?.repository;
  if (!repository?.getAccessibleMt4Accounts) return { accounts: 0, snapshots: 0 };
  let accounts = [];
  try { accounts = await repository.getAccessibleMt4Accounts(userId); } catch { return { accounts: 0, snapshots: 0 }; }
  let snapshots = 0;
  for (const account of accounts.filter((row) => String(row.ownerUserId || row.discordUserId || userId) === String(userId))) {
    const latestSnapshotRecord = account.latestSnapshot;
    if (!latestSnapshotRecord?.snapshot) continue;
    await ingestReporterSnapshotToProductState({
      connectionRecord: { ...account, discordUserId: String(account.ownerUserId || account.discordUserId || userId), accountId: account.accountId, accountNumber: account.accountNumber, brokerServer: account.server || account.brokerServer },
      latestSnapshotRecord,
      signalSummary: {},
      loadEcosystemState,
      saveEcosystemState,
    });
    snapshots += 1;
  }
  return { accounts: accounts.length, snapshots };
}

function relayRiskFromRule(rule = {}) {
  const mode = rule.risk_type || 'fixed_lot';
  return {
    enabled: Boolean(rule.is_active),
    mode,
    fixedLot: mode === 'fixed_lot' ? num(rule.risk_value, 0.01) : num(rule.min_lot, 0.01),
    targetFixedLot: mode === 'fixed_lot' ? num(rule.risk_value, 0.01) : num(rule.min_lot, 0.01),
    multiplier: mode === 'multiplier' || mode === 'equity_ratio' ? num(rule.risk_value, 1) : 1,
    maxLot: num(rule.max_lot, 100),
    maxOpenTrades: num(rule.max_open_trades, 5),
    allowedSymbols: Array.isArray(rule.allowed_symbols) ? rule.allowed_symbols : [],
    copyBuys: true,
    copySells: true,
    copySLTP: rule.copy_sl_tp !== false,
    copyPendingOrders: Boolean(rule.copy_pending_orders),
    reverseCopy: Boolean(rule.reverse_signals),
    copierPaused: !rule.is_active,
    equityFloor: 0,
    maxDailyLossPercent: 0,
    maxDrawdownPercent: num(rule.equity_protection_pct, 0),
    symbolMapping: rule.symbol_mapping || {},
  };
}

async function syncCopierRuleToRelay(mt4SyncService, rule) {
  const repository = mt4SyncService?.repository;
  if (!repository?.upsertCopyRoute || !rule) return null;
  return repository.upsertCopyRoute(rule.user_id, {
    routeId: rule.id,
    leaderAccountId: rule.master_id,
    followerAccountId: rule.slave_id,
    status: rule.is_active ? 'active' : 'paused',
    risk: relayRiskFromRule(rule),
  });
}

async function synchronizeCopierRulesToRelay({ userId, mt4SyncService, loadEcosystemState }) {
  const state = ensureMajorState(await loadEcosystemState());
  const rules = Object.values(state.copierRules).filter((rule) => String(rule.user_id) === String(userId));
  const results = [];
  for (const rule of rules) {
    try { results.push({ ruleId: rule.id, route: await syncCopierRuleToRelay(mt4SyncService, rule) }); }
    catch (error) { results.push({ ruleId: rule.id, error: error.message }); }
  }
  return results;
}

async function synchronizeCopierRulesForAccount({ accountId, mt4SyncService, loadEcosystemState }) {
  const normalizedAccountId = String(accountId || '');
  if (!normalizedAccountId) return [];
  const state = ensureMajorState(await loadEcosystemState());
  const rules = Object.values(state.copierRules).filter((rule) =>
    String(rule.master_id) === normalizedAccountId || String(rule.slave_id) === normalizedAccountId,
  );
  const results = [];
  for (const rule of rules) {
    try { results.push({ ruleId: rule.id, route: await syncCopierRuleToRelay(mt4SyncService, rule) }); }
    catch (error) { results.push({ ruleId: rule.id, error: error.message }); }
  }
  return results;
}

function analyzerFromState(state, userId, { accountId = '', period = 'month' } = {}) {
  const start = rangeStart(period);
  let trades = Object.values(state.trades).filter((trade) => String(trade.user_id) === String(userId) && new Date(trade.opened_at || trade.updated_at || 0) >= start);
  if (accountId) trades = trades.filter((trade) => String(trade.account_id) === String(accountId));
  const base = analyzeTrades(trades);
  const accountIds = accountId ? [String(accountId)] : Object.values(state.tradingAccounts).filter((account) => String(account.user_id) === String(userId)).map((account) => String(account.id));
  const telemetry = accountIds.flatMap((idValue) => state.accountTelemetry[idValue] || []).filter((point) => new Date(point.receivedAt || 0) >= start).sort((a,b)=>new Date(a.receivedAt)-new Date(b.receivedAt));
  const series = telemetry.map((point) => ({ date: point.receivedAt, value: num(point.equity), balance: num(point.balance), floatingPL: num(point.floatingPL), openTradeCount: num(point.openTradeCount) }));
  return {
    ...base,
    series: series.length ? series : base.series,
    openTradeCount: trades.filter((trade) => trade.status === 'open').length,
    closedTradeCount: trades.filter((trade) => trade.status === 'closed').length,
    telemetryPoints: telemetry.length,
    dataSource: telemetry.length || trades.length ? 'mt4_reporter_ledger' : 'waiting_for_reporter_trade_data',
  };
}


export function computePrice(input={}){
  const productType=input.productType==='futures'?'futures':'cfd';
  const plan=productType==='futures'?'futures':(input.plan==='premium'?'premium':'standard');
  const quantity=Math.round(clamp(input.accountQuantity||input.quantity||1,1,100));
  const billingCycle=CYCLE_MONTHS[input.billingCycle||input.cycle]?input.billingCycle||input.cycle:'monthly';
  const addons=input.addons||{};
  const analyzer=parseBool(addons.analyzer??input.addonAnalyzer);
  const dedicatedEnv=parseBool(addons.dedicatedEnv??input.addonDedicatedEnv);
  const extraEnvAccounts=Math.round(clamp(addons.extraEnvAccounts??input.extraEnvAccounts??0,0,100));
  const basePerMonth=BASE[plan]*quantity;
  const addonsMonthly=(analyzer?ADDON.analyzer:0)+(dedicatedEnv?ADDON.dedicatedEnv+extraEnvAccounts*ADDON.extraEnvAccount:0);
  const months=CYCLE_MONTHS[billingCycle];
  const perMonth=basePerMonth+addonsMonthly;
  return { productType,plan,accountQuantity:quantity,billingCycle,cycleLabel:CYCLE_LABEL[billingCycle],addons:{analyzer,dedicatedEnv,extraEnvAccounts},basePerMonth,addonsMonthly,perMonth,total:perMonth*months,months,savingsMonths:billingCycle==='semiannual'?1:billingCycle==='annual'?2:0,currency:'USD' };
}

function metadata(title,description,path='/'){
  const base=String(process.env.PUBLIC_BASE_URL||'https://wisdo.app').replace(/\/$/,'');
  const url=`${base}${path}`; const image=`${base}/media/wisdo-og.svg`;
  return `<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(url)}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image">`;
}
function publicNav(active='/'){ return [['/','Home'],['/copier','Copier'],['/analyzer','Analyzer'],['/compare','Compare'],['/pricing','Pricing'],['/academy','Academy'],['/resources','Resources']].map(([p,l])=>`<a class="${active===p?'active':''}" href="${p}">${l}</a>`).join(''); }
function publicShell({title,description,path,body,active=path,scripts='',schema=''}){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${metadata(title,description,path)}<link rel="icon" href="/media/logo_transparent_background.png">${schema}<style>${PUBLIC_CSS}</style></head><body><div class="noise"></div><header class="top"><a class="brand" href="/"><img src="/media/logo_transparent_background.png" alt="WISDO"><span>WISDO</span><small>CONNECT · COPY · CONTROL</small></a><nav>${publicNav(active)}</nav><div class="nav-actions"><a class="btn ghost" href="/login">Login</a><a class="btn primary" href="/register">Start now</a></div><button class="mobile-menu" aria-label="Open navigation">☰</button></header>${body}<footer><div><strong>WISDO</strong><p>Trading infrastructure, education, and account controls in one command ecosystem.</p></div><div><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/risk-disclosure">Risk disclosure</a><a href="/contact">Support</a></div><p class="risk">Trading involves substantial risk of loss. Past performance does not guarantee future results.</p></footer><div id="cookie" class="cookie"><div><strong>Privacy controls</strong><p>We use necessary cookies for authentication and optional analytics only after consent.</p></div><button class="btn ghost" data-cookie="necessary">Necessary only</button><button class="btn primary" data-cookie="all">Accept all</button></div><script>${PUBLIC_JS}${scripts}</script><script src="/js/wisdo-assistant.js" defer></script></body></html>`;
}

const PUBLIC_CSS = `
:root{--bg:#03060b;--panel:#09111c;--panel2:#0d1928;--line:rgba(116,255,211,.16);--green:#68f7c4;--blue:#59a8ff;--purple:#9b7bff;--gold:#ffcc74;--text:#f6fbff;--muted:#94a9bb;--red:#ff6f82}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 15% 0,rgba(39,154,255,.13),transparent 33%),radial-gradient(circle at 85% 12%,rgba(104,247,196,.10),transparent 29%),var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;overflow-x:hidden}.noise{position:fixed;inset:0;pointer-events:none;opacity:.16;z-index:9;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.12'/%3E%3C/svg%3E")}.top{height:82px;display:flex;align-items:center;gap:24px;padding:0 max(24px,calc((100vw - 1280px)/2));position:sticky;top:0;z-index:20;background:rgba(3,6,11,.72);backdrop-filter:blur(22px);border-bottom:1px solid rgba(255,255,255,.07)}.brand{display:flex;align-items:center;gap:10px;color:white;text-decoration:none;font-weight:950;letter-spacing:.08em}.brand img{width:40px;height:40px;object-fit:contain}.brand small{font-size:9px;color:var(--muted);letter-spacing:.18em;margin-left:4px}.top nav{display:flex;gap:4px;margin-left:auto}.top nav a,.nav-actions a{color:#cfe0ed;text-decoration:none;padding:10px 12px;border-radius:12px;font-weight:750;font-size:14px}.top nav a:hover,.top nav a.active{background:rgba(104,247,196,.08);color:var(--green)}.nav-actions{display:flex;align-items:center;gap:7px}.btn{border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.04);color:white;text-decoration:none;padding:11px 16px;border-radius:12px;font-weight:850;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}.btn.primary{background:linear-gradient(135deg,var(--green),#2ccba5);color:#03120f;border-color:transparent;box-shadow:0 13px 40px rgba(104,247,196,.18)}.btn.ghost:hover{border-color:var(--green);color:var(--green)}.mobile-menu{display:none}.hero{min-height:720px;display:grid;grid-template-columns:1.05fr .95fr;align-items:center;gap:60px;max-width:1280px;margin:auto;padding:80px 24px 64px;position:relative}.hero:before{content:'';position:absolute;inset:0;background:linear-gradient(125deg,transparent 20%,rgba(89,168,255,.05),transparent 57%);transform:skewX(-13deg);pointer-events:none}.eyebrow{color:var(--green);font-size:12px;text-transform:uppercase;letter-spacing:.2em;font-weight:900}.hero h1,.page-hero h1{font-size:clamp(50px,7vw,92px);line-height:.92;letter-spacing:-.065em;margin:18px 0;max-width:900px}.gradient{background:linear-gradient(100deg,#fff 10%,var(--green) 50%,var(--blue));-webkit-background-clip:text;color:transparent}.lead{color:var(--muted);font-size:19px;line-height:1.72;max-width:680px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.hero-console{background:linear-gradient(180deg,rgba(14,28,44,.95),rgba(5,12,20,.94));border:1px solid rgba(104,247,196,.22);border-radius:26px;box-shadow:0 45px 120px rgba(0,0,0,.45),0 0 90px rgba(89,168,255,.09);padding:18px;position:relative;transform:perspective(1000px) rotateY(-5deg) rotateX(2deg)}.hero-console:after{content:'';position:absolute;inset:-1px;border-radius:26px;background:linear-gradient(135deg,rgba(104,247,196,.3),transparent 25%,transparent 75%,rgba(89,168,255,.25));z-index:-1}.console-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.08);padding:6px 4px 15px}.live{color:var(--green);font-size:12px}.live:before{content:'';display:inline-block;width:8px;height:8px;background:var(--green);border-radius:50%;box-shadow:0 0 18px var(--green);margin-right:7px}.account-row,.metric-grid,.route{display:grid;gap:10px}.account-row{grid-template-columns:1fr auto;align-items:center;padding:14px 4px}.select{background:#081522;border:1px solid rgba(255,255,255,.1);color:white;border-radius:12px;padding:10px}.metric-grid{grid-template-columns:repeat(3,1fr)}.metric{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:15px}.metric small{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.12em}.metric strong{font-size:23px;display:block;margin-top:7px}.green{color:var(--green)}.red{color:var(--red)}.route{grid-template-columns:1fr auto 1fr;align-items:center;margin-top:12px;padding:18px;border-radius:18px;background:linear-gradient(90deg,rgba(89,168,255,.07),rgba(104,247,196,.07))}.route-arrow{width:55px;height:2px;background:linear-gradient(90deg,var(--blue),var(--green));position:relative}.route-arrow:after{content:'›';position:absolute;right:-2px;top:-15px;color:var(--green);font-size:26px}.trust{border-block:1px solid rgba(255,255,255,.07);display:grid;grid-template-columns:repeat(4,1fr);max-width:1280px;margin:auto}.trust div{padding:25px;text-align:center;border-right:1px solid rgba(255,255,255,.07)}.trust div:last-child{border:0}.trust strong{font-size:30px}.trust small{display:block;color:var(--muted);margin-top:4px}.section{max-width:1280px;margin:auto;padding:100px 24px}.section-head{display:flex;justify-content:space-between;gap:30px;align-items:end;margin-bottom:34px}.section h2,.page-section h2{font-size:clamp(34px,4.7vw,62px);letter-spacing:-.055em;line-height:1;margin:10px 0}.section-head p{max-width:560px;color:var(--muted);line-height:1.65}.grid2,.grid3,.grid4{display:grid;gap:18px}.grid2{grid-template-columns:repeat(2,1fr)}.grid3{grid-template-columns:repeat(3,1fr)}.grid4{grid-template-columns:repeat(4,1fr)}.card{background:linear-gradient(180deg,rgba(13,25,40,.82),rgba(6,13,22,.88));border:1px solid rgba(255,255,255,.08);border-radius:21px;padding:24px;position:relative;overflow:hidden;transition:.25s transform,.25s border,.25s box-shadow}.card:hover{transform:translateY(-5px);border-color:rgba(104,247,196,.28);box-shadow:0 30px 70px rgba(0,0,0,.25)}.card h3{font-size:20px;margin:7px 0}.card p,.muted{color:var(--muted);line-height:1.65}.icon{width:48px;height:48px;border-radius:15px;background:linear-gradient(145deg,rgba(104,247,196,.16),rgba(89,168,255,.11));display:grid;place-items:center;font-size:22px;border:1px solid rgba(104,247,196,.15)}.platform-strip{display:flex;gap:16px;overflow:hidden;mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)}.platform-track{display:flex;gap:16px;animation:marquee 36s linear infinite;min-width:max-content}.platform-track img{width:144px;height:58px;object-fit:contain;filter:grayscale(1) brightness(1.9);opacity:.72;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:12px}@keyframes marquee{to{transform:translateX(-50%)}}.market-grid{display:grid;grid-template-columns:1fr 1.5fr 1fr;gap:18px}.sentiment{height:12px;background:#111d29;border-radius:999px;overflow:hidden;display:flex}.sentiment span:first-child{background:var(--green)}.sentiment span:last-child{background:var(--red)}table{width:100%;border-collapse:collapse}th,td{padding:13px;text-align:left;border-bottom:1px solid rgba(255,255,255,.07);font-size:14px}th{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em}.impact{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--red);box-shadow:0 0 12px var(--red)}.price-layout{display:grid;grid-template-columns:1.15fr .85fr;gap:22px}.control{padding:18px 0;border-bottom:1px solid rgba(255,255,255,.07)}.control label{display:block;font-weight:850;margin-bottom:12px}.segments{display:flex;gap:7px;flex-wrap:wrap}.segments button,.stepper button{background:#091522;border:1px solid rgba(255,255,255,.1);color:white;border-radius:11px;padding:10px 13px;cursor:pointer}.segments button.active{background:rgba(104,247,196,.13);border-color:var(--green);color:var(--green)}.stepper{display:flex;align-items:center;gap:12px}.stepper output{font-size:24px;font-weight:950;min-width:45px;text-align:center}.check{display:flex;justify-content:space-between;align-items:center;padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:14px;margin-top:9px}.price-card{position:sticky;top:105px}.price-total{font-size:56px;letter-spacing:-.05em;margin:10px 0}.price-breakdown{list-style:none;padding:0}.price-breakdown li{display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.07);color:var(--muted)}.page-hero{max-width:1280px;margin:auto;padding:105px 24px 70px;text-align:center}.page-hero h1{margin-inline:auto;max-width:1000px}.page-hero .lead{margin-inline:auto}.page-section{max-width:1280px;margin:auto;padding:55px 24px 100px}.compare-controls{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:22px}.input,select,textarea{width:100%;background:#07121d;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px;color:white}.auth-wrap{min-height:calc(100vh - 82px);display:grid;place-items:center;padding:50px 20px}.auth-card{width:min(520px,100%);background:rgba(9,17,28,.92);border:1px solid rgba(104,247,196,.18);border-radius:24px;padding:30px;box-shadow:0 40px 100px rgba(0,0,0,.4)}.auth-card form{display:grid;gap:13px}.auth-card label{font-size:13px;font-weight:800}.testimonials{display:flex;overflow:auto;scroll-snap-type:x mandatory;gap:18px;padding-bottom:10px}.testimonial{min-width:min(430px,90vw);scroll-snap-align:start}.stars{color:var(--gold)}footer{max-width:1280px;margin:70px auto 0;padding:45px 24px;border-top:1px solid rgba(255,255,255,.08);display:grid;grid-template-columns:1fr auto;gap:24px;color:var(--muted)}footer a{color:#cfe0ed;text-decoration:none;margin-left:18px}.risk{grid-column:1/-1;font-size:12px}.cookie{position:fixed;z-index:100;left:22px;right:22px;bottom:22px;background:rgba(8,17,27,.96);border:1px solid rgba(104,247,196,.18);border-radius:18px;padding:16px;display:none;align-items:center;gap:12px;box-shadow:0 30px 80px rgba(0,0,0,.5)}.cookie div{margin-right:auto}.cookie p{margin:4px 0;color:var(--muted)}.reveal{opacity:0;transform:translateY(24px);transition:.7s ease}.reveal.visible{opacity:1;transform:none}.workspace{display:grid;grid-template-columns:250px 1fr;min-height:100vh;background:#050910}.workspace aside{padding:22px;border-right:1px solid rgba(255,255,255,.07);position:sticky;top:0;height:100vh;background:#07101a}.workspace main{padding:28px;min-width:0}.workspace aside a{display:block;color:#c9d8e5;text-decoration:none;padding:11px 12px;border-radius:10px;margin:4px 0}.workspace aside a.active,.workspace aside a:hover{background:rgba(104,247,196,.1);color:var(--green)}.workspace .mobile-account{display:none}.toast{position:fixed;right:20px;bottom:20px;background:#0b1b29;border:1px solid var(--green);padding:14px;border-radius:13px;z-index:100}@media(max-width:980px){.top nav{display:none}.brand small{display:none}.mobile-menu{display:block;background:transparent;color:white;border:0;font-size:24px}.hero{grid-template-columns:1fr;min-height:auto}.hero-console{transform:none}.grid3,.grid4,.market-grid{grid-template-columns:1fr 1fr}.price-layout{grid-template-columns:1fr}.price-card{position:relative;top:auto}.workspace{grid-template-columns:1fr}.workspace aside{display:none}.workspace .mobile-account{display:block}.trust{grid-template-columns:1fr 1fr}}@media(max-width:640px){.academy-course-grid,.academy-profile-grid,.command-map,.lesson-progress-nav,.lesson-context-grid,.lesson-vocabulary{grid-template-columns:1fr}.academy-filter{grid-template-columns:1fr}.scenario-actions{grid-template-columns:1fr 1fr}.tutor-compose{grid-template-columns:1fr}.academy-stat-grid{grid-template-columns:1fr 1fr}.top{padding:0 16px}.nav-actions .ghost{display:none}.hero,.section,.page-hero,.page-section{padding-inline:17px}.hero h1,.page-hero h1{font-size:48px}.metric-grid,.grid2,.grid3,.grid4,.market-grid{grid-template-columns:1fr}.trust{grid-template-columns:1fr 1fr}.trust div{padding:17px}.route{grid-template-columns:1fr}.route-arrow{transform:rotate(90deg);margin:12px auto}.section-head{display:block}.cookie{display:grid;left:10px;right:10px}.workspace main{padding:16px}}
.btn.danger{border-color:rgba(255,111,130,.45);color:#ff9bab;background:rgba(255,111,130,.08)}.btn.danger:hover{background:rgba(255,111,130,.16)}dialog{border:0;padding:0;background:transparent;color:inherit;max-width:720px;width:min(94vw,720px)}dialog::backdrop{background:rgba(0,0,0,.76);backdrop-filter:blur(7px)}.dialog-form{display:grid;grid-template-columns:1fr 1fr;gap:14px;max-height:88vh;overflow:auto}.dialog-form h3,.dialog-form p,.dialog-form .actions{grid-column:1/-1}.dialog-form label{display:grid;gap:7px;color:#cfe0ed;font-weight:700}.full{grid-column:1/-1}.account-line{display:flex;justify-content:space-between;gap:15px;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.07)}.feature-list{padding-left:20px;color:var(--muted);line-height:1.9}.table-wrap{overflow:auto}.mini-chart{display:flex;align-items:end;height:270px;gap:6px}.mini-chart i{flex:1;min-width:5px;background:linear-gradient(var(--green),var(--blue));border-radius:6px 6px 0 0}.danger-zone{margin-top:18px;border-color:rgba(255,111,130,.25)}.toast.warn{border-color:var(--gold)}pre{white-space:pre-wrap;overflow:auto}.workspace label{display:grid;gap:7px}.workspace input[type=checkbox]{accent-color:var(--green)}@media(max-width:640px){.academy-course-grid,.academy-profile-grid,.command-map,.lesson-progress-nav,.lesson-context-grid,.lesson-vocabulary{grid-template-columns:1fr}.academy-filter{grid-template-columns:1fr}.scenario-actions{grid-template-columns:1fr 1fr}.tutor-compose{grid-template-columns:1fr}.academy-stat-grid{grid-template-columns:1fr 1fr}.dialog-form{grid-template-columns:1fr}.account-line{align-items:flex-start;flex-direction:column}}

html[data-theme="cobalt"]{--bg:#020817;--panel:#08162c;--panel2:#0d2240;--green:#66d9ff;--blue:#508cff;--purple:#9a7cff;--gold:#8ed8ff;--line:rgba(102,217,255,.18)}html[data-theme="emerald"]{--bg:#03110d;--panel:#082019;--panel2:#0b2a20;--green:#5cffb2;--blue:#54d6c7;--purple:#9cead0;--gold:#d5ff7a;--line:rgba(92,255,178,.18)}html[data-theme="violet"]{--bg:#0a0614;--panel:#171027;--panel2:#21163a;--green:#d09aff;--blue:#8e8cff;--purple:#c368ff;--gold:#ffb3eb;--line:rgba(208,154,255,.2)}html[data-theme="gold"]{--bg:#0d0902;--panel:#1b1307;--panel2:#2a1b08;--green:#ffcc74;--blue:#eaa64e;--purple:#d79654;--gold:#ffd36e;--line:rgba(255,204,116,.2)}html[data-theme="ember"]{--bg:#100506;--panel:#210b0e;--panel2:#321116;--green:#ff9e75;--blue:#ff6f82;--purple:#d86190;--gold:#ffc06a;--line:rgba(255,111,130,.22)}html[data-theme="light"]{--bg:#eef4fb;--panel:#ffffff;--panel2:#e7f0fa;--green:#087f68;--blue:#1767d7;--purple:#7147c7;--gold:#9a5b00;--text:#07111e;--muted:#526577;--red:#bb2744;--line:rgba(23,103,215,.18)}html[data-theme="light"] body,html[data-theme="light"] .workspace{color:var(--text)}html[data-theme="light"] .card,html[data-theme="light"] .workspace aside,html[data-theme="light"] .workspace-topbar{background:rgba(255,255,255,.9);color:var(--text)}html[data-theme="light"] .input,html[data-theme="light"] select,html[data-theme="light"] textarea{background:#fff;color:#07111e;border-color:rgba(7,17,30,.15)}
.workspace-bg-video{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-4;opacity:0;transition:opacity .6s;filter:saturate(1.05) brightness(.34)}.workspace-bg-video.active{opacity:.55}.workspace-bg-overlay{position:fixed;inset:0;z-index:-3;background:radial-gradient(circle at 15% 0,rgba(89,168,255,.16),transparent 34%),radial-gradient(circle at 86% 8%,rgba(104,247,196,.12),transparent 32%),linear-gradient(145deg,rgba(3,6,11,.96),rgba(7,16,26,.88));pointer-events:none}html[data-background="terminal"] .workspace-bg-overlay{background:repeating-linear-gradient(0deg,rgba(104,247,196,.025) 0 1px,transparent 1px 5px),#020604}html[data-background="solid"] .workspace-bg-overlay{background:var(--bg)}html[data-background="motion-a"] .workspace-bg-overlay,html[data-background="motion-b"] .workspace-bg-overlay{background:linear-gradient(145deg,rgba(3,6,11,.88),rgba(7,16,26,.7))}.workspace{background:transparent}.workspace aside{display:flex;flex-direction:column;background:color-mix(in srgb,var(--panel) 88%,transparent);backdrop-filter:blur(22px);border-color:var(--line);z-index:4}.member-identity{padding:14px 10px 18px;border-bottom:1px solid var(--line);margin-bottom:8px}.member-identity small{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.14em}.member-identity strong{display:block;margin-top:5px;overflow:hidden;text-overflow:ellipsis}.aside-spacer{flex:1}.workspace main{padding:0 28px 32px}.workspace-topbar{position:sticky;top:0;z-index:5;min-height:82px;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px 0;background:color-mix(in srgb,var(--bg) 78%,transparent);backdrop-filter:blur(20px);border-bottom:1px solid var(--line);margin-bottom:25px}.workspace-topbar strong{display:block;font-size:20px}.topbar-account{display:flex;align-items:center;gap:12px;min-width:min(560px,55vw)}.topbar-account>span{font-size:12px;color:var(--muted);white-space:nowrap}.workspace .mobile-account{display:block}.workspace-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:22px}.workspace-heading h1{font-size:clamp(34px,5vw,58px);letter-spacing:-.055em;line-height:1;margin:8px 0}.live-chip,.status-pill{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;padding:7px 10px;font-size:12px;color:var(--green);background:color-mix(in srgb,var(--green) 8%,transparent)}.status-pill.connected{color:var(--green)}.status-pill.waiting{color:var(--gold)}.selected-account-banner{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:18px;border-color:var(--line)}.mini-metrics{display:grid;grid-template-columns:repeat(4,minmax(90px,1fr));gap:10px}.mini-metrics>div{padding:10px 12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:13px}.mini-metrics small{display:block;color:var(--muted)}.mini-metrics strong{display:block;margin-top:5px}.card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.account-select-line{width:100%;background:transparent;color:var(--text);border:0;text-align:left;cursor:pointer}.account-select-line:hover{background:rgba(255,255,255,.025)}.account-heartbeat{display:flex;justify-content:space-between;gap:12px;padding:12px 0;margin-top:10px;border-top:1px solid rgba(255,255,255,.07);font-size:12px}.account-heartbeat span{color:var(--muted)}.capability-row{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.account-role-form{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07)}.account-role-form .full{grid-column:1/-1}.account-role-form label{font-size:12px;color:var(--muted)}.account-role-form .input{margin-top:5px}.pairing-code{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:8px;padding:12px;background:rgba(104,247,196,.06);border:1px solid var(--line);border-radius:14px;margin-top:12px}.pairing-code small{grid-column:1/-1;color:var(--muted)}.pairing-code code{overflow:auto}.setup-note,.form-status{padding:13px 15px;border:1px solid var(--line);border-radius:14px;background:rgba(89,168,255,.06)}.setup-note{grid-column:1/-1}.setup-note p{margin:5px 0 0}.form-status{grid-column:1/-1;color:var(--muted)}.form-status.working{color:var(--blue)}.form-status.success{color:var(--green);background:rgba(104,247,196,.07)}.form-status.error{color:var(--red);background:rgba(255,111,130,.07);border-color:rgba(255,111,130,.3)}.dialog-x{border:0;background:transparent;color:var(--text);font-size:26px;cursor:pointer}.dialog-form details{grid-column:1/-1;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:13px}.dialog-form summary{cursor:pointer;font-weight:850}.toast.error{border-color:var(--red)}button:disabled{opacity:.55;cursor:wait}.heat-row{display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.07)}.appearance-panel{padding:18px;border:1px solid var(--line);border-radius:17px}.theme-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:9px;margin-top:14px}.theme-choice{cursor:pointer;text-align:center}.theme-choice input{position:absolute;opacity:0}.theme-choice span{display:block;height:46px;border-radius:12px;border:2px solid transparent;background:linear-gradient(135deg,#050910,#68f7c4)}.theme-choice.cobalt span{background:linear-gradient(135deg,#020817,#508cff)}.theme-choice.emerald span{background:linear-gradient(135deg,#03110d,#5cffb2)}.theme-choice.violet span{background:linear-gradient(135deg,#0a0614,#c368ff)}.theme-choice.gold span{background:linear-gradient(135deg,#0d0902,#ffd36e)}.theme-choice.ember span{background:linear-gradient(135deg,#100506,#ff6f82)}.theme-choice.light span{background:linear-gradient(135deg,#fff,#1767d7)}.theme-choice input:checked+span{border-color:var(--text);box-shadow:0 0 0 3px color-mix(in srgb,var(--green) 32%,transparent)}.theme-choice strong{font-size:11px;text-transform:capitalize}.background-choice{display:inline-flex!important;cursor:pointer}.background-choice input{position:absolute;opacity:0}.background-choice span{padding:10px 13px;border:1px solid var(--line);border-radius:12px;text-transform:capitalize}.background-choice input:checked+span{background:color-mix(in srgb,var(--green) 15%,transparent);color:var(--green)}

.wisdo-boot{position:fixed;inset:0;z-index:10000;display:none;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 42%,color-mix(in srgb,var(--green) 20%,transparent),transparent 25%),radial-gradient(circle at 50% 50%,#071526 0,#03070d 56%,#010204 100%);color:#fff}.wisdo-boot.active{display:grid}.wisdo-boot-grid{position:absolute;inset:-20%;opacity:.25;background-image:linear-gradient(color-mix(in srgb,var(--green) 15%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--blue) 13%,transparent) 1px,transparent 1px);background-size:52px 52px;transform:perspective(550px) rotateX(62deg) translateY(35%);animation:wisdoGridMove 5s linear infinite}.wisdo-boot-stars{position:absolute;inset:0;background-image:radial-gradient(circle,#fff 0 1px,transparent 1.5px);background-size:79px 83px;opacity:.25;animation:wisdoStars 9s linear infinite}.wisdo-boot-shell{position:relative;width:min(720px,calc(100vw - 30px));padding:36px 30px 28px;text-align:center;border:1px solid color-mix(in srgb,var(--green) 28%,transparent);border-radius:30px;background:linear-gradient(180deg,rgba(7,20,34,.84),rgba(2,7,13,.92));box-shadow:0 0 110px color-mix(in srgb,var(--green) 20%,transparent),0 40px 100px rgba(0,0,0,.6);backdrop-filter:blur(20px)}.wisdo-boot-orb{position:relative;width:168px;height:168px;margin:0 auto 24px;display:grid;place-items:center}.wisdo-boot-orb:before,.wisdo-boot-orb:after{content:'';position:absolute;border-radius:50%;inset:0;border:1px solid color-mix(in srgb,var(--green) 55%,transparent);box-shadow:inset 0 0 40px color-mix(in srgb,var(--green) 18%,transparent),0 0 45px color-mix(in srgb,var(--green) 22%,transparent);animation:wisdoBootRing 2.1s ease-in-out infinite}.wisdo-boot-orb:after{inset:17px;border-color:color-mix(in srgb,var(--blue) 55%,transparent);animation-delay:-.7s;animation-direction:reverse}.wisdo-boot-core{position:relative;width:92px;height:92px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 25%,#ecfff8,var(--green) 23%,#087f68 58%,#02150e 100%);box-shadow:0 0 35px var(--green),0 0 90px color-mix(in srgb,var(--green) 55%,transparent);animation:wisdoBootCore 1.55s ease-in-out infinite}.wisdo-boot-core img{width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 4px 12px rgba(0,0,0,.35))}.wisdo-boot h1{font-size:clamp(30px,5vw,52px);letter-spacing:.18em;margin:0;text-transform:uppercase}.wisdo-boot-kicker{display:block;margin:9px 0 22px;color:var(--green);font-size:11px;font-weight:900;letter-spacing:.25em;text-transform:uppercase}.wisdo-boot-status{min-height:26px;color:#d8eafa;font-weight:800}.wisdo-boot-track{height:8px;margin:18px auto 13px;overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(255,255,255,.055)}.wisdo-boot-track span{display:block;width:4%;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--blue),var(--green),#fff);box-shadow:0 0 18px var(--green);transition:width .38s ease}.wisdo-boot-meta{display:flex;justify-content:space-between;gap:12px;color:#8297aa;font:700 11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.07em;text-transform:uppercase}.wisdo-boot-skip{position:absolute;right:18px;top:18px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.05);color:#d9e7f2;border-radius:999px;padding:8px 12px;cursor:pointer}.wisdo-boot.ready .wisdo-boot-core{background:radial-gradient(circle at 35% 25%,#fff,var(--green) 30%,#0c9f78 65%,#02150e 100%)}.wisdo-boot.error .wisdo-boot-core{background:radial-gradient(circle at 35% 25%,#fff,#ff9bab 30%,#a51f3c 65%,#21030a 100%);box-shadow:0 0 35px var(--red)}@keyframes wisdoBootRing{0%,100%{transform:scale(.88) rotate(0);opacity:.45}50%{transform:scale(1.06) rotate(180deg);opacity:1}}@keyframes wisdoBootCore{50%{transform:scale(1.07);filter:saturate(1.25)}}@keyframes wisdoGridMove{to{background-position:0 104px,104px 0}}@keyframes wisdoStars{to{transform:translate3d(-79px,83px,0)}}@media(prefers-reduced-motion:reduce){.wisdo-boot-grid,.wisdo-boot-stars,.wisdo-boot-orb:before,.wisdo-boot-orb:after,.wisdo-boot-core{animation:none}}
.academy-hero{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;background:linear-gradient(135deg,color-mix(in srgb,var(--green) 11%,var(--panel)),color-mix(in srgb,var(--blue) 9%,var(--panel)))}.academy-hero h1{font-size:clamp(34px,5vw,64px);letter-spacing:-.055em;line-height:.98;margin:10px 0}.academy-score{min-width:160px;text-align:center;border:1px solid var(--line);border-radius:20px;padding:20px}.academy-score small,.academy-score span{color:var(--muted)}.academy-score strong{font-size:54px;display:block}.academy-panel{margin-top:18px}.academy-replay-grid,.academy-video-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(310px,.7fr);gap:18px}.chart-card{padding:14px}.academy-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.academy-toolbar .input{width:auto;min-width:150px}.chart-card canvas{width:100%;height:440px;background:#03070d;border:1px solid rgba(255,255,255,.08);border-radius:15px}.replay-progress{height:7px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden;margin-top:10px}.replay-progress span{display:block;height:100%;background:linear-gradient(90deg,var(--green),var(--blue));width:0}.brain-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}.brain-grid>div,.card.mini{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.025)}.brain-grid small{display:block;color:var(--muted)}.decision-box{padding:15px;border:1px solid var(--line);border-radius:16px;background:rgba(104,247,196,.045)}.video-stage{padding:12px}.video-stage video{display:block;width:100%;max-height:520px;border-radius:15px;background:#000}.video-prompt{position:absolute;left:28px;right:28px;bottom:28px;background:rgba(3,6,11,.86);backdrop-filter:blur(15px);border:1px solid var(--line);border-radius:16px;padding:16px}.chapter{display:block;width:100%;text-align:left;padding:13px;border:1px solid rgba(255,255,255,.08);background:transparent;color:var(--text);border-radius:12px;margin:8px 0;cursor:pointer}.chapter.active,.chapter:hover{border-color:var(--green);background:rgba(104,247,196,.07)}.tv-frame{width:100%;height:650px;border:1px solid var(--line);border-radius:16px;background:#07121d}.lesson-map{color:var(--muted);line-height:1.8}.track-card{padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:15px;background:rgba(255,255,255,.025)}.academy-progress{text-align:right}.academy-progress strong{font-size:32px;display:block}.academy-progress span{color:var(--muted)}

.lesson-player{display:grid;gap:18px}.lesson-context-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.lesson-context-grid>div{padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.025)}.lesson-context-grid small{display:block;color:var(--muted);margin-bottom:5px}.lesson-progress-nav{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.lesson-step{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:8px;text-align:left;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);color:var(--text);cursor:pointer}.lesson-step span{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.07);font-weight:900}.lesson-step small{line-height:1.25}.lesson-step.active{border-color:var(--green);background:rgba(104,247,196,.08)}.lesson-step.complete span{background:var(--green);color:#03120f}.lesson-stage-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:16px}.lesson-scene,.lesson-coach{padding:20px;border:1px solid rgba(255,255,255,.08);border-radius:17px;background:rgba(0,0,0,.14)}.lesson-scene section{margin-top:14px;padding:15px;border-radius:14px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025)}.lesson-scene section h3{margin-top:0}.lesson-example{border-color:rgba(89,168,255,.24)!important}.lesson-activity{border-color:rgba(255,204,116,.22)!important}.lesson-checkpoint{border-color:rgba(104,247,196,.22)!important}.lesson-vocabulary{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:14px}.lesson-vocabulary div{padding:12px;border-radius:12px;background:rgba(89,168,255,.06);border:1px solid rgba(89,168,255,.14)}.lesson-vocabulary strong,.lesson-vocabulary span{display:block}.lesson-vocabulary span{color:var(--muted);font-size:13px;line-height:1.5;margin-top:4px}.lesson-choices{display:grid;gap:8px}.lesson-choices .btn{justify-content:flex-start;text-align:left}.lesson-tutor-thread{min-height:220px;max-height:420px;margin-top:12px}.lesson-coach form{display:grid;gap:9px}.command-hub{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:18px}.command-map{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.command-module{display:block;text-decoration:none;color:var(--text);padding:18px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:rgba(255,255,255,.025)}.command-module:hover{border-color:var(--green);background:rgba(104,247,196,.06)}.command-module small{display:block;color:var(--muted);margin-top:7px}.academy-shell{display:grid;gap:18px}.academy-tabs{display:flex;gap:8px;flex-wrap:wrap}.academy-tabs button.active{background:linear-gradient(135deg,var(--green),#2ccba5);color:#03120f;border-color:transparent}.academy-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.academy-stat{padding:16px;border:1px solid rgba(255,255,255,.08);border-radius:15px;background:rgba(255,255,255,.025)}.academy-stat strong{display:block;font-size:30px}.academy-layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(310px,.55fr);gap:18px}.academy-course-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.course-tile{padding:16px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:rgba(255,255,255,.025);cursor:pointer;color:var(--text);text-align:left}.course-tile:hover{border-color:var(--green);transform:translateY(-2px)}.course-tile h3{font-size:16px}.course-meta{display:flex;gap:7px;flex-wrap:wrap}.course-meta span{font-size:11px;color:var(--muted);border:1px solid rgba(255,255,255,.08);padding:5px 8px;border-radius:999px}.academy-filter{display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px}.path-list{display:grid;gap:9px}.path-item{padding:13px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.02)}.tutor-thread{min-height:290px;max-height:520px;overflow:auto;display:grid;gap:10px;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:15px;background:rgba(0,0,0,.18)}.tutor-message{max-width:88%;padding:12px 14px;border-radius:14px;white-space:pre-wrap;line-height:1.55}.tutor-message.user{justify-self:end;background:rgba(89,168,255,.14)}.tutor-message.assistant{justify-self:start;background:rgba(104,247,196,.09)}.tutor-compose{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:10px}.tutor-recommendations{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08)}.tutor-recommendations small{width:100%;color:var(--muted)}.tutor-recommendations .btn{font-size:11px;padding:7px 9px}.scenario-stage{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(300px,.55fr);gap:14px}.scenario-chart{width:100%;height:460px;background:#03070d;border:1px solid rgba(255,255,255,.08);border-radius:15px}.scenario-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.checkpoint{padding:13px;border-radius:13px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025)}.checkpoint.current{border-color:var(--green);box-shadow:0 0 0 1px rgba(104,247,196,.12)}.private-strategy-notice{padding:14px;border:1px solid rgba(255,204,116,.25);background:rgba(255,204,116,.06);border-radius:14px;color:#ffe6b8}.academy-profile-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.academy-profile-grid .full{grid-column:1/-1}.voice-toggle{display:flex;align-items:center;gap:8px}.tv-status{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:10px}.tv-frame{width:100%;height:650px;border:1px solid var(--line);border-radius:16px;background:#07121d}
@media(max-width:1050px){.command-hub,.academy-layout,.scenario-stage,.lesson-stage-grid{grid-template-columns:1fr}.lesson-progress-nav{grid-template-columns:repeat(2,1fr)}.lesson-context-grid{grid-template-columns:repeat(2,1fr)}.academy-course-grid{grid-template-columns:repeat(2,1fr)}.academy-stat-grid{grid-template-columns:repeat(2,1fr)}.academy-filter{grid-template-columns:1fr 1fr}.command-map{grid-template-columns:repeat(2,1fr)}.topbar-account{min-width:0;flex:1}.selected-account-banner,.workspace-heading{display:block}.mini-metrics{margin-top:15px}.academy-replay-grid,.academy-video-grid{grid-template-columns:1fr}.theme-grid{grid-template-columns:repeat(4,1fr)}}@media(max-width:640px){.academy-course-grid,.academy-profile-grid,.command-map,.lesson-progress-nav,.lesson-context-grid,.lesson-vocabulary{grid-template-columns:1fr}.academy-filter{grid-template-columns:1fr}.scenario-actions{grid-template-columns:1fr 1fr}.tutor-compose{grid-template-columns:1fr}.academy-stat-grid{grid-template-columns:1fr 1fr}.workspace-topbar{display:block}.topbar-account{display:block}.topbar-account>span{display:block;margin:6px 0}.mini-metrics{grid-template-columns:1fr 1fr}.academy-hero{grid-template-columns:1fr}.academy-score{min-width:0}.chart-card canvas{height:330px}.theme-grid{grid-template-columns:repeat(3,1fr)}.pairing-code{grid-template-columns:1fr}.video-prompt{position:relative;left:auto;right:auto;bottom:auto;margin-top:10px}}

`;
const PUBLIC_JS = `
(()=>{const c=document.getElementById('cookie');if(c&&!localStorage.getItem('wisdo_cookie'))c.style.display='flex';document.querySelectorAll('[data-cookie]').forEach(b=>b.onclick=()=>{localStorage.setItem('wisdo_cookie',b.dataset.cookie);c.style.display='none'});const io=new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting&&e.target.classList.add('visible')),{threshold:.12});document.querySelectorAll('.reveal').forEach(e=>io.observe(e));document.querySelectorAll('[data-count]').forEach(el=>{const target=Number(el.dataset.count);let n=0;const step=Math.max(1,target/70);const tick=()=>{n=Math.min(target,n+step);el.textContent=target>=1000000?(n/1000000).toFixed(n<target?1:0)+'M+':Math.round(n)+(el.dataset.suffix||'');if(n<target)requestAnimationFrame(tick)};tick()});document.querySelectorAll('.card').forEach(card=>card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect();card.style.background='radial-gradient(circle at '+(e.clientX-r.left)+'px '+(e.clientY-r.top)+'px,rgba(104,247,196,.09),transparent 35%),linear-gradient(180deg,rgba(13,25,40,.82),rgba(6,13,22,.88))'}));})();
`;

function homePage(){
 const schema=`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'SoftwareApplication',name:'WISDO',applicationCategory:'FinanceApplication',operatingSystem:'Web, Windows, MetaTrader',offers:{'@type':'AggregateOffer',lowPrice:'10',highPrice:'30',priceCurrency:'USD'},description:'Multi-account trading command center, copier engine, analyzer, education, and affiliate ecosystem.'})}</script>`;
 const platforms=[...PLATFORMS,...PLATFORMS].map(p=>`<img src="/platforms/${p}.svg" alt="${esc(p)}">`).join('');
 const body=`<main><section class="hero"><div><span class="eyebrow">Trading infrastructure for connected operators</span><h1>Every account.<br><span class="gradient">One command center.</span></h1><p class="lead">Connect trading accounts, relay positions, govern follower risk, control MT4 from mobile, study campaign character, and grow an affiliate ecosystem without stitching together five disconnected tools.</p><div class="actions"><a class="btn primary" href="/register">Build your desk</a><a class="btn ghost" href="/copier">Explore the copier</a></div></div><div class="hero-console" data-parallax><div class="console-head"><strong>WISDO Command Center</strong><span class="live">Bridge online</span></div><div class="account-row"><div><small class="muted">Active desk</small><strong>Coinexx · 5301063</strong></div><select class="select"><option>Follower · 5301063</option><option>Culture Lead · 5205295</option></select></div><div class="metric-grid"><div class="metric"><small>Balance</small><strong>$24,842</strong></div><div class="metric"><small>Equity</small><strong class="green">$25,190</strong></div><div class="metric"><small>Floating</small><strong class="green">+$348</strong></div></div><div class="route"><div><small class="muted">Culture Lead</small><strong>5205295 · XAUUSD</strong></div><div class="route-arrow"></div><div><small class="muted">Mirror Receiver</small><strong>5301063 · XAUUSD</strong></div></div><div class="card" style="margin-top:12px"><small class="muted">Account Health Governor</small><div style="display:flex;justify-content:space-between;margin-top:8px"><strong class="green">Healthy · 87/100</strong><span>Equity ratio · 1.00×</span></div></div></div></section><section class="trust"><div><strong data-count="20" data-suffix="ms">0</strong><small>target relay latency</small></div><div><strong data-count="100" data-suffix="M+">0</strong><small>trade-volume ready</small></div><div><strong data-count="99.9" data-suffix="%">0</strong><small>availability architecture</small></div><div><strong>10</strong><small>supported platforms</small></div></section><section class="section reveal"><div class="section-head"><div><span class="eyebrow">One operating system</span><h2>Connect. Copy. Control.</h2></div><p>WISDO combines account linking, relay execution, safety governance, analytics, education, community leads, mobile controls, and revenue systems.</p></div><div class="grid3"><div class="card"><div class="icon">⇄</div><h3>Culture Relay Engine</h3><p>Map a lead to one or many receivers with fixed lot, multiplier, equity ratio, symbol aliases, trading hours, and drawdown gates.</p><a href="/copier">Open copier deep dive →</a></div><div class="card"><div class="icon">⌁</div><h3>WISDO Insight Engine</h3><p>Read ROI, equity curve, win rate, drawdown, session heatmaps, symbol performance, and per-account health.</p><a href="/analyzer">Explore analytics →</a></div><div class="card"><div class="icon">✦</div><h3>Wisdo Academy</h3><p>Learn DF Sauce, campaign character, bot control, copier safety, and risk through interactive chart scenarios.</p><a href="/academy">Enter Academy →</a></div></div></section><section class="section reveal"><div class="section-head"><div><span class="eyebrow">Bridge coverage</span><h2>Built for the platforms traders actually use.</h2></div></div><div class="platform-strip"><div class="platform-track">${platforms}</div></div></section><section class="section reveal"><div class="section-head"><div><span class="eyebrow">Market context</span><h2>Know the environment before the relay fires.</h2></div><p>These widgets use provider data when configured and clearly label fallback data when no provider key is present.</p></div><div class="market-grid" id="market-widgets"><div class="card"><h3>Market Sentiment</h3><div data-sentiment></div></div><div class="card"><h3>Economic Calendar</h3><div data-calendar>Loading…</div></div><div class="card"><h3>Market News</h3><div data-news>Loading…</div></div></div></section><section class="section reveal"><div class="section-head"><div><span class="eyebrow">Proof from operators</span><h2>Fast enough to feel invisible.</h2></div></div><div class="testimonials"><div class="card testimonial"><div class="stars">★★★★★</div><h3>“Copies fire before I can blink.”</h3><p>Account switching and account-specific close controls finally make sense on my phone.</p><strong>A. Rahman · Prop trader</strong></div><div class="card testimonial"><div class="stars">★★★★★</div><h3>“The risk controls are the product.”</h3><p>I can let a follower scale by equity without giving it permission to overexpose the account.</p><strong>M. Carter · Portfolio operator</strong></div><div class="card testimonial"><div class="stars">★★★★★</div><h3>“One ecosystem instead of five tabs.”</h3><p>Discord, MT4, education, signals, and affiliate tracking finally live together.</p><strong>J. Lewis · Community lead</strong></div></div></section><section class="section reveal"><div class="card" style="padding:45px;text-align:center;background:linear-gradient(135deg,rgba(104,247,196,.12),rgba(89,168,255,.1))"><span class="eyebrow">Build the desk</span><h2>Move from scattered tools to a controlled trading ecosystem.</h2><p class="lead" style="margin:auto">Start with one account. Expand into multi-account relay, education, community copying, and affiliate revenue when the desk is ready.</p><div class="actions" style="justify-content:center"><a class="btn primary" href="/pricing">Configure pricing</a><a class="btn ghost" href="/register">Create account</a></div></div></section></main>`;
 const scripts=`fetch('/api/market/widgets').then(r=>r.json()).then(d=>{const s=document.querySelector('[data-sentiment]');s.innerHTML=d.sentiment.map(x=>'<p><strong>'+x.symbol+'</strong> <small class="muted">'+x.source+'</small></p><div class="sentiment"><span style="width:'+x.long+'%"></span><span style="width:'+x.short+'%"></span></div><small>'+x.long+'% long · '+x.short+'% short</small>').join('');document.querySelector('[data-calendar]').innerHTML='<table><tbody>'+d.calendar.map(x=>'<tr><td><span class="impact"></span></td><td><strong>'+x.event+'</strong><br><small class="muted">'+x.time+' · '+x.currency+'</small></td><td>'+x.forecast+'</td></tr>').join('')+'</tbody></table>';document.querySelector('[data-news]').innerHTML=d.news.map(x=>'<p><strong>'+x.title+'</strong><br><small class="muted">'+x.source+' · '+x.age+'</small></p>').join('')});`;
 return publicShell({title:'WISDO — Connect. Copy. Control.',description:'A premium multi-account trading command center, copier engine, analyzer, education platform, and affiliate ecosystem.',path:'/',body,active:'/',scripts,schema});
}

function productPage(kind){
 const data={copier:{eyebrow:'Culture Relay Engine',title:'Copy with rules, not hope.',lead:'Control how every follower receives risk, symbols, protection, and closing instructions.',cards:[['Four risk modes','Fixed lot, multiplier, equity ratio, and balance ratio with min/max lot caps.'],['Broker-aware mapping','Map GOLD to XAUUSD, suffixes, prefixes, and custom aliases before the command enters the queue.'],['Protection gates','Equity protection, max daily loss, spread, trading hours, max positions, and route pause.'],['Close authority','Closing commands bypass opening filters so followers are never trapped by an allowed-symbol rule.']],visual:'copier'},analyzer:{eyebrow:'WISDO Insight Engine',title:'See the truth across every account.',lead:'Turn snapshots and trade history into usable decisions, not a wall of disconnected numbers.',cards:[['ROI and equity curve','Portfolio and account-level time series with period controls.'],['Drawdown intelligence','Current, peak, recovery, and account-health context.'],['Heatmaps','Symbol, session, weekday, and strategy performance.'],['Export and AI analysis','CSV export plus grounded insight using the same selected account.']],visual:'analyzer'},compare:{eyebrow:'Broker + Prop Comparison',title:'Compare rules before capital is committed.',lead:'Filter brokers and prop firms by platform, drawdown, payout split, refund terms, and minimum days.',cards:[['Normalized rules','Side-by-side fields reduce marketing-language confusion.'],['Platform filters','See only firms that support the platform attached to your desk.'],['Save shortlists','Keep a comparison list inside your profile.'],['Admin-managed data','Firm records can be updated without redeploying the website.']],visual:'compare'}}[kind];
 const visual=data.visual==='analyzer'?`<div class="card"><h3>Portfolio ROI</h3><div style="height:220px;display:flex;align-items:end;gap:8px">${[32,47,41,58,69,62,81,77,92,108,104,123].map((v,i)=>`<i style="display:block;flex:1;height:${v}px;background:linear-gradient(var(--green),var(--blue));border-radius:6px 6px 0 0;opacity:${.45+i/24}"></i>`).join('')}</div><div class="grid3"><div class="metric"><small>ROI</small><strong class="green">+18.6%</strong></div><div class="metric"><small>Win rate</small><strong>64.2%</strong></div><div class="metric"><small>Max DD</small><strong class="red">7.8%</strong></div></div></div>`:data.visual==='compare'?`<div class="card"><table><thead><tr><th>Firm</th><th>DD</th><th>Split</th><th>Platform</th></tr></thead><tbody>${FIRMS.slice(0,3).map(f=>`<tr><td>${f.name}</td><td>${f.max_drawdown_pct||'—'}%</td><td>${f.profit_split_pct||'—'}%</td><td>${f.supported_platforms[0]}</td></tr>`).join('')}</tbody></table></div>`:`<div class="hero-console"><div class="console-head"><strong>Active Culture Lane</strong><span class="live">Relaying</span></div><div class="route"><div><small>Lead</small><strong>XAUUSD · 0.20</strong></div><div class="route-arrow"></div><div><small>Follower</small><strong>XAUUSD.a · 0.08</strong></div></div><div class="grid2" style="margin-top:12px"><div class="metric"><small>Risk mode</small><strong>Equity ratio</strong></div><div class="metric"><small>Latency</small><strong class="green">18ms</strong></div></div></div>`;
 return publicShell({title:`WISDO ${data.eyebrow}`,description:data.lead,path:`/${kind}`,active:`/${kind}`,body:`<main><section class="page-hero"><span class="eyebrow">${data.eyebrow}</span><h1>${data.title}</h1><p class="lead">${data.lead}</p><div class="actions" style="justify-content:center"><a class="btn primary" href="/register">Start building</a><a class="btn ghost" href="/pricing">See pricing</a></div></section><section class="page-section"><div class="grid2"><div class="grid2">${data.cards.map(([h,p])=>`<div class="card"><div class="icon">✦</div><h3>${h}</h3><p>${p}</p></div>`).join('')}</div>${visual}</div></section>${kind==='compare'?compareSection():''}</main>`});
}
function compareSection(){ return `<section class="section"><div class="section-head"><div><span class="eyebrow">Interactive table</span><h2>Filter the field.</h2></div></div><div class="compare-controls"><select id="firm-type" class="input" style="max-width:220px"><option value="">All types</option><option value="prop">Prop firms</option><option value="broker">Brokers</option></select><select id="firm-platform" class="input" style="max-width:220px"><option value="">All platforms</option>${PLATFORMS.map(p=>`<option>${p}</option>`).join('')}</select><input id="firm-search" class="input" style="max-width:300px" placeholder="Search firm"></div><div class="card"><table id="firm-table"><thead><tr><th>Firm</th><th>Type</th><th>Max DD</th><th>Daily DD</th><th>Split</th><th>Refund</th><th>Platforms</th><th>Rating</th></tr></thead><tbody></tbody></table></div></section><script>fetch('/api/firms').then(r=>r.json()).then(d=>{const tbody=document.querySelector('#firm-table tbody'),type=document.querySelector('#firm-type'),platform=document.querySelector('#firm-platform'),search=document.querySelector('#firm-search');function draw(){const q=search.value.toLowerCase();tbody.innerHTML=d.firms.filter(f=>(!type.value||f.type===type.value)&&(!platform.value||f.supported_platforms.includes(platform.value))&&(!q||f.name.toLowerCase().includes(q))).map(f=>'<tr><td><strong>'+f.name+'</strong></td><td>'+f.type+'</td><td>'+(f.max_drawdown_pct??'—')+'</td><td>'+(f.daily_drawdown_pct??'—')+'</td><td>'+(f.profit_split_pct??'—')+'</td><td>'+f.refund_policy+'</td><td>'+f.supported_platforms.join(', ')+'</td><td>'+f.rating+'</td></tr>').join('')}[type,platform,search].forEach(x=>x.oninput=draw);draw()})</script>`; }

function pricingPage(){
 const body=`<main><section class="page-hero"><span class="eyebrow">Interactive pricing</span><h1>Configure the desk you actually need.</h1><p class="lead">Switch products, plans, account quantity, billing cycle, and add-ons. The total updates instantly and the same calculation runs on the server before checkout.</p></section><section class="page-section price-layout"><div class="card"><div class="control"><label>Product</label><div class="segments" data-group="productType"><button class="active" data-value="cfd">CFD / Forex</button><button data-value="futures">Futures</button></div></div><div class="control" id="plan-control"><label>Plan</label><div class="segments" data-group="plan"><button class="active" data-value="standard">Standard · $10/account</button><button data-value="premium">Premium · $15/account</button></div></div><div class="control"><label>Trading accounts</label><div class="stepper"><button id="minus">−</button><output id="qty">1</output><button id="plus">+</button></div></div><div class="control"><label>Billing cycle</label><div class="segments" data-group="billingCycle">${Object.entries(CYCLE_LABEL).map(([v,l],i)=>`<button class="${i===0?'active':''}" data-value="${v}">${l}</button>`).join('')}</div></div><div class="control"><label>Add-ons</label><label class="check"><span><strong>WISDO Insight Engine</strong><br><small class="muted">Portfolio analytics and exports</small></span><input type="checkbox" id="analyzer"></label><label class="check"><span><strong>Dedicated Environment</strong><br><small class="muted">Isolated relay process</small></span><input type="checkbox" id="env"></label><label class="check" id="extra-wrap" style="display:none"><span>Extra environment accounts</span><input class="input" style="max-width:90px" id="extra" type="number" min="0" max="100" value="0"></label></div></div><aside class="card price-card"><span class="eyebrow">Your configuration</span><div class="price-total" id="total">$10.00</div><p class="muted" id="cycle-copy">Billed monthly</p><ul class="price-breakdown" id="breakdown"></ul><button class="btn primary" style="width:100%" id="checkout">Continue to secure checkout</button><p class="muted" id="checkout-note">Checkout becomes live when Square credentials and subscription plan IDs are configured.</p></aside></section></main>`;
 const scripts=`(()=>{const s={productType:'cfd',plan:'standard',accountQuantity:1,billingCycle:'monthly',addons:{analyzer:false,dedicatedEnv:false,extraEnvAccounts:0}};const q=x=>document.querySelector(x);document.querySelectorAll('[data-group]').forEach(g=>g.querySelectorAll('button').forEach(b=>b.onclick=()=>{g.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');s[g.dataset.group]=b.dataset.value;q('#plan-control').style.display=s.productType==='futures'?'none':'block';refresh()}));q('#minus').onclick=()=>{s.accountQuantity=Math.max(1,s.accountQuantity-1);q('#qty').value=s.accountQuantity;refresh()};q('#plus').onclick=()=>{s.accountQuantity=Math.min(100,s.accountQuantity+1);q('#qty').value=s.accountQuantity;refresh()};q('#analyzer').onchange=e=>{s.addons.analyzer=e.target.checked;refresh()};q('#env').onchange=e=>{s.addons.dedicatedEnv=e.target.checked;q('#extra-wrap').style.display=e.target.checked?'flex':'none';refresh()};q('#extra').oninput=e=>{s.addons.extraEnvAccounts=Number(e.target.value||0);refresh()};async function refresh(){const d=await fetch('/api/pricing/compute',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(s)}).then(r=>r.json());q('#total').textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(d.total/100);q('#cycle-copy').textContent=d.cycleLabel+' · '+d.months+' billed month'+(d.months===1?'':'s');q('#breakdown').innerHTML='<li><span>Base accounts</span><strong>'+money(d.basePerMonth)+'/mo</strong></li><li><span>Add-ons</span><strong>'+money(d.addonsMonthly)+'/mo</strong></li><li><span>Effective monthly</span><strong>'+money(d.perMonth)+'</strong></li><li><span>Total due</span><strong>'+money(d.total)+'</strong></li>';function money(c){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100)}}q('#checkout').onclick=async()=>{const d=await fetch('/api/pricing/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(s)}).then(r=>r.json());if(d.url)location.href=d.url;else if(d.loginUrl)location.href=d.loginUrl;else q('#checkout-note').textContent=d.message||d.error};refresh()})();`;
 return publicShell({title:'WISDO Pricing Configurator',description:'Configure CFD or futures copier accounts, billing cycles, analyzer, and dedicated environment add-ons.',path:'/pricing',active:'/pricing',body,scripts});
}

function academyPage(){ return publicShell({title:'WISDO Academy',description:'Interactive DF Sauce, campaign character, risk, bot-control, and copier training.',path:'/academy',active:'/academy',body:`<main><section class="page-hero"><span class="eyebrow">Hands-on trading school</span><h1>Learn markets, money, and the operating process.</h1><p class="lead">Search 6,500 structured courses, build an adaptive learning path, replay market scenarios, ask an AI tutor, practice copier decisions, and study a protected TradingView layout before touching live money.</p></section><section class="page-section"><div class="grid3">${[['DF Sauce Foundations','Launch zones, BOS, cloud pullbacks, and proof before pressure.'],['Campaign Character','Trend, range, fakeout, accumulation, distribution, and reversal days.'],['Bot Flight School','Reporter pairing, Culture Lanes, mobile controls, logs, pause, resume, and close-all.'],['Risk Simulator','Balance, equity, margin, drawdown, lot scaling, and equity protection.'],['Copier Masterclass','Master/follower mapping, symbol aliases, close authority, and route health.'],['Private TradingView Lab','Study your protected DF Sauce layout on TradingView while WISDO provides scenario coaching without exposing source code.']].map(([h,p],i)=>`<div class="card"><span class="eyebrow">Module ${i+1}</span><h3>${h}</h3><p>${p}</p><div class="actions"><a class="btn ghost" href="/app/education">Start lab</a></div></div>`).join('')}</div></section></main>`}); }
function blogPage(){ return publicShell({title:'WISDO Resources',description:'Trading copier, account safety, product, and education resources.',path:'/blog',active:'/blog',body:`<main><section class="page-hero"><span class="eyebrow">Resources</span><h1>Build a healthier trading desk.</h1><p class="lead">Product guides, copier safety architecture, mobile command design, and interactive education.</p></section><section class="page-section"><div class="grid3">${BLOG_POSTS.map(p=>`<article class="card"><small class="muted">${p.date}</small><h3>${p.title}</h3><p>${p.excerpt}</p><a href="/blog/${p.slug}">Read article →</a></article>`).join('')}</div></section></main>`}); }
function blogPostPage(post){ return publicShell({title:`${post.title} — WISDO`,description:post.excerpt,path:`/blog/${post.slug}`,active:'/blog',body:`<main><article class="page-hero" style="text-align:left"><span class="eyebrow">${post.date} · WISDO Resources</span><h1>${post.title}</h1><p class="lead">${post.excerpt}</p></article><article class="page-section"><div class="card" style="max-width:820px;margin:auto"><p style="font-size:18px;line-height:1.9">${post.body}</p><h2>Operational checklist</h2><p>Use account-specific identifiers, validate ownership, normalize broker symbols before queueing, separate delivery from completion, preserve closing authority, and keep execution feature flags off until two-account demo testing passes.</p></div></article></main>`}); }
function legalPage(type){ const content={terms:['Terms of Service','Use WISDO only for lawful trading activity. You remain responsible for broker permissions, account credentials, strategy settings, tax obligations, and every trade placed through a connected account.'],privacy:['Privacy Policy','WISDO stores the minimum information needed for authentication, connected-account operation, support, billing, and safety audit logs. Broker credentials must be encrypted and are never displayed after storage.'],risk:['Risk Disclosure','Leveraged trading can result in losses greater than expected. Copying another account does not eliminate risk. Latency, slippage, symbol differences, platform outages, and incorrect settings can change results.']}[type]; return publicShell({title:`${content[0]} — WISDO`,description:content[1],path:type==='risk'?'/risk-disclosure':`/${type}`,body:`<main><section class="page-hero"><span class="eyebrow">Legal</span><h1>${content[0]}</h1><p class="lead">Effective July 10, 2026</p></section><section class="page-section"><div class="card" style="max-width:900px;margin:auto"><p>${content[1]}</p><h2>Account responsibility</h2><p>You authorize only the accounts you own or have permission to control. You must test automation on demo before enabling live execution.</p><h2>Service availability</h2><p>WISDO may pause unsafe commands, expired subscriptions, invalid routes, stale Reporters, or integrations that fail validation.</p><h2>Contact</h2><p>Use the support center for privacy, billing, security, or account-deletion requests.</p></div></section></main>`}); }
function authPage(mode='login',message='',options={}){
 const isRegister=mode==='register'; const forgot=mode==='forgot'; const reset=mode==='reset';
 const returnTo=safeReturnPath(options.returnTo||'/app/dashboard','/app/dashboard');
 const resetToken=String(options.token||'');
 const title=isRegister?'Create your WISDO account':forgot?'Reset your password':reset?'Choose a new password':'Welcome back';
 const action=isRegister?'/auth/email/signup':forgot?'/api/auth/password-reset/request':reset?'/api/auth/password-reset/complete':'/auth/email/login';
 const returnField=`<input type="hidden" name="returnTo" value="${esc(returnTo)}">`;
 const signupAttribution=`<input type="hidden" name="source" value="${esc(options.source||'website-register')}"><input type="hidden" name="medium" value="${esc(options.medium||'')}"><input type="hidden" name="campaign" value="${esc(options.campaign||'website-signup')}"><input type="hidden" name="content" value="${esc(options.content||'')}"><input type="hidden" name="term" value="${esc(options.term||'')}"><input type="hidden" name="referralCode" value="${esc(options.referralCode||'')}"><input type="hidden" name="landingPath" value="${esc(options.landingPath||'/register')}">`;
 const fields=isRegister?`${returnField}${signupAttribution}<label>Full name<input class="input" name="name" required></label><label>Email<input class="input" type="email" name="email" required></label><label>Phone optional<input class="input" name="phone" inputmode="tel" autocomplete="tel"></label><label>Password<input class="input" type="password" name="password" minlength="8" required></label><label style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" name="smsConsent" value="true" style="width:auto;margin-top:4px"><span>Text me my welcome and setup link. Message and data rates may apply. Reply STOP to opt out.</span></label><label style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" name="marketingConsent" value="true" style="width:auto;margin-top:4px"><span>Email me WISDO training and product updates.</span></label>`:forgot?`<label>Email<input class="input" type="email" name="email" required></label>`:reset?`<input type="hidden" name="token" value="${esc(resetToken)}"><label>New password<input class="input" type="password" name="password" minlength="8" required></label>`:`${returnField}<label>Email<input class="input" type="email" name="email" required></label><label>Password<input class="input" type="password" name="password" required></label>`;
 const submit=isRegister?'Create account':forgot?'Send reset link':reset?'Update password':'Login';
 const socialReturn=encodeURIComponent(returnTo);
 const body=`<main class="auth-wrap"><section class="auth-card"><a class="brand" href="/"><img src="/media/logo_transparent_background.png"><span>WISDO</span></a><span class="eyebrow">Secure access</span><h1>${title}</h1>${message?`<p class="green">${esc(message)}</p>`:''}<form method="post" action="${action}" id="auth-form">${fields}<button class="btn primary" type="submit">${submit}</button></form>${!forgot&&!reset?`<div class="actions"><a class="btn ghost" style="width:100%" href="/auth/discord?returnTo=${socialReturn}">Continue with Discord</a><a class="btn ghost" style="width:100%" href="/auth/google?returnTo=${socialReturn}">Continue with Google</a></div>`:''}<p class="muted">${isRegister?'Already have an account? <a href="/login">Login</a>':forgot||reset?'Return to <a href="/login">login</a>':'New here? <a href="/register">Create an account</a> · <a href="/forgot-password">Forgot password?</a>'}</p></section></main>`;
 return publicShell({title:`${title} — WISDO`,description:'Secure WISDO account access.',path:`/${mode}`,body});
}

function workspaceShell(page,user){
 const nav=[['command-center','Command Center'],['dashboard','Dashboard'],['accounts','Accounts'],['copier-engine','Copier Engine'],['trades','Trades'],['analyzer','Insight Engine'],['alerts','Alerts'],['education','Academy'],['affiliate','Affiliate'],['settings','Settings'],['settings/billing','Billing']];
 const pageTitle=nav.find(([p])=>p===page)?.[1]||'WISDO';
 const bootMarkup=`<div id="wisdo-boot" class="wisdo-boot" aria-live="polite" aria-label="WISDO Command Center loading"><div class="wisdo-boot-stars"></div><div class="wisdo-boot-grid"></div><section class="wisdo-boot-shell"><button class="wisdo-boot-skip" type="button" data-wisdo-boot-skip>Skip</button><div class="wisdo-boot-orb"><div class="wisdo-boot-core"><img src="/media/logo_transparent_background.png" alt=""></div></div><h1>WISDO</h1><span class="wisdo-boot-kicker">Command Center Startup</span><div id="wisdo-boot-status" class="wisdo-boot-status">Waking WISDO Core…</div><div class="wisdo-boot-track"><span id="wisdo-boot-progress"></span></div><div class="wisdo-boot-meta"><span id="wisdo-boot-stage">Core 01</span><span id="wisdo-boot-percent">4%</span></div></section></div>`;
 return `<!doctype html><html data-theme="midnight" data-background="mesh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${pageTitle} — WISDO</title><link rel="icon" href="/media/logo_transparent_background.png"><style>${PUBLIC_CSS}</style><script>try{document.documentElement.dataset.theme=localStorage.getItem('wisdo.theme')||'midnight';document.documentElement.dataset.background=localStorage.getItem('wisdo.background')||'mesh'}catch{}</script></head><body>${bootMarkup}<video id="workspace-video-a" class="workspace-bg-video" muted autoplay loop playsinline><source src="/media/14683743_3840_2160_30fps.mp4" type="video/mp4"></video><video id="workspace-video-b" class="workspace-bg-video" muted autoplay loop playsinline><source src="/media/14250431_1920_1080_30fps.mp4" type="video/mp4"></video><div class="workspace-bg-overlay"></div><div class="workspace"><aside><a class="brand" href="/app/command-center" data-wisdo-dashboard-launch><img src="/media/logo_transparent_background.png"><span>WISDO</span></a><div class="member-identity"><small>Member desk</small><strong>${esc(user.username||user.name||user.email||user.id)}</strong></div>${nav.map(([p,l])=>`<a class="${p===page?'active':''}" href="/app/${p}" ${p==='dashboard'?'data-wisdo-dashboard-launch':''}>${l}</a>`).join('')}<div class="aside-spacer"></div><a href="/contact">Support</a><a href="/logout">Logout</a></aside><main><header class="workspace-topbar"><div><span class="eyebrow">Connect · Copy · Control</span><strong>${pageTitle}</strong></div><div class="topbar-account"><span id="workspace-account-status">Loading accounts…</span><select class="input mobile-account" id="mobile-account"></select></div></header><div id="app-root"><div class="card loading-card">Loading ${pageTitle}…</div></div></main></div><script>window.WISDO_PAGE=${JSON.stringify(page)};window.WISDO_USER=${JSON.stringify({id:user.id,username:user.username||user.name||user.email||user.id})};</script><script src="/js/df-sauce-academy.js" defer></script><script src="/js/workspace.js" defer></script><script src="/js/wisdo-assistant.js" defer></script></body></html>`;
}
function rangeStart(period='month'){ const d=new Date(); if(period==='day') d.setHours(0,0,0,0); else if(period==='week') d.setDate(d.getDate()-7); else if(period==='year') d.setFullYear(d.getFullYear()-1); else d.setMonth(d.getMonth()-1); return d; }
function calculateSlaveLot(rule, masterLot, masterEquity=0, slaveEquity=0, masterBalance=0, slaveBalance=0){ const type=rule.risk_type||'multiplier'; const value=Math.max(0,num(rule.risk_value,1)); let lot=masterLot; if(type==='fixed_lot')lot=value; else if(type==='multiplier')lot=masterLot*value; else if(type==='equity_ratio')lot=masterEquity>0?masterLot*(slaveEquity/masterEquity)*value:masterLot*value; else if(type==='balance_ratio')lot=masterBalance>0?masterLot*(slaveBalance/masterBalance)*value:masterLot*value; return Math.round(clamp(lot,num(rule.min_lot,.01),num(rule.max_lot,100))*100)/100; }
function inTradingHours(rule,when=new Date()){ if(!rule.trading_hours_start||!rule.trading_hours_end)return true; const current=when.toISOString().slice(11,16); return rule.trading_hours_start<=rule.trading_hours_end?current>=rule.trading_hours_start&&current<=rule.trading_hours_end:current>=rule.trading_hours_start||current<=rule.trading_hours_end; }
function analyzeTrades(trades=[]){ const closed=trades.filter(t=>t.status==='closed'); const wins=closed.filter(t=>num(t.pnl)>0); const pnl=closed.reduce((s,t)=>s+num(t.pnl),0); const invested=closed.reduce((s,t)=>s+Math.abs(num(t.open_price)*num(t.lot_size)),0); let equity=0,max=0,maxDd=0; const series=[]; for(const t of [...closed].sort((a,b)=>new Date(a.closed_at||a.opened_at)-new Date(b.closed_at||b.opened_at))){equity+=num(t.pnl);max=Math.max(max,equity);const denominator=Math.max(1,Math.abs(max));maxDd=Math.max(maxDd,((max-equity)/denominator)*100);series.push({date:t.closed_at||t.opened_at,value:equity});} return {roi:invested>0?pnl/invested*100:0,winRate:closed.length?wins.length/closed.length*100:0,maxDrawdown:maxDd,tradeCount:closed.length,pnl,series}; }

export function registerMajorUpgradeRoutes(app,{config,loadEcosystemState,saveEcosystemState,mt4SyncService,mt4CommandService,copyTradingService,logger}){
  mt4SyncService?.attachProductEventSink?.({
    prepareSnapshot: (event) => synchronizeCopierRulesForAccount({
      accountId: event?.connectionRecord?.accountId || event?.latestSnapshotRecord?.accountId,
      mt4SyncService,
      loadEcosystemState,
    }),
    ingestSnapshot: (event) => ingestReporterSnapshotToProductState({ ...event, loadEcosystemState, saveEcosystemState }),
  });
  app.get('/',(req,res)=>res.send(homePage()));
  app.get('/copier',(req,res)=>res.send(productPage('copier'))); app.get('/analyzer',(req,res)=>res.send(productPage('analyzer'))); app.get('/compare',(req,res)=>res.send(productPage('compare'))); app.get('/pricing',(req,res)=>res.send(pricingPage())); app.get('/academy',(req,res)=>res.send(academyPage())); app.get('/blog',(req,res)=>res.send(blogPage())); app.get('/resources',(req,res)=>res.send(publicShell({title:'WISDO Resource Center',description:'Original trading guides, checklists, journals, calculators, AI webinars, and adaptive learning resources.',path:'/resources',active:'/resources',body:`<main><section class="page-hero"><span class="eyebrow">Resource Center</span><h1>Study guides, tools, and AI teaching in one library.</h1><p class="lead">Members receive original WISDO checklists, worksheets, journals, flash cards, calculators, on-demand AI webinars, interactive labs, bookmarks, notes, and adaptive AI teaching without redistributing copyrighted paid courses.</p><div class="actions"><a class="btn primary" href="/app/education">Open member library</a><a class="btn ghost" href="/academy">Explore Academy</a></div></section><section class="page-section"><div class="grid4">${[['Trading Academy','Beginner through professional market education.'],['WISDO University','Copier, account health, automation, DF Sauce, and HIGHTOWER operating knowledge.'],['Resource Center','Original guides, journals, checklists, cheat sheets, and calculators.'],['AI Webinar Room','On-demand narrated video lessons generated from member questions and approved strategies.']].map(([title,copy])=>`<article class="card"><h3>${title}</h3><p>${copy}</p></article>`).join('')}</div></section></main>`}))); app.get('/blog/:slug',(req,res)=>{const p=BLOG_POSTS.find(x=>x.slug===req.params.slug);if(!p)return res.status(404).send(publicShell({title:'Not found',description:'Resource not found.',path:req.path,body:'<main class="page-hero"><h1>Resource not found.</h1></main>'}));res.send(blogPostPage(p));});
  app.get('/terms',(req,res)=>res.send(legalPage('terms'))); app.get('/privacy',(req,res)=>res.send(legalPage('privacy'))); app.get('/risk-disclosure',(req,res)=>res.send(legalPage('risk')));
  app.get('/contact',(req,res)=>res.send(publicShell({title:'WISDO Support',description:'Contact WISDO support for account, billing, security, or relay help.',path:'/contact',body:`<main><section class="page-hero"><span class="eyebrow">Support</span><h1>Get the right help fast.</h1><p class="lead">Use Discord support for live relay operations, or email the configured support address for billing, privacy, and account requests.</p></section><section class="page-section"><div class="grid3"><div class="card"><h3>Relay support</h3><p>Include the account ID, Reporter version, command ID, and approximate event time.</p></div><div class="card"><h3>Billing support</h3><p>Include the subscription email and invoice or checkout reference.</p></div><div class="card"><h3>Security and privacy</h3><p>Request credential rotation, account export, or account deletion through the authenticated settings page.</p></div></div></section></main>`})));
  const registrationOptions=(req)=>({returnTo:req.query.returnTo,source:req.query.utm_source||req.query.source||'website-register',medium:req.query.utm_medium||req.query.medium||'',campaign:req.query.utm_campaign||req.query.campaign||'website-signup',content:req.query.utm_content||req.query.content||'',term:req.query.utm_term||req.query.term||'',referralCode:req.query.ref||req.query.referralCode||'',landingPath:req.originalUrl||'/register'});
  app.get('/register',(req,res)=>res.send(authPage('register','',registrationOptions(req)))); app.get('/signup',(req,res)=>res.send(authPage('register','',registrationOptions(req)))); app.get('/login',(req,res)=>res.send(authPage('login',String(req.query.message||''),{returnTo:req.query.returnTo}))); app.get('/forgot-password',(req,res)=>res.send(authPage('forgot'))); app.get('/reset-password',(req,res)=>res.send(authPage('reset','',{token:req.query.token})));


  app.get('/robots.txt',(req,res)=>res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /app/\nDisallow: /admin/\nSitemap: ${String(process.env.PUBLIC_BASE_URL||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'')}/sitemap.xml\n`));
  app.get('/llms.txt',(req,res)=>res.type('text/plain').send('WISDO is a multi-account trading command center, copier engine, analyzer, interactive academy, affiliate system, and MT4/Discord bridge. Public pages: /, /copier, /analyzer, /compare, /pricing, /academy, /resources, /blog. Trading involves risk of loss.'));
  app.get('/sitemap.xml',(req,res)=>{const base=String(process.env.PUBLIC_BASE_URL||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'');const paths=['/','/copier','/analyzer','/compare','/pricing','/academy','/resources','/blog','/terms','/privacy','/risk-disclosure','/contact',...BLOG_POSTS.map(p=>`/blog/${p.slug}`)];res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p=>`<url><loc>${esc(base+p)}</loc><lastmod>2026-07-10</lastmod></url>`).join('')}</urlset>`)});

  app.get('/api/market/widgets',async(req,res)=>{const providerConfigured=Boolean(process.env.FINNHUB_API_KEY||process.env.TRADING_ECONOMICS_API_KEY||process.env.FIRECRAWL_API_KEY);res.json({ok:true,mode:providerConfigured?'provider_ready_fallback':'static_fallback',sentiment:[{symbol:'EURUSD',long:58,short:42,source:providerConfigured?'cached provider':'sample'},{symbol:'BTCUSD',long:64,short:36,source:providerConfigured?'cached provider':'sample'},{symbol:'SPX500',long:53,short:47,source:providerConfigured?'cached provider':'sample'}],calendar:[{time:'08:30 ET',currency:'USD',event:'Core CPI m/m',forecast:'0.3%'},{time:'10:00 ET',currency:'USD',event:'Consumer Sentiment',forecast:'61.8'},{time:'14:00 ET',currency:'USD',event:'FOMC Member Speech',forecast:'—'}],news:[{title:'Markets balance inflation expectations and rate outlook',source:'WISDO Market Desk',age:'12m'},{title:'Gold volatility expands around U.S. session liquidity',source:'WISDO Market Desk',age:'31m'},{title:'Index futures hold above overnight value area',source:'WISDO Market Desk',age:'48m'}]})});
  app.post('/api/pricing/compute',(req,res)=>res.json({ok:true,...computePrice(req.body||{})}));
  app.post('/api/pricing/checkout',(req,res)=>res.redirect(307,'/api/v2/billing/checkout'));
  app.get('/api/firms',async(req,res)=>{const state=ensureMajorState(await loadEcosystemState());let firms=Object.values(state.firms);if(req.query.type)firms=firms.filter(f=>f.type===req.query.type);if(req.query.platform)firms=firms.filter(f=>(f.supported_platforms||[]).includes(req.query.platform));res.json({ok:true,firms})});

  app.post('/api/auth/password-reset/request',async(req,res)=>{const email=String(req.body?.email||'').trim().toLowerCase();let token='';await mutate(loadEcosystemState,saveEcosystemState,state=>{const user=Object.values(state.usersById||{}).find(u=>String(u.email||'').toLowerCase()===email)||Object.values(state.profiles||{}).find(p=>String(p.email||'').toLowerCase()===email);if(user){token=crypto.randomBytes(24).toString('hex');state.passwordResetTokens[token]={token,userId:user.id||user.userId,email,expiresAt:new Date(Date.now()+3600000).toISOString(),used:false};}return true});const production=process.env.NODE_ENV==='production';res.status(200).send(wantsHtml(req)?publicShell({title:'Reset requested',description:'Password reset request accepted.',path:'/forgot-password',body:`<main class="auth-wrap"><div class="auth-card"><h1>Check your email</h1><p>If the address exists, a reset link has been created.</p>${!production&&token?`<a class="btn primary" href="/reset-password?token=${token}">Development reset link</a>`:''}</div></main>`}):JSON.stringify({ok:true,message:'If the address exists, a reset link has been created.',developmentToken:production?undefined:token}))});
  app.post('/api/auth/password-reset/complete',async(req,res)=>{const token=String(req.body?.token||'');const password=String(req.body?.password||'');if(password.length<8)return res.status(400).json({ok:false,error:'Password must be at least 8 characters.'});const result=await mutate(loadEcosystemState,saveEcosystemState,state=>{const r=state.passwordResetTokens[token];if(!r||r.used||new Date(r.expiresAt)<new Date())return null;const hash=hashPassword(password);let updated=false;for(const [userId,user] of Object.entries(state.usersById||{})){if(String(userId)===String(r.userId)||String(user.email||'').toLowerCase()===String(r.email||'').toLowerCase()){state.usersById[userId]={...user,passwordHash:hash,updatedAt:nowIso()};updated=true;}}if(!updated&&r.userId){state.usersById[r.userId]={id:r.userId,email:r.email,passwordHash:hash,createdAt:nowIso(),updatedAt:nowIso()};updated=true;}r.used=true;r.usedAt=nowIso();audit(state,r.userId,'password.reset','User',r.userId);return {updated,userId:r.userId};});if(!result?.updated)return res.status(400).json({ok:false,error:'Reset token is invalid, expired, or no user could be updated.'});if(wantsHtml(req))return res.redirect('/login?message=Password+updated');res.json({ok:true,updated:true});});

  app.get('/app', requireUser, (req, res) => res.redirect('/app/command-center'));
  const appPages=['command-center','dashboard','accounts','copier-engine','trades','analyzer','alerts','education','affiliate','settings','settings/billing'];
  for(const page of appPages)app.get(`/app/${page}`,requireUser,(req,res)=>res.send(workspaceShell(page,req.wisdoUser)));
  app.get('/member/command-center', requireUser, (req, res) => res.redirect('/app/command-center'));
  app.get('/member', requireUser, (req, res) => res.redirect('/app/command-center'));
  for(const legacyEducationPath of ['/member/education','/member/academy','/member/seminars']) app.get(legacyEducationPath,requireUser,(req,res)=>{const query=new URLSearchParams(req.query||{}).toString();res.redirect(`/app/education${query?`?${query}`:''}`)});

  app.get('/api/v2/me',requireUser,async(req,res)=>{const state=ensureMajorState(await loadEcosystemState());res.json({ok:true,user:req.wisdoUser,profile:state.profiles[req.wisdoUser.id]||null,roles:state.userRoles[req.wisdoUser.id]||[]})});
  app.patch('/api/v2/profile',requireUser,async(req,res)=>{const profile=await mutate(loadEcosystemState,saveEcosystemState,state=>{const previous=state.profiles[req.wisdoUser.id]||{};const themes=['midnight','cobalt','emerald','violet','gold','ember','light'];const backgrounds=['mesh','terminal','motion-a','motion-b','solid'];state.profiles[req.wisdoUser.id]={...previous,id:req.wisdoUser.id,email:req.body.email||previous.email||req.wisdoUser.email||'',full_name:req.body.full_name??previous.full_name,country:req.body.country??previous.country,timezone:req.body.timezone??previous.timezone??'UTC',avatar_url:req.body.avatar_url??previous.avatar_url,theme:themes.includes(req.body.theme)?req.body.theme:(previous.theme||'midnight'),background:backgrounds.includes(req.body.background)?req.body.background:(previous.background||'mesh'),updated_at:nowIso(),created_at:previous.created_at||nowIso()};audit(state,req.wisdoUser.id,'profile.updated','Profile',req.wisdoUser.id,{theme:state.profiles[req.wisdoUser.id].theme,background:state.profiles[req.wisdoUser.id].background});return state.profiles[req.wisdoUser.id]});res.json({ok:true,profile})});
  app.delete('/api/v2/me',requireUser,async(req,res)=>{await mutate(loadEcosystemState,saveEcosystemState,state=>{const uid=String(req.wisdoUser.id);delete state.profiles[uid];delete state.userRoles[uid];for(const [k,v] of Object.entries(state.tradingAccounts))if(String(v.user_id)===uid)delete state.tradingAccounts[k];for(const [k,v] of Object.entries(state.copierRules))if(String(v.user_id)===uid)delete state.copierRules[k];for(const [k,v] of Object.entries(state.trades))if(String(v.user_id)===uid)delete state.trades[k];delete state.alerts[uid];audit(state,uid,'account.deleted','User',uid);return true});res.json({ok:true,deleted:true})});

  app.get('/api/v2/accounts',requireUser,async(req,res)=>{const result=await synchronizeReporterAccounts({userId:req.wisdoUser.id,mt4SyncService,loadEcosystemState,saveEcosystemState});res.json({ok:true,...result})});
  app.post('/api/v2/accounts',requireUser,async(req,res)=>{
    const platform=String(req.body.platform||'').toLowerCase();
    if(!PLATFORMS.includes(platform))return res.status(400).json({ok:false,error:'Unsupported platform.'});
    const accountNumber=String(req.body.account_number||'').trim();const server=String(req.body.server||'').trim();
    if(!accountNumber)return res.status(400).json({ok:false,error:'Account number is required.'});
    if(['mt4','mt5'].includes(platform)&&!server)return res.status(400).json({ok:false,error:'Broker server is required so the website can match the Reporter heartbeat.'});
    const requestedDeskRole=normalizeDeskRole(req.body.desk_role||req.body.role,req.body.role==='master'?'lead':req.body.role==='slave'?'receiver':'private');
    const requestedSharingMode=normalizeSharingMode(req.body.sharing_mode,parseBool(req.body.community_visible)?'community':'private');
    if(requestedSharingMode!=='private'&&!['lead','dual'].includes(requestedDeskRole))return res.status(400).json({ok:false,error:'Only a Culture Lead or Dual Role account can be shared or listed in the community.'});
    let encrypted='';if(req.body.credentials&&Object.values(req.body.credentials).some(Boolean)){try{encrypted=encryptCredential(req.body.credentials)}catch(e){return res.status(400).json({ok:false,error:`Credential vault unavailable: ${e.message}. Remove the optional login/password or configure ENCRYPTION_KEY.`})}}
    const repository=mt4SyncService?.repository;const canonicalId=String(repository?.getMt4AccountId?.(accountNumber,server)||`${accountNumber}:${server||'server'}`).replace(/[^a-zA-Z0-9:_.-]/g,'_');
    const outcome=await mutate(loadEcosystemState,saveEcosystemState,state=>{
      const uid=String(req.wisdoUser.id);const occupied=state.tradingAccounts[canonicalId];if(occupied&&String(occupied.user_id)!==uid)return {conflict:true};
      const matching=Object.entries(state.tradingAccounts).find(([key,row])=>String(row.user_id)===uid&&String(row.account_number||'')===accountNumber&&normalizeServer(row.server)===normalizeServer(server));
      const oldId=matching?.[0];const previous=occupied||matching?.[1]||{};
      if(oldId&&oldId!==canonicalId){for(const rule of Object.values(state.copierRules)){if(rule.master_id===oldId)rule.master_id=canonicalId;if(rule.slave_id===oldId)rule.slave_id=canonicalId}for(const trade of Object.values(state.trades)){if(trade.account_id===oldId)trade.account_id=canonicalId}delete state.tradingAccounts[oldId]}
      const account={...previous,id:canonicalId,user_id:uid,platform,broker:String(req.body.broker||previous.broker||'').trim(),account_number:accountNumber,server,nickname:String(req.body.nickname||previous.nickname||'').trim(),desk_role:requestedDeskRole,sharing_mode:requestedSharingMode,role:legacyRoleForDeskRole(requestedDeskRole),community_visible:requestedSharingMode==='community',community_name:String(req.body.community_name||previous.community_name||req.body.nickname||previous.nickname||'').trim(),status:previous.reporter_connected?'connected':'awaiting_reporter',balance:num(previous.balance),equity:num(previous.equity),floating_pl:num(previous.floating_pl),open_trades:num(previous.open_trades),currency:String(req.body.currency||previous.currency||'USD'),is_premium:Boolean(previous.is_premium),encrypted_credentials:encrypted||previous.encrypted_credentials||'',last_sync_at:previous.last_sync_at||null,reporter_account_id:canonicalId,source:previous.source||'member_form',created_at:previous.created_at||nowIso(),updated_at:nowIso()};
      state.tradingAccounts[canonicalId]=account;audit(state,uid,previous.id?'account.updated':'account.created','TradingAccount',canonicalId,{platform,broker:account.broker,connection:'reporter_pairing',deskRole:requestedDeskRole,sharingMode:requestedSharingMode});return {account:sanitizeAccount(account),created:!previous.id};
    });
    if(outcome.conflict)return res.status(409).json({ok:false,error:'This broker account is already owned by another WISDO user.'});
    let pairing=null;
    if(['mt4','mt5'].includes(platform)&&!outcome.account.reporter_connected&&mt4SyncService?.issuePairingCode){try{pairing=await mt4SyncService.issuePairingCode({discordUserId:String(req.wisdoUser.id),requestedByUserId:String(req.wisdoUser.id),accountNickname:outcome.account.nickname||`${accountNumber} ${server}`,accountRole:outcome.account.can_lead&&outcome.account.can_receive?'both':outcome.account.can_lead?'leader':'follower',copyPermission:outcome.account.can_lead?'copy_allowed':'control_allowed',forceNew:true});await mutate(loadEcosystemState,saveEcosystemState,state=>{if(state.tradingAccounts[canonicalId])state.tradingAccounts[canonicalId].pairing_code=pairing.pairingCode;return true});outcome.account.pairing_code=pairing.pairingCode}catch(error){logger?.warn?.('Account saved but pairing generation failed',{accountId:canonicalId,error:error.message})}}
    res.status(outcome.created?201:200).json({ok:true,account:outcome.account,pairing,message:outcome.account.reporter_connected?'Account matched to a live Reporter heartbeat.':'Account saved. Paste the pairing code into the Reporter to activate live metrics and controls.'});
  });
  app.get('/api/v2/accounts/:id',requireUser,async(req,res)=>{const state=ensureMajorState(await loadEcosystemState());if(!ownAccount(state,req.wisdoUser.id,req.params.id))return res.status(404).json({ok:false,error:'Account not found.'});res.json({ok:true,account:sanitizeAccount(state.tradingAccounts[req.params.id])})});
  app.patch('/api/v2/accounts/:id',requireUser,async(req,res)=>{
    const account=await mutate(loadEcosystemState,saveEcosystemState,state=>{
      if(!ownAccount(state,req.wisdoUser.id,req.params.id))return null;
      const row=state.tradingAccounts[req.params.id];
      const allowed=['broker','server','status','currency','nickname','community_name'];for(const k of allowed)if(req.body[k]!==undefined)row[k]=String(req.body[k]??'').trim();
      if(req.body.desk_role!==undefined||req.body.role!==undefined){const deskRole=normalizeDeskRole(req.body.desk_role||req.body.role,row.desk_role||(row.role==='master'?'lead':'receiver'));row.desk_role=deskRole;row.role=legacyRoleForDeskRole(deskRole);if(!accountCanLead(row)){row.sharing_mode='private';row.community_visible=false;}}
      if(req.body.sharing_mode!==undefined||req.body.community_visible!==undefined){const sharingMode=normalizeSharingMode(req.body.sharing_mode,parseBool(req.body.community_visible)?'community':'private');if(sharingMode!=='private'&&!accountCanLead(row))return {validationError:'Only Culture Lead or Dual Role accounts can be shared.'};row.sharing_mode=sharingMode;row.community_visible=sharingMode==='community';}
      row.updated_at=nowIso();audit(state,req.wisdoUser.id,'account.updated','TradingAccount',req.params.id,{deskRole:row.desk_role,sharingMode:row.sharing_mode});return sanitizeAccount(row);
    });
    if(!account)return res.status(404).json({ok:false,error:'Account not found.'});
    if(account.validationError)return res.status(400).json({ok:false,error:account.validationError});
    res.json({ok:true,account});
  });
  app.patch('/api/v2/accounts/:id/desk-role',requireUser,async(req,res)=>{
    const deskRole=normalizeDeskRole(req.body.desk_role,'private');const sharingMode=normalizeSharingMode(req.body.sharing_mode,'private');
    if(sharingMode!=='private'&&!['lead','dual'].includes(deskRole))return res.status(400).json({ok:false,error:'Only Culture Lead or Dual Role accounts can be shared.'});
    const account=await mutate(loadEcosystemState,saveEcosystemState,state=>{if(!ownAccount(state,req.wisdoUser.id,req.params.id))return null;const row=state.tradingAccounts[req.params.id];row.desk_role=deskRole;row.role=legacyRoleForDeskRole(deskRole);row.sharing_mode=sharingMode;row.community_visible=sharingMode==='community';row.community_name=String(req.body.community_name||row.community_name||row.nickname||row.broker||'').trim();row.updated_at=nowIso();audit(state,req.wisdoUser.id,'account.desk_role_changed','TradingAccount',row.id,{deskRole,sharingMode});return sanitizeAccount(row)});
    if(!account)return res.status(404).json({ok:false,error:'Account not found.'});res.json({ok:true,account});
  });
  app.delete('/api/v2/accounts/:id',requireUser,async(req,res)=>{const removed=await mutate(loadEcosystemState,saveEcosystemState,state=>{if(!ownAccount(state,req.wisdoUser.id,req.params.id))return null;const r=state.tradingAccounts[req.params.id];delete state.tradingAccounts[req.params.id];for(const [k,v] of Object.entries(state.copierRules))if(v.master_id===req.params.id||v.slave_id===req.params.id)delete state.copierRules[k];audit(state,req.wisdoUser.id,'account.deleted','TradingAccount',req.params.id);return r});if(!removed)return res.status(404).json({ok:false,error:'Account not found.'});res.json({ok:true,removed:{...removed,encrypted_credentials:undefined}})});
  app.post('/api/v2/accounts/:id/test',requireUser,async(req,res)=>{const result=await synchronizeReporterAccounts({userId:req.wisdoUser.id,mt4SyncService,loadEcosystemState,saveEcosystemState});const account=result.accounts.find(row=>row.id===req.params.id);if(!account)return res.status(404).json({ok:false,error:'Account not found.'});const connected=Boolean(account.reporter_connected);res.json({ok:true,connected,status:account.status,account,message:connected?`Reporter heartbeat found. Equity ${account.equity} and balance ${account.balance} are live.`:`Account identity is saved, but no fresh Reporter heartbeat matches ${account.account_number} on ${account.server}. Paste the pairing code into the Reporter and confirm WebRequest.`})});
  app.post('/api/v2/accounts/:id/sync',requireUser,async(req,res)=>{const state=ensureMajorState(await loadEcosystemState());if(!ownAccount(state,req.wisdoUser.id,req.params.id))return res.status(404).json({ok:false,error:'Account not found.'});try{const command=await mt4CommandService.queueCommandForAccount(req.wisdoUser.id,req.params.id,'SYNC_ACCOUNT',{accountId:req.params.id,immediate:true});res.json({ok:true,queued:true,command})}catch(e){res.status(400).json({ok:false,error:e.message,validation:e.validation})}});
  app.post('/api/v2/accounts/:id/disconnect',requireUser,async(req,res)=>{const account=await mutate(loadEcosystemState,saveEcosystemState,state=>{if(!ownAccount(state,req.wisdoUser.id,req.params.id))return null;state.tradingAccounts[req.params.id].status='disconnected';state.tradingAccounts[req.params.id].updated_at=nowIso();return state.tradingAccounts[req.params.id]});if(!account)return res.status(404).json({ok:false,error:'Account not found.'});res.json({ok:true,account:sanitizeAccount(account)})});

  const copierOptionsHandler=async(req,res)=>{
    const sync=await synchronizeReporterAccounts({userId:req.wisdoUser.id,mt4SyncService,loadEcosystemState,saveEcosystemState});
    const state=ensureMajorState(await loadEcosystemState());
    const uid=String(req.wisdoUser.id);
    const shareRows=Object.values(state.accountShares||{}).filter(share=>String(share.shared_with_user_id)===uid&&share.status!=='revoked'&&['copy','control'].includes(String(share.permission||'copy')));
    const shares=new Map(shareRows.map(share=>[share.account_id,String(share.permission||'copy')]));
    const owned=Object.values(state.tradingAccounts).filter(account=>String(account.user_id)===uid).map(account=>({...sanitizeAccount(account),access:'owned'}));
    const leads=Object.values(state.tradingAccounts).filter(account=>accountCanLead(account)&&(String(account.user_id)===uid||normalizeSharingMode(account.sharing_mode,account.community_visible?'community':'private')==='community'||shares.has(account.id))).map(account=>{
      const access=String(account.user_id)===uid?'owned':shares.has(account.id)?'shared':'community';
      const safe=sanitizeAccount(account);
      const isShared=access==='shared'||safe.isShared;
      const isCommunity=access==='community'||safe.isCommunity;
      const canExecute=access==='owned'?safe.canExecute:false;
      return {...safe,access,sharePermission:shares.get(account.id)||null,canExecute,can_execute:canExecute,isShared,is_shared:isShared,isCommunity,is_community:isCommunity,capabilities:{...safe.capabilities,canExecute,isShared,isCommunity}};
    });
    const receivers=owned.filter(account=>account.canReceive).map(account=>({...account,access:'owned'}));
    const privateDesks=owned.filter(account=>account.desk_role==='private');
    const unavailable=owned.filter(account=>!account.canLead&&!account.canReceive);
    const diagnostics=[];
    if(!leads.length) diagnostics.push({severity:'warning',code:'NO_LEAD',message:'No Culture Lead is available. Assign an owned account as Culture Lead or Dual Role, or request access to a shared/community lead.'});
    if(!receivers.length) diagnostics.push({severity:'warning',code:'NO_RECEIVER',message:'No Mirror Receiver is available. Assign an owned account as Mirror Receiver or Dual Role.'});
    for(const account of receivers.filter(account=>!account.canExecute)) diagnostics.push({severity:'info',code:'RECEIVER_NOT_LIVE',accountId:account.id,message:`${account.nickname||account.account_number} is eligible as a receiver but cannot execute live until Reporter, terminal, and AutoTrading are ready.`});
    res.json({ok:true,source:'reporter-backed-account-registry',generatedAt:nowIso(),accounts:owned,leads,receivers,privateDesks,unavailable,diagnostics,importedReporterAccounts:sync.importedReporterAccounts||0,reporterSourceAvailable:sync.reporterSourceAvailable!==false,summary:{owned:owned.length,leads:leads.length,receivers:receivers.length,privateDesks:privateDesks.length,live:owned.filter(account=>account.reporter_connected).length,executableReceivers:receivers.filter(account=>account.canExecute).length,sharedLeads:leads.filter(account=>account.access==='shared').length,communityLeads:leads.filter(account=>account.access==='community').length}});
  };
  app.get(['/copier/options','/api/copier/options','/api/v2/copier/options'],requireUser,copierOptionsHandler);

  app.get('/api/v2/community/leads',requireUser,async(req,res)=>{const result=await synchronizeReporterAccounts({userId:req.wisdoUser.id,mt4SyncService,loadEcosystemState,saveEcosystemState});const state=ensureMajorState(await loadEcosystemState());const uid=String(req.wisdoUser.id);const shares=new Set(Object.values(state.accountShares||{}).filter(share=>String(share.shared_with_user_id)===uid&&share.status!=='revoked').map(share=>share.account_id));const leads=Object.values(state.tradingAccounts).filter(account=>accountCanLead(account)&&(String(account.user_id)===uid||normalizeSharingMode(account.sharing_mode,account.community_visible?'community':'private')==='community'||shares.has(account.id))).map(account=>({...sanitizeAccount(account),access:String(account.user_id)===uid?'owned':shares.has(account.id)?'shared':'community'}));res.json({ok:true,leads,importedReporterAccounts:result.importedReporterAccounts||0})});

  app.get('/api/v2/copier-rules',requireUser,async(req,res)=>{const state=ensureMajorState(await loadEcosystemState());res.json({ok:true,rules:Object.values(state.copierRules).filter(r=>String(r.user_id)===String(req.wisdoUser.id)),relaySync:[],source:'persisted-rules'});});
  app.get('/api/v2/copier/diagnostics',requireUser,async(req,res)=>{
    const userId=String(req.wisdoUser.id);
    const relaySync=[];
    const state=ensureMajorState(await loadEcosystemState());
    const rules=Object.values(state.copierRules).filter(rule=>String(rule.user_id)===userId);
    const relayRoutes=await mt4SyncService?.repository?.getCopyRoutesForUser?.(userId)||[];
    const routeById=new Map(relayRoutes.map(route=>[String(route.routeId),route]));
    const rows=[];
    for(const rule of rules){
      const leader=state.tradingAccounts[rule.master_id]||null;
      const receiver=state.tradingAccounts[rule.slave_id]||null;
      const route=routeById.get(String(rule.id))||null;
      const recentCommands=receiver?.id&&mt4CommandService?.listAccountCommands?await mt4CommandService.listAccountCommands(userId,receiver.id,{limit:12}):[];
      const copyCommands=recentCommands.filter(command=>String(command.command||'').startsWith('COPY_'));
      const issues=[];
      if(!rule.is_active)issues.push('Culture Lane is paused.');
      if(!leader)issues.push('Culture Lead account is missing from the product account registry.');
      if(!receiver)issues.push('Mirror Receiver account is missing from the product account registry.');
      if(receiver&&!receiver.reporter_connected)issues.push('Mirror Receiver Reporter has not synchronized.');
      if(receiver&&receiver.terminal_connected===false)issues.push('Mirror Receiver MT4 terminal is offline.');
      if(receiver&&receiver.expert_enabled===false)issues.push('Mirror Receiver AutoTrading/Expert execution is disabled.');
      if(!route)issues.push('Culture Lane is saved but not registered in the live relay repository.');
      rows.push({ruleId:rule.id,status:rule.is_active?'active':'paused',leaderAccountId:rule.master_id,receiverAccountId:rule.slave_id,relayRegistered:Boolean(route),relayStatus:route?.status||'missing',executionReady:Boolean(rule.is_active&&route&&receiver?.reporter_connected&&receiver?.terminal_connected!==false&&receiver?.expert_enabled!==false),recentCopyCommands:copyCommands,issues});
    }
    res.json({ok:true,generatedAt:nowIso(),rules:rows,relaySync,relayDiagnostics:(state.relayDiagnostics||[]).filter(item=>String(item.userId)===userId).slice(0,100)});
  });
  app.post('/api/v2/copier-rules',requireUser,async(req,res)=>{
    const startedAt=Date.now();
    const requestId=id('copier-save');
    logger?.info?.('Copier rule save started',{requestId,userId:String(req.wisdoUser.id),masterId:String(req.body.master_id||''),receiverId:String(req.body.slave_id||'')});
    try{
      const outcome=await mutate(loadEcosystemState,saveEcosystemState,state=>{
        const master=state.tradingAccounts[String(req.body.master_id||'')];const follower=state.tradingAccounts[String(req.body.slave_id||'')];
        if(!master)return {error:'Select a Culture Lead. No lead account was found for that ID.'};
        if(!canAccessLeader(state,req.wisdoUser.id,master.id))return {error:'That account is not assigned as a Culture Lead or is not shared with this desk.'};
        if(!follower||!ownAccount(state,req.wisdoUser.id,follower.id))return {error:'Select an owned Mirror Receiver account.'};
        if(!accountCanReceive(follower))return {error:'The destination account must be assigned Mirror Receiver or Dual Role in Accounts.'};
        if(master.id===follower.id)return {error:'Culture Lead and Mirror Receiver must be different accounts.'};
        const risk=RISK_TYPES.includes(req.body.risk_type)?req.body.risk_type:'multiplier';
        const rule={id:id('rule'),user_id:String(req.wisdoUser.id),master_id:String(master.id),slave_id:String(follower.id),risk_type:risk,risk_value:num(req.body.risk_value,1),min_lot:num(req.body.min_lot,.01),max_lot:num(req.body.max_lot,100),equity_protection_pct:req.body.equity_protection_pct===''?null:num(req.body.equity_protection_pct,null),max_daily_loss:req.body.max_daily_loss===''?null:num(req.body.max_daily_loss,null),max_open_trades:req.body.max_open_trades===''?null:num(req.body.max_open_trades,null),max_spread_points:req.body.max_spread_points===''?null:num(req.body.max_spread_points,null),max_slippage_points:req.body.max_slippage_points===''?null:num(req.body.max_slippage_points,null),allowed_symbols:parseSymbols(req.body.allowed_symbols),symbol_mapping:normalizeMap(req.body.symbol_mapping),trading_hours_start:req.body.trading_hours_start||null,trading_hours_end:req.body.trading_hours_end||null,is_active:req.body.is_active===undefined?true:parseBool(req.body.is_active),reverse_signals:parseBool(req.body.reverse_signals),copy_sl_tp:req.body.copy_sl_tp===undefined?true:parseBool(req.body.copy_sl_tp),copy_pending_orders:parseBool(req.body.copy_pending_orders),created_at:nowIso(),updated_at:nowIso()};
        state.copierRules[rule.id]=rule;
        audit(state,req.wisdoUser.id,'copier_rule.created','CopierRule',rule.id,{leadRole:master.desk_role,receiverRole:follower.desk_role});
        appendMemberAlert(state,req.wisdoUser.id,{type:'system',title:'Culture Lane saved',body:`${rule.master_id} → ${rule.slave_id} was saved. Live relay registration is being checked.`,metadata:{ruleId:rule.id,relayRegistered:false}},`lane-created:${rule.id}`);
        return {rule};
      });
      if(outcome.error){
        logger?.warn?.('Copier rule save rejected',{requestId,userId:String(req.wisdoUser.id),error:outcome.error,elapsedMs:Date.now()-startedAt});
        return res.status(400).json({ok:false,error:outcome.error,requestId});
      }
      const relayTimeoutMs=Math.max(250,Number(process.env.WISDO_COPIER_RELAY_TIMEOUT_MS||5000));
      const relayResult=await settleWithin(syncCopierRuleToRelay(mt4SyncService,outcome.rule),relayTimeoutMs);
      const relayRoute=relayResult.status==='fulfilled'?relayResult.value:null;
      const relayPending=relayResult.status==='timeout';
      const relayError=relayResult.status==='rejected'?String(relayResult.error?.message||relayResult.error||'Relay registration failed'):'';
      const elapsedMs=Date.now()-startedAt;
      const logData={requestId,userId:String(req.wisdoUser.id),ruleId:outcome.rule.id,elapsedMs,relayStatus:relayResult.status,executionReady:Boolean(relayRoute)};
      if(relayError)logger?.warn?.('Copier rule saved but relay registration failed',{...logData,error:relayError});
      else logger?.info?.('Copier rule save completed',logData);
      return res.status(201).json({ok:true,rule:outcome.rule,relayRoute,executionReady:Boolean(relayRoute),relayPending,relayError,requestId,elapsedMs});
    }catch(error){
      logger?.error?.('Copier rule save failed',{requestId,userId:String(req.wisdoUser.id),elapsedMs:Date.now()-startedAt,error:error?.message,stack:error?.stack});
      return res.status(500).json({ok:false,error:'Culture Lane could not be saved.',detail:error?.message||'Unknown error',requestId});
    }
  });
  app.patch('/api/v2/copier-rules/:id',requireUser,async(req,res)=>{const rule=await mutate(loadEcosystemState,saveEcosystemState,state=>{if(!ownRule(state,req.wisdoUser.id,req.params.id))return null;const r=state.copierRules[req.params.id];for(const k of ['risk_type','risk_value','min_lot','max_lot','equity_protection_pct','max_daily_loss','max_open_trades','max_spread_points','max_slippage_points','trading_hours_start','trading_hours_end','reverse_signals','copy_sl_tp','copy_pending_orders'])if(req.body[k]!==undefined)r[k]=req.body[k];if(req.body.allowed_symbols!==undefined)r.allowed_symbols=parseSymbols(req.body.allowed_symbols);if(req.body.symbol_mapping!==undefined)r.symbol_mapping=normalizeMap(req.body.symbol_mapping);r.updated_at=nowIso();audit(state,req.wisdoUser.id,'copier_rule.updated','CopierRule',r.id);return r});if(!rule)return res.status(404).json({ok:false,error:'Rule not found.'});const relayRoute=await syncCopierRuleToRelay(mt4SyncService,rule);res.json({ok:true,rule,relayRoute,executionReady:Boolean(relayRoute)})});
  app.post('/api/v2/copier-rules/:id/toggle',requireUser,async(req,res)=>{const rule=await mutate(loadEcosystemState,saveEcosystemState,state=>{if(!ownRule(state,req.wisdoUser.id,req.params.id))return null;const r=state.copierRules[req.params.id];r.is_active=req.body?.is_active===undefined?!r.is_active:parseBool(req.body.is_active);r.updated_at=nowIso();audit(state,req.wisdoUser.id,'copier_rule.toggled','CopierRule',r.id,{is_active:r.is_active});return r});if(!rule)return res.status(404).json({ok:false,error:'Rule not found.'});const relayRoute=await syncCopierRuleToRelay(mt4SyncService,rule);res.json({ok:true,rule,relayRoute,executionReady:Boolean(relayRoute)})});
  app.delete('/api/v2/copier-rules/:id',requireUser,async(req,res)=>{const removed=await mutate(loadEcosystemState,saveEcosystemState,state=>{if(!ownRule(state,req.wisdoUser.id,req.params.id))return null;const r=state.copierRules[req.params.id];delete state.copierRules[req.params.id];audit(state,req.wisdoUser.id,'copier_rule.deleted','CopierRule',r.id);return r});if(!removed)return res.status(404).json({ok:false,error:'Rule not found.'});const relayRemoved=await mt4SyncService?.repository?.deleteCopyRoute?.(req.wisdoUser.id,removed.id);res.json({ok:true,removed,relayRemoved})});

  app.get('/api/v2/trades',requireUser,async(req,res)=>{const sync=await synchronizeLiveTradeLedger({userId:req.wisdoUser.id,mt4SyncService,loadEcosystemState,saveEcosystemState});const state=ensureMajorState(await loadEcosystemState());let trades=Object.values(state.trades).filter(t=>String(t.user_id)===String(req.wisdoUser.id));if(req.query.account_id)trades=trades.filter(t=>String(t.account_id)===String(req.query.account_id));if(req.query.status)trades=trades.filter(t=>t.status===req.query.status);trades.sort((a,b)=>new Date(b.opened_at||b.updated_at||0)-new Date(a.opened_at||a.updated_at||0));res.json({ok:true,trades:trades.slice(0,clamp(req.query.limit||500,1,2000)),sync,dataSource:trades.length?'mt4_reporter_ledger':'waiting_for_reporter_trade_data'})});
  app.post('/api/v2/trades',requireUser,async(req,res)=>{const state=ensureMajorState(await loadEcosystemState());if(!ownAccount(state,req.wisdoUser.id,req.body.account_id))return res.status(400).json({ok:false,error:'Account not found.'});const side=req.body.side==='sell'?'sell':'buy';const symbol=normalizeSymbol(req.body.symbol);if(!symbol)return res.status(400).json({ok:false,error:'Symbol is required.'});const trade=await mutate(loadEcosystemState,saveEcosystemState,state=>{const t={id:id('trade'),user_id:String(req.wisdoUser.id),account_id:req.body.account_id,copier_rule_id:null,source_trade_id:null,external_ticket:null,symbol,side,lot_size:num(req.body.lot_size,.01),open_price:num(req.body.open_price,null),close_price:null,stop_loss:num(req.body.stop_loss||req.body.sl,null),take_profit:num(req.body.take_profit||req.body.tp,null),commission:0,swap:0,pnl:null,status:'open',opened_at:nowIso(),closed_at:null,copy_latency_ms:null};state.trades[t.id]=t;return t});try{const command=await mt4CommandService.queueCommandForAccount(req.wisdoUser.id,trade.account_id,'MARKET_ORDER',{accountId:trade.account_id,symbol:trade.symbol,side:trade.side,lots:trade.lot_size,stopLoss:trade.stop_loss,takeProfit:trade.take_profit,confirmation:req.body.confirmation});res.status(201).json({ok:true,trade,command})}catch(e){await mutate(loadEcosystemState,saveEcosystemState,state=>{state.trades[trade.id].status='error';return true});res.status(400).json({ok:false,error:e.message,validation:e.validation,trade})}});
  app.post('/api/v2/trades/:id/close',requireUser,async(req,res)=>{const state=ensureMajorState(await loadEcosystemState());const trade=state.trades[req.params.id];if(!trade||String(trade.user_id)!==String(req.wisdoUser.id))return res.status(404).json({ok:false,error:'Trade not found.'});try{const command=await mt4CommandService.queueCommandForAccount(req.wisdoUser.id,trade.account_id,'CLOSE_BY_TICKET',{accountId:trade.account_id,ticket:trade.external_ticket||trade.id,confirmation:req.body.confirmation});res.json({ok:true,queued:true,command})}catch(e){res.status(400).json({ok:false,error:e.message,validation:e.validation})}});
  app.post('/api/v2/trades/close-all',requireUser,async(req,res)=>{const state=ensureMajorState(await loadEcosystemState());if(!ownAccount(state,req.wisdoUser.id,req.body.account_id))return res.status(404).json({ok:false,error:'Account not found.'});try{const command=await mt4CommandService.queueCommandForAccount(req.wisdoUser.id,req.body.account_id,'CLOSE_ALL_TRADES',{accountId:req.body.account_id,confirmation:req.body.confirmation});res.json({ok:true,queued:true,command})}catch(e){res.status(400).json({ok:false,error:e.message,validation:e.validation})}});
  app.get('/api/v2/trades/stats',requireUser,async(req,res)=>{await synchronizeLiveTradeLedger({userId:req.wisdoUser.id,mt4SyncService,loadEcosystemState,saveEcosystemState});const state=ensureMajorState(await loadEcosystemState());res.json({ok:true,...analyzerFromState(state,req.wisdoUser.id,{accountId:req.query.account_id||'',period:req.query.period||'month'})})});

  app.get('/api/v2/analyzer/portfolio',requireUser,async(req,res)=>{const sync=await synchronizeLiveTradeLedger({userId:req.wisdoUser.id,mt4SyncService,loadEcosystemState,saveEcosystemState});const state=ensureMajorState(await loadEcosystemState());res.json({ok:true,period:req.query.period||'month',sync,...analyzerFromState(state,req.wisdoUser.id,{accountId:req.query.account_id||'',period:req.query.period||'month'})})});
  app.get('/api/v2/analyzer/heatmap',requireUser,async(req,res)=>{await synchronizeLiveTradeLedger({userId:req.wisdoUser.id,mt4SyncService,loadEcosystemState,saveEcosystemState});const state=ensureMajorState(await loadEcosystemState());let rows=Object.values(state.trades).filter(t=>String(t.user_id)===String(req.wisdoUser.id)&&t.status==='closed');if(req.query.account_id)rows=rows.filter(t=>String(t.account_id)===String(req.query.account_id));const bySymbol={};for(const t of rows)bySymbol[t.symbol]=(bySymbol[t.symbol]||0)+num(t.pnl);res.json({ok:true,symbols:Object.entries(bySymbol).map(([symbol,pnl])=>({symbol,pnl,trades:rows.filter(t=>t.symbol===symbol).length})).sort((a,b)=>b.pnl-a.pnl),dataSource:rows.length?'mt4_reporter_ledger':'waiting_for_closed_trades'})});
  app.get('/api/v2/analyzer/export.csv',requireUser,async(req,res)=>{const state=ensureMajorState(await loadEcosystemState());const rows=Object.values(state.trades).filter(t=>String(t.user_id)===String(req.wisdoUser.id));const keys=['id','account_id','symbol','side','lot_size','open_price','close_price','pnl','status','opened_at','closed_at'];const csv=[keys.join(','),...rows.map(r=>keys.map(k=>JSON.stringify(r[k]??'')).join(','))].join('\n');res.type('text/csv').set('content-disposition','attachment; filename="wisdo-trades.csv"').send(csv)});

  app.get('/api/v2/alerts',requireUser,async(req,res)=>{const sync=await synchronizeLiveTradeLedger({userId:req.wisdoUser.id,mt4SyncService,loadEcosystemState,saveEcosystemState});const state=ensureMajorState(await loadEcosystemState());const uid=String(req.wisdoUser.id);const native=state.alerts[uid]||[];const legacy=(state.notification_events||[]).filter(a=>String(a.userId||a.user_id)===uid).map(a=>({id:a.id,user_id:uid,type:String(a.type||'system').toLowerCase().replace(/\s+/g,'_'),title:a.title||a.type||'WISDO alert',body:a.message||a.body||'',metadata:a.metadata||{},read_at:a.read_at||(a.read_status==='read'?a.createdAt:null),created_at:a.created_at||a.createdAt||nowIso()}));const seen=new Set();const alerts=[...native,...legacy].filter(a=>{const key=String(a.id||a.metadata?.eventKey||`${a.type}:${a.title}:${a.created_at}`);if(seen.has(key))return false;seen.add(key);return !parseBool(req.query.unread_only)||!a.read_at}).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,clamp(req.query.limit||250,1,1000));res.json({ok:true,alerts,sync,dataSource:alerts.length?'live_event_ledger':'waiting_for_events',health:Object.values(state.tradingAccounts).filter(a=>String(a.user_id)===uid).map(a=>({accountId:a.id,status:a.status,reporterConnected:a.reporter_connected,terminalConnected:a.terminal_connected,expertEnabled:a.expert_enabled,lastSyncAt:a.last_sync_at}))})});
  app.patch('/api/v2/alerts/:id/read',requireUser,async(req,res)=>{const alert=await mutate(loadEcosystemState,saveEcosystemState,state=>{const a=(state.alerts[req.wisdoUser.id]||[]).find(x=>x.id===req.params.id);if(!a)return null;a.read_at=nowIso();return a});if(!alert)return res.status(404).json({ok:false,error:'Alert not found.'});res.json({ok:true,alert})});
  app.post('/api/v2/alerts/read-all',requireUser,async(req,res)=>{await mutate(loadEcosystemState,saveEcosystemState,state=>{for(const a of state.alerts[req.wisdoUser.id]||[])a.read_at ||= nowIso();return true});res.json({ok:true})});
  app.get('/api/v2/events',requireUser,(req,res)=>{res.set({'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});res.flushHeaders?.();const send=()=>res.write(`event: heartbeat\ndata: ${JSON.stringify({time:nowIso(),userId:req.wisdoUser.id})}\n\n`);send();const timer=setInterval(send,25000);req.on('close',()=>clearInterval(timer))});

  app.get('/api/v2/affiliate',requireUser,async(req,res)=>{const state=ensureMajorState(await loadEcosystemState());const uid=String(req.wisdoUser.id);state.affiliates[uid] ||= {userId:uid,code:`WISDO-${uid.slice(-6).toUpperCase()}`,commissionPercent:num(config?.affiliate?.defaultCommissionPercent,30),available:0,pending:0,createdAt:nowIso()};const conversions=Object.values(state.affiliateConversions).filter(c=>String(c.affiliateUserId)===uid);res.json({ok:true,code:state.affiliates[uid].code,commissionPercent:state.affiliates[uid].commissionPercent,available:state.affiliates[uid].available,pending:state.affiliates[uid].pending,conversions:conversions.length})});

  app.post('/api/v2/ai/trade-insight',requireUser,async(req,res)=>{const state=ensureMajorState(await loadEcosystemState());const account=state.tradingAccounts[req.body.account_id];if(!account||String(account.user_id)!==String(req.wisdoUser.id))return res.status(404).json({ok:false,error:'Account not found.'});const stats=analyzeTrades(Object.values(state.trades).filter(t=>t.account_id===account.id));res.json({ok:true,provider:process.env.OPENAI_API_KEY||process.env.GOOGLE_AI_API_KEY?'gateway_ready_rule_fallback':'rule_engine',insight:`${account.broker||account.platform} account has ${stats.tradeCount} closed trades, ${stats.winRate.toFixed(1)}% win rate, and ${stats.maxDrawdown.toFixed(1)}% measured drawdown. ${stats.maxDrawdown>10?'Reduce route pressure and review equity protection.':'Current measured drawdown is within the default warning threshold.'}`})});
  app.post('/api/v2/ai/risk-suggestion',requireUser,async(req,res)=>{const state=ensureMajorState(await loadEcosystemState());const account=state.tradingAccounts[req.body.account_id];if(!account||String(account.user_id)!==String(req.wisdoUser.id))return res.status(404).json({ok:false,error:'Account not found.'});const health=account.equity>=account.balance?85:account.balance?Math.max(20,100-(account.balance-account.equity)/account.balance*200):50;res.json({ok:true,suggestion:{risk_type:'equity_ratio',risk_value:health>=80?1:health>=60?.75:.5,equity_protection_pct:health>=80?12:8,max_lot:Math.max(.01,Math.min(100,num(account.equity)/10000))},reason:`Account health score ${health.toFixed(0)}/100.`})});

  app.post('/api/public/webhooks/broker-trade',async(req,res)=>{
    const raw=req.rawBody||Buffer.from(JSON.stringify(req.body||{}));
    const signature=req.headers['x-wisdo-signature']||req.headers['x-broker-signature'];
    if(!verifyHmacSha256({rawBody:raw,signature,secretValue:process.env.BROKER_WEBHOOK_SECRET}))return res.status(401).json({ok:false,error:'Invalid webhook signature.'});
    const event=req.body||{};
    const masterAccountId=String(event.account_id||event.masterAccountId||'');
    const action=String(event.action||event.event||'open').toLowerCase();
    const isClose=action.includes('close')||action.includes('delete');
    const incomingSymbol=normalizeSymbol(event.symbol||event.leaderSymbol||event.masterSymbol);
    const externalTicket=String(event.ticket||event.external_ticket||'');
    const result=await mutate(loadEcosystemState,saveEcosystemState,async state=>{
      const master=state.tradingAccounts[masterAccountId];
      if(!master)return {error:'Master account not found.'};
      let masterTrade=Object.values(state.trades).find(t=>t.account_id===masterAccountId&&externalTicket&&String(t.external_ticket||'')===externalTicket);
      const wasExisting=Boolean(masterTrade);
      if(!masterTrade){
        masterTrade={id:id('trade'),user_id:master.user_id,account_id:masterAccountId,copier_rule_id:null,source_trade_id:null,external_ticket:externalTicket,symbol:incomingSymbol,side:String(event.side||'buy').toLowerCase()==='sell'?'sell':'buy',lot_size:num(event.lot_size||event.lots,.01),open_price:num(event.open_price||event.price,null),close_price:null,stop_loss:num(event.stop_loss||event.sl,null),take_profit:num(event.take_profit||event.tp,null),commission:num(event.commission,0),swap:num(event.swap,0),pnl:null,status:'open',opened_at:event.opened_at||nowIso(),closed_at:null,copy_latency_ms:null};
        state.trades[masterTrade.id]=masterTrade;
      }else if(!isClose){
        masterTrade.symbol=masterTrade.symbol||incomingSymbol;
        masterTrade.side=String(event.side||masterTrade.side||'buy').toLowerCase()==='sell'?'sell':'buy';
        masterTrade.lot_size=num(event.lot_size||event.lots,masterTrade.lot_size||.01);
        masterTrade.open_price=num(event.open_price||event.price,masterTrade.open_price);
        masterTrade.stop_loss=num(event.stop_loss||event.sl,masterTrade.stop_loss);
        masterTrade.take_profit=num(event.take_profit||event.tp,masterTrade.take_profit);
        masterTrade.status='open';
      }
      if(isClose){
        masterTrade.status='closed';
        masterTrade.close_price=num(event.close_price||event.price,masterTrade.close_price);
        masterTrade.pnl=num(event.pnl,masterTrade.pnl||0);
        masterTrade.commission=num(event.commission,masterTrade.commission||0);
        masterTrade.swap=num(event.swap,masterTrade.swap||0);
        masterTrade.closed_at=event.closed_at||nowIso();
      }
      const leaderSymbol=normalizeSymbol(masterTrade.symbol||incomingSymbol);
      const routes=Object.values(state.copierRules).filter(r=>r.master_id===masterAccountId&&r.is_active);
      const queued=[];
      for(const rule of routes){
        const follower=state.tradingAccounts[rule.slave_id];
        if(!follower)continue;
        const existingCopy=Object.values(state.trades).find(t=>t.copier_rule_id===rule.id&&t.source_trade_id===masterTrade.id&&t.account_id===follower.id&&t.status==='open')||Object.values(state.trades).find(t=>t.copier_rule_id===rule.id&&t.source_trade_id===masterTrade.id&&t.account_id===follower.id);
        if(!isClose){
          if(existingCopy&&wasExisting){queued.push({ruleId:rule.id,followerAccountId:follower.id,skipped:'duplicate_open'});continue;}
          if(rule.allowed_symbols?.length&&!rule.allowed_symbols.includes(leaderSymbol)){queued.push({ruleId:rule.id,followerAccountId:follower.id,skipped:'symbol_not_allowed'});continue;}
          if(!inTradingHours(rule)){queued.push({ruleId:rule.id,followerAccountId:follower.id,skipped:'outside_trading_hours'});continue;}
          if(rule.equity_protection_pct!=null&&follower.balance>0&&((follower.balance-follower.equity)/follower.balance*100)>=num(rule.equity_protection_pct)){queued.push({ruleId:rule.id,followerAccountId:follower.id,skipped:'equity_protection'});continue;}
          const today=new Date();today.setHours(0,0,0,0);
          const dailyPnl=Object.values(state.trades).filter(t=>t.account_id===follower.id&&t.status==='closed'&&new Date(t.closed_at||t.opened_at)>=today).reduce((sum,t)=>sum+num(t.pnl),0);
          if(rule.max_daily_loss!=null&&dailyPnl<=-Math.abs(num(rule.max_daily_loss))){queued.push({ruleId:rule.id,followerAccountId:follower.id,skipped:'max_daily_loss'});continue;}
          const openCount=Object.values(state.trades).filter(t=>t.account_id===follower.id&&t.status==='open').length;
          if(rule.max_open_trades!=null&&openCount>=num(rule.max_open_trades)){queued.push({ruleId:rule.id,followerAccountId:follower.id,skipped:'max_open_trades'});continue;}
          if(rule.max_spread_points!=null&&event.spread!=null&&num(event.spread)>num(rule.max_spread_points)){queued.push({ruleId:rule.id,followerAccountId:follower.id,skipped:'spread_limit'});continue;}
          const pending=String(event.order_type||event.type||'').toLowerCase().includes('limit')||String(event.order_type||event.type||'').toLowerCase().includes('stop');
          if(pending&&!rule.copy_pending_orders){queued.push({ruleId:rule.id,followerAccountId:follower.id,skipped:'pending_orders_disabled'});continue;}
        }else if(!existingCopy){
          queued.push({ruleId:rule.id,followerAccountId:follower.id,skipped:'no_matching_copy'});
          continue;
        }
        if(isClose&&existingCopy&&!existingCopy.external_ticket){
          const recoveredTicket=await recoverCompletedFollowerTicket(mt4CommandService,{routeId:rule.id,leaderTicket:masterTrade.external_ticket||masterTrade.id,followerAccountId:follower.id});
          if(recoveredTicket)existingCopy.external_ticket=recoveredTicket;
        }
        const followerSymbol=normalizeSymbol(existingCopy?.symbol||resolveFollowerSymbol(leaderSymbol,rule)||leaderSymbol);
        const lot=existingCopy?.lot_size||calculateSlaveLot(rule,masterTrade.lot_size,num(master.equity),num(follower.equity),num(master.balance),num(follower.balance));
        const commandName=isClose?'COPY_CLOSE_TRADE':'COPY_OPEN_TRADE';
        const stableLeaderTicket=String(masterTrade.external_ticket||masterTrade.id);
        const payload={accountId:follower.id,leaderAccountId:master.id,followerAccountId:follower.id,leaderSymbol,masterSymbol:leaderSymbol,followerSymbol,symbol:followerSymbol,sourceTicket:stableLeaderTicket,leaderTicket:stableLeaderTicket,masterTicket:stableLeaderTicket,copyKey:`${rule.id}:${stableLeaderTicket}`,followerTicket:existingCopy?.external_ticket||null,masterTradeId:masterTrade.id,side:rule.reverse_signals?(masterTrade.side==='buy'?'sell':'buy'):masterTrade.side,lots:lot,stopLoss:rule.copy_sl_tp?masterTrade.stop_loss:null,takeProfit:rule.copy_sl_tp?masterTrade.take_profit:null,routeId:rule.id,maxSlippagePoints:rule.max_slippage_points??null,immediate:true,priority:isClose?300:150,confirmation:'confirmed'};
        try{
          const command=await mt4CommandService.queueCommandForAccount(rule.user_id,follower.id,commandName,payload);
          queued.push({ruleId:rule.id,followerAccountId:follower.id,followerSymbol,commandId:command.id});
          const memberAlerts=state.alerts[rule.user_id] ||= [];
          memberAlerts.unshift({id:id('alert'),user_id:String(rule.user_id),type:isClose?'trade_closed':'trade_opened',title:isClose?'Mirrored trade close queued':'Mirrored trade open queued',body:`${leaderSymbol} → ${followerSymbol} on ${follower.nickname||follower.account_number||follower.id}`,metadata:{routeId:rule.id,leaderAccountId:master.id,followerAccountId:follower.id,masterTradeId:masterTrade.id,commandId:command.id,symbol:followerSymbol,lots:lot},read_at:null,created_at:nowIso()});
          state.alerts[rule.user_id]=memberAlerts.slice(0,500);
          if(existingCopy){
            if(isClose){existingCopy.status='closing';existingCopy.close_requested_at=nowIso();existingCopy.close_command_id=command.id;}
          }else{
            const copied={id:id('trade'),user_id:rule.user_id,account_id:follower.id,copier_rule_id:rule.id,source_trade_id:masterTrade.id,external_ticket:null,symbol:followerSymbol,side:payload.side,lot_size:lot,open_price:masterTrade.open_price,close_price:null,stop_loss:payload.stopLoss,take_profit:payload.takeProfit,commission:0,swap:0,pnl:null,status:'open',opened_at:nowIso(),closed_at:null,copy_latency_ms:Math.max(0,Date.now()-new Date(masterTrade.opened_at).getTime())};
            state.trades[copied.id]=copied;
          }
        }catch(error){queued.push({ruleId:rule.id,followerAccountId:follower.id,error:error.message});}
      }
      audit(state,master.user_id,'broker_webhook.processed','Trade',masterTrade.id,{action,queued:queued.length,externalTicket});
      return {masterTrade,queued};
    });
    if(result.error)return res.status(404).json({ok:false,error:result.error});
    res.json({ok:true,...result});
  });

  const cronGuard=(req,res,next)=>{const expected=String(process.env.CRON_SECRET||'');const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!expected||supplied!==expected)return res.status(401).json({ok:false,error:'Invalid cron token.'});next()};
  app.post('/api/public/cron/sync-accounts',cronGuard,async(req,res)=>{const state=ensureMajorState(await loadEcosystemState());const accounts=Object.values(state.tradingAccounts).filter(a=>a.status!=='disconnected');let queued=0;for(const a of accounts){try{await mt4CommandService.queueCommandForAccount(a.user_id,a.id,'SYNC_ACCOUNT',{accountId:a.id,immediate:false,ttlMinutes:2});queued++}catch{}}res.json({ok:true,queued,accounts:accounts.length})});
  app.post('/api/public/cron/refresh-market',cronGuard,async(req,res)=>{await mutate(loadEcosystemState,saveEcosystemState,state=>{state.marketCache={refreshedAt:nowIso(),providerConfigured:Boolean(process.env.FINNHUB_API_KEY||process.env.TRADING_ECONOMICS_API_KEY||process.env.FIRECRAWL_API_KEY)};return true});res.json({ok:true,refreshedAt:nowIso()})});
  app.get('/api/public/health',async(req,res)=>{const security=sessionSecurityStatus();res.json({ok:true,service:'WISDO Major Product Pass',version:'5.7.0',time:nowIso(),persistence:config.persistence?.mode||'json',security,integrations:{discord:Boolean(process.env.DISCORD_TOKEN&&process.env.CLIENT_ID),square:Boolean(process.env.SQUARE_ACCESS_TOKEN&&process.env.SQUARE_LOCATION_ID),resend:Boolean(process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL),sms:Boolean(process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN&&process.env.TWILIO_FROM_NUMBER),market:Boolean(process.env.FINNHUB_API_KEY||process.env.TRADING_ECONOMICS_API_KEY||process.env.FIRECRAWL_API_KEY),ai:Boolean(process.env.OPENAI_API_KEY||process.env.GOOGLE_AI_API_KEY),postgres:Boolean(process.env.DATABASE_URL)},features:{premiumPublicSite:true,pricingConfigurator:true,operationalApi:true,signedBrokerWebhook:true,accountSpecificCommands:true,academy:true,affiliate:true,unifiedCopierOptions:true,protectedPrivateStrategies:true,aiWebinarRoom:true,adminStrategyStudio:true,browserNarration:true,chartTeacher:true,tradingViewLessons:true,realHistoricalExamples:true,fakeChartFallbackDisabled:true,squareCheckout:true,renderMemoryRepair:true,growthFunnel:true,signupEmailSms:true,personalLearningRoom:true,educationDripSequence:true,portableLeadAi:true,videoEngagementTracking:true}})});
  app.get('/api/runtime-audit',async(req,res)=>{const state=ensureMajorState(await loadEcosystemState());res.json({ok:true,version:'5.7.0',source:'wisdo-learning-funnel-portable-ai-v5.7.0.zip',checks:{rootRoute:true,publicProductPages:true,loginReturnTo:true,signedSessions:sessionSecurityStatus().signedSessions,credentialEncryptionReady:sessionSecurityStatus().credentialEncryptionConfigured,copierRules:Object.keys(state.copierRules).length,accounts:Object.keys(state.tradingAccounts).length,trades:Object.keys(state.trades).length,closeSignalsBypassEntryFilters:true,followerSymbolGuaranteed:true,persistentStorageConfigured:Boolean(config.persistence?.storagePath),executionAutomatchEnabled:parseBool(process.env.WISDO_SYMBOL_AUTOMATCH_EXECUTION_ENABLED),unifiedCopierOptions:true,privateStrategySourcePublic:false,aiWebinarRoom:true,adminStrategyStudio:true,browserNarration:true,chartTeacher:true,tradingViewLessons:true,realHistoricalExamples:true,fakeChartFallbackDisabled:true,squareCheckout:true,renderMemoryRepair:true,growthFunnel:true,signupEmailSms:true,personalLearningRoom:true,educationDripSequence:true,portableLeadAi:true,videoEngagementTracking:true}})});

  app.get('/api/v2/admin/stats',requireUser,requireAdmin,async(req,res)=>{const state=ensureMajorState(await loadEcosystemState());res.json({ok:true,users:Object.keys(state.profiles).length,accounts:Object.keys(state.tradingAccounts).length,rules:Object.keys(state.copierRules).length,trades:Object.keys(state.trades).length,subscriptions:Object.keys(state.subscriptions).length,alerts:Object.values(state.alerts).flat().length})});
  app.post('/api/v2/admin/firms',requireUser,requireAdmin,async(req,res)=>{const firm=await mutate(loadEcosystemState,saveEcosystemState,state=>{const firm={id:req.body.id||id('firm'),name:String(req.body.name||'').trim(),type:req.body.type==='broker'?'broker':'prop',logo_url:req.body.logo_url||'',max_drawdown_pct:num(req.body.max_drawdown_pct,null),daily_drawdown_pct:num(req.body.daily_drawdown_pct,null),profit_split_pct:num(req.body.profit_split_pct,null),refund_policy:req.body.refund_policy||'',min_trading_days:num(req.body.min_trading_days,0),supported_platforms:(req.body.supported_platforms||[]).filter(x=>PLATFORMS.includes(x)),rating:num(req.body.rating,0),updated_at:nowIso()};state.firms[firm.id]=firm;audit(state,req.wisdoUser.id,'firm.upserted','Firm',firm.id);return firm});res.json({ok:true,firm})});

  logger?.info?.('WISDO major upgrade routes registered', { source: 'wisdo-learning-funnel-portable-ai-v5.7.0.zip', version: '5.7.0' });
}
