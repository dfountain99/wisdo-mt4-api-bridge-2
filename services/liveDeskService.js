import crypto from 'node:crypto';

const VISIBILITY = new Set(['private_devices', 'private_room', 'selected_members', 'members', 'public', 'unlisted']);
const SIGNAL_TYPES = new Set(['viewer-ready', 'offer', 'answer', 'ice', 'bye', 'control']);

function text(value = '', max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeIds(values = []) {
  const source = Array.isArray(values) ? values : String(values || '').split(/[\s,]+/g);
  return [...new Set(source.map((value) => text(value, 96)).filter(Boolean))];
}

function sha256(value = '') {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function safeTelemetry(input = {}) {
  const symbols = Array.isArray(input.symbols) ? input.symbols.slice(0, 12).map((value) => text(value, 24)) : [];
  return {
    accountId: text(input.accountId, 120),
    accountLabel: text(input.accountLabel || input.nickname || input.accountName, 120),
    broker: text(input.broker || input.brokerServer || input.server, 120),
    accountType: text(input.accountType || input.type, 32).toUpperCase(),
    balance: Number.isFinite(Number(input.balance)) ? Number(input.balance) : 0,
    equity: Number.isFinite(Number(input.equity)) ? Number(input.equity) : 0,
    floatingPL: Number.isFinite(Number(input.floatingPL ?? input.profit)) ? Number(input.floatingPL ?? input.profit) : 0,
    dailyClosedPL: Number.isFinite(Number(input.dailyClosedPL)) ? Number(input.dailyClosedPL) : 0,
    openTradeCount: Math.max(0, Number(input.openTradeCount || 0)),
    buyTradeCount: Math.max(0, Number(input.buyTradeCount || 0)),
    sellTradeCount: Math.max(0, Number(input.sellTradeCount || 0)),
    totalLots: Math.max(0, Number(input.totalLots || 0)),
    drawdownPercent: Math.max(0, Number(input.drawdownPercent || 0)),
    marginLevel: Math.max(0, Number(input.marginLevel || 0)),
    symbols,
    logicStatus: text(input.logicStatus || input.botMode || input.marketMode, 160),
    updatedAt: new Date().toISOString(),
  };
}

function publicParticipant(participant = {}) {
  return {
    id: participant.id,
    userId: participant.userId || '',
    displayName: participant.displayName || 'Viewer',
    joinedAt: participant.joinedAt,
    lastSeenAt: participant.lastSeenAt,
    deviceType: participant.deviceType || 'web',
    status: participant.status || 'connected',
  };
}

export class LiveDeskService {
  constructor({ secret = process.env.SESSION_SECRET || '', logger = console, maxViewers = Number(process.env.WISDO_LIVE_DESK_MAX_VIEWERS || 8) } = {}) {
    this.secret = secret || randomToken(32);
    this.logger = logger;
    this.maxViewers = Math.max(1, Math.min(32, Number(maxViewers || 8)));
    this.sessions = new Map();
  }

  cleanup() {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.status !== 'live' || Date.parse(session.expiresAt) <= now) {
        session.status = session.status === 'live' ? 'expired' : session.status;
        session.endedAt ||= new Date().toISOString();
        for (const queue of session.signalQueues.values()) {
          queue.push({ seq: ++session.signalSeq, from: 'system', type: 'bye', payload: { reason: session.status }, createdAt: new Date().toISOString() });
        }
        if (Date.parse(session.endedAt) < now - 60 * 60 * 1000) this.sessions.delete(sessionId);
      }
    }
  }

  createSession({ ownerUserId, ownerDisplayName = 'Culture Coin Trader', title = 'Live Trading Desk', visibility = 'private_devices', accountId = '', expiresMinutes = 240, allowedViewerIds = [], roomCode = '', showAccountOverlay = true, watermarkEnabled = true, recordingAllowed = false, telemetry = {} } = {}) {
    this.cleanup();
    const ownerId = text(ownerUserId, 96);
    if (!ownerId) throw new Error('ownerUserId is required');
    const normalizedVisibility = VISIBILITY.has(String(visibility)) ? String(visibility) : 'private_devices';
    const sessionId = `desk_${randomToken(14)}`;
    const generatedRoomCode = normalizedVisibility === 'private_room' ? (text(roomCode, 64) || String(crypto.randomInt(100000, 999999))) : '';
    const session = {
      id: sessionId,
      ownerUserId: ownerId,
      ownerDisplayName: text(ownerDisplayName, 120) || 'Culture Coin Trader',
      title: text(title, 160) || 'Live Trading Desk',
      visibility: normalizedVisibility,
      accountId: text(accountId, 120),
      showAccountOverlay: Boolean(showAccountOverlay),
      watermarkEnabled: watermarkEnabled !== false,
      recordingAllowed: Boolean(recordingAllowed),
      allowedViewerIds: new Set(normalizeIds(allowedViewerIds)),
      blockedViewerIds: new Set(),
      roomCodeHash: generatedRoomCode ? sha256(generatedRoomCode) : '',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + Math.max(15, Math.min(24 * 60, Number(expiresMinutes || 240))) * 60 * 1000).toISOString(),
      endedAt: null,
      status: 'live',
      telemetry: safeTelemetry({ ...telemetry, accountId: accountId || telemetry.accountId }),
      participants: new Map(),
      signalQueues: new Map([['host', []]]),
      signalSeq: 0,
      chat: [],
      maxViewers: this.maxViewers,
    };
    this.sessions.set(sessionId, session);
    return { session: this.serializeSession(session, { owner: true }), roomCode: generatedRoomCode || null };
  }

  getRaw(sessionId) {
    this.cleanup();
    return this.sessions.get(String(sessionId || '')) || null;
  }

  serializeSession(session, { owner = false, viewerId = '' } = {}) {
    if (!session) return null;
    const participant = viewerId ? session.participants.get(viewerId) : null;
    return {
      id: session.id,
      ownerUserId: owner ? session.ownerUserId : '',
      ownerDisplayName: session.ownerDisplayName,
      title: session.title,
      visibility: session.visibility,
      accountId: owner ? session.accountId : '',
      showAccountOverlay: session.showAccountOverlay,
      watermarkEnabled: session.watermarkEnabled,
      recordingAllowed: session.recordingAllowed,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      endedAt: session.endedAt,
      status: session.status,
      viewerCount: [...session.participants.values()].filter((participant) => participant.status === 'connected').length,
      maxViewers: session.maxViewers,
      telemetry: session.showAccountOverlay ? session.telemetry : null,
      participant: participant ? publicParticipant(participant) : null,
      participants: owner ? [...session.participants.values()].map(publicParticipant) : undefined,
    };
  }

  listForOwner(ownerUserId) {
    this.cleanup();
    const owner = text(ownerUserId, 96);
    return [...this.sessions.values()]
      .filter((session) => session.ownerUserId === owner)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((session) => this.serializeSession(session, { owner: true }));
  }

  discover({ viewerUserId = '', activeMember = false } = {}) {
    this.cleanup();
    const viewer = text(viewerUserId, 96);
    return [...this.sessions.values()]
      .filter((session) => session.status === 'live')
      .filter((session) => session.visibility === 'public' || (session.visibility === 'members' && activeMember) || (session.visibility === 'selected_members' && viewer && session.allowedViewerIds.has(viewer)))
      .map((session) => this.serializeSession(session))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  authorizeView(session, { viewerUserId = '', activeMember = false, roomCode = '' } = {}) {
    if (!session) return { ok: false, status: 404, code: 'session_not_found', error: 'Live Desk session not found.' };
    if (session.status !== 'live') return { ok: false, status: 410, code: 'session_ended', error: 'This Live Desk broadcast has ended.' };
    const viewer = text(viewerUserId, 96);
    if (viewer && session.blockedViewerIds.has(viewer)) return { ok: false, status: 403, code: 'viewer_blocked', error: 'This viewer is blocked from the Live Desk.' };
    if (session.visibility === 'private_devices' && viewer !== session.ownerUserId) return { ok: false, status: viewer ? 403 : 401, code: 'owner_only', error: 'This Live Desk is limited to the owner’s signed-in devices.' };
    if (session.visibility === 'members' && !activeMember && viewer !== session.ownerUserId) return { ok: false, status: viewer ? 403 : 401, code: 'member_required', error: 'Active Culture Coin membership is required for this Live Desk.' };
    if (session.visibility === 'selected_members' && viewer !== session.ownerUserId && !session.allowedViewerIds.has(viewer)) return { ok: false, status: viewer ? 403 : 401, code: 'selected_member_required', error: 'This Live Desk is restricted to selected members.' };
    if (session.visibility === 'private_room' && viewer !== session.ownerUserId && sha256(text(roomCode, 64)) !== session.roomCodeHash) return { ok: false, status: 403, code: 'room_code_required', error: 'A valid Private Room code is required.' };
    return { ok: true };
  }

  joinSession(sessionId, { viewerUserId = '', displayName = 'Viewer', activeMember = false, roomCode = '', deviceType = 'web' } = {}) {
    const session = this.getRaw(sessionId);
    const access = this.authorizeView(session, { viewerUserId, activeMember, roomCode });
    if (!access.ok) return access;
    const activeViewerCount = [...session.participants.values()].filter((participant) => participant.status === 'connected').length;
    if (activeViewerCount >= session.maxViewers && text(viewerUserId, 96) !== session.ownerUserId) {
      return { ok: false, status: 429, code: 'viewer_capacity_reached', error: `This direct WebRTC Live Desk is at its ${session.maxViewers}-viewer capacity.` };
    }
    const id = `viewer_${randomToken(10)}`;
    const token = randomToken(24);
    const participant = {
      id,
      tokenHash: sha256(token),
      userId: text(viewerUserId, 96),
      displayName: text(displayName, 120) || 'Viewer',
      deviceType: text(deviceType, 40) || 'web',
      joinedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: 'connected',
    };
    session.participants.set(id, participant);
    session.signalQueues.set(id, []);
    this.enqueue(session, 'host', { from: id, type: 'viewer-ready', payload: { participant: publicParticipant(participant) } });
    return { ok: true, participant: publicParticipant(participant), token, session: this.serializeSession(session, { viewerId: id }) };
  }

  validateParticipant(session, participantId, token) {
    if (!session) return null;
    if (participantId === 'host') return null;
    const participant = session.participants.get(String(participantId || ''));
    if (!participant || sha256(String(token || '')) !== participant.tokenHash) return null;
    participant.lastSeenAt = new Date().toISOString();
    return participant;
  }

  enqueue(session, recipientId, message = {}) {
    const recipient = String(recipientId || '');
    const queue = session.signalQueues.get(recipient);
    if (!queue) throw new Error('Signal recipient is no longer connected.');
    const record = {
      seq: ++session.signalSeq,
      from: text(message.from, 80),
      type: text(message.type, 40),
      payload: message.payload ?? null,
      createdAt: new Date().toISOString(),
    };
    queue.push(record);
    if (queue.length > 160) queue.splice(0, queue.length - 160);
    return record;
  }

  sendSignal(sessionId, { senderId, recipientId, token = '', ownerUserId = '', type, payload } = {}) {
    const session = this.getRaw(sessionId);
    if (!session || session.status !== 'live') return { ok: false, status: 410, error: 'Live Desk session is not active.' };
    const sender = String(senderId || '');
    const recipient = String(recipientId || '');
    const signalType = String(type || '');
    if (!SIGNAL_TYPES.has(signalType)) return { ok: false, status: 400, error: 'Unsupported Live Desk signal type.' };
    if (!recipient || !session.signalQueues.has(recipient)) return { ok: false, status: 404, error: 'Signal recipient is not connected.' };
    if (sender === 'host') {
      if (text(ownerUserId, 96) !== session.ownerUserId) return { ok: false, status: 403, error: 'Only the broadcast owner may signal as host.' };
    } else if (!this.validateParticipant(session, sender, token)) {
      return { ok: false, status: 403, error: 'Invalid Live Desk participant token.' };
    }
    const payloadSize = Buffer.byteLength(JSON.stringify(payload ?? null));
    if (payloadSize > 160000) return { ok: false, status: 413, error: 'Signal payload is too large.' };
    const record = this.enqueue(session, recipient, { from: sender, type: signalType, payload });
    return { ok: true, signal: record };
  }

  pollSignals(sessionId, { participantId, token = '', ownerUserId = '', after = 0 } = {}) {
    const session = this.getRaw(sessionId);
    if (!session) return { ok: false, status: 404, error: 'Live Desk session not found.' };
    const participant = String(participantId || '');
    if (participant === 'host') {
      if (text(ownerUserId, 96) !== session.ownerUserId) return { ok: false, status: 403, error: 'Only the broadcast owner may poll host signals.' };
    } else if (!this.validateParticipant(session, participant, token)) {
      return { ok: false, status: 403, error: 'Invalid Live Desk participant token.' };
    }
    const queue = session.signalQueues.get(participant) || [];
    const cursor = Number(after || 0);
    const messages = queue.filter((message) => message.seq > cursor).slice(0, 80);
    return { ok: true, status: session.status, messages, cursor: messages.at(-1)?.seq || cursor };
  }

  updateTelemetry(sessionId, ownerUserId, telemetry = {}) {
    const session = this.getRaw(sessionId);
    if (!session) return { ok: false, status: 404, error: 'Live Desk session not found.' };
    if (text(ownerUserId, 96) !== session.ownerUserId) return { ok: false, status: 403, error: 'Only the Live Desk owner may update telemetry.' };
    session.telemetry = safeTelemetry({ ...session.telemetry, ...telemetry, accountId: session.accountId || telemetry.accountId });
    return { ok: true, telemetry: session.telemetry };
  }

  listParticipants(sessionId, ownerUserId) {
    const session = this.getRaw(sessionId);
    if (!session) return { ok: false, status: 404, error: 'Live Desk session not found.' };
    if (text(ownerUserId, 96) !== session.ownerUserId) return { ok: false, status: 403, error: 'Only the Live Desk owner may view participants.' };
    return { ok: true, participants: [...session.participants.values()].filter((participant) => participant.status === 'connected').map(publicParticipant) };
  }

  leaveSession(sessionId, participantId, token = '') {
    const session = this.getRaw(sessionId);
    if (!session) return { ok: false, status: 404, error: 'Live Desk session not found.' };
    const participant = this.validateParticipant(session, participantId, token);
    if (!participant) return { ok: false, status: 403, error: 'Invalid Live Desk participant token.' };
    try { this.enqueue(session, 'host', { from: participant.id, type: 'bye', payload: { reason: 'viewer_left' } }); } catch {}
    participant.status = 'left';
    session.participants.delete(participant.id);
    setTimeout(() => session.signalQueues.delete(participant.id), 5000).unref?.();
    return { ok: true, participant: publicParticipant(participant) };
  }

  removeViewer(sessionId, ownerUserId, participantId, { block = false } = {}) {
    const session = this.getRaw(sessionId);
    if (!session) return { ok: false, status: 404, error: 'Live Desk session not found.' };
    if (text(ownerUserId, 96) !== session.ownerUserId) return { ok: false, status: 403, error: 'Only the Live Desk owner may remove viewers.' };
    const participant = session.participants.get(String(participantId || ''));
    if (!participant) return { ok: false, status: 404, error: 'Viewer not found.' };
    if (block && participant.userId) session.blockedViewerIds.add(participant.userId);
    this.enqueue(session, participant.id, { from: 'host', type: 'bye', payload: { reason: block ? 'blocked' : 'removed' } });
    participant.status = block ? 'blocked' : 'removed';
    setTimeout(() => {
      session.participants.delete(participant.id);
      session.signalQueues.delete(participant.id);
    }, 5000).unref?.();
    return { ok: true, participant: publicParticipant(participant), blocked: Boolean(block) };
  }

  endSession(sessionId, ownerUserId, reason = 'owner_stop') {
    const session = this.getRaw(sessionId);
    if (!session) return { ok: false, status: 404, error: 'Live Desk session not found.' };
    if (text(ownerUserId, 96) !== session.ownerUserId) return { ok: false, status: 403, error: 'Only the Live Desk owner may stop this broadcast.' };
    session.status = 'ended';
    session.endedAt = new Date().toISOString();
    for (const [recipientId] of session.signalQueues.entries()) {
      if (recipientId === 'host') continue;
      try { this.enqueue(session, recipientId, { from: 'host', type: 'bye', payload: { reason: text(reason, 80) || 'owner_stop' } }); } catch {}
    }
    return { ok: true, session: this.serializeSession(session, { owner: true }) };
  }

  endAllForOwner(ownerUserId, reason = 'owner_logout') {
    const owner = text(ownerUserId, 96);
    const ended = [];
    for (const session of this.sessions.values()) {
      if (session.ownerUserId === owner && session.status === 'live') {
        const result = this.endSession(session.id, owner, reason);
        if (result.ok) ended.push(session.id);
      }
    }
    return ended;
  }

  addChat(sessionId, { participantId, token = '', ownerUserId = '', message = '' } = {}) {
    const session = this.getRaw(sessionId);
    if (!session || session.status !== 'live') return { ok: false, status: 410, error: 'Live Desk session is not active.' };
    const senderId = String(participantId || '');
    let displayName = session.ownerDisplayName;
    let userId = session.ownerUserId;
    if (senderId === 'host') {
      if (text(ownerUserId, 96) !== session.ownerUserId) return { ok: false, status: 403, error: 'Only the owner may chat as host.' };
    } else {
      const participant = this.validateParticipant(session, senderId, token);
      if (!participant) return { ok: false, status: 403, error: 'Invalid Live Desk participant token.' };
      displayName = participant.displayName;
      userId = participant.userId;
    }
    const body = text(message, 1000);
    if (!body) return { ok: false, status: 400, error: 'Chat message is required.' };
    const item = { id: `chat_${randomToken(8)}`, senderId, userId, displayName, message: body, createdAt: new Date().toISOString() };
    session.chat.push(item);
    if (session.chat.length > 100) session.chat.splice(0, session.chat.length - 100);
    return { ok: true, item };
  }

  getChat(sessionId, { participantId, token = '', ownerUserId = '', after = '' } = {}) {
    const session = this.getRaw(sessionId);
    if (!session) return { ok: false, status: 404, error: 'Live Desk session not found.' };
    if (participantId === 'host') {
      if (text(ownerUserId, 96) !== session.ownerUserId) return { ok: false, status: 403, error: 'Only the owner may read host chat.' };
    } else if (!this.validateParticipant(session, participantId, token)) {
      return { ok: false, status: 403, error: 'Invalid Live Desk participant token.' };
    }
    const index = after ? session.chat.findIndex((item) => item.id === after) : -1;
    return { ok: true, messages: session.chat.slice(index >= 0 ? index + 1 : Math.max(0, session.chat.length - 40)) };
  }

  iceConfig(subject = 'viewer') {
    const split = (value = '') => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
    const stunUrls = split(process.env.WISDO_WEBRTC_STUN_URLS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302');
    const turnUrls = split(process.env.WISDO_WEBRTC_TURN_URLS || '');
    const turnSecret = String(process.env.WISDO_WEBRTC_TURN_SHARED_SECRET || '');
    const ttl = Math.max(300, Math.min(86400, Number(process.env.WISDO_WEBRTC_TURN_TTL_SECONDS || 3600)));
    const iceServers = [];
    if (stunUrls.length) iceServers.push({ urls: stunUrls });
    if (turnUrls.length && turnSecret) {
      const username = `${Math.floor(Date.now() / 1000) + ttl}:${text(subject, 96) || 'viewer'}`;
      const credential = crypto.createHmac('sha1', turnSecret).update(username).digest('base64');
      iceServers.push({ urls: turnUrls, username, credential });
    }
    return {
      iceServers,
      transport: 'direct-webrtc',
      turnConfigured: Boolean(turnUrls.length && turnSecret),
      viewerCapacity: this.maxViewers,
      note: turnUrls.length && turnSecret
        ? 'TURN relay is configured for restrictive mobile/NAT networks.'
        : 'Direct/STUN WebRTC is enabled. Configure WISDO_WEBRTC_TURN_URLS and WISDO_WEBRTC_TURN_SHARED_SECRET for reliable cross-network mobile viewing.',
    };
  }
}

export const LIVE_DESK_VISIBILITY = [...VISIBILITY];
