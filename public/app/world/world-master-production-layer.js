import { WISDO_VISUAL, createWisdoMasterMaterials, disposeWisdoMaterials } from './world-visual-constitution.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const unwrap = (event) => event?.detail?.detail ?? event?.detail ?? {};
const qualityName = (value) => ['low', 'medium', 'high'].includes(value) ? value : 'medium';

function disposeTree(root) {
  root?.traverse?.((object) => {
    object.geometry?.dispose?.();
    const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of list) material?.dispose?.();
  });
}

function gatewayArch(THREE, materials, { name, position, rotation = 0, accent = 'gold' }) {
  const group = new THREE.Group();
  group.name = `WisdoGatewayArch:${name}`;
  group.position.set(...position); group.rotation.y = rotation;
  const trim = accent === 'cyan' ? materials.dataCyan : materials.goldLight;
  const columnGeo = new THREE.BoxGeometry(0.72, 7.2, 0.9);
  const baseGeo = new THREE.BoxGeometry(1.35, 0.44, 1.55);
  for (const x of [-4.35, 4.35]) {
    const base = new THREE.Mesh(baseGeo, materials.stone); base.position.set(x, 0.22, 0); base.castShadow = true; base.receiveShadow = true; group.add(base);
    const column = new THREE.Mesh(columnGeo, materials.blackMetal); column.position.set(x, 3.8, 0); column.castShadow = true; group.add(column);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.13, 6.3, 0.98), trim); blade.position.set(x + Math.sign(x) * -0.43, 4, 0); group.add(blade);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(4.35, 0.42, 10, 34, Math.PI), materials.blackMetal);
  arch.rotation.z = Math.PI; arch.position.y = 7.15; arch.castShadow = true; group.add(arch);
  const lightArch = new THREE.Mesh(new THREE.TorusGeometry(4.35, 0.085, 8, 42, Math.PI), trim);
  lightArch.rotation.z = Math.PI; lightArch.position.set(0, 7.15, 0.43); group.add(lightArch);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.48, 0.72), materials.obsidian); crown.position.set(0, 7.8, 0); group.add(crown);
  const glyph = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), trim); glyph.position.set(0, 7.8, 0.48); glyph.rotation.z = Math.PI / 4; group.add(glyph);
  group.userData.wisdoDistrictGateway = name;
  return group;
}

function buildGatewaySystem(THREE, root, materials) {
  const group = new THREE.Group(); group.name = 'WisdoGatewaySystem'; root.add(group);
  const specs = [
    { name: 'CENTRAL', position: [0, 0.02, 53], accent: 'gold' },
    { name: 'TRADING', position: [0, 0.02, -53], accent: 'cyan' },
    { name: 'ACADEMY', position: [-40, 0.02, -37], rotation: Math.PI / 4, accent: 'gold' },
    { name: 'MARKET', position: [-38, 0.02, 23], rotation: Math.PI / 2, accent: 'gold' },
    { name: 'COMMAND', position: [49, 0.02, -31], rotation: -Math.PI / 4, accent: 'cyan' },
  ];
  const arches = specs.map((spec) => gatewayArch(THREE, materials, spec));
  arches.forEach((arch) => group.add(arch));
  return arches;
}

function buildBoulevardDetail(THREE, root, materials) {
  const group = new THREE.Group(); group.name = 'WisdoPremiumBoulevard'; root.add(group);
  const guideGeo = new THREE.BoxGeometry(0.085, 0.026, 7.2);
  const nodeGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.045, 18);
  for (let z = 44; z >= -46; z -= 8.2) for (const x of [-13.6, 13.6]) {
    const strip = new THREE.Mesh(guideGeo, materials.goldLight); strip.position.set(x, 0.19, z); group.add(strip);
  }
  for (let z = 47; z >= -47; z -= 11) for (const x of [-12.9, 12.9]) {
    const node = new THREE.Mesh(nodeGeo, materials.dataCyan); node.rotation.x = Math.PI / 2; node.position.set(x, 0.2, z); group.add(node);
  }
  const islandGeo = new THREE.CylinderGeometry(4.5, 4.8, 0.12, 32);
  for (const z of [18, -18]) {
    const island = new THREE.Mesh(islandGeo, materials.stone); island.position.set(0, 0.12, z); island.receiveShadow = true; group.add(island);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.1, 0.055, 8, 48), materials.goldLight); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.2, z); group.add(ring);
  }
  return group;
}

