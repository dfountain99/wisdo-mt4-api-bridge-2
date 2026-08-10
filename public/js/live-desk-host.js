(() => {
  const $ = (id) => document.getElementById(id);
  const form = $('liveDeskForm');
  if (!form) return;

  const stage = $('liveDeskStage');
  const preview = $('liveDeskPreview');
  const badge = $('liveDeskBadge');
  const watermark = $('liveDeskWatermark');
  const overlay = $('liveDeskOverlay');
  const statusLine = $('liveDeskStatus');
  const headerState = $('liveDeskHeaderState');
  const startButton = $('liveDeskStart');
  const stopButton = $('liveDeskStop');
  const shareCard = $('liveDeskShareCard');
  const shareLink = $('liveDeskShareLink');
  const roomCodeWrap = $('liveDeskRoomCodeWrap');
  const roomCode = $('liveDeskRoomCode');
  const openViewer = $('liveDeskOpenViewer');
  const copyLink = $('liveDeskCopyLink');
  const viewerCard = $('liveDeskViewersCard');
  const viewerList = $('liveDeskViewerList');
  const viewerCapacity = $('liveDeskViewerCapacity');
  const viewCount = $('liveDeskViewCount');
  const chatCard = $('liveDeskChatCard');
  const chatLog = $('liveDeskChat');
  const chatForm = $('liveDeskChatForm');
  const chatInput = $('liveDeskChatInput');
  const selectedWrap = $('liveDeskSelectedWrap');
  const transport = $('liveDeskTransport');
  const turn = $('liveDeskTurn');

  let session = null;
  let screenStream = null;
  let micStream = null;
  let iceConfig = { iceServers: [] };
  let signalCursor = 0;
  let chatCursor = '';
  let running = false;
  let signalTimer = null;
  let participantTimer = null;
  let telemetryTimer = null;
  let chatTimer = null;
  const peers = new Map();

  function setStatus(message, error = false) {
    statusLine.textContent = message;
    statusLine.style.color = error ? '#fecaca' : '#94a3b8';
  }

  function money(value) {
    const n = Number(value || 0);
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  }

  function signedMoney(value) {
    const n = Number(value || 0);
    return `${n >= 0 ? '+' : '-'}${money(Math.abs(n))}`;
  }

  function updateOverlay(telemetry = null) {
    if (!telemetry || !session?.showAccountOverlay) {
      overlay.classList.add('live-hidden');
      return;
    }
    overlay.classList.remove('live-hidden');
    $('ldAccount').textContent = telemetry.accountLabel || telemetry.accountId || '--';
    $('ldEquity').textContent = money(telemetry.equity);
    $('ldFloating').textContent = signedMoney(telemetry.floatingPL);
    $('ldFloating').style.color = Number(telemetry.floatingPL || 0) >= 0 ? '#39ff88' : '#ff7a7a';
    $('ldTrades').textContent = String(telemetry.openTradeCount || 0);
    $('ldLogic').textContent = telemetry.logicStatus || (telemetry.symbols || []).join(', ') || 'Live telemetry';
  }

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

  async function loadIceConfig() {
    try {
      const body = await jsonFetch('/api/live-desk/ice-config');
      iceConfig = { iceServers: body.iceServers || [] };
      transport.textContent = body.transport === 'direct-webrtc' ? 'Direct WebRTC' : (body.transport || 'WebRTC');
      turn.textContent = body.turnConfigured ? 'TURN ready' : 'STUN/direct only';
      turn.title = body.note || '';
      viewerCapacity.textContent = `0 / ${body.viewerCapacity || '--'}`;
    } catch (error) {
      setStatus(`ICE configuration check failed: ${error.message}`, true);
    }
  }

  function stopLocalMedia() {
    for (const peer of peers.values()) {
      try { peer.close(); } catch {}
    }
    peers.clear();
    for (const stream of [screenStream, micStream]) {
      for (const track of stream?.getTracks?.() || []) {
        try { track.stop(); } catch {}
      }
    }
    screenStream = null;
    micStream = null;
    preview.srcObject = null;
    stage.classList.remove('is-live');
    badge.classList.add('live-hidden');
    watermark.classList.add('live-hidden');
    overlay.classList.add('live-hidden');
  }

  function clearTimers() {
    for (const timer of [signalTimer, participantTimer, telemetryTimer, chatTimer]) {
      if (timer) clearTimeout(timer);
    }
    signalTimer = participantTimer = telemetryTimer = chatTimer = null;
  }

  async function stopBroadcast(reason = 'owner_stop', remote = true) {
    if (!session && !screenStream) return;
    running = false;
    clearTimers();
    const current = session;
    session = null;
    startButton.disabled = false;
    stopButton.disabled = true;
    headerState.textContent = 'Broadcast stopped';
    if (current && remote) {
      try {
        await jsonFetch(`/api/live-desk/sessions/${encodeURIComponent(current.id)}/stop`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });
      } catch {}
    }
    stopLocalMedia();
    setStatus('Broadcast stopped. Your trading screen is no longer being sent to viewers.');
  }

  async function sendSignal(recipientId, type, payload) {
    if (!session) return;
    await jsonFetch(`/api/live-desk/sessions/${encodeURIComponent(session.id)}/signal`, {
      method: 'POST',
      body: JSON.stringify({ senderId: 'host', recipientId, type, payload }),
    });
  }

  async function createPeer(viewerId) {
    if (!session || !screenStream || !viewerId) return;
    if (peers.has(viewerId)) {
      try { peers.get(viewerId).close(); } catch {}
      peers.delete(viewerId);
    }
    const pc = new RTCPeerConnection(iceConfig);
    peers.set(viewerId, pc);
    const tracks = [
      ...(screenStream?.getTracks?.() || []),
      ...(micStream?.getAudioTracks?.() || []),
    ];
    for (const track of tracks) pc.addTrack(track, track.kind === 'video' ? screenStream : (micStream || screenStream));
    pc.onicecandidate = (event) => {
      if (event.candidate) sendSignal(viewerId, 'ice', event.candidate.toJSON ? event.candidate.toJSON() : event.candidate).catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        setTimeout(() => {
          if (peers.get(viewerId) === pc && ['failed', 'closed'].includes(pc.connectionState)) {
            try { pc.close(); } catch {}
            peers.delete(viewerId);
          }
        }, 1500);
      }
    };
    const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);
    await sendSignal(viewerId, 'offer', pc.localDescription);
  }

  async function handleSignal(message) {
    if (!message?.type) return;
    const viewerId = message.from;
    if (message.type === 'viewer-ready') {
      await createPeer(viewerId);
      return;
    }
    const pc = peers.get(viewerId);
    if (message.type === 'answer' && pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
    } else if (message.type === 'ice' && pc && message.payload) {
      try { await pc.addIceCandidate(new RTCIceCandidate(message.payload)); } catch {}
    } else if (message.type === 'bye' && pc) {
      try { pc.close(); } catch {}
      peers.delete(viewerId);
    }
  }

  async function pollSignals() {
    if (!running || !session) return;
    try {
      const body = await jsonFetch(`/api/live-desk/sessions/${encodeURIComponent(session.id)}/signals?participantId=host&after=${signalCursor}`);
      for (const message of body.messages || []) {
        signalCursor = Math.max(signalCursor, Number(message.seq || 0));
        try { await handleSignal(message); } catch (error) { console.warn('Live Desk signal error', error); }
      }
      if (body.status && body.status !== 'live') return stopBroadcast(body.status, false);
    } catch (error) {
      setStatus(`Signaling retry: ${error.message}`, true);
    }
    signalTimer = setTimeout(pollSignals, 450);
  }

  function renderParticipants(participants = []) {
    viewCount.textContent = `${participants.length} viewer${participants.length === 1 ? '' : 's'}`;
    viewerCapacity.textContent = `${participants.length} / ${session?.maxViewers || '--'}`;
    if (!participants.length) {
      viewerList.innerHTML = '<p class="muted">No viewers connected.</p>';
      return;
    }
    viewerList.replaceChildren(...participants.map((participant) => {
      const row = document.createElement('div');
      row.className = 'live-viewer-row';
      const info = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = participant.displayName || 'Viewer';
      const meta = document.createElement('div');
      meta.className = 'muted';
      meta.style.fontSize = '11px';
      meta.textContent = `${participant.deviceType || 'web'} • ${participant.userId ? 'signed in' : 'guest'}`;
      info.append(name, meta);
      const actions = document.createElement('div');
      actions.className = 'live-inline';
      const remove = document.createElement('button');
      remove.className = 'btn';
      remove.textContent = 'Remove';
      remove.dataset.removeViewer = participant.id;
      const block = document.createElement('button');
      block.className = 'btn danger';
      block.textContent = 'Block';
      block.dataset.blockViewer = participant.id;
      actions.append(remove, block);
      row.append(info, actions);
      return row;
    }));
  }

  async function refreshParticipants() {
    if (!running || !session) return;
    try {
      const body = await jsonFetch(`/api/live-desk/sessions/${encodeURIComponent(session.id)}/participants`);
      renderParticipants(body.participants || []);
    } catch {}
    participantTimer = setTimeout(refreshParticipants, 2500);
  }

  async function refreshTelemetry() {
    if (!running || !session) return;
    try {
      const body = await jsonFetch(`/api/live-desk/sessions/${encodeURIComponent(session.id)}/telemetry`, {
        method: 'POST',
        body: JSON.stringify({ accountId: session.accountId }),
      });
      if (body.telemetry) updateOverlay(body.telemetry);
    } catch {}
    telemetryTimer = setTimeout(refreshTelemetry, 3000);
  }

  function appendChat(items = []) {
    for (const item of items) {
      if (!item?.id || chatLog.querySelector(`[data-chat-id="${CSS.escape(item.id)}"]`)) continue;
      const node = document.createElement('div');
      node.className = 'live-chat-item';
      node.dataset.chatId = item.id;
      const name = document.createElement('strong');
      name.textContent = item.displayName || 'Viewer';
      const message = document.createElement('p');
      message.textContent = item.message || '';
      node.append(name, message);
      chatLog.appendChild(node);
      chatCursor = item.id;
    }
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  async function pollChat() {
    if (!running || !session) return;
    try {
      const suffix = chatCursor ? `&after=${encodeURIComponent(chatCursor)}` : '';
      const body = await jsonFetch(`/api/live-desk/sessions/${encodeURIComponent(session.id)}/chat?participantId=host${suffix}`);
      appendChat(body.messages || []);
    } catch {}
    chatTimer = setTimeout(pollChat, 1200);
  }

  async function startBroadcast(event) {
    event.preventDefault();
    if (running) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getDisplayMedia) {
      setStatus('Screen sharing requires HTTPS and a browser that supports getDisplayMedia.', true);
      return;
    }
    startButton.disabled = true;
    startButton.textContent = 'Choose Screen…';
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 20, max: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      const data = new FormData(form);
      if (data.get('micCommentary')) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        } catch (error) {
          setStatus(`Screen is ready, but microphone commentary was not granted: ${error.message}`);
        }
      }
      preview.srcObject = screenStream;
      await preview.play().catch(() => {});
      const allowedViewerIds = String(data.get('allowedViewerIds') || '').split(/[\s,]+/g).filter(Boolean);
      const body = await jsonFetch('/api/live-desk/sessions', {
        method: 'POST',
        body: JSON.stringify({
          title: data.get('title'),
          visibility: data.get('visibility'),
          expiresMinutes: Number(data.get('expiresMinutes') || 240),
          accountId: data.get('accountId') || '',
          allowedViewerIds,
          showAccountOverlay: Boolean(data.get('showAccountOverlay')),
          watermarkEnabled: Boolean(data.get('watermarkEnabled')),
          recordingAllowed: false,
        }),
      });
      session = body.session;
      signalCursor = 0;
      chatCursor = '';
      running = true;
      const url = body.viewerUrl || `${location.origin}/live/${encodeURIComponent(session.id)}`;
      shareLink.textContent = url;
      openViewer.href = url;
      shareCard.classList.remove('live-hidden');
      viewerCard.classList.remove('live-hidden');
      chatCard.classList.remove('live-hidden');
      stage.classList.add('is-live');
      badge.classList.remove('live-hidden');
      if (session.watermarkEnabled) {
        watermark.textContent = `WISDO LIVE • ${session.id.slice(-8)} • ${new Date().toLocaleString()}`;
        watermark.classList.remove('live-hidden');
      }
      if (body.roomCode) {
        roomCode.textContent = body.roomCode;
        roomCodeWrap.classList.remove('live-hidden');
      } else {
        roomCodeWrap.classList.add('live-hidden');
      }
      stopButton.disabled = false;
      startButton.textContent = 'Broadcasting';
      headerState.textContent = `LIVE • ${session.visibility.replaceAll('_', ' ')}`;
      setStatus('Broadcast is live. WISDO is negotiating secure peer connections as viewers join.');
      updateOverlay(session.telemetry);
      screenStream.getVideoTracks()[0]?.addEventListener('ended', () => stopBroadcast('screen_share_ended'));
      pollSignals();
      refreshParticipants();
      refreshTelemetry();
      pollChat();
    } catch (error) {
      startButton.disabled = false;
      startButton.textContent = 'Start Broadcast';
      stopLocalMedia();
      setStatus(error.name === 'NotAllowedError' ? 'Screen sharing was cancelled or blocked by browser permission.' : error.message, true);
    }
  }

  form.addEventListener('submit', startBroadcast);
  form.elements.visibility?.addEventListener('change', () => {
    selectedWrap.classList.toggle('live-hidden', form.elements.visibility.value !== 'selected_members');
  });
  stopButton.addEventListener('click', () => stopBroadcast('panic_stop'));
  copyLink.addEventListener('click', async () => {
    if (!shareLink.textContent) return;
    await navigator.clipboard?.writeText(shareLink.textContent);
    copyLink.textContent = 'Copied';
    setTimeout(() => { copyLink.textContent = 'Copy Link'; }, 1200);
  });
  viewerList.addEventListener('click', async (event) => {
    const removeId = event.target?.dataset?.removeViewer;
    const blockId = event.target?.dataset?.blockViewer;
    const participantId = removeId || blockId;
    if (!participantId || !session) return;
    try {
      await jsonFetch(`/api/live-desk/sessions/${encodeURIComponent(session.id)}/viewers/${encodeURIComponent(participantId)}/${blockId ? 'block' : 'remove'}`, { method: 'POST', body: '{}' });
      const pc = peers.get(participantId);
      try { pc?.close(); } catch {}
      peers.delete(participantId);
      await refreshParticipants();
    } catch (error) { setStatus(error.message, true); }
  });
  chatForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message || !session) return;
    chatInput.value = '';
    try {
      const body = await jsonFetch(`/api/live-desk/sessions/${encodeURIComponent(session.id)}/chat`, {
        method: 'POST', body: JSON.stringify({ participantId: 'host', message }),
      });
      appendChat([body.item]);
    } catch (error) { setStatus(error.message, true); }
  });

  window.addEventListener('beforeunload', () => {
    if (!session || !running) return;
    try {
      navigator.sendBeacon(`/api/live-desk/sessions/${encodeURIComponent(session.id)}/stop`, new Blob([JSON.stringify({ reason: 'page_unload' })], { type: 'application/json' }));
    } catch {}
  });

  loadIceConfig();
})();
