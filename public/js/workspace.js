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
    const { retries, ...fetchOptions } = options || {};
    const method = String(fetchOptions.method || 'GET').toUpperCase();
    const safeToRetry = ['GET', 'HEAD'].includes(method);
    const attempts = safeToRetry ? Math.max(1, Number(retries ?? 1)) : 1;
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs + (attempt - 1) * 8000);
      try {
        const response = await fetch(path, {
          ...fetchOptions,
          signal: fetchOptions.signal || controller.signal,
          headers: { 'content-type': 'application/json', ...(fetchOptions.headers || {}) },
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
    const selectedVideo = background === 'motion-a'
      ? document.querySelector('#workspace-video-a')
      : background === 'motion-b'
        ? document.querySelector('#workspace-video-b')
        : null;
    document.querySelectorAll('.workspace-bg-video').forEach((video) => {
      const active = video === selectedVideo;
      video.classList.toggle('active', active);
      if (!active) {
        video.pause?.();
        // Decorative video bytes are released when the user is not using a motion theme.
        if (video.getAttribute('src')) { video.removeAttribute('src'); video.load?.(); }
        return;
      }
      if (!video.getAttribute('src') && video.dataset.src) {
        video.setAttribute('src', video.dataset.src);
        video.load?.();
      }
      video.play?.().catch(() => undefined);
    });
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
    const result = await api('/api/v2/accounts?includeReporter=1', { retries: 1 }, 8000);
    accounts = result.accounts || [];
    try { sessionStorage.setItem('wisdo.accountSnapshot', JSON.stringify(accounts)); } catch {}
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
        window.dispatchEvent(new CustomEvent('wisdo:account-selected', {
          detail: { accounts, selectedAccountId: selector.value || '' },
        }));
        await renderCurrentPage();
      };
    }
    const status = document.querySelector('#workspace-account-status');
    if (status) status.textContent = `${accounts.filter((account) => account.reporter_connected || reporterFresh(account)).length}/${accounts.length} Reporter accounts live`;
    window.dispatchEvent(new CustomEvent('wisdo:accounts-ready', {
      detail: { accounts, selectedAccountId: selector?.value || '' },
    }));
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
            <a class="command-module" href="/app/dashboard"><strong>Combined Portfolio Dashboard</strong><small>View each Culture Lane as one large account with collective equity, drawdown, exposure, and Harvest controls.</small></a>
            <a class="command-module" href="/app/copier-engine"><strong>Multi-Account Lane Builder</strong><small>Select multiple receivers and highlight allowed leader symbols inside the real Copier Engine workflow.</small></a>
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
    const laneResult = await api('/api/v2/culture-lanes', {}, 20000).catch(() => ({ lanes: [] }));
    const lanes = laneResult.lanes || [];
    const stats = await api(`/api/v2/analyzer/portfolio?period=month${lanes.length ? '' : accountId ? `&account_id=${encodeURIComponent(accountId)}` : ''}`);
    if (!lanes.length) {
      const active = selectedAccount();
      root().innerHTML = `
        <div class="workspace-heading"><div><span class="eyebrow">Trading workspace</span><h1>WISDO Command Center</h1><p class="muted">Connect a Culture Lead and receiver accounts to turn the dashboard into one combined portfolio profile.</p></div><div class="live-chip">${accounts.length} accounts loaded</div></div>
        ${accountMetrics(active)}
        <div class="grid4"><div class="card"><small>Connected accounts</small><div class="metric">${accounts.length}</div></div><div class="card"><small>ROI</small><div class="metric green">${Number(stats.roi || 0).toFixed(2)}%</div></div><div class="card"><small>Win rate</small><div class="metric">${Number(stats.winRate || 0).toFixed(1)}%</div></div><div class="card"><small>Max drawdown</small><div class="metric red">${Number(stats.maxDrawdown || 0).toFixed(2)}%</div></div></div>
        <section class="card" style="margin-top:18px"><h3>No combined Culture Lane yet</h3><p>Select one leader and multiple receiver accounts in Copier Engine. WISDO will then display their collective balance and equity here as one large portfolio account.</p><a class="btn primary" href="/app/copier-engine">Build Culture Lane</a></section>`;
      return;
    }
    const overviews = await Promise.all(lanes.map((lane) => api(`/api/v2/culture-lanes/${encodeURIComponent(lane.laneId)}/overview`).catch(() => ({ lane, vault: null }))));
    let selectedLaneId = sessionStorage.getItem('wisdo.selectedLaneId') || lanes[0].laneId;
    if (!lanes.some((lane) => lane.laneId === selectedLaneId)) selectedLaneId = lanes[0].laneId;
    const overview = overviews.find((row) => row.lane?.laneId === selectedLaneId) || overviews[0];
    const lane = overview.lane || lanes[0];
    const vault = overview.vault || {};
    const policy = overview.harvestPolicy || { enabled: false, mode: 'harvest_once', goalType: 'percent_gain', goalValue: 2, referencePoint: 'start_of_day_balance', trailRetracePercent: 0.5, stairSteps: [] };
    const accountById = Object.fromEntries(accounts.map((account) => [String(account.id), account]));
    const laneAccounts = vault.accounts || [];
    root().innerHTML = `
      <div class="workspace-heading"><div><span class="eyebrow">Multi-account portfolio profile</span><h1>${html(lane.name || 'Culture Lane')}</h1><p class="muted">WISDO combines the leader and every receiver into one large account view while keeping execution isolated per broker account.</p></div><div><label>Culture Lane<select class="input" id="dashboard-lane-select">${lanes.map((item) => `<option value="${html(item.laneId)}" ${item.laneId === lane.laneId ? 'selected' : ''}>${html(item.name || item.laneId)}</option>`).join('')}</select></label><div class="actions compact"><button class="btn danger" id="dashboard-close-lane">Close All Culture Lane</button><button class="btn ghost" id="dashboard-close-leader">Close Leader Trades</button></div></div></div>
      <section class="card portfolio-hero"><div class="card-head"><div><span class="eyebrow">Collective lane equity</span><div class="portfolio-total">${money(vault.equity)}</div><p class="muted">Combined balance ${money(vault.balance)} across ${Number(vault.totalAccounts || 0)} account(s)</p></div><span class="status-pill ${(vault.disconnectedAccountIds || []).length ? 'waiting' : 'connected'}">${html(vault.executionStatus || lane.status || 'waiting')}</span></div><div class="grid4"><div><small>Floating P/L</small><strong class="${Number(vault.floatingProfit || 0) >= 0 ? 'green' : 'red'}">${money(vault.floatingProfit)}</strong></div><div><small>Closed today</small><strong class="${Number(vault.closedProfit || 0) >= 0 ? 'green' : 'red'}">${money(vault.closedProfit)}</strong></div><div><small>Combined P/L</small><strong class="${Number(vault.combinedProfit || 0) >= 0 ? 'green' : 'red'}">${money(vault.combinedProfit)}</strong></div><div><small>Daily return</small><strong>${Number(vault.dailyReturnPercent || 0).toFixed(2)}%</strong></div><div><small>Drawdown</small><strong class="${Number(vault.currentDrawdownPercent || 0) > 10 ? 'red' : ''}">${Number(vault.currentDrawdownPercent || 0).toFixed(2)}%</strong></div><div><small>Open trades</small><strong>${Number(vault.openTrades || 0)}</strong></div><div><small>Connected</small><strong>${Number(vault.connectedAccounts || 0)}/${Number(vault.totalAccounts || 0)}</strong></div><div><small>Harvest count</small><strong>${Number(vault.harvestCount || 0)}</strong></div></div></section>
      <div class="grid2" style="margin-top:18px">
        <section class="card"><div class="card-head"><div><span class="eyebrow">One portfolio · separate execution</span><h3>Account breakdown</h3></div><a class="btn ghost" href="/app/copier-engine">Edit lane</a></div><div class="lane-account-breakdown">${laneAccounts.map((metric) => { const account = accountById[String(metric.accountId)] || {}; return `<div class="account-line"><div><strong>${html(account.nickname || account.account_number || metric.accountId)}</strong><br><small class="muted">${String(metric.accountId) === String(lane.leaderAccountId) ? 'Culture Lead' : 'Mirror Receiver'} · ${metric.connected ? 'Reporter live' : 'Disconnected'}</small></div><div><strong>${money(metric.equity)}</strong><br><small class="${Number(metric.floatingProfit || 0) >= 0 ? 'green' : 'red'}">${money(metric.floatingProfit)} floating</small></div></div>`; }).join('')}</div></section>
        <section class="card harvest-inline"><div class="card-head"><div><span class="eyebrow">Dashboard Harvest Mode</span><h3>Profit authority for the entire lane</h3></div><span class="status-pill ${policy.enabled ? 'connected' : 'waiting'}">${policy.enabled ? 'armed' : 'off'}</span></div><form id="dashboard-harvest-form" class="grid2"><label><input type="checkbox" name="enabled" ${policy.enabled ? 'checked' : ''}> Enable automatic Harvest</label><label>Mode<select class="input" name="mode"><option value="harvest_once" ${policy.mode === 'harvest_once' ? 'selected' : ''}>Harvest Once + Pause</option><option value="harvest_and_continue" ${policy.mode === 'harvest_and_continue' ? 'selected' : ''}>Harvest and Continue</option><option value="stair_step" ${policy.mode === 'stair_step' ? 'selected' : ''}>Stair-Step</option></select></label><label>Goal type<select class="input" name="goalType">${[['percent_gain','Percent gain'],['dollar_gain','Dollar gain'],['equity_target','Equity target'],['balance_target','Balance target'],['floating_profit','Floating profit'],['closed_profit','Closed profit']].map(([value,label]) => `<option value="${value}" ${policy.goalType === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>Goal value<input class="input" name="goalValue" type="number" min="0" step="0.01" value="${html(policy.goalValue ?? 2)}"></label><label>Reference<select class="input" name="referencePoint"><option value="start_of_day_balance" ${policy.referencePoint === 'start_of_day_balance' ? 'selected' : ''}>Start-of-day balance</option><option value="start_of_cycle_equity" ${policy.referencePoint === 'start_of_cycle_equity' ? 'selected' : ''}>Start-of-cycle equity</option><option value="last_harvest_balance" ${policy.referencePoint === 'last_harvest_balance' ? 'selected' : ''}>Last harvested balance</option></select></label><label>Stair steps<input class="input" name="stairSteps" value="${html((policy.stairSteps || []).join(', '))}" placeholder="2, 4, 6"></label><div class="actions full"><button class="btn primary" type="submit">Save + Arm</button><button class="btn ghost" type="button" id="dashboard-harvest-check">Check Goal</button><button class="btn danger" type="button" id="dashboard-harvest-goal">Check Goal + Harvest</button><button class="btn danger" type="button" id="dashboard-harvest-now">Harvest Lane Now</button></div></form><div id="dashboard-harvest-result"></div><p class="muted">Automatic Harvest evaluates after every Reporter snapshot. Harvest Lane Now closes the leader and every receiver immediately, even when the goal has not been reached.</p></section>
      </div>
      <div class="grid4" style="margin-top:18px"><div class="card"><small>Portfolio ROI</small><div class="metric green">${Number(stats.roi || 0).toFixed(2)}%</div></div><div class="card"><small>Win rate</small><div class="metric">${Number(stats.winRate || 0).toFixed(1)}%</div></div><div class="card"><small>Analyzer max drawdown</small><div class="metric red">${Number(stats.maxDrawdown || 0).toFixed(2)}%</div></div><div class="card"><small>Peak lane equity</small><div class="metric">${money(vault.peakEquity)}</div></div></div>`;

    document.querySelector('#dashboard-lane-select').onchange = async (event) => { sessionStorage.setItem('wisdo.selectedLaneId', event.target.value); await drawDashboard(); };
    document.querySelector('#dashboard-close-lane').onclick = async (event) => {
      if (!confirm('Close every open trade on the Culture Lead and all receiver accounts now?')) return;
      const button=event.currentTarget; setBusy(button,true,'Closing lane…');
      try { const result=await api(`/api/v2/culture-lanes/${encodeURIComponent(lane.laneId)}/close-all`,{method:'POST',body:JSON.stringify({confirmation:'confirmed'})},30000); toast(`Culture Lane close queued across ${Number(result.accountIds?.length||0)} account(s).`,result.failures?.length?'warn':'ok',9000); }
      catch(error){toast(error.message,'error',9000)} finally{setBusy(button,false)}
    };
    document.querySelector('#dashboard-close-leader').onclick = async (event) => {
      if (!confirm('Close every open trade on the Culture Lead only? Receiver trades remain open until the normal leader-close relay confirms each matching ticket.')) return;
      const button=event.currentTarget; setBusy(button,true,'Closing leader…');
      try { await api(`/api/v2/culture-lanes/${encodeURIComponent(lane.laneId)}/close-leader`,{method:'POST',body:JSON.stringify({confirmation:'confirmed'})},30000); toast('Leader atomic close sweep queued. Matching receiver closes will follow through the lane relay.','ok',9000); }
      catch(error){toast(error.message,'error',9000)} finally{setBusy(button,false)}
    };
    const harvestForm = document.querySelector('#dashboard-harvest-form');
    harvestForm.onsubmit = async (event) => {
      event.preventDefault(); const data = new FormData(harvestForm); const payload = Object.fromEntries(data); payload.enabled = data.has('enabled'); payload.resetBaseline = true; payload.goalValue = Number(payload.goalValue); payload.stairSteps = String(payload.stairSteps || '').split(/[;,\s]+/).map(Number).filter((value) => value > 0);
      try { await api(`/api/v2/culture-lanes/${encodeURIComponent(lane.laneId)}/harvest-policy`, { method: 'PUT', body: JSON.stringify(payload) }); toast('Harvest saved and armed on the dashboard'); await drawDashboard(); } catch (error) { toast(error.message, 'error', 7000); }
    };
    const showHarvestResult = (result) => { const evaluation = result.evaluation || {}; document.querySelector('#dashboard-harvest-result').innerHTML = `<div class="setup-note"><strong>${result.manual ? 'Manual Harvest queued' : evaluation.triggered ? 'Harvest goal reached' : 'Goal not reached'}</strong><p>Current ${html(evaluation.current ?? vault.combinedProfit ?? 0)} · Target ${html(evaluation.target ?? policy.goalValue ?? 0)}${result.commandIds ? ` · ${result.commandIds.length} account sweep(s) queued in ${Number(result.fanoutMs || 0)} ms` : ''}</p></div>`; };
    const checkHarvest = async (execute) => { const button = document.querySelector(execute ? '#dashboard-harvest-goal' : '#dashboard-harvest-check'); if (execute && !confirm('Close the full lane only if the saved Harvest goal is reached?')) return; setBusy(button, true, execute ? 'Checking + harvesting…' : 'Checking…'); try { const result = await api(`/api/v2/culture-lanes/${encodeURIComponent(lane.laneId)}/harvest/evaluate`, { method: 'POST', body: JSON.stringify({ execute, confirmation: execute ? 'confirmed' : undefined }) }, 25000); showHarvestResult(result); if (result.commandIds?.length) toast(`Harvest queued to ${result.commandIds.length} account(s)`, 'ok', 7000); } catch (error) { toast(error.message, 'error', 7000); } finally { setBusy(button, false); } };
    document.querySelector('#dashboard-harvest-check').onclick = () => checkHarvest(false);
    document.querySelector('#dashboard-harvest-goal').onclick = () => checkHarvest(true);
    document.querySelector('#dashboard-harvest-now').onclick = async () => { const button = document.querySelector('#dashboard-harvest-now'); if (!confirm('Harvest this entire Culture Lane now? This sends an immediate Close All sweep to the leader and every receiver.')) return; setBusy(button, true, 'Fanning out now…'); try { const result = await api(`/api/v2/culture-lanes/${encodeURIComponent(lane.laneId)}/harvest/execute`, { method: 'POST', body: JSON.stringify({ confirmation: 'confirmed' }) }, 25000); showHarvestResult(result); toast(`Manual Harvest queued to ${result.commandIds?.length || 0} account(s)`, result.failures?.length ? 'warn' : 'ok', 7000); } catch (error) { toast(error.message, 'error', 7000); } finally { setBusy(button, false); } };
  }

  async function drawAccounts() {
    const brokerApi = await api('/api/v2/broker-api/connections').catch(() => ({ connections: [], providers: {} }));
    const brokerConnections = brokerApi.connections || [];
    const roleOptions = (selected) => DESK_ROLES.map((role) => `<option value="${role}" ${role === selected ? 'selected' : ''}>${({ private: 'Private Desk', lead: 'Culture Lead', receiver: 'Mirror Receiver', dual: 'Lead + Receiver' })[role]}</option>`).join('');
    const sharingOptions = (selected) => SHARING_MODES.map((mode) => `<option value="${mode}" ${mode === selected ? 'selected' : ''}>${({ private: 'Private', shared: 'Shared by approval', community: 'Community discoverable' })[mode]}</option>`).join('');
    root().innerHTML = `
      <div class="workspace-heading"><div><span class="eyebrow">Database-backed connections</span><h1>Trading Accounts</h1><p class="muted">Connect with Reporter v1.59, MetaApi, cTrader OAuth, or a signed broker webhook. All identities, tokens, snapshots, and lane membership are stored in PostgreSQL—never local JSON files.</p></div><div class="actions"><button class="btn primary" id="add-account">Reporter / manual</button><button class="btn gold" id="add-broker-api">Broker API</button></div></div>
      <section class="card" style="margin-bottom:18px"><div class="card-head"><div><span class="eyebrow">Direct broker connectivity</span><h3>Broker API Connection Center</h3></div><span class="status-pill connected">PostgreSQL only</span></div><div class="grid3">${brokerConnections.length ? brokerConnections.map((connection) => `<div class="path-item"><strong>${html(String(connection.provider || 'broker').toUpperCase())}</strong><span class="status-pill ${connection.status === 'connected' ? 'connected' : 'waiting'}">${html(connection.status || 'waiting')}</span><small>${html(connection.providerAccountId || connection.label || connection.id)}</small><small>Last sync ${html(connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString() : 'waiting')}</small>${connection.provider === 'metaapi' ? `<button class="btn ghost" data-api-sync="${html(connection.id)}">Refresh API account</button>` : ''}</div>`).join('') : '<div class="setup-note"><strong>No Broker API connections yet</strong><p>MetaApi can import MT4/MT5 account information and positions without the Reporter. cTrader uses OAuth. The signed webhook is for broker/VPS adapters.</p></div>'}</div></section>
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
      </form></dialog>
      <dialog id="broker-api-dialog"><form class="card dialog-form" id="metaapi-form"><div class="card-head"><div><span class="eyebrow">Broker API</span><h3>Connect without Reporter</h3></div><button class="dialog-x" type="button" id="cancel-broker-api">×</button></div><div class="setup-note"><strong>Choose a real provider path</strong><p>MetaApi connects MT4/MT5 through its cloud API. cTrader uses Spotware OAuth. Broker Webhook creates a signed endpoint for an approved broker, VPS, or bridge adapter.</p></div><div class="grid2"><label>MetaApi account ID<input class="input" name="accountId" required placeholder="865d3a4d-..."></label><label>MetaApi region<input class="input" name="region" value="new-york"></label><label class="full">MetaApi token<input class="input" type="password" name="token" required autocomplete="new-password"></label><label>Desk capability<select class="input" name="deskRole"><option value="private">Private Desk</option><option value="lead">Culture Lead</option><option value="receiver">Mirror Receiver</option><option value="dual">Lead + Receiver</option></select></label><label>Nickname<input class="input" name="nickname" placeholder="API master"></label></div><div class="actions"><button class="btn primary" type="submit">Connect MetaApi</button><a class="btn gold" href="/api/v2/broker-api/ctrader/start">Connect cTrader OAuth</a><button class="btn ghost" type="button" id="create-broker-webhook">Create Broker Webhook</button></div><div id="broker-api-status" class="form-status">Credentials are encrypted before PostgreSQL storage.</div></form></dialog>`;

    const brokerDialog = document.querySelector('#broker-api-dialog');
    document.querySelector('#add-broker-api').onclick = () => brokerDialog.showModal();
    document.querySelector('#cancel-broker-api').onclick = () => brokerDialog.close();
    document.querySelector('#metaapi-form').onsubmit = async (event) => { event.preventDefault(); const form=event.target; const status=document.querySelector('#broker-api-status'); const payload=Object.fromEntries(new FormData(form)); status.textContent='Connecting to MetaApi and importing the live account snapshot…'; try{const result=await api('/api/v2/broker-api/metaapi/connect',{method:'POST',body:JSON.stringify(payload)},30000); status.className='form-status success';status.textContent=result.message;toast('MetaApi account connected','ok',7000);await refreshAccounts(false,true);setTimeout(()=>{brokerDialog.close();drawAccounts()},800)}catch(error){status.className='form-status error';status.textContent=error.message;toast(error.message,'error',9000)} };
    document.querySelector('#create-broker-webhook').onclick = async () => { const status=document.querySelector('#broker-api-status'); try{const result=await api('/api/v2/broker-api/webhook/create',{method:'POST',body:JSON.stringify({label:'WISDO Broker API Bridge'})}); status.className='form-status success';status.innerHTML=`Webhook created. Copy this secret now: <code>${html(result.secret)}</code><br>Snapshot URL: <code>${html(result.snapshotUrl)}</code>`;await navigator.clipboard?.writeText(`${result.snapshotUrl}
${result.secret}`)}catch(error){status.className='form-status error';status.textContent=error.message} };
    root().querySelectorAll('[data-api-sync]').forEach((button)=>button.onclick=async()=>{setBusy(button,true,'Refreshing…');try{await api(`/api/v2/broker-api/connections/${encodeURIComponent(button.dataset.apiSync)}/sync`,{method:'POST'},30000);toast('Broker API snapshot refreshed');await refreshAccounts(false,true);drawAccounts()}catch(error){toast(error.message,'error',8000)}finally{setBusy(button,false)}});
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
      try {
        const result = await api(`/api/v2/accounts/${encodeURIComponent(form.dataset.roleAccount)}/desk-role`, { method: 'PATCH', body: JSON.stringify(payload) }, 8000);
        accounts = accounts.map((account) => account.id === result.account?.id ? { ...account, ...result.account } : account);
        toast(`Account capabilities updated in ${Number(result.responseMs || 0)}ms`);
        drawAccounts();
      }
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
    const [ruleResult, options, relayDiagnostics, laneResult] = await Promise.all([
      api('/api/v2/copier-rules', {}, 20000),
      api('/api/copier/options', {}, 30000),
      api('/api/v2/copier/diagnostics', {}, 30000).catch(() => ({ rules: [], relayDiagnostics: [] })),
      api('/api/v2/culture-lanes', {}, 20000).catch(() => ({ lanes: [] })),
    ]);
    const rules = ruleResult.rules || [];
    const lanes = laneResult.lanes || [];
    const leaders = options.leads || [];
    const receivers = options.receivers || [];
    const allVisible = [...(options.accounts || []), ...leaders, ...receivers];
    const byId = Object.fromEntries(allVisible.map((account) => [account.id, account]));
    const diagnostics = options.diagnostics || [];
    const relayByRule = Object.fromEntries((relayDiagnostics.rules || []).map((row) => [row.ruleId, row]));
    const rulesByLane = {};
    for (const rule of rules) {
      const laneId = rule.culture_lane_id || `lane_${rule.id}`;
      (rulesByLane[laneId] ||= []).push(rule);
    }
    const noRouteReady = !leaders.length || !receivers.length;
    root().innerHTML = `
      <div class="workspace-heading"><div><span class="eyebrow">Culture Relay Engine</span><h1>Build a Culture Lane</h1><p class="muted">Choose one Culture Lead, select every receiver account that belongs in the lane, then click the leader symbols that are allowed to relay.</p></div><div class="actions compact"><button class="btn primary" id="repair-live-relay">Repair Live Relay</button><button class="btn ghost" id="refresh-copier-options">Refresh relay state</button></div></div>
      <div class="grid4"><div class="card"><small>Owned accounts</small><div class="metric">${Number(options.summary?.owned || 0)}</div></div><div class="card"><small>Available leads</small><div class="metric">${Number(options.summary?.leads || 0)}</div></div><div class="card"><small>Receivers</small><div class="metric">${Number(options.summary?.receivers || 0)}</div></div><div class="card"><small>Live receivers</small><div class="metric green">${Number(options.summary?.executableReceivers || 0)}</div></div></div>
      ${diagnostics.length ? `<section class="card" style="margin-top:18px"><span class="eyebrow">Account capability diagnostics</span><div class="path-list">${diagnostics.map((item) => `<div class="path-item"><small>${html(item.code || item.severity || 'notice')}</small><strong>${html(item.message)}</strong>${item.accountId ? `<a href="/app/accounts">Fix account role</a>` : ''}</div>`).join('')}</div></section>` : ''}
      <section class="card" style="margin-top:18px"><form id="rule-form" class="grid2">
        <input type="hidden" name="lane_id" value="">
        <label>Lane name<input class="input" name="lane_name" placeholder="Deadshot Income Lane"></label>
        <label>Culture Lead<select class="input" name="master_id" required><option value="">Select Culture Lead</option>${leaders.map((account) => `<option value="${html(account.id)}">${html(account.community_name || accountLabel(account))} · ${html(account.access || 'owned')}</option>`).join('')}</select></label>
        <div class="full receiver-picker"><div class="card-head"><div><span class="eyebrow">Multi-account receivers</span><h3>Select one or more follower accounts</h3></div><span id="receiver-count" class="status-pill waiting">0 selected</span></div><div class="receiver-grid">${receivers.map((account) => `<label class="receiver-choice"><input type="checkbox" name="slave_ids" value="${html(account.id)}"><span><strong>${html(accountLabel(account))}</strong><small>${account.canExecute ? 'Reporter live · execution ready' : 'Pairing or AutoTrading needed'}</small></span></label>`).join('') || '<p class="muted">No receiver accounts are assigned yet.</p>'}</div></div>
        <div class="full symbol-builder"><div class="card-head"><div><span class="eyebrow">Allowed symbols</span><h3>Click green to allow · grey to block</h3></div><div class="actions compact"><button class="btn ghost" id="allow-all-symbols" type="button">Allow All</button><button class="btn ghost" id="block-all-symbols" type="button">Block All</button></div></div><p class="muted">WISDO automatically lists every symbol this leader has traded. These highlights are saved directly into every receiver route in this lane.</p><div id="leader-symbol-highlights" class="symbol-highlight-grid"><div class="setup-note"><strong>Select a Culture Lead</strong><p>Leader trade history will appear here.</p></div></div></div>
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
        <details class="full"><summary>Advanced symbol aliases</summary><label>Symbol mapping<textarea class="input" name="symbol_mapping" placeholder='{"SPXUSD":"US500","XAUUSD":"GOLD"}'></textarea></label></details>
        <label><input type="checkbox" name="auto_match_symbols" checked> Auto-match broker aliases</label><label><input type="checkbox" name="copy_sl_tp" checked> Copy SL/TP</label><label><input type="checkbox" name="copy_pending_orders" checked> Copy pending orders</label><label><input type="checkbox" name="reverse_signals"> Reverse signals</label>
        <div id="rule-status" class="form-status full">${noRouteReady ? 'Assign at least one Culture Lead and one owned Mirror Receiver on the Accounts page.' : 'Choose a leader, receivers, and highlighted symbols.'}</div><div class="actions full"><button class="btn primary" id="save-rule" type="submit" ${noRouteReady ? 'disabled' : ''}>Save and arm multi-account lane</button><button class="btn ghost" id="cancel-lane-edit" type="button" hidden>Cancel edit</button></div>
      </form></section>
      <section class="grid2" style="margin-top:18px">${lanes.length ? lanes.map((lane) => {
        const laneRules = rulesByLane[lane.laneId] || [];
        const master = byId[lane.leaderAccountId] || byId[laneRules[0]?.master_id];
        const followers = (lane.followerAccountIds || laneRules.map((rule) => rule.slave_id)).map((id) => byId[id]).filter(Boolean);
        const readyCount = laneRules.filter((rule) => relayByRule[rule.id]?.executionReady).length;
        const allowed = laneRules[0]?.allowed_symbols || [];
        const issues = laneRules.flatMap((rule) => relayByRule[rule.id]?.issues || []);
        return `<article class="card"><div class="card-head"><div><span class="eyebrow">Combined Culture Lane</span><h3>${html(lane.name || master?.nickname || lane.laneId)}</h3></div><span class="status-pill ${readyCount === laneRules.length && laneRules.length ? 'connected' : 'waiting'}">${readyCount}/${laneRules.length} routes ready</span></div><p><strong>${html(master?.nickname || master?.account_number || lane.leaderAccountId)}</strong> → ${followers.length} receiver account(s)</p><div class="capability-row">${followers.map((follower) => `<span class="status-pill ${follower.canExecute ? 'connected' : 'waiting'}">${html(follower.nickname || follower.account_number || follower.id)}</span>`).join('')}</div><p class="muted">Allowed: ${html(allowed.length ? allowed.join(', ') : (laneRules[0]?.allow_only_highlighted ? 'None · entries blocked' : 'All symbols'))}</p>${issues.length ? `<div class="setup-note"><strong>Relay attention</strong><ul>${[...new Set(issues)].map((issue) => `<li>${html(issue)}</li>`).join('')}</ul></div>` : ''}<div class="actions"><button class="btn primary" data-edit-lane="${html(lane.laneId)}">Edit accounts + symbols</button><button class="btn ghost" data-toggle-lane="${html(lane.laneId)}">${lane.status === 'active' ? 'Pause lane' : 'Resume lane'}</button><button class="btn danger" data-delete-lane="${html(lane.laneId)}">Delete lane</button></div></article>`;
      }).join('') : '<div class="card"><h3>No Culture Lanes yet</h3><p>Select one leader and as many receiver accounts as needed above.</p></div>'}</section>`;

    const formNode = document.querySelector('#rule-form');
    const status = document.querySelector('#rule-status');
    const saveButton = document.querySelector('#save-rule');
    const cancelEdit = document.querySelector('#cancel-lane-edit');
    const masterSelect = formNode.elements.master_id;
    let leaderSymbols = [];
    let allowedSymbols = new Set();

    const updateReceiverCount = () => {
      const count = formNode.querySelectorAll('input[name="slave_ids"]:checked').length;
      const node = document.querySelector('#receiver-count');
      node.textContent = `${count} selected`;
      node.className = `status-pill ${count ? 'connected' : 'waiting'}`;
    };
    formNode.querySelectorAll('input[name="slave_ids"]').forEach((input) => input.onchange = updateReceiverCount);

    const renderSymbols = () => {
      const host = document.querySelector('#leader-symbol-highlights');
      if (!leaderSymbols.length) {
        host.innerHTML = '<div class="setup-note"><strong>No stored leader symbols yet</strong><p>Trade the leader on demo or sync its history. Until history arrives, new entries are not restricted by a symbol list.</p></div>';
        return;
      }
      host.innerHTML = leaderSymbols.map((item) => `<button type="button" class="symbol-highlight ${allowedSymbols.has(item.symbol) ? 'allowed' : 'blocked'}" data-symbol-highlight="${html(item.symbol)}"><strong>${html(item.symbol)}</strong><small>${Number(item.count || 0)} trade(s) · ${allowedSymbols.has(item.symbol) ? 'ALLOWED' : 'BLOCKED'}</small></button>`).join('');
      host.querySelectorAll('[data-symbol-highlight]').forEach((button) => button.onclick = () => {
        const symbol = button.dataset.symbolHighlight;
        if (allowedSymbols.has(symbol)) allowedSymbols.delete(symbol); else allowedSymbols.add(symbol);
        renderSymbols();
      });
    };
    const loadLeaderSymbols = async (leaderId, selected = null) => {
      leaderSymbols = [];
      allowedSymbols = new Set();
      renderSymbols();
      if (!leaderId) return;
      const result = await api(`/api/v2/leaders/${encodeURIComponent(leaderId)}/symbol-history`, {}, 20000);
      leaderSymbols = result.symbols || [];
      allowedSymbols = new Set(selected === null ? leaderSymbols.map((item) => item.symbol) : selected);
      renderSymbols();
    };
    masterSelect.onchange = () => loadLeaderSymbols(masterSelect.value).catch((error) => { status.className = 'form-status error full'; status.textContent = error.message; });
    document.querySelector('#allow-all-symbols').onclick = () => { allowedSymbols = new Set(leaderSymbols.map((item) => item.symbol)); renderSymbols(); };
    document.querySelector('#block-all-symbols').onclick = () => { allowedSymbols.clear(); renderSymbols(); };
    document.querySelector('#repair-live-relay').onclick = async (event) => {
      const button=event.currentTarget; setBusy(button,true,'Repairing routes…');
      try{
        const repaired=await api('/api/v2/copier/repair-relay',{method:'POST',body:'{}'},60000);
        toast(repaired.failedCount?`Registered ${repaired.registered}; ${repaired.failedCount} route(s) still need Reporter attention.`:`Live relay repaired across ${repaired.registered} route(s).`,repaired.failedCount?'warn':'ok',9000);
        await drawRules();
      }catch(error){toast(error.message,'error',9000)}finally{setBusy(button,false)}
    };
    document.querySelector('#refresh-copier-options').onclick = async () => { await refreshAccounts(true, true); drawRules(); };

    const resetForm = () => { formNode.reset(); formNode.elements.lane_id.value = ''; leaderSymbols = []; allowedSymbols = new Set(); renderSymbols(); formNode.querySelectorAll('input[name="slave_ids"]').forEach((input) => { input.checked = false; }); updateReceiverCount(); cancelEdit.hidden = true; saveButton.textContent = 'Save and arm multi-account lane'; status.className = 'form-status full'; status.textContent = 'Choose a leader, receivers, and highlighted symbols.'; };
    cancelEdit.onclick = resetForm;

    root().querySelectorAll('[data-edit-lane]').forEach((button) => button.onclick = async () => {
      try {
        const laneId = button.dataset.editLane;
        const overview = await api(`/api/v2/culture-lanes/${encodeURIComponent(laneId)}/overview`);
        const lane = overview.lane || {};
        const laneRules = rulesByLane[laneId] || [];
        const base = laneRules[0] || {};
        formNode.elements.lane_id.value = laneId;
        formNode.elements.lane_name.value = lane.name || '';
        formNode.elements.master_id.value = lane.leaderAccountId || base.master_id || '';
        for (const name of ['risk_type','risk_value','min_lot','max_lot','equity_protection_pct','max_daily_loss','max_open_trades','max_spread_points','max_slippage_points','trading_hours_start','trading_hours_end']) if (formNode.elements[name] && base[name] !== undefined && base[name] !== null) formNode.elements[name].value = base[name];
        formNode.elements.symbol_mapping.value = JSON.stringify(overview.symbolPolicy?.aliases || base.symbol_mapping || {}, null, 2);
        formNode.elements.auto_match_symbols.checked = overview.symbolPolicy?.autoMatch !== false;
        formNode.elements.copy_sl_tp.checked = base.copy_sl_tp !== false;
        formNode.elements.copy_pending_orders.checked = Boolean(base.copy_pending_orders);
        formNode.elements.reverse_signals.checked = Boolean(base.reverse_signals);
        const selectedFollowers = new Set((lane.followerAccountIds || []).map(String));
        formNode.querySelectorAll('input[name="slave_ids"]').forEach((input) => { input.checked = selectedFollowers.has(input.value); });
        updateReceiverCount();
        await loadLeaderSymbols(formNode.elements.master_id.value, overview.symbolPolicy?.allowedSymbols || []);
        cancelEdit.hidden = false;
        saveButton.textContent = 'Update Culture Lane';
        status.className = 'form-status working full';
        status.textContent = 'Editing this lane. Saving will add or remove receiver routes and apply the highlighted symbols to every receiver.';
        formNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) { toast(error.message, 'error', 7000); }
    });

    formNode.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(formNode);
      const payload = Object.fromEntries(data);
      payload.slave_ids = data.getAll('slave_ids');
      payload.allowed_symbols = [...allowedSymbols];
      payload.blocked_symbols = leaderSymbols.map((item) => item.symbol).filter((symbol) => !allowedSymbols.has(symbol));
      payload.allow_only_highlighted = leaderSymbols.length > 0;
      payload.copy_sl_tp = data.has('copy_sl_tp'); payload.copy_pending_orders = data.has('copy_pending_orders'); payload.reverse_signals = data.has('reverse_signals'); payload.auto_match_symbols = data.has('auto_match_symbols');
      if (!payload.slave_ids.length) { status.className = 'form-status error full'; status.textContent = 'Select at least one receiver account.'; return; }
      try { payload.symbol_mapping = JSON.parse(payload.symbol_mapping || '{}'); } catch { status.className = 'form-status error full'; status.textContent = 'Symbol mapping must be valid JSON.'; return; }
      setBusy(saveButton, true, payload.lane_id ? 'Updating every route…' : 'Creating receiver routes…');
      try {
        const endpoint = payload.lane_id ? `/api/v2/culture-lanes/${encodeURIComponent(payload.lane_id)}/copier-configuration` : '/api/v2/copier-rules';
        const saved = await api(endpoint, { method: payload.lane_id ? 'PUT' : 'POST', body: JSON.stringify(payload) }, 60000);
        const routeCount = saved.rules?.length || saved.receiverCount || 0;
        status.className = 'form-status success full';
        status.textContent = `Culture Lane saved with ${routeCount} receiver route(s). Highlighted symbols now govern every new entry.`;
        toast(`Culture Lane armed across ${routeCount} receiver account(s)`, saved.executionReady === false ? 'warn' : 'ok', 7000);
        if(saved.executionReady===false) api('/api/v2/copier/repair-relay',{method:'POST',body:'{}'},60000).catch(()=>null);
        setTimeout(() => drawRules(), saved.executionReady===false?1200:350);
      } catch (error) { status.className = 'form-status error full'; status.textContent = error.message; }
      finally { setBusy(saveButton, false); }
    };
    root().querySelectorAll('[data-toggle-lane]').forEach((button) => button.onclick = async () => { await api(`/api/v2/culture-lanes/${encodeURIComponent(button.dataset.toggleLane)}/toggle`, { method: 'POST', body: '{}' }); drawRules(); });
    root().querySelectorAll('[data-delete-lane]').forEach((button) => button.onclick = async () => { if (!confirm('Delete this Culture Lane and every receiver route inside it?')) return; await api(`/api/v2/culture-lanes/${encodeURIComponent(button.dataset.deleteLane)}`, { method: 'DELETE' }); toast('Culture Lane deleted'); drawRules(); });
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

  function durationLabel(milliseconds = 0) {
    const ms = Number(milliseconds || 0);
    if (!ms) return '—';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)} sec`;
    return `${(ms / 60000).toFixed(1)} min`;
  }

  function trackerCard(tracker) {
    if (!tracker) return '';
    const analysis = tracker.after || tracker.before || {};
    const before = tracker.before || {};
    const result = tracker.result || {};
    const completionMs = tracker.completed_at && tracker.requested_at ? new Date(tracker.completed_at) - new Date(tracker.requested_at) : 0;
    const statusClass = tracker.status === 'completed' ? 'connected' : ['failed', 'queue_failed'].includes(tracker.status) ? 'waiting' : 'waiting';
    const raw = result.raw || {};
    return `<details class="card" style="margin-top:14px"><summary class="card-head" style="cursor:pointer"><div><span class="eyebrow">${html(tracker.request_source || 'website')} · ${html(tracker.account_id || 'portfolio')}</span><h3>${html(tracker.label || tracker.mode || 'Close analysis')}</h3><small>${html(tracker.requested_at ? new Date(tracker.requested_at).toLocaleString() : 'Unknown request time')}</small></div><span class="status-pill ${statusClass}">${html(tracker.status || 'queued')}</span></summary>
      <div class="grid4" style="margin-top:16px"><div><small>Closed</small><strong>${Number(result.closedCount || 0)}</strong></div><div><small>Failed</small><strong class="${Number(result.failedCount || 0) ? 'red' : 'green'}">${Number(result.failedCount || 0)}</strong></div><div><small>Realized</small><strong class="${Number(result.realizedPnl || 0) >= 0 ? 'green' : 'red'}">${money(result.realizedPnl)}</strong></div><div><small>Completion</small><strong>${durationLabel(completionMs)}</strong></div></div>
      <div class="grid4" style="margin-top:14px"><div><small>Win rate after</small><strong>${Number(analysis.gauges?.winRate || 0).toFixed(1)}%</strong></div><div><small>Profit factor</small><strong>${Number(analysis.gauges?.profitFactor || 0).toFixed(2)}</strong></div><div><small>Risk pressure</small><strong>${Number(analysis.gauges?.riskPressure || 0)}/100</strong></div><div><small>Compound score</small><strong>${Number(analysis.gauges?.compoundScore || 0)}/100</strong></div></div>
      <p class="muted">${html(result.message || 'Waiting for the MT4 Reporter to execute and return the final result. This record remains saved with account history.')}</p>
      <div class="table-wrap"><table><thead><tr><th>Command ID</th><th>Before P/L</th><th>After P/L</th><th>Daily trend</th><th>Weekly trend</th></tr></thead><tbody><tr><td><code>${html(tracker.command_id || 'pending')}</code></td><td>${money(before.allTime?.pnl)}</td><td>${money(analysis.allTime?.pnl)}</td><td>${Number(analysis.gauges?.dailyTrend || 0)}</td><td>${Number(analysis.gauges?.weeklyTrend || 0)}</td></tr></tbody></table></div>
      ${Object.keys(raw).length ? `<details style="margin-top:12px"><summary>Reporter result payload</summary><pre style="white-space:pre-wrap;overflow:auto">${html(JSON.stringify(raw, null, 2).slice(0, 5000))}</pre></details>` : ''}
    </details>`;
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
    form.onsubmit = async (event) => { event.preventDefault(); const data = new FormData(form); const payload = Object.fromEntries(data); payload.enabled = data.has('enabled'); payload.resetBaseline = true; payload.goalValue = Number(payload.goalValue); payload.trailRetracePercent = Number(payload.trailRetracePercent); payload.stairSteps = String(payload.stairSteps || '').split(/[;,\s]+/).map(Number).filter((value) => value > 0); try { await api(`/api/v2/culture-lanes/${encodeURIComponent(laneId)}/harvest-policy`, { method: 'PUT', body: JSON.stringify(payload) }); toast('Harvest policy saved'); await drawHarvest(); } catch (error) { toast(error.message, 'error'); } };
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
    if (!lanes.length) return emptyLaneState('Lane Intelligence', 'Connect a Culture Lane so WISDO can welcome you, read live MT4 snapshots, and build a grounded coaching history.');
    const laneId = laneIdFromLocation(lanes);
    const [overview, coach] = await Promise.all([
      api(`/api/v2/culture-lanes/${encodeURIComponent(laneId)}/overview`),
      api(`/api/v2/wisdo/coach?lane_id=${encodeURIComponent(laneId)}&limit=30`).catch((error) => ({ messages: [], preferences: {}, aiConfigured: false, error: error.message })),
    ]);
    const dna = (overview.dnaSnapshots || [])[0] || null;
    const report = (overview.intelligenceReports || [])[0] || null;
    const messages = coach.messages || [];
    const latest = messages[0] || null;
    const preferences = coach.preferences || {};
    const coachCards = messages.length ? messages.slice(0, 12).map((message) => `<article class="card"><div class="card-head"><div><span class="eyebrow">${html(message.mode || 'lane coach')} · ${Number(message.confidence || 0).toFixed(0)}% confidence</span><h3>${html(message.headline || 'WISDO observation')}</h3></div><span class="status-pill ${message.notificationSeverity === 'critical' ? 'waiting' : 'connected'}">${html(message.aiGenerated ? 'AI grounded' : 'rules grounded')}</span></div><p>${html(message.summary || '')}</p><div class="setup-note"><strong>Education</strong><p>${html(message.education || '')}</p></div>${(message.risks || []).length ? `<h4>What WISDO sees</h4><ul class="feature-list">${message.risks.map((item) => `<li>${html(item)}</li>`).join('')}</ul>` : ''}${(message.nextActions || []).length ? `<h4>Suggested review</h4><ul class="feature-list">${message.nextActions.map((item) => `<li>${html(item)}</li>`).join('')}</ul>` : ''}<small class="muted">${html(message.createdAt ? new Date(message.createdAt).toLocaleString() : '')} · Education and decision support only</small></article>`).join('') : '<article class="card"><h3>WISDO is preparing the first lane welcome</h3><p>The first grounded message appears after the lane snapshot is available.</p></article>';
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">Active WISDO portfolio coach</span><h1>Lane Intelligence</h1><p class="muted">WISDO reads the combined lane snapshot, confirmed MT4 history, execution timeline, Trade Passports, Harvest cycles, and shared Academy learning memory. It explains observations in plain language without inventing candles or promising outcomes.</p></div><div class="actions">${laneSelector(lanes, laneId)}<button class="btn primary" id="refresh-wisdo-coach">Read Lane Now</button><button class="btn ghost" id="generate-dna">Recalculate DNA</button></div></div>
      <section class="card portfolio-hero"><div class="card-head"><div><span class="eyebrow">Welcome from WISDO</span><h2>${html(latest?.headline || 'Your lane coach is connected')}</h2></div><span class="status-pill ${coach.aiConfigured ? 'connected' : 'waiting'}">${coach.aiConfigured ? 'OpenAI + WISDO memory' : 'WISDO deterministic coach'}</span></div><p class="lead">${html(latest?.chatMessage || latest?.summary || 'Ask WISDO what the lane is doing, what changed, or which lesson to study next.')}</p><div class="grid4"><div><small>Lane equity</small><strong>${money(overview.vault?.equity)}</strong></div><div><small>Floating P/L</small><strong class="${Number(overview.vault?.floatingProfit || 0) >= 0 ? 'green' : 'red'}">${money(overview.vault?.floatingProfit)}</strong></div><div><small>Open trades</small><strong>${Number(overview.vault?.openTrades || 0)}</strong></div><div><small>Execution</small><strong>${html(overview.vault?.executionStatus || 'waiting')}</strong></div></div></section>
      <section class="grid2" style="margin-top:18px"><article class="card"><div class="card-head"><div><span class="eyebrow">Talk to the lane</span><h3>Ask WISDO Coach</h3></div></div><div id="lane-coach-thread" class="tutor-thread">${messages.slice(0, 6).reverse().map((message) => `<div class="tutor-message assistant"><strong>${html(message.headline || 'WISDO')}</strong><br>${html(message.chatMessage || message.summary || '')}</div>`).join('') || '<div class="tutor-message assistant">Welcome. Ask what the lane is doing, what risk changed, why a result occurred, or which Academy lesson matches the current behavior.</div>'}</div><form id="lane-coach-form" class="tutor-compose"><textarea class="input" name="question" rows="3" required placeholder="Example: Explain today’s drawdown, strongest symbol, receiver execution, and what I should study before changing the lane."></textarea><button class="btn primary" type="submit">Ask WISDO</button></form><div class="actions"><button class="btn ghost coach-prompt" data-prompt="Explain the current open exposure and the most important risk visible in the lane.">Explain risk</button><button class="btn ghost coach-prompt" data-prompt="Compare the recent winning and losing trades and teach me the lesson without promising the next trade.">Teach from history</button><button class="btn ghost coach-prompt" data-prompt="Check leader-to-receiver execution health, symbol routing, and close confirmations.">Audit execution</button></div></article><article class="card"><span class="eyebrow">Opt-in WISDO outreach</span><h3>Proactive coach delivery</h3><p>WISDO can create a chat when the lane changes and send warning-level coaching through channels you explicitly enable.</p><form id="coach-preferences" class="path-list"><label class="path-item"><input type="checkbox" name="enabled" ${preferences.enabled !== false ? 'checked' : ''}> <strong>Enable proactive WISDO coach</strong></label><label class="path-item"><input type="checkbox" name="email" ${preferences.email ? 'checked' : ''}> Email coaching</label><label class="path-item"><input type="checkbox" name="sms" ${preferences.sms ? 'checked' : ''}> SMS coaching</label><label class="path-item"><input type="checkbox" name="discordDm" ${preferences.discordDm ? 'checked' : ''}> Discord DM from WISDO</label><label>Minimum severity<select class="input" name="minimumSeverity"><option value="info" ${preferences.minimumSeverity === 'info' ? 'selected' : ''}>Info</option><option value="warning" ${preferences.minimumSeverity !== 'info' && preferences.minimumSeverity !== 'critical' ? 'selected' : ''}>Warning</option><option value="critical" ${preferences.minimumSeverity === 'critical' ? 'selected' : ''}>Critical</option></select></label><button class="btn primary" type="submit">Save coach preferences</button></form><p class="muted">Email, SMS, and Discord require the matching Render provider credentials and a saved destination. Messages are stored in PostgreSQL before delivery.</p></article></section>
      ${dna ? `<section class="grid4" style="margin-top:18px">${gaugeCard('Aggression', dna.aggression)}${gaugeCard('Patience', dna.patience)}${gaugeCard('Harvest accuracy', dna.harvestAccuracy)}${gaugeCard('Execution health', dna.executionHealth)}${gaugeCard('Win rate', dna.winRate)}${gaugeCard('Confidence', dna.confidence)}</section>` : '<section class="card" style="margin-top:18px"><h3>DNA needs a larger confirmed sample</h3><p>WISDO will calculate behavior only from durable results and finalized Trade Passports.</p></section>'}
      ${report ? `<section class="grid2" style="margin-top:18px"><article class="card"><h3>Deterministic observations</h3><ul class="feature-list">${(report.observations || []).map((item) => `<li>${html(item)}</li>`).join('')}</ul></article><article class="card"><h3>Explainable recommendations</h3><ul class="feature-list">${(report.recommendations || []).map((item) => `<li><strong>${html(item.type)}</strong> — ${html(item.text)}</li>`).join('') || '<li>No recommendation generated.</li>'}</ul></article></section>` : ''}
      <section style="margin-top:18px"><div class="workspace-heading"><div><span class="eyebrow">Persistent coaching history</span><h2>What WISDO has told this lane</h2></div></div><div class="grid2">${coachCards}</div></section>`;
    bindLaneSelector(drawLaneIntelligence);
    document.querySelector('#generate-dna').onclick = async () => { await Promise.all([api(`/api/v2/culture-lanes/${encodeURIComponent(laneId)}/dna`, { method: 'POST', body: '{}' }), api(`/api/v2/culture-lanes/${encodeURIComponent(laneId)}/intelligence`, { method: 'POST', body: '{}' })]); toast('Lane DNA and deterministic intelligence refreshed'); drawLaneIntelligence(); };
    document.querySelector('#refresh-wisdo-coach').onclick = async (event) => { setBusy(event.currentTarget, true, 'Reading snapshots…'); try { await api('/api/v2/wisdo/coach/chat', { method: 'POST', body: JSON.stringify({ laneId, mode: 'chat', question: 'Read the newest lane snapshot and tell me what changed, what requires attention, and what lesson is most useful now.' }) }, 45000); toast('WISDO read the latest lane state'); drawLaneIntelligence(); } catch (error) { toast(error.message, 'error', 9000); } };
    const form = document.querySelector('#lane-coach-form');
    const ask = async (question) => { if (!question) return; const thread = document.querySelector('#lane-coach-thread'); thread.insertAdjacentHTML('beforeend', `<div class="tutor-message user">${html(question)}</div><div class="tutor-message assistant" data-pending>WISDO is grounding the answer in PostgreSQL lane history and live snapshots…</div>`); try { const result = await api('/api/v2/wisdo/coach/chat', { method: 'POST', body: JSON.stringify({ laneId, mode: 'chat', question }) }, 45000); const pending = thread.querySelector('[data-pending]'); if (pending) { pending.removeAttribute('data-pending'); pending.innerHTML = `<strong>${html(result.message?.headline || 'WISDO')}</strong><br>${html(result.message?.chatMessage || result.message?.summary || '')}`; } } catch (error) { const pending = thread.querySelector('[data-pending]'); if (pending) pending.textContent = error.message; } };
    form.onsubmit = async (event) => { event.preventDefault(); const question = form.elements.question.value.trim(); form.elements.question.value = ''; await ask(question); };
    document.querySelectorAll('.coach-prompt').forEach((button) => button.onclick = () => ask(button.dataset.prompt));
    document.querySelector('#coach-preferences').onsubmit = async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); await api('/api/v2/wisdo/coach/preferences', { method: 'PUT', body: JSON.stringify({ enabled: data.has('enabled'), email: data.has('email'), sms: data.has('sms'), discordDm: data.has('discordDm'), minimumSeverity: data.get('minimumSeverity') }) }); toast('WISDO coach preferences saved'); drawLaneIntelligence(); };
  }

  async function drawCompoundTracker() {
    const params = new URLSearchParams(location.search);
    const lanes = await loadCultureLanes().catch(() => []);
    const requestedScope = params.get('scope') || 'portfolio';
    const period = ['today', '7d', '30d', '90d', 'year', 'all'].includes(params.get('period')) ? params.get('period') : '30d';
    const validScopes = new Set(['portfolio', ...lanes.map((lane) => `lane:${lane.laneId}`), ...accounts.map((account) => `account:${account.id}`)]);
    const scope = validScopes.has(requestedScope) ? requestedScope : 'portfolio';
    const laneId = scope.startsWith('lane:') ? scope.slice(5) : '';
    const accountId = scope.startsWith('account:') ? scope.slice(8) : '';
    const query = new URLSearchParams({ period, limit: '100' });
    if (laneId) query.set('lane_id', laneId);
    if (accountId) query.set('account_id', accountId);
    const response = await api(`/api/v2/trades/compound-report?${query}`);
    const report = response.report || {};
    const selected = report.selected || {};
    const goals = report.goals || {};
    const gauges = report.gauges || {};
    const periods = [['Today', report.today || {}], ['Last 7 days', report.weekly || {}], ['Last 30 days', report.monthly || {}], [`Selected · ${period}`, selected], ['All time', report.allTime || {}]];
    const scopeOptions = [
      `<option value="portfolio" ${scope === 'portfolio' ? 'selected' : ''}>All connected accounts</option>`,
      ...lanes.map((lane) => `<option value="lane:${html(lane.laneId)}" ${scope === `lane:${lane.laneId}` ? 'selected' : ''}>Culture Lane · ${html(lane.name || lane.laneId)}</option>`),
      ...accounts.map((account) => `<option value="account:${html(account.id)}" ${scope === `account:${account.id}` ? 'selected' : ''}>Account · ${html(account.nickname || account.account_number || account.id)}</option>`),
    ].join('');
    const scopeLabel = scope === 'portfolio' ? 'All connected accounts' : scope.startsWith('lane:') ? lanes.find((lane) => lane.laneId === laneId)?.name || laneId : accounts.find((account) => String(account.id) === String(accountId))?.nickname || accounts.find((account) => String(account.id) === String(accountId))?.account_number || accountId;
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">Persistent compounding intelligence</span><h1>Compound Tracker</h1><p class="muted">Complete results for ${html(scopeLabel)}: realized and floating performance, drawdown, expectancy, streaks, symbol/account attribution, goals, MT4 close confirmations, and trade-level history.</p></div><div class="actions"><a class="btn danger" href="/app/trades">Open Trade Controls</a><button class="btn ghost" id="export-compound">Export visible trades</button><button class="btn ghost" id="refresh-trackers">Refresh</button></div></div>
      <section class="card"><div class="grid3"><label>Scope<select class="input" id="compound-scope">${scopeOptions}</select></label><label>Period<select class="input" id="compound-period"><option value="today" ${period === 'today' ? 'selected' : ''}>Today</option><option value="7d" ${period === '7d' ? 'selected' : ''}>7 days</option><option value="30d" ${period === '30d' ? 'selected' : ''}>30 days</option><option value="90d" ${period === '90d' ? 'selected' : ''}>90 days</option><option value="year" ${period === 'year' ? 'selected' : ''}>1 year</option><option value="all" ${period === 'all' ? 'selected' : ''}>All time</option></select></label><div><small>Data source</small><strong>${html(report.dataSource || 'waiting')}</strong><p class="muted">${Number(report.connectedAccountCount || 0)}/${Number(report.accountCount || 0)} account(s) reporting</p></div></div></section>
      <section class="grid4" style="margin-top:18px"><div class="card"><small>Combined balance</small><div class="metric">${money(report.balance)}</div></div><div class="card"><small>Combined equity</small><div class="metric">${money(report.equity)}</div></div><div class="card"><small>Selected realized P/L</small><div class="metric ${Number(selected.pnl || 0) >= 0 ? 'green' : 'red'}">${money(selected.pnl)}</div><small>${Number(report.returnPercent || 0).toFixed(2)}% of current balance</small></div><div class="card"><small>Floating P/L</small><div class="metric ${Number(report.floatingPnl || 0) >= 0 ? 'green' : 'red'}">${money(report.floatingPnl)}</div><small>${Number(report.openTradeCount || 0)} open position(s)</small></div></section>
      <section class="grid4" style="margin-top:18px">${gaugeCard('Win rate', gauges.winRate || 0, { suffix: '%' })}${gaugeCard('Profit factor', gauges.profitFactor || 0, { max: 5 })}${gaugeCard('Risk pressure', gauges.riskPressure || 0, { inverse: true })}${gaugeCard('Consistency', gauges.consistency || 0, { suffix: '%' })}</section>
      <section class="card" style="margin-top:18px"><div class="card-head"><div><span class="eyebrow">Profit targets</span><h3>Daily · Weekly · Monthly Progress</h3></div><button class="btn primary" id="save-compound-goals">Save Goals</button></div><div class="grid3"><label>Daily dollar goal<input class="input" id="daily-compound-goal" type="number" min="0" step="0.01" value="${Number(goals.dailyTargetAmount || 0)}"></label><label>Weekly dollar goal<input class="input" id="weekly-compound-goal" type="number" min="0" step="0.01" value="${Number(goals.weeklyTargetAmount || 0)}"></label><label>Monthly dollar goal<input class="input" id="monthly-compound-goal" type="number" min="0" step="0.01" value="${Number(goals.monthlyTargetAmount || 0)}"></label></div><div class="grid3" style="margin-top:16px">${gaugeCard('Daily goal', goals.dailyProgress ?? 0, { suffix: '%' })}${gaugeCard('Weekly goal', goals.weeklyProgress ?? 0, { suffix: '%' })}${gaugeCard('Monthly goal', goals.monthlyProgress ?? 0, { suffix: '%' })}</div>${goals.inheritedHarvestGoal ? `<p class="muted">This lane also has Harvest ${goals.inheritedHarvestGoal.enabled ? 'armed' : 'disabled'}: ${html(goals.inheritedHarvestGoal.goalType)} ${Number(goals.inheritedHarvestGoal.goalValue || 0)}.</p>` : ''}</section>
      <section class="grid2" style="margin-top:18px"><article class="card"><div class="card-head"><h3>Daily cumulative P/L</h3><span>${money((report.dailySeries || []).at(-1)?.cumulative)}</span></div>${lineChart(report.dailySeries || [], 'cumulative', 'Daily cumulative profit')}</article><article class="card"><div class="card-head"><h3>Weekly cumulative P/L</h3><span>${money((report.weeklySeries || []).at(-1)?.cumulative)}</span></div>${lineChart(report.weeklySeries || [], 'cumulative', 'Weekly cumulative profit')}</article></section>
      <section class="card table-wrap" style="margin-top:18px"><h3>Performance by period</h3><table><thead><tr><th>Period</th><th>Trades</th><th>Net P/L</th><th>Wins</th><th>Losses</th><th>Win rate</th><th>Profit factor</th><th>Expectancy</th></tr></thead><tbody>${periods.map(([label, row]) => `<tr><td><strong>${html(label)}</strong></td><td>${Number(row.trades || 0)}</td><td class="${Number(row.pnl || 0) >= 0 ? 'green' : 'red'}">${money(row.pnl)}</td><td>${Number(row.wins || 0)}</td><td>${Number(row.losses || 0)}</td><td>${Number(row.winRate || 0).toFixed(1)}%</td><td>${Number(row.profitFactor || 0).toFixed(2)}</td><td>${money(row.expectancy ?? row.average)}</td></tr>`).join('')}</tbody></table></section>
      <section class="grid4" style="margin-top:18px"><div class="card"><small>Average win</small><div class="metric green">${money(selected.averageWin)}</div><small>Largest ${money(selected.largestWin)}</small></div><div class="card"><small>Average loss</small><div class="metric red">${money(selected.averageLoss)}</div><small>Largest ${money(selected.largestLoss)}</small></div><div class="card"><small>Payoff / Recovery</small><div class="metric">${Number(selected.payoffRatio || 0).toFixed(2)}</div><small>Recovery ${Number(report.recoveryFactor || 0).toFixed(2)}</small></div><div class="card"><small>Drawdown</small><div class="metric red">${Number(report.currentDrawdownPercent || 0).toFixed(2)}%</div><small>Maximum equity ${Number(report.maxEquityDrawdownPercent || 0).toFixed(2)}% · Closed ${money(selected.maxClosedDrawdown)}</small></div></section>
      <section class="grid4" style="margin-top:18px"><div class="card"><small>Gross profit</small><div class="metric green">${money(selected.grossProfit)}</div></div><div class="card"><small>Gross loss</small><div class="metric red">${money(selected.grossLoss)}</div></div><div class="card"><small>Best streak</small><div class="metric">${Number(selected.maxWinStreak || 0)}</div><small>Worst streak ${Number(selected.maxLossStreak || 0)}</small></div><div class="card"><small>Average hold</small><div class="metric">${Number(selected.averageHoldMinutes || 0).toFixed(1)}m</div><small>${Number(selected.breakeven || 0)} breakeven trade(s)</small></div></section>
      <section class="grid2" style="margin-top:18px"><article class="card table-wrap"><h3>Symbol contribution</h3><table><thead><tr><th>Symbol</th><th>Trades</th><th>P/L</th><th>Win rate</th><th>Lots</th></tr></thead><tbody>${(report.bySymbol || []).length ? report.bySymbol.map((row) => `<tr><td><strong>${html(row.key)}</strong></td><td>${Number(row.trades || 0)}</td><td class="${Number(row.pnl || 0) >= 0 ? 'green' : 'red'}">${money(row.pnl)}</td><td>${Number(row.winRate || 0).toFixed(1)}%</td><td>${Number(row.lots || 0).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="5">No closed symbol results for this period.</td></tr>'}</tbody></table></article><article class="card table-wrap"><h3>Account contribution</h3><table><thead><tr><th>Account</th><th>Trades</th><th>P/L</th><th>Win rate</th><th>Profit factor</th></tr></thead><tbody>${(report.byAccount || []).length ? report.byAccount.map((row) => `<tr><td><strong>${html(row.account || row.key)}</strong></td><td>${Number(row.trades || 0)}</td><td class="${Number(row.pnl || 0) >= 0 ? 'green' : 'red'}">${money(row.pnl)}</td><td>${Number(row.winRate || 0).toFixed(1)}%</td><td>${Number(row.profitFactor || 0).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="5">No closed account results for this period.</td></tr>'}</tbody></table></article></section>
      <section class="card table-wrap" style="margin-top:18px"><div class="card-head"><div><span class="eyebrow">Execution ledger</span><h3>Compound close summary</h3></div><span>${Number(report.trackerSummary?.completed || 0)} completed · ${Number(report.trackerSummary?.failed || 0)} failed · ${Number(report.trackerSummary?.pending || 0)} pending</span></div><table><thead><tr><th>Tracker events</th><th>Orders closed</th><th>Orders failed</th><th>Tracker realized</th><th>Average confirmation</th></tr></thead><tbody><tr><td>${Number(report.trackerSummary?.total || 0)}</td><td>${Number(report.trackerSummary?.closedOrders || 0)}</td><td>${Number(report.trackerSummary?.failedOrders || 0)}</td><td>${money(report.trackerSummary?.realizedPnl)}</td><td>${durationLabel(report.trackerSummary?.averageCompletionMs)}</td></tr></tbody></table></section>
      <section style="margin-top:18px">${(report.trackers || []).length ? report.trackers.map((tracker) => trackerCard(tracker)).join('') : '<div class="card"><h3>No Compound Tracker events yet</h3><p>Use Trade Log, the Culture Lane dashboard, or Harvest controls. WISDO will save the request, command, MT4 confirmation, result, and after-close analysis here.</p></div>'}</section>
      <section class="card table-wrap" style="margin-top:18px"><h3>Recent closed trades</h3><table><thead><tr><th>Closed</th><th>Account</th><th>Ticket</th><th>Symbol</th><th>Side</th><th>Lots</th><th>Hold</th><th>P/L</th></tr></thead><tbody>${(report.recentClosedTrades || []).length ? report.recentClosedTrades.map((trade) => `<tr><td>${html(trade.closedAt ? new Date(trade.closedAt).toLocaleString() : '—')}</td><td>${html(trade.accountId || '')}</td><td>${html(trade.ticket || '')}</td><td><strong>${html(trade.symbol || '')}</strong></td><td>${html(String(trade.side || '').toUpperCase())}</td><td>${Number(trade.lots || 0).toFixed(2)}</td><td>${Number(trade.holdMinutes || 0).toFixed(1)}m</td><td class="${Number(trade.pnl || 0) >= 0 ? 'green' : 'red'}">${money(trade.pnl)}</td></tr>`).join('') : '<tr><td colspan="8">Waiting for closed MT4 history.</td></tr>'}</tbody></table></section>`;
    const updateLocation = () => {
      const url = new URL(location.href);
      url.searchParams.set('scope', document.querySelector('#compound-scope').value);
      url.searchParams.set('period', document.querySelector('#compound-period').value);
      history.replaceState(null, '', `${url.pathname}${url.search}`);
      drawCompoundTracker();
    };
    document.querySelector('#compound-scope').onchange = updateLocation;
    document.querySelector('#compound-period').onchange = updateLocation;
    document.querySelector('#refresh-trackers').onclick = drawCompoundTracker;
    document.querySelector('#save-compound-goals').onclick = async () => {
      const payload = { dailyTargetAmount: Number(document.querySelector('#daily-compound-goal').value || 0), weeklyTargetAmount: Number(document.querySelector('#weekly-compound-goal').value || 0), monthlyTargetAmount: Number(document.querySelector('#monthly-compound-goal').value || 0) };
      if (laneId) payload.lane_id = laneId;
      if (accountId) payload.account_id = accountId;
      await api('/api/v2/trades/compound-goals', { method: 'POST', body: JSON.stringify(payload) });
      toast('Compound Tracker goals saved'); drawCompoundTracker();
    };
    document.querySelector('#export-compound').onclick = () => {
      const rows = report.recentClosedTrades || [];
      const fields = ['closedAt', 'accountId', 'ticket', 'symbol', 'side', 'lots', 'holdMinutes', 'pnl'];
      const csv = [fields.join(','), ...rows.map((row) => fields.map((field) => JSON.stringify(row[field] ?? '')).join(','))].join('\n');
      const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `wisdo-compound-${period}.csv`; link.click(); URL.revokeObjectURL(link.href);
    };
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
      <section class="card" style="margin-top:18px"><div class="card-head"><div><span class="eyebrow">Execution authority</span><h3>Account-specific close controls</h3></div><div class="actions"><a class="btn ghost" href="/app/accounts">Check Reporter</a><a class="btn primary" href="/app/dashboard">Parallel Lane Close</a></div></div><p class="muted">Close All sends one atomic MT4 sweep command for the selected account with priority 5000 and a 2-minute expiry. Culture Lane Close All fans commands to every account in parallel; entry filters never block close authority.</p></section>
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
    const [academy, lanes] = await Promise.all([
      api('/api/v2/academy/tracks').catch(() => ({ tracks: [], progress: {}, summary: { courseCount: 6500, domainCount: 65 } })),
      loadCultureLanes().catch(() => []),
    ]);
    const params = new URLSearchParams(location.search);
    const requestedLane = params.get('lane') || '';
    const laneId = lanes.some((lane) => lane.laneId === requestedLane) ? requestedLane : (lanes[0]?.laneId || '');
    const coach = laneId ? await api(`/api/v2/wisdo/coach?lane_id=${encodeURIComponent(laneId)}&limit=8&refresh=false`).catch(() => ({ messages: [] })) : { messages: [] };
    const latest = coach.messages?.[0];
    root().innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">WISDO AI Adaptive Academy</span><h1>Learn with your actual portfolio context.</h1><p class="muted">The Academy combines structured courses, scenario labs, AI webinars, a page-aware tutor, and optional Culture Lane history. WISDO teaches from confirmed snapshots and trades; it does not invent market data or expose protected source code.</p></div><div class="academy-progress"><strong>${Number(academy.progress?.score || 0)}</strong><span>academy points</span></div></div>
      <section class="card portfolio-hero"><div class="card-head"><div><span class="eyebrow">AI learning guide</span><h2>${html(latest?.headline || (laneId ? 'Ask WISDO to turn lane behavior into a lesson' : 'Connect a Culture Lane for portfolio-aware teaching'))}</h2></div>${lanes.length ? `<select class="input" id="academy-lane">${lanes.map((lane) => `<option value="${html(lane.laneId)}" ${lane.laneId === laneId ? 'selected' : ''}>${html(lane.name || lane.laneId)}</option>`).join('')}</select>` : '<a class="btn primary" href="/app/copier-engine">Create Culture Lane</a>'}</div><p>${html(latest?.education || latest?.summary || 'WISDO can explain a lesson from the current account state, recent wins and losses, execution health, symbol contribution, drawdown, and Harvest behavior.')}</p>${laneId ? `<form id="academy-lane-coach" class="tutor-compose"><textarea class="input" name="question" rows="3" required placeholder="Example: Turn my recent losing trades into a lesson on risk, entries, exits, and what to practice next."></textarea><button class="btn gold" type="submit">Build lesson from my lane</button></form><div class="actions"><button class="btn ghost academy-coach-prompt" data-prompt="Create a beginner-friendly lesson from the strongest and weakest symbols in this lane history.">Symbol lesson</button><button class="btn ghost academy-coach-prompt" data-prompt="Teach me what the lane drawdown and recovery history says about risk management.">Risk lesson</button><button class="btn ghost academy-coach-prompt" data-prompt="Explain the leader-to-receiver execution history as a copier reliability lesson.">Execution lesson</button></div><div id="academy-coach-answer" class="setup-note"><strong>WISDO answer</strong><p>${html(latest?.chatMessage || 'Choose a prompt or ask a question. The answer becomes part of your persistent WISDO learning memory.')}</p></div>` : ''}</section>
      <div id="df-academy" class="academy-shell"></div>`;
    if (document.querySelector('#academy-lane')) document.querySelector('#academy-lane').onchange = (event) => { const url = new URL(location.href); url.searchParams.set('lane', event.target.value); history.replaceState(null, '', `${url.pathname}${url.search}`); drawEducation(); };
    const askAcademy = async (question) => { if (!laneId || !question) return; const answer = document.querySelector('#academy-coach-answer'); answer.innerHTML = '<strong>WISDO is building the lesson…</strong><p>Reading confirmed lane history and shared Academy memory.</p>'; try { const result = await api('/api/v2/wisdo/coach/chat', { method: 'POST', body: JSON.stringify({ laneId, mode: 'academy', question }) }, 45000); answer.innerHTML = `<strong>${html(result.message?.headline || 'WISDO lesson')}</strong><p>${html(result.message?.education || result.message?.summary || '')}</p><p>${html(result.message?.chatMessage || '')}</p>`; } catch (error) { answer.innerHTML = `<strong>Lesson could not be generated</strong><p>${html(error.message)}</p>`; } };
    const form = document.querySelector('#academy-lane-coach'); if (form) form.onsubmit = async (event) => { event.preventDefault(); const question = form.elements.question.value.trim(); form.elements.question.value = ''; await askAcademy(question); };
    document.querySelectorAll('.academy-coach-prompt').forEach((button) => button.onclick = () => askAcademy(button.dataset.prompt));
    window.DFSauceAcademy?.mount(document.querySelector('#df-academy'), {
      bot: new URLSearchParams(location.search).get('bot') || '',
      bootstrap: academy,
      selectedAccountId: selectedAccountId(),
      selectedLaneId: laneId,
      wisdoCoachEnabled: true,
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
    else if (currentPage === 'accounts') await drawAccounts();
    else if (currentPage === 'copier-engine') await drawRules();
    else if (currentPage === 'culture-lanes') location.replace('/app/dashboard');
    else if (currentPage === 'symbol-routing') location.replace('/app/copier-engine');
    else if (currentPage === 'harvest') location.replace('/app/dashboard');
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
      try {
        await refreshAccounts(true, true);
      } catch (accountError) {
        try { accounts = JSON.parse(sessionStorage.getItem('wisdo.accountSnapshot') || '[]'); } catch { accounts = []; }
        const status = document.querySelector('#workspace-account-status');
        if (status) status.textContent = accounts.length ? `${accounts.length} cached account(s) · live refresh recovering` : 'Account service recovering';
        toast(`Account refresh is recovering: ${accountError.message}`, 'warn', 6000);
      }
      if (bootingDashboard) setDashboardBootStage(`${accounts.length} account${accounts.length === 1 ? '' : 's'} hydrated · checking command authority…`, 62, 'Accounts 04');
      const me = await mePromise;
      if (me?.profile) applyTheme(me.profile);
      if (bootingDashboard) setDashboardBootStage('Loading health gauges, copier state, and live metrics…', 82, 'Dashboard 05');
      await renderCurrentPage();
      if (bootingDashboard) await finishDashboardBoot(true);
      accountPoll = setInterval(async () => {
        if (document.querySelector('dialog[open]') || document.visibilityState !== 'visible') return;
        const previous = JSON.stringify(accounts.map((a) => [a.id, a.status, a.equity, a.last_sync_at]));
        try { await refreshAccounts(true, true); const next = JSON.stringify(accounts.map((a) => [a.id, a.status, a.equity, a.last_sync_at])); if (next !== previous && ['command-center', 'dashboard', 'analyzer', 'trades', 'compound-tracker'].includes(currentPage)) await renderCurrentPage(); } catch {}
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
