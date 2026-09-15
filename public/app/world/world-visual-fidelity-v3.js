const REVISION='2026.09.15.visual-fidelity-v3';
const TAU=Math.PI*2;

function keep(list,item){if(item)list.push(item);return item;}
function glow(THREE,color,opacity=.9){return new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending});}
function metal(THREE,color,{emissive=0,emissiveIntensity=0,roughness=.3,metalness=.72,transparent=false,opacity=1}={}){return new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity,roughness,metalness,transparent,opacity,depthWrite:!transparent});}

function textTexture(THREE,{title='WISDO ARCADE WORLD',subtitle='TRADE · EXPLORE · PLAY · LIVE',eyebrow='WISDO',accent='#76ebff',gold='#e7bf69'}={}){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=420;const ctx=canvas.getContext('2d');
  const gradient=ctx.createLinearGradient(0,0,1024,420);gradient.addColorStop(0,'#030713');gradient.addColorStop(.5,'#071a34');gradient.addColorStop(1,'#050713');ctx.fillStyle=gradient;ctx.fillRect(0,0,1024,420);
  const halo=ctx.createRadialGradient(512,180,20,512,180,420);halo.addColorStop(0,'rgba(92,95,255,.26)');halo.addColorStop(.45,'rgba(31,210,255,.09)');halo.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=halo;ctx.fillRect(0,0,1024,420);
  ctx.strokeStyle=accent;ctx.lineWidth=6;ctx.shadowColor=accent;ctx.shadowBlur=25;ctx.strokeRect(16,16,992,388);ctx.shadowBlur=0;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=accent;ctx.font='800 27px Inter,system-ui,sans-serif';ctx.fillText(eyebrow,512,62);
  ctx.fillStyle='#ffffff';ctx.font='900 78px Inter,system-ui,sans-serif';ctx.shadowColor='#6f70ff';ctx.shadowBlur=25;ctx.fillText(title,512,178);ctx.shadowBlur=0;
  ctx.fillStyle=gold;ctx.font='800 28px Inter,system-ui,sans-serif';ctx.fillText(subtitle,512,286);
  ctx.fillStyle='#a9d8e8';ctx.font='700 20px Inter,system-ui,sans-serif';ctx.fillText('SAME MARKETS · A BIGGER WORLD',512,344);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

function createLightingRig(THREE,scene,root,renderer,touchLike,disposables){
  const previousExposure=renderer.toneMappingExposure;
  renderer.toneMappingExposure=Math.max(previousExposure||1.25,touchLike?1.55:1.48);
  const hemi=new THREE.HemisphereLight(0x9ac8ff,0x08060e,touchLike?1.15:.95);hemi.name='WisdoV3HemisphereFill';root.add(hemi);
  const ambient=new THREE.AmbientLight(0x496582,touchLike?.34:.28);ambient.name='WisdoV3AmbientFill';root.add(ambient);
  const key=new THREE.DirectionalLight(0xb7dcff,touchLike?.78:.66);key.name='WisdoV3MoonKey';key.position.set(34,48,46);key.castShadow=false;root.add(key);const target=new THREE.Object3D();target.position.set(0,3,10);root.add(target);key.target=target;
  const pools=[
    [-23,6,31,0xffb45f,26,touchLike?42:34],
    [-23,7,54,0x8e72ff,28,touchLike?48:38],
    [10,6,22,0x5eeaff,28,touchLike?46:36],
    [0,10,-45,0xe3b962,36,touchLike?48:40],
    [36,8,-2,0x54dfff,30,touchLike?42:34],
  ];
  for(const [x,y,z,color,distance,intensity] of pools){const light=new THREE.PointLight(color,intensity,distance,2);light.position.set(x,y,z);light.castShadow=false;root.add(light);}
  return()=>{renderer.toneMappingExposure=previousExposure;};
}

function createOperatorLighting(THREE,scene){
  const operator=scene.getObjectByName('WisdoOperator');if(!operator)return null;
  const group=new THREE.Group();group.name='WisdoOperatorV3Lighting';
  const cyan=new THREE.PointLight(0x6eeaff,9,5.5,2);cyan.position.set(1.15,2.1,.8);cyan.castShadow=false;group.add(cyan);
  const gold=new THREE.PointLight(0xe8bb68,6,4.5,2);gold.position.set(-1.0,1.65,-.5);gold.castShadow=false;group.add(gold);
  operator.add(group);return{operator,group};
}

function fixOperatorBranding(THREE,scene){
  const branding=scene.getObjectByName('WISDOOperatorV2Branding');if(!branding)return false;
  const front=branding.getObjectByName('WISDOOperatorFrontMark');const back=branding.getObjectByName('WISDOOperatorBackMark');
  if(front)front.visible=false;
  if(back){back.visible=true;back.scale.setScalar(.48);back.position.set(0,1.37,-.205);back.rotation.set(0,Math.PI,0);const materials=Array.isArray(back.material)?back.material:[back.material];for(const material of materials){if(!material)continue;material.side=THREE.FrontSide;material.transparent=true;material.opacity=.9;material.blending=THREE.NormalBlending;material.depthWrite=false;material.depthTest=true;material.polygonOffset=true;material.polygonOffsetFactor=-1;material.needsUpdate=true;}}
  branding.userData.v3Integrated=true;return true;
}

function createSkyline(THREE,root,touchLike,disposables){
  const count=touchLike?14:20;const geometry=keep(disposables,new THREE.BoxGeometry(1,1,1));const stripGeometry=keep(disposables,new THREE.BoxGeometry(.12,1,.12));
  const buildingMaterial=keep(disposables,metal(THREE,0x07101d,{emissive:0x071a32,emissiveIntensity:.78,roughness:.38,metalness:.68}));
  const stripMaterial=keep(disposables,glow(THREE,0x62dcff,.72));const buildings=new THREE.InstancedMesh(geometry,buildingMaterial,count);buildings.name='WisdoV3HeroSkyline';const strips=new THREE.InstancedMesh(stripGeometry,stripMaterial,count);strips.name='WisdoV3SkylineLightSpines';
  const dummy=new THREE.Object3D();for(let i=0;i<count;i+=1){const column=i-Math.floor(count/2);const x=column*(touchLike?10.5:8.8)+(i%3-1)*2.2;const z=-111-(i%4)*4.5;const h=26+(i*13%38);const w=5.5+(i%4)*1.4;const d=5+(i%3)*1.3;dummy.position.set(x,h/2,z);dummy.scale.set(w,h,d);dummy.rotation.set(0,(i%5-2)*.018,0);dummy.updateMatrix();buildings.setMatrixAt(i,dummy.matrix);dummy.position.set(x+(i%2?.9:-.9),h*.54,z+d*.51);dummy.scale.set(1,h*.72,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();strips.setMatrixAt(i,dummy.matrix);}buildings.instanceMatrix.needsUpdate=true;strips.instanceMatrix.needsUpdate=true;buildings.castShadow=false;buildings.receiveShadow=false;strips.frustumCulled=false;root.add(buildings,strips);return{buildings,strips};
}

function createArcadeGateway(THREE,root,touchLike,disposables){
  const group=new THREE.Group();group.name='WisdoV3ArcadeGateway';group.position.set(-23,0,48);root.add(group);
  const frame=keep(disposables,metal(THREE,0x080d16,{roughness:.22,metalness:.88}));const cyan=keep(disposables,glow(THREE,0x69eaff,.92));const gold=keep(disposables,glow(THREE,0xe6bc68,.8));
  for(const x of [-6.2,6.2]){const pillar=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(.62,8.4,.62)),frame);pillar.position.set(x,4.2,0);group.add(pillar);const rail=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(.11,7.8,.11)),x<0?cyan:gold);rail.position.set(x,4.2,.36);group.add(rail);}
  const crown=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(13.2,.58,.72)),frame);crown.position.set(0,8.25,0);group.add(crown);
  const texture=keep(disposables,textTexture(THREE,{}));const screen=new THREE.Mesh(keep(disposables,new THREE.PlaneGeometry(touchLike?10.8:12.2,touchLike?4.4:4.9)),keep(disposables,new THREE.MeshBasicMaterial({map:texture,toneMapped:false})));screen.name='WisdoV3ArcadeWorldScreen';screen.position.set(0,6.0,.38);group.add(screen);
  const halo=new THREE.Mesh(keep(disposables,new THREE.TorusGeometry(7.4,.055,8,touchLike?40:72)),cyan);halo.name='WisdoV3ArcadeHalo';halo.rotation.x=Math.PI/2;halo.position.set(0,8.7,-.25);group.add(halo);return{group,halo};
}

