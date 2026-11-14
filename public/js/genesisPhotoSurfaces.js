/**
 * Genesis photo surface library (CC0, hosted under our own /assets path).
 * Source provenance: docs/GENESIS_PHOTO_TEXTURES.md.
 * Materials load independently: missing photos never prevent world startup.
 */
export const GENESIS_SURFACE_FILES=Object.freeze({
 turf:'turf-color.jpg.b64',
 dry:'dry-ground-color.jpg.b64',
 asphalt:'asphalt-color.jpg.b64',
 rock:'rock-color.jpg.b64',
});
export const GENESIS_BIOME_SURFACES=Object.freeze({
 forest:'turf',marsh:'turf',titan:'dry',neon:'asphalt',
 crystal:'rock',aether:'rock',
});
export function genesisSceneDisposed(scene){
 if(!scene)return true;
 return typeof scene.isDisposed==='function'?Boolean(scene.isDisposed()):
   scene.isDisposed===true;
}
export function genesisSurfaceForBiome(biome){
 return GENESIS_BIOME_SURFACES[biome]||'turf';
}
export async function loadGenesisPhotoSurfaces(scene){
 if(genesisSceneDisposed(scene)||!globalThis.BABYLON?.Texture)
   throw Error('Genesis rendering scene unavailable for texture loading.');
 const BASE='/assets/genesis/textures/';
 const entries=Object.entries(GENESIS_SURFACE_FILES);
 const loaded=await Promise.allSettled(entries.map(async ([key,filename])=>{
  const result=await fetch(BASE+filename,{credentials:'same-origin'});
  if(!result.ok)throw Error(filename+' HTTP '+result.status);
  const b64=(await result.text()).replace(/\s/g,'');
  if(!b64.startsWith('/9j/'))throw Error('Invalid JPEG texture: '+filename);
  // Use an embedded same-origin URL. Assets are decoded on the device, not
  // fetched from external CDNs; Babylon can load standard data:image URLs.
  const url='data:image/jpeg;base64,'+b64;
  const texture=await new Promise((resolve,reject)=>{
   let tex;
   try{
    tex=new BABYLON.Texture(url,scene,true,false,
      BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
      ()=>resolve(tex),
      (message,error)=>{tex?.dispose();reject(error||Error(String(message||filename)));});
   }catch(error){tex?.dispose();reject(error);}
  });
  texture.name='genesis-photo-'+key;
  texture.wrapU=BABYLON.Texture.WRAP_ADDRESSMODE;
  texture.wrapV=BABYLON.Texture.WRAP_ADDRESSMODE;
  texture.anisotropicFilteringLevel=4;
  return [key,texture];
 }));
 const maps=new Map(),errors=[];
 loaded.forEach((entry,index)=>{
  if(entry.status==='fulfilled')maps.set(...entry.value);
  else errors.push(entries[index][0]+': '+String(entry.reason?.message||entry.reason));
 });
 if(genesisSceneDisposed(scene)){
  for(const tex of maps.values())tex.dispose();
  throw Error('Genesis scene closed before photo textures finished.');
 }
 if(!maps.size)throw Error('Photo textures unavailable: '+errors.join('; '));
 return {
  available:[...maps.keys()],
  errors,
  get(key){return maps.get(key)||null;},
  getForBiome(id){
   const key=genesisSurfaceForBiome(id);
   return maps.get(key)||maps.get('turf')||maps.get('dry')||
     maps.get('rock')||maps.get('asphalt')||null;
  },
  dispose(){for(const tex of maps.values())tex.dispose();maps.clear();},
 };
}
