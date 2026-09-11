import crypto from 'node:crypto';

const safeText = (value, max = 120) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const clamp = (value, min, max, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};
const nowIso = () => new Date().toISOString();

const HEAD_PRESETS = new Set(['standard', 'soft', 'angular', 'oval', 'round']);
const SKIN_MATERIALS = new Set(['neutral-1', 'neutral-2', 'neutral-3', 'neutral-4', 'neutral-5', 'neutral-6', 'neutral-7', 'neutral-8']);
const HAIR_PRESETS = new Set(['none', 'close', 'fade', 'short-curls', 'medium-curls', 'waves', 'locs-short', 'locs-long', 'braids', 'straight-short', 'straight-long', 'bun']);
const FACIAL_HAIR_PRESETS = new Set(['none', 'stubble', 'mustache', 'goatee', 'short-beard', 'full-beard']);
const BODY_PRESETS = new Set(['slim', 'balanced', 'athletic', 'broad']);
const HEIGHT_SETTINGS = new Set(['short', 'medium', 'tall']);
const OUTFITS = new Set(['cem-operator-black-gold', 'cem-operator-midnight', 'cem-operator-formal']);
const ACCESSORIES = new Set(['glasses-clear', 'glasses-dark', 'watch-black', 'watch-gold', 'earpiece']);
const MORPH_KEYS = new Set(['faceWidth', 'jawWidth', 'cheekVolume', 'eyeSpacing', 'noseWidth', 'noseLength', 'lipFullness', 'browHeight', 'chinLength']);
const FORBIDDEN_RAW_KEYS = /(raw|image|photo|selfie|frame|video|landmark|embedding|descriptor|biometric|faceprint|base64|blob)/i;

function assertNoRawCapture(value, path = 'payload') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_RAW_KEYS.test(key)) throw new Error(`Raw facial capture data is not accepted by the World identity service (${path}.${key}).`);
    if (child && typeof child === 'object') assertNoRawCapture(child, `${path}.${key}`);
  }
}

function choose(set, value, fallback) {
  const normalized = safeText(value, 60).toLowerCase();
  return set.has(normalized) ? normalized : fallback;
}

export function sanitizeAvatarConfiguration(input = {}, { source = 'manual' } = {}) {
  assertNoRawCapture(input);
  const morphParameters = {};
  for (const [key, value] of Object.entries(input.morphParameters || {})) {
    if (!MORPH_KEYS.has(key)) continue;
    morphParameters[key] = Number(clamp(value, -1, 1, 0).toFixed(4));
  }
  const accessories = [...new Set((Array.isArray(input.accessories) ? input.accessories : [])
    .map((value) => safeText(value, 60).toLowerCase())
    .filter((value) => ACCESSORIES.has(value)))].slice(0, 8);
  return {
    avatarVersion: 1,
    source: source === 'scan_derived' ? 'scan_derived' : 'manual',
    topology: 'wisdo-operator-standard-v1',
    skeleton: 'wisdo-humanoid-v1',
    headPreset: choose(HEAD_PRESETS, input.headPreset, 'standard'),
    morphParameters,
    skinMaterial: choose(SKIN_MATERIALS, input.skinMaterial, 'neutral-4'),
    hairPreset: choose(HAIR_PRESETS, input.hairPreset, 'close'),
    facialHairPreset: choose(FACIAL_HAIR_PRESETS, input.facialHairPreset, 'none'),
    bodyPreset: choose(BODY_PRESETS, input.bodyPreset, 'balanced'),
    heightSetting: choose(HEIGHT_SETTINGS, input.heightSetting, 'medium'),
    outfit: choose(OUTFITS, input.outfit, 'cem-operator-black-gold'),
    accessories,
  };
}

function sanitizeQuality(input = {}) {
  return {
    faceDetected: input.faceDetected === true,
    lighting: choose(new Set(['good', 'dim', 'bright', 'unknown']), input.lighting, 'unknown'),
    blur: choose(new Set(['good', 'soft', 'unknown']), input.blur, 'unknown'),
    posesCompleted: Math.max(0, Math.min(5, Number.parseInt(input.posesCompleted, 10) || 0)),
    processor: safeText(input.processor || 'manual-confirmation', 80),
  };
}

