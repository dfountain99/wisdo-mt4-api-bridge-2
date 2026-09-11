import { worldEventBus } from './world-event-bus.js';

const activeSignals = new Map();
const seenRealtimeEvents = new Set();
let clockOffsetMs = 0;
let eventSource = null;
let ticker = null;
let repairTimer = null;
let connectionState = 'connecting';

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function syncClock(serverTimestamp) {
  const server = Date.parse(serverTimestamp || '');
  if (!Number.isFinite(server)) return;
  const measured = server - Date.now();
  clockOffsetMs = Math.abs(clockOffsetMs) < 1 ? measured : (clockOffsetMs * .7) + (measured * .3);
}

function serverNow() {
  return Date.now() + clockOffsetMs;
}

function remainingSeconds(signal) {
  const expires = Date.parse(signal?.expiresAt || '');
  if (!Number.isFinite(expires)) return 0;
  return Math.max(0, Math.ceil((expires - serverNow()) / 1000));
}

function formatRemaining(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function hud() {
  let el = document.getElementById('worldSignalHud');
  if (el) return el;
  el = document.createElement('aside');
  el.id = 'worldSignalHud';
  el.className = 'living-signal-hud';
  el.hidden = true;
  document.body.appendChild(el);
  return el;
}

function newestActive() {
  return [...activeSignals.values()]
    .filter((signal) => signal.presentationStatus === 'active' && signal.tradeStatus === 'active' && remainingSeconds(signal) > 0)
    .sort((a, b) => Date.parse(b.tradeTimestamp || 0) - Date.parse(a.tradeTimestamp || 0));
}

function renderHud() {
  const el = hud();
  const rows = newestActive();
  if (!rows.length && connectionState !== 'degraded') {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.classList.toggle('signal-stale', connectionState === 'degraded');
  if (!rows.length) {
    el.innerHTML = '<div class="signal-connection-warning">SIGNAL DATA CONNECTION LOST · RECONNECTING</div>';
    return;
  }
  const signal = rows[0];
  const age = Math.max(0, Math.floor((serverNow() - Date.parse(signal.tradeTimestamp || signal.serverTimestamp || Date.now())) / 1000));
  el.innerHTML = `<button type="button" aria-label="Inspect active ${esc(signal.symbol)} ${esc(signal.direction)} WISDO signal">
    <span class="signal-direction ${String(signal.direction).toLowerCase()}" aria-hidden="true"></span>
    <span class="signal-copy"><small>WISDO SIGNAL · BOT ACTION</small><strong>${esc(signal.botName)} · ${esc(signal.symbol)} ${esc(signal.direction)}</strong><em>${rows.length > 1 ? `${rows.length} active signals · ` : ''}${age}s since confirmed bot entry</em></span>
    <span class="signal-countdown">${formatRemaining(remainingSeconds(signal))}</span>
  </button>${connectionState === 'degraded' ? '<div class="signal-connection-warning">SIGNAL DATA CONNECTION LOST · RECONNECTING</div>' : ''}`;
  el.querySelector('button')?.addEventListener('click', () => openSignalDetails(signal.eventId));
}

function setConnection(state, detail = {}) {
  connectionState = state;
  renderHud();
  worldEventBus.emit('world.connection', { state, source: 'signal-event-stream', ...detail });
}

function rememberRealtimeEvent(id) {
  if (!id) return true;
  if (seenRealtimeEvents.has(id)) return false;
  seenRealtimeEvents.add(id);
  while (seenRealtimeEvents.size > 1000) seenRealtimeEvents.delete(seenRealtimeEvents.values().next().value);
  return true;
}

function applySignal(type, envelope) {
  syncClock(envelope.serverTimestamp);
  if (!rememberRealtimeEvent(envelope.eventId)) return;
  const signal = envelope.detail || {};
  if (!signal.eventId) return;
  if (type === 'bot.signal.expired' || signal.presentationStatus === 'expired' || signal.presentationStatus === 'closed' || signal.tradeStatus === 'closed') {
    activeSignals.delete(signal.eventId);
  } else {
    activeSignals.set(signal.eventId, signal);
  }
  worldEventBus.emit(type, signal, { eventId: envelope.eventId, serverTimestamp: envelope.serverTimestamp });
  renderHud();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function repairActiveSignals() {
  try {
    const payload = await fetchJson('/api/world/signals/active');
    syncClock(payload.serverTimestamp);
    const nextIds = new Set();
    for (const signal of payload.events || []) {
      if (!signal?.eventId || remainingSeconds(signal) <= 0) continue;
      activeSignals.set(signal.eventId, signal);
      nextIds.add(signal.eventId);
    }
    for (const id of [...activeSignals.keys()]) if (!nextIds.has(id)) activeSignals.delete(id);
    if (connectionState === 'degraded') setConnection('live', { repaired: true });
    renderHud();
  } catch (error) {
    if (error.status !== 401) setConnection('degraded', { error: error.message });
  }
}

function parseSse(event) {
  try { return JSON.parse(event.data || '{}'); }
  catch { return null; }
}

function connectStream() {
  if (!('EventSource' in window)) {
    setConnection('degraded', { reason: 'sse-unavailable' });
    return;
  }
  eventSource?.close?.();
  eventSource = new EventSource('/api/world/events');
  const signalTypes = ['bot.signal.created', 'bot.signal.updated', 'bot.signal.expired'];
  for (const type of signalTypes) {
    eventSource.addEventListener(type, (event) => {
      const envelope = parseSse(event);
      if (envelope) applySignal(type, envelope);
    });
  }
  eventSource.addEventListener('avatar.updated', (event) => {
    const envelope = parseSse(event);
    if (!envelope || !rememberRealtimeEvent(envelope.eventId)) return;
    syncClock(envelope.serverTimestamp);
    worldEventBus.emit('avatar.updated', envelope.detail, { eventId: envelope.eventId, serverTimestamp: envelope.serverTimestamp });
  });
  eventSource.addEventListener('world.events.ready', (event) => {
    const envelope = parseSse(event);
    if (envelope) syncClock(envelope.serverTimestamp);
    setConnection('live', { transport: 'sse' });
  });
  eventSource.addEventListener('world.events.heartbeat', (event) => {
    const envelope = parseSse(event);
    if (envelope) syncClock(envelope.serverTimestamp);
    if (connectionState !== 'live') setConnection('live', { transport: 'sse' });
  });
  eventSource.onerror = () => setConnection('degraded', { error: 'Signal data connection lost. EventSource is reconnecting.' });
}

function modalElements() {
  return { modal: document.getElementById('modal'), body: document.getElementById('modalBody') };
}

async function openSignalDetails(eventId) {
  const { modal, body } = modalElements();
  if (!modal || !body) return;
  modal.hidden = false;
  body.innerHTML = '<span class="modal-kicker">WISDO SIGNAL</span><h2 id="modalTitle">Loading verified signal…</h2>';
  try {
    const [signalResponse, worldState] = await Promise.all([
      fetchJson(`/api/world/signals/${encodeURIComponent(eventId)}`),
      fetchJson('/api/world/state').catch(() => null),
    ]);
    syncClock(signalResponse.serverTimestamp);
    const signal = signalResponse.event;
    const positions = worldState?.worldData?.positions || [];
    const matching = positions.find((position) => String(position.symbol || '').toUpperCase() === String(signal.symbol || '').toUpperCase() && String(position.direction || '').toUpperCase() === String(signal.direction || '').toUpperCase());
    const age = Math.max(0, Math.floor((serverNow() - Date.parse(signal.tradeTimestamp)) / 1000));
    body.innerHTML = `
      <span class="modal-kicker">WISDO SIGNAL · VERIFIED BACKEND EVENT</span>
      <h2 id="modalTitle">${esc(signal.botName)} · ${esc(signal.symbol)} ${esc(signal.direction)}</h2>
      <p>The countdown is an informational decision-review window. It never executes a trade and does not imply profit.</p>
      <div class="signal-detail-grid">
        <div><span>BOT ENTRY</span><strong>${signal.entryPrice ?? '—'}</strong></div>
        <div><span>AGE</span><strong>${age}s</strong></div>
        <div><span>WINDOW</span><strong>${formatRemaining(remainingSeconds(signal))}</strong></div>
        <div><span>TYPE</span><strong>${esc(signal.signalType || 'PRIMARY_ENTRY')}</strong></div>
        <div><span>SL</span><strong>${signal.stopLoss ?? 'AUTHORIZED VIEW ONLY'}</strong></div>
        <div><span>TP</span><strong>${signal.takeProfit ?? 'AUTHORIZED VIEW ONLY'}</strong></div>
      </div>
      <div class="bot-account-compare">
        <section><h3>BOT ACTION</h3><strong>${esc(signal.botName)}</strong><p>${esc(signal.symbol)} ${esc(signal.direction)} @ ${signal.entryPrice ?? '—'}</p><small>Confirmed trade event: ${esc(signal.tradeTimestamp)}</small></section>
        <section><h3>YOUR SELECTED ACCOUNT</h3>${matching ? `<strong>${esc(matching.symbol)} ${esc(String(matching.direction || '').toUpperCase())}</strong><p>Entry ${matching.entryPrice ?? '—'} · ${Number(matching.lots || 0)} lot</p><small>This is reported account state, separate from the bot event.</small>` : '<strong>NO CORRESPONDING POSITION REPORTED</strong><p>The sky signal does not mean your selected account entered.</p>'}</section>
      </div>
      <div class="modal-actions"><a class="action primary" href="/member/command-center?symbol=${encodeURIComponent(signal.symbol || '')}" data-nav>View Chart</a><a class="action" href="/member/bots" data-nav>Show Bot</a></div>`;
  } catch (error) {
    body.innerHTML = `<span class="modal-kicker">WISDO SIGNAL</span><h2 id="modalTitle">Signal unavailable</h2><p>${esc(error.message)}</p>`;
  }
}

export function startWorldSignalRuntime() {
  repairActiveSignals();
  connectStream();
  clearInterval(ticker);
  ticker = setInterval(() => {
    for (const [id, signal] of activeSignals) if (remainingSeconds(signal) <= 0) activeSignals.delete(id);
    renderHud();
  }, 1_000);
  clearInterval(repairTimer);
  repairTimer = setInterval(repairActiveSignals, 15_000);
  worldEventBus.on('world.connection', (event) => {
    if (event.detail?.source === 'signal-event-stream') return;
    if (event.detail?.state === 'degraded') renderHud();
  });
  return {
    openSignalDetails,
    remainingSeconds,
    get activeSignals() { return [...activeSignals.values()]; },
    get clockOffsetMs() { return clockOffsetMs; },
    stop() {
      eventSource?.close?.();
      eventSource = null;
      clearInterval(ticker);
      clearInterval(repairTimer);
    },
  };
}
