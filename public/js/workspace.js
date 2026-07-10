(() => {
  'use strict';

  const PLATFORMS = ['mt4', 'mt5', 'ctrader', 'matchtrader', 'tradelocker', 'dxtrade', 'ninjatrader', 'tradovate', 'projectx', 'rithmic'];
  const RISK_TYPES = ['fixed_lot', 'multiplier', 'equity_ratio', 'balance_ratio'];
  const THEMES = ['midnight', 'cobalt', 'emerald', 'violet', 'gold', 'ember', 'light'];
  const BACKGROUNDS = ['mesh', 'terminal', 'motion-a', 'motion-b', 'solid'];
  let accounts = [];
  let currentPage = window.WISDO_PAGE || 'dashboard';
  let accountPoll = null;
  let activeRequest = null;
  const launchParams = new URLSearchParams(location.search);
  const dashboardBootRequested = currentPage === 'dashboard' && (
    launchParams.has('launch') ||
    sessionStorage.getItem('wisdo.dashboardLaunch') === '1' ||
    sessionStorage.getItem('deadshotLaunch') === '1' ||
    sessionStorage.getItem('wisdo.dashboardBootSeen') !== '1'
  );
  let dashboardBootStartedAt = 0;
  let dashboardBootSkipped = false;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function bootNode(selector) { return document.querySelector(selector); }
  function setDashboardBootStage(message, percent, stage = '') {
    const overlay = bootNode('#wisdo-boot');
    if (!overlay || dashboardBootSkipped) return;
    overlay.classList.add('active');
    const status = bootNode('#wisdo-boot-status');
    const progress = bootNode('#wisdo-boot-progress');
    const percentNode = bootNode('#wisdo-boot-percent');
    const stageNode = bootNode('#wisdo-boot-stage');
    if (status) status.textContent = message;
    if (progress) progress.style.width = `${Math.max(4, Math.min(100, Number(percent || 0)))}%`;
    if (percentNode) percentNode.textContent = `${Math.round(Number(percent || 0))}%`;
    if (stageNode) stageNode.textContent = stage || `Core ${String(Math.max(1, Math.ceil(Number(percent || 0) / 14))).padStart(2, '0')}`;
  }

  function beginDashboardBoot() {
    if (!dashboardBootRequested) return false;
    dashboardBootStartedAt = performance.now();
    sessionStorage.removeItem('wisdo.dashboardLaunch');
    sessionStorage.removeItem('deadshotLaunch');
    sessionStorage.setItem('wisdo.dashboardBootSeen', '1');
    setDashboardBootStage('Waking WISDO Core…', 6, 'Core 01');
    return true;
  }

  async function finishDashboardBoot(success = true, detail = '') {
    const overlay = bootNode('#wisdo-boot');
    if (!overlay || !dashboardBootRequested || dashboardBootSkipped) return;
    overlay.classList.toggle('ready', success);
    overlay.classList.toggle('error', !success);
    setDashboardBootStage(success ? 'Command Center Online' : (detail || 'Workspace recovery mode'), 100, success ? 'Online' : 'Recovery');
    const elapsed = performance.now() - dashboardBootStartedAt;
    if (elapsed < 1850) await sleep(1850 - elapsed);
    await sleep(success ? 420 : 850);
    overlay.classList.remove('active');
    if (launchParams.has('launch')) {
      launchParams.delete('launch');
      const clean = `${location.pathname}${launchParams.toString() ? `?${launchParams}` : ''}${location.hash}`;
      history.replaceState(null, '', clean);
    }
  }

  document.querySelectorAll('[data-wisdo-dashboard-launch]').forEach((link) => link.addEventListener('click', () => {
    sessionStorage.setItem('wisdo.dashboardLaunch', '1');
  }));
  bootNode('[data-wisdo-boot-skip]')?.addEventListener('click', () => {
    dashboardBootSkipped = true;
    bootNode('#wisdo-boot')?.classList.remove('active');
  });

  const html = (value = '') => String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
  const root = () => document.querySelector('#app-root');
  const selectedAccountId = () => document.querySelector('#mobile-account')?.value || '';
  const selectedAccount = () => accounts.find((account) => account.id === selectedAccountId()) || null;

  async function api(path, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);
    try {
      const response = await fetch(path, {
        ...options,
        signal: options.signal || controller.signal,
        headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      });
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : { message: await response.text() };
      if (response.status === 401) {
        const returnTo = `${location.pathname}${location.search}`;
        location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
        throw new Error('Your session expired. Redirecting to login.');
      }
      if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
      return payload;
    } catch (error) {
      if (error.name === 'AbortError' || /timed out/i.test(error.message || '')) throw new Error('The server did not answer in time. Your form is still intact—retry after checking the service logs.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function toast(message, tone = 'ok', duration = 4200) {
    const node = document.createElement('div');
    node.className = `toast ${tone}`;
    node.textContent = message;
    document.body.append(node);
    setTimeout(() => node.remove(), duration);
  }

  function setBusy(button, busy, label = 'Working…') {
    if (!button) return;
    if (busy) {
      button.dataset.originalLabel = button.textContent;
      button.textContent = label;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    } else {
      button.textContent = button.dataset.originalLabel || button.textContent;
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  function applyTheme(preferences = {}) {
    const theme = THEMES.includes(preferences.theme) ? preferences.theme : (localStorage.getItem('wisdo.theme') || 'midnight');
    const background = BACKGROUNDS.includes(preferences.background) ? preferences.background : (localStorage.getItem('wisdo.background') || 'mesh');
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.background = background;
    localStorage.setItem('wisdo.theme', theme);
    localStorage.setItem('wisdo.background', background);
    document.querySelectorAll('.workspace-bg-video').forEach((video) => video.classList.remove('active'));
    if (background === 'motion-a') document.querySelector('#workspace-video-a')?.classList.add('active');
    if (background === 'motion-b') document.querySelector('#workspace-video-b')?.classList.add('active');
  }

  function reporterFresh(account) {
    if (!account.last_sync_at) return false;
    return Date.now() - new Date(account.last_sync_at).getTime() < 5 * 60 * 1000;
  }

  function accountLabel(account) {
    const base = account.nickname || account.broker || account.platform || 'Trading account';
    const status = account.reporter_connected || reporterFresh(account) ? 'LIVE' : account.status === 'awaiting_reporter' ? 'PAIR' : String(account.status || '').toUpperCase();
    return `${base} · ${account.account_number || account.id} · ${status}`;
  }

  async function refreshAccounts(preserveSelection = true, silent = false) {
    const previous = preserveSelection ? (selectedAccountId() || sessionStorage.getItem('wisdo.selectedAccountId') || '') : '';
    const result = await api('/api/v2/accounts?includeReporter=1', {}, 12000);
    accounts = result.accounts || [];
    const selector = document.querySelector('#mobile-account');
    if (selector) {
      selector.innerHTML = '<option value="">Portfolio / choose an account</option>' + accounts.map((account) =>
        `<option value="${html(account.id)}">${html(accountLabel(account))}</option>`
      ).join('');
      if (accounts.some((account) => account.id === previous)) selector.value = previous;
      else if (accounts.some((account) => account.is_primary)) selector.value = accounts.find((account) => account.is_primary).id;
      else if (accounts.length === 1) selector.value = accounts[0].id;
      if (selector.value) sessionStorage.setItem('wisdo.selectedAccountId', selector.value);
      selector.onchange = async () => {
        sessionStorage.setItem('wisdo.selectedAccountId', selector.value);
        await renderCurrentPage();
      };
    }
    const status = document.querySelector('#workspace-account-status');
    if (status) status.textContent = `${accounts.filter((account) => account.reporter_connected || reporterFresh(account)).length}/${accounts.length} Reporter accounts live`;
    if (!silent && result.importedReporterAccounts) toast(`${result.importedReporterAccounts} Reporter account${result.importedReporterAccounts === 1 ? '' : 's'} synchronized into the workspace.`);
    return accounts;
  }

  function accountOptions(role = 'any') {
    return accounts.filter((account) => role === 'any' || account.role === role)
      .map((account) => `<option value="${html(account.id)}">${html(accountLabel(account))}</option>`).join('');
  }

  function accountMetrics(account) {
    if (!account) return '';
    const freshness = account.reporter_connected || reporterFresh(account);
    return `<section class="selected-account-banner card">
      <div><span class="eyebrow">Selected account</span><h3>${html(account.nickname || account.broker || account.platform)} · ${html(account.account_number)}</h3><p class="muted">${html(account.server || 'server pending')} · ${html(account.role)} · ${freshness ? 'Reporter live' : html(account.status || 'waiting')}</p></div>
      <div class="mini-metrics"><div><small>Balance</small><strong>${money(account.balance)}</strong></div><div><small>Equity</small><strong>${money(account.equity)}</strong></div><div><small>Floating</small><strong class="${Number(account.floating_pl || 0) >= 0 ? 'green' : 'red'}">${money(account.floating_pl)}</strong></div><div><small>Open</small><strong>${Number(account.open_trades || 0)}</strong></div></div>
    </section>`;
  }

  async function drawDashboard() {
    const accountId = selectedAccountId();
    const stats = await api(`/api/v2/analyzer/portfolio?period=month${accountId ? `&account_id=${encodeURIComponent(accountId)}` : ''}`);
    const active = selectedAccount();
    root().innerHTML = `
      <div class="workspace-heading"><div><span class="eyebrow">Trading workspace</span><h1>WISDO Command Center</h1><p class="muted">Every metric and command below follows the selected Reporter-backed account.</p></div><div class="live-chip" id="workspace-account-status">${accounts.length} accounts loaded</div></div>
      ${accountMetrics(active)}
      <div class="grid4">
        <div class="card"><small class="muted">Connected accounts</small><div class="metric">${accounts.length}</div><p>${accounts.filter((a) => a.reporter_connected || reporterFresh(a)).length} live Reporter heartbeats</p></div>
        <div class="card"><small class="muted">${active ? 'Account' : 'Portfolio'} ROI</small><div class="metric green">${Number(stats.roi || 0).toFixed(2)}%</div></div>
        <div class="card"><small class="muted">Win rate</small><div class="metric">${Number(stats.winRate || 0).toFixed(1)}%</div></div>
        <div class="card"><small class="muted">Max drawdown</small><div class="metric red">${Number(stats.maxDrawdown || 0).toFixed(2)}%</div></div>
      </div>
      <div class="grid2" style="margin-top:18px">
        <section class="card"><div class="card-head"><div><span class="eyebrow">Connected desk</span><h3>Accounts</h3></div><a class="btn primary" href="/app/accounts">Manage</a></div>${accounts.length ? accounts.map((account) => `
          <button class="account-line account-select-line" data-account-target="${html(account.id)}"><div><strong>${html(account.nickname || account.broker || account.platform)} ${html(account.account_number)}</strong><br><small class="muted">${html(account.platform)} · ${html(account.status)} · ${html(account.role)} · ${html(account.server || '')}</small></div><div><strong>${money(account.equity)}</strong><br><small class="${account.reporter_connected || reporterFresh(account) ? 'green' : 'muted'}">${account.reporter_connected || reporterFresh(account) ? 'Reporter live' : 'Awaiting heartbeat'}</small></div></button>`).join('') : '<p class="muted">No accounts yet. Add a Culture Lead or Mirror Receiver.</p>'}</section>
        <section class="card"><span class="eyebrow">Relay readiness</span><h3>Account-aware controls</h3><ul class="feature-list"><li>Live Reporter metrics merge into every app screen</li><li>Mobile selector changes dashboard, trade log, and Insight Engine</li><li>Commands carry the actual Reporter account ID</li><li>Close authority bypasses entry filters</li><li>Live symbol execution remains feature-gated</li></ul><div class="actions"><a class="btn primary" href="/app/copier-engine">Build Culture Lane</a><a class="btn ghost" href="/app/education?bot=df-sauce-final-ai">Open Academy</a></div></section>
      </div>`;
    root().querySelectorAll('[data-account-target]').forEach((button) => button.onclick = async () => {
      const selector = document.querySelector('#mobile-account'); selector.value = button.dataset.accountTarget; sessionStorage.setItem('wisdo.selectedAccountId', selector.value); await drawDashboard();
    });
  }

  function drawAccounts() {
    root().innerHTML = `
      <div class="workspace-heading"><div><span class="eyebrow">Connections</span><h1>Trading Accounts</h1><p class="muted">Accounts are matched to the MT4 Reporter using account number + broker server. Saving login information does not bypass Reporter pairing.</p></div><button class="btn primary" id="add-account">Add account</button></div>
      <div class="grid3">${accounts.length ? accounts.map((account) => `
        <article class="card account-card">
          <div class="card-head"><span class="status-pill ${account.reporter_connected || reporterFresh(account) ? 'connected' : 'waiting'}">${account.reporter_connected || reporterFresh(account) ? 'Reporter live' : html(account.status || 'waiting')}</span><span class="muted">${html(String(account.platform || 'mt4').toUpperCase())}</span></div>
          <h3>${html(account.nickname || account.broker || account.platform)} · ${html(account.account_number)}</h3>
          <p>${html(account.role)} · ${html(account.server || 'server pending')}</p>
          <div class="metric">${money(account.equity)}</div>
          <small class="muted">Balance ${money(account.balance)} · Floating ${money(account.floating_pl)} · Open ${Number(account.open_trades || 0)}</small>
          <div class="account-heartbeat"><span>Last heartbeat</span><strong>${html(account.last_sync_at ? new Date(account.last_sync_at).toLocaleString() : 'Never')}</strong></div>
          ${account.pairing_code ? `<div class="pairing-code"><small>Pairing code</small><code>${html(account.pairing_code)}</code><button class="btn ghost" data-copy-code="${html(account.pairing_code)}">Copy</button></div>` : ''}
          <div class="actions"><button class="btn ghost" data-test="${html(account.id)}">Test</button><button class="btn ghost" data-sync="${html(account.id)}">Sync</button><button class="btn ghost" data-disconnect="${html(account.id)}">Disconnect</button><button class="btn danger" data-delete-account="${html(account.id)}">Delete</button></div>
        </article>`).join('') : '<div class="card"><h3>No accounts connected</h3><p>Add an account. WISDO saves the identity, creates a Reporter-compatible account ID, and shows the pairing status instead of freezing.</p></div>'}</div>
      <dialog id="account-dialog"><form class="card dialog-form" id="account-form">
        <div class="card-head"><div><span class="eyebrow">Secure account onboarding</span><h3>Add trading account</h3></div><button class="dialog-x" type="button" id="cancel-account" aria-label="Close">×</button></div>
        <div class="setup-note"><strong>How connection works</strong><p>WISDO stores the account identity and optional encrypted credential vault. MT4/MT5 execution becomes live only after the Reporter sends a heartbeat with the same account number and server.</p></div>
        <div class="grid2"><label>Platform<select class="input" name="platform">${PLATFORMS.map((platform) => `<option value="${platform}">${platform.toUpperCase()}</option>`).join('')}</select></label>
        <label>Role<select class="input" name="role"><option value="master">Culture Lead / Master</option><option value="slave">Mirror Receiver / Follower</option></select></label>
        <label>Broker<input class="input" name="broker" required placeholder="Coinexx"></label>
        <label>Server<input class="input" name="server" required placeholder="Coinexx-Demo"></label>
        <label>Account number<input class="input" name="account_number" required inputmode="numeric"></label>
        <label>Nickname<input class="input" name="nickname" placeholder="Gold master"></label></div>
        <details><summary>Optional encrypted credential vault</summary><div class="grid2"><label>Broker login<input class="input" name="login" autocomplete="off"></label><label>Investor/API password<input class="input" type="password" name="password" autocomplete="new-password"></label></div><p class="muted">Never use this form as a substitute for the approved Reporter bridge. Credentials are accepted only when production encryption is configured.</p></details>
        <div id="account-form-status" class="form-status" role="status">Ready to save.</div>
        <div class="actions"><button class="btn primary" id="save-account" type="submit">Save and prepare pairing</button><button class="btn ghost" type="button" id="cancel-account-2">Cancel</button></div>
      </form></dialog>`;

    const dialog = document.querySelector('#account-dialog');
    document.querySelector('#add-account').onclick = () => { dialog.showModal(); document.querySelector('#account-form-status').textContent = 'Ready to save.'; };
    const closeDialog = () => dialog.close();
    document.querySelector('#cancel-account').onclick = closeDialog;
    document.querySelector('#cancel-account-2').onclick = closeDialog;
    document.querySelector('#account-form').onsubmit = async (event) => {
      event.preventDefault();
      const form = event.target; const button = document.querySelector('#save-account'); const status = document.querySelector('#account-form-status');
      const payload = Object.fromEntries(new FormData(form));
      const login = payload.login; const password = payload.password; delete payload.login; delete payload.password;
      if (login || password) payload.credentials = { login, password };
      setBusy(button, true, 'Saving securely…'); status.className = 'form-status working'; status.textContent = 'Validating account identity and preparing the Reporter link…';
      try {
        const result = await api('/api/v2/accounts', { method: 'POST', body: JSON.stringify(payload) }, 20000);
        status.className = 'form-status success';
        status.innerHTML = `Account saved. Status: <strong>${html(result.account.status)}</strong>${result.account.pairing_code ? ` · Pairing code: <code>${html(result.account.pairing_code)}</code>` : ''}`;
        toast(result.message || 'Trading account saved. Complete Reporter pairing to activate live metrics.');
        await refreshAccounts(false, true);
        setTimeout(() => { dialog.close(); drawAccounts(); }, 900);
      } catch (error) {
        status.className = 'form-status error'; status.textContent = error.message; toast(error.message, 'error', 7000);
      } finally { setBusy(button, false); }
    };
    root().querySelectorAll('[data-copy-code]').forEach((button) => button.onclick = async () => { await navigator.clipboard?.writeText(button.dataset.copyCode); toast('Pairing code copied'); });
    root().querySelectorAll('[data-test]').forEach((button) => button.onclick = async () => {
      setBusy(button, true, 'Testing…'); try { const result = await api(`/api/v2/accounts/${encodeURIComponent(button.dataset.test)}/test`, { method: 'POST' }); toast(result.message, result.connected ? 'ok' : 'warn', 6000); await refreshAccounts(true, true); drawAccounts(); } catch (error) { toast(error.message, 'error'); } finally { setBusy(button, false); }
    });
    root().querySelectorAll('[data-sync]').forEach((button) => button.onclick = async () => {
      setBusy(button, true, 'Queueing…'); try { await api(`/api/v2/accounts/${encodeURIComponent(button.dataset.sync)}/sync`, { method: 'POST' }); toast('Sync request queued to the selected Reporter account.'); } catch (error) { toast(error.message, 'error'); } finally { setBusy(button, false); }
    });
    root().querySelectorAll('[data-disconnect]').forEach((button) => button.onclick = async () => { try { await api(`/api/v2/accounts/${encodeURIComponent(button.dataset.disconnect)}/disconnect`, { method: 'POST' }); await refreshAccounts(true, true); drawAccounts(); } catch (error) { toast(error.message, 'error'); } });
    root().querySelectorAll('[data-delete-account]').forEach((button) => button.onclick = async () => {
      if (!confirm('Delete this account and every Culture Lane attached to it?')) return;
      try { await api(`/api/v2/accounts/${encodeURIComponent(button.dataset.deleteAccount)}`, { method: 'DELETE' }); toast('Account deleted'); await refreshAccounts(false, true); drawAccounts(); } catch (error) { toast(error.message, 'error'); }
    });
  }

  async function drawRules() {
    const [result, leadResult] = await Promise.all([api('/api/v2/copier-rules'), api('/api/v2/community/leads')]);
    const rules = result.rules || []; const leaders = leadResult.leads || accounts.filter((account) => account.role === 'master');
    const byId = Object.fromEntries([...accounts, ...leaders].map((account) => [account.id, account]));
    root().innerHTML = `
      <div class="workspace-heading"><div><span class="eyebrow">Culture Relay Engine</span><h1>Copier Rules</h1><p class="muted">All account dropdowns use the same Reporter-backed account list as the dashboard.</p></div></div>${accountMetrics(selectedAccount())}
      <section class="card"><form id="rule-form" class="grid2">
        <label>Culture Lead<select class="input" name="master_id" required><option value="">Select master</option>${leaders.map((account) => `<option value="${html(account.id)}">${html(account.community_name || accountLabel(account))} · ${html(account.access || 'owned')}</option>`).join('')}</select></label>
        <label>Mirror Receiver<select class="input" name="slave_id" required><option value="">Select follower</option>${accountOptions('any')}</select></label>
        <label>Risk type<select class="input" name="risk_type">${RISK_TYPES.map((type) => `<option value="${type}">${type.replaceAll('_', ' ')}</option>`).join('')}</select></label>
        <label>Risk value<input class="input" name="risk_value" type="number" min="0.01" max="100" step="0.01" value="1"></label>
        <label>Minimum lot<input class="input" name="min_lot" type="number" min="0.01" max="100" step="0.01" value="0.01"></label>
        <label>Maximum lot<input class="input" name="max_lot" type="number" min="0.01" max="100" step="0.01" value="100"></label>
        <label>Equity protection %<input class="input" name="equity_protection_pct" type="number" min="0" max="100" step="0.1" placeholder="10"></label>
        <label>Max daily loss<input class="input" name="max_daily_loss" type="number" min="0" step="0.01"></label>
        <label>Max open trades<input class="input" name="max_open_trades" type="number" min="1" max="500" step="1"></label>
        <label>Max spread points<input class="input" name="max_spread_points" type="number" min="0" step="1"></label>
        <label>Max slippage points<input class="input" name="max_slippage_points" type="number" min="0" step="1"></label>
        <label>Trading start<input class="input" name="trading_hours_start" type="time"></label><label>Trading end<input class="input" name="trading_hours_end" type="time"></label>
        <label class="full">Allowed symbols<input class="input" name="allowed_symbols" placeholder="XAUUSD, GBPJPY, NAS100"></label>
        <label class="full">Symbol mapping<textarea class="input" name="symbol_mapping" placeholder='{"GOLD":"XAUUSD","USTEC":"NAS100"}'></textarea></label>
        <label><input type="checkbox" name="auto_match_symbols" checked> Auto-match preview</label><label><input type="checkbox" name="copy_sl_tp" checked> Copy SL/TP</label><label><input type="checkbox" name="copy_pending_orders" checked> Copy pending orders</label><label><input type="checkbox" name="reverse_signals"> Reverse signals</label>
        <div id="rule-status" class="form-status full">Ready.</div><button class="btn primary full" id="save-rule" type="submit">Save Culture Lane</button>
      </form></section>
      <section class="grid2" style="margin-top:18px">${rules.length ? rules.map((rule) => { const master = byId[rule.master_id]; const follower = byId[rule.slave_id]; return `<article class="card"><span class="status-pill ${rule.is_active ? 'connected' : 'waiting'}">${rule.is_active ? 'active' : 'paused'}</span><h3>${html(master?.nickname || master?.account_number || rule.master_id)} → ${html(follower?.nickname || follower?.account_number || rule.slave_id)}</h3><p>${html(rule.risk_type)} · ${html(rule.risk_value)}</p><p class="muted">${html((rule.allowed_symbols || []).join(', ') || 'All symbols')}</p><div class="actions"><button class="btn ghost" data-toggle="${html(rule.id)}">${rule.is_active ? 'Pause' : 'Resume'}</button><button class="btn danger" data-delete-rule="${html(rule.id)}">Delete</button></div></article>`; }).join('') : '<div class="card"><h3>No Culture Lanes yet</h3><p>Choose a lead and receiver above, then save the route.</p></div>'}</section>`;
    document.querySelector('#rule-form').onsubmit = async (event) => {
      event.preventDefault(); const form = new FormData(event.target); const payload = Object.fromEntries(form); const button = document.querySelector('#save-rule'); const status = document.querySelector('#rule-status');
      payload.allowed_symbols = String(payload.allowed_symbols || '').split(/[;,\s]+/).filter(Boolean); payload.copy_sl_tp = form.has('copy_sl_tp'); payload.copy_pending_orders = form.has('copy_pending_orders'); payload.reverse_signals = form.has('reverse_signals'); payload.auto_match_symbols = form.has('auto_match_symbols');
      try { payload.symbol_mapping = JSON.parse(payload.symbol_mapping || '{}'); } catch { status.className = 'form-status error full'; status.textContent = 'Symbol mapping must be valid JSON.'; return; }
      setBusy(button, true, 'Saving lane…'); try { await api('/api/v2/copier-rules', { method: 'POST', body: JSON.stringify(payload) }); toast('Culture Lane saved'); await drawRules(); } catch (error) { status.className = 'form-status error full'; status.textContent = error.message; } finally { setBusy(button, false); }
    };
    root().querySelectorAll('[data-toggle]').forEach((button) => button.onclick = async () => { await api(`/api/v2/copier-rules/${encodeURIComponent(button.dataset.toggle)}/toggle`, { method: 'POST', body: '{}' }); drawRules(); });
    root().querySelectorAll('[data-delete-rule]').forEach((button) => button.onclick = async () => { if (!confirm('Delete this Culture Lane?')) return; await api(`/api/v2/copier-rules/${encodeURIComponent(button.dataset.deleteRule)}`, { method: 'DELETE' }); toast('Culture Lane deleted'); drawRules(); });
  }

  async function drawTrades() {
    const accountId = selectedAccountId(); const result = await api(`/api/v2/trades${accountId ? `?account_id=${encodeURIComponent(accountId)}` : ''}`); const trades = result.trades || [];
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">Execution proof</span><h1>Trade Log</h1><p class="muted">${accountId ? 'Filtered to the selected account.' : 'Showing portfolio trades.'}</p></div><div class="actions"><button class="btn danger" id="close-all">Close all selected</button><button class="btn ghost" id="refresh-trades">Refresh</button></div></div>${accountMetrics(selectedAccount())}<section class="card table-wrap"><table><thead><tr><th>Time</th><th>Account</th><th>Symbol</th><th>Side</th><th>Lots</th><th>Status</th><th>P/L</th><th>Control</th></tr></thead><tbody>${trades.map((trade) => `<tr><td>${html(trade.opened_at || '')}</td><td>${html(trade.account_id)}</td><td>${html(trade.symbol)}</td><td>${html(trade.side)}</td><td>${html(trade.lot_size)}</td><td>${html(trade.status)}</td><td class="${Number(trade.pnl || 0) >= 0 ? 'green' : 'red'}">${money(trade.pnl)}</td><td>${trade.status === 'open' ? `<button class="btn ghost" data-close="${html(trade.id)}">Close</button>` : ''}</td></tr>`).join('')}</tbody></table></section>`;
    document.querySelector('#refresh-trades').onclick = drawTrades;
    root().querySelectorAll('[data-close]').forEach((button) => button.onclick = async () => { if (!confirm('Queue a close for this ticket?')) return; try { await api(`/api/v2/trades/${encodeURIComponent(button.dataset.close)}/close`, { method: 'POST', body: JSON.stringify({ confirmation: 'confirmed' }) }); toast('Ticket close queued'); } catch (error) { toast(error.message, 'error'); } });
    document.querySelector('#close-all').onclick = async () => { const target = selectedAccountId(); if (!target) return toast('Select the target account first.', 'warn'); if (!confirm('Close every open trade on the selected account?')) return; try { await api('/api/v2/trades/close-all', { method: 'POST', body: JSON.stringify({ account_id: target, confirmation: 'confirmed' }) }); toast('Account-specific Close All queued'); } catch (error) { toast(error.message, 'error'); } };
  }

  async function drawAnalyzer() {
    const accountId = selectedAccountId(); const result = await api(`/api/v2/analyzer/portfolio?period=month${accountId ? `&account_id=${encodeURIComponent(accountId)}` : ''}`); const heat = await api('/api/v2/analyzer/heatmap'); const series = result.series || [];
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">WISDO Insight Engine</span><h1>Performance Intelligence</h1><p class="muted">Account-aware intelligence tied directly to the selected Reporter account.</p></div><div class="actions"><a class="btn ghost" href="/api/v2/analyzer/export.csv">Export CSV</a><button class="btn primary" id="risk-suggestion">AI risk suggestion</button></div></div>${accountMetrics(selectedAccount())}<div class="grid4"><div class="card"><small>ROI</small><div class="metric green">${Number(result.roi || 0).toFixed(2)}%</div></div><div class="card"><small>Win rate</small><div class="metric">${Number(result.winRate || 0).toFixed(1)}%</div></div><div class="card"><small>Max drawdown</small><div class="metric red">${Number(result.maxDrawdown || 0).toFixed(2)}%</div></div><div class="card"><small>Trades</small><div class="metric">${Number(result.tradeCount || 0)}</div></div></div><div class="grid2" style="margin-top:18px"><section class="card"><h3>Equity curve</h3><div class="mini-chart">${series.map((point) => `<i title="${html(point.date)}" style="height:${Math.max(5, Math.min(250, Number(point.value || 0)))}px"></i>`).join('')}</div></section><section class="card"><h3>Symbol heatmap</h3>${(heat.symbols || []).length ? heat.symbols.slice(0, 10).map((row) => `<div class="heat-row"><span>${html(row.symbol)}</span><strong class="${Number(row.pnl) >= 0 ? 'green' : 'red'}">${money(row.pnl)}</strong></div>`).join('') : '<p class="muted">Closed trades will populate symbol performance.</p>'}</section></div><div id="insight"></div>`;
    document.querySelector('#risk-suggestion').onclick = async () => { const target = selectedAccountId() || accounts[0]?.id; if (!target) return toast('Add an account first.', 'warn'); const suggestion = await api('/api/v2/ai/risk-suggestion', { method: 'POST', body: JSON.stringify({ account_id: target }) }); document.querySelector('#insight').innerHTML = `<div class="card"><h3>Suggested controls</h3><pre>${html(JSON.stringify(suggestion.suggestion, null, 2))}</pre><p>${html(suggestion.reason)}</p></div>`; };
  }

  async function drawAlerts() {
    const result = await api('/api/v2/alerts'); const alerts = result.alerts || [];
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">Notification center</span><h1>Alerts</h1></div><button class="btn ghost" id="read-all">Mark all read</button></div><div class="grid2">${alerts.length ? alerts.map((alert) => `<article class="card"><span class="eyebrow">${html(alert.type)}</span><h3>${html(alert.title)}</h3><p>${html(alert.body)}</p><small class="muted">${html(alert.created_at)}</small></article>`).join('') : '<div class="card"><h3>No alerts</h3><p>Trade, drawdown, equity protection, billing, and system alerts appear here.</p></div>'}</div>`;
    document.querySelector('#read-all').onclick = async () => { await api('/api/v2/alerts/read-all', { method: 'POST', body: '{}' }); toast('Alerts marked read'); drawAlerts(); };
  }

  async function drawEducation() {
    const tracks = await api('/api/v2/academy/tracks').catch(() => ({ tracks: [], progress: {} }));
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">WISDO Academy</span><h1>Interactive Trading School</h1><p class="muted">Chart replay, guided video checkpoints, DF Sauce bot-brain decisions, TradingView watch room, and Pine explanation lab—all inside the member command center.</p></div><div class="academy-progress"><strong>${Number(tracks.progress?.score || 0)}</strong><span>academy points</span></div></div><div id="df-academy"></div><section class="card" style="margin-top:18px"><h3>Learning tracks</h3><div class="grid4">${(tracks.tracks || []).map((track) => `<div class="track-card"><span class="eyebrow">${html(track.id)}</span><h3>${html(track.title)}</h3><p>${track.lessons.length} lessons</p></div>`).join('')}</div></section>`;
    window.DFSauceAcademy?.mount(document.querySelector('#df-academy'), { bot: new URLSearchParams(location.search).get('bot') || '' });
  }

  async function drawAffiliate() {
    const result = await api('/api/v2/affiliate');
    root().innerHTML = `<span class="eyebrow">Growth engine</span><h1>Affiliate Desk</h1><div class="grid3"><div class="card"><small>Referral code</small><div class="metric">${html(result.code)}</div></div><div class="card"><small>Conversions</small><div class="metric">${Number(result.conversions || 0)}</div></div><div class="card"><small>Available</small><div class="metric green">${money(result.available)}</div></div></div><section class="card" style="margin-top:18px"><h3>Your referral link</h3><input class="input" readonly value="${html(`${location.origin}/r/${result.code}`)}"><p>Activation commissions use the configured split and remain on hold through the refund window.</p></section>`;
  }

  async function drawSettings(page) {
    const me = await api('/api/v2/me'); const billing = page.includes('billing'); const profile = me.profile || {};
    if (profile.theme || profile.background) applyTheme(profile);
    root().innerHTML = billing ? `<span class="eyebrow">Subscription</span><h1>Billing</h1><section class="card"><h3>Plan control</h3><p>Choose CFD or Futures, plan tier, account count, billing cycle, WISDO Insight Engine, and Dedicated Environment from the pricing configurator.</p><a class="btn primary" href="/pricing">Configure plan</a></section>` : `
      <div class="workspace-heading"><div><span class="eyebrow">Profile, appearance, and security</span><h1>Settings</h1></div></div>
      <section class="card"><form id="profile-form" class="grid2"><label>Full name<input class="input" name="full_name" value="${html(profile.full_name || '')}"></label><label>Country<input class="input" name="country" value="${html(profile.country || '')}"></label><label>Timezone<input class="input" name="timezone" value="${html(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')}"></label><label>Email<input class="input" name="email" type="email" value="${html(profile.email || me.user?.email || '')}"></label>
      <div class="full appearance-panel"><div><span class="eyebrow">Color scheme</span><h3>Choose your command-center theme</h3></div><div class="theme-grid">${THEMES.map((theme) => `<label class="theme-choice ${theme}"><input type="radio" name="theme" value="${theme}" ${String(profile.theme || localStorage.getItem('wisdo.theme') || 'midnight') === theme ? 'checked' : ''}><span></span><strong>${theme}</strong></label>`).join('')}</div></div>
      <div class="full appearance-panel"><div><span class="eyebrow">Background</span><h3>Choose motion or a focused workspace</h3></div><div class="segments">${BACKGROUNDS.map((background) => `<label class="background-choice"><input type="radio" name="background" value="${background}" ${String(profile.background || localStorage.getItem('wisdo.background') || 'mesh') === background ? 'checked' : ''}><span>${background.replace('-', ' ')}</span></label>`).join('')}</div></div>
      <button class="btn primary full" type="submit">Save settings</button></form></section><section class="card danger-zone"><h3>Danger zone</h3><p>Account deletion removes the profile, connected account records, Culture Lanes, trades, and alerts owned by this user.</p><button class="btn danger" id="delete-profile">Delete WISDO account</button></section>`;
    const form = document.querySelector('#profile-form');
    if (form) {
      form.querySelectorAll('input[name="theme"],input[name="background"]').forEach((input) => input.onchange = () => applyTheme(Object.fromEntries(new FormData(form))));
      form.onsubmit = async (event) => { event.preventDefault(); const payload = Object.fromEntries(new FormData(event.target)); await api('/api/v2/profile', { method: 'PATCH', body: JSON.stringify(payload) }); applyTheme(payload); toast('Settings and appearance saved'); };
    }
    const deleteButton = document.querySelector('#delete-profile'); if (deleteButton) deleteButton.onclick = async () => { if (!confirm('Permanently delete your WISDO account data?')) return; await api('/api/v2/me', { method: 'DELETE' }); location.href = '/logout'; };
  }

  async function renderCurrentPage() {
    if (activeRequest) activeRequest.abort?.();
    if (currentPage === 'dashboard') await drawDashboard();
    else if (currentPage === 'accounts') drawAccounts();
    else if (currentPage === 'copier-engine') await drawRules();
    else if (currentPage === 'trades') await drawTrades();
    else if (currentPage === 'analyzer') await drawAnalyzer();
    else if (currentPage === 'alerts') await drawAlerts();
    else if (currentPage === 'affiliate') await drawAffiliate();
    else if (currentPage === 'settings' || currentPage === 'settings/billing') await drawSettings(currentPage);
    else if (currentPage === 'education') await drawEducation();
  }

  async function boot() {
    const bootingDashboard = beginDashboardBoot();
    try {
      applyTheme({});
      if (bootingDashboard) setDashboardBootStage('Authenticating member desk…', 19, 'Security 02');
      const mePromise = api('/api/v2/me').catch(() => null);
      if (bootingDashboard) setDashboardBootStage('Synchronizing connected Reporter accounts…', 38, 'Relay 03');
      await refreshAccounts(true, true);
      if (bootingDashboard) setDashboardBootStage(`${accounts.length} account${accounts.length === 1 ? '' : 's'} hydrated · checking command authority…`, 62, 'Accounts 04');
      const me = await mePromise;
      if (me?.profile) applyTheme(me.profile);
      if (bootingDashboard) setDashboardBootStage('Loading health gauges, copier state, and live metrics…', 82, 'Dashboard 05');
      await renderCurrentPage();
      if (bootingDashboard) await finishDashboardBoot(true);
      accountPoll = setInterval(async () => {
        if (document.querySelector('dialog[open]') || document.visibilityState !== 'visible') return;
        const previous = JSON.stringify(accounts.map((a) => [a.id, a.status, a.equity, a.last_sync_at]));
        try { await refreshAccounts(true, true); const next = JSON.stringify(accounts.map((a) => [a.id, a.status, a.equity, a.last_sync_at])); if (next !== previous && ['dashboard', 'analyzer', 'trades'].includes(currentPage)) await renderCurrentPage(); } catch {}
      }, 15000);
    } catch (error) {
      await finishDashboardBoot(false, 'Workspace recovery mode');
      root().innerHTML = `<div class="card"><h3>Could not load workspace</h3><p class="red">${html(error.message)}</p><button class="btn ghost" onclick="location.reload()">Retry</button></div>`;
    }
  }

  window.addEventListener('beforeunload', () => { if (accountPoll) clearInterval(accountPoll); });
  window.bootWorkspace = boot;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  boot();
})();
