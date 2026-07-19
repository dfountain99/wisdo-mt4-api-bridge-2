import { createDatabaseStateStore } from '../storage/stateStore.js';

function nowIso() {
  return new Date().toISOString();
}

function toNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeId(value) {
  return String(value || '').trim();
}

function defaultState() {
  return {
    version: 1,
    users: {},
    accounts: {},
    commandJournal: [],
  };
}

function normalizeState(raw) {
  return {
    version: raw?.version || 1,
    users: raw?.users || {},
    accounts: raw?.accounts || {},
    commandJournal: Array.isArray(raw?.commandJournal) ? raw.commandJournal : [],
  };
}

export class WisdoMemoryService {
  constructor(config = {}, repository = null) {
    this.store = createDatabaseStateStore('wisdo_memory', defaultState);
    this.repository = repository;
  }

  async load() {
    return normalizeState(await this.store.read());
  }

  async save(data) {
    return this.store.write(normalizeState(data));
  }

  async update(updater) {
    const data = await this.load();
    const next = await updater(data) || data;
    await this.save(next);
    return next;
  }

  ensureUser(data, discordUserId) {
    const userId = normalizeId(discordUserId);
    data.users[userId] ||= {
      discordUserId: userId,
      activeAccountId: null,
      defaultAccountId: null,
      accounts: [],
      lastCommand: null,
      takeoverMode: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    return data.users[userId];
  }

  async updateFromSnapshot({ connectionRecord, latestSnapshotRecord }) {
    if (!connectionRecord?.discordUserId || !connectionRecord?.accountId) return null;

    const snapshot = latestSnapshotRecord?.snapshot || {};
    const updatedAt = latestSnapshotRecord?.receivedAt || nowIso();
    let result = null;

    await this.update((data) => {
      const user = this.ensureUser(data, connectionRecord.discordUserId);
      const accountId = connectionRecord.accountId;
      if (!user.accounts.includes(accountId)) user.accounts.push(accountId);
      if (!user.activeAccountId) user.activeAccountId = accountId;
      if (!user.defaultAccountId) user.defaultAccountId = accountId;
      user.lastSeenAt = updatedAt;
      user.updatedAt = updatedAt;

      const previous = data.accounts[accountId] || {};
      const balance = toNumber(snapshot.balance, previous.lastKnownBalance ?? null);
      const equity = toNumber(snapshot.equity, previous.lastKnownEquity ?? null);
      const openTradeCount = toNumber(snapshot.openTradeCount, previous.openTradeCount ?? 0);
      const floatingPL = toNumber(snapshot.floatingPL, previous.floatingPL ?? 0);
      const drawdownPercent = balance && equity !== null && equity < balance
        ? Number((((balance - equity) / balance) * 100).toFixed(2))
        : 0;

      data.accounts[accountId] = {
        ...previous,
        accountId,
        discordUserId: connectionRecord.discordUserId,
        accountNumber: connectionRecord.accountNumber,
        brokerServer: connectionRecord.brokerServer,
        nickname: connectionRecord.nickname || connectionRecord.accountNickname || previous.nickname || connectionRecord.accountNumber,
        accountRole: connectionRecord.accountRole || previous.accountRole || 'private',
        copyPermission: connectionRecord.copyPermission || previous.copyPermission || 'private',
        eaName: connectionRecord.eaName || snapshot.eaName || previous.eaName || '',
        eaVersion: connectionRecord.eaVersion || snapshot.eaVersion || previous.eaVersion || '',
        lastKnownBalance: balance,
        lastKnownEquity: equity,
        floatingPL,
        dailyClosedPL: toNumber(snapshot.dailyClosedPL, previous.dailyClosedPL ?? 0),
        openTradeCount,
        buyTradeCount: toNumber(snapshot.buyTradeCount, previous.buyTradeCount ?? 0),
        sellTradeCount: toNumber(snapshot.sellTradeCount, previous.sellTradeCount ?? 0),
        symbols: Array.isArray(snapshot.symbols) ? snapshot.symbols : previous.symbols || [],
        terminalConnected: snapshot.terminalConnected !== false,
        expertEnabled: snapshot.expertEnabled !== false,
        drawdownPercent,
        lastSyncAt: updatedAt,
        updatedAt,
      };
      result = { user: data.users[connectionRecord.discordUserId], account: data.accounts[accountId] };
      return data;
    });

    return result;
  }

  async setActiveAccount(discordUserId, accountId) {
    const userId = normalizeId(discordUserId);
    const selectedId = normalizeId(accountId);
    let selected = null;
    await this.update((data) => {
      const user = this.ensureUser(data, userId);
      if (!data.accounts[selectedId] || String(data.accounts[selectedId].discordUserId) !== userId) return data;
      user.activeAccountId = selectedId;
      user.defaultAccountId ||= selectedId;
      if (!user.accounts.includes(selectedId)) user.accounts.push(selectedId);
      user.updatedAt = nowIso();
      selected = data.accounts[selectedId];
      return data;
    });
    return selected;
  }

  async resolveActiveAccount(discordUserId) {
    const userId = normalizeId(discordUserId);
    const data = await this.load();
    const user = data.users[userId];
    const activeId = user?.activeAccountId || user?.defaultAccountId || null;
    if (activeId && data.accounts[activeId]) return data.accounts[activeId];

    if (this.repository?.getPrimaryMt4Connection) {
      const connection = await this.repository.getPrimaryMt4Connection(userId);
      if (connection?.accountId) return connection;
    }

    const firstAccountId = user?.accounts?.find((id) => data.accounts[id]);
    return firstAccountId ? data.accounts[firstAccountId] : null;
  }

  async rememberCommand({ discordUserId, accountId = null, command = '', payload = {}, status = 'queued', commandId = null }) {
    const userId = normalizeId(discordUserId);
    const record = {
      id: commandId || `memcmd_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      discordUserId: userId,
      accountId: accountId || null,
      command,
      payload,
      status,
      createdAt: nowIso(),
    };
    await this.update((data) => {
      const user = this.ensureUser(data, userId);
      user.lastCommand = record;
      user.updatedAt = record.createdAt;
      data.commandJournal = [record, ...(data.commandJournal || [])].slice(0, 500);
      return data;
    });
    return record;
  }

  async setTakeoverMode({ discordUserId, accountId = null, enabled = true, equityFloor = null, drawdownLimitPercent = null }) {
    const userId = normalizeId(discordUserId);
    const updatedAt = nowIso();
    let takeover = null;
    await this.update((data) => {
      const user = this.ensureUser(data, userId);
      const selectedAccountId = accountId || user.activeAccountId || user.defaultAccountId || null;
      user.takeoverMode = Boolean(enabled);
      user.takeover = {
        enabled: Boolean(enabled),
        accountId: selectedAccountId,
        equityFloor: toNumber(equityFloor, null),
        drawdownLimitPercent: toNumber(drawdownLimitPercent, null),
        updatedAt,
      };
      user.updatedAt = updatedAt;
      if (selectedAccountId && data.accounts[selectedAccountId]) {
        data.accounts[selectedAccountId].takeoverMode = Boolean(enabled);
        data.accounts[selectedAccountId].takeover = user.takeover;
        data.accounts[selectedAccountId].updatedAt = updatedAt;
      }
      takeover = user.takeover;
      return data;
    });
    return takeover;
  }

  async getCoachSummary(discordUserId) {
    const active = await this.resolveActiveAccount(discordUserId);
    if (!active) {
      return {
        ok: false,
        message: 'No active MT4 account is connected yet. Run /connect, then /my-accounts.',
      };
    }

    const equity = toNumber(active.lastKnownEquity, 0);
    const balance = toNumber(active.lastKnownBalance, 0);
    const floating = toNumber(active.floatingPL, 0);
    const dd = toNumber(active.drawdownPercent, 0);
    const state = !active.terminalConnected ? 'offline'
      : active.expertEnabled === false ? 'expert-disabled'
      : dd >= 20 ? 'danger'
      : dd >= 10 ? 'caution'
      : 'stable';

    return {
      ok: true,
      account: active,
      state,
      summary: [
        `Account: ${active.nickname || active.accountNumber} (${active.brokerServer || 'server'})`,
        `Balance: $${balance.toFixed(2)} | Equity: $${equity.toFixed(2)} | Floating: $${floating.toFixed(2)}`,
        `Open trades: ${active.openTradeCount || 0} | Drawdown: ${dd.toFixed(2)}%`,
        `Bot: ${active.eaName || 'unknown'} ${active.eaVersion || ''}`.trim(),
        `Coach read: ${state === 'stable' ? 'Account is stable. Let the plan work and protect profit.' : state === 'caution' ? 'Caution zone. Watch drawdown and avoid adding unnecessary exposure.' : state === 'danger' ? 'Danger zone. Consider takeover/profit protection rules.' : 'Connection needs attention.'}`,
      ].join('\n'),
    };
  }
}
