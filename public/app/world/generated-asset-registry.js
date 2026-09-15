// AUTO-UPDATED ONLY BY tools/blender/bridge/register-generated-asset.mjs
// Empty catalog entries intentionally preserve authored/fallback runtime until a validated Blender PR supplies a real GLB.
export const GENERATED_WORLD_ASSET_DATA =
/* WISDO_GENERATED_ASSET_DATA_BEGIN */
{
  "players": {
    "default": null
  },
  "arcades": {
    "default": null
  },
  "npcs": {},
  "buildings": {},
  "props": {},
  "vehicles": {},
  "interiors": {},
  "vegetation": {},
  "worldObjects": {}
}
/* WISDO_GENERATED_ASSET_DATA_END */;

function freezeAsset(value){
  if(!value)return null;
  const clips={};for(const [key,names] of Object.entries(value.clips||{}))clips[key]=Object.freeze(Array.isArray(names)?names:[]);
  return Object.freeze({...value,clips:Object.freeze(clips)});
}
function freezeAssetMap(value){
  const out={};for(const [key,asset] of Object.entries(value||{}))out[key]=freezeAsset(asset);
  return Object.freeze(out);
}
const PLAYERS=Object.freeze({default:freezeAsset(GENERATED_WORLD_ASSET_DATA.players?.default)});
const ARCADES=Object.freeze({default:freezeAsset(GENERATED_WORLD_ASSET_DATA.arcades?.default)});
const NPCS=freezeAssetMap(GENERATED_WORLD_ASSET_DATA.npcs);
const BUILDINGS=freezeAssetMap(GENERATED_WORLD_ASSET_DATA.buildings);
const PROPS=freezeAssetMap(GENERATED_WORLD_ASSET_DATA.props);
const VEHICLES=freezeAssetMap(GENERATED_WORLD_ASSET_DATA.vehicles);
const INTERIORS=freezeAssetMap(GENERATED_WORLD_ASSET_DATA.interiors);
const VEGETATION=freezeAssetMap(GENERATED_WORLD_ASSET_DATA.vegetation);
const WORLD_OBJECTS=freezeAssetMap(GENERATED_WORLD_ASSET_DATA.worldObjects);
export const GENERATED_WORLD_ASSETS=Object.freeze({
  playerV2:PLAYERS.default,
  arcadeV2:ARCADES.default,
  players:PLAYERS,
  arcades:ARCADES,
  npcs:NPCS,
  buildings:BUILDINGS,
  props:PROPS,
  vehicles:VEHICLES,
  interiors:INTERIORS,
  vegetation:VEGETATION,
  worldObjects:WORLD_OBJECTS,
});
export function getGeneratedPlayerV2(){return GENERATED_WORLD_ASSETS.players.default||null;}
export function getGeneratedArcadeV2(){return GENERATED_WORLD_ASSETS.arcades.default||null;}
export function getGeneratedNpcAsset(assetId){return GENERATED_WORLD_ASSETS.npcs?.[String(assetId||'')]||null;}
export function getGeneratedAsset(collection,assetId='default'){return GENERATED_WORLD_ASSETS?.[String(collection||'')]?.[String(assetId||'')]||null;}
