/**
 * Genesis authored 3D art streaming.
 *
 * Each .glb.b64 is a self-hosted, embedded-texture GLB encoded as ASCII so the
 * GitHub contents workflow can package binaries without external runtime URLs.
 * Decode/load once, then use Babylon AssetContainer instancing for mobile.
 *
 * Source: Quaternius Stylized Nature MegaKit (CC0), see docs/GENESIS_ART_ASSETS.md.
 */
export const GENESIS_MODEL_KEYS=Object.freeze(['tree1','tree2','tree3','bush','explorer']);
export function genesisArtPlacement(cx,cz,i,chunkSize=80){
 const frac=(n)=>n-Math.floor(n);
 const seed=(s)=>frac(Math.sin(cx*127.1+cz*311.7+i*79.7+s*17.3)*43758.5453123);
 return {
  x:cx*chunkSize+5+seed(33)*(chunkSize-10),
  z:cz*chunkSize+5+seed(91)*(chunkSize-10),
  rotation:seed(55)*Math.PI*2,
  scale:.9+seed(12)*.36,
  tree:GENESIS_MODEL_KEYS[Math.floor(seed(99)*3)],
 };
}

export function decodeGenesisGlb64(encoded){
 const chars=String(encoded||'').replace(/\s/g,'');
 if(!chars.startsWith('Z2xURg'))throw Error('Invalid Genesis glTF asset header.');
 const binary=atob(chars),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 if(bytes.length<20||bytes[0]!==103||bytes[1]!==108||bytes[2]!==84||bytes[3]!==70)
   throw Error('Genesis asset is not a binary glTF file.');
 return bytes;
}

export async function loadGenesisArtLibrary(scene){
 if(!globalThis.BABYLON?.SceneLoader?.LoadAssetContainerAsync)
   throw Error('Babylon glTF loader is unavailable.');
 const base='/assets/genesis/models/';
 const results=await Promise.allSettled(GENESIS_MODEL_KEYS.map(async key=>{
  const response=await fetch(base+key+'.glb.b64',{credentials:'same-origin'});
  if(!response.ok)throw Error(key+' art request failed: '+response.status);
  const bytes=decodeGenesisGlb64(await response.text());
  const blobUrl=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));
  try{
   const container=await BABYLON.SceneLoader.LoadAssetContainerAsync('',blobUrl,scene,undefined,'.glb');
   if(!container.meshes.some(mesh=>mesh.getTotalVertices?.()>0)){
     container.dispose();throw Error(key+' asset contains no mesh geometry.');
   }
   return {key,container};
  } finally {URL.revokeObjectURL(blobUrl);}
 }));
 const containers=new Map(),failures=[];
 results.forEach((item,i)=>{
  if(item.status==='fulfilled')containers.set(item.value.key,item.value.container);
  else failures.push(GENESIS_MODEL_KEYS[i]+': '+String(item.reason?.message||item.reason));
 });
 if(!['tree1','tree2','tree3'].some(key=>containers.has(key))){
  for(const container of containers.values())container.dispose();
  throw Error('No tree models loaded: '+failures.join('; '));
 }
 let nextId=0;
 function spawn(kind,parent,x,y,z,{scale=1,rotation=0}={}){
  const container=containers.get(kind);
  if(!container||!parent)return null;
  const sequence=++nextId;
  const instance=container.instantiateModelsToScene(
   name=>'genesis-model-'+kind+'-'+sequence+'-'+name,
   false,{doNotInstantiate:false}
  );
  const root=new BABYLON.TransformNode('genesis-model-'+kind+'-'+sequence,parent.getScene());
  root.parent=parent;
  root.position.set(x,y,z);
  root.scaling.setAll(scale);
  root.rotation.y=rotation;
  for(const node of instance.rootNodes)node.parent=root;
  for(const mesh of root.getChildMeshes()){
   mesh.isPickable=false;
   mesh.receiveShadows=true;
  }
  return {root,animationGroups:instance.animationGroups};
 }
 function place(...args){
  try{return Boolean(spawn(...args));}
  catch(error){
   console.warn('Genesis authored scenery instance could not be created:',error);
   return false;
  }
 }
 return {
  has:key=>containers.has(key),
  spawn,place,
  available:[...containers.keys()],
  failures,
  dispose:()=>{for(const container of containers.values())container.dispose();containers.clear();}
 };
}
