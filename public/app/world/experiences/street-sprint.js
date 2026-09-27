import * as THREE from 'three';
import {raceDuration,collectCoin,depositCheckpoint,applyHit,seededCoins,COINS_PER_LAP} from './street-sprint-rules.js';
import {cityZone,localRaceResult} from './street-sprint-circuit.js';

const $=id=>document.getElementById(id);
const TAU=Math.PI*2, RX=90,RZ=70, ROAD=18;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const at=p=>new THREE.Vector3(RX*Math.sin(p*TAU),0,-RZ*Math.cos(p*TAU));
const tangent=p=>new THREE.Vector3(RX*Math.cos(p*TAU),0,RZ*Math.sin(p*TAU)).normalize();
const normal=p=>new THREE.Vector3(-tangent(p).z,0,tangent(p).x);
const place=(p,lane=0)=>at(p).addScaledVector(normal(p),lane);
const worldProgress=(x,z)=>(Math.atan2(x/RX,-z/RZ)/TAU+1)%1;
const away=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const deckHeight=p=>p<.53||p>.75?0:p<.58?3*(p-.53)/.05:p>.70?3*(.75-p)/.05:3;
const palette={runner:{top:29,turn:1.65,armor:1},drifter:{top:27,turn:2.1,armor:.8},bruiser:{top:26,turn:1.42,armor:1.4}};
const keys=new Set();let runtime=null;

function box(parent,size,pos,mat){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
function glow(color,intensity=1){return new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.32,metalness:.3})}
function streetSign(parent,label,color=0x50d9f4){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#071727';ctx.fillRect(0,0,512,128);
  ctx.strokeStyle='#64dffd';ctx.lineWidth=6;ctx.strokeRect(5,5,502,118);
  ctx.fillStyle='#f5df91';ctx.font='bold 46px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,256,66,480);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(12,3),new THREE.MeshBasicMaterial({map:texture,color,side:THREE.DoubleSide}));parent.add(sign);return sign;
}
function courseGroup(scene,p,lane=0){const g=new THREE.Group();g.position.copy(place(p,lane));g.rotation.y=Math.atan2(tangent(p).x,tangent(p).z);scene.add(g);return g}
function makeCar(color,custom={},rival=false,kind='runner'){
  const group=new THREE.Group(),body=new THREE.Group(),paint=new THREE.MeshPhysicalMaterial({color,roughness:.22,metalness:.58,clearcoat:1,clearcoatRoughness:.1}),black=new THREE.MeshStandardMaterial({color:0x071420,roughness:.3,metalness:.25}),trim=glow(rival?0xff526a:0x59e4f7,.8);
  const width=(kind==='bruiser'?2.55:kind==='drifter'?2.32:2.1)*clamp(custom.width||1,.75,1.25),height=clamp(custom.height||1,.75,1.25),length=kind==='bruiser'?4.5:4.2;
  group.add(body);box(body,[width,.54*height,length],[0,.84*height,0],paint);
  box(body,[width*.73,.65*height,1.95],[0,1.36*height,-.3],black);
  box(body,[width*.85,.13,1.4],[0,1.08*height,1.35],paint);
  box(body,[width*.96,.13,.42],[0,.58,2.18],black);box(body,[width*.96,.13,.42],[0,.58,-2.18],black);
  if(kind==='bruiser'){for(const x of [-width*.43,width*.43])box(body,[.25,.38,3.5],[x,.96,0],trim)}
  if(kind==='drifter'){box(body,[width*1.1,.1,.46],[0,1.82*height,-1.92],paint);for(const x of [-width*.42,width*.42])box(body,[.09,.5,.1],[x,1.57*height,-1.92],black)}
  const wheels=[];for(const x of [-1,1])for(const z of [-1.34,1.34]){
    const wheel=new THREE.Group();wheel.position.set(x*(width/2+.12),.46,z);group.add(wheel);
    const tire=new THREE.Mesh(new THREE.CylinderGeometry(.49,.49,.38,20),black);tire.rotation.z=Math.PI/2;wheel.add(tire);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.26,.26,.4,12),trim);hub.rotation.z=Math.PI/2;wheel.add(hub);wheels.push(wheel);
  }
  for(const x of [-width*.31,width*.31]){box(body,[.46,.19,.12],[x,.92,2.13],glow(0xc8f7ff,1.6));box(body,[.49,.19,.12],[x,.91,-2.13],glow(0xff3349,1.2))}
  box(body,[width*.72,.1,.44],[0,1.17,-2.04],paint);group.userData={paint,wheels,body};return group;
}

