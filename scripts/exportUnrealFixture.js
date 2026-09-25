import fs from 'node:fs';
import path from 'node:path';
import { compileHolographicPreview } from '../services/holographicBlueprintService.js';
import { createUnrealWorldManifest } from '../services/unrealWorldManifestService.js';

// Same Genesis compiler and Forge manifest contract; no Unreal-only prompt parser.
const prompt = 'Aurelia Prime: Futuristic mountain kingdom island surrounded by water, city, huge tower in the center, forest, private home, crafting lab and portal.';
const preview = compileHolographicPreview(prompt);
const world = {
  worldId: 'fixture:golden-world', buildStatus: 'forged', revision: 1,
  name: 'Aurelia Prime', theme: 'future', themeIdentity:preview.themeIdentity,
  seed:preview.seed, world:preview.world, intent:{ideas:preview.ideas}, terrain: {type: 'spawn-island'},
  spawn: {x:0,y:1.8,z:600}, zones: [{id:'spawn',type:'spawn-island',walkable:true}],
  buildings: preview.operations.filter(op => ['CREATE_CASTLE','CREATE_TOWER','CREATE_HOME','CREATE_CRAFTING_LAB'].includes(op.type)).map((op,i) =>
    ({id:`structure-${i}`,type:op.type.replace('CREATE_','').toLowerCase(),name:op.payload.name,position:op.payload.position})),
  objects: [], portals: preview.operations.filter(op=>op.type==='CREATE_PORTAL').map((op,i)=>
    ({id:`portal-${i}`,position:op.payload.position,status:'inactive'})),
  forgeOperations: preview.operations,
};
const output = path.resolve('public/app/world/fixtures/golden-world.json');
fs.mkdirSync(path.dirname(output), {recursive:true});
const manifest=createUnrealWorldManifest(world);
manifest.validationViews=[
  {id:'overview',position:{x:900,y:820,z:1300},target:{x:0,y:55,z:0}},
  {id:'city',position:{x:600,y:220,z:650},target:{x:0,y:30,z:150}},
  {id:'tower',position:{x:340,y:250,z:440},target:{x:0,y:210,z:0}},
  {id:'forest',position:{x:-200,y:180,z:0},target:{x:-550,y:20,z:-450}},
  {id:'portal',position:{x:680,y:110,z:300},target:{x:530,y:22,z:200}},
  {id:'spawn',position:{x:0,y:4,z:600},target:{x:0,y:80,z:0}},
];
fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
console.log(output);
