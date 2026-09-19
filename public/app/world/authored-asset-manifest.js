import {
  GENERATED_WORLD_ASSETS,
  getGeneratedPlayerV2,
  getGeneratedArcadeV2,
} from './generated-asset-registry.js';

export const GLTF_LOADER_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/loaders/GLTFLoader.js';

const FALLBACK_OPERATOR = Object.freeze({
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
  movementMode: 'KINEMATIC_IN_PLACE',
  clips: Object.freeze({
    idle: Object.freeze(['IDLE', 'idle', 'Idle']),
    idleVariant: Object.freeze(['IDLE_VARIANT', 'idle_variant', 'Idle Variant', 'idle2']),
    walkForward: Object.freeze(['WALK_FORWARD', 'walk_forward', 'Walk Forward', 'walk', 'Walk']),
    walkBackward: Object.freeze(['WALK_BACKWARD', 'walk_backward', 'Walk Backward']),
    strafeLeft: Object.freeze(['STRAFE_LEFT', 'strafe_left', 'Strafe Left']),
    strafeRight: Object.freeze(['STRAFE_RIGHT', 'strafe_right', 'Strafe Right']),
    jog: Object.freeze(['JOG', 'jog', 'Jog', 'run', 'Run']),
    sprint: Object.freeze(['SPRINT', 'sprint', 'Sprint']),
    turnLeft: Object.freeze(['TURN_LEFT', 'turn_left', 'Turn Left']),
    turnRight: Object.freeze(['TURN_RIGHT', 'turn_right', 'Turn Right']),
    jumpStart: Object.freeze(['JUMP_START', 'jump_start', 'Jump Start']),
    jumpLoop: Object.freeze(['JUMP_LOOP', 'jump_loop', 'Jump Loop']),
    land: Object.freeze(['LAND', 'land', 'Land']),
    stop: Object.freeze(['STOP', 'stop', 'Stop']),
    interact: Object.freeze(['INTERACT', 'interact', 'Interact', 'wave', 'Wave']),
    sit: Object.freeze(['SIT', 'sit', 'Sit']),
    walk: Object.freeze(['WALK_FORWARD', 'walk', 'Walk']),
    run: Object.freeze(['JOG', 'run', 'Run']),
    wave: Object.freeze(['INTERACT', 'wave', 'Wave']),
  }),
});

const generatedPlayer=getGeneratedPlayerV2();
const DEFAULT_OPERATOR=generatedPlayer
  ? Object.freeze({
      ...FALLBACK_OPERATOR,
      ...generatedPlayer,
      clips:Object.freeze({
        ...FALLBACK_OPERATOR.clips,
        ...(generatedPlayer.clips||{}),
      }),
    })
  : FALLBACK_OPERATOR;

export const AUTHORED_WORLD_ASSETS = Object.freeze({
  defaultOperator: DEFAULT_OPERATOR,
  arcadeV2: getGeneratedArcadeV2(),
  generatedCatalog: GENERATED_WORLD_ASSETS,
});
