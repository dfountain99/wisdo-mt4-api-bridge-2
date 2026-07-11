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
        <button class="btn" data-academy-tab="resources">Resource Center</button>
        <button class="btn" data-academy-tab="tools">Trading Tools</button>
        <button class="btn" data-academy-tab="live">Live Learning</button>
        <button class="btn" data-academy-tab="scenario">DF Sauce Scenario Lab</button>
        <button class="btn" data-academy-tab="watch">TradingView Watch Room</button>
      </nav>
      <div data-academy-panel="path"></div>
      <div data-academy-panel="catalog" hidden></div>
      <div data-academy-panel="tutor" hidden></div>
      <div data-academy-panel="resources" hidden></div>
      <div data-academy-panel="tools" hidden></div>
      <div data-academy-panel="live" hidden></div>
      <div data-academy-panel="scenario" hidden></div>
      <div data-academy-panel="watch" hidden></div>
    `;

    const panel = (name) => container.querySelector(`[data-academy-panel="${name}"]`);
    const showPanel = (name) => {
      container.querySelectorAll('[data-academy-panel]').forEach((node) => { node.hidden = node.dataset.academyPanel !== name; });
      container.querySelectorAll('[data-academy-tab]').forEach((button) => button.classList.toggle('active', button.dataset.academyTab === name));
    };
    const switchTab = async (name) => {
      showPanel(name);
      if (name === 'catalog') await loadCatalog();
      if (name === 'resources') await loadResources();
      if (name === 'tools') await loadTools();
      if (name === 'live') await loadLiveLearning();
      if (name === 'scenario') await loadScenario(container.querySelector('#scenario-select')?.value || 'bull-campaign');
      if (name === 'watch') await loadWatchRoom();
    };
    container.querySelectorAll('[data-academy-tab]').forEach((button) => { button.onclick = () => { switchTab(button.dataset.academyTab).catch((error) => console.warn('Academy tab failed', error)); }; });

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
        const submitButton = form.querySelector('button[type="submit"]');
        const originalLabel = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Building your first lesson…';
        try {
          const result = await api('/api/v2/academy/profile', { method: 'PATCH', body: JSON.stringify(values) });
          profile = result.profile;
          await loadPath();
          const firstCourseId = result.firstCourseId || result.path?.[0]?.id;
          if (firstCourseId) {
            showPanel('catalog');
            await openCourse(firstCourseId, { autoStarted: true });
          }
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = originalLabel;
        }
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

    async function openCourse(courseId, { autoStarted = false } = {}) {
      const result = await api(`/api/v2/academy/courses/${encodeURIComponent(courseId)}/session`);
      const course = result.course;
      const lesson = result.lesson;
      selectedCourseId = course.id;
      const host = panel('catalog');
      let sceneIndex = 0;
      let correctAnswers = 0;
      const answeredScenes = new Set();

      const multiline = (value) => html(value || '').replaceAll('\n', '<br>');
      const lessonScenes = lesson?.scenes || [];
      host.innerHTML = `
        <section class="card lesson-player">
          <div class="card-head">
            <div><span class="eyebrow">${html(course.category)} · ${html(course.levelTitle)}</span><h2>${html(course.title)}</h2></div>
            <button class="btn ghost" data-course-back>← Course universe</button>
          </div>
          ${autoStarted ? '<div class="form-status success">Your new learning path is ready. WISDO opened the first lesson automatically.</div>' : ''}
          <p class="lead">${html(course.summary)}</p>
          <div class="lesson-context-grid">
            <div><small>Experience</small><strong>${html(lesson?.learnerContext?.experience || profile.experience || 'starter')}</strong></div>
            <div><small>Markets</small><strong>${html(lesson?.learnerContext?.markets || 'multiple markets')}</strong></div>
            <div><small>Learning mode</small><strong>${html(lesson?.learnerContext?.learningStyle || profile.learningStyle || 'interactive')}</strong></div>
            <div><small>AI teaching</small><strong>${result.aiTutorReady ? 'Live model configured' : 'Adaptive WISDO tutor'}</strong></div>
          </div>
          <div class="lesson-progress-nav" data-lesson-progress></div>
          <div class="lesson-stage-grid">
            <article class="lesson-scene" data-lesson-scene></article>
            <aside class="lesson-coach">
              <span class="eyebrow">WISDO lesson coach</span>
              <h3>Ask about this exact step</h3>
              <p class="muted">The tutor uses your experience, goals, markets, current course, and selected account context.</p>
              <form data-scene-tutor>
                <textarea class="input" rows="5" name="message" placeholder="Explain this another way, give me a forex example, or quiz me one question at a time."></textarea>
                <button class="btn primary full" type="submit">Ask WISDO</button>
              </form>
              <div class="tutor-thread lesson-tutor-thread" data-scene-answer><div class="tutor-message assistant">Choose a lesson step, answer its checkpoint, or ask for a customized example.</div></div>
            </aside>
          </div>
          <div class="private-strategy-notice">${html(course.riskNotice)}</div>
          <div class="actions">
            <button class="btn ghost" data-scene-prev>← Previous</button>
            <button class="btn primary" data-scene-next>Next step →</button>
            <button class="btn primary" data-course-complete>Complete course</button>
          </div>
        </section>`;

      const sceneHost = host.querySelector('[data-lesson-scene]');
      const progressHost = host.querySelector('[data-lesson-progress]');
      const answerHost = host.querySelector('[data-scene-answer]');
      const previousButton = host.querySelector('[data-scene-prev]');
      const nextButton = host.querySelector('[data-scene-next]');
      const completeButton = host.querySelector('[data-course-complete]');

      function renderScene() {
        const scene = lessonScenes[sceneIndex];
        if (!scene) {
          sceneHost.innerHTML = '<h3>Lesson content is unavailable.</h3><p>Ask WISDO Tutor to rebuild this lesson.</p>';
          return;
        }
        progressHost.innerHTML = lessonScenes.map((item, index) => `<button class="lesson-step ${index === sceneIndex ? 'active' : ''} ${answeredScenes.has(index) ? 'complete' : ''}" data-scene-index="${index}"><span>${index + 1}</span><small>${html(item.title)}</small></button>`).join('');
        progressHost.querySelectorAll('[data-scene-index]').forEach((button) => { button.onclick = () => { sceneIndex = Number(button.dataset.sceneIndex); renderScene(); }; });
        const vocabulary = Array.isArray(scene.vocabulary) && scene.vocabulary.length
          ? `<div class="lesson-vocabulary">${scene.vocabulary.map((item) => `<div><strong>${html(item.term)}</strong><span>${html(item.meaning)}</span></div>`).join('')}</div>`
          : '';
        const checkpoint = scene.checkpoint || {};
        sceneHost.innerHTML = `
          <span class="eyebrow">Step ${sceneIndex + 1} of ${lessonScenes.length}</span>
          <h2>${html(scene.title)}</h2>
          <section class="lesson-explanation"><h3>Teach</h3><p>${multiline(scene.explanation)}</p></section>
          <section class="lesson-example"><h3>Worked example</h3><p>${multiline(scene.demonstration)}</p></section>
          ${vocabulary}
          <section class="lesson-activity"><h3>Your engagement</h3><p>${multiline(scene.activity)}</p><textarea class="input" rows="4" data-lesson-notes placeholder="Write your answer, rule, or observation before checking the knowledge question."></textarea></section>
          <section class="lesson-checkpoint"><span class="eyebrow">Knowledge checkpoint</span><h3>${html(checkpoint.question || 'Explain what you learned in your own words.')}</h3><div class="lesson-choices">${(checkpoint.choices || []).map((choice, index) => `<button class="btn ghost" data-checkpoint-choice="${index}">${html(choice)}</button>`).join('')}</div><div class="form-status" data-checkpoint-feedback>Choose the best answer.</div></section>`;
        sceneHost.querySelectorAll('[data-checkpoint-choice]').forEach((button) => {
          button.onclick = () => {
            const selected = Number(button.dataset.checkpointChoice);
            const correct = selected === Number(checkpoint.answer);
            const feedback = sceneHost.querySelector('[data-checkpoint-feedback]');
            sceneHost.querySelectorAll('[data-checkpoint-choice]').forEach((choiceButton) => { choiceButton.disabled = true; });
            if (correct) {
              if (!answeredScenes.has(sceneIndex)) correctAnswers += 1;
              answeredScenes.add(sceneIndex);
              feedback.className = 'form-status success';
              feedback.textContent = 'Correct. Explain why it is correct before advancing.';
            } else {
              feedback.className = 'form-status error';
              feedback.textContent = `Not yet. Review the worked example, then ask WISDO why “${checkpoint.choices?.[selected] || 'that answer'}” is unsafe or incomplete.`;
            }
            renderProgressOnly();
          };
        });
        previousButton.disabled = sceneIndex <= 0;
        nextButton.textContent = sceneIndex >= lessonScenes.length - 1 ? 'Review final challenge →' : 'Next step →';
      }

      function renderProgressOnly() {
        progressHost.querySelectorAll('[data-scene-index]').forEach((button) => {
          const index = Number(button.dataset.sceneIndex);
          button.classList.toggle('complete', answeredScenes.has(index));
        });
      }

      host.querySelector('[data-course-back]').onclick = () => loadCatalog();
      previousButton.onclick = () => { sceneIndex = Math.max(0, sceneIndex - 1); renderScene(); };
      nextButton.onclick = () => {
        if (sceneIndex < lessonScenes.length - 1) {
          sceneIndex += 1;
          renderScene();
          sceneHost.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        answerHost.innerHTML = `<div class="tutor-message assistant"><strong>Final challenge</strong>\n${html(lesson?.finalChallenge || 'Build a repeatable checklist and review it with WISDO.')}</div>`;
      };
      completeButton.onclick = async () => {
        const score = lessonScenes.length ? Math.round((correctAnswers / lessonScenes.length) * 100) : 100;
        await api(`/api/v2/academy/lessons/${encodeURIComponent(course.id)}/complete`, { method: 'POST', body: JSON.stringify({ score }) });
        completeButton.textContent = `Completed ✓ · ${score}%`;
        completeButton.disabled = true;
      };
      host.querySelector('[data-scene-tutor]').onsubmit = async (event) => {
        event.preventDefault();
        const form = event.target;
        const input = form.elements.message;
        const scene = lessonScenes[sceneIndex];
        const learnerText = input.value.trim();
        const notes = sceneHost.querySelector('[data-lesson-notes]')?.value.trim() || '';
        const message = learnerText || `Teach me step ${sceneIndex + 1}, “${scene?.title},” using a concrete ${lesson?.learnerContext?.markets || 'market'} example. Ask me one question before giving the answer.${notes ? ` My current notes are: ${notes}` : ''}`;
        if (!message) return;
        answerHost.insertAdjacentHTML('beforeend', `<div class="tutor-message user">${html(message)}</div>`);
        input.value = '';
        const pending = document.createElement('div');
        pending.className = 'tutor-message assistant';
        pending.textContent = 'WISDO is adapting the lesson to your profile…';
        answerHost.append(pending);
        answerHost.scrollTop = answerHost.scrollHeight;
        try {
          const tutorResult = await api(result.tutorEndpoint || '/api/v2/academy/tutor', { method: 'POST', body: JSON.stringify({ message, courseId: course.id, selectedAccountId: options.selectedAccountId || undefined }) }, 45000);
          pending.textContent = tutorResult.answer || 'No answer returned.';
          speak(tutorResult.answer, voiceEnabled);
        } catch (error) {
          pending.textContent = error.message;
        }
        answerHost.scrollTop = answerHost.scrollHeight;
      };
      renderScene();
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


    async function loadResources(page = 1, filters = {}) {
      const host = panel('resources');
      const queryParams = new URLSearchParams({ page: String(page), limit: '30', ...filters });
      const result = await api(`/api/v2/education/resources?${queryParams}`);
      host.innerHTML = `<section class="card"><div class="card-head"><div><span class="eyebrow">Resource Center</span><h3>Original study guides, checklists, worksheets, journals, flash cards, and cheat sheets.</h3></div><span class="status-pill connected">${Number(result.total || 0).toLocaleString()} resources</span></div><form id="resource-search" class="academy-filter"><input class="input" name="query" placeholder="Search liquidity, candlesticks, gold, margin…"><select class="input" name="type"><option value="">All types</option><option value="guide">Study guides</option><option value="checklist">Checklists</option><option value="worksheet">Worksheets</option><option value="flashcards">Flash cards</option><option value="journal">Journals</option><option value="cheat-sheet">Cheat sheets</option></select><select class="input" name="difficulty"><option value="">All levels</option><option value="starter">Starter</option><option value="foundation">Foundation</option><option value="intermediate">Intermediate</option></select><button class="btn primary">Search</button></form><div class="academy-course-grid" id="resource-grid">${(result.resources || []).map((item) => `<article class="course-tile"><span class="eyebrow">${html(item.type)}</span><h3>${html(item.title)}</h3><p>${html(item.description)}</p><div class="course-meta"><span>${html(item.difficulty)}</span><span>${Number(item.estimatedMinutes || 0)} min</span></div><button class="btn ghost" data-resource-bookmark="${html(item.id)}">${item.bookmarked ? 'Saved ✓' : 'Bookmark'}</button></article>`).join('')}</div></section>`;
      host.querySelector('#resource-search').onsubmit = async (event) => {
        event.preventDefault(); const values = Object.fromEntries(new FormData(event.target).entries()); const query = new URLSearchParams({ ...values, limit: '30' });
        await loadResources(1, values);
      };
      host.querySelectorAll('[data-resource-bookmark]').forEach((button) => { button.onclick = async () => { const enabled = !button.textContent.includes('Saved'); await api(`/api/v2/education/resources/${encodeURIComponent(button.dataset.resourceBookmark)}/bookmark`, { method: 'POST', body: JSON.stringify({ enabled }) }); button.textContent = enabled ? 'Saved ✓' : 'Bookmark'; }; });
    }

    const toolFields = {
      'position-size': [['accountBalance','Account balance'],['riskPercent','Risk %'],['stopDistance','Stop distance (pips/points)'],['valuePerPoint','Value per point per lot']],
      'risk-reward': [['entry','Entry'],['stop','Stop'],['target','Target']],
      margin: [['contractSize','Contract size'],['lots','Lots'],['price','Price'],['leverage','Leverage']],
      'pip-value': [['lots','Lots'],['valuePerLot','Value per pip/point at 1 lot']],
      'profit-loss': [['direction','Direction (buy/sell)'],['entry','Entry'],['exit','Exit'],['lots','Lots'],['contractSize','Contract size']],
      drawdown: [['peakEquity','Peak equity'],['currentEquity','Current equity']],
      compounding: [['principal','Starting amount'],['ratePercent','Rate % per period'],['periods','Periods'],['contribution','Contribution per period']],
      'risk-of-ruin': [['winRate','Win rate %'],['averageWin','Average win units'],['averageLoss','Average loss units'],['riskPercent','Risk % per trade']],
    };

    async function loadTools() {
      const host = panel('tools'); const result = await api('/api/v2/education/tools');
      host.innerHTML = `<section class="card"><div class="card-head"><div><span class="eyebrow">Trading Tools</span><h3>Practice the math before touching a live account.</h3></div></div><div class="academy-course-grid">${(result.tools || []).map((tool) => `<button class="course-tile" data-tool="${html(tool.id)}"><span class="eyebrow">Calculator</span><h3>${html(tool.title)}</h3><p>${html(tool.description)}</p></button>`).join('')}</div></section><section class="card" id="tool-workbench"><h3>Select a calculator.</h3><p class="muted">Every result is educational and must be checked against broker contract specifications.</p></section>`;
      host.querySelectorAll('[data-tool]').forEach((button) => { button.onclick = () => openTool(button.dataset.tool, result.tools.find((item) => item.id === button.dataset.tool)); });
    }

    function openTool(toolId, tool) {
      const workbench = panel('tools').querySelector('#tool-workbench'); const fields = toolFields[toolId] || [];
      workbench.innerHTML = `<span class="eyebrow">Interactive calculator</span><h3>${html(tool?.title || toolId)}</h3><p>${html(tool?.description || '')}</p><form id="tool-form" class="academy-profile-grid">${fields.map(([name,label]) => name === 'direction' ? `<label>${html(label)}<select class="input" name="direction"><option value="buy">Buy</option><option value="sell">Sell</option></select></label>` : `<label>${html(label)}<input class="input" name="${html(name)}" type="number" step="any" required></label>`).join('')}<button class="btn primary full">Calculate</button></form><pre id="tool-output" class="private-strategy-notice">Enter values to begin.</pre>`;
      workbench.querySelector('#tool-form').onsubmit = async (event) => { event.preventDefault(); const body = Object.fromEntries(new FormData(event.target).entries()); const result = await api(`/api/v2/education/tools/${encodeURIComponent(toolId)}/calculate`, { method: 'POST', body: JSON.stringify(body) }); workbench.querySelector('#tool-output').textContent = `${JSON.stringify(result.result, null, 2)}\n\n${result.notice}`; };
      workbench.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function loadLiveLearning() {
      const host = panel('live'); const result = await api('/api/v2/education/live-learning');
      host.innerHTML = `<section class="card"><div class="card-head"><div><span class="eyebrow">Live Learning</span><h3>Seminars, workshops, market breakdowns, and office hours.</h3></div><span class="status-pill ${result.providerReady ? 'connected' : 'waiting'}">${result.providerReady ? 'Provider connected' : 'Scheduling ready'}</span></div><div class="academy-course-grid">${(result.sessions || []).map((session) => `<article class="course-tile"><span class="eyebrow">${html(session.type)}</span><h3>${html(session.title)}</h3><p>${html(session.description)}</p><div class="course-meta"><span>${html(session.level)}</span><span>${Number(session.durationMinutes || 0)} min</span><span>${html(session.status)}</span></div>${result.providerUrl ? `<a class="btn primary" href="${html(result.providerUrl)}" target="_blank" rel="noopener">Open live room</a>` : '<button class="btn ghost" disabled>Provider setup required for live room</button>'}</article>`).join('')}</div></section>`;
    }

    renderTutor();
    renderScenarioShell();
    loadPath().catch((error) => { panel('path').innerHTML = `<section class="card"><h3>Academy could not load</h3><p class="red">${html(error.message)}</p></section>`; });
    if (options.bot === 'df-sauce-final-ai') switchTab('scenario');
  }

  window.DFSauceAcademy = { mount };
})();
