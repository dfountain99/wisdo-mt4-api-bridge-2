const REVISION='2026.09.15.visual-fidelity-v2';
const TAU=Math.PI*2;

function addDisposable(list,item){if(item)list.push(item);return item;}
function glow(THREE,color,opacity=.9){return new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending});}
function standard(THREE,color,{emissive=0,emissiveIntensity=0,roughness=.32,metalness=.55,transparent=false,opacity=1}={}){return new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity,roughness,metalness,transparent,opacity,depthWrite:!transparent});}

function screenTexture(THREE,{eyebrow='WISDO',title='ARCADE WORLD',subtitle='',footer='TRADE · EXPLORE · PLAY · LIVE',accent='#68e8ff',accent2='#e2bb62',width=1024,height=512}={}){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
  const g=ctx.createLinearGradient(0,0,width,height);g.addColorStop(0,'#020713');g.addColorStop(.48,'#07162c');g.addColorStop(1,'#050713');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
  const rg=ctx.createRadialGradient(width*.5,height*.45,10,width*.5,height*.45,width*.5);rg.addColorStop(0,'rgba(84,112,255,.20)');rg.addColorStop(.48,'rgba(40,205,255,.08)');rg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=rg;ctx.fillRect(0,0,width,height);
  ctx.strokeStyle='rgba(112,232,255,.72)';ctx.lineWidth=5;ctx.shadowColor=accent;ctx.shadowBlur=24;ctx.strokeRect(18,18,width-36,height-36);ctx.shadowBlur=0;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=accent;ctx.font='800 26px Inter,system-ui,sans-serif';ctx.fillText(String(eyebrow).toUpperCase(),width/2,68);
  ctx.fillStyle='#f8fbff';ctx.font='900 78px Inter,system-ui,sans-serif';ctx.shadowColor=accent;ctx.shadowBlur=22;ctx.fillText(String(title).toUpperCase(),width/2,178);ctx.shadowBlur=0;
  if(subtitle){ctx.fillStyle=accent2;ctx.font='800 34px Inter,system-ui,sans-serif';ctx.fillText(String(subtitle).toUpperCase(),width/2,260);}
  ctx.fillStyle='#cfeeff';ctx.font='700 26px Inter,system-ui,sans-serif';ctx.fillText(String(footer).toUpperCase(),width/2,358);
  ctx.fillStyle='rgba(255,255,255,.10)';for(let y=414;y<height-32;y+=18)ctx.fillRect(54,y,width-108,1);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

function makeFramedScreen(THREE,disposables,{name,position,size=[12,5],rotationY=0,texture,accent=0x68e8ff,accent2=0xe2bb62}){
  const group=new THREE.Group();group.name=name;group.position.set(...position);group.rotation.y=rotationY;
  const frameMat=addDisposable(disposables,standard(THREE,0x070b12,{roughness:.22,metalness:.9}));
  const edgeA=addDisposable(disposables,glow(THREE,accent,.9));const edgeB=addDisposable(disposables,glow(THREE,accent2,.72));
  const [w,h]=size;const frame=new THREE.Mesh(addDisposable(disposables,new THREE.BoxGeometry(w+.45,h+.45,.28)),frameMat);group.add(frame);
  const screen=new THREE.Mesh(addDisposable(disposables,new THREE.PlaneGeometry(w,h)),addDisposable(disposables,new THREE.MeshBasicMaterial({map:texture,toneMapped:false})));screen.position.z=.151;group.add(screen);
  const top=new THREE.Mesh(addDisposable(disposables,new THREE.BoxGeometry(w+.12,.07,.06)),edgeA);top.position.set(0,h/2+.08,.18);group.add(top);
  const bottom=new THREE.Mesh(addDisposable(disposables,new THREE.BoxGeometry(w+.12,.07,.06)),edgeB);bottom.position.set(0,-h/2-.08,.18);group.add(bottom);
  return group;
}

function createHeroTowerIdentity(THREE,root,disposables,quality){
  const texture=addDisposable(disposables,screenTexture(THREE,{eyebrow:'WISDO',title:'ARCADE WORLD',subtitle:'A BIGGER WORLD',footer:'TRADE · EXPLORE · PLAY · LIVE'}));
  const hero=makeFramedScreen(THREE,disposables,{name:'WisdoArcadeWorldHeroBillboard',position:[0,33,-59.55],size:[quality==='low'?14:18,quality==='low'?5:6.5],texture});root.add(hero);
  const cyan=addDisposable(disposables,glow(THREE,0x6cecff,.94));const gold=addDisposable(disposables,glow(THREE,0xe2bb62,.82));
  const crown=new THREE.Group();crown.name='WisdoArcadeTowerCrown';crown.position.set(0,0,-84);root.add(crown);
  for(const [radius,y,material,spin] of [[7.6,108,cyan,.08],[6.2,119,gold,-.11],[4.9,130,cyan,.14]]){const ring=new THREE.Mesh(addDisposable(disposables,new THREE.TorusGeometry(radius,.075,8,quality==='low'?36:72)),material);ring.rotation.x=Math.PI/2;ring.position.y=y;crown.add(ring);ring.userData.spin=spin;}
  const beam=new THREE.Mesh(addDisposable(disposables,new THREE.CylinderGeometry(.12,.2,74,8)),cyan);beam.position.y=101;crown.add(beam);
  return{hero,crown};
}

function createModeBridge(THREE,root,disposables){
  const frame=addDisposable(disposables,standard(THREE,0x080d16,{roughness:.25,metalness:.86}));const cyan=addDisposable(disposables,glow(THREE,0x66e6ff,.82));const violet=addDisposable(disposables,glow(THREE,0x7c6cff,.72));
  const gate=new THREE.Group();gate.name='WisdoModeBridge';gate.position.set(0,0,47);root.add(gate);
  for(const x of [-15,15]){const pillar=new THREE.Mesh(addDisposable(disposables,new THREE.BoxGeometry(.55,8,.55)),frame);pillar.position.set(x,4,0);gate.add(pillar);const strip=new THREE.Mesh(addDisposable(disposables,new THREE.BoxGeometry(.13,7.2,.09)),x<0?cyan:violet);strip.position.set(x,4,.32);gate.add(strip);}
  const top=new THREE.Mesh(addDisposable(disposables,new THREE.BoxGeometry(30.5,.48,.62)),frame);top.position.set(0,8,0);gate.add(top);
  const leftTexture=addDisposable(disposables,screenTexture(THREE,{eyebrow:'WISDO',title:'2D DASHBOARD',subtitle:'FAST MODE',footer:'ACCOUNT · TRADES · ANALYTICS',width:768,height:420}));
  const rightTexture=addDisposable(disposables,screenTexture(THREE,{eyebrow:'WISDO',title:'3D WORLD',subtitle:'LIVE CITY',footer:'EXPLORE · LEARN · BELONG',accent:'#8d78ff',width:768,height:420}));
  const left=makeFramedScreen(THREE,disposables,{name:'WisdoModeBridgeDashboard',position:[-10,5.2,47.2],size:[7.4,3.5],texture:leftTexture});
  const right=makeFramedScreen(THREE,disposables,{name:'WisdoModeBridgeWorld',position:[10,5.2,47.2],size:[7.4,3.5],texture:rightTexture,accent:0x8d78ff});
  root.add(left,right);return gate;
}

function createCommandGlobe(THREE,root,disposables,quality){
  const group=new THREE.Group();group.name='WisdoCommandGlobe';group.position.set(10.5,0,22);root.add(group);
  const cyan=addDisposable(disposables,glow(THREE,0x6cecff,.72));const gold=addDisposable(disposables,glow(THREE,0xe2bb62,.64));
  const sphere=new THREE.Mesh(addDisposable(disposables,new THREE.SphereGeometry(1.65,quality==='low'?16:28,quality==='low'?10:18)),addDisposable(disposables,new THREE.MeshBasicMaterial({color:0x3fd7ff,wireframe:true,transparent:true,opacity:.56,depthWrite:false,toneMapped:false})));sphere.position.y=2.2;group.add(sphere);
  for(const [r,y,mat] of [[2.35,2.2,cyan],[1.95,2.2,gold],[2.65,.55,cyan]]){const ring=new THREE.Mesh(addDisposable(disposables,new THREE.TorusGeometry(r,.035,8,48)),mat);ring.rotation.x=Math.PI/2;ring.position.y=y;group.add(ring);}
  const base=new THREE.Mesh(addDisposable(disposables,new THREE.CylinderGeometry(2.9,3.2,.48,quality==='low'?20:40)),addDisposable(disposables,standard(THREE,0x08121d,{roughness:.28,metalness:.78})));base.position.y=.28;group.add(base);
  const labelTexture=addDisposable(disposables,screenTexture(THREE,{eyebrow:'ONE ECOSYSTEM',title:'WISDO',subtitle:'COMMAND HUB',footer:'MARKETS · INTELLIGENCE · FREEDOM',width:768,height:360}));
  const label=new THREE.Sprite(addDisposable(disposables,new THREE.SpriteMaterial({map:labelTexture,transparent:true,depthWrite:false,toneMapped:false})));label.position.set(0,5.15,0);label.scale.set(6.6,3.1,1);group.add(label);return group;
}

function createDistrictIdentity(THREE,root,disposables,quality){
  const identities=[
    ['WisdoDistrictGrowth',[34,22,82],'GROWTH','BUILD · COMPOUND','GROW',0x68e8a9],
    ['WisdoDistrictAcademy',[-58,20,-58],'ACADEMY','LEARN · PRACTICE','LEARN',0xe2bb62],
    ['WisdoDistrictVault',[-82,17,5],'VAULT','OWN · PROTECT','OWN',0x53e8e5],
    ['WisdoDistrictCoach',[67,24,-40],'COACH','MENTOR · GUIDE','COACH',0x9d68ff],
    ['WisdoDistrictWarRoom',[-36,19,-92],'WAR ROOM','COMMAND · ANALYZE','OPERATE',0x6cecff],
  ];
  const limit=quality==='low'?3:identities.length;const groups=[];
  identities.slice(0,limit).forEach(([name,position,title,subtitle,footer,accent])=>{const texture=addDisposable(disposables,screenTexture(THREE,{eyebrow:'WISDO',title,subtitle,footer,accent:`#${accent.toString(16).padStart(6,'0')}`,width:640,height:360}));const panel=makeFramedScreen(THREE,disposables,{name,position,size:[7.8,4.3],texture,accent});root.add(panel);groups.push(panel);});
  const registry=new THREE.Group();registry.name='WisdoEcosystemDistrictLabels';root.add(registry);groups.forEach((g)=>registry.attach(g));return registry;
}

function createWetPlaza(THREE,root,disposables,quality){
  const material=addDisposable(disposables,new THREE.MeshPhysicalMaterial({color:0x071421,roughness:quality==='low'?.2:.08,metalness:.32,clearcoat:1,clearcoatRoughness:.04,transparent:true,opacity:quality==='low'?.2:.32,depthWrite:false}));
  const puddles=quality==='low'?[[0,58,5.2],[9,39,3.5],[-8,25,4]]:[[0,58,6.2],[9,39,4.5],[-8,25,4.8],[12,7,3.6],[-10,5,3.2],[6,-18,4.4]];
  puddles.forEach(([x,z,r],i)=>{const p=new THREE.Mesh(addDisposable(disposables,new THREE.CircleGeometry(r,quality==='low'?20:36)),material);p.name=`WisdoReflectivePlaza-${i}`;p.rotation.x=-Math.PI/2;p.position.set(x,.145,z);p.scale.y=.55+(i%3)*.08;p.renderOrder=4;root.add(p);});
}

function createSloganSigns(THREE,root,disposables){
  const rows=[[-13.4,3.2,18,'SAME MARKETS','A BIGGER WORLD',-.12],[13.4,3.2,8,'TRADE SMARTER','LIVE BIGGER',.12],[-13.4,3.2,-18,'GOOD TRADERS','BUILD BETTER',-.08]];
  rows.forEach(([x,y,z,title,subtitle,rot],index)=>{const texture=addDisposable(disposables,screenTexture(THREE,{eyebrow:'WISDO',title,subtitle,footer:index===0?'CONNECT · COPY · CONTROL':'DISCIPLINE · FREEDOM',width:640,height:360}));const panel=makeFramedScreen(THREE,disposables,{name:`WisdoStreetMessage-${index}`,position:[x,y,z],size:[6.5,3.2],rotationY:rot,texture,accent:index===2?0xe2bb62:0x68e8ff});root.add(panel);});
}

export function installWisdoVisualFidelityV2({THREE,scene,renderer,quality='medium',debug=false}={}){
  if(!THREE||!scene||!renderer)throw new TypeError('WISDO Visual Fidelity V2 requires the active Three.js scene and renderer.');
  const root=new THREE.Group();root.name='WisdoVisualFidelityV2';scene.add(root);const disposables=[];
  const touchLike=Boolean(globalThis.matchMedia?.('(pointer: coarse)')?.matches||navigator.maxTouchPoints>0);const resolvedQuality=quality==='low'?'low':quality==='high'?'high':'medium';
  const previousExposure=renderer.toneMappingExposure;renderer.toneMappingExposure=Math.min(previousExposure||1.25,touchLike?1.26:1.34);
  const tower=createHeroTowerIdentity(THREE,root,disposables,resolvedQuality);const bridge=createModeBridge(THREE,root,disposables);const globe=createCommandGlobe(THREE,root,disposables,resolvedQuality);const districts=createDistrictIdentity(THREE,root,disposables,resolvedQuality);createWetPlaza(THREE,root,disposables,resolvedQuality);
  if(!touchLike)createSloganSigns(THREE,root,disposables);
  const objectNames=['WisdoArcadeWorldHeroBillboard','WisdoArcadeTowerCrown','WisdoModeBridge','WisdoCommandGlobe','WisdoEcosystemDistrictLabels'];
  const diagnostics=Object.freeze({active:true,revision:REVISION,artDirection:'WISDO_CYBER_LUXURY_FINANCIAL_CITY',touchLike,quality:resolvedQuality,objects:objectNames,objectCount:objectNames.length,executionFromVisualLayer:false});
  globalThis.WisdoVisualFidelityV2Diagnostics=diagnostics;document.documentElement.dataset.wisdoVisualV2='active';window.dispatchEvent(new CustomEvent('wisdo:visual-v2-ready',{detail:diagnostics}));
  if(debug)console.debug('[WISDO VISUAL FIDELITY V2]',diagnostics);
  let elapsed=0;return{diagnostics,update(dt=.016){elapsed+=dt;tower.crown.children.forEach((child,index)=>{if(child.userData?.spin)child.rotation.z+=dt*child.userData.spin;else if(child.isMesh&&index===tower.crown.children.length-1)child.material.opacity=.72+Math.sin(elapsed*1.25)*.12;});globe.rotation.y+=dt*.06;districts.children.forEach((child,index)=>{child.position.y+=Math.sin(elapsed*.7+index)*.0008;});bridge.rotation.y=Math.sin(elapsed*.25)*.002;},destroy(){renderer.toneMappingExposure=previousExposure;scene.remove(root);for(const item of disposables.reverse())item?.dispose?.();delete globalThis.WisdoVisualFidelityV2Diagnostics;delete document.documentElement.dataset.wisdoVisualV2;}};
}
