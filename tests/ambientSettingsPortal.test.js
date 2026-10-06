import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { ambientSettingsPage, ambientLifeOsPage, smartHomeTrustCenterPage } from '../server/ambientSettingsView.js';
import { WisdoAmbientLifeService } from '../services/wisdoAmbientLifeService.js';

const source = await readFile(new URL('../server/deadshotSite.js', import.meta.url), 'utf8');
test('live portal registers Settings and Ambient pages behind its membership guard', async () => {
  const routes = new Map();
  let role = 'guest';
  const context = { app: { get: (path, handler) => routes.set(path, handler) }, loadLiveState: async()=>({}), resolveMembership: async()=>({role}), config:{}, getRequestedAccountId:()=>'', shell:x=>x, pageTitle:x=>x, portalPage:x=>x };
  const begin = source.indexOf("  for (const page of ['dashboard'");
  const end = source.indexOf('  // Friendly aliases', begin);
  vm.runInNewContext(source.slice(begin,end), context);
  for (const path of ['/app/settings','/app/life-os','/app/smart-home']) {
    assert.ok(routes.has(path), path);
    let redirect, sent;
    const response = {redirect:x=>redirect=x,send:x=>sent=x};
    await routes.get(path)({query:{}},response);
    assert.match(redirect,/^\/login/);
    assert.equal(sent,undefined);
    role='free'; redirect=undefined;
    await routes.get(path)({query:{}},response);
    assert.equal(sent.active,path);
    role='guest';
  }
  const nav = source.slice(source.indexOf('const PORTAL_NAV'), source.indexOf('const ADMIN_NAV'));
  for(const path of ['/app/settings','/app/life-os','/app/smart-home']) assert.ok(nav.includes(path));
});

test('settings routes render real forms and disclose unsupported runtime capabilities', () => {
  const hub=ambientSettingsPage(), life=ambientLifeOsPage(), home=smartHomeTrustCenterPage();
  for(const anchor of ['rooms','household','missions','policies','truth','offline']) {
    assert.ok(hub.includes('/app/life-os#'+anchor));
    assert.ok(life.includes('id="'+anchor+'"'));
  }
  assert.match(life,/id="memberExpires" type="datetime-local"/);
  assert.match(life,/id="ambientPolicyForm"/);
  assert.match(life,/data-ambient-home/);
  assert.doesNotMatch(life,/missionWorkstation" type="checkbox" checked/);
  assert.match(home,/id="createHome"/);
  assert.match(hub,/Not available yet/);
});

test('home scoped settings reject a foreign home before writing',async()=>{
  let writes=0;
  const service=new WisdoAmbientLifeService({pool:{query:async()=>{writes++;return {rows:[{}]};}},universalControlService:{assertOwnedHome:async()=>{throw new Error('Home not owned');}}});
  for(const method of ['savePolicy','saveHouseholdMember','createMission']) await assert.rejects(service[method]({owner_user_id:'u1'},{homeId:'foreign',steps:[{type:'mode',mode:'family'}]}),/not owned/);
  assert.equal(writes,0);
});

test('settings cannot overwrite another owner identifier; failed saves are not success',async()=>{
  const service=new WisdoAmbientLifeService({pool:{query:async(sql)=>{assert.match(sql,/WHERE wisdo_\w+\.owner_user_id=EXCLUDED.owner_user_id/);return {rows:[]};}},universalControlService:{assertOwnedHome:async()=>{}}});
  for(const method of ['savePolicy','saveHouseholdMember','createMission']) await assert.rejects(service[method]({owner_user_id:'u1'},{homeId:'mine',steps:[{type:'mode',mode:'family'}]}),{statusCode:404});
});

test('household expiry is validated and preserved in durable save arguments',async()=>{
  let captured;
  const service=new WisdoAmbientLifeService({pool:{query:async(sql,args)=>{captured=args;return {rows:[{member_id:args[0],expires_at:args[6]}]};}},universalControlService:{assertOwnedHome:async()=>{}}});
  const input={homeId:'mine',role:'GUEST',displayName:'Guest',expiresAt:new Date(Date.now()+3600000).toISOString()};
  const saved=await service.saveHouseholdMember({owner_user_id:'u1'},input);
  assert.equal(saved.expires_at,input.expiresAt);
  assert.equal(captured[1],'u1');
  for(const expiresAt of ['bad','2000-01-01']) await assert.rejects(service.saveHouseholdMember({owner_user_id:'u1'},{...input,expiresAt}),{statusCode:400});
});

test('browser saves house rules and temporary members without executing missions', async()=>{
  const script=await readFile(new URL('../public/js/ambient-life-os.js',import.meta.url),'utf8');
  const nodes=new Map(), calls=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,dataset:{},addEventListener(type,fn){this[type]=fn;},querySelector(){return {disabled:false};}});return nodes.get(id);};
  const empty={ok:true,missions:[],zones:[],household:[],policies:{defaults:[],custom:[]},runs:[],truth:[]};
  const document={getElementById:node,querySelectorAll:()=>[]};
  vm.runInNewContext(script,{document,fetch:async(url,options={})=>{calls.push({url,body:options.body?JSON.parse(options.body):null});return {ok:true,json:async()=>url.endsWith('onboarding')?{ok:true,homes:[]}:empty};},alert:message=>{throw new Error(message);},confirm:()=>{throw new Error('Settings must not confirm execution');},console,Date,setTimeout});
  node('policyName').value='No cameras';node('policyHomeId').value='home1';node('policyPreset').value='camera';
  await node('ambientPolicyForm').submit({preventDefault(){},currentTarget:node('ambientPolicyForm')});
  const policy=calls.find(c=>c.url.endsWith('/policies')).body;
  assert.equal(policy.homeId,'home1');assert.equal(policy.effect,'deny');assert.deepEqual(policy.match.deviceClasses,['CAMERA']);
  node('memberRole').value='TECHNICIAN';node('memberHomeId').value='home1';node('memberName').value='Installer';node('memberExpires').value='2099-01-01T16:00';
  await node('addHousehold').click();
  const member=calls.find(c=>c.url.endsWith('/household')).body;
  assert.equal(member.homeId,'home1');assert.equal(member.role,'TECHNICIAN');assert.ok(member.expiresAt.endsWith('Z'));
  assert.equal(calls.filter(c=>c.url.endsWith('/run')).length,0);
});
