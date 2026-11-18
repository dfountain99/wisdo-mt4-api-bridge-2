/**
 * WISDO Genesis - opt-in abandoned aircraft visual loader.
 * No flight, repair, resource, or multiplayer authority is granted here.
 * Asset should be copied to public/assets/genesis/vehicles/abandoned_aircraft.glb.
 */
export const GENESIS_AIRCRAFT_URL='/assets/genesis/vehicles/abandoned_aircraft.glb';

export async function loadGenesisAircraft(scene,{url=GENESIS_AIRCRAFT_URL}={}){
 if(!scene||!globalThis.BABYLON?.SceneLoader?.LoadAssetContainerAsync)
  throw new Error('Babylon GLB loader or Genesis scene is unavailable.');
 const response=await fetch(url,{method:'HEAD',credentials:'same-origin'}).catch(()=>null);
 if(!response?.ok)return null; // Optional: missing asset leaves live gameplay unchanged.
 const container=await BABYLON.SceneLoader.LoadAssetContainerAsync('',url,scene,undefined,'.glb');
 if(!container.meshes.some(mesh=>mesh.getTotalVertices?.()>0)){
  container.dispose();
  throw new Error('Aircraft GLB is missing mesh geometry.');
 }
 let next=0;const placed=new Set();
 function spawn({x=0,y=0,z=0,scale=10,rotationY=0}={}){
  // Source model has approximately 1.9 authored units of wingspan.
  // scale=10 places it at roughly aircraft size in the world.
  const index=++next;
  const spawned=container.instantiateModelsToScene(
   name=>'genesis-abandoned-aircraft-'+index+'-'+name,
   false,{doNotInstantiate:false}
  );
  const root=new BABYLON.TransformNode('genesis-aircraft-'+index,scene);
  root.position.set(x,y,z);
  root.scaling.setAll(scale);
  root.rotation.y=rotationY;
  for(const node of spawned.rootNodes)node.parent=root;
  for(const mesh of root.getChildMeshes(false)){
   mesh.receiveShadows=true;
   // Visual-only until a server-authoritative aircraft entity exists.
   mesh.isPickable=false;
  }
  placed.add({root,spawned});
  return root;
 }
 function dispose(){
  for(const item of placed){
   item.root.dispose(false,false);
   for(const animation of item.spawned.animationGroups||[])animation.dispose();
  }
  placed.clear();
  container.dispose();
 }
 return {spawn,dispose,source:url};
}
