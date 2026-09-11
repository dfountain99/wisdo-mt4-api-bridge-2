import { InputManager } from './input-manager.js';
import { QUALITY_PRESETS, THREE_MODULE_URL, WORLD_CONFIG, WORLD_LOCATIONS, chooseAutoQuality } from './world-config.js';

const DEG = Math.PI / 180;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));
const moveToward = (current, target, amount) => current < target ? Math.min(target, current + amount) : current > target ? Math.max(target, current - amount) : current;

function signTexture(THREE, title, subtitle = '', accent = '#69dcff') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1024, 256);
  gradient.addColorStop(0, '#05090e');
  gradient.addColorStop(.55, '#0b1721');
  gradient.addColorStop(1, '#04070b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 20;
  ctx.lineWidth = 5;
  ctx.strokeRect(9, 9, 1006, 238);
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f5fbff';
  ctx.font = '800 66px system-ui,sans-serif';
  ctx.fillText(title, 512, subtitle ? 103 : 132);
  if (subtitle) {
    ctx.fillStyle = '#b5cbd9';
    ctx.font = '600 27px system-ui,sans-serif';
    ctx.fillText(subtitle, 512, 180);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function addSign(THREE, group, title, subtitle, position, size = [11, 2.8], rotationY = 0, accent = '#69dcff') {
  const material = new THREE.MeshBasicMaterial({ map: signTexture(THREE, title, subtitle, accent), transparent: true, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  group.add(mesh);
  return mesh;
}

function materials(THREE) {
  return {
    asphalt: new THREE.MeshStandardMaterial({ color: 0x0a0e13, roughness: .94 }),
    plaza: new THREE.MeshStandardMaterial({ color: 0x1a222b, roughness: .74, metalness: .1 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x46515b, roughness: .8, metalness: .08 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x282f37, roughness: .84 }),
    concrete2: new THREE.MeshStandardMaterial({ color: 0x4b545c, roughness: .76 }),
    black: new THREE.MeshStandardMaterial({ color: 0x05080c, roughness: .46, metalness: .34 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0c2534, roughness: .14, metalness: .46 }),
    glassBright: new THREE.MeshStandardMaterial({ color: 0x163d55, emissive: 0x052f48, emissiveIntensity: .55, roughness: .12, metalness: .38 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x69727a, roughness: .31, metalness: .8 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xcaa45f, roughness: .28, metalness: .82 }),
    goldGlow: new THREE.MeshStandardMaterial({ color: 0xf0cf79, emissive: 0x8d5d0c, emissiveIntensity: 1.8, roughness: .24, metalness: .58 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x6fe8ff, emissive: 0x0b7396, emissiveIntensity: 1.65, roughness: .22 }),
    cyanBright: new THREE.MeshBasicMaterial({ color: 0x83ecff, toneMapped: false }),
    window: new THREE.MeshStandardMaterial({ color: 0x203c4b, emissive: 0x103f58, emissiveIntensity: .82, roughness: .22, metalness: .28 }),
    water: new THREE.MeshPhysicalMaterial({ color: 0x0d7fa2, roughness: .18, metalness: .08, transparent: true, opacity: .72, transmission: .12, clearcoat: .85, clearcoatRoughness: .16 }),
    globe: new THREE.MeshPhysicalMaterial({ color: 0x0d83c8, emissive: 0x073c79, emissiveIntensity: 1.2, roughness: .13, metalness: .22, transparent: true, opacity: .88, clearcoat: .9 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x11231a, roughness: 1 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x1f5135, roughness: .92 }),
    foliage2: new THREE.MeshStandardMaterial({ color: 0x397252, roughness: .9 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x5c4430, roughness: 1 }),
    lane: new THREE.MeshBasicMaterial({ color: 0xd1b36f }),
    rock: new THREE.MeshStandardMaterial({ color: 0x27313b, roughness: .96 }),
  };
}

function box(THREE, group, size, position, material, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  group.add(mesh);
  return mesh;
}

function colliderFor(THREE, mesh, colliders, occluders, pad = 0) {
  mesh.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(mesh);
  if (pad) bounds.expandByScalar(pad);
  colliders.push(bounds);
  if (occluders) occluders.push(mesh);
  return bounds;
}

function addWindowBands(THREE, group, mat, { x, z, width, height, depth, rows = 6, columns = 5, front = 1 }) {
  const frontZ = z + front * (depth / 2 + .055);
  const usableW = width * .78;
  for (let row = 0; row < rows; row += 1) {
    const y = 2.2 + row * ((height - 4.4) / Math.max(1, rows - 1));
    for (let col = 0; col < columns; col += 1) {
      const px = x - usableW / 2 + (col + .5) * (usableW / columns);
      const cell = box(THREE, group, [Math.max(.75, usableW / columns * .7), .5, .07], [px, y, frontZ], (row + col) % 5 === 0 ? mat.goldGlow : mat.window, false);
      cell.castShadow = false;
    }
  }
}

function buildWisdoMonument(THREE, group, mat, groundMeshes, colliders) {
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(12.8, 13.7, .8, 64), mat.stone);
  basin.position.set(0, .38, -2);
  basin.receiveShadow = true;
  group.add(basin);
  groundMeshes.push(basin);
  if (colliders) colliderFor(THREE, basin, colliders, null, .08);

  const water = new THREE.Mesh(new THREE.CylinderGeometry(11.7, 11.7, .14, 64), mat.water);
  water.position.set(0, .86, -2);
  group.add(water);

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 1.8, 32), mat.black);
  pedestal.position.set(0, 1.75, -2);
  pedestal.castShadow = true;
  group.add(pedestal);

  const globe = new THREE.Mesh(new THREE.SphereGeometry(4.4, 40, 28), mat.globe);
  globe.position.set(0, 7.05, -2);
  globe.castShadow = true;
  group.add(globe);

  const latitude = [];
  for (const scaleY of [.38, .7, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, .055, 8, 72), mat.cyanBright);
    ring.position.copy(globe.position);
    ring.scale.y = scaleY;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    latitude.push(ring);
  }
  const orbitA = new THREE.Mesh(new THREE.TorusGeometry(5.45, .065, 8, 80), mat.goldGlow);
  orbitA.position.copy(globe.position);
  orbitA.rotation.set(67 * DEG, 0, 18 * DEG);
  group.add(orbitA);
  const orbitB = new THREE.Mesh(new THREE.TorusGeometry(5.8, .04, 8, 80), mat.cyanBright);
  orbitB.position.copy(globe.position);
  orbitB.rotation.set(104 * DEG, 30 * DEG, 0);
  group.add(orbitB);

  addSign(THREE, group, 'WISDO', 'DISCIPLINE CREATES FREEDOM', [0, 3.1, 2.15], [10.8, 2.25], 0, '#75e6ff');
  return { globe, water, orbitA, orbitB, latitude };
}

