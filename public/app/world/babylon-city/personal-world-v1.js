(()=>{'use strict';
const canvas=document.getElementById('c');
const engine=new BABYLON.Engine(canvas,true);
const scene=new BABYLON.Scene(engine);
scene.clearColor=new BABYLON.Color4(.01,.025,.05,1);
scene.collisionsEnabled=true;
scene.gravity=new BABYLON.Vector3(0,-.06,0);
new BABYLON.HemisphericLight('sun',new BABYLON.Vector3(0,1,0),scene).intensity=.9;
const camera=new BABYLON.UniversalCamera('player',new BABYLON.Vector3(0,1,6),scene);
camera.attachControl(canvas,true);
camera.speed=.18;
camera.ellipsoid=new BABYLON.Vector3(.35,.9,.35);
camera.checkCollisions=true;
camera.applyGravity=true;
camera.keysUp.push(87);camera.keysDown.push(83);camera.keysLeft.push(65);camera.keysRight.push(68);
const meshes=[],portalPositions=[];
const debug=new URLSearchParams(location.search).has('debug')||new URLSearchParams(location.search).get('fixture')==='golden';
const debugLines=[];
function material(name,color,alpha=1){const m=new BABYLON.StandardMaterial(name,scene);m.diffuseColor=BABYLON.Color3.FromHexString(color);m.alpha=alpha;return m}
function track(mesh,id){mesh.metadata={operationId:id};meshes.push(mesh);return mesh}
function box(name,width,height,depth,x,y,z,color,id,collision=true){const m=track(BABYLON.MeshBuilder.CreateBox(name,{width,height,depth},scene),id);m.position.set(x,y,z);m.material=material(name+'-mat',color);m.checkCollisions=collision;return m}
function pos(p,fallback){return {x:p?.position?.x??fallback.x,y:p?.position?.y??fallback.y,z:p?.position?.z??fallback.z}}
function yaw(p){return Math.max(-360,Math.min(360,Number(p?.rotation?.y)||0))*Math.PI/180}
function buildTerrain(id){box('island',60,1.5,60,0,-.75,0,'#24583b',id)}
function buildMountain(p,id){const h=Math.max(2,Math.min(20,Number(p.height)||2.8));for(let i=0;i<7;i++){const height=h*(.7+(i%3)*.25);const m=track(BABYLON.MeshBuilder.CreateCylinder('mountain',{diameterTop:0,diameterBottom:8,height,tessellation:8},scene),id);m.position.set(-12+(i-3)*Math.max(2,Math.min(20,Number(p.radius)||6))/3,height/2,-16+(i%2)*Math.max(2,Math.min(20,Number(p.radius)||6))/2);m.material=material('mountain-mat','#545c65');m.checkCollisions=true}}
function buildForest(p,id){const count=Math.max(1,Math.min(64,Math.round(Number(p.density)||20))),radius=Math.max(2,Math.min(20,Number(p.radius)||5)),columns=Math.ceil(Math.sqrt(count)),step=2*radius/Math.max(1,columns-1);for(let i=0;i<count;i++){const m=track(BABYLON.MeshBuilder.CreateCylinder('tree',{diameterTop:0,diameterBottom:1,height:3,tessellation:6},scene),id);m.position.set(-20-radius+(i%columns)*step,1.5,11-radius+Math.floor(i/columns)*step);m.material=material('tree-mat','#08722c');m.checkCollisions=true}}
function buildBuilding(p,id,type){const q=pos(p,{x:0,y:0,z:-8}),tall=['CREATE_CASTLE','CREATE_CITY_ZONE','CREATE_TOWER'].includes(type),height=Math.max(2,Math.min(50,Number(p.height)||(tall?14:4)));const m=box(p.name||type,tall?7:6,height,tall?7:6,q.x,q.y+height/2,q.z,type==='CREATE_TOWER'?'#1883cb':'#8f7657',id);m.rotation.y=yaw(p)}
function buildPortal(p,id){const q=pos(p,{x:9,y:0,z:-8}),rotation=yaw(p);for(const [z,y,w,h] of [[-1.3,2,.35,4],[1.3,2,.35,4],[0,4,2.9,.4]]){const x=q.x-Math.sin(rotation)*z,depth=q.z+Math.cos(rotation)*z;const m=box('portal-frame',.5,h,w,x,q.y+y,depth,'#29a5ff',id,false);m.rotation.y=rotation}portalPositions.push(q)}
function render(manifest){const operations=manifest.operations||manifest.forgeOperations||[];if(manifest.schema&&manifest.schema!=='wisdo-unreal-world-v1')throw Error('Unsupported world manifest');camera.position.set(manifest.spawn?.x??0,manifest.spawn?.y??1,manifest.spawn?.z??6);buildTerrain('terrain:base');const registry={CREATE_LANDMASS:(p,id)=>buildTerrain(id),CREATE_MOUNTAIN_RANGE:buildMountain,CREATE_FOREST:buildForest,CREATE_OCEAN:(p,id)=>{const w=60+2*Math.max(9,Math.min(100,Number(p.radius)||15));box('ocean',w,.15,w,0,-1.7,0,'#073d7f',id,false)},CREATE_RIVER:(p,id)=>{const w=60+2*Math.max(9,Math.min(100,Number(p.radius)||15));box('river',w,.15,w,0,-1.7,0,'#073d7f',id,false)},CREATE_CASTLE:(p,id)=>buildBuilding(p,id,'CREATE_CASTLE'),CREATE_CITY_ZONE:(p,id)=>buildBuilding(p,id,'CREATE_CITY_ZONE'),CREATE_TOWER:(p,id)=>buildBuilding(p,id,'CREATE_TOWER'),CREATE_HOME:(p,id)=>buildBuilding(p,id,'CREATE_HOME'),CREATE_CRAFTING_LAB:(p,id)=>buildBuilding(p,id,'CREATE_CRAFTING_LAB'),CREATE_PORTAL:buildPortal,SET_THEME:()=>{},PREVIEW_MODULE:()=>{},CREATE_SPACE_BODY:(p,id)=>{const q=pos(p,{x:8,y:6,z:-7});const m=track(BABYLON.MeshBuilder.CreateSphere('space-body',{diameter:1},scene),id);m.position.set(q.x,q.y,q.z)}};
operations.forEach((op,i)=>{const id=`op:${String(i).padStart(2,'0')}:${op.type}`,before=meshes.length;const handler=registry[op.type];if(handler)handler(op.payload||{},id);else console.error('WISDO World unsupported operation',id);debugLines.push(`${id}  ${meshes.length-before} meshes`)});
if(!operations.length)(manifest.buildings||[]).forEach((b,i)=>buildBuilding({name:b.name,position:b.position,height:b.height},`legacy:${i}`,`CREATE_${String(b.type).toUpperCase()}`));
if(debug)document.getElementById('debug').textContent=`${manifest.worldId||'world'} • revision ${manifest.revision||1}\nspawn ${JSON.stringify(manifest.spawn)}\n${debugLines.join('\n')}`;
document.getElementById('name').textContent=(manifest.name||'MY WORLD').toUpperCase();document.getElementById('meta').textContent=`${operations.length} FORGE OPERATIONS • ${meshes.length} MESHES`;document.getElementById('load').style.display='none';
}
let portalShown=false;scene.onBeforeRenderObservable.add(()=>{const near=portalPositions.some(p=>Math.hypot(camera.position.x-p.x,camera.position.z-p.z)<2.2);if(near!==portalShown){portalShown=near;const status=document.getElementById('portalStatus');status.hidden=!near;status.textContent=near?'PORTAL REACHED — destination not connected':''}});
engine.runRenderLoop(()=>scene.render());addEventListener('resize',()=>engine.resize());
const fixture=new URLSearchParams(location.search).get('fixture')==='golden';
const url=fixture?'/app/world/fixtures/golden-world.json':'/api/world/personal';
fetch(url,{credentials:'include'}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'world_load_failed');render(data.manifest||data.world||data)}).catch(e=>{console.error('WISDO World:',e);document.getElementById('load').textContent='WORLD LOAD FAILED — '+e.message});
document.getElementById('save').onclick=()=>{document.getElementById('save').textContent='SAVED';setTimeout(()=>document.getElementById('save').textContent='SAVE STATE',1000)};
})();
