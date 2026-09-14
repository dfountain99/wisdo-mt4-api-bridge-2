import { WISDO_VISUAL, createWisdoMasterMaterials, disposeWisdoMaterials } from './world-visual-constitution.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));
const unwrap = (event) => event?.detail?.detail ?? event?.detail ?? {};
const qualityName = (value) => ['low', 'medium', 'high'].includes(value) ? value : 'medium';

function disposeTree(root) {
  root?.traverse?.((object) => {
    object.geometry?.dispose?.();
    const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of list) {
      if (material?.map?.userData?.wisdoOwned) material.map.dispose?.();
      material?.dispose?.();
    }
  });
}

function buildGatewayArch(THREE, materials, { name, position, rotation = 0, accent = 'gold' }) {
  const group = new THREE.Group();
  group.name = `WisdoGatewayArch:${name}`;
  group.position.set(...position);
  group.rotation.y = rotation;
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
    { name: 'CENTRAL', position: [0, 0.02, 53], rotation: 0, accent: 'gold' },
    { name: 'TRADING', position: [0, 0.02, -53], rotation: 0, accent: 'cyan' },
    { name: 'ACADEMY', position: [-40, 0.02, -37], rotation: Math.PI / 4, accent: 'gold' },
    { name: 'MARKET', position: [-38, 0.02, 23], rotation: Math.PI / 2, accent: 'gold' },
    { name: 'COMMAND', position: [49, 0.02, -31], rotation: -Math.PI / 4, accent: 'cyan' },
  ];
  const arches = specs.map((spec) => buildGatewayArch(THREE, materials, spec));
  arches.forEach((arch) => group.add(arch));
  return arches;
}

function buildBoulevardDetail(THREE, root, materials) {
  const group = new THREE.Group(); group.name = 'WisdoPremiumBoulevard'; root.add(group);
  const guideGeo = new THREE.BoxGeometry(0.085, 0.026, 7.2);
  for (let z = 44; z >= -46; z -= 8.2) {
    for (const x of [-13.6, 13.6]) {
      const strip = new THREE.Mesh(guideGeo, materials.goldLight); strip.position.set(x, 0.19, z); group.add(strip);
    }
  }
  const nodeGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.045, 18);
  for (let z = 47; z >= -47; z -= 11) {
    for (const x of [-12.9, 12.9]) {
      const node = new THREE.Mesh(nodeGeo, materials.dataCyan); node.rotation.x = Math.PI / 2; node.position.set(x, 0.2, z); group.add(node);
    }
  }
  return group;
}

function buildFarSkyline(THREE, root, materials, maxCount = 42) {
  const group = new THREE.Group(); group.name = 'WisdoFarSkylineMaster'; root.add(group);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geometry, materials.obsidian, maxCount);
  mesh.name = 'WisdoFarSkylineInstances'; mesh.castShadow = false; mesh.receiveShadow = false;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < maxCount; i += 1) {
    const angle = (i / maxCount) * Math.PI * 2 + ((i * 37) % 11) * 0.013;
    const radius = 148 + (i % 7) * 11;
    const width = 7 + (i * 5) % 12;
    const depth = 7 + (i * 3) % 10;
    const height = 34 + (i * 17) % 92;
    dummy.position.set(Math.cos(angle) * radius, height / 2 - 1, Math.sin(angle) * radius);
    dummy.scale.set(width, height, depth); dummy.rotation.y = angle * 0.37; dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true; group.add(mesh);
  const crownGeo = new THREE.BoxGeometry(1, 1, 1);
  const crowns = new THREE.InstancedMesh(crownGeo, materials.gold, maxCount);
  crowns.name = 'WisdoSkylineCrowns';
  for (let i = 0; i < maxCount; i += 1) {
    const angle = (i / maxCount) * Math.PI * 2 + ((i * 37) % 11) * 0.013;
    const radius = 148 + (i % 7) * 11;
    const width = 7 + (i * 5) % 12;
    const depth = 7 + (i * 3) % 10;
    const height = 34 + (i * 17) % 92;
    dummy.position.set(Math.cos(angle) * radius, height - 0.3, Math.sin(angle) * radius);
    dummy.scale.set(width * 0.78, 0.35, depth * 0.78); dummy.rotation.y = angle * 0.37; dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
  }
  crowns.instanceMatrix.needsUpdate = true; group.add(crowns);
  return { group, mesh, crowns, maxCount };
}

