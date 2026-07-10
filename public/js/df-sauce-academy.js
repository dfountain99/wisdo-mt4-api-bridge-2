(() => {
  'use strict';

  const html = (value = '') => String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  async function api(path, options = {}, timeoutMs = 20000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(path, {
        ...options,
        signal: controller.signal,
        headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  function speak(text, enabled) {
    if (!enabled || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text || '').slice(0, 1200));
    utterance.rate = 0.94;
    utterance.pitch = 0.96;
    speechSynthesis.speak(utterance);
  }

  function drawScenario(canvas, scenario, visibleCount) {
    if (!canvas || !scenario?.candles?.length) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(500, canvas.clientWidth || 900);
    const height = Math.max(300, canvas.clientHeight || 460);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#03070d';
    ctx.fillRect(0, 0, width, height);

    const candles = scenario.candles.slice(0, Math.max(1, visibleCount));
    const values = candles.flatMap((bar) => [bar.high, bar.low]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(0.001, max - min);
    const left = 48;
    const top = 22;
    const chartWidth = width - 72;
    const chartHeight = height - 54;
    const y = (price) => top + ((max - price) / range) * chartHeight;

    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 1;
    for (let index = 0; index <= 5; index += 1) {
      const rowY = top + chartHeight * (index / 5);
      ctx.beginPath(); ctx.moveTo(left, rowY); ctx.lineTo(width - 20, rowY); ctx.stroke();
      const value = max - range * (index / 5);
      ctx.fillStyle = 'rgba(190,210,225,.7)';
      ctx.font = '11px system-ui';
      ctx.fillText(value.toFixed(2), 3, rowY + 4);
    }

    const step = chartWidth / Math.max(1, candles.length);
    const bodyWidth = Math.max(3, Math.min(12, step * 0.58));
    candles.forEach((bar, index) => {
      const x = left + index * step + step / 2;
      const up = bar.close >= bar.open;
      ctx.strokeStyle = up ? '#68f7c4' : '#ff6f82';
      ctx.fillStyle = up ? '#68f7c4' : '#ff6f82';
      ctx.beginPath(); ctx.moveTo(x, y(bar.high)); ctx.lineTo(x, y(bar.low)); ctx.stroke();
      const bodyTop = Math.min(y(bar.open), y(bar.close));
      const bodyHeight = Math.max(2, Math.abs(y(bar.open) - y(bar.close)));
      ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    });

    for (const checkpoint of scenario.checkpoints || []) {
      if (checkpoint.index >= candles.length) continue;
      const x = left + checkpoint.index * step + step / 2;
      ctx.strokeStyle = 'rgba(255,204,116,.72)';
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, height - 24); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function mount(container, options = {}) {
    if (!container) return;
    const bootstrap = options.bootstrap || {};
    const summary = bootstrap.summary || { courseCount: 6500, domainCount: 65, levelCount: 5, categories: [] };
    const tracks = bootstrap.tracks || [];
    let profile = bootstrap.learnerProfile || { experience: 'starter', goals: [], markets: [], interests: [], weeklyMinutes: 180, learningStyle: 'interactive' };
    let selectedCourseId = '';
    let scenario = null;
    let visibleBars = 1;
    let replayTimer = null;
    let currentCheckpoint = 0;
    let voiceEnabled = false;
    let catalogPage = 1;

    container.innerHTML = `
      <section class="card academy-hero">
        <div><span class="eyebrow">Adaptive education operating system</span><h1>Build knowledge around the trader—not the other way around.</h1><p class="muted">Start with what a candlestick is, then progress through execution, strategies, global markets, personal finance, money management, psychology, research, technology, and professional trading operations.</p></div>
        <div class="academy-score"><small>Course universe</small><strong>${Number(summary.courseCount || 6500).toLocaleString()}</strong><span>structured courses</span><p>${Number(summary.domainCount || 65)} knowledge domains</p></div>
      </section>
      <section class="card">
        <div class="academy-stat-grid">
          <div class="academy-stat"><small class="muted">Courses</small><strong>${Number(summary.courseCount || 6500).toLocaleString()}</strong><span>searchable curriculum</span></div>
          <div class="academy-stat"><small class="muted">Domains</small><strong>${Number(summary.domainCount || 65)}</strong><span>trading, finance, and systems</span></div>
          <div class="academy-stat"><small class="muted">Levels</small><strong>${Number(summary.levelCount || 5)}</strong><span>starter to professional</span></div>
          <div class="academy-stat"><small class="muted">Learning modes</small><strong>5</strong><span>visual, interactive, reading, audio, mixed</span></div>
        </div>
      </section>
      <nav class="academy-tabs card" aria-label="Academy sections">
        <button class="btn active" data-academy-tab="path">My Learning Path</button>
        <button class="btn" data-academy-tab="catalog">Course Universe</button>
        <button class="btn" data-academy-tab="tutor">Ask WISDO Tutor</button>
        <button class="btn" data-academy-tab="scenario">DF Sauce Scenario Lab</button>
        <button class="btn" data-academy-tab="watch">TradingView Watch Room</button>
      </nav>
      <div data-academy-panel="path"></div>
      <div data-academy-panel="catalog" hidden></div>
      <div data-academy-panel="tutor" hidden></div>
      <div data-academy-panel="scenario" hidden></div>
      <div data-academy-panel="watch" hidden></div>
    `;

    const panel = (name) => container.querySelector(`[data-academy-panel="${name}"]`);
    const switchTab = (name) => {
      container.querySelectorAll('[data-academy-panel]').forEach((node) => { node.hidden = node.dataset.academyPanel !== name; });
      container.querySelectorAll('[data-academy-tab]').forEach((button) => button.classList.toggle('active', button.dataset.academyTab === name));
      if (name === 'catalog') loadCatalog();
      if (name === 'scenario') loadScenario(container.querySelector('#scenario-select')?.value || 'bull-campaign');
      if (name === 'watch') loadWatchRoom();
    };
    container.querySelectorAll('[data-academy-tab]').forEach((button) => { button.onclick = () => switchTab(button.dataset.academyTab); });

    async function loadPath() {
      const response = await api('/api/v2/academy/path', { method: 'POST', body: JSON.stringify(profile) });
      const path = response.path || [];
      panel('path').innerHTML = `
        <div class="academy-layout">
          <section class="card"><div class="card-head"><div><span class="eyebrow">Adaptive profile</span><h3>Tell WISDO what you know and what you want to learn.</h3></div></div>
            <form id="academy-profile-form" class="academy-profile-grid">
              <label>Experience<select class="input" name="experience"><option value="starter">Starter</option><option value="foundation">Foundation</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="professional">Professional</option></select></label>
              <label>Learning style<select class="input" name="learningStyle"><option value="interactive">Interactive</option><option value="visual">Visual</option><option value="reading">Reading</option><option value="audio">Audio</option><option value="mixed">Mixed</option></select></label>
              <label>Minutes per week<input class="input" name="weeklyMinutes" type="number" min="30" max="1200" value="${Number(profile.weeklyMinutes || 180)}"></label>
              <label class="full">Goals<input class="input" name="goals" value="${html((profile.goals || []).join(', '))}" placeholder="Example: learn forex, protect capital, build a retirement plan"></label>
              <label class="full">Markets<input class="input" name="markets" value="${html((profile.markets || []).join(', '))}" placeholder="Forex, stocks, futures, options, crypto, bonds"></label>
              <label class="full">Interests<input class="input" name="interests" value="${html((profile.interests || []).join(', '))}" placeholder="Candlesticks, swing trading, money management, automation"></label>
              <button class="btn primary full" type="submit">Rebuild my learning path</button>
            </form>
          </section>
          <aside class="card"><span class="eyebrow">Why this path</span><h3>Risk and understanding come first.</h3><p>${html(response.explanation || '')}</p><div class="private-strategy-notice"><strong>Protected strategy policy</strong><br>WISDO teaches DF Sauce through decisions, scenarios, and private TradingView access. Proprietary source code and exact hidden implementation details are not delivered to the browser.</div></aside>
        </div>
        <section class="card"><div class="card-head"><div><span class="eyebrow">Recommended sequence</span><h3>Your next 36 courses</h3></div><button class="btn ghost" data-open-catalog>Search all ${Number(summary.courseCount || 6500).toLocaleString()}</button></div><div class="academy-course-grid">${path.slice(0, 18).map(courseCard).join('')}</div></section>
        <section class="card"><span class="eyebrow">Curriculum tracks</span><h3>Broad coverage, one connected system.</h3><div class="grid3">${tracks.map((track) => `<div class="track-card"><strong>${html(track.title)}</strong><p>${track.lessons.length} core domains</p></div>`).join('')}</div></section>`;
      const form = container.querySelector('#academy-profile-form');
      form.elements.experience.value = profile.experience || 'starter';
      form.elements.learningStyle.value = profile.learningStyle || 'interactive';
      form.onsubmit = async (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form));
        const result = await api('/api/v2/academy/profile', { method: 'PATCH', body: JSON.stringify(values) });
        profile = result.profile;
        await loadPath();
      };
      container.querySelector('[data-open-catalog]').onclick = () => switchTab('catalog');
      bindCourseButtons(panel('path'));
    }

    function courseCard(course) {
      return `<button class="course-tile" data-course-id="${html(course.id)}"><span class="eyebrow">${html(course.category)}</span><h3>${html(course.title)}</h3><p>${html(course.summary)}</p><div class="course-meta"><span>${html(course.levelTitle)}</span><span>${Number(course.durationMinutes)} min</span></div></button>`;
    }

    function bindCourseButtons(scope) {
      scope.querySelectorAll('[data-course-id]').forEach((button) => {
        button.onclick = () => openCourse(button.dataset.courseId);
      });
    }

    async function openCourse(courseId) {
      const result = await api(`/api/v2/academy/courses/${encodeURIComponent(courseId)}`);
      const course = result.course;
      selectedCourseId = course.id;
      const host = panel('catalog');
      host.innerHTML = `<section class="card"><button class="btn ghost" data-course-back>← Back to course search</button><span class="eyebrow">${html(course.category)} · ${html(course.levelTitle)}</span><h2>${html(course.title)}</h2><p class="lead">${html(course.summary)}</p><div class="grid2"><div><h3>Learning objectives</h3><ol class="lesson-map">${course.objectives.map((item) => `<li>${html(item)}</li>`).join('')}</ol></div><div><h3>Practice sequence</h3><ol class="lesson-map">${course.practice.map((item) => `<li>${html(item)}</li>`).join('')}</ol></div></div><div class="grid3">${course.modules.map((module) => `<article class="track-card"><span class="eyebrow">Module</span><h3>${html(module.title)}</h3><p>${html(module.body)}</p></article>`).join('')}</div><div class="private-strategy-notice">${html(course.riskNotice)}</div><div class="actions"><button class="btn primary" data-course-complete>Complete course</button><button class="btn ghost" data-ask-course>Ask WISDO about this course</button></div></section>`;
      host.querySelector('[data-course-back]').onclick = () => loadCatalog();
      host.querySelector('[data-course-complete]').onclick = async () => {
        await api(`/api/v2/academy/lessons/${encodeURIComponent(course.id)}/complete`, { method: 'POST', body: JSON.stringify({ score: 100 }) });
        host.querySelector('[data-course-complete]').textContent = 'Completed ✓';
      };
      host.querySelector('[data-ask-course]').onclick = () => { switchTab('tutor'); container.querySelector('#tutor-input').value = `Teach me ${course.title} at my current level. Start with the most important idea and a practice question.`; };
    }

    async function loadCatalog(page = catalogPage) {
      catalogPage = page;
      const current = panel('catalog');
      const previousQuery = current.querySelector('#course-query')?.value || '';
      const previousCategory = current.querySelector('#course-category')?.value || '';
      const previousLevel = current.querySelector('#course-level')?.value || '';
      const params = new URLSearchParams({ query: previousQuery, category: previousCategory, level: previousLevel, page: String(page), limit: '24' });
      const result = await api(`/api/v2/academy/catalog?${params}`);
      const categories = result.summary?.categories || summary.categories || [];
      current.innerHTML = `<section class="card"><div class="card-head"><div><span class="eyebrow">Course universe</span><h3>${Number(result.total || 0).toLocaleString()} matching courses</h3></div><span class="muted">Page ${result.page} of ${result.pages}</span></div><form id="catalog-filter" class="academy-filter"><input class="input" id="course-query" name="query" value="${html(previousQuery)}" placeholder="Search candlesticks, risk, forex, budgeting, options…"><select class="input" id="course-category" name="category"><option value="">All categories</option>${categories.map((item) => `<option value="${html(item)}" ${item === previousCategory ? 'selected' : ''}>${html(item)}</option>`).join('')}</select><select class="input" id="course-level" name="level"><option value="">All levels</option><option value="starter">Starter</option><option value="foundation">Foundation</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="professional">Professional</option></select><button class="btn primary" type="submit">Search</button></form><div class="academy-course-grid">${(result.courses || []).map(courseCard).join('')}</div><div class="actions"><button class="btn ghost" data-page-prev ${result.page <= 1 ? 'disabled' : ''}>Previous</button><button class="btn ghost" data-page-next ${result.page >= result.pages ? 'disabled' : ''}>Next</button></div></section>`;
      current.querySelector('#course-level').value = previousLevel;
      current.querySelector('#catalog-filter').onsubmit = (event) => { event.preventDefault(); loadCatalog(1); };
      current.querySelector('[data-page-prev]').onclick = () => loadCatalog(Math.max(1, result.page - 1));
      current.querySelector('[data-page-next]').onclick = () => loadCatalog(Math.min(result.pages, result.page + 1));
      bindCourseButtons(current);
    }

    function renderTutor() {
      panel('tutor').innerHTML = `<div class="academy-layout"><section class="card"><div class="card-head"><div><span class="eyebrow">Adaptive AI tutor</span><h3>Ask about trading, investing, money management, or the WISDO system.</h3></div><button class="btn ghost" id="clear-tutor-history">Clear history</button></div><div class="tutor-thread" id="tutor-thread"><div class="tutor-message assistant">Tell me what you already know, what market you care about, and what you are trying to accomplish. I will adjust the explanation and recommend a course path.</div></div><form class="tutor-compose" id="tutor-form"><textarea class="input" id="tutor-input" rows="3" placeholder="Example: I am new. Explain candlesticks and how much money I should risk while practicing."></textarea><button class="btn primary" type="submit">Ask WISDO</button></form></section><aside class="card"><span class="eyebrow">Tutor context</span><h3>Your learning profile</h3><div class="path-list"><div class="path-item"><small>Experience</small><strong>${html(profile.experience || 'starter')}</strong></div><div class="path-item"><small>Markets</small><strong>${html((profile.markets || []).join(', ') || 'not selected')}</strong></div><div class="path-item"><small>Goals</small><strong>${html((profile.goals || []).join(', ') || 'not selected')}</strong></div><div class="path-item"><small>Selected account</small><strong>${html(options.selectedAccountId || 'portfolio education')}</strong></div></div><p class="muted">The tutor is educational. It should not promise returns, reveal protected strategy code, or replace a licensed financial professional.</p></aside></div>`;
      const thread = panel('tutor').querySelector('#tutor-thread');
      api('/api/v2/academy/tutor/history').then((result) => {
        const messages = result.messages || [];
        if (!messages.length) return;
        thread.innerHTML = messages.map((message) => `<div class="tutor-message ${message.role === 'assistant' ? 'assistant' : 'user'}">${html(message.content || '')}</div>`).join('');
        thread.scrollTop = thread.scrollHeight;
      }).catch(() => null);
      panel('tutor').querySelector('#clear-tutor-history').onclick = async () => {
        await api('/api/v2/academy/tutor/history', { method: 'DELETE' });
        thread.innerHTML = '<div class="tutor-message assistant">Tutor history cleared. Tell me what you want to learn next.</div>';
      };
      panel('tutor').querySelector('#tutor-form').onsubmit = async (event) => {
        event.preventDefault();
        const input = panel('tutor').querySelector('#tutor-input');
        const message = input.value.trim();
        if (!message) return;
        thread.insertAdjacentHTML('beforeend', `<div class="tutor-message user">${html(message)}</div>`);
        input.value = '';
        const pending = document.createElement('div'); pending.className = 'tutor-message assistant'; pending.textContent = 'WISDO is building the explanation…'; thread.append(pending); thread.scrollTop = thread.scrollHeight;
        try {
          const result = await api('/api/v2/academy/tutor', { method: 'POST', body: JSON.stringify({ message, courseId: selectedCourseId || undefined, selectedAccountId: options.selectedAccountId || undefined }) }, 45000);
          pending.textContent = result.answer || 'No answer returned.';
          if (result.recommendations?.length) {
            const recommendations = document.createElement('div');
            recommendations.className = 'tutor-recommendations';
            recommendations.innerHTML = `<small>Recommended next courses</small>${result.recommendations.map((course) => `<button class="btn ghost" data-tutor-course="${html(course.id)}">${html(course.title)}</button>`).join('')}`;
            pending.append(recommendations);
            recommendations.querySelectorAll('[data-tutor-course]').forEach((button) => button.onclick = () => { switchTab('catalog'); openCourse(button.dataset.tutorCourse); });
          }
          speak(result.answer, voiceEnabled);
        } catch (error) { pending.textContent = error.message; }
        thread.scrollTop = thread.scrollHeight;
      };
    }

    function renderScenarioShell() {
      panel('scenario').innerHTML = `<section class="card"><div class="card-head"><div><span class="eyebrow">Protected DF Sauce training</span><h3>Read campaign character without exposing proprietary source.</h3></div><label class="voice-toggle"><input id="academy-voice" type="checkbox"> Voice coach</label></div><div class="private-strategy-notice">The private indicator belongs on your TradingView layout. This lab receives educational candle scenarios and decision checkpoints only; it does not contain downloadable strategy source or exact private implementation parameters.</div><div class="academy-toolbar"><select class="input" id="scenario-select"><option value="bull-campaign">Bull campaign formation</option><option value="bear-campaign">Bear campaign formation</option><option value="false-break">False break and recovery</option><option value="range-day">Range-day character</option><option value="campaign-exit">Campaign invalidation</option><option value="news-volatility">News-volatility expansion</option></select><button class="btn primary" id="scenario-play">Play live lesson</button><button class="btn ghost" id="scenario-step">Step</button><button class="btn ghost" id="scenario-reset">Reset</button></div><div class="scenario-stage"><div><canvas class="scenario-chart" id="scenario-chart"></canvas><div class="replay-progress"><span id="scenario-progress"></span></div><div class="scenario-actions"><button class="btn ghost" data-decision="buy">Buy</button><button class="btn ghost" data-decision="sell">Sell</button><button class="btn primary" data-decision="wait">Wait</button><button class="btn ghost" data-decision="close">Close</button></div></div><aside><div id="scenario-coach" class="decision-box"><span class="eyebrow">Live coach</span><h3>Load a scenario to begin.</h3><p>WISDO will pause at decision checkpoints and ask you to explain the safest action.</p></div><div id="checkpoint-list" class="path-list"></div></aside></div></section>`;
      const scope = panel('scenario');
      scope.querySelector('#academy-voice').onchange = (event) => { voiceEnabled = event.target.checked; };
      scope.querySelector('#scenario-select').onchange = (event) => loadScenario(event.target.value);
      scope.querySelector('#scenario-play').onclick = toggleReplay;
      scope.querySelector('#scenario-step').onclick = stepReplay;
      scope.querySelector('#scenario-reset').onclick = () => resetScenario();
      scope.querySelectorAll('[data-decision]').forEach((button) => { button.onclick = () => gradeDecision(button.dataset.decision); });
    }

    async function loadScenario(id) {
      if (!panel('scenario').querySelector('#scenario-chart')) renderScenarioShell();
      const result = await api(`/api/v2/academy/df-sauce/scenarios/${encodeURIComponent(id)}`);
      scenario = result.scenario;
      resetScenario();
      const list = panel('scenario').querySelector('#checkpoint-list');
      list.innerHTML = scenario.checkpoints.map((item, index) => `<div class="checkpoint ${index === 0 ? 'current' : ''}" data-checkpoint="${index}"><small>${html(item.state)}</small><strong>${html(item.title)}</strong></div>`).join('');
      updateCoach();
    }

    function resetScenario() {
      clearInterval(replayTimer); replayTimer = null; visibleBars = 1; currentCheckpoint = 0;
      const button = panel('scenario').querySelector('#scenario-play'); if (button) button.textContent = 'Play live lesson';
      drawScenario(panel('scenario').querySelector('#scenario-chart'), scenario, visibleBars);
      const progress = panel('scenario').querySelector('#scenario-progress'); if (progress) progress.style.width = '1%';
      updateCoach();
    }

    function toggleReplay() {
      if (replayTimer) { clearInterval(replayTimer); replayTimer = null; panel('scenario').querySelector('#scenario-play').textContent = 'Resume live lesson'; return; }
      panel('scenario').querySelector('#scenario-play').textContent = 'Pause';
      replayTimer = setInterval(stepReplay, 280);
    }

    function stepReplay() {
      if (!scenario) return;
      visibleBars = Math.min(scenario.candles.length, visibleBars + 1);
      const nextCheckpoint = scenario.checkpoints[currentCheckpoint];
      if (nextCheckpoint && visibleBars - 1 >= nextCheckpoint.index) {
        clearInterval(replayTimer); replayTimer = null;
        panel('scenario').querySelector('#scenario-play').textContent = 'Continue';
        updateCoach();
        speak(`${nextCheckpoint.title}. ${nextCheckpoint.prompt}`, voiceEnabled);
      }
      drawScenario(panel('scenario').querySelector('#scenario-chart'), scenario, visibleBars);
      panel('scenario').querySelector('#scenario-progress').style.width = `${(visibleBars / scenario.candles.length) * 100}%`;
      if (visibleBars >= scenario.candles.length) { clearInterval(replayTimer); replayTimer = null; }
    }

    function updateCoach(feedback = '') {
      if (!scenario) return;
      const checkpoint = scenario.checkpoints[currentCheckpoint] || scenario.checkpoints.at(-1);
      const coach = panel('scenario').querySelector('#scenario-coach');
      coach.innerHTML = `<span class="eyebrow">${html(scenario.label)}</span><h3>${html(checkpoint.title)}</h3><p>${html(feedback || checkpoint.prompt)}</p><small class="muted">${html(scenario.coachNotes?.[2] || '')}</small>`;
      panel('scenario').querySelectorAll('[data-checkpoint]').forEach((node, index) => node.classList.toggle('current', index === currentCheckpoint));
    }

    async function gradeDecision(decision) {
      if (!scenario) return;
      const checkpoint = scenario.checkpoints[currentCheckpoint] || scenario.checkpoints.at(-1);
      const correct = decision === checkpoint.correctDecision;
      updateCoach(correct ? `Good process. “${decision}” matches the safest decision for this checkpoint. Explain the invalidation before moving on.` : `Not yet. “${decision}” adds more assumption than the visible evidence supports. The safer answer here is “${checkpoint.correctDecision}.”`);
      speak(correct ? 'Good process. Define your invalidation before moving on.' : `The safer answer is ${checkpoint.correctDecision}. Review the evidence and risk.`, voiceEnabled);
      if (correct) {
        currentCheckpoint = Math.min(scenario.checkpoints.length - 1, currentCheckpoint + 1);
        await api(`/api/v2/academy/lessons/df-sauce-${encodeURIComponent(scenario.id)}-${currentCheckpoint}/complete`, { method: 'POST', body: JSON.stringify({ score: 100 }) }).catch(() => null);
      }
    }

    async function loadWatchRoom() {
      const host = panel('watch');
      if (host.dataset.loaded === '1') return;
      const config = await api('/api/v2/academy/tradingview-config');
      host.dataset.loaded = '1';
      host.innerHTML = `<section class="card"><div class="card-head"><div><span class="eyebrow">TradingView Watch Room</span><h3>Study the live market with your private DF Sauce layout.</h3></div><a class="btn primary" href="/api/v2/academy/tradingview" target="_blank" rel="noopener">${config.privateChartConfigured ? 'Open private DF Sauce chart' : 'Open TradingView chart'}</a></div><iframe id="wisdo-tv" class="tv-frame" title="TradingView Watch Room" loading="lazy" src="${html(config.genericWatchRoomUrl)}"></iframe><div class="tv-status"><div><strong>${config.privateChartConfigured ? 'Private chart link configured' : 'Private chart link not configured yet'}</strong><p class="muted">${config.privateChartConfigured ? 'The private indicator remains hosted in your TradingView layout and is not sent to the WISDO browser.' : 'Set WISDO_DF_SAUCE_TRADINGVIEW_URL in Render to the saved TradingView layout where your private indicator is installed.'}</p></div><span class="status-pill ${config.privateChartConfigured ? 'connected' : 'waiting'}">${config.privateChartConfigured ? 'Protected' : 'Setup needed'}</span></div></section>`;
    }

    renderTutor();
    renderScenarioShell();
    loadPath().catch((error) => { panel('path').innerHTML = `<section class="card"><h3>Academy could not load</h3><p class="red">${html(error.message)}</p></section>`; });
    if (options.bot === 'df-sauce-final-ai') switchTab('scenario');
  }

  window.DFSauceAcademy = { mount };
})();
