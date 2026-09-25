import { WORLD_LOCATIONS } from './world-config.js';
import { createWorldPbrLibrary } from './world-pbr-materials.js';

const DEG=Math.PI/180;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

function box(THREE,size,position,material,{cast=true,receive=true,name=''}={}){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
  mesh.position.set(...position);mesh.castShadow=cast;mesh.receiveShadow=receive;if(name)mesh.name=name;return mesh;
}
function cylinder(THREE,args,position,material,{cast=true,receive=true}={}){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(...args),material);mesh.position.set(...position);mesh.castShadow=cast;mesh.receiveShadow=receive;return mesh;
}
function addCollider(THREE,mesh,colliders,pad=0){mesh.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(mesh);if(pad)b.expandByScalar(pad);colliders.push(b);return b;}
function labelTexture(THREE,title,subtitle=''){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d');
  const g=ctx.createLinearGradient(0,0,1024,256);g.addColorStop(0,'#080a0d');g.addColorStop(.5,'#161a1f');g.addColorStop(1,'#080a0d');ctx.fillStyle=g;ctx.fillRect(0,0,1024,256);
  ctx.strokeStyle='#d0ad63';ctx.lineWidth=8;ctx.strokeRect(10,10,1004,236);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f6f2e8';ctx.font='900 62px system-ui,sans-serif';ctx.fillText(title,512,subtitle?102:128);if(subtitle){ctx.fillStyle='#9fe9f5';ctx.font='700 25px system-ui,sans-serif';ctx.fillText(subtitle,512,178);}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function sign(THREE,title,subtitle,size=[8,2]){return new THREE.Mesh(new THREE.PlaneGeometry(...size),new THREE.MeshBasicMaterial({map:labelTexture(THREE,title,subtitle),toneMapped:false}));}

function buildGround(THREE,root,mat,groundMeshes){
  const terrain=new THREE.Mesh(new THREE.PlaneGeometry(250,250),mat.grass);terrain.rotation.x=-Math.PI/2;terrain.position.y=-.06;terrain.receiveShadow=true;terrain.name='ProductionTerrain';root.add(terrain);groundMeshes.push(terrain);
  const roadA=box(THREE,[34,.12,232],[0,.01,0],mat.asphalt,{cast:false,receive:true,name:'MainAvenue'});root.add(roadA);groundMeshes.push(roadA);
  const roadB=box(THREE,[232,.12,30],[0,.015,10],mat.asphalt,{cast:false,receive:true,name:'MarketBoulevard'});root.add(roadB);groundMeshes.push(roadB);
  const roadC=box(THREE,[20,.12,120],[-58,.02,32],mat.asphalt,{cast:false,receive:true,name:'MarketDistrictRoad'});root.add(roadC);groundMeshes.push(roadC);
  const sidewalkSpecs=[[-21,0,8,232],[21,0,8,232],[0,-9,232,6],[0,29,232,6],[-72,32,8,120],[-44,32,8,120]];
  for(const [x,z,w,d] of sidewalkSpecs){const s=box(THREE,[w,.18,d],[x,.11,z],mat.sidewalk,{cast:false,receive:true});root.add(s);groundMeshes.push(s);}
  for(const x of [-17.3,17.3])root.add(box(THREE,[.38,.28,232],[x,.16,0],mat.concrete,{cast:false,receive:true}));
  for(const z of [-5.8,25.8])root.add(box(THREE,[232,.28,.38],[0,.16,z],mat.concrete,{cast:false,receive:true}));
  for(let z=-106;z<=104;z+=11){for(const x of [-8.3,8.3])root.add(box(THREE,[.15,.035,5.6],[x,.09,z],mat.roadLine,{cast:false,receive:false}));}
  for(let x=-105;x<=105;x+=11){root.add(box(THREE,[5.8,.035,.15],[x,.095,10],mat.roadLineWhite,{cast:false,receive:false}));}
  for(const z of [38,51])for(let x=-15;x<=15;x+=2.5)root.add(box(THREE,[1.35,.035,4.2],[x,.1,z],mat.roadLineWhite,{cast:false,receive:false}));
  for(const z of [-48,-8,67])for(let x=-13;x<=13;x+=2.5)root.add(box(THREE,[1.3,.035,3.6],[x,.1,z],mat.roadLineWhite,{cast:false,receive:false}));
  for(const x of [-78,-69,-47,-38])for(let z=-8;z<=70;z+=6.2)root.add(box(THREE,[.12,.03,3.4],[x,.1,z],mat.roadLineWhite,{cast:false,receive:false}));
}

function addWindowGrid(THREE,group,mat,{width,height,depth,position=[0,0,0],floors=8,cols=6,warmEvery=7,front=1}){
  const [x,,z]=position;const frontZ=z+front*(depth/2+.055);const floorH=(height-4)/Math.max(1,floors);const cellW=width*.78/cols;
  for(let f=0;f<floors;f+=1){const y=2.5+(f+.5)*floorH;for(let c=0;c<cols;c+=1){const px=x-width*.39+(c+.5)*cellW;const window=box(THREE,[cellW*.72,Math.max(.65,floorH*.56),.08],[px,y,frontZ],((f*cols+c)%warmEvery===0)?mat.windowWarm:mat.windowCool,{cast:false,receive:false});group.add(window);}}
}

function facadeBuilding(THREE,root,mat,{id,name,position,size,style='cool',colliders,occluders,entranceFront=1}){
  const [x,,z]=position,[w,h,d]=size;const group=new THREE.Group();group.name=id;root.add(group);
  const base=box(THREE,[w,h,d],[x,h/2,z],style==='warm'?mat.facadeWarm:mat.facadeCool,{cast:true,receive:true,name:`${id}-mass`});group.add(base);addCollider(THREE,base,colliders,.05);occluders.push(base);
  const plinth=box(THREE,[w+1,.7,d+1],[x,.35,z],mat.concreteDark,{cast:true,receive:true});group.add(plinth);
  addWindowGrid(THREE,group,mat,{width:w,height:h,depth:d,position:[x,0,z],floors:clamp(Math.floor(h/3.4),3,14),cols:clamp(Math.floor(w/3.6),3,9),front:entranceFront});
  const entranceZ=z+entranceFront*(d/2+.28);group.add(box(THREE,[Math.min(6,w*.38),4.3,.45],[x,2.15,entranceZ],mat.glass,{cast:true,receive:true}));
  const canopy=box(THREE,[Math.min(9,w*.62),.28,3.4],[x,4.55,entranceZ-entranceFront*1.25],mat.blackMetal,{cast:true,receive:true});group.add(canopy);
  const frame=style==='warm'?mat.emissiveGold:mat.brushedMetal;
  for(const edge of [-1,1]){
    group.add(box(THREE,[.28,h*.82,.34],[x+edge*w*.46,h*.51,entranceZ],frame,{cast:false,receive:false}));
    group.add(box(THREE,[w*.16,.28,1.8],[x+edge*w*.34,4.95,entranceZ+entranceFront*.5],mat.roof,{cast:false,receive:false}));
  }
  group.add(box(THREE,[w*.88,.2,.38],[x,h*.86,entranceZ],style==='warm'?mat.emissiveGold:mat.emissiveCyan,{cast:false,receive:false}));
  const crown=box(THREE,[w*.72,1.2,d*.7],[x,h+.6,z],mat.roof,{cast:true,receive:true});group.add(crown);
  for(const ox of [-w*.3,w*.3])group.add(box(THREE,[w*.12,1.1,d*.18],[x+ox,h+1.45,z],mat.brushedMetal,{cast:true,receive:true}));
  if(!id.startsWith('market-block-')){const s=sign(THREE,String(name||id).toUpperCase(),'WISDO WORLD',[Math.min(11,w*.72),2.1]);s.position.set(x,Math.min(h-1,7.8),entranceZ+entranceFront*.25);s.rotation.y=entranceFront<0?Math.PI:0;group.add(s);}
  return group;
}

function buildWisdoCentral(THREE,root,mat,colliders,occluders){
  const group=new THREE.Group();group.name='WISDOCentralHeadquarters';root.add(group);const x=38,z=-1;
  const podium=box(THREE,[44,7,31],[x,3.5,z],mat.stone,{cast:true,receive:true});group.add(podium);addCollider(THREE,podium,colliders,.12);occluders.push(podium);
  const tower=box(THREE,[31,72,23],[x,43,z],mat.glass,{cast:true,receive:true,name:'WISDOCityHeroTower'});group.add(tower);addCollider(THREE,tower,colliders,.04);occluders.push(tower);
  for(let y=9;y<78;y+=3.2)group.add(box(THREE,[31.4,.12,23.4],[x,y,z],Math.round(y)%3===0?mat.emissiveGold:mat.blackMetal,{cast:false,receive:false}));
  for(const ox of [-12.5,12.5])group.add(box(THREE,[.45,69,23.7],[x+ox,43,z],mat.gold,{cast:false,receive:false}));
  for(let y=13;y<77;y+=6.4)for(const ox of [-8,0,8])group.add(box(THREE,[4.3,2.1,.12],[x+ox,y,z+11.64],(y+ox)%3?mat.windowWarm:mat.windowCool,{cast:false,receive:false}));
  const entrance=box(THREE,[11,5,.5],[x,2.5,z+15.78],mat.glassWarm,{cast:true,receive:true});group.add(entrance);
  const canopy=box(THREE,[19,.35,5],[x,5.1,z+13.3],mat.blackMetal,{cast:true,receive:true});group.add(canopy);
  const rooftop=box(THREE,[20,6,15],[x,82,z],mat.blackMetal,{cast:true,receive:true});group.add(rooftop);
  for(const ox of [-8,8])group.add(box(THREE,[.7,12,1],[x+ox,90,z],mat.emissiveGold,{cast:false,receive:false}));
  const blade=box(THREE,[1.2,24,4],[x,96,z],mat.emissiveCyan,{cast:true,receive:false});group.add(blade);
  const s=sign(THREE,'WISDO','CONNECT · COPY · CONTROL',[15,3]);s.position.set(x,10,z+15.9);group.add(s);
  return group;
}

function buildTradingTower(THREE,root,mat,colliders,occluders,groundMeshes){
  const group=new THREE.Group();group.name='TradingTowerDistrict';root.add(group);const x=0,z=-84;
  const podium=box(THREE,[36,8,28],[x,4,z],mat.stone,{cast:true,receive:true});group.add(podium);addCollider(THREE,podium,colliders,.08);occluders.push(podium);
  const tiers=[[31,38,24,27],[26,38,20,65],[21,30,17,99]];
  for(const [w,h,d,y] of tiers){const m=box(THREE,[w,h,d],[x,y,z],mat.glass,{cast:true,receive:true});group.add(m);addCollider(THREE,m,colliders,.04);occluders.push(m);for(let fy=y-h/2+3;fy<y+h/2;fy+=3.4)group.add(box(THREE,[w+.18,.09,d+.18],[x,fy,z],(Math.round(fy*10)%7===0)?mat.emissiveGold:mat.blackMetal,{cast:false,receive:false}));}
  for(const px of [-12,-7,0,7,12])group.add(box(THREE,[.38,104,.6],[px,59,z+12.25],px===0?mat.emissiveCyan:mat.gold,{cast:false,receive:false}));
  const crown=box(THREE,[13,12,12],[x,121,z],mat.blackMetal,{cast:true,receive:true});group.add(crown);for(const px of [-4,-2,0,2,4]){const fin=box(THREE,[.32,13-Math.abs(px),2.4],[px,132,z],px===0?mat.emissiveCyan:mat.gold,{cast:true,receive:false});fin.rotation.z=px*.012;group.add(fin);}
  const lobby=box(THREE,[20,6,9],[x,3,z+18.4],mat.glassWarm,{cast:true,receive:true});group.add(lobby);const ts=sign(THREE,'TRADING TOWER','MARKETS · COMMAND · SIGNALS',[14,2.5]);ts.position.set(x,8.2,z+23.1);group.add(ts);
  for(let i=0;i<6;i+=1){const step=box(THREE,[16-i*.45,.16,1.3],[x,.08+i*.16,z+25+i*1.12],mat.sidewalk,{cast:false,receive:true});group.add(step);groundMeshes.push(step);}
  return group;
}

function buildMarketDistrict(THREE,root,mat,colliders,occluders){
  const group=new THREE.Group();group.name='MarketDistrictArchitecture';root.add(group);
  const stores=[[-93,8,16,8,18],[-93,30,16,10,18],[-93,54,16,9,18],[-23,8,16,9,18],[-23,31,16,11,18],[-23,55,16,8,18]];
  for(let i=0;i<stores.length;i+=1){const [x,z,w,h,d]=stores[i];facadeBuilding(THREE,group,mat,{id:`market-block-${i}`,name:i%2?'WISDO MARKET':'CULTURE LAB',position:[x,0,z],size:[w,h,d],style:i%2?'warm':'cool',colliders,occluders,entranceFront:x<0?1:-1});}
  return group;
}

function buildSmartHomeExterior(THREE,root,mat,colliders,occluders){
  const group=new THREE.Group();group.name='SmartHomeExterior';root.add(group);const x=-88,z=88;
  const lawn=box(THREE,[38,.12,30],[x,.02,z],mat.grass,{cast:false,receive:true});group.add(lawn);
  const lower=box(THREE,[24,5,18],[x,2.5,z],mat.facadeWarm,{cast:true,receive:true});group.add(lower);addCollider(THREE,lower,colliders,.06);occluders.push(lower);
  const upper=box(THREE,[16,4.4,13],[x+2,6.9,z-1],mat.facadeCool,{cast:true,receive:true});group.add(upper);addCollider(THREE,upper,colliders,.04);occluders.push(upper);
  const glass=box(THREE,[7,4.1,.36],[x-5,2.45,z+9.2],mat.glassWarm,{cast:true,receive:true});group.add(glass);
  const garage=box(THREE,[7,3,.28],[x+6,1.55,z+9.22],mat.blackMetal,{cast:true,receive:true});group.add(garage);
  const roof=box(THREE,[25,.5,19],[x,5.15,z],mat.roof,{cast:true,receive:true});group.add(roof);
  const s=sign(THREE,'WISDO SMART HOME','PRIVATE RESIDENCE',[10,2]);s.position.set(x-5,5.2,z+9.45);group.add(s);return group;
}

function buildDestinationArchitecture(THREE,root,mat,destinations,colliders,occluders){
  const names=new Map((destinations||[]).map((d)=>[d.id,d.name]));
  for(const [id,location] of Object.entries(WORLD_LOCATIONS)){
    if(id==='trading-tower'||id==='marketplace')continue;
    const [w,h,d]=location.size;facadeBuilding(THREE,root,mat,{id,name:names.get(id)||id,position:location.position,size:[w,Math.max(10,h),d],style:(id==='academy'||id==='growth-chamber'||id==='coach-center')?'warm':'cool',colliders,occluders,entranceFront:location.position[2]>55?-1:1});
  }
  const marketLoc=WORLD_LOCATIONS.marketplace;if(marketLoc)facadeBuilding(THREE,root,mat,{id:'marketplace',name:names.get('marketplace')||'WISDO MARKET',position:marketLoc.position,size:[32,16,28],style:'warm',colliders,occluders,entranceFront:1});
}

function buildProps(THREE,root,mat,quality){
  const propRoot=new THREE.Group();propRoot.name='ProductionStreetProps';root.add(propRoot);
  const lampPositions=[];const stride=quality==='low'?28:quality==='medium'?21:17;
  for(let z=-98;z<=96;z+=stride)for(const x of [-22.5,22.5])lampPositions.push([x,z]);
  for(const [x,z] of lampPositions){propRoot.add(cylinder(THREE,[.08,.12,6.2,10],[x,3.1,z],mat.blackMetal,{cast:quality==='high',receive:true}));propRoot.add(box(THREE,[1,.16,.38],[x,6.08,z],mat.emissiveGold,{cast:false,receive:false}));}
  for(const [x,z] of [[-26,18],[26,18],[-26,56],[26,56],[-13,-32],[13,-32]]){propRoot.add(box(THREE,[3.5,.18,.72],[x,.55,z],mat.blackMetal,{cast:true,receive:true}));propRoot.add(box(THREE,[3.5,.9,.15],[x,1.02,z+.3],mat.blackMetal,{cast:true,receive:true}));}
  for(const [x,z] of [[-24,4],[24,4],[-24,36],[24,36],[-70,18],[-46,18]]){propRoot.add(cylinder(THREE,[.42,.5,.82,12],[x,.41,z],mat.concreteDark,{cast:true,receive:true}));}
  for(let z=-30;z<78;z+=8)for(const x of [-14.7,14.7])propRoot.add(cylinder(THREE,[.13,.16,.82,8],[x,.41,z],mat.gold,{cast:true,receive:true}));
  const count=quality==='low'?24:quality==='medium'?42:64;const trunkGeo=new THREE.CylinderGeometry(.18,.26,3.1,8);const crownGeo=new THREE.SphereGeometry(1,quality==='low'?7:10,quality==='low'?5:7);const trunks=new THREE.InstancedMesh(trunkGeo,mat.trunk,count);trunks.name='WisdoCityTreeTrunks';const crowns=[mat.foliage,mat.foliageLight,mat.foliage].map((material,j)=>{const mesh=new THREE.InstancedMesh(crownGeo,material,count);mesh.name=`WisdoCityCanopyLayer-${j}`;mesh.castShadow=quality==='high';mesh.receiveShadow=true;return mesh});const dummy=new THREE.Object3D();
  for(let i=0;i<count;i+=1){const side=i%4;let x,z;if(side<2){x=side===0?-30:30;z=-95+(i/count)*190;}else{x=-104+(i/count)*208;z=side===2?-28:48;}const s=.85+((i*17)%13)/50;dummy.position.set(x,1.55*s,z);dummy.scale.set(s,s,s);dummy.rotation.y=(i*.61)%Math.PI;dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);for(let j=0;j<3;j+=1){const sway=j===0?0:j===1?-1:1;dummy.position.set(x+sway*.7*s,(4.05+(j===0?.8:-.1))*s,z+(j===1?.45:-.25)*s);dummy.scale.set((j===0?1.65:1.12)*s,(j===0?1.34:1.04)*s,(j===0?1.55:1.15)*s);dummy.rotation.y=(i*.37+j*.8)%Math.PI;dummy.updateMatrix();crowns[j].setMatrixAt(i,dummy.matrix)}}trunks.castShadow=quality!=='low';trunks.receiveShadow=true;propRoot.add(trunks,...crowns);
  return propRoot;
}