function createPlazaDeck(THREE,root,touchLike,disposables){
  const deckMaterial=keep(disposables,new THREE.MeshPhysicalMaterial({color:0x071423,emissive:0x02101c,emissiveIntensity:.7,roughness:touchLike?.14:.08,metalness:.38,clearcoat:1,clearcoatRoughness:.045,transparent:true,opacity:touchLike?.30:.38,depthWrite:false}));
  const deck=new THREE.Mesh(keep(disposables,new THREE.PlaneGeometry(47,61)),deckMaterial);deck.name='WisdoV3LuminousPlazaDeck';deck.rotation.x=-Math.PI/2;deck.position.set(0,.155,29);deck.renderOrder=4;root.add(deck);
  const cyan=keep(disposables,glow(THREE,0x61e9ff,.72));const gold=keep(disposables,glow(THREE,0xe4b85f,.62));
  const rails=[[-14.2,.18,29,.08,.04,58,cyan],[14.2,.18,29,.08,.04,58,gold],[0,.18,1,28,.04,.08,cyan],[0,.18,57,28,.04,.08,gold]];
  for(const [x,y,z,w,h,d,material] of rails){const rail=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(w,h,d)),material);rail.position.set(x,y,z);root.add(rail);}return deck;
}

function createCrowd(THREE,root,touchLike,disposables){
  const count=touchLike?10:14;const bodyGeometry=keep(disposables,new THREE.CylinderGeometry(.16,.22,1.0,6));const headGeometry=keep(disposables,new THREE.SphereGeometry(.15,8,6));const accentGeometry=keep(disposables,new THREE.BoxGeometry(.08,.30,.025));
  const bodyMaterial=keep(disposables,metal(THREE,0x101722,{emissive:0x02050a,emissiveIntensity:.2,roughness:.58,metalness:.24}));const headMaterial=keep(disposables,metal(THREE,0x8e5f48,{roughness:.78,metalness:0}));const accentMaterial=keep(disposables,glow(THREE,0x6ceaff,.82));
  const body=new THREE.InstancedMesh(bodyGeometry,bodyMaterial,count);body.name='WisdoV3CrowdBodies';const heads=new THREE.InstancedMesh(headGeometry,headMaterial,count);heads.name='WisdoV3CrowdHeads';const accents=new THREE.InstancedMesh(accentGeometry,accentMaterial,count);accents.name='WisdoV3CrowdAccents';body.castShadow=false;heads.castShadow=false;accents.castShadow=false;root.add(body,heads,accents);
  const anchors=[[-8,18],[-2,22],[6,18],[12,26],[-17,32],[-27,37],[-18,47],[-30,51],[6,38],[13,43],[20,31],[25,24],[-3,50],[3,55]];const people=[];for(let i=0;i<count;i+=1){const [x,z]=anchors[i%anchors.length];people.push({x,z,phase:i*.67,radius:.8+(i%4)*.35,speed:.18+(i%3)*.04});}
  const dummy=new THREE.Object3D();function matrixFor(mesh,index,x,y,z,yaw,scaleY=1){dummy.position.set(x,y,z);dummy.rotation.set(0,yaw,0);dummy.scale.set(1,scaleY,1);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);}
  function update(elapsed){for(let i=0;i<count;i+=1){const p=people[i],a=elapsed*p.speed+p.phase;const x=p.x+Math.cos(a)*p.radius,z=p.z+Math.sin(a*.88)*p.radius*.72;const dx=-Math.sin(a),dz=Math.cos(a*.88)*.88;const yaw=Math.atan2(dx,dz);matrixFor(body,i,x,.72,z,yaw,.95+(i%3)*.04);matrixFor(heads,i,x,1.43,z,yaw,1);const ax=x-Math.sin(yaw)*.205,az=z-Math.cos(yaw)*.205;matrixFor(accents,i,ax,1.02,az,yaw,1);}body.instanceMatrix.needsUpdate=true;heads.instanceMatrix.needsUpdate=true;accents.instanceMatrix.needsUpdate=true;}
  update(0);return{count,update};
}

