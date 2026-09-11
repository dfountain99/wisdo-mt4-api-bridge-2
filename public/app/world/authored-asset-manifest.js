export const GLTF_LOADER_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/loaders/GLTFLoader.js';

export const AUTHORED_WORLD_ASSETS = Object.freeze({
  defaultOperator: Object.freeze({
    id: 'wisdo-default-operator-v1',
    kind: 'operator',
    format: 'glb',
    url: 'https://cdn.jsdelivr.net/gh/kunalkushwaha/vsim@3f97faf85e46d2f9a122b0a8b8d3ccc0af598f91/packages/assets/library/suited.glb',
    sourceRepository: 'kunalkushwaha/vsim',
    sourceCommit: '3f97faf85e46d2f9a122b0a8b8d3ccc0af598f91',
    sourcePath: 'packages/assets/library/suited.glb',
    license: 'CC0-1.0',
    provenance: 'Generated with MakeHuman / MPFB 2 using CC0 MakeHuman system assets. Source package documents skin, suit, shoes, rig and animation clips as CC0.',
    targetHeightMeters: 1.82,
    faces: '+x',
    rotationY: -Math.PI / 2,
    clips: Object.freeze({
      idle: Object.freeze(['idle', 'Idle']),
      walk: Object.freeze(['walk', 'Walk']),
      run: Object.freeze(['run', 'Run']),
      wave: Object.freeze(['wave', 'Wave']),
    }),
  }),
});