function buildGround(THREE, scene, mat, groundMeshes, colliders) {
  const group = new THREE.Group();
  group.name = 'CentralPlaza';
  scene.add(group);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), mat.asphalt);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  groundMeshes.push(ground);

  const boulevard = box(THREE, group, [34, .08, 220], [0, .04, 0], mat.concrete, false);
  boulevard.receiveShadow = true;
  groundMeshes.push(boulevard);
  const crossBoulevard = box(THREE, group, [220, .08, 30], [0, .045, 9], mat.concrete, false);
  crossBoulevard.receiveShadow = true;
  groundMeshes.push(crossBoulevard);

  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(38, 38, .24, 64), mat.plaza);
  plaza.position.set(0, .14, -2);
  plaza.receiveShadow = true;
  group.add(plaza);
  groundMeshes.push(plaza);

  const ring = new THREE.Mesh(new THREE.RingGeometry(34.9, 35.45, 64), mat.gold);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, .27, -2);
  group.add(ring);

  const innerRing = new THREE.Mesh(new THREE.RingGeometry(14.4, 14.72, 64), mat.cyanBright);
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.set(0, .285, -2);
  group.add(innerRing);

  for (let n = -94; n <= 94; n += 10) {
    box(THREE, group, [.15, .025, 4.4], [-12.2, .11, n], mat.lane, false);
    box(THREE, group, [.15, .025, 4.4], [12.2, .11, n], mat.lane, false);
  }

  for (const z of [26, 41]) {
    for (let x = -12; x <= 12; x += 2.4) box(THREE, group, [1.35, .03, 3.1], [x, .115, z], mat.concrete2, false);
  }

  return buildWisdoMonument(THREE, group, mat, groundMeshes, colliders);
}

