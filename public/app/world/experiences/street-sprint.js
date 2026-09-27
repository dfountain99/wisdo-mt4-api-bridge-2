import * as THREE from 'three';
import {raceDuration,collectCoin,depositCheckpoint,applyHit,rankByBanked,seededCoins,COINS_PER_LAP} from './street-sprint-rules.js';

const $=id=>document.getElementById(id);
const TAU=Math.PI*2, RX=90,RZ=70, ROAD=18;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const at=p=>new THREE.Vector3(RX*Math.sin(p*TAU),0,-RZ*Math.cos(p*TAU));
const tangent=p=>new THREE.Vector3(RX*Math.cos(p*TAU),0,RZ*Math.sin(p*TAU)).normalize();
const normal=p=>new THREE.Vector3(-tangent(p).z,0,tangent(p).x);
const place=(p,lane=0)=>at(p).addScaledVector(normal(p),lane);
const worldProgress=(x,z)=>(Math.atan2(x/RX,-z/RZ)/TAU+1)%1;
const away=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const palette={runner:{top:29,turn:1.65,armor:1},drifter:{top:27,turn:2.1,armor:.8},bruiser:{top:26,turn:1.42,armor:1.4}};
const keys=new Set();let runtime=null;

function box(parent,size,pos,mat){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
function glow(color,intensity=1){return new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.32,metalness:.3})}
function makeCar(color,custom={},rival=false){
  const group=new THREE.Group(),paint=new THREE.MeshPhysicalMaterial({color,roughness:.24,metalness:.65,clearcoat:1,clearcoatRoughness:.12}),black=new THREE.MeshStandardMaterial({color:0x08121d,roughness:.36,metalness:.32});
  const width=2.1*clamp(custom.width||1,.75,1.25),height=clamp(custom.height||1,.75,1.25);
  box(group,[width,.55*height,4.2],[0,.78*height,0],paint);box(group,[width*.77,.62*height,2],[0,1.28*height,-.25],black);
  for(const x of [-1,1])for(const z of [-1.28,1.28]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.46,.46,.32,14),black);wheel.rotation.z=Math.PI/2;wheel.position.set(x*(width/2+.07),.47,z);group.add(wheel)}
  for(const x of [-.66,.66]){box(group,[.5,.16,.1],[x,.91,2.13],glow(rival?0xff647d:0xa9ecff,1.2));box(group,[.5,.16,.1],[x,.91,-2.13],glow(0xff343f,.8))}
  box(group,[width*.8,.11,.55],[0,1.11,-2.02],paint);group.userData.paint=paint;return group;
}