function buildFarSkyline(THREE, root, materials, maxCount = 42) {
  const group = new THREE.Group(); group.name = 'WisdoFarSkylineMaster'; root.add(group);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geometry, materials.obsidian, maxCount);
  const crowns = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materials.gold, maxCount);
  mesh.name = 'WisdoFarSkylineInstances'; crowns.name = 'WisdoSkylineCrowns';
  const dummy = new THREE.Object3D();
  for (let i = 0; i < maxCount; i += 1) {
    const angle = (i / maxCount) * Math.PI * 2 + ((i * 37) % 11) * 0.013;
    const radius = 148 + (i % 7) * 11, width = 7 + (i * 5) % 12, depth = 7 + (i * 3) % 10, height = 34 + (i * 17) % 92;
    dummy.position.set(Math.cos(angle) * radius, height / 2 - 1, Math.sin(angle) * radius); dummy.scale.set(width, height, depth); dummy.rotation.y = angle * 0.37; dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    dummy.position.y = height - 0.3; dummy.scale.set(width * 0.78, 0.35, depth * 0.78); dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true; group.add(mesh, crowns);
  return { group, mesh, crowns, maxCount };
}

function buildTowerBeacon(THREE, root, scene, materials) {
  const tower = scene.getObjectByName('TradingTowerDistrict');
  const group = new THREE.Group(); group.name = 'WisdoTradingTowerBeacon'; root.add(group);
  const center = new THREE.Vector3(0, 116, -84);
  if (tower) {
    const box = new THREE.Box3().setFromObject(tower), measured = new THREE.Vector3(); box.getCenter(measured);
    if (Number.isFinite(box.max.y)) center.set(measured.x, box.max.y + 5, measured.z);
  }
  group.position.copy(center);
  for (const [radius, y, material] of [[5.2, 0, materials.goldLight], [7.2, 2.2, materials.dataCyan], [9.4, 4.6, materials.gold]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.075, 7, 64), material); ring.rotation.x = Math.PI / 2; ring.position.y = y; group.add(ring);
  }
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 13, 10), materials.dataCyan); core.position.y = 5.5; group.add(core);
  return group;
}

function enhanceExistingGlobe(THREE, root, scene, materials) {
  let globe = null;
  scene.traverse((object) => { if (!globe && /globe/i.test(String(object.name || ''))) globe = object; });
  if (!globe) return null;
  const box = new THREE.Box3().setFromObject(globe); if (box.isEmpty()) return null;
  const center = new THREE.Vector3(), size = new THREE.Vector3(); box.getCenter(center); box.getSize(size);
  const radius = clamp(Math.max(size.x, size.z) * 0.62, 2.2, 8.5);
  const network = new THREE.Group(); network.name = 'WisdoGlobeNetworkHalo'; network.position.copy(center); root.add(network);
  for (const [scale, tilt, material] of [[1, 0.35, materials.dataCyan], [1.14, -0.48, materials.goldLight], [1.28, 1.05, materials.dataBlue]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * scale, 0.035, 6, 72), material); ring.rotation.set(Math.PI / 2 + tilt, tilt * 0.3, 0); network.add(ring);
  }
  return network;
}

