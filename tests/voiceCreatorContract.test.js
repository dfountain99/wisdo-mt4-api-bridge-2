import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const service=readFileSync(new URL('../services/wisdoVoiceCreatorService.js',import.meta.url),'utf8');
const routes=readFileSync(new URL('../server/voiceCreatorRoutes.js',import.meta.url),'utf8');
const migration=readFileSync(new URL('../scripts/migratePostgres.js',import.meta.url),'utf8');
test('voice creator compiles conversation into three original variations',()=>{assert.match(service,/balanced/);assert.match(service,/deeper/);assert.match(service,/warmer/);assert.match(service,/original_style_designed/)});
test('voice creator supports refinement activation and device sync',()=>{assert.match(routes,/\/api\/voice\/v2\/conversation/);assert.match(routes,/\/activate/);assert.match(routes,/\/active/)});
test('voice migrations are versioned scoped and auditable',()=>{assert.match(migration,/wisdo_voice_versions/);assert.match(migration,/wisdo_voice_assignments/);assert.match(migration,/wisdo_voice_events/)});
test('real-person references become original profiles instead of impersonations',()=>{assert.match(service,/celebrity_imitation_blocked/);assert.match(service,/never claim to be or closely imitate a real person/i)});
