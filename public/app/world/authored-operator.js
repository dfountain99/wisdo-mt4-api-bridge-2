import { AUTHORED_WORLD_ASSETS, GLTF_LOADER_MODULE_URL } from './authored-asset-manifest.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function clipByNames(clips, names = []) {
  for (const wanted of names) {
    const exact = clips.find((clip) => clip.name === wanted);
    if (exact) return exact;
    const insensitive = clips.find((clip) => String(clip.name || '').toLowerCase() === String(wanted).toLowerCase());
    if (insensitive) return insensitive;
  }
  return null;
}

function prepareMaterials(root) {
  root.traverse((object) => {
    if (!object.isMesh && !object.isSkinnedMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      if ('roughness' in material) material.roughness = clamp(Number(material.roughness ?? .5), .24, .86);
      if ('metalness' in material) material.metalness = clamp(Number(material.metalness ?? 0), 0, .72);
      if (material.map) material.map.anisotropy = Math.max(4, Number(material.map.anisotropy || 1));
      material.needsUpdate = true;
    }
  });
}

function normalizeHumanScale(THREE, model, targetHeightMeters = 1.82) {
  model.updateMatrixWorld(true);
  const first = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  first.getSize(size);
  if (!Number.isFinite(size.y) || size.y <= .001) throw new Error('Authored Operator has invalid bounds.');
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

function loadGltf(GLTFLoader, url, timeoutMs = 15000) {
  return Promise.race([
    new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(url, resolve, undefined, reject);
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Authored Operator load timed out.')), timeoutMs)),
  ]);
}

function createClipController(THREE, gltf, asset) {
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clips = Array.isArray(gltf.animations) ? gltf.animations : [];
  const actions = {
    idle: clipByNames(clips, asset.clips.idle),
    walk: clipByNames(clips, asset.clips.walk),
    run: clipByNames(clips, asset.clips.run),
    wave: clipByNames(clips, asset.clips.wave),
  };
  const resolved = {};
  for (const [name, clip] of Object.entries(actions)) {
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    action.enabled = true;
    action.setEffectiveWeight(1);
    if (name !== 'wave') action.setLoop(THREE.LoopRepeat, Infinity);
    resolved[name] = action;
  }
  let current = null;
  function play(name, fade = .18, timeScale = 1) {
    const next = resolved[name] || resolved.idle || resolved.walk || resolved.run;
    if (!next) return;
    next.timeScale = timeScale;
    if (next === current) return;
    next.reset().fadeIn(fade).play();
    current?.fadeOut(fade);
    current = next;
  }
  play('idle', 0);
  return { mixer, actions: resolved, play, clips: clips.map((clip) => clip.name) };
}

function makeOperatorBadge(THREE) {
  const group = new THREE.Group();
  group.name = 'WISDOOperatorBadge';
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a55c, metalness: .85, roughness: .24 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x7deaff, emissive: 0x0a6a89, emissiveIntensity: .85, roughness: .22 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.18, .055, .018), gold);
  plate.position.set(0, 1.38, -.19);
  const core = new THREE.Mesh(new THREE.BoxGeometry(.07, .018, .008), cyan);
  core.position.set(0, 1.38, -.201);
  group.add(plate, core);
  return group;
}

export async function installAuthoredOperator({ THREE, scene, debug = false } = {}) {
  if (!THREE || !scene) throw new TypeError('Authored Operator requires the active Three.js scene.');
  const operator = scene.getObjectByName('WisdoOperator');
  if (!operator) throw new Error('WisdoOperator physics root is unavailable.');

  const asset = AUTHORED_WORLD_ASSETS.defaultOperator;
  const { GLTFLoader } = await import(GLTF_LOADER_MODULE_URL);
  const gltf = await loadGltf(GLTFLoader, asset.url);
  if (!gltf?.scene) throw new Error('Authored Operator GLB did not contain a scene.');

  const mount = new THREE.Group();
  mount.name = 'WISDOAuthoredOperatorMount';
  const model = gltf.scene;
  model.name = 'WISDOAuthoredOperatorModel';
  model.rotation.y = asset.rotationY || 0;
  prepareMaterials(model);
  const scale = normalizeHumanScale(THREE, model, asset.targetHeightMeters);
  mount.add(model);
  mount.add(makeOperatorBadge(THREE));
  operator.add(mount);

  const previousVisibility = new Map();
  function hideFallbacks() {
    for (const child of operator.children) {
      if (child === mount) continue;
      if (!previousVisibility.has(child)) previousVisibility.set(child, child.visible);
      child.visible = false;
    }
  }
  hideFallbacks();

  const clips = createClipController(THREE, gltf, asset);
  const previousWorld = new THREE.Vector3();
  const currentWorld = new THREE.Vector3();
  operator.getWorldPosition(previousWorld);
  let destroyed = false;
  let frameId = 0;
  let last = performance.now();

  function frame(now) {
    if (destroyed) return;
    frameId = requestAnimationFrame(frame);
    const dt = Math.min(.05, Math.max(.001, (now - last) / 1000));
    last = now;
    operator.getWorldPosition(currentWorld);
    const distance = currentWorld.distanceTo(previousWorld);
    const speed = clamp(distance / dt, 0, 12);
    const verticalSpeed = Math.abs(currentWorld.y - previousWorld.y) / dt;
    previousWorld.copy(currentWorld);

    if (verticalSpeed > 1.1) clips.play('run', .12, .72);
    else if (speed < .18) clips.play('idle', .2, 1);
    else if (speed < 4.35) clips.play('walk', .16, clamp(speed / 3.2, .72, 1.35));
    else clips.play('run', .14, clamp(speed / 5.2, .82, 1.55));
    clips.mixer.update(dt);
  }
  frameId = requestAnimationFrame(frame);

  const avatarListener = () => hideFallbacks();
  window.addEventListener('wisdo:avatar.updated', avatarListener);

  globalThis.WisdoAuthoredAssets = Object.freeze({
    operator: Object.freeze({
      active: true,
      assetId: asset.id,
      source: asset.sourceRepository,
      sourceCommit: asset.sourceCommit,
      license: asset.license,
      scale,
      clips: clips.clips,
    }),
  });
  document.documentElement.dataset.wisdoOperator = 'authored-glb';
  if (debug) console.debug('[WISDO AUTHORED OPERATOR]', globalThis.WisdoAuthoredAssets.operator);

  return {
    active: true,
    assetId: asset.id,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener('wisdo:avatar.updated', avatarListener);
      clips.mixer.stopAllAction();
      operator.remove(mount);
      mount.traverse((object) => {
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!material) continue;
          for (const value of Object.values(material)) if (value?.isTexture) value.dispose?.();
          material.dispose?.();
        }
      });
      for (const [child, visible] of previousVisibility) child.visible = visible;
      delete document.documentElement.dataset.wisdoOperator;
      delete globalThis.WisdoAuthoredAssets;
    },
  };
}
