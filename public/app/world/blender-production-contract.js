export const BLENDER_PRODUCTION_BUILD = 'WISDO-BLENDER-PRODUCTION-M1';

export const BLENDER_PRODUCTION_ASSETS = Object.freeze({
  operator: Object.freeze({
    assetId: 'wisdo-operator-v1',
    collection: 'players',
    slot: 'default',
    required: true,
    targetHeightMeters: 1.82,
  }),
  central: Object.freeze({
    assetId: 'wisdo-central-v1',
    collection: 'interiors',
    required: true,
    position: Object.freeze([0, 0, 68]),
    rotationY: 0,
  }),
  terminal: Object.freeze({
    assetId: 'wisdo-terminal-v1',
    collection: 'props',
    required: true,
    position: Object.freeze([0, 0, 65.4]),
    rotationY: 0,
  }),
});

export const BLENDER_NODE_CONVENTIONS = Object.freeze({
  interactionPrefix: 'INTERACT_',
  screenPrefix: 'SCREEN_',
  colliderPrefix: 'COLLIDER_',
  spawnPrefix: 'SPAWN_',
  lodPattern: '_LOD',
});

export const INTERACTION_DESTINATION_MAP = Object.freeze({
  TRADING_TOWER: Object.freeze({ destinationId: 'trading-tower' }),
  SMART_HOME: Object.freeze({ destinationId: 'private-rooms' }),
  VAULT: Object.freeze({ destinationId: 'vault' }),
  INTELLIGENCE: Object.freeze({ destinationId: 'coach-center' }),
  MARKET_ARCADE: Object.freeze({ destinationId: 'marketplace', semantic: 'market-arcade' }),
  REPORTER_COMMAND: Object.freeze({ destinationId: 'vps-forge', semantic: 'reporter-command' }),
  TERMINAL: Object.freeze({ semantic: 'terminal' }),
});

export const PRODUCTION_MOBILE_BUDGETS = Object.freeze({
  maxDevicePixelRatio: 1.5,
  targetMobileFps: 30,
  targetDesktopFps: 60,
  preferredOperatorTriangles: Object.freeze([25000, 50000]),
  preferredHeroNpcTriangles: Object.freeze([30000, 60000]),
  defaultTextureResolution: 2048,
  heroTextureResolutionMax: 4096,
  requireSimplifiedCollision: true,
  requireLod: true,
});

export function semanticFromNodeName(name = '') {
  const upper = String(name || '').toUpperCase();
  const marker = BLENDER_NODE_CONVENTIONS.interactionPrefix;
  const index = upper.indexOf(marker);
  if (index < 0) return null;
  return upper.slice(index + marker.length).replace(/_LOD\d+.*$/, '').replace(/[^A-Z0-9_].*$/, '');
}

export function productionAssetReadiness(generated = {}) {
  const players = generated.players || {};
  const interiors = generated.interiors || {};
  const props = generated.props || {};
  const operator = players.default || null;
  const central = interiors[BLENDER_PRODUCTION_ASSETS.central.assetId] || null;
  const terminal = props[BLENDER_PRODUCTION_ASSETS.terminal.assetId] || null;
  const ready = Boolean(operator && central && terminal);
  return Object.freeze({
    build: BLENDER_PRODUCTION_BUILD,
    ready,
    operator: Boolean(operator),
    central: Boolean(central),
    terminal: Boolean(terminal),
    missing: Object.freeze([
      !operator ? BLENDER_PRODUCTION_ASSETS.operator.assetId : null,
      !central ? BLENDER_PRODUCTION_ASSETS.central.assetId : null,
      !terminal ? BLENDER_PRODUCTION_ASSETS.terminal.assetId : null,
    ].filter(Boolean)),
  });
}
