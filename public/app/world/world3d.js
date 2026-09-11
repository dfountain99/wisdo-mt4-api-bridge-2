import { InputManager } from './input-manager.js';
import { QUALITY_PRESETS, THREE_MODULE_URL, WORLD_CONFIG, WORLD_LOCATIONS, chooseAutoQuality } from './world-config.js';

const DEG = Math.PI / 180;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));
const moveToward = (current, target, amount) => current < target ? Math.min(target, current + amount) : current > target ? Math.max(target, current - amount) : current;

function signTexture(THREE, title, subtitle = '') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#05090e';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#d8ac55';
  ctx.lineWidth = 7;
  ctx.strokeRect(8, 8, 1008, 240);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f0d28a';
  ctx.font = '700 68px system-ui,sans-serif';
  ctx.fillText(title, 512, subtitle ? 105 : 132);
  if (subtitle) {
    ctx.fillStyle = '#c8d6df';
    ctx.font = '500 28px system-ui,sans-serif';
    ctx.fillText(subtitle, 512, 180);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addSign(THREE, group, title, subtitle, position, size = [11, 2.8], rotationY = 0) {
  const material = new THREE.MeshBasicMaterial({ map: signTexture(THREE, title, subtitle), transparent: true, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  group.add(mesh);
  return mesh;
}

function materials(THREE) {
  return {
    asphalt: new THREE.MeshStandardMaterial({ color: 0x11161d, roughness: .94 }),
    plaza: new THREE.MeshStandardMaterial({ color: 0x222a33, roughness: .8, metalness: .05 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x343a41, roughness: .86 }),
    concrete2: new THREE.MeshStandardMaterial({ color: 0x555b61, roughness: .82 }),
    black: new THREE.MeshStandardMaterial({ color: 0x080b10, roughness: .58, metalness: .25 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x132532, roughness: .18, metalness: .42 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x56616a, roughness: .38, metalness: .74 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc99a42, roughness: .33, metalness: .8 }),
    goldGlow: new THREE.MeshStandardMaterial({ color: 0xd8ac55, emissive: 0x805006, emissiveIntensity: 1.55, roughness: .28, metalness: .55 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x55d8ff, emissive: 0x075b7a, emissiveIntensity: 1.15, roughness: .28 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x17261e, roughness: 1 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x2e493b, roughness: .95 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x49392e, roughness: 1 }),
    lane: new THREE.MeshBasicMaterial({ color: 0xcfae64 }),
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

function buildGround(THREE, scene, mat, groundMeshes) {
  const group = new THREE.Group();
  group.name = 'CentralPlaza';
  scene.add(group);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), mat.asphalt);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  groundMeshes.push(ground);
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, .22, 64), mat.plaza);
  plaza.position.y = .11;
  plaza.receiveShadow = true;
  group.add(plaza);
  groundMeshes.push(plaza);
  const ring = new THREE.Mesh(new THREE.RingGeometry(29.7, 30.25, 64), mat.gold);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .235;
  group.add(ring);
  for (const spec of [[18,.05,220,0,0],[220,.05,18,0,0]]) {
    const road = box(THREE, group, [spec[0], spec[1], spec[2]], [spec[3], .025, spec[4]], mat.asphalt, false);
    groundMeshes.push(road);
  }
  for (let n = -96; n <= 96; n += 12) {
    box(THREE, group, [.16,.02,5.2], [-3.2,.07,n], mat.lane, false);
    box(THREE, group, [.16,.02,5.2], [3.2,.07,n], mat.lane, false);
    box(THREE, group, [5.2,.02,.16], [n,.07,-3.2], mat.lane, false);
    box(THREE, group, [5.2,.02,.16], [n,.07,3.2], mat.lane, false);
  }
  const core = box(THREE, group, [7.5,1.15,7.5], [0,.57,0], mat.black, true);
  groundMeshes.push(core);
  const monolith = new THREE.Mesh(new THREE.CylinderGeometry(.85,1.2,5,6), mat.glass);
  monolith.position.set(0,3.1,0);
  monolith.rotation.y = Math.PI / 6;
  group.add(monolith);
  addSign(THREE, group, 'W', 'CEM CULTURE', [0,3.1,1.08], [2.2,1.15]);
}

function buildTradingTower(THREE, scene, mat, colliders, occluders, groundMeshes) {
  const group = new THREE.Group();
  group.name = 'TradingTowerDistrict';
  scene.add(group);
  const body = box(THREE, group, [26,84,21], [0,42,-82], mat.glass, true);
  colliderFor(THREE, body, colliders, occluders, .08);
  const crown = box(THREE, group, [18,10,17], [0,89,-82], mat.black, true);
  colliderFor(THREE, crown, colliders, occluders, .05);
  for (let floor = 1; floor <= 14; floor += 1) {
    box(THREE, group, [26.4,.18,21.4], [0,5+floor*5.25,-82], floor % 4 === 0 ? mat.goldGlow : mat.gold, false);
  }
  for (const x of [-11.8,11.8]) box(THREE, group, [.34,78,.45], [x,42,-71.25], mat.gold, false);
  for (const x of [-6,0,6]) box(THREE, group, [.12,70,.12], [x,42,-71.18], mat.cyan, false);
  const entrance = box(THREE, group, [12,.8,9], [0,.4,-66.8], mat.concrete, true);
  groundMeshes.push(entrance);
  const ramp = box(THREE, group, [10,.15,9], [0,.22,-61.5], mat.concrete2, false);
  ramp.rotation.x = -3 * DEG;
  groundMeshes.push(ramp);
  box(THREE, group, [3.5,5.2,.4], [-2,2.7,-71.28], mat.glass, false);
  box(THREE, group, [3.5,5.2,.4], [2,2.7,-71.28], mat.glass, false);
  addSign(THREE, group, 'TRADING TOWER', 'WISDO', [0,10.5,-71.05], [15,3.2]);
  addSign(THREE, group, 'W', 'CONNECT · COPY · CONTROL', [0,61,-71.02], [10,3]);
  for (const x of [-9,-4.5,4.5,9]) {
    const lamp = box(THREE, group, [.18,.12,.18], [x,.7,-58], mat.goldGlow, false);
    lamp.castShadow = false;
  }
}

function buildBuilding(THREE, scene, mat, destination, location, colliders, occluders) {
  const group = new THREE.Group();
  group.name = destination.id;
  scene.add(group);
  const [w,h,d] = location.size;
  const [x,,z] = location.position;
  const body = box(THREE, group, [w,h,d], [x,h/2,z], location.kind === 'vault' ? mat.black : mat.concrete, true);
  colliderFor(THREE, body, colliders, occluders, .08);
  box(THREE, group, [w+.45,.34,d+.45], [x,h+.17,z], destination.unlocked ? mat.gold : mat.steel, false);
  const faceZ = z + (d/2 + .04) * (z < -68 ? 1 : z > 68 ? -1 : 1);
  let rotationY = z > 68 ? Math.PI : 0;
  let sx = x, sz = faceZ;
  if (Math.abs(x) > 70 && Math.abs(z) < 60) {
    sx = x - Math.sign(x) * (w/2 + .04);
    sz = z;
    rotationY = Math.sign(x) > 0 ? -Math.PI/2 : Math.PI/2;
  }
  addSign(THREE, group, destination.name.toUpperCase(), destination.short || 'WISDO', [sx,Math.min(h-.8,8),sz], [Math.min(13,w*.72),2.5], rotationY);
  if (!destination.unlocked) addSign(THREE, group, 'ACCESS REQUIRED', destination.minTier || 'MEMBER', [sx,Math.min(h-4,4.6),sz], [8.5,1.8], rotationY);
  for (let row = 2.2; row < h-2; row += 3.4) box(THREE, group, [Math.max(4,w*.62),.08,.09], [x,row,z+d/2+.05], mat.cyan, false);
}

function buildProps(THREE, scene, mat, density) {
  const group = new THREE.Group();
  group.name = 'StreetProps';
  scene.add(group);
  const stride = density < .6 ? 24 : density < .9 ? 18 : 14;
  for (let z = -94; z <= 94; z += stride) {
    for (const x of [-14,14]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,5.2,8),mat.steel);
      pole.position.set(x,2.6,z); group.add(pole);
      box(THREE,group,[.55,.12,.35],[x,5.12,z],mat.goldGlow,false);
    }
  }
  for (let x = -92; x <= 92; x += stride*1.3) {
    for (const z of [-25,25]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.18,.24,2.3,8),mat.trunk);
      trunk.position.set(x,1.15,z); group.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25,1),mat.foliage);
      crown.position.set(x,3.1,z); crown.castShadow = true; group.add(crown);
    }
  }
  for (const [x,z] of [[-24,18],[24,18],[-24,-18],[24,-18]]) box(THREE,group,[4,.45,1.2],[x,.3,z],mat.concrete2,true);
}

