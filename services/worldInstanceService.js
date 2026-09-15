const CENTRAL_SCENE = 'central';
const HOME_SCENE = 'home';

function clean(value, max = 160) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function safeSlug(value, max = 80) {
  return clean(value, max).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max);
}

export function normalizeWorldScene(value = CENTRAL_SCENE) {
  const scene = safeSlug(value || CENTRAL_SCENE, 80);
  if (!scene || scene === CENTRAL_SCENE) return CENTRAL_SCENE;
  if (scene === HOME_SCENE) return HOME_SCENE;
  return scene;
}

export function resolveWorldInstance({ scene = CENTRAL_SCENE, userId = '', destinationId = '' } = {}) {
  const normalizedScene = normalizeWorldScene(scene || destinationId || CENTRAL_SCENE);
  const owner = clean(userId, 160);

  if (normalizedScene === HOME_SCENE) {
    if (!owner) throw new Error('userId is required for a private Smart Home instance.');
    return Object.freeze({
      scene: HOME_SCENE,
      worldId: 'wisdo.home',
      instanceId: `user.${owner}.home`,
      visibility: 'private',
      ownerUserId: owner,
      maxPlayers: 8,
      shared: false,
      topics: [`instance.user.${owner}.home`, `account.${owner}`, `user.${owner}`],
    });
  }

  if (normalizedScene === CENTRAL_SCENE) {
    return Object.freeze({
      scene: CENTRAL_SCENE,
      worldId: 'wisdo.central',
      instanceId: 'wisdo.central.1',
      visibility: 'members',
      ownerUserId: null,
      maxPlayers: 64,
      shared: true,
      topics: ['instance.wisdo.central.1', owner ? `account.${owner}` : '', owner ? `user.${owner}` : ''].filter(Boolean),
    });
  }

  const destination = safeSlug(destinationId || normalizedScene, 80) || 'interior';
  return Object.freeze({
    scene: destination,
    worldId: `wisdo.${destination}`,
    instanceId: `wisdo.${destination}.1`,
    visibility: 'members',
    ownerUserId: null,
    maxPlayers: 32,
    shared: true,
    topics: [`instance.wisdo.${destination}.1`, owner ? `account.${owner}` : '', owner ? `user.${owner}` : ''].filter(Boolean),
  });
}

export function worldRealtimeScopesForInstance(instance = {}) {
  const scopes = new Set(['world:events:read', 'world:presence:read', 'world:presence:write']);
  if (instance.ownerUserId) scopes.add('world:property:owner');
  return [...scopes];
}

export function publicWorldInstance(instance = {}) {
  return {
    scene: instance.scene,
    worldId: instance.worldId,
    instanceId: instance.instanceId,
    visibility: instance.visibility,
    maxPlayers: instance.maxPlayers,
    shared: Boolean(instance.shared),
  };
}
