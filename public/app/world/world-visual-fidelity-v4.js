export const WISDO_VISUAL_FIDELITY_V4_REVISION='2026.09.17.visual-fidelity-v4';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
function keep(list,item){if(item)list.push(item);return item;}
function glow(THREE,color,opacity=1){return new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending});}
function physical(THREE,color,options={}){return new THREE.MeshPhysicalMaterial({color,roughness:.28,metalness:.35,envMapIntensity:1.2,...options});}

function makeEnvironment(THREE,renderer,disposables){
  if(!THREE.PMREMGenerator)return null;
  const envScene=new THREE.Scene();envScene.background=new THREE.Color(0x030711);
  envScene.add(new THREE.HemisphereLight(0x84bfff,0x120b12,2.6));
  const cool=new THREE.PointLight(0x68e7ff,85,40,2);cool.position.set(-8,8,6);envScene.add(cool);
  const warm=new THREE.PointLight(0xffb45f,72,36,2);warm.position.set(9,5,-5);envScene.add(warm);
  const violet=new THREE.PointLight(0x7568ff,68,34,2);violet.position.set(0,12,10);envScene.add(violet);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshBasicMaterial({color:0x07121f}));floor.rotation.x=-Math.PI/2;envScene.add(floor);
  const pmrem=new THREE.PMREMGenerator(renderer);pmrem.compileCubemapShader?.();const target=pmrem.fromScene(envScene,.04,.1,60);pmrem.dispose();
  floor.geometry.dispose();floor.material.dispose();disposables.push(target);return target.texture;
}

function academyWordmarkTexture(THREE){
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=384;const ctx=canvas.getContext('2d');
  const g=ctx.createLinearGradient(0,0,1536,384);g.addColorStop(0,'#020713');g.addColorStop(.55,'#06172a');g.addColorStop(1,'#050611');ctx.fillStyle=g;ctx.fillRect(0,0,1536,384);
  ctx.strokeStyle='#6de9ff';ctx.lineWidth=8;ctx.strokeRect(12,12,1512,360);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#e9faff';ctx.shadowColor='#44dfff';ctx.shadowBlur=28;ctx.font='900 118px Inter,system-ui,sans-serif';ctx.fillText('WISDO ACADEMY',768,150);ctx.shadowBlur=0;ctx.fillStyle='#e8bd6b';ctx.font='800 42px Inter,system-ui,sans-serif';ctx.fillText('FOUNDER WING · MASTER CHAMBER',768,264);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}

function buildAcademyEntrance(THREE,root,touchLike,disposables){
  const academy=new THREE.Group();academy.name='WisdoV4AcademyHeroEntrance';academy.position.set(-45,0,-45);academy.rotation.y=Math.PI/4;root.add(academy);
  const obsidian=keep(disposables,physical(THREE,0x050a12,{roughness:.16,metalness:.74,clearcoat:1,clearcoatRoughness:.08}));
  const gold=keep(disposables,physical(THREE,0xd2a755,{roughness:.18,metalness:1,envMapIntensity:1.75}));
  const cyan=keep(disposables,glow(THREE,0x68eaff,.92));
  const glass=keep(disposables,new THREE.MeshPhysicalMaterial({color:0x173957,roughness:.08,metalness:.05,transmission:touchLike?0:.55,thickness:.6,ior:1.42,transparent:true,opacity:touchLike?.42:.58,envMapIntensity:1.55,depthWrite:false}));
  const base=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(23,.7,13)),obsidian);base.position.set(0,.35,0);base.receiveShadow=true;academy.add(base);
  for(const x of [-10.4,10.4]){const col=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(.75,10.8,.9)),gold);col.position.set(x,5.7,0);col.castShadow=true;academy.add(col);const strip=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(.1,9.8,.12)),cyan);strip.position.set(x,5.7,.52);academy.add(strip);}
  const lintel=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(21.6,.8,1.0)),obsidian);lintel.position.set(0,10.5,0);lintel.castShadow=true;academy.add(lintel);
  const facade=new THREE.Mesh(keep(disposables,new THREE.PlaneGeometry(19,8.7)),glass);facade.position.set(0,5.7,.18);academy.add(facade);
  for(let i=-4;i<=4;i+=1){const fin=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(.10,8.0,.32)),i%2?gold:cyan);fin.position.set(i*1.9,5.7,.46);academy.add(fin);}
  const signTexture=keep(disposables,academyWordmarkTexture(THREE));const sign=new THREE.Mesh(keep(disposables,new THREE.PlaneGeometry(15.6,3.9)),keep(disposables,new THREE.MeshBasicMaterial({map:signTexture,toneMapped:false,transparent:true})));sign.position.set(0,12.7,.1);academy.add(sign);
  const steps=[];for(let i=0;i<4;i+=1){const step=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(13.5-i*1.1,.22,1.35)),obsidian);step.position.set(0,.12+i*.2,5.6+i*.58);step.receiveShadow=true;academy.add(step);steps.push(step);}
  const portal=new THREE.Mesh(keep(disposables,new THREE.TorusGeometry(3.05,.11,12,touchLike?48:96)),gold);portal.name='WisdoV4MasterChamberPortal';portal.position.set(0,4.1,-.35);academy.add(portal);
  const portalCore=new THREE.Mesh(keep(disposables,new THREE.CircleGeometry(2.82,touchLike?36:64)),keep(disposables,new THREE.MeshBasicMaterial({color:0x07111d,transparent:true,opacity:.72,depthWrite:false,side:THREE.DoubleSide})));portalCore.position.set(0,4.1,-.31);academy.add(portalCore);
  const interactionLight=new THREE.PointLight(0xe7bc69,touchLike?20:30,18,2);interactionLight.position.set(0,5,4);academy.add(interactionLight);
  return{group:academy,portal,portalCore,interactionLight};
}

