import { WORLD_BUILD, WORLD_BUILD_ID } from './world-build.js';
import { installArcadeCityVerticalSlice } from './world-arcade-plaza.js';
import { createThreeRuntimeCompat, publishVisualRuntimeError, removeSceneObjectsByName } from './world-runtime-compat.js';

const money = (value, currency = 'USD') => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0)); }
  catch { return `$${Number(value || 0).toFixed(2)}`; }
};

function addDisposable(list, value) { if (value) list.push(value); return value; }

function safeFetchJson(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'AbortError')), timeoutMs);
  return fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
    .then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.error || `HTTP ${response.status}`), { status: response.status });
      return body;
    })
    .finally(() => clearTimeout(timer));
}

function installRecoveryUi() {
  const stage = document.getElementById('worldStage');
  if (!stage) return {};
  let hud = document.getElementById('wisdoFinancialHud');
  if (!hud) {
    hud = document.createElement('aside');
    hud.id = 'wisdoFinancialHud';
    hud.className = 'wisdo-financial-hud wisdo-recovery-hud';
    hud.innerHTML = '<div class="wf-brand"><b>WISDO</b><small>WORLD RECOVERY VIEW</small></div><div class="wf-mode" id="wfMode">NO LIVE ACCOUNT</div><div class="wf-grid"><div><span>BALANCE</span><strong id="wfBalance">—</strong></div><div><span>EQUITY</span><strong id="wfEquity">—</strong></div><div><span>OPEN TRADES</span><strong id="wfTrades">0</strong></div><div><span>FLOATING P/L</span><strong id="wfFloating">—</strong></div></div>';
    stage.appendChild(hud);
  }
  let ribbon = document.getElementById('wisdoActivityRibbon');
  if (!ribbon) {
    ribbon = document.createElement('nav');
    ribbon.id = 'wisdoActivityRibbon';
    ribbon.className = 'wisdo-activity-ribbon wisdo-recovery-ribbon';
    for (const [label, detail] of [
      ['COFFEE', { id: 'wisdo-brew', name: 'WISDO Brew', x: -23, z: 31 }],
      ['GYM', { id: 'wisdo-gym', name: 'WISDO Gym', x: -93, z: 30 }],
      ['ARCADE', { id: 'wisdo-arcade', name: 'WISDO Arcade', x: -23, z: 55 }],
      ['CHILL', { id: 'wisdo-chill', name: 'WISDO Chill Plaza', x: 26, z: 37 }],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => window.dispatchEvent(new CustomEvent('wisdo:set-waypoint', { detail })));
      ribbon.appendChild(button);
    }
    stage.appendChild(ribbon);
  }
  let build = document.getElementById('wisdoLiveBuildBadge');
  if (!build) {
    build = document.createElement('div');
    build.id = 'wisdoLiveBuildBadge';
    build.className = 'wisdo-build-badge';
    build.textContent = `WORLD ${WORLD_BUILD.worldVersion} · ${WORLD_BUILD_ID} · RECOVERY`;
    stage.appendChild(build);
  }
  return { hud, ribbon, build };
}

function updateHud(snapshot) {
  const live = snapshot?.homeRuntime?.live || snapshot?.worldData || {};
  const financial = live.financial;
  const positions = Array.isArray(live.positions) ? live.positions : [];
  const currency = financial?.currency || 'USD';
  const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
  set('wfMode', financial ? 'LIVE ACCOUNT · REPORTER AUTHORIZED' : 'NO LIVE ACCOUNT');
  set('wfBalance', financial ? money(financial.balance, currency) : '—');
  set('wfEquity', financial ? money(financial.equity, currency) : '—');
  set('wfTrades', String(positions.length));
  set('wfFloating', financial ? money(financial.floatingPL, currency) : '—');
}

