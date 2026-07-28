import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
test('master kernel registers universal control plane',()=>{const api=read('../server/apiServer.js');const kernel=read('../server/kernelRouteRegistry.js');assert.match(api,/registerWisdoKernelRoutes/);assert.match(kernel,/registerUniversalControlRoutes/);});
test('universal control supports bot and website actions',()=>{const r=read('../server/universalControlRoutes.js');assert.match(r,/components\/register/);assert.match(r,/website\/actions/);assert.match(r,/control\/v1\/execute/);});
test('migration contains durable control entities',()=>{const m=read('../scripts/migratePostgres.js');for(const t of['wisdo_components','wisdo_control_executions','wisdo_browser_events','wisdo_missions','wisdo_event_ledger'])assert.match(m,new RegExp(t));});
