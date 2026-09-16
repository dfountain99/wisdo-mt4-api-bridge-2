import { GLTF_LOADER_MODULE_URL } from './authored-asset-manifest.js';
import { GENERATED_WORLD_ASSETS } from './generated-asset-registry.js';
import {
  BLENDER_PRODUCTION_ASSETS,
  BLENDER_PRODUCTION_BUILD,
  BLENDER_NODE_CONVENTIONS,
  INTERACTION_DESTINATION_MAP,
  productionAssetReadiness,
  semanticFromNodeName,
} from './blender-production-contract.js';

const INTERACTION_RADIUS = 3.3;
const FETCH_TIMEOUT_MS = 45_000;
const EDITABLE = 'input,textarea,select,[contenteditable="true"]';

function finite(value, fallback = 0) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }
function qualityLevel(name = '') { return name === 'low' ? 2 : name === 'medium' ? 1 : 0; }

function publish(patch = {}) {
  const previous = globalThis.WisdoProductionAssetDiagnostics || {};
  const next = Object.freeze({ ...previous, ...patch, build: BLENDER_PRODUCTION_BUILD, updatedAt: new Date().toISOString() });
  globalThis.WisdoProductionAssetDiagnostics = next;
  try { window.dispatchEvent(new CustomEvent('wisdo:production-asset-diagnostics', { detail: next })); } catch {}
  return next;
}

async function fetchGlb(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'force-cache', signal: controller.signal });
    if (!response.ok) throw new Error(`Production GLB HTTP ${response.status}`);
    return await response.arrayBuffer();
  } finally { clearTimeout(timer); }
}

async function parseGlb(GLTFLoader, buffer, url) {
  const loader = new GLTFLoader();
  const basePath = new URL('.', new URL(url, location.href)).href;
  return loader.parseAsync ? loader.parseAsync(buffer, basePath) : new Promise((resolve, reject) => loader.parse(buffer, basePath, resolve, reject));
}

function configureMaterials(root, renderer) {
  const maxAnisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 4);
  root.traverse((object) => {
    if (!object.isMesh && !object.isSkinnedMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      if (!material) continue;
      if (material.map) material.map.anisotropy = maxAnisotropy;
      if (material.normalMap) material.normalMap.anisotropy = maxAnisotropy;
      if ('envMapIntensity' in material) material.envMapIntensity = Math.max(0.75, finite(material.envMapIntensity, 1));
      material.needsUpdate = true;
    }
  });
}

function baseLodName(name = '') { return String(name).replace(/_LOD\d+.*$/i, ''); }
function applyStaticLodPolicy(root, qualityName) {
  const level = qualityLevel(qualityName);
  const groups = new Map();
  root.traverse((object) => {
    if (!object.isMesh) return;
    const base = baseLodName(object.name);
    if (!groups.has(base)) groups.set(base, []);
    const match = String(object.name).match(/_LOD(\d+)/i);
    groups.get(base).push({ object, level: match ? Number(match[1]) : 0 });
  });
  for (const variants of groups.values()) {
    if (variants.length < 2) continue;
    const levels = [...new Set(variants.map((item) => item.level))].sort((a, b) => a - b);
    const chosen = levels.reduce((best, candidate) => Math.abs(candidate - level) < Math.abs(best - level) ? candidate : best, levels[0]);
    for (const item of variants) item.object.visible = item.level === chosen;
  }
}

function extractSemanticNodes(THREE, root) {
  const interactions = [];
  const screens = [];
  const colliders = [];
  const spawns = [];
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    const upper = String(object.name || '').toUpperCase();
    const semantic = semanticFromNodeName(upper);
    if (semantic) {
      const point = new THREE.Vector3(); object.getWorldPosition(point);
      interactions.push(Object.freeze({ semantic, object, point }));
      object.visible = false;
    }
    if (upper.includes(BLENDER_NODE_CONVENTIONS.screenPrefix)) screens.push(object);
    if (upper.includes(BLENDER_NODE_CONVENTIONS.colliderPrefix) || upper.startsWith('UCX_') || upper.includes('_UCX_')) {
      const box = new THREE.Box3().setFromObject(object);
      if (!box.isEmpty()) colliders.push(box);
      object.visible = false;
    }
    if (upper.includes(BLENDER_NODE_CONVENTIONS.spawnPrefix)) {
      const point = new THREE.Vector3(); object.getWorldPosition(point);
      spawns.push(Object.freeze({ name: object.name, point }));
      object.visible = false;
    }
  });
  return Object.freeze({ interactions: Object.freeze(interactions), screens: Object.freeze(screens), colliders: Object.freeze(colliders), spawns: Object.freeze(spawns) });
}

function disposeRoot(root) {
  root?.traverse?.((object) => {
    object.geometry?.dispose?.();
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose?.();
      material.dispose?.();
    }
  });
}

async function loadAsset({ THREE, GLTFLoader, scene, renderer, asset, contract, quality }) {
  if (!asset?.url) return null;
  const buffer = await fetchGlb(asset.url);
  const gltf = await parseGlb(GLTFLoader, buffer, asset.url);
  if (!gltf?.scene) throw new Error(`${asset.id || contract.assetId} has no glTF scene.`);
  const mount = new THREE.Group();
  mount.name = `WISDO_PRODUCTION_ASSET:${contract.assetId}`;
  mount.userData.wisdoAssetId = contract.assetId;
  mount.position.fromArray(contract.position || [0,0,0]);
  mount.rotation.y = finite(contract.rotationY, 0);
  mount.add(gltf.scene);
  scene.add(mount);
  configureMaterials(mount, renderer);
  applyStaticLodPolicy(mount, quality);
  const semantics = extractSemanticNodes(THREE, mount);
  return Object.freeze({ contract, asset, mount, semantics, bytes: buffer.byteLength });
}

