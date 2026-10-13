/* WISDO Robot Studio — navigation and progressive UX, browser-only. */
const createPanel = document.getElementById('builder-view');
const importPanel = document.getElementById('import-rebuild');
const hospitalPanel = document.getElementById('bot-hospital');
const flowPanel = document.getElementById('flow-builder');
const switcher = document.getElementById('mode-switch');
const tabs = Array.from(document.querySelectorAll('[data-studio-view]'));
const count = document.getElementById('studio-module-count');

const modeFromHash = () => location.hash === '#bot-hospital' ? 'hospital' : location.hash === '#import-rebuild' ? 'import' : location.hash === '#builder-view' ? 'builder' : 'flow';
function activate(mode, { navigate = false, focus = false } = {}) {
  const current = mode === 'import' ? 'import' : mode === 'hospital' && hospitalPanel ? 'hospital' : mode === 'flow' && flowPanel ? 'flow' : 'builder';
  createPanel.hidden = current !== 'builder';
  importPanel.hidden = current !== 'import';
  if (hospitalPanel) hospitalPanel.hidden = current !== 'hospital';
  if (flowPanel) flowPanel.hidden = current !== 'flow';
  for (const tab of tabs) {
    const selected = tab.dataset.studioView === current;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  if (navigate) {
    const hash = current === 'hospital' ? '#bot-hospital' : current === 'import' ? '#import-rebuild' : current === 'flow' ? '#flow-builder' : '#builder-view';
    if (location.hash !== hash) history.pushState({ robotStudioMode: current }, '', hash);
  }
  if (focus) {
    const selectedTab = tabs.find((x) => x.dataset.studioView === current);
    selectedTab?.focus({ preventScroll: true });
    switcher.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
for (const tab of tabs) {
  tab.addEventListener('click', () => activate(tab.dataset.studioView, { navigate: true, focus: false }));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? tabs.length - 1
      : (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    activate(tabs[next].dataset.studioView, { navigate: true, focus: true });
  });
}
for (const link of document.querySelectorAll('[data-studio-go="import"]')) {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    activate('import', { navigate: true, focus: true });
  });
}
document.getElementById('start-new')?.addEventListener('click', () => {
  activate('builder', { navigate: true, focus: false });
});
addEventListener('popstate', () => activate(modeFromHash()));
addEventListener('hashchange', () => activate(modeFromHash()));
activate(modeFromHash());

// Display observed strategy modules, never claim code compilation or account execution.
const graph = document.getElementById('flow-graph');
function updateModuleCount() {
  if (!graph || !count) return;
  count.textContent = String(graph.querySelectorAll('.node').length).padStart(2, '0');
  count.setAttribute('aria-label', count.textContent + ' visible source strategy blocks');
}
if (graph && count) {
  const observer = new MutationObserver(updateModuleCount);
  observer.observe(graph, { childList: true });
  updateModuleCount();
}