function buildCity(scene){
  const asphalt=new THREE.MeshStandardMaterial({color:0x1c3547,roughness:.82}),sidewalk=new THREE.MeshStandardMaterial({color:0x687b84,roughness:.87}),edge=glow(0x31c8e5,.5),land=new THREE.MeshStandardMaterial({color:0x133b33,roughness:1});
  box(scene,[470,.2,430],[0,-.24,0],land);
  // Short segments follow the curve with consistent width, including on portrait devices.
  const mark=new THREE.MeshBasicMaterial({color:0xf3cd78});
  for(let i=0;i<128;i++){
    const p=i/128,q=(i+1)/128,a=place(p),b=place(q),len=a.distanceTo(b),t=tangent((p+q)/2),mid=a.add(b).multiplyScalar(.5);
    const slab=box(scene,[ROAD,.08,len+1],[mid.x,.005,mid.z],asphalt);slab.rotation.y=Math.atan2(t.x,t.z);
    if(i%4===0){const dash=box(scene,[.18,.012,len*.7],[mid.x,.053,mid.z],mark);dash.rotation.y=slab.rotation.y;dash.castShadow=false}
    if(i%3===0)for(const lane of [-ROAD*.6,ROAD*.6]){const curb=box(scene,[.22,.13,Math.max(2,len+1)],[mid.x+normal((p+q)/2).x*lane,.1,mid.z+normal((p+q)/2).z*lane],sidewalk);curb.rotation.y=Math.atan2(t.x,t.z)}
  }
  const glass=new THREE.MeshStandardMaterial({color:0x345f7e,metalness:.48,roughness:.25,emissive:0x0a1f32,emissiveIntensity:.45}),stone=new THREE.MeshStandardMaterial({color:0x445563,roughness:.8}),window=glow(0xf5c872,.7);
  // Fixed, low-cost buildings form the downtown center and outer skyline.
  for(let i=0;i<(innerWidth<800?34:54);i++){
    const angle=i*2.39996,r=i%3===0?125:33+(i%5)*7,x=Math.sin(angle)*r,z=Math.cos(angle)*r;
    if(Math.abs(Math.hypot(x/RX,z/RZ)-1)<.43)continue;
    const h=11+(i*13)%45,w=8+(i*7)%8,d=8+(i*11)%8;
    box(scene,[w,h,d],[x,h/2-.1,z],i%4===0?glass:stone);
    for(let floor=4;floor<h-2;floor+=4)for(const dx of [-w*.24,w*.24])box(scene,[1.2,1.2,.08],[x+dx,floor,z+d/2+.06],i%4===0?window:glass);
  }
  // Landmark, open office tunnel and lit rail sections along the city course.
  const tower=box(scene,[17,82,17],[0,41,0],glass);tower.name='WISDO City Tower';
  for(let y=8;y<80;y+=5)box(scene,[17.4,.2,17.4],[0,y,0],window);
  const office=place(.27,12);const officeGate=new THREE.Group();officeGate.position.copy(office);officeGate.rotation.y=Math.atan2(tangent(.27).x,tangent(.27).z);scene.add(officeGate);
  for(const x of [-12,12])box(officeGate,[8,16,14],[x,8,0],glass);
  box(officeGate,[32,1,15],[0,16.5,0],window);
  for(let i=0;i<12;i++){const p=.2+i*.01,pos=place(p,12),path=box(scene,[9,.1,8],[pos.x,.04,pos.z],asphalt);path.rotation.y=Math.atan2(tangent(p).x,tangent(p).z)}
  for(const p of [.07,.56]){const pos=place(p,ROAD*.64),t=tangent(p);const rail=box(scene,[.14,.3,27],[pos.x,.95,pos.z],edge);rail.rotation.y=Math.atan2(t.x,t.z)}
  for(let i=0;i<24;i++){const p=i/24,pos=place(p,ROAD*.85),lamp=box(scene,[.15,5,.15],[pos.x,2.5,pos.z],stone);lamp.rotation.y=p*TAU;const bulb=box(scene,[1,.17,1],[pos.x,5,pos.z],window);bulb.castShadow=false}
  const sky=new THREE.Color(0x315471);scene.background=sky;scene.fog=new THREE.FogExp2(0x315471,.0028);
  scene.add(new THREE.HemisphereLight(0xadddfc,0x667362,2.25));const sun=new THREE.DirectionalLight(0xffd498,2.9);sun.position.set(-75,130,48);scene.add(sun);
}

function coinMesh(value){return new THREE.Mesh(new THREE.TorusGeometry(value===3?1.15:.78,.18,8,18),glow(value===3?0xf7d67e:0x76ebff,1.35))}
function checkpoint(scene,index){
  const p=(index+1)/4,pos=place(p),t=tangent(p),g=new THREE.Group();g.position.copy(pos);g.rotation.y=Math.atan2(t.x,t.z);scene.add(g);
  const material=glow(index%2?0x72e8ff:0xf2ca65,1.2),dark=new THREE.MeshStandardMaterial({color:0x132637,metalness:.6,roughness:.35});
  for(const x of [-8,8])box(g,[.7,7,.8],[x,3.5,0],dark);
  box(g,[17,.7,.8],[0,7,0],material);
  box(g,[16,.08,3],[0,.1,0],material);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.3,.16,10,32),material);ring.position.set(0,4,-.1);g.add(ring);
  g.userData.material=material;return g;
}

