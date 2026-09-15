const REVISION='2026.09.15.visual-fidelity-v4';

function keep(list,item){if(item)list.push(item);return item;}
function glow(THREE,color,opacity=.9){return new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending});}
function surface(THREE,color,{emissive=0,emissiveIntensity=0,roughness=.3,metalness=.62,clearcoat=0,clearcoatRoughness=.08,transparent=false,opacity=1,side}={}){
  return new THREE.MeshPhysicalMaterial({color,emissive,emissiveIntensity,roughness,metalness,clearcoat,clearcoatRoughness,transparent,opacity,depthWrite:!transparent,side:side??THREE.FrontSide});
}
function screenTexture(THREE,{title='WISDO',subtitle='ARCADE WORLD',footer='TRADE · EXPLORE · PLAY · LIVE',accent='#72eaff',gold='#e7bd68'}={}){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=384;const ctx=canvas.getContext('2d');
  const gradient=ctx.createLinearGradient(0,0,1024,384);gradient.addColorStop(0,'#020714');gradient.addColorStop(.52,'#071c37');gradient.addColorStop(1,'#040813');ctx.fillStyle=gradient;ctx.fillRect(0,0,1024,384);
  const halo=ctx.createRadialGradient(512,160,20,512,160,360);halo.addColorStop(0,'rgba(95,94,255,.28)');halo.addColorStop(.45,'rgba(45,214,255,.10)');halo.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=halo;ctx.fillRect(0,0,1024,384);
  ctx.strokeStyle=accent;ctx.lineWidth=5;ctx.shadowColor=accent;ctx.shadowBlur=26;ctx.strokeRect(14,14,996,356);ctx.shadowBlur=0;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#ffffff';ctx.font='900 82px Inter,system-ui,sans-serif';ctx.shadowColor='#655cff';ctx.shadowBlur=24;ctx.fillText(title,512,112);ctx.shadowBlur=0;
  ctx.fillStyle=accent;ctx.font='900 44px Inter,system-ui,sans-serif';ctx.fillText(subtitle,512,204);ctx.fillStyle=gold;ctx.font='800 25px Inter,system-ui,sans-serif';ctx.fillText(footer,512,292);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

function createTowerFacade(THREE,root,touchLike,disposables){
  const group=new THREE.Group();group.name='WisdoV4TradingTowerFacade';group.position.set(0,0,-59.1);root.add(group);
  const dark=keep(disposables,surface(THREE,0x050a13,{emissive:0x061425,emissiveIntensity:.5,roughness:.24,metalness:.86}));
  const glass=keep(disposables,surface(THREE,0x0a2135,{emissive:0x05213b,emissiveIntensity:.9,roughness:.12,metalness:.52,clearcoat:1,clearcoatRoughness:.04,transparent:true,opacity:.88}));
  const cyan=keep(disposables,glow(THREE,0x68eaff,.9));const gold=keep(disposables,glow(THREE,0xe7bd68,.82));
  const base=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(24,7.2,1.25)),dark);base.position.y=3.6;group.add(base);
  const center=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(12.5,19,.72)),glass);center.position.y=13.4;group.add(center);
  for(const side of [-1,1]){
    const wing=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(5.6,14.5,.78)),dark);wing.position.set(side*8.6,10.5,.14);wing.rotation.z=side*.055;group.add(wing);
    const fin=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(.16,20,.16)),side<0?cyan:gold);fin.position.set(side*11.45,12,.56);group.add(fin);
    const crownFin=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(.18,8,.22)),side<0?gold:cyan);crownFin.position.set(side*4.1,27.4,.35);crownFin.rotation.z=side*.18;group.add(crownFin);
  }
  const portal=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(8.4,5.2,.86)),glass);portal.position.set(0,2.6,.72);group.add(portal);
  const portalGlow=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(9.1,.13,.12)),gold);portalGlow.position.set(0,5.25,1.18);group.add(portalGlow);
  const texture=keep(disposables,screenTexture(THREE,{}));const screen=new THREE.Mesh(keep(disposables,new THREE.PlaneGeometry(touchLike?14.8:17.2,touchLike?5.55:6.45)),keep(disposables,new THREE.MeshBasicMaterial({map:texture,toneMapped:false})));screen.name='WisdoV4TowerHeroScreen';screen.position.set(0,16.5,.78);group.add(screen);
  const halo=new THREE.Mesh(keep(disposables,new THREE.TorusGeometry(7.9,.07,8,touchLike?40:72)),cyan);halo.name='WisdoV4TowerHalo';halo.rotation.x=Math.PI/2;halo.position.set(0,28.2,-.1);group.add(halo);return{group,halo};
}

