import { InputManager } from './input-manager.js';
import { QUALITY_PRESETS, THREE_MODULE_URL, WORLD_CONFIG, chooseAutoQuality } from './world-config.js';

const DEG = Math.PI / 180;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const moveToward = (current, target, amount) => current < target ? Math.min(target, current + amount) : current > target ? Math.max(target, current - amount) : current;
const money = (value, currency = 'USD') => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0)); }
  catch { return `$${Number(value || 0).toFixed(2)}`; }
};

const STATIONS = Object.freeze([
  { id: 'home:account-vault', kind: 'home-station', station: 'account-vault', name: 'Account Vault', short: 'ACCOUNT', position: [-11.5, 0, 8], interaction: [-8.2, 0, 8], description: 'Switch the authorized account powering your home.' },
  { id: 'home:growth', kind: 'home-station', station: 'growth', name: 'Growth Room', short: 'GROWTH', position: [11.5, 0, 8], interaction: [8.2, 0, 8], description: 'XP, achievements, education, and unlocks.' },
  { id: 'home:reporter', kind: 'home-station', station: 'reporter', name: 'Reporter Room', short: 'MESH', position: [-12.5, 0, -4], interaction: [-8.7, 0, -4], description: 'Live Reporter Mesh and terminal health.' },
  { id: 'home:trading', kind: 'home-station', station: 'trading', name: 'Trading Room', short: 'TRADE', position: [12.5, 0, -4], interaction: [8.6, 0, -4], description: 'Live positions, floating P/L, and active market context.' },
  { id: 'home:performance', kind: 'home-station', station: 'performance', name: 'Performance Room', short: 'PERFORM', position: [0, 0, -15.3], interaction: [0, 0, -11.1], description: 'Balance, equity, history, and account performance.' },
  { id: 'home:coach', kind: 'home-station', station: 'coach', name: 'Coach', short: 'COACH', position: [0, 0, 1.2], interaction: [0, 0, 3.6], description: 'WISDO intelligence and guided operator actions.' },
  { id: 'home:fast-mode', kind: 'home-station', station: 'fast-mode', name: 'Fast Mode Terminal', short: 'FAST', position: [-4.6, 0, 13], interaction: [-4.6, 0, 10.9], description: 'Open the traditional responsive WISDO controls.' },
  { id: 'home:front-door', kind: 'home-station', station: 'front-door', name: 'Exit to WISDO City', short: 'CITY', position: [0, 0, 18.2], interaction: [0, 0, 15.7], description: 'Leave your private instance and enter WISDO Central.' },
]);

function panelTexture(THREE, width = 1024, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, ctx: canvas.getContext('2d'), texture };
}

function drawPanel(panel, { eyebrow = 'WISDO', title = '', lines = [], accent = '#72e7ff', muted = false } = {}) {
  const { ctx, canvas, texture } = panel;
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#05080d');
  gradient.addColorStop(.58, '#0a151e');
  gradient.addColorStop(1, '#04070b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = muted ? '#40515d' : accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  ctx.fillStyle = muted ? '#748692' : accent;
  ctx.font = '700 28px system-ui,sans-serif';
  ctx.fillText(String(eyebrow).toUpperCase(), 48, 62);
  ctx.fillStyle = '#f4f8fb';
  ctx.font = '800 58px system-ui,sans-serif';
  ctx.fillText(String(title || 'WISDO'), 48, 135);
  let y = 205;
  for (const line of lines.slice(0, 7)) {
    ctx.fillStyle = line.emphasis ? '#ffffff' : '#a8bfcc';
    ctx.font = `${line.emphasis ? 800 : 600} ${line.large ? 42 : 28}px system-ui,sans-serif`;
    ctx.fillText(String(line.text ?? ''), 48, y);
    y += line.large ? 58 : 45;
  }
  texture.needsUpdate = true;
}

function makeMaterialSet(THREE) {
  return {
    floor: new THREE.MeshStandardMaterial({ color: 0x111820, roughness: .62, metalness: .18 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x1b222a, roughness: .76 }),
    wallDark: new THREE.MeshStandardMaterial({ color: 0x090d12, roughness: .58, metalness: .25 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x68737d, roughness: .28, metalness: .78 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc5a45e, roughness: .28, metalness: .82 }),
    goldGlow: new THREE.MeshStandardMaterial({ color: 0xe5c472, emissive: 0x74500a, emissiveIntensity: 1.25, roughness: .24, metalness: .68 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x6fe8ff, emissive: 0x075a78, emissiveIntensity: 1.55, roughness: .2, metalness: .3 }),
    cyanBasic: new THREE.MeshBasicMaterial({ color: 0x78eaff, toneMapped: false }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x142e3c, roughness: .08, metalness: .12, transparent: true, opacity: .42, transmission: .22, clearcoat: .8 }),
    hologram: new THREE.MeshBasicMaterial({ color: 0x55dfff, transparent: true, opacity: .64, toneMapped: false }),
    positive: new THREE.MeshStandardMaterial({ color: 0x78f2b0, emissive: 0x0b5b34, emissiveIntensity: 1.15, roughness: .24 }),
    negative: new THREE.MeshStandardMaterial({ color: 0xff8b8b, emissive: 0x681515, emissiveIntensity: .85, roughness: .3 }),
    neutral: new THREE.MeshStandardMaterial({ color: 0x91a7b5, emissive: 0x20333e, emissiveIntensity: .55, roughness: .3 }),
  };
}

