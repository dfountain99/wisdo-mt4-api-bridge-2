/**
 * WISDO Genesis v2 streamed landscape renderer.
 * Only a local neighborhood of meshes exists at once: no 3.2km ground draw
 * and no attempt to build every tree in the region. Terrain and scenery are
 * deterministic, so revisiting an area produces the same view.
 */
import {
 CHUNK_SIZE,WORLD_LIMIT,BIOMES,WAYSTONES,LANDMARKS,
 terrainHeight,biomeColor,biomeAt,worldChunk,chunkKey,valueNoise,
} from './genesisWorldMap.js';

function tone(hex){return BABYLON.Color3.FromHexString(hex);}
function rng(cx,cz,i,seed=0){
 const n=Math.sin(cx*127.1+cz*311.7+i*79.7+seed*17.3)*43758.5453123;
 return n-Math.floor(n);
}
/** Resolve fixed world locations without shadowing the coordinate arguments. */
export function resolveGenesisLandmark(x,z){
 const waystone=WAYSTONES.find(point=>Math.abs(point.x-x)<1&&Math.abs(point.z-z)<1);
 const entry=waystone||LANDMARKS.find(point=>Math.abs(point.x-x)<1&&Math.abs(point.z-z)<1);
 return entry?{entry,waystone:Boolean(waystone)}:null;
}

/**
 * Babylon.js computes facet normals from (p1 - p2) × (p3 - p2).
 * Triangles must wind so their normals face the sky (+Y), otherwise
 * HemisphericLight shades the entire ground with its dark underside color.
 */
export function genesisTerrainTriangleIndices(subdivisions){
 const indices=[];
 for(let z=0;z<subdivisions;z++)for(let x=0;x<subdivisions;x++){
   const a=z*(subdivisions+1)+x,c=a+subdivisions+1;
   indices.push(a,a+1,c,c,a+1,c+1);
 }
 return indices;
}

/** Per-vertex layered color; stays deterministic at shared chunk edges. */
export function genesisTerrainSurfaceColor(x,z){
 const base=biomeColor(x,z);
 const detail=valueNoise(x/14,z/14,137);
 const broad=valueNoise(x/52,z/52,41);
 const shade=.84+detail*.24+broad*.12;
 return base.map((channel,i)=>i===3?channel:
   Math.max(.025,Math.min(1,channel*shade+(i===1?.014:0))));
}

