(() => {
  'use strict';

  window.WISDO_RECOGNITION_V2 = true;
  const state = { accounts: [], selectedAccountId: '', identity: null, recognition: null, showing: false, lastMilestoneKey: '', currentMilestone: null };
  const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const userName = () => state.identity?.displayName || window.WISDO_USER?.username || 'Culture Member';
  const cultureId = () => state.identity?.cultureId ? `@${state.identity.cultureId}` : 'WISDO Member';

  function selectedAccount() {
    return state.accounts.find((account) => String(account.id) === String(state.selectedAccountId)) || null;
  }

  function portfolio() {
    const active = selectedAccount();
    if (active) return {
      accountId: active.id,
      label: active.nickname || active.broker || active.account_number || 'Selected account',
      accountNumber: active.account_number || '',
      balance: number(active.balance), equity: number(active.equity), floating: number(active.floating_pl), openTrades: number(active.open_trades),
      mode: 'account',
    };
    return {
      accountId: '', label: 'Culture Portfolio', accountNumber: '',
      balance: state.accounts.reduce((sum, account) => sum + number(account.balance), 0),
      equity: state.accounts.reduce((sum, account) => sum + number(account.equity), 0),
      floating: state.accounts.reduce((sum, account) => sum + number(account.floating_pl), 0),
      openTrades: state.accounts.reduce((sum, account) => sum + number(account.open_trades), 0),
      mode: 'portfolio',
    };
  }

  function inject() {
    if (document.querySelector('#wisdo-recognition-stage')) return;
    const style = document.createElement('style');
    style.textContent = `
      #wisdo-recognition-stage{position:fixed;inset:0;z-index:260;display:none;place-items:center;padding:22px;background:radial-gradient(circle at 50% 36%,rgba(104,247,196,.16),transparent 27%),rgba(1,5,10,.86);backdrop-filter:blur(18px);overflow:hidden}#wisdo-recognition-stage.open{display:grid}
      .wisdo-recognition-grid{position:absolute;inset:-20%;opacity:.2;background-image:linear-gradient(rgba(104,247,196,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(89,168,255,.11) 1px,transparent 1px);background-size:55px 55px;transform:perspective(600px) rotateX(63deg) translateY(40%);animation:wisdoRecognitionGrid 7s linear infinite}
      .wisdo-recognition-card{position:relative;width:min(780px,100%);padding:34px;border:1px solid rgba(104,247,196,.32);border-radius:30px;background:radial-gradient(circle at 90% 0,rgba(89,168,255,.16),transparent 37%),linear-gradient(155deg,rgba(13,29,43,.98),rgba(4,10,17,.99));box-shadow:0 50px 160px rgba(0,0,0,.72),0 0 100px rgba(104,247,196,.1);overflow:hidden}
      .wisdo-recognition-card.milestone{border-color:rgba(255,204,116,.65);background:radial-gradient(circle at 85% 0,rgba(255,204,116,.24),transparent 38%),linear-gradient(155deg,rgba(31,24,12,.98),rgba(7,10,15,.99));box-shadow:0 50px 160px rgba(0,0,0,.72),0 0 120px rgba(255,204,116,.18)}
      .wisdo-recognition-close{position:absolute;right:16px;top:15px;width:40px;height:40px;border:1px solid rgba(255,255,255,.12);border-radius:13px;background:rgba(255,255,255,.05);color:white;font-size:22px;cursor:pointer}.wisdo-recognition-kicker{color:#68f7c4;font-size:11px;font-weight:950;letter-spacing:.22em;text-transform:uppercase}.milestone .wisdo-recognition-kicker{color:#ffcc74}
      .wisdo-recognition-name{font-size:clamp(38px,7vw,74px);line-height:.92;letter-spacing:-.065em;margin:13px 0 8px;background:linear-gradient(100deg,#fff 5%,#68f7c4 48%,#59a8ff);-webkit-background-clip:text;color:transparent}.milestone .wisdo-recognition-name{background:linear-gradient(100deg,#fff 5%,#ffcc74 52%,#ff8a73);-webkit-background-clip:text;color:transparent}
      .wisdo-recognition-id{color:#8ca7b9;font-weight:800}.wisdo-recognition-message{font-size:17px;line-height:1.7;color:#b7c8d5;max-width:680px}.wisdo-recognition-account{margin:23px 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.13em;color:#90a8ba}
      .wisdo-recognition-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.wisdo-recognition-metrics div{padding:14px;border-radius:15px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035)}.wisdo-recognition-metrics small{display:block;color:#8198aa;text-transform:uppercase;letter-spacing:.1em;font-size:9px}.wisdo-recognition-metrics strong{display:block;margin-top:6px;font-size:22px}.wisdo-recognition-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.wisdo-recognition-actions button,.wisdo-recognition-actions a{flex:1;min-width:190px}
      #wisdo-recognition-hud{position:fixed;right:92px;bottom:20px;z-index:229;display:flex;align-items:center;gap:13px;min-width:250px;padding:11px 15px;border-radius:17px;border:1px solid rgba(104,247,196,.2);background:rgba(5,13,21,.9);box-shadow:0 18px 55px rgba(0,0,0,.36);backdrop-filter:blur(15px);cursor:pointer;transform:translateY(20px);opacity:0;transition:.35s}.wisdo-recognition-hud.ready{transform:none;opacity:1}.wisdo-recognition-hud.pulse{animation:wisdoHudPulse .8s ease}.wisdo-recognition-hud .mark{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 25%,#fff,#68f7c4 20%,#0b5d54 65%);color:#03120f;font-weight:1000;box-shadow:0 0 24px rgba(104,247,196,.3)}.wisdo-recognition-hud small{display:block;color:#849bab;font-size:9px;text-transform:uppercase;letter-spacing:.1em}.wisdo-recognition-hud strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}.wisdo-recognition-hud .pnl{margin-left:auto;font-size:17px}.wisdo-recognition-hud .positive{color:#68f7c4}.wisdo-recognition-hud .negative{color:#ff6f82}
      .wisdo-confetti{position:absolute;width:8px;height:16px;border-radius:3px;background:#ffcc74;top:-20px;animation:wisdoConfetti 3s linear forwards}.wisdo-confetti:nth-child(3n){background:#68f7c4}.wisdo-confetti:nth-child(4n){background:#59a8ff}.wisdo-confetti:nth-child(5n){background:#ff7f93}
      @keyframes wisdoRecognitionGrid{to{background-position:0 110px,110px 0}}@keyframes wisdoHudPulse{50%{transform:scale(1.05);box-shadow:0 0 60px rgba(104,247,196,.25)}}@keyframes wisdoConfetti{to{transform:translate3d(var(--drift),110vh,0) rotate(720deg);opacity:.15}}
      @media(max-width:700px){.wisdo-recognition-card{padding:29px 20px}.wisdo-recognition-metrics{grid-template-columns:repeat(2,1fr)}#wisdo-recognition-hud{left:12px;right:72px;bottom:12px;min-width:0}.wisdo-recognition-actions button,.wisdo-recognition-actions a{min-width:100%}}
      @media(prefers-reduced-motion:reduce){.wisdo-recognition-grid,.wisdo-confetti,.wisdo-recognition-hud.pulse{animation:none}}
    `;
    document.head.append(style);
    const stage = document.createElement('div');
    stage.id = 'wisdo-recognition-stage';
    stage.innerHTML = `<div class="wisdo-recognition-grid"></div><section class="wisdo-recognition-card" id="wisdo-recognition-card"><button class="wisdo-recognition-close" type="button" aria-label="Close">×</button><div id="wisdo-recognition-confetti"></div><div class="wisdo-recognition-kicker" id="wisdo-recognition-kicker">Identity recognized</div><h1 class="wisdo-recognition-name" id="wisdo-recognition-name">Welcome back</h1><div class="wisdo-recognition-id" id="wisdo-recognition-id">WISDO Member</div><p class="wisdo-recognition-message" id="wisdo-recognition-message">Your Culture Desk is connected.</p><div class="wisdo-recognition-account" id="wisdo-recognition-account">Culture Portfolio</div><div class="wisdo-recognition-metrics"><div><small>Balance</small><strong id="wisdo-recognition-balance">$0.00</strong></div><div><small>Equity</small><strong id="wisdo-recognition-equity">$0.00</strong></div><div><small>Floating P/L</small><strong id="wisdo-recognition-floating">$0.00</strong></div><div><small>Open trades</small><strong id="wisdo-recognition-open">0</strong></div></div><div class="wisdo-recognition-actions"><button class="btn primary" id="wisdo-recognition-enter" type="button">Enter my desk</button><a class="btn ghost" href="/app/presence">Open my identity</a></div></section>`;
    document.body.append(stage);
    const hud = document.createElement('button');
    hud.id = 'wisdo-recognition-hud';
    hud.type = 'button';
    hud.innerHTML = `<span class="mark">W</span><span><small id="wisdo-hud-label">Culture Portfolio</small><strong id="wisdo-hud-name">${userName()}</strong></span><span class="pnl" id="wisdo-hud-pnl">$0.00</span>`;
    document.body.append(hud);
    stage.querySelector('.wisdo-recognition-close').addEventListener('click', close);
    stage.querySelector('#wisdo-recognition-enter').addEventListener('click', close);
    stage.addEventListener('click', (event) => { if (event.target === stage) close(); });
    hud.addEventListener('click', () => show({ reason: 'orb' }));
  }

  function updateHud() {
    inject();
    const summary = portfolio();
    const hud = document.querySelector('#wisdo-recognition-hud');
    document.querySelector('#wisdo-hud-name').textContent = userName();
    document.querySelector('#wisdo-hud-label').textContent = summary.label;
    const pnl = document.querySelector('#wisdo-hud-pnl');
    pnl.textContent = money(summary.floating);
    pnl.className = `pnl ${summary.floating >= 0 ? 'positive' : 'negative'}`;
    hud.classList.add('ready', 'pulse');
    setTimeout(() => hud.classList.remove('pulse'), 900);
    const oldIdentity = document.querySelector('.member-identity strong');
    if (oldIdentity) oldIdentity.textContent = userName();
  }

  function createConfetti() {
    const host = document.querySelector('#wisdo-recognition-confetti');
    if (!host) return;
    host.innerHTML = '';
    for (let index = 0; index < 34; index += 1) {
      const piece = document.createElement('i');
      piece.className = 'wisdo-confetti';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.animationDelay = `${Math.random() * .7}s`;
      piece.style.setProperty('--drift', `${Math.round((Math.random() - .5) * 240)}px`);
      host.append(piece);
    }
  }

  function animateNumber(node, target, formatter = (value) => String(Math.round(value))) {
    if (!node) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { node.textContent = formatter(target); return; }
    const start = performance.now();
    const duration = 850;
    const tick = (time) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = formatter(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  async function acknowledgement(accountId, milestonePercent) {
    if (!accountId || !milestonePercent) return;
    await fetch('/api/presence/recognition/ack', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accountId, milestonePercent }),
    }).catch(() => null);
  }

  function greetingReason() {
    const day = new Date().toISOString().slice(0, 10);
    const lastDay = localStorage.getItem('wisdo.recognition.day') || '';
    const lastActiveAt = Number(localStorage.getItem('wisdo.recognition.lastActiveAt') || 0);
    const away = lastActiveAt > 0 && Date.now() - lastActiveAt >= 15 * 60 * 1000;
    const sessionShown = sessionStorage.getItem('wisdo.recognition.sessionShown') === '1';
    if (lastDay !== day) return 'first_today';
    if (away) return 'returned';
    if (!sessionShown) return 'new_session';
    return '';
  }

  function messageFor(reason, summary) {
    if (reason === 'first_today') return `Good to see you, ${userName()}. Your first WISDO session of the day is live with ${summary.label}.`;
    if (reason === 'returned') return `Welcome back, ${userName()}. WISDO restored ${summary.label} and refreshed your live performance.`;
    if (reason === 'new_session') return `${userName()}, your Culture identity is recognized. Your trading desk is ready.`;
    if (reason === 'account_changed') return `${summary.label} is now selected. WISDO has updated your balance, equity, floating P/L, and open-trade context.`;
    return `${userName()}, WISDO recognizes your identity and current trading context.`;
  }

  function show({ reason = '', milestone = null } = {}) {
    inject();
    const portfolioSummary = portfolio();
    const summary = milestone?.milestonePercent ? {
      accountId: milestone.accountId || portfolioSummary.accountId,
      label: milestone.accountLabel || portfolioSummary.label,
      accountNumber: milestone.accountNumber || portfolioSummary.accountNumber,
      balance: number(milestone.currentBalance ?? portfolioSummary.balance),
      equity: number(milestone.currentEquity ?? portfolioSummary.equity),
      floating: number(milestone.floatingPL ?? portfolioSummary.floating),
      openTrades: portfolioSummary.openTrades,
      mode: 'account',
    } : portfolioSummary;
    const stage = document.querySelector('#wisdo-recognition-stage');
    const card = document.querySelector('#wisdo-recognition-card');
    const isMilestone = Boolean(milestone?.milestonePercent);
    card.classList.toggle('milestone', isMilestone);
    document.querySelector('#wisdo-recognition-kicker').textContent = isMilestone ? `Growth milestone · ${milestone.milestonePercent}%` : (reason === 'account_changed' ? 'Account context synchronized' : 'Identity recognized');
    document.querySelector('#wisdo-recognition-name').textContent = isMilestone ? `${milestone.milestonePercent}% recognized` : userName();
    document.querySelector('#wisdo-recognition-id').textContent = `${cultureId()}${state.identity?.title ? ` · ${state.identity.title}` : ''}${state.recognition?.rank?.currentRank?.name ? ` · ${state.recognition.rank.currentRank.name}` : ''}`;
    document.querySelector('#wisdo-recognition-message').textContent = isMilestone ? milestone.message : messageFor(reason, summary);
    document.querySelector('#wisdo-recognition-account').textContent = `${summary.label}${summary.accountNumber ? ` · ${summary.accountNumber}` : ''}`;
    animateNumber(document.querySelector('#wisdo-recognition-balance'), summary.balance, money);
    animateNumber(document.querySelector('#wisdo-recognition-equity'), summary.equity, money);
    const floatingNode = document.querySelector('#wisdo-recognition-floating');
    floatingNode.style.color = summary.floating >= 0 ? '#68f7c4' : '#ff6f82';
    animateNumber(floatingNode, summary.floating, money);
    animateNumber(document.querySelector('#wisdo-recognition-open'), summary.openTrades);
    if (isMilestone) createConfetti();
    stage.classList.add('open');
    state.showing = true;
    state.currentMilestone = isMilestone ? { ...milestone, accountId: milestone.accountId || summary.accountId } : null;
    localStorage.setItem('wisdo.recognition.day', new Date().toISOString().slice(0, 10));
    localStorage.setItem('wisdo.recognition.lastActiveAt', String(Date.now()));
    sessionStorage.setItem('wisdo.recognition.sessionShown', '1');
  }

  function close() {
    document.querySelector('#wisdo-recognition-stage')?.classList.remove('open');
    state.showing = false;
    const milestone = state.currentMilestone;
    state.currentMilestone = null;
    if (milestone?.accountId && milestone?.milestonePercent) {
      acknowledgement(milestone.accountId, milestone.milestonePercent).finally(() => {
        setTimeout(() => refresh({ allowGreeting: false }).catch(() => null), 450);
      });
    }
  }

  async function loadRecognition() {
    const accountId = state.selectedAccountId || '';
    const response = await fetch(`/api/presence/recognition${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ''}`, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`recognition ${response.status}`);
    const payload = await response.json();
    state.identity = payload.identity || state.identity;
    state.recognition = payload.recognition || state.recognition;
    return payload;
  }

  async function refresh({ reason = '', allowGreeting = false } = {}) {
    updateHud();
    let payload = null;
    try { payload = await loadRecognition(); } catch {}
    updateHud();
    const recognitionAccounts = Array.isArray(payload?.recognition?.accounts) ? payload.recognition.accounts : [];
    const selectedRecognition = state.selectedAccountId
      ? (payload?.recognition?.selected || recognitionAccounts.find((row) => String(row.accountId) === String(state.selectedAccountId)) || null)
      : (recognitionAccounts.find((row) => row?.pendingMilestone) || payload?.recognition?.selected || recognitionAccounts[0] || null);
    const pending = selectedRecognition?.pendingMilestone;
    if (pending) {
      const key = `${selectedRecognition.accountId}:${pending.milestonePercent}`;
      if (state.lastMilestoneKey !== key) {
        state.lastMilestoneKey = key;
        show({ milestone: { ...pending, accountId: selectedRecognition.accountId } });
        return;
      }
    }
    if (allowGreeting) {
      const resolvedReason = reason || greetingReason();
      if (resolvedReason) show({ reason: resolvedReason });
    } else if (reason === 'account_changed') {
      show({ reason });
      setTimeout(close, 4200);
    }
  }

  window.addEventListener('wisdo:accounts-ready', (event) => {
    state.accounts = Array.isArray(event.detail?.accounts) ? event.detail.accounts : [];
    state.selectedAccountId = String(event.detail?.selectedAccountId || '');
    refresh({ allowGreeting: !document.documentElement.dataset.wisdoRecognitionStarted }).catch(() => null);
    document.documentElement.dataset.wisdoRecognitionStarted = '1';
  });

  window.addEventListener('wisdo:account-selected', (event) => {
    state.accounts = Array.isArray(event.detail?.accounts) ? event.detail.accounts : state.accounts;
    state.selectedAccountId = String(event.detail?.selectedAccountId || '');
    refresh({ reason: 'account_changed', allowGreeting: false }).catch(() => null);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) localStorage.setItem('wisdo.recognition.lastActiveAt', String(Date.now()));
    else {
      const last = Number(localStorage.getItem('wisdo.recognition.lastActiveAt') || 0);
      if (last && Date.now() - last >= 15 * 60 * 1000) refresh({ reason: 'returned', allowGreeting: true }).catch(() => null);
      localStorage.setItem('wisdo.recognition.lastActiveAt', String(Date.now()));
    }
  });

  window.addEventListener('beforeunload', () => localStorage.setItem('wisdo.recognition.lastActiveAt', String(Date.now())));
  setInterval(() => {
    if (!document.hidden && state.accounts.length) refresh({ allowGreeting: false }).catch(() => null);
  }, 60000);
  inject();
  try {
    const cached = JSON.parse(sessionStorage.getItem('wisdo.accountSnapshot') || '[]');
    if (Array.isArray(cached) && cached.length) {
      state.accounts = cached;
      state.selectedAccountId = sessionStorage.getItem('wisdo.selectedAccountId') || '';
      updateHud();
    }
  } catch {}
})();