export async function installWorldMasterProduction({ THREE, scene, camera, renderer, debug = false, instanceId = null } = {}) {
  if (!THREE || !scene || !camera || !renderer) throw new Error('WISDO master production requires active Three.js scene, camera and renderer.');
  const old = scene.getObjectByName('WisdoWorldMasterProduction'); if (old) { scene.remove(old); disposeTree(old); }
  const root = new THREE.Group(); root.name = 'WisdoWorldMasterProduction'; root.userData.instanceId = instanceId; scene.add(root);
  const materials = createWisdoMasterMaterials(THREE);
  const arches = buildGatewaySystem(THREE, root, materials);
  buildBoulevardDetail(THREE, root, materials);
  const skyline = buildFarSkyline(THREE, root, materials, 42);
  const beacon = buildTowerBeacon(THREE, root, scene, materials);
  const globeHalo = enhanceExistingGlobe(THREE, root, scene, materials);
  let activeQuality = qualityName(globalThis.WisdoQualityDiagnostics?.activeQuality || 'medium');
  let destroyed = false, raf = 0, lastFrame = performance.now(), activeBurst = null, lastBurstAt = -Infinity, activeSignal = null;
  const listeners = [];
  const on = (name, fn) => { window.addEventListener(name, fn); listeners.push([name, fn]); };

  function setQuality(next) {
    activeQuality = qualityName(next); const budget = WISDO_VISUAL.budgets[activeQuality];
    skyline.mesh.count = Math.min(skyline.maxCount, budget.skyline); skyline.crowns.count = Math.min(skyline.maxCount, budget.skyline);
    arches.forEach((arch, index) => { arch.visible = index < budget.gatewayArches; });
    globeHalo && (globeHalo.visible = activeQuality !== 'low');
    return activeQuality;
  }

  function signalBurst(detail = {}) {
    activeSignal = { eventId: detail.eventId || detail.id || null, symbol: detail.symbol || detail.event?.symbol || 'MARKET', direction: detail.direction || detail.event?.direction || '' };
    const now = performance.now(); if (now - lastBurstAt < 5000) return; lastBurstAt = now;
    if (activeBurst) { activeBurst.removeFromParent(); disposeTree(activeBurst); }
    const burst = new THREE.Group(); burst.name = 'WisdoSignalBurst';
    const center = beacon.position.clone(); center.y += 6; burst.position.copy(center); burst.userData.startedAt = now;
    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3 + i * 1.8, 0.1, 8, 52), i % 2 ? materials.goldLight : materials.dataCyan); ring.rotation.x = Math.PI / 2; ring.position.y = i * 1.2; burst.add(ring);
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.5, 34, 10, 1, true), materials.dataCyan); beam.position.y = 17; burst.add(beam);
    root.add(burst); activeBurst = burst;
  }
  on('wisdo:bot.signal.created', (event) => signalBurst(unwrap(event)));
  on('wisdo:bot.signal.expired', (event) => { const detail = unwrap(event); if (!detail?.eventId || detail.eventId === activeSignal?.eventId) activeSignal = null; });

  function frame(now) {
    if (destroyed) return; raf = requestAnimationFrame(frame); const dt = clamp((now - lastFrame) / 1000, 0.001, 0.05); lastFrame = now;
    beacon.rotation.y += dt * 0.07; if (globeHalo) globeHalo.rotation.y += dt * 0.08;
    if (activeBurst) {
      const age = (now - activeBurst.userData.startedAt) / 1000; activeBurst.rotation.y += dt * 0.35; activeBurst.scale.setScalar(1 + age * 0.14);
      if (age > 5.2) { activeBurst.removeFromParent(); disposeTree(activeBurst); activeBurst = null; }
    }
  }

  setQuality(activeQuality); raf = requestAnimationFrame(frame);
  const api = Object.freeze({
    version: 'WISDO-WORLD-MASTER-V1',
    setQuality,
    get state() { return Object.freeze({ quality: activeQuality, signal: activeSignal, gatewayCount: arches.filter((arch) => arch.visible).length, skylineCount: skyline.mesh.count, globeEnhanced: Boolean(globeHalo) }); },
    destroy() {
      if (destroyed) return; destroyed = true; cancelAnimationFrame(raf); listeners.forEach(([name, fn]) => window.removeEventListener(name, fn));
      activeBurst?.removeFromParent?.(); scene.remove(root); disposeTree(root); disposeWisdoMaterials(materials);
      if (globalThis.WisdoWorldMasterProduction === api) delete globalThis.WisdoWorldMasterProduction;
      delete document.documentElement.dataset.wisdoMasterWorld;
    },
  });
  globalThis.WisdoWorldMasterProduction = api; document.documentElement.dataset.wisdoMasterWorld = 'active';
  if (debug) console.info('WISDO master environment active', api.state);
  return api;
}
