import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureLivingOsState,getLivingUser,createMission,updateMission,saveWorkspace,createAutomation,rememberAiObservation,pairDevice,livingSnapshot } from '../services/livingOperatingSystemService.js';

test('Living OS creates one durable member operating state',()=>{
  const state=ensureLivingOsState({}); const user={id:'member-7',username:'Derrion'}; const row=getLivingUser(state,user);
  assert.equal(row.userId,'member-7'); assert.ok(row.missions.length>=3); assert.ok(row.workspaces.length>=3);
  const same=getLivingUser(state,user); assert.equal(same.createdAt,row.createdAt);
});

test('missions reward once and workspaces persist operating context',()=>{
  const state={}; const user={id:'member-7'}; const mission=createMission(state,user,{title:'Test mission',target:1,rewardCredits:12});
  updateMission(state,user,mission.id,{progress:1}); updateMission(state,user,mission.id,{progress:1});
  assert.equal(getLivingUser(state,user).credits,12);
  const workspace=saveWorkspace(state,user,{name:'Gold Desk',path:'/app/analyzer',accountId:'123',mode:'focus',isDefault:true});
  assert.equal(workspace.accountId,'123'); assert.equal(getLivingUser(state,user).workspaces.find(x=>x.isDefault).name,'Gold Desk');
});

test('automation, memory and device layers appear in Nexus snapshot',()=>{
  const state={}; const user={id:'member-7'};
  createAutomation(state,user,{trigger:'drawdown_above',value:5,action:'pause_copier'});
  rememberAiObservation(state,user,{text:'Gold performs best during London.',confidence:88});
  pairDevice(state,user,{name:'Culture Band Alpha',type:'culture_band',battery:95});
  const snapshot=livingSnapshot(state,user);
  assert.equal(snapshot.automations.length,1); assert.equal(snapshot.aiMemory.observations.length,1); assert.equal(snapshot.devices.length,1); assert.ok(snapshot.briefing.score.overall>=0);
});
