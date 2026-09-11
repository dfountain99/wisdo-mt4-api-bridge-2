const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || payload.message || `Request failed: ${response.status}`);
    error.status = response.status;
    error.code = payload.code || null;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export function createWorldCommandRuntime({ onState = null, onStatus = null, onReceipt = null, intervalMs = 2200 } = {}) {
  let stopped = false;
  let timer = null;
  let currentState = null;
  let accountId = '';
  let selectedCampaignId = null;
  let refreshing = null;

  async function refresh({ forceAccountId = null } = {}) {
    if (stopped) return currentState;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        if (forceAccountId !== null) accountId = forceAccountId || '';
        const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
        const payload = await request(`/api/world/command/state${query}`);
        currentState = payload;
        if (!accountId && payload.account?.accountId) accountId = payload.account.accountId;
        if (!selectedCampaignId || !payload.campaigns?.some((item) => item.campaignId === selectedCampaignId)) selectedCampaignId = payload.selectedCampaignId || payload.campaigns?.[0]?.campaignId || null;
        onState?.(payload, { selectedCampaignId });
        onStatus?.({ state: payload.executionHealth?.commandLinkReady ? 'live' : 'degraded', at: Date.now() });
        return payload;
      } catch (error) {
        onStatus?.({ state: 'degraded', error, at: Date.now() });
        throw error;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  function schedule() {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try { await refresh(); } catch {}
      schedule();
    }, Math.max(1200, Number(intervalMs) || 2200));
  }

  async function start() {
    stopped = false;
    await refresh().catch(() => null);
    schedule();
    return api;
  }

  function stop() { stopped = true; clearTimeout(timer); timer = null; }

  async function selectAccount(nextAccountId) {
    accountId = String(nextAccountId || '');
    selectedCampaignId = null;
    return refresh({ forceAccountId: accountId });
  }

  function selectCampaign(campaignId) {
    selectedCampaignId = String(campaignId || '') || null;
    onState?.(currentState, { selectedCampaignId });
    return selectedCampaignId;
  }

  async function propose(action, options = {}) {
    const body = {
      action,
      accountId: options.accountId || accountId || currentState?.account?.accountId || '',
      campaignId: options.campaignId || selectedCampaignId || undefined,
      positionId: options.positionId || undefined,
      symbol: options.symbol || undefined,
      clientCommandId: options.clientCommandId || undefined,
    };
    const payload = await request('/api/world/command/propose', { method: 'POST', body: JSON.stringify(body) });
    return payload.proposal;
  }

  async function execute(proposal, heldForMs) {
    if (!proposal?.proposalId || !proposal?.confirmationToken) throw new Error('Command proposal is incomplete.');
    const payload = await request('/api/world/command/execute', {
      method: 'POST',
      body: JSON.stringify({ proposalId: proposal.proposalId, confirmationToken: proposal.confirmationToken, heldForMs }),
    });
    onReceipt?.(payload.receipt);
    watchReceipt(payload.receipt?.commandId).catch(() => undefined);
    return payload.receipt;
  }

  async function watchReceipt(commandId, { timeoutMs = 45_000 } = {}) {
    if (!commandId) return null;
    const started = Date.now();
    while (!stopped && Date.now() - started < timeoutMs) {
      const payload = await request(`/api/world/command/receipts/${encodeURIComponent(commandId)}`);
      const receipt = payload.receipt;
      onReceipt?.(receipt);
      if (['completed', 'failed', 'expired', 'cancelled'].includes(String(receipt?.status || '').toLowerCase())) {
        await refresh().catch(() => null);
        return receipt;
      }
      await sleep(900);
    }
    return null;
  }

  async function receipts(limit = 40) {
    const query = new URLSearchParams();
    if (accountId) query.set('accountId', accountId);
    query.set('limit', String(limit));
    const payload = await request(`/api/world/command/receipts?${query}`);
    return payload.receipts || [];
  }

  const api = {
    start,
    stop,
    refresh,
    selectAccount,
    selectCampaign,
    propose,
    execute,
    watchReceipt,
    receipts,
    get state() { return currentState; },
    get accountId() { return accountId; },
    get selectedCampaignId() { return selectedCampaignId; },
  };
  return api;
}