function box(THREE, group, size, position, material, { shadow = true } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  group.add(mesh);
  return mesh;
}

function colliderFor(THREE, mesh, colliders, pad = 0) {
  mesh.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(mesh);
  if (pad) bounds.expandByScalar(pad);
  colliders.push(bounds);
  return bounds;
}

function addPanel(THREE, group, panel, position, size, rotationY = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ map: panel.texture, toneMapped: false }));
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  group.add(mesh);
  return mesh;
}

function createOperator(THREE, mat) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.42, .92, 6, 10), mat.wallDark);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(.58, .08, .18), mat.goldGlow);
  chest.position.set(0, 1.2, -.38);
  group.add(chest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.31, 18, 14), mat.steel);
  head.position.y = 1.9;
  head.castShadow = true;
  group.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(.44, .12, .09), mat.cyan);
  visor.position.set(0, 1.93, -.28);
  group.add(visor);
  return group;
}

function createHomeGeometry(THREE, scene, mat, colliders, groundMeshes, snapshot) {
  const house = new THREE.Group();
  house.name = 'WISDOStarterResidence';
  scene.add(house);

  const floor = box(THREE, house, [32, .24, 40], [0, -.12, 0], mat.floor);
  groundMeshes.push(floor);
  const ceiling = box(THREE, house, [32, .18, 40], [0, 5.7, 0], mat.wallDark, { shadow: false });
  ceiling.material = mat.wallDark;

  const wallParts = [
    [[.35, 5.8, 40], [-16, 2.8, 0]], [[.35, 5.8, 40], [16, 2.8, 0]],
    [[32, 5.8, .35], [0, 2.8, -20]],
    [[12.2, 5.8, .35], [-9.9, 2.8, 20]], [[12.2, 5.8, .35], [9.9, 2.8, 20]],
  ];
  for (const [size, position] of wallParts) colliderFor(THREE, box(THREE, house, size, position, mat.wall), colliders, .02);

  // Interior wings provide functional separation while leaving wide circulation paths.
  for (const x of [-7.4, 7.4]) {
    colliderFor(THREE, box(THREE, house, [.25, 4.2, 9], [x, 2.1, -10.5], mat.wall), colliders, .01);
    colliderFor(THREE, box(THREE, house, [.25, 4.2, 5.8], [x, 2.1, 9.6], mat.wall), colliders, .01);
  }

  // Rear city window: private residence visually opens onto WISDO skyline.
  const window = box(THREE, house, [12.8, 4.3, .08], [0, 2.7, -19.76], mat.glass, { shadow: false });
  const skyline = new THREE.Group();
  skyline.position.set(0, 0, -29);
  scene.add(skyline);
  for (let i = -5; i <= 5; i += 1) {
    const h = 6 + ((i * i * 7 + 11) % 11);
    const building = box(THREE, skyline, [2.4, h, 2.8], [i * 3.25, h / 2 - .2, -Math.abs(i % 3) * 2], i === 0 ? mat.goldGlow : i % 2 ? mat.wallDark : mat.glass, { shadow: false });
    building.material = i === 0 ? mat.goldGlow : building.material;
  }

  // Architectural light strips.
  for (const x of [-14.8, 14.8]) box(THREE, house, [.07, .07, 36], [x, 4.9, 0], mat.cyanBasic, { shadow: false });
  box(THREE, house, [27, .06, .06], [0, 4.9, -18.7], mat.goldGlow, { shadow: false });

  const panels = {
    greeting: panelTexture(THREE),
    financial: panelTexture(THREE),
    reporter: panelTexture(THREE),
    performance: panelTexture(THREE),
    account: panelTexture(THREE),
    growth: panelTexture(THREE),
    market: panelTexture(THREE),
  };

  addPanel(THREE, house, panels.greeting, [0, 3.1, 4.2], [10.5, 5], 0);
  addPanel(THREE, house, panels.financial, [9.1, 3, -3.9], [6.3, 3.5], -Math.PI / 2);
  addPanel(THREE, house, panels.reporter, [-9.1, 3, -3.9], [6.3, 3.5], Math.PI / 2);
  addPanel(THREE, house, panels.performance, [0, 3, -19.55], [11, 3.7], 0);
  addPanel(THREE, house, panels.account, [-15.7, 3, 8], [6.2, 3.4], Math.PI / 2);
  addPanel(THREE, house, panels.growth, [15.7, 3, 8], [6.2, 3.4], -Math.PI / 2);
  addPanel(THREE, house, panels.market, [0, 3.2, -5.2], [8.8, 3.8], 0);

  // Trading hologram table.
  const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.2, .7, 32), mat.wallDark);
  tableBase.position.set(10.6, .38, -4);
  tableBase.castShadow = true;
  house.add(tableBase);
  colliderFor(THREE, tableBase, colliders, .1);
  const tableSurface = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 2.65, .08, 32), mat.glass);
  tableSurface.position.set(10.6, .8, -4);
  house.add(tableSurface);
  const tradeGroup = new THREE.Group();
  tradeGroup.position.set(10.6, 1.05, -4);
  house.add(tradeGroup);

  // Reporter Mesh core.
  const reporterCore = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 2), mat.cyan);
  reporterCore.position.set(-11.3, 1.8, -4);
  house.add(reporterCore);
  const reporterGroup = new THREE.Group();
  reporterGroup.position.set(-11.3, 1.8, -4);
  house.add(reporterGroup);

  // Coach intelligence orb.
  const coachOrb = new THREE.Mesh(new THREE.SphereGeometry(.72, 24, 18), mat.cyan);
  coachOrb.position.set(0, 1.9, 1.2);
  house.add(coachOrb);
  const coachRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, .035, 8, 56), mat.goldGlow);
  coachRing.position.copy(coachOrb.position);
  coachRing.rotation.x = Math.PI / 2;
  house.add(coachRing);

  const stationMarkers = [];
  for (const station of STATIONS) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(.55, .68, 32), mat.cyanBasic);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(station.interaction[0], .02, station.interaction[2]);
    ring.userData.station = station;
    house.add(ring);
    stationMarkers.push(ring);
  }

  function update(next) {
    const profile = next?.worldProfile || {};
    const live = next?.homeRuntime?.live || next?.worldData || {};
    const financial = live.financial || next?.worldData?.financial || null;
    const account = live.account || next?.worldData?.activeAccount || null;
    const positions = live.positions || next?.worldData?.positions || [];
    const reporters = live.reporters || next?.worldData?.reporters || [];
    const growth = next?.growth || next?.homeRuntime?.growth || {};
    const currency = financial?.currency || 'USD';

    drawPanel(panels.greeting, {
      eyebrow: 'WELCOME HOME',
      title: profile.callsign || 'OPERATOR',
      lines: [
        { text: `${next?.access?.worldLabel || 'MEMBER'} · LEVEL ${growth.level || profile.level || 1}`, emphasis: true },
        { text: `${reporters.filter((r) => r.status === 'live').length}/${reporters.length} REPORTERS ONLINE` },
        { text: `${positions.length} POSITION${positions.length === 1 ? '' : 'S'} ACTIVE` },
        { text: financial ? `FLOATING ${money(financial.floatingPL, currency)}` : 'NO AUTHORIZED ACCOUNT DATA', large: true, emphasis: Boolean(financial) },
      ],
      muted: !financial,
    });

    drawPanel(panels.financial, {
      eyebrow: 'TRADING ROOM · LIVE',
      title: financial ? `FLOATING ${money(financial.floatingPL, currency)}` : 'STANDBY',
      lines: financial ? [
        { text: `BALANCE   ${money(financial.balance, currency)}`, emphasis: true },
        { text: `EQUITY    ${money(financial.equity, currency)}`, emphasis: true },
        { text: `TODAY     ${money(financial.dailyClosedPL, currency)}` },
        { text: `POSITIONS ${positions.length}` },
      ] : [{ text: 'Connect or select an authorized trading account.' }],
      accent: Number(financial?.floatingPL || 0) >= 0 ? '#72e7ff' : '#ff9999',
      muted: !financial,
    });

    drawPanel(panels.reporter, {
      eyebrow: 'REPORTER MESH',
      title: `${reporters.filter((r) => r.status === 'live').length}/${reporters.length} ONLINE`,
      lines: reporters.length ? reporters.slice(0, 5).map((r) => ({ text: `${String(r.name || 'REPORTER').slice(0, 25)} · ${String(r.status || 'offline').toUpperCase()}`, emphasis: r.status === 'live' })) : [{ text: 'No Reporter nodes connected.' }],
      muted: !reporters.length,
    });

    const history = live.history || [];
    drawPanel(panels.performance, {
      eyebrow: 'PERFORMANCE ROOM',
      title: account?.nickname || account?.accountNumberMasked || 'NO ACTIVE ACCOUNT',
      lines: financial ? [
        { text: `BALANCE ${money(financial.balance, currency)} · EQUITY ${money(financial.equity, currency)}`, emphasis: true },
        { text: `FLOATING ${money(financial.floatingPL, currency)} · TODAY ${money(financial.dailyClosedPL, currency)}` },
        { text: `HISTORY POINTS ${history.length}` },
        { text: account?.freshness?.stale ? `DATA ${String(account.freshness.state).toUpperCase()}` : 'DATA LIVE', emphasis: !account?.freshness?.stale },
      ] : [{ text: 'Performance appears when authorized account data is available.' }],
      muted: !financial,
    });

    drawPanel(panels.account, {
      eyebrow: 'ACCOUNT VAULT',
      title: account?.nickname || 'SELECT ACCOUNT',
      lines: account ? [
        { text: account.accountNumberMasked || 'ACCOUNT', emphasis: true },
        { text: `${account.accountType || ''} · ${account.health || account.freshness?.state || ''}` },
        { text: account.server || account.broker || 'Broker server not supplied' },
        { text: `${next?.worldData?.accounts?.length || 0} AUTHORIZED ACCOUNT${(next?.worldData?.accounts?.length || 0) === 1 ? '' : 'S'}` },
      ] : [{ text: 'No authorized account selected.' }],
      muted: !account,
    });

    drawPanel(panels.growth, {
      eyebrow: 'GROWTH ROOM',
      title: `LEVEL ${growth.level || profile.level || 1}`,
      lines: [
        { text: `${Number(growth.xp ?? profile.xp ?? 0).toLocaleString()} XP`, large: true, emphasis: true },
        { text: `${growth.achievements?.length || profile.achievements?.length || 0} ACHIEVEMENTS` },
        { text: `${growth.education?.completedLessons || 0} LESSONS COMPLETED` },
        { text: `${next?.access?.worldLabel || 'MEMBER'} ACCESS` },
      ],
    });

    const symbol = live.selectedSymbol || positions[0]?.symbol || '';
    const selectedTrade = positions.find((p) => p.symbol === symbol) || positions[0];
    drawPanel(panels.market, {
      eyebrow: 'PRIMARY MARKET WALL',
      title: symbol || 'MARKET FEED STANDBY',
      lines: selectedTrade ? [
        { text: `${String(selectedTrade.direction || '').toUpperCase()} ${selectedTrade.lots} LOT`, emphasis: true },
        { text: `ENTRY ${selectedTrade.entryPrice || '—'} · CURRENT ${selectedTrade.currentPrice || '—'}` },
        { text: `P/L ${money(selectedTrade.floatingPL, currency)}`, large: true, emphasis: true },
        { text: 'Full candle chart opens through the authorized WISDO market interface.' },
      ] : [{ text: 'No real market series is available from the current Reporter snapshot.' }, { text: 'WISDO will not fabricate chart candles.' }],
      muted: !selectedTrade,
    });

    tradeGroup.clear();
    positions.slice(0, 18).forEach((position, index) => {
      const angle = (index / Math.max(1, Math.min(18, positions.length))) * Math.PI * 2;
      const radius = 1.3 + (index % 3) * .32;
      const height = .45 + Math.min(1.5, Math.abs(Number(position.floatingPL || 0)) / 100) + (index % 2) * .12;
      const material = Number(position.floatingPL || 0) > 0 ? mat.positive : Number(position.floatingPL || 0) < 0 ? mat.negative : mat.neutral;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.11, .16, height, 10), material);
      pillar.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
      tradeGroup.add(pillar);
    });

    reporterGroup.clear();
    reporters.slice(0, 12).forEach((reporter, index) => {
      const angle = (index / Math.max(1, reporters.length)) * Math.PI * 2;
      const node = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 8), reporter.status === 'live' ? mat.positive : mat.neutral);
      node.position.set(Math.cos(angle) * 1.7, Math.sin(index * 1.7) * .55, Math.sin(angle) * 1.7);
      reporterGroup.add(node);
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), node.position.clone()]);
      reporterGroup.add(new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: reporter.status === 'live' ? 0x78f2b0 : 0x54636d, transparent: true, opacity: .65 })));
    });
  }

  update(snapshot);
  return { house, panels, tradeGroup, reporterCore, reporterGroup, coachOrb, coachRing, stationMarkers, update };
}

