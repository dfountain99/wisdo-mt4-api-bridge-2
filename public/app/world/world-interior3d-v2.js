import { THREE_MODULE_URL, QUALITY_PRESETS, chooseAutoQuality } from './world-config.js';
import { InputManager } from './input-manager.js';
import { installAuthoredOperator } from './authored-operator.js';

const TAU = Math.PI * 2;

const BLUEPRINTS = Object.freeze({
  'trading-tower': { title:'TRADING TOWER', subtitle:'MARKET OPERATIONS', signature:'tower', spawn:[0,20], bounds:[-29,29,-31,25], ceiling:15, theme:[0x03070b,0x061018,0x0b141d,0x071018,0xc9a55c,0x72e8ff,0xf3dbac], stations:[['signals','SIGNAL OBSERVATORY',0,-22],['command','CAMPAIGN COMMAND',-11,-7],['market','LIVE MARKETS',11,-7],['exit','RETURN TO CENTRAL',0,20]] },
  observatory: { title:'SIGNAL OBSERVATORY', subtitle:'LIVE WISDO INTELLIGENCE', signature:'observatory', spawn:[0,19], bounds:[-25,25,-26,24], ceiling:18, theme:[0x01050a,0x020b16,0x07121b,0x06101c,0x6fdcf4,0x9b7cff,0xd8b86c], stations:[['signals','ACTIVE SIGNALS',0,-18],['market','WORLD MARKETS',-10,-4],['command','MY CAMPAIGNS',10,-4],['tower','TRADING TOWER',0,18]] },
  academy: { title:'WISDO ACADEMY', subtitle:'LEARN · PRACTICE · LEVEL UP', signature:'academy', spawn:[0,20], bounds:[-28,28,-30,25], ceiling:13, theme:[0x0a0a09,0x15130f,0x171713,0x12130f,0xcaa760,0x7fcde0,0xffe6aa], stations:[['learn','LEARNING LAB',-10,-12],['progress','PROGRESS HALL',10,-12],['exit','RETURN TO CENTRAL',0,20]] },
  vault: { title:'THE VAULT', subtitle:'OWNED SYSTEMS', signature:'vault', spawn:[0,20], bounds:[-22,22,-30,25], ceiling:12, theme:[0x040504,0x0c0d0b,0x11120f,0x090b09,0xd0ad61,0x66c7d9,0xffd978], stations:[['vault','MY SYSTEMS',0,-14],['progress','ACHIEVEMENTS',10,0],['exit','RETURN TO CENTRAL',0,20]] },
  'bot-arena': { title:'BOT ARENA', subtitle:'SYSTEM EXHIBITION', signature:'arena', spawn:[0,22], bounds:[-31,31,-31,27], ceiling:17, theme:[0x05060b,0x0b0b16,0x0f111b,0x090b14,0xbe9b58,0x61def2,0xe9c66d], stations:[['bots','BOT FLOOR',-11,-7],['market','MARKET',11,-7],['exit','RETURN TO CENTRAL',0,22]] },
  'switch-lab': { title:'SWITCH LAB', subtitle:'WISDO CONFIGURATION', signature:'switch', spawn:[0,20], bounds:[-27,27,-29,25], ceiling:12, theme:[0x03080a,0x061115,0x0c1518,0x071014,0xc3a15d,0x4cf0d1,0xffcc6b], stations:[['coach','COACH LINK',-10,-8],['command','COMMAND BUS',10,-8],['exit','RETURN TO CENTRAL',0,20]] },
  'growth-chamber': { title:'GROWTH CHAMBER', subtitle:'ACCOUNT HISTORY', signature:'growth', spawn:[0,20], bounds:[-27,27,-29,25], ceiling:16, theme:[0x03100d,0x082019,0x0b1815,0x071510,0xbfa45f,0x67e4ba,0xdcc678], stations:[['accounts','ACCOUNT GROWTH',-10,-8],['progress','MILESTONES',10,-8],['exit','RETURN TO CENTRAL',0,20]] },
  'strategy-lab': { title:'STRATEGY LAB', subtitle:'SIMULATION · REVIEW', signature:'strategy', spawn:[0,20], bounds:[-29,29,-30,25], ceiling:13, theme:[0x050810,0x0b1020,0x0d1320,0x080e19,0xc8a65f,0x6aa7ff,0xe3bf68], stations:[['simulation','SIMULATION CORE',-11,-8],['performance','PERFORMANCE REVIEW',11,-8],['exit','RETURN TO CENTRAL',0,20]] },
  'coach-center': { title:'COACH CENTER', subtitle:'WISDO INTELLIGENCE', signature:'coach', spawn:[0,18], bounds:[-24,24,-25,23], ceiling:12, theme:[0x0b0907,0x1b1510,0x17120e,0x120e0b,0xc8a35c,0x86dce4,0xffd79a], stations:[['coach','TALK TO COACH',0,-9],['command','COMMAND LINK',10,1],['exit','RETURN TO CENTRAL',0,18]] },
  'culture-arena': { title:'CULTURE ARENA', subtitle:'COMMUNITY', signature:'culture', spawn:[0,23], bounds:[-32,32,-31,28], ceiling:18, theme:[0x080609,0x160d15,0x151018,0x100b12,0xd0ab62,0xe17bc4,0xf5cd73], stations:[['community','COMMUNITY FLOOR',0,-10],['progress','WORLD PROGRESS',12,2],['exit','RETURN TO CENTRAL',0,23]] },
  marketplace: { title:'WISDO MARKET', subtitle:'PRODUCTS · ACCESS', signature:'market', spawn:[0,22], bounds:[-31,31,-31,27], ceiling:14, theme:[0x090807,0x18130e,0x17150f,0x100e0b,0xd8b464,0x75dfea,0xffdf8a], stations:[['market','MARKET FLOOR',-10,-9],['checkout','SECURE CHECKOUT',10,-9],['exit','RETURN TO CENTRAL',0,22]] },
  'vps-forge': { title:'VPS FORGE', subtitle:'RUNTIME INFRASTRUCTURE', signature:'forge', spawn:[0,21], bounds:[-28,28,-31,26], ceiling:15, theme:[0x070605,0x1a0e07,0x15110f,0x100c09,0xc9a15a,0xf28e45,0xffca69], stations:[['reporter','REPORTER MESH',-11,-8],['command','SYSTEM COMMAND',11,-8],['exit','RETURN TO CENTRAL',0,21]] },
  'private-rooms': { title:'PRIVATE ROOMS', subtitle:'COMMANDER RESIDENCE', signature:'private', spawn:[0,17], bounds:[-24,24,-25,22], ceiling:11, theme:[0x070707,0x151414,0x171715,0x11110f,0xd3af65,0x88c9d8,0xffdfae], stations:[['profile','IDENTITY SUITE',-9,-7],['home','SMART HOME',9,-7],['exit','RETURN TO CENTRAL',0,17]] },
  'war-room': { title:'WAR ROOM', subtitle:'AUTHORIZED OPERATIONS', signature:'war', spawn:[0,20], bounds:[-28,28,-30,25], ceiling:12, theme:[0x060607,0x100d0e,0x111113,0x0b0b0d,0xc39d55,0xd35f5f,0xe8bd64], stations:[['command','COMMAND CORE',0,-10],['reporter','SYSTEM HEALTH',11,0],['exit','RETURN TO CENTRAL',0,20]] },
});