function makeScene(options){
  const scene=new THREE.Scene();buildCity(scene);
  const camera=new THREE.PerspectiveCamera(67,1,.1,680);const renderer=new THREE.WebGLRenderer({canvas:$('view'),antialias:innerWidth>800,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<800?1.35:2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.6;
  const car=makeCar(options.paint,{width:options.width,height:options.height});scene.add(car);const rival=makeCar(0xff5473,{},true);scene.add(rival);
  const coins=seededCoins().map(row=>{const mesh=coinMesh(row.value);const pos=place(row.progress,row.lane);mesh.position.set(pos.x,1.7,pos.z);scene.add(mesh);return{...row,mesh,takenLap:-1}});
  const bins=Array.from({length:4},(_,i)=>checkpoint(scene,i));
  const hazard=glow(0xff4266,.9),ramp=glow(0x8cebff,.5);
  for(const p of [.15,.63]){const pos=place(p,-4),t=tangent(p),mesh=box(scene,[8,.5,6],[pos.x,.22,pos.z],ramp);mesh.rotation.y=Math.atan2(t.x,t.z)}
  for(const p of [.42,.85]){const pos=place(p,4),mesh=box(scene,[5,.6,2],[pos.x,.3,pos.z],hazard);mesh.rotation.y=Math.atan2(tangent(p).x,tangent(p).z)}
  return{scene,camera,renderer,car,rival,coins,bins};
}

function message(text){$('message').textContent=text}
function display(s){const remaining=Math.max(0,Math.ceil(s.duration-s.elapsed));$('clock').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;$('banked').textContent=s.player.banked;$('carried').textContent=s.player.carried;$('rival').textContent=s.ai.banked;$('bin').textContent=`${s.player.nextCheckpoint+1} / 4`;$('weapon').textContent=s.weapon;$('speed').textContent=Math.round(Math.abs(s.speed)*3.6);$('district').textContent=s.offroad?'SIDEWALK · SLOWDOWN':s.grind?'RAIL GRIND · WEAPON CHARGE':s.shortcut?'OFFICE SPEED TRACK':'DOWNTOWN LOOP'}
function hit(s,perfect){const next=applyHit(s.player,{perfect});s.player=next;s.hitCooldown=1.7;message(perfect?`PERFECT HIT! ${next.lost} CARRIED COINS SPILLED`:`CONTACT · ${next.lost} CARRIED COINS SPILLED`);s.shake=.65}
function loop(t){const s=runtime;if(!s||s.stopped)return;s.raf=requestAnimationFrame(loop);if(s.paused){s.last=t;return}const dt=Math.min(.035,Math.max(0,(t-s.last)/1000));s.last=t;s.elapsed+=dt;s.player.cleanSeconds+=dt;s.hitCooldown=Math.max(0,s.hitCooldown-dt);s.jump=Math.max(0,s.jump-dt);s.strikeCooldown=Math.max(0,s.strikeCooldown-dt);s.shake=Math.max(0,s.shake-dt*2);
  const profile=palette[s.options.car],throttle=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),steer=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  const cleanBoost=s.player.cleanSeconds>=12,boost=(keys.has('ShiftLeft')||keys.has('ShiftRight'))&&cleanBoost&&s.speed>5;
  const top=profile.top*(s.offroad?.62:1)*(boost?1.28:1)*(s.shortcut?1.14:1);s.speed=clamp(s.speed+(throttle>0?15:throttle<0?-21:-7*Math.sign(s.speed))*dt,-9,top);
  s.heading-=steer*profile.turn*dt*clamp(Math.abs(s.speed)/12,.18,1.35)*Math.sign(s.speed||1);
  const forward=new THREE.Vector3(Math.sin(s.heading),0,Math.cos(s.heading));s.position.addScaledVector(forward,s.speed*dt);
  const radius=Math.hypot(s.position.x/RX,s.position.z/RZ),edge=clamp(radius,.76,1.24);
  if(radius!==edge){s.position.x*=edge/radius;s.position.z*=edge/radius;s.speed*=.58;message('ARENA BARRIER · RETURN TO THE CITY COURSE')}
  const progress=worldProgress(s.position.x,s.position.z);if(s.progress>.88&&progress<.12&&s.speed>0){s.lap++;message('NEW LAP · TRACK COINS RESTORED')}s.progress=progress;
  s.shortcut=progress>.2&&progress<.31&&radius<.93&&radius>.76;
  s.offroad=Math.abs(radius-1)>.115&&!s.shortcut;
  const railLane=Math.abs(radius-1)*Math.min(RX,RZ),railSection=[.07,.56].some(p=>Math.abs(progress-p)<.045),onRail=railSection&&railLane>8.7&&railLane<12&&Math.abs(s.speed)>11;s.grind=onRail;
  if(onRail){s.grindTime+=dt;if(s.grindTime>=1.25){s.weapon=Math.min(3,s.weapon+1);s.grindTime=0;message('RAIL GRIND · CAR BOXING CHARGE +1')}}else s.grindTime=0;
  if(keys.has('Space')&&s.jump<=0&&s.jumpCooldown<=0){s.jump=.7;s.jumpCooldown=1.3;const stunt=[.15,.63].some(p=>Math.abs(progress-p)<.04);if(stunt){s.weapon=Math.min(3,s.weapon+1);message('SPECIAL JUMP · CAR BOXING CHARGE +1')}else message('SIDEWALK JUMP')}s.jumpCooldown=Math.max(0,s.jumpCooldown-dt);
  const y=s.jump>0?Math.sin((1-s.jump/.7)*Math.PI)*2.8:0;
  s.visual.car.position.set(s.position.x,y,s.position.z);s.visual.car.rotation.y=s.heading;
  s.visual.coins.forEach(c=>{const d=(c.progress-progress+1)%1;c.mesh.visible=c.takenLap!==s.lap&&d<.23;c.mesh.rotation.y+=dt*1.8;if(c.mesh.visible&&away(s.position,c.mesh.position)<2.7){s.player=collectCoin(s.player,c.value);c.takenLap=s.lap;c.mesh.visible=false;message(`+${c.value} TRACK COIN${c.value>1?'S':''} · CARRY TO THE NEXT BIN`)}});
  const cp=s.player.nextCheckpoint,bin=s.visual.bins[cp];if(away(s.position,bin.position)<8&&s.checkpointCooldown<=0){const next=depositCheckpoint(s.player,cp);s.player=next;s.checkpointCooldown=4;message(`CHECKPOINT ${cp+1} · ${next.deposited} COINS BANKED · ${next.carried} STILL CARRIED`)}s.checkpointCooldown=Math.max(0,s.checkpointCooldown-dt);
  // AI competes for banked score and can knock loose carried coins; it has no account payout.
  s.ai.progress=(s.ai.progress+dt*.025)%1;s.ai.position.copy(place(s.ai.progress,2.5*Math.sin(s.elapsed*.8)));s.visual.rival.position.copy(s.ai.position);s.visual.rival.rotation.y=Math.atan2(tangent(s.ai.progress).x,tangent(s.ai.progress).z);s.ai.collectTimer+=dt;
  if(s.ai.collectTimer>=2.4){s.ai.collectTimer=0;s.ai.carried+=1}const aiCp=(s.ai.nextCheckpoint+1)/4;if(Math.abs(s.ai.progress-aiCp)<.008&&s.ai.checkpointCooldown<=0){s.ai=depositCheckpoint(s.ai,s.ai.nextCheckpoint);s.ai.checkpointCooldown=2.5}s.ai.checkpointCooldown=Math.max(0,s.ai.checkpointCooldown-dt);
  const gap=away(s.position,s.ai.position);if(gap<4&&s.hitCooldown<=0){if(keys.has('KeyE')&&s.weapon>0&&s.strikeCooldown<=0){const perfect=gap<2.2&&Math.abs(s.speed)>15;s.ai=applyHit(s.ai,{perfect});s.weapon--;s.strikeCooldown=1.8;s.hitCooldown=1.5;message(perfect?'PERFECT CAR BOX · RIVAL DROPPED ALL CARRIED COINS':'CAR BOX · RIVAL DROPPED SOME CARRIED COINS')}else hit(s,false)}
  const follow=s.position.clone().addScaledVector(forward,-11).add(new THREE.Vector3(0,6.5+y*.4,0));s.visual.camera.position.lerp(follow,1-Math.exp(-5*dt));s.visual.camera.lookAt(s.position.clone().addScaledVector(forward,9).add(new THREE.Vector3(0,2.1,0)));if(s.shake)s.visual.camera.position.x+=Math.sin(t*.07)*s.shake*.18;
  s.visual.renderer.render(s.visual.scene,s.visual.camera);display(s);if(s.elapsed>=s.duration)endRace(s);
}

function endRace(s){if(s.stopped)return;s.stopped=true;cancelAnimationFrame(s.raf);keys.clear();const order=rankByBanked([{name:'YOU',...s.player},{name:'RIVAL',...s.ai}]);$('overlayEyebrow').textContent='RACE COMPLETE';$('overlayTitle').textContent=order[0].name==='YOU'?'YOU WON THE COIN CIRCUIT':'RIVAL TOOK THE CIRCUIT';$('overlayBody').textContent=`You banked ${s.player.banked} coins at ${s.player.checkpoints} checkpoints. Rival banked ${s.ai.banked}. Unbanked coins do not count. This solo result does not credit your Culture Coin wallet.`;$('resume').textContent='RACE AGAIN';$('resume').onclick=()=>{stop();startRace(s.options)};$('overlay').hidden=false}
function pause(){const s=runtime;if(!s||s.stopped)return;s.paused=!s.paused;keys.clear();$('overlay').hidden=!s.paused;$('overlayEyebrow').textContent='PAUSED';$('overlayTitle').textContent='Catch your breath';$('overlayBody').textContent='The race clock is stopped. Your carried coins stay at risk when you resume.';$('resume').textContent='RESUME';$('resume').onclick=()=>{s.paused=false;s.last=performance.now();$('overlay').hidden=true}}
function stop(){if(runtime){runtime.stopped=true;cancelAnimationFrame(runtime.raf);runtime.visual.renderer.dispose();runtime.visual.scene.traverse(o=>{o.geometry?.dispose?.();if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose?.())}})}runtime=null;keys.clear();$('overlay').hidden=true;$('play').hidden=true}
function startRace(options){stop();let visual;try{visual=makeScene(options)}catch(error){$('overlay').hidden=false;$('overlayEyebrow').textContent='3D UNAVAILABLE';$('overlayTitle').textContent='Unable to open the race';$('overlayBody').textContent='This device or browser could not start WebGL. '+error.message;$('resume').hidden=true;return}
  $('garage').hidden=true;$('play').hidden=false;$('resume').hidden=false;const position=at(0);runtime={options,visual,duration:raceDuration(options.minutes),elapsed:0,last:performance.now(),stopped:false,paused:false,raf:0,position,heading:Math.PI/2,speed:0,progress:0,lap:0,offroad:false,shortcut:false,grind:false,grindTime:0,weapon:0,jump:0,jumpCooldown:0,checkpointCooldown:0,hitCooldown:0,strikeCooldown:0,shake:0,player:{carried:0,banked:0,collected:0,checkpoints:0,nextCheckpoint:0,cleanSeconds:0},ai:{position:place(.07),progress:.07,carried:0,banked:0,checkpoints:0,nextCheckpoint:0,collectTimer:0,checkpointCooldown:0}};
  visual.car.position.copy(position);visual.car.rotation.y=Math.PI/2;visual.rival.position.copy(runtime.ai.position);visual.camera.position.copy(position).add(new THREE.Vector3(-11,6.5,0));visual.camera.lookAt(position.clone().add(new THREE.Vector3(9,2.1,0)));message(`${COINS_PER_LAP} TRACK COINS PER LAP · BANK THEM AT THE BINS`);resize();runtime.visual.renderer.render(visual.scene,visual.camera);runtime.raf=requestAnimationFrame(loop)}
function resize(){if(!runtime)return;const {renderer,camera}=runtime.visual,w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
window.addEventListener('resize',resize);window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='Escape'){pause();return}keys.add(e.code)});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{if(runtime&&!runtime.paused)pause()});
document.querySelectorAll('[data-key]').forEach(button=>{const key=button.dataset.key;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(key);button.classList.add('pressed')});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{keys.delete(key);button.classList.remove('pressed')})});
$('start').onclick=()=>startRace({minutes:Number(document.querySelector('input[name="minutes"]:checked').value),car:document.querySelector('input[name="car"]:checked').value,width:Number($('bodyWidth').value)/100,height:Number($('rideHeight').value)/100,paint:$('paint').value});$('pause').onclick=pause;$('resume').onclick=pause;$('exit').onclick=()=>{stop();$('garage').hidden=false};
