import {existsSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

function windowsCandidates(){
  if(process.platform!=='win32') return [];
  const roots=[
    'C:\\Program Files\\Blender Foundation',
    process.env.LOCALAPPDATA?path.join(process.env.LOCALAPPDATA,'Programs','Blender Foundation'):null,
  ].filter(Boolean);
  const found=[];
  for(const root of roots){
    if(!existsSync(root)) continue;
    let entries=[];
    try{entries=readdirSync(root,{withFileTypes:true}).filter((e)=>e.isDirectory()).map((e)=>e.name).sort().reverse();}catch{}
    for(const name of entries) found.push(path.join(root,name,'blender.exe'));
  }
  return found;
}
export function blenderCandidates(){
  return [
    process.env.BLENDER_BIN,
    'blender',
    '/usr/bin/blender',
    '/usr/local/bin/blender',
    '/opt/blender/blender',
    '/snap/bin/blender',
    '/Applications/Blender.app/Contents/MacOS/Blender',
    ...windowsCandidates(),
  ].filter(Boolean);
}
export function findBlender(){
  for(const candidate of blenderCandidates()){
    if((candidate.includes('/')||candidate.includes('\\'))&&candidate!=='blender'&&!existsSync(candidate)) continue;
    try{
      const raw=execFileSync(candidate,['--version'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
      return {executable:candidate,version:raw.split(/\r?\n/)[0].trim(),raw:raw.trim()};
    }catch{}
  }
  return null;
}
