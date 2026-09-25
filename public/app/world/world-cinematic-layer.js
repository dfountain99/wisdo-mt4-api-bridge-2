import { WORLD_LOCATIONS } from './world-config.js';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

function seeded(seed = 1) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function addDisposable(list, value) {
  if (value) list.push(value);
  return value;
}

function basicGlow(THREE, color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
  });
}

function makeTextTexture(THREE, lines = [], { accent = '#79e8ff', width = 1024, height = 512 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, 'rgba(2,7,16,.90)');
  gradient.addColorStop(.58, 'rgba(5,13,28,.74)');
  gradient.addColorStop(1, 'rgba(5,8,18,.92)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 9;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 28;
  ctx.strokeRect(18, 18, width - 36, height - 36);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  for (let y = 52; y < height - 30; y += 42) ctx.fillRect(30, y, width - 60, 1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const safe = lines.filter(Boolean).slice(0, 4);
  safe.forEach((line, index) => {
    const isFirst = index === 0;
    ctx.font = `${isFirst ? 900 : 750} ${isFirst ? 72 : 43}px Inter,system-ui,sans-serif`;
    ctx.fillStyle = isFirst ? '#f5fbff' : index === safe.length - 1 ? '#d5b869' : accent;
    ctx.shadowColor = isFirst ? '#ffffff' : accent;
    ctx.shadowBlur = isFirst ? 10 : 20;
    const spacing = height / (safe.length + 1);
    ctx.fillText(String(line).toUpperCase(), width / 2, spacing * (index + 1));
  });
  ctx.shadowBlur = 0;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeLogoTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 150px Inter,system-ui,sans-serif';
  ctx.fillStyle = '#79e8ff';
  ctx.shadowColor = '#1ec8ff';
  ctx.shadowBlur = 35;
  ctx.fillText('W', 128, 132);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function worldTransform(THREE, source, target) {
  source.updateWorldMatrix(true, false);
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  source.matrixWorld.decompose(position, quaternion, scale);
  target.position.copy(position);
  target.quaternion.copy(quaternion);
  target.scale.copy(scale);
}

function createNightSky(THREE, scene, root, quality, disposables) {
  const oldSky = scene.getObjectByName('ProductionSky');
  const oldSkyVisible = oldSky?.visible;
  if (oldSky) oldSky.visible = false;
  const sky = new THREE.Mesh(
    addDisposable(disposables, new THREE.SphereGeometry(410, quality === 'low' ? 20 : 32, quality === 'low' ? 12 : 18)),
    addDisposable(disposables, new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        zenith: { value: new THREE.Color(0x10233f) },
        upper: { value: new THREE.Color(0x1b3a5d) },
        horizon: { value: new THREE.Color(0x355471) },
        city: { value: new THREE.Color(0x54748a) },
      },
      vertexShader: 'varying float vY; void main(){vY=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying float vY; uniform vec3 zenith; uniform vec3 upper; uniform vec3 horizon; uniform vec3 city; void main(){float h=clamp(vY*.5+.5,0.0,1.0);vec3 c=mix(city,horizon,smoothstep(.35,.5,h));c=mix(c,upper,smoothstep(.48,.72,h));c=mix(c,zenith,smoothstep(.7,1.0,h));gl_FragColor=vec4(c,1.0);}',
    })),
  );
  sky.name = 'WISDOCinematicNightSky';
  root.add(sky);

  const starCount = quality === 'low' ? 90 : quality === 'medium' ? 180 : 300;
  const positions = new Float32Array(starCount * 3);
  const random = seeded(90914);
  for (let i = 0; i < starCount; i += 1) {
    const radius = 300 + random() * 60;
    const theta = random() * TAU;
    const y = 45 + random() * 225;
    const horizontal = Math.sqrt(Math.max(1, radius * radius - y * y * .45));
    positions[i * 3] = Math.cos(theta) * horizontal;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(theta) * horizontal;
  }
  const starGeometry = addDisposable(disposables, new THREE.BufferGeometry());
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(starGeometry, addDisposable(disposables, new THREE.PointsMaterial({
    color: 0xbad9ff,
    size: quality === 'low' ? .55 : .72,
    transparent: true,
    opacity: .72,
    depthWrite: false,
    toneMapped: false,
  })));
  stars.name = 'WISDOCinematicStars';
  root.add(stars);

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 256;
  const ctx = glowCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 8, 128, 128, 125);
  gradient.addColorStop(0, 'rgba(58,205,255,.72)');
  gradient.addColorStop(.22, 'rgba(38,107,255,.30)');
  gradient.addColorStop(1, 'rgba(7,9,30,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const glowTexture = addDisposable(disposables, new THREE.CanvasTexture(glowCanvas));
  const horizonGlow = new THREE.Sprite(addDisposable(disposables, new THREE.SpriteMaterial({
    map: glowTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })));
  horizonGlow.position.set(42, 58, -180);
  horizonGlow.scale.set(220, 150, 1);
  root.add(horizonGlow);

  return () => {
    if (oldSky && oldSkyVisible !== undefined) oldSky.visible = oldSkyVisible;
  };
}