function loading(message, value) {
  const text = document.getElementById('loadingPhase');
  const bar = document.getElementById('loadingBar');
  if (text) text.textContent = message;
  if (bar) {
    const current = Number.parseFloat(bar.style.width || '0') || 0;
    bar.style.width = `${Math.max(current, Math.min(99, Number(value) || current))}%`;
  }
}

function mat(THREE, color, options={}) { return new THREE.MeshStandardMaterial({ color, roughness:options.roughness ?? .42, metalness:options.metalness ?? .28, emissive:options.emissive ?? 0x000000, emissiveIntensity:options.emissiveIntensity ?? 0, transparent:Boolean(options.transparent), opacity:options.opacity ?? 1 }); }
function box(THREE, root, size, pos, material, rot=null, cast=true) { const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...pos);if(rot)m.rotation.set(...rot);m.castShadow=cast;m.receiveShadow=true;root.add(m);return m; }
function cyl(THREE, root, r, h, pos, material, rot=null, seg=24) { const m=new THREE.Mesh(new THREE.CylinderGeometry(r[0],r[1],h,seg),material);m.position.set(...pos);if(rot)m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;root.add(m);return m; }
function ring(THREE, root, radius, tube, pos, material, rot=[Math.PI/2,0,0]) { const m=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,10,56),material);m.position.set(...pos);m.rotation.set(...rot);m.castShadow=true;root.add(m);return m; }
function plane(THREE, root, size, pos, material) { const m=new THREE.Mesh(new THREE.PlaneGeometry(...size),material);m.position.set(...pos);m.rotation.x=-Math.PI/2;m.receiveShadow=true;root.add(m);return m; }

