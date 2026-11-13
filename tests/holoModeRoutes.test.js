import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAllowedEntities, sanitizeHomeEntities, validateHomeAction,
  isTrustedWriteOrigin, isHomeOwner, registerHoloModeRoutes,
} from '../server/holoModeRoutes.js';
import { encodeSignedSession } from '../server/security.js';

test('device allowlist excludes locks, alarms and malformed entities', () => {
  assert.deepEqual(
    parseAllowedEntities('light.kitchen, switch.fan,lock.front_door,alarm_control_panel.home,light.kitchen,light.evil/path'),
    ['light.kitchen','switch.fan']
  );
});

test('entities are allowlisted, sanitized and do not leak attributes', () => {
  const values = sanitizeHomeEntities([
    { entity_id: 'light.kitchen', state: 'on', attributes: { friendly_name: 'Kitchen', secret: 'do not share' } },
    { entity_id: 'lock.front', state: 'locked', attributes: { friendly_name: 'Front' } },
  ], ['light.kitchen']);
  assert.deepEqual(values, [{ id:'light.kitchen', name:'Kitchen', state:'on', lastUpdated:null, available:true }]);
  assert.equal(JSON.stringify(values).includes('do not share'), false);
});

test('only approved devices and confirmed on/off commands are accepted', () => {
  const allow = ['light.kitchen'];
  assert.equal(validateHomeAction({entityId:'light.kitchen',action:'turn_on',confirmed:true},allow).ok,true);
  assert.equal(validateHomeAction({entityId:'lock.front',action:'unlock',confirmed:true},allow).ok,false);
  assert.equal(validateHomeAction({entityId:'light.kitchen',action:'toggle',confirmed:true},allow).ok,false);
  assert.equal(validateHomeAction({entityId:'light.kitchen',action:'turn_off',confirmed:false},allow).ok,false);
  assert.equal(validateHomeAction({entityId:'light.bedroom',action:'turn_on',confirmed:true},allow).ok,false);
});

test('write requests require same origin and explicit header', () => {
  const request = {origin:'https://wisdo.example',host:'wisdo.example',protocol:'https',fetchSite:'same-origin',marker:'confirmed'};
  assert.equal(isTrustedWriteOrigin(request),true);
  assert.equal(isTrustedWriteOrigin({...request,origin:'https://attacker.example'}),false);
  assert.equal(isTrustedWriteOrigin({...request,fetchSite:'cross-site'}),false);
  assert.equal(isTrustedWriteOrigin({...request,marker:''}),false);
  assert.equal(isTrustedWriteOrigin({...request,origin:''}),false);
});

test('owner gate does not allow other signed-in WISDO members', () => {
  assert.equal(isHomeOwner({id:'123'},'123'),true);
  assert.equal(isHomeOwner({id:'456'},'123'),false);
  assert.equal(isHomeOwner({id:'456'},''),false);
});

function fakeApp() {
  const routes = new Map();
  return {
    routes,
    get(path,...handlers){ routes.set('GET '+path, handlers); },
    post(path,...handlers){ routes.set('POST '+path, handlers); },
  };
}
function fakeResponse() {
  return {
    statusCode:200, payload:null, headers:{}, redirectTo:null,
    status(code){this.statusCode=code;return this;},
    set(headers){ Object.assign(this.headers,headers);return this; },
    json(payload){ this.payload=payload; return this; },
    redirect(url){ this.redirectTo=url;return this; },
    sendFile(){this.sentFile=true;return this;},
  };
}
function requestFor(userId, overrides = {}) {
  const cookie = userId ? 'cc_user=' + encodeURIComponent(encodeSignedSession({id:userId,username:'Test'})) : '';
  const headers = {cookie,origin:'https://wisdo.example','sec-fetch-site':'same-origin','x-wisdo-holomode':'confirmed',host:'wisdo.example'};
  return {
    headers: {...headers,...(overrides.headers||{})},
    protocol: 'https', body: overrides.body || {},
    get(name){return this.headers[name.toLowerCase()] || null;},
    ...overrides,
  };
}
async function dispatch(handlers, req) {
  const res=fakeResponse();
  let index=0;
  const next=()=> { index++; };
  while(index<handlers.length) {
    const n=index;
    await handlers[index](req,res,next);
    if(index===n) break;
  }
  return res;
}

test('HoloMode bootstrap requires a signed session', async () => {
  const app=fakeApp();
  registerHoloModeRoutes(app);
  const res=await dispatch(app.routes.get('GET /api/holomode/bootstrap'),requestFor(null));
  assert.equal(res.statusCode,401);
});

test('unauthorized user cannot read home entities even if HA is configured', async () => {
  const previous = {
    WISDO_HOLO_OWNER_USER_ID:process.env.WISDO_HOLO_OWNER_USER_ID,
    WISDO_HOME_ASSISTANT_URL:process.env.WISDO_HOME_ASSISTANT_URL,
    WISDO_HOME_ASSISTANT_TOKEN:process.env.WISDO_HOME_ASSISTANT_TOKEN,
    WISDO_HOLO_ALLOWED_ENTITIES:process.env.WISDO_HOLO_ALLOWED_ENTITIES,
  };
  try {
    process.env.WISDO_HOLO_OWNER_USER_ID='owner';
    process.env.WISDO_HOME_ASSISTANT_URL='http://127.0.0.1:8123';
    process.env.WISDO_HOME_ASSISTANT_TOKEN='test-private-token';
    process.env.WISDO_HOLO_ALLOWED_ENTITIES='light.kitchen';
    const app=fakeApp();registerHoloModeRoutes(app);
    const res=await dispatch(app.routes.get('GET /api/holomode/home/entities'),requestFor('other'));
    assert.equal(res.statusCode,403);
  } finally {
    for(const [key,value] of Object.entries(previous)) {
      if(value === undefined) delete process.env[key]; else process.env[key]=value;
    }
  }
});
