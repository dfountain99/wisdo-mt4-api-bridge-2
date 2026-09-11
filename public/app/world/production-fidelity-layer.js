import { WORLD_LOCATIONS } from './world-config.js';
import { createMarketBillboardManager } from './markets/market-billboard-manager.js';

const DEG = Math.PI / 180;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function fidelityQuality() {
  const coarse = matchMedia?.('(pointer: coarse)')?.matches;
  const memory = Number(navigator.deviceMemory || 4);
  const cores = Number(navigator.hardwareConcurrency || 4);
  if (coarse || memory <= 4 || cores <= 4) return 'low';
  if (memory >= 8 && cores >= 8 && devicePixelRatio <= 2) return 'high';
  return 'medium';
}

function disposeTree(root) {
  root?.traverse?.((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose?.();
      material.dispose?.();
    }
  });
  root?.parent?.remove?.(root);
}

function createMaterialBible(THREE) {
  return Object.freeze({
    obsidian: new THREE.MeshPhysicalMaterial({ color: 0x05080c, roughness: .34, metalness: .58, clearcoat: .45, clearcoatRoughness: .28 }),
    blackMetal: new THREE.MeshStandardMaterial({ color: 0x0c1117, roughness: .26, metalness: .86 }),
    goldMetal: new THREE.MeshStandardMaterial({ color: 0xcaa65e, roughness: .26, metalness: .9 }),
    goldGlow: new THREE.MeshStandardMaterial({ color: 0xe6c36f, emissive: 0x6e4708, emissiveIntensity: 1.28, roughness: .22, metalness: .76 }),
    darkGlass: new THREE.MeshPhysicalMaterial({ color: 0x102b3a, roughness: .09, metalness: .32, transparent: true, opacity: .84, transmission: .08, clearcoat: .82, clearcoatRoughness: .12 }),
    glassLit: new THREE.MeshPhysicalMaterial({ color: 0x173d4f, emissive: 0x08283b, emissiveIntensity: .64, roughness: .11, metalness: .24, clearcoat: .74 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x303941, roughness: .78, metalness: .08 }),
    concreteDark: new THREE.MeshStandardMaterial({ color: 0x161d24, roughness: .82, metalness: .08 }),
    plazaStone: new THREE.MeshPhysicalMaterial({ color: 0x34414b, roughness: .43, metalness: .12, clearcoat: .28, clearcoatRoughness: .36 }),
    road: new THREE.MeshPhysicalMaterial({ color: 0x080d12, roughness: .62, metalness: .1, clearcoat: .2, clearcoatRoughness: .42 }),
    curb: new THREE.MeshStandardMaterial({ color: 0x5b646b, roughness: .72, metalness: .08 }),
    cyanData: new THREE.MeshStandardMaterial({ color: 0x68e7ff, emissive: 0x0a6a89, emissiveIntensity: 1.45, roughness: .18, metalness: .2 }),
    cyanFlat: new THREE.MeshBasicMaterial({ color: 0x7beaff, transparent: true, opacity: .84, toneMapped: false }),
    windowWarm: new THREE.MeshStandardMaterial({ color: 0x60552f, emissive: 0x4c3709, emissiveIntensity: .9, roughness: .24, metalness: .18 }),
    windowCool: new THREE.MeshStandardMaterial({ color: 0x21495c, emissive: 0x103b53, emissiveIntensity: .82, roughness: .22, metalness: .2 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x234a35, roughness: .9 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x543f2e, roughness: .95 }),
  });
}

function mesh(THREE, geometry, material, position, { rotation = null, cast = false, receive = false, name = '' } = {}) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  if (rotation) object.rotation.set(...rotation);
  object.castShadow = cast;
  object.receiveShadow = receive;
  if (name) object.name = name;
  return object;
}

