const ACCOUNT_TYPES = new Set(['DEMO', 'LIVE', 'UNKNOWN']);
const ACCOUNT_HEALTH = new Set(['UNLINKED', 'CONNECTING', 'CONNECTED', 'STALE', 'DEGRADED', 'OFFLINE', 'DANGER']);

function text(value) { return String(value ?? '').trim(); }
function normalized(value) { return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function asDate(value) { if (!value) return 0; const time = Date.parse(value); return Number.isFinite(time) ? time : 0; }

export function classifyAccountType(account = {}) {
  const explicit = text(account.accountType || account.type || account.environment).toUpperCase();
  if (ACCOUNT_TYPES.has(explicit)) return explicit;
  if (account.isDemo === true || /demo|practice|paper/i.test(`${account.brokerServer || ''} ${account.server || ''}`)) return 'DEMO';
  if (account.isDemo === false || /live|real/i.test(explicit)) return 'LIVE';
  return 'UNKNOWN';
}

export function classifyAccountHealth(account = {}, now = Date.now()) {
  const explicit = text(account.health || account.connectionStatus || account.status).toUpperCase();
  const marginLevel = Number(account.marginLevel);
  if (Number.isFinite(marginLevel) && marginLevel > 0 && marginLevel < 100) return 'DANGER';
  if (explicit === 'DANGER') return 'DANGER';
  if (account.pendingReporter || explicit === 'CONNECTING') return 'CONNECTING';

  // A persisted CONNECTED flag is only a hint. Reporter heartbeat/snapshot age is the
  // authoritative liveness signal so a dead terminal cannot look healthy forever.
  const last = asDate(account.lastHeartbeatAt || account.lastSyncAt || account.lastSnapshotAt || account.latestSnapshot?.receivedAt);
  if (last) {
    const age = Math.max(0, now - last);
    if (age <= 90_000) return 'CONNECTED';
    if (age <= 5 * 60_000) return 'STALE';
    if (age <= 30 * 60_000) return 'DEGRADED';
    return 'OFFLINE';
  }

  if (['STALE', 'DEGRADED', 'OFFLINE'].includes(explicit)) return explicit;
  if (explicit === 'CONNECTED') return account.accountId ? 'STALE' : 'OFFLINE';
  return account.accountId ? 'UNLINKED' : 'OFFLINE';
}

export function normalizeTradingAccount(account = {}, viewerUserId = '') {
  const snapshot = account.latestSnapshot?.snapshot || account.snapshot || {};
  return {
    ...account,
    accountId: text(account.stableAccountId || account.stable_account_id || account.accountId || account.id),
    legacyAccountId: text(account.legacyAccountId || account.accountId || account.id),
    ownerUserId: text(account.ownerUserId || account.discordUserId || account.userId),
    discordUserId: text(account.discordUserId || account.ownerUserId || account.userId),
    nickname: text(account.nickname || account.accountNickname),
    brokerName: text(account.brokerName || account.broker || snapshot.broker),
    brokerServer: text(account.brokerServer || account.server || snapshot.brokerServer),
    mt4Login: text(account.mt4Login || account.accountNumber || snapshot.accountNumber),
    accountType: classifyAccountType({ ...account, ...snapshot }),
    health: classifyAccountHealth({ ...account, ...snapshot }),
    balance: Number(snapshot.balance ?? account.balance ?? 0),
    equity: Number(snapshot.equity ?? account.equity ?? 0),
    floatingProfit: Number(snapshot.floatingProfit ?? snapshot.floatingPL ?? account.floatingProfit ?? account.floatingPL ?? 0),
    dailyProfit: Number(snapshot.dailyProfit ?? snapshot.dailyClosedPL ?? account.dailyProfit ?? account.dailyClosedPL ?? 0),
    authorized: text(account.ownerUserId || account.discordUserId || account.userId) === text(viewerUserId) || Boolean(account.shared),
  };
}

export class AccountSelectionError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'AccountSelectionError'; this.code = code; this.statusCode = code === 'account_forbidden' ? 403 : 400; this.details = details; this.expose = true; }
}

export class AccountSelectionService {
  constructor({ repository, memoryService = null } = {}) { this.repository = repository; this.memoryService = memoryService; }

  async list(userId) {
    const id = text(userId);
    if (!id) throw new AccountSelectionError('identity_required', 'Sign in before selecting a trading account.');
    const rows = await this.repository?.getAccessibleMt4Accounts?.(id) || [];
    return rows.map((row) => normalizeTradingAccount(row, id)).filter((row) => row.accountId && row.authorized);
  }

  async active(userId) {
    const accounts = await this.list(userId);
    const selected = accounts.find((account) => account.isPrimary);
    if (!selected) throw new AccountSelectionError('active_account_required', 'Select an active account before using account-aware controls.', { accountCount: accounts.length });
    return selected;
  }

  async select(userId, accountId) {
    const accounts = await this.list(userId);
    const selected = accounts.find((account) => account.accountId === text(accountId) || account.legacyAccountId === text(accountId));
    if (!selected) throw new AccountSelectionError('account_forbidden', 'That account is not owned by or shared with this user.');
    const saved = await this.repository?.setPrimaryMt4Account?.(text(userId), selected.legacyAccountId || selected.accountId);
    if (!saved) throw new AccountSelectionError('account_forbidden', 'Shared view-only accounts cannot become execution targets.');
    await this.memoryService?.setActiveAccount?.(text(userId), selected.legacyAccountId || selected.accountId);
    return { ...selected, isPrimary: true };
  }

  async resolve(userId, reference, { permission = 'view', allowActive = true } = {}) {
    const accounts = await this.list(userId);
    const raw = text(reference);
    if (!raw) {
      if (!allowActive) throw new AccountSelectionError('account_reference_required', 'Specify an exact account.');
      return this.active(userId);
    }
    const query = normalized(raw.replace(/^my\s+/i, '').replace(/\s+account$/i, ''));
    const ordinal = query.match(/^account\s+(\d+)$/i);
    let matches = ordinal ? [accounts[Number(ordinal[1]) - 1]].filter(Boolean) : accounts.filter((account) => {
      const candidates = [account.accountId, account.legacyAccountId, account.nickname, account.mt4Login, `${account.nickname} ${account.accountType}`, `${account.brokerName} ${account.brokerServer}`].map(normalized).filter(Boolean);
      return candidates.some((candidate) => candidate === query) || (query === 'primary account' && account.isPrimary);
    });
    if (!matches.length) throw new AccountSelectionError('account_not_found', `No authorized account exactly matched “${raw}”.`, { choices: accounts.map((account) => account.nickname || account.accountId) });
    if (matches.length > 1) throw new AccountSelectionError('account_ambiguous', `“${raw}” matches more than one account. Use the account nickname or ID.`, { matches: matches.map((account) => account.accountId) });
    const account = matches[0];
    const sharePermission = text(account.sharePermission).toLowerCase();
    if (permission === 'control' && account.shared && !['control_allowed', 'admin'].includes(sharePermission)) throw new AccountSelectionError('account_forbidden', 'This shared account does not grant trading-control permission.');
    return account;
  }
}
