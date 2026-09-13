const ROOT_FLAG = 'wisdoHoloAiReady';
const MOBILE_QUERY = '(max-width: 760px)';
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function q(id) { return document.getElementById(id); }
function text(id, fallback = '—') { return (q(id)?.textContent || fallback).trim(); }
function visible(el) { return Boolean(el && !el.hidden && el.getClientRects().length); }

function makeWorldLayer() {
  const stage = q('worldStage');
  if (!stage || q('wisdoHoloFrame')) return;
  const frame = document.createElement('div');
  frame.id = 'wisdoHoloFrame';
  frame.className = 'wisdo-holo-frame';
  frame.setAttribute('aria-hidden', 'true');
  frame.innerHTML = `
    <canvas id="wisdoHoloCanvas" class="wisdo-holo-canvas"></canvas>
    <div class="wisdo-holo-corners"></div>
    <div class="wisdo-holo-readout left"><span>WISDO A.I. CORE</span><strong id="wisdoHoloLeftMain">WORLD LINK</strong><em id="wisdoHoloLeftSub">INITIALIZING</em></div>
    <div class="wisdo-holo-readout right"><span>OPERATOR GRID</span><strong id="wisdoHoloRightMain">MEMBER</strong><em id="wisdoHoloRightSub">STANDBY</em></div>
    <div class="wisdo-holo-ai-status"><i></i><strong>WISDO INTELLIGENCE</strong><span id="wisdoHoloStatus">SYSTEMS NOMINAL</span></div>
    <div class="wisdo-holo-sector a">TACTICAL WORLD INTERFACE // LIVE</div>
    <div class="wisdo-holo-sector b">CONNECT // COPY // CONTROL</div>`;
  stage.appendChild(frame);
  startHudCanvas(q('wisdoHoloCanvas'), { command: false });
}

function makeCommandLayer(overlay) {
  if (!overlay || overlay.querySelector('.wisdo-command-ai-layer')) return;
  overlay.classList.add('wisdo-holo-ai');
  const stage = overlay.querySelector('.wisdo-command-stage');
  if (!stage) return;
  const layer = document.createElement('div');
  layer.className = 'wisdo-command-ai-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `
    <canvas class="wisdo-command-ai-canvas"></canvas>
    <div class="wisdo-command-ai-badge"><i></i><strong>WISDO A.I. CORE</strong><span id="wisdoCommandAiState">TACTICAL LINK ACTIVE</span></div>
    <div class="wisdo-command-ai-rail left"></div>
    <div class="wisdo-command-ai-rail right"></div>`;
  stage.appendChild(layer);
  startHudCanvas(layer.querySelector('canvas'), { command: true, overlay });
}

function updateReadouts() {
  const frame = q('wisdoHoloFrame');
  if (!frame) return;
  const link = text('syncLabel', navigator.onLine ? 'ONLINE' : 'OFFLINE');
  const tier = text('tierBadge', 'MEMBER');
  const accounts = text('accountCount', '0');
  const reporters = text('onlineCount', '0');
  const sceneBuild = document.querySelector('[data-world-build]')?.textContent?.replace(/^BUILD\s+/i, '') || 'WORLD';
  q('wisdoHoloLeftMain').textContent = navigator.onLine ? 'WORLD LINK // ONLINE' : 'WORLD LINK // DEGRADED';
  q('wisdoHoloLeftSub').textContent = `${accounts} ACCT · ${reporters} REPORTER`;
  q('wisdoHoloRightMain').textContent = tier;
  q('wisdoHoloRightSub').textContent = sceneBuild;
  q('wisdoHoloStatus').textContent = link.length > 34 ? `${link.slice(0, 31)}…` : link;

  const overlay = q('wisdoCommandOverlay');
  if (overlay) {
    makeCommandLayer(overlay);
    const stateEl = q('wisdoCommandAiState');
    if (stateEl) {
      const commandLink = text('wcScopeLink', 'STANDBY');
      const symbol = text('wcScopeSymbol', '—');
      stateEl.textContent = `${commandLink} // ${symbol}`;
    }
    overlay.classList.toggle('wisdo-ai-alert', /DEGRADED|DISABLED|FAILED|ERROR/i.test(text('wcScopeLink', '') + ' ' + text('wcReceipt', '')));
  }
}

function setupBootLanguage() {
  const eyebrow = document.querySelector('.loading-eyebrow');
  if (eyebrow) eyebrow.textContent = 'CEM CULTURE // WISDO A.I.';
  const heading = document.querySelector('.loading-screen h1');
  if (heading) heading.textContent = 'INITIALIZING WISDO CORE';
  const phase = q('loadingPhase');
  if (phase && /Initializing World/i.test(phase.textContent || '')) phase.textContent = 'Linking holographic systems';
}