function createStorefronts(THREE,root,touchLike,disposables){
  const dark=keep(disposables,surface(THREE,0x07101b,{emissive:0x04182c,emissiveIntensity:.55,roughness:.3,metalness:.7}));
  const glass=keep(disposables,surface(THREE,0x10263a,{emissive:0x0a2639,emissiveIntensity:.65,roughness:.14,metalness:.38,clearcoat:1,clearcoatRoughness:.04,transparent:true,opacity:.86}));
  const warm=keep(disposables,glow(THREE,0xffbd72,.78));const cyan=keep(disposables,glow(THREE,0x67e9ff,.76));const violet=keep(disposables,glow(THREE,0x9b70ff,.76));
  const stores=[[-20.5,41,'WISDO BREW','BETTER TRADES · BRIGHTER DAYS',warm],[-20.5,19,'ARCADE','PLAY · LEARN · COMPETE',violet],[20.5,35,'WISDO GYM','FOCUS · DISCIPLINE · GROW',cyan],[20.5,11,'WISDO LOUNGE','CONNECT · BUILD · BELONG',warm]];
  for(const [x,z,title,subtitle,accent] of stores){
    const group=new THREE.Group();group.name=`WisdoV4Storefront-${title.replaceAll(' ','')}`;group.position.set(x,0,z);
    const body=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(9.5,5.8,7.4)),dark);body.position.y=2.9;group.add(body);
    const window=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(7.7,3.1,.16)),glass);window.position.set(0,2.7,x<0?3.78:-3.78);group.add(window);
    const canopy=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(8.5,.24,1.8)),dark);canopy.position.set(0,4.85,x<0?4.22:-4.22);group.add(canopy);
    const strip=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(8.2,.10,.10)),accent);strip.position.set(0,5.02,x<0?4.33:-4.33);group.add(strip);
    const texture=keep(disposables,screenTexture(THREE,{title,subtitle,footer:'WISDO WORLD'}));const sign=new THREE.Mesh(keep(disposables,new THREE.PlaneGeometry(touchLike?6.4:7.2,touchLike?2.4:2.7)),keep(disposables,new THREE.MeshBasicMaterial({map:texture,toneMapped:false})));sign.position.set(0,6.55,x<0?3.86:-3.86);sign.rotation.y=x<0?0:Math.PI;group.add(sign);root.add(group);
  }
  return stores.length;
}

function createPalm(THREE,root,disposables,x,z,scale){
  const palm=new THREE.Group();palm.name=`WisdoV4Palm-${x}-${z}`;palm.position.set(x,0,z);palm.scale.setScalar(scale);root.add(palm);
  const trunkMat=keep(disposables,surface(THREE,0x5a4331,{roughness:.82,metalness:.02}));const frondMat=keep(disposables,surface(THREE,0x153a2b,{emissive:0x071d18,emissiveIntensity:.35,roughness:.66,metalness:.04,side:THREE.DoubleSide}));
  const trunk=new THREE.Mesh(keep(disposables,new THREE.CylinderGeometry(.18,.30,5.8,8)),trunkMat);trunk.position.y=2.9;trunk.rotation.z=.035;palm.add(trunk);
  for(let i=0;i<9;i+=1){const a=i*Math.PI*2/9;const frond=new THREE.Mesh(keep(disposables,new THREE.PlaneGeometry(3.3,.52,1,3)),frondMat);frond.position.set(Math.cos(a)*1.25,5.85,Math.sin(a)*1.25);frond.rotation.set(-.52,Math.PI/2-a,Math.sin(a)*.18);palm.add(frond);}return palm;
}
function createPalms(THREE,root,disposables){const points=[[-13.3,55,.92],[13.3,55,.9],[-13.8,31,.82],[13.8,31,.84],[-14.2,8,.76],[14.2,8,.78]];for(const [x,z,s] of points)createPalm(THREE,root,disposables,x,z,s);return points.length;}

function createPlaza(THREE,root,touchLike,disposables){
  const material=keep(disposables,surface(THREE,0x07101b,{emissive:0x03111e,emissiveIntensity:.62,roughness:touchLike?.18:.11,metalness:.42,clearcoat:1,clearcoatRoughness:.04,transparent:true,opacity:touchLike?.82:.9}));
  const plaza=new THREE.Mesh(keep(disposables,new THREE.PlaneGeometry(31.5,73)),material);plaza.name='WisdoV4HeroPlazaSurface';plaza.rotation.x=-Math.PI/2;plaza.position.set(0,.19,28);root.add(plaza);
  const cyan=keep(disposables,glow(THREE,0x62eaff,.56));const gold=keep(disposables,glow(THREE,0xe7bd68,.5));
  for(let z=-2;z<=62;z+=8){const line=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(28,.018,.045)),z%16===0?gold:cyan);line.position.set(0,.205,z);root.add(line);}for(const x of [-14,14]){const edge=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(.055,.025,70)),x<0?cyan:gold);edge.position.set(x,.21,28);root.add(edge);}return plaza;
}

