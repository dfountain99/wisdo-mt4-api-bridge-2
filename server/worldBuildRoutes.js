import {
  WORLD_BUILD_ID,
  WORLD_CITY_ID,
  WORLD_OPERATOR_ASSET,
  WORLD_RENDERER,
  WORLD_VERSION,
} from '../public/app/world/world-build.js';

function cleanCommit(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return 'unknown';
  return /^[a-f0-9]{7,40}$/i.test(raw) ? raw.slice(0, 40) : 'unknown';
}

export function worldBuildSnapshot() {
  return Object.freeze({
    ok: true,
    worldVersion: WORLD_VERSION,
    buildId: WORLD_BUILD_ID,
    commit: cleanCommit(process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || process.env.SOURCE_VERSION),
    environment: String(process.env.NODE_ENV || 'development'),
    renderer: WORLD_RENDERER,
    city: WORLD_CITY_ID,
    operatorAsset: WORLD_OPERATOR_ASSET,
    executionFromVisualLayer: false,
  });
}

export function registerWorldBuildRoutes(app) {
  if (!app?.get) throw new TypeError('Express app is required.');
  app.get('/api/world/build', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(worldBuildSnapshot());
  });
  return { api: '/api/world/build', build: worldBuildSnapshot() };
}
