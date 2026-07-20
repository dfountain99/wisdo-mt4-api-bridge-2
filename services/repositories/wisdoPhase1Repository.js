import { createHash, randomUUID } from 'node:crypto';

import { createPersistenceAdapter } from '../persistenceAdapter.js';

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

const CULTURE_LANE_DURABLE_SECTIONS = [
  'cultureLanesById',
  'symbolPoliciesByLaneId',
  'harvestPoliciesByLaneId',
  'brokerSymbolInventoriesByAccountId',
];

function cultureLaneConfigurationSnapshot(state = {}) {
  const laneRules = Object.fromEntries(Object.entries(state.copierRules || {})
    .filter(([, rule]) => String(rule?.culture_lane_id || rule?.cultureLaneId || '').trim()));
  return {
    ...Object.fromEntries(CULTURE_LANE_DURABLE_SECTIONS.map((key) => [key, state[key] || {}])),
    laneCopierRulesById: laneRules,
  };
}

function cultureLaneConfigurationDigest(state = {}) {
  return createHash('sha256')
    .update(JSON.stringify(cultureLaneConfigurationSnapshot(state)))
    .digest('hex');
}

export function createWisdoPhase1State() {
  return {
    usersById: {},
    ordersById: {},
    licensesByUserId: {},
    videosByUserId: {},
    referralCodesByUserId: {},
    referralLinksById: {},
    referralVisits: [],
    conversions: [],
    commissionRulesById: {},
    commissionLedgerById: {},
    payoutsById: {},
    subscriptionsById: {},
    paymentPlansById: {},
    vpsAssignmentsById: {},
    paidLinkAccessById: {},
    paidLinkAccessByUserId: {},
    wisdoDesksByUserId: {},
    deskPreferencesByUserId: {},
    botVersionsBySlug: {},
    botFilesById: {},
    botAccessByUserId: {},
    botPresetsById: {},
    botEducationModulesByBotSlug: {},
    lessonsById: {},
    lessonProgressByUserId: {},
    quizzesById: {},
    simulationScenariosById: {},
    copyRequestsById: {},
    copyRelationshipsById: {},
    copyRiskProfilesByUserId: {},
    copyTradeLogsById: {},
    socialPostsById: {},
    commentsById: {},
    likesByUserId: {},
    followsByUserId: {},
    notificationsByUserId: {},
    themePreferencesByUserId: {},
    adminAuditLogsById: {},
    roleSyncByUserId: {},
    roleOverridesByUserId: {},
    signalGridChannelsById: {},
    signalSourcesById: {},
    signalGridCellsById: {},
    signalBasketsById: {},
    signalGridInteractionLogsById: {},
    copyBotSubscriptionsById: {},
    signalGridSettings: {},
    affiliatesById: {},
    affiliateReferralsById: {},
    affiliateCommissionsById: {},
    affiliatePayoutsById: {},
    affiliateCampaignsById: {},
    affiliateSettings: {},
    creatorPayoutsById: {},
    paymentsById: {},
    serverAnnouncementsById: {},
    featureFlagsById: {},
    notificationOutboxById: {},
    notificationDeliveryLogById: {},
    notificationPreferencesByUserId: {},
    funnelCampaignsById: {},
    funnelVisitsById: {},
    funnelLeadsById: {},
    funnelEvents: [],
    leads: [],
    tradingAccounts: {},
    copierRules: {},
    accountControlSettingsById: {},
    deletedTradingAccounts: {},
    compoundCloseTrackersById: {},
    compoundTrackerGoalsByScope: {},
    cultureLanesById: {},
    brokerSymbolInventoriesByAccountId: {},
    symbolPoliciesByLaneId: {},
    harvestPoliciesByLaneId: {},
    harvestCyclesById: {},
    tradePassportsById: {},
    laneTimelineEventsById: {},
    laneGenomesById: {},
    laneDnaSnapshotsById: {},
    cultureIntelligenceReportsById: {},
    brokerApiConnectionsById: {},
    brokerApiOAuthStatesById: {},
    brokerApiSyncEventsById: {},
    wisdoCoachMessagesById: {},
    wisdoCoachThreadsById: {},
    wisdoSharedLearningMemoryById: {},
    wisdoCoachPreferencesByUserId: {},
    wisdoAiWorkQueueById: {},
    accountTelemetry: {},
    trades: {},
    alerts: {},
  };
}

export function ensureWisdoPhase1State(state = {}) {
  const next = { ...createWisdoPhase1State(), ...(state || {}) };
  for (const [key, fallback] of Object.entries(createWisdoPhase1State())) {
    if (Array.isArray(fallback)) {
      if (!Array.isArray(next[key])) next[key] = [];
    } else if (!next[key] || typeof next[key] !== 'object' || Array.isArray(next[key])) {
      next[key] = {};
    }
  }
  return next;
}

export class WisdoPhase1Repository {
  constructor(config = {}) {
    this.config = config;
    this.adapter = createPersistenceAdapter(config, {
      fileName: 'ecosystem',
      namespace: 'wisdo_phase_1',
      defaultState: createWisdoPhase1State,
    });
    this.lastKnownGood = null;
    this.lastDurableLaneDigest = null;
  }