function createWetStreetVeneers(THREE, scene, root, quality, disposables) {
  const wetMaterial = addDisposable(disposables, new THREE.MeshPhysicalMaterial({
    color: 0x07101a,
    roughness: quality === 'low' ? .24 : .12,
    metalness: .42,
    clearcoat: 1,
    clearcoatRoughness: quality === 'low' ? .18 : .06,
    transparent: true,
    opacity: quality === 'low' ? .24 : .36,
    depthWrite: false,
  }));
  for (const name of ['MainAvenue', 'MarketBoulevard', 'MarketDistrictRoad']) {
    const source = scene.getObjectByName(name);
    if (!source?.geometry) continue;
    const veneer = new THREE.Mesh(addDisposable(disposables, source.geometry.clone()), wetMaterial);
    veneer.name = `CinematicWet-${name}`;
    worldTransform(THREE, source, veneer);
    veneer.position.y += .066;
    veneer.renderOrder = 3;
    root.add(veneer);
  }
}

function makeStrip(THREE, root, geometry, position, material, disposables) {
  const mesh = new THREE.Mesh(addDisposable(disposables, geometry), material);
  mesh.position.set(...position);
  mesh.renderOrder = 4;
  root.add(mesh);
  return mesh;
}

function createEnergyRoutes(THREE, root, quality, disposables) {
  const cyan = addDisposable(disposables, basicGlow(THREE, 0x40dfff, quality === 'low' ? .66 : .9));
  const blue = addDisposable(disposables, basicGlow(THREE, 0x4c70ff, quality === 'low' ? .5 : .76));
  const gold = addDisposable(disposables, basicGlow(THREE, 0xe0b65c, quality === 'low' ? .56 : .82));
  makeStrip(THREE, root, new THREE.BoxGeometry(.11, .045, 226), [-16.75, .145, 0], cyan, disposables);
  makeStrip(THREE, root, new THREE.BoxGeometry(.11, .045, 226), [16.75, .145, 0], gold, disposables);
  makeStrip(THREE, root, new THREE.BoxGeometry(226, .045, .11), [0, .15, -5.1], blue, disposables);
  makeStrip(THREE, root, new THREE.BoxGeometry(226, .045, .11), [0, .15, 25.1], cyan, disposables);
  if (quality !== 'low') {
    makeStrip(THREE, root, new THREE.BoxGeometry(.1, .04, 115), [-68.1, .15, 32], cyan, disposables);
    makeStrip(THREE, root, new THREE.BoxGeometry(.1, .04, 115), [-48.1, .15, 32], gold, disposables);
  }
}

function createDistrictBeacons(THREE, root, quality, disposables) {
  const beaconRoot = new THREE.Group();
  beaconRoot.name = 'WISDOCinematicDistrictBeacons';
  root.add(beaconRoot);
  const rows = Object.entries(WORLD_LOCATIONS);
  const limit = quality === 'low' ? 7 : rows.length;
  const animated = [];
  rows.slice(0, limit).forEach(([id, location], index) => {
    const interaction = location.interaction || location.position || [0, 0, 0];
    const x = Number(interaction[0] || 0);
    const z = Number(interaction[2] || 0);
    const accent = ['academy', 'growth-chamber', 'marketplace'].includes(id) ? 0xe0b65c : index % 3 === 0 ? 0x5f77ff : 0x42def7;
    const group = new THREE.Group();
    group.name = `DistrictBeacon-${id}`;
    group.position.set(x, .2, z);
    const material = addDisposable(disposables, basicGlow(THREE, accent, quality === 'low' ? .58 : .78));
    const ring = new THREE.Mesh(addDisposable(disposables, new THREE.TorusGeometry(1.25, .045, 8, quality === 'low' ? 24 : 48)), material);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = .12;
    group.add(ring);
    const pillar = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.028, .07, quality === 'low' ? 5 : 9, 8)), material);
    pillar.position.y = quality === 'low' ? 2.5 : 4.5;
    group.add(pillar);
    const cap = new THREE.Mesh(addDisposable(disposables, new THREE.SphereGeometry(.12, 10, 8)), material);
    cap.position.y = quality === 'low' ? 5 : 9;
    group.add(cap);
    beaconRoot.add(group);
    animated.push({ group, ring, phase: index * .7 });
  });
  return animated;
}