function buildWaterFeature(THREE,root,touchLike,disposables){
  const group=new THREE.Group();group.name='WisdoV4ReflectionCourt';group.position.set(-27,0,-29);root.add(group);
  const rim=keep(disposables,physical(THREE,0x080d14,{roughness:.18,metalness:.86}));const water=keep(disposables,new THREE.MeshPhysicalMaterial({color:0x0b3a55,roughness:.08,metalness:.12,transmission:touchLike?0:.26,thickness:.28,clearcoat:1,clearcoatRoughness:.03,envMapIntensity:1.7,transparent:true,opacity:touchLike?.58:.76}));
  const basin=new THREE.Mesh(keep(disposables,new THREE.CylinderGeometry(5.6,5.9,.42,touchLike?36:72)),rim);basin.position.y=.2;basin.receiveShadow=true;group.add(basin);const surface=new THREE.Mesh(keep(disposables,new THREE.CircleGeometry(5.15,touchLike?36:72)),water);surface.rotation.x=-Math.PI/2;surface.position.y=.43;group.add(surface);
  const sculpture=new THREE.Mesh(keep(disposables,new THREE.TorusKnotGeometry(1.1,.12, touchLike?64:120,touchLike?8:12)),keep(disposables,physical(THREE,0xd4aa58,{roughness:.14,metalness:1})));sculpture.position.y=2.3;sculpture.castShadow=true;group.add(sculpture);
  const under=new THREE.PointLight(0x58e6ff,touchLike?14:24,13,2);under.position.set(0,1.2,0);group.add(under);return{group,surface,sculpture,water};
}

function buildAtmosphere(THREE,root,touchLike,disposables){
  const count=touchLike?90:220;const positions=new Float32Array(count*3);for(let i=0;i<count;i+=1){const a=(i*12.9898)%6.28318;const r=16+(i*7.13)%68;positions[i*3]=Math.cos(a)*r-14;positions[i*3+1]=1.2+(i*3.7)%25;positions[i*3+2]=Math.sin(a)*r-20;}
  const geometry=keep(disposables,new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const material=keep(disposables,new THREE.PointsMaterial({color:0x7deaff,size:touchLike?.035:.045,transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending}));const points=new THREE.Points(geometry,material);points.name='WisdoV4AtmosphereParticles';root.add(points);return points;
}

function buildOperatorContact(THREE,scene,root,disposables){
  const operator=scene.getObjectByName('WisdoOperator');if(!operator)return null;const material=keep(disposables,new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.28,depthWrite:false}));const shadow=new THREE.Mesh(keep(disposables,new THREE.CircleGeometry(.58,32)),material);shadow.name='WisdoV4OperatorContactShadow';shadow.rotation.x=-Math.PI/2;shadow.renderOrder=3;root.add(shadow);return{operator,shadow,material};
}