function buildTradingTower(THREE, scene, mat, colliders, occluders, groundMeshes) {
  const group = new THREE.Group();
  group.name = 'TradingTowerDistrict';
  scene.add(group);

  const z = -82;
  const podium = box(THREE, group, [33, 7, 26], [0, 3.5, z], mat.black, true);
  colliderFor(THREE, podium, colliders, occluders, .08);
  const lower = box(THREE, group, [27, 34, 21], [0, 23, z], mat.glassBright, true);
  colliderFor(THREE, lower, colliders, occluders, .06);
  const mid = box(THREE, group, [22.5, 34, 18], [0, 57, z], mat.glass, true);
  colliderFor(THREE, mid, colliders, occluders, .06);
  const upper = box(THREE, group, [17.5, 22, 15], [0, 85, z], mat.glassBright, true);
  colliderFor(THREE, upper, colliders, occluders, .05);
  const crown = box(THREE, group, [11.5, 10, 11], [0, 101, z], mat.black, true);
  colliderFor(THREE, crown, colliders, occluders, .04);

  const frontZ = z + 13.05;
  box(THREE, group, [5.7, 92, .38], [0, 54, frontZ], mat.black, false);
  box(THREE, group, [1.2, 88, .44], [0, 55, frontZ + .25], mat.cyan, false);
  for (const x of [-11.4, 11.4]) box(THREE, group, [.55, 79, .55], [x, 48, z + 10.8], mat.gold, false);
  for (const x of [-7.1, 7.1]) box(THREE, group, [.26, 86, .26], [x, 53, z + 10.95], mat.cyan, false);

  for (let floor = 1; floor <= 18; floor += 1) {
    const y = 8 + floor * 4.65;
    const width = y > 75 ? 17.9 : y > 40 ? 22.9 : 27.4;
    const depth = y > 75 ? 15.4 : y > 40 ? 18.4 : 21.4;
    box(THREE, group, [width, .14, depth], [0, y, z], floor % 5 === 0 ? mat.goldGlow : mat.steel, false);
  }

  addWindowBands(THREE, group, mat, { x: 0, z, width: 27, height: 38, depth: 21, rows: 8, columns: 7, front: 1 });
  addWindowBands(THREE, group, mat, { x: 0, z, width: 22.5, height: 73, depth: 18, rows: 8, columns: 6, front: 1 });

  const entrance = box(THREE, group, [16, .75, 13], [0, .4, -66.4], mat.stone, true);
  groundMeshes.push(entrance);
  const stairs = box(THREE, group, [13, .34, 10], [0, .18, -59.7], mat.concrete2, false);
  groundMeshes.push(stairs);
  box(THREE, group, [4.3, 5.8, .45], [-2.45, 3.1, -68.8], mat.glassBright, false);
  box(THREE, group, [4.3, 5.8, .45], [2.45, 3.1, -68.8], mat.glassBright, false);

  addSign(THREE, group, 'WISDO', 'TRADING TOWER', [0, 47, -68.65], [10.5, 4.3], 0, '#6cecff');
  addSign(THREE, group, 'TRADING TOWER', 'LIVE ACCOUNTS · COMMAND · ANALYTICS', [0, 12.4, -68.62], [16.5, 3.15], 0, '#d5b96d');

  const spire = new THREE.Mesh(new THREE.CylinderGeometry(.16, .42, 12, 10), mat.goldGlow);
  spire.position.set(0, 112, z);
  group.add(spire);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(5.6, .11, 10, 64), mat.cyanBright);
  halo.position.set(0, 111, z);
  halo.rotation.x = Math.PI / 2;
  group.add(halo);

  return { halo };
}