function canvasLabel(THREE, title, subtitle = '', accent = '#73e8ff') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 1024, 256);
  g.addColorStop(0, '#03070b'); g.addColorStop(.55, '#0a141c'); g.addColorStop(1, '#030609');
  ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#caa65e'; ctx.lineWidth = 5; ctx.strokeRect(9, 9, 1006, 238);
  ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.strokeRect(20, 20, 984, 216);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f7fbfd'; ctx.font = '900 66px system-ui,sans-serif'; ctx.fillText(title, 512, subtitle ? 102 : 132);
  if (subtitle) { ctx.fillStyle = '#9db9c7'; ctx.font = '700 26px system-ui,sans-serif'; ctx.fillText(subtitle, 512, 180); }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addArchitecturalSign(THREE, group, title, subtitle, position, size, rotationY = 0) {
  const panel = mesh(THREE, new THREE.BoxGeometry(size[0] + .55, size[1] + .4, .24), new THREE.MeshStandardMaterial({ color: 0x06090d, roughness: .25, metalness: .8 }), position);
  panel.rotation.y = rotationY;
  group.add(panel);
  const face = mesh(THREE, new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ map: canvasLabel(THREE, title, subtitle), toneMapped: false }), [position[0], position[1], position[2]]);
  face.rotation.y = rotationY;
  const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
  face.position.addScaledVector(normal, .14);
  group.add(face);
}

function enhanceGround(THREE, root, mat, quality) {
  const group = new THREE.Group(); group.name = 'ProductionGroundLayer'; root.add(group);
  const boulevard = mesh(THREE, new THREE.BoxGeometry(24, .07, 150), mat.plazaStone, [0, .155, 34], { receive: true }); group.add(boulevard);
  const median = mesh(THREE, new THREE.BoxGeometry(7.8, .09, 150), mat.concreteDark, [0, .205, 34], { receive: true }); group.add(median);
  const roadL = mesh(THREE, new THREE.BoxGeometry(18, .055, 175), mat.road, [-24, .125, 28], { receive: true }); group.add(roadL);
  const roadR = roadL.clone(); roadR.position.x = 24; group.add(roadR);
  for (const x of [-13.1, 13.1]) group.add(mesh(THREE, new THREE.BoxGeometry(.48, .22, 160), mat.curb, [x, .23, 31], { receive: true }));
  const tileCount = quality === 'low' ? 28 : 48;
  const jointMat = new THREE.MeshBasicMaterial({ color: 0x1f2c35, transparent: true, opacity: .72 });
  for (let i = 0; i < tileCount; i += 1) {
    const z = -30 + i * (145 / tileCount);
    group.add(mesh(THREE, new THREE.BoxGeometry(23.5, .012, .055), jointMat, [0, .205, z]));
  }
  for (const x of [-8, -4, 4, 8]) group.add(mesh(THREE, new THREE.BoxGeometry(.05, .013, 145), jointMat, [x, .207, 34]));
  const wetMat = new THREE.MeshPhysicalMaterial({ color: 0x183445, roughness: .18, metalness: .12, clearcoat: .8, transparent: true, opacity: .34 });
  if (quality !== 'low') {
    for (const [x, z, w, d] of [[-7,32,4.8,18],[7,12,5.2,14],[-5,-32,3.6,12],[5,61,4.5,16]]) {
      group.add(mesh(THREE, new THREE.PlaneGeometry(w, d), wetMat, [x, .221, z], { rotation: [-Math.PI/2,0,0] }));
    }
  }
  return group;
}

function buildStreetFurniture(THREE, root, mat, quality) {
  const group = new THREE.Group(); group.name = 'ProductionStreetFurniture'; root.add(group);
  const density = quality === 'low' ? .55 : quality === 'high' ? 1 : .78;
  const lampPositions = [];
  for (let z = -48; z <= 86; z += Math.round(18 / density)) for (const x of [-15.6, 15.6]) lampPositions.push([x, z]);
  for (const [x, z] of lampPositions) {
    group.add(mesh(THREE, new THREE.CylinderGeometry(.065, .09, 5.8, 8), mat.blackMetal, [x, 2.9, z], { cast: quality === 'high' }));
    group.add(mesh(THREE, new THREE.BoxGeometry(.72, .12, .34), mat.goldGlow, [x, 5.66, z]));
  }
  for (let z = -38; z <= 78; z += quality === 'low' ? 18 : 12) for (const x of [-9.7, 9.7]) {
    group.add(mesh(THREE, new THREE.CylinderGeometry(.12, .16, .78, 8), mat.goldMetal, [x, .39, z]));
  }
  const planterSpots = [[-18,18],[18,18],[-18,-18],[18,-18],[-18,50],[18,50]];
  for (const [x,z] of planterSpots) {
    group.add(mesh(THREE, new THREE.BoxGeometry(4.6, .75, 2.2), mat.concreteDark, [x,.38,z], { cast:true, receive:true }));
    group.add(mesh(THREE, new THREE.BoxGeometry(4.1, .4, 1.7), mat.foliage, [x,.78,z]));
  }
  const benchSpots = [[-11,24],[11,24],[-11,58],[11,58]];
  for (const [x,z] of benchSpots) {
    group.add(mesh(THREE, new THREE.BoxGeometry(3.2,.18,.78), mat.blackMetal, [x,.55,z], { cast:true }));
    group.add(mesh(THREE, new THREE.BoxGeometry(3.2,.9,.14), mat.blackMetal, [x,1.02,z+.34], { cast:true }));
  }
  return group;
}

