const BUILD = 'WISDO-WORLD-MASTER-V1';
const MARKET_SCENES = new Set(['trading-tower', 'observatory', 'bot-arena']);

function currentScene() {
  return new URLSearchParams(location.search).get('scene') || 'central';
}

function closeWorldModal() {
  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  if (modal) modal.hidden = true;
  body?.replaceChildren?.();
}

function goldEntity(sceneId = 'trading-tower') {
  const district = sceneId === 'observatory'
    ? 'SIGNAL OBSERVATORY'
    : sceneId === 'bot-arena'
      ? 'BOT ARENA MARKET FLOOR'
      : 'COMMODITIES / TRADING TOWER';
  return {
    id: `merged-market:${sceneId}:XAUUSD`,
    kind: 'market-billboard',
    name: 'XAUUSD Live Market',
    short: 'LIVE MARKET',
    symbol: 'XAUUSD',
    district,
    anchorId: 'tower-market-01',
    unlocked: true,
    market: {
      symbol: 'XAUUSD',
      pinned: true,
      activeOperatorCount: 0,
      buyParticipants: 0,
      sellParticipants: 0,
      participants: [],
      currentPrice: null,
      instrumentMetadata: { digits: 2 },
    },
  };
}

function openMergedMarketTerminal(sceneId = currentScene()) {
  const terminal = globalThis.WisdoMarketTerminal;
  if (!terminal?.open) return false;
  closeWorldModal();
  terminal.open(goldEntity(sceneId));
  window.dispatchEvent(new CustomEvent('wisdo:merged-market-terminal-opened', {
    detail: { build: BUILD, sceneId, symbol: 'XAUUSD', source: 'world-interior' },
  }));
  return true;
}

function installBuildMarker() {
  const marker = document.querySelector('[data-world-build]');
  if (!marker) return;
  marker.dataset.worldBuild = BUILD;
  marker.textContent = `BUILD ${BUILD}`;
}

function installDiagnostics() {
  globalThis.WisdoWorldMerge = Object.freeze({
    build: BUILD,
    architecture: 'same-authority-fast-mode + persistent-world-mode + physical-interiors + authoritative-live-markets',
    visualArchitecture: 'production-city-core + world-master-production-layer',
    persistentMarkets: true,
    tradingViewTerminal: true,
    distinctInteriors: true,
    companionDashboard: true,
    worldDirector: 'v2',
    websiteRedirectsDefault: false,
    fastModeExplicitOnly: true,
    goldHeroMarket: 'XAUUSD',
    openGoldTerminal: () => openMergedMarketTerminal(currentScene()),
  });
}

window.addEventListener('wisdo:world-market-inspected', () => {
  const sceneId = currentScene();
  if (MARKET_SCENES.has(sceneId)) openMergedMarketTerminal(sceneId);
});

window.addEventListener('wisdo:world-interior-ready', (event) => {
  const sceneId = event.detail?.sceneId || currentScene();
  document.documentElement.dataset.wisdoInterior = sceneId;
  document.documentElement.dataset.wisdoWorldBuild = BUILD;
});

window.addEventListener('wisdo:world-destination-entered', (event) => {
  document.documentElement.dataset.wisdoDestination = event.detail?.id || '';
});

installBuildMarker();
installDiagnostics();