function buildBuilding(THREE, scene, mat, destination, location, colliders, occluders) {
  const group = new THREE.Group();
  group.name = destination.id;
  scene.add(group);

  const [w, h, d] = location.size;
  const [x, , z] = location.position;
  const locked = !destination.unlocked;
  const bodyMat = location.kind === 'vault' ? mat.black : location.kind === 'arena' ? mat.glass : mat.concrete;

  const podium = box(THREE, group, [w + 4, Math.min(5.2, h * .35), d + 4], [x, Math.min(5.2, h * .35) / 2, z], mat.black, true);
  colliderFor(THREE, podium, colliders, occluders, .08);

  const upperHeight = Math.max(5, h - Math.min(5.2, h * .35));
  const taper = location.kind === 'arena' ? .84 : location.kind === 'lab' ? .78 : .9;
  const body = box(THREE, group, [w * taper, upperHeight, d * taper], [x, Math.min(5.2, h * .35) + upperHeight / 2, z], bodyMat, true);
  colliderFor(THREE, body, colliders, occluders, .06);

  const roof = box(THREE, group, [w * taper + .7, .38, d * taper + .7], [x, h + .18, z], locked ? mat.steel : mat.goldGlow, false);
  roof.castShadow = false;

  if (location.kind === 'arena') {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(w * .28, .34, 8, 48, Math.PI), locked ? mat.steel : mat.cyan);
    arch.position.set(x, h + 2.2, z);
    arch.rotation.z = Math.PI;
    group.add(arch);
  }
  if (location.kind === 'vault') {
    const vaultDoor = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, .7, 32), locked ? mat.steel : mat.gold);
    vaultDoor.rotation.x = Math.PI / 2;
    vaultDoor.position.set(x, 4.1, z + d / 2 + 2.15);
    group.add(vaultDoor);
  }

  addWindowBands(THREE, group, mat, { x, z, width: w * taper, height: h, depth: d * taper, rows: Math.max(3, Math.floor(h / 3.1)), columns: Math.max(3, Math.floor(w / 4.5)), front: 1 });

  let signZ = z + d * taper / 2 + .09;
  let rotationY = 0;
  let signX = x;
  if (z > 65) { signZ = z - d * taper / 2 - .09; rotationY = Math.PI; }
  if (Math.abs(x) > 72 && Math.abs(z) < 58) {
    signX = x - Math.sign(x) * (w * taper / 2 + .09);
    signZ = z;
    rotationY = Math.sign(x) > 0 ? -Math.PI / 2 : Math.PI / 2;
  }
  addSign(THREE, group, destination.name.toUpperCase(), destination.description?.split('.')[0] || destination.short || 'WISDO', [signX, Math.min(h - .9, 9), signZ], [Math.min(14.5, w * .78), 3.2], rotationY, locked ? '#9ba3aa' : '#6ee9ff');
  if (locked) addSign(THREE, group, 'ACCESS REQUIRED', destination.minTier || 'MEMBER', [signX, Math.min(h - 4.7, 4.7), signZ], [8.5, 1.65], rotationY, '#d5b96d');
}

function buildPalm(THREE, group, mat, x, z, scale = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.17 * scale, .28 * scale, 4.8 * scale, 9), mat.trunk);
  trunk.position.set(x, 2.4 * scale, z);
  trunk.rotation.z = (Math.sin(x * .13 + z * .08) * 3) * DEG;
  trunk.castShadow = true;
  group.add(trunk);

  const topY = 4.75 * scale;
  for (let i = 0; i < 7; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(.48 * scale, 3.1 * scale, 5), i % 2 ? mat.foliage : mat.foliage2);
    leaf.position.set(x, topY, z);
    leaf.rotation.z = 72 * DEG;
    leaf.rotation.y = (i / 7) * Math.PI * 2;
    leaf.castShadow = true;
    group.add(leaf);
  }
}

function buildProps(THREE, scene, mat, density) {
  const group = new THREE.Group();
  group.name = 'StreetProps';
  scene.add(group);

  const lampStride = density < .6 ? 25 : density < .9 ? 19 : 15;
  for (let z = -54; z <= 88; z += lampStride) {
    for (const x of [-19, 19]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, 5.4, 8), mat.steel);
      pole.position.set(x, 2.7, z);
      group.add(pole);
      box(THREE, group, [.65, .13, .38], [x, 5.25, z], mat.goldGlow, false);
    }
  }

  const palmRows = density < .6 ? [-31, 31] : [-34, -25, 25, 34];
  const palmStride = density < .6 ? 26 : 18;
  for (const x of palmRows) {
    for (let z = -48; z <= 70; z += palmStride) buildPalm(THREE, group, mat, x, z, .9 + ((Math.abs(x + z) % 5) * .025));
  }

  for (const [x, z] of [[-27, 18], [27, 18], [-27, -23], [27, -23], [-19, 33], [19, 33]]) {
    box(THREE, group, [4.2, .48, 1.2], [x, .3, z], mat.concrete2, true);
  }

  for (let i = -3; i <= 3; i += 1) {
    const left = box(THREE, group, [.38, .78, .38], [-8.7, .4, 51 + i * 3.6], mat.gold, false);
    const right = box(THREE, group, [.38, .78, .38], [8.7, .4, 51 + i * 3.6], mat.gold, false);
    left.castShadow = right.castShadow = false;
  }
}

