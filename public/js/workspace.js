(() => {
  'use strict';

  const PLATFORMS = ['mt4', 'mt5', 'ctrader', 'matchtrader', 'tradelocker', 'dxtrade', 'ninjatrader', 'tradovate', 'projectx', 'rithmic'];
  const RISK_TYPES = ['fixed_lot', 'multiplier', 'equity_ratio', 'balance_ratio'];
  const THEMES = ['midnight', 'cobalt', 'emerald', 'violet', 'gold', 'ember', 'light'];
  const BACKGROUNDS = ['mesh', 'terminal', 'motion-a', 'motion-b', 'solid'];
  const DESK_ROLES = ['private', 'lead', 'receiver', 'dual'];
  const SHARING_MODES = ['private', 'shared', 'community'];
  let accounts = [];
  let currentPage = window.WISDO_PAGE || 'command-center';
  let accountPoll = null;
  let activeRequest = null;
  const launchParams = new URLSearchParams(location.search);
  const dashboardBootRequested = ['command-center', 'dashboard'].includes(currentPage) && (
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

  async function api(path, options = {}, timeoutMs = 25000) {
    const method = String(options.method || 'GET').toUpperCase();
    const safeToRetry = ['GET', 'HEAD'].includes(method);
    const attempts = safeToRetry ? 3 : 1;
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs + (attempt - 1) * 8000);
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
        if (!response.ok) {
          const error = new Error(payload.error || payload.message || `Request failed (${response.status})`);
          error.status = response.status;
          throw error;
        }
        return payload;
      } catch (error) {
        lastError = error;
        const transient = error.name === 'AbortError' || /timed out|failed to fetch|network/i.test(error.message || '') || [502, 503, 504].includes(error.status);
        if (!safeToRetry || !transient || attempt >= attempts) break;
        toast(attempt === 1 ? 'Waking the WISDO server and retrying…' : 'Server is still waking; retrying once more…', 'warn', 2600);
        await fetch('/api/public/health', { cache: 'no-store' }).catch(() => null);
        await sleep(attempt * 900);
      } finally {
        clearTimeout(timeout);
      }
    }
    if (lastError?.name === 'AbortError' || /timed out/i.test(lastError?.message || '')) throw new Error('The server did not answer after automatic wake-up retries. Your form was not submitted.');
    throw lastError || new Error('Request failed.');
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

  function deskRole(account = {}) {
    const role = String(account.desk_role || account.role || 'private').toLowerCase();
    if (['master', 'leader', 'culture_lead', 'lead'].includes(role)) return 'lead';
    if (['slave', 'follower', 'mirror_receiver', 'receiver'].includes(role)) return 'receiver';
    if (['dual', 'both'].includes(role)) return 'dual';
    return 'private';
  }

  function roleLabel(account = {}) {
    return ({ private: 'Private Desk', lead: 'Culture Lead', receiver: 'Mirror Receiver', dual: 'Lead + Receiver' })[deskRole(account)] || 'Private Desk';
  }

  function accountCanLead(account = {}) { return ['lead', 'dual'].includes(deskRole(account)) || account.can_lead === true; }
  function accountCanReceive(account = {}) { return ['receiver', 'dual'].includes(deskRole(account)) || account.can_receive === true; }

  function sharingLabel(account = {}) {
    const mode = String(account.sharing_mode || (account.community_visible ? 'community' : 'private')).toLowerCase();
    return ({ private: 'Private', shared: 'Shared by approval', community: 'Community discoverable' })[mode] || 'Private';
  }

  function accountLabel(account) {
    const base = account.nickname || account.broker || account.platform || 'Trading account';
    const status = account.reporter_connected || reporterFresh(account) ? 'LIVE' : account.status === 'awaiting_reporter' ? 'PAIR' : String(account.status || '').toUpperCase();
    return `${base} · ${account.account_number || account.id} · ${roleLabel(account)} · ${status}`;
  }

  async function refreshAccounts(preserveSelection = true, silent = false) {
    const previous = preserveSelection ? (selectedAccountId() || sessionStorage.getItem('wisdo.selectedAccountId') || '') : '';
    const result = await api('/api/v2/accounts?includeReporter=1', {}, 25000);
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

  function accountOptions(capability = 'any', source = accounts) {
    return source.filter((account) => capability === 'any' || (capability === 'lead' ? accountCanLead(account) : capability === 'receiver' ? accountCanReceive(account) : deskRole(account) === capability))
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


  async function drawCommandCenter() {
    const active = selectedAccount();
    const accountId = active?.id || '';
    const stats = await api(`/api/v2/analyzer/portfolio?period=month${accountId ? `&account_id=${encodeURIComponent(accountId)}` : ''}`).catch(() => ({}));
    const liveAccounts = accounts.filter((account) => account.reporter_connected || reporterFresh(account));
    root().innerHTML = `
      <div class="workspace-heading"><div><span class="eyebrow">WISDO operating system</span><h1>Command Center</h1><p class="muted">The central launch screen for accounts, relay execution, risk, analytics, education, signals, AI, and support.</p></div><div class="live-chip">${liveAccounts.length}/${accounts.length} Reporter accounts live</div></div>
      ${accountMetrics(active)}
      <div class="command-hub">
        <section class="card"><div class="card-head"><div><span class="eyebrow">System map</span><h3>Choose an operating lane</h3></div><a class="btn ghost" href="/app/dashboard?launch=1">Open live dashboard</a></div>
          <div class="command-map">
            <a class="command-module" href="/app/accounts"><strong>Account Desk</strong><small>Pair, sync, switch, and diagnose Reporter-backed accounts.</small></a>
            <a class="command-module" href="/app/copier-engine"><strong>Culture Relay</strong><small>Build lead-to-follower lanes and govern close authority.</small></a>
            <a class="command-module" href="/app/culture-lanes"><strong>Culture Lane Vault</strong><small>See every lane, combined equity, health, and parallel lane-close controls.</small></a>
            <a class="command-module" href="/app/symbol-routing"><strong>Symbol Highlights</strong><small>Click leader-traded symbols green to allow or grey to block per lane.</small></a>
            <a class="command-module" href="/app/harvest"><strong>Harvest Mode</strong><small>Configure lane profit goals and confirmation-gated parallel harvesting.</small></a>
            <a class="command-module" href="/app/lane-audit"><strong>Genome · Timeline · Passports</strong><small>Inspect configuration versions and immutable execution history.</small></a>
            <a class="command-module" href="/app/lane-intelligence"><strong>Lane DNA + Intelligence</strong><small>Generate behavior metrics, observations, and recommendations.</small></a>
            <a class="command-module" href="/app/compound-tracker"><strong>Compound Tracker</strong><small>Review finalized daily and weekly growth cycles.</small></a>
            <a class="command-module" href="/app/trades"><strong>Trade Control</strong><small>Review open positions, history, and account-specific close actions.</small></a>
            <a class="command-module" href="/app/analyzer"><strong>Insight Engine</strong><small>ROI, drawdown, win rate, equity curves, and performance heatmaps.</small></a>
            <a class="command-module" href="/app/education"><strong>Adaptive Academy</strong><small>6,500 structured courses, interactive labs, and an AI tutor.</small></a>
            <a class="command-module" href="/app/alerts"><strong>Alerts and Health</strong><small>Relay, risk, billing, and platform notifications.</small></a>
            <a class="command-module" href="/member/signal-grid"><strong>Signal Grid</strong><small>Review and route controlled community trade opportunities.</small></a>
            <a class="command-module" href="/member/simulator"><strong>Simulator</strong><small>Practice without placing live-money orders.</small></a>
            <a class="command-module" href="/member/ai"><strong>WISDO AI</strong><small>Ask account-aware education and operating questions.</small></a>
            <a class="command-module" href="/app/settings"><strong>Appearance and Settings</strong><small>Choose the color scheme, motion background, and profile controls.</small></a>
            <a class="command-module" href="/app/affiliate"><strong>Affiliate Desk</strong><small>Referral links, activation, commissions, and payout readiness.</small></a>
            <a class="command-module" href="/member/support/tickets"><strong>Support Desk</strong><small>Open a ticket with account and command context.</small></a>
          </div>
        </section>
        <aside class="card"><span class="eyebrow">Desk pulse</span><h3>${active ? html(active.nickname || active.broker || active.account_number) : 'Portfolio overview'}</h3>
          <div class="path-list">
            <div class="path-item"><small class="muted">Reporter status</small><strong class="${active && (active.reporter_connected || reporterFresh(active)) ? 'green' : 'red'}">${active ? (active.reporter_connected || reporterFresh(active) ? 'Live' : 'Needs heartbeat') : `${liveAccounts.length} live accounts`}</strong></div>
            <div class="path-item"><small class="muted">Monthly ROI view</small><strong>${Number(stats.roi || 0).toFixed(2)}%</strong></div>
            <div class="path-item"><small class="muted">Maximum drawdown</small><strong class="${Number(stats.maxDrawdown || 0) > 10 ? 'red' : ''}">${Number(stats.maxDrawdown || 0).toFixed(2)}%</strong></div>
            <div class="path-item"><small class="muted">Open positions</small><strong>${Number(active?.open_trades || 0)}</strong></div>
          </div>
          <div class="actions"><a class="btn primary" href="/app/copier-engine">Open relay controls</a><a class="btn ghost" href="/app/education">Continue learning</a></div>
        </aside>
      </div>`;
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
    const roleOptions = (selected) => DESK_ROLES.map((role) => `<option value="${role}" ${role === selected ? 'selected' : ''}>${({ private: 'Private Desk', lead: 'Culture Lead', receiver: 'Mirror Receiver', dual: 'Lead + Receiver' })[role]}</option>`).join('');
    const sharingOptions = (selected) => SHARING_MODES.map((mode) => `<option value="${mode}" ${mode === selected ? 'selected' : ''}>${({ private: 'Private', shared: 'Shared by approval', community: 'Community discoverable' })[mode]}</option>`).join('');
    root().innerHTML = `
      <div class="workspace-heading"><div><span class="eyebrow">Connections</span><h1>Trading Accounts</h1><p class="muted">Every app screen and copier dropdown uses the same Reporter-backed account identity. Assign explicit capabilities instead of relying on legacy master/slave labels.</p></div><button class="btn primary" id="add-account">Add account</button></div>
      <div class="grid3">${accounts.length ? accounts.map((account) => {
        const warnings = account.capabilityWarnings || [];
        return `<article class="card account-card">
          <div class="card-head"><span class="status-pill ${account.reporter_connected || reporterFresh(account) ? 'connected' : 'waiting'}">${account.reporter_connected || reporterFresh(account) ? 'Reporter live' : html(account.status || 'waiting')}</span><span class="muted">${html(String(account.platform || 'mt4').toUpperCase())}</span></div>
          <h3>${html(account.nickname || account.broker || account.platform)} · ${html(account.account_number)}</h3>
          <p>${html(roleLabel(account))} · ${html(account.server || 'server pending')}</p>
          <div class="capability-row"><span class="status-pill ${account.canLead ? 'connected' : 'waiting'}">Lead ${account.canLead ? '✓' : '—'}</span><span class="status-pill ${account.canReceive ? 'connected' : 'waiting'}">Receive ${account.canReceive ? '✓' : '—'}</span><span class="status-pill ${account.canExecute ? 'connected' : 'waiting'}">Execute ${account.canExecute ? '✓' : '—'}</span></div>
          <div class="metric">${money(account.equity)}</div>
          <small class="muted">Balance ${money(account.balance)} · Floating ${money(account.floating_pl)} · Open ${Number(account.open_trades || 0)}</small>
          <div class="account-heartbeat"><span>Last heartbeat</span><strong>${html(account.last_sync_at ? new Date(account.last_sync_at).toLocaleString() : 'Never')}</strong></div>
          ${account.pairing_code ? `<div class="pairing-code"><small>Pairing code</small><code>${html(account.pairing_code)}</code><button class="btn ghost" data-copy-code="${html(account.pairing_code)}">Copy</button></div>` : ''}
          <form class="account-role-form" data-role-account="${html(account.id)}"><label>Desk capability<select class="input" name="desk_role">${roleOptions(deskRole(account))}</select></label><label>Visibility<select class="input" name="sharing_mode">${sharingOptions(String(account.sharing_mode || 'private'))}</select></label><label class="full">Community label<input class="input" name="community_name" value="${html(account.community_name || account.nickname || '')}" placeholder="Optional public lead name"></label><button class="btn ghost full" type="submit">Save account role</button></form>
          ${warnings.length ? `<div class="setup-note"><strong>Readiness</strong><ul>${warnings.map((warning) => `<li>${html(warning)}</li>`).join('')}</ul></div>` : ''}
          <div class="actions"><button class="btn ghost" data-test="${html(account.id)}">Test</button><button class="btn ghost" data-sync="${html(account.id)}">Sync</button><button class="btn ghost" data-disconnect="${html(account.id)}">Disconnect</button><button class="btn danger" data-delete-account="${html(account.id)}">Delete</button></div>
        </article>`;
      }).join('') : '<div class="card"><h3>No accounts connected</h3><p>Add an account. WISDO saves the identity, creates a Reporter-compatible account ID, and shows pairing status instead of freezing.</p></div>'}</div>
      <dialog id="account-dialog"><form class="card dialog-form" id="account-form">
        <div class="card-head"><div><span class="eyebrow">Secure account onboarding</span><h3>Add trading account</h3></div><button class="dialog-x" type="button" id="cancel-account" aria-label="Close">×</button></div>
        <div class="setup-note"><strong>How connection works</strong><p>WISDO stores the account identity and optional encrypted credential vault. MT4/MT5 execution becomes live only after the Reporter sends a heartbeat with the same account number and server.</p></div>
        <div class="grid2"><label>Platform<select class="input" name="platform">${PLATFORMS.map((platform) => `<option value="${platform}">${platform.toUpperCase()}</option>`).join('')}</select></label>
        <label>Desk capability<select class="input" name="desk_role"><option value="private">Private Desk</option><option value="lead">Culture Lead</option><option value="receiver">Mirror Receiver</option><option value="dual">Lead + Receiver</option></select></label>
        <label>Visibility<select class="input" name="sharing_mode"><option value="private">Private</option><option value="shared">Shared by approval</option><option value="community">Community discoverable</option></select></label>
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
    root().querySelectorAll('[data-role-account]').forEach((form) => form.onsubmit = async (event) => {
      event.preventDefault(); const button = form.querySelector('button[type="submit"]'); const payload = Object.fromEntries(new FormData(form));
      setBusy(button, true, 'Saving role…');
      try { await api(`/api/v2/accounts/${encodeURIComponent(form.dataset.roleAccount)}/desk-role`, { method: 'PATCH', body: JSON.stringify(payload) }); toast('Account capabilities updated'); await refreshAccounts(true, true); drawAccounts(); }
      catch (error) { toast(error.message, 'error', 7000); }
      finally { setBusy(button, false); }
    });
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
    const [ruleResult, options, relayDiagnostics] = await Promise.all([
      api('/api/v2/copier-rules', {}, 20000),
      api('/api/copier/options', {}, 30000),
      api('/api/v2/copier/diagnostics', {}, 30000).catch(() => ({ rules: [], relayDiagnostics: [] })),
    ]);
    const rules = ruleResult.rules || [];
    const leaders = options.leads || [];
    const receivers = options.receivers || [];
    const allVisible = [...(options.accounts || []), ...leaders, ...receivers];
    const byId = Object.fromEntries(allVisible.map((account) => [account.id, account]));
    const diagnostics = options.diagnostics || [];
    const relayByRule = Object.fromEntries((relayDiagnostics.rules || []).map((row) => [row.ruleId, row]));
    const noRouteReady = !leaders.length || !receivers.length;
    root().innerHTML = `
      <div class="workspace-heading"><div><span class="eyebrow">Culture Relay Engine</span><h1>Copier Rules</h1><p class="muted">Lead and receiver dropdowns, live routes, and MT4 execution diagnostics use the same Reporter-backed registry.</p></div><button class="btn ghost" id="refresh-copier-options">Refresh relay state</button></div>${accountMetrics(selectedAccount())}
      <div class="grid4"><div class="card"><small>Owned accounts</small><div class="metric">${Number(options.summary?.owned || 0)}</div></div><div class="card"><small>Available leads</small><div class="metric">${Number(options.summary?.leads || 0)}</div></div><div class="card"><small>Receivers</small><div class="metric">${Number(options.summary?.receivers || 0)}</div></div><div class="card"><small>Live receivers</small><div class="metric green">${Number(options.summary?.executableReceivers || 0)}</div></div></div>
      ${diagnostics.length ? `<section class="card" style="margin-top:18px"><span class="eyebrow">Account capability diagnostics</span><div class="path-list">${diagnostics.map((item) => `<div class="path-item"><small>${html(item.code || item.severity || 'notice')}</small><strong>${html(item.message)}</strong>${item.accountId ? `<a href="/app/accounts">Fix account role</a>` : ''}</div>`).join('')}</div></section>` : ''}
      <section class="card" style="margin-top:18px"><form id="rule-form" class="grid2">
        <label>Culture Lead<select class="input" name="master_id" required><option value="">Select Culture Lead</option>${leaders.map((account) => `<option value="${html(account.id)}">${html(account.community_name || accountLabel(account))} · ${html(account.access || 'owned')}</option>`).join('')}</select></label>
        <label>Mirror Receiver<select class="input" name="slave_id" required><option value="">Select owned receiver</option>${receivers.map((account) => `<option value="${html(account.id)}">${html(accountLabel(account))}${account.canExecute ? ' · LIVE' : ' · pairing needed'}</option>`).join('')}</select></label>
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
        <div id="rule-status" class="form-status full">${noRouteReady ? 'Assign at least one Culture Lead and one owned Mirror Receiver on the Accounts page.' : 'Ready to register this lane in the live relay engine.'}</div><button class="btn primary full" id="save-rule" type="submit" ${noRouteReady ? 'disabled' : ''}>Save and arm Culture Lane</button>
      </form></section>
      <section class="grid2" style="margin-top:18px">${rules.length ? rules.map((rule) => {
        const master = byId[rule.master_id]; const follower = byId[rule.slave_id]; const relay = relayByRule[rule.id] || {};
        const stateClass = relay.executionReady ? 'connected' : rule.is_active ? 'waiting' : 'waiting';
        const stateText = relay.executionReady ? 'execution ready' : rule.is_active ? 'active · needs attention' : 'paused';
        return `<article class="card"><span class="status-pill ${stateClass}">${stateText}</span><h3>${html(master?.nickname || master?.account_number || rule.master_id)} → ${html(follower?.nickname || follower?.account_number || rule.slave_id)}</h3><p>${html(rule.risk_type)} · ${html(rule.risk_value)}</p><p class="muted">${html((rule.allowed_symbols || []).join(', ') || 'All symbols')}</p><div class="capability-row"><span class="status-pill ${relay.relayRegistered ? 'connected' : 'waiting'}">Relay ${relay.relayRegistered ? 'registered' : 'missing'}</span><span class="status-pill ${follower?.canExecute ? 'connected' : 'waiting'}">Receiver ${follower?.canExecute ? 'live' : 'not ready'}</span><span class="status-pill">Commands ${Number(relay.recentCopyCommands?.length || 0)}</span></div>${relay.issues?.length ? `<div class="setup-note"><strong>Why it may not copy</strong><ul>${relay.issues.map((issue) => `<li>${html(issue)}</li>`).join('')}</ul></div>` : ''}<div class="actions"><button class="btn ghost" data-toggle="${html(rule.id)}">${rule.is_active ? 'Pause' : 'Resume'}</button><button class="btn danger" data-delete-rule="${html(rule.id)}">Delete</button></div></article>`;
      }).join('') : '<div class="card"><h3>No Culture Lanes yet</h3><p>Assign explicit capabilities on Accounts, then choose a lead and receiver here.</p></div>'}</section>`;
    document.querySelector('#refresh-copier-options').onclick = async () => { await refreshAccounts(true, true); drawRules(); };
    document.querySelector('#rule-form').onsubmit = async (event) => {
      event.preventDefault(); const form = new FormData(event.target); const payload = Object.fromEntries(form); const button = document.querySelector('#save-rule'); const status = document.querySelector('#rule-status');
      payload.allowed_symbols = String(payload.allowed_symbols || '').split(/[;,\s]+/).filter(Boolean); payload.copy_sl_tp = form.has('copy_sl_tp'); payload.copy_pending_orders = form.has('copy_pending_orders'); payload.reverse_signals = form.has('reverse_signals'); payload.auto_match_symbols = form.has('auto_match_symbols');
      try { payload.symbol_mapping = JSON.parse(payload.symbol_mapping || '{}'); } catch { status.className = 'form-status error full'; status.textContent = 'Symbol mapping must be valid JSON.'; return; }
      setBusy(button, true, 'Saving and arming lane…');
      try {
        const saved = await api('/api/v2/copier-rules', { method: 'POST', body: JSON.stringify(payload) }, 45000);
        status.className = saved.executionReady ? 'form-status success full' : 'form-status working full';
        status.textContent = saved.executionReady ? 'Culture Lane saved and registered in the live relay engine.' : 'Lane saved, but Reporter execution is not ready. Open Accounts to finish pairing or AutoTrading.';
        toast(saved.executionReady ? 'Culture Lane armed for live relay' : 'Culture Lane saved; execution readiness needs attention', saved.executionReady ? 'ok' : 'warn', 7000);
        setTimeout(() => {
          drawRules().catch((refreshError) => {
            toast(`Culture Lane saved, but relay status refresh is still loading: ${refreshError.message}`, 'warn', 7000);
          });
        }, 250);
      } catch (error) { status.className = 'form-status error full'; status.textContent = error.message; }
      finally { setBusy(button, false); }
    };
    root().querySelectorAll('[data-toggle]').forEach((button) => button.onclick = async () => { await api(`/api/v2/copier-rules/${encodeURIComponent(button.dataset.toggle)}/toggle`, { method: 'POST', body: '{}' }); drawRules(); });
    root().querySelectorAll('[data-delete-rule]').forEach((button) => button.onclick = async () => { if (!confirm('Delete this Culture Lane?')) return; await api(`/api/v2/copier-rules/${encodeURIComponent(button.dataset.deleteRule)}`, { method: 'DELETE' }); toast('Culture Lane deleted'); drawRules(); });
  }

  function gaugeCard(label, value, { min = 0, max = 100, suffix = '', inverse = false } = {}) {
    const numeric = Number(value || 0);
    const normalized = Math.max(0, Math.min(1, (numeric - min) / Math.max(1, max - min)));
    const dash = Math.round(normalized * 176);
    const good = inverse ? numeric <= (min + max) / 2 : numeric >= (min + max) / 2;
    return `<div class="card gauge-card"><small>${html(label)}</small><svg viewBox="0 0 120 72" role="img" aria-label="${html(`${label} ${numeric}${suffix}`)}"><path d="M14 64 A46 46 0 0 1 106 64" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="12" stroke-linecap="round" pathLength="176"></path><path d="M14 64 A46 46 0 0 1 106 64" fill="none" stroke="currentColor" class="${good ? 'green' : 'red'}" stroke-width="12" stroke-linecap="round" pathLength="176" stroke-dasharray="${dash} 176"></path></svg><div class="metric ${good ? 'green' : 'red'}">${Number.isInteger(numeric) ? numeric : numeric.toFixed(1)}${suffix}</div></div>`;
  }

  function lineChart(series = [], key = 'cumulative', label = 'Trend') {
    const values = series.map((row) => Number(row[key] || 0));
    if (!values.length) return '<div class="setup-note"><strong>Waiting for MT4 history</strong><p>The chart will populate after closed trades are imported.</p></div>';
    const min = Math.min(...values); const max = Math.max(...values); const span = Math.max(1, max - min);
    const points = values.map((value, index) => `${8 + index * (284 / Math.max(1, values.length - 1))},${112 - ((value - min) / span) * 92}`).join(' ');
    return `<svg viewBox="0 0 300 128" class="trend-line-chart" role="img" aria-label="${html(label)}"><line x1="8" y1="112" x2="292" y2="112" stroke="rgba(255,255,255,.12)"></line><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"></polyline>${values.map((value,index)=>`<circle cx="${8 + index * (284 / Math.max(1, values.length - 1))}" cy="${112 - ((value - min) / span) * 92}" r="3" fill="currentColor"><title>${html(`${series[index]?.label || ''}: ${money(value)}`)}</title></circle>`).join('')}</svg><div class="account-line"><span>Low ${money(min)}</span><span>High ${money(max)}</span></div>`;
  }

  function trackerCard(tracker) {
    if (!tracker) return '';
    const analysis = tracker.after || tracker.before || {};
    const result = tracker.result || {};
    return `<section class="card" style="margin-top:18px"><div class="card-head"><div><span class="eyebrow">Compound Tracker</span><h3>${html(tracker.label || tracker.mode || 'Close analysis')}</h3></div><span class="status-pill ${tracker.status === 'completed' ? 'connected' : tracker.status === 'failed' || tracker.status === 'queue_failed' ? 'waiting' : 'waiting'}">${html(tracker.status || 'queued')}</span></div><div class="grid4"><div><small>Closed</small><strong>${Number(result.closedCount || 0)}</strong></div><div><small>Realized</small><strong class="${Number(result.realizedPnl || 0) >= 0 ? 'green' : 'red'}">${money(result.realizedPnl)}</strong></div><div><small>Daily trend</small><strong>${Number(analysis.gauges?.dailyTrend || 0)}</strong></div><div><small>Weekly trend</small><strong>${Number(analysis.gauges?.weeklyTrend || 0)}</strong></div></div><p class="muted">${html(result.message || 'Waiting for the MT4 Reporter to execute and return the final result. This record remains saved with account history.')}</p></section>`;
  }


  async function loadCultureLanes() {
    const result = await api('/api/v2/culture-lanes');
    return result.lanes || [];
  }

  function laneIdFromLocation(lanes = []) {
    const requested = new URLSearchParams(location.search).get('lane');
    return lanes.some((lane) => lane.laneId === requested) ? requested : (lanes[0]?.laneId || '');
  }

  function laneSelector(lanes = [], selectedLaneId = '', id = 'culture-lane-select') {
    return `<label>Culture Lane<select class="input" id="${id}">${lanes.map((lane) => `<option value="${html(lane.laneId)}" ${lane.laneId === selectedLaneId ? 'selected' : ''}>${html(lane.name || lane.laneId)}</option>`).join('')}</select></label>`;
  }

  function bindLaneSelector(drawFunction, id = 'culture-lane-select') {
    const select = document.querySelector(`#${id}`);
    if (!select) return;
    select.onchange = () => {
      const url = new URL(location.href);
      url.searchParams.set('lane', select.value);
      history.replaceState(null, '', `${url.pathname}${url.search}`);
      drawFunction();
    };
  }

  function emptyLaneState(title, copy) {
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">Culture Lane OS</span><h1>${html(title)}</h1><p class="muted">${html(copy)}</p></div><a class="btn primary" href="/app/copier-engine">Build Culture Lane</a></div><section class="card"><h3>No Culture Lane exists yet</h3><p>Create a Culture Lead → Mirror Receiver route in Copier Engine. WISDO will now create the visible portfolio lane automatically.</p></section>`;
  }

  async function drawCultureLanes() {
    const lanes = await loadCultureLanes();
    if (!lanes.length) return emptyLaneState('Culture Lanes', 'Portfolio control, health, instant lane close, and links to every operating surface.');
    const overviews = await Promise.all(lanes.map((lane) => api(`/api/v2/culture-lanes/${encodeURIComponent(lane.laneId)}/overview`).catch(() => ({ lane, vault: null }))));
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">Portfolio operating system</span><h1>Culture Lanes</h1><p class="muted">Every Copier Engine route now creates a visible lane with Vault metrics, symbol permissions, Harvest, audit history, and intelligence.</p></div><a class="btn primary" href="/app/copier-engine">Add Culture Lane</a></div>
      <section class="grid2">${overviews.map((row) => { const lane = row.lane; const vault = row.vault || {}; const disconnected = vault.disconnectedAccountIds || []; return `<article class="card"><div class="card-head"><div><span class="eyebrow">${html(lane.profile || 'custom')} profile</span><h3>${html(lane.name || lane.laneId)}</h3></div><span class="status-pill ${disconnected.length ? 'waiting' : 'connected'}">${html(vault.executionStatus || lane.status || 'waiting')}</span></div><div class="grid3"><div><small>Lane equity</small><strong>${money(vault.equity)}</strong></div><div><small>Combined P/L</small><strong class="${Number(vault.combinedProfit || 0) >= 0 ? 'green' : 'red'}">${money(vault.combinedProfit)}</strong></div><div><small>Open trades</small><strong>${Number(vault.openTrades || 0)}</strong></div></div><p class="muted">Leader ${html(lane.leaderAccountId)} · ${Number((lane.followerAccountIds || []).length)} follower(s) · ${Number(vault.connectedAccounts || 0)}/${Number(vault.totalAccounts || 0)} connected</p>${disconnected.length ? `<div class="setup-note"><strong>Disconnected</strong><p>${disconnected.map(html).join(', ')}</p></div>` : ''}<div class="actions"><a class="btn primary" href="/app/symbol-routing?lane=${encodeURIComponent(lane.laneId)}">Symbols</a><a class="btn ghost" href="/app/harvest?lane=${encodeURIComponent(lane.laneId)}">Harvest</a><a class="btn ghost" href="/app/lane-audit?lane=${encodeURIComponent(lane.laneId)}">Audit</a><a class="btn ghost" href="/app/lane-intelligence?lane=${encodeURIComponent(lane.laneId)}">Intelligence</a><button class="btn danger" data-lane-close="${html(lane.laneId)}">Close Entire Lane Now</button></div></article>`; }).join('')}</section>`;
    root().querySelectorAll('[data-lane-close]').forEach((button) => button.onclick = async () => {
      if (!confirm('Send one simultaneous close-all command to every account in this Culture Lane?')) return;
      setBusy(button, true, 'Fanning out now…');
      try {
        const result = await api(`/api/v2/culture-lanes/${encodeURIComponent(button.dataset.laneClose)}/close-all`, { method: 'POST', body: JSON.stringify({ confirmation: 'confirmed' }) }, 15000);
        toast(`Parallel lane close queued to ${result.commands?.length || 0} account(s) in ${Number(result.fanoutMs || 0)} ms`, result.failures?.length ? 'warn' : 'ok', 7000);
        await drawCultureLanes();
      } catch (error) { toast(error.message, 'error', 7000); }
      finally { setBusy(button, false); }
    });
  }

  async function drawSymbolRouting() {
    const lanes = await loadCultureLanes();
    if (!lanes.length) return emptyLaneState('Smart Symbol Routing', 'Leader history becomes a clickable allowed-symbol matrix for every follower.');
    const laneId = laneIdFromLocation(lanes);
    const overview = await api(`/api/v2/culture-lanes/${encodeURIComponent(laneId)}/overview`);
    const symbols = overview.leaderSymbols || [];
    const policy = overview.symbolPolicy || {};
    const blocked = new Set(Array.isArray(policy.blockedSymbols) ? policy.blockedSymbols : []);
    const configuredAllowed = Array.isArray(policy.allowedSymbols) ? policy.allowedSymbols : [];
    const allowed = new Set(configuredAllowed.length ? configuredAllowed : symbols.map((item) => item.symbol).filter((symbol) => !blocked.has(symbol)));
    const followers = overview.followerInventories || [];
    const resolutionByFollower = Object.fromEntries(followers.map((row) => [row.accountId, Object.fromEntries((row.resolutions || []).map((resolution) => [resolution.leaderSymbol, resolution]))]));
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">Click-to-allow broker routing</span><h1>Smart Symbol Routing</h1><p class="muted">WISDO automatically lists every symbol the selected leader has traded before. Green means allowed. Click a symbol to allow or block it, then save the highlights.</p></div><div class="actions">${laneSelector(lanes, laneId)}<button class="btn ghost" id="allow-all-symbols">Allow all</button><button class="btn ghost" id="block-all-symbols">Block all</button><button class="btn primary" id="save-symbol-policy">Save highlights</button></div></div>
      <section class="card"><div class="card-head"><div><span class="eyebrow">Leader trade history</span><h3>${html(overview.lane?.name || laneId)}</h3></div><span class="status-pill connected">${symbols.length} discovered</span></div>${symbols.length ? `<div class="actions" id="symbol-highlight-grid">${symbols.map((item) => `<button type="button" class="btn symbol-permission ${allowed.has(item.symbol) ? 'primary' : 'ghost'}" data-symbol="${html(item.symbol)}" data-allowed="${allowed.has(item.symbol) ? 'true' : 'false'}">${html(item.symbol)} · ${Number(item.count || 0)} trade${Number(item.count || 0) === 1 ? '' : 's'}</button>`).join('')}</div>` : '<div class="setup-note"><strong>No leader history yet</strong><p>Open or import at least one leader trade. The symbols will appear here automatically.</p></div>'}</section>
      <section class="card table-wrap" style="margin-top:18px"><div class="card-head"><div><span class="eyebrow">Follower compatibility</span><h3>Auto Match + optional fallback</h3></div><span class="muted">Missing symbols skip only that follower</span></div><table><thead><tr><th>Leader symbol</th>${followers.map((follower) => `<th>${html(follower.account?.nickname || follower.account?.account_number || follower.accountId)}</th>`).join('')}<th>Fallback alias</th></tr></thead><tbody>${symbols.length ? symbols.map((item) => `<tr><td><strong>${html(item.symbol)}</strong></td>${followers.map((follower) => { const resolution = resolutionByFollower[follower.accountId]?.[item.symbol] || {}; return `<td><span class="status-pill ${resolution.eligible ? 'connected' : 'waiting'}">${resolution.eligible ? html(resolution.followerSymbol || item.symbol) : 'missing'}</span></td>`; }).join('')}<td><input class="input symbol-alias" data-leader-symbol="${html(item.symbol)}" value="${html(policy.aliases?.[item.symbol] || '')}" placeholder="US500, NAS100, GOLD"></td></tr>`).join('') : `<tr><td colspan="${followers.length + 2}">Waiting for leader trade history.</td></tr>`}</tbody></table></section>
      <section class="card" style="margin-top:18px"><h3>How this executes</h3><p class="muted">Allowed symbols are evaluated before opening risk. Exact broker symbol is preferred, then your fallback alias. A missing symbol is skipped and recorded without blocking other followers. Close authority always bypasses this opening filter.</p></section>`;
    bindLaneSelector(drawSymbolRouting);
    root().querySelectorAll('.symbol-permission').forEach((button) => button.onclick = () => { const next = button.dataset.allowed !== 'true'; button.dataset.allowed = next ? 'true' : 'false'; button.classList.toggle('primary', next); button.classList.toggle('ghost', !next); });
    document.querySelector('#allow-all-symbols').onclick = () => root().querySelectorAll('.symbol-permission').forEach((button) => { button.dataset.allowed = 'true'; button.classList.add('primary'); button.classList.remove('ghost'); });
    document.querySelector('#block-all-symbols').onclick = () => root().querySelectorAll('.symbol-permission').forEach((button) => { button.dataset.allowed = 'false'; button.classList.remove('primary'); button.classList.add('ghost'); });
    document.querySelector('#save-symbol-policy').onclick = async (event) => {
      const button = event.currentTarget;
      const allowedSymbols = [...root().querySelectorAll('.symbol-permission')].filter((node) => node.dataset.allowed === 'true').map((node) => node.dataset.symbol);
      const aliases = Object.fromEntries([...root().querySelectorAll('.symbol-alias')].map((node) => [node.dataset.leaderSymbol, node.value.trim()]).filter(([, value]) => value));
      setBusy(button, true, 'Saving…');
      try { await api(`/api/v2/culture-lanes/${encodeURIComponent(laneId)}/symbol-policy`, { method: 'PUT', body: JSON.stringify({ autoMatch: true, allowedSymbols, blockedSymbols: symbols.map((item) => item.symbol).filter((symbol) => !allowedSymbols.includes(symbol)), aliases, missingSymbolBehavior: 'skip_and_notify' }) }); toast(`${allowedSymbols.length} leader symbol(s) allowed`); await drawSymbolRouting(); }
      catch (error) { toast(error.message, 'error'); }
      finally { setBusy(button, false); }
    };
  }

  async function drawHarvest() {
    const lanes = await loadCultureLanes();
    if (!lanes.length) return emptyLaneState('Harvest Mode', 'Set a lane goal, evaluate it, and close every account through one parallel fan-out.');
    const laneId = laneIdFromLocation(lanes);
    const overview = await api(`/api/v2/culture-lanes/${encodeURIComponent(laneId)}/overview`);
    const policy = overview.harvestPolicy || { enabled: false, mode: 'harvest_once', goalType: 'percent_gain', goalValue: 2, referencePoint: 'start_of_day_balance', trailRetracePercent: 0.5 };
    const vault = overview.vault || {};
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">Portfolio profit authority</span><h1>Harvest Mode</h1><p class="muted">Set the goal once. WISDO evaluates the combined lane, then sends one close-all sweep to every account simultaneously.</p></div>${laneSelector(lanes, laneId)}</div>
      <div class="grid4"><div class="card"><small>Lane equity</small><div class="metric">${money(vault.equity)}</div></div><div class="card"><small>Combined P/L</small><div class="metric ${Number(vault.combinedProfit || 0) >= 0 ? 'green' : 'red'}">${money(vault.combinedProfit)}</div></div><div class="card"><small>Daily return</small><div class="metric">${Number(vault.dailyReturnPercent || 0).toFixed(2)}%</div></div><div class="card"><small>Execution health</small><strong>${html(vault.executionStatus || 'waiting')}</strong></div></div>
      <section class="card" style="margin-top:18px"><form id="harvest-form" class="grid2"><label><input type="checkbox" name="enabled" ${policy.enabled ? 'checked' : ''}> Enable Harvest Mode</label><label>Mode<select class="input" name="mode"><option value="harvest_once" ${policy.mode === 'harvest_once' ? 'selected' : ''}>Harvest Once + Pause</option><option value="harvest_and_continue" ${policy.mode === 'harvest_and_continue' ? 'selected' : ''}>Harvest and Continue</option><option value="stair_step" ${policy.mode === 'stair_step' ? 'selected' : ''}>Stair-Step Harvest</option></select></label><label>Goal type<select class="input" name="goalType">${[['percent_gain','Percent gain'],['dollar_gain','Dollar gain'],['equity_target','Equity target'],['balance_target','Balance target'],['floating_profit','Floating profit'],['closed_profit','Closed profit']].map(([value,label]) => `<option value="${value}" ${policy.goalType === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>Goal value<input class="input" type="number" min="0" step="0.01" name="goalValue" value="${html(policy.goalValue ?? 2)}"></label><label>Reference point<select class="input" name="referencePoint"><option value="start_of_day_balance" ${policy.referencePoint === 'start_of_day_balance' ? 'selected' : ''}>Start-of-day balance</option><option value="start_of_cycle_equity" ${policy.referencePoint === 'start_of_cycle_equity' ? 'selected' : ''}>Start-of-cycle equity</option><option value="last_harvest_balance" ${policy.referencePoint === 'last_harvest_balance' ? 'selected' : ''}>Last harvested balance</option></select></label><label>Equity trail retrace %<input class="input" type="number" min="0.05" max="25" step="0.05" name="trailRetracePercent" value="${html(policy.trailRetracePercent ?? 0.5)}"></label><label class="full">Stair steps CSV<input class="input" name="stairSteps" value="${html((policy.stairSteps || []).join(', '))}" placeholder="2, 4, 6, 8"></label><div class="actions full"><button class="btn primary" type="submit">Save Harvest Policy</button><button class="btn ghost" type="button" id="evaluate-harvest">Evaluate Goal</button><button class="btn danger" type="button" id="execute-harvest">Evaluate + Close Lane</button></div></form><div id="harvest-result"></div></section>
      <section class="card table-wrap" style="margin-top:18px"><h3>Harvest cycles</h3><table><thead><tr><th>Time</th><th>Status</th><th>Goal</th><th>Achieved</th><th>Commands</th><th>Fan-out</th></tr></thead><tbody>${(overview.harvestCycles || []).length ? overview.harvestCycles.map((cycle) => `<tr><td>${html(cycle.createdAt || '')}</td><td>${html(cycle.status)}</td><td>${html(cycle.goalType)} ${html(cycle.goalValue)}</td><td>${html(cycle.achievedValue)}</td><td>${Number((cycle.commandIds || []).length)}</td><td>${cycle.parallelFanout ? `${Number(cycle.fanoutMs || 0)} ms` : 'legacy'}</td></tr>`).join('') : '<tr><td colspan="6">No Harvest cycle has executed yet.</td></tr>'}</tbody></table></section>`;
    bindLaneSelector(drawHarvest);
    const form = document.querySelector('#harvest-form');
    form.onsubmit = async (event) => { event.preventDefault(); const data = new FormData(form); const payload = Object.fromEntries(data); payload.enabled = data.has('enabled'); payload.goalValue = Number(payload.goalValue); payload.trailRetracePercent = Number(payload.trailRetracePercent); payload.stairSteps = String(payload.stairSteps || '').split(/[;,\s]+/).map(Number).filter((value) => value > 0); try { await api(`/api/v2/culture-lanes/${encodeURIComponent(laneId)}/harvest-policy`, { method: 'PUT', body: JSON.stringify(payload) }); toast('Harvest policy saved'); await drawHarvest(); } catch (error) { toast(error.message, 'error'); } };
    const evaluate = async (execute) => { const button = document.querySelector(execute ? '#execute-harvest' : '#evaluate-harvest'); if (execute && !confirm('If the goal is reached, close every eligible lane account in parallel now?')) return; setBusy(button, true, execute ? 'Evaluating + fanning out…' : 'Evaluating…'); try { const result = await api(`/api/v2/culture-lanes/${encodeURIComponent(laneId)}/harvest/evaluate`, { method: 'POST', body: JSON.stringify({ execute, confirmation: execute ? 'confirmed' : undefined }) }, 20000); const evaluation = result.evaluation || {}; document.querySelector('#harvest-result').innerHTML = `<div class="setup-note"><strong>${evaluation.triggered ? 'Goal reached' : 'Goal not reached'}</strong><p>Current ${html(evaluation.current ?? 0)} · Target ${html(evaluation.target ?? 0)} · Progress ${Number(evaluation.progressPercent || 0).toFixed(1)}%${result.cycle ? ` · ${Number(result.cycle.commandIds?.length || 0)} account close commands queued in parallel` : ''}</p></div>`; if (result.cycle) toast('Harvest parallel close fan-out queued', result.failures?.length ? 'warn' : 'ok', 7000); } catch (error) { toast(error.message, 'error', 7000); } finally { setBusy(button, false); } };
    document.querySelector('#evaluate-harvest').onclick = () => evaluate(false);
    document.querySelector('#execute-harvest').onclick = () => evaluate(true);
  }

  async function drawLaneAudit() {
    const lanes = await loadCultureLanes();
    if (!lanes.length) return emptyLaneState('Lane Audit', 'Genome versions, Timeline events, and Trade Passports become visible here.');
    const laneId = laneIdFromLocation(lanes);
    const overview = await api(`/api/v2/culture-lanes/${encodeURIComponent(laneId)}/overview`);
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">Immutable operating history</span><h1>Genome · Timeline · Passports</h1><p class="muted">See which configuration governed the lane, what happened in order, and the permanent identity of each trade lifecycle.</p></div><div class="actions">${laneSelector(lanes, laneId)}<button class="btn primary" id="snapshot-genome">Snapshot Genome</button><button class="btn ghost" id="create-passport">Create Passport</button></div></div>
      <section class="grid3"><div class="card"><small>Genome versions</small><div class="metric">${Number((overview.genomes || []).length)}</div></div><div class="card"><small>Timeline events</small><div class="metric">${Number((overview.timeline || []).length)}</div></div><div class="card"><small>Trade Passports</small><div class="metric">${Number((overview.passports || []).length)}</div></div></section>
      <section class="card table-wrap" style="margin-top:18px"><h3>Lane Genome</h3><table><thead><tr><th>Version</th><th>Reason</th><th>Effective</th><th>Accounts</th><th>Harvest</th></tr></thead><tbody>${(overview.genomes || []).length ? overview.genomes.map((row) => `<tr><td><strong>${html(row.version)}</strong></td><td>${html(row.reason)}</td><td>${html(row.effectiveAt)}</td><td>${Number(row.configuration?.accountIds?.length || 0)}</td><td>${html(row.configuration?.harvestPolicy?.mode || 'not set')}</td></tr>`).join('') : '<tr><td colspan="5">No Genome snapshots.</td></tr>'}</tbody></table></section>
      <section class="card table-wrap" style="margin-top:18px"><h3>Lane Timeline</h3><table><thead><tr><th>Time</th><th>Event</th><th>Detail</th></tr></thead><tbody>${(overview.timeline || []).length ? overview.timeline.map((row) => `<tr><td>${html(row.createdAt)}</td><td><strong>${html(row.eventType)}</strong></td><td><code>${html(JSON.stringify(row.payload || {}).slice(0, 260))}</code></td></tr>`).join('') : '<tr><td colspan="3">No Timeline events.</td></tr>'}</tbody></table></section>
      <section class="card table-wrap" style="margin-top:18px"><h3>Trade Passports</h3><table><thead><tr><th>ID</th><th>Status</th><th>Genome</th><th>Created</th><th>Followers</th><th>Result</th></tr></thead><tbody>${(overview.passports || []).length ? overview.passports.map((row) => `<tr><td>${html(row.passportId)}</td><td>${html(row.status)}</td><td>${html(row.genomeId || '')}</td><td>${html(row.createdAt)}</td><td>${Number(row.followerOrders?.length || 0)}</td><td>${row.result ? html(JSON.stringify(row.result).slice(0, 160)) : 'open'}</td></tr>`).join('') : '<tr><td colspan="6">No Trade Passports yet.</td></tr>'}</tbody></table></section>`;
    bindLaneSelector(drawLaneAudit);
    document.querySelector('#snapshot-genome').onclick = async () => { await api(`/api/v2/culture-lanes/${encodeURIComponent(laneId)}/genomes`, { method: 'POST', body: JSON.stringify({ reason: 'manual_website_snapshot' }) }); toast('Genome snapshot created'); drawLaneAudit(); };
    document.querySelector('#create-passport').onclick = async () => { await api(`/api/v2/culture-lanes/${encodeURIComponent(laneId)}/passports`, { method: 'POST', body: JSON.stringify({ leaderOrder: {}, followerOrders: [], acknowledgements: [] }) }); toast('Open Trade Passport created'); drawLaneAudit(); };
  }

  async function drawLaneIntelligence() {
    const lanes = await loadCultureLanes();
    if (!lanes.length) return emptyLaneState('Lane Intelligence', 'Generate Lane DNA and explainable portfolio observations.');
    const laneId = laneIdFromLocation(lanes);
    const overview = await api(`/api/v2/culture-lanes/${encodeURIComponent(laneId)}/overview`);
    const dna = (overview.dnaSnapshots || [])[0] || null;
    const report = (overview.intelligenceReports || [])[0] || null;
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">Culture Intelligence</span><h1>Lane DNA + Intelligence</h1><p class="muted">Behavior, execution health, confidence, observations, and recommendations are generated from durable lane data.</p></div><div class="actions">${laneSelector(lanes, laneId)}<button class="btn primary" id="generate-dna">Calculate DNA</button><button class="btn ghost" id="generate-intelligence">Generate Intelligence</button></div></div>
      ${dna ? `<section class="grid4">${gaugeCard('Aggression', dna.aggression)}${gaugeCard('Patience', dna.patience)}${gaugeCard('Harvest accuracy', dna.harvestAccuracy)}${gaugeCard('Execution health', dna.executionHealth)}${gaugeCard('Win rate', dna.winRate)}${gaugeCard('Confidence', dna.confidence)}</section><section class="card" style="margin-top:18px"><h3>DNA Summary</h3><p>Risk profile <strong>${html(dna.riskProfile)}</strong> · Average hold ${Number(dna.averageHoldMinutes || 0).toFixed(1)} minutes · Sample ${Number(dna.sampleSize || 0)} finalized passport(s).</p></section>` : '<section class="card"><h3>No DNA snapshot yet</h3><p>Calculate DNA after connecting the lane. Confidence increases as Trade Passports finalize.</p></section>'}
      ${report ? `<section class="grid2" style="margin-top:18px"><article class="card"><h3>Observations</h3><ul class="feature-list">${(report.observations || []).map((item) => `<li>${html(item)}</li>`).join('')}</ul></article><article class="card"><h3>Recommendations</h3><ul class="feature-list">${(report.recommendations || []).map((item) => `<li><strong>${html(item.type)}</strong> — ${html(item.text)} <small>Auto-apply: ${item.autoApply ? 'enabled' : 'no'}</small></li>`).join('') || '<li>No recommendation generated.</li>'}</ul></article></section>` : '<section class="card" style="margin-top:18px"><h3>No Intelligence report yet</h3><p>Generate a report to review health, drawdown, profit state, and data quality.</p></section>'}`;
    bindLaneSelector(drawLaneIntelligence);
    document.querySelector('#generate-dna').onclick = async () => { await api(`/api/v2/culture-lanes/${encodeURIComponent(laneId)}/dna`, { method: 'POST', body: '{}' }); toast('Lane DNA calculated'); drawLaneIntelligence(); };
    document.querySelector('#generate-intelligence').onclick = async () => { await api(`/api/v2/culture-lanes/${encodeURIComponent(laneId)}/intelligence`, { method: 'POST', body: '{}' }); toast('Culture Intelligence generated'); drawLaneIntelligence(); };
  }

  async function drawCompoundTracker() {
    const accountId = selectedAccountId();
    const query = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
    const [trackerResult, trends] = await Promise.all([api(`/api/v2/trades/compound-trackers${query}${query ? '&' : '?'}limit=50`), api(`/api/v2/analyzer/trends?${accountId ? `account_id=${encodeURIComponent(accountId)}` : ''}`).catch(() => ({ gauges: {} }))]);
    const trackers = trackerResult.trackers || [];
    const gauges = trends.gauges || {};
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">Persistent close intelligence</span><h1>Compound Tracker</h1><p class="muted">Every Close All, Profit Secure, and Close Losing request receives a durable execution record and after-close analysis.</p></div><div class="actions"><a class="btn danger" href="/app/trades">Open Trade Controls</a><button class="btn ghost" id="refresh-trackers">Refresh</button></div></div>${accountMetrics(selectedAccount())}
      <section class="grid4">${gaugeCard('Win rate', gauges.winRate || 0)}${gaugeCard('Risk pressure', gauges.riskPressure || 0, { inverse: true })}${gaugeCard('Daily progress', gauges.dailyProgress || 0)}${gaugeCard('Weekly progress', gauges.weeklyProgress || 0)}</section>
      <section style="margin-top:18px">${trackers.length ? trackers.map((tracker) => trackerCard(tracker)).join('') : '<div class="card"><h3>No Compound Tracker events yet</h3><p>Use Trade Log close controls. WISDO will record the request, command, MT4 confirmation, result, and trend impact here.</p></div>'}</section>`;
    document.querySelector('#refresh-trackers').onclick = drawCompoundTracker;
  }

  async function drawTrades() {
    const accountId = selectedAccountId();
    const query = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
    const [result, trackerResult] = await Promise.all([
      api(`/api/v2/trades${query}`),
      api(`/api/v2/trades/compound-trackers${query}${query ? '&' : '?'}limit=8`).catch(() => ({ trackers: [] })),
    ]);
    const trades = result.trades || [];
    const trackers = trackerResult.trackers || [];
    const openCount = trades.filter((trade) => trade.status === 'open' || trade.status === 'closing').length;
    const closedCount = trades.filter((trade) => trade.status === 'closed').length;
    const lastTradeAt = trades[0]?.updated_at || trades[0]?.opened_at || null;
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">Immediate trade control</span><h1>Trade Log</h1><p class="muted">${accountId ? 'Filtered to the selected account.' : 'Showing the live portfolio ledger.'} Every bulk close receives a saved Compound Tracker analysis.</p></div><div class="actions"><button class="btn danger" data-bulk-close="all">Close All Now</button><button class="btn primary" data-bulk-close="profitable">Profit Secure</button><button class="btn ghost" data-bulk-close="losing">Close Losing Only</button><button class="btn ghost" id="refresh-trades">Refresh</button></div></div>${accountMetrics(selectedAccount())}
      <div class="grid4"><div class="card"><small>Open positions</small><div class="metric">${openCount}</div></div><div class="card"><small>Closed today/history</small><div class="metric">${closedCount}</div></div><div class="card"><small>Snapshots imported</small><div class="metric">${Number(result.sync?.snapshots || 0)}</div></div><div class="card"><small>Last ledger event</small><strong>${html(lastTradeAt ? new Date(lastTradeAt).toLocaleString() : 'Waiting for Reporter')}</strong></div></div>
      ${trackerCard(trackers[0])}
      <section class="card" style="margin-top:18px"><div class="card-head"><div><span class="eyebrow">Execution authority</span><h3>Account-specific close controls</h3></div><div class="actions"><a class="btn ghost" href="/app/accounts">Check Reporter</a><a class="btn primary" href="/app/culture-lanes">Parallel Lane Close</a></div></div><p class="muted">Close All sends one atomic MT4 sweep command for the selected account with priority 5000 and a 2-minute expiry. Culture Lane Close All fans commands to every account in parallel; entry filters never block close authority.</p></section>
      <section class="card table-wrap" style="margin-top:18px"><table><thead><tr><th>Time</th><th>Account</th><th>Ticket</th><th>Symbol</th><th>Side</th><th>Lots</th><th>Status</th><th>P/L</th><th>Control</th></tr></thead><tbody>${trades.length ? trades.map((trade) => `<tr><td>${html(trade.opened_at || trade.updated_at || '')}</td><td>${html(trade.account_id)}</td><td>${html(trade.external_ticket || 'pending')}</td><td>${html(trade.symbol)}</td><td>${html(trade.side)}</td><td>${html(trade.lot_size)}</td><td>${html(trade.status)}</td><td class="${Number(trade.pnl || 0) >= 0 ? 'green' : 'red'}">${money(trade.pnl)}</td><td>${trade.status === 'open' ? `<button class="btn ghost" data-close="${html(trade.id)}">Close</button>` : ''}</td></tr>`).join('') : `<tr><td colspan="9"><div class="setup-note"><strong>No trade records yet</strong><p>Confirm the Reporter is current, synchronized, and returning MT4 open and closed history.</p></div></td></tr>`}</tbody></table></section>`;
    document.querySelector('#refresh-trades').onclick = drawTrades;
    root().querySelectorAll('[data-close]').forEach((button) => button.onclick = async () => { if (!confirm('Queue an immediate close for this ticket?')) return; try { await api(`/api/v2/trades/${encodeURIComponent(button.dataset.close)}/close`, { method: 'POST', body: JSON.stringify({ confirmation: 'confirmed' }) }); toast('Ticket close queued'); setTimeout(drawTrades, 1200); } catch (error) { toast(error.message, 'error'); } });
    root().querySelectorAll('[data-bulk-close]').forEach((button) => button.onclick = async () => {
      const target = selectedAccountId(); const mode = button.dataset.bulkClose;
      if (!target) return toast('Select the target account first.', 'warn');
      const wording = mode === 'profitable' ? 'close profitable positions only and secure current winners' : mode === 'losing' ? 'close losing positions only' : 'close every open position';
      if (!confirm(`Immediately ${wording} on the selected account?`)) return;
      setBusy(button, true, 'Sending now…');
      try { const response = await api('/api/v2/trades/close-bulk', { method: 'POST', body: JSON.stringify({ account_id: target, mode, confirmation: 'confirmed' }) }, 30000); toast(`${response.tracker?.label || 'Close command'} entered the immediate MT4 queue`); await drawTrades(); }
      catch (error) { toast(error.message, 'error', 7000); }
      finally { setBusy(button, false); }
    });
  }

  async function drawAnalyzer() {
    const accountId = selectedAccountId();
    const accountQuery = accountId ? `&account_id=${encodeURIComponent(accountId)}` : '';
    const [result, heat, trends] = await Promise.all([
      api(`/api/v2/analyzer/portfolio?period=month${accountQuery}`),
      api(`/api/v2/analyzer/heatmap?period=month${accountQuery}`),
      api(`/api/v2/analyzer/trends?${accountId ? `account_id=${encodeURIComponent(accountId)}` : ''}`),
    ]);
    const series = result.series || [];
    const values = series.map((point) => Number(point.value || 0)).filter(Number.isFinite);
    const minimum = values.length ? Math.min(...values) : 0;
    const maximum = values.length ? Math.max(...values) : 0;
    const range = Math.max(1, maximum - minimum);
    const chartBars = series.map((point) => { const value = Number(point.value || 0); const height = 20 + ((value - minimum) / range) * 225; return `<i title="${html(`${point.date} · Equity ${money(value)} · Floating ${money(point.floatingPL || 0)} · Open ${point.openTradeCount || 0}`)}" style="height:${Math.max(8, Math.min(250, height))}px"></i>`; }).join('');
    const gauges = trends.gauges || {};
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">WISDO Insight Engine</span><h1>Daily + Weekly Trend Intelligence</h1><p class="muted">Persistent gauges and line charts calculated from MT4 Reporter equity snapshots and closed-trade history.</p></div><div class="actions"><a class="btn ghost" href="/api/v2/analyzer/export.csv">Export CSV</a><button class="btn primary" id="risk-suggestion">AI risk suggestion</button></div></div>${accountMetrics(selectedAccount())}
      <div class="grid4">${gaugeCard('Daily trend', gauges.dailyTrend, { min: -100, max: 100 })}${gaugeCard('Weekly trend', gauges.weeklyTrend, { min: -100, max: 100 })}${gaugeCard('Compound score', gauges.compoundScore, { suffix: '/100' })}${gaugeCard('Risk pressure', gauges.riskPressure, { suffix: '/100', inverse: true })}</div>
      <div class="grid3" style="margin-top:18px">${gaugeCard('Win rate', gauges.winRate, { suffix: '%' })}${gaugeCard('Consistency', gauges.consistency, { suffix: '%' })}${gaugeCard('Profit factor', Math.min(100, Number(gauges.profitFactor || 0) * 25), { suffix: '' })}</div>
      <div class="grid2" style="margin-top:18px"><section class="card"><div class="card-head"><div><span class="eyebrow">Daily trend</span><h3>7-day compound line</h3></div><strong class="${Number(trends.daily?.pnl || 0) >= 0 ? 'green' : 'red'}">${money(trends.daily?.pnl)}</strong></div>${lineChart(trends.dailySeries, 'cumulative', 'Daily compound trend')}</section><section class="card"><div class="card-head"><div><span class="eyebrow">Weekly trend</span><h3>8-week compound line</h3></div><strong class="${Number(trends.weekly?.pnl || 0) >= 0 ? 'green' : 'red'}">${money(trends.weekly?.pnl)}</strong></div>${lineChart(trends.weeklySeries, 'cumulative', 'Weekly compound trend')}</section></div>
      <div class="grid4" style="margin-top:18px"><div class="card"><small>ROI</small><div class="metric ${Number(result.roi || 0) >= 0 ? 'green' : 'red'}">${Number(result.roi || 0).toFixed(2)}%</div></div><div class="card"><small>Monthly P/L</small><div class="metric ${Number(trends.monthly?.pnl || 0) >= 0 ? 'green' : 'red'}">${money(trends.monthly?.pnl)}</div></div><div class="card"><small>Max drawdown</small><div class="metric red">${Number(trends.maxDrawdown || result.maxDrawdown || 0).toFixed(2)}%</div></div><div class="card"><small>Closed trades</small><div class="metric">${Number(result.closedTradeCount || result.tradeCount || 0)}</div></div></div>
      <div class="grid2" style="margin-top:18px"><section class="card"><div class="card-head"><div><span class="eyebrow">Live telemetry</span><h3>Equity curve</h3></div><span class="muted">${series.length} points</span></div>${series.length ? `<div class="mini-chart">${chartBars}</div><div class="account-line"><span>Low ${money(minimum)}</span><span>High ${money(maximum)}</span></div>` : '<div class="setup-note"><strong>Waiting for equity snapshots</strong><p>Reporter synchronization populates this chart automatically.</p></div>'}</section><section class="card"><div class="card-head"><div><span class="eyebrow">Closed trade evidence</span><h3>Symbol heatmap</h3></div><span class="muted">${html(heat.dataSource || '')}</span></div>${(heat.symbols || []).length ? heat.symbols.slice(0, 20).map((row) => `<div class="heat-row"><span>${html(row.symbol)} <small>· ${Number(row.trades || 0)} trades</small></span><strong class="${Number(row.pnl) >= 0 ? 'green' : 'red'}">${money(row.pnl)}</strong></div>`).join('') : '<div class="setup-note"><strong>No closed trades imported yet</strong><p>Win rate and symbol performance require confirmed MT4 closed trades.</p></div>'}</section></div><div id="insight"></div>`;
    document.querySelector('#risk-suggestion').onclick = async () => { const target = selectedAccountId() || accounts[0]?.id; if (!target) return toast('Add an account first.', 'warn'); const suggestion = await api('/api/v2/ai/risk-suggestion', { method: 'POST', body: JSON.stringify({ account_id: target }) }); document.querySelector('#insight').innerHTML = `<div class="card"><h3>Suggested controls</h3><pre>${html(JSON.stringify(suggestion.suggestion, null, 2))}</pre><p>${html(suggestion.reason)}</p></div>`; };
  }

  async function drawAlerts() {
    const result = await api('/api/v2/alerts');
    const alerts = result.alerts || [];
    const health = result.health || [];
    const unhealthy = health.filter((row) => !row.reporterConnected || row.terminalConnected === false || row.expertEnabled === false);
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">Notification center</span><h1>Alerts</h1><p class="muted">Reporter health, trade opens and closes, Culture Lane execution, command results, drawdown, and billing events flow into one ledger.</p></div><div class="actions"><button class="btn ghost" id="refresh-alerts">Refresh</button><button class="btn ghost" id="read-all">Mark all read</button></div></div>
      <div class="grid4"><div class="card"><small>Events loaded</small><div class="metric">${alerts.length}</div></div><div class="card"><small>Accounts monitored</small><div class="metric">${health.length}</div></div><div class="card"><small>Needs attention</small><div class="metric ${unhealthy.length ? 'red' : 'green'}">${unhealthy.length}</div></div><div class="card"><small>Data source</small><strong>${html(result.dataSource || 'waiting')}</strong></div></div>
      ${health.length ? `<section class="card" style="margin-top:18px"><span class="eyebrow">Execution health</span><div class="grid3">${health.map((row) => { const ready = row.reporterConnected && row.terminalConnected !== false && row.expertEnabled !== false; return `<div class="path-item"><span class="status-pill ${ready ? 'connected' : 'waiting'}">${ready ? 'ready' : 'attention'}</span><strong>${html(row.accountId)}</strong><small>Reporter ${row.reporterConnected ? 'online' : 'missing'} · Terminal ${row.terminalConnected === false ? 'offline' : 'online'} · AutoTrading ${row.expertEnabled === false ? 'off' : 'on'}</small><small>${html(row.lastSyncAt ? new Date(row.lastSyncAt).toLocaleString() : 'Never synchronized')}</small></div>`; }).join('')}</div></section>` : ''}
      <section class="grid2" style="margin-top:18px">${alerts.length ? alerts.map((alert) => `<article class="card"><div class="card-head"><span class="eyebrow">${html(alert.type)}</span><span class="status-pill ${alert.read_at ? 'waiting' : 'connected'}">${alert.read_at ? 'read' : 'new'}</span></div><h3>${html(alert.title)}</h3><p>${html(alert.body)}</p><small class="muted">${html(alert.created_at ? new Date(alert.created_at).toLocaleString() : '')}</small>${alert.metadata?.accountId ? `<p class="muted">Account ${html(alert.metadata.accountId)}${alert.metadata.ticket ? ` · Ticket ${html(alert.metadata.ticket)}` : ''}</p>` : ''}</article>`).join('') : '<div class="card"><h3>Waiting for the first live event</h3><p>As soon as a Reporter snapshot arrives, WISDO creates a pipeline-online alert. Trade opens, closes, command failures, and execution-health changes will follow.</p><a class="btn ghost" href="/app/accounts">Check Reporter connection</a></div>'}</section>`;
    document.querySelector('#refresh-alerts').onclick = drawAlerts;
    document.querySelector('#read-all').onclick = async () => { await api('/api/v2/alerts/read-all', { method: 'POST', body: '{}' }); toast('Alerts marked read'); drawAlerts(); };
  }

  async function drawEducation() {
    const academy = await api('/api/v2/academy/tracks').catch(() => ({ tracks: [], progress: {}, summary: { courseCount: 6500, domainCount: 65 } }));
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">WISDO Adaptive Academy</span><h1>Learn from first candle to professional systems.</h1><p class="muted">A personalized curriculum spanning trading, investing, risk, money management, global markets, research, psychology, technology, and WISDO operations. Proprietary DF Sauce source code is never displayed or downloaded here.</p></div><div class="academy-progress"><strong>${Number(academy.progress?.score || 0)}</strong><span>academy points</span></div></div><div id="df-academy" class="academy-shell"></div>`;
    window.DFSauceAcademy?.mount(document.querySelector('#df-academy'), {
      bot: new URLSearchParams(location.search).get('bot') || '',
      bootstrap: academy,
      selectedAccountId: selectedAccountId(),
    });
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
    if (currentPage === 'command-center') await drawCommandCenter();
    else if (currentPage === 'dashboard') await drawDashboard();
    else if (currentPage === 'accounts') drawAccounts();
    else if (currentPage === 'copier-engine') await drawRules();
    else if (currentPage === 'culture-lanes') await drawCultureLanes();
    else if (currentPage === 'symbol-routing') await drawSymbolRouting();
    else if (currentPage === 'harvest') await drawHarvest();
    else if (currentPage === 'lane-audit') await drawLaneAudit();
    else if (currentPage === 'lane-intelligence') await drawLaneIntelligence();
    else if (currentPage === 'compound-tracker') await drawCompoundTracker();
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
      const pageNav = document.querySelector('#mobile-page-nav');
      if (pageNav) pageNav.addEventListener('change', () => { if (pageNav.value) location.href = pageNav.value; });
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
        try { await refreshAccounts(true, true); const next = JSON.stringify(accounts.map((a) => [a.id, a.status, a.equity, a.last_sync_at])); if (next !== previous && ['command-center', 'dashboard', 'analyzer', 'trades', 'culture-lanes', 'harvest', 'compound-tracker'].includes(currentPage)) await renderCurrentPage(); } catch {}
      }, 45000);
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
