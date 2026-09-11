import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { WorldCampaignStateService } from './worldCampaignStateService.js';

const clean = (value, max = 160) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const nowIso = () => new Date().toISOString();
const hash = (value) => createHash('sha256').update(String(value)).digest('hex');

const COMMAND_DEFINITIONS = Object.freeze({
  CLOSE_POSITION: { command: 'CLOSE_BY_TICKET', level: 3, scope: 'POSITION', label: 'Close Position', requires: ['position'] },
  CLOSE_CAMPAIGN: { command: 'CLOSE_BY_MAGIC', level: 3, scope: 'CAMPAIGN', label: 'Close Campaign', requires: ['campaignMagic'] },
  CLOSE_ALL: { command: 'CLOSE_ALL_TRADES', level: 3, scope: 'ACCOUNT', label: 'Close All', requires: [] },
  CLOSE_PROFIT: { command: 'CLOSE_ALL_PROFITS', level: 3, scope: 'ACCOUNT', label: 'Close Profit', requires: [] },
  PAUSE_BOT: { command: 'PAUSE_BOT', level: 2, scope: 'ACCOUNT', label: 'Pause Bot', requires: [] },
  RESUME_BOT: { command: 'RESUME_BOT', level: 2, scope: 'ACCOUNT', label: 'Resume Bot', requires: [] },
  STOP_NEW_ENTRIES: { command: 'STOP_ENTRIES', level: 2, scope: 'ACCOUNT', label: 'Stop New Entries', requires: [] },
  RESUME_NEW_ENTRIES: { command: 'START_ENTRIES', level: 2, scope: 'ACCOUNT', label: 'Resume New Entries', requires: [] },
  EMERGENCY_STOP: { command: 'EMERGENCY_STOP', level: 3, scope: 'ACCOUNT', label: 'Emergency Stop', requires: [] },
});

const NOT_CONNECTED = Object.freeze({
  CLOSE_BUYS: 'No canonical direction-scoped close command is exposed by the current Reporter contract.',
  CLOSE_SELLS: 'No canonical direction-scoped close command is exposed by the current Reporter contract.',
  TRAIL_TIGHTER: 'No canonical trailing-distance parameter contract has been verified yet.',
  TRAIL_LOOSER: 'No canonical trailing-distance parameter contract has been verified yet.',
  BREAK_EVEN: 'No canonical break-even parameter/offset contract has been verified yet.',
  LOCK_PROFIT: 'The low-level command exists, but a safe spatial proposal contract is not yet verified.',
  STOP_ADDS: 'Current backend exposes STOP_ENTRIES, not a separately verified add-engine-only command.',
  RESUME_ADDS: 'Current backend exposes START_ENTRIES, not a separately verified add-engine-only command.',
});

function canControlAccount(account = {}, userId = '') {
  if (!account) return false;
  if (!account.shared) return String(account.ownerUserId || userId) === String(userId);
  return ['control_allowed', 'admin'].includes(String(account.sharePermission || '').toLowerCase());
}

function safeReceipt(record = {}) {
  return {
    commandId: record.id || null,
    clientCommandId: record.payload?.clientCommandId || record.payload?.commandId || null,
    accountId: record.accountId || null,
    command: record.command || null,
    status: record.status || 'pending',
    requestedAt: record.createdAt || null,
    deliveredAt: record.deliveredAt || null,
    completedAt: record.completedAt || null,
    failedAt: record.failedAt || null,
    expiredAt: record.expiredAt || null,
    result: record.result ? {
      success: record.result.success !== false,
      message: clean(record.result.message || record.result.resultMessage || '', 280) || null,
      positionsRequested: Number.isFinite(Number(record.result.positionsRequested)) ? Number(record.result.positionsRequested) : null,
      positionsClosed: Number.isFinite(Number(record.result.positionsClosed)) ? Number(record.result.positionsClosed) : null,
      remainingOpen: Number.isFinite(Number(record.result.remainingOpen)) ? Number(record.result.remainingOpen) : null,
    } : null,
    error: clean(record.errorMessage || '', 280) || null,
  };
}

