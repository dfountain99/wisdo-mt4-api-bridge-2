import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultWorldDNA } from '../services/worldDNAService.js';
import { applyMutation, undoWorldMutation, redoWorldMutation, validateMutation } from '../services/worldMutationService.js';

test('Genesis mutation runtime creates stable persistent objects',()=>{
 const dna=createDefaultWorldDNA({id:'genesis-user',username:'Creator'});
 const r=applyMutation(dna,{type:'CREATE',objectType:'castle',name:'High Castle',position:{x:4,y:2,z:-8},scale:{x:5,y:8,z:5},material:'gold-stone'},{userId:'genesis-user'});
 assert.equal(r.dna.objects.length,1);assert.match(r.mutation.objectId,/^obj_/);assert.equal(r.dna.objects[0].name,'High Castle');assert.equal(r.dna.history.revisions.length,1);
});
test('Genesis history supports undo and redo without changing world identity',()=>{
 const dna=createDefaultWorldDNA({id:'genesis-user',username:'Creator'});
 const built=applyMutation(dna,{type:'CREATE',objectType:'tower',position:{x:1,y:1,z:1}},{userId:'genesis-user'}).dna;
 const undone=undoWorldMutation(built);assert.equal(undone.changed,true);assert.equal(undone.dna.objects.length,0);assert.equal(undone.dna.worldId,'planet:genesis-user');
 const redone=redoWorldMutation(undone.dna);assert.equal(redone.changed,true);assert.equal(redone.dna.objects.length,1);
});
test('mutation validation rejects arbitrary operations',()=>{assert.throws(()=>validateMutation({type:'EXECUTE_JAVASCRIPT',value:'alert(1)'}),/unsupported_world_mutation/)});
test('gameplay modules mutate declaratively',()=>{
 let dna=createDefaultWorldDNA({id:'g',username:'G'});
 dna=applyMutation(dna,{type:'ACTIVATE_MODULE',module:'combat'},{userId:'g'}).dna;assert.ok(dna.gameplay.modules.includes('combat'));
 dna=applyMutation(dna,{type:'DEACTIVATE_MODULE',module:'combat'},{userId:'g'}).dna;assert.ok(!dna.gameplay.modules.includes('combat'));
});
