import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {WisdoIntentService} from '../services/wisdoIntentService.js';

const read=(path)=>fs.readFile(new URL('../'+path,import.meta.url),'utf8');

test('V18 Settings exposes real environment tabs instead of one profile-only card',async()=>{
  const source=await read('public/js/workspace.js');
  for(const label of ['presence','workstations','mt4','smart-home','voice','character','authority'])assert.match(source,new RegExp(label));
  assert.match(source,/\/api\/settings\/v1/);
  assert.match(source,/Home Assistant URL/);
  assert.match(source,/Discovered devices/);
  assert.match(source,/CampaignControlSymbol/);
  assert.match(source,/Character Customization/);
  assert.match(source,/Test arrival now/);
});

test('V18 durable settings and one-time edge secret tables are migrated',async()=>{
  const [migration,runner]=await Promise.all([
    read('migrations/2026-10-05-wisdo-settings-smart-home-v18.sql'),
    read('scripts/migratePostgres.js'),
  ]);
  for(const table of ['wisdo_user_runtime_settings','wisdo_smart_home_scenes','wisdo_device_secrets'])assert.match(migration,new RegExp(table));
  assert.match(migration,/ciphertext TEXT NOT NULL/);
  assert.match(migration,/claimed_at/);
  assert.match(runner,/2026-10-05-wisdo-settings-smart-home-v18\.sql/);
});

test('V18 settings APIs are session-authenticated and execute only through real control services',async()=>{
  const [routes,service,kernel]=await Promise.all([
    read('server/settingsHubRoutes.js'),
    read('services/wisdoSettingsHubService.js'),
    read('server/kernelRouteRegistry.js'),
  ]);
  assert.match(routes,/getSessionUser/);
  assert.match(routes,/\/api\/settings\/v1\/smart-home\/home-assistant\/connect/);
  assert.match(routes,/\/api\/settings\/v1\/smart-home\/execute/);
  assert.match(routes,/\/api\/settings\/v1\/scenes\/.*\/run/);
  assert.match(service,/universalControlService\.execute/);
  assert.match(service,/commandBusService\.issueSystemCommand/);
  assert.match(service,/createDeviceSecret/);
  assert.match(service,/Every scene target must be one of your discovered smart-home components/);
  assert.match(kernel,/registerSettingsHubRoutes/);
  assert.match(kernel,/setPresenceCoordinator/);
});

test('V18 secret claim erases encrypted cloud payload after the selected edge claims it',async()=>{
  const [bus,routes]=await Promise.all([read('services/wisdoCommandBusService.js'),read('server/commandBusRoutes.js')]);
  assert.match(bus,/encryptCredential/);
  assert.match(bus,/decryptCredential/);
  assert.match(bus,/ciphertext\s*=\s*['"]{2}|SET status=.*claimed.*ciphertext/i);
  assert.match(bus,/status='claimed'|status=\'claimed\'/);
  assert.match(routes,/\/api\/agent\/v1\/secrets\/:secretId/);
  assert.match(routes,/Cache-Control','no-store'|Cache-Control.*no-store/);
});

test('V18 Pi edge is a real Home Assistant bridge with discovery, execution and verified state reads',async()=>{
  const [edge,enroll,env]=await Promise.all([read('pi-edge/wisdo_edge.py'),read('pi-edge/enroll.py'),read('pi-edge/.env.example')]);
  assert.match(enroll,/home_assistant_config/);
  assert.match(edge,/\/api\/states/);
  assert.match(edge,/\/api\/services\/\{domain\}\/\{service\}/);
  assert.match(edge,/\/api\/control\/v1\/components\/register/);
  assert.match(edge,/\/api\/control\/v1\/executions\/lease/);
  assert.match(edge,/\/api\/control\/v1\/executions\/\{execution\["execution_id"\]\}\/complete/);
  assert.match(edge,/configure_home_assistant/);
  assert.match(edge,/HOME_ASSISTANT_CONFIG_FILE/);
  assert.match(env,/WISDO_HOME_ASSISTANT_SYNC_SECONDS/);
  for(const domain of ['light','switch','scene','climate','lock','cover','media_player','fan'])assert.match(edge,new RegExp("'"+domain+"'"));
});

test('V18 presence handles arrival and departure through saved scene settings',async()=>{
  const [routes,service,edge]=await Promise.all([read('server/commandBusRoutes.js'),read('services/wisdoSettingsHubService.js'),read('pi-edge/wisdo_edge.py')]);
  assert.match(routes,/presence\/arrive/);
  assert.match(routes,/presence\/depart/);
  assert.match(service,/handlePresenceArrival/);
  assert.match(service,/handlePresenceDeparture/);
  assert.match(service,/arrivalSceneId/);
  assert.match(service,/departureSceneId/);
  assert.match(edge,/event = 'arrive' if arrived else 'depart'/);
});

test('V18 desktop agent accepts verified workstation configuration from Settings',async()=>{
  const [agent,enroll]=await Promise.all([read('desktop-agent/agent.py'),read('desktop-agent/enroll.py')]);
  assert.match(agent,/configure_workstation/);
  assert.match(agent,/save_workstation_config/);
  assert.match(agent,/workstation-config\.json/);
  assert.match(agent,/The configured MetaTrader executable does not exist/);
  assert.match(enroll,/configure_workstation/);
});

test('V18 natural voice compiles smart-home and workstation language to ambient actions',()=>{
  const intent=new WisdoIntentService();
  const lights=intent.deterministic('Wisdo turn on the trading room lights');
  assert.equal(lights.type,'AMBIENT_ACTION');
  assert.equal(lights.parameters.componentType,'light');
  assert.equal(lights.parameters.action,'turn_on');
  const dim=intent.deterministic('dim the trading room lights to 30 percent');
  assert.equal(dim.type,'AMBIENT_ACTION');
  assert.equal(dim.parameters.action,'set_brightness');
  assert.equal(dim.parameters.parameters.brightness_pct,30);
  const temp=intent.deterministic('set the trading room thermostat to 72');
  assert.equal(temp.parameters.action,'set_temperature');
  const unlock=intent.deterministic('unlock the front door');
  assert.equal(unlock.type,'AMBIENT_ACTION');
  assert.equal(unlock.parameters.action,'unlock');
  const scene=intent.deterministic('activate my trading focus scene');
  assert.equal(scene.parameters.sceneName,'trading focus');
  const workstation=intent.deterministic('prepare my trading workstation');
  assert.equal(workstation.parameters.intent,'prepare_trading_workspace');
});

test('V18 high-risk ambient voice actions require confirmation and never share trading execution shortcuts',async()=>{
  const conversation=await read('services/wisdoConversationService.js');
  assert.match(conversation,/ambientControlService/);
  assert.match(conversation,/AMBIENT_ACTION/);
  assert.match(conversation,/ambient_confirmation_required|high-risk device action/);
  assert.match(conversation,/Confirm Coach, execute/);
  assert.match(conversation,/Completion still requires the device receipt|Completion is pending the enrolled edge or workstation receipt/);
});