  async loadState() {
    try {
      const state = ensureWisdoPhase1State(await this.adapter.load({ cloneResult: false }));
      // Keep one last-known-good reference instead of cloning the entire ecosystem into
      // a second long-lived heap. The adapter already returns an isolated state object.
      this.lastKnownGood = state;
      this.lastDurableLaneDigest = cultureLaneConfigurationDigest(state);
      return state;
    } catch (error) {
      if (this.lastKnownGood) return this.lastKnownGood;
      throw error;
    }
  }

  async saveState(state, { durable = false } = {}) {
    const snapshot = ensureWisdoPhase1State(state);
    const laneDigest = cultureLaneConfigurationDigest(snapshot);
    const laneConfigurationChanged = this.lastDurableLaneDigest !== null && laneDigest !== this.lastDurableLaneDigest;
    const saved = await this.adapter.save(snapshot, { cloneInput: false, cloneResult: false });
    if ((durable || laneConfigurationChanged) && typeof this.adapter.flushNow === 'function') {
      await this.adapter.flushNow({ cloneResult: false });
      this.lastDurableLaneDigest = laneDigest;
    } else if (this.lastDurableLaneDigest === null) {
      this.lastDurableLaneDigest = laneDigest;
    }
    this.lastKnownGood = snapshot;
    return saved;
  }

  async flushState() {
    const flushed = typeof this.adapter.flushNow === 'function' ? await this.adapter.flushNow({ cloneResult: false }) : null;
    if (this.lastKnownGood) this.lastDurableLaneDigest = cultureLaneConfigurationDigest(this.lastKnownGood);
    return flushed;
  }

  async updateState(updater, { durable = false } = {}) {
    if (typeof this.adapter.atomicUpdate === 'function') {
      const beforeDigest = this.lastDurableLaneDigest;
      const saved = await this.adapter.atomicUpdate(updater, { normalize: ensureWisdoPhase1State, cloneResult: false });
      const laneDigest = cultureLaneConfigurationDigest(saved);
      if ((durable || (beforeDigest !== null && laneDigest !== beforeDigest)) && typeof this.adapter.flushNow === 'function') {
        await this.adapter.flushNow({ cloneResult: false });
        this.lastDurableLaneDigest = laneDigest;
      }
      this.lastKnownGood = saved;
      return saved;
    }
    const state = await this.loadState();
    const next = ensureWisdoPhase1State((await updater(state)) || state);
    return this.saveState(next, { durable });
  }

  async getDesk(userId) {
    const state = await this.loadState();
    return state.wisdoDesksByUserId[String(userId)] || null;
  }

  async saveDesk(userId, desk = {}) {
    const key = String(userId || desk.userId || 'website-buyer');
    let saved;
    await this.updateState((state) => {
      state.wisdoDesksByUserId[key] = {
        ...(state.wisdoDesksByUserId[key] || {}),
        ...desk,
        userId: key,
        updatedAt: nowIso(),
        createdAt: state.wisdoDesksByUserId[key]?.createdAt || desk.createdAt || nowIso(),
      };
      saved = state.wisdoDesksByUserId[key];
      return state;
    });
    return saved;
  }

  async setSelectedAccount(userId, accountId) {
    const key = String(userId || 'website-buyer');
    let preference;
    await this.updateState((state) => {
      state.deskPreferencesByUserId[key] = {
        ...(state.deskPreferencesByUserId[key] || {}),
        selectedAccountId: String(accountId || ''),
        updatedAt: nowIso(),
      };
      state.wisdoDesksByUserId[key] = {
        ...(state.wisdoDesksByUserId[key] || {}),
        userId: key,
        selectedAccountId: String(accountId || ''),
        updatedAt: nowIso(),
        createdAt: state.wisdoDesksByUserId[key]?.createdAt || nowIso(),
      };
      preference = state.deskPreferencesByUserId[key];
      this.addAuditToState(state, {
        adminId: key,
        action: 'account_selection.changed',
        targetType: 'UserDesk',
        targetId: key,
        data: { selectedAccountId: accountId },
      });
      return state;
    });
    return preference;
  }

  async saveThemePreference(userId, preference = {}) {
    const key = String(userId || 'website-buyer');
    let saved;
    await this.updateState((state) => {
      saved = {
        userId: key,
        theme: preference.theme || 'neon',
        accent: preference.accent || preference.accentColor || '',
        accentColor: preference.accentColor || preference.accent || '',
        settings: preference.settings || preference.settingsJson || {},
        updatedAt: nowIso(),
      };
      state.themePreferencesByUserId[key] = saved;
      this.addAuditToState(state, {
        adminId: key,
        action: 'theme.changed',
        targetType: 'ThemePreference',
        targetId: key,
        data: saved,
      });
      return state;
    });
    return saved;
  }

