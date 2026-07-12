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
    let webinarConfig = null;
    let webinarLibrary = [];
    let activeWebinarSession = null;
    let webinarSceneIndex = 0;
    let webinarTimer = null;
    let webinarPlaying = false;
    let webinarVoiceEnabled = true;
    let strategyStudioRows = [];

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
        <button class="btn" data-academy-tab="webinar">AI Webinar Room</button>
        ${bootstrap.canTeachStrategies ? '<button class="btn" data-academy-tab="studio">Strategy Studio</button>' : ''}
        <button class="btn" data-academy-tab="scenario">DF Sauce Scenario Lab</button>
        <button class="btn" data-academy-tab="watch">TradingView Watch Room</button>
      </nav>
      <div data-academy-panel="path"></div>
      <div data-academy-panel="catalog" hidden></div>
      <div data-academy-panel="tutor" hidden></div>
      <div data-academy-panel="resources" hidden></div>
      <div data-academy-panel="tools" hidden></div>
      <div data-academy-panel="webinar" hidden></div>
      <div data-academy-panel="studio" hidden></div>
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
      if (name === 'webinar') await loadAiWebinarRoom();
      if (name === 'studio') await loadStrategyStudio();
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

    async function loadAiWebinarRoom() {
      const host = panel('webinar');
      host.innerHTML = '<section class="card"><h3>Opening AI Webinar Room…</h3><p class="muted">Loading your lesson library and approved strategy knowledge.</p></section>';
      const [config, library] = await Promise.all([api('/api/v2/webinar-ai/config'), api('/api/v2/webinar-ai/library')]);
      webinarConfig = config;
      webinarLibrary = library.sessions || [];
      renderAiWebinarRoom();
    }

    function renderAiWebinarRoom() {
      const host = panel('webinar');
      const strategies = webinarConfig?.strategies || [];
      const templates = webinarConfig?.templates || [];
      host.innerHTML = `
        <style>
          .ai-webinar-stage{min-height:390px;border:1px solid rgba(104,247,196,.18);border-radius:22px;padding:28px;background:radial-gradient(circle at 80% 10%,rgba(89,168,255,.16),transparent 36%),linear-gradient(145deg,#07111d,#050910);display:grid;grid-template-columns:1.2fr .8fr;gap:24px;align-items:center;overflow:hidden;position:relative}
          .ai-webinar-stage:after{content:'WISDO AI VIDEO';position:absolute;right:18px;top:16px;font-size:10px;letter-spacing:.18em;color:rgba(255,255,255,.42)}
          .ai-webinar-visual{min-height:220px;border:1px solid rgba(255,255,255,.08);border-radius:18px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(104,247,196,.08),rgba(117,87,255,.12));font-size:72px}
          .ai-webinar-bullets{display:grid;gap:9px;margin-top:18px}.ai-webinar-bullets span{display:block;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.05)}
          .ai-webinar-timeline{height:8px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.ai-webinar-timeline span{display:block;height:100%;background:linear-gradient(90deg,#68f7c4,#59a8ff);transition:width .25s ease}
          .ai-webinar-library{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}.ai-webinar-form{display:grid;grid-template-columns:1fr 1fr;gap:14px}.ai-webinar-form .full{grid-column:1/-1}
          .strategy-studio-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:18px}.strategy-rule-list{display:grid;gap:7px}.strategy-rule-list span{font-size:12px;padding:8px;border-radius:10px;background:rgba(255,255,255,.05)}
          @media(max-width:820px){.ai-webinar-stage,.strategy-studio-grid{grid-template-columns:1fr}.ai-webinar-form{grid-template-columns:1fr}.ai-webinar-form .full{grid-column:auto}}
        </style>
        <section class="card academy-hero">
          <div><span class="eyebrow">On-demand AI Webinar Room</span><h1>Ask for a lesson. WISDO builds and teaches it.</h1><p class="muted">Generate a narrated AI video lesson from your question, the WISDO Academy, or an admin-published strategy. No scheduled host and no fake live webinar.</p></div>
          <div class="academy-score"><small>Teaching engine</small><strong>${webinarConfig?.aiProviderReady ? 'AI' : 'AUTO'}</strong><span>${webinarConfig?.aiProviderReady ? 'OpenAI connected' : 'adaptive lesson engine'}</span><p>Browser narration ready</p></div>
        </section>
        <section class="card">
          <div class="card-head"><div><span class="eyebrow">Generate your webinar</span><h3>What do you need help with?</h3></div><span class="status-pill connected">On demand</span></div>
          <form id="ai-webinar-form" class="ai-webinar-form">
            <label class="full">Question or problem<textarea class="input" name="question" rows="4" required placeholder="Example: Teach me how to identify a reversal, confirm it, define invalidation, and practice it safely."></textarea></label>
            <label>Topic<input class="input" name="topic" placeholder="Reversals, risk, copier setup, MT4 Reporter…"></label>
            <label>Experience<select class="input" name="level"><option value="starter">Starter</option><option value="foundation">Foundation</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="professional">Professional</option></select></label>
            <label>Length<select class="input" name="durationMinutes"><option value="5">5-minute lesson</option><option value="8" selected>8-minute lesson</option><option value="12">12-minute lesson</option><option value="15">15-minute lesson</option><option value="20">20-minute lesson</option></select></label>
            <label>Approved strategy<select class="input" name="strategyId"><option value="">General Academy knowledge</option>${strategies.map((strategy) => `<option value="${html(strategy.strategyId)}">${html(strategy.title)} · v${html(strategy.version)}</option>`).join('')}</select></label>
            <button class="btn primary full" type="submit">Generate AI Webinar</button>
          </form>
          <div id="ai-webinar-status" class="private-strategy-notice" style="margin-top:14px">WISDO will build scenes, narration, examples, risk warnings, and a quiz. Strategy lessons use published admin knowledge only.</div>
        </section>
        <section class="card"><div class="card-head"><div><span class="eyebrow">Fast starts</span><h3>Generate from a lesson template</h3></div></div><div class="academy-course-grid">${templates.map((item) => `<button class="course-tile" data-webinar-template="${html(item.id)}" data-title="${html(item.title)}" data-level="${html(item.level)}" data-minutes="${Number(item.durationMinutes || 8)}"><span class="eyebrow">${html(item.type)}</span><h3>${html(item.title)}</h3><p>${html(item.description)}</p><div class="course-meta"><span>${html(item.level)}</span><span>${Number(item.durationMinutes || 0)} min</span></div></button>`).join('')}</div></section>
        <section id="ai-webinar-player"></section>
        <section class="card"><div class="card-head"><div><span class="eyebrow">My webinar library</span><h3>Continue saved lessons</h3></div><button class="btn ghost" id="refresh-webinar-library">Refresh</button></div><div id="ai-webinar-library" class="ai-webinar-library">${renderWebinarLibraryCards()}</div></section>`;
      const form = host.querySelector('#ai-webinar-form');
      form.elements.level.value = profile.experience || 'starter';
      form.onsubmit = async (event) => {
        event.preventDefault();
        const status = host.querySelector('#ai-webinar-status');
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true; submit.textContent = 'Building scenes and narration…';
        status.textContent = 'WISDO is creating your personalized AI webinar.';
        try {
          const body = Object.fromEntries(new FormData(form).entries());
          const result = await api('/api/v2/webinar-ai/generate', { method: 'POST', body: JSON.stringify(body) }, 60000);
          webinarLibrary.unshift(result.session);
          status.textContent = `Ready: ${result.session.webinar.title}`;
          openWebinar(result.session);
          host.querySelector('#ai-webinar-library').innerHTML = renderWebinarLibraryCards();
          bindWebinarLibraryButtons();
        } catch (error) { status.textContent = error.message; }
        finally { submit.disabled = false; submit.textContent = 'Generate AI Webinar'; }
      };
      host.querySelectorAll('[data-webinar-template]').forEach((button) => {
        button.onclick = () => {
          form.elements.topic.value = button.dataset.title;
          form.elements.question.value = `Create an AI video lesson that teaches ${button.dataset.title} step by step, includes a worked example, risk warnings, common mistakes, and a knowledge check.`;
          form.elements.level.value = button.dataset.level || 'starter';
          form.elements.durationMinutes.value = button.dataset.minutes || '8';
          form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
      });
      host.querySelector('#refresh-webinar-library').onclick = async () => { const result = await api('/api/v2/webinar-ai/library'); webinarLibrary = result.sessions || []; renderAiWebinarRoom(); };
      bindWebinarLibraryButtons();
      if (activeWebinarSession) openWebinar(activeWebinarSession);
    }

    function renderWebinarLibraryCards() {
      if (!webinarLibrary.length) return '<article class="course-tile"><h3>No generated webinars yet</h3><p>Ask WISDO for the first lesson above.</p></article>';
      return webinarLibrary.slice(0, 24).map((session) => `<article class="course-tile"><span class="eyebrow">${html(session.provider || 'WISDO')}</span><h3>${html(session.webinar?.title || 'AI Webinar')}</h3><p>${html(session.webinar?.objective || '')}</p><div class="course-meta"><span>${html(session.webinar?.level || '')}</span><span>${Number(session.webinar?.estimatedMinutes || 0)} min</span><span>${session.progress?.completed ? 'Completed' : `Scene ${Number(session.progress?.sceneIndex || 0) + 1}`}</span></div><button class="btn primary" data-open-webinar="${html(session.sessionId)}">${session.progress?.completed ? 'Replay webinar' : 'Continue webinar'}</button></article>`).join('');
    }

    function bindWebinarLibraryButtons() {
      panel('webinar').querySelectorAll('[data-open-webinar]').forEach((button) => {
        button.onclick = async () => {
          const local = webinarLibrary.find((row) => row.sessionId === button.dataset.openWebinar);
          if (local) return openWebinar(local);
          const result = await api(`/api/v2/webinar-ai/sessions/${encodeURIComponent(button.dataset.openWebinar)}`);
          openWebinar(result.session);
        };
      });
    }

    function webinarVisualIcon(visual = '') {
      return ({ 'title-card': '✦', 'concept-map': '⌘', 'strategy-board': '⇄', 'chart-example': '⌁', 'risk-panel': '⚠', 'quiz-card': '?', 'summary-card': '✓' })[visual] || 'W';
    }

    function openWebinar(session) {
      stopWebinarPlayback();
      activeWebinarSession = session;
      webinarSceneIndex = Number(session.progress?.sceneIndex || 0);
      const player = panel('webinar').querySelector('#ai-webinar-player');
      if (!player) return;
      player.innerHTML = `
        <section class="card"><div class="card-head"><div><span class="eyebrow">Interactive narrated AI video</span><h3>${html(session.webinar?.title)}</h3><p class="muted">${html(session.webinar?.subtitle || '')}</p></div><label class="voice-toggle"><input id="webinar-voice" type="checkbox" checked> AI narration</label></div>
          <div class="ai-webinar-timeline"><span id="webinar-progress-bar"></span></div>
          <div id="webinar-scene-stage" style="margin-top:16px"></div>
          <div class="actions"><button class="btn ghost" id="webinar-prev">Previous</button><button class="btn primary" id="webinar-play">Play webinar</button><button class="btn ghost" id="webinar-next">Next</button>${webinarConfig?.externalVideoProviderReady ? '<button class="btn ghost" id="webinar-render-video">Render MP4</button>' : ''}</div>
          <div id="webinar-player-status" class="muted" style="margin-top:10px">Ready to play.</div>
        </section>
        <section class="grid2 app-panel-row"><div class="card" id="webinar-quiz"></div><div class="card"><span class="eyebrow">Ask about this lesson</span><h3>Follow-up with the AI teacher</h3><div id="webinar-questions" class="tutor-thread">${(session.questions || []).map((item) => `<div class="tutor-message user">${html(item.question)}</div><div class="tutor-message assistant">${html(item.answer)}</div>`).join('') || '<div class="tutor-message assistant">Ask for another example, a simpler explanation, or clarification of an approved rule.</div>'}</div><form id="webinar-question-form" class="tutor-compose"><textarea class="input" name="question" rows="3" required placeholder="Explain the invalidation rule with another example."></textarea><button class="btn primary">Ask teacher</button></form></div></section>`;
      player.querySelector('#webinar-prev').onclick = () => { stopWebinarPlayback(); webinarSceneIndex = Math.max(0, webinarSceneIndex - 1); renderWebinarScene(); };
      player.querySelector('#webinar-next').onclick = () => { stopWebinarPlayback(); advanceWebinarScene(false); };
      player.querySelector('#webinar-play').onclick = () => { webinarPlaying ? stopWebinarPlayback() : playWebinarScene(); };
      player.querySelector('#webinar-voice').onchange = (event) => { webinarVoiceEnabled = event.target.checked; if (!webinarVoiceEnabled && 'speechSynthesis' in window) speechSynthesis.cancel(); };
      const renderButton = player.querySelector('#webinar-render-video');
      if (renderButton) renderButton.onclick = async () => { renderButton.disabled = true; renderButton.textContent = 'Sending render…'; try { const result = await api(`/api/v2/webinar-ai/sessions/${encodeURIComponent(session.sessionId)}/render-video`, { method: 'POST', body: '{}' }, 60000); player.querySelector('#webinar-player-status').textContent = result.externalVideo?.url ? 'External video ready.' : 'External video render queued.'; } catch (error) { player.querySelector('#webinar-player-status').textContent = error.message; } finally { renderButton.disabled = false; renderButton.textContent = 'Render MP4'; } };
      player.querySelector('#webinar-question-form').onsubmit = async (event) => {
        event.preventDefault(); const form = event.target; const question = form.elements.question.value.trim(); if (!question) return;
        const thread = player.querySelector('#webinar-questions'); thread.insertAdjacentHTML('beforeend', `<div class="tutor-message user">${html(question)}</div><div class="tutor-message assistant" data-pending>WISDO is checking the lesson knowledge…</div>`); form.elements.question.value = '';
        try { const result = await api(`/api/v2/webinar-ai/sessions/${encodeURIComponent(session.sessionId)}/questions`, { method: 'POST', body: JSON.stringify({ question }) }, 45000); const pending = thread.querySelector('[data-pending]'); pending.removeAttribute('data-pending'); pending.textContent = result.question.answer; speak(result.question.answer, webinarVoiceEnabled); }
        catch (error) { const pending = thread.querySelector('[data-pending]'); if (pending) pending.textContent = error.message; }
        thread.scrollTop = thread.scrollHeight;
      };
      renderWebinarQuiz();
      renderWebinarScene();
      player.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderWebinarScene() {
      const session = activeWebinarSession; if (!session) return;
      const scenes = session.webinar?.scenes || [];
      webinarSceneIndex = Math.max(0, Math.min(scenes.length - 1, webinarSceneIndex));
      const scene = scenes[webinarSceneIndex];
      const player = panel('webinar').querySelector('#ai-webinar-player'); if (!scene || !player) return;
      const stage = player.querySelector('#webinar-scene-stage');
      stage.innerHTML = `<div class="ai-webinar-stage"><div><span class="eyebrow">Scene ${webinarSceneIndex + 1} of ${scenes.length}</span><h2>${html(scene.title)}</h2><p class="lead">${html(scene.narration)}</p><div class="ai-webinar-bullets">${(scene.bullets || []).map((bullet) => `<span>${html(bullet)}</span>`).join('')}</div></div><div class="ai-webinar-visual" aria-label="${html(scene.visual)}">${webinarVisualIcon(scene.visual)}</div></div>`;
      player.querySelector('#webinar-progress-bar').style.width = `${((webinarSceneIndex + 1) / Math.max(1, scenes.length)) * 100}%`;
      player.querySelector('#webinar-prev').disabled = webinarSceneIndex === 0;
      player.querySelector('#webinar-next').textContent = webinarSceneIndex >= scenes.length - 1 ? 'Finish lesson' : 'Next';
      api(`/api/v2/webinar-ai/sessions/${encodeURIComponent(session.sessionId)}/progress`, { method: 'PATCH', body: JSON.stringify({ sceneIndex: webinarSceneIndex }) }).catch(() => null);
    }

    function playWebinarScene() {
      const session = activeWebinarSession; if (!session) return;
      const scene = session.webinar?.scenes?.[webinarSceneIndex]; if (!scene) return;
      stopWebinarPlayback(false);
      webinarPlaying = true;
      const player = panel('webinar').querySelector('#ai-webinar-player');
      player.querySelector('#webinar-play').textContent = 'Pause webinar';
      player.querySelector('#webinar-player-status').textContent = `Playing scene ${webinarSceneIndex + 1}: ${scene.title}`;
      if (webinarVoiceEnabled && 'speechSynthesis' in window) {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`${scene.title}. ${scene.narration}. ${(scene.bullets || []).join('. ')}`.slice(0, 3500));
        utterance.rate = 0.94; utterance.pitch = 0.96;
        utterance.onend = () => { if (webinarPlaying) advanceWebinarScene(true); };
        utterance.onerror = () => { webinarTimer = setTimeout(() => advanceWebinarScene(true), 7000); };
        speechSynthesis.speak(utterance);
      } else {
        webinarTimer = setTimeout(() => advanceWebinarScene(true), Math.max(6000, Math.min(18000, Number(scene.durationSeconds || 45) * 250)));
      }
    }

    function stopWebinarPlayback(updateButton = true) {
      webinarPlaying = false;
      if (webinarTimer) { clearTimeout(webinarTimer); webinarTimer = null; }
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      const button = panel('webinar')?.querySelector('#webinar-play'); if (button && updateButton) button.textContent = 'Play webinar';
    }

    function advanceWebinarScene(autoPlay) {
      const session = activeWebinarSession; if (!session) return;
      const scenes = session.webinar?.scenes || [];
      if (webinarSceneIndex >= scenes.length - 1) {
        stopWebinarPlayback();
        api(`/api/v2/webinar-ai/sessions/${encodeURIComponent(session.sessionId)}/progress`, { method: 'PATCH', body: JSON.stringify({ sceneIndex: webinarSceneIndex, completed: true }) }).catch(() => null);
        const status = panel('webinar').querySelector('#webinar-player-status'); if (status) status.textContent = 'Lesson complete. Take the quiz and ask follow-up questions.';
        return;
      }
      webinarSceneIndex += 1;
      renderWebinarScene();
      if (autoPlay) playWebinarScene();
    }

    function renderWebinarQuiz() {
      const session = activeWebinarSession; if (!session) return;
      const quizHost = panel('webinar').querySelector('#webinar-quiz');
      const quiz = session.webinar?.quiz || [];
      quizHost.innerHTML = `<span class="eyebrow">Knowledge check</span><h3>Complete the webinar quiz</h3><form id="webinar-quiz-form">${quiz.map((item, index) => `<fieldset style="border:0;padding:12px 0"><legend><strong>${index + 1}. ${html(item.prompt)}</strong></legend>${(item.options || []).map((option, optionIndex) => `<label style="display:block;padding:7px"><input type="radio" name="${html(item.questionId)}" value="${optionIndex}" required> ${html(option)}</label>`).join('')}</fieldset>`).join('')}<button class="btn primary">Submit quiz</button></form><div id="webinar-quiz-result" class="muted" style="margin-top:10px">A score of 70% completes the lesson.</div>`;
      quizHost.querySelector('#webinar-quiz-form').onsubmit = async (event) => {
        event.preventDefault(); const answers = Object.fromEntries(new FormData(event.target).entries());
        const result = await api(`/api/v2/webinar-ai/sessions/${encodeURIComponent(session.sessionId)}/quiz`, { method: 'POST', body: JSON.stringify({ answers }) });
        quizHost.querySelector('#webinar-quiz-result').textContent = `${result.score}% · ${result.passed ? 'Passed — lesson completed.' : 'Review the scenes and try again.'}`;
      };
    }

    async function loadStrategyStudio() {
      const host = panel('studio');
      if (!bootstrap.canTeachStrategies) { host.innerHTML = '<section class="card"><h3>Admin access required</h3></section>'; return; }
      const result = await api('/api/v2/admin/webinar-ai/strategies');
      strategyStudioRows = result.strategies || [];
      renderStrategyStudio();
    }

    function renderStrategyStudio(editId = '') {
      const host = panel('studio');
      const editing = strategyStudioRows.find((row) => row.strategyId === editId) || null;
      const lines = (value) => html((value || []).join('\n'));
      host.innerHTML = `<section class="card academy-hero"><div><span class="eyebrow">Admin Strategy Teaching Studio</span><h1>Teach WISDO once. Let the AI teach approved lessons.</h1><p class="muted">Enter the strategy rules, invalidation, risk, examples, and FAQs. WISDO will not teach it to members until an admin publishes the version.</p></div><div class="academy-score"><small>Knowledge control</small><strong>${strategyStudioRows.length}</strong><span>strategy records</span><p>Versioned and approval-gated</p></div></section>
      <div class="strategy-studio-grid"><section class="card"><div class="card-head"><div><span class="eyebrow">${editing ? 'Edit strategy' : 'New strategy'}</span><h3>${editing ? html(editing.title) : 'Create teaching knowledge'}</h3></div>${editing ? '<button class="btn ghost" id="strategy-cancel-edit">Cancel</button>' : ''}</div><form id="strategy-studio-form" class="academy-profile-grid">
        <input type="hidden" name="strategyId" value="${html(editing?.strategyId || '')}"><label>Strategy title<input class="input" name="title" required value="${html(editing?.title || '')}"></label><label>Version<input class="input" name="version" value="${html(editing?.version || '1.0')}"></label><label>Level<select class="input" name="level"><option value="starter">Starter</option><option value="foundation">Foundation</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="professional">Professional</option></select></label><label>Markets<input class="input" name="markets" value="${html((editing?.markets || []).join(', '))}" placeholder="Gold, forex"></label>
        <label class="full">Summary<textarea class="input" name="summary" rows="3" required>${html(editing?.summary || '')}</textarea></label><label class="full">Market conditions — one per line<textarea class="input" name="marketConditions" rows="4">${lines(editing?.marketConditions)}</textarea></label><label class="full">Entry rules — one per line<textarea class="input" name="entryRules" rows="5">${lines(editing?.entryRules)}</textarea></label><label class="full">Confirmation rules — one per line<textarea class="input" name="confirmationRules" rows="4">${lines(editing?.confirmationRules)}</textarea></label><label class="full">Exit rules — one per line<textarea class="input" name="exitRules" rows="4">${lines(editing?.exitRules)}</textarea></label><label class="full">Invalidation rules — required before publish<textarea class="input" name="invalidationRules" rows="4">${lines(editing?.invalidationRules)}</textarea></label><label class="full">Risk rules — one per line<textarea class="input" name="riskRules" rows="4">${lines(editing?.riskRules)}</textarea></label><label class="full">Common mistakes — one per line<textarea class="input" name="commonMistakes" rows="4">${lines(editing?.commonMistakes)}</textarea></label><label class="full">Examples — one per line<textarea class="input" name="examples" rows="5">${lines(editing?.examples)}</textarea></label><label class="full">FAQ / extra teaching notes<textarea class="input" name="faq" rows="4">${lines(editing?.faq)}</textarea></label><label class="full">Source notes kept in admin knowledge<textarea class="input" name="sourceNotes" rows="5">${html(editing?.sourceNotes || '')}</textarea></label><button class="btn primary full" type="submit">${editing ? 'Save strategy update' : 'Create strategy draft'}</button></form><div id="strategy-studio-status" class="private-strategy-notice" style="margin-top:14px">Drafts are private. Publish only after the rules are complete and reviewed.</div></section>
        <aside class="card"><span class="eyebrow">Strategy library</span><h3>Draft, review, and publish</h3><div class="path-list">${strategyStudioRows.map((row) => `<article class="path-item"><small>${html(row.status)} · v${html(row.version)}</small><strong>${html(row.title)}</strong><p class="muted">${html(row.summary || 'No summary yet.')}</p><div class="strategy-rule-list"><span>${(row.entryRules || []).length} entry rules</span><span>${(row.invalidationRules || []).length} invalidation rules</span><span>${(row.riskRules || []).length} risk rules</span></div><div class="actions"><button class="btn ghost" data-edit-strategy="${html(row.strategyId)}">Edit</button>${row.status === 'published' ? `<button class="btn primary" data-generate-strategy="${html(row.strategyId)}">Generate member lesson</button>` : `<button class="btn primary" data-publish-strategy="${html(row.strategyId)}">Publish version</button>`}</div></article>`).join('') || '<p class="muted">No strategy drafts yet.</p>'}</div></aside></div>`;
      const form = host.querySelector('#strategy-studio-form'); form.elements.level.value = editing?.level || 'foundation';
      form.onsubmit = async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(form).entries()); const status = host.querySelector('#strategy-studio-status'); try { const isEdit = Boolean(values.strategyId); const path = isEdit ? `/api/v2/admin/webinar-ai/strategies/${encodeURIComponent(values.strategyId)}` : '/api/v2/admin/webinar-ai/strategies'; const method = isEdit ? 'PATCH' : 'POST'; const result = await api(path, { method, body: JSON.stringify(values) }); const index = strategyStudioRows.findIndex((row) => row.strategyId === result.strategy.strategyId); if (index >= 0) strategyStudioRows[index] = result.strategy; else strategyStudioRows.unshift(result.strategy); status.textContent = `${result.strategy.title} saved as ${result.strategy.status}.`; renderStrategyStudio(result.strategy.strategyId); } catch (error) { status.textContent = error.message; } };
      const cancel = host.querySelector('#strategy-cancel-edit'); if (cancel) cancel.onclick = () => renderStrategyStudio();
      host.querySelectorAll('[data-edit-strategy]').forEach((button) => button.onclick = () => renderStrategyStudio(button.dataset.editStrategy));
      host.querySelectorAll('[data-publish-strategy]').forEach((button) => button.onclick = async () => { button.disabled = true; try { const result = await api(`/api/v2/admin/webinar-ai/strategies/${encodeURIComponent(button.dataset.publishStrategy)}/publish`, { method: 'POST', body: '{}' }); const index = strategyStudioRows.findIndex((row) => row.strategyId === result.strategy.strategyId); if (index >= 0) strategyStudioRows[index] = result.strategy; renderStrategyStudio(result.strategy.strategyId); } catch (error) { alert(error.message); button.disabled = false; } });
      host.querySelectorAll('[data-generate-strategy]').forEach((button) => button.onclick = () => { switchTab('webinar').then(() => { const webinarForm = panel('webinar').querySelector('#ai-webinar-form'); webinarForm.elements.strategyId.value = button.dataset.generateStrategy; webinarForm.elements.question.value = 'Create a complete AI video lesson that teaches this approved strategy, including conditions, confirmations, entries, exits, invalidation, risk, common mistakes, a worked example, and a quiz.'; webinarForm.scrollIntoView({ behavior: 'smooth' }); }); });
    }

    renderTutor();
    renderScenarioShell();
    loadPath().catch((error) => { panel('path').innerHTML = `<section class="card"><h3>Academy could not load</h3><p class="red">${html(error.message)}</p></section>`; });
    if (location.hash === '#ai-webinar-room') switchTab('webinar');
    else if (options.bot === 'df-sauce-final-ai') switchTab('scenario');
  }

  window.DFSauceAcademy = { mount };
})();