function createStorefront(THREE, root, disposables, { id, position, accent }) {
  const group = new THREE.Group();
  group.name = id;
  group.position.set(...position);
  root.add(group);
  const facadeMat = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x101722, roughness: .48, metalness: .5 }));
  const glow = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.25, roughness: .24, metalness: .42 }));
  const facade = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(9.5, 5.2, 2.4)), facadeMat);
  facade.position.set(0, 2.6, 0);
  group.add(facade);
  const crown = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(8.4, .4, 2.6)), glow);
  crown.position.set(0, 5.35, 0);
  group.add(crown);
  const door = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(2.1, 3.2, .18)), glow);
  door.position.set(0, 1.65, -1.3);
  group.add(door);
  group.userData.worldObject = { id, type: 'business', interactionRadius: 3.5, prompt: 'ENTER', action: 'waypoint', permissions: 'member' };
  return group;
}

function createPalm(THREE, root, disposables, index, x, z) {
  const group = new THREE.Group();
  group.name = `WisdoPalm-${index}`;
  group.position.set(x, 0, z);
  root.add(group);
  const trunkMat = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x594739, roughness: .95 }));
  const leafMat = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x173d35, roughness: .78, side: THREE.DoubleSide }));
  const trunk = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.2, .36, 5.5, 8)), trunkMat);
  trunk.position.y = 2.75;
  group.add(trunk);
  const fronds = new THREE.Group(); fronds.position.y = 5.45; group.add(fronds);
  for (let i = 0; i < 8; i += 1) {
    const blade = new THREE.Mesh(addDisposable(disposables, new THREE.PlaneGeometry(3.0, .42)), leafMat);
    blade.geometry.translate(1.35, 0, 0);
    blade.rotation.y = i / 8 * Math.PI * 2;
    blade.rotation.z = -.28;
    fronds.add(blade);
  }
  return { group, fronds, phase: index * .6 };
}

function createNpc(THREE, root, disposables, index, route) {
  const group = new THREE.Group();
  group.name = `WisdoNPC-${index}`;
  root.add(group);
  const cloth = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x111721, roughness: .56, metalness: .18 }));
  const skin = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: [0x6c4637, 0x8b5e49, 0xa87959, 0x5d3d31][index % 4], roughness: .8 }));
  const torso = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.2, .25, .7, 8)), cloth);
  torso.position.y = 1.22;
  group.add(torso);
  const head = new THREE.Mesh(addDisposable(disposables, new THREE.SphereGeometry(.16, 10, 8)), skin);
  head.position.y = 1.77;
  group.add(head);
  const limbs = {};
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * .29, 1.42, 0);
    const armMesh = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.05, .065, .5, 7)), cloth); armMesh.position.y = -.25; arm.add(armMesh); group.add(arm);
    const leg = new THREE.Group(); leg.position.set(side * .11, .82, 0);
    const legMesh = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.06, .08, .72, 7)), cloth); legMesh.position.y = -.36; leg.add(legMesh); group.add(leg);
    limbs[side < 0 ? 'la' : 'ra'] = arm;
    limbs[side < 0 ? 'll' : 'rl'] = leg;
  }
  group.position.set(route[0][0], 0, route[0][1]);
  return { npc: group, limbs, route, segment: 0, t: (index * .17) % 1, speed: .3 + index * .025, phase: index * .7 };
}

function createCoach(THREE, root, disposables) {
  const group = new THREE.Group();
  group.name = 'WisdoCoachHologram';
  group.position.set(29, 0, -15);
  root.add(group);
  const holo = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x65e8ff, emissive: 0x1596bc, emissiveIntensity: 1.8, transparent: true, opacity: .7, roughness: .2, metalness: .2, depthWrite: false }));
  const torso = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.24, .3, .8, 10)), holo); torso.position.y = 1.35; group.add(torso);
  const head = new THREE.Mesh(addDisposable(disposables, new THREE.SphereGeometry(.19, 12, 9)), holo); head.position.y = 2.0; group.add(head);
  const ring = new THREE.Mesh(addDisposable(disposables, new THREE.TorusGeometry(1.0, .04, 8, 32)), holo); ring.rotation.x = Math.PI / 2; ring.position.y = .08; group.add(ring);
  return { group, ring, material: holo };
}

