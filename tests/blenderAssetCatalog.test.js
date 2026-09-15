import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

import {
  GENERATED_WORLD_ASSETS,
  getGeneratedPlayerV2,
  getGeneratedArcadeV2,
  getGeneratedNpcAsset,
} from '../public/app/world/generated-asset-registry.js';
import {
  normalizeNpcAssetId,
  resolveNpcAsset,
  getOgMasterWisdoAsset,
  getOgMasterWisdoRuntime,
} from '../public/app/world/npc-runtime-registry.js';
import {OG_MASTER_WISDO} from '../public/app/world/og-master-wisdo-contract.js';

const registerScript=fileURLToPath(new URL('../tools/blender/bridge/register-generated-asset.mjs',import.meta.url));

function parseGeneratedData(source){
  const match=source.match(/\/\* WISDO_GENERATED_ASSET_DATA_BEGIN \*\/\s*([\s\S]*?)\s*\/\* WISDO_GENERATED_ASSET_DATA_END \*\//);
  assert.ok(match,'generated registry data marker should exist');
  return JSON.parse(match[1]);
}

function runRegister(cwd,args){
  const result=spawnSync(process.execPath,[registerScript,...args],{cwd,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
  return JSON.parse(result.stdout);
}

test('generalized generated registry preserves legacy aliases while exposing grouped catalogs',()=>{
  assert.equal(getGeneratedPlayerV2(),GENERATED_WORLD_ASSETS.playerV2);
  assert.equal(getGeneratedArcadeV2(),GENERATED_WORLD_ASSETS.arcadeV2);
  assert.equal(getGeneratedNpcAsset('og-master-wisdo'),null);
  assert.equal(GENERATED_WORLD_ASSETS.players.default,null);
  assert.equal(GENERATED_WORLD_ASSETS.arcades.default,null);
  assert.deepEqual(Object.keys(GENERATED_WORLD_ASSETS.npcs),[]);
});

test('NPC runtime lookup normalizes contract ids and remains visually pending without a real GLB',()=>{
  assert.equal(normalizeNpcAssetId('og_master_wisdo'),'og-master-wisdo');
  assert.equal(OG_MASTER_WISDO.asset.assetId,'og-master-wisdo');
  assert.equal(resolveNpcAsset('og-master-wisdo'),null);
  assert.equal(getOgMasterWisdoAsset(),null);
  assert.equal(getOgMasterWisdoRuntime().visualReady,false);
});

test('NPC runtime lookup returns generated metadata when a matching catalog asset exists',()=>{
  const asset=Object.freeze({id:'og-master-wisdo',kind:'npc',format:'glb',url:'/world-assets/characters/npcs/og-master-wisdo/og_master_wisdo.glb'});
  const catalog=Object.freeze({'og-master-wisdo':asset});
  assert.equal(resolveNpcAsset('og_master_wisdo',{catalog}),asset);
  assert.equal(getOgMasterWisdoAsset({catalog}),asset);
  const runtime=getOgMasterWisdoRuntime({catalog});
  assert.equal(runtime.visualReady,true);
  assert.equal(runtime.asset,asset);
});

test('registration script stores NPCs and other generated assets in named catalog buckets',()=>{
  const cwd=mkdtempSync(path.join(tmpdir(),'wisdo-asset-catalog-'));
  try{
    mkdirSync(path.join(cwd,'public/app/world'),{recursive:true});
    mkdirSync(path.join(cwd,'public/world-assets/test'),{recursive:true});
    const reportPath='public/world-assets/test/asset.report.json';
    writeFileSync(path.join(cwd,reportPath),JSON.stringify({
      boundsMeters:{size:[0.65,0.42,1.84]},
      animations:{mapping:{
        IDLE:{source:'IDLE'},
        SEATED_IDLE:{source:'SEATED_IDLE'},
        SPEAK:{source:'SPEAK'},
        WALK_FORWARD:{source:'WALK_FORWARD'},
      }},
    }));

    runRegister(cwd,[
      '--target','npc',
      '--asset-id','og-master-wisdo',
      '--output','public/world-assets/characters/npcs/og-master-wisdo/og_master_wisdo.glb',
      '--report',reportPath,
      '--license','USER_PROVIDED',
      '--source-note','Original OG MASTER WISDO founder mentor NPC.',
      '--clips-json',JSON.stringify({IDLE:['IDLE'],SEATED_IDLE:['SEATED_IDLE'],SPEAK:['SPEAK'],GREET:['GREET']}),
    ]);

    runRegister(cwd,[
      '--target','building',
      '--asset-id','wisdo-academy-annex',
      '--output','public/world-assets/buildings/wisdo-academy-annex.glb',
      '--report',reportPath,
      '--license','WISDO_ORIGINAL',
      '--source-note','WISDO Academy generated building.',
    ]);

    runRegister(cwd,[
      '--target','playerV2',
      '--asset-id','wisdo-player-v2',
      '--output','public/world-assets/characters/player/wisdo_player_v2.glb',
      '--report',reportPath,
      '--license','WISDO_ORIGINAL',
      '--source-note','WISDO default operator.',
    ]);

    runRegister(cwd,[
      '--target','arcadeV2',
      '--asset-id','wisdo-arcade-v2',
      '--output','public/world-assets/arcade/wisdo_arcade_v2.glb',
      '--report',reportPath,
      '--license','WISDO_ORIGINAL',
      '--source-note','WISDO arcade.',
    ]);

    const registryPath=path.join(cwd,'public/app/world/generated-asset-registry.js');
    const source=readFileSync(registryPath,'utf8');
    const data=parseGeneratedData(source);
    assert.equal(data.npcs['og-master-wisdo'].kind,'npc');
    assert.equal(data.npcs['og-master-wisdo'].targetHeightMeters,1.84);
    assert.deepEqual(data.npcs['og-master-wisdo'].clips.seated,['SEATED_IDLE']);
    assert.deepEqual(data.npcs['og-master-wisdo'].clips.speak,['SPEAK']);
    assert.equal(data.buildings['wisdo-academy-annex'].kind,'building');
    assert.equal(data.players.default.id,'wisdo-player-v2');
    assert.equal(data.arcades.default.id,'wisdo-arcade-v2');
    assert.doesNotMatch(source,/"playerV2"\s*:/);

    const syntax=spawnSync(process.execPath,['--check',registryPath],{encoding:'utf8'});
    assert.equal(syntax.status,0,syntax.stderr||syntax.stdout);
  } finally {
    rmSync(cwd,{recursive:true,force:true});
  }
});