function createSkybridge(THREE,root,disposables){
  const dark=keep(disposables,surface(THREE,0x06101c,{emissive:0x06172b,emissiveIntensity:.55,roughness:.25,metalness:.82}));const cyan=keep(disposables,glow(THREE,0x6ceaff,.66));
  const bridge=new THREE.Group();bridge.name='WisdoV4Skybridge';bridge.position.set(0,9.8,4);root.add(bridge);const deck=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(31,.48,2.3)),dark);bridge.add(deck);const rail=new THREE.Mesh(keep(disposables,new THREE.BoxGeometry(30,.08,.08)),cyan);rail.position.set(0,.44,1.12);bridge.add(rail);return bridge;
}

function createCrowd(THREE,root,touchLike,disposables){
  const count=touchLike?8:12;const bodyGeo=keep(disposables,new THREE.CylinderGeometry(.18,.23,1.05,6));const headGeo=keep(disposables,new THREE.SphereGeometry(.15,8,6));
  const bodyMat=keep(disposables,surface(THREE,0x111925,{emissive:0x03060a,emissiveIntensity:.2,roughness:.58,metalness:.18}));const headMat=keep(disposables,surface(THREE,0x8f6049,{roughness:.8,metalness:0}));
  const bodies=new THREE.InstancedMesh(bodyGeo,bodyMat,count);const heads=new THREE.InstancedMesh(headGeo,headMat,count);bodies.name='WisdoV4ForegroundCrowd';heads.name='WisdoV4ForegroundCrowdHeads';root.add(bodies,heads);
  const anchors=[[-8,52],[-3,49],[5,54],[9,44],[-8,36],[7,31],[-5,23],[6,18],[-9,12],[9,8],[-2,42],[2,27]];const dummy=new THREE.Object3D();
  function update(t){for(let i=0;i<count;i+=1){const [bx,bz]=anchors[i],a=t*(.14+(i%3)*.035)+i*.83,x=bx+Math.cos(a)*(.45+(i%2)*.25),z=bz+Math.sin(a*.91)*(.35+(i%3)*.16),yaw=a+Math.PI*.5;dummy.position.set(x,.73,z);dummy.rotation.set(0,yaw,0);dummy.scale.set(1,1,1);dummy.updateMatrix();bodies.setMatrixAt(i,dummy.matrix);dummy.position.set(x,1.49,z);dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);}bodies.instanceMatrix.needsUpdate=true;heads.instanceMatrix.needsUpdate=true;}
  update(0);return{count,update};
}

export function installWisdoVisualFidelityV4({THREE,scene,camera,renderer,quality='medium',debug=false}={}){
  if(!THREE||!scene||!camera||!renderer)throw new TypeError('WISDO Visual Fidelity V4 requires the active production scene, camera and renderer.');
  const root=new THREE.Group();root.name='WisdoVisualFidelityV4';scene.add(root);const disposables=[];const touchLike=Boolean(globalThis.matchMedia?.('(pointer: coarse)')?.matches||navigator.maxTouchPoints>0);
  const tower=createTowerFacade(THREE,root,touchLike,disposables);const storefrontCount=createStorefronts(THREE,root,touchLike,disposables);const palmCount=createPalms(THREE,root,disposables);createPlaza(THREE,root,touchLike,disposables);createSkybridge(THREE,root,disposables);const crowd=createCrowd(THREE,root,touchLike,disposables);
  const objectNames=['WisdoV4TradingTowerFacade','WisdoV4TowerHeroScreen','WisdoV4HeroPlazaSurface','WisdoV4Skybridge','WisdoV4ForegroundCrowd'];
  const diagnostics=Object.freeze({active:true,revision:REVISION,artDirection:'WISDO_ARCADE_CITY_HERO_COMPOSITION_V4',touchLike,quality,storefrontCount,palmCount,crowdCount:crowd.count,objects:objectNames,objectCount:objectNames.length,executionFromVisualLayer:false});
  globalThis.WisdoVisualFidelityV4Diagnostics=diagnostics;document.documentElement.dataset.wisdoVisualV4='active';window.dispatchEvent(new CustomEvent('wisdo:visual-v4-ready',{detail:diagnostics}));if(debug)console.debug('[WISDO VISUAL FIDELITY V4]',diagnostics);
  let elapsed=0;return{diagnostics,update(dt=.016){elapsed+=dt;tower.halo.rotation.z+=dt*.055;crowd.update(elapsed);},destroy(){scene.remove(root);for(const item of disposables.reverse())item?.dispose?.();delete globalThis.WisdoVisualFidelityV4Diagnostics;delete document.documentElement.dataset.wisdoVisualV4;}};
}