function buildSkyline(THREE, scene, mat, density) {
  const group = new THREE.Group();
  group.name = 'BackgroundSkyline';
  scene.add(group);
  const count = Math.floor(45*density);
  for (let i=0;i<count;i+=1) {
    const angle = i/count*Math.PI*2;
    const radius = 138 + (i%5)*7;
    const width = 8 + (i%4)*3;
    const depth = 8 + ((i+2)%4)*3;
    const height = 18 + (i*13%52);
    const mesh = box(THREE,group,[width,height,depth],[Math.sin(angle)*radius,height/2-1,Math.cos(angle)*radius],i%6===0?mat.glass:mat.black,false);
    mesh.rotation.y = angle*.23;
  }
}

function buildBoundary(THREE, scene, mat, colliders, occluders) {
  const group = new THREE.Group();
  group.name = 'WorldBoundary';
  scene.add(group);
  const edge = WORLD_CONFIG.world.halfSize + 1;
  for (const spec of [[0,-edge,220,2],[0,edge,220,2],[-edge,0,2,220],[edge,0,2,220]]) {
    const wall = box(THREE,group,[spec[2],3.2,spec[3]],[spec[0],1.6,spec[1]],mat.black,false);
    colliderFor(THREE,wall,colliders,occluders,.02);
  }
  addSign(THREE,group,'FUTURE DISTRICT','EXPANSION GATE',[0,3.3,-edge+1.05],[13,2.5]);
}

