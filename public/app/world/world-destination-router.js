import { LOCAL_DESTINATIONS } from './world-config.js';

const ROUTE_ALIASES = Object.freeze({
  '/member/command-center': 'command',
  '/member/education': 'academy',
  '/member/bots': 'bot-arena',
  '/member/wisdo': 'coach-center',
  '/member/accounts': 'growth-chamber',
  '/member/simulator': 'strategy-lab',
  '/member/social': 'culture-arena',
  '/member/home': 'private-rooms',
  '/member/admin-wisdo': 'war-room',
  '/pricing': 'marketplace',
});

const NAME_ALIASES = Object.freeze(Object.fromEntries(LOCAL_DESTINATIONS.map((d) => [d.name.toLowerCase(), d.id])));
const esc = (value = '') => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const json = async (url, options = {}) => {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Request failed ${response.status}`);
  return response.json().catch(() => ({}));
};

function installStyles() {
  if (document.querySelector('style[data-world-interiors]')) return;
  const style = document.createElement('style');
  style.dataset.worldInteriors = '1';
  style.textContent = `
    .wisdo-interior{position:fixed;inset:0;z-index:8200;display:grid;grid-template-rows:auto 1fr;background:radial-gradient(circle at 50% 18%,rgba(0,126,168,.16),transparent 34%),linear-gradient(180deg,rgba(2,6,10,.72),rgba(2,5,9,.94));backdrop-filter:blur(12px);color:#eef8ff;font-family:Inter,system-ui,sans-serif}
    .wisdo-interior[hidden]{display:none}.wisdo-interior-head{display:flex;gap:18px;align-items:center;justify-content:space-between;padding:18px max(18px,4vw);border-bottom:1px solid rgba(201,166,93,.32);background:rgba(4,9,15,.84)}
    .wisdo-interior-brand span,.wisdo-interior-kicker{display:block;color:#c9a65d;font-size:11px;letter-spacing:.22em}.wisdo-interior-brand strong{font-size:20px;letter-spacing:.08em}.wisdo-interior-close,.wisdo-interior-action{border:1px solid rgba(201,166,93,.48);border-radius:999px;background:rgba(7,15,23,.88);color:#fff;padding:10px 16px;font:700 11px/1 system-ui;letter-spacing:.09em;text-decoration:none}
    .wisdo-interior-body{overflow:auto;padding:clamp(18px,4vw,48px);display:grid;align-content:start;gap:18px}.wisdo-interior-hero{max-width:1050px}.wisdo-interior-hero h1{font-size:clamp(30px,6vw,74px);margin:.15em 0;letter-spacing:-.04em}.wisdo-interior-hero p{max-width:760px;color:#9fb4c4;line-height:1.65}
    .wisdo-interior-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;max-width:1200px}.wisdo-interior-card{min-height:120px;border:1px solid rgba(117,230,255,.18);background:linear-gradient(145deg,rgba(10,21,31,.94),rgba(3,8,13,.9));border-radius:18px;padding:18px;box-shadow:0 20px 70px rgba(0,0,0,.28)}.wisdo-interior-card.gold{border-color:rgba(201,166,93,.28)}.wisdo-interior-card span{display:block;color:#7194aa;font-size:10px;letter-spacing:.16em}.wisdo-interior-card strong{display:block;margin-top:9px;font-size:22px}.wisdo-interior-card small{display:block;margin-top:8px;color:#8ca4b4;line-height:1.45}.wisdo-interior-actions{display:flex;flex-wrap:wrap;gap:10px}.wisdo-interior-action.primary{background:#c9a65d;color:#05080d}.wisdo-interior-standby{padding:18px;border-left:2px solid #6ee7ff;color:#aec4d2;background:rgba(13,28,39,.5);max-width:900px}
    @media(max-width:700px){.wisdo-interior-head{padding:14px}.wisdo-interior-body{padding:18px}.wisdo-interior-brand strong{font-size:15px}.wisdo-interior-hero h1{font-size:38px}}
  `;
  document.head.appendChild(style);
}

function destinationById(id) { return LOCAL_DESTINATIONS.find((d) => d.id === id) || null; }
function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  for (const key of ['items','signals','markets','data','rows']) if (Array.isArray(value?.[key])) return value[key];
  return [];
}

function genericCards(destination) {
  const map = {
    academy: [['LEARN','Academy Campus','Courses, simulations, readiness and WISDO systems training.'],['PRACTICE','Scenario Lab','Practice and review without creating live trading actions.'],['PROGRESS','Education Record','Completed learning can feed World progression.']],
    vault: [['OWN','Bot & License Vault','Your owned WISDO systems and entitlement state.'],['HISTORY','Milestones','Persistent records and achievements.'],['PRIVATE','Protected Data','Sensitive account data stays outside public World visibility.']],
    'bot-arena': [['EXPLORE','Bot Families','Inspect systems, strategy descriptions and eligibility.'],['COMPARE','Strategy Context','Compare verified metadata without inventing performance.'],['BUILD','Operator Loadout','Prepare systems before activating them through authorized controls.']],
    'switch-lab': [['TUNE','Capability Lab','Adjust connected WISDO behavior through supported controls.'],['SIMULATE','Preview First','Review changes before applying live settings.'],['VERIFY','Server Authority','World visuals never become trading authority.']],
    'growth-chamber': [['GROW','Account Growth','Health, milestones and long-term history.'],['REVIEW','Performance','Inspect real analytics from authorized services.'],['LEVEL','World Progress','Education and exploration progression live separately from trading profit.']],
    'strategy-lab': [['ANALYZE','Strategy Lab','Research campaign behavior and system structure.'],['REPLAY','Campaign Replay','Historical mode stays read-only.'],['SIMULATE','What-if Space','Hypothetical controls remain clearly separated from LIVE.']],
    'coach-center': [['COACH','WISDO Intelligence','Ask about your authorized World context.'],['NAVIGATE','World Guidance','Coach can point you toward places and systems.'],['PROPOSE','Command Safety','Coach proposes live actions; confirmation remains mandatory.']],
    'culture-arena': [['BELONG','Community Arena','Shared events, challenges and social identity.'],['PRESENCE','Real Members','Real presence remains distinct from ambient NPCs.'],['EVENTS','Culture Events','World events can animate the city without fabricating market data.']],
    marketplace: [['DISCOVER','WISDO Market','Browse products and access inside the World.'],['CREATORS','Future Storefronts','Creator spaces can become physical destinations.'],['CHECKOUT','Secure Purchase','Checkout intentionally opens secure Fast Mode only when you choose it.']],
    'vps-forge': [['RUN','Runtime Forge','Execution infrastructure, Reporter health and always-on systems.'],['HEALTH','Diagnostics','Connection state is real service state.'],['COMMAND','Protected Controls','Execution remains behind WISDO authorization.']],
    'private-rooms': [['IDENTITY','Private Headquarters','Commander identity, trophies and private World space.'],['PROPERTY','Persistent Space','Property configuration can persist without duplicating financial data.'],['INVITE','Future Visits','Visitors never inherit financial-data permission.']],
    'war-room': [['OPERATE','War Room','High-authority operational tooling.'],['AUDIT','System State','Diagnostics and activity stay traceable.'],['SECURE','Permission First','Server permissions determine available operations.']],
  };
  return map[destination?.id] || [['WORLD','WISDO Interior','This destination stays inside the 3D World shell.']];
}

export function createWorldDestinationRouter({ onOpen, onClose } = {}) {
  installStyles();
  let overlay = null;
  let current = null;
  let command = null;
  let stopped = false;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('section');
    overlay.className = 'wisdo-interior';
    overlay.hidden = true;
    overlay.innerHTML = `<header class="wisdo-interior-head"><div class="wisdo-interior-brand"><span>WISDO WORLD · IMMERSIVE DESTINATION</span><strong id="wiTitle">INTERIOR</strong></div><button class="wisdo-interior-close" id="wiClose">RETURN TO WORLD</button></header><main class="wisdo-interior-body" id="wiBody"></main>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#wiClose').addEventListener('click', close);
    return overlay;
  }

  function setUrl(id) {
    const url = new URL(location.href);
    if (id) url.searchParams.set('inside', id); else url.searchParams.delete('inside');
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }

  async function recordVisit(id) {
    try { await json('/api/world/visit', { method:'POST', body:JSON.stringify({ destinationId:id }) }); } catch {}
  }

  function emit(type, detail) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
    window.dispatchEvent(new CustomEvent('wisdo:world-game-event', { detail:{ type, ...detail } }));
  }

  async function renderTradingTower() {
    const body = overlay.querySelector('#wiBody');
    body.innerHTML = `<div class="wisdo-interior-hero"><span class="wisdo-interior-kicker">TRADING TOWER · SIGNAL OBSERVATORY</span><h1>Markets above the city.</h1><p>The Observatory reads authoritative WISDO market and signal services. It does not manufacture candles, positions, or signals.</p></div><div class="wisdo-interior-standby">Synchronizing live World market state…</div>`;
    const [signalsResult, marketsResult] = await Promise.allSettled([json('/api/world/signals/active'), json('/api/world/markets/active')]);
    const signals = signalsResult.status === 'fulfilled' ? normalizeArray(signalsResult.value) : [];
    const markets = marketsResult.status === 'fulfilled' ? normalizeArray(marketsResult.value) : [];
    const marketsHtml = markets.slice(0,8).map((m) => `<article class="wisdo-interior-card"><span>LIVE MARKET</span><strong>${esc(m.symbol || m.id || 'MARKET')}</strong><small>${Number(m.participantCount ?? m.activePositionCount ?? m.participants?.length ?? 0)} authorized participant${Number(m.participantCount ?? m.activePositionCount ?? m.participants?.length ?? 0)===1?'':'s'} · ${esc(m.status || 'ACTIVE')}</small></article>`).join('');
    const signalHtml = signals.slice(0,6).map((s) => `<article class="wisdo-interior-card gold"><span>ACTIVE SIGNAL</span><strong>${esc(s.symbol || 'SIGNAL')} ${esc(s.direction || '')}</strong><small>${esc(s.botName || s.strategyName || 'WISDO BOT')} · server event ${esc(s.status || 'ACTIVE')}</small></article>`).join('');
    body.innerHTML = `<div class="wisdo-interior-hero"><span class="wisdo-interior-kicker">TRADING TOWER · SIGNAL OBSERVATORY</span><h1>Market intelligence, in-world.</h1><p>One authoritative event can drive the sky signal, billboard, Coach and Observatory while the World remains the presentation layer.</p></div><div class="wisdo-interior-grid">${marketsHtml || '<article class="wisdo-interior-card"><span>MARKETS</span><strong>Standby</strong><small>No authorized active World markets are visible right now.</small></article>'}${signalHtml || '<article class="wisdo-interior-card gold"><span>SIGNALS</span><strong>Standby</strong><small>No qualifying active signal event is visible right now.</small></article>'}</div><div class="wisdo-interior-actions"><button class="wisdo-interior-action primary" id="wiCommand">OPEN CAMPAIGN COMMAND</button><button class="wisdo-interior-action" id="wiRefresh">REFRESH OBSERVATORY</button></div>`;
    body.querySelector('#wiRefresh')?.addEventListener('click', renderTradingTower);
    body.querySelector('#wiCommand')?.addEventListener('click', async () => {
      if (!command) { const mod = await import('./command/command-center-runtime.js'); command = mod.startCampaignCommandCenter(); }
      command.open();
    });
  }

  async function renderGeneric(destination) {
    const body = overlay.querySelector('#wiBody');
    const cards = genericCards(destination).map(([k,t,d]) => `<article class="wisdo-interior-card"><span>${esc(k)}</span><strong>${esc(t)}</strong><small>${esc(d)}</small></article>`).join('');
    const secure = destination.id === 'marketplace' ? `<div class="wisdo-interior-actions"><a class="wisdo-interior-action primary" href="/pricing" data-world-external="billing">OPEN SECURE CHECKOUT</a></div>` : '';
    body.innerHTML = `<div class="wisdo-interior-hero"><span class="wisdo-interior-kicker">${esc(destination.short || 'WISDO')} · IN-WORLD INTERIOR</span><h1>${esc(destination.name)}</h1><p>${esc(destination.description || 'A persistent WISDO World destination.')}</p></div><div class="wisdo-interior-grid">${cards}</div>${secure}`;
  }

  async function open(target, meta = {}) {
    if (stopped) return false;
    const id = typeof target === 'string' ? target : target?.id;
    if (id === 'command') {
      if (!command) { const mod = await import('./command/command-center-runtime.js'); command = mod.startCampaignCommandCenter(); }
      command.open(); emit('wisdo:world-destination-entered',{ id:'command', source:meta.source||'route' }); return true;
    }
    const destination = destinationById(id);
    if (!destination) return false;
    ensureOverlay(); current = destination;
    overlay.querySelector('#wiTitle').textContent = destination.name.toUpperCase();
    overlay.hidden = false; setUrl(destination.id); recordVisit(destination.id);
    if (destination.id === 'trading-tower') await renderTradingTower(); else await renderGeneric(destination);
    emit('wisdo:world-destination-entered',{ id:destination.id, name:destination.name, source:meta.source||'world' });
    onOpen?.(destination); return true;
  }

  function close() {
    if (!current || !overlay) return;
    const closed = current; current = null; overlay.hidden = true; setUrl(null);
    emit('wisdo:world-destination-exited',{ id:closed.id, name:closed.name }); onClose?.(closed);
  }

  function resolveFromProximity() {
    const prompt = document.getElementById('proximity');
    const kicker = document.getElementById('nearKicker')?.textContent || '';
    const name = document.getElementById('nearName')?.textContent?.trim().toLowerCase() || '';
    if (!prompt || prompt.hidden || kicker.startsWith('SMART HOME') || kicker.includes('ACCESS REQUIRED')) return null;
    return NAME_ALIASES[name] || null;
  }

  function captureKey(event) {
    if (event.key?.toLowerCase() !== 'e' || event.repeat || overlay?.hidden === false) return;
    const id = resolveFromProximity(); if (!id) return;
    event.preventDefault(); event.stopImmediatePropagation(); open(id,{source:'keyboard'});
  }

  function captureClick(event) {
    const interact = event.target?.closest?.('#interactBtn');
    if (interact) {
      const id = resolveFromProximity();
      if (id) { event.preventDefault(); event.stopImmediatePropagation(); open(id,{source:'touch'}); return; }
    }
    const anchor = event.target?.closest?.('a[href]'); if (!anchor || anchor.dataset.worldExternal) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname.startsWith('/login') || url.pathname.startsWith('/logout')) return;
    const label = String(anchor.textContent || '').trim().toLowerCase();
    if (label.includes('fast mode') || label === 'fast') return;
    const id = ROUTE_ALIASES[url.pathname]; if (!id) return;
    event.preventDefault(); event.stopImmediatePropagation(); open(id,{source:'link'});
  }

  window.addEventListener('keydown', captureKey, true);
  document.addEventListener('click', captureClick, true);
  const requested = new URL(location.href).searchParams.get('inside');
  if (requested) queueMicrotask(() => open(requested,{source:'url'}));

  return Object.freeze({ open, close, get current(){return current?.id || null;}, stop(){stopped=true;window.removeEventListener('keydown',captureKey,true);document.removeEventListener('click',captureClick,true);command?.stop?.();overlay?.remove();} });
}