function createHeroArchitecture(THREE, root, quality, disposables) {
  const animated = [];
  const cyan = addDisposable(disposables, basicGlow(THREE, 0x55e6ff, .92));
  const gold = addDisposable(disposables, basicGlow(THREE, 0xe4bb61, .84));
  const violet = addDisposable(disposables, basicGlow(THREE, 0x6d66ff, .72));

  const central = new THREE.Group();
  central.name = 'WISDOCinematicCentralCrown';
  central.position.set(38, 0, -1);
  const ringSpecs = [
    [8.4, 10.5, cyan, .17],
    [10.6, 20.5, gold, -.11],
    [7.1, 31.5, violet, .21],
    [5.2, 39.5, cyan, -.25],
  ];
  for (const [radius, y, material, spin] of ringSpecs) {
    const ring = new THREE.Mesh(addDisposable(disposables, new THREE.TorusGeometry(radius, quality === 'low' ? .055 : .08, 8, quality === 'low' ? 42 : 88)), material);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    central.add(ring);
    animated.push({ ring, spin });
  }
  const core = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.055, .12, 55, 8)), cyan);
  core.position.y = 28;
  central.add(core);
  for (const x of [-8.8, 8.8]) {
    const rail = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(.08, 33, .08)), x < 0 ? cyan : gold);
    rail.position.set(x, 18, 12.1);
    central.add(rail);
  }
  root.add(central);

  const trading = new THREE.Group();
  trading.name = 'WISDOCinematicTradingSpine';
  trading.position.set(0, 0, -84);
  const spine = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(.13, 118, .13)), cyan);
  spine.position.set(0, 65, 12.45);
  trading.add(spine);
  for (const y of [24, 52, 82, 112]) {
    const halo = new THREE.Mesh(addDisposable(disposables, new THREE.TorusGeometry(8.5 - y * .025, .045, 8, 52)), y % 2 === 0 ? gold : cyan);
    halo.position.set(0, y, 0);
    halo.rotation.x = Math.PI / 2;
    trading.add(halo);
    animated.push({ ring: halo, spin: y % 4 === 0 ? .08 : -.08 });
  }
  root.add(trading);

  return animated;
}

function createHolograms(THREE, root, quality, disposables) {
  // Keep one architectural identifier. Destination names remain on façades and in the map.
  const signs = quality === 'low' ? [] : [
    { lines: ['WISDO', 'CITY HUB', 'CONNECT · COPY · CONTROL'], position: [38, 17, 15.7], scale: [10, 4.6] },
  ];
  const sprites = [];
  for (const [index, row] of signs.entries()) {
    const texture = addDisposable(disposables, makeTextTexture(THREE, row.lines, { accent: index % 2 ? '#dfbb64' : '#6fe9ff' }));
    const material = addDisposable(disposables, new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: quality === 'low' ? .76 : .9,
      depthWrite: false,
      toneMapped: false,
    }));
    const sprite = new THREE.Sprite(material);
    sprite.position.set(...row.position);
    sprite.scale.set(row.scale[0], row.scale[1], 1);
    sprite.renderOrder = 8;
    root.add(sprite);
    sprites.push({ sprite, material, phase: index * 1.7 });
  }
  return sprites;
}

function createHeroLights(THREE, scene, quality) {
  if (quality === 'low') return [];
  const lights = [];
  const centralCyan = new THREE.PointLight(0x4ddfff, quality === 'high' ? 22 : 13, quality === 'high' ? 62 : 46, 2);
  centralCyan.position.set(38, 14, 8);
  scene.add(centralCyan);
  lights.push(centralCyan);
  const centralGold = new THREE.PointLight(0xe5b661, quality === 'high' ? 17 : 10, quality === 'high' ? 48 : 36, 2);
  centralGold.position.set(38, 8, -10);
  scene.add(centralGold);
  lights.push(centralGold);
  if (quality === 'high') {
    const trading = new THREE.PointLight(0x4d8cff, 14, 45, 2);
    trading.position.set(0, 22, -70);
    scene.add(trading);
    lights.push(trading);
  }
  return lights;
}