function label(THREE, title, sub='', accent='#72dff3') {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const c=canvas.getContext('2d');
  const g=c.createLinearGradient(0,0,1024,256);g.addColorStop(0,'#03070b');g.addColorStop(.55,'#0a141c');g.addColorStop(1,'#030609');c.fillStyle=g;c.fillRect(0,0,1024,256);
  c.strokeStyle='#c9a55c';c.lineWidth=8;c.strokeRect(8,8,1008,240);c.strokeStyle=accent;c.lineWidth=2;c.strokeRect(22,22,980,212);
  c.fillStyle='#f7f7f3';c.textAlign='center';c.font='700 62px system-ui';c.fillText(title,512,112);c.fillStyle=accent;c.font='600 28px system-ui';c.fillText(sub,512,166);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return new THREE.Mesh(new THREE.PlaneGeometry(8,2),new THREE.MeshBasicMaterial({map:t,toneMapped:false}));
}

function materials(THREE, b) {
  const [, , floor, wall, accent, energy, warm]=b.theme;
  return { floor:mat(THREE,floor,{roughness:.34,metalness:.18}), wall:mat(THREE,wall,{roughness:.42,metalness:.4}), black:mat(THREE,0x070a0d,{roughness:.28,metalness:.82}), accent:mat(THREE,accent,{roughness:.24,metalness:.85}), accentGlow:mat(THREE,accent,{roughness:.2,metalness:.55,emissive:accent,emissiveIntensity:.7}), energy:mat(THREE,energy,{roughness:.18,metalness:.25,emissive:energy,emissiveIntensity:.75}), energySoft:mat(THREE,energy,{roughness:.2,metalness:.15,emissive:energy,emissiveIntensity:.3,transparent:true,opacity:.62}), warm:mat(THREE,warm,{roughness:.28,metalness:.38,emissive:warm,emissiveIntensity:.4}), concrete:mat(THREE,0x282c30,{roughness:.8,metalness:.08}), glass:new THREE.MeshPhysicalMaterial({color:energy,roughness:.08,metalness:.12,transparent:true,opacity:.28,transmission:.06,clearcoat:.8}) };
}