function buildBackdrop(THREE, scene, mat, density) {
  const group = new THREE.Group();
  group.name = 'DistantBackdrop';
  scene.add(group);

  const skylineCount = Math.max(24, Math.floor(64 * density));
  for (let i = 0; i < skylineCount; i += 1) {
    const t = i / Math.max(1, skylineCount - 1);
    const x = -150 + t * 300;
    const z = -142 - (i % 4) * 8;
    const width = 7 + (i * 11 % 10);
    const depth = 8 + (i * 7 % 12);
    const height = 22 + (i * 17 % 66);
    const mesh = box(THREE, group, [width, height, depth], [x, height / 2 - 2, z], i % 5 === 0 ? mat.glassBright : mat.black, false);
    mesh.rotation.y = ((i % 7) - 3) * 1.5 * DEG;
    if (i % 2 === 0) {
      for (let y = 5; y < height - 2; y += 6) box(THREE, group, [width * .62, .12, .08], [x, y, z + depth / 2 + .05], i % 6 === 0 ? mat.goldGlow : mat.window, false);
    }
  }

  const rockCount = density < .7 ? 6 : 10;
  for (let i = 0; i < rockCount; i += 1) {
    const side = i % 2 ? -1 : 1;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(18 + (i % 3) * 7, 1), mat.rock);
    rock.scale.set(1.1, 2.4 + (i % 4) * .35, 1.05);
    rock.position.set(side * (125 + (i % 5) * 18), 26 + (i % 3) * 8, -108 + (i % 4) * 35);
    rock.rotation.set(.15 * i, .22 * i, -.06 * i);
    group.add(rock);
  }
}

function buildBoundary(THREE, scene, mat, colliders, occluders) {
  const group = new THREE.Group();
  group.name = 'WorldBoundary';
  scene.add(group);
  const edge = WORLD_CONFIG.world.halfSize + 1;
  for (const spec of [[0, -edge, 220, 2], [0, edge, 220, 2], [-edge, 0, 2, 220], [edge, 0, 2, 220]]) {
    const wall = box(THREE, group, [spec[2], 3.2, spec[3]], [spec[0], 1.6, spec[1]], mat.black, false);
    colliderFor(THREE, wall, colliders, occluders, .02);
  }
  addSign(THREE, group, 'FUTURE DISTRICT', 'EXPANSION GATE', [0, 3.3, -edge + 1.05], [13, 2.5], 0, '#d2b66b');
}

function createOperator(THREE, mat) {
  const group = new THREE.Group();
  group.name = 'WisdoOperator';
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.42, .75, 7, 12), mat.black);
  torso.position.y = 1.13;
  torso.castShadow = true;
  group.add(torso);
  const chest = box(THREE, group, [.56, .08, .44], [0, 1.3, -.33], mat.gold, false);
  chest.rotation.x = -.1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.29, 18, 14), mat.concrete2);
  head.position.y = 2.02;
  head.castShadow = true;
  group.add(head);
  const visor = box(THREE, group, [.48, .1, .08], [0, 2.07, -.25], mat.cyan, false);
  const limbs = {};
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .63, 5, 8), mat.black);
    arm.position.set(side * .54, 1.2, 0);
    arm.castShadow = true;
    group.add(arm);
    limbs[side < 0 ? 'leftArm' : 'rightArm'] = arm;
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.12, .72, 5, 8), mat.black);
    leg.position.set(side * .19, .36, 0);
    leg.castShadow = true;
    group.add(leg);
    limbs[side < 0 ? 'leftLeg' : 'rightLeg'] = leg;
  }
  group.userData.limbs = limbs;
  group.userData.head = head;
  group.userData.visor = visor;
  return group;
}

function animateOperator(operator, info) {
  const limbs = operator.userData.limbs;
  const moving = info.speed > .12 && info.grounded;
  const pace = info.state === 'SPRINT' ? 11 : info.state === 'RUN' ? 8.2 : 5.7;
  const amp = info.state === 'SPRINT' ? .82 : info.state === 'RUN' ? .62 : .4;
  const swing = moving ? Math.sin(info.elapsed * pace) * amp : 0;
  limbs.leftLeg.rotation.x = swing;
  limbs.rightLeg.rotation.x = -swing;
  limbs.leftArm.rotation.x = -swing * .75;
  limbs.rightArm.rotation.x = swing * .75;
  const airborne = !info.grounded;
  operator.position.y += airborne ? Math.sin(info.elapsed * 7) * .015 : Math.abs(Math.sin(info.elapsed * pace)) * Math.min(.035, info.speed * .005);
  operator.userData.visor.material.emissiveIntensity = info.state === 'SPRINT' ? 2.2 : 1.5;
}