function buildAmbientCitizens(THREE, root, materials, maxCount = 16) {
  const group = new THREE.Group(); group.name = 'WisdoAmbientCitizens'; root.add(group);
  const citizens = [];
  const bodyGeo = new THREE.CapsuleGeometry(0.23, 0.78, 3, 6);
  const headGeo = new THREE.SphereGeometry(0.2, 8, 6);
  const routes = [
    [-14, 29, -14, -35], [14, 24, 14, -42], [-25, 18, -78, 18], [27, -7, 78, -7],
    [-31, 31, -78, 31], [31, 31, 82, 31], [-27, -31, -74, -31], [28, -29, 72, -29],
  ];
  for (let i = 0; i < maxCount; i += 1) {
    const route = routes[i % routes.length];
    const citizen = new THREE.Group(); citizen.name = `AmbientCitizen:${i}`; citizen.userData.isAmbientNpc = true;
    const body = new THREE.Mesh(bodyGeo, i % 3 === 0 ? materials.concrete : materials.blackMetal); body.position.y = 1.02; citizen.add(body);
    const head = new THREE.Mesh(headGeo, materials.stone); head.position.y = 1.76; citizen.add(head);
    const link = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.02), materials.dataCyan); link.position.set(0.24, 1.03, -0.19); citizen.add(link);
    citizen.userData.route = route; citizen.userData.phase = (i * 0.173) % 1; citizen.userData.speed = 0.018 + (i % 4) * 0.003;
    group.add(citizen); citizens.push(citizen);
  }
  return { group, citizens, maxCount };
}

function buildTransit(THREE, root, materials, maxCount = 2) {
  const group = new THREE.Group(); group.name = 'WisdoAutonomousTransit'; root.add(group);
  const vehicles = [];
  for (let i = 0; i < maxCount; i += 1) {
    const vehicle = new THREE.Group(); vehicle.name = `WisdoShuttle:${i}`;
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.05, 6.2), materials.blackMetal); body.position.y = 0.9; body.castShadow = true; vehicle.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.72, 3.7), materials.glass); cabin.position.set(0, 1.58, -0.2); vehicle.add(cabin);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 5.4), materials.goldLight); spine.position.set(0, 1.48, 0); vehicle.add(spine);
    vehicle.userData.phase = i / maxCount; group.add(vehicle); vehicles.push(vehicle);
  }
  return { group, vehicles, maxCount };
}

function buildTowerBeacon(THREE, root, scene, materials) {
  const tower = scene.getObjectByName('TradingTowerDistrict');
  const group = new THREE.Group(); group.name = 'WisdoTradingTowerBeacon'; root.add(group);
  const center = new THREE.Vector3(0, 116, -84);
  if (tower) {
    const box = new THREE.Box3().setFromObject(tower); const measured = new THREE.Vector3(); box.getCenter(measured);
    if (Number.isFinite(box.max.y)) center.set(measured.x, box.max.y + 5, measured.z);
  }
  group.position.copy(center);
  for (const [radius, y, material] of [[5.2, 0, materials.goldLight], [7.2, 2.2, materials.dataCyan], [9.4, 4.6, materials.gold]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.075, 7, 64), material); ring.rotation.x = Math.PI / 2; ring.position.y = y; group.add(ring);
  }
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 13, 10), materials.dataCyan); core.position.y = 5.5; group.add(core);
  return group;
}