function createOperator(THREE, mat) {
  const group = new THREE.Group();
  group.name = 'WisdoOperator';
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.42,.75,7,12),mat.black);
  torso.position.y = 1.13; torso.castShadow = true; group.add(torso);
  const chest = box(THREE,group,[.56,.08,.44],[0,1.3,-.33],mat.gold,false); chest.rotation.x = -.1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.29,18,14),mat.concrete2); head.position.y=2.02; head.castShadow=true; group.add(head);
  const visor = box(THREE,group,[.48,.1,.08],[0,2.07,-.25],mat.cyan,false);
  const limbs = {};
  for (const side of [-1,1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.1,.63,5,8),mat.black); arm.position.set(side*.54,1.2,0); arm.castShadow=true; group.add(arm); limbs[side<0?'leftArm':'rightArm']=arm;
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.12,.72,5,8),mat.black); leg.position.set(side*.19,.36,0); leg.castShadow=true; group.add(leg); limbs[side<0?'leftLeg':'rightLeg']=leg;
  }
  group.userData.limbs = limbs; group.userData.head = head; group.userData.visor = visor;
  return group;
}

function animateOperator(operator, info) {
  const limbs = operator.userData.limbs;
  const moving = info.speed > .12 && info.grounded;
  const pace = info.state === 'SPRINT' ? 11 : info.state === 'RUN' ? 8.2 : 5.7;
  const amp = info.state === 'SPRINT' ? .82 : info.state === 'RUN' ? .62 : .4;
  const swing = moving ? Math.sin(info.elapsed*pace)*amp : 0;
  limbs.leftLeg.rotation.x = swing; limbs.rightLeg.rotation.x = -swing; limbs.leftArm.rotation.x = -swing*.75; limbs.rightArm.rotation.x = swing*.75;
  const airborne = !info.grounded;
  operator.position.y += airborne ? Math.sin(info.elapsed*7)*.015 : Math.abs(Math.sin(info.elapsed*pace))*Math.min(.035,info.speed*.005);
  operator.userData.visor.material.emissiveIntensity = info.state === 'SPRINT' ? 1.8 : 1.15;
}

function circleHitsBox(x,z,radius,box3) {
  const nx = clamp(x,box3.min.x,box3.max.x), nz = clamp(z,box3.min.z,box3.max.z);
  return (x-nx)*(x-nx)+(z-nz)*(z-nz) < radius*radius;
}

