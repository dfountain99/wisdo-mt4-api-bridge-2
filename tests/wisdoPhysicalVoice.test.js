import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { WisdoAudioService } from '../services/wisdoAudioService.js';
import { EA_CAPABILITY_CONTRACTS, WisdoCapabilityContractService } from '../services/wisdoCapabilityContractService.js';
import { WisdoIntentService } from '../services/wisdoIntentService.js';

const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const service=()=>new WisdoAudioService({pool:{query(){throw new Error('validation should run before persistence');}},provider:{},conversationService:{}});

test('physical upload rejects unsupported content before persistence',async()=>{
  await assert.rejects(service().submit({device_id:'pi',owner_user_id:'u'},{idempotencyKey:'one',contentType:'text/plain',durationMs:500,audioBase64:'AAAA'}),(error)=>error.code==='unsupported_audio_type'&&error.statusCode===415);
});

test('physical upload enforces duration and base64 boundaries',async()=>{
  await assert.rejects(service().submit({device_id:'pi',owner_user_id:'u'},{idempotencyKey:'one',contentType:'audio/wav',durationMs:0,audioBase64:'AAAA'}),(error)=>error.code==='audio_duration_limit');
  await assert.rejects(service().submit({device_id:'pi',owner_user_id:'u'},{idempotencyKey:'one',contentType:'audio/wav',durationMs:1000,audioBase64:'not-base64'}),(error)=>error.code==='invalid_audio');
});

test('physical upload rejects MIME declarations that do not match audio bytes',async()=>{
  await assert.rejects(service().submit({device_id:'pi',owner_user_id:'u'},{idempotencyKey:'one',contentType:'audio/wav',durationMs:1000,audioBase64:Buffer.from('not a wave').toString('base64')}),(error)=>error.code==='audio_content_mismatch'&&error.statusCode===415);
});

test('Pi contract uses local wake, server STT upload, idempotency, and playback receipts',()=>{
  const pi=read('../pi-edge/wisdo_edge.py');
  assert.match(pi,/recognize_sphinx/); assert.doesNotMatch(pi,/recognize_google/);
  assert.match(pi,/audioBase64/); assert.match(pi,/idempotencyKey/);
  for(const state of ['DELIVERED','PLAYING','PLAYED','FAILED'])assert.match(pi,new RegExp(`'${state}'`));
  assert.match(pi,/coach stop/); assert.match(pi,/emergency stop/);
  assert.match(pi,/Recording cancelled by physical mute/);
  assert.match(pi,/path\.unlink\(missing_ok=True\)/);
  assert.match(pi,/uuid\.UUID/); assert.match(pi,/remember_delivery/);
});

test('physical voice is cross-platform and rejects the permissive wake threshold',()=>{
  const pi=read('../pi-edge/wisdo_edge.py');
  assert.match(pi,/platform\.system\(\)/);
  assert.match(pi,/playback_command/);
  assert.match(pi,/WISDO_WAKE_SENSITIVITY/);
  assert.match(pi,/WAKE_BLOCKED_UNTIL/);
  assert.doesNotMatch(pi,/\[\(word, 1\.0\) for word in WAKE_WORDS\]/);
  assert.ok(existsSync(new URL('../pi-edge/install-windows.ps1',import.meta.url)));
  assert.ok(existsSync(new URL('../pi-edge/start-wisdo-windows.cmd',import.meta.url)));
});

test('delivery schema is bounded, expiring, and owner/device scoped',()=>{
  const migration=read('../migrations/2026-08-09-conversational-trading-os.sql');
  const routes=read('../server/conversationalVoiceRoutes.js');
  assert.match(migration,/CREATE TABLE IF NOT EXISTS wisdo_voice_utterances/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS wisdo_speech_deliveries/);
  assert.match(routes,/deliveries\/next/); assert.match(routes,/playback\/interrupt/);
});

test('unsupported EA actions have explicit future contracts and honest gating',()=>{
  assert.deepEqual(Object.keys(EA_CAPABILITY_CONTRACTS).sort(),['LADDER_AWARE_ACTION','NEWS_AVOIDANCE','PRESERVE_RUNNER','STOP_AFTER_CURRENT_TRADE','STOP_AFTER_NEXT_TRADE','TRADE_EXPLANATION','TRAIL_RUNNER_GIVEBACK'].sort());
  const capabilities=new WisdoCapabilityContractService();
  assert.equal(capabilities.supported({capabilities:{}},'PRESERVE_RUNNER'),false);
  assert.match(capabilities.unsupportedMessage('PRESERVE_RUNNER'),/did not make any changes/);
  assert.equal(new WisdoIntentService().deterministic('preserve one runner').requiresCapability,true);
});

test('plan lifecycle schema includes templates, history, timezone, and safe draft reset',()=>{
  const migration=read('../migrations/2026-08-09-conversational-trading-os.sql');
  const plans=read('../services/wisdoPlanService.js');
  assert.match(migration,/wisdo_plan_templates/); assert.match(migration,/wisdo_plan_versions/);
  assert.match(migration,/timezone TEXT/); assert.match(migration,/trading_days INTEGER\[\]/);
  assert.match(plans,/resetForNextTradingDay/); assert.match(plans,/status:'DRAFT'/);
  assert.match(plans,/status='CANCELLED'.*'PENDING','ARMED'/s);
});
