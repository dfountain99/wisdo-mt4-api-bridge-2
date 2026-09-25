import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const root=path.resolve('.world-lab-dist');
const pr=Number(process.env.WORLD_LAB_PR||0);
const requested=process.env.WORLD_LAB_TARGET_SHA||'';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
if(!Number.isSafeInteger(pr)||pr<=0||!/^[a-f0-9]{40}$/.test(requested))
 throw Error('Set WORLD_LAB_PR and the full 40-character WORLD_LAB_TARGET_SHA');
git('fetch','--no-tags','origin',`refs/pull/${pr}/head`);
const head=git('rev-parse','FETCH_HEAD');
if(head!==requested)throw Error(`PR #${pr} moved: expected ${requested}, current ${head}. Rebuild for the new SHA; prior evidence is invalid.`);
const files=[
 'public/app/world/babylon-city/personal-world-v1.html',
 'public/app/world/babylon-city/personal-world-v1.js',
 'public/app/world/babylon-city/world-space.js',
 'public/app/world/fixtures/golden-world.json',
];
rmSync(root,{recursive:true,force:true});
for(const source of files){const destination=path.join(root,source.replace(/^public\//,''));mkdirSync(path.dirname(destination),{recursive:true});writeFileSync(destination,execFileSync('git',['show',`${head}:${source}`]));}
const fixture=readFileSync(path.join(root,'app/world/fixtures/golden-world.json'));
const manifest=JSON.parse(fixture);
mkdirSync(root,{recursive:true});
writeFileSync(path.join(root,'index.html'),readFileSync('world-lab/index.html'));
const metadata={pr,commit:head,world:manifest.name||manifest.worldId,fixture:manifest.worldId,
 manifestVersion:manifest.revision,manifestHash:createHash('sha256').update(fixture).digest('hex'),renderer:'aether',
 environment:'PR Preview',generatedAt:new Date().toISOString()};
writeFileSync(path.join(root,'build.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(`WISDO Aether Lab PR #${pr} ${head} ${metadata.manifestHash}`);