export class WorldCommandCenterService {
  constructor({ mt4SyncService = null, mt4CommandService = null, eventEngine = null, logger = console } = {}) {
    if (!mt4SyncService?.repository) throw new TypeError('WorldCommandCenterService requires MT4 sync/repository access.');
    if (!mt4CommandService?.queueCommandForAccount) throw new TypeError('WorldCommandCenterService requires the MT4 command service.');
    this.mt4SyncService = mt4SyncService;
    this.mt4CommandService = mt4CommandService;
    this.eventEngine = eventEngine;
    this.logger = logger;
    this.campaignState = new WorldCampaignStateService({ mt4SyncService });
    this.proposals = new Map();
    this.proposalTtlMs = Math.max(10_000, Math.min(120_000, Number(process.env.WISDO_WORLD_COMMAND_PROPOSAL_TTL_MS || 45_000)));
  }

  capabilitiesFor(snapshot = {}, userId = '') {
    const account = snapshot.account;
    const controlAllowed = canControlAccount(account, userId);
    const linkReady = Boolean(snapshot.executionHealth?.commandLinkReady);
    const connected = {};
    for (const [key, definition] of Object.entries(COMMAND_DEFINITIONS)) {
      let available = controlAllowed && linkReady;
      let reason = available ? '' : !controlAllowed ? 'This account is not authorized for control.' : 'Reporter command link is not live.';
      if (key === 'CLOSE_POSITION' && !snapshot.campaigns.some((campaign) => campaign.positions?.length)) {
        available = false; reason = 'No open positions.';
      }
      if (key === 'CLOSE_CAMPAIGN' && !snapshot.campaigns.some((campaign) => campaign.canTargetByMagic)) {
        available = false; reason = 'No active campaign has one verified magic number for safe targeting.';
      }
      connected[key] = { key, label: definition.label, command: definition.command, safetyLevel: definition.level, scope: definition.scope, available, reason, connected: true };
    }
    for (const [key, reason] of Object.entries(NOT_CONNECTED)) connected[key] = { key, label: key.replaceAll('_', ' '), available: false, connected: false, reason, safetyLevel: key.includes('CLOSE') || key === 'LOCK_PROFIT' ? 3 : 2 };
    return connected;
  }

  async state(userId, { accountId = '' } = {}) {
    const snapshot = await this.campaignState.snapshot(String(userId), { accountId });
    return {
      ...snapshot,
      capabilities: this.capabilitiesFor(snapshot, userId),
      executionFromWorldEnabled: true,
      safetyModel: {
        level1: 'information',
        level2: 'live-setting-confirmation',
        level3: 'destructive-hold-confirmation',
      },
    };
  }

  cleanupProposals() {
    const now = Date.now();
    for (const [id, proposal] of this.proposals) if (proposal.expiresAtMs <= now || proposal.usedAt) this.proposals.delete(id);
  }

  affectedFor(snapshot, action, body = {}) {
    const campaignId = clean(body.campaignId, 180);
    const ticket = clean(body.positionId || body.ticket, 100);
    const symbol = clean(body.symbol, 32).toUpperCase();
    const campaign = campaignId ? snapshot.campaigns.find((item) => item.campaignId === campaignId) || null : null;
    const allPositions = snapshot.campaigns.flatMap((item) => item.positions || []);
    const position = ticket ? allPositions.find((item) => String(item.ticket) === ticket) || null : null;
    if (action === 'CLOSE_POSITION') return { campaign, position, count: position ? 1 : 0 };
    if (action === 'CLOSE_CAMPAIGN') return { campaign, position: null, count: campaign?.positions?.length || 0 };
    if (symbol) {
      const matching = allPositions.filter((item) => item.symbol === symbol);
      return { campaign, position, count: matching.length };
    }
    return { campaign, position, count: allPositions.length };
  }

