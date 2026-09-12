const SCENES = Object.freeze({
  home: { id: 'home', name: 'Smart Home', type: 'home' },
  central: { id: 'central', name: 'WISDO Central', type: 'central' },
  'trading-tower': { id: 'trading-tower', name: 'Trading Tower', type: 'interior' },
  academy: { id: 'academy', name: 'WISDO Academy', type: 'interior' },
  vault: { id: 'vault', name: 'The Vault', type: 'interior' },
  'bot-arena': { id: 'bot-arena', name: 'Bot Arena', type: 'interior' },
  'switch-lab': { id: 'switch-lab', name: 'Switch Lab', type: 'interior' },
  'growth-chamber': { id: 'growth-chamber', name: 'Growth Chamber', type: 'interior' },
  'strategy-lab': { id: 'strategy-lab', name: 'Strategy Lab', type: 'interior' },
  'coach-center': { id: 'coach-center', name: 'Coach Center', type: 'interior' },
  'culture-arena': { id: 'culture-arena', name: 'Culture Arena', type: 'interior' },
  marketplace: { id: 'marketplace', name: 'Marketplace', type: 'interior' },
  'vps-forge': { id: 'vps-forge', name: 'VPS Forge', type: 'interior' },
  'private-rooms': { id: 'private-rooms', name: 'Private Rooms', type: 'interior' },
  'war-room': { id: 'war-room', name: 'War Room', type: 'interior' },
  observatory: { id: 'observatory', name: 'Signal Observatory', type: 'interior', parent: 'trading-tower' },
});

const ROUTE_TO_SCENE = Object.freeze({
  '/member/command-center': 'trading-tower',
  '/app/link-vault/analytics': 'trading-tower',
  '/member/education': 'academy',
  '/app/challenges': 'academy',
  '/member/bots': 'bot-arena',
  '/app/bot-arena/my-bots': 'vault',
  '/app/bot-arena/all-bots': 'bot-arena',
  '/member/wisdo': 'coach-center',
  '/app/feed': 'coach-center',
  '/member/accounts': 'growth-chamber',
  '/member/simulator': 'strategy-lab',
  '/app/growth-chamber/account-growth': 'growth-chamber',
  '/app/growth-chamber/milestones': 'strategy-lab',
  '/member/social': 'culture-arena',
  '/app/leaderboard': 'culture-arena',
  '/pricing': 'marketplace',
  '/app/vps-forge/servers': 'vps-forge',
  '/app/profile': 'private-rooms',
  '/member/admin-wisdo': 'war-room',
  '/war-room/overview': 'war-room',
});

export const WORLD_SCENES = SCENES;

export function isWorldScene(scene) {
  return Boolean(scene && SCENES[scene]);
}

export function sceneType(scene) {
  return SCENES[scene]?.type || null;
}

export function sceneForDestination(destination) {
  const id = typeof destination === 'string' ? destination : destination?.id;
  if (isWorldScene(id)) return id;
  const route = typeof destination === 'object' ? destination?.route : null;
  return ROUTE_TO_SCENE[route] || 'central';
}

export function sceneForLegacyRoute(route = '') {
  try {
    const url = new URL(route, location.origin);
    if (url.origin !== location.origin) return null;
    return ROUTE_TO_SCENE[url.pathname] || null;
  } catch {
    return ROUTE_TO_SCENE[String(route || '')] || null;
  }
}

export function worldUrlForScene(scene, { replace = false } = {}) {
  const safe = isWorldScene(scene) ? scene : 'central';
  const url = new URL(location.href);
  url.pathname = '/app/world';
  url.searchParams.set('scene', safe);
  if (replace) history.replaceState({ wisdoWorld: true, scene: safe }, '', url);
  else history.pushState({ wisdoWorld: true, scene: safe }, '', url);
  return url;
}

export function requestedWorldScene({ guest = false } = {}) {
  const requested = new URLSearchParams(location.search).get('scene');
  if (isWorldScene(requested)) {
    if (guest && requested === 'home') return 'central';
    return requested;
  }
  return guest ? 'central' : 'home';
}

export function fastModeRouteFor(destination) {
  return destination?.fastModeRoute || destination?.route || '/member/home';
}