function createDrones(THREE, root, quality, disposables) {
  const count = quality === 'low' ? 2 : quality === 'medium' ? 4 : 7;
  const drones = [];
  const dark = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x10151e, roughness: .28, metalness: .8 }));
  const cyan = addDisposable(disposables, basicGlow(THREE, 0x54e7ff, .92));
  const gold = addDisposable(disposables, basicGlow(THREE, 0xe2b960, .86));
  for (let i = 0; i < count; i += 1) {
    const group = new THREE.Group();
    group.name = `WISDOAmbientDrone-${i}`;
    const body = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(1.1, .22, .42)), dark);
    group.add(body);
    const wing = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(2.1, .05, .18)), dark);
    wing.position.y = -.02;
    group.add(wing);
    for (const x of [-.92, .92]) {
      const lamp = new THREE.Mesh(addDisposable(disposables, new THREE.SphereGeometry(.075, 8, 6)), x < 0 ? cyan : gold);
      lamp.position.set(x, 0, 0);
      group.add(lamp);
    }
    root.add(group);
    drones.push({ group, radius: 48 + i * 8, speed: .07 + (i % 3) * .017, height: 22 + (i % 4) * 7, phase: i * (TAU / count) });
  }
  return drones;
}

function createCinematicFallbackOperator(THREE, scene, disposables) {
  const operator = scene.getObjectByName('WisdoOperator');
  if (!operator) return null;
  const previousVisibility = new Map();
  for (const child of operator.children) {
    if (child.name === 'WISDOAuthoredOperatorMount') continue;
    previousVisibility.set(child, child.visible);
    child.visible = false;
  }

  const shell = new THREE.Group();
  shell.name = 'WISDOCinematicFallbackOperator';
  shell.userData.cinematicFallback = true;
  const suit = addDisposable(disposables, new THREE.MeshPhysicalMaterial({ color: 0x080b10, roughness: .32, metalness: .58, clearcoat: .72, clearcoatRoughness: .18 }));
  const suit2 = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x171c25, roughness: .42, metalness: .48 }));
  const skin = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x875c45, roughness: .72, metalness: 0 }));
  const cyan = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x75edff, emissive: 0x0b7897, emissiveIntensity: 2.1, roughness: .18, metalness: .42 }));
  const gold = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0xd0aa58, emissive: 0x5a3503, emissiveIntensity: .7, roughness: .24, metalness: .8 }));

  const torso = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.29, .36, .78, 10, 1)), suit);
  torso.position.y = 1.35;
  torso.scale.z = .72;
  shell.add(torso);
  const chest = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(.46, .15, .31)), suit2);
  chest.position.set(0, 1.46, -.035);
  shell.add(chest);
  const waist = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.23, .28, .28, 10)), suit2);
  waist.position.y = .82;
  waist.scale.z = .76;
  shell.add(waist);
  const neck = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.085, .1, .15, 10)), skin);
  neck.position.y = 1.82;
  shell.add(neck);
  const head = new THREE.Mesh(addDisposable(disposables, new THREE.SphereGeometry(.22, 16, 12)), suit2);
  head.position.y = 2.08;
  head.scale.set(.98, 1.12, .94);
  shell.add(head);
  const visor = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(.34, .115, .055)), cyan);
  visor.position.set(0, 2.09, -.2);
  shell.add(visor);

  const logoTexture = addDisposable(disposables, makeLogoTexture(THREE));
  const logoMat = addDisposable(disposables, new THREE.MeshBasicMaterial({ map: logoTexture, transparent: true, depthWrite: false, toneMapped: false }));
  const logo = new THREE.Mesh(addDisposable(disposables, new THREE.PlaneGeometry(.24, .24)), logoMat);
  logo.position.set(0, 1.48, -.247);
  shell.add(logo);
  const beltCore = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(.16, .035, .04)), gold);
  beltCore.position.set(0, .88, -.245);
  shell.add(beltCore);

  const joints = {};
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * .39, 1.58, 0);
    const shoulderPad = new THREE.Mesh(addDisposable(disposables, new THREE.SphereGeometry(.135, 12, 8)), suit2);
    shoulderPad.scale.set(1.2, .78, 1);
    shoulder.add(shoulderPad);
    const upperArm = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.085, .095, .48, 10)), suit);
    upperArm.position.y = -.25;
    shoulder.add(upperArm);
    const forearm = new THREE.Group();
    forearm.position.y = -.49;
    const forearmMesh = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.07, .085, .43, 10)), suit2);
    forearmMesh.position.y = -.21;
    forearm.add(forearmMesh);
    const wristLight = new THREE.Mesh(addDisposable(disposables, new THREE.TorusGeometry(.078, .012, 6, 16)), cyan);
    wristLight.position.y = -.38;
    wristLight.rotation.x = Math.PI / 2;
    forearm.add(wristLight);
    const hand = new THREE.Mesh(addDisposable(disposables, new THREE.SphereGeometry(.085, 10, 8)), skin);
    hand.position.y = -.46;
    hand.scale.set(.85, 1.1, .85);
    forearm.add(hand);
    shoulder.add(forearm);
    shell.add(shoulder);

    const hip = new THREE.Group();
    hip.position.set(side * .16, .7, 0);
    const thigh = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.105, .125, .55, 10)), suit);
    thigh.position.y = -.28;
    hip.add(thigh);
    const calf = new THREE.Group();
    calf.position.y = -.56;
    const calfMesh = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.085, .105, .49, 10)), suit2);
    calfMesh.position.y = -.24;
    calf.add(calfMesh);
    const shoe = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(.2, .13, .34)), suit);
    shoe.position.set(0, -.53, -.065);
    calf.add(shoe);
    hip.add(calf);
    shell.add(hip);
    joints[side < 0 ? 'leftArm' : 'rightArm'] = shoulder;
    joints[side < 0 ? 'leftFore' : 'rightFore'] = forearm;
    joints[side < 0 ? 'leftLeg' : 'rightLeg'] = hip;
    joints[side < 0 ? 'leftCalf' : 'rightCalf'] = calf;
  }
  shell.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  operator.add(shell);

  const previous = new THREE.Vector3();
  const current = new THREE.Vector3();
  operator.getWorldPosition(previous);
  let phase = 0;
  return {
    shell,
    update(dt) {
      if (!shell.visible) return;
      operator.getWorldPosition(current);
      const speed = clamp(current.distanceTo(previous) / Math.max(.001, dt), 0, 9);
      previous.copy(current);
      phase += dt * (speed > .15 ? 5.2 + speed * .65 : 1.8);
      const amplitude = speed > .12 ? clamp(speed / 5.5, .12, .82) : .025;
      const swing = Math.sin(phase) * amplitude;
      joints.leftLeg.rotation.x = swing;
      joints.rightLeg.rotation.x = -swing;
      joints.leftCalf.rotation.x = Math.max(0, -swing) * .38;
      joints.rightCalf.rotation.x = Math.max(0, swing) * .38;
      joints.leftArm.rotation.x = -swing * .62;
      joints.rightArm.rotation.x = swing * .62;
      joints.leftFore.rotation.x = -.12 + Math.max(0, swing) * .18;
      joints.rightFore.rotation.x = -.12 + Math.max(0, -swing) * .18;
    },
    destroy() {
      operator.remove(shell);
      for (const [child, visible] of previousVisibility) child.visible = visible;
    },
  };
}

