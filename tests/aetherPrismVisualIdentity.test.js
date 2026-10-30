import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const source=async(path)=>fs.readFile(new URL(path,root),'utf8');

test('AETHER PRISM makes the holographic character the center of the real Command Center',async()=>{
  const [runtime,css]=await Promise.all([
    source('public/app/world/command/command-center-runtime.js'),
    source('public/app/world/command/aether-prism-v1.css'),
  ]);
  assert.match(runtime,/AETHER PRISM · LIVING COMMAND INTELLIGENCE/);
  assert.match(runtime,/aether-prism-character-v1\.png/);
  assert.match(runtime,/class="ap-figure"/);
  assert.match(runtime,/CORE CAMPAIGN/);
  assert.match(runtime,/PRISM RECOVERY/);
  assert.match(runtime,/DRAWDOWN ADD/);
  assert.match(css,/\.ap-stage\{[^}]*grid-template-columns:/);
  assert.match(css,/@media\(max-width:750px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('recovery bank and character PRISM mode require actual EA recovery telemetry',async()=>{
  const runtime=await source('public/app/world/command/command-center-runtime.js');
  assert.match(runtime,/prism\?\.receiverReady===true&&prism\?\.reported===true/);
  assert.match(runtime,/const prismActive=prismVerified&&prism\?\.active===true/);
  assert.match(runtime,/\#apRecoveryBank'\)\.textContent=prismVerified&&hasPrismNumber\(prism\.netRealized\)/);
  assert.match(runtime,/\#apRecoveryCycles'\)\.textContent=prismVerified/);
  assert.match(runtime,/\#apRecoveryTrigger'\)\.textContent=prismVerified/);
  assert.match(runtime,/No order submitted\./);
});

test('Drawdown Add cannot reuse a normal campaign add without a dedicated PRISM capability',async()=>{
  const runtime=await source('public/app/world/command/command-center-runtime.js');
  assert.match(runtime,/capability\('PRISM_CONTINUOUS_ADD'\)\?\.available===true/);
  assert.match(runtime,/arm\('PRISM_CONTINUOUS_ADD',\{campaignId:selectedCampaignId\}\)/);
  assert.match(runtime,/q\('#lmReceiverDiagnosticPanel'\)\.open=true/);
  assert.match(runtime,/runtime\.propose\(/);
  assert.match(runtime,/runtime\.execute\(/);
});