function derivePlayerState(grounded,speed,verticalVelocity,sprint,magnitude) {
  if (!grounded) return verticalVelocity > .35 ? 'JUMP' : 'FALL';
  if (speed < .08 || magnitude < .04) return 'IDLE';
  if (sprint && speed > WORLD_CONFIG.player.runSpeed) return 'SPRINT';
  if (speed > WORLD_CONFIG.player.walkSpeed*1.12) return 'RUN';
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
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.enabled = quality.shadows;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,quality.dpr)); renderer.domElement.className = 'world-canvas'; renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('aria-label','Playable WISDO World 3D district'); mount.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x07111c); scene.fog = new THREE.Fog(0x09131c,WORLD_CONFIG.world.fogNear,WORLD_CONFIG.world.fogFar);
  const camera = new THREE.PerspectiveCamera(WORLD_CONFIG.camera.fieldOfView,1,.08,420);
  const mat = materials(THREE), colliders = [], occluders = [], groundMeshes = [];

  onPhase?.('Building WISDO Central');
  buildGround(THREE,scene,mat,groundMeshes); buildTradingTower(THREE,scene,mat,colliders,occluders,groundMeshes);
  for (const destination of destinations) { if (destination.id === 'trading-tower') continue; const location = WORLD_LOCATIONS[destination.id]; if (location) buildBuilding(THREE,scene,mat,destination,location,colliders,occluders); }
  buildProps(THREE,scene,mat,quality.propDensity); buildSkyline(THREE,scene,mat,quality.skylineDensity); buildBoundary(THREE,scene,mat,colliders,occluders);

  const hemi = new THREE.HemisphereLight(0x91abc0,0x101419,2.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe3b0,3.25); sun.position.set(-55,95,60); sun.castShadow=quality.shadows; sun.shadow.mapSize.set(quality.shadowMap,quality.shadowMap); sun.shadow.camera.left=-90; sun.shadow.camera.right=90; sun.shadow.camera.top=90; sun.shadow.camera.bottom=-90; sun.shadow.camera.near=5; sun.shadow.camera.far=230; sun.shadow.bias=-.00012; scene.add(sun);
  const rim = new THREE.DirectionalLight(0x3da9e8,1.05); rim.position.set(45,26,-65); scene.add(rim);

  onPhase?.('Preparing operator');
  const operator = createOperator(THREE,mat); scene.add(operator);
  const pos = new THREE.Vector3(...WORLD_CONFIG.player.spawn), velocity = new THREE.Vector3(); operator.position.copy(pos);
  const input = new InputManager({ canvas: renderer.domElement, sensitivity:Number(preferences.sensitivity||1)*WORLD_CONFIG.camera.sensitivity, invertY:Boolean(preferences.invertY) });
  input.bindTouch({ joystick:document.getElementById('moveStick'), knob:document.getElementById('moveKnob'), lookZone:document.getElementById('lookZone'), jumpButton:document.getElementById('jumpBtn'), sprintButton:document.getElementById('sprintBtn'), interactButton:document.getElementById('interactBtn') });

  let yaw=0, pitch=12*DEG, cameraDistance=WORLD_CONFIG.camera.distance, grounded=true, lastGroundedAt=performance.now(), accumulator=0, lastTime=performance.now(), elapsed=0, destroyed=false, paused=false, nearest=null, lastInteractAt=0, fpsFrames=0, fpsWindow=performance.now();
  const groundRay=new THREE.Raycaster(), cameraRay=new THREE.Raycaster(), rayOrigin=new THREE.Vector3(), down=new THREE.Vector3(0,-1,0), forward=new THREE.Vector3(), right=new THREE.Vector3(), wish=new THREE.Vector3(), target=new THREE.Vector3(), desiredCamera=new THREE.Vector3(), offset=new THREE.Vector3(), rayDirection=new THREE.Vector3(), playerLook=new THREE.Vector3();

  function groundHeight() { rayOrigin.set(pos.x,pos.y+2.5,pos.z); groundRay.set(rayOrigin,down); groundRay.far=5.5; const hit=groundRay.intersectObjects(groundMeshes,false)[0]; return hit ? hit.point.y : null; }
  function moveAxis(axis,amount) { if (Math.abs(amount)<1e-7) return; const nx=axis==='x'?pos.x+amount:pos.x, nz=axis==='z'?pos.z+amount:pos.z; if (colliders.some((bounds)=>circleHitsBox(nx,nz,WORLD_CONFIG.player.capsuleRadius,bounds))) velocity[axis]=0; else pos[axis]+=amount; }
  function updateNearest() { let best=null,bestDistance=Infinity; for (const destination of destinations) { const location=WORLD_LOCATIONS[destination.id]; if(!location)continue; const distance=Math.hypot(pos.x-location.interaction[0],pos.z-location.interaction[2]); if(distance<bestDistance){bestDistance=distance;best=destination;} } const next=bestDistance<=WORLD_CONFIG.world.interactionRadius?best:null; if(next?.id!==nearest?.id){nearest=next;onNearestChange?.(nearest);} }

  function physicsStep(dt,frameInput,now) {
    yaw-=frameInput.lookX; pitch=clamp(pitch-frameInput.lookY,WORLD_CONFIG.camera.pitchMinDegrees*DEG,WORLD_CONFIG.camera.pitchMaxDegrees*DEG);
    forward.set(-Math.sin(yaw),0,-Math.cos(yaw)); right.set(Math.cos(yaw),0,-Math.sin(yaw)); wish.set(0,0,0).addScaledVector(forward,frameInput.moveY).addScaledVector(right,frameInput.moveX); if(wish.lengthSq()>1)wish.normalize();
    const magnitude=Math.min(1,frameInput.magnitude); const speedLimit=frameInput.sprint?WORLD_CONFIG.player.sprintSpeed:magnitude<.6&&magnitude>.01?WORLD_CONFIG.player.walkSpeed:WORLD_CONFIG.player.runSpeed; const control=grounded?1:WORLD_CONFIG.player.airControl; const change=(magnitude>.01?WORLD_CONFIG.player.acceleration:WORLD_CONFIG.player.deceleration)*control*dt;
    velocity.x=moveToward(velocity.x,wish.x*speedLimit*magnitude,change); velocity.z=moveToward(velocity.z,wish.z*speedLimit*magnitude,change); if(grounded)lastGroundedAt=now;
    if(frameInput.jumpPressed&&(grounded||now-lastGroundedAt<=WORLD_CONFIG.player.coyoteTimeMs)){velocity.y=WORLD_CONFIG.player.jumpVelocity;grounded=false;lastGroundedAt=-Infinity;}
    velocity.y+=WORLD_CONFIG.player.gravity*dt; moveAxis('x',velocity.x*dt); moveAxis('z',velocity.z*dt); pos.y+=velocity.y*dt;
    const gy=groundHeight(); if(gy!==null){const snap=grounded?WORLD_CONFIG.player.groundSnapDistance+.16:.09;if(velocity.y<=0&&pos.y<=gy+snap){pos.y=gy;velocity.y=0;grounded=true;lastGroundedAt=now;}else if(pos.y>gy+WORLD_CONFIG.player.groundSnapDistance+.24)grounded=false;} else grounded=false;
    if(pos.y<WORLD_CONFIG.player.deathHeight){pos.set(...WORLD_CONFIG.player.spawn);velocity.set(0,0,0);grounded=true;}
    const speed=Math.hypot(velocity.x,velocity.z), pState=derivePlayerState(grounded,speed,velocity.y,frameInput.sprint,magnitude);
    if(speed>.12){playerLook.set(velocity.x,0,velocity.z).normalize();const wanted=Math.atan2(playerLook.x,playerLook.z);const delta=Math.atan2(Math.sin(wanted-operator.rotation.y),Math.cos(wanted-operator.rotation.y));operator.rotation.y+=delta*(1-Math.exp(-12*dt));}
    operator.position.copy(pos); animateOperator(operator,{state:pState,speed,grounded,elapsed,verticalVelocity:velocity.y}); updateNearest(); if(frameInput.interactPressed&&nearest&&now-lastInteractAt>360){lastInteractAt=now;onInteract?.(nearest);} return {speed,pState};
  }

  function updateCamera(dt,sprinting) {
    target.set(pos.x,pos.y+WORLD_CONFIG.camera.targetHeight,pos.z); const cp=Math.cos(pitch); offset.set(Math.sin(yaw)*cp,Math.sin(pitch),Math.cos(yaw)*cp).multiplyScalar(WORLD_CONFIG.camera.distance); right.set(Math.cos(yaw),0,-Math.sin(yaw)).multiplyScalar(WORLD_CONFIG.camera.shoulderOffset); desiredCamera.copy(target).add(offset).add(right);
    rayDirection.copy(desiredCamera).sub(target); const distance=rayDirection.length(); rayDirection.normalize(); cameraRay.set(target,rayDirection); cameraRay.far=distance; const hit=cameraRay.intersectObjects(occluders,false)[0]; const safe=hit?clamp(hit.distance-.28,WORLD_CONFIG.camera.minDistance,distance):distance; cameraDistance=damp(cameraDistance,safe,hit?24:8,dt); desiredCamera.copy(target).addScaledVector(rayDirection,cameraDistance); camera.position.lerp(desiredCamera,1-Math.exp(-WORLD_CONFIG.camera.damping*dt)); camera.lookAt(target);
    const reduce=Boolean(preferences.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches); camera.fov=damp(camera.fov,!reduce&&sprinting?WORLD_CONFIG.camera.sprintFieldOfView:WORLD_CONFIG.camera.fieldOfView,7,dt); camera.updateProjectionMatrix();
  }

  function resize(){const width=mount.clientWidth||innerWidth,height=mount.clientHeight||innerHeight;renderer.setSize(width,height,false);camera.aspect=Math.max(.2,width/Math.max(1,height));camera.updateProjectionMatrix();}
  function setQuality(name){const resolved=name==='auto'?chooseAutoQuality():name;if(!QUALITY_PRESETS[resolved])return;qualityName=resolved;quality=QUALITY_PRESETS[resolved];renderer.setPixelRatio(Math.min(devicePixelRatio||1,quality.dpr));renderer.shadowMap.enabled=quality.shadows;sun.castShadow=quality.shadows;sun.shadow.mapSize.set(quality.shadowMap,quality.shadowMap);sun.shadow.map?.dispose?.();sun.shadow.map=null;resize();}
  function setPreferences(next={}){Object.assign(preferences,next);input.setPreferences({sensitivity:Number(preferences.sensitivity||1)*WORLD_CONFIG.camera.sensitivity,invertY:Boolean(preferences.invertY)});if(next.quality)setQuality(next.quality);}
  function telemetry(now){if(now-fpsWindow<1000)return;const fps=Math.round(fpsFrames*1000/(now-fpsWindow));fpsFrames=0;fpsWindow=now;onTelemetry?.({fps,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,quality:qualityName,player:{x:+pos.x.toFixed(2),y:+pos.y.toFixed(2),z:+pos.z.toFixed(2),grounded}});}

  function frame(now){if(destroyed)return;requestAnimationFrame(frame);if(paused)return;const dt=Math.min(WORLD_CONFIG.world.maxFrameDt,Math.max(.001,(now-lastTime)/1000));lastTime=now;elapsed+=dt;accumulator+=dt;const frameInput=input.frame();let result={speed:0,pState:'IDLE'},first=true;while(accumulator>=WORLD_CONFIG.world.fixedDt){result=physicsStep(WORLD_CONFIG.world.fixedDt,first?frameInput:{...frameInput,jumpPressed:false,interactPressed:false,lookX:0,lookY:0},now);accumulator-=WORLD_CONFIG.world.fixedDt;first=false;}updateCamera(dt,frameInput.sprint&&result.speed>WORLD_CONFIG.player.runSpeed);renderer.render(scene,camera);fpsFrames+=1;telemetry(now);}
  function onVisibility(){paused=document.hidden;if(!paused){lastTime=performance.now();accumulator=0;}}
  function onContextLost(event){event.preventDefault();onFatal?.(new Error('WebGL context was lost.'));}
  function destroy(){if(destroyed)return;destroyed=true;input.destroy();window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',onVisibility);renderer.domElement.removeEventListener('webglcontextlost',onContextLost);onNearestChange?.(null);scene.traverse((object)=>{object.geometry?.dispose?.();const mats=Array.isArray(object.material)?object.material:[object.material];for(const material of mats){if(!material)continue;for(const value of Object.values(material))if(value?.isTexture)value.dispose?.();material.dispose?.();}});renderer.dispose();renderer.forceContextLoss?.();mount.replaceChildren();}

  window.addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',onVisibility);renderer.domElement.addEventListener('webglcontextlost',onContextLost,false);resize();updateCamera(1/60,false);renderer.render(scene,camera);onPhase?.('WISDO World ready');onReady?.({quality:qualityName,engine:'Three.js',physics:'fixed-step kinematic controller'});requestAnimationFrame(frame);
  return {mode:'3d',engine:'Three.js',physics:'fixed-step kinematic controller',get quality(){return qualityName;},destroy,setQuality,setPreferences,releasePointer:()=>input.releasePointer()};
}