function addFacadeSkin(THREE, targetGroup, location, mat, destination) {
  if (!targetGroup || !location) return;
  const group = new THREE.Group(); group.name = 'ProductionFacadeSkin'; targetGroup.add(group);
  const [w,h,d] = location.size;
  const [x,,z] = location.position;
  const frontSign = z > 65 ? -1 : 1;
  const frontZ = z + frontSign * (d * .46 + .34);
  const columns = Math.max(3, Math.min(8, Math.floor(w / 4)));
  for (let c = 0; c <= columns; c += 1) {
    const px = x - w * .4 + c * (w * .8 / columns);
    group.add(mesh(THREE, new THREE.BoxGeometry(.16, Math.max(6,h*.75), .24), c % 2 ? mat.blackMetal : mat.goldMetal, [px, Math.max(6,h*.75)/2 + 1.4, frontZ]));
  }
  const floorStride = 3.1;
  for (let y = 3.4; y < h - 1; y += floorStride) {
    const stripMat = Math.round(y/floorStride) % 4 === 0 ? mat.goldGlow : mat.windowCool;
    group.add(mesh(THREE, new THREE.BoxGeometry(w*.72, .17, .16), stripMat, [x,y,frontZ + frontSign*.08]));
  }
  const entranceZ = z + frontSign * (d/2 + .55);
  group.add(mesh(THREE, new THREE.BoxGeometry(Math.min(7,w*.38), 4.8, .44), mat.darkGlass, [x,2.4,entranceZ], { cast:true }));
  group.add(mesh(THREE, new THREE.BoxGeometry(Math.min(10,w*.55), .34, 4.2), mat.blackMetal, [x,4.95,entranceZ - frontSign*1.65], { cast:true }));
  group.add(mesh(THREE, new THREE.BoxGeometry(Math.min(10,w*.55), .13, 4.25), mat.goldGlow, [x,5.13,entranceZ - frontSign*1.65]));
  addArchitecturalSign(THREE, group, String(destination?.name || targetGroup.name || 'WISDO').toUpperCase(), String(destination?.short || 'WISDO CENTRAL').toUpperCase(), [x, Math.min(8.5,h*.55), frontZ + frontSign*.2], [Math.min(10,w*.58),2.1], frontSign < 0 ? Math.PI : 0);
}

