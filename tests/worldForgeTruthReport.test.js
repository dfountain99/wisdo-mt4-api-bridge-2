import test from 'node:test';
import assert from 'node:assert/strict';
import {compileHolographicPreview} from '../services/holographicBlueprintService.js';
import {compileApprovedForgePreview,buildForgeTruthReport,applyBabylonObservation} from '../services/worldForgeTruthService.js';
const prompt='Create Aurelia Prime, a futuristic island kingdom with deep blue water, mountains, WISDO tower, modern city buildings, forest, portal and a spawn plaza.';
const draft={name:'Aurelia Prime',description:prompt,approved:true,preview:{operations:[{type:'CREATE_TOWER',payload:{}}]}};
function world(){const preview=compileApprovedForgePreview(draft);return {worldId:'world:operator',name:draft.name,description:prompt,revision:7,forgeOperations:preview.operations,intent:{ideas:preview.ideas},spawn:{x:0,y:1.8,z:600}}}
test('old approved preview without truth recompiles instead of MISSING_TRUTH_REPORT',()=>{
 const p=compileApprovedForgePreview(draft);assert.equal(p.truth.valid,true);assert.ok(p.operations.some(o=>o.type==='CREATE_OCEAN'));
 assert.throws(()=>compileApprovedForgePreview({...draft,approved:false}),/approved_blueprint_required/);
});
test('structural truth cannot invent visible or executed operations',()=>{
 const report=buildForgeTruthReport(world());assert.equal(report.status,'PENDING_VISUAL');assert.equal(report.forgeStatus,'awaiting_visual');
 assert.equal(report.executed,null);assert.equal(report.visible,null);assert.equal(report.spawnStatus,'PASS');
 for(const name of ['terrain','water','mountains','tower','buildings','forest','portal','spawn'])assert.notEqual(report.requirements[name].status,'MISSING');
});
test('Babylon observation is pinned to exact operation IDs, revision, bounds and camera',()=>{
 const w=world(),structural=buildForgeTruthReport(w),operations=w.forgeOperations.filter(o=>o.type.startsWith('CREATE_')).map(o=>({id:o.id,type:o.type,meshCount:1,visible:true,inCamera:true,bounds:{min:{x:o.position.x-1,y:o.position.y,z:o.position.z-1},max:{x:o.position.x+1,y:o.position.y+1,z:o.position.z+1}}}));
 const observation={worldId:w.worldId,manifestVersion:w.revision,operations,cameraFraming:true,worldBounds:{min:{x:-1400,y:-2,z:-1400},max:{x:1400,y:180,z:1400}}};
 const pass=applyBabylonObservation(structuredClone(structural),w,observation);assert.equal(pass.status,'PASS');assert.equal(pass.visible,operations.length);assert.equal(pass.forgeStatus,'composition_pending');assert.equal(pass.babylonCertification,'PENDING');
 assert.equal(applyBabylonObservation(structuredClone(structural),w,{...observation,operations:operations.map((o,i)=>i?o:{...o,visible:false})}).status,'FAIL');
 assert.throws(()=>applyBabylonObservation(structuredClone(structural),w,{...observation,manifestVersion:8}),/version_mismatch/);
 assert.throws(()=>applyBabylonObservation(structuredClone(structural),w,{...observation,operations:operations.slice(1)}),/operation_set_mismatch/);
 const misplaced=structuredClone(operations);misplaced[0].bounds={min:{x:5000,y:0,z:5000},max:{x:5001,y:1,z:5001}};
 assert.ok(applyBabylonObservation(structuredClone(structural),w,{...observation,operations:misplaced}).invalid.some(e=>e.code==='WRONG_REGION'));
});