function buildCompanionDashboard(THREE, root, materials) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.userData.wisdoOwned = true;
  const panel = new THREE.Group(); panel.name = 'WisdoCompanionDashboard';
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(1.92, 0.98), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.96, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
  frame.renderOrder = 900; panel.add(frame);
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 1), materials.dataCyan); orb.position.set(0.84, -0.38, 0.035); orb.visible = false; panel.add(orb);
  root.add(panel);
  const state = { positions: [], reporterConnected: null, platformState: 'connecting', signal: null, streamer: localStorage.getItem('wisdo-streamer-mode') === '1', side: localStorage.getItem('wisdo-companion-side') || 'right' };
  function reporterFrom(snapshot) {
    const rows = snapshot?.worldData?.reporters || snapshot?.homeRuntime?.live?.reporters || [];
    if (!rows.length) return null;
    return rows.some((r) => r?.status === 'live' || r?.terminalConnected === true);
  }
  function render() {
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    const grad = ctx.createLinearGradient(0, 0, 1024, 512); grad.addColorStop(0, 'rgba(5,9,13,.94)'); grad.addColorStop(1, 'rgba(8,25,34,.88)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(20, 20, 984, 472, 42); ctx.fill();
    ctx.strokeStyle = 'rgba(201,166,93,.82)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = '#f4d98b'; ctx.font = '800 34px system-ui'; ctx.fillText('WISDO COMPANION', 62, 82);
    ctx.fillStyle = '#6fe6ff'; ctx.font = '700 19px system-ui'; ctx.fillText('PRIVATE OPERATOR GLANCE', 64, 115);
    if (state.streamer) {
      ctx.fillStyle = '#f3f6f8'; ctx.font = '800 34px system-ui'; ctx.fillText('STREAMER MODE', 64, 212);
      ctx.fillStyle = '#91a7b5'; ctx.font = '600 24px system-ui'; ctx.fillText('Sensitive account context hidden', 64, 257);
    } else {
      const first = state.positions[0] || null; const symbol = first?.symbol || state.signal?.symbol || '—';
      const direction = first?.direction ? String(first.direction).toUpperCase() : state.signal?.direction ? String(state.signal.direction).toUpperCase() : '—';
      const reporter = state.reporterConnected === true ? 'CONNECTED' : state.reporterConnected === false ? 'OFFLINE' : 'UNKNOWN';
      const platform = String(state.platformState || 'unknown').toUpperCase();
      const cells = [['ACTIVE', `${symbol} ${direction}`.trim()], ['POSITIONS', String(state.positions.length)], ['REPORTER', reporter], ['PLATFORM', platform]];
      cells.forEach(([label, value], index) => {
        const x = 64 + (index % 2) * 465, y = 190 + Math.floor(index / 2) * 145;
        ctx.fillStyle = '#8099a8'; ctx.font = '700 18px system-ui'; ctx.fillText(label, x, y);
        ctx.fillStyle = label === 'REPORTER' && reporter === 'CONNECTED' ? '#70efc4' : label === 'PLATFORM' && platform !== 'LIVE' ? '#f4d98b' : '#f2f7fa';
        ctx.font = '800 31px system-ui'; ctx.fillText(value, x, y + 43);
      });
    }
    if (state.signal && !state.streamer) {
      ctx.fillStyle = 'rgba(97,230,255,.12)'; ctx.fillRect(60, 416, 900, 42);
      ctx.fillStyle = '#71e7ff'; ctx.font = '700 19px system-ui'; ctx.fillText(`SIGNAL · ${state.signal.symbol || 'MARKET'} ${String(state.signal.direction || '').toUpperCase()}`, 78, 444);
    }
    texture.needsUpdate = true;
  }
  render();
  return { panel, orb, state, render, texture };
}

function installBlueHourAtmosphere(THREE, root, scene, materials) {
  const previous = { background: scene.background, fog: scene.fog };
  scene.background = new THREE.Color(WISDO_VISUAL.atmosphere.background);
  scene.fog = new THREE.Fog(WISDO_VISUAL.atmosphere.fog, WISDO_VISUAL.atmosphere.fogNear, WISDO_VISUAL.atmosphere.fogFar);
  const hemi = new THREE.HemisphereLight(WISDO_VISUAL.atmosphere.hemisphereSky, WISDO_VISUAL.atmosphere.hemisphereGround, WISDO_VISUAL.atmosphere.hemisphereIntensity); hemi.name = 'WisdoBlueHourHemisphere'; root.add(hemi);
  const key = new THREE.DirectionalLight(WISDO_VISUAL.atmosphere.moonKey, WISDO_VISUAL.atmosphere.moonIntensity); key.position.set(-42, 86, 58); key.name = 'WisdoBlueHourKey'; key.castShadow = false; root.add(key);
  const civic = new THREE.PointLight(WISDO_VISUAL.colors.GOLD_BRIGHT, WISDO_VISUAL.atmosphere.goldFillIntensity, 72, 1.8); civic.position.set(0, 12, -12); civic.name = 'WisdoCivicGoldFill'; root.add(civic);
  return () => { scene.background = previous.background; scene.fog = previous.fog; };
}

