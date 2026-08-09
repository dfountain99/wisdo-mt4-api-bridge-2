import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { WisdoCommandBusService } from '../services/wisdoCommandBusService.js';
import { WisdoExecutionService } from '../services/wisdoExecutionService.js';
import { isProvenDemoAccount, WisdoSafetyService } from '../services/wisdoSafetyService.js';

const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('DEMO_ONLY accepts proven demo accounts and rejects live, unknown, or mixed targets',()=>{
  const safety=new WisdoSafetyService();
  assert.equal(isProvenDemoAccount({environment:'demo'}),true);
  assert.equal(isProvenDemoAccount({brokerServer:'Coinexx-Demo'}),true);
  assert.equal(isProvenDemoAccount({environment:'live'}),false);
  assert.doesNotThrow(()=>safety.assertVoiceExecutionMode([{environment:'demo'}],'DEMO_ONLY'));
  for(const accounts of [[{environment:'live'}],[{accountId:'unknown'}],[{environment:'demo'},{environment:'live'}]])assert.throws(()=>safety.assertVoiceExecutionMode(accounts,'DEMO_ONLY'),(error)=>error.code==='demo_only_live_blocked');
});

test('conversational queue boundary audits and blocks a live account before MT4 queueing',async()=>{
  const previous=process.env.WISDO_VOICE_EXECUTION_MODE;process.env.WISDO_VOICE_EXECUTION_MODE='DEMO_ONLY';
  let queued=0,audited=0;
  const execution=new WisdoExecutionService({pool:{},safetyService:new WisdoSafetyService(),getAuthorizedAccounts:async()=>[{accountId:'live-1',environment:'live'}],auditService:{record:async()=>{audited+=1;}},mt4CommandService:{queueCommandForAccount:async()=>{queued+=1;}}});
  try{await assert.rejects(execution.queue({userId:'u',accountId:'live-1',intent:'STOP_NEW_ENTRIES',commandName:'STOP_ENTRIES'}),(error)=>error.code==='demo_only_live_blocked');assert.equal(queued,0);assert.equal(audited,1);}finally{if(previous===undefined)delete process.env.WISDO_VOICE_EXECUTION_MODE;else process.env.WISDO_VOICE_EXECUTION_MODE=previous;}
});

test('direct Pi command-bus calls cannot bypass DEMO_ONLY',async()=>{
  const previous=process.env.WISDO_VOICE_EXECUTION_MODE;process.env.WISDO_VOICE_EXECUTION_MODE='DEMO_ONLY';let commandInsert=0,auditInsert=0;
  const context={safetyService:new WisdoSafetyService(),resolveTarget:async()=>({type:'bot',id:'bot-1',desktopDeviceId:'desktop-1',accountId:'live-1',metadata:{environment:'live'}}),pool:{query:async(sql)=>{if(sql.includes('wisdo_commands'))commandInsert+=1;if(sql.includes('wisdo_conversation_audit'))auditInsert+=1;return{rows:[]};}}};
  try{await assert.rejects(WisdoCommandBusService.prototype.issueCommand.call(context,{device_id:'pi',device_type:'pi-edge',owner_user_id:'u'},{intent:'pause_entries',target:{type:'bot',id:'bot-1'},source:'voice'}),(error)=>error.code==='demo_only_live_blocked');assert.equal(commandInsert,0);assert.equal(auditInsert,1);}finally{if(previous===undefined)delete process.env.WISDO_VOICE_EXECUTION_MODE;else process.env.WISDO_VOICE_EXECUTION_MODE=previous;}
});

test('all conversational surfaces converge on protected execution boundaries',()=>{
  assert.match(read('../index.js'),/channel: 'discord'/);
  assert.match(read('../server/conversationalVoiceRoutes.js'),/conversationService\.answer/);
  assert.match(read('../services/wisdoAudioService.js'),/conversationService\.answer/);
  assert.match(read('../services/wisdoPlanMonitorService.js'),/executionService\.queue/);
  assert.match(read('../services/wisdoExecutionService.js'),/assertVoiceExecutionMode/);
  assert.match(read('../services/wisdoCommandBusService.js'),/assertVoiceExecutionMode/);
});

test('release security controls cover rate limits, bounded queues, signatures, and receipt transitions',()=>{
  const audio=read('../services/wisdoAudioService.js'),routes=read('../server/commandBusRoutes.js');
  assert.match(routes,/enrollmentAttempts\.size>256/);assert.match(routes,/status\(429\)/);
  assert.match(audio,/maxUtterancesPerMinute/);assert.match(audio,/maxPendingDeliveries/);
  assert.match(audio,/audio_content_mismatch/);assert.match(audio,/invalid_playback_transition/);
});

test('Pi package is pinned, least-privilege, restart-safe, and rollback-ready',()=>{
  const install=read('../pi-edge/install.sh');
  const uninstall=read('../pi-edge/uninstall.sh');
  const requirements=read('../pi-edge/requirements.txt').trim().split(/\r?\n/);
  const edge=read('../pi-edge/wisdo_edge.py');
  assert.ok(requirements.length>=5);
  assert.ok(requirements.every((line)=>/^[A-Za-z0-9_.-]+==[^=\s]+$/.test(line)));
  assert.match(install,/id -u "\$SERVICE_USER"/);
  assert.match(install,/chmod 0640 "\$ROOT\/\.env"/);
  assert.match(install,/NoNewPrivileges=true/);
  assert.match(install,/ProtectSystem=strict/);
  assert.match(install,/Restart=always/);
  assert.match(uninstall,/Service removed\. Runtime data remains/);
  assert.match(edge,/played-deliveries/);
  assert.match(edge,/temporary\.replace\(PLAYED_FILE\)/);
  assert.match(edge,/unlink\(missing_ok=True\)/);
  assert.doesNotMatch(edge,/print\([^\n]*(?:device_token|DEVICE_TOKEN)/i);
});

test('Pi release manifest is complete and every packaged file checksum matches',()=>{
  const manifest=JSON.parse(read('../pi-edge/release-manifest.json'));
  assert.equal(manifest.piRuntimeVersion,read('../pi-edge/VERSION').trim());
  assert.equal(manifest.reporterRequirement,'v1.59');
  assert.equal(manifest.voiceExecutionMode,'DEMO_ONLY');
  assert.equal(manifest.serverCommit,'RESOLVE_FROM_ENCLOSING_GIT_COMMIT');
  for(const [name,expected] of Object.entries(manifest.sha256)){
    const bytes=readFileSync(new URL(`../pi-edge/${name}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,name);
  }
});