  async propose(userId, body = {}) {
    this.cleanupProposals();
    const action = clean(body.action, 64).toUpperCase();
    const definition = COMMAND_DEFINITIONS[action];
    if (!definition) {
      const reason = NOT_CONNECTED[action] || 'Unknown World Command action.';
      const error = new Error(reason); error.statusCode = NOT_CONNECTED[action] ? 409 : 400; error.code = NOT_CONNECTED[action] ? 'not_connected' : 'unknown_action'; throw error;
    }
    const snapshot = await this.state(userId, { accountId: clean(body.accountId, 160) });
    const capability = snapshot.capabilities[action];
    if (!capability?.available) {
      const error = new Error(capability?.reason || 'Command is unavailable.'); error.statusCode = 409; error.code = 'command_unavailable'; throw error;
    }
    const affected = this.affectedFor(snapshot, action, body);
    if (action === 'CLOSE_POSITION' && !affected.position) { const error = new Error('The selected position is no longer open.'); error.statusCode = 409; throw error; }
    if (action === 'CLOSE_CAMPAIGN' && (!affected.campaign || !affected.campaign.canTargetByMagic || affected.campaign.magicNumber == null)) { const error = new Error('This campaign cannot be safely targeted by the current Reporter command contract.'); error.statusCode = 409; throw error; }

    const proposalId = `world-proposal:${randomUUID()}`;
    const token = randomBytes(24).toString('base64url');
    const createdAt = nowIso();
    const expiresAtMs = Date.now() + this.proposalTtlMs;
    const clientCommandId = clean(body.clientCommandId, 120) || `world-${randomUUID()}`;
    const proposal = {
      proposalId,
      tokenHash: hash(token),
      userId: String(userId),
      accountId: snapshot.account.accountId,
      action,
      definition,
      campaignId: affected.campaign?.campaignId || null,
      positionId: affected.position?.ticket || null,
      symbol: affected.campaign?.symbol || affected.position?.symbol || clean(body.symbol, 32).toUpperCase() || null,
      magicNumber: affected.campaign?.magicNumber ?? null,
      affectedCount: affected.count,
      createdAt,
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
      clientCommandId,
      holdRequiredMs: definition.level >= 3 ? 1800 : 700,
      usedAt: null,
      snapshotGeneratedAt: snapshot.generatedAt,
      accountState: {
        openPositions: snapshot.campaigns.reduce((sum, row) => sum + Number(row.positionCount || 0), 0),
        floatingPL: snapshot.financial?.floatingPL ?? null,
        currency: snapshot.financial?.currency || 'USD',
      },
    };
    this.proposals.set(proposalId, proposal);
    return {
      proposalId,
      confirmationToken: token,
      clientCommandId,
      action,
      label: definition.label,
      safetyLevel: definition.level,
      scope: definition.scope,
      account: snapshot.account,
      campaign: affected.campaign ? {
        campaignId: affected.campaign.campaignId,
        symbol: affected.campaign.symbol,
        direction: affected.campaign.direction,
        strategyName: affected.campaign.strategyName,
        positionCount: affected.campaign.positionCount,
        averageEntry: affected.campaign.averageEntry,
        currentPrice: affected.campaign.currentPrice,
        stopLoss: affected.campaign.stopLoss,
        takeProfit: affected.campaign.takeProfit,
      } : null,
      position: affected.position || null,
      affectedCount: affected.count,
      holdRequiredMs: proposal.holdRequiredMs,
      expiresAt: proposal.expiresAt,
      currentFloatingPL: proposal.accountState.floatingPL,
      currency: proposal.accountState.currency,
      executionNotice: 'Nothing has been sent to MT4 yet. This is a proposal only.',
    };
  }

  payloadFor(proposal, currentSnapshot) {
    const base = {
      source: 'wisdo_world_command_center',
      immediate: true,
      priority: proposal.definition.level >= 3 ? 200 : 150,
      ttlMinutes: 2,
      confirmation: 'confirmed',
      commandId: proposal.clientCommandId,
      clientCommandId: proposal.clientCommandId,
      worldProposalId: proposal.proposalId,
      scope: proposal.definition.scope,
      symbol: proposal.symbol || undefined,
      campaignId: proposal.campaignId || undefined,
    };
    if (proposal.action === 'CLOSE_POSITION') base.ticket = proposal.positionId;
    if (proposal.action === 'CLOSE_CAMPAIGN') base.magicNumber = proposal.magicNumber;
    if (['PAUSE_BOT', 'RESUME_BOT', 'STOP_NEW_ENTRIES', 'RESUME_NEW_ENTRIES'].includes(proposal.action)) {
      const campaign = currentSnapshot.campaigns.find((item) => item.campaignId === proposal.campaignId) || currentSnapshot.campaigns.find((item) => item.symbol === proposal.symbol) || currentSnapshot.campaigns[0];
      if (campaign?.magicNumber != null) base.magicNumber = campaign.magicNumber;
      if (campaign?.strategyName) base.botName = campaign.strategyName;
    }
    return base;
  }

