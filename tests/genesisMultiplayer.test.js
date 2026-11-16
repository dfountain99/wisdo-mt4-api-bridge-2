import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GenesisMultiplayerPresence} from '../server/genesisMultiplayer.js';
import {createGenesisProfile,applyGenesisAction} from '../services/genesisGameService.js';

test('100 players fit, 101st is refused, and stale sessions expire',()=>{
  let now=100000;
  const presence=new GenesisMultiplayerPresence({clock:()=>now});
  for(let i=0;i<100;i++)presence.join('user-'+i,{speed:5});
  assert.equal(presence.nearby('user-0').online,100);
  assert.throws(()=>presence.join('user-100'),e=>e.status===503);
  now+=30001;
  presence.join('user-100',{speed:5});
  assert.equal(presence.nearby('user-100').online,1);
});

test('nearby snapshots limit mobile rendering and never expose account IDs',()=>{
  const presence=new GenesisMultiplayerPresence({clock:()=>100});
  presence.join('me');
  for(let i=0;i<60;i++){
    presence.join('private-'+i);
    presence.teleport('private-'+i,{x:10+i,z:0},100);
  }
  presence.join('distant');
  presence.teleport('distant',{x:500,z:500},100);
  const result=presence.nearby('me');
  assert.equal(result.online,62);
  assert.equal(result.capacity,100);
  assert.equal(result.players.length,24);
  assert.ok(result.players.every(p=>p.x<=33&&!('userId' in p)));
  assert.ok(result.players.every(p=>/^[0-9a-f]{12}$/.test(p.id)));
  assert.equal(new Set(result.players.map(p=>p.id)).size,24);
});

test('repeated requests cannot multiply movement distance allowance',()=>{
  const presence=new GenesisMultiplayerPresence({clock:()=>1000});
  presence.join('runner',{speed:5,now:1000});
  let accepted=0;
  for(let i=1;i<=100;i++){
    if(presence.move('runner',{x:accepted+.5,z:0},1000+i*10).ok)
      accepted+=.5;
  }
  assert.ok(accepted>=5&&accepted<=8.1,'movement stays in one-second budget');
});

test('fast travel resets movement credit',()=>{
  const presence=new GenesisMultiplayerPresence({clock:()=>5000});
  presence.join('a',{speed:5,now:5000});
  presence.teleport('a',{x:800,z:-200},5000);
  assert.equal(presence.move('a',{x:805,z:-200},5000).ok,false);
  assert.equal(presence.move('a',{x:805,z:-200},6000).ok,true);
});

test('inherited object keys do not grant companion ownership',()=>{
  const profile=createGenesisProfile('owner');
  for(const body of [
    {action:'nameCreature',echoId:'__proto__',name:'Intruder'},
    {action:'commandCreature',echoId:'__proto__',command:'follow'},
  ]){
    assert.throws(()=>applyGenesisAction(profile,body,{x:0,z:0}),/do not own/);
  }
});

test('browser and authenticated routes wire nearby-player snapshots',()=>{
  const routes=readFileSync(new URL('../server/genesisRoutes.js',import.meta.url),'utf8');
  const client=readFileSync(new URL('../public/js/genesisWorld.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../public/genesis.html',import.meta.url),'utf8');
  assert.match(routes,/app\.get\('\/api\/genesis\/players',auth/);
  assert.match(client,/syncNearbyPlayers\(await api\('\/api\/genesis\/players'\)\)/);
  assert.match(html,/id="online-count"/);
});