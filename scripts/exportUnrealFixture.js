import fs from 'node:fs';
import path from 'node:path';
import { compileHolographicPreview } from '../services/holographicBlueprintService.js';
import { createUnrealWorldManifest } from '../services/unrealWorldManifestService.js';

// Same Genesis compiler and Forge manifest contract; no Unreal-only prompt parser.
const prompt = 'Futuristic mountain kingdom surrounded by water with a huge tower in the center, forest, private home, crafting lab and portal.';
const preview = compileHolographicPreview(prompt);
const world = {
  worldId: 'fixture:golden-world', buildStatus: 'forged', revision: 1,
  name: 'Golden World', theme: 'future', terrain: {type: 'spawn-island'},
  spawn: {x:0,y:1,z:6}, zones: [{id:'spawn',type:'spawn-island',walkable:true}],
  buildings: preview.operations.filter(op => ['CREATE_CASTLE','CREATE_TOWER','CREATE_HOME','CREATE_CRAFTING_LAB'].includes(op.type)).map((op,i) =>
    ({id:`structure-${i}`,type:op.type.replace('CREATE_','').toLowerCase(),name:op.payload.name,position:op.payload.position})),
  objects: [], portals: preview.operations.filter(op=>op.type==='CREATE_PORTAL').map((op,i)=>
    ({id:`portal-${i}`,position:op.payload.position,status:'inactive'})),
  forgeOperations: preview.operations,
};
const output = path.resolve('public/app/world/fixtures/golden-world.json');
fs.mkdirSync(path.dirname(output), {recursive:true});
fs.writeFileSync(output, JSON.stringify(createUnrealWorldManifest(world), null, 2) + '\n');
console.log(output);
