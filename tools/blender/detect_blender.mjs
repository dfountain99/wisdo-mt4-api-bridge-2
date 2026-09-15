import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const candidates = [
  process.env.BLENDER_BIN,
  'blender',
  '/usr/bin/blender',
  '/usr/local/bin/blender',
  '/opt/blender/blender',
  '/snap/bin/blender',
  '/Applications/Blender.app/Contents/MacOS/Blender',
  'C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 4.4\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 4.3\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe',
].filter(Boolean);

let found = null;
for (const candidate of candidates) {
  if (candidate.includes(path.sep) && candidate !== 'blender' && !existsSync(candidate)) continue;
  try {
    const output = execFileSync(candidate, ['--version'], {encoding: 'utf8', stdio: ['ignore','pipe','pipe']});
    found = {executable: candidate, version: output.split(/\r?\n/)[0].trim(), raw: output.trim()};
    break;
  } catch {}
}
if (!found) {
  console.error(JSON.stringify({ok:false,error:'BLENDER_NOT_FOUND',message:'Install Blender, then rerun this detector. All later WISDO asset work is automated.'}, null, 2));
  process.exit(2);
}
console.log(JSON.stringify({ok:true,...found}, null, 2));
