/* WISDO HoloMode v1: authenticated trading readout, owner-scoped Home Assistant,
   push-to-talk browser voice, and an interactive WebGL PRISM character. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const scene = window.Prism3D || { available: false, setMood() {}, wave() {}, celebrate() {} };
  const state = { accounts: [], home: [], bootstrap: null, recognition: null, pending: null };
  const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const shortMoney = (value, currency = 'USD') => {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'Unavailable';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(number); }
    catch { return number.toFixed(2); }
  };
  const mood = (name, duration) => scene.setMood(name, duration);
  const status = (id, label, connected) => {
    const node = $(id);
    node.textContent = label;
    node.classList.toggle('connected', connected === true);
    node.classList.toggle('offline', connected === false);
  };
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(path, {
        credentials: 'same-origin',
        cache: 'no-store',
        ...options,
        signal: controller.signal,
        headers: { Accept: 'application/json', ...(options.headers || {}) },
      });
      if (response.status === 401) {
        location.href = '/login?returnTo=' + encodeURIComponent('/app/holomode');
        throw new Error('Your WISDO session expired.');
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || 'WISDO could not complete the request.');
      return result;
    } finally { clearTimeout(timer); }
  }
  function reply(text, speak = true) {
    $('prism-response').textContent = text;
    mood('thinking', 1000);
    if (speak && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 450));
      utterance.rate = 1.02;
      utterance.pitch = .92;
      utterance.onstart = () => mood('speaking', 12000);
      utterance.onend = () => mood('idle', 100);
      utterance.onerror = () => mood('idle', 100);
      window.speechSynthesis.speak(utterance);
    }
  }
  function freshness(account) {
    const last = Date.parse(account.last_sync_at || account.lastSyncAt || '');
    return Boolean(account.reporter_connected && Number.isFinite(last) && Date.now() - last < 300000);
  }
  function accountLine(account) {
    const connected = freshness(account);
    const name = account.nickname || account.broker || account.platform || 'Trading account';
    const balance = connected ? shortMoney(account.balance, account.currency) : 'Not verified';
    const equity = connected ? shortMoney(account.equity, account.currency) : 'Not verified';
    return `<div class="item"><div class="row"><strong>${esc(name)} · ${esc(account.account_number || 'linked')}</strong>
      <span class="tag ${connected ? 'connected' : 'offline'}">${connected ? 'LIVE REPORTER' : 'STALE / OFFLINE'}</span></div>
      <div class="small muted">Balance: ${esc(balance)} · Equity: ${esc(equity)} · ${esc(account.platform || 'MT4').toUpperCase()}</div></div>`;
  }
  async function refreshTrading() {
    try {
      const data = await request('/api/v2/accounts');
      state.accounts = Array.isArray(data.accounts) ? data.accounts : [];
      const live = state.accounts.filter(freshness).length;
      status('trading-status', live ? `${live} LIVE` : (state.accounts.length ? 'NO FRESH REPORTER' : 'NO ACCOUNTS'), Boolean(live));
      $('accounts').innerHTML = state.accounts.length ? state.accounts.map(accountLine).join('') :
        '<div class="item muted">No linked trading accounts. Use WISDO Accounts to pair your MT4 Reporter.</div>';
    } catch (error) {
      state.accounts = [];
      status('trading-status', 'UNAVAILABLE', false);
      $('accounts').textContent = 'Trading data unavailable: ' + error.message;
    }
  }
  function renderHome() {
    if (!state.home.length) {
      $('home-entities').innerHTML = '<div class="item muted">No approved Home Assistant lights or switches are connected.</div>';
      return;
    }
    $('home-entities').innerHTML = state.home.map((entity, index) => `
      <div class="item"><div class="row"><strong>${esc(entity.name)}</strong>
      <span class="tag ${entity.available ? 'connected' : 'offline'}">${esc(entity.state)}</span></div>
      <div class="actions"><button type="button" data-home-index="${index}" data-home-action="turn_on" ${entity.available ? '' : 'disabled'}>On</button>
      <button type="button" data-home-index="${index}" data-home-action="turn_off" ${entity.available ? '' : 'disabled'}>Off</button></div></div>`).join('');
  }
  async function refreshHome() {
    if (!state.bootstrap?.capabilities?.homeEnabled) {
      state.home = [];
      status('home-status', 'NOT CONFIGURED', false);
      renderHome();
      return;
    }
    try {
      const data = await request('/api/holomode/home/entities');
      state.home = Array.isArray(data.entities) ? data.entities : [];
      status('home-status', data.configured ? 'CONNECTED' : 'NOT CONFIGURED', Boolean(data.configured));
      renderHome();
    } catch (error) {
      state.home = [];
      status('home-status', 'UNAVAILABLE', false);
      $('home-entities').textContent = 'Home connection unavailable: ' + error.message;
    }
  }
  async function refreshAll() {
    await Promise.all([refreshTrading(), refreshHome()]);
  }
  function requestHomeChange(entity, action) {
    if (!entity?.available || !['turn_on', 'turn_off'].includes(action)) return;
    state.pending = { entityId: entity.id, name: entity.name, action };
    $('confirm-message').textContent = 'Are you sure you want to ' + (action === 'turn_on' ? 'turn ON ' : 'turn OFF ') + entity.name + '?';
    $('confirm-dialog').showModal();
  }
  async function confirmHomeChange() {
    const pending = state.pending;
    if (!pending) return;
    $('confirm-action').disabled = true;
    try {
      const result = await request('/api/holomode/home/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Wisdo-HoloMode': 'confirmed' },
        body: JSON.stringify({ entityId: pending.entityId, action: pending.action, confirmed: true }),
      });
      $('confirm-dialog').close();
      state.pending = null;
      reply(result.message || 'Home Assistant accepted the request. Refreshing to check its state.');
      await refreshHome();
    } catch (error) {
      $('confirm-dialog').close();
      state.pending = null;
      reply('The home action was not confirmed: ' + error.message);
    } finally { $('confirm-action').disabled = false; }
  }
  function accountSpeech() {
    if (!state.accounts.length) return 'No verified trading accounts are linked yet. Open Accounts to connect your Reporter.';
    const fresh = state.accounts.filter(freshness);
    if (!fresh.length) return 'Your accounts are listed, but none have a fresh Reporter heartbeat. I cannot confirm live balances or open positions.';
    const main = fresh[0];
    return `I can verify ${fresh.length} account${fresh.length !== 1 ? 's' : ''} with fresh Reporter data. ${main.nickname || main.broker || 'The first account'} has equity of ${shortMoney(main.equity, main.currency)} and ${Number(main.open_trades || 0)} reported open trades.`;
  }
  function locateHomeEntity(phrase) {
    const normalized = phrase.toLowerCase();
    const matches = state.home.filter((entity) =>
      normalized.includes(entity.name.toLowerCase()) ||
      normalized.includes(entity.id.replace(/^(light|switch)\./, '').replaceAll('_', ' '))
    );
    return matches.length === 1 ? matches[0] : null;
  }
  async function handleCommand(raw) {
    const phrase = String(raw || '').trim().slice(0, 260);
    if (!phrase) return;
    const normalized = phrase.toLowerCase().replace(/^(hey\s+(wisdo|wisdom|coach)|prism)[,\s]*/i, '');
    $('command').value = '';
    if (/\b(close|open|place|buy|sell|liquidate)\b.*\b(trade|order|position|gold|xau)/.test(normalized)) {
      reply('For your safety, placing or closing live trades must use the authorized WISDO Command Center with account-specific confirmation.');
      return;
    }
    if (/(account|balance|equity|trades?|profit|drawdown|gold|xau)/.test(normalized)) {
      await refreshTrading();
      reply(accountSpeech());
      return;
    }
    if (/(turn on|switch on|turn off|switch off)/.test(normalized)) {
      const action = /(turn on|switch on)/.test(normalized) ? 'turn_on' : 'turn_off';
      const target = locateHomeEntity(normalized);
      if (!target) return reply('Please name the approved light or switch. I will ask you to confirm the action before changing it.');
      requestHomeChange(target, action);
      mood('listening', 3000);
      return;
    }
    if (/(home|light|switch|device|room)/.test(normalized)) {
      await refreshHome();
      reply(state.home.length ? `I can see ${state.home.length} approved devices: ${state.home.map((x) => x.name + ' is ' + x.state).join(', ')}.` :
        'No approved Home Assistant lights or switches are connected yet.');
      return;
    }
    if (/(camera|surveillance|alarm|sentinel|unlock|door lock|disarm)/.test(normalized)) {
      reply('Security cameras, door locks, and alarm control are not connected to this HoloMode version. I will not pretend to control them.');
      return;
    }
    if (/(hello|hi|wave|how are you|who are you)/.test(normalized)) {
      scene.wave();
      reply('Hello. I am PRISM, your interactive WISDO companion. My trading status comes from your actual Reporter and my home devices come from approved Home Assistant connections.');
      return;
    }
    if (/(celebrate|dance|happy)/.test(normalized)) {
      scene.celebrate(); reply('Celebration mode activated.'); return;
    }
    reply('I can review your trading accounts, show approved lights and switches, or request a confirmed on or off action. More WISDO AI skills will connect through this interface later.');
  }
  function setupVoice() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      $('mic').disabled = true;
      $('voice-support').textContent = 'Microphone transcription is unsupported in this browser. Use the command field. PRISM voice output may still work.';
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    state.recognition = recognition;
    recognition.onstart = () => { $('mic').textContent = 'Listening…'; mood('listening', 12000); };
    recognition.onresult = (event) => { const value = event.results?.[0]?.[0]?.transcript || ''; handleCommand(value).catch((error) => reply(error.message)); };
    recognition.onerror = (event) => reply('Voice recognition could not complete: ' + (event.error || 'unknown error'), false);
    recognition.onend = () => { $('mic').textContent = '🎙 Talk to PRISM'; };
    $('mic').addEventListener('click', () => {
      window.speechSynthesis?.cancel();
      try { recognition.start(); } catch { reply('The microphone is busy. Try again.', false); }
    });
  }
  $('command-form').addEventListener('submit', (event) => {
    event.preventDefault();
    handleCommand($('command').value).catch((error) => reply(error.message));
  });
  $('home-entities').addEventListener('click', (event) => {
    const target = event.target.closest('[data-home-action]');
    if (!target) return;
    requestHomeChange(state.home[Number(target.dataset.homeIndex)], target.dataset.homeAction);
  });
  $('confirm-action').addEventListener('click', confirmHomeChange);
  $('cancel-action').addEventListener('click', () => { state.pending = null; $('confirm-dialog').close(); });
  $('confirm-dialog').addEventListener('close', () => { state.pending = null; });
  $('wave').addEventListener('click', () => { scene.wave(); reply('Hello from PRISM.'); });
  $('celebrate').addEventListener('click', () => { scene.celebrate(); reply('A little celebration for you.'); });
  $('refresh').addEventListener('click', refreshAll);
  status('character-status', scene.available ? '3D ONLINE' : 'WEBGL UNAVAILABLE', scene.available);
  setupVoice();
  (async () => {
    try {
      state.bootstrap = await request('/api/holomode/bootstrap');
      $('cloud-status').textContent = 'WISDO SESSION ACTIVE';
      $('cloud-status').classList.add('online');
      reply('Welcome to WISDO HoloMode. Try asking me about your trading accounts or approved home devices.', false);
      await refreshAll();
    } catch (error) {
      $('cloud-status').textContent = 'DISCONNECTED';
      reply('WISDO cloud connection failed: ' + error.message, false);
    }
  })();
  setInterval(() => { if (!document.hidden && state.bootstrap) refreshAll(); }, 60000);
})();