function shell(THREE, root, b, m) {
  const [minX,maxX,minZ,maxZ]=b.bounds,w=maxX-minX,d=maxZ-minZ,cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
  plane(THREE,root,[w,d],[cx,0,cz],m.floor);box(THREE,root,[w,b.ceiling,.65],[cx,b.ceiling/2,minZ],m.wall);box(THREE,root,[.65,b.ceiling,d],[minX,b.ceiling/2,cz],m.wall);box(THREE,root,[.65,b.ceiling,d],[maxX,b.ceiling/2,cz],m.wall);
  const side=(w-7)/2;box(THREE,root,[side,b.ceiling,.65],[minX+side/2,b.ceiling/2,maxZ],m.wall);box(THREE,root,[side,b.ceiling,.65],[maxX-side/2,b.ceiling/2,maxZ],m.wall);
  box(THREE,root,[4.4,5.5,.5],[0,2.75,maxZ-.35],m.glass,null,false);box(THREE,root,[.24,6,.8],[-2.45,3,maxZ-.35],m.accentGlow);box(THREE,root,[.24,6,.8],[2.45,3,maxZ-.35],m.accentGlow);box(THREE,root,[5.2,.22,.8],[0,5.95,maxZ-.35],m.accentGlow);
}

function grid(THREE, root, b, m, step=4) { const [minX,maxX,minZ,maxZ]=b.bounds;for(let x=Math.ceil(minX/step)*step;x<=maxX;x+=step)box(THREE,root,[.035,.018,maxZ-minZ],[x,.018,(minZ+maxZ)/2],m.energySoft,null,false);for(let z=Math.ceil(minZ/step)*step;z<=maxZ;z+=step)box(THREE,root,[maxX-minX,.018,.035],[(minX+maxX)/2,.018,z],m.energySoft,null,false); }