  async execute(userId, body = {}) {
    this.cleanupProposals();
    const proposalId = clean(body.proposalId, 200);
    const proposal = this.proposals.get(proposalId);
    if (!proposal || String(proposal.userId) !== String(userId)) { const error = new Error('Command proposal expired or not found.'); error.statusCode = 409; error.code = 'proposal_expired'; throw error; }
    if (proposal.usedAt) { const existing = await this.findReceipt(userId, proposal.clientCommandId, proposal.accountId); if (existing) return existing; const error = new Error('Command proposal has already been used.'); error.statusCode = 409; throw error; }
    if (proposal.expiresAtMs <= Date.now()) { this.proposals.delete(proposalId); const error = new Error('Command proposal expired. Review current live state and arm again.'); error.statusCode = 409; throw error; }
    if (hash(clean(body.confirmationToken, 200)) !== proposal.tokenHash) { const error = new Error('Invalid confirmation token.'); error.statusCode = 403; throw error; }
    if (Number(body.heldForMs || 0) < proposal.holdRequiredMs) { const error = new Error(`Hold confirmation for at least ${proposal.holdRequiredMs}ms.`); error.statusCode = 409; error.code = 'hold_required'; throw error; }

    const current = await this.state(userId, { accountId: proposal.accountId });
    const capability = current.capabilities[proposal.action];
    if (!capability?.available) { const error = new Error(capability?.reason || 'Command link is no longer ready.'); error.statusCode = 409; error.code = 'revalidation_failed'; throw error; }
    const currentAffected = this.affectedFor(current, proposal.action, { campaignId: proposal.campaignId, positionId: proposal.positionId, symbol: proposal.symbol });
    if (proposal.action === 'CLOSE_POSITION' && !currentAffected.position) { const error = new Error('Position already closed or changed before confirmation. Refresh Command Core.'); error.statusCode = 409; throw error; }
    if (proposal.action === 'CLOSE_CAMPAIGN' && (!currentAffected.campaign || currentAffected.campaign.magicNumber == null || String(currentAffected.campaign.magicNumber) !== String(proposal.magicNumber))) { const error = new Error('Campaign targeting changed before confirmation. Review the live campaign again.'); error.statusCode = 409; throw error; }

    const payload = this.payloadFor(proposal, current);
    const record = await this.mt4CommandService.queueCommandForAccount(String(userId), proposal.accountId, proposal.definition.command, payload);
    proposal.usedAt = nowIso();
    if (this.eventEngine?.publish) {
      this.eventEngine.publish('command.requested', { userId: String(userId) }, {
        eventId: `world-command:${record.id}`,
        detail: { commandId: record.id, action: proposal.action, accountId: proposal.accountId, campaignId: proposal.campaignId, status: record.status },
      });
    }
    return safeReceipt(record);
  }

  async loadRecords() {
    const state = await this.mt4CommandService.load({ cloneResult: true, includeIndexes: false });
    return Array.isArray(state.commandQueue) ? state.commandQueue : [];
  }

  async findReceipt(userId, clientCommandId, accountId = '') {
    const records = await this.loadRecords();
    const row = records.find((record) => String(record.userId) === String(userId)
      && (!accountId || String(record.accountId || '') === String(accountId))
      && (String(record.payload?.clientCommandId || record.payload?.commandId || '') === String(clientCommandId) || String(record.id || '') === String(clientCommandId)));
    return row ? safeReceipt(row) : null;
  }

  async receipts(userId, { accountId = '', limit = 40 } = {}) {
    const records = await this.loadRecords();
    return records
      .filter((record) => String(record.userId) === String(userId) && (!accountId || String(record.accountId || '') === String(accountId)))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, Math.max(1, Math.min(100, Number(limit) || 40)))
      .map(safeReceipt);
  }

  async receiptById(userId, commandId) {
    const records = await this.loadRecords();
    const row = records.find((record) => String(record.userId) === String(userId) && String(record.id || '') === String(commandId));
    return row ? safeReceipt(row) : null;
  }
}

export { COMMAND_DEFINITIONS as WORLD_COMMAND_DEFINITIONS, NOT_CONNECTED as WORLD_COMMAND_NOT_CONNECTED };