function enhanceTradingTower(THREE, scene, mat, quality) {
  const tower = scene.getObjectByName('TradingTowerDistrict');
  if (!tower || tower.getObjectByName('ProductionTowerSkin')) return;
  const skin = new THREE.Group(); skin.name = 'ProductionTowerSkin'; tower.add(skin);
  const z = -82;
  for (const x of [-14.3,-10.4,10.4,14.3]) {
    skin.add(mesh(THREE, new THREE.BoxGeometry(.38, 93, .5), x % 2 ? mat.goldMetal : mat.blackMetal, [x,52,z+10.8]));
  }
  for (let y = 10; y <= 96; y += 4.6) {
    skin.add(mesh(THREE, new THREE.BoxGeometry(24 - Math.max(0,(y-35)*.08), .12, .3), y % 18 < 5 ? mat.goldGlow : mat.windowCool, [0,y,z+11.35]));
  }
  const crownY = 109;
  for (const x of [-5.2,-2.6,0,2.6,5.2]) {
    const fin = mesh(THREE, new THREE.BoxGeometry(.28, 13 - Math.abs(x)*.5, 2.3), x === 0 ? mat.cyanData : mat.goldMetal, [x,crownY,z], { cast: quality === 'high' });
    fin.rotation.z = x * .012;
    skin.add(fin);
  }
  const lobby = mesh(THREE, new THREE.BoxGeometry(22, 6.2, 9.4), mat.darkGlass, [0,3.2,-66.8], { cast:true }); skin.add(lobby);
  for (const x of [-9.6,9.6]) skin.add(mesh(THREE, new THREE.BoxGeometry(.52,7.2,.7), mat.goldMetal, [x,3.6,-63.2]));
  skin.add(mesh(THREE, new THREE.BoxGeometry(22.5,.28,6.8), mat.blackMetal, [0,6.35,-63.4], { cast:true }));
  skin.add(mesh(THREE, new THREE.BoxGeometry(18,.08,6.9), mat.goldGlow, [0,6.53,-63.4]));
  addArchitecturalSign(THREE, skin, 'WISDO', 'TRADING TOWER · COMMAND · ANALYTICS', [0,14.5,-68.4], [15.5,3.2], 0);
  if (quality !== 'low') {
    const spotL = new THREE.SpotLight(0x55dbff, 850, 75, 24*DEG, .42, 1.8); spotL.position.set(-8,10,-57); spotL.target.position.set(0,25,-82); scene.add(spotL, spotL.target);
    const spotR = new THREE.SpotLight(0xd2ad5f, 650, 68, 22*DEG, .46, 1.8); spotR.position.set(8,10,-57); spotR.target.position.set(0,20,-82); scene.add(spotR, spotR.target);
  }
}

function enhanceGlobe(THREE, scene, mat, quality) {
  const plaza = scene.getObjectByName('CentralPlaza');
  if (!plaza || plaza.getObjectByName('ProductionGlobeNetwork')) return;
  const group = new THREE.Group(); group.name = 'ProductionGlobeNetwork'; plaza.add(group);
  const center = new THREE.Vector3(0,7.05,-2);
  const count = quality === 'low' ? 8 : quality === 'high' ? 18 : 12;
  const points = [];
  for (let i=0;i<count;i+=1) {
    const phi = Math.acos(1 - 2 * (i + .5) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const p = new THREE.Vector3(Math.sin(phi)*Math.cos(theta), Math.cos(phi), Math.sin(phi)*Math.sin(theta)).multiplyScalar(4.55).add(center);
    points.push(p);
    group.add(mesh(THREE, new THREE.SphereGeometry(.1,10,8), i%4===0 ? mat.goldGlow : mat.cyanData, [p.x,p.y,p.z]));
  }
  for (let i=0;i<points.length;i+=1) {
    const a=points[i], b=points[(i*5+3)%points.length];
    const mid=a.clone().add(b).multiplyScalar(.5); mid.y += 1.2 + (i%3)*.35;
    const curve=new THREE.QuadraticBezierCurve3(a,mid,b);
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(18)), new THREE.LineBasicMaterial({ color:i%4===0?0xd2ad63:0x69e5ff, transparent:true, opacity:.44 }));
    group.add(line);
  }
}

function addDistantSkyline(THREE, scene, mat, quality) {
  const group = new THREE.Group(); group.name = 'ProductionSkyline'; scene.add(group);
  const count = quality === 'low' ? 38 : quality === 'high' ? 92 : 64;
  const geometry = new THREE.BoxGeometry(1,1,1);
  const towerMat = mat.obsidian;
  const windowsMat = mat.windowCool;
  const towers = new THREE.InstancedMesh(geometry, towerMat, count);
  const windows = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,.05), windowsMat, count);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3(); const scale = new THREE.Vector3(); const quat = new THREE.Quaternion();
  for (let i=0;i<count;i+=1) {
    const ring = i % 2;
    const angle = -Math.PI*.95 + (i/(count-1))*Math.PI*1.9;
    const radius = 150 + ring*28 + (i%5)*5;
    const x = Math.sin(angle)*radius;
    const z = -45 - Math.cos(angle)*radius*.78;
    const h = 28 + ((i*17)%78);
    const w = 6 + ((i*11)%10);
    const d = 7 + ((i*7)%9);
    position.set(x,h/2-1.5,z); scale.set(w,h,d); matrix.compose(position,quat,scale); towers.setMatrixAt(i,matrix);
    const frontZ = z + d/2 + .04; position.set(x,h/2,frontZ); scale.set(w*.66,h*.72,1); matrix.compose(position,quat,scale); windows.setMatrixAt(i,matrix);
  }
  towers.instanceMatrix.needsUpdate = true; windows.instanceMatrix.needsUpdate = true;
  group.add(towers, windows);
}

