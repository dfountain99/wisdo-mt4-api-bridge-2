import { installCinematicWorldLayer } from './world-cinematic-layer.js?v=2026.09.25.city-phone-fix';
import { createThreeRuntimeCompat, publishVisualRuntimeError, removeSceneObjectsByName } from './world-runtime-compat.js';
import { installEmergencyWisdoOperator } from './world-operator-fallback.js?v=2026.09.25.city-phone-fix';

function addDisposable(list, value) { if (value) list.push(value); return value; }

function installRecoveryLayer({ THREE, scene, renderer, quality = 'medium', debug = false, cause = null } = {}) {
  removeSceneObjectsByName(scene, 'WISDOCinematicVisualDirector');
  const root = new THREE.Group();
  root.name = 'WISDOCinematicVisualDirector';
  root.userData.recoveryLayer = true;
  scene.add(root);
  const disposables = [];
  const safeQuality = ['low', 'medium', 'high'].includes(quality) ? quality : 'medium';
  const previousBackground = scene.background;
  const previousFog = scene.fog;
  const previousExposure = renderer.toneMappingExposure;
  const oldSky = scene.getObjectByName?.('ProductionSky');
  const oldSkyVisible = oldSky?.visible;
  if (oldSky) oldSky.visible = false;

  scene.background = new THREE.Color(0x02050d);
  scene.fog = new THREE.FogExp2(0x07101e, safeQuality === 'low' ? .0062 : .0048);
  if (THREE.ACESFilmicToneMapping !== undefined) renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = safeQuality === 'low' ? .94 : .86;
  renderer.setClearColor?.(0x02050d, 1);

  const ground = new THREE.Mesh(
    addDisposable(disposables, new THREE.PlaneGeometry(250, 250)),
    addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x03070d, roughness: .76, metalness: .16, transparent: true, opacity: .5, depthWrite: false })),
  );
  ground.name = 'WISDORecoveryNightGround';
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = .02;
  root.add(ground);

  const cyan = addDisposable(disposables, new THREE.MeshBasicMaterial({ color: 0x55e6ff, transparent: true, opacity: .9, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  const gold = addDisposable(disposables, new THREE.MeshBasicMaterial({ color: 0xe4bb61, transparent: true, opacity: .82, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  const violet = addDisposable(disposables, new THREE.MeshBasicMaterial({ color: 0x7766ff, transparent: true, opacity: .78, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));

  const crown = new THREE.Group();
  crown.name = 'WISDOCinematicCentralCrown';
  crown.position.set(38, 0, -1);
  root.add(crown);
  const rings = [];
  for (const [radius, y, material, spin] of [[8.4, 10.5, cyan, .17], [10.6, 20.5, gold, -.11], [7.1, 31.5, violet, .2]]) {
    const ring = new THREE.Mesh(addDisposable(disposables, new THREE.TorusGeometry(radius, .075, 8, safeQuality === 'low' ? 36 : 64)), material);
    ring.position.y = y;
    ring.rotation.x = Math.PI / 2;
    crown.add(ring);
    rings.push({ ring, spin });
  }
  const spine = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.055, .12, 52, 8)), cyan);
  spine.position.y = 27;
  crown.add(spine);

  const trading = new THREE.Group();
  trading.name = 'WISDOCinematicTradingSpine';
  trading.position.set(0, 0, -84);
  root.add(trading);
  const towerSpine = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(.12, 112, .12)), cyan);
  towerSpine.position.y = 60;
  trading.add(towerSpine);

  const drones = [];
  const droneCount = safeQuality === 'low' ? 2 : 4;
  const dark = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x10151e, roughness: .34, metalness: .72 }));
  for (let i = 0; i < droneCount; i += 1) {
    const group = new THREE.Group();
    group.name = `WISDOAmbientDrone-${i}`;
    const body = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(1.1, .22, .42)), dark);
    const wing = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(2.1, .05, .18)), dark);
    group.add(body, wing);
    root.add(group);
    drones.push({ group, radius: 44 + i * 9, speed: .07 + i * .012, height: 21 + i * 4, phase: i * 1.5 });
  }

  const fallbackOperator = installEmergencyWisdoOperator({ THREE, scene });
  const error = cause ? publishVisualRuntimeError('cinematic-primary', cause) : null;
  const diagnostics = Object.freeze({
    active: true,
    visualPass: 'cinematic-city-recovery-v2',
    quality: safeQuality,
    recoveryMode: true,
    recoveryCause: error?.message || null,
    wetStreets: false,
    districtBeacons: 0,
    holograms: 0,
    ambientDrones: drones.length,
    heroLights: 0,
    cinematicFallbackOperator: Boolean(fallbackOperator),
    executionFromVisualLayer: false,
    installedAt: new Date().toISOString(),
  });
  globalThis.WisdoCinematicDiagnostics = diagnostics;
  document.documentElement.dataset.wisdoVisualPass = diagnostics.visualPass;
  window.dispatchEvent(new CustomEvent('wisdo:cinematic-ready', { detail: diagnostics }));
  if (debug) console.warn('[WISDO CINEMATIC RECOVERY ACTIVE]', diagnostics);

  let destroyed = false;
  let frameId = 0;
  let last = performance.now();
  let elapsed = 0;
  function frame(now) {
    if (destroyed) return;
    frameId = requestAnimationFrame(frame);
    const dt = Math.min(.05, Math.max(.001, (now - last) / 1000));
    last = now;
    elapsed += dt;
    for (const row of rings) row.ring.rotation.z += row.spin * dt;
    for (const drone of drones) {
      const angle = elapsed * drone.speed + drone.phase;
      drone.group.position.set(Math.cos(angle) * drone.radius + 10, drone.height + Math.sin(angle * 2.1) * 1.4, Math.sin(angle) * drone.radius - 8);
      drone.group.rotation.y = -angle + Math.PI / 2;
    }
    fallbackOperator?.update?.(dt);
  }
  frameId = requestAnimationFrame(frame);

  return {
    quality: safeQuality,
    diagnostics,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frameId);
      fallbackOperator?.destroy?.();
      scene.remove(root);
      scene.background = previousBackground;
      scene.fog = previousFog;
      renderer.toneMappingExposure = previousExposure;
      if (oldSky && oldSkyVisible !== undefined) oldSky.visible = oldSkyVisible;
      for (const item of disposables.reverse()) item?.dispose?.();
      delete globalThis.WisdoCinematicDiagnostics;
      delete document.documentElement.dataset.wisdoVisualPass;
    },
  };
}

export function installResilientCinematicWorldLayer(options = {}) {
  const THREE = createThreeRuntimeCompat(options.THREE);
  try {
    return installCinematicWorldLayer({ ...options, THREE });
  } catch (error) {
    publishVisualRuntimeError('cinematic-primary', error);
    console.warn('Primary cinematic layer failed; activating deterministic recovery layer.', error);
    return installRecoveryLayer({ ...options, THREE, cause: error });
  }
}