export async function installWorldMasterProduction({ THREE, scene, camera, renderer, debug = false, instanceId = null } = {}) {
  if (!THREE || !scene || !camera || !renderer) throw new Error('WISDO master production requires active Three.js scene, camera and renderer.');
  const previous = scene.getObjectByName('WisdoWorldMasterProduction'); if (previous) { scene.remove(previous); disposeTree(previous); }
  const root = new THREE.Group(); root.name = 'WisdoWorldMasterProduction'; root.userData.instanceId = instanceId; scene.add(root);
  const materials = createWisdoMasterMaterials(THREE);
  const restoreAtmosphere = installBlueHourAtmosphere(THREE, root, scene, materials);
  renderer.toneMappingExposure = Math.min(Number(renderer.toneMappingExposure || 1.2), 1.16);

  const arches = buildGatewaySystem(THREE, root, materials);
  buildBoulevardDetail(THREE, root, materials);
  const skyline = buildFarSkyline(THREE, root, materials, 42);
  const population = buildAmbientCitizens(THREE, root, materials, 16);
  const transit = buildTransit(THREE, root, materials, 2);
  const beacon = buildTowerBeacon(THREE, root, scene, materials);
  const companion = buildCompanionDashboard(THREE, root, materials);
  const raycaster = new THREE.Raycaster(), rayDirection = new THREE.Vector3(), cameraForward = new THREE.Vector3(), cameraRight = new THREE.Vector3(), desired = new THREE.Vector3(), player = new THREE.Vector3(0, 0, 68);
  const temp = new THREE.Object3D();
  let activeQuality = qualityName(globalThis.WisdoQualityDiagnostics?.activeQuality || 'medium');
  let playerState = 'IDLE', destroyed = false, raf = 0, lastFrame = performance.now(), lastBurstAt = -Infinity, activeBurst = null;
  const listeners = [];
  const on = (name, fn) => { window.addEventListener(name, fn); listeners.push([name, fn]); };

  function setQuality(next) {
    activeQuality = qualityName(next); const budget = WISDO_VISUAL.budgets[activeQuality];
    skyline.mesh.count = Math.min(skyline.maxCount, budget.skyline); skyline.crowns.count = Math.min(skyline.maxCount, budget.skyline);
    population.citizens.forEach((citizen, index) => { citizen.visible = index < budget.citizens; });
    transit.vehicles.forEach((vehicle, index) => { vehicle.visible = index < budget.transit; });
    arches.forEach((arch, index) => { arch.visible = index < budget.gatewayArches; });
    companion.panel.scale.setScalar(activeQuality === 'low' ? WISDO_VISUAL.companion.mobileScale : WISDO_VISUAL.companion.scale);
    return activeQuality;
  }

  function refreshSnapshot(snapshot) {
    if (!snapshot) return;
    companion.state.positions = snapshot?.worldData?.positions || snapshot?.homeRuntime?.live?.positions || [];
    const rows = snapshot?.worldData?.reporters || snapshot?.homeRuntime?.live?.reporters || [];
    companion.state.reporterConnected = rows.length ? rows.some((r) => r?.status === 'live' || r?.terminalConnected === true) : null;
    companion.state.platformState = 'live'; companion.render();
  }

  on('wisdo:world-player-state', (event) => { const detail = unwrap(event); player.set(Number(detail.x || 0), Number(detail.y || 0), Number(detail.z || 0)); playerState = detail.state || 'IDLE'; });
  on('wisdo:world.ready', (event) => refreshSnapshot(unwrap(event)?.snapshot));
  on('wisdo:financial.updated', () => companion.render());
  on('wisdo:account.updated', () => companion.render());
  on('wisdo:position.opened', (event) => { const position = unwrap(event)?.position; if (position) companion.state.positions = [...companion.state.positions.filter((p) => String(p.ticket) !== String(position.ticket)), position]; companion.render(); });
  on('wisdo:position.updated', (event) => { const position = unwrap(event)?.position; if (position) companion.state.positions = companion.state.positions.map((p) => String(p.ticket) === String(position.ticket) ? position : p); companion.render(); });
  on('wisdo:position.closed', (event) => { const position = unwrap(event)?.position; if (position) companion.state.positions = companion.state.positions.filter((p) => String(p.ticket) !== String(position.ticket)); companion.render(); });
  on('wisdo:reporter.online', () => { companion.state.reporterConnected = true; companion.render(); beacon.visible = true; });
  on('wisdo:reporter.offline', () => { companion.state.reporterConnected = false; companion.render(); });
  on('wisdo:world.connection', (event) => { companion.state.platformState = unwrap(event)?.state || 'degraded'; companion.render(); });
  on('wisdo:streamer-mode', (event) => { const detail = unwrap(event); companion.state.streamer = Boolean(detail.enabled); try { localStorage.setItem('wisdo-streamer-mode', companion.state.streamer ? '1' : '0'); } catch {} companion.render(); });
  on('wisdo:companion-side', (event) => { const side = String(unwrap(event)?.side || '').toLowerCase(); if (['left', 'right', 'auto'].includes(side)) { companion.state.side = side; try { localStorage.setItem('wisdo-companion-side', side); } catch {} } });

  function towerBurst(detail = {}) {
    const now = performance.now();
    companion.state.signal = { symbol: detail.symbol || detail.event?.symbol || 'MARKET', direction: detail.direction || detail.event?.direction || '' }; companion.render();
    if (now - lastBurstAt < 5000) return; lastBurstAt = now;
    activeBurst?.removeFromParent?.(); if (activeBurst) disposeTree(activeBurst);
    const burst = new THREE.Group(); burst.name = 'WisdoSignalBurst';
    const tower = scene.getObjectByName('TradingTowerDistrict'); const center = new THREE.Vector3(0, 105, -84);
    if (tower) { const box = new THREE.Box3().setFromObject(tower); box.getCenter(center); center.y = box.max.y + 9; }
    burst.position.copy(center); burst.userData.startedAt = now;
    for (let i = 0; i < 3; i += 1) { const ring = new THREE.Mesh(new THREE.TorusGeometry(3 + i * 1.8, 0.1, 8, 52), i % 2 ? materials.goldLight : materials.dataCyan); ring.rotation.x = Math.PI / 2; ring.position.y = i * 1.2; burst.add(ring); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.5, 34, 10, 1, true), materials.dataCyan); beam.position.y = 17; burst.add(beam); root.add(burst); activeBurst = burst;
  }
  on('wisdo:bot.signal.created', (event) => towerBurst(unwrap(event)));
  on('wisdo:bot.signal.expired', () => { companion.state.signal = null; companion.render(); });

  function updatePopulation(dt) {
    for (const citizen of population.citizens) {
      if (!citizen.visible) continue; const [x1, z1, x2, z2] = citizen.userData.route; citizen.userData.phase = (citizen.userData.phase + citizen.userData.speed * dt * 4) % 2;
      const p = citizen.userData.phase <= 1 ? citizen.userData.phase : 2 - citizen.userData.phase; citizen.position.set(x1 + (x2 - x1) * p, 0.04, z1 + (z2 - z1) * p); citizen.rotation.y = Math.atan2(x2 - x1, z2 - z1) + (citizen.userData.phase > 1 ? Math.PI : 0);
    }
  }
  function updateTransit(dt) {
    for (const vehicle of transit.vehicles) {
      if (!vehicle.visible) continue; vehicle.userData.phase = (vehicle.userData.phase + dt * 0.018) % 1; const a = vehicle.userData.phase * Math.PI * 2; const rx = 74, rz = 67; vehicle.position.set(Math.sin(a) * rx, 0.06, Math.cos(a) * rz + 6); vehicle.rotation.y = a + Math.PI / 2;
    }
  }
  function updateCompanion(dt) {
    const sprinting = playerState === 'SPRINT' || playerState === 'RUN';
    companion.orb.visible = sprinting; companion.panel.children[0].visible = !sprinting;
    camera.getWorldDirection(cameraForward).normalize(); cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    let side = companion.state.side === 'left' ? -1 : 1; if (companion.state.side === 'auto') side = camera.position.x < player.x ? -1 : 1;
    desired.copy(player).addScaledVector(cameraRight, WISDO_VISUAL.companion.side * side).addScaledVector(cameraForward, -0.34); desired.y += WISDO_VISUAL.companion.height;
    rayDirection.copy(desired).sub(camera.position); const distance = rayDirection.length(); if (distance > 0.1) {
      rayDirection.normalize(); raycaster.set(camera.position, rayDirection); raycaster.far = distance - 0.08;
      const blockers = scene.children.filter((item) => item !== root && item.visible && !item.isLight && item.name !== 'WisdoOperator');
      const hit = raycaster.intersectObjects(blockers, true)[0]; if (hit && hit.distance < distance - 0.18) { desired.copy(player).addScaledVector(cameraRight, 0.52 * side); desired.y += 1.82; }
    }
    companion.panel.position.lerp(desired, 1 - Math.exp(-WISDO_VISUAL.companion.spring * dt)); companion.panel.quaternion.slerp(camera.quaternion, 1 - Math.exp(-12 * dt));
    const base = activeQuality === 'low' ? WISDO_VISUAL.companion.mobileScale : WISDO_VISUAL.companion.scale; const targetScale = sprinting ? base * 0.48 : base;
    const current = companion.panel.scale.x || base; const scale = damp(current, targetScale, 11, dt); companion.panel.scale.setScalar(scale);
  }
  function animateBurst(now) {
    if (!activeBurst) return; const age = (now - activeBurst.userData.startedAt) / 1000; activeBurst.rotation.y += 0.008;
    activeBurst.scale.setScalar(1 + age * 0.14); activeBurst.children.forEach((child, i) => { child.rotation.z += 0.0025 * (i + 1); });
    if (age > 5.2) { activeBurst.removeFromParent(); disposeTree(activeBurst); activeBurst = null; }
  }
  function frame(now) {
    if (destroyed) return; raf = requestAnimationFrame(frame); const dt = clamp((now - lastFrame) / 1000, 0.001, 0.05); lastFrame = now;
    updatePopulation(dt); updateTransit(dt); updateCompanion(dt); animateBurst(now); beacon.rotation.y += dt * 0.07;
  }

  setQuality(activeQuality); raf = requestAnimationFrame(frame);
  const api = {
    version: 'WISDO-WORLD-MASTER-V1',
    setQuality,
    setStreamerMode(enabled) { window.dispatchEvent(new CustomEvent('wisdo:streamer-mode', { detail: { enabled: Boolean(enabled) } })); },
    setCompanionSide(side) { window.dispatchEvent(new CustomEvent('wisdo:companion-side', { detail: { side } })); },
    get state() { return Object.freeze({ quality: activeQuality, reporterConnected: companion.state.reporterConnected, platformState: companion.state.platformState, playerState, signal: companion.state.signal, streamerMode: companion.state.streamer }); },
    destroy() {
      if (destroyed) return; destroyed = true; cancelAnimationFrame(raf); listeners.forEach(([name, fn]) => window.removeEventListener(name, fn));
      activeBurst?.removeFromParent?.(); scene.remove(root); restoreAtmosphere(); disposeTree(root); disposeWisdoMaterials(materials);
      if (globalThis.WisdoWorldMasterProduction === api) delete globalThis.WisdoWorldMasterProduction;
    },
  };
  globalThis.WisdoWorldMasterProduction = api;
  document.documentElement.dataset.wisdoMasterWorld = 'active';
  if (debug) console.info('WISDO World master production active', api.state);
  return api;
}