function applyBlueHour(scene, THREE, mat, quality) {
  scene.background = new THREE.Color(0x0b1725);
  if (scene.fog) { scene.fog.color.set(0x102333); scene.fog.near = 72; scene.fog.far = quality === 'low' ? 245 : 330; }
  const ambient = new THREE.HemisphereLight(0x86b7d2, 0x090b10, quality === 'low' ? .65 : .92); scene.add(ambient);
  const key = new THREE.DirectionalLight(0x9bbbd2, quality === 'low' ? .8 : 1.15); key.position.set(-75,110,45); scene.add(key);
  const warm = new THREE.DirectionalLight(0xffc47b, .42); warm.position.set(50,28,65); scene.add(warm);
  const globeLight = new THREE.PointLight(0x4bdcff, quality === 'low' ? 8 : 15, 46, 2); globeLight.position.set(0,9,-2); scene.add(globeLight);
  const boulevardLight = new THREE.PointLight(0xd1aa5b, quality === 'low' ? 5 : 9, 34, 2.2); boulevardLight.position.set(0,7,42); scene.add(boulevardLight);
}

function skinDestinationBuildings(THREE, scene, mat, destinations) {
  const byId = new Map((destinations || []).map((d) => [d.id,d]));
  for (const [id, location] of Object.entries(WORLD_LOCATIONS)) {
    if (id === 'trading-tower') continue;
    const group = scene.getObjectByName(id);
    if (!group || group.getObjectByName('ProductionFacadeSkin')) continue;
    addFacadeSkin(THREE, group, location, mat, byId.get(id));
  }
}

