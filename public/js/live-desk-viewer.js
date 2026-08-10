(() => {
  const root = document.querySelector('[data-live-desk-viewer]');
  if (!root) return;
  const sessionId = root.dataset.sessionId || window.WISDO_LIVE_DESK_SESSION || '';
  const $ = (id) => document.getElementById(id);
  const gate = $('liveViewerGate');
  const gateTitle = $('liveViewerGateTitle');
  const gateText = $('liveViewerGateText');
  const roomForm = $('liveViewerRoomForm');
  const roomInput = $('liveViewerRoomCode');
  const loginLink = $('liveViewerLogin');
  const grid = $('liveViewerGrid');
  const video = $('liveViewerVideo');
  const statusBadge = $('liveViewerStatus');
  const title = $('liveViewerTitle');
  const owner = $('liveViewerOwner');
  const subtitle = $('liveViewerSubtitle');
  const watermark = $('liveViewerWatermark');
  const overlay = $('liveViewerOverlay');
  const notice = $('liveViewerNotice');
  const chatLog = $('liveViewerChat');
  const chatForm = $('liveViewerChatForm');
  const chatInput = $('liveViewerChatInput');
  const resolution = $('liveViewerResolution');
  const bitrate = $('liveViewerBitrate');
  const network = $('liveViewerNetwork');

  let participantId = '';
  let participantToken = '';
  let pc = null;
  let iceConfig = { iceServers: [] };
  let signalCursor = 0;
  let chatCursor = '';
  let running = false;
  let signalTimer = null;
  let metaTimer = null;
  let chatTimer = null;
  let statsTimer = null;
  let previousBytes = 0;
  let previousStatsAt = 0;

  async function jsonFetch(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const body = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
    if (!response.ok || body.ok === false) {
      const error = new Error(body.error || `Request failed (${response.status})`);
      error.code = body.code;
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  function money(value) {
    return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  }
  function signedMoney(value) {
    const n = Number(value || 0);
    return `${n >= 0 ? '+' : '-'}${money(Math.abs(n))}`;
  }

  function updateMeta(session = {}) {
    title.textContent = session.title || 'Live Trading Desk';
    owner.textContent = `Trader: ${session.ownerDisplayName || 'Culture Coin Trader'}`;
    subtitle.textContent = `${session.ownerDisplayName || 'Culture Coin Trader'} • ${String(session.visibility || 'live').replaceAll('_', ' ')} • ${session.viewerCount || 0} watching`;
    if (session.watermarkEnabled) {
      const label = session.participant?.displayName || 'Viewer';
      watermark.textContent = `WISDO • ${label} • ${session.id?.slice(-8) || ''} • ${new Date().toLocaleString()}`;
      watermark.classList.remove('live-hidden');
    } else watermark.classList.add('live-hidden');
    const telemetry = session.telemetry;
    if (session.showAccountOverlay && telemetry) {
      overlay.classList.remove('live-hidden');
      $('lvAccount').textContent = telemetry.accountLabel || telemetry.accountId || '--';
      $('lvEquity').textContent = money(telemetry.equity);
      $('lvFloating').textContent = signedMoney(telemetry.floatingPL);
      $('lvFloating').style.color = Number(telemetry.floatingPL || 0) >= 0 ? '#39ff88' : '#ff7a7a';
      $('lvTrades').textContent = String(telemetry.openTradeCount || 0);
      $('lvLogic').textContent = telemetry.logicStatus || (telemetry.symbols || []).join(', ') || 'Live telemetry';
    } else overlay.classList.add('live-hidden');
    if (session.status && session.status !== 'live') endViewer(`Broadcast ${session.status}.`);
  }

  function showGate(message, { room = false, login = false } = {}) {
    gate.classList.remove('live-hidden');
    grid.classList.add('live-hidden');
    gateText.textContent = message;
    roomForm.classList.toggle('live-hidden', !room);
    loginLink.classList.toggle('live-hidden', !login);
    if (login) loginLink.href = `/login?returnTo=${encodeURIComponent(location.pathname)}`;
  }

  function showViewer() {
    gate.classList.add('live-hidden');
    grid.classList.remove('live-hidden');
    statusBadge.innerHTML = '<span class="pulse"><i></i></span> LIVE';
  }

  async function sendSignal(type, payload) {
    if (!participantId || !participantToken) return;
    await jsonFetch(`/api/live-desk/sessions/${encodeURIComponent(sessionId)}/signal`, {
      method: 'POST',
      body: JSON.stringify({ senderId: participantId, recipientId: 'host', token: participantToken, type, payload }),
    });
  }

  function makePeer() {
    try { pc?.close(); } catch {}
    pc = new RTCPeerConnection(iceConfig);
    pc.onicecandidate = (event) => {
      if (event.candidate) sendSignal('ice', event.candidate.toJSON ? event.candidate.toJSON() : event.candidate).catch(() => {});
    };
    pc.ontrack = (event) => {
      const stream = event.streams?.[0] || new MediaStream([event.track]);
      if (video.srcObject !== stream) video.srcObject = stream;
      video.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      const state = pc?.connectionState || 'connecting';
      network.textContent = state;
      if (state === 'connected') notice.textContent = 'Peer-to-peer media connected. You are watching the desk live.';
      if (['failed', 'closed'].includes(state) && running) notice.textContent = 'Media connection dropped. WISDO is waiting for the host to reconnect.';
    };
    return pc;
  }

  async function handleSignal(message) {
    if (message.type === 'offer') {
      const peer = makePeer();
      await peer.setRemoteDescription(new RTCSessionDescription(message.payload));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await sendSignal('answer', peer.localDescription);
    } else if (message.type === 'ice' && message.payload) {
      if (!pc) return;
      try { await pc.addIceCandidate(new RTCIceCandidate(message.payload)); } catch {}
    } else if (message.type === 'bye') {
      endViewer(message.payload?.reason ? `Broadcast ended: ${message.payload.reason}` : 'Broadcast ended.');
    }
  }

  async function pollSignals() {
    if (!running) return;
    try {
      const body = await jsonFetch(`/api/live-desk/sessions/${encodeURIComponent(sessionId)}/signals?participantId=${encodeURIComponent(participantId)}&after=${signalCursor}`, { headers: { 'X-Live-Desk-Token': participantToken } });
      for (const message of body.messages || []) {
        signalCursor = Math.max(signalCursor, Number(message.seq || 0));
        await handleSignal(message);
      }
      if (body.status && body.status !== 'live') return endViewer(`Broadcast ${body.status}.`);
    } catch (error) {
      notice.textContent = `Connection retry: ${error.message}`;
    }
    signalTimer = setTimeout(pollSignals, 450);
  }

  async function pollMeta() {
    if (!running) return;
    try {
      const body = await jsonFetch(`/api/live-desk/sessions/${encodeURIComponent(sessionId)}?participantId=${encodeURIComponent(participantId)}`, { headers: { 'X-Live-Desk-Token': participantToken } });
      updateMeta(body.session || {});
    } catch (error) {
      if ([404, 410].includes(error.status)) return endViewer(error.message);
    }
    metaTimer = setTimeout(pollMeta, 3000);
  }

  function appendChat(items = []) {
    for (const item of items) {
      if (!item?.id || chatLog.querySelector(`[data-chat-id="${CSS.escape(item.id)}"]`)) continue;
      const node = document.createElement('div');
      node.className = 'live-chat-item';
      node.dataset.chatId = item.id;
      const name = document.createElement('strong');
      name.textContent = item.displayName || 'Viewer';
      const msg = document.createElement('p');
      msg.textContent = item.message || '';
      node.append(name, msg);
      chatLog.appendChild(node);
      chatCursor = item.id;
    }
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  async function pollChat() {
    if (!running) return;
    try {
      const suffix = chatCursor ? `&after=${encodeURIComponent(chatCursor)}` : '';
      const body = await jsonFetch(`/api/live-desk/sessions/${encodeURIComponent(sessionId)}/chat?participantId=${encodeURIComponent(participantId)}${suffix}`, { headers: { 'X-Live-Desk-Token': participantToken } });
      appendChat(body.messages || []);
    } catch {}
    chatTimer = setTimeout(pollChat, 1200);
  }

  async function updateStats() {
    if (!running || !pc) return;
    try {
      const stats = await pc.getStats();
      let inbound = null;
      let pair = null;
      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.kind === 'video' && !report.isRemote) inbound = report;
        if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) pair = report;
      });
      if (inbound) {
        const now = performance.now();
        if (previousStatsAt && inbound.bytesReceived >= previousBytes) {
          const bps = ((inbound.bytesReceived - previousBytes) * 8) / ((now - previousStatsAt) / 1000);
          bitrate.textContent = `${Math.max(0, bps / 1000000).toFixed(2)} Mbps`;
        }
        previousStatsAt = now;
        previousBytes = inbound.bytesReceived || 0;
        resolution.textContent = inbound.frameWidth && inbound.frameHeight ? `${inbound.frameWidth}×${inbound.frameHeight}` : `${video.videoWidth || '--'}×${video.videoHeight || '--'}`;
      }
      if (pair?.currentRoundTripTime != null) network.textContent = `${pc.connectionState} • ${Math.round(pair.currentRoundTripTime * 1000)}ms`;
    } catch {}
    statsTimer = setTimeout(updateStats, 2000);
  }

  function endViewer(message = 'Broadcast ended.') {
    if (!running) return;
    running = false;
    for (const timer of [signalTimer, metaTimer, chatTimer, statsTimer]) if (timer) clearTimeout(timer);
    try { pc?.close(); } catch {}
    pc = null;
    try { video.srcObject = null; } catch {}
    statusBadge.textContent = 'ENDED';
    showGate(message);
    gateTitle.textContent = 'Live Desk Ended';
  }

  async function join(roomCode = '') {
    gateTitle.textContent = 'Joining Live Desk';
    gateText.textContent = 'Checking room access and negotiating a secure viewer connection…';
    try {
      const ice = await jsonFetch('/api/live-desk/ice-config');
      iceConfig = { iceServers: ice.iceServers || [] };
      const body = await jsonFetch(`/api/live-desk/sessions/${encodeURIComponent(sessionId)}/join`, {
        method: 'POST',
        body: JSON.stringify({ roomCode, deviceType: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent || '') ? 'mobile' : 'desktop' }),
      });
      participantId = body.participant.id;
      participantToken = body.token;
      running = true;
      signalCursor = 0;
      updateMeta(body.session || {});
      showViewer();
      notice.textContent = ice.turnConfigured ? 'TURN/direct WebRTC ready. Waiting for the broadcaster’s offer…' : 'Direct/STUN WebRTC ready. Waiting for the broadcaster’s offer…';
      pollSignals();
      pollMeta();
      pollChat();
      updateStats();
    } catch (error) {
      if (error.code === 'room_code_required') {
        gateTitle.textContent = 'Private Live Desk';
        showGate('Enter the Private Room code provided by the broadcaster.', { room: true });
      } else if (['owner_only', 'member_required', 'selected_member_required'].includes(error.code) && error.status === 401) {
        gateTitle.textContent = 'Login Required';
        showGate(error.message, { login: true });
      } else {
        gateTitle.textContent = error.status === 410 ? 'Broadcast Ended' : 'Unable To Join';
        showGate(error.message || 'Unable to join this Live Desk.');
      }
    }
  }

  roomForm.addEventListener('submit', (event) => {
    event.preventDefault();
    join(roomInput.value.trim());
  });
  chatForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message || !running) return;
    chatInput.value = '';
    try {
      const body = await jsonFetch(`/api/live-desk/sessions/${encodeURIComponent(sessionId)}/chat`, {
        method: 'POST',
        body: JSON.stringify({ participantId, token: participantToken, message }),
      });
      appendChat([body.item]);
    } catch (error) { notice.textContent = error.message; }
  });
  $('liveViewerFullscreen').addEventListener('click', () => {
    const target = video.closest('.live-stage') || video;
    target.requestFullscreen?.().catch(() => {});
  });
  $('liveViewerPip').addEventListener('click', async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (document.pictureInPictureEnabled && video.requestPictureInPicture) await video.requestPictureInPicture();
      else notice.textContent = 'Picture-in-picture is not supported by this browser.';
    } catch (error) { notice.textContent = error.message; }
  });
  $('liveViewerMute').addEventListener('click', () => {
    video.muted = !video.muted;
    $('liveViewerMute').textContent = video.muted ? 'Unmute' : 'Mute';
  });
  $('liveViewerReturn').addEventListener('click', () => {
    video.play().catch(() => {});
    notice.textContent = 'You are on the live WebRTC edge. There is no recorded rewind buffer.';
  });

  window.addEventListener('beforeunload', () => {
    if (!participantId || !participantToken) return;
    try {
      navigator.sendBeacon(`/api/live-desk/sessions/${encodeURIComponent(sessionId)}/leave`, new Blob([JSON.stringify({ participantId, token: participantToken })], { type: 'application/json' }));
    } catch {}
  });

  join();
})();