function resolveAsset(contract, generated) {
  if (contract.collection === 'players') return generated.players?.[contract.slot || 'default'] || null;
  return generated[contract.collection]?.[contract.assetId] || null;
}

export async function installProductionAssetRuntime({ THREE, scene, renderer, destinations = [], quality = 'medium', onInteract } = {}) {
  if (!THREE || !scene) throw new TypeError('Production asset runtime requires the active Three.js scene.');
  const readiness = productionAssetReadiness(GENERATED_WORLD_ASSETS);
  const contracts = [BLENDER_PRODUCTION_ASSETS.central, BLENDER_PRODUCTION_ASSETS.terminal];
  const available = contracts.map((contract) => ({ contract, asset: resolveAsset(contract, GENERATED_WORLD_ASSETS) })).filter((item) => item.asset);
  if (!available.length) {
    const diagnostics = publish({ status: 'FALLBACK_ACTIVE', active: false, readiness, loaded: Object.freeze([]), reason: 'No production Blender environment GLBs are registered yet.' });
    return Object.freeze({ active: false, diagnostics, destroy() {} });
  }

  const imported = await import(GLTF_LOADER_MODULE_URL);
  if (!imported.GLTFLoader) throw new Error('GLTFLoader export missing for production assets.');
  const loaded = [];
  const failures = [];
  for (const item of available) {
    try { loaded.push(await loadAsset({ THREE, GLTFLoader: imported.GLTFLoader, scene, renderer, asset: item.asset, contract: item.contract, quality })); }
    catch (error) { failures.push(Object.freeze({ assetId: item.contract.assetId, reason: String(error?.message || error) })); }
  }

  const interactions = loaded.flatMap((item) => item?.semantics?.interactions || []);
  const collisionBoxes = loaded.flatMap((item) => item?.semantics?.colliders || []);
  const screens = loaded.flatMap((item) => item?.semantics?.screens || []);
  const spawns = loaded.flatMap((item) => item?.semantics?.spawns || []);
  globalThis.WisdoGeneratedCollisionBoxes = Object.freeze(collisionBoxes);
  globalThis.WisdoGeneratedInteractionNodes = Object.freeze(interactions.map((item) => Object.freeze({ semantic: item.semantic, x: item.point.x, y: item.point.y, z: item.point.z })));
  try { window.dispatchEvent(new CustomEvent('wisdo:production-interaction-registry', { detail: { interactions: globalThis.WisdoGeneratedInteractionNodes, collisionBoxes, screens, spawns } })); } catch {}

  let player = null;
  let nearest = null;
  let destroyed = false;
  const destinationById = new Map((destinations || []).map((item) => [item.id, item]));
  const updateNearest = () => {
    if (!player) return;
    let best = null, distance = Infinity;
    for (const item of interactions) {
      const d = Math.hypot(finite(player.x) - item.point.x, finite(player.z) - item.point.z);
      if (d < distance) { best = item; distance = d; }
    }
    nearest = best && distance <= INTERACTION_RADIUS ? Object.freeze({ ...best, distance }) : null;
  };
  const activate = () => {
    if (!nearest) return false;
    const mapping = INTERACTION_DESTINATION_MAP[nearest.semantic] || Object.freeze({ semantic: nearest.semantic.toLowerCase() });
    const destination = mapping.destinationId ? destinationById.get(mapping.destinationId) : null;
    const detail = Object.freeze({ semantic: mapping.semantic || nearest.semantic.toLowerCase(), destinationId: mapping.destinationId || null, destination: destination || null, distance: nearest.distance });
    try { window.dispatchEvent(new CustomEvent('wisdo:production-interact', { detail })); } catch {}
    if (destination) onInteract?.(destination);
    return true;
  };
  const onPlayer = (event) => { player = event?.detail || null; updateNearest(); };
  const onKey = (event) => {
    if (destroyed || event.defaultPrevented || String(event.key || '').toLowerCase() !== 'e' || event.target?.closest?.(EDITABLE)) return;
    updateNearest();
    if (!nearest) return;
    event.preventDefault(); event.stopImmediatePropagation(); activate();
  };
  const onPointer = (event) => {
    if (destroyed || !event.target?.closest?.('#interactBtn')) return;
    updateNearest();
    if (!nearest) return;
    event.preventDefault(); event.stopImmediatePropagation(); activate();
  };
  window.addEventListener('wisdo:world-player-state', onPlayer);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', onPointer, true);

  const diagnostics = publish({
    status: loaded.length ? (failures.length ? 'DEGRADED' : 'ACTIVE') : 'FAILED',
    active: loaded.length > 0,
    readiness,
    loaded: Object.freeze(loaded.map((item) => Object.freeze({ assetId: item.contract.assetId, url: item.asset.url, bytes: item.bytes, interactions: item.semantics.interactions.length, colliders: item.semantics.colliders.length, screens: item.semantics.screens.length }))),
    failures: Object.freeze(failures),
    interactionCount: interactions.length,
    colliderCount: collisionBoxes.length,
    screenCount: screens.length,
    spawnCount: spawns.length,
    fallbackPreserved: true,
    executionFromVisuals: false,
  });

  return Object.freeze({
    active: loaded.length > 0,
    diagnostics,
    interactions: Object.freeze(interactions),
    collisionBoxes: Object.freeze(collisionBoxes),
    screens: Object.freeze(screens),
    activateNearest: activate,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener('wisdo:world-player-state', onPlayer);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
      for (const item of loaded) { scene.remove(item.mount); disposeRoot(item.mount); }
      delete globalThis.WisdoGeneratedCollisionBoxes;
      delete globalThis.WisdoGeneratedInteractionNodes;
      publish({ status: 'DESTROYED', active: false });
    },
  });
}