function createLiveTradeHologram(THREE, root, disposables) {
  const frame = new THREE.Group();
  frame.name = 'WisdoLiveTradeHologram';
  frame.position.set(6, 4.6, 18);
  root.add(frame);
  const glow = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x70e8ff, emissive: 0x0b617a, emissiveIntensity: 1.6, transparent: true, opacity: .72, roughness: .2, metalness: .2 }));
  const panel = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(7.2, 3.8, .12)), glow);
  frame.add(panel);
  return { sprite: frame, update() {} };
}

function installRecoveryArcade({ THREE, scene, quality = 'medium', debug = false, cause = null } = {}) {
  removeSceneObjectsByName(scene, 'WISDOArcadeWorldVerticalSlice');
  const root = new THREE.Group();
  root.name = 'WISDOArcadeWorldVerticalSlice';
  root.userData.recoveryLayer = true;
  scene.add(root);
  const disposables = [];
  const ui = installRecoveryUi();
  const registry = { landmarks: {}, businesses: {}, activities: {}, npcGroups: {}, vehicles: {}, signs: {}, interactables: {} };
  const componentErrors = {};
  const palms = [];
  const npcs = [];
  let coach = null;
  let liveTrades = null;

  const publishRegistry = () => {
    globalThis.WisdoWorldRegistry = Object.freeze({ ...registry, root });
  };
  const step = (name, factory) => {
    try { const value = factory(); publishRegistry(); return value; }
    catch (error) { componentErrors[name] = publishVisualRuntimeError(`arcade-${name}`, error); publishRegistry(); return null; }
  };

  const brew = step('brew', () => createStorefront(THREE, root, disposables, { id: 'WisdoBrew', position: [-23, 0, 30], accent: 0xe6a552 }));
  if (brew) { registry.businesses.brew = brew; registry.interactables.brew = brew; publishRegistry(); }
  const arcade = step('arcade', () => createStorefront(THREE, root, disposables, { id: 'WisdoArcade', position: [-23, 0, 54], accent: 0x8c66ff }));
  if (arcade) { registry.businesses.arcade = arcade; registry.interactables.arcade = arcade; publishRegistry(); }
  const gym = step('gym', () => createStorefront(THREE, root, disposables, { id: 'WisdoGym', position: [-93, 0, 29], accent: 0x67f6b2 }));
  if (gym) { registry.businesses.gym = gym; registry.interactables.gym = gym; publishRegistry(); }

  const chill = step('chill', () => {
    const group = new THREE.Group(); group.name = 'WisdoChillPlaza'; group.position.set(26, 0, 37); root.add(group);
    const mat = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x101822, roughness: .58, metalness: .36 }));
    for (const x of [-3, 0, 3]) { const bench = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(3.2, .3, .8)), mat); bench.position.set(x, .6, Math.abs(x) * .5); group.add(bench); }
    return group;
  });
  if (chill) { registry.activities.chill = chill; publishRegistry(); }

  const palmPositions = [[22,24],[30,25],[22,49],[32,47],[-31,22],[-31,43],[-82,18],[-82,44]];
  palmPositions.slice(0, quality === 'low' ? 5 : palmPositions.length).forEach(([x, z], index) => {
    const palm = step(`palm-${index}`, () => createPalm(THREE, root, disposables, index, x, z));
    if (palm) palms.push(palm);
  });

  const routes = [
    [[-12,18],[12,18],[14,40],[-8,42]],
    [[-36,18],[-10,18],[-10,48],[-36,48]],
    [[20,-18],[20,18],[48,18],[48,-12]],
    [[8,31],[29,31],[29,53],[8,53]],
  ];
  routes.slice(0, quality === 'low' ? 2 : routes.length).forEach((route, index) => {
    const row = step(`npc-${index}`, () => createNpc(THREE, root, disposables, index, route));
    if (row) { npcs.push(row); registry.npcGroups[`npc${index}`] = row.npc; publishRegistry(); }
  });

  coach = step('coach', () => createCoach(THREE, root, disposables));
  if (coach) { registry.landmarks.coach = coach.group; registry.interactables.coach = coach.group; publishRegistry(); }
  liveTrades = step('live-trades', () => createLiveTradeHologram(THREE, root, disposables));
  if (liveTrades) { registry.signs.liveTrades = liveTrades.sprite; publishRegistry(); }

  const primaryError = cause ? publishVisualRuntimeError('arcade-primary', cause) : null;
  const diagnostics = Object.freeze({
    active: true,
    recoveryMode: true,
    recoveryCause: primaryError?.message || null,
    buildId: WORLD_BUILD_ID,
    businesses: Object.keys(registry.businesses),
    npcCount: npcs.length,
    palmCount: palms.length,
    coach: Boolean(coach),
    liveTradeHologram: Boolean(liveTrades),
    financialHud: Boolean(ui.hud),
    activityRibbon: Boolean(ui.ribbon),
    componentErrors: Object.freeze({ ...componentErrors }),
    executionFromWorldVisuals: false,
  });
  globalThis.WisdoArcadeWorldDiagnostics = diagnostics;
  publishRegistry();
  window.dispatchEvent(new CustomEvent('wisdo:arcade-world-ready', { detail: diagnostics }));
  if (debug) console.warn('[WISDO ARCADE RECOVERY ACTIVE]', diagnostics);

  let destroyed = false;
  let frameId = 0;
  let last = performance.now();
  let elapsed = 0;
  let syncBusy = false;
  async function syncWorld() {
    if (destroyed || syncBusy) return;
    syncBusy = true;
    try { const snapshot = await safeFetchJson('/api/world/state'); updateHud(snapshot); liveTrades?.update?.(snapshot); }
    catch (error) { if (error?.status !== 401 && error?.name !== 'AbortError' && debug) console.debug('[WISDO ARCADE RECOVERY] state unavailable', error?.message || error); updateHud(null); }
    finally { syncBusy = false; }
  }
  void syncWorld();
  const syncTimer = setInterval(() => { void syncWorld(); }, 5000);

  function frame(now) {
    if (destroyed) return;
    frameId = requestAnimationFrame(frame);
    const dt = Math.min(.05, Math.max(.001, (now - last) / 1000));
    last = now;
    elapsed += dt;
    for (const palm of palms) palm.fronds.rotation.y = Math.sin(elapsed * .35 + palm.phase) * .03;
    if (coach) { coach.ring.rotation.z += dt * .35; coach.material.opacity = .64 + Math.sin(elapsed * 1.2) * .07; }
    for (const row of npcs) {
      const a = row.route[row.segment % row.route.length];
      const b = row.route[(row.segment + 1) % row.route.length];
      row.t += dt * row.speed;
      if (row.t >= 1) { row.t = 0; row.segment = (row.segment + 1) % row.route.length; }
      row.npc.position.set(a[0] + (b[0] - a[0]) * row.t, 0, a[1] + (b[1] - a[1]) * row.t);
      row.npc.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
      const swing = Math.sin(elapsed * 6 + row.phase) * .42;
      row.limbs.la.rotation.x = -swing; row.limbs.ra.rotation.x = swing; row.limbs.ll.rotation.x = swing; row.limbs.rl.rotation.x = -swing;
    }
  }
  frameId = requestAnimationFrame(frame);

  return {
    diagnostics,
    registry,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearInterval(syncTimer);
      cancelAnimationFrame(frameId);
      scene.remove(root);
      for (const item of disposables.reverse()) item?.dispose?.();
      document.getElementById('wisdoFinancialHud')?.remove();
      document.getElementById('wisdoActivityRibbon')?.remove();
      document.getElementById('wisdoLiveBuildBadge')?.remove();
      delete globalThis.WisdoWorldRegistry;
      delete globalThis.WisdoArcadeWorldDiagnostics;
    },
  };
}

export function installResilientArcadeCityVerticalSlice(options = {}) {
  const THREE = createThreeRuntimeCompat(options.THREE);
  try {
    return installArcadeCityVerticalSlice({ ...options, THREE });
  } catch (error) {
    publishVisualRuntimeError('arcade-primary', error);
    console.warn('Primary Arcade Plaza failed; activating independently recoverable vertical slice.', error);
    return installRecoveryArcade({ ...options, THREE, cause: error });
  }
}
