import { THREE_MODULE_URL, QUALITY_PRESETS, chooseAutoQuality } from './world-config.js';
import { InputManager } from './input-manager.js';
import { installAuthoredOperator } from './authored-operator.js';

const INTERIORS = Object.freeze({
  'trading-tower': { title: 'TRADING TOWER', subtitle: 'MARKET OPERATIONS', stations: [['observatory','SIGNAL OBSERVATORY',0,-18],['command','CAMPAIGN COMMAND',-9,-7],['market','LIVE MARKETS',9,-7],['exit','RETURN TO CENTRAL',0,17]] },
  observatory: { title: 'SIGNAL OBSERVATORY', subtitle: 'LIVE WISDO INTELLIGENCE', stations: [['signals','ACTIVE SIGNALS',0,-17],['market','WORLD MARKETS',-9,-5],['command','MY CAMPAIGNS',9,-5],['tower','TRADING TOWER',0,16]] },
  academy: { title: 'WISDO ACADEMY', subtitle: 'LEARN · PRACTICE · LEVEL UP', stations: [['learn','LEARNING LAB',-8,-8],['progress','PROGRESS',8,-8],['exit','RETURN TO CENTRAL',0,16]] },
  vault: { title: 'THE VAULT', subtitle: 'OWNED SYSTEMS', stations: [['vault','MY SYSTEMS',0,-8],['progress','ACHIEVEMENTS',8,2],['exit','RETURN TO CENTRAL',0,16]] },
  'bot-arena': { title: 'BOT ARENA', subtitle: 'SYSTEM EXHIBITION', stations: [['bots','BOT FLOOR',-8,-6],['market','MARKET',8,-6],['exit','RETURN TO CENTRAL',0,16]] },
  'switch-lab': { title: 'SWITCH LAB', subtitle: 'WISDO CONFIGURATION', stations: [['coach','COACH',-8,-6],['command','COMMAND',8,-6],['exit','RETURN TO CENTRAL',0,16]] },
  'growth-chamber': { title: 'GROWTH CHAMBER', subtitle: 'ACCOUNT HISTORY', stations: [['accounts','ACCOUNT GROWTH',-8,-6],['progress','MILESTONES',8,-6],['exit','RETURN TO CENTRAL',0,16]] },
  'strategy-lab': { title: 'STRATEGY LAB', subtitle: 'SIMULATION · REVIEW', stations: [['simulation','SIMULATION',-8,-6],['performance','PERFORMANCE',8,-6],['exit','RETURN TO CENTRAL',0,16]] },
  'coach-center': { title: 'COACH CENTER', subtitle: 'WISDO INTELLIGENCE', stations: [['coach','TALK TO COACH',0,-8],['command','COMMAND',8,2],['exit','RETURN TO CENTRAL',0,16]] },
  'culture-arena': { title: 'CULTURE ARENA', subtitle: 'COMMUNITY', stations: [['community','COMMUNITY FLOOR',0,-8],['progress','WORLD PROGRESS',8,2],['exit','RETURN TO CENTRAL',0,16]] },
  marketplace: { title: 'WISDO MARKET', subtitle: 'PRODUCTS · ACCESS', stations: [['market','MARKET FLOOR',0,-8],['checkout','SECURE CHECKOUT',8,2],['exit','RETURN TO CENTRAL',0,16]] },
  'vps-forge': { title: 'VPS FORGE', subtitle: 'RUNTIME INFRASTRUCTURE', stations: [['reporter','REPORTER MESH',-8,-6],['command','SYSTEM COMMAND',8,-6],['exit','RETURN TO CENTRAL',0,16]] },
  'private-rooms': { title: 'PRIVATE ROOMS', subtitle: 'COMMANDER RESIDENCE', stations: [['profile','IDENTITY',-8,-6],['home','SMART HOME',8,-6],['exit','RETURN TO CENTRAL',0,16]] },
  'war-room': { title: 'WAR ROOM', subtitle: 'AUTHORIZED OPERATIONS', stations: [['command','COMMAND CORE',0,-8],['reporter','SYSTEM HEALTH',8,2],['exit','RETURN TO CENTRAL',0,16]] },
});