function createDiagnostics({quality,touchLike,academy,water,environmentActive}){
  return Object.freeze({active:true,revision:WISDO_VISUAL_FIDELITY_V4_REVISION,artDirection:'academy-cinematic-vertical-slice-v4',quality,touchLike,environmentPbr:environmentActive,animationTarget:'state-graph-crossfade-secondary-motion',objects:Object.freeze([academy.group.name,academy.portal.name,water.group.name,'WisdoV4AtmosphereParticles','WisdoV4OperatorContactShadow']),target:Object.freeze({operator:true,academyEntrance:true,masterChamberPortal:true,reflectiveCourt:true,pbrEnvironment:true,semanticNpcAnimation:true}),performanceBudget:Object.freeze({desktopTargetFps:60,mobileTargetFps:30,heroArea:'academy-founder-wing',instancedAtmosphere:true})});
}

export function installWisdoVisualFidelityV4({THREE,scene,camera,renderer,quality='medium',debug=false}={}){
  if(!THREE||!scene||!camera||!renderer)throw new TypeError('WISDO Visual Fidelity V4 requires active Three.js scene, camera and renderer.');
  const touchLike=Boolean(globalThis.matchMedia?.('(pointer: coarse)')?.matches||globalThis.navigator?.maxTouchPoints>0);const root=new THREE.Group();root.name='WisdoVisualFidelityV4';scene.add(root);const disposables=[];
  const previousEnvironment=scene.environment,previousFog=scene.fog,previousExposure=renderer.toneMappingExposure;let envTexture=null;
  try{envTexture=makeEnvironment(THREE,renderer,disposables);if(envTexture)scene.environment=envTexture;}catch(error){if(debug)console.warn('WISDO V4 PMREM environment degraded.',error);}
  scene.fog=new THREE.FogExp2(0x06101c,touchLike?.0075:.0062);renderer.toneMappingExposure=Math.max(Number(previousExposure||1),touchLike?1.34:1.28);
  const academy=buildAcademyEntrance(THREE,root,touchLike,disposables);const water=buildWaterFeature(THREE,root,touchLike,disposables);const atmosphere=buildAtmosphere(THREE,root,touchLike,disposables);const contact=buildOperatorContact(THREE,scene,root,disposables);
  const diagnostics=createDiagnostics({quality,touchLike,academy,water,environmentActive:Boolean(envTexture)});globalThis.WisdoVisualFidelityV4Diagnostics=diagnostics;
  if(debug)console.debug('[WISDO VISUAL FIDELITY V4]',diagnostics);
  let destroyed=false,last=performance.now(),elapsed=0,frameId=0;const operatorPos=new THREE.Vector3();
  function frame(now){if(destroyed)return;frameId=requestAnimationFrame(frame);const dt=Math.min(.05,Math.max(.001,(now-last)/1000));last=now;elapsed+=dt;academy.portal.rotation.z=elapsed*.18;academy.portal.material.opacity=.78+Math.sin(elapsed*1.7)*.16;academy.portalCore.material.opacity=.64+Math.sin(elapsed*1.1)*.08;academy.interactionLight.intensity=(touchLike?20:30)*(1+Math.sin(elapsed*1.3)*.12);water.sculpture.rotation.y=elapsed*.18;water.sculpture.rotation.x=Math.sin(elapsed*.42)*.08;water.water.roughness=clamp(.075+Math.sin(elapsed*.7)*.015,.05,.11);atmosphere.rotation.y=elapsed*.006;
    if(contact){contact.operator.getWorldPosition(operatorPos);contact.shadow.position.set(operatorPos.x,.036,operatorPos.z);const speed=Number(globalThis.WisdoRenderDiagnostics?.player?.speed||0);contact.material.opacity=damp(contact.material.opacity,speed>5?.20:.30,4,dt);}
  }
  frameId=requestAnimationFrame(frame);
  return Object.freeze({quality,diagnostics,update(){},destroy(){if(destroyed)return;destroyed=true;cancelAnimationFrame(frameId);scene.remove(root);scene.environment=previousEnvironment;scene.fog=previousFog;renderer.toneMappingExposure=previousExposure;for(const item of disposables){try{item?.dispose?.();}catch{}}delete globalThis.WisdoVisualFidelityV4Diagnostics;}});
}