function buildCity(scene){
  const asphalt=new THREE.MeshStandardMaterial({color:0x1c3547,roughness:.82}),marketRoad=new THREE.MeshStandardMaterial({color:0x31405b,roughness:.7}),deckRoad=new THREE.MeshStandardMaterial({color:0x384450,roughness:.74}),sidewalk=new THREE.MeshStandardMaterial({color:0x687b84,roughness:.87}),edge=glow(0x31c8e5,.5),land=new THREE.MeshStandardMaterial({color:0x285044,roughness:1});
  box(scene,[470,.2,430],[0,-.24,0],land);
  // Short segments follow the curve with consistent width, including on portrait devices.
  const mark=new THREE.MeshBasicMaterial({color:0xf3cd78});
  for(let i=0;i<128;i++){
    const p=i/128,q=(i+1)/128,m=(p+q)/2,a=place(p),b=place(q),len=a.distanceTo(b),t=tangent(m),mid=a.add(b).multiplyScalar(.5),zone=cityZone(m),y=deckHeight(m);
    const slab=box(scene,[zone.roadWidth,.14,len+1],[mid.x,y,mid.z],zone.id==='market'?marketRoad:zone.id==='parking'?deckRoad:asphalt);slab.rotation.y=Math.atan2(t.x,t.z);
    if(i%4===0){const dash=box(scene,[.2,.018,len*.7],[mid.x,y+.09,mid.z],mark);dash.rotation.y=slab.rotation.y;dash.castShadow=false}
    for(const lane of [-zone.roadWidth*.54,zone.roadWidth*.54]){const n=normal(m),curb=box(scene,[.35,.3,len+1],[mid.x+n.x*lane,y+.16,mid.z+n.z*lane],i%8<2?edge:sidewalk);curb.rotation.y=Math.atan2(t.x,t.z);curb.castShadow=false}
    if(zone.id==='parking'&&i%4===0)for(const lane of [-7,7]){const post=place(m,lane);box(scene,[.48,Math.max(1,y),.48],[post.x,y/2-.15,post.z],sidewalk)}
  }
  const glass=new THREE.MeshStandardMaterial({color:0x345f7e,metalness:.48,roughness:.25,emissive:0x0a1f32,emissiveIntensity:.45}),stone=new THREE.MeshStandardMaterial({color:0x445563,roughness:.8}),window=glow(0xf5c872,.7);
  // Fixed, low-cost buildings form the downtown center and outer skyline.
  for(let i=0;i<(innerWidth<800?34:54);i++){
    const angle=i*2.39996,r=i%3===0?125:33+(i%5)*7,x=Math.sin(angle)*r,z=Math.cos(angle)*r;
    if(Math.abs(Math.hypot(x/RX,z/RZ)-1)<.43)continue;
    const h=11+(i*13)%45,w=8+(i*7)%8,d=8+(i*11)%8;
    box(scene,[w,h,d],[x,h/2-.1,z],i%4===0?glass:stone);
    box(scene,[w+1,.6,d+1],[x,h+.15,z],i%4===0?window:glass);
    for(let floor=4;floor<h-2;floor+=4)for(const dx of [-w*.24,w*.24])box(scene,[1.2,1.2,.08],[x+dx,floor,z+d/2+.06],i%4===0?window:glass);
  }
  // A readable skyline and planted verge make the bounded road feel like a city circuit.
  const trunk=new THREE.MeshStandardMaterial({color:0x514536,roughness:1}),canopy=new THREE.MeshStandardMaterial({color:0x277768,roughness:.94});
  for(let i=0;i<42;i++){
    const p=(i+.35)/42,side=i%2?1:-1,pos=place(p,side*17);
    box(scene,[.8,3.6,.8],[pos.x,1.8,pos.z],trunk);
    const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(2.7+(i%3)*.35,1),canopy);crown.position.set(pos.x,5.2,pos.z);scene.add(crown);
  }
  // The office route is a real lit passage on the inner line, not a floating gate.
  const tower=box(scene,[17,82,17],[0,41,0],glass);tower.name='WISDO City Tower';
  for(let y=8;y<80;y+=5)box(scene,[17.4,.2,17.4],[0,y,0],window);
  const office=place(.27,12);const officeGate=new THREE.Group();officeGate.position.copy(office);officeGate.rotation.y=Math.atan2(tangent(.27).x,tangent(.27).z);scene.add(officeGate);
  for(const x of [-12,12])box(officeGate,[8,16,14],[x,8,0],glass);
  box(officeGate,[32,1,15],[0,16.5,0],window);
  for(let i=0;i<12;i++){const p=.2+i*.01,pos=place(p,12),path=box(scene,[9,.1,8],[pos.x,.04,pos.z],asphalt);path.rotation.y=Math.atan2(tangent(p).x,tangent(p).z)}
  for(let i=0;i<9;i++){
    const p=.215+i*.012,g=courseGroup(scene,p,12);
    for(const x of [-6.5,6.5]){box(g,[3.4,9,6],[x,4.5,0],glass);box(g,[.13,5,3],[x-Math.sign(x)*1.78,4.3,0],window)}
    box(g,[16,.5,6],[0,9.2,0],stone);box(g,[10,.12,.4],[0,8.83,0],window);
  }
  const officeSign=courseGroup(scene,.208,12);streetSign(officeSign,'OFFICE SPEEDWAY').position.set(0,11,0);
  // Market stalls and overhead light bars make the next section legible at speed.
  const awning=glow(0xf05a9c,.55),stall=new THREE.MeshStandardMaterial({color:0x674963,roughness:.65});
  for(let i=0;i<14;i++){
    const p=.35+i*.012,g=courseGroup(scene,p,i%2?17:-17);
    box(g,[6,3,5],[0,1.5,0],stall);box(g,[7,.28,6],[0,3.2,0],i%3?awning:window);
    if(i%3===0){const bar=courseGroup(scene,p);for(const x of [-10,10])box(bar,[.2,6,.2],[x,3,0],stone);box(bar,[20,.2,.3],[0,6,0],awning)}
  }
  const marketSign=courseGroup(scene,.34);streetSign(marketSign,'NIGHT MARKET',0xffa2d6).position.set(0,9,0);
  // Elevated deck with an open skyline, guardrails and a descending exit.
  for(let i=0;i<12;i++){
    const p=.55+i*.016,g=courseGroup(scene,p);g.position.y=deckHeight(p);
    for(const x of [-9,9]){box(g,[.3,2,5],[x,1,0],edge);if(i%3===0)box(g,[.5,deckHeight(p)+1,.5],[x,-(deckHeight(p)+1)/2,0],stone)}
  }
  const deckSign=courseGroup(scene,.56);deckSign.position.y=deckHeight(.56);streetSign(deckSign,'PARKING DECK').position.set(0,8,0);
  const towerSign=courseGroup(scene,.81);streetSign(towerSign,'WISDO TOWER').position.set(0,10,0);
  for(const p of [.07,.56]){const pos=place(p,ROAD*.64),t=tangent(p);const rail=box(scene,[.14,.3,27],[pos.x,.95+deckHeight(p),pos.z],edge);rail.rotation.y=Math.atan2(t.x,t.z)}
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
  const car=makeCar(options.paint,{width:options.width,height:options.height},false,options.car);scene.add(car);
  const rivals=[makeCar(0xff5473,{},true,'bruiser'),makeCar(0xffce67,{},true,'drifter'),makeCar(0x9c79ff,{},true,'runner')];rivals.forEach(rival=>scene.add(rival));
  const coins=seededCoins().map(row=>{const mesh=coinMesh(row.value);const pos=place(row.progress,row.lane);mesh.position.set(pos.x,1.7+deckHeight(row.progress),pos.z);scene.add(mesh);return{...row,mesh,takenLap:-1}});
  const bins=Array.from({length:4},(_,i)=>checkpoint(scene,i));
  const hazard=glow(0xff4266,.9),ramp=glow(0x8cebff,.5);
  for(const p of [.15,.82]){const pos=place(p,-4),t=tangent(p),mesh=box(scene,[8,.5,6],[pos.x,.22,pos.z],ramp);mesh.rotation.y=Math.atan2(t.x,t.z)}
  for(const p of [.05,.43,.79]){const pos=place(p),t=tangent(p),pad=box(scene,[10,.09,4],[pos.x,deckHeight(p)+.12,pos.z],glow(0x23d8fb,1));pad.rotation.y=Math.atan2(t.x,t.z)}
  for(const p of [.42,.85]){const pos=place(p,4),mesh=box(scene,[5,.6,2],[pos.x,.3,pos.z],hazard);mesh.rotation.y=Math.atan2(tangent(p).x,tangent(p).z)}
  return{scene,camera,renderer,car,rivals,coins,bins};
}

