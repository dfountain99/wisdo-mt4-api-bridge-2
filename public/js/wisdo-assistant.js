(() => {
  'use strict';
  if (window.__wisdoAssistantMounted) return;
  window.__wisdoAssistantMounted = true;

  const escapeHtml = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const style = document.createElement('style');
  style.textContent = `
  .wisdo-ai-launch{position:fixed;right:20px;bottom:20px;z-index:10020;width:58px;height:58px;border-radius:20px;border:1px solid rgba(104,247,196,.45);background:radial-gradient(circle at 35% 30%,#fff5bd,#ffcc68 30%,#6b41c8 70%,#08111c);color:#06100d;font-weight:950;box-shadow:0 0 36px rgba(104,247,196,.28),0 24px 60px rgba(0,0,0,.45);cursor:pointer;display:grid;place-items:center;font-size:19px}
  .wisdo-ai-launch[data-alert]:after{content:attr(data-alert);position:absolute;right:-6px;top:-7px;min-width:22px;height:22px;padding:0 5px;border-radius:999px;background:#ff5f75;color:#fff;border:2px solid #08111c;display:grid;place-items:center;font-size:11px}
  .wisdo-ai-shell{position:fixed;right:20px;bottom:90px;z-index:10019;width:min(430px,calc(100vw - 24px));height:min(690px,calc(100vh - 120px));display:none;grid-template-rows:auto auto 1fr auto;background:linear-gradient(180deg,rgba(11,20,32,.98),rgba(3,9,16,.98));border:1px solid rgba(104,247,196,.25);border-radius:24px;box-shadow:0 30px 100px rgba(0,0,0,.58);overflow:hidden;color:#f3f8ff;backdrop-filter:blur(20px)}
  .wisdo-ai-shell.open{display:grid}.wisdo-ai-shell.full{inset:12px;width:auto;height:auto;right:12px;bottom:12px}
  .wisdo-ai-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:15px 16px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025)}
  .wisdo-ai-head strong{display:block}.wisdo-ai-head small{color:#91a6b9}.wisdo-ai-head button{border:0;background:rgba(255,255,255,.07);color:#fff;border-radius:10px;padding:7px 9px;cursor:pointer}
  .wisdo-ai-context{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;gap:7px;flex-wrap:wrap}.wisdo-ai-chip{font-size:11px;border:1px solid rgba(255,255,255,.11);border-radius:999px;padding:5px 8px;color:#b9c9d7}.wisdo-ai-chip.warn{border-color:rgba(255,111,130,.35);color:#ffabb8}
  .wisdo-ai-thread{padding:14px;overflow:auto;display:grid;align-content:start;gap:10px}.wisdo-ai-msg{max-width:88%;padding:11px 13px;border-radius:15px;white-space:pre-wrap;line-height:1.5;font-size:14px}.wisdo-ai-msg.user{justify-self:end;background:rgba(89,168,255,.17)}.wisdo-ai-msg.assistant{justify-self:start;background:rgba(104,247,196,.09);border:1px solid rgba(104,247,196,.12)}.wisdo-ai-msg.notice{justify-self:stretch;max-width:none;background:rgba(255,204,116,.08);border:1px solid rgba(255,204,116,.2);color:#ffe7b5}
  .wisdo-ai-suggestions{display:flex;gap:6px;flex-wrap:wrap}.wisdo-ai-suggestions button,.wisdo-ai-actions a{border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:7px 9px;background:rgba(255,255,255,.035);color:#d8e6f2;font-size:11px;cursor:pointer;text-decoration:none}.wisdo-ai-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
  .wisdo-ai-compose{padding:12px;border-top:1px solid rgba(255,255,255,.08);display:grid;grid-template-columns:auto 1fr auto;gap:7px;background:#07111c}.wisdo-ai-compose textarea{resize:none;min-height:48px;max-height:120px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.04);color:#fff;padding:11px}.wisdo-ai-compose button,.wisdo-ai-file{border:1px solid rgba(255,255,255,.12);border-radius:13px;background:rgba(255,255,255,.05);color:#fff;padding:10px;cursor:pointer;display:grid;place-items:center}.wisdo-ai-file input{display:none}.wisdo-ai-attachment{grid-column:1/-1;font-size:11px;color:#9fb1c2}.wisdo-ai-send{background:linear-gradient(135deg,#68f7c4,#2ccba5)!important;color:#03120f!important;font-weight:950}.wisdo-ai-usage{font-size:10px;color:#73889c;margin-left:auto}
  @media(max-width:640px){.wisdo-ai-launch{right:14px;bottom:14px}.wisdo-ai-shell{left:8px;right:8px;bottom:82px;width:auto;height:min(76vh,720px);border-radius:22px 22px 14px 14px}.wisdo-ai-shell.full{inset:0;border-radius:0}}
  `;
  document.head.append(style);

  const launch = document.createElement('button');
  launch.className = 'wisdo-ai-launch'; launch.type = 'button'; launch.title = 'Open Wisdo AI'; launch.textContent = 'W';
  const shell = document.createElement('section');
  shell.className = 'wisdo-ai-shell'; shell.setAttribute('aria-label', 'Wisdo AI assistant');
  shell.innerHTML = `<header class="wisdo-ai-head"><div><strong>Wisdo AI</strong><small>Page-aware education and operations assistant</small></div><div><button type="button" data-wisdo-ai-clear title="Clear history">↺</button><button type="button" data-wisdo-ai-full title="Expand">□</button><button type="button" data-wisdo-ai-close title="Minimize">—</button></div></header><div class="wisdo-ai-context"><span class="wisdo-ai-chip" data-ai-page></span><span class="wisdo-ai-chip" data-ai-account>Account context loading</span><span class="wisdo-ai-usage" data-ai-usage></span></div><div class="wisdo-ai-thread"><div class="wisdo-ai-msg assistant">I can explain this page, teach a lesson, open tools, diagnose visible account status, and prepare the next safe step. Trade closures, copier changes, automation, and payments still require the normal visible confirmation screen.</div><div class="wisdo-ai-suggestions" data-ai-suggestions></div></div><form class="wisdo-ai-compose"><label class="wisdo-ai-file" title="Attach screenshot">＋<input type="file" accept="image/*" data-ai-file></label><textarea placeholder="Ask Wisdo about this page…" data-ai-input></textarea><button class="wisdo-ai-send" type="submit">Send</button><button type="button" data-ai-voice title="Voice input">🎙</button><div class="wisdo-ai-attachment" data-ai-attachment></div></form>`;
  document.body.append(shell, launch);

  const thread = shell.querySelector('.wisdo-ai-thread');
  const suggestions = shell.querySelector('[data-ai-suggestions]');
  const input = shell.querySelector('[data-ai-input]');
  const attachmentLabel = shell.querySelector('[data-ai-attachment]');
  let context = null;
  let attachment = null;
  let historyLoaded = false;

  const selectedAccountId = () => document.querySelector('#mobile-account')?.value || sessionStorage.getItem('wisdo.selectedAccountId') || '';
  const addMessage = (role, text, extras = {}) => {
    const node = document.createElement('div'); node.className = `wisdo-ai-msg ${role}`; node.textContent = text; thread.append(node);
    if (extras.actionLinks?.length) {
      const links = document.createElement('div'); links.className = 'wisdo-ai-actions'; links.innerHTML = extras.actionLinks.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join(''); node.append(links);
    }
    if (extras.confirmationMessage) { const notice = document.createElement('div'); notice.className = 'wisdo-ai-msg notice'; notice.textContent = extras.confirmationMessage; thread.append(notice); }
    thread.scrollTop = thread.scrollHeight;
    return node;
  };

  async function loadHistory() {
    if (historyLoaded) return;
    historyLoaded = true;
    try {
      const response = await fetch('/api/v2/wisdo-ai/history');
      if (!response.ok) return;
      const payload = await response.json();
      for (const row of (payload.messages || []).slice(-20)) addMessage(row.role === 'assistant' ? 'assistant' : 'user', row.content || '');
    } catch {}
  }

  async function loadContext() {
    try {
      const query = new URLSearchParams({ currentPage: location.pathname + location.search, selectedAccountId: selectedAccountId() });
      const response = await fetch(`/api/wisdo-ai/context?${query}`); const payload = await response.json(); context = payload.context || {};
      shell.querySelector('[data-ai-page]').textContent = context.currentPage || location.pathname;
      shell.querySelector('[data-ai-account]').textContent = context.selectedAccount ? `${context.selectedAccount.broker || context.selectedAccount.platform} · ${context.selectedAccount.accountNumber}` : 'No selected account';
      shell.querySelector('[data-ai-account]').classList.toggle('warn', Boolean(context.issues?.length));
      if (context.issues?.length) launch.dataset.alert = String(context.issues.length); else delete launch.dataset.alert;
      suggestions.innerHTML = (context.suggestedQuestions || []).slice(0, 4).map((question) => `<button type="button">${escapeHtml(question)}</button>`).join('');
      suggestions.querySelectorAll('button').forEach((button) => { button.onclick = () => { input.value = button.textContent; input.focus(); }; });
    } catch { shell.querySelector('[data-ai-account]').textContent = 'Public education mode'; }
  }

  async function sendMessage(message) {
    addMessage('user', message);
    const pending = addMessage('assistant', 'Wisdo is building the response…');
    try {
      const response = await fetch('/api/wisdo-ai/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, currentPage: location.pathname + location.search, selectedAccountId: selectedAccountId(), attachment }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
      pending.remove(); addMessage('assistant', payload.answer || 'No answer returned.', payload);
      shell.querySelector('[data-ai-usage]').textContent = payload.usage ? `${payload.usage.count}/${payload.usage.limit} today` : '';
    } catch (error) { pending.textContent = error.message; }
    attachment = null; attachmentLabel.textContent = '';
  }

  launch.onclick = async () => { shell.classList.toggle('open'); if (shell.classList.contains('open')) { await loadContext(); await loadHistory(); input.focus(); } };
  shell.querySelector('[data-wisdo-ai-clear]').onclick = async () => {
    try { await fetch('/api/v2/wisdo-ai/history', { method: 'DELETE' }); } catch {}
    thread.querySelectorAll('.wisdo-ai-msg.user,.wisdo-ai-msg.assistant,.wisdo-ai-msg.notice').forEach((node, index) => { if (index > 0) node.remove(); });
    historyLoaded = true;
  };
  shell.querySelector('[data-wisdo-ai-close]').onclick = () => shell.classList.remove('open');
  shell.querySelector('[data-wisdo-ai-full]').onclick = () => shell.classList.toggle('full');
  shell.querySelector('form').onsubmit = (event) => { event.preventDefault(); const message = input.value.trim(); if (!message) return; input.value = ''; sendMessage(message); };
  shell.querySelector('[data-ai-file]').onchange = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 2_000_000) { attachmentLabel.textContent = 'Screenshot must be under 2 MB.'; return; }
    const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    attachment = { name: file.name, type: file.type, dataUrl }; attachmentLabel.textContent = `Attached: ${file.name}`;
  };
  shell.querySelector('[data-ai-voice]').onclick = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { attachmentLabel.textContent = 'Voice input is not available in this browser.'; return; }
    const recognition = new Recognition(); recognition.lang = 'en-US'; recognition.interimResults = false; recognition.onresult = (event) => { input.value = event.results[0][0].transcript; input.focus(); }; recognition.onerror = () => { attachmentLabel.textContent = 'Voice input could not start.'; }; recognition.start();
  };

  document.addEventListener('change', (event) => { if (event.target?.id === 'mobile-account') loadContext(); });
})();