function buildBackdrop(THREE,root,mat,quality){
  const group=new THREE.Group();group.name='ProductionSkyline';root.add(group);const count=quality==='low'?24:quality==='medium'?40:58;
  const geo=new THREE.BoxGeometry(1,1,1);const inst=new THREE.InstancedMesh(geo,mat.facadeCool,count);const dummy=new THREE.Object3D();
  for(let i=0;i<count;i+=1){const side=i%2===0?-1:1;const lane=Math.floor(i/2);const x=side*(112+(lane%8)*9);const z=-118+(lane%10)*24;const w=9+(i*7)%12,d=8+(i*11)%14,h=20+(i*17)%68;dummy.position.set(x,h/2-1,z);dummy.scale.set(w,h,d);dummy.rotation.y=((i%5)-2)*3*DEG;dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);}inst.castShadow=false;inst.receiveShadow=true;group.add(inst);return group;
}

function carMesh(THREE,mat,index){
  const g=new THREE.Group();g.name=`TrafficCar-${index}`;const colors=[0x2f4655,0x5c2a2a,0x5b5a50,0x1c1d20,0x274b35];const paint=new THREE.MeshPhysicalMaterial({color:colors[index%colors.length],roughness:.34,metalness:.54,clearcoat:.74,clearcoatRoughness:.16});g.add(box(THREE,[3.7,.72,1.75],[0,.62,0],paint,{cast:true,receive:true}));g.add(box(THREE,[2.2,.72,1.55],[-.15,1.22,0],mat.glass,{cast:true,receive:true}));for(const x of [-1.16,1.16])for(const z of [-.84,.84]){const wheel=cylinder(THREE,[.32,.32,.28,14],[x,.38,z],mat.blackMetal,{cast:true,receive:true});wheel.rotation.x=Math.PI/2;g.add(wheel);}return g;
}
function buildTraffic(THREE,root,mat,quality){
  const group=new THREE.Group();group.name='ProductionTraffic';root.add(group);const count=quality==='low'?3:quality==='medium'?6:9;const traffic=[];
  for(let i=0;i<count;i+=1){const car=carMesh(THREE,mat,i);const vertical=i%2===0;const dir=i%3===0?-1:1;if(vertical){car.position.set(dir<0?-6.2:6.2,.06,-105+(i*23)%200);car.rotation.y=dir<0?Math.PI:0;traffic.push({mesh:car,axis:'z',dir,speed:5.5+(i%3)*1.2,min:-112,max:112});}else{car.position.set(-108+(i*29)%210,.06,dir<0?4.5:15.5);car.rotation.y=dir<0?-Math.PI/2:Math.PI/2;traffic.push({mesh:car,axis:'x',dir,speed:5+(i%4)*1.1,min:-115,max:115});}group.add(car);}return traffic;
}

