import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compileHolographicPreview} from '../services/holographicBlueprintService.js';
import {validateWorldManifest,validateWorldPlan} from '../services/worldSpatialPlanner.js';
const prompt='Aurelia Prime futuristic island kingdom with mountains, water, forest, city, tower and portal';
test('Aurelia Prime plans distinct regions, dimensions and stable IDs',()=>{
 const preview=compileHolographicPreview(prompt);assert.equal(preview.truth.valid,true);
 assert.equal(preview.world.width,2400);assert.equal(new Set(preview.operations.map(o=>o.id)).size,preview.operations.length);
 for(const op of preview.operations.filter(o=>o.type.startsWith('CREATE_'))){assert.ok(op.region);assert.ok(op.dimensions.x>0);assert.deepEqual(op.position,op.payload.position)}
 const byType=Object.fromEntries(preview.operations.map(o=>[o.type,o]));
 assert.ok(byType.CREATE_MOUNTAIN_RANGE.position.z<0);assert.ok(byType.CREATE_FOREST.position.x<0);assert.deepEqual(byType.CREATE_TOWER.position,{x:0,y:0,z:0});assert.ok(byType.CREATE_PORTAL.position.x>0);
 assert.equal(validateWorldManifest({operations:preview.operations,intent:{ideas:preview.ideas},spawn:{x:0,y:1.8,z:600}}).valid,true);
});
test('Forge truth rejects omitted concepts, overlap, invalid scale, and spawn',()=>{
 const preview=compileHolographicPreview(prompt), operations=structuredClone(preview.operations);
 operations.splice(operations.findIndex(o=>o.type==='CREATE_TOWER'),1);
 assert.ok(validateWorldPlan(operations,preview.ideas).errors.some(e=>e.code==='REQUESTED_CONCEPT_MISSING'));
 const invalid=structuredClone(preview.operations);const portal=invalid.find(o=>o.type==='CREATE_PORTAL');portal.position={...invalid.find(o=>o.type==='CREATE_TOWER').position};portal.payload.position=portal.position;portal.dimensions.x=-3;
 const result=validateWorldPlan(invalid,preview.ideas);assert.ok(result.errors.some(e=>e.code==='INVALID_X'));assert.ok(result.errors.some(e=>e.code==='STRUCTURE_OVERLAP'));
 assert.ok(validateWorldManifest({operations:preview.operations,intent:{ideas:preview.ideas},spawn:{x:1800,y:0,z:0}}).errors.some(e=>e.code==='INVALID_SPAWN'));
 assert.ok(validateWorldManifest({operations:preview.operations,intent:{ideas:preview.ideas},spawn:{x:0,y:1.8,z:6}}).errors.some(e=>e.code==='SPAWN_INTERSECTS_STRUCTURE'));
});
test('golden fixture is a shared spatial contract',()=>{
 const fixture=JSON.parse(fs.readFileSync('public/app/world/fixtures/golden-world.json'));
 assert.equal(validateWorldManifest(fixture).valid,true);
 const ue=fs.readFileSync('unreal/WisdoWorld/Source/WisdoWorld/WorldRuntimeActor.cpp','utf8');
 for(const phrase of ['Dimension(Data,TEXT("x")','Position(Data','Operation.Id'])assert.ok(ue.includes(phrase));
});