function message(text){$('message').textContent=text}
function display(s){const remaining=Math.max(0,Math.ceil(s.duration-s.elapsed));$('clock').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;$('banked').textContent=s.player.banked;$('carried').textContent=s.player.carried;$('rival').textContent=Math.max(...s.ais.map(ai=>ai.banked));$('place').textContent=`${1+s.ais.filter(ai=>ai.banked>s.player.banked).length} / 4`;$('bin').textContent=`${s.player.nextCheckpoint+1} / 4`;$('weapon').textContent=s.weapon;$('speed').textContent=Math.round(Math.abs(s.speed)*3.6);$('district').textContent=s.offroad?'SIDEWALK · SLOWDOWN':s.grind?'RAIL GRIND · WEAPON CHARGE':cityZone(s.progress).label}
function hit(s,perfect){const next=applyHit(s.player,{perfect});s.player=next;s.hitCooldown=1.7;message(perfect?`PERFECT HIT! ${next.lost} CARRIED COINS SPILLED`:`CONTACT · ${next.lost} CARRIED COINS SPILLED`);s.shake=.65}
function loop(t){const s=runtime;if(!s||s.stopped)return;s.raf=requestAnimationFrame(loop);if(s.paused){s.last=t;return}const dt=Math.min(.035,Math.max(0,(t-s.last)/1000));s.last=t;s.elapsed+=dt;s.player.cleanSeconds+=dt;s.hitCooldown=Math.max(0,s.hitCooldown-dt);s.jump=Math.max(0,s.jump-dt);s.strikeCooldown=Math.max(0,s.strikeCooldown-dt);s.shake=Math.max(0,s.shake-dt*2);
  if(keys.has('KeyR')){keys.delete('KeyR');recover(s)}
  const profile=palette[s.options.car],throttle=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),steer=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  const cleanBoost=s.player.cleanSeconds>=12,boost=(keys.has('ShiftLeft')||keys.has('ShiftRight'))&&cleanBoost&&s.speed>5;
  const top=profile.top*(s.offroad?.62:1)*(boost?1.28:1)*cityZone(s.progress).speed*(s.shortcut?1.14:1);s.speed=clamp(s.speed+(throttle>0?15:throttle<0?-21:-7*Math.sign(s.speed))*dt,-9,top);
  s.heading-=steer*profile.turn*dt*clamp(Math.abs(s.speed)/12,.18,1.35)*Math.sign(s.speed||1);
  const forward=new THREE.Vector3(Math.sin(s.heading),0,Math.cos(s.heading));s.position.addScaledVector(forward,s.speed*dt);
  const radius=Math.hypot(s.position.x/RX,s.position.z/RZ),edge=clamp(radius,.76,1.24);
  if(radius!==edge){s.position.x*=edge/radius;s.position.z*=edge/radius;s.speed*=.58;message('ARENA BARRIER · RETURN TO THE CITY COURSE')}
  const progress=worldProgress(s.position.x,s.position.z);if(s.progress>.88&&progress<.12&&s.speed>0){s.lap++;message('NEW LAP · TRACK COINS RESTORED')}s.progress=progress;
  s.shortcut=progress>.2&&progress<.31&&radius<.93&&radius>.76;
  s.offroad=Math.abs(radius-1)>.115&&!s.shortcut;
  s.offroadSeconds=s.offroad?s.offroadSeconds+dt:0;
  if(s.offroadSeconds>4)recover(s);
  const railLane=Math.abs(radius-1)*Math.min(RX,RZ),railSection=[.07,.56].some(p=>Math.abs(progress-p)<.045),onRail=railSection&&railLane>8.7&&railLane<12&&Math.abs(s.speed)>11;s.grind=onRail;
  if(onRail){s.grindTime+=dt;if(s.grindTime>=1.25){s.weapon=Math.min(3,s.weapon+1);s.grindTime=0;message('RAIL GRIND · CAR BOXING CHARGE +1')}}else s.grindTime=0;
  const rampContact=[.15,.82].some(p=>Math.abs(progress-p)<.006)&&away(s.position,place(progress,-4))<5;
  if((keys.has('Space')||rampContact)&&s.jump<=0&&s.jumpCooldown<=0){s.jump=.7;s.jumpCooldown=1.3;if(rampContact){s.weapon=Math.min(3,s.weapon+1);message('RAMP JUMP · CAR BOXING CHARGE +1')}else message('SIDEWALK JUMP')}s.jumpCooldown=Math.max(0,s.jumpCooldown-dt);
  s.boostCooldown=Math.max(0,s.boostCooldown-dt);
  if(s.boostCooldown<=0&&[.05,.43,.79].some(p=>Math.abs(progress-p)<.006)&&Math.abs(radius-1)<.1&&s.speed>4){s.speed=Math.min(top*1.28,s.speed+11);s.boostCooldown=3;message('BOOST STRIP · HOLD THE COIN LINE')}
  const y=s.jump>0?Math.sin((1-s.jump/.7)*Math.PI)*2.8:0,surface=s.offroad?0:deckHeight(progress),carY=surface+y+(onRail?.72:0);
  s.visual.car.position.set(s.position.x,carY,s.position.z);s.visual.car.rotation.y=s.heading;
  s.visual.car.userData.body.position.y=Math.sin(t*.018)*Math.min(.055,Math.abs(s.speed)*.002)+(s.grind?.1:0);
  for(const wheel of s.visual.car.userData.wheels)wheel.rotation.x-=s.speed*dt/.49;
  s.visual.coins.forEach(c=>{const d=(c.progress-progress+1)%1;c.mesh.visible=c.takenLap!==s.lap&&d<.23;c.mesh.rotation.y+=dt*1.8;if(c.mesh.visible&&away(s.position,c.mesh.position)<2.7){s.player=collectCoin(s.player,c.value);c.takenLap=s.lap;c.mesh.visible=false;message(`+${c.value} TRACK COIN${c.value>1?'S':''} · CARRY TO THE NEXT BIN`)}});
  const cp=s.player.nextCheckpoint,bin=s.visual.bins[cp];if(away(s.position,bin.position)<8&&s.checkpointCooldown<=0){const next=depositCheckpoint(s.player,cp);s.player=next;s.checkpointCooldown=4;message(`CHECKPOINT ${cp+1} · ${next.deposited} COINS BANKED · ${next.carried} STILL CARRIED`)}s.checkpointCooldown=Math.max(0,s.checkpointCooldown-dt);
  // Three local AI cars fill the four slots. No network match or account payout is implied.
  s.ais.forEach((ai,i)=>{
    ai.progress=(ai.progress+dt*(.023+i*.0016))%1;ai.position.copy(place(ai.progress,(i-1)*2.7+1.5*Math.sin(s.elapsed*.65+i)));
    const model=s.visual.rivals[i];model.position.copy(ai.position);model.position.y=deckHeight(ai.progress);model.rotation.y=Math.atan2(tangent(ai.progress).x,tangent(ai.progress).z);
    for(const wheel of model.userData.wheels)wheel.rotation.x-=dt*(12+i);
    ai.collectTimer+=dt;if(ai.collectTimer>=2.3+i*.25){ai.collectTimer=0;ai.carried+=1}
    const aiCp=(ai.nextCheckpoint+1)/4;if(Math.abs(ai.progress-aiCp)<.008&&ai.checkpointCooldown<=0){s.ais[i]=depositCheckpoint(ai,ai.nextCheckpoint);s.ais[i].checkpointCooldown=2.5}
    s.ais[i].checkpointCooldown=Math.max(0,s.ais[i].checkpointCooldown-dt);
  });
  const target=s.ais.map((ai,i)=>({ai,i,gap:away(s.position,ai.position)})).sort((a,b)=>a.gap-b.gap)[0];
  if(target.gap<4&&s.hitCooldown<=0){if(keys.has('KeyE')&&s.weapon>0&&s.strikeCooldown<=0){const perfect=target.gap<2.2&&Math.abs(s.speed)>15;s.ais[target.i]=applyHit(target.ai,{perfect});s.weapon--;s.strikeCooldown=1.8;s.hitCooldown=1.5;message(perfect?'PERFECT CAR BOX · RIVAL DROPPED ALL CARRIED COINS':'CAR BOX · RIVAL DROPPED SOME CARRIED COINS')}else hit(s,false)}
  const follow=s.position.clone().addScaledVector(forward,-11).add(new THREE.Vector3(0,6.5+carY,0));s.visual.camera.position.lerp(follow,1-Math.exp(-5*dt));s.visual.camera.lookAt(s.position.clone().addScaledVector(forward,9).add(new THREE.Vector3(0,2.1+surface,0)));if(s.shake)s.visual.camera.position.x+=Math.sin(t*.07)*s.shake*.18;
  s.visual.renderer.render(s.visual.scene,s.visual.camera);display(s);if(s.elapsed>=s.duration)endRace(s);
}

