import fs from 'node:fs';
import path from 'node:path';
import { compileHolographicPreview } from '../services/holographicBlueprintService.js';
import { createUnrealWorldManifest } from '../services/unrealWorldManifestService.js';

// Same Genesis compiler and Forge manifest contract; no Unreal-only prompt parser.
const prompt = 'Mountain kingdom surrounded by water with a huge futuristic tower in the center.';
const preview = compileHolographicPreview(prompt);
const world = {
  worldId: 'fixture:mountain-kingdom', buildStatus: 'forged', revision: 1,
  name: 'Mountain Kingdom', theme: 'future', terrain: {type: 'spawn-island'},
  spawn: {x:0,y:1,z:6}, zones: [{id:'spawn',type:'spawn-island',walkable:true}],
  buildings: preview.operations.filter(op => op.type === 'CREATE_TOWER').map((op,i) =>
    ({id:`structure-${i}`,type:'tower',name:op.payload.name,position:op.payload.position})),
  objects: [], portals: [], forgeOperations: preview.operations,
};
const output = path.resolve('unreal/WisdoWorld/Content/WISDO/Fixtures/mountain_kingdom.json');
fs.mkdirSync(path.dirname(output), {recursive:true});
fs.writeFileSync(output, JSON.stringify(createUnrealWorldManifest(world), null, 2) + '\n');
console.log(output);