function animateEnvironment(animated, elapsed) {
  if (!animated) return;
  animated.globe.rotation.y = elapsed * .09;
  animated.orbitA.rotation.z = elapsed * .16;
  animated.orbitB.rotation.y = elapsed * .12;
  animated.towerHalo.rotation.z = elapsed * .22;
  animated.water.material.opacity = .68 + Math.sin(elapsed * 1.4) * .035;
  for (let i = 0; i < animated.latitude.length; i += 1) animated.latitude[i].rotation.z = elapsed * (.025 + i * .012);
}

function circleHitsBox(x, z, radius, box3) {
  const nx = clamp(x, box3.min.x, box3.max.x);
  const nz = clamp(z, box3.min.z, box3.max.z);
  return (x - nx) * (x - nx) + (z - nz) * (z - nz) < radius * radius;
}

function derivePlayerState(grounded, speed, verticalVelocity, sprint, magnitude) {
  if (!grounded) return verticalVelocity > .35 ? 'JUMP' : 'FALL';
  if (speed < .08 || magnitude < .04) return 'IDLE';
  if (sprint && speed > WORLD_CONFIG.player.runSpeed) return 'SPRINT';
  if (speed > WORLD_CONFIG.player.walkSpeed * 1.12) return 'RUN';
  return 'WALK';
}

