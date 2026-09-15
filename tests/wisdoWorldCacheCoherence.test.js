import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const REVISION='2026.09.14.runtime-recovery-v3';

test('World entry rotates every production asset to the cache-coherence revision',()=>{
  const html=read('public/app/world/index.html');
  assert.match(html,new RegExp(`data-world-build=\\"${REVISION.replaceAll('.','\\.')}\\"`));
  assert.match(html,/world3d-production\.js\?v=2026\.09\.14\.runtime-recovery-v3/);
  assert.match(html,/world-debug-runtime\.js\?v=2026\.09\.14\.runtime-recovery-v3/);
  assert.doesNotMatch(html,/runtime-recovery-v2/);
});

test('production World and fidelity imports use one explicit revisioned module graph',()=>{
  const wrapper=read('public/app/world/world3d-production.js');
  const fidelity=read('public/app/world/production-fidelity-layer.js');
  for(const source of [wrapper,fidelity]){
    const localImports=[...source.matchAll(/from ['\"](\.\/?[^'\"]+\.js(?:\?[^'\"]*)?)['\"]/g)].map((match)=>match[1]);
    assert.ok(localImports.length>0,'expected local ESM imports');
    for(const specifier of localImports)assert.match(specifier,/\?v=2026\.09\.14\.runtime-recovery-v3$/);
    assert.doesNotMatch(source,/runtime-recovery-v2/);
  }
});

test('client runtime publishes independent core, fidelity and debug revision proof',()=>{
  const wrapper=read('public/app/world/world3d-production.js');
  const fidelity=read('public/app/world/production-fidelity-layer.js');
  const debug=read('public/app/world/world-debug-runtime.js');
  const build=read('public/app/world/world-build.js');
  assert.match(wrapper,/WisdoWorldClientRevision/);
  assert.match(fidelity,/WisdoFidelityClientRevision/);
  assert.match(debug,/CLIENT COHERENCE/);
  assert.match(debug,/CLIENT REV/);
  assert.match(debug,/WisdoDebugClientRevision/);
  assert.match(build,/3\.0\.2-cache-coherence-alpha/);
  assert.match(build,/2026\.09\.14\.runtime-recovery-v3/);
});
