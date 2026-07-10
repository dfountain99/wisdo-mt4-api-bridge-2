(() => {
  'use strict';

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value || 0)));
  const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));

  function ema(values, length) {
    const alpha = 2 / (length + 1);
    const out = [];
    let previous = Number(values[0] || 0);
    values.forEach((value, index) => {
      previous = index === 0 ? Number(value || 0) : (Number(value || 0) * alpha) + (previous * (1 - alpha));
      out.push(previous);
    });
    return out;
  }

  function seededCandles(kind = 'bull-launch', count = 180) {
    let seed = [...kind].reduce((sum, char) => sum + char.charCodeAt(0), 991);
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const rows = [];
    let close = kind.includes('bear') ? 2428 : 2310;
    for (let i = 0; i < count; i += 1) {
      const phase = i / count;
      let drift = 0;
      if (kind === 'bull-launch') drift = phase < .38 ? .08 : phase < .55 ? -.03 : phase < .72 ? .34 : .15;
      else if (kind === 'bear-hunt') drift = phase < .35 ? -.07 : phase < .52 ? .04 : phase < .74 ? -.32 : -.13;
      else if (kind === 'fakeout') drift = phase < .42 ? .08 : phase < .52 ? .72 : phase < .68 ? -.62 : -.08;
      else drift = Math.sin(i / 7) * .04;
      const noise = (random() - .5) * .72;
      const open = close;
      close = Math.max(20, open + drift + noise);
      const high = Math.max(open, close) + random() * .62;
      const low = Math.min(open, close) - random() * .62;
      rows.push({ open, high, low, close, time: i });
    }
    return rows;
  }

  function analyze(candles, index) {
    const visible = candles.slice(0, index + 1);
    const closes = visible.map((row) => row.close);
    const fast = ema(closes, 25);
    const mid = ema(closes, 50);
    const slow = ema(closes, 200);
    const last = visible.at(-1);
    const f = fast.at(-1); const m = mid.at(-1); const s = slow.at(-1);
    const bullBias = last.close > m && f > m && m > s;
    const bearBias = last.close < m && f < m && m < s;
    const pivotLen = 6;
    let lastHigh = null; let previousHigh = null; let lastLow = null; let previousLow = null;
    for (let i = pivotLen; i < visible.length - pivotLen; i += 1) {
      const window = visible.slice(i - pivotLen, i + pivotLen + 1);
      const high = Math.max(...window.map((row) => row.high));
      const low = Math.min(...window.map((row) => row.low));
      if (visible[i].high === high) { previousHigh = lastHigh; lastHigh = visible[i].high; }
      if (visible[i].low === low) { previousLow = lastLow; lastLow = visible[i].low; }
    }
    const highTag = lastHigh == null || previousHigh == null ? '' : (lastHigh > previousHigh ? 'HH' : 'LH');
    const lowTag = lastLow == null || previousLow == null ? '' : (lastLow >= previousLow ? 'HL' : 'LL');
    const bullStructure = ['', 'HH'].includes(highTag) && ['', 'HL'].includes(lowTag);
    const bearStructure = ['', 'LH'].includes(highTag) && ['', 'LL'].includes(lowTag);
    const previous = visible.at(-2) || last;
    const bullBos = lastHigh != null && previous.close <= lastHigh && last.close > lastHigh;
    const bearBos = lastLow != null && previous.close >= lastLow && last.close < lastLow;
    const buySetup = bullBias && bullStructure && bullBos && last.close > Math.max(f, m);
    const sellSetup = bearBias && bearStructure && bearBos && last.close < Math.min(f, m);
    const direction = buySetup || (bullBias && bullStructure) ? 1 : sellSetup || (bearBias && bearStructure) ? -1 : 0;
    const anchor = direction === 1 ? (lastLow ?? Math.min(...visible.map((row) => row.low))) : direction === -1 ? (lastHigh ?? Math.max(...visible.map((row) => row.high))) : last.close;
    const range = Math.abs(last.close - anchor);
    const hold = direction === 1 ? anchor + range * .9 : direction === -1 ? anchor - range * .9 : last.close;
    const target2 = direction === 1 ? anchor + range * 2 : direction === -1 ? anchor - range * 2 : null;
    const target3 = direction === 1 ? anchor + range * 3 : direction === -1 ? anchor - range * 3 : null;
    const launchConfirmed = direction === 1 ? last.close >= hold : direction === -1 ? last.close <= hold : false;
    const cloudBreak = direction === 1 ? last.close < Math.min(f, m) : direction === -1 ? last.close > Math.max(f, m) : false;
    return {
      fast, mid, slow, bullBias, bearBias, bullStructure, bearStructure, bullBos, bearBos,
      buySetup, sellSetup, direction, anchor, hold, target2, target3, launchConfirmed, cloudBreak,
      highTag, lowTag, character: direction === 1 ? (launchConfirmed ? 'BULL LAUNCH MODE' : 'BULL MARCH MODE') : direction === -1 ? (launchConfirmed ? 'BEAR LAUNCH MODE' : 'BEAR HUNT MODE') : 'SCOUT MODE',
    };
  }

  function drawChart(canvas, candles, index, analysis) {
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 900;
    const height = canvas.clientHeight || 420;
    canvas.width = width * ratio; canvas.height = height * ratio;
    const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio); ctx.clearRect(0, 0, width, height);
    const start = Math.max(0, index - 80); const rows = candles.slice(start, index + 1);
    const values = rows.flatMap((row) => [row.high, row.low]);
    const minimum = Math.min(...values) - 1; const maximum = Math.max(...values) + 1;
    const y = (price) => height - 25 - ((price - minimum) / Math.max(.0001, maximum - minimum)) * (height - 50);
    const step = width / Math.max(1, rows.length); const bodyWidth = Math.max(3, step * .55);
    ctx.strokeStyle = 'rgba(148,169,187,.12)'; ctx.lineWidth = 1;
    for (let grid = 1; grid < 6; grid += 1) { const gy = grid * height / 6; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke(); }
    rows.forEach((row, localIndex) => {
      const x = localIndex * step + step / 2; const up = row.close >= row.open;
      ctx.strokeStyle = up ? '#68f7c4' : '#ff6f82'; ctx.fillStyle = up ? '#68f7c4' : '#ff6f82';
      ctx.beginPath(); ctx.moveTo(x, y(row.high)); ctx.lineTo(x, y(row.low)); ctx.stroke();
      const top = y(Math.max(row.open, row.close)); const bottom = y(Math.min(row.open, row.close));
      ctx.fillRect(x - bodyWidth / 2, top, bodyWidth, Math.max(2, bottom - top));
    });
    const closes = candles.slice(0, index + 1).map((row) => row.close);
    const lines = [[ema(closes, 25), '#ffcc74'], [ema(closes, 50), '#59a8ff'], [ema(closes, 200), '#9b7bff']];
    lines.forEach(([series, color]) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
      series.slice(start).forEach((value, localIndex) => { const x = localIndex * step + step / 2; if (localIndex === 0) ctx.moveTo(x, y(value)); else ctx.lineTo(x, y(value)); }); ctx.stroke();
    });
    [[analysis.hold, '#68f7c4', '0.90 HOLD'], [analysis.target2, '#59a8ff', '2.0'], [analysis.target3, '#9b7bff', '3.0']].forEach(([price, color, label]) => {
      if (!Number.isFinite(price)) return; const lineY = y(price); ctx.setLineDash([8, 7]); ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(width, lineY); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = color; ctx.font = '12px system-ui'; ctx.fillText(label, 8, lineY - 5);
    });
  }

  function tradingViewUrl(symbol) {
    const safe = encodeURIComponent(symbol || 'OANDA:XAUUSD');
    return `https://s.tradingview.com/widgetembed/?frameElementId=wisdo-tv&symbol=${safe}&interval=15&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=0b1420&studies=[]&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&hideideas=1`;
  }

  async function completeLesson(lessonId, score) {
    try {
      await fetch(`/api/v2/academy/lessons/${encodeURIComponent(lessonId)}/complete`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ score }),
      });
    } catch {}
  }

  function mount(container, options = {}) {
    if (!container) return;
    const scenarioNames = { 'bull-launch': 'Bull Launch', 'bear-hunt': 'Bear Hunt', fakeout: 'Fakeout / Trap', range: 'Range / Scout' };
    container.innerHTML = `
      <section class="academy-hero card">
        <div><span class="eyebrow">DF Sauce Campaign Character</span><h1>Watch it form. Make the call. See the bot brain.</h1><p class="muted">Interactive training based on the supplied Pine v6 logic: EMA cloud, market structure, BOS, campaign anchors, scale-ins, 0.90 hold confirmation, fib targets, and cloud-break exits.</p><div class="actions"><button class="btn primary" data-academy-tab="replay">Chart Replay</button><button class="btn ghost" data-academy-tab="video">Interactive Video</button><button class="btn ghost" data-academy-tab="watch">TradingView Watch Room</button><button class="btn ghost" data-academy-tab="pine">Pine Lab</button></div></div>
        <div class="academy-score"><small>Lesson score</small><strong id="academy-score">0</strong><span>/100</span><p id="academy-badge">Scout Mode</p></div>
      </section>
      <section class="academy-panel" data-panel="replay">
        <div class="academy-replay-grid">
          <div class="card chart-card"><div class="academy-toolbar"><select class="input" id="scenario-select">${Object.entries(scenarioNames).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select><button class="btn primary" id="replay-play">Play</button><button class="btn ghost" id="replay-step">Step</button><button class="btn ghost" id="replay-reset">Reset</button><select class="input" id="replay-speed"><option value="650">1×</option><option value="320">2×</option><option value="150">4×</option></select></div><canvas id="df-chart"></canvas><div class="replay-progress"><span id="replay-progress"></span></div></div>
          <aside class="card bot-brain"><span class="eyebrow">Live lesson state</span><h3 id="character">SCOUT MODE</h3><div class="brain-grid"><div><small>Bias</small><strong id="bias">Neutral</strong></div><div><small>Structure</small><strong id="structure">Mixed</strong></div><div><small>BOS</small><strong id="bos">Waiting</strong></div><div><small>Launch hold</small><strong id="hold">Waiting</strong></div></div><div class="decision-box"><h3>Your decision</h3><p>What should the bot do at this candle?</p><div class="actions"><button class="btn decision" data-decision="buy">BUY</button><button class="btn decision" data-decision="sell">SELL</button><button class="btn decision" data-decision="wait">WAIT</button><button class="btn decision" data-decision="close">CLOSE</button></div><p id="decision-feedback" class="muted">Pause at any candle and make a decision.</p></div><div class="card mini"><h3>Campaign map</h3><p id="campaign-map">Waiting for structure.</p></div></aside>
        </div>
      </section>
      <section class="academy-panel" data-panel="video" hidden>
        <div class="academy-video-grid"><div class="card video-stage"><video id="lesson-video" controls muted playsinline preload="metadata"><source src="/media/14683743_3840_2160_30fps.mp4" type="video/mp4"></video><div id="video-prompt" class="video-prompt"><span class="eyebrow">Chapter 1</span><h3>Read the cloud before the signal.</h3><p>Fast above mid and mid above slow establishes bullish permission—not an automatic entry.</p></div></div><aside class="card"><h3>Interactive chapters</h3><button class="chapter active" data-time="0" data-title="Cloud permission">1. Trend / Cloud</button><button class="chapter" data-time="4" data-title="Structure tags">2. HH / HL / LH / LL</button><button class="chapter" data-time="8" data-title="Break of structure">3. BOS paired line</button><button class="chapter" data-time="12" data-title="Campaign anchor">4. Anchor and scale-in</button><button class="chapter" data-time="16" data-title="Launch confirmation">5. 0.90 hold and targets</button><button class="chapter" data-time="20" data-title="Cloud-break exit">6. Campaign over</button><div class="decision-box"><p id="video-question">Choose a chapter to begin.</p><button class="btn primary" id="video-check">Complete this checkpoint</button></div></aside></div>
      </section>
      <section class="academy-panel" data-panel="watch" hidden>
        <div class="card"><div class="academy-toolbar"><select class="input" id="tv-symbol"><option value="OANDA:XAUUSD">XAUUSD</option><option value="OANDA:EURUSD">EURUSD</option><option value="OANDA:GBPJPY">GBPJPY</option><option value="CAPITALCOM:US100">NAS100</option><option value="TVC:USOIL">USOIL</option></select><button class="btn primary" id="tv-load">Load chart</button><a class="btn ghost" href="https://www.tradingview.com/chart/" target="_blank" rel="noopener">Open TradingView</a></div><iframe id="wisdo-tv" class="tv-frame" title="TradingView Watch Room" loading="lazy"></iframe><p class="muted">Use the live chart for visual study. The Pine script runs in TradingView; WISDO’s simulator explains and rehearses the strategy state.</p></div>
      </section>
      <section class="academy-panel" data-panel="pine" hidden>
        <div class="grid2"><section class="card"><span class="eyebrow">Pine v6 explanation lab</span><h3>DF Sauce Campaign Character</h3><textarea id="pine-code" class="pine-code" spellcheck="false">Loading supplied Pine script…</textarea><div class="actions"><button class="btn primary" id="copy-pine">Copy script</button><a class="btn ghost" href="/academy/df-sauce-campaign-character.pine" download>Download .pine</a></div></section><aside class="card"><h3>Logic map</h3><ol class="lesson-map"><li><strong>Trend permission:</strong> EMA 25 / 50 / 200 alignment.</li><li><strong>Structure:</strong> pivot-based HH, HL, LH, LL.</li><li><strong>Trigger:</strong> valid BOS close outside the cloud.</li><li><strong>Campaign:</strong> first valid setup anchors; later setups scale.</li><li><strong>Launch:</strong> price holds the 0.90 level for the required bars.</li><li><strong>Targets:</strong> 2.0, 3.0, and extended campaign fibs.</li><li><strong>Exit:</strong> campaign ends on the configured cloud break.</li></ol><button class="btn primary" id="pine-complete">Mark Pine lesson complete</button></aside></div>
      </section>`;

    const panels = [...container.querySelectorAll('[data-panel]')];
    container.querySelectorAll('[data-academy-tab]').forEach((button) => button.addEventListener('click', () => {
      const target = button.dataset.academyTab;
      panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== target; });
      container.querySelectorAll('[data-academy-tab]').forEach((item) => item.classList.toggle('primary', item === button));
      if (target === 'watch') loadTv();
    }));

    let scenario = 'bull-launch'; let candles = seededCandles(scenario); let index = 45; let timer = null; let score = 0;
    const canvas = container.querySelector('#df-chart');
    const setScore = (next) => { score = clamp(next, 0, 100); container.querySelector('#academy-score').textContent = Math.round(score); container.querySelector('#academy-badge').textContent = score >= 85 ? 'Campaign Reader' : score >= 60 ? 'Structure Scout' : 'Scout Mode'; };
    const render = () => {
      const state = analyze(candles, index); drawChart(canvas, candles, index, state);
      container.querySelector('#character').textContent = state.character;
      container.querySelector('#bias').textContent = state.bullBias ? 'Bullish' : state.bearBias ? 'Bearish' : 'Neutral';
      container.querySelector('#structure').textContent = state.bullStructure ? `${state.highTag || 'HH'} / ${state.lowTag || 'HL'}` : state.bearStructure ? `${state.highTag || 'LH'} / ${state.lowTag || 'LL'}` : 'Mixed';
      container.querySelector('#bos').textContent = state.bullBos ? 'Bull BOS' : state.bearBos ? 'Bear BOS' : 'Waiting';
      container.querySelector('#hold').textContent = state.launchConfirmed ? 'Confirmed' : 'Not confirmed';
      container.querySelector('#campaign-map').textContent = state.direction === 0 ? 'Scout mode: wait for aligned bias, structure, and BOS.' : `${state.direction === 1 ? 'Buy' : 'Sell'} campaign · anchor ${state.anchor.toFixed(2)} · hold ${state.hold.toFixed(2)} · 2.0 ${state.target2.toFixed(2)} · 3.0 ${state.target3.toFixed(2)}.`;
      container.querySelector('#replay-progress').style.width = `${(index + 1) / candles.length * 100}%`;
      container.dataset.correctDecision = state.cloudBreak ? 'close' : state.buySetup ? 'buy' : state.sellSetup ? 'sell' : 'wait';
    };
    const stop = () => { if (timer) clearInterval(timer); timer = null; container.querySelector('#replay-play').textContent = 'Play'; };
    const play = () => { if (timer) return stop(); container.querySelector('#replay-play').textContent = 'Pause'; timer = setInterval(() => { if (index >= candles.length - 1) return stop(); index += 1; render(); }, Number(container.querySelector('#replay-speed').value)); };
    container.querySelector('#replay-play').onclick = play;
    container.querySelector('#replay-step').onclick = () => { stop(); index = Math.min(candles.length - 1, index + 1); render(); };
    container.querySelector('#replay-reset').onclick = () => { stop(); index = 45; setScore(0); render(); };
    container.querySelector('#replay-speed').onchange = () => { if (timer) { stop(); play(); } };
    container.querySelector('#scenario-select').onchange = (event) => { stop(); scenario = event.target.value; candles = seededCandles(scenario); index = 45; setScore(0); render(); };
    container.querySelectorAll('[data-decision]').forEach((button) => button.onclick = () => {
      const chosen = button.dataset.decision; const correct = container.dataset.correctDecision;
      const good = chosen === correct; setScore(score + (good ? 18 : -4));
      container.querySelector('#decision-feedback').textContent = good ? `Correct: ${correct.toUpperCase()} matches the current DF Sauce state.` : `Not yet. The current state calls for ${correct.toUpperCase()}. Recheck bias, structure, BOS, and cloud position.`;
      if (score >= 80) completeLesson('campaign-character', score);
    });
    window.addEventListener('resize', render);

    const video = container.querySelector('#lesson-video');
    const chapterText = {
      'Cloud permission': 'EMA alignment grants directional permission, but structure and BOS still have to prove the setup.',
      'Structure tags': 'HH/HL supports bull campaigns. LH/LL supports bear campaigns. Mixed structure stays in Scout Mode.',
      'Break of structure': 'A BOS candle must close beyond the paired pivot line. A wick alone is not enough.',
      'Campaign anchor': 'The first valid setup becomes the anchor. Additional valid setups in the same direction become scale-ins.',
      'Launch confirmation': 'The 0.90 hold level must survive the configured number of bars before Launch Mode is confirmed.',
      'Cloud-break exit': 'A close through the opposite edge of the cloud ends the active campaign when cloud-break exits are enabled.',
    };
    container.querySelectorAll('.chapter').forEach((button, chapterIndex) => button.onclick = () => {
      container.querySelectorAll('.chapter').forEach((item) => item.classList.toggle('active', item === button));
      video.currentTime = Number(button.dataset.time || 0); video.play().catch(() => {});
      container.querySelector('#video-prompt').innerHTML = `<span class="eyebrow">Chapter ${chapterIndex + 1}</span><h3>${button.dataset.title}</h3><p>${chapterText[button.dataset.title]}</p>`;
      container.querySelector('#video-question').textContent = `Checkpoint: explain ${button.dataset.title.toLowerCase()} before moving on.`;
    });
    container.querySelector('#video-check').onclick = () => { setScore(score + 12); completeLesson('df-sauce-video', score); container.querySelector('#video-question').textContent = 'Checkpoint recorded. Continue to the next chapter.'; };

    function loadTv() { const frame = container.querySelector('#wisdo-tv'); if (frame && !frame.src) frame.src = tradingViewUrl(container.querySelector('#tv-symbol').value); }
    container.querySelector('#tv-load').onclick = () => { container.querySelector('#wisdo-tv').src = tradingViewUrl(container.querySelector('#tv-symbol').value); };
    fetch('/academy/df-sauce-campaign-character.pine').then((response) => response.text()).then((text) => { container.querySelector('#pine-code').value = text; }).catch(() => { container.querySelector('#pine-code').value = 'The Pine lesson file could not be loaded.'; });
    container.querySelector('#copy-pine').onclick = () => navigator.clipboard?.writeText(container.querySelector('#pine-code').value);
    container.querySelector('#pine-complete').onclick = () => { setScore(Math.max(score, 85)); completeLesson('pine-explanation-lab', Math.max(score, 85)); };
    if (options.bot === 'df-sauce-final-ai') container.querySelector('[data-academy-tab="replay"]').click();
    render();
  }

  window.DFSauceAcademy = { mount };
})();
