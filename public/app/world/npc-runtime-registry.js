import { GENERATED_WORLD_ASSETS, getGeneratedNpcAsset } from './generated-asset-registry.js';
import { OG_MASTER_WISDO, OG_MASTER_WISDO_NPC_ID } from './og-master-wisdo-contract.js';

export function normalizeNpcAssetId(value='') {
  return String(value||'')
    .trim()
    .toLowerCase()
    .replace(/_/g,'-')
    .replace(/[^a-z0-9-]+/g,'-')
    .replace(/-+/g,'-')
    .replace(/^-+|-+$/g,'');
}

export function resolveNpcAsset(npcId,{catalog=GENERATED_WORLD_ASSETS.npcs}={}) {
  const normalized=normalizeNpcAssetId(npcId);
  if(!normalized) return null;
  return catalog?.[normalized]||getGeneratedNpcAsset(normalized)||null;
}

export function resolveNpcRuntime(npc,{catalog=GENERATED_WORLD_ASSETS.npcs}={}) {
  if(!npc) return Object.freeze({npc:null,asset:null,visualReady:false});
  const assetId=normalizeNpcAssetId(npc.asset?.assetId||npc.npcId||'');
  const asset=resolveNpcAsset(assetId,{catalog});
  return Object.freeze({
    npc,
    assetId,
    asset,
    visualReady:Boolean(asset?.url&&asset?.format==='glb'),
  });
}

export function getOgMasterWisdoAsset(options={}) {
  return resolveNpcAsset(OG_MASTER_WISDO.asset?.assetId||OG_MASTER_WISDO_NPC_ID,options);
}

export function getOgMasterWisdoRuntime(options={}) {
  return resolveNpcRuntime(OG_MASTER_WISDO,options);
}
