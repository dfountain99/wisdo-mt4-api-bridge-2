import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';

function detect(){
  const candidates=[process.env.BLENDER_BIN,'blender','/usr/bin/blender','/usr/local/bin/blender','/opt/blender/blender','/snap/bin/blender','/Applications/Blender.app/Contents/MacOS/Blender','C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe','C:\\Program Files\\Blender Foundation\\Blender 4.4\\blender.exe'].filter(Boolean);
  for(const c of candidates){
    if((c.includes('/')||c.includes('\\'))&&!existsSync(c))continue;
    try{execFileSync(c,['--version'],{stdio:'ignore'});return c;}catch{}
  }
  throw new Error('Blender executable not found. Set BLENDER_BIN or install Blender.');
}

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
const blender=detect();
const result=spawnSync(blender,['-b','-P',map[command],'--',...rest],{stdio:'inherit'});
process.exit(result.status??1);