function recover(s){
  const progress=worldProgress(s.position.x,s.position.z),safe=place(progress);
  s.position.copy(safe);s.heading=Math.atan2(tangent(progress).x,tangent(progress).z);s.speed=0;s.offroad=false;s.offroadSeconds=0;
  message('BACK ON TRACK · COINS STILL AT RISK');
}

function endRace(s){if(s.stopped)return;s.stopped=true;cancelAnimationFrame(s.raf);keys.clear();const result=localRaceResult([{id:'you',...s.player},...s.ais.map((ai,i)=>({id:`ai-${i+1}`,...ai}))],Math.round(s.elapsed));const place=result.placements.find(row=>row.id==='you').place;$('overlayEyebrow').textContent='RACE COMPLETE · LOCAL RESULT';$('overlayTitle').textContent=place===1?'YOU WON THE COIN CIRCUIT':'THE AI TOOK THE CIRCUIT';$('overlayBody').textContent=`PLACE ${place} OF 4 · You banked ${s.player.banked} coins at ${s.player.checkpoints} checkpoints. Unbanked coins do not count. Rewards are unverified; no Culture Coin or XP was credited.`;$('resume').textContent='RACE AGAIN';$('resume').onclick=()=>{stop();startRace(s.options)};$('overlay').hidden=false}
function pause(){const s=runtime;if(!s||s.stopped)return;s.paused=!s.paused;keys.clear();$('overlay').hidden=!s.paused;$('overlayEyebrow').textContent='PAUSED';$('overlayTitle').textContent='Catch your breath';$('overlayBody').textContent='The race clock is stopped. Your carried coins stay at risk when you resume.';$('resume').textContent='RESUME';$('resume').onclick=()=>{s.paused=false;s.last=performance.now();$('overlay').hidden=true}}
function stop(){if(runtime){runtime.stopped=true;cancelAnimationFrame(runtime.raf);runtime.visual.renderer.dispose();runtime.visual.scene.traverse(o=>{o.geometry?.dispose?.();if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{m.map?.dispose?.();m.dispose?.()})}})}runtime=null;keys.clear();$('overlay').hidden=true;$('play').hidden=true}
function startRace(options){stop();let visual;try{visual=makeScene(options)}catch(error){$('overlay').hidden=false;$('overlayEyebrow').textContent='3D UNAVAILABLE';$('overlayTitle').textContent='Unable to open the race';$('overlayBody').textContent='This device or browser could not start WebGL. '+error.message;$('resume').hidden=true;return}
  $('garage').hidden=true;$('play').hidden=false;$('resume').hidden=false;const position=at(0);runtime={options,visual,duration:raceDuration(options.minutes),elapsed:0,last:performance.now(),stopped:false,paused:false,raf:0,position,heading:Math.PI/2,speed:0,progress:0,lap:0,offroad:false,offroadSeconds:0,shortcut:false,grind:false,grindTime:0,weapon:0,jump:0,jumpCooldown:0,boostCooldown:0,checkpointCooldown:0,hitCooldown:0,strikeCooldown:0,shake:0,player:{carried:0,banked:0,collected:0,checkpoints:0,nextCheckpoint:0,cleanSeconds:0},ais:Array.from({length:3},(_,i)=>({position:place(.04+i*.018),progress:.04+i*.018,carried:0,banked:0,checkpoints:0,nextCheckpoint:0,collectTimer:0,checkpointCooldown:0}))};
  visual.car.position.copy(position);visual.car.rotation.y=Math.PI/2;visual.rivals.forEach((rival,i)=>rival.position.copy(runtime.ais[i].position));visual.camera.position.copy(position).add(new THREE.Vector3(-11,6.5,0));visual.camera.lookAt(position.clone().add(new THREE.Vector3(9,2.1,0)));message(`${COINS_PER_LAP} TRACK COINS PER LAP · BANK THEM AT THE BINS`);resize();runtime.visual.renderer.render(visual.scene,visual.camera);runtime.raf=requestAnimationFrame(loop)}
function resize(){if(!runtime)return;const {renderer,camera}=runtime.visual,w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
window.addEventListener('resize',resize);window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='Escape'){pause();return}keys.add(e.code)});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{if(runtime&&!runtime.paused)pause()});
document.querySelectorAll('[data-key]').forEach(button=>{const key=button.dataset.key;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(key);button.classList.add('pressed')});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{keys.delete(key);button.classList.remove('pressed')})});
$('start').onclick=()=>startRace({minutes:Number(document.querySelector('input[name="minutes"]:checked').value),car:document.querySelector('input[name="car"]:checked').value,width:Number($('bodyWidth').value)/100,height:Number($('rideHeight').value)/100,paint:$('paint').value});$('pause').onclick=pause;$('resume').onclick=pause;$('exit').onclick=()=>{stop();$('garage').hidden=false};