function buildEnhancedOperator(THREE, parent, identity, mat) {
  const originalChildren = [...parent.children];
  originalChildren.forEach((child) => { child.visible = false; });
  const root = new THREE.Group(); root.name = 'ProductionWisdoOperator'; parent.add(root);
  const skinMap = { 'neutral-1':0xf1c7a8,'neutral-2':0xe6b28d,'neutral-3':0xc98b67,'neutral-4':0xa86749,'neutral-5':0x865039,'neutral-6':0x673d2e,'neutral-7':0x4e3025,'neutral-8':0x35231d };
  const skin = new THREE.MeshStandardMaterial({ color: skinMap[identity?.skinMaterial] || 0x9e6b50, roughness:.58 });
  const cloth = new THREE.MeshStandardMaterial({ color: identity?.outfit === 'cem-operator-midnight' ? 0x111f2a : identity?.outfit === 'cem-operator-formal' ? 0x17191e : 0x080c11, roughness:.52, metalness:.18 });
  const cloth2 = new THREE.MeshStandardMaterial({ color:0x1c242b, roughness:.46, metalness:.2 });
  const gold = mat.goldMetal;
  const bodyPreset = identity?.bodyPreset || 'balanced';
  const shoulder = bodyPreset === 'broad' ? 1.1 : bodyPreset === 'athletic' ? 1.02 : bodyPreset === 'slim' ? .9 : .96;
  const height = identity?.heightSetting === 'tall' ? 1.08 : identity?.heightSetting === 'short' ? .94 : 1;
  root.scale.set(shoulder, height, shoulder*.96);
  const pelvis = new THREE.Group(); pelvis.position.y=.82; root.add(pelvis);
  pelvis.add(mesh(THREE,new THREE.BoxGeometry(.52,.3,.3),cloth,[0,0,0],{cast:true}));
  const torso = mesh(THREE,new THREE.CapsuleGeometry(.34,.72,8,14),cloth,[0,1.05,0],{cast:true}); root.add(torso);
  root.add(mesh(THREE,new THREE.BoxGeometry(.58,.12,.09),gold,[0,1.27,-.33]));
  root.add(mesh(THREE,new THREE.BoxGeometry(.2,.05,.035),mat.cyanData,[0,1.27,-.39]));
  const neck = mesh(THREE,new THREE.CylinderGeometry(.1,.12,.18,12),skin,[0,1.62,0],{cast:true}); root.add(neck);
  const head = mesh(THREE,new THREE.SphereGeometry(.27,24,18),skin,[0,1.91,0],{cast:true}); head.scale.set(identity?.headPreset==='oval'?.92:1,identity?.headPreset==='round'?.94:1.06,.96); root.add(head);
  const hairPreset=identity?.hairPreset || 'close';
  if (hairPreset !== 'none') {
    const hair = mesh(THREE,new THREE.SphereGeometry(.276,20,12,0,Math.PI*2,0,Math.PI*.48),new THREE.MeshStandardMaterial({color:0x11100e,roughness:.86}),[0,1.975,0],{cast:true});
    hair.scale.y = hairPreset.includes('locs') || hairPreset.includes('curls') ? 1.15 : 1; root.add(hair);
  }
  const faceVisor = mesh(THREE,new THREE.BoxGeometry(.34,.035,.04),mat.cyanData,[0,1.91,-.264]); root.add(faceVisor);
  const joints = {};
  for (const side of [-1,1]) {
    const armRoot=new THREE.Group(); armRoot.position.set(side*.43,1.37,0); root.add(armRoot);
    const upper=mesh(THREE,new THREE.CapsuleGeometry(.085,.42,6,10),cloth2,[0,-.26,0],{cast:true}); armRoot.add(upper);
    const fore=new THREE.Group(); fore.position.set(0,-.53,0); armRoot.add(fore);
    fore.add(mesh(THREE,new THREE.CapsuleGeometry(.075,.34,6,10),cloth,[0,-.22,0],{cast:true}));
    fore.add(mesh(THREE,new THREE.SphereGeometry(.095,12,10),skin,[0,-.48,0],{cast:true}));
    const legRoot=new THREE.Group(); legRoot.position.set(side*.17,.71,0); root.add(legRoot);
    legRoot.add(mesh(THREE,new THREE.CapsuleGeometry(.105,.48,6,10),cloth,[0,-.31,0],{cast:true}));
    const calf=new THREE.Group(); calf.position.set(0,-.61,0); legRoot.add(calf);
    calf.add(mesh(THREE,new THREE.CapsuleGeometry(.092,.44,6,10),cloth2,[0,-.28,0],{cast:true}));
    const shoe=mesh(THREE,new THREE.BoxGeometry(.22,.14,.39),mat.obsidian,[0,-.56,-.08],{cast:true}); calf.add(shoe);
    joints[side<0?'leftArm':'rightArm']=armRoot; joints[side<0?'leftFore':'rightFore']=fore; joints[side<0?'leftLeg':'rightLeg']=legRoot; joints[side<0?'leftCalf':'rightCalf']=calf;
  }
  root.userData.joints=joints; root.userData.lastWorld=new THREE.Vector3(); root.userData.speed=0; root.userData.phase=0;
  return { root, originalChildren };
}

function animateEnhancedOperator(THREE, operator, enhanced, dt, elapsed) {
  if (!operator || !enhanced?.root) return;
  const world = new THREE.Vector3(); operator.getWorldPosition(world);
  const last = enhanced.root.userData.lastWorld;
  if (last.lengthSq() === 0) last.copy(world);
  const speed = clamp(world.distanceTo(last) / Math.max(dt,.001),0,10); last.copy(world);
  enhanced.root.userData.speed = speed;
  enhanced.root.userData.phase += dt * (speed > 6 ? 10.2 : speed > 2.7 ? 7.6 : 4.8);
  const phase=enhanced.root.userData.phase; const joints=enhanced.root.userData.joints;
  const moving=speed>.16; const amp=moving ? clamp(speed/8,.18,.85) : .035;
  const swing=Math.sin(phase)*amp;
  joints.leftLeg.rotation.x=swing; joints.rightLeg.rotation.x=-swing;
  joints.leftCalf.rotation.x=Math.max(0,-swing)*.44; joints.rightCalf.rotation.x=Math.max(0,swing)*.44;
  joints.leftArm.rotation.x=-swing*.58; joints.rightArm.rotation.x=swing*.58;
  joints.leftFore.rotation.x=-.14+Math.max(0,swing)*.25; joints.rightFore.rotation.x=-.14+Math.max(0,-swing)*.25;
  enhanced.root.position.y = moving ? Math.abs(Math.sin(phase*2))*.018 : Math.sin(elapsed*1.45)*.006;
}

