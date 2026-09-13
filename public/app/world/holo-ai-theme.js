const ROOT_FLAG = 'wisdoHoloAiReady';
const MOBILE_QUERY = '(max-width: 760px)';
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
const VERSION = 'HOLO-AI-V6-STABLE';

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function q(id) { return document.getElementById(id); }
function text(id, fallback = '—') { return (q(id)?.textContent || fallback).trim(); }
function shown(el) { return Boolean(el && !el.hidden); }
function setText(id, value) {
  const el = q(id);
  if (el && el.textContent !== value) el.textContent = value;
}

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
  const stage = overlay.querySelector('.wisdo-command-stage');
  if (!stage) return;
  overlay.classList.add('wisdo-holo-ai');
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
  if (document.hidden) return;
  const frame = q('wisdoHoloFrame');
  if (!frame) return;
  const link = text('syncLabel', navigator.onLine ? 'ONLINE' : 'OFFLINE');
  const tier = text('tierBadge', 'MEMBER');
  const accounts = text('accountCount', '0');
  const reporters = text('onlineCount', '0');
  const sceneBuild = document.querySelector('[data-world-build]')?.textContent?.replace(/^BUILD\s+/i, '') || 'WORLD';

  setText('wisdoHoloLeftMain', navigator.onLine ? 'WORLD LINK // ONLINE' : 'WORLD LINK // DEGRADED');
  setText('wisdoHoloLeftSub', `${accounts} ACCT · ${reporters} REPORTER`);
  setText('wisdoHoloRightMain', tier);
  setText('wisdoHoloRightSub', sceneBuild);
  setText('wisdoHoloStatus', link.length > 34 ? `${link.slice(0, 31)}…` : link);

  const overlay = q('wisdoCommandOverlay');
  if (!overlay) return;
  makeCommandLayer(overlay);
  const commandLink = text('wcScopeLink', 'STANDBY');
  const symbol = text('wcScopeSymbol', '—');
  setText('wisdoCommandAiState', `${commandLink} // ${symbol}`);
  const shouldAlert = /DEGRADED|DISABLED|FAILED|ERROR/i.test(`${commandLink} ${text('wcReceipt', '')}`);
  if (overlay.classList.contains('wisdo-ai-alert') !== shouldAlert) overlay.classList.toggle('wisdo-ai-alert', shouldAlert);
}

function setupBootLanguage() {
  const eyebrow = document.querySelector('.loading-eyebrow');
  if (eyebrow && eyebrow.textContent !== 'CEM CULTURE // WISDO A.I.') eyebrow.textContent = 'CEM CULTURE // WISDO A.I.';
  const heading = document.querySelector('.loading-screen h1');
  if (heading && heading.textContent !== 'INITIALIZING WISDO CORE') heading.textContent = 'INITIALIZING WISDO CORE';
  const phase = q('loadingPhase');
  if (phase && /Initializing World/i.test(phase.textContent || '')) phase.textContent = 'Linking holographic systems';
}