function startHudCanvas(canvas, { command = false, overlay = null } = {}) {
  if (!canvas || canvas.dataset.running === '1') return;
  canvas.dataset.running = '1';
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  const reduced = window.matchMedia?.(REDUCED_QUERY)?.matches || false;
  const mobile = window.matchMedia?.(MOBILE_QUERY)?.matches || false;
  const fps = reduced ? 12 : mobile ? 24 : 36;
  const interval = 1000 / fps;
  let width = 1, height = 1, dpr = 1, last = 0, start = performance.now();

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.6);
    const nextW = Math.max(1, Math.round(width * dpr));
    const nextH = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW; canvas.height = nextH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function arc(cx, cy, radius, a0, a1, alpha, line = 1, color = '114,239,255') {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, a0, a1);
    ctx.strokeStyle = `rgba(${color},${alpha})`;
    ctx.lineWidth = line;
    ctx.stroke();
  }

  function tickRing(cx, cy, radius, count, phase, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(phase);
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      const major = i % 6 === 0;
      const len = major ? 7 : 3.5;
      const x0 = Math.cos(a) * (radius - len);
      const y0 = Math.sin(a) * (radius - len);
      const x1 = Math.cos(a) * radius;
      const y1 = Math.sin(a) * radius;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.strokeStyle = `rgba(114,239,255,${major ? alpha : alpha * .45})`;
      ctx.lineWidth = major ? 1 : .7; ctx.stroke();
    }
    ctx.restore();
  }

  function brackets(cx, cy, size, alpha) {
    const l = size * .22;
    ctx.strokeStyle = `rgba(225,189,103,${alpha})`; ctx.lineWidth = 1;
    const corners = [
      [cx-size,cy-size,1,1],[cx+size,cy-size,-1,1],[cx-size,cy+size,1,-1],[cx+size,cy+size,-1,-1],
    ];
    for (const [x,y,sx,sy] of corners) {
      ctx.beginPath(); ctx.moveTo(x + sx*l, y); ctx.lineTo(x,y); ctx.lineTo(x, y + sy*l); ctx.stroke();
    }
  }

  function draw(now) {
    requestAnimationFrame(draw);
    if (now - last < interval) return;
    last = now;
    if (command && overlay && !visible(overlay)) return;
    resize();
    ctx.clearRect(0, 0, width, height);
    const t = (now - start) / 1000;
    const cx = width * .5;
    const cy = height * (command ? .50 : .52);
    const base = clamp(Math.min(width, height) * (command ? .18 : .12), 46, command ? 170 : 120);
    const pulse = .5 + .5 * Math.sin(t * 1.5);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    arc(cx, cy, base, t * .16, t * .16 + Math.PI * 1.22, .22 + pulse * .08, 1.1);
    arc(cx, cy, base + 10, -t * .11 + .7, -t * .11 + 2.6, .34, 1.3, '225,189,103');
    arc(cx, cy, base + 22, t * .07 + 2.8, t * .07 + 5.55, .16, .8);
    tickRing(cx, cy, base + 31, command ? 72 : 48, t * .02, .22);
    brackets(cx, cy, base * .54, .22 + pulse * .1);

    if (command) {
      arc(cx, cy, base + 47, -t * .05, -t * .05 + .9, .23, 2, '31,204,230');
      arc(cx, cy, base + 47, -t * .05 + Math.PI, -t * .05 + Math.PI + .9, .18, 2, '225,189,103');
      for (let i = 0; i < 5; i += 1) {
        const a = t * (.09 + i * .008) + i * 1.19;
        const r = base + 34 + (i % 2) * 13;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        ctx.beginPath(); ctx.arc(x, y, i === 0 ? 2.2 : 1.3, 0, Math.PI * 2);
        ctx.fillStyle = i % 3 === 0 ? 'rgba(225,189,103,.8)' : 'rgba(114,239,255,.72)'; ctx.fill();
      }
    }

    const sweepA = t * .34;
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(sweepA);
    const grad = ctx.createLinearGradient(0,0,base*1.8,0);
    grad.addColorStop(0,'rgba(114,239,255,.03)'); grad.addColorStop(1,'rgba(114,239,255,.2)');
    ctx.strokeStyle = grad; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(base*1.7,0); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  resize();
  requestAnimationFrame(draw);
  window.addEventListener('resize', resize, { passive: true });
}

function installObserver() {
  const observer = new MutationObserver(() => {
    const overlay = q('wisdoCommandOverlay');
    if (overlay) makeCommandLayer(overlay);
    updateReadouts();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden','class'] });
}

function installEventReactions() {
  window.addEventListener('online', updateReadouts);
  window.addEventListener('offline', updateReadouts);
  ['wisdo:world-interior-ready','wisdo:world-destination-entered','wisdo:merged-market-terminal-opened'].forEach((name) => window.addEventListener(name, updateReadouts));
  setInterval(updateReadouts, 2400);
}

function start() {
  if (document.documentElement.dataset[ROOT_FLAG] === '1') return;
  document.documentElement.dataset[ROOT_FLAG] = '1';
  document.documentElement.dataset.wisdoHoloAi = '1';
  setupBootLanguage();
  makeWorldLayer();
  const overlay = q('wisdoCommandOverlay');
  if (overlay) makeCommandLayer(overlay);
  installObserver();
  installEventReactions();
  updateReadouts();
  globalThis.WisdoHoloAI = Object.freeze({ version: 'HOLO-AI-V5', refresh: updateReadouts });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
