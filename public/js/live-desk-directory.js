(() => {
  const root = document.getElementById('liveDeskDirectory');
  if (!root) return;
  function card(session) {
    const node = document.createElement('article');
    node.className = 'live-directory-card';
    const badge = document.createElement('span');
    badge.className = 'eyebrow';
    badge.textContent = session.visibility === 'members' ? 'Members Live' : 'Public Live';
    const title = document.createElement('h3');
    title.textContent = session.title || 'Live Trading Desk';
    const owner = document.createElement('p');
    owner.className = 'muted';
    owner.textContent = `${session.ownerDisplayName || 'Culture Coin Trader'} • ${session.viewerCount || 0} watching`;
    const meta = document.createElement('div');
    meta.className = 'live-quality';
    if (session.telemetry?.symbols?.length) {
      const symbol = document.createElement('span');
      symbol.textContent = session.telemetry.symbols.slice(0, 3).join(', ');
      meta.append(symbol);
    }
    const view = document.createElement('a');
    view.className = 'btn primary';
    view.href = `/live/${encodeURIComponent(session.id)}`;
    view.textContent = 'Watch Live';
    view.style.marginTop = '14px';
    node.append(badge, title, owner, meta, view);
    return node;
  }
  async function load() {
    try {
      const response = await fetch('/api/live-desk/discover', { credentials: 'same-origin' });
      const body = await response.json();
      const sessions = body.sessions || [];
      if (!sessions.length) {
        root.innerHTML = '<div class="live-directory-card"><span class="eyebrow">No Public Desks</span><h3>No broadcasts are public right now.</h3><p class="muted">Private, unlisted, and coded rooms never appear here.</p><a class="btn primary" href="/app/live-desk">Start My Live Desk</a></div>';
        return;
      }
      root.replaceChildren(...sessions.map(card));
    } catch (error) {
      root.innerHTML = `<div class="live-directory-card"><h3>Directory unavailable</h3><p class="muted">${String(error.message || 'Try again shortly').replace(/[<>]/g, '')}</p></div>`;
    }
  }
  load();
  setInterval(load, 10000);
})();
