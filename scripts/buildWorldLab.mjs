import {cpSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const root=path.resolve('.world-lab-dist');
const target=path.join(root,'app/world');
mkdirSync(path.join(target,'babylon-city'),{recursive:true});
mkdirSync(path.join(target,'fixtures'),{recursive:true});
for(const name of ['personal-world-v1.html','personal-world-v1.js','world-space.js'])
 cpSync(path.join('public/app/world/babylon-city',name),path.join(target,'babylon-city',name));
const fixture='public/app/world/fixtures/golden-world.json';
cpSync(fixture,path.join(target,'fixtures/golden-world.json'));
cpSync('world-lab/index.html',path.join(root,'index.html'));
const manifest=JSON.parse(readFileSync(fixture,'utf8'));
const git=(...args)=>{try{return execFileSync('git',args,{encoding:'utf8'}).trim()}catch{return 'unknown'}};
const metadata={commit:process.env.RENDER_GIT_COMMIT||git('rev-parse','HEAD'),branch:process.env.RENDER_GIT_BRANCH||git('rev-parse','--abbrev-ref','HEAD'),
 fixture:manifest.worldId,manifestVersion:manifest.revision,manifestHash:createHash('sha256').update(readFileSync(fixture)).digest('hex'),renderer:'Babylon',
 generatedAt:new Date().toISOString()};
writeFileSync(path.join(root,'build.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(`World Lab ${metadata.commit} ${metadata.manifestHash}`);