export function createGenesisTerrain(scene,{mobile=false}={}){
 if(!scene||!globalThis.BABYLON)throw Error('Babylon scene required for Genesis terrain.');
 const active=new Map(), special=new Map(),materialCache=new Map();
 let artLibrary=null;
 const radius=2, subdivisions=mobile?12:20;
 const terrainMat=new BABYLON.StandardMaterial('genesis-terrain-vertex-colors',scene);
 terrainMat.diffuseColor=new BABYLON.Color3(1,1,1);
 terrainMat.specularColor=new BABYLON.Color3(.035,.06,.06);
 terrainMat.backFaceCulling=false;
 // An actual surface texture provides fine detail between biome-colored vertices.
 // UVs are world-space, so moving across an 80m chunk boundary never shifts the pattern.
 const groundTex=new BABYLON.DynamicTexture('genesis-ground-grain',{width:128,height:128},scene,false);
 const ctx=groundTex.getContext(),tile=ctx.createImageData(128,128);
 let noise=1799;
 for(let i=0;i<128*128;i++){
   noise=(Math.imul(noise,1664525)+1013904223)|0;
   const grain=((noise>>>17)&31)-15;
   const spot=((noise>>>25)&7)===0?-17:0;
   const shade=Math.max(178,Math.min(255,230+grain+spot));
   tile.data[i*4]=shade+2;
   tile.data[i*4+1]=shade;
   tile.data[i*4+2]=shade-6;
   tile.data[i*4+3]=255;
 }
 ctx.putImageData(tile,0,0);groundTex.update();
 groundTex.wrapU=BABYLON.Texture.WRAP_ADDRESSMODE;
 groundTex.wrapV=BABYLON.Texture.WRAP_ADDRESSMODE;
 terrainMat.diffuseTexture=groundTex;
 function mat(name,hex,{glow=0,alpha=1}={}){
   const key=name+hex+glow+alpha;
   if(materialCache.has(key))return materialCache.get(key);
   const out=new BABYLON.StandardMaterial(name,scene);
   out.diffuseColor=tone(hex);out.specularColor=new BABYLON.Color3(.05,.08,.09);
   if(glow)out.emissiveColor=tone(hex).scale(glow);
   if(alpha<1){out.alpha=alpha;out.backFaceCulling=false;}
   materialCache.set(key,out);return out;
 }
 const wood=mat('forest-bark','#665343');
 const stone=mat('architect-stone','#71828b');
 const snow=mat('aether-stone','#9eabd9',{glow:.09});
 const metal=mat('neon-metal','#3c627b');
 const lava=mat('titan-molten','#f77b43',{glow:.5});
 const water=mat('marsh-water','#267d87',{glow:.1,alpha:.75});
 const glass=mat('neon-glass','#6be9f6',{glow:.55});
 const flowers=mat('glow-flora','#62f6b6',{glow:.38});
 function leafMaterial(biome){
   return mat('foliage-'+biome.id,biome.leaf,{glow:biome.id==='neon'||biome.id==='crystal'?.15:0});
 }
 function addBox(root,name,x,y,z,sx,sy,sz,material,rotation=0){
   const m=BABYLON.MeshBuilder.CreateBox(name,{width:sx,height:sy,depth:sz},scene);
   m.parent=root;m.position.set(x,y,z);m.rotation.y=rotation;m.material=material;m.isPickable=false;return m;
 }
 function addCylinder(root,name,x,y,z,height,diameter,material,{topDiameter=diameter,segments=7}={}){
   const m=BABYLON.MeshBuilder.CreateCylinder(name,{height,diameterBottom:diameter,diameterTop:topDiameter,tessellation:segments},scene);
   m.parent=root;m.position.set(x,y,z);m.material=material;m.isPickable=false;return m;
 }
 function addOrb(root,name,x,y,z,sx,sy,sz,material){
   const mesh=BABYLON.MeshBuilder.CreateSphere(name,{diameter:1,segments:8},scene);
   mesh.parent=root;mesh.position.set(x,y,z);mesh.scaling.set(sx,sy,sz);mesh.material=material;mesh.isPickable=false;return mesh;
 }
 function makeRoot(name,x,z){
   const node=new BABYLON.TransformNode(name,scene);
   node.position.set(x,terrainHeight(x,z),z);return node;
 }
 function matrix(x,y,z,sx,sy,sz,rotation=0){
   return BABYLON.Matrix.Compose(new BABYLON.Vector3(sx,sy,sz),
     BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,rotation),
     new BABYLON.Vector3(x,y,z)).m;
 }
 function addThin(mesh,matrices){
   if(!matrices.length){mesh.dispose();return;}
   const list=new Float32Array(matrices.length*16);
   for(let i=0;i<matrices.length;i++)list.set(matrices[i],i*16);
   mesh.thinInstanceSetBuffer('matrix',list,16,true);
   mesh.isPickable=false;
   mesh.alwaysSelectAsActiveMesh=true;
   mesh.freezeWorldMatrix();
 }
 function createChunk(cx,cz){
   const key=chunkKey(cx,cz),root=new BABYLON.TransformNode('chunk-'+key,scene);
   const mesh=new BABYLON.Mesh('land-'+key,scene);
   mesh.parent=root;
   const p=[],indices=[],normals=[],colors=[],uvs=[];
   const centerX=(cx+.5)*CHUNK_SIZE,centerZ=(cz+.5)*CHUNK_SIZE;
   for(let zi=0;zi<=subdivisions;zi++)for(let xi=0;xi<=subdivisions;xi++){
     const worldX=cx*CHUNK_SIZE+xi/subdivisions*CHUNK_SIZE;
     const worldZ=cz*CHUNK_SIZE+zi/subdivisions*CHUNK_SIZE;
     p.push(worldX-centerX,terrainHeight(worldX,worldZ),worldZ-centerZ);
     colors.push(...genesisTerrainSurfaceColor(worldX,worldZ));
     uvs.push(worldX/9,worldZ/9);
   }
   // The original index order pointed normals downward, turning the terrain black.
   indices.push(...genesisTerrainTriangleIndices(subdivisions));
   BABYLON.VertexData.ComputeNormals(p,indices,normals);
   const vd=new BABYLON.VertexData();
   vd.positions=p;vd.indices=indices;vd.normals=normals;vd.colors=colors;vd.uvs=uvs;vd.applyToMesh(mesh);
   mesh.position.set(centerX,0,centerZ);
   mesh.material=terrainMat;mesh.isPickable=false;
   mesh.freezeWorldMatrix();
   const biome=biomeAt(centerX,centerZ);
   // GPU thin-instances: small meshes + a single matrix buffer for every tree.
   const trunks=[],canopies=[],leafTips=[],groundRocks=[],sparkles=[],grasses=[],blossoms=[];
   const count=artLibrary?(mobile?5:10):(mobile?11:20);
   for(let i=0;i<count;i++){
     const x=cx*CHUNK_SIZE+5+rng(cx,cz,i,33)*(CHUNK_SIZE-10);
     const z=cz*CHUNK_SIZE+5+rng(cx,cz,i,91)*(CHUNK_SIZE-10);
     if(Math.abs(x)>WORLD_LIMIT-5||Math.abs(z)>WORLD_LIMIT-5)continue;
     if(WAYSTONES.some(w=>Math.hypot(w.x-x,w.z-z)<18))continue;
     if(LANDMARKS.some(w=>Math.hypot(w.x-x,w.z-z)<18))continue;
     const y=terrainHeight(x,z),variation=.75+rng(cx,cz,i,12)*.85;
     const style=biomeAt(x,z).id;
     // Place genuine textured glTF mesh instances when the CC0 art pack is loaded.
     // Original procedural shapes remain available in case assets fail to load.
     if(artLibrary&&['forest','marsh','aether'].includes(style)){
       const trees=artLibrary.available.filter(name=>name.startsWith('tree'));
       const chosen=trees[Math.floor(rng(cx,cz,i,99)*trees.length)];
       const rotation=rng(cx,cz,i,55)*Math.PI*2;
       const scale=.90+rng(cx,cz,i,12)*.35;
       if(chosen){
         artLibrary.place(chosen,root,x,y,z,{scale,rotation});
         if(artLibrary.has('bush')&&i%2===0){
           const bx=x+3+rng(cx,cz,i,143)*3,bz=z-3+rng(cx,cz,i,177)*3;
           if(Math.abs(bx)<WORLD_LIMIT-4&&Math.abs(bz)<WORLD_LIMIT-4&&
              !WAYSTONES.some(w=>Math.hypot(w.x-bx,w.z-bz)<16)){
             artLibrary.place('bush',root,bx,terrainHeight(bx,bz),bz,
               {scale:.8+rng(cx,cz,i,14)*.6,rotation:rotation*.4});
           }
         }
         continue;
       }
     }
     if(style==='forest'||style==='marsh'||style==='aether'){
       const h=(style==='aether'?6.0:style==='marsh'?3.7:5.2)*variation;
       trunks.push(matrix(x,y+h*.5,z,.55*variation,h,.55*variation,rng(cx,cz,i,4)*6.28));
       // Four overlapping offset crowns create a layered silhouette instead of a sphere-on-stick.
       const spread=(style==='marsh'?2.15:style==='aether'?2.4:2.85)*variation;
       canopies.push(matrix(x,y+h+.6,z,spread*1.65,h*.69,spread*1.55));
       for(let l=0;l<3;l++){
         const angle=l*Math.PI*2/3+rng(cx,cz,i,52)*.9;
         const bx=x+Math.cos(angle)*spread*.46,bz=z+Math.sin(angle)*spread*.46;
         canopies.push(matrix(bx,y+h+.2+rng(cx,cz,i,l+100)*.65,bz,
           spread*1.25,h*.55,spread*1.25));
       }
       leafTips.push(matrix(x,y+h+1.3,z,spread*1.05,h*.40,spread*1.05));
       if(i%3===0)sparkles.push(matrix(x+.8,y+.3,z+.3,.32,.65,.32));
     }else if(style==='neon'){
       const h=3+variation*8;
       trunks.push(matrix(x,y+h*.5,z,.8,h,.8,0));
       sparkles.push(matrix(x,y+h+.4,z,.85,.3,.85));
     }else if(style==='titan'){
       const h=2+variation*5;
       groundRocks.push(matrix(x,y+h*.45,z,1.3*variation,h,1.05*variation,rng(cx,cz,i,7)*6.28));
       if(i%4===0)sparkles.push(matrix(x,y+.5,z,.35,1.5,.35));
     }else{
       const h=2+variation*4;
       sparkles.push(matrix(x,y+h*.5,z,.8,h,.8));
     }
   }
   // Small-scale understory adds visual depth without extra independent draw calls.
   // Decorative objects are deterministic and never participate in resource rewards.
   const groundDetails=mobile?38:75;
   for(let i=0;i<groundDetails;i++){
     const x=cx*CHUNK_SIZE+3+rng(cx,cz,i,180)*(CHUNK_SIZE-6);
     const z=cz*CHUNK_SIZE+3+rng(cx,cz,i,202)*(CHUNK_SIZE-6);
     if(Math.abs(x)>WORLD_LIMIT-4||Math.abs(z)>WORLD_LIMIT-4)continue;
     if(WAYSTONES.some(w=>Math.hypot(w.x-x,w.z-z)<16))continue;
     if(LANDMARKS.some(w=>Math.hypot(w.x-x,w.z-z)<14))continue;
     const y=terrainHeight(x,z),style=biomeAt(x,z).id;
     const height=.5+rng(cx,cz,i,214)*.75;
     if(['forest','marsh','aether'].includes(style)){
       for(let blade=0;blade<2;blade++){
         grasses.push(matrix(x+(blade?-.18:.18),y+height*.48,z+(blade?.1:-.1),
           .22,height,.22,rng(cx,cz,i,231+blade)*Math.PI*2));
       }
       if(i%9===0)blossoms.push(matrix(x,y+height+.1,z,.30,.30,.30));
       if(i%11===0)groundRocks.push(matrix(x,y+.18,z,.55,.36,.7,rng(cx,cz,i,240)*6.28));
     }else if(style==='crystal'||style==='neon'){
       if(i%3===0)sparkles.push(matrix(x,y+.5,z,.24,1,.24));
     }else if(style==='titan'&&i%4===0){
       groundRocks.push(matrix(x,y+.32,z,1,.65,1.1));
     }
   }
   if(trunks.length){
     const m=BABYLON.MeshBuilder.CreateCylinder('trunks-'+key,
       {height:1,diameterTop:.67,diameterBottom:1,tessellation:7},scene);
     m.parent=root;m.material=biome.id==='neon'?metal:wood;
     addThin(m,trunks);
   }
   if(canopies.length){
     const m=BABYLON.MeshBuilder.CreateSphere('leaf-clusters-'+key,{diameter:1,segments:8},scene);
     m.parent=root;m.material=leafMaterial(biome);addThin(m,canopies);
   }
   if(leafTips.length){
     const m=BABYLON.MeshBuilder.CreateSphere('upper-foliage-'+key,{diameter:1,segments:7},scene);
     m.parent=root;
     m.material=mat('leaf-highlights-'+biome.id,biome.accent);
     addThin(m,leafTips);
   }
   if(grasses.length){
     const m=BABYLON.MeshBuilder.CreateCylinder('ground-cover-'+key,
       {height:1,diameterTop:0,diameterBottom:1,tessellation:3},scene);
     m.parent=root;
     m.material=mat('ground-cover-'+biome.id,({
       forest:'#54a36a',marsh:'#65aa83',aether:'#91a6da',
       neon:'#59aabd',titan:'#b98a65',crystal:'#5db9ab'
     })[biome.id]||'#55a675');
     addThin(m,grasses);
   }
   if(blossoms.length){
     const m=BABYLON.MeshBuilder.CreateSphere('wildflowers-'+key,{diameter:1,segments:6},scene);
     m.parent=root;m.material=flowers;addThin(m,blossoms);
   }
   if(groundRocks.length){
     const m=BABYLON.MeshBuilder.CreateCylinder('rocks-'+key,
       {height:1,diameterTop:.5,diameterBottom:1.2,tessellation:6},scene);
     m.parent=root;m.material=stone;addThin(m,groundRocks);
   }
   if(sparkles.length){
     const m=BABYLON.MeshBuilder.CreateCylinder('light-structures-'+key,
       {height:1,diameterTop:0,diameterBottom:.95,tessellation:5},scene);
     m.parent=root;m.material=biome.id==='titan'?lava:biome.id==='neon'?glass:flowers;
     addThin(m,sparkles);
   }
   if(biome.id==='marsh'&&terrainHeight(centerX,centerZ)<2.5){
     const pool=BABYLON.MeshBuilder.CreateGround('wetland-pool-'+key,
       {width:CHUNK_SIZE,height:CHUNK_SIZE,subdivisions:1},scene);
     pool.parent=root;pool.position.set(centerX,.65,centerZ);pool.material=water;pool.isPickable=false;
   }
   active.set(key,root);
 }
 function landmark(x,z){
   const resolved=resolveGenesisLandmark(x,z);
   if(!resolved)return;
   const {entry,waystone}=resolved;
   const w=waystone?entry:null;
   const root=makeRoot((waystone?'waystone:':'landmark:')+entry.id,x,z);
   if(w){
     const label=w.biome,accent=mat('portal-'+label,BIOMES[label].accent,{glow:.6});
     addCylinder(root,'platform',0,.2,0,.32,9,stone,{segments:12});
     addCylinder(root,'obelisk-left',-3,3.8,0,7.6,.9,stone);
     addCylinder(root,'obelisk-right',3,3.8,0,7.6,.9,stone);
     addBox(root,'arch',0,7.3,0,7,.8,1.1,stone);
     addOrb(root,'waystone-orb',0,5.4,0,1.6,1.6,1.6,accent);
     for(const side of [-1,1])addOrb(root,'signal',side*3,7.8,0,.5,.5,.5,accent);
   }else if(entry?.kind==='tower'){
     for(let i=0;i<6;i++){
       const h=22+i*11;
       addBox(root,'neon-building',Math.sin(i*3)*20,h*.5,Math.cos(i*4)*18,8+i,h,9,metal);
       addBox(root,'neon-accent',Math.sin(i*3)*20,h,Math.cos(i*4)*18,9+i,.7,10,glass);
     }
   }else if(entry?.kind==='fortress'){
     for(const side of [-1,1]){
       addCylinder(root,'titan-watchtower',side*22,12,0,24,7,stone);
       addOrb(root,'molten-signal',side*22,24,0,4,4,4,lava);
     }
     addBox(root,'titan-gate',0,10,0,36,18,6,stone);
     addBox(root,'gate-core',0,11,4,8,12,1,lava);
   }else if(entry?.kind==='islands'){
     for(let i=0;i<6;i++){
       const bx=Math.sin(i*2.45)*21,bz=Math.cos(i*2.12)*19,alt=12+i*4.5;
       addCylinder(root,'floating-island',bx,alt,bz,5,11,snow,{topDiameter:14});
       addCylinder(root,'sky-column',bx,alt+6,bz,9,2,snow);
       addOrb(root,'sky-light',bx,alt+10,bz,2.4,2.4,2.4,glass);
     }
   }else if(entry?.kind==='waterfall'){
     addBox(root,'waterfall-cliff',0,12,0,32,25,16,stone);
     const cascade=mat('fall-water','#4dc7ea',{glow:.3,alpha:.7});
     addBox(root,'cascade',0,12,8.8,12,24,.5,cascade);
     addCylinder(root,'pond',0,.1,12,.35,35,water,{segments:22});
   }else if(entry?.kind==='cavern'){
     for(const side of [-1,1]){
       addCylinder(root,'crystal-door',side*6,7,0,14,3,stone);
       addOrb(root,'cavern-light',side*6,15,0,3,3,3,glass);
     }
     addBox(root,'cave-entrance',0,6,0,15,12,2,stone);
     addBox(root,'cave-darkness',0,5,1.1,9,9,.3,mat('cave-mouth','#0b1427'));
   }else {
     for(let i=0;i<7;i++){
       const angle=i*Math.PI*2/7;
       addCylinder(root,'ancient-pillar',Math.sin(angle)*11,4,Math.cos(angle)*11,
         8,1.8,stone);
     }
     addCylinder(root,'ancient-altar',0,1,0,2.1,8,stone,{segments:10});
     addOrb(root,'relic',0,3.1,0,3,3,3,flowers);
   }
   root.setEnabled(false);
   special.set((waystone?'waystone:':'landmark:')+entry.id,root);
 }
 for(const entry of WAYSTONES)landmark(entry.x,entry.z);
 for(const entry of LANDMARKS)landmark(entry.x,entry.z);
 let previousCell=null;
 function setArtLibrary(library){
   if(!library||!library.available?.some(name=>name.startsWith('tree')))return false;
   if(artLibrary===library)return true;
   artLibrary=library;
   // Recreate only the local scenery chunks; gameplay objects/save data live elsewhere.
   for(const root of active.values())root.dispose(false,false);
   active.clear();
   previousCell=null;
   return true;
 }
 function update(x,z,{force=false}={}){
   const cell=worldChunk(x,z),key=chunkKey(cell.cx,cell.cz);
   if(!force&&previousCell===key)return false;
   previousCell=key;
   const keep=new Set();
   const needed=[];
   for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
     const cx=cell.cx+dx,cz=cell.cz+dz,k=chunkKey(cx,cz);
     const mx=(cx+.5)*CHUNK_SIZE,mz=(cz+.5)*CHUNK_SIZE;
     if(Math.abs(mx)>WORLD_LIMIT||Math.abs(mz)>WORLD_LIMIT)continue;
     keep.add(k);
     if(!active.has(k))needed.push({cx,cz,k,dist:dx*dx+dz*dz});
   }
   for(const [k,root] of active)if(!keep.has(k)){
     root.dispose(false,false);active.delete(k);
   }
   needed.sort((a,b)=>a.dist-b.dist);
   for(const {cx,cz} of needed)createChunk(cx,cz);
   for(const root of special.values()){
     const d=Math.hypot(root.position.x-x,root.position.z-z);
     root.setEnabled(d<245);
   }
   return true;
 }
 function dispose(){
   for(const root of active.values())root.dispose(false,false);
   for(const root of special.values())root.dispose(false,false);
   active.clear();special.clear();
   terrainMat.dispose();groundTex.dispose();
   for(const m of materialCache.values())m.dispose();
   artLibrary?.dispose();
 }
 return {update,setArtLibrary,dispose,activeChunkCount:()=>active.size,terrainHeight,biomeAt};
}
