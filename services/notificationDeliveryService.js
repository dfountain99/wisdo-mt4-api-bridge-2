import crypto from 'node:crypto';

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function normalizeEmail(value = '') {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

export function normalizePhone(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) {
    const digits = raw.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : '';
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return '';
}

function htmlEscape(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function ensureDeliveryState(state = {}) {
  state.notificationOutboxById ||= {};
  state.notificationDeliveryLogById ||= {};
  state.notificationPreferencesByUserId ||= {};
  return state;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class NotificationDeliveryService {
  constructor({ loadEcosystemState, saveEcosystemState, logger, publicBaseUrl = '' }) {
    this.loadEcosystemState = loadEcosystemState;
    this.saveEcosystemState = saveEcosystemState;
    this.logger = logger;
    this.publicBaseUrl = String(publicBaseUrl || process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    this.stateChain = Promise.resolve();
    this.retryTimer = null;
  }

  async mutate(updater) {
    const operation = this.stateChain.then(async () => {
      const state = ensureDeliveryState(await this.loadEcosystemState());
      const result = await updater(state);
      await this.saveEcosystemState(state);
      return result;
    });
    this.stateChain = operation.catch(() => undefined);
    return operation;
  }

  providerHealth() {
    return {
      emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      smsConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
      discordDmConfigured: Boolean(process.env.DISCORD_TOKEN),
      resendFrom: process.env.RESEND_FROM_EMAIL || '',
      twilioFromConfigured: Boolean(process.env.TWILIO_FROM_NUMBER),
      leadPortalSecretConfigured: Boolean(process.env.WISDO_LEAD_PORTAL_SECRET || process.env.SESSION_SECRET),
    };
  }

  buildWelcomeEmail({ name, loginUrl }) {
    const safeName = htmlEscape(name || 'there');
    const safeUrl = htmlEscape(loginUrl || `${this.publicBaseUrl}/login` || '/login');
    return {
      subject: 'Welcome to WISDO — your command center is ready',
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827"><h1>Welcome to WISDO, ${safeName}</h1><p>Your account was created successfully.</p><p>Next, connect your trading account, pair the Culture Coin Reporter, and review your copier risk controls before enabling live execution.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#111827;color:#fff;text-decoration:none">Open WISDO</a></p><p style="font-size:12px;color:#6b7280">Trading involves risk. WISDO does not guarantee profits or trading results.</p></div>`,
      text: `Welcome to WISDO, ${name || 'there'}. Your account was created successfully. Open your command center: ${loginUrl || `${this.publicBaseUrl}/login`}`,
    };
  }

  buildLeadEmail({ name, portalUrl, resources = [], unsubscribeUrl = '' }) {
    const safeName = htmlEscape(name || 'there');
    const safeUrl = htmlEscape(portalUrl || `${this.publicBaseUrl}/webinar/replay` || '/webinar/replay');
    const resourceList = resources.slice(0, 4).map((resource) => `<li style="margin:8px 0"><a href="${htmlEscape(resource.trackedUrl || resource.href || safeUrl)}">${htmlEscape(resource.title || 'WISDO resource')}</a> — ${htmlEscape(resource.description || '')}</li>`).join('');
    const unsubscribe = unsubscribeUrl ? `<p style="font-size:11px;color:#6b7280">Training updates are optional. <a href="${htmlEscape(unsubscribeUrl)}">Unsubscribe from educational follow-up</a>.</p>` : '';
    return {
      subject: 'Your WISDO webinar and personal learning room are ready',
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827"><h1>Your learning room is ready, ${safeName}</h1><p>You are registered for the WISDO command-center training.</p><p>Your personal room brings together the webinar, Reporter setup information, copier-safety videos, and the portable WISDO AI learning guide.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#111827;color:#fff;text-decoration:none">Open my WISDO learning room</a></p>${resourceList ? `<h3>Included training</h3><ul>${resourceList}</ul>` : ''}<p style="font-size:12px;color:#6b7280">Trading involves risk. No profit or lead-volume result is guaranteed.</p>${unsubscribe}</div>`,
      text: `Your WISDO webinar and personal learning room are ready: ${portalUrl || `${this.publicBaseUrl}/webinar/replay`}`,
    };
  }

  buildEducationEmail({ name, title, intro, callToAction, url, bullets = [], unsubscribeUrl = '' }) {
    const safeName = htmlEscape(name || 'there');
    const safeUrl = htmlEscape(url || `${this.publicBaseUrl}/education` || '/education');
    const list = bullets.slice(0, 5).map((item) => `<li style="margin:7px 0">${htmlEscape(item)}</li>`).join('');
    const unsubscribe = unsubscribeUrl ? `<p style="font-size:11px;color:#6b7280"><a href="${htmlEscape(unsubscribeUrl)}">Unsubscribe from educational follow-up</a>.</p>` : '';
    return {
      subject: title,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827"><p>Hi ${safeName},</p><h1>${htmlEscape(title)}</h1><p>${htmlEscape(intro)}</p>${list ? `<ul>${list}</ul>` : ''}<p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#111827;color:#fff;text-decoration:none">${htmlEscape(callToAction || 'Open the lesson')}</a></p><p style="font-size:12px;color:#6b7280">Educational information only. Trading involves risk and results are not guaranteed.</p>${unsubscribe}</div>`,
      text: `${title}

${intro}

${callToAction || 'Open the lesson'}: ${url}

Educational information only. Trading involves risk.`,
    };
  }

  async enqueue(events = []) {
    const accepted = [];
    await this.mutate((state) => {
      const existing = new Set(Object.values(state.notificationOutboxById).map((item) => item.dedupeKey).filter(Boolean));
      for (const event of events) {
        if (!event?.channel || !event?.to) continue;
        if (event.dedupeKey && existing.has(event.dedupeKey)) continue;
        const id = makeId('notify');
        const record = {
          id,
          channel: event.channel,
          to: event.to,
          userId: String(event.userId || ''),
          category: event.category || 'transactional',
          template: event.template || 'custom',
          subject: event.subject || '',
          html: event.html || '',
          text: event.text || '',
          dedupeKey: event.dedupeKey || '',
          metadata: event.metadata || {},
          status: 'pending',
          attempts: 0,
          nextAttemptAt: event.sendAt || nowIso(),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        state.notificationOutboxById[id] = record;
        existing.add(record.dedupeKey);
        accepted.push(record);
      }
      const ordered = Object.values(state.notificationOutboxById)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 2000);
      state.notificationOutboxById = Object.fromEntries(ordered.map((item) => [item.id, item]));
      return accepted;
    });
    return accepted;
  }

  async sendEmail(event) {
    const apiKey = process.env.RESEND_API_KEY || '';
    const from = process.env.RESEND_FROM_EMAIL || '';
    if (!apiKey || !from) return { ok: false, retryable: true, providerStatus: 'provider_not_configured', error: 'RESEND_API_KEY and RESEND_FROM_EMAIL are required.' };
    const response = await fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [event.to],
        subject: event.subject,
        html: event.html,
        text: event.text,
        reply_to: process.env.WISDO_EMAIL_REPLY_TO || undefined,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, retryable: response.status >= 429 || response.status >= 500, providerStatus: String(response.status), error: payload?.message || payload?.error || `Resend HTTP ${response.status}` };
    return { ok: true, providerId: payload.id || '', providerStatus: String(response.status) };
  }

  async sendSms(event) {
    const sid = process.env.TWILIO_ACCOUNT_SID || '';
    const token = process.env.TWILIO_AUTH_TOKEN || '';
    const from = process.env.TWILIO_FROM_NUMBER || '';
    if (!sid || !token || !from) return { ok: false, retryable: true, providerStatus: 'provider_not_configured', error: 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER are required.' };
    const body = new URLSearchParams({ To: event.to, From: from, Body: event.text.slice(0, 1500) });
    const response = await fetchWithTimeout(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: 'POST',
      headers: { authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, retryable: response.status >= 429 || response.status >= 500, providerStatus: String(response.status), error: payload?.message || `Twilio HTTP ${response.status}` };
    return { ok: true, providerId: payload.sid || '', providerStatus: payload.status || String(response.status) };
  }

  async sendDiscordDm(event) {
    const token = process.env.DISCORD_TOKEN || '';
    if (!token) return { ok: false, retryable: true, providerStatus: 'provider_not_configured', error: 'DISCORD_TOKEN is required for WISDO coach DMs.' };
    const createChannel = await fetchWithTimeout('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: { authorization: `Bot ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ recipient_id: String(event.to) }),
    });
    const channel = await createChannel.json().catch(() => ({}));
    if (!createChannel.ok || !channel.id) return { ok: false, retryable: createChannel.status === 429 || createChannel.status >= 500, providerStatus: String(createChannel.status), error: channel?.message || `Discord create-DM HTTP ${createChannel.status}` };
    const send = await fetchWithTimeout(`https://discord.com/api/v10/channels/${encodeURIComponent(channel.id)}/messages`, {
      method: 'POST',
      headers: { authorization: `Bot ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ content: String(event.text || event.subject || 'WISDO update').slice(0, 2000), allowed_mentions: { parse: [] } }),
    });
    const payload = await send.json().catch(() => ({}));
    if (!send.ok) return { ok: false, retryable: send.status === 429 || send.status >= 500, providerStatus: String(send.status), error: payload?.message || `Discord message HTTP ${send.status}` };
    return { ok: true, providerId: payload.id || '', providerStatus: String(send.status) };
  }

  async deliverEvent(event) {
    let result;
    try {
      if (event.channel === 'sms') result = await this.sendSms(event);
      else if (event.channel === 'discord_dm') result = await this.sendDiscordDm(event);
      else result = await this.sendEmail(event);
    } catch (error) {
      result = { ok: false, retryable: true, providerStatus: 'exception', error: error?.name === 'AbortError' ? 'Provider request timed out.' : error.message };
    }

    await this.mutate((state) => {
      const current = state.notificationOutboxById[event.id];
      if (!current) return null;
      const attempts = Number(current.attempts || 0) + 1;
      const sent = Boolean(result.ok);
      const retryable = !sent && result.retryable !== false && attempts < 8;
      current.status = sent ? 'sent' : retryable ? 'retrying' : 'failed';
      current.attempts = attempts;
      current.lastError = sent ? '' : String(result.error || 'Delivery failed');
      current.providerId = result.providerId || current.providerId || '';
      current.providerStatus = result.providerStatus || '';
      current.sentAt = sent ? nowIso() : current.sentAt || null;
      current.nextAttemptAt = retryable ? new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000).toISOString() : null;
      current.updatedAt = nowIso();
      const logId = makeId('delivery');
      state.notificationDeliveryLogById[logId] = {
        id: logId,
        notificationId: current.id,
        channel: current.channel,
        to: current.to,
        status: current.status,
        attempt: attempts,
        providerId: current.providerId || '',
        providerStatus: current.providerStatus || '',
        error: current.lastError || '',
        createdAt: nowIso(),
      };
      const logs = Object.values(state.notificationDeliveryLogById)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 2000);
      state.notificationDeliveryLogById = Object.fromEntries(logs.map((item) => [item.id, item]));
      return current;
    });

    if (!result.ok) this.logger?.warn?.('WISDO notification delivery did not complete.', { notificationId: event.id, channel: event.channel, providerStatus: result.providerStatus, error: result.error });
    return result;
  }

  async deliverByIds(ids = []) {
    const state = ensureDeliveryState(await this.loadEcosystemState());
    const events = ids.map((id) => state.notificationOutboxById[id]).filter(Boolean);
    const results = [];
    for (const event of events) results.push(await this.deliverEvent(event));
    return results;
  }

  async deliverDueByIds(ids = []) {
    const state = ensureDeliveryState(await this.loadEcosystemState());
    const now = Date.now();
    const dueIds = ids.filter((id) => {
      const event = state.notificationOutboxById[id];
      return event && (!event.nextAttemptAt || new Date(event.nextAttemptAt).getTime() <= now);
    });
    return this.deliverByIds(dueIds);
  }

  sequenceDelayMs(day = 1) {
    const acceleratedMinutes = Number(process.env.WISDO_FUNNEL_SEQUENCE_STEP_MINUTES || 0);
    if (acceleratedMinutes > 0) return Math.max(1, day) * acceleratedMinutes * 60_000;
    return Math.max(1, day) * 24 * 60 * 60_000;
  }

  async queueSignupWelcome({ user, phone = '', smsConsent = false, source = 'signup' }) {
    const email = normalizeEmail(user?.email);
    const normalizedPhone = normalizePhone(phone || user?.phone);
    const loginUrl = `${this.publicBaseUrl}/login`;
    const template = this.buildWelcomeEmail({ name: user?.username || user?.name, loginUrl });
    const events = [];
    if (email) events.push({ channel: 'email', to: email, userId: user?.id, template: 'signup_welcome', subject: template.subject, html: template.html, text: template.text, dedupeKey: `signup-welcome-email:${user?.id || email}`, metadata: { source } });
    if (smsConsent && normalizedPhone) events.push({ channel: 'sms', to: normalizedPhone, userId: user?.id, template: 'signup_welcome_sms', text: `Welcome to WISDO. Your account is ready: ${loginUrl}. Reply STOP to opt out.`, dedupeKey: `signup-welcome-sms:${user?.id || normalizedPhone}`, metadata: { source, consent: true } });
    const queued = await this.enqueue(events);
    await this.deliverDueByIds(queued.map((item) => item.id));
    return queued;
  }

  async queueLeadEducationSequence({ lead, portalUrl, resources = [], unsubscribeUrl = '' }) {
    const email = normalizeEmail(lead?.email);
    if (!email || !lead?.marketingConsent) return [];
    const resource = (id, fallback = portalUrl) => resources.find((item) => item.id === id)?.trackedUrl || fallback;
    const lessons = [
      {
        day: 1,
        template: 'lead_reporter_setup',
        title: 'Lesson 1: Connect the Reporter without duplicate syncs',
        intro: 'Start with a clean account connection before you enable any copying.',
        callToAction: 'Watch the Reporter setup lesson',
        url: resource('reporter-setup-video'),
        bullets: ['Use one Reporter instance per MT4 account.', 'Confirm pairing, terminal connection, and Expert status.', 'Keep command polling responsive while snapshots remain controlled.'],
      },
      {
        day: 3,
        template: 'lead_copier_safety',
        title: 'Lesson 2: Understand Culture Lane risk and close authority',
        intro: 'Learn how lead trades map to receiver trades and how the follower confirms a close.',
        callToAction: 'Open the copier-safety lesson',
        url: resource('copier-safety-video'),
        bullets: ['Compare fixed lot, multiplier, and equity-ratio sizing.', 'Verify symbol mapping and follower permissions.', 'Use demo accounts before enabling live execution.'],
      },
      {
        day: 5,
        template: 'lead_ai_webinar',
        title: 'Lesson 3: Use your portable WISDO AI learning guide',
        intro: 'Your AI guide carries the same lead context across the webinar, videos, information pages, and education room.',
        callToAction: 'Ask WISDO AI a question',
        url: resource('ai-learning-room', portalUrl),
        bullets: ['Ask for a personalized setup checklist.', 'Build a beginner-to-operator study plan.', 'Get page-aware explanations without allowing the AI to execute trades.'],
      },
      {
        day: 7,
        template: 'lead_next_steps',
        title: 'Your WISDO next-step checklist',
        intro: 'Review the complete training room, choose your access level, and create an account only when you understand the controls.',
        callToAction: 'Open my personal learning room',
        url: portalUrl,
        bullets: ['Finish the command webinar.', 'Review Reporter versus Copier access.', 'Compare free and membership options.', 'Connect only a demo account for your first test.'],
      },
    ];
    const events = lessons.map((lesson) => {
      const template = this.buildEducationEmail({ name: lead?.name, ...lesson, unsubscribeUrl });
      return {
        channel: 'email',
        to: email,
        userId: lead?.signupUserId || lead?.userId || '',
        category: 'marketing_education',
        template: lesson.template,
        subject: template.subject,
        html: template.html,
        text: template.text,
        sendAt: new Date(Date.now() + this.sequenceDelayMs(lesson.day)).toISOString(),
        dedupeKey: `${lesson.template}:${lead?.id || email}`,
        metadata: { leadId: lead?.id, campaign: lead?.campaign || '', sequenceDay: lesson.day, consent: true },
      };
    });
    return this.enqueue(events);
  }

  async queueLeadConfirmation({ lead, smsConsent = false, marketingConsent = false, portalUrl = '', resources = [], unsubscribeUrl = '' }) {
    const email = normalizeEmail(lead?.email);
    const phone = normalizePhone(lead?.phone);
    const destination = portalUrl || `${this.publicBaseUrl}/webinar/replay`;
    const template = this.buildLeadEmail({ name: lead?.name, portalUrl: destination, resources, unsubscribeUrl });
    const events = [];
    if (email) events.push({ channel: 'email', to: email, userId: lead?.signupUserId || lead?.userId || '', template: 'lead_confirmation', subject: template.subject, html: template.html, text: template.text, dedupeKey: `lead-confirmation-email:${lead?.id || email}`, metadata: { leadId: lead?.id, campaign: lead?.campaign || '', portalUrl: destination } });
    if (smsConsent && phone) events.push({ channel: 'sms', to: phone, userId: lead?.signupUserId || lead?.userId || '', template: 'lead_confirmation_sms', text: `Your WISDO training room is ready: ${destination}. Reply STOP to opt out.`, dedupeKey: `lead-confirmation-sms:${lead?.id || phone}`, metadata: { leadId: lead?.id, campaign: lead?.campaign || '', consent: true } });
    const queued = await this.enqueue(events);
    await this.deliverDueByIds(queued.map((item) => item.id));
    const sequence = marketingConsent || lead?.marketingConsent
      ? await this.queueLeadEducationSequence({ lead: { ...lead, marketingConsent: true }, portalUrl: destination, resources, unsubscribeUrl })
      : [];
    return [...queued, ...sequence];
  }

  async cancelLeadMarketing({ leadId = '', email = '' } = {}) {
    const normalizedEmail = normalizeEmail(email);
    return this.mutate((state) => {
      let cancelled = 0;
      for (const event of Object.values(state.notificationOutboxById)) {
        if (!['pending', 'retrying'].includes(event.status)) continue;
        if (event.category !== 'marketing_education') continue;
        const sameLead = leadId && String(event.metadata?.leadId || '') === String(leadId);
        const sameEmail = normalizedEmail && event.to === normalizedEmail;
        if (!sameLead && !sameEmail) continue;
        event.status = 'cancelled';
        event.nextAttemptAt = null;
        event.updatedAt = nowIso();
        event.lastError = 'Cancelled after lead unsubscribe.';
        cancelled += 1;
      }
      return cancelled;
    });
  }

  async retryPending(limit = 25) {
    const state = ensureDeliveryState(await this.loadEcosystemState());
    const now = Date.now();
    const ids = Object.values(state.notificationOutboxById)
      .filter((event) => ['pending', 'retrying'].includes(event.status))
      .filter((event) => !event.nextAttemptAt || new Date(event.nextAttemptAt).getTime() <= now)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(0, limit)
      .map((event) => event.id);
    return this.deliverByIds(ids);
  }

  startRetryLoop(intervalMs = 5 * 60_000) {
    if (this.retryTimer) return;
    let running = false;
    this.retryTimer = setInterval(async () => {
      if (running) return;
      running = true;
      try { await this.retryPending(); }
      catch (error) { this.logger?.warn?.('Notification retry loop failed.', { message: error.message }); }
      finally { running = false; }
    }, intervalMs);
    this.retryTimer.unref?.();
  }

  stopRetryLoop() {
    if (!this.retryTimer) return;
    clearInterval(this.retryTimer);
    this.retryTimer = null;
  }
}

export default NotificationDeliveryService;
