import { GLTF_LOADER_MODULE_URL } from './authored-asset-manifest.js';
import { GENERATED_WORLD_ASSETS } from './generated-asset-registry.js';
import { resolveNpcRuntime } from './npc-runtime-registry.js';
import { OG_MASTER_WISDO } from './og-master-wisdo-contract.js';

const DEFAULT_FETCH_TIMEOUT_MS = 45_000;
const DEFAULT_TARGET_HEIGHT_METERS = 1.84;
const NPC_CONTRACTS = Object.freeze([OG_MASTER_WISDO]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function freezeArray(values = []) {
  return Object.freeze(Array.from(values));
}

function validAnchor(value) {
  return Array.isArray(value)
    && value.length === 3
    && value.every((entry) => Number.isFinite(Number(entry)));
}

function normalizeClipMap(clips = {}) {
  const normalized = {};
  for (const [key, values] of Object.entries(clips || {})) {
    normalized[String(key)] = freezeArray((Array.isArray(values) ? values : [values])
      .map((value) => String(value || '').trim())
      .filter(Boolean));
  }
  return Object.freeze(normalized);
}

export function buildNpcVisualDescriptor(npc, runtime) {
  if (!npc || !runtime?.visualReady || !runtime.asset) return null;
  const anchor = npc.location?.centralWorldAnchor;
  if (!validAnchor(anchor)) return null;
  const asset = runtime.asset;
  if (String(asset.format || '').toLowerCase() !== 'glb' || !String(asset.url || '').trim()) return null;
  const targetHeightMeters = finite(asset.targetHeightMeters, DEFAULT_TARGET_HEIGHT_METERS);
  const interactionRadius = Math.max(1, finite(npc.location?.interactionRadius, 4.2));
  return Object.freeze({
    npcId: String(npc.npcId || runtime.assetId || ''),
    assetId: String(runtime.assetId || asset.id || ''),
    name: String(npc.name || runtime.assetId || 'WISDO NPC'),
    role: String(npc.role || ''),
    district: String(npc.district || ''),
    room: String(npc.room || ''),
    worldScene: String(npc.location?.worldScene || 'central'),
    position: Object.freeze(anchor.map((value) => Number(value))),
    interactionRadius,
    targetHeightMeters: targetHeightMeters > 0 ? targetHeightMeters : DEFAULT_TARGET_HEIGHT_METERS,
    rotationY: finite(asset.rotationY, 0),
    asset: Object.freeze({
      id: String(asset.id || runtime.assetId || ''),
      url: String(asset.url),
      reportUrl: asset.reportUrl ? String(asset.reportUrl) : null,
      format: 'glb',
      license: String(asset.license || 'UNSPECIFIED'),
      provenance: String(asset.provenance || ''),
      clips: normalizeClipMap(asset.clips),
    }),
  });
}

export function collectReadyNpcVisuals({ catalog = GENERATED_WORLD_ASSETS.npcs, contracts = NPC_CONTRACTS } = {}) {
  const descriptors = [];
  for (const npc of contracts || []) {
    const runtime = resolveNpcRuntime(npc, { catalog });
    const descriptor = buildNpcVisualDescriptor(npc, runtime);
    if (descriptor) descriptors.push(descriptor);
  }
  return Object.freeze(descriptors);
}

export function npcDistanceToPlayer(descriptor, player = {}) {
  if (!descriptor?.position) return Infinity;
  const x = finite(player.x, NaN);
  const z = finite(player.z, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return Infinity;
  return Math.hypot(x - descriptor.position[0], z - descriptor.position[2]);
}

export function resolveNearbyNpc(descriptors = [], player = {}) {
  let nearest = null;
  let distance = Infinity;
  for (const descriptor of descriptors || []) {
    const candidate = npcDistanceToPlayer(descriptor, player);
    if (candidate <= descriptor.interactionRadius && candidate < distance) {
      nearest = descriptor;
      distance = candidate;
    }
  }
  return nearest ? Object.freeze({ descriptor: nearest, distance }) : null;
}

function publishDiagnostics(instanceId, patch = {}) {
  if (instanceId && globalThis.WisdoWorldRenderInstance && globalThis.WisdoWorldRenderInstance !== instanceId) {
    return globalThis.WisdoNpcDiagnostics || {};
  }
  const previous = globalThis.WisdoNpcDiagnostics || {};
  const next = Object.freeze({
    ...previous,
    ...patch,
    instanceId: instanceId || previous.instanceId || null,
    updatedAt: new Date().toISOString(),
  });
  globalThis.WisdoNpcDiagnostics = next;
  try { globalThis.window?.dispatchEvent?.(new CustomEvent('wisdo:npc-diagnostics', { detail: next })); } catch {}
  return next;
}

async function fetchGlb(url, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'force-cache',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`NPC GLB HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    return Object.freeze({ buffer, bytes: buffer.byteLength, fetchMs: Math.round(performance.now() - startedAt) });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`NPC GLB fetch timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function parseGlb(GLTFLoader, buffer, url) {
  const loader = new GLTFLoader();
  const basePath = new URL('.', new URL(url, globalThis.location?.href || 'http://localhost/')).href;
  if (loader.parseAsync) return loader.parseAsync(buffer, basePath);
  return new Promise((resolve, reject) => loader.parse(buffer, basePath, resolve, reject));
}

function prepareModelMaterials(root) {
  root.traverse((object) => {
    if (!object.isMesh && !object.isSkinnedMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      if ('roughness' in material) material.roughness = clamp(finite(material.roughness, 0.48), 0.16, 0.9);
      if ('metalness' in material) material.metalness = clamp(finite(material.metalness, 0), 0, 1);
      if (material.map) material.map.anisotropy = Math.max(4, finite(material.map.anisotropy, 1));
      material.needsUpdate = true;
    }
  });
}

function normalizeModelScale(THREE, model, targetHeightMeters) {
  model.updateMatrixWorld(true);
  const initial = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  initial.getSize(size);
  if (!Number.isFinite(size.y) || size.y <= 0.001) throw new Error('NPC GLB has invalid vertical bounds.');
  const scale = targetHeightMeters / size.y;
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  finalBox.getCenter(center);
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= finalBox.min.y;
  model.updateMatrixWorld(true);
  return scale;
}

function clipByNames(clips, names = []) {
  for (const name of names || []) {
    const exact = clips.find((clip) => clip.name === name);
    if (exact) return exact;
    const insensitive = clips.find((clip) => String(clip.name || '').toLowerCase() === String(name).toLowerCase());
    if (insensitive) return insensitive;
  }
  return null;
}

function createAnimationController(THREE, gltf, descriptor) {
  const clips = Array.isArray(gltf.animations) ? gltf.animations : [];
  if (!clips.length) return Object.freeze({ clips: Object.freeze([]), update() {}, destroy() {} });
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const preferred = [
    ...(descriptor.asset.clips.seated || []),
    ...(descriptor.asset.clips.idle || []),
    'SEATED_IDLE',
    'IDLE',
    'Idle',
  ];
  const clip = clipByNames(clips, preferred) || clips[0];
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();
  return Object.freeze({
    clips: Object.freeze(clips.map((item) => item.name)),
    update(dt) { mixer.update(dt); },
    destroy() { mixer.stopAllAction(); },
  });
}

function disposeObject(root) {
  root?.traverse?.((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose?.();
      material.dispose?.();
    }
  });
}

async function loadNpcVisual({ THREE, scene, GLTFLoader, descriptor, instanceId }) {
  const download = await fetchGlb(descriptor.asset.url);
  if (instanceId && globalThis.WisdoWorldRenderInstance !== instanceId) throw new Error('World instance changed during NPC asset fetch.');
  const gltf = await parseGlb(GLTFLoader, download.buffer, descriptor.asset.url);
  if (!gltf?.scene) throw new Error(`${descriptor.assetId} GLB did not contain a scene.`);
  if (instanceId && globalThis.WisdoWorldRenderInstance !== instanceId) throw new Error('World instance changed during NPC asset parse.');
  const mount = new THREE.Group();
  mount.name = `WISDONPC:${descriptor.assetId}`;
  mount.userData.wisdoNpcId = descriptor.npcId;
  mount.userData.wisdoAssetId = descriptor.assetId;
  const model = gltf.scene;
  model.name = `${descriptor.assetId}:model`;
  prepareModelMaterials(model);
  const scale = normalizeModelScale(THREE, model, descriptor.targetHeightMeters);
  model.rotation.y = descriptor.rotationY;
  mount.add(model);
  mount.position.set(...descriptor.position);
  scene.add(mount);
  const animation = createAnimationController(THREE, gltf, descriptor);
  return { descriptor, mount, model, animation, scale, bytes: download.bytes, fetchMs: download.fetchMs };
}

export async function installWorldNpcVisuals({ THREE, scene, instanceId = null, catalog = GENERATED_WORLD_ASSETS.npcs, debug = false } = {}) {
  if (!THREE || !scene) throw new TypeError('WISDO NPC visual runtime requires the active Three.js scene.');
  const descriptors = collectReadyNpcVisuals({ catalog });
  if (!descriptors.length) {
    const diagnostics = publishDiagnostics(instanceId, {
      status: 'PENDING_ASSET',
      active: false,
      activeCount: 0,
      readyAssetIds: Object.freeze([]),
      pendingAssetIds: Object.freeze(NPC_CONTRACTS.map((npc) => String(npc.asset?.assetId || npc.npcId || '')).filter(Boolean)),
      reason: 'No validated generated NPC GLB is registered yet.',
    });
    return Object.freeze({ active: false, visuals: Object.freeze([]), diagnostics, destroy() {} });
  }

  publishDiagnostics(instanceId, {
    status: 'LOADING',
    active: false,
    activeCount: 0,
    readyAssetIds: Object.freeze(descriptors.map((descriptor) => descriptor.assetId)),
    pendingAssetIds: Object.freeze([]),
    reason: null,
  });

  let GLTFLoader;
  try {
    const imported = await import(GLTF_LOADER_MODULE_URL);
    GLTFLoader = imported.GLTFLoader;
    if (!GLTFLoader) throw new Error('GLTFLoader export missing.');
  } catch (error) {
    publishDiagnostics(instanceId, { status: 'LOADER_FAILED', active: false, reason: error?.message || String(error) });
    throw error;
  }

  const visuals = [];
  const failures = [];
  for (const descriptor of descriptors) {
    try {
      visuals.push(await loadNpcVisual({ THREE, scene, GLTFLoader, descriptor, instanceId }));
    } catch (error) {
      failures.push(Object.freeze({ assetId: descriptor.assetId, reason: error?.message || String(error) }));
      console.warn(`WISDO NPC asset ${descriptor.assetId} unavailable; visual spawn skipped.`, error);
    }
  }

  let destroyed = false;
  let frameId = 0;
  let lastFrame = performance.now();
  let nearbyAssetId = null;
  const onPlayerState = (event) => {
    if (destroyed) return;
    const available = visuals.map((item) => item.descriptor);
    const nearby = resolveNearbyNpc(available, event?.detail || {});
    const nextId = nearby?.descriptor?.assetId || null;
    if (nextId === nearbyAssetId) return;
    nearbyAssetId = nextId;
    const detail = Object.freeze({
      npcId: nearby?.descriptor?.npcId || null,
      assetId: nextId,
      name: nearby?.descriptor?.name || null,
      distance: nearby ? Number(nearby.distance.toFixed(2)) : null,
      interactionRadius: nearby?.descriptor?.interactionRadius || null,
    });
    publishDiagnostics(instanceId, { nearbyNpcId: detail.npcId, nearbyAssetId: detail.assetId, nearbyDistance: detail.distance });
    try { globalThis.window?.dispatchEvent?.(new CustomEvent('wisdo:npc-proximity', { detail })); } catch {}
  };

  function frame(now) {
    if (destroyed) return;
    frameId = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
    lastFrame = now;
    for (const visual of visuals) visual.animation.update(dt);
  }

  globalThis.window?.addEventListener?.('wisdo:world-player-state', onPlayerState);
  if (visuals.length) frameId = requestAnimationFrame(frame);

  const diagnostics = publishDiagnostics(instanceId, {
    status: visuals.length ? (failures.length ? 'DEGRADED' : 'ACTIVE') : 'FAILED',
    active: visuals.length > 0,
    activeCount: visuals.length,
    loaded: Object.freeze(visuals.map((visual) => Object.freeze({
      npcId: visual.descriptor.npcId,
      assetId: visual.descriptor.assetId,
      url: visual.descriptor.asset.url,
      scale: visual.scale,
      clips: visual.animation.clips,
      bytes: visual.bytes,
      fetchMs: visual.fetchMs,
    }))),
    failures: Object.freeze(failures),
    reason: visuals.length ? null : 'No generated NPC visual could be loaded.',
  });

  if (debug) console.debug('[WISDO NPC RUNTIME]', diagnostics);

  return Object.freeze({
    active: visuals.length > 0,
    visuals: Object.freeze(visuals.map((visual) => Object.freeze({ descriptor: visual.descriptor, mount: visual.mount }))),
    diagnostics,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frameId);
      globalThis.window?.removeEventListener?.('wisdo:world-player-state', onPlayerState);
      for (const visual of visuals) {
        visual.animation.destroy();
        scene.remove(visual.mount);
        disposeObject(visual.mount);
      }
      if (!instanceId || globalThis.WisdoWorldRenderInstance === instanceId) {
        publishDiagnostics(instanceId, { status: 'DESTROYED', active: false, activeCount: 0, nearbyNpcId: null, nearbyAssetId: null });
      }
    },
  });
}
