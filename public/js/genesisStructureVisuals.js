/**
 * Genesis modular construction meshes.
 * Geometry is client-only: the server owns blueprint, cost, collision and save.
 * Reuses globally shared material instances (photo-bark, stone, metal, glass).
 */
export function drawGenesisStructure(scene,root,s,mats,{mobile=false}={}){
 if(!scene||!root||!s)return false;
 const B=globalThis.BABYLON;
 if(!B)return false;
 const mat=(name)=>mats[name]||(name==='metal'?mats.iron:null)||mats.wood;
 const box=(name,x,y,z,w,h,d,m='wood',rotation={})=>{
  const obj=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);
  obj.parent=root;obj.position.set(x,y,z);
  obj.rotation.set(rotation.x||0,rotation.y||0,rotation.z||0);
  obj.material=mat(m);obj.isPickable=false;
  return obj;
 };
 const glow=(name,x,y,z,size=.5)=>{
  const mesh=B.MeshBuilder.CreateSphere(name,{diameter:size,segments:mobile?8:12},scene);
  mesh.parent=root;mesh.position.set(x,y,z);mesh.material=mat('crystal');
  mesh.isPickable=false;return mesh;
 };
 const post=(x,z,h=2.6)=>box('carved-post',x,h/2,z,.23,h,.23,'wood');
 const rail=(z,h=1.25,length=3)=>box('handrail',0,h,z,length,.14,.15,'wood');
 const rock=(x,y,z,w=1,h=.5,d=1)=>box('stone-course',x,y,z,w,h,d,'rock');
 const plank=(x,z,y=.3,w=.37,d=3)=>box('timber-deck',x,y,z,w,.18,d,'wood');
 const k=s.kind;
 if(k==='hut'){
   rock(0,.19,0,4.6,.38,4.6);
   box('wooden-floor',0,.43,0,4.25,.23,4.25,'wood');
   for(const x of [-1.9,1.9])for(const z of [-1.9,1.9])post(x,z,3.1);
   for(const x of [-1.85,1.85]){
     box('cabin-side',x,1.7,0,.16,2.6,3.65,'wood');
     box('window-frame',x+(x<0?-.1:.1),1.85,.4,.12,.85,1.05,'metal');
     box('window-pane',x+(x<0?-.18:.18),1.85,.4,.05,.60,.76,'glass');
   }
   box('cabin-back',0,1.7,-1.88,3.8,2.6,.16,'wood');
   for(const x of [-1.45,1.45])box('front-wall',x,1.72,1.87,.91,2.65,.16,'wood');
   box('entry-crossbeam',0,2.87,1.87,2.05,.23,.22,'wood');
   box('cabin-door',0,1.35,1.94,1.05,1.90,.13,'dark');
   glow('door-knob',.40,1.29,2.06,.16);
   for(const sign of [-1,1])
     box('pitched-shingle-roof',sign*.98,3.58,0,2.38,.22,5.2,'roof',
       {z:sign*.49});
   box('ridge',0,4.16,0,.28,.16,5.1,'wood');
   for(let i=0;i<3;i++)rock(-.7+i*.7,.15,2.65,1.0,.2,.55);
   box('stone-chimney',1.35,4.02,-.9,.65,2.1,.72,'rock');
   return true;
 }
 if(k==='workbench'){
   for(const x of [-1,1])for(const z of [-.53,.53])box('turned-bench-leg',x,.57,z,.17,1.15,.17,'wood');
   box('worktop',0,1.19,0,2.45,.25,1.45,'wood');
   for(let i=0;i<7;i++)box('worktop-plank',-1.04+i*.34,1.34,0,.29,.07,1.38,'wood');
   box('tool-backboard',0,1.78,-.68,2.0,.93,.18,'wood');
   for(let x=-.75;x<=.8;x+=.45)box('tool-hook',x,1.78,-.57,.08,.32,.13,'metal');
   return true;
 }
 if(k==='floor'||k==='stone_foundation'){
   for(let i=0;i<9;i++){
     const x=(i%3-1)*1,z=(Math.floor(i/3)-1)*1;
     box('modular-floor',x,k==='floor'?.19:.22,z,.97,k==='floor'?.26:.36,.97,
       k==='floor'?'wood':'rock');
   }
   return true;
 }
 if(k==='wall'||k==='fence'||k==='gate'){
   for(const x of [-1.42,1.42])post(x,0,k==='wall'?3:2.6);
   for(const y of [0.62,1.92])box('horizontal-beam',0,y,0,3.15,.16,.24,'wood');
   if(k==='gate'){
     for(let i=0;i<7;i++)box('gate-plank',(i-3)*.42,1.21,.12,.35,2.22,.19,
       'wood');
     box('gate-brace',0,1.22,.26,3.0,.14,.2,'metal',{z:.53});
     glow('hinge-lock',1.31,1.36,.29,.22);
   }else if(k==='wall'){
     for(let i=0;i<9;i++)box('vertical-wall-plank',(i-4)*.36,1.42,.05,.32,2.6,.16,'wood');
   }else{
     for(let i=0;i<8;i++)box('fence-picket',(i-3.5)*.38,1.30,.08,.31,2.2,.18,'wood');
   }
   return true;
 }
 if(k==='storage_chest'){
   for(const x of [-.78,.78])for(const z of [-.4,.4])box('chest-foot',x,.18,z,.16,.32,.16,'rock');
   box('wood-chest',0,.57,0,2,.87,1.12,'wood');
   box('hinged-lid',0,1.10,-.08,2.16,.28,1.28,'wood',{x:-.16});
   for(const x of [-.66,.66])box('iron-binding',x,.69,0,.15,1.05,1.23,'metal');
   box('lock-plate',0,.68,.60,.34,.37,.08,'metal');glow('lock-gem',0,.70,.66,.17);
   return true;
 }
 if(k==='kiln'){
   rock(0,.30,0,3.45,.55,3.45);
   for(let y=0;y<4;y++)for(let i=0;i<4;i++){
     const x=(i-1.5)*.77;
     box('kiln-brick',x,.61+y*.55,-1.17, .76,.52,.7,'rock');
     if(i===0||i===3||y>=2)
       box('kiln-front-brick',x,.61+y*.55,1.18,.76,.52,.66,'rock');
   }
   for(let y=0;y<3;y++)for(const x of [-1.18,1.18])
     box('kiln-side-brick',x,.60+y*.65,0,.69,.60,2,'rock');
   box('furnace-interior',0,.60,.84,1.65,.70,.14,'dark');
   glow('kiln-embers',0,.73,1.06,1.15);
   box('chimney',-.74,3.22,-.72,.78,2,.86,'rock');
   return true;
 }
 if(k==='ramp'||k==='bridge'){
   const bridge=k==='bridge';
   const span=bridge?6:3;
   for(let i=0;i<(bridge?14:8);i++)
     box('deck-board',0,bridge?.68:(.23+i*.13),-span/2+(i+.5)*span/(bridge?14:8),
       2.92,.17,span/(bridge?14:8)-.03,'wood',{x:bridge?0:-.25});
   for(const side of [-1,1]){
     for(const z of [-span/2+.25,span/2-.25])
       post(side*1.38,z,bridge?1.65:1.28);
     box('bridge-rail',side*1.4,bridge?1.47:1.08,0,.12,.12,span,'wood');
   }
   return true;
 }
 if(k==='lantern'){
   rock(0,.22,0,1,.44,1);
   box('lamp-post',0,1.48,0,.22,2.45,.22,'wood');
   box('lamp-frame',0,2.70,0,.95,.17,.95,'metal');
   for(const x of [-.34,.34])for(const z of [-.34,.34])
     box('glass-cage',x,3.00,z,.09,.56,.09,'metal');
   glow('contained-crystal',0,3.03,0,.60);
   box('canopy',0,3.37,0,1.18,.17,1.18,'metal');
   return true;
 }
 if(k==='creature_habitat'){
   rock(0,.12,0,6.35,.23,6.2);
   for(const side of [-1,1])for(let i=0;i<4;i++){
     const z=-2.5+i*1.55;
     post(side*2.9,z,1.7);
   }
   for(const side of [-1,1])for(const y of [.65,1.23])
     box('habitat-fence',side*2.9,y,0,.13,.16,5.8,'wood');
   for(const z of [-2.75,2.75])for(const x of [-1.9,-.6,.6,1.9])
     post(x,z,1.4);
   for(const z of [-2.75,2.75])for(const y of [.7,1.15])
     box('habitat-crossrail',0,y,z,5.7,.13,.13,'wood');
   for(const x of [-1.8,1.8])post(x,-1.8,3.4);
   box('resting-platform',0,.52,-1.65,4.5,.35,2.6,'wood');
   for(const side of [-1,1])box('wooden-lean-to',side*1.35,3.28,-1.7,
     2.8,.17,3.25,'roof',{z:side*.52});
   box('water-trough',0,.68,1.7,2.3,.5,.8,'rock');
   glow('sanctuary-core',0,2.02,-1.4,.74);
   return true;
 }
 if(k==='greenhouse'){
   rock(0,.19,0,5.2,.35,4.5);
   for(const x of [-2.2,2.2])for(const z of [-1.9,1.9])post(x,z,3.55);
   for(const z of [-1.9,1.9])for(const y of [.45,2.9])
     box('glass-greenhouse-brace',0,y,z,4.5,.14,.17,'wood');
   for(const x of [-2.2,2.2])box('translucent-glass-wall',x,1.72,0,.06,2.55,3.62,'glass');
   box('glass-rear',0,1.72,-1.87,4.5,2.55,.06,'glass');
   for(const side of [-1,1])
     box('glass-roof',side*1.15,3.56,0,2.7,.12,4.30,'glass',{z:side*.49});
   for(const x of [-1.5,0,1.5])for(let z=-1;z<1.2;z+=1.1)
     glow('seedling-resonance',x,.55,z,.45);
   return true;
 }
 if(k==='staircase'){
   for(let step=0;step<7;step++){
     const z=-1.34+step*.44;
     box('stair-tread',0,.22+step*.245,z,3,.18,.48,'wood');
     for(const edge of [-1,1])box('step-end-trim',edge*1.43,.23+step*.245,z,.12,.26,.47,'wood');
   }
   for(const side of [-1,1]){
     box('stair-stringer',side*1.37,1.06,0,.14,.20,3.58,'wood',{x:-.50});
     for(const z of [-1.18,1.18])post(side*1.35,z,2);
   }
   return true;
 }
 if(k==='roof_panel'||k==='stone_roof'){
   const stone=k==='stone_roof';
   for(let i=0;i<6;i++){
     const z=(i-2.5)*.51;
     box('angled-roof-panel',0,.55,z,3.15,.16,.49,stone?'rock':'roof',{z:.35});
   }
   for(const x of [-1.40,1.40])
     box('roof-edge-trim',x,.57,0,.16,.14,3.35,stone?'rock':'wood',{z:.35});
   return true;
 }
 if(k==='door_frame'){
   for(const x of [-1.25,1.25])post(x,0,2.8);
   box('lintel',0,2.72,0,2.84,.28,.29,'wood');
   box('threshold',0,.16,0,2.6,.18,.58,'rock');
   box('hinged-door',-.08,1.27,.10,2.1,2.30,.15,'wood');
   for(const y of [.62,1.66])box('door-cross-brace',0,y,.21,1.93,.13,.12,'metal');
   glow('door-handle',.82,1.24,.25,.16);
   return true;
 }
 if(k==='stone_wall'){
   rock(0,.14,0,3.1,.30,.72);
   for(let course=0;course<6;course++){
     for(let blockIndex=0;blockIndex<4;blockIndex++){
       const offset=course%2?-.13:.13;
       const x=(blockIndex-1.5)*.78+offset;
       rock(x,.40+course*.39,0,.73,.37,.66);
     }
   }
   for(const x of [-1.35,1.35])rock(x,1.35,0,.29,2.7,.88);
   return true;
 }
 if(k==='campfire'){
   for(let i=0;i<9;i++){
     const a=i*Math.PI*2/9;
     rock(Math.cos(a)*.75,.22,Math.sin(a)*.75,.45,.4,.5);
   }
   for(const a of [0,Math.PI/2])
     box('split-log',0,.49,0,1.6,.24,.3,'wood',{y:a});
   glow('living-flame',0,.82,0,.7);
   return true;
 }
 return false;
}