function retuneExistingLights(THREE, scene) {
  const previous = [];
  for (const object of scene.children) {
    if (object.isHemisphereLight) {
      previous.push({ object, intensity: object.intensity, color: object.color.clone(), groundColor: object.groundColor?.clone?.() });
      object.intensity = 1.25;
      object.color.set(0xa9c8e8);
      object.groundColor?.set?.(0x34465c);
    } else if (object.isDirectionalLight) {
      previous.push({ object, intensity: object.intensity, color: object.color.clone() });
      object.intensity = object.castShadow ? 1.65 : .65;
      object.color.set(object.castShadow ? 0xc1d9f4 : 0x90b8dd);
    }
  }
  return () => {
    for (const row of previous) {
      row.object.intensity = row.intensity;
      row.object.color.copy(row.color);
      if (row.groundColor && row.object.groundColor) row.object.groundColor.copy(row.groundColor);
    }
  };
}

export function installCinematicWorldLayer({ THREE, scene, camera, renderer, quality = 'medium', debug = false } = {}) {
  if (!THREE || !scene || !camera || !renderer) throw new TypeError('Cinematic World layer requires the active Three.js scene.');
  const safeQuality = ['low', 'medium', 'high'].includes(quality) ? quality : 'medium';
  const root = new THREE.Group();
  root.name = 'WISDOCinematicVisualDirector';
  scene.add(root);
  const disposables = [];
  const previousBackground = scene.background;
  const previousFog = scene.fog;
  const previousExposure = renderer.toneMappingExposure;
  const previousClearColor = renderer.getClearColor?.(new THREE.Color())?.clone?.() || null;
  const previousClearAlpha = renderer.getClearAlpha?.() ?? 1;

  scene.background = new THREE.Color(0x1b3552);
  scene.fog = new THREE.FogExp2(0x304862, safeQuality === 'low' ? .0046 : safeQuality === 'medium' ? .0038 : .0034);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = safeQuality === 'low' ? 1.3 : 1.18;
  renderer.setClearColor?.(0x1b3552, 1);

  const restoreSky = createNightSky(THREE, scene, root, safeQuality, disposables);
  const restoreLights = retuneExistingLights(THREE, scene);
  const groundShade = new THREE.Mesh(addDisposable(disposables, new THREE.PlaneGeometry(250, 250)), addDisposable(disposables, new THREE.MeshStandardMaterial({
    color: 0x152539,
    roughness: .93,
    metalness: .02,
    transparent: true,
    opacity: safeQuality === 'low' ? .18 : .24,
    depthWrite: false,
  })));
  groundShade.rotation.x = -Math.PI / 2;
  groundShade.position.y = -.025;
  groundShade.receiveShadow = true;
  root.add(groundShade);

  createWetStreetVeneers(THREE, scene, root, safeQuality, disposables);
  createEnergyRoutes(THREE, root, safeQuality, disposables);
  const beacons = createDistrictBeacons(THREE, root, safeQuality, disposables);
  const heroAnimated = createHeroArchitecture(THREE, root, safeQuality, disposables);
  const holograms = createHolograms(THREE, root, safeQuality, disposables);
  const lights = createHeroLights(THREE, scene, safeQuality);
  const drones = createDrones(THREE, root, safeQuality, disposables);
  const fallbackOperator = createCinematicFallbackOperator(THREE, scene, disposables);

  const diagnostics = Object.freeze({
    active: true,
    visualPass: 'cinematic-city-v1',
    quality: safeQuality,
    wetStreets: true,
    districtBeacons: beacons.length,
    holograms: holograms.length,
    ambientDrones: drones.length,
    heroLights: lights.length,
    cinematicFallbackOperator: Boolean(fallbackOperator),
    executionFromVisualLayer: false,
    installedAt: new Date().toISOString(),
  });
  globalThis.WisdoCinematicDiagnostics = diagnostics;
  document.documentElement.dataset.wisdoVisualPass = 'cinematic-city-v1';
  window.dispatchEvent(new CustomEvent('wisdo:cinematic-ready', { detail: diagnostics }));
  if (debug) console.debug('[WISDO CINEMATIC WORLD]', diagnostics);

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
    for (const row of heroAnimated) row.ring.rotation.z += row.spin * dt;
    for (const row of beacons) {
      row.ring.rotation.z += dt * .34;
      row.group.position.y = .2 + Math.sin(elapsed * 1.4 + row.phase) * .035;
    }
    for (const row of holograms) row.material.opacity = (safeQuality === 'low' ? .68 : .8) + Math.sin(elapsed * 1.15 + row.phase) * .08;
    for (const drone of drones) {
      const angle = elapsed * drone.speed + drone.phase;
      drone.group.position.set(Math.cos(angle) * drone.radius + 12, drone.height + Math.sin(angle * 2.3) * 1.8, Math.sin(angle) * drone.radius - 8);
      drone.group.rotation.y = -angle + Math.PI / 2;
      drone.group.rotation.z = Math.sin(angle * 1.7) * .08;
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
      restoreSky?.();
      restoreLights?.();
      for (const light of lights) scene.remove(light);
      scene.remove(root);
      scene.background = previousBackground;
      scene.fog = previousFog;
      renderer.toneMappingExposure = previousExposure;
      if (previousClearColor) renderer.setClearColor?.(previousClearColor, previousClearAlpha);
      for (const item of disposables.reverse()) item?.dispose?.();
      delete globalThis.WisdoCinematicDiagnostics;
      delete document.documentElement.dataset.wisdoVisualPass;
    },
  };
}
