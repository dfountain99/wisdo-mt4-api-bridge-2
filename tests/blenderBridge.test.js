import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JOB_MARKER,
  extractJobJson,
  validateJob,
  issueIsJob,
  claimPayload,
  parseClaim,
} from '../tools/blender/bridge/protocol.mjs';

const good={
  assetId:'wisdo-player-v2',
  name:'WISDO_PLAYER_V2',
  assetType:'character',
  source:{url:'https://cdn.jsdelivr.net/gh/example/assets/player.glb'},
  output:'public/world-assets/characters/player/wisdo_player_v2.glb',
  report:'public/world-assets/characters/player/wisdo_player_v2.report.json',
  registerTarget:'playerV2',
  targetHeight:1.82,
  lodRatios:[1,.6,.35,.18],
};

test('Blender Bridge parses fenced issue jobs and normalizes safe output',()=>{
  const parsed=extractJobJson(`${JOB_MARKER}\n\`\`\`json\n${JSON.stringify(good)}\n\`\`\``);
  const job=validateJob(parsed);
  assert.equal(job.assetType,'character');
  assert.equal(job.output,good.output);
  assert.equal(job.report,good.report);
  assert.equal(job.registerTarget,'playerV2');
});

test('Blender Bridge accepts generalized NPC registration and explicit clip intent',()=>{
  const job=validateJob({
    ...good,
    assetId:'og-master-wisdo',
    name:'OG_MASTER_WISDO',
    registerTarget:'npc',
    output:'public/world-assets/characters/npcs/og-master-wisdo/og_master_wisdo.glb',
    report:'public/world-assets/characters/npcs/og-master-wisdo/og_master_wisdo.report.json',
    clips:{IDLE:['IDLE'],SEATED_IDLE:['SEATED_IDLE'],SPEAK:['SPEAK']},
  });
  assert.equal(job.registerTarget,'npc');
  assert.deepEqual(job.clips.SPEAK,['SPEAK']);
});

test('interior is a runtime catalog target backed by the supported building Blender pipeline',()=>{
  const job=validateJob({
    ...good,
    assetId:'wisdo-master-chamber',
    name:'WISDO_MASTER_CHAMBER',
    assetType:'building',
    registerTarget:'interior',
    output:'public/world-assets/interiors/wisdo-master-chamber.glb',
    report:'public/world-assets/interiors/wisdo-master-chamber.report.json',
  });
  assert.equal(job.assetType,'building');
  assert.equal(job.registerTarget,'interior');
  assert.throws(()=>validateJob({...job,assetType:'interior'}),/Unsupported assetType/);
});

test('Blender Bridge requires durable asset identity, output and report paths',()=>{
  assert.throws(()=>validateJob({...good,assetId:''}),/assetId is required/);
  assert.throws(()=>validateJob({...good,output:''}),/output is required/);
  assert.throws(()=>validateJob({...good,report:''}),/report is required/);
});

test('Blender Bridge rejects incompatible runtime targets',()=>{
  assert.throws(()=>validateJob({...good,registerTarget:'building'}),/incompatible/);
  assert.throws(()=>validateJob({...good,registerTarget:'unknown'}),/Unsupported registerTarget/);
});

test('Blender Bridge rejects path traversal and arbitrary hosts',()=>{
  assert.throws(()=>validateJob({...good,output:'../secret.glb'}),/repository-relative|public\/world-assets|escape/);
  assert.throws(()=>validateJob({...good,source:{url:'https://evil.example/player.glb'}}),/not approved/);
  assert.throws(()=>validateJob({...good,source:{repoPath:'../../etc/passwd'}}),/escape|assets-source/);
});

test('Blender Bridge cannot accept arbitrary asset types or commands',()=>{
  assert.throws(()=>validateJob({...good,assetType:'shell',command:'rm -rf /'}),/Unsupported assetType/);
  const job=validateJob({...good,command:'rm -rf /'});
  assert.equal('command' in job,false);
});

test('Blender Bridge identifies queue issues and claim markers',()=>{
  assert.equal(issueIsJob({title:'[BLENDER JOB] Player V2'}),true);
  assert.equal(issueIsJob({title:'[BLENDER JOB] Player V2',pull_request:{}}),false);
  const marker=claimPayload('agent-1');
  assert.equal(parseClaim(marker).agent,'agent-1');
});