function ensureState(raw = {}) {
  raw.worldProfilesByUserId ||= {};
  raw.worldAuditLogsById ||= {};
  return raw;
}

function ensureProfile(state, user = {}) {
  const userId = String(user.id || '');
  if (!state.worldProfilesByUserId[userId]) {
    state.worldProfilesByUserId[userId] = {
      schemaVersion: 1,
      userId,
      callsign: safeText(user.global_name || user.globalName || user.username || 'Operator', 48) || 'Operator',
      title: 'World Explorer',
      avatarStyle: 'vanguard',
      xp: 0,
      visitedDestinations: [],
      achievements: [],
      spawnPreference: 'home',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }
  return state.worldProfilesByUserId[userId];
}

function addAudit(state, userId, action, data = {}) {
  const id = `world_identity_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  state.worldAuditLogsById[id] = { id, userId: String(userId), action, data, createdAt: nowIso() };
  return id;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export class WorldAvatarIdentityService {
  constructor({ repository, eventEngine = null, logger = console, sessionTtlMs = 5 * 60_000, now = () => Date.now() } = {}) {
    if (!repository?.loadState || !repository?.updateState) throw new TypeError('WorldAvatarIdentityService requires a repository.');
    this.repository = repository;
    this.eventEngine = eventEngine;
    this.logger = logger;
    this.sessionTtlMs = Math.max(30_000, Math.min(15 * 60_000, Number(sessionTtlMs) || 5 * 60_000));
    this.now = now;
    this.scanSessions = new Map();
  }

  sweepSessions() {
    const now = this.now();
    for (const [id, session] of this.scanSessions) {
      if (now > session.expiresAtMs + 60_000 || session.status === 'accepted' && now - Number(session.acceptedAtMs || now) > 60_000) this.scanSessions.delete(id);
    }
  }

  async getOperator(user) {
    const state = ensureState(await this.repository.loadState());
    const profile = state.worldProfilesByUserId?.[String(user.id)] || null;
    return {
      ok: true,
      operator: profile?.operatorIdentity || null,
      configured: Boolean(profile?.operatorIdentity),
      privacy: {
        rawCaptureStored: false,
        authenticationUse: false,
        sensitiveAttributeInference: false,
      },
    };
  }

  createScanSession(user, baseUrl) {
    this.sweepSessions();
    const userId = String(user.id || '');
    if (!userId) throw new Error('Authenticated member is required.');
    const sessionId = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('base64url');
    const pairCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    const createdAtMs = this.now();
    const expiresAtMs = createdAtMs + this.sessionTtlMs;
    const session = {
      sessionId,
      ownerUserId: userId,
      purpose: 'world-avatar-scan',
      tokenHash: hashToken(token),
      pairCode,
      createdAtMs,
      expiresAtMs,
      status: 'awaiting_capture',
      usedAtMs: null,
      draftAvatar: null,
      captureQuality: null,
      acceptedAtMs: null,
    };
    this.scanSessions.set(sessionId, session);
    const root = String(baseUrl || '').replace(/\/$/, '');
    return {
      ok: true,
      sessionId,
      token,
      pairCode,
      purpose: session.purpose,
      createdAt: new Date(createdAtMs).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      captureUrl: `${root}/world/avatar-scan#token=${encodeURIComponent(token)}`,
      privacy: {
        tokenSingleUse: true,
        rawCaptureUploaded: false,
        rawCaptureStored: false,
      },
    };
  }

  findByToken(token) {
    const digest = hashToken(token || '');
    for (const session of this.scanSessions.values()) {
      if (session.tokenHash === digest) return session;
    }
    return null;
  }

  assertUsableSession(session) {
    if (!session) {
      const error = new Error('Avatar scan session was not found.');
      error.statusCode = 404;
      throw error;
    }
    if (this.now() > session.expiresAtMs) {
      session.status = 'expired';
      session.tokenHash = null;
      const error = new Error('Avatar scan session expired. Start a new scan from your WISDO Identity Mirror.');
      error.statusCode = 410;
      throw error;
    }
    if (session.usedAtMs || session.status !== 'awaiting_capture') {
      const error = new Error('Avatar scan token has already been used.');
      error.statusCode = 409;
      throw error;
    }
  }

  submitScanDraft(token, body = {}) {
    const session = this.findByToken(token);
    this.assertUsableSession(session);
    // The capture stays on the phone/browser. Only approved derived configuration is accepted here.
    assertNoRawCapture(body);
    const draftAvatar = sanitizeAvatarConfiguration(body.avatar || body, { source: 'scan_derived' });
    session.draftAvatar = draftAvatar;
    session.captureQuality = sanitizeQuality(body.quality || {});
    session.status = 'ready_for_preview';
    session.usedAtMs = this.now();
    session.tokenHash = null;
    return {
      ok: true,
      sessionId: session.sessionId,
      status: session.status,
      pairCode: session.pairCode,
      rawCaptureStored: false,
    };
  }

  getOwnedSession(user, sessionId) {
    this.sweepSessions();
    const session = this.scanSessions.get(String(sessionId || ''));
    if (!session || String(session.ownerUserId) !== String(user.id)) return null;
    return {
      sessionId: session.sessionId,
      purpose: session.purpose,
      pairCode: session.pairCode,
      status: this.now() > session.expiresAtMs && session.status === 'awaiting_capture' ? 'expired' : session.status,
      createdAt: new Date(session.createdAtMs).toISOString(),
      expiresAt: new Date(session.expiresAtMs).toISOString(),
      draftAvatar: session.status === 'ready_for_preview' || session.status === 'accepted' ? session.draftAvatar : null,
      captureQuality: session.status === 'ready_for_preview' || session.status === 'accepted' ? session.captureQuality : null,
      rawCaptureStored: false,
    };
  }

  async persistOperator(user, avatar, { source = 'manual', sessionId = null } = {}) {
    const sanitized = sanitizeAvatarConfiguration(avatar, { source });
    let operatorIdentity = null;
    await this.repository.updateState((raw) => {
      const state = ensureState(raw);
      const profile = ensureProfile(state, user);
      const previousVersion = Number(profile.operatorIdentity?.avatarVersion || 0);
      operatorIdentity = {
        operatorId: profile.operatorIdentity?.operatorId || `operator:${String(user.id)}`,
        ...sanitized,
        avatarVersion: previousVersion + 1,
        approvedAt: nowIso(),
        updatedAt: nowIso(),
      };
      profile.operatorIdentity = operatorIdentity;
      profile.avatarStyle = 'operator';
      profile.updatedAt = nowIso();
      addAudit(state, user.id, 'world.avatar.updated', {
        operatorId: operatorIdentity.operatorId,
        avatarVersion: operatorIdentity.avatarVersion,
        source: operatorIdentity.source,
        scanSessionId: sessionId || null,
      });
      return state;
    });
    this.eventEngine?.publishToUser?.(String(user.id), 'avatar.updated', { operator: operatorIdentity }, `avatar:${user.id}:${operatorIdentity.avatarVersion}`);
    return operatorIdentity;
  }

  async acceptScanSession(user, sessionId, edits = null) {
    const session = this.scanSessions.get(String(sessionId || ''));
    if (!session || String(session.ownerUserId) !== String(user.id)) {
      const error = new Error('Avatar scan session was not found.');
      error.statusCode = 404;
      throw error;
    }
    if (session.status !== 'ready_for_preview' || !session.draftAvatar) {
      const error = new Error('Avatar scan is not ready for approval.');
      error.statusCode = 409;
      throw error;
    }
    const merged = edits && typeof edits === 'object' ? { ...session.draftAvatar, ...edits, morphParameters: { ...session.draftAvatar.morphParameters, ...(edits.morphParameters || {}) } } : session.draftAvatar;
    const operator = await this.persistOperator(user, merged, { source: 'scan_derived', sessionId: session.sessionId });
    session.status = 'accepted';
    session.acceptedAtMs = this.now();
    session.draftAvatar = operator;
    return { ok: true, operator, rawCaptureStored: false };
  }

  async saveManualOperator(user, avatar = {}) {
    const operator = await this.persistOperator(user, avatar, { source: 'manual' });
    return { ok: true, operator, rawCaptureStored: false };
  }
}