export async function createWorldExperience({ mount, destinations = [], preferences = {}, onInteract, onNearestChange, onReady, onPhase, onFatal, onTelemetry } = {}) {
  onPhase?.('Loading Three.js renderer');
  const THREE = await import(THREE_MODULE_URL);
  const autoQuality = chooseAutoQuality();
  let qualityName = preferences.quality && preferences.quality !== 'auto' ? preferences.quality : autoQuality;
  if (!QUALITY_PRESETS[qualityName]) qualityName = autoQuality;
  let quality = QUALITY_PRESETS[qualityName];

  onPhase?.('Initializing WebGL');
  const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dpr));
  renderer.domElement.className = 'world-canvas';
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Playable WISDO World 3D district');
  mount.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101a28);
  scene.fog = new THREE.Fog(0x152331, WORLD_CONFIG.world.fogNear, WORLD_CONFIG.world.fogFar);
  const camera = new THREE.PerspectiveCamera(WORLD_CONFIG.camera.fieldOfView, 1, .08, 460);
  const mat = materials(THREE);
  const colliders = [];
  const occluders = [];
  const groundMeshes = [];

  onPhase?.('Building cinematic WISDO Central');
  const monument = buildGround(THREE, scene, mat, groundMeshes, colliders);
  const tower = buildTradingTower(THREE, scene, mat, colliders, occluders, groundMeshes);
  for (const destination of destinations) {
    if (destination.id === 'trading-tower') continue;
    const location = WORLD_LOCATIONS[destination.id];
    if (location) buildBuilding(THREE, scene, mat, destination, location, colliders, occluders);
  }
  buildProps(THREE, scene, mat, quality.propDensity);
  buildBackdrop(THREE, scene, mat, quality.skylineDensity);
  buildBoundary(THREE, scene, mat, colliders, occluders);
  const animated = { ...monument, towerHalo: tower.halo };

  const hemi = new THREE.HemisphereLight(0x9fc8e0, 0x101115, 2.45);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd7a2, 4.05);
  sun.position.set(-58, 96, 58);
  sun.castShadow = quality.shadows;
  sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 235;
  sun.shadow.bias = -.00012;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x55bfff, 1.45);
  rim.position.set(48, 30, -70);
  scene.add(rim);
  const plazaGlow = new THREE.PointLight(0x47d9ff, 26, 42, 2.1);
  plazaGlow.position.set(0, 9, -2);
  scene.add(plazaGlow);
  const towerGlow = new THREE.PointLight(0x51dfff, 20, 72, 2.25);
  towerGlow.position.set(0, 36, -66);
  scene.add(towerGlow);

  onPhase?.('Preparing operator');
  const operator = createOperator(THREE, mat);
  scene.add(operator);
  const pos = new THREE.Vector3(...WORLD_CONFIG.player.spawn);
  const velocity = new THREE.Vector3();
  operator.position.copy(pos);
  const input = new InputManager({ canvas: renderer.domElement, sensitivity: Number(preferences.sensitivity || 1) * WORLD_CONFIG.camera.sensitivity, invertY: Boolean(preferences.invertY) });
  input.bindTouch({ joystick: document.getElementById('moveStick'), knob: document.getElementById('moveKnob'), lookZone: document.getElementById('lookZone'), jumpButton: document.getElementById('jumpBtn'), sprintButton: document.getElementById('sprintBtn'), interactButton: document.getElementById('interactBtn') });

  let yaw = 0;
  let pitch = 10 * DEG;
  let cameraDistance = WORLD_CONFIG.camera.distance;
  let grounded = true;
  let lastGroundedAt = performance.now();
  let accumulator = 0;
  let lastTime = performance.now();
  let elapsed = 0;
  let destroyed = false;
  let paused = false;
  let nearest = null;
  let lastInteractAt = 0;
  let fpsFrames = 0;
  let fpsWindow = performance.now();
  const groundRay = new THREE.Raycaster();
  const cameraRay = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const target = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const rayDirection = new THREE.Vector3();
  const playerLook = new THREE.Vector3();

  function groundHeight() {
    rayOrigin.set(pos.x, pos.y + 2.5, pos.z);
    groundRay.set(rayOrigin, down);
    groundRay.far = 5.5;
    const hit = groundRay.intersectObjects(groundMeshes, false)[0];
    return hit ? hit.point.y : null;
  }

  function moveAxis(axis, amount) {
    if (Math.abs(amount) < 1e-7) return;
    const nx = axis === 'x' ? pos.x + amount : pos.x;
    const nz = axis === 'z' ? pos.z + amount : pos.z;
    if (colliders.some((bounds) => circleHitsBox(nx, nz, WORLD_CONFIG.player.capsuleRadius, bounds))) velocity[axis] = 0;
    else pos[axis] += amount;
  }

  function updateNearest() {
    let best = null;
    let bestDistance = Infinity;
    for (const destination of destinations) {
      const location = WORLD_LOCATIONS[destination.id];
      if (!location) continue;
      const distance = Math.hypot(pos.x - location.interaction[0], pos.z - location.interaction[2]);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = destination;
      }
    }
    const next = bestDistance <= WORLD_CONFIG.world.interactionRadius ? best : null;
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
    const control = grounded ? 1 : WORLD_CONFIG.player.airControl;
    const change = (magnitude > .01 ? WORLD_CONFIG.player.acceleration : WORLD_CONFIG.player.deceleration) * control * dt;
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
    const gy = groundHeight();
    if (gy !== null) {
      const snap = grounded ? WORLD_CONFIG.player.groundSnapDistance + .16 : .09;
      if (velocity.y <= 0 && pos.y <= gy + snap) {
        pos.y = gy;
        velocity.y = 0;
        grounded = true;
        lastGroundedAt = now;
      } else if (pos.y > gy + WORLD_CONFIG.player.groundSnapDistance + .24) grounded = false;
    } else grounded = false;
    if (pos.y < WORLD_CONFIG.player.deathHeight) {
      pos.set(...WORLD_CONFIG.player.spawn);
      velocity.set(0, 0, 0);
      grounded = true;
    }
    const speed = Math.hypot(velocity.x, velocity.z);
    const pState = derivePlayerState(grounded, speed, velocity.y, frameInput.sprint, magnitude);
    if (speed > .12) {
      playerLook.set(velocity.x, 0, velocity.z).normalize();
      const wanted = Math.atan2(playerLook.x, playerLook.z);
      const delta = Math.atan2(Math.sin(wanted - operator.rotation.y), Math.cos(wanted - operator.rotation.y));
      operator.rotation.y += delta * (1 - Math.exp(-12 * dt));
    }
    operator.position.copy(pos);
    animateOperator(operator, { state: pState, speed, grounded, elapsed, verticalVelocity: velocity.y });
    updateNearest();
    if (frameInput.interactPressed && nearest && now - lastInteractAt > 360) {
      lastInteractAt = now;
      onInteract?.(nearest);
    }
    return { speed, pState };
  }

  function updateCamera(dt, sprinting) {
    target.set(pos.x, pos.y + WORLD_CONFIG.camera.targetHeight, pos.z);
    const cp = Math.cos(pitch);
    offset.set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp).multiplyScalar(WORLD_CONFIG.camera.distance);
    right.set(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(WORLD_CONFIG.camera.shoulderOffset);
    desiredCamera.copy(target).add(offset).add(right);
    rayDirection.copy(desiredCamera).sub(target);
    const distance = rayDirection.length();
    rayDirection.normalize();
    cameraRay.set(target, rayDirection);
    cameraRay.far = distance;
    const hit = cameraRay.intersectObjects(occluders, false)[0];
    const safe = hit ? clamp(hit.distance - .28, WORLD_CONFIG.camera.minDistance, distance) : distance;
    cameraDistance = damp(cameraDistance, safe, hit ? 24 : 8, dt);
    desiredCamera.copy(target).addScaledVector(rayDirection, cameraDistance);
    camera.position.lerp(desiredCamera, 1 - Math.exp(-WORLD_CONFIG.camera.damping * dt));
    camera.lookAt(target);
    const reduce = Boolean(preferences.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches);
    camera.fov = damp(camera.fov, !reduce && sprinting ? WORLD_CONFIG.camera.sprintFieldOfView : WORLD_CONFIG.camera.fieldOfView, 7, dt);
    camera.updateProjectionMatrix();
  }

  function resize() {
    const width = mount.clientWidth || innerWidth;
    const height = mount.clientHeight || innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = Math.max(.2, width / Math.max(1, height));
    camera.updateProjectionMatrix();
  }

  function setQuality(name) {
    const resolved = name === 'auto' ? chooseAutoQuality() : name;
    if (!QUALITY_PRESETS[resolved]) return;
    qualityName = resolved;
    quality = QUALITY_PRESETS[resolved];
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality.dpr));
    renderer.shadowMap.enabled = quality.shadows;
    sun.castShadow = quality.shadows;
    sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
    sun.shadow.map?.dispose?.();
    sun.shadow.map = null;
    resize();
  }

  function setPreferences(next = {}) {
    Object.assign(preferences, next);
    input.setPreferences({ sensitivity: Number(preferences.sensitivity || 1) * WORLD_CONFIG.camera.sensitivity, invertY: Boolean(preferences.invertY) });
    if (next.quality) setQuality(next.quality);
  }

  function telemetry(now) {
    if (now - fpsWindow < 1000) return;
    const fps = Math.round(fpsFrames * 1000 / (now - fpsWindow));
    fpsFrames = 0;
    fpsWindow = now;
    onTelemetry?.({ fps, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, quality: qualityName, player: { x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2), grounded } });
  }

  function frame(now) {
    if (destroyed) return;
    requestAnimationFrame(frame);
    if (paused) return;
    const dt = Math.min(WORLD_CONFIG.world.maxFrameDt, Math.max(.001, (now - lastTime) / 1000));
    lastTime = now;
    elapsed += dt;
    accumulator += dt;
    const frameInput = input.frame();
    let result = { speed: 0, pState: 'IDLE' };
    let first = true;
    while (accumulator >= WORLD_CONFIG.world.fixedDt) {
      result = physicsStep(WORLD_CONFIG.world.fixedDt, first ? frameInput : { ...frameInput, jumpPressed: false, interactPressed: false, lookX: 0, lookY: 0 }, now);
      accumulator -= WORLD_CONFIG.world.fixedDt;
      first = false;
    }
    animateEnvironment(animated, elapsed);
    updateCamera(dt, frameInput.sprint && result.speed > WORLD_CONFIG.player.runSpeed);
    renderer.render(scene, camera);
    fpsFrames += 1;
    telemetry(now);
  }

  function onVisibility() {
    paused = document.hidden;
    if (!paused) {
      lastTime = performance.now();
      accumulator = 0;
    }
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
      const mats = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of mats) {
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
  onPhase?.('WISDO World ready');
  onReady?.({ quality: qualityName, engine: 'Three.js', physics: 'fixed-step kinematic controller', visualPass: 'cinematic-plaza' });
  requestAnimationFrame(frame);
  return { mode: '3d', engine: 'Three.js', physics: 'fixed-step kinematic controller', get quality() { return qualityName; }, destroy, setQuality, setPreferences, releasePointer: () => input.releasePointer() };
}
