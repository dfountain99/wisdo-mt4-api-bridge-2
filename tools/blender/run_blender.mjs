import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {findBlender} from './blender_locator.mjs';

const [command='build',...rest]=process.argv.slice(2);
const map={
  build:'tools/blender/scripts/build_wisdo_asset.py',
  validate:'tools/blender/scripts/validate_asset.py',
  import:'tools/blender/scripts/import_asset.py',
  normalize:'tools/blender/scripts/normalize_asset.py',
  lod:'tools/blender/scripts/generate_lods.py',
  materials:'tools/blender/scripts/setup_materials.py',
  character:'tools/blender/scripts/setup_character.py',
  animations:'tools/blender/scripts/process_animations.py',
  collision:'tools/blender/scripts/build_collision.py',
  export:'tools/blender/scripts/export_glb.py',
};
if(!map[command])throw new Error(`Unknown Blender command: ${command}`);
const blender=findBlender();
if(!blender)throw new Error('Blender executable not found. Set BLENDER_BIN or install Blender.');
console.log(`[WISDO Blender] ${blender.version} @ ${blender.executable}`);

// Blender's embedded Python does not reliably add the directory containing a
// `-P` script to sys.path in headless Linux builds. All WISDO bpy entrypoints
// import the shared `wisdo_pipeline.py`, so expose that directory explicitly.
const scriptsDir=path.resolve('tools/blender/scripts');
const env={
  ...process.env,
  PYTHONPATH:[scriptsDir,process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
};
const result=spawnSync(blender.executable,['-b','-P',map[command],'--',...rest],{stdio:'inherit',env});
process.exit(result.status??1);
