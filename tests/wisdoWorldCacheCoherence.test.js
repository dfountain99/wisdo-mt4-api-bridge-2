import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const REVISION='2026.09.14.runtime-recovery-v4';

test('World entry rotates every production asset to the render-context revision',()=>{
  const html=read('public/app/world/index.html');
  assert.match(html,new RegExp(`data-world-build=\\"${REVISION.replaceAll('.','\\.')}\\"`));
  assert.match(html,/world3d-production\.js\?v=2026\.09\.14\.runtime-recovery-v4/);
  assert.match(html,/world-debug-runtime\.js\?v=2026\.09\.14\.runtime-recovery-v4/);
  assert.doesNotMatch(html,/runtime-recovery-v3/);
});

test('production World, core and fidelity imports use one explicit revisioned module graph',()=>{
  const wrapper=read('public/app/world/world3d-production.js');
  const core=read('public/app/world/world3d-production-core.js');
  const fidelity=read('public/app/world/production-fidelity-layer.js');
  for(const source of [wrapper,core,fidelity]){
    const localImports=[...source.matchAll(/from ['\"](\.\/?[^'\"]+\.js(?:\?[^'\"]*)?)['\"]/g)].map((match)=>match[1]);
    assert.ok(localImports.length>0,'expected local ESM imports');
    for(const specifier of localImports)assert.match(specifier,/\?v=2026\.09\.14\.runtime-recovery-v4$/);
    assert.doesNotMatch(source,/runtime-recovery-v3/);
  }
});

test('core publishes render context directly instead of prototype interception',()=>{
  const wrapper=read('public/app/world/world3d-production.js');
  const core=read('public/app/world/world3d-production-core.js');
  assert.match(core,/onRenderContext/);
  assert.match(core,/onRenderContext\?\.\(\{THREE,scene,camera,renderer,operator\}\)/);
  assert.match(wrapper,/onRenderContext:captureRenderContext/);
  assert.match(wrapper,/WisdoRenderContextDiagnostics/);
  assert.doesNotMatch(wrapper,/WebGLRenderer\.prototype/);
  assert.doesNotMatch(wrapper,/proto\.render/);
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
  assert.match(debug,/RENDER CTX/);
  assert.match(debug,/WisdoDebugClientRevision/);
  assert.match(build,/3\.0\.3-render-context-alpha/);
  assert.match(build,/2026\.09\.14\.runtime-recovery-v4/);
});