function signature(THREE, root, b, m, quality) {
  switch (b.signature) {
    case 'tower': {
      grid(THREE,root,b,m,4);for(const x of[-20,-13,13,20])box(THREE,root,[.42,13,.42],[x,6.5,-22],Math.abs(x)>15?m.accent:m.black);for(const x of[-18,-9,0,9,18])box(THREE,root,[7.2,3.7,.25],[x,6.3,-30],m.glass,null,false);cyl(THREE,root,[3.7,4.5],.6,[0,.3,-10],m.black);ring(THREE,root,7.2,.12,[0,.75,-10],m.energy);for(const x of[-22,22]){box(THREE,root,[5.8,.45,28],[x,4.2,-5],m.black);box(THREE,root,[5.8,.14,28],[x,4.5,-5],m.accentGlow);}break;
    }
    case 'observatory': {
      cyl(THREE,root,[20,21],.45,[0,.22,-3],m.black,null,64);ring(THREE,root,16,.16,[0,9,-3],m.energy);ring(THREE,root,10,.09,[0,12,-3],m.accentGlow);const n=quality==='low'?10:18;for(let i=0;i<n;i++){const a=i/n*TAU;cyl(THREE,root,[.09,.15],7+(i%3),[Math.cos(a)*17.5,4+(i%3),-3+Math.sin(a)*17.5],i%4===0?m.accentGlow:m.energySoft,null,8);}const orb=new THREE.Mesh(new THREE.SphereGeometry(2.6,28,20),m.glass);orb.position.set(0,5.5,-7);root.add(orb);break;
    }
    case 'academy': {
      const rows=quality==='low'?3:5;for(let r=0;r<rows;r++)for(const x of[-12,-6,6,12]){const z=8-r*5;box(THREE,root,[4.5,.28,1.4],[x,.75,z],m.concrete);box(THREE,root,[4.2,.1,1.2],[x,.96,z],m.warm);}box(THREE,root,[21,1,7],[0,.5,-21],m.black);box(THREE,root,[16,5.8,.25],[0,5.3,-29.4],m.glass,null,false);for(const x of[-22,-16,16,22])cyl(THREE,root,[.5,.68],11,[x,5.5,-6],m.accent,null,16);break;
    }
    case 'vault': {
      const door=new THREE.Mesh(new THREE.CylinderGeometry(7.2,7.2,1,48),m.black);door.rotation.x=Math.PI/2;door.position.set(0,6.7,-29);root.add(door);ring(THREE,root,6,.32,[0,6.7,-28.4],m.accentGlow,[0,0,0]);ring(THREE,root,3.5,.18,[0,6.7,-27.9],m.energy,[0,0,0]);for(const x of[-14,-7,7,14]){box(THREE,root,[4.2,1,4.2],[x,.5,-5],m.black);box(THREE,root,[3.5,3.4,3.5],[x,2.2,-5],m.glass,null,false);box(THREE,root,[2.3,.35,1],[x,2,-5],m.warm);}break;
    }
    case 'arena': {
      cyl(THREE,root,[12.5,13.5],.75,[0,.38,-7],m.black,null,48);ring(THREE,root,11.2,.16,[0,.82,-7],m.energy);ring(THREE,root,7,.11,[0,1.05,-7],m.accentGlow);const tiers=quality==='low'?2:4;for(let t=0;t<tiers;t++){const r=16+t*2.3,n=10+t*3;for(let i=0;i<n;i++){const a=i/n*TAU;box(THREE,root,[2.1,.5+t*.22,1.5],[Math.cos(a)*r,.25+t*.32,-7+Math.sin(a)*r],t%2?m.wall:m.concrete,[0,-a+Math.PI/2,0],false);}}break;
    }
    case 'switch': {
      grid(THREE,root,b,m,3);for(const x of quality==='low'?[-12,0,12]:[-16,-8,0,8,16]){box(THREE,root,[5.2,.6,10],[x,.85,-5],m.black);box(THREE,root,[4.6,.14,8.8],[x,1.22,-5],m.energySoft,null,false);for(let z=-8;z<=-2;z+=3)box(THREE,root,[.45,.8,.45],[x,1.75,z],z%2?m.accentGlow:m.energy);}for(let x=-20;x<=20;x+=4)box(THREE,root,[2.8,2,.3],[x,5.4,-28.9],x%8===0?m.energySoft:m.black,null,false);break;
    }
    case 'growth': {
      const n=quality==='low'?5:9;for(let i=0;i<n;i++){const x=-16+i*(32/Math.max(1,n-1)),h=3.2+i*.8;cyl(THREE,root,[.7,.9],h,[x,h/2,-12],i%3===0?m.accent:m.energySoft,null,18);ring(THREE,root,1+i*.05,.055,[x,h+.3,-12],m.energy);}const chamber=new THREE.Mesh(new THREE.CylinderGeometry(5,5.8,8.5,32,1,true),m.glass);chamber.position.set(0,4.3,2);root.add(chamber);ring(THREE,root,5.1,.12,[0,.4,2],m.accentGlow);break;
    }
    case 'strategy': {
      grid(THREE,root,b,m,2.5);cyl(THREE,root,[5.5,6.4],1.1,[0,.55,-8],m.black,null,8);const holo=new THREE.Mesh(new THREE.CylinderGeometry(4.6,4.6,5,32,1,true),m.glass);holo.position.set(0,3.4,-8);root.add(holo);ring(THREE,root,4.7,.09,[0,5.9,-8],m.energy);for(const x of[-21,-14,-7,7,14,21])box(THREE,root,[5.2,4.6,.24],[x,5.5,-29.3],x%14===0?m.energySoft:m.glass,null,false);break;
    }
    case 'coach': {
      cyl(THREE,root,[6.2,6.8],.5,[0,.25,-8],m.black,null,48);const orb=new THREE.Mesh(new THREE.SphereGeometry(1.9,28,20),m.glass);orb.position.set(0,4,-8);root.add(orb);ring(THREE,root,4.8,.08,[0,7,-8],m.accentGlow);const n=quality==='low'?6:10;for(let i=0;i<n;i++){const a=Math.PI*.18+i/Math.max(1,n-1)*Math.PI*1.64,x=Math.cos(a)*12,z=-8+Math.sin(a)*12;box(THREE,root,[2.5,.55,1.3],[x,.5,z],m.concrete,[0,-a+Math.PI/2,0]);}break;
    }
    case 'culture': {
      box(THREE,root,[23,1.2,10],[0,.6,-20],m.black);box(THREE,root,[20,.12,8],[0,1.28,-20],m.accentGlow);const n=quality==='low'?4:7;for(let t=0;t<n;t++)box(THREE,root,[26+t*.7,.45+t*.15,2.6],[0,.25+t*.14,12-t*4],t%2?m.wall:m.concrete,null,false);for(const x of[-12,-6,0,6,12])cyl(THREE,root,[.08,.08],12,[x,7.5,-27.6],x===0?m.accentGlow:m.energySoft,null,8);break;
    }
    case 'market': {
      for(const x of quality==='low'?[-18,-6,6,18]:[-22,-14,-6,6,14,22]){box(THREE,root,[6,6.2,4],[x,3.1,-17],m.black);box(THREE,root,[5.3,4.7,.18],[x,3.3,-14.9],m.glass,null,false);box(THREE,root,[4.2,.45,2],[x,.65,-13.8],m.accent);const d=new THREE.Mesh(new THREE.SphereGeometry(.65,16,12),x%12===0?m.energy:m.warm);d.position.set(x,1.7,-13.7);root.add(d);}box(THREE,root,[12,.8,7],[0,.4,2],m.black);break;
    }
    case 'forge': {
      for(const x of quality==='low'?[-15,15]:[-18,-9,9,18])for(let z=-18;z<=8;z+=6.2){box(THREE,root,[4,6.8,2.7],[x,3.4,z],m.black);for(let y=1.3;y<=5.8;y+=1.15)box(THREE,root,[3.3,.13,2.78],[x,y,z],Math.round(y*10)%2?m.energySoft:m.accentGlow,null,false);}cyl(THREE,root,[4.2,5.3],7.5,[0,3.75,-12],m.black,null,32);const fire=new THREE.Mesh(new THREE.CylinderGeometry(2.4,3.2,6.2,24,1,true),m.energySoft);fire.position.set(0,4,-12);root.add(fire);ring(THREE,root,4.4,.14,[0,7.3,-12],m.accentGlow);break;
    }
    case 'private': {
      plane(THREE,root,[15,9],[0,.025,-6],mat(THREE,0x3a2d20,{roughness:.9,metalness:0}));box(THREE,root,[8.5,.75,2.4],[0,.55,-4],m.concrete);box(THREE,root,[8.5,2.4,.45],[0,1.8,-5],m.wall);for(const x of[-15,-8,8,15]){box(THREE,root,[4.5,1,4.5],[x,.5,-14],m.black);const t=new THREE.Mesh(new THREE.OctahedronGeometry(.78),x<0?m.accentGlow:m.energy);t.position.set(x,2.1,-14);root.add(t);}box(THREE,root,[18,6.8,.2],[0,4.6,-24.6],m.glass,null,false);break;
    }
    case 'war': {
      grid(THREE,root,b,m,4);cyl(THREE,root,[7.8,8.5],1,[0,.5,-8],m.black,null,10);const map=new THREE.Mesh(new THREE.CircleGeometry(5.5,48),m.glass);map.rotation.x=-Math.PI/2;map.position.set(0,1.05,-8);root.add(map);for(const x of quality==='low'?[-18,-6,6,18]:[-21,-14,-7,0,7,14,21])box(THREE,root,[5.5,4.3,.22],[x,5.7,-29.1],x%14===0?m.energySoft:m.glass,null,false);break;
    }
  }
}