async function safeJson(url) {
  const response = await fetch(url, { credentials:'same-origin', cache:'no-store' });
  const body = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(body.error || `Request failed: ${response.status}`);
  return body;
}

export async function installProductionFidelity({ THREE, scene, camera, renderer, destinations = [], debug = false } = {}) {
  if (!THREE || !scene || !camera || !renderer) throw new TypeError('Production fidelity layer requires the active Three.js scene.');
  const quality = fidelityQuality();
  const mat = createMaterialBible(THREE);
  const root = new THREE.Group(); root.name='WISDOProductionFidelity'; scene.add(root);
  applyBlueHour(scene, THREE, mat, quality);
  enhanceGround(THREE, root, mat, quality);
  buildStreetFurniture(THREE, root, mat, quality);
  skinDestinationBuildings(THREE, scene, mat, destinations);
  enhanceTradingTower(THREE, scene, mat, quality);
  enhanceGlobe(THREE, scene, mat, quality);
  addDistantSkyline(THREE, scene, mat, quality);

  const operator = scene.getObjectByName('WisdoOperator');
  let identity = globalThis.WisdoIdentityMirror?.operator || null;
  let enhancedOperator = operator ? buildEnhancedOperator(THREE, operator, identity, mat) : null;
  const avatarListener = (event) => {
    if (!operator || !event.detail?.operator) return;
    const old = enhancedOperator?.root;
    if (old) { old.parent?.remove(old); disposeTree(old); }
    identity = event.detail.operator;
    enhancedOperator = buildEnhancedOperator(THREE, operator, identity, mat);
  };
  window.addEventListener('wisdo:avatar-updated', avatarListener);

  const marketManager = createMarketBillboardManager({ THREE, scene, camera, qualityName: quality, onChanged: ({ markets, billboardCount }) => {
    const anchors = marketManager?.anchors || [];
    globalThis.WisdoWorldDiagnostics = {
      ...(globalThis.WisdoWorldDiagnostics || {}),
      activeSymbols: markets.map((m)=>m.symbol),
      authorizedParticipants: markets.reduce((sum,m)=>sum+Number(m.activeOperatorCount||0),0),
      activeBillboards: billboardCount,
      billboardAnchorAssignments: markets.slice(0,anchors.length).map((m,i)=>({symbol:m.symbol,anchorId:anchors[i]?.id||null,district:anchors[i]?.district||null})),
      fidelityQuality: quality,
      fakeCandlesAllowed: false,
    };
  }});
  let marketTimer = null;
  let marketRefreshBusy = false;
  async function refreshMarkets() {
    if (marketRefreshBusy) return;
    marketRefreshBusy = true;
    try {
      const payload = await safeJson('/api/world/markets/active');
      const markets = Array.isArray(payload.markets) ? payload.markets : [];
      marketManager.setMarkets(markets);
      if (debug) console.debug('[WISDO WORLD MARKETS]', globalThis.WisdoWorldDiagnostics);
    } catch (error) {
      if (debug && !String(error.message).includes('Authentication')) console.debug('[WISDO WORLD MARKETS] unavailable', error.message);
    } finally { marketRefreshBusy=false; }
  }
  await refreshMarkets().catch(()=>{});
  marketTimer = setInterval(refreshMarkets, 5000);

  let destroyed=false; let frameId=0; let last=performance.now(); let elapsed=0;
  const animate=(now)=>{
    if (destroyed) return;
    frameId=requestAnimationFrame(animate);
    const dt=Math.min(.05,Math.max(.001,(now-last)/1000)); last=now; elapsed+=dt;
    animateEnhancedOperator(THREE,operator,enhancedOperator,dt,elapsed);
    marketManager.update(dt,elapsed);
  };
  frameId=requestAnimationFrame(animate);

  return {
    quality,
    diagnostics: globalThis.WisdoWorldDiagnostics,
    destroy() {
      destroyed=true; cancelAnimationFrame(frameId); clearInterval(marketTimer); window.removeEventListener('wisdo:avatar-updated',avatarListener);
      marketManager.destroy();
      if (enhancedOperator?.root) disposeTree(enhancedOperator.root);
      if (enhancedOperator?.originalChildren) enhancedOperator.originalChildren.forEach((child)=>{child.visible=true;});
      disposeTree(root);
    },
  };
}
