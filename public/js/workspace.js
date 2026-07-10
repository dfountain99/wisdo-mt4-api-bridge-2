(() => {
  'use strict';

  const PLATFORMS = ['mt4', 'mt5', 'ctrader', 'matchtrader', 'tradelocker', 'dxtrade', 'ninjatrader', 'tradovate', 'projectx', 'rithmic'];
  const RISK_TYPES = ['fixed_lot', 'multiplier', 'equity_ratio', 'balance_ratio'];
  let accounts = [];

  const html = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
  const root = () => document.querySelector('#app-root');
  const selectedAccountId = () => document.querySelector('#mobile-account')?.value || '';

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }

  function toast(message, tone = 'ok') {
    const node = document.createElement('div');
    node.className = `toast ${tone}`;
    node.textContent = message;
    document.body.append(node);
    setTimeout(() => node.remove(), 2800);
  }

  async function refreshAccounts(preserveSelection = true) {
    const previous = preserveSelection ? selectedAccountId() : '';
    const result = await api('/api/v2/accounts');
    accounts = result.accounts || [];
    const selector = document.querySelector('#mobile-account');
    if (selector) {
      selector.innerHTML = '<option value="">All accounts / select control target</option>' + accounts.map((account) =>
        `<option value="${html(account.id)}">${html(account.nickname || account.broker || account.platform)} · ${html(account.account_number)}</option>`
      ).join('');
      if (accounts.some((account) => account.id === previous)) selector.value = previous;
      selector.onchange = () => sessionStorage.setItem('wisdo.selectedAccountId', selector.value);
      const remembered = sessionStorage.getItem('wisdo.selectedAccountId');
      if (!selector.value && accounts.some((account) => account.id === remembered)) selector.value = remembered;
    }
    return accounts;
  }

  function accountOptions(role) {
    return accounts
      .filter((account) => !role || account.role === role || role === 'any')
      .map((account) => `<option value="${html(account.id)}">${html(account.nickname || account.broker || account.platform)} · ${html(account.account_number)}</option>`)
      .join('');
  }

  async function drawDashboard() {
    const stats = await api('/api/v2/analyzer/portfolio?period=month');
    root().innerHTML = `
      <span class="eyebrow">Trading workspace</span><h1>Command Center</h1>
      <div class="grid4">
        <div class="card"><small class="muted">Connected accounts</small><div class="metric">${accounts.length}</div></div>
        <div class="card"><small class="muted">Portfolio ROI</small><div class="metric green">${Number(stats.roi || 0).toFixed(2)}%</div></div>
        <div class="card"><small class="muted">Win rate</small><div class="metric">${Number(stats.winRate || 0).toFixed(1)}%</div></div>
        <div class="card"><small class="muted">Max drawdown</small><div class="metric red">${Number(stats.maxDrawdown || 0).toFixed(2)}%</div></div>
      </div>
      <div class="grid2" style="margin-top:18px">
        <section class="card"><h3>Connected desk</h3>${accounts.length ? accounts.map((account) => `
          <div class="account-line"><div><strong>${html(account.nickname || account.broker || account.platform)} ${html(account.account_number)}</strong><br><small class="muted">${html(account.platform)} · ${html(account.status)} · ${html(account.role)}</small></div><strong>${money(account.equity)}</strong></div>`).join('') : '<p class="muted">No accounts yet. Add the first master or follower account.</p>'}
          <a class="btn primary" href="/app/accounts">Manage accounts</a>
        </section>
        <section class="card"><h3>Relay readiness</h3><ul class="feature-list"><li>Account-specific command targets</li><li>Signed sessions and broker webhooks</li><li>Symbol normalization before queueing</li><li>Closing authority bypasses entry filters</li><li>Live execution automatch remains feature-gated</li></ul><a class="btn primary" href="/app/copier-engine">Build Culture Lane</a></section>
      </div>`;
  }

  function drawAccounts() {
    root().innerHTML = `
      <span class="eyebrow">Connections</span><h1>Trading Accounts</h1>
      <div class="actions"><button class="btn primary" id="add-account">Add account</button></div>
      <div class="grid3" style="margin-top:18px">${accounts.length ? accounts.map((account) => `
        <article class="card">
          <span class="live">${html(account.status)}</span>
          <h3>${html(account.nickname || account.broker || account.platform)} · ${html(account.account_number)}</h3>
          <p>${html(String(account.platform).toUpperCase())} · ${html(account.role)} · ${html(account.server || 'server pending')}</p>
          <div class="metric">${money(account.equity)}</div>
          <small class="muted">Balance ${money(account.balance)} · ${html(account.currency || 'USD')}</small>
          <div class="actions">
            <button class="btn ghost" data-test="${html(account.id)}">Test</button>
            <button class="btn ghost" data-sync="${html(account.id)}">Sync</button>
            <button class="btn ghost" data-disconnect="${html(account.id)}">Disconnect</button>
            <button class="btn danger" data-delete-account="${html(account.id)}">Delete</button>
          </div>
        </article>`).join('') : '<div class="card"><h3>No accounts connected</h3><p>Add a master or follower account to begin building Culture Lanes.</p></div>'}</div>
      <dialog id="account-dialog"><form class="card dialog-form" id="account-form">
        <h3>Add trading account</h3>
        <label>Platform<select class="input" name="platform">${PLATFORMS.map((platform) => `<option value="${platform}">${platform}</option>`).join('')}</select></label>
        <label>Broker<input class="input" name="broker" required></label>
        <label>Nickname<input class="input" name="nickname" placeholder="Gold master"></label>
        <label>Account number<input class="input" name="account_number" required></label>
        <label>Server<input class="input" name="server"></label>
        <label>Role<select class="input" name="role"><option value="master">Master / Culture Lead</option><option value="slave">Follower / Mirror Receiver</option></select></label>
        <label>Broker login<input class="input" name="login" autocomplete="off"></label>
        <label>Broker password<input class="input" type="password" name="password" autocomplete="new-password"></label>
        <p class="muted">Credentials are stored only when ENCRYPTION_KEY is configured and are encrypted with AES-256-GCM.</p>
        <div class="actions"><button class="btn primary" type="submit">Save account</button><button class="btn ghost" type="button" id="cancel-account">Cancel</button></div>
      </form></dialog>`;

    const dialog = document.querySelector('#account-dialog');
    document.querySelector('#add-account').onclick = () => dialog.showModal();
    document.querySelector('#cancel-account').onclick = () => dialog.close();
    document.querySelector('#account-form').onsubmit = async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(event.target));
      const login = payload.login; const password = payload.password;
      delete payload.login; delete payload.password;
      if (login || password) payload.credentials = { login, password };
      await api('/api/v2/accounts', { method: 'POST', body: JSON.stringify(payload) });
      toast('Trading account saved');
      await refreshAccounts(false); drawAccounts();
    };
    document.querySelectorAll('[data-test]').forEach((button) => button.onclick = async () => {
      const result = await api(`/api/v2/accounts/${encodeURIComponent(button.dataset.test)}/test`, { method: 'POST' });
      toast(result.message, result.connected ? 'ok' : 'warn');
    });
    document.querySelectorAll('[data-sync]').forEach((button) => button.onclick = async () => {
      await api(`/api/v2/accounts/${encodeURIComponent(button.dataset.sync)}/sync`, { method: 'POST' }); toast('Sync request queued');
    });
    document.querySelectorAll('[data-disconnect]').forEach((button) => button.onclick = async () => {
      await api(`/api/v2/accounts/${encodeURIComponent(button.dataset.disconnect)}/disconnect`, { method: 'POST' }); await refreshAccounts(); drawAccounts();
    });
    document.querySelectorAll('[data-delete-account]').forEach((button) => button.onclick = async () => {
      if (!confirm('Delete this account and every Culture Lane attached to it?')) return;
      await api(`/api/v2/accounts/${encodeURIComponent(button.dataset.deleteAccount)}`, { method: 'DELETE' });
      toast('Account deleted'); await refreshAccounts(false); drawAccounts();
    });
  }

  async function drawRules() {
    const [result, leadResult] = await Promise.all([api('/api/v2/copier-rules'), api('/api/v2/community/leads')]);
    const rules = result.rules || [];
    const leaders = leadResult.leads || accounts.filter((account) => account.role === 'master');
    const byId = Object.fromEntries([...accounts, ...leaders].map((account) => [account.id, account]));
    root().innerHTML = `
      <span class="eyebrow">Culture Relay Engine</span><h1>Copier Rules</h1>
      <section class="card"><form id="rule-form" class="grid2">
        <label>Culture Lead<select class="input" name="master_id" required><option value="">Select master</option>${leaders.map((account) => `<option value="${html(account.id)}">${html(account.community_name || account.nickname || account.broker || account.platform)} · ${html(account.account_number)} · ${html(account.access || 'owned')}</option>`).join('')}</select></label>
        <label>Mirror Receiver<select class="input" name="slave_id" required><option value="">Select follower</option>${accounts.map((account) => `<option value="${html(account.id)}">${html(account.nickname || account.broker || account.platform)} · ${html(account.account_number)}</option>`).join('')}</select></label>
        <label>Risk type<select class="input" name="risk_type">${RISK_TYPES.map((type) => `<option value="${type}">${type.replaceAll('_', ' ')}</option>`).join('')}</select></label>
        <label>Risk value<input class="input" name="risk_value" type="number" min="0.01" max="100" step="0.01" value="1"></label>
        <label>Minimum lot<input class="input" name="min_lot" type="number" min="0.01" max="100" step="0.01" value="0.01"></label>
        <label>Maximum lot<input class="input" name="max_lot" type="number" min="0.01" max="100" step="0.01" value="100"></label>
        <label>Equity protection %<input class="input" name="equity_protection_pct" type="number" min="0" max="100" step="0.1" placeholder="10"></label>
        <label>Max daily loss<input class="input" name="max_daily_loss" type="number" min="0" step="0.01"></label>
        <label>Max open trades<input class="input" name="max_open_trades" type="number" min="1" max="500" step="1"></label>
        <label>Max spread points<input class="input" name="max_spread_points" type="number" min="0" step="1"></label>
        <label>Max slippage points<input class="input" name="max_slippage_points" type="number" min="0" step="1"></label>
        <label>Trading start<input class="input" name="trading_hours_start" type="time"></label>
        <label>Trading end<input class="input" name="trading_hours_end" type="time"></label>
        <label class="full">Allowed symbols<input class="input" name="allowed_symbols" placeholder="XAUUSD, GBPJPY, NAS100"></label>
        <label class="full">Symbol mapping<textarea class="input" name="symbol_mapping" placeholder='{"GOLD":"XAUUSD","USTEC":"NAS100"}'></textarea></label>
        <label><input type="checkbox" name="auto_match_symbols" checked> Auto-match preview</label>
        <label><input type="checkbox" name="copy_sl_tp" checked> Copy SL/TP</label>
        <label><input type="checkbox" name="copy_pending_orders" checked> Copy pending orders</label>
        <label><input type="checkbox" name="reverse_signals"> Reverse signals</label>
        <button class="btn primary full" type="submit">Save Culture Lane</button>
      </form></section>
      <section class="grid2" style="margin-top:18px">${rules.length ? rules.map((rule) => {
        const master = byId[rule.master_id]; const follower = byId[rule.slave_id];
        return `<article class="card"><span class="live">${rule.is_active ? 'active' : 'paused'}</span><h3>${html(master?.nickname || master?.account_number || rule.master_id)} → ${html(follower?.nickname || follower?.account_number || rule.slave_id)}</h3><p>${html(rule.risk_type)} · ${html(rule.risk_value)}</p><p class="muted">${html((rule.allowed_symbols || []).join(', ') || 'All symbols')}</p><div class="actions"><button class="btn ghost" data-toggle="${html(rule.id)}">${rule.is_active ? 'Pause' : 'Resume'}</button><button class="btn danger" data-delete-rule="${html(rule.id)}">Delete</button></div></article>`;
      }).join('') : '<div class="card"><h3>No Culture Lanes yet</h3><p>Choose a lead and receiver above, then save the route.</p></div>'}</section>`;

    document.querySelector('#rule-form').onsubmit = async (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      const payload = Object.fromEntries(form);
      payload.allowed_symbols = String(payload.allowed_symbols || '').split(/[;,\s]+/).filter(Boolean);
      payload.copy_sl_tp = form.has('copy_sl_tp');
      payload.copy_pending_orders = form.has('copy_pending_orders');
      payload.reverse_signals = form.has('reverse_signals');
      payload.auto_match_symbols = form.has('auto_match_symbols');
      try { payload.symbol_mapping = JSON.parse(payload.symbol_mapping || '{}'); } catch { throw new Error('Symbol mapping must be valid JSON.'); }
      await api('/api/v2/copier-rules', { method: 'POST', body: JSON.stringify(payload) });
      toast('Culture Lane saved'); drawRules();
    };
    document.querySelectorAll('[data-toggle]').forEach((button) => button.onclick = async () => {
      await api(`/api/v2/copier-rules/${encodeURIComponent(button.dataset.toggle)}/toggle`, { method: 'POST', body: '{}' }); drawRules();
    });
    document.querySelectorAll('[data-delete-rule]').forEach((button) => button.onclick = async () => {
      if (!confirm('Delete this Culture Lane?')) return;
      await api(`/api/v2/copier-rules/${encodeURIComponent(button.dataset.deleteRule)}`, { method: 'DELETE' }); toast('Culture Lane deleted'); drawRules();
    });
  }

  async function drawTrades() {
    const accountId = selectedAccountId();
    const result = await api(`/api/v2/trades${accountId ? `?account_id=${encodeURIComponent(accountId)}` : ''}`);
    const trades = result.trades || [];
    root().innerHTML = `
      <span class="eyebrow">Execution proof</span><h1>Trade Log</h1>
      <div class="actions"><button class="btn danger" id="close-all">Close all on selected account</button><button class="btn ghost" id="refresh-trades">Refresh</button></div>
      <section class="card table-wrap"><table><thead><tr><th>Time</th><th>Account</th><th>Symbol</th><th>Side</th><th>Lots</th><th>Status</th><th>P/L</th><th>Control</th></tr></thead><tbody>${trades.map((trade) => `<tr><td>${html(trade.opened_at || '')}</td><td>${html(trade.account_id)}</td><td>${html(trade.symbol)}</td><td>${html(trade.side)}</td><td>${html(trade.lot_size)}</td><td>${html(trade.status)}</td><td class="${Number(trade.pnl || 0) >= 0 ? 'green' : 'red'}">${money(trade.pnl)}</td><td>${trade.status === 'open' ? `<button class="btn ghost" data-close="${html(trade.id)}">Close</button>` : ''}</td></tr>`).join('')}</tbody></table></section>`;
    document.querySelector('#refresh-trades').onclick = drawTrades;
    document.querySelectorAll('[data-close]').forEach((button) => button.onclick = async () => {
      if (!confirm('Queue a close for this ticket?')) return;
      await api(`/api/v2/trades/${encodeURIComponent(button.dataset.close)}/close`, { method: 'POST', body: JSON.stringify({ confirmation: 'confirmed' }) }); toast('Ticket close queued');
    });
    document.querySelector('#close-all').onclick = async () => {
      const target = selectedAccountId();
      if (!target) return toast('Select the target account first.', 'warn');
      if (!confirm('Close every open trade on the selected account?')) return;
      await api('/api/v2/trades/close-all', { method: 'POST', body: JSON.stringify({ account_id: target, confirmation: 'confirmed' }) }); toast('Account-specific Close All queued');
    };
  }

  async function drawAnalyzer() {
    const result = await api('/api/v2/analyzer/portfolio?period=month');
    const series = result.series || [];
    root().innerHTML = `
      <span class="eyebrow">Portfolio intelligence</span><h1>Analyzer</h1>
      <div class="grid4"><div class="card"><small>ROI</small><div class="metric green">${Number(result.roi || 0).toFixed(2)}%</div></div><div class="card"><small>Win rate</small><div class="metric">${Number(result.winRate || 0).toFixed(1)}%</div></div><div class="card"><small>Max drawdown</small><div class="metric red">${Number(result.maxDrawdown || 0).toFixed(2)}%</div></div><div class="card"><small>Trades</small><div class="metric">${Number(result.tradeCount || 0)}</div></div></div>
      <section class="card" style="margin-top:18px"><h3>Equity series</h3><div class="mini-chart">${series.map((point) => `<i title="${html(point.date)}" style="height:${Math.max(5, Math.min(250, Number(point.value || 0)))}px"></i>`).join('')}</div></section>
      <div class="actions"><a class="btn ghost" href="/api/v2/analyzer/export.csv">Export CSV</a><button class="btn primary" id="risk-suggestion">AI risk suggestion</button></div><div id="insight"></div>`;
    document.querySelector('#risk-suggestion').onclick = async () => {
      const accountId = selectedAccountId() || accounts[0]?.id;
      if (!accountId) return toast('Add an account first.', 'warn');
      const suggestion = await api('/api/v2/ai/risk-suggestion', { method: 'POST', body: JSON.stringify({ account_id: accountId }) });
      document.querySelector('#insight').innerHTML = `<div class="card"><h3>Suggested controls</h3><pre>${html(JSON.stringify(suggestion.suggestion, null, 2))}</pre><p>${html(suggestion.reason)}</p></div>`;
    };
  }

  async function drawAlerts() {
    const result = await api('/api/v2/alerts');
    const alerts = result.alerts || [];
    root().innerHTML = `<span class="eyebrow">Notification center</span><h1>Alerts</h1><div class="actions"><button class="btn ghost" id="read-all">Mark all read</button></div><div class="grid2">${alerts.length ? alerts.map((alert) => `<article class="card"><span class="eyebrow">${html(alert.type)}</span><h3>${html(alert.title)}</h3><p>${html(alert.body)}</p><small class="muted">${html(alert.created_at)}</small></article>`).join('') : '<div class="card"><h3>No alerts</h3><p>Trade, drawdown, equity protection, billing, and system alerts appear here.</p></div>'}</div>`;
    document.querySelector('#read-all').onclick = async () => { await api('/api/v2/alerts/read-all', { method: 'POST', body: '{}' }); toast('Alerts marked read'); drawAlerts(); };
  }

  async function drawAffiliate() {
    const result = await api('/api/v2/affiliate');
    root().innerHTML = `<span class="eyebrow">Growth engine</span><h1>Affiliate Desk</h1><div class="grid3"><div class="card"><small>Referral code</small><div class="metric">${html(result.code)}</div></div><div class="card"><small>Conversions</small><div class="metric">${Number(result.conversions || 0)}</div></div><div class="card"><small>Available</small><div class="metric green">${money(result.available)}</div></div></div><section class="card" style="margin-top:18px"><h3>Your referral link</h3><input class="input" readonly value="${html(`${location.origin}/r/${result.code}`)}"><p>Activation commissions use the configured split and remain on hold through the refund window.</p></section>`;
  }

  async function drawSettings(page) {
    const me = await api('/api/v2/me');
    const billing = page.includes('billing');
    root().innerHTML = billing ? `
      <span class="eyebrow">Subscription</span><h1>Billing</h1><section class="card"><h3>Plan control</h3><p>Choose CFD or Futures, plan tier, account count, billing cycle, Analyzer, and Dedicated Environment from the pricing configurator.</p><a class="btn primary" href="/pricing">Configure plan</a></section>` : `
      <span class="eyebrow">Profile and security</span><h1>Settings</h1><section class="card"><form id="profile-form" class="grid2"><label>Full name<input class="input" name="full_name" value="${html(me.profile?.full_name || '')}"></label><label>Country<input class="input" name="country" value="${html(me.profile?.country || '')}"></label><label>Timezone<input class="input" name="timezone" value="${html(me.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')}"></label><label>Email<input class="input" name="email" type="email" value="${html(me.profile?.email || me.user?.email || '')}"></label><button class="btn primary full">Save settings</button></form></section><section class="card danger-zone"><h3>Danger zone</h3><p>Account deletion removes the profile, connected account records, Culture Lanes, trades, and alerts owned by this user.</p><button class="btn danger" id="delete-profile">Delete WISDO account</button></section>`;
    const form = document.querySelector('#profile-form');
    if (form) form.onsubmit = async (event) => { event.preventDefault(); await api('/api/v2/profile', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); toast('Settings saved'); };
    const deleteButton = document.querySelector('#delete-profile');
    if (deleteButton) deleteButton.onclick = async () => { if (!confirm('Permanently delete your WISDO account data?')) return; await api('/api/v2/me', { method: 'DELETE' }); location.href = '/logout'; };
  }

  async function boot() {
    try {
      await refreshAccounts();
      const page = window.WISDO_PAGE || 'dashboard';
      if (page === 'dashboard') await drawDashboard();
      else if (page === 'accounts') drawAccounts();
      else if (page === 'copier-engine') await drawRules();
      else if (page === 'trades') await drawTrades();
      else if (page === 'analyzer') await drawAnalyzer();
      else if (page === 'alerts') await drawAlerts();
      else if (page === 'affiliate') await drawAffiliate();
      else if (page === 'settings' || page === 'settings/billing') await drawSettings(page);
      else if (page === 'education') location.href = '/member/education';
    } catch (error) {
      root().innerHTML = `<div class="card"><h3>Could not load workspace</h3><p class="red">${html(error.message)}</p><button class="btn ghost" onclick="location.reload()">Retry</button></div>`;
    }
  }

  window.bootWorkspace = boot;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }
  boot();
})();