function circleHitsBox(x, z, radius, box3) {
  const nx = clamp(x, box3.min.x, box3.max.x);
  const nz = clamp(z, box3.min.z, box3.max.z);
  return (x - nx) ** 2 + (z - nz) ** 2 < radius ** 2;
}

export async function createHomeExperience({ mount, snapshot, preferences = {}, onInteract, onNearestChange, onReady, onPhase, onFatal, onTelemetry } = {}) {
  onPhase?.('Loading private WISDO residence');
  const THREE = await import(THREE_MODULE_URL);
  const autoQuality = chooseAutoQuality();
  let qualityName = preferences.quality && preferences.quality !== 'auto' ? preferences.quality : autoQuality;
  if (!QUALITY_PRESETS[qualityName]) qualityName = autoQuality;
  let quality = QUALITY_PRESETS[qualityName];

  const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality.dpr));
  renderer.domElement.className = 'world-canvas';
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Playable private WISDO Smart Home');
  mount.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071018);
  scene.fog = new THREE.Fog(0x08121b, 42, 100);
  const camera = new THREE.PerspectiveCamera(WORLD_CONFIG.camera.fieldOfView, 1, .08, 160);
  const mat = makeMaterialSet(THREE);
  const colliders = [];
  const groundMeshes = [];

  onPhase?.('Building your Smart Home');
  let currentSnapshot = snapshot;
  const home = createHomeGeometry(THREE, scene, mat, colliders, groundMeshes, currentSnapshot);

  const hemi = new THREE.HemisphereLight(0x91cbe7, 0x0c0d0f, 2.2);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffd6a0, 3.25);
  key.position.set(-14, 19, 12);
  key.castShadow = quality.shadows;
  key.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
  key.shadow.camera.left = -25; key.shadow.camera.right = 25; key.shadow.camera.top = 25; key.shadow.camera.bottom = -25;
  scene.add(key);
  const hubLight = new THREE.PointLight(0x5edcff, 28, 30, 2.1);
  hubLight.position.set(0, 4.4, 1.5);
  scene.add(hubLight);
  const warmLight = new THREE.PointLight(0xd5a84d, 18, 24, 2.2);
  warmLight.position.set(0, 4.6, 12);
  scene.add(warmLight);

  onPhase?.('Spawning operator at home');
  const operator = createOperator(THREE, mat);
  scene.add(operator);
  const serverSpawn = currentSnapshot?.home?.spawn;
  const spawn = new THREE.Vector3(Number(serverSpawn?.x ?? 0), Number(serverSpawn?.y ?? .02), Number(serverSpawn?.z ?? 10.5));
  const pos = spawn.clone();
  const velocity = new THREE.Vector3();
  operator.position.copy(pos);
  const input = new InputManager({ canvas: renderer.domElement, sensitivity: Number(preferences.sensitivity || 1) * WORLD_CONFIG.camera.sensitivity, invertY: Boolean(preferences.invertY) });
  input.bindTouch({ joystick: document.getElementById('moveStick'), knob: document.getElementById('moveKnob'), lookZone: document.getElementById('lookZone'), jumpButton: document.getElementById('jumpBtn'), sprintButton: document.getElementById('sprintBtn'), interactButton: document.getElementById('interactBtn') });

  let yaw = Number(serverSpawn?.yaw ?? Math.PI);
  let pitch = 10 * DEG;
  let grounded = true;
  let lastGroundedAt = performance.now();
  let accumulator = 0;
  let lastTime = performance.now();
  let destroyed = false;
  let paused = false;
  let nearest = null;
  let lastInteractAt = 0;
  let fpsFrames = 0;
  let fpsWindow = performance.now();
  let elapsed = 0;
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const target = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const offset = new THREE.Vector3();

  function groundHeight() { return 0; }

  function moveAxis(axis, amount) {
    if (Math.abs(amount) < 1e-7) return;
    const nx = axis === 'x' ? pos.x + amount : pos.x;
    const nz = axis === 'z' ? pos.z + amount : pos.z;
    if (Math.abs(nx) > 15.35 || nz < -19.25 || nz > 19.25 || colliders.some((bounds) => circleHitsBox(nx, nz, WORLD_CONFIG.player.capsuleRadius, bounds))) velocity[axis] = 0;
    else pos[axis] += amount;
  }

  function updateNearest() {
    let best = null;
    let distance = Infinity;
    for (const station of STATIONS) {
      const d = Math.hypot(pos.x - station.interaction[0], pos.z - station.interaction[2]);
      if (d < distance) { distance = d; best = station; }
    }
    const next = distance <= 3.2 ? { ...best, unlocked: true, minTier: 'Member' } : null;
    if (next?.id !== nearest?.id) {
      nearest = next;
      onNearestChange?.(nearest);
    }
  }

  function physicsStep(dt, frameInput, now) {
    yaw -= frameInput.lookX;
    pitch = clamp(pitch - frameInput.lookY, WORLD_CONFIG.camera.pitchMinDegrees * DEG, WORLD_CONFIG.camera.pitchMaxDegrees * DEG);
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    wish.set(0, 0, 0).addScaledVector(forward, frameInput.moveY).addScaledVector(right, frameInput.moveX);
    if (wish.lengthSq() > 1) wish.normalize();
    const magnitude = Math.min(1, frameInput.magnitude);
    const speedLimit = frameInput.sprint ? WORLD_CONFIG.player.sprintSpeed : magnitude < .6 && magnitude > .01 ? WORLD_CONFIG.player.walkSpeed : WORLD_CONFIG.player.runSpeed;
    const change = (magnitude > .01 ? WORLD_CONFIG.player.acceleration : WORLD_CONFIG.player.deceleration) * (grounded ? 1 : WORLD_CONFIG.player.airControl) * dt;
    velocity.x = moveToward(velocity.x, wish.x * speedLimit * magnitude, change);
    velocity.z = moveToward(velocity.z, wish.z * speedLimit * magnitude, change);
    if (grounded) lastGroundedAt = now;
    if (frameInput.jumpPressed && (grounded || now - lastGroundedAt <= WORLD_CONFIG.player.coyoteTimeMs)) {
      velocity.y = WORLD_CONFIG.player.jumpVelocity;
      grounded = false;
      lastGroundedAt = -Infinity;
    }
    velocity.y += WORLD_CONFIG.player.gravity * dt;
    moveAxis('x', velocity.x * dt);
    moveAxis('z', velocity.z * dt);
    pos.y += velocity.y * dt;
    if (velocity.y <= 0 && pos.y <= groundHeight()) {
      pos.y = groundHeight(); velocity.y = 0; grounded = true; lastGroundedAt = now;
    }
    const speed = Math.hypot(velocity.x, velocity.z);
    if (speed > .12) {
      const wanted = Math.atan2(velocity.x, velocity.z);
      const delta = Math.atan2(Math.sin(wanted - operator.rotation.y), Math.cos(wanted - operator.rotation.y));
      operator.rotation.y += delta * (1 - Math.exp(-12 * dt));
    }
    operator.position.copy(pos);
    if (!grounded) operator.position.y += Math.sin(elapsed * 8) * .012;
    updateNearest();
    if (frameInput.interactPressed && nearest && now - lastInteractAt > 360) {
      lastInteractAt = now;
      onInteract?.(nearest);
    }
    return { speed };
  }

  function updateCamera(dt, sprinting) {
    target.set(pos.x, pos.y + WORLD_CONFIG.camera.targetHeight, pos.z);
    const cp = Math.cos(pitch);
    offset.set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp).multiplyScalar(4.25);
    right.set(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(.38);
    desiredCamera.copy(target).add(offset).add(right);
    camera.position.lerp(desiredCamera, 1 - Math.exp(-WORLD_CONFIG.camera.damping * dt));
    camera.lookAt(target);
    const reduce = Boolean(preferences.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches);
    camera.fov += ((!reduce && sprinting ? WORLD_CONFIG.camera.sprintFieldOfView : WORLD_CONFIG.camera.fieldOfView) - camera.fov) * (1 - Math.exp(-7 * dt));
    camera.updateProjectionMatrix();
  }

  function resize() {
    const width = mount.clientWidth || innerWidth;
    const height = mount.clientHeight || innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = Math.max(.2, width / Math.max(1, height));
    camera.updateProjectionMatrix();
  }

  function setPreferences(next = {}) {
    Object.assign(preferences, next);
    input.setPreferences({ sensitivity: Number(preferences.sensitivity || 1) * WORLD_CONFIG.camera.sensitivity, invertY: Boolean(preferences.invertY) });
  }

  function updateSnapshot(next) {
    currentSnapshot = next || currentSnapshot;
    home.update(currentSnapshot);
  }

  function telemetry(now) {
    if (now - fpsWindow < 1000) return;
    const fps = Math.round(fpsFrames * 1000 / (now - fpsWindow));
    fpsFrames = 0; fpsWindow = now;
    onTelemetry?.({ fps, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, quality: qualityName, scene: 'home', player: { x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2), grounded } });
  }

  function frame(now) {
    if (destroyed) return;
    requestAnimationFrame(frame);
    if (paused) return;
    const dt = Math.min(WORLD_CONFIG.world.maxFrameDt, Math.max(.001, (now - lastTime) / 1000));
    lastTime = now; elapsed += dt; accumulator += dt;
    const frameInput = input.frame();
    let result = { speed: 0 };
    let first = true;
    while (accumulator >= WORLD_CONFIG.world.fixedDt) {
      result = physicsStep(WORLD_CONFIG.world.fixedDt, first ? frameInput : { ...frameInput, jumpPressed: false, interactPressed: false, lookX: 0, lookY: 0 }, now);
      accumulator -= WORLD_CONFIG.world.fixedDt; first = false;
    }
    home.coachOrb.rotation.y = elapsed * .7;
    home.coachRing.rotation.z = elapsed * .45;
    home.reporterCore.rotation.y = elapsed * .38;
    for (const marker of home.stationMarkers) marker.material.opacity = .48 + Math.sin(elapsed * 2.2) * .18;
    updateCamera(dt, frameInput.sprint && result.speed > WORLD_CONFIG.player.runSpeed);
    renderer.render(scene, camera);
    fpsFrames += 1;
    telemetry(now);
  }

  function onVisibility() {
    paused = document.hidden;
    if (!paused) { lastTime = performance.now(); accumulator = 0; }
  }

  function onContextLost(event) {
    event.preventDefault();
    onFatal?.(new Error('WebGL context was lost.'));
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    input.destroy();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
    onNearestChange?.(null);
    scene.traverse((object) => {
      object.geometry?.dispose?.();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        for (const value of Object.values(material)) if (value?.isTexture) value.dispose?.();
        material.dispose?.();
      }
    });
    renderer.dispose();
    renderer.forceContextLoss?.();
    mount.replaceChildren();
  }

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
  resize();
  updateCamera(1 / 60, false);
  renderer.render(scene, camera);
  onPhase?.('Your WISDO Smart Home is online');
  onReady?.({ quality: qualityName, engine: 'Three.js', scene: 'private-home', physics: 'fixed-step kinematic controller' });
  requestAnimationFrame(frame);
  return { mode: 'home3d', engine: 'Three.js', scene: 'private-home', destroy, setPreferences, updateSnapshot, releasePointer: () => input.releasePointer() };
}
