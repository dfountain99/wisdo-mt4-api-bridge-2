const ROUTES = Object.freeze([
  Object.freeze([[0,0,58],[0,0,35],[0,0,10],[0,0,-20],[0,0,-52]]),
  Object.freeze([[-20,0,60],[-20,0,35],[-20,0,10],[-38,0,10],[-55,0,22]]),
  Object.freeze([[20,0,62],[20,0,34],[38,0,18],[55,0,8],[67,0,-7]]),
  Object.freeze([[-45,0,-45],[-31,0,-31],[-20,0,-10],[-20,0,18],[-39,0,22]]),
  Object.freeze([[53,0,-35],[40,0,-25],[22,0,-12],[18,0,20],[31,0,53]]),
]);
const SHUTTLE_ROUTE = Object.freeze([[-55,0,78],[-55,0,24],[-20,0,10],[20,0,10],[55,0,36],[30,0,72],[-20,0,72],[-55,0,78]]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function budgetForQuality() {
  const quality = globalThis.WisdoQualityDiagnostics?.activeQuality || 'medium';
  if (quality === 'low') return 5;
  if (quality === 'high') return 16;
  return 9;
}

function makeCitizen(THREE, index) {
  const group = new THREE.Group(); group.name = `WISDOAmbientCitizen${index}`; group.userData.presenceClass = 'AMBIENT_NPC'; group.userData.isRealOperator = false;
  const cloth = new THREE.MeshStandardMaterial({ color: index % 3 === 0 ? 0x20252c : index % 3 === 1 ? 0x29313a : 0x171b20, roughness: .68, metalness: .08 });
  const skin = new THREE.MeshStandardMaterial({ color: index % 4 === 0 ? 0x6f4735 : index % 4 === 1 ? 0x9a684d : index % 4 === 2 ? 0xb98162 : 0x4c3128, roughness: .72 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.23,.55,4,8), cloth); torso.position.y = 1.12; torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.18,10,8), skin); head.position.y = 1.72; head.castShadow = true;
  const legs = [];
  for (const side of [-1,1]) { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.085,.46,3,6), cloth); leg.position.set(side*.11,.47,0); leg.castShadow = true; group.add(leg); legs.push(leg); }
  group.add(torso,head); group.userData.anim = { legs, phase:index*.7 }; return group;
}

function makeShuttle(THREE) {
  const group = new THREE.Group(); group.name='WISDOAutonomousShuttle'; group.userData.presenceClass='AMBIENT_TRANSPORT';
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2,1.2,5.2),new THREE.MeshStandardMaterial({color:0x151b21,metalness:.58,roughness:.28}));body.position.y=.95;body.castShadow=true;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.75,.85,3.1),new THREE.MeshPhysicalMaterial({color:0x173643,transparent:true,opacity:.72,roughness:.1,metalness:.18,clearcoat:.85}));glass.position.y=1.75;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(3.3,.08,5.25),new THREE.MeshStandardMaterial({color:0xcaa65d,emissive:0x60440c,emissiveIntensity:.65,metalness:.75,roughness:.2}));strip.position.y=1.28;
  group.add(body,glass,strip);return group;
}

function pointOnRoute(THREE, route, distance) {
  let total = 0; const lengths=[];
  for(let i=0;i<route.length-1;i+=1){const a=route[i],b=route[i+1],len=Math.hypot(b[0]-a[0],b[2]-a[2]);lengths.push(len);total+=len;}
  let d=((distance%total)+total)%total;
  for(let i=0;i<lengths.length;i+=1){if(d<=lengths[i]){const a=route[i],b=route[i+1],t=lengths[i]?d/lengths[i]:0;return {position:new THREE.Vector3(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t),heading:Math.atan2(b[0]-a[0],b[2]-a[2])};}d-=lengths[i];}
  const last=route[route.length-1];return {position:new THREE.Vector3(...last),heading:0};
}

export function startWorldPopulationRuntime() {
  let stopped=false,raf=0,spatial=null,root=null,shuttle=null,last=performance.now(),elapsed=0,citizens=[];
  const onReady=()=>attach(globalThis.WisdoWorldSpatialContext||null);
  window.addEventListener('wisdo:spatial-context-ready',onReady);

  function detach(){if(!root)return;try{spatial?.scene?.remove?.(root);}catch{} root.traverse((object)=>{object.geometry?.dispose?.();const mats=Array.isArray(object.material)?object.material:[object.material];mats.forEach((m)=>m?.dispose?.());});root=null;shuttle=null;citizens=[];}
  function attach(next){if(!next?.THREE||!next?.scene||next===spatial&&root)return;detach();spatial=next;const THREE=spatial.THREE;root=new THREE.Group();root.name='WISDOAmbientPopulation';root.userData.containsRealOperators=false;spatial.scene.add(root);
    const count=budgetForQuality();
    for(let i=0;i<count;i+=1){const model=makeCitizen(THREE,i),route=ROUTES[i%ROUTES.length],progress=(i/count)*120;root.add(model);citizens.push({model,route,progress,speed:.72+(i%4)*.14,purpose:['COMMUTE','MARKET','ACADEMY','TOWER','PLAZA'][i%5]});}
    shuttle=makeShuttle(THREE);root.add(shuttle);
    globalThis.WisdoWorldPopulation=Object.freeze({get ambientNpcCount(){return citizens.length;},realOperatorCount:null,transport:'AUTONOMOUS_SHUTTLE',navigation:'DETERMINISTIC_PURPOSE_ROUTES'});
  }

  function frame(now){if(stopped)return;raf=requestAnimationFrame(frame);if(globalThis.WisdoWorldSpatialContext!==spatial)attach(globalThis.WisdoWorldSpatialContext||null);if(!root||!spatial?.THREE)return;const dt=clamp((now-last)/1000,.001,.05);last=now;elapsed+=dt;const THREE=spatial.THREE,quality=globalThis.WisdoQualityDiagnostics?.activeQuality||'medium';const activeBudget=budgetForQuality();
    citizens.forEach((agent,index)=>{agent.model.visible=index<activeBudget;if(!agent.model.visible)return;agent.progress+=agent.speed*dt;const p=pointOnRoute(THREE,agent.route,agent.progress);agent.model.position.copy(p.position);agent.model.rotation.y=p.heading;const phase=(agent.model.userData.anim.phase+=dt*(4.6+agent.speed));const swing=Math.sin(phase)*.38;agent.model.userData.anim.legs[0].rotation.x=swing;agent.model.userData.anim.legs[1].rotation.x=-swing;});
    if(shuttle){const p=pointOnRoute(THREE,SHUTTLE_ROUTE,elapsed*(quality==='low'?2.2:3.1));shuttle.position.copy(p.position);shuttle.position.y=.08;shuttle.rotation.y=p.heading;}
  }
  attach(globalThis.WisdoWorldSpatialContext||null);raf=requestAnimationFrame(frame);
  return Object.freeze({stop(){if(stopped)return;stopped=true;cancelAnimationFrame(raf);window.removeEventListener('wisdo:spatial-context-ready',onReady);detach();delete globalThis.WisdoWorldPopulation;}});
}
