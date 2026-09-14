const BUILD = 'WISDO-WORLD-MASTER-V1';
const sideOrder = ['right', 'left', 'auto'];

function emit(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function installControls() {
  const actions = document.querySelector('.top-actions');
  if (!actions || actions.querySelector('[data-master-world-controls]')) return null;
  const wrap = document.createElement('span');
  wrap.dataset.masterWorldControls = '1';
  wrap.style.display = 'contents';

  const streamer = document.createElement('button');
  streamer.className = 'chip';
  streamer.type = 'button';
  streamer.title = 'Hide private financial context from WISDO World presentation';
  const readStreamer = () => localStorage.getItem('wisdo-streamer-mode') === '1';
  const paintStreamer = () => {
    const active = readStreamer();
    streamer.textContent = active ? 'Streamer ON' : 'Streamer';
    streamer.setAttribute('aria-pressed', active ? 'true' : 'false');
  };
  streamer.addEventListener('click', () => {
    const enabled = !readStreamer();
    try { localStorage.setItem('wisdo-streamer-mode', enabled ? '1' : '0'); } catch {}
    paintStreamer();
    emit('wisdo:streamer-mode', { enabled });
  });
  paintStreamer();

  const companion = document.createElement('button');
  companion.className = 'chip';
  companion.type = 'button';
  companion.title = 'Move your private spatial Companion Dashboard';
  const readSide = () => {
    const value = String(localStorage.getItem('wisdo-companion-side') || 'right').toLowerCase();
    return sideOrder.includes(value) ? value : 'right';
  };
  const paintSide = () => { companion.textContent = `Companion ${readSide().toUpperCase()}`; };
  companion.addEventListener('click', () => {
    const current = readSide();
    const side = sideOrder[(sideOrder.indexOf(current) + 1) % sideOrder.length];
    try { localStorage.setItem('wisdo-companion-side', side); } catch {}
    paintSide();
    emit('wisdo:companion-side', { side });
  });
  paintSide();

  wrap.append(streamer, companion);
  const fast = [...actions.children].find((node) => String(node.textContent || '').trim().toLowerCase() === 'fast mode');
  if (fast) actions.insertBefore(wrap, fast); else actions.appendChild(wrap);
  return wrap;
}

function replayAuthoritativeStateWhenReady() {
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    const snapshot = globalThis.WisdoWorldData?.snapshot;
    const presentationReady = Boolean(globalThis.WisdoWorldDirector && globalThis.WisdoWorldMasterProduction);
    if (snapshot && presentationReady) {
      clearInterval(timer);
      emit('wisdo:world.ready', { snapshot, replay: true, source: 'shared-world-data-bridge' });
      const enabled = localStorage.getItem('wisdo-streamer-mode') === '1';
      emit('wisdo:streamer-mode', { enabled });
      emit('wisdo:companion-side', { side: localStorage.getItem('wisdo-companion-side') || 'right' });
    } else if (attempts >= 120) clearInterval(timer);
  }, 250);
  return timer;
}

const controls = installControls();
const replayTimer = replayAuthoritativeStateWhenReady();
const marker = document.querySelector('[data-world-build]');
if (marker) { marker.dataset.worldBuild = BUILD; marker.textContent = `BUILD ${BUILD}`; }
document.documentElement.dataset.wisdoWorldBuild = BUILD;

globalThis.WisdoMasterWorldUi = Object.freeze({
  build: BUILD,
  setStreamerMode(enabled) { emit('wisdo:streamer-mode', { enabled: Boolean(enabled) }); },
  setCompanionSide(side) { if (sideOrder.includes(side)) emit('wisdo:companion-side', { side }); },
});

window.addEventListener('pagehide', () => {
  clearInterval(replayTimer);
  controls?.remove?.();
  delete globalThis.WisdoMasterWorldUi;
}, { once: true });