function canvasLabel(THREE, text, sub = '') {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#071018'; ctx.fillRect(0,0,1024,256);
  ctx.strokeStyle = '#c9a55c'; ctx.lineWidth = 8; ctx.strokeRect(8,8,1008,240);
  ctx.fillStyle = '#f6f3e9'; ctx.font = '700 62px system-ui'; ctx.textAlign='center'; ctx.fillText(text,512,112);
  ctx.fillStyle = '#72dff3'; ctx.font = '500 28px system-ui'; ctx.fillText(sub,512,166);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(8,2), new THREE.MeshBasicMaterial({ map: tex, toneMapped:false }));
}

function makeFallbackOperator(THREE) {
  const root = new THREE.Group(); root.name='WisdoOperator';
  const mat = new THREE.MeshStandardMaterial({color:0x11161c,roughness:.5,metalness:.35});
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.42,.9,8,12),mat); body.position.y=1.05; root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.28,18,14),new THREE.MeshStandardMaterial({color:0x5b4638,roughness:.72})); head.position.y=1.88; root.add(head);
  return root;
}

function stationObject(THREE, station, x, z) {
  const group = new THREE.Group(); group.position.set(x,0,z); group.userData.station = station;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.55,.45,20),new THREE.MeshStandardMaterial({color:0x121c27,metalness:.65,roughness:.28})); base.position.y=.23;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(.58,.78,1.7,16),new THREE.MeshStandardMaterial({color:0x0a3040,emissive:0x0a6a89,emissiveIntensity:.55,metalness:.45,roughness:.32})); core.position.y=1.15;
  group.add(base,core); return group;
}

