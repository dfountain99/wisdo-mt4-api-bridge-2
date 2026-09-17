(() => {
'use strict';
const B=BABYLON, canvas=document.getElementById('renderCanvas');
const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true,adaptToDeviceRatio:true});
const low=(navigator.hardwareConcurrency||4)<=4||innerWidth<760;
engine.setHardwareScalingLevel(low?Math.min(1.7,devicePixelRatio||1):Math.min(1.25,devicePixelRatio||1));
const scene=new B.Scene(engine); scene.clearColor=new B.Color4(.006,.012,.025,1);
scene.fogMode=B.Scene.FOGMODE_EXP2; scene.fogDensity=.00072; scene.fogColor=new B.Color3(.018,.026,.045);
scene.imageProcessingConfiguration.toneMappingEnabled=true; scene.imageProcessingConfiguration.toneMappingType=B.ImageProcessingConfiguration.TONEMAPPING_ACES;
scene.imageProcessingConfiguration.exposure=1.08; scene.imageProcessingConfiguration.contrast=1.12;
const C={gold:B.Color3.FromHexString('#d4af37'),gold2:B.Color3.FromHexString('#f3d66b'),black:B.Color3.FromHexString('#05070b'),glass:B.Color3.FromHexString('#13243b'),blue:B.Color3.FromHexString('#4fb5ff'),green:B.Color3.FromHexString('#3bff9c'),red:B.Color3.FromHexString('#ff4c5f')};
const mats={};
function mat(n,c,metal=.1,rough=.55,em=null){let m=new B.PBRMaterial(n,scene);m.albedoColor=c;m.metallic=metal;m.roughness=rough;if(em){m.emissiveColor=em;m.emissiveIntensity=1.2}mats[n]=m;return m}
mat('asphalt',B.Color3.FromHexString('#11151c'),.05,.9);mat('concrete',B.Color3.FromHexString('#353a42'),.02,.82);mat('dark',C.black,.75,.26);mat('gold',C.gold,.95,.18);mat('glass',C.glass,.42,.12,C.blue.scale(.07));mats.glass.alpha=.72;mat('white',B.Color3.FromHexString('#dce3ec'),.05,.5);mat('green',B.Color3.FromHexString('#123c2a'),.1,.7);mat('neon',B.Color3.FromHexString('#091b2d'),.4,.2,C.blue);mat('redNeon',B.Color3.FromHexString('#2b0a10'),.4,.2,C.red);
const hemi=new B.HemisphericLight('sky',new B.Vector3(.15,1,.1),scene);hemi.intensity=.42;hemi.diffuse=new B.Color3(.55,.64,.8);hemi.groundColor=new B.Color3(.04,.03,.05);
const moon=new B.DirectionalLight('moon',new B.Vector3(-.35,-1,.28),scene);moon.position=new B.Vector3(250,420,-180);moon.intensity=1.35;moon.diffuse=new B.Color3(.62,.73,1);
const shadow=new B.ShadowGenerator(low?1024:2048,moon);shadow.usePercentageCloserFiltering=true;shadow.bias=.0005;
const glow=new B.GlowLayer('cityGlow',scene,{blurKernelSize:low?24:48});glow.intensity=.72;
const world=new B.TransformNode('WISDO_CITY',scene), interactables=[], npcs=[], vehicles=[], districtNodes=[];
function box(n,w,h,d,x,y,z,m,parent=world){let o=B.MeshBuilder.CreateBox(n,{width:w,height:h,depth:d},scene);o.position.set(x,y,z);o.material=m;o.parent=parent;o.receiveShadows=true;o.freezeWorldMatrix();return o}
function cyl(n,diam,h,x,y,z,m,parent=world){let o=B.MeshBuilder.CreateCylinder(n,{diameter:diam,height:h,tessellation:low?12:20},scene);o.position.set(x,y,z);o.material=m;o.parent=parent;o.freezeWorldMatrix();return o}
function textPlane(text,x,y,z,w=18,h=3,parent=world){let p=B.MeshBuilder.CreatePlane('sign_'+text,{width:w,height:h},scene);p.position.set(x,y,z);let dt=new B.DynamicTexture('dt_'+text,{width:1024,height:192},scene,false);dt.hasAlpha=true;dt.drawText(text,null,132,'bold 74px Arial','#f4d66d','transparent',true);let mm=new B.StandardMaterial('sm_'+text,scene);mm.diffuseTexture=dt;mm.opacityTexture=dt;mm.emissiveTexture=dt;mm.disableLighting=true;p.material=mm;p.parent=parent;return p}
function road(x,z,w,d){box('road',w,.22,d,x,.05,z,mats.asphalt);for(let t=-d/2+10;t<d/2;t+=16)box('lane',.22,.03,7,x,.18,z+t,mats.gold)}
function roadX(x,z,w,d){box('roadX',w,.22,d,x,.05,z,mats.asphalt);for(let t=-w/2+10;t<w/2;t+=16)box('laneX',7,.03,.22,x+t,.18,z,mats.gold)}
function sidewalk(x,z,w,d){box('walk',w,.35,d,x,.17,z,mats.concrete)}
function tree(x,z,s=1){let p=new B.TransformNode('tree',scene);p.position.set(x,0,z);p.parent=world;cyl('trunk',.8*s,5*s,0,2.5*s,0,mats.dark,p);let crown=B.MeshBuilder.CreateSphere('crown',{diameter:5*s,segments:low?5:8},scene);crown.position.y=6*s;crown.material=mats.green;crown.parent=p;p.freezeWorldMatrix()}
function lamp(x,z){let p=new B.TransformNode('lamp',scene);p.position.set(x,0,z);p.parent=world;cyl('pole',.18,7,0,3.5,0,mats.dark,p);let l=B.MeshBuilder.CreateSphere('bulb',{diameter:.5,segments:6},scene);l.position.y=7;l.material=mats.gold;l.parent=p;if(!low){let q=new B.PointLight('pl',new B.Vector3(x,7,z),scene);q.diffuse=C.gold2;q.intensity=.45;q.range=18}p.freezeWorldMatrix()}
function tower(n,x,z,w,d,h,label,accent=C.gold){let root=new B.TransformNode(n,scene);root.position.set(x,0,z);root.parent=world;let body=box(n+'_body',w,h,d,0,h/2,0,mats.glass,root);body.freezeWorldMatrix();box(n+'_base',w+2,2,d+2,0,1,0,mats.dark,root);for(let y=5;y<h;y+=7){box('floor',w+.15,.22,d+.15,0,y,0,mats.gold,root)}
for(let yy=8;yy<h-3;yy+=10){for(let side of [-1,1]){let strip=box('light',.28,5,d*.72,side*(w/2+.08),yy,0,mats.neon,root);strip.material=mats.neon}}
textPlane(label,0,Math.min(h-5,18),d/2+.18,Math.max(16,w*.9),3,root);districtNodes.push(root);return root}
function landmark(n,x,z,w,d,h,label){let r=tower(n,x,z,w,d,h,label);let crown=cyl('crown',w*.5,4,0,h+2,0,mats.gold,r);crown.freezeWorldMatrix();return r}
function lowBuilding(n,x,z,w,d,h,label){let r=new B.TransformNode(n,scene);r.position.set(x,0,z);r.parent=world;box('shell',w,h,d,0,h/2,0,mats.dark,r);box('glassFront',w*.82,h*.66,.3,0,h*.52,d/2+.18,mats.glass,r);box('goldCap',w+1,.55,d+1,0,h+.28,0,mats.gold,r);textPlane(label,0,h*.73,d/2+.38,Math.min(w*.8,24),2.7,r);districtNodes.push(r);return r}
function plaza(){
box('plaza',150,.25,120,0,.1,0,mats.concrete);for(let x=-65;x<=65;x+=13){tree(x,-50,.75);tree(x,50,.75)}for(let z=-38;z<=38;z+=19){lamp(-68,z);lamp(68,z)}
let ring=B.MeshBuilder.CreateTorus('wisdoRing',{diameter:28,thickness:1.1,tessellation:48},scene);ring.position.y=7;ring.rotation.x=Math.PI/2;ring.material=mats.gold;ring.parent=world;
let core=cyl('wisdoCore',7,14,0,7,0,mats.neon);textPlane('WISDO',0,9,3.6,13,3);
interactables.push({mesh:core,label:'WISDO WORLD CORE',action:()=>flash('WISDO WORLD NETWORK • ONLINE')});
}
function academy(){
let r=lowBuilding('academy',-185,-120,92,64,25,'WISDO ACADEMY');for(let i=-3;i<=3;i++)cyl('column',2.1,17,i*11,8.5,33,mats.gold,r);
let chamber=lowBuilding('masterChamber',-185,-205,62,48,18,'MASTER CHAMBER');interactables.push({mesh:r.getChildMeshes()[0],label:'ENTER WISDO ACADEMY',action:()=>flash('ACADEMY • LESSONS • SIMULATIONS • SEMINARS')});interactables.push({mesh:chamber.getChildMeshes()[0],label:'ENTER MASTER CHAMBER',action:()=>flash('OG MASTER • CHAMBER AVAILABLE')});
}
function trading(){
let hall=lowBuilding('tradingHall',185,-105,104,70,31,'TRADING HALL');let vault=lowBuilding('botVault',190,-205,74,50,22,'BOT VAULT');let broker=lowBuilding('brokerCenter',285,-105,58,54,20,'ACCOUNT LINK');
interactables.push({mesh:hall.getChildMeshes()[0],label:'OPEN TRADING HALL',action:()=>flash('LIVE ACCOUNTS • POSITIONS • COPY LANES')});interactables.push({mesh:vault.getChildMeshes()[0],label:'OPEN BOT VAULT',action:()=>flash('WISDO BOT VAULT • OWNED SYSTEMS')});interactables.push({mesh:broker.getChildMeshes()[0],label:'ACCOUNT CENTER',action:()=>location.assign('/app/dashboard')});
}
function civic(){
landmark('wisdoTower',0,210,62,62,142,'WISDO TOWER');lowBuilding('creatorRow',-140,185,75,45,19,'CREATOR ROW');lowBuilding('marketplace',140,185,82,48,21,'MARKETPLACE');lowBuilding('socialClub',-145,265,68,45,18,'SOCIAL CLUB');lowBuilding('missionHQ',145,265,68,45,18,'MISSION HQ');
}
function residential(){
for(let row=0;row<3;row++)for(let col=0;col<5;col++){let x=-320+col*62,z=90+row*68;let h=28+((row*17+col*13)%34);tower('res_'+row+'_'+col,x,z,42,42,h,'');}
for(let row=0;row<3;row++)for(let col=0;col<5;col++){let x=320-col*62,z=95+row*68;let h=30+((row*11+col*19)%38);tower('commerce_'+row+'_'+col,x,z,42,42,h,'');}
}
function skyline(){
for(let i=0;i<34;i++){let a=i/34*Math.PI*2,r=430+(i%4)*32,x=Math.cos(a)*r,z=Math.sin(a)*r,h=40+(i*37%105);tower('sky_'+i,x,z,34+(i%3)*8,34+(i%4)*6,h,'');}
}
function streets(){
for(let x of [-360,-240,-120,0,120,240,360])road(x,0,18,820);for(let z of [-330,-220,-110,0,110,220,330])roadX(0,z,820,18);
for(let x=-390;x<=390;x+=60)for(let z=-390;z<=390;z+=110){if(Math.abs(x)>75||Math.abs(z)>70){if((x+z)%120===0)tree(x+16,z+18,.65)}}
for(let x=-350;x<=350;x+=70){lamp(x,-22);lamp(x,22)}for(let z=-330;z<=330;z+=70){lamp(-22,z);lamp(22,z)}
}
function makeHuman(name,x,z,scale=1,master=false){let r=new B.TransformNode(name,scene);r.position.set(x,0,z);r.scaling.setAll(scale);r.parent=world;let skin=master?mats.white:mats.concrete,cloth=master?mats.gold:mats.dark;
cyl('body',1.45,2.5,0,3.1,0,cloth,r);let head=B.MeshBuilder.CreateSphere('head',{diameter:1.25,segments:8},scene);head.position.y=4.9;head.material=skin;head.parent=r;
for(let s of [-1,1]){let leg=cyl('leg',.42,2.3,s*.38,1.15,0,mats.dark,r);let arm=cyl('arm',.34,2.1,s*.95,3.25,0,cloth,r);arm.rotation.z=s*.15}
if(master){let beard=B.MeshBuilder.CreateSphere('beard',{diameter:.9,segments:7},scene);beard.scaling.y=.7;beard.position.set(0,4.55,.38);beard.material=mats.white;beard.parent=r;textPlane('OG MASTER',0,6.5,0,6,1.3,r)}
return r}
function population(){let master=makeHuman('OG_MASTER',-185,-195,1.25,true);interactables.push({mesh:master.getChildMeshes()[0],label:'SPEAK WITH OG MASTER',action:()=>flash('OG MASTER • WELCOME TO THE CHAMBER')});
for(let i=0;i<(low?18:42);i++){let x=-350+(i*83)%700,z=-310+(i*137)%620,n=makeHuman('npc_'+i,x,z,.82+(i%4)*.06);npcs.push({node:n,phase:i*.71,speed:.4+(i%5)*.08,origin:n.position.clone()})}}
function car(name,x,z,axis=0){let r=new B.TransformNode(name,scene);r.position.set(x,.7,z);r.parent=world;box('carbody',3.6,.8,7,0,.8,0,mats.dark,r);box('carroof',3,.75,3.2,0,1.5,-.4,mats.glass,r);for(let sx of [-1,1])for(let sz of [-1,1])cyl('wheel',.8,.35,sx*1.7,.45,sz*2.35,mats.concrete,r).rotation.z=Math.PI/2;r.rotation.y=axis?Math.PI/2:0;return r}
function traffic(){for(let i=0;i<(low?10:22);i++){let vertical=i%2===0,n=car('car_'+i,vertical?(-360+(i%7)*120):(-360+i*33),vertical?(-330+i*31):(-220+(i%7)*110),vertical?0:1);vehicles.push({node:n,vertical,dir:i%3?1:-1,speed:7+(i%5)*1.4})}}
streets();plaza();academy();trading();civic();residential();skyline();population();traffic();
const ground=B.MeshBuilder.CreateGround('ground',{width:1200,height:1200,subdivisions:2},scene);ground.material=mats.asphalt;ground.position.y=-.18;ground.receiveShadows=true;ground.parent=world;ground.freezeWorldMatrix();
const player=new B.TransformNode('Operator',scene);player.position.set(0,0,-62);
const body=makeHuman('operatorVisual',0,0,1,false);body.parent=player;body.position.set(0,0,0);body.getChildMeshes().forEach(m=>{m.unfreezeWorldMatrix?.();shadow.addShadowCaster(m)});
const camera=new B.ArcRotateCamera('camera',Math.PI/2,1.13,12,new B.Vector3(0,3.2,0),scene);camera.lowerRadiusLimit=7;camera.upperRadiusLimit=20;camera.lowerBetaLimit=.65;camera.upperBetaLimit=1.42;camera.wheelPrecision=30;camera.panningSensibility=0;camera.attachControl(canvas,true);camera.lockedTarget=player;camera.inertia=.82;camera.angularSensibilityX=2500;camera.angularSensibilityY=2500;
const keys={};addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyE')interact();if(e.code==='KeyM')toggleMap()});addEventListener('keyup',e=>keys[e.code]=false);
let map=false;function toggleMap(){map=!map;if(map){camera.radius=95;camera.beta=.18}else{camera.radius=12;camera.beta=1.13}}
function flash(msg){let p=document.getElementById('prompt');p.textContent=msg;p.style.display='block';clearTimeout(flash.t);flash.t=setTimeout(()=>{p.style.display='none'},2600)}
function interact(){let best=null,bd=12;for(let q of interactables){let d=B.Vector3.Distance(player.position,q.mesh.getAbsolutePosition());if(d<bd){best=q;bd=d}}if(best)best.action()}
const districts=[['CENTRAL PLAZA',0,0,115],['WISDO ACADEMY',-185,-120,105],['MASTER CHAMBER',-185,-205,80],['TRADING DISTRICT',205,-125,140],['WISDO TOWER',0,210,105],['CREATOR ROW',-140,185,80],['MARKETPLACE',140,185,85],['WEST RESIDENCES',-260,175,145],['EAST COMMERCE',260,175,145]];
function districtUpdate(){let best=['WISDO CITY',1e9];for(let d of districts){let dist=Math.hypot(player.position.x-d[1],player.position.z-d[2]);if(dist<d[3]&&dist<best[1])best=[d[0],dist]}document.getElementById('district').textContent=best[0]}
async function hydrate(){for(let u of ['/api/me/accounts','/api/dashboard','/api/mt4/accounts'])try{let r=await fetch(u,{credentials:'include'});if(!r.ok)continue;let j=await r.json();let a=j.accounts?.[0]||j.account||j.data?.accounts?.[0];if(a){document.getElementById('account').textContent=a.accountId||a.login||a.name||'LINKED';let eq=Number(a.equity||a.balance);if(Number.isFinite(eq))document.getElementById('equity').textContent='$'+eq.toLocaleString(undefined,{maximumFractionDigits:2});break}}catch{}}
let lastD=0;scene.onBeforeRenderObservable.add(()=>{let dt=Math.min(.04,engine.getDeltaTime()/1000),forward=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),side=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
if(forward||side){let yaw=camera.alpha-Math.PI/2,fx=Math.sin(yaw),fz=Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw),speed=(keys.ShiftLeft||keys.ShiftRight)?13:7;let dx=(fx*forward+rx*side)*speed*dt,dz=(fz*forward+rz*side)*speed*dt;player.position.x=B.Scalar.Clamp(player.position.x+dx,-405,405);player.position.z=B.Scalar.Clamp(player.position.z+dz,-405,405);player.rotation.y=Math.atan2(dx,dz)}
let t=performance.now()/1000;for(let n of npcs){let d=B.Vector3.DistanceSquared(player.position,n.node.position);n.node.setEnabled(d<42000);if(d<42000){n.node.position.x=n.origin.x+Math.sin(t*n.speed+n.phase)*12;n.node.position.z=n.origin.z+Math.cos(t*n.speed*.7+n.phase)*8;n.node.rotation.y=Math.atan2(Math.cos(t*n.speed+n.phase),-Math.sin(t*n.speed*.7+n.phase))}}
for(let v of vehicles){if(v.vertical){v.node.position.z+=v.dir*v.speed*dt;if(Math.abs(v.node.position.z)>400)v.node.position.z=-v.node.position.z}else{v.node.position.x+=v.dir*v.speed*dt;if(Math.abs(v.node.position.x)>400)v.node.position.x=-v.node.position.x}}
if(t-lastD>.35){districtUpdate();lastD=t}});
scene.executeWhenReady(()=>{document.getElementById('loading').style.display='none';hydrate();flash('WELCOME TO WISDO CITY')});
engine.runRenderLoop(()=>scene.render());addEventListener('resize',()=>engine.resize());
})();