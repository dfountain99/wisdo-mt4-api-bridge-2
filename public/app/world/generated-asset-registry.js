// AUTO-UPDATED ONLY BY tools/blender/bridge/register-generated-asset.mjs
// Null entries intentionally preserve the current authored/fallback runtime until a Blender PR supplies a validated GLB.
export const GENERATED_WORLD_ASSET_DATA =
/* WISDO_GENERATED_ASSET_DATA_BEGIN */
{
  "playerV2": null,
  "arcadeV2": null
}
/* WISDO_GENERATED_ASSET_DATA_END */;

function freezeAsset(value){
  if(!value)return null;
  const clips={};for(const [key,names] of Object.entries(value.clips||{}))clips[key]=Object.freeze(Array.isArray(names)?names:[]);
  return Object.freeze({...value,clips:Object.freeze(clips)});
}
export const GENERATED_WORLD_ASSETS=Object.freeze({
  playerV2:freezeAsset(GENERATED_WORLD_ASSET_DATA.playerV2),
  arcadeV2:freezeAsset(GENERATED_WORLD_ASSET_DATA.arcadeV2),
});