function buildSky(THREE,scene,quality){
  const skyGeo=new THREE.SphereGeometry(420,32,18);const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(0x4e7fae)},horizon:{value:new THREE.Color(0xf0b36e)},bottom:{value:new THREE.Color(0xd7d3c6)}},vertexShader:'varying float vY; void main(){vY=normalize(position).y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying float vY; uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; void main(){float h=smoothstep(-.12,.22,vY); vec3 c=mix(bottom,horizon,smoothstep(-.16,.05,vY)); c=mix(c,top,smoothstep(.02,.82,vY)); gl_FragColor=vec4(c,1.0);}'});const sky=new THREE.Mesh(skyGeo,skyMat);sky.name='ProductionSky';scene.add(sky);
  const sunDisc=new THREE.Mesh(new THREE.CircleGeometry(8,32),new THREE.MeshBasicMaterial({color:0xffe7b0,toneMapped:false}));sunDisc.position.set(-150,105,-210);sunDisc.lookAt(0,20,0);scene.add(sunDisc);
  if(quality!=='low'){const cloudMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.2,depthWrite:false});for(let i=0;i<12;i+=1){const cloud=new THREE.Mesh(new THREE.PlaneGeometry(24+(i%4)*8,5+(i%3)*2),cloudMat);cloud.position.set(-150+i*28,70+(i%5)*4,-180+(i%4)*35);cloud.rotation.x=-8*DEG;scene.add(cloud);}}
}