function fallbackOperator(THREE) { const g=new THREE.Group();g.name='WisdoOperator';const body=new THREE.Mesh(new THREE.CapsuleGeometry(.42,.9,8,12),mat(THREE,0x11161c,{roughness:.5,metalness:.35}));body.position.y=1.05;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.28,18,14),mat(THREE,0x5b4638,{roughness:.72,metalness:0}));head.position.y=1.88;g.add(head);return g; }
function station(THREE, id, x, z, m) { const g=new THREE.Group();g.position.set(x,0,z);const b=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.45,.38,20),m.black);b.position.y=.2;const c=new THREE.Mesh(new THREE.CylinderGeometry(.48,.72,1.55,16),m.energy);c.position.y=1.05;const h=new THREE.Mesh(new THREE.TorusGeometry(.83,.05,8,28),m.accentGlow);h.rotation.x=Math.PI/2;h.position.y=1.84;g.add(b,c,h);return g; }
function dispose(root) { root?.traverse?.(o=>{o.geometry?.dispose?.();const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms){if(!m)continue;for(const v of Object.values(m))if(v?.isTexture)v.dispose?.();m.dispose?.();}}); }

export async function createWorldInterior({ mount, sceneId, preferences={}, onNearestChange=()=>{}, onInteract=()=>{}, onTelemetry=()=>{}, onReady=()=>{} }={}) {
  const b=BLUEPRINTS[sceneId];if(!b)throw new Error(`Unknown WISDO World interior: ${sceneId}`);
  loading(`Unlocking ${b.title}`,48);const THREE=await import(THREE_MODULE_URL);const id=globalThis.crypto?.randomUUID?.()||`interior-${Date.now()}-${Math.random().toString(36).slice(2)}`;globalThis.WisdoWorldRenderInstance=id;const current=()=>globalThis.WisdoWorldRenderInstance===id;
  const quality=preferences.quality==='auto'||!preferences.quality?chooseAutoQuality():preferences.quality,preset=QUALITY_PRESETS[quality]||QUALITY_PRESETS.medium;
  loading(`Building ${b.title} interior`,61);const renderer=new THREE.WebGLRenderer({antialias:preset.antialias,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,preset.dpr));renderer.setSize(mount.clientWidth||innerWidth,mount.clientHeight||innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=Boolean(preset.shadows);renderer.shadowMap.type=THREE.PCFSoftShadowMap;mount.replaceChildren(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(b.theme[0]);scene.fog=new THREE.Fog(b.theme[1],34,105);const camera=new THREE.PerspectiveCamera(66,(mount.clientWidth||innerWidth)/(mount.clientHeight||innerHeight),.1,190);scene.add(new THREE.HemisphereLight(b.theme[5],b.theme[0],1));const key=new THREE.DirectionalLight(b.theme[6],1.9);key.position.set(-12,22,16);key.castShadow=Boolean(preset.shadows);scene.add(key);const fill=new THREE.PointLight(b.theme[5],22,55,2);fill.position.set(0,8,-8);scene.add(fill);
  const root=new THREE.Group();root.name=`WISDOInteriorV2:${sceneId}`;scene.add(root);const m=materials(THREE,b);shell(THREE,root,b,m);signature(THREE,root,b,m,quality);
  loading(`Activating ${b.title} systems`,76);const hero=label(THREE,b.title,b.subtitle);hero.position.set(0,Math.min(b.ceiling-2.4,9.2),b.bounds[2]+.55);root.add(hero);const stations=[];for(const [sid,name,x,z] of b.stations){const s=station(THREE,sid,x,z,m);s.userData.entity={kind:'world-interior-station',station:sid,id:`${sceneId}:${sid}`,name,sceneId,unlocked:true};root.add(s);stations.push(s);const sign=label(THREE,name,'[E] INTERACT');sign.scale.set(.42,.42,.42);sign.position.set(x,3.05,z);sign.lookAt(b.spawn[0],2,b.spawn[1]);root.add(sign);}
  const operator=fallbackOperator(THREE);operator.position.set(b.spawn[0],0,b.spawn[1]);scene.add(operator);const input=new InputManager({canvas:renderer.domElement,sensitivity:Number(preferences.sensitivity||1)*.0022,invertY:Boolean(preferences.invertY)});input.bindTouch({joystick:document.getElementById('moveStick'),knob:document.getElementById('moveKnob'),lookZone:document.getElementById('lookZone'),jumpButton:document.getElementById('jumpBtn'),sprintButton:document.getElementById('sprintBtn'),interactButton:document.getElementById('interactBtn')});
  loading(`Materializing Operator inside ${b.title}`,89);let authored=null,destroyed=false;installAuthoredOperator({THREE,scene,debug:new URLSearchParams(location.search).get('debug')==='1',instanceId:id}).then(v=>{if(!destroyed&&current())authored=v;else v?.destroy?.();}).catch(e=>{if(!destroyed&&current())console.warn('Interior authored Operator fallback',e);});
  let yaw=0,pitch=.18,velocity=new THREE.Vector3(),last=performance.now(),frames=0,fpsAt=last,nearest=null,frameId=0;const forward=new THREE.Vector3(),right=new THREE.Vector3(),desired=new THREE.Vector3(),target=new THREE.Vector3();const [minX,maxX,minZ,maxZ]=b.bounds;
  function resize(){if(!current())return;const w=mount.clientWidth||innerWidth,h=mount.clientHeight||innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}window.addEventListener('resize',resize);
  function loop(now){if(destroyed||!current())return;frameId=requestAnimationFrame(loop);const dt=Math.min(.05,Math.max(.001,(now-last)/1000));last=now;const i=input.frame();yaw-=i.lookX;pitch=Math.max(-.25,Math.min(.95,pitch-i.lookY));forward.set(-Math.sin(yaw),0,-Math.cos(yaw));right.set(Math.cos(yaw),0,-Math.sin(yaw));desired.copy(forward).multiplyScalar(i.moveY).addScaledVector(right,i.moveX);if(desired.lengthSq()>1)desired.normalize();desired.multiplyScalar(i.sprint?6.8:3.45);velocity.lerp(desired,1-Math.exp(-12*dt));operator.position.addScaledVector(velocity,dt);operator.position.x=Math.max(minX+1.2,Math.min(maxX-1.2,operator.position.x));operator.position.z=Math.max(minZ+1.2,Math.min(maxZ-1.2,operator.position.z));if(velocity.lengthSq()>.04)operator.rotation.y=Math.atan2(velocity.x,velocity.z);target.copy(operator.position).add(new THREE.Vector3(0,1.45,0));camera.position.set(target.x+Math.sin(yaw)*4.7,target.y+1.1+Math.sin(pitch)*2,target.z+Math.cos(yaw)*4.7);camera.lookAt(target);let best=null,bestD=4.2;for(const s of stations){const d=s.position.distanceTo(operator.position);if(d<bestD){bestD=d;best=s.userData.entity;}}if(best?.id!==nearest?.id){nearest=best;onNearestChange(best);}if(i.interactPressed&&nearest)onInteract(nearest);renderer.render(scene,camera);frames++;if(now-fpsAt>1000){onTelemetry({fps:Math.round(frames*1000/(now-fpsAt)),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,quality,interior:sceneId,player:{x:operator.position.x.toFixed(1),y:'0.0',z:operator.position.z.toFixed(1)}});frames=0;fpsAt=now;}}
  frameId=requestAnimationFrame(loop);globalThis.WisdoInteriorDiagnostics=Object.freeze({sceneId,title:b.title,signature:b.signature,quality,stationCount:stations.length,instanceId:id,uniqueInterior:true,build:'DISTINCT-INTERIORS-V2',loadedAt:new Date().toISOString()});window.dispatchEvent(new CustomEvent('wisdo:world-interior-ready',{detail:globalThis.WisdoInteriorDiagnostics}));onReady();
  return {mode:'world-interior-v2',sceneId,releasePointer:()=>input.releasePointer(),setPreferences:p=>input.setPreferences(p),updateSnapshot:()=>{},destroy(){destroyed=true;cancelAnimationFrame(frameId);input.destroy();authored?.destroy?.();window.removeEventListener('resize',resize);dispose(root);renderer.dispose();mount.replaceChildren();onNearestChange(null);if(current())delete globalThis.WisdoWorldRenderInstance;}};
}