export async function createWorldInterior({ mount, sceneId, snapshot, preferences = {}, onNearestChange=()=>{}, onInteract=()=>{}, onTelemetry=()=>{}, onReady=()=>{}, onFatal=()=>{} }={}) {
  const THREE = await import(THREE_MODULE_URL);
  const config = INTERIORS[sceneId] || INTERIORS['trading-tower'];
  const quality = preferences.quality === 'auto' || !preferences.quality ? chooseAutoQuality() : preferences.quality;
  const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.medium;
  const renderer = new THREE.WebGLRenderer({antialias:preset.antialias,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,preset.dpr)); renderer.setSize(mount.clientWidth||innerWidth,mount.clientHeight||innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=Boolean(preset.shadows); renderer.shadowMap.type=THREE.PCFSoftShadowMap; mount.replaceChildren(renderer.domElement);
  const scene = new THREE.Scene(); scene.background=new THREE.Color(0x050b13); scene.fog=new THREE.Fog(0x050b13,34,92);
  const camera = new THREE.PerspectiveCamera(66,(mount.clientWidth||innerWidth)/(mount.clientHeight||innerHeight),.1,180);
  const hemi=new THREE.HemisphereLight(0x587da0,0x08090c,1.25); scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xf3dbac,2.1); sun.position.set(-12,20,13); sun.castShadow=Boolean(preset.shadows); scene.add(sun);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(58,54),new THREE.MeshStandardMaterial({color:0x111923,roughness:.26,metalness:.18})); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
  const back=new THREE.Mesh(new THREE.BoxGeometry(50,12,.8),new THREE.MeshStandardMaterial({color:0x0a1018,roughness:.36,metalness:.55})); back.position.set(0,6,-25); scene.add(back);
  const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(50,50),new THREE.MeshStandardMaterial({color:0x070b10,roughness:.45})); ceiling.rotation.x=Math.PI/2; ceiling.position.y=11.5; scene.add(ceiling);
  for(let x=-22;x<=22;x+=5.5){ const rib=new THREE.Mesh(new THREE.BoxGeometry(.12,10,.24),new THREE.MeshStandardMaterial({color:0xc9a55c,emissive:0x3d2a08,emissiveIntensity:.5,metalness:.8,roughness:.25})); rib.position.set(x,5.4,-24.5); scene.add(rib); }
  const title=canvasLabel(THREE,config.title,config.subtitle); title.position.set(0,7.2,-24); scene.add(title);
  const operator=makeFallbackOperator(THREE); operator.position.set(0,0,12); scene.add(operator);
  const stations=[];
  for(const [id,name,x,z] of config.stations){ const object=stationObject(THREE,id,x,z); object.userData.entity={kind:'world-interior-station',station:id,id:`${sceneId}:${id}`,name,sceneId,unlocked:true}; scene.add(object); stations.push(object); const sign=canvasLabel(THREE,name,'[E] INTERACT'); sign.scale.set(.42,.42,.42); sign.position.set(x,3.1,z); sign.lookAt(0,2,12); scene.add(sign); }
  const input=new InputManager({canvas:renderer.domElement,sensitivity:Number(preferences.sensitivity||1)*.0022,invertY:Boolean(preferences.invertY)});
  input.bindTouch({joystick:document.getElementById('moveStick'),knob:document.getElementById('moveKnob'),lookZone:document.getElementById('lookZone'),jumpButton:document.getElementById('jumpBtn'),sprintButton:document.getElementById('sprintBtn'),interactButton:document.getElementById('interactBtn')});
  let yaw=0,pitch=.18,velocity=new THREE.Vector3(),destroyed=false,last=performance.now(),frames=0,fpsAt=last,nearest=null;
  const forward=new THREE.Vector3(),right=new THREE.Vector3(),desired=new THREE.Vector3(),camTarget=new THREE.Vector3();
  let authored=null; installAuthoredOperator({THREE,scene,debug:new URLSearchParams(location.search).get('debug')==='1'}).then((v)=>{authored=v;}).catch((e)=>console.warn('Interior authored Operator fallback',e));
  function resize(){const w=mount.clientWidth||innerWidth,h=mount.clientHeight||innerHeight; camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h,false);} window.addEventListener('resize',resize);
  function loop(now){ if(destroyed)return; requestAnimationFrame(loop); const dt=Math.min(.05,Math.max(.001,(now-last)/1000)); last=now; const i=input.frame(); yaw-=i.lookX; pitch=Math.max(-.25,Math.min(.95,pitch-i.lookY));
    forward.set(-Math.sin(yaw),0,-Math.cos(yaw)); right.set(Math.cos(yaw),0,-Math.sin(yaw)); desired.copy(forward).multiplyScalar(i.moveY).addScaledVector(right,i.moveX); if(desired.lengthSq()>1)desired.normalize(); const speed=i.sprint?6.5:3.3; desired.multiplyScalar(speed); velocity.lerp(desired,1-Math.exp(-12*dt)); operator.position.addScaledVector(velocity,dt); operator.position.x=Math.max(-23,Math.min(23,operator.position.x)); operator.position.z=Math.max(-22,Math.min(21,operator.position.z)); if(velocity.lengthSq()>.04)operator.rotation.y=Math.atan2(velocity.x,velocity.z);
    camTarget.copy(operator.position).add(new THREE.Vector3(0,1.45,0)); camera.position.set(camTarget.x+Math.sin(yaw)*4.7,camTarget.y+1.1+Math.sin(pitch)*2.0,camTarget.z+Math.cos(yaw)*4.7); camera.lookAt(camTarget);
    let best=null,bestD=4.2; for(const s of stations){const d=s.position.distanceTo(operator.position); if(d<bestD){bestD=d;best=s.userData.entity;}} if(best?.id!==nearest?.id){nearest=best;onNearestChange(best);} if(i.interactPressed&&nearest)onInteract(nearest);
    renderer.render(scene,camera); frames++; if(now-fpsAt>1000){onTelemetry({fps:Math.round(frames*1000/(now-fpsAt)),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,quality,player:{x:operator.position.x.toFixed(1),y:'0.0',z:operator.position.z.toFixed(1)}});frames=0;fpsAt=now;}
  }
  requestAnimationFrame(loop); onReady();
  return {mode:'world-interior',sceneId,releasePointer:()=>input.releasePointer(),setPreferences:(p)=>input.setPreferences(p),updateSnapshot:()=>{},destroy(){destroyed=true; input.destroy(); authored?.destroy?.(); window.removeEventListener('resize',resize); renderer.dispose(); mount.replaceChildren(); onNearestChange(null);}};
}