function startHudCanvas(canvas, { command = false, overlay = null } = {}) {
  if (!canvas || canvas.dataset.running === '1') return;
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) return;
  canvas.dataset.running = '1';

  const reduced = window.matchMedia?.(REDUCED_QUERY)?.matches || false;
  const mobile = window.matchMedia?.(MOBILE_QUERY)?.matches || false;
  const fps = reduced ? 8 : mobile ? 18 : 30;
  const interval = 1000 / fps;
  const dprCap = mobile ? 1 : 1.35;
  const tickCount = mobile ? (command ? 36 : 24) : (command ? 72 : 48);
  let width = 1;
  let height = 1;
  let dpr = 1;
  let last = 0;
  const start = performance.now();

  function applySize(nextWidth, nextHeight) {
    width = Math.max(1, nextWidth || 1);
    height = Math.max(1, nextHeight || 1);
    dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const nextW = Math.max(1, Math.round(width * dpr));
    const nextH = Math.max(1, Math.round(height * dpr));
    if (canvas.width === nextW && canvas.height === nextH) return;
    canvas.width = nextW;
    canvas.height = nextH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    applySize(rect.width, rect.height);
  }

  const resizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (rect) applySize(rect.width, rect.height);
      })
    : null;
  resizeObserver?.observe(canvas);
  window.addEventListener('resize', resize, { passive: true });

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
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = `rgba(114,239,255,${major ? alpha : alpha * .45})`;
      ctx.lineWidth = major ? 1 : .7;
      ctx.stroke();
    }
    ctx.restore();
  }

  function brackets(cx, cy, size, alpha) {
    const l = size * .22;
    ctx.strokeStyle = `rgba(225,189,103,${alpha})`;
    ctx.lineWidth = 1;
    const corners = [
      [cx-size,cy-size,1,1],[cx+size,cy-size,-1,1],[cx-size,cy+size,1,-1],[cx+size,cy+size,-1,-1],
    ];
    for (const [x,y,sx,sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x + sx*l, y);
      ctx.lineTo(x,y);
      ctx.lineTo(x, y + sy*l);
      ctx.stroke();
    }
  }

  function draw(now) {
    requestAnimationFrame(draw);
    if (document.hidden || now - last < interval) return;
    if (command && !shown(overlay)) return;
    const commandOverlay = q('wisdoCommandOverlay');
    if (!command && commandOverlay && shown(commandOverlay)) return;
    last = now;
    if (width <= 1 || height <= 1) return;

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
    tickRing(cx, cy, base + 31, tickCount, t * .02, .22);
    brackets(cx, cy, base * .54, .22 + pulse * .1);

    if (command) {
      arc(cx, cy, base + 47, -t * .05, -t * .05 + .9, .23, 2, '31,204,230');
      arc(cx, cy, base + 47, -t * .05 + Math.PI, -t * .05 + Math.PI + .9, .18, 2, '225,189,103');
      const nodes = mobile ? 3 : 5;
      for (let i = 0; i < nodes; i += 1) {
        const a = t * (.09 + i * .008) + i * 1.19;
        const r = base + 34 + (i % 2) * 13;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, i === 0 ? 2.2 : 1.3, 0, Math.PI * 2);
        ctx.fillStyle = i % 3 === 0 ? 'rgba(225,189,103,.8)' : 'rgba(114,239,255,.72)';
        ctx.fill();
      }
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * .34);
    const grad = ctx.createLinearGradient(0, 0, base * 1.8, 0);
    grad.addColorStop(0, 'rgba(114,239,255,.03)');
    grad.addColorStop(1, 'rgba(114,239,255,.2)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(base * 1.7, 0);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  resize();
  requestAnimationFrame(draw);
}

function installCommandLayerWatcher() {
  const existing = q('wisdoCommandOverlay');
  if (existing) {
    makeCommandLayer(existing);
    return;
  }
  const root = document.body || document.documentElement;
  const observer = new MutationObserver(() => {
    const overlay = q('wisdoCommandOverlay');
    if (!overlay) return;
    observer.disconnect();
    makeCommandLayer(overlay);
    updateReadouts();
  });
  observer.observe(root, { childList: true, subtree: true });
}

function installEventReactions() {
  window.addEventListener('online', updateReadouts);
  window.addEventListener('offline', updateReadouts);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateReadouts(); });
  ['wisdo:world-interior-ready','wisdo:world-destination-entered','wisdo:merged-market-terminal-opened']
    .forEach((name) => window.addEventListener(name, updateReadouts));
  setInterval(updateReadouts, 5000);
}

function start() {
  if (document.documentElement.dataset[ROOT_FLAG] === '1') return;
  document.documentElement.dataset[ROOT_FLAG] = '1';
  document.documentElement.dataset.wisdoHoloAi = '1';
  setupBootLanguage();
  makeWorldLayer();
  installCommandLayerWatcher();
  installEventReactions();
  updateReadouts();
  globalThis.WisdoHoloAI = Object.freeze({ version: VERSION, refresh: updateReadouts });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
