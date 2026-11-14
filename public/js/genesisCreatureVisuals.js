/**
 * Genesis hybrid creature art. Each hybrid receives a distinct layered
 * silhouette: organic limbs, segmented tails, crests, horns, energy organs,
 * fins or membrane wings rather than a floating primitive orb.
 * LOD is handled by caller: only nearby Echoforms are instantiated.
 */
export function buildGenesisHybrid(scene,parent,echo,{companion=false,mobile=false}={}){
 const B=globalThis.BABYLON;
 if(!B||!scene||!parent||!echo?.silhouette)return null;
 const creatureRoot=new B.TransformNode('hybrid:'+echo.id+(companion?':prism':''),scene);
 creatureRoot.parent=parent;
 creatureRoot.scaling.setAll(companion?.75:1);
 const color=B.Color3.FromHexString(echo.color||'#65e3cc');
 const coat=new B.PBRMaterial('coat-'+echo.id+(companion?'-dna':''),scene);
 coat.albedoColor=color.scale(.52);
 coat.roughness=.68;
 coat.metallic=echo.biome==='neon'||echo.biome==='crystal'?.38:.10;
 const shell=new B.PBRMaterial('carapace-'+echo.id+(companion?'-dna':''),scene);
 shell.albedoColor=color.scale(.3);
 shell.metallic=.44;shell.roughness=.43;
 const accent=new B.PBRMaterial('resonance-'+echo.id+(companion?'-dna':''),scene);
 accent.albedoColor=color.scale(.7);
 accent.emissiveColor=color.scale(.46);
 accent.metallic=.32;accent.roughness=.28;
 const dark=new B.PBRMaterial('dark-'+echo.id+(companion?'-dna':''),scene);
 dark.albedoColor=new B.Color3(.045,.085,.125);
 dark.roughness=.76;
 const all=[coat,shell,accent,dark];
 function ball(name,at,scale,mat=coat,segments=mobile?10:14){
  const m=B.MeshBuilder.CreateSphere(name,{diameter:1,segments},scene);
  m.parent=creatureRoot;m.position.set(...at);m.scaling.set(...scale);
  m.material=mat;m.isPickable=false;return m;
 }
 function joint(name,from,to,width,mat=coat){
  const a=new B.Vector3(...from),b=new B.Vector3(...to);
  const axis=b.subtract(a),length=axis.length();
  const mesh=B.MeshBuilder.CreateCylinder(name,{
   height:length,diameterTop:width*.72,diameterBottom:width,tessellation:mobile?7:10
  },scene);
  mesh.parent=creatureRoot;mesh.position=a.add(b).scale(.5);
  mesh.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef
    ?null:B.Quaternion.Identity();
  // Align the default +Y cylinder axis to the limb vector.
  mesh.rotationQuaternion=B.Quaternion.RotationAxis(B.Vector3.Cross(B.Axis.Y,axis.normalize()),
    Math.acos(Math.min(1,Math.max(-1,B.Vector3.Dot(B.Axis.Y,axis.normalize())))));
  mesh.material=mat;mesh.isPickable=false;return mesh;
 }
 function horn(name,x,y,z,dx,dy,dz,size=.29,mat=shell){
  const cone=B.MeshBuilder.CreateCylinder(name,{height:1,diameterTop:0,
   diameterBottom:1,tessellation:mobile?6:9},scene);
  cone.parent=creatureRoot;
  cone.position.set(x+dx*.45,y+dy*.45,z+dz*.45);
  cone.scaling.set(size,Math.hypot(dx,dy,dz),size);
  const direction=new B.Vector3(dx,dy,dz).normalize();
  const axis=B.Vector3.Cross(B.Axis.Y,direction);
  const angle=Math.acos(Math.min(1,Math.max(-1,B.Vector3.Dot(B.Axis.Y,direction))));
  if(axis.lengthSquared()>1e-8)cone.rotationQuaternion=B.Quaternion.RotationAxis(axis.normalize(),angle);
  cone.material=mat;cone.isPickable=false;return cone;
 }
 function membrane(name,side,mat=coat){
  const s=side;
  const pathA=[[s*.37,1.98,-.22],[s*.95,2.46,-.6],[s*2.0,2.72,-.86],[s*2.85,2.35,-.53]];
  const pathB=[[s*.38,1.65,.17],[s*.91,1.85,.12],[s*1.76,1.85,.16],[s*2.24,1.9,.28]];
  const pathArray=[pathA,pathB].map(path=>path.map(p=>new B.Vector3(...p)));
  const wing=B.MeshBuilder.CreateRibbon(name,{pathArray,sideOrientation:B.Mesh.DOUBLESIDE},scene);
  wing.parent=creatureRoot;wing.material=mat;wing.isPickable=false;return wing;
 }
 const style=echo.silhouette;
 const serpent=style==='serpent';
 const winged=style==='winged';
 const armored=style==='armored';
 const tall=style==='raptor';
 const heavy=style==='horned'||armored;
 const bodyY=serpent?1.38:1.31;
 ball('layered-torso',[0,bodyY,0],[heavy?1.8:1.5,heavy?1.35:1.05,serpent?3.45:2.5],coat);
 ball('rib-cage',[0,bodyY+.26,.30],[1.20,.88,1.15],shell);
 ball('neck',[0,1.67,1.02],[.82,.96,.84],coat);
 ball('expressive-head',[0,2.13,1.39],[1.05,.82,.97],coat);
 ball('snout',[0,1.91,1.92],[.76,.43,.75],dark);
 ball('nose',[0,1.91,2.30],[.40,.20,.20],shell);
 for(const side of [-1,1]){
  ball('eye-socket',[side*.37,2.23,1.82],[.34,.32,.22],dark);
  ball('eye-lumina',[side*.39,2.23,1.96],[.17,.17,.12],accent);
  if(!serpent){
   for(const f of [-.78,.81]){
    const z=f<0?-.65:.9,root=[side*.53,1.10,z];
    const elbow=[side*(.67+(heavy?.12:0)),.60,z+(f<0?-.16:.12)];
    const foot=[side*(.75+(heavy?.12:0)),.13,z+(f<0?-.24:.24)];
    joint('articulated-leg',root,elbow,.27,coat);
    joint('lower-leg',elbow,foot,.20,shell);
    ball('padded-paw',foot,[.40,.24,.52],shell);
    for(const offset of [-.13,.13])
     horn('talon',foot[0]+offset,foot[1]+.01,foot[2]+.33,0,-.08,.28,.09,accent);
   }
  }else{
   for(let f=0;f<3;f++){
    horn('serpent-fin',side*(.55+f*.09),1.43,-.50-f*.63,
      side*.56,.54,-.20,.22,accent);
   }
  }
 }
 // Long segmented tail with an illuminated tip.
 for(let i=0;i<5;i++){
  const z=-1.1-i*.48,y=1.35+Math.sin(i*.7)*.18;
  ball('tail-segment',[0,y,z],[.52-i*.055,.5-i*.055,.87],i%2?coat:shell,10);
 }
 ball('tail-focus',[0,1.36,-3.68],[.42,.42,.52],accent,10);
 // Layered dorsal plates create a strong creature silhouette from behind.
 for(let i=0;i<6;i++){
  const z=.79-i*.36;
  horn('dorsal-crest',0,1.84,z,0,.55+(i%2)*.26,-.10,.24,armored?accent:shell);
 }
 if(winged||style==='feline'){
  if(winged){
   membrane('wing-left',-1,shell);membrane('wing-right',1,shell);
   for(const side of [-1,1])for(let i=0;i<3;i++)
    horn('wing-feather',side*(1.0+i*.37),2.05,-.40-i*.12,side*.34,.42,.2,.11,accent);
  }else{
   for(const side of [-1,1])horn('luminous-ear',side*.45,2.47,1.22,
     side*.20,.85,-.08,.23,coat);
  }
 }
 if(style==='horned'||armored){
  for(const side of [-1,1]){
   horn('crown-antler',side*.47,2.48,1.10,side*.34,1.27,-.34,.30,armored?shell:accent);
   horn('crown-branch',side*.67,3.1,.96,side*.44,.40,.09,.13,shell);
  }
 }
 if(tall){
  for(const side of [-1,1]){
   membrane('feather-arm',side,coat);
   horn('raptor-beak',side*.16,2.03,2.15,0,-.13,.47,.15,accent);
  }
 }
 // Resonance energy organ changes hue and intensity with the equipped DNA.
 ball('resonance-heart',[0,1.62,1.09],[.46,.51,.25],accent);
 for(let i=0;i<(mobile?3:6);i++){
  const a=i*Math.PI*2/(mobile?3:6);
  ball('bioluminescent-node',[Math.cos(a)*.79,1.54+Math.sin(i)*.15,Math.sin(a)*.7],
   [.12,.13,.12],accent,6);
 }
 return {
  root:creatureRoot,
  dispose:()=>{creatureRoot.dispose(false,false);all.forEach(m=>m.dispose());}
 };
}