function createWayfindingPylons(THREE,root,touchLike,disposables){
  const material=keep(disposables,metal(THREE,0x09111d,{emissive:0x06182a,emissiveIntensity:.65,roughness:.28,metalness:.76}));const cyan=keep(disposables,glow(THREE,0x6ceaff,.78));const points=[[-11,0,12],[11,0,12],[-11,0,36],[11,0,36],[-11,0,57],[11,0,57]];for(let i=0;i<points.length;i+=1){const [x,,z]=points[i];const pylon=new THREE.Group();pylon.name=`WisdoV3LightPylon-${i}`;pylon.position.set(x,0,z);const pole=new THREE.Mesh(keep(disposables,new THREE.CylinderGeometry(.055,.08,4.8,6)),material);pole.position.y=2.4;pylon.add(pole);const lamp=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(.26,.10,.62)),cyan);lamp.position.set(0,4.72,0);pylon.add(lamp);root.add(pylon);}return points.length;
}

export function installWisdoVisualFidelityV3({THREE,scene,camera,renderer,quality='medium',debug=false}={}){
  if(!THREE||!scene||!camera||!renderer)throw new TypeError('WISDO Visual Fidelity V3 requires the active production scene, camera and renderer.');
  const root=new THREE.Group();root.name='WisdoVisualFidelityV3';scene.add(root);const disposables=[];const touchLike=Boolean(globalThis.matchMedia?.('(pointer: coarse)')?.matches||navigator.maxTouchPoints>0);
  const restoreLighting=createLightingRig(THREE,scene,root,renderer,touchLike,disposables);const operatorLighting=createOperatorLighting(THREE,scene);const skyline=createSkyline(THREE,root,touchLike,disposables);const gateway=createArcadeGateway(THREE,root,touchLike,disposables);createPlazaDeck(THREE,root,touchLike,disposables);const crowd=createCrowd(THREE,root,touchLike,disposables);const pylonCount=createWayfindingPylons(THREE,root,touchLike,disposables);
  let brandingIntegrated=fixOperatorBranding(THREE,scene);const brandingListener=()=>{brandingIntegrated=fixOperatorBranding(THREE,scene)||brandingIntegrated;};window.addEventListener('wisdo:operator-diagnostics',brandingListener);
  const objects=['WisdoV3HeroSkyline','WisdoV3ArcadeGateway','WisdoV3ArcadeWorldScreen','WisdoV3LuminousPlazaDeck','WisdoV3CrowdBodies','WisdoV3LightPylon-0'];
  const publish=()=>{const diagnostics=Object.freeze({active:true,revision:REVISION,artDirection:'WISDO_CYBER_LUXURY_CITY_V3',touchLike,quality,crowdCount:crowd.count,pylonCount,heroSkyline:true,arcadeGateway:true,operatorLighting:Boolean(operatorLighting),operatorBrandingIntegrated:brandingIntegrated,targetMobileFps:30,objects,executionFromVisualLayer:false});globalThis.WisdoVisualFidelityV3Diagnostics=diagnostics;document.documentElement.dataset.wisdoVisualV3='active';return diagnostics;};let diagnostics=publish();window.dispatchEvent(new CustomEvent('wisdo:visual-v3-ready',{detail:diagnostics}));if(debug)console.debug('[WISDO VISUAL FIDELITY V3]',diagnostics);
  let elapsed=0;let lastPublish=0;return{diagnostics,update(dt=.016){elapsed+=dt;gateway.halo.rotation.z+=dt*.08;crowd.update(elapsed);if(skyline.strips.material)skyline.strips.material.opacity=.62+Math.sin(elapsed*.55)*.09;if(!brandingIntegrated){brandingIntegrated=fixOperatorBranding(THREE,scene);if(brandingIntegrated)diagnostics=publish();}if(elapsed-lastPublish>5){lastPublish=elapsed;diagnostics=publish();}},destroy(){window.removeEventListener('wisdo:operator-diagnostics',brandingListener);operatorLighting?.operator?.remove?.(operatorLighting.group);restoreLighting();scene.remove(root);for(const item of disposables.reverse())item?.dispose?.();delete globalThis.WisdoVisualFidelityV3Diagnostics;delete document.documentElement.dataset.wisdoVisualV3;}};
}
