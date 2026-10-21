import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url);
const load=p=>readFileSync(new URL(p,root),'utf8');
test('Live Manager forwards all Sonic and scheduled behavior parameters through proposal transport',()=>{
 const runtime=load('public/app/world/command/command-runtime.js');
 for(const field of ['burstCount','durationSeconds','eaCampaignId','slotMasks','requestedDirection'])assert.match(runtime,new RegExp(field+': options\\.'+field));
});
test('missing broker equity cannot be silently normalized to zero',()=>{
 const svc=load('services/worldCampaignStateService.js');
 assert.match(svc,/value == null \|\| value === ''/);
 assert.match(svc,/equity: finite\(snapshot\.equity, null\)/);
});
test('Reporter-only delivery is visibly distinct from broker execution',()=>{
 const view=load('public/app/world/command/command-center-runtime.js');
 assert.match(view,/r\.deliveryOnly && status==='completed'/);
 assert.match(view,/status==='completed'&&!r\.deliveryOnly/);
});