export function buildProductionCity({THREE,scene,renderer,destinations=[],quality='medium'}={}){
  const mat=createWorldPbrLibrary(THREE,renderer,{quality});const root=new THREE.Group();root.name='WISDOProductionCity';scene.add(root);const colliders=[],occluders=[],groundMeshes=[];
  buildGround(THREE,root,mat,groundMeshes);buildWisdoCentral(THREE,root,mat,colliders,occluders);buildTradingTower(THREE,root,mat,colliders,occluders,groundMeshes);buildDestinationArchitecture(THREE,root,mat,destinations,colliders,occluders);buildMarketDistrict(THREE,root,mat,colliders,occluders);buildSmartHomeExterior(THREE,root,mat,colliders,occluders);buildProps(THREE,root,mat,quality);buildBackdrop(THREE,root,mat,quality);const traffic=buildTraffic(THREE,root,mat,quality);buildSky(THREE,scene,quality);
  const hemi=new THREE.HemisphereLight(0x9ec5e1,0x5a4b39,1.62);scene.add(hemi);const sun=new THREE.DirectionalLight(0xffd39a,4.2);sun.position.set(-95,145,75);sun.castShadow=quality!=='low';sun.shadow.mapSize.set(quality==='high'?2048:1024,quality==='high'?2048:1024);sun.shadow.camera.left=-105;sun.shadow.camera.right=105;sun.shadow.camera.top=105;sun.shadow.camera.bottom=-105;sun.shadow.camera.near=12;sun.shadow.camera.far=300;sun.shadow.bias=-.00018;sun.shadow.normalBias=.035;scene.add(sun);const fill=new THREE.DirectionalLight(0x74a9d8,.54);fill.position.set(95,40,-80);scene.add(fill);
  scene.background=new THREE.Color(0x84a9c9);scene.fog=new THREE.FogExp2(0x9fb3bd,quality==='low'?.0048:.0034);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.32;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  return {root,mat,colliders,occluders,groundMeshes,traffic,sun,hemi,update(dt){for(const car of traffic){car.mesh.position[car.axis]+=car.dir*car.speed*dt;if(car.dir>0&&car.mesh.position[car.axis]>car.max)car.mesh.position[car.axis]=car.min;if(car.dir<0&&car.mesh.position[car.axis]<car.min)car.mesh.position[car.axis]=car.max;}},destroy(){root.traverse((o)=>{o.geometry?.dispose?.();if(o.material&&!Object.values(mat).includes(o.material)){const list=Array.isArray(o.material)?o.material:[o.material];for(const m of list)m?.dispose?.();}});scene.remove(root);mat.dispose?.();}};
}