  async addNotification(userId, notification = {}) {
    const key = String(userId || 'website-buyer');
    let saved;
    await this.updateState((state) => {
      state.notificationsByUserId[key] ||= [];
      saved = {
        notificationId: notification.notificationId || notification.id || makeId('note'),
        userId: key,
        type: notification.type || 'system',
        title: notification.title || 'Wisdo notification',
        message: notification.message || '',
        status: notification.status || 'unread',
        severity: notification.severity || 'info',
        data: notification.data || notification.dataJson || {},
        readAt: notification.readAt || null,
        createdAt: notification.createdAt || nowIso(),
        ...notification,
      };
      state.notificationsByUserId[key].unshift(saved);
      state.notificationsByUserId[key] = state.notificationsByUserId[key].slice(0, 100);
      return state;
    });
    return saved;
  }

  async saveLessonProgress(userId, progress = {}) {
    const key = String(userId || 'website-buyer');
    const progressId = String(progress.progressId || progress.id || progress.lessonId || makeId('lesson'));
    let saved;
    await this.updateState((state) => {
      state.lessonProgressByUserId[key] ||= {};
      saved = {
        id: progressId,
        userId: key,
        lessonId: String(progress.lessonId || progressId),
        moduleId: String(progress.moduleId || ''),
        botId: String(progress.botId || progress.botSlug || ''),
        status: progress.status || 'in_progress',
        progress: Number(progress.progress || 0),
        score: progress.score === undefined ? null : Number(progress.score),
        completedAt: progress.completedAt || null,
        updatedAt: nowIso(),
      };
      state.lessonProgressByUserId[key][progressId] = saved;
      this.addAuditToState(state, {
        adminId: key,
        action: 'education_progress.updated',
        targetType: 'LessonProgress',
        targetId: progressId,
        data: saved,
      });
      return state;
    });
    return saved;
  }

  async addAuditLog({ adminId = 'system', action, targetType = '', targetId = '', data = {} } = {}) {
    let saved;
    await this.updateState((state) => {
      saved = this.addAuditToState(state, { adminId, action, targetType, targetId, data });
      return state;
    });
    return saved;
  }

  addAuditToState(state, { adminId = 'system', action, targetType = '', targetId = '', data = {} } = {}) {
    state.adminAuditLogsById ||= {};
    const auditLogId = makeId('audit');
    const log = {
      auditLogId,
      id: auditLogId,
      adminId: String(adminId || 'system'),
      actorUserId: String(adminId || 'system'),
      action: String(action || 'unknown'),
      targetType: String(targetType || ''),
      targetId: String(targetId || ''),
      dataJson: data,
      metadata: data,
      createdAt: nowIso(),
    };
    state.adminAuditLogsById[auditLogId] = log;
    return log;
  }

  async seedDevelopmentData() {
    if (String(process.env.WISDO_SEED_DEV_DATA || '').toLowerCase() !== 'true') {
      return { skipped: true, reason: 'WISDO_SEED_DEV_DATA is not true' };
    }

    const userId = 'dev-wisdo-user';
    await this.updateState((state) => {
      state.wisdoDesksByUserId[userId] ||= {
        deskId: 'dev_wisdo_desk',
        userId,
        name: 'Development Wisdo Desk',
        selectedAccountId: 'dev-demo-1001',
        seedData: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.deskPreferencesByUserId[userId] ||= { selectedAccountId: 'dev-demo-1001', updatedAt: nowIso(), seedData: true };
      state.botVersionsBySlug['wisdo-dev-bot'] ||= [{
        versionId: 'dev_bot_version_1',
        botSlug: 'wisdo-dev-bot',
        version: '0.1.0-dev',
        status: 'development_seed',
        releaseNotes: 'Development-only seed bot. No production performance claim.',
        seedData: true,
        createdAt: nowIso(),
      }];
      state.botEducationModulesByBotSlug['wisdo-dev-bot'] ||= [{
        moduleId: 'dev_module_1',
        botSlug: 'wisdo-dev-bot',
        title: 'Development Risk Controls',
        type: 'text',
        required: true,
        lessons: ['dev_lesson_1'],
        seedData: true,
        createdAt: nowIso(),
      }];
      state.copyRequestsById.dev_copy_request ||= {
        requestId: 'dev_copy_request',
        requesterUserId: userId,
        providerUserId: 'dev-provider',
        status: 'pending_approval',
        riskProfile: { mode: 'fixed_lot', fixedLot: 0.01, maxLot: 0.05 },
        seedData: true,
        createdAt: nowIso(),
      };
      state.notificationsByUserId[userId] ||= [{
        notificationId: 'dev_notification_1',
        userId,
        type: 'development_seed',
        title: 'Development data loaded',
        message: 'This is local seed data only.',
        status: 'unread',
        seedData: true,
        createdAt: nowIso(),
      }];
      this.addAuditToState(state, {
        adminId: 'system',
        action: 'development_seed.loaded',
        targetType: 'WisdoPhase1',
        targetId: userId,
        data: { seedData: true },
      });
      return state;
    });

    return { skipped: false, userId };
  }
}

export function createWisdoPhase1Repository(config = {}) {
  return new WisdoPhase1Repository(config);
}
