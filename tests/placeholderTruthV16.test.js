import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=(path)=>fs.readFile(new URL('../'+path,import.meta.url),'utf8');

test('V16 Aether exposes only live navigation targets',async()=>{
  const html=await read('public/app/world/aether-lobby/index.html');
  assert.doesNotMatch(html,/PARTY SOON|LOCKER SOON|SHOP SOON|Not live yet/i);
  assert.match(html,/href="\/app\/world\?scene=genesis">GENESIS<\/a>/);
  assert.match(html,/href="\/app\/world\?scene=city">WISDO CITY<\/a>/);
});

test('V16 Studio records creations only after real service acceptance',async()=>{
  const html=await read('public/app/studio/index.html');
  assert.match(html,/Only creations accepted by a real WISDO service/);
  assert.match(html,/Not generated ·/);
  const audioFetch=html.indexOf("fetch('/api/wisdo/media/audio-program'");
  const audioRemember=html.indexOf("remember('audio'");
  const videoFetch=html.indexOf("fetch('/api/wisdo/media/video'");
  const videoRemember=html.indexOf("remember('video'");
  const musicFetch=html.indexOf("fetch('/api/wisdo/music/compose'");
  const musicRemember=html.lastIndexOf("remember('music'");
  assert.ok(audioFetch>=0&&audioRemember>audioFetch);
  assert.ok(videoFetch>=0&&videoRemember>videoFetch);
  assert.ok(musicFetch>=0&&musicRemember>musicFetch);
  assert.doesNotMatch(html,/Saved request\.|server adapter still needs to be connected/i);
});

test('V16 workspace atmosphere calls the real video route and cannot fake a pending provider event',async()=>{
  const source=await read('public/js/workspace.js');
  assert.match(source,/fetch\('\/api\/wisdo\/media\/video'/);
  assert.match(source,/status:'unavailable'/);
  assert.doesNotMatch(source,/wisdo:video-request['"]/);
  assert.doesNotMatch(source,/Provider adapters can answer this event/);
});

test('V16 provider failures and scanner state fail closed instead of returning fake success',async()=>{
  const [extended,api]=await Promise.all([read('server/extendedProductRoutes.js'),read('server/apiServer.js')]);
  assert.match(extended,/WISDO_AI_NOT_CONFIGURED/);
  assert.match(extended,/WISDO_AI_PROVIDER_FAILED/);
  assert.doesNotMatch(extended,/provider:\s*'rule_fallback'/);
  assert.match(api,/blocked_unscanned/);
  assert.match(api,/trusted:\s*false/);
  assert.doesNotMatch(api,/pending_hook/);
});

test('V16 Living OS does not claim automation execution or hardware pairing without a live executor',async()=>{
  const [service,routes]=await Promise.all([read('services/livingOperatingSystemService.js'),read('server/livingOperatingSystemRoutes.js')]);
  assert.match(service,/enabled:false,executionState:'definition_only'/);
  assert.match(service,/Automation execution is not connected/);
  assert.match(service,/status:'registered'/);
  assert.doesNotMatch(service,/status:'paired'/);
  assert.match(routes,/DEFINITION ONLY/);
  assert.match(routes,/Device Registry/);
  assert.doesNotMatch(routes,/Rules active|Paired Culture devices|Pair prototype/);
});

test('V16 removes fabricated education progress and future-feature copy',async()=>{
  const source=await read('server/deadshotSite.js');
  assert.doesNotMatch(source,/Add this to the future AI support layer/);
  assert.doesNotMatch(source,/--ringValue:76%/);
  assert.match(source,/Available learning modules/);
});

test('V16 Street Sprint states local-mode limits without future placeholder controls',async()=>{
  const html=await read('public/app/world/experiences/street-sprint.html');
  assert.doesNotMatch(html,/not live yet|coming soon/i);
  assert.match(html,/does not create multiplayer sessions, send phone alerts, or credit Culture Coin wallet rewards/);
});

test('V16 deterministic trade insight never masquerades as an AI fallback',async()=>{
  const routes=await read('server/majorUpgradeRoutes.js');
  assert.doesNotMatch(routes,/gateway_ready_rule_fallback|rule_fallback/);
  assert.match(routes,/provider:'rule_engine'/);
  assert.match(routes,/aiGenerated:false/);
  assert.match(routes,/dataSource:'measured_trade_ledger'/);
});
