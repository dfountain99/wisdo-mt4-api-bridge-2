import crypto from 'node:crypto';

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function clean(value = '', max = 250) {
  return String(value || '').trim().slice(0, max);
}

function normalizeEmail(value = '') {
  const email = clean(value, 320).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function normalizePhoneDigits(value = '') {
  return String(value || '').replace(/\D/g, '').slice(0, 15);
}

function ensureFunnelState(state = {}) {
  state.funnelCampaignsById ||= {};
  state.funnelVisitsById ||= {};
  state.funnelLeadsById ||= {};
  state.funnelEvents ||= [];
  state.leads ||= [];
  return state;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysInMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function parseBase64UrlJson(value) {
  return JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'));
}

function safeEqual(a = '', b = '') {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function portalSecret() {
  return String(
    process.env.WISDO_LEAD_PORTAL_SECRET
      || process.env.SESSION_SECRET
      || process.env.DISCORD_COMMAND_API_SECRET
      || 'wisdo-development-lead-portal-secret-change-me',
  );
}

export const LEAD_RESOURCE_CATALOG = Object.freeze([
  {
    id: 'command-webinar',
    type: 'webinar',
    title: 'WISDO Command Center Webinar',
    description: 'Reporter setup, Culture Lane permissions, account targeting, close authority, and live-operation safety.',
    href: '/webinar/replay',
    duration: '18 min',
  },
  {
    id: 'reporter-setup-video',
    type: 'video',
    title: 'Reporter Connection Walkthrough',
    description: 'A visual introduction to pairing an account, reading Reporter health, and avoiding duplicate Reporter instances.',
    href: '/media/14250431_1920_1080_30fps.mp4',
    duration: 'Video lesson',
  },
  {
    id: 'copier-safety-video',
    type: 'video',
    title: 'Copier Safety and Close Authority',
    description: 'Understand lead versus receiver roles, fixed-lot versus equity-ratio sizing, and how follower closes are confirmed.',
    href: '/media/14683743_3840_2160_30fps.mp4',
    duration: 'Video lesson',
  },
  {
    id: 'ai-learning-room',
    type: 'ai',
    title: 'Portable WISDO AI Learning Guide',
    description: 'Ask page-aware questions, build a study plan, and carry the same learning context between funnel pages.',
    href: '/education',
    duration: 'Interactive',
  },
  {
    id: 'membership-options',
    type: 'guide',
    title: 'Reporter and Membership Access Guide',
    description: 'Compare free Reporter access, Culture Coin membership, and the controls that remain locked until activation.',
    href: '/pricing',
    duration: '4 min read',
  },
]);

export function createLeadAccessToken(lead = {}, ttlDays = Number(process.env.WISDO_LEAD_PORTAL_TTL_DAYS || 30)) {
  if (!lead?.id) return '';
  const payload = {
    v: 1,
    leadId: String(lead.id),
    email: normalizeEmail(lead.email),
    exp: Date.now() + Math.max(1, Number(ttlDays || 30)) * 24 * 60 * 60 * 1000,
  };
  const encoded = base64UrlJson(payload);
  const signature = crypto.createHmac('sha256', portalSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyLeadAccessToken(token = '') {
  try {
    const [encoded, signature] = String(token || '').split('.');
    if (!encoded || !signature) return null;
    const expected = crypto.createHmac('sha256', portalSecret()).update(encoded).digest('base64url');
    if (!safeEqual(signature, expected)) return null;
    const payload = parseBase64UrlJson(encoded);
    if (!payload?.leadId || Number(payload.exp || 0) <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export class GrowthFunnelService {
  constructor({ loadEcosystemState, saveEcosystemState, logger }) {
    this.loadEcosystemState = loadEcosystemState;
    this.saveEcosystemState = saveEcosystemState;
    this.logger = logger;
  }

  async mutate(updater) {
    const state = ensureFunnelState(await this.loadEcosystemState());
    const result = await updater(state);
    await this.saveEcosystemState(state);
    return result;
  }

  monthlyTarget() {
    return Math.max(1, Number(process.env.FUNNEL_MONTHLY_LEAD_TARGET || 1000));
  }

  resourceCatalog() {
    return LEAD_RESOURCE_CATALOG.map((item) => ({ ...item }));
  }

  createAccessBundle(lead = {}, publicBaseUrl = '') {
    const token = createLeadAccessToken(lead);
    const base = String(publicBaseUrl || process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    const portalPath = `/learn/${encodeURIComponent(token)}`;
    const resources = this.resourceCatalog().map((resource) => ({
      ...resource,
      trackedUrl: `${base}/r/lead/${encodeURIComponent(token)}/${encodeURIComponent(resource.id)}`,
    }));
    return {
      token,
      portalPath,
      portalUrl: `${base}${portalPath}`,
      unsubscribeUrl: `${base}/funnel/unsubscribe?token=${encodeURIComponent(token)}`,
      resources,
    };
  }

  async getLeadByToken(token = '') {
    const payload = verifyLeadAccessToken(token);
    if (!payload) return null;
    const state = ensureFunnelState(await this.loadEcosystemState());
    const lead = state.funnelLeadsById[payload.leadId];
    if (!lead) return null;
    if (payload.email && lead.email && payload.email !== lead.email) return null;
    return { lead, payload };
  }

  async recordVisit(input = {}) {
    return this.mutate((state) => {
      const id = makeId('visit');
      const visit = {
        id,
        sessionId: clean(input.sessionId || id, 120),
        path: clean(input.path || input.landingUrl || '/', 500),
        referrer: clean(input.referrer, 500),
        source: clean(input.source || input.utmSource || 'direct', 100).toLowerCase(),
        medium: clean(input.medium || input.utmMedium || '', 100).toLowerCase(),
        campaign: clean(input.campaign || input.utmCampaign || 'wisdo-growth', 160).toLowerCase(),
        content: clean(input.content || input.utmContent || '', 160),
        term: clean(input.term || input.utmTerm || '', 160),
        referralCode: clean(input.referralCode || input.ref || '', 120),
        userAgent: clean(input.userAgent || '', 300),
        createdAt: nowIso(),
      };
      state.funnelVisitsById[id] = visit;
      state.funnelEvents.unshift({ id: makeId('funnel_event'), type: 'visit', visitId: id, campaign: visit.campaign, source: visit.source, createdAt: visit.createdAt });
      state.funnelEvents = state.funnelEvents.slice(0, 5000);
      const visits = Object.values(state.funnelVisitsById).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10000);
      state.funnelVisitsById = Object.fromEntries(visits.map((item) => [item.id, item]));
      return visit;
    });
  }

  async recordLead(input = {}) {
    const email = normalizeEmail(input.email);
    const phoneDigits = normalizePhoneDigits(input.phone);
    if (!email && phoneDigits.length < 8) throw new Error('A valid email or phone number is required.');
    return this.mutate((state) => {
      const campaign = clean(input.campaign || input.utmCampaign || 'wisdo-growth', 160).toLowerCase();
      const existing = Object.values(state.funnelLeadsById).find((lead) =>
        String(lead.campaign) === campaign && ((email && lead.email === email) || (phoneDigits && lead.phoneDigits === phoneDigits))
      );
      const id = existing?.id || makeId('lead');
      const createdAt = existing?.createdAt || nowIso();
      const lead = {
        ...(existing || {}),
        id,
        name: clean(input.name || existing?.name, 160),
        email: email || existing?.email || '',
        phone: clean(input.phone || existing?.phone, 40),
        phoneDigits: phoneDigits || existing?.phoneDigits || '',
        platform: clean(input.platform || existing?.platform || '', 80),
        stage: clean(input.stage || existing?.stage || 'new', 50).toLowerCase(),
        source: clean(input.source || input.utmSource || existing?.source || 'website', 100).toLowerCase(),
        medium: clean(input.medium || input.utmMedium || existing?.medium || '', 100).toLowerCase(),
        campaign,
        content: clean(input.content || input.utmContent || existing?.content || '', 160),
        term: clean(input.term || input.utmTerm || existing?.term || '', 160),
        referralCode: clean(input.referralCode || input.ref || existing?.referralCode || '', 120),
        landingPath: clean(input.landingPath || input.path || existing?.landingPath || '', 500),
        emailConsent: input.emailConsent == null ? existing?.emailConsent !== false : input.emailConsent !== false,
        smsConsent: input.smsConsent == null ? Boolean(existing?.smsConsent) : Boolean(input.smsConsent),
        marketingConsent: input.marketingConsent == null ? Boolean(existing?.marketingConsent) : Boolean(input.marketingConsent),
        signupUserId: clean(input.signupUserId || existing?.signupUserId || '', 160),
        createdAt,
        updatedAt: nowIso(),
        duplicateSubmissions: Number(existing?.duplicateSubmissions || 0) + (existing ? 1 : 0),
        engagementCount: Number(existing?.engagementCount || 0),
      };
      state.funnelLeadsById[id] = lead;
      if (!existing) {
        state.leads.push({ id, name: lead.name, email: lead.email, phone: lead.phone, platform: lead.platform, source: lead.source, campaign: lead.campaign, smsConsent: lead.smsConsent, marketingConsent: lead.marketingConsent, createdAt });
      } else {
        const index = state.leads.findIndex((item) => item.id === id);
        if (index >= 0) state.leads[index] = { ...state.leads[index], ...lead };
      }
      state.leads = state.leads.slice(-5000);
      state.funnelEvents.unshift({ id: makeId('funnel_event'), type: existing ? 'lead_repeat' : 'lead_created', leadId: id, campaign: lead.campaign, source: lead.source, createdAt: nowIso() });
      state.funnelEvents = state.funnelEvents.slice(0, 5000);
      return { lead, created: !existing };
    });
  }

  async recordEngagement({ token = '', leadId = '', type = 'resource_click', resourceId = '', metadata = {} } = {}) {
    const tokenPayload = token ? verifyLeadAccessToken(token) : null;
    const resolvedLeadId = tokenPayload?.leadId || clean(leadId, 160);
    if (!resolvedLeadId) throw new Error('Lead access is required.');
    return this.mutate((state) => {
      const lead = state.funnelLeadsById[resolvedLeadId];
      if (!lead) throw new Error('Lead not found.');
      const event = {
        id: makeId('funnel_event'),
        type: clean(type, 80).toLowerCase() || 'resource_click',
        leadId: lead.id,
        resourceId: clean(resourceId, 160),
        campaign: lead.campaign,
        source: lead.source,
        metadata: metadata && typeof metadata === 'object' ? structuredClone(metadata) : {},
        createdAt: nowIso(),
      };
      state.funnelEvents.unshift(event);
      state.funnelEvents = state.funnelEvents.slice(0, 5000);
      lead.lastEngagedAt = event.createdAt;
      lead.lastEngagementType = event.type;
      lead.lastResourceId = event.resourceId;
      lead.engagementCount = Number(lead.engagementCount || 0) + 1;
      if (!['signed_up', 'customer'].includes(lead.stage)) lead.stage = 'engaged';
      lead.updatedAt = event.createdAt;
      return { event, lead };
    });
  }

  async unsubscribeLead(token = '') {
    const payload = verifyLeadAccessToken(token);
    if (!payload) throw new Error('This unsubscribe link is invalid or expired.');
    return this.mutate((state) => {
      const lead = state.funnelLeadsById[payload.leadId];
      if (!lead) throw new Error('Lead not found.');
      lead.marketingConsent = false;
      lead.unsubscribedAt = nowIso();
      lead.updatedAt = lead.unsubscribedAt;
      state.funnelEvents.unshift({ id: makeId('funnel_event'), type: 'email_unsubscribe', leadId: lead.id, campaign: lead.campaign, source: lead.source, createdAt: lead.unsubscribedAt });
      state.funnelEvents = state.funnelEvents.slice(0, 5000);
      return lead;
    });
  }

  async linkSignup({ email, phone, userId }) {
    const normalizedEmail = normalizeEmail(email);
    const phoneDigits = normalizePhoneDigits(phone);
    if (!normalizedEmail && !phoneDigits) return null;
    return this.mutate((state) => {
      const matches = Object.values(state.funnelLeadsById)
        .filter((lead) => (normalizedEmail && lead.email === normalizedEmail) || (phoneDigits && lead.phoneDigits === phoneDigits))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const lead = matches[0];
      if (!lead) return null;
      lead.signupUserId = String(userId || '');
      lead.stage = 'signed_up';
      lead.signedUpAt = nowIso();
      lead.updatedAt = nowIso();
      state.funnelEvents.unshift({ id: makeId('funnel_event'), type: 'signup', leadId: lead.id, userId: lead.signupUserId, campaign: lead.campaign, source: lead.source, createdAt: lead.signedUpAt });
      state.funnelEvents = state.funnelEvents.slice(0, 5000);
      return lead;
    });
  }

  async dashboard(date = new Date()) {
    const state = ensureFunnelState(await this.loadEcosystemState());
    const monthStart = startOfMonth(date).getTime();
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
    const visits = Object.values(state.funnelVisitsById).filter((item) => {
      const time = new Date(item.createdAt).getTime();
      return time >= monthStart && time < monthEnd;
    });
    const leads = Object.values(state.funnelLeadsById).filter((item) => {
      const time = new Date(item.createdAt).getTime();
      return time >= monthStart && time < monthEnd;
    });
    const events = (state.funnelEvents || []).filter((item) => {
      const time = new Date(item.createdAt).getTime();
      return time >= monthStart && time < monthEnd;
    });
    const target = this.monthlyTarget();
    const day = Math.max(1, date.getDate());
    const totalDays = daysInMonth(date);
    const elapsedRatio = day / totalDays;
    const paceTarget = Math.ceil(target * elapsedRatio);
    const projected = Math.round((leads.length / day) * totalDays);
    const conversionRate = visits.length ? (leads.length / visits.length) * 100 : 0;
    const configuredConversion = Math.max(0.1, Number(process.env.FUNNEL_TARGET_CONVERSION_RATE || 20));
    const requiredVisitors = Math.ceil(target / (configuredConversion / 100));
    const dailyLeadTarget = Math.ceil(target / totalDays);
    const dailyVisitorTarget = Math.ceil(requiredVisitors / totalDays);
    const bySource = {};
    const byStage = {};
    const engagementByType = {};
    for (const lead of leads) {
      bySource[lead.source || 'unknown'] = (bySource[lead.source || 'unknown'] || 0) + 1;
      byStage[lead.stage || 'new'] = (byStage[lead.stage || 'new'] || 0) + 1;
    }
    for (const event of events) engagementByType[event.type || 'unknown'] = (engagementByType[event.type || 'unknown'] || 0) + 1;
    return {
      target,
      leads: leads.length,
      visits: visits.length,
      conversionRate,
      configuredConversion,
      paceTarget,
      onPace: leads.length >= paceTarget,
      projected,
      gap: Math.max(0, target - leads.length),
      requiredVisitors,
      dailyLeadTarget,
      dailyVisitorTarget,
      daysElapsed: day,
      daysInMonth: totalDays,
      month: date.toISOString().slice(0, 7),
      bySource,
      byStage,
      engagementByType,
      engagedLeads: leads.filter((lead) => Number(lead.engagementCount || 0) > 0).length,
      signedUpLeads: leads.filter((lead) => lead.stage === 'signed_up').length,
      marketingOptIns: leads.filter((lead) => lead.marketingConsent).length,
      recentLeads: leads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 25),
    };
  }
}

export default GrowthFunnelService;
