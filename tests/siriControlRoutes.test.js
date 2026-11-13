import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySiriCommand, formatTradingStatus, registerSiriControlRoutes } from '../server/siriControlRoutes.js';

const validToken = 'a'.repeat(48);
const validId = 'c1b1fc5a-5e4b-4d23-8452-323467e42a16';

function fakeApp() {
  const routes = new Map();
  const app = {};
  for (const method of ['get', 'post', 'delete']) app[method] = (path, ...handlers) => routes.set(`${method.toUpperCase()} ${path}`, handlers);
  return { app, routes };
}
function fakeResponse() {
  return {
    code: 200, payload: null, headers: {},
    set(k, v) { this.headers[k] = v; return this; },
    status(v) { this.code = v; return this; },
    json(v) { this.payload = v; return this; },
    type() { return this; },
    send(v) { this.payload = v; return this; },
  };
}
async function invoke(routes, method, path, req) {
  const res = fakeResponse();
  const handlers = routes.get(`${method} ${path}`);
  assert.ok(handlers, `${method} ${path} is registered`);
  for (const handler of handlers) {
    let continued = false;
    await handler(req, res, () => { continued = true; });
    if (!continued) break;
  }
  return res;
}

test('safe read-only Siri commands are classified without an execution channel', () => {
  assert.equal(classifySiriCommand('check my MT4 equity').kind, 'TRADING_STATUS');
  assert.equal(classifySiriCommand('open PRISM').kind, 'PRISM');
  assert.equal(classifySiriCommand('show my front camera').kind, 'CAMERAS');
  assert.equal(classifySiriCommand('open trading dashboard').kind, 'TRADING_DASHBOARD');
  for (const phrase of ['buy gold', 'close all my trades', 'disarm my alarm', 'turn off the cameras', 'set my stop loss', 'pause bot', 'unlock front door']) {
    assert.equal(classifySiriCommand(phrase).kind, 'APPROVAL_REQUIRED', phrase);
  }
  assert.equal(classifySiriCommand('q'.repeat(501)).kind, 'INVALID');
});

test('status distinguishes live and offline Reporter rather than claiming stale data is current', () => {
  const base = { account: { nickname: 'Coinexx Demo' }, campaigns: [{ positionCount: 2 }], financial: { currency: 'USD', equity: 1024.75, floatingPL: -3.5 } };
  assert.match(formatTradingStatus({ ...base, executionHealth: { reporter: 'LIVE' } }), /Reporter is live/);
  assert.match(formatTradingStatus({ ...base, executionHealth: { reporter: 'LIVE' } }), /2 open positions/);
  assert.match(formatTradingStatus({ ...base, executionHealth: { reporter: 'STALE' } }), /cannot confirm live equity/);
  assert.match(formatTradingStatus({ account: null, accounts: [{}, {}] }), /primary account/);
});

test('Siri request requires separately paired device credentials', async () => {
  const previous = process.env.PUBLIC_BASE_URL;
  process.env.PUBLIC_BASE_URL = 'https://wisdo-mt4-api-bridge.onrender.com';
  const { app, routes } = fakeApp();
  const pool = { query: async () => { throw new Error('Should not reach database for missing credentials'); } };
  registerSiriControlRoutes(app, { pool, worldCommandService: { state: async () => { throw new Error('Not called'); } }, logger: { warn() {} } });
  const res = await invoke(routes, 'POST', '/api/siri/v1/command', { headers: { 'content-type': 'application/json' }, body: { text: 'check my MT4' } });
  assert.equal(res.code, 401);
  assert.equal(res.payload.ok, false);
  if (previous === undefined) delete process.env.PUBLIC_BASE_URL; else process.env.PUBLIC_BASE_URL = previous;
});

test('paired Siri device can get status but never executes a trade or changes security', async () => {
  const original = process.env.PUBLIC_BASE_URL;
  process.env.PUBLIC_BASE_URL = 'https://wisdo-mt4-api-bridge.onrender.com';
  try {
    const { app, routes } = fakeApp();
    let statusCalls = 0;
    const pool = {
      async query(query) {
        if (query.startsWith('SELECT device_id,owner_user_id,name')) return { rows: [{ device_id: validId, owner_user_id: 'user-1', name: 'Phone' }] };
        return { rows: [], rowCount: 0 };
      },
    };
    const worldCommandService = { async state(userId) { statusCalls++; assert.equal(userId, 'user-1'); return { account: { nickname: 'Test' }, campaigns: [{ positionCount: 0 }], financial: { equity: 42, floatingPL: 0 }, executionHealth: { reporter: 'LIVE' } }; } };
    registerSiriControlRoutes(app, { pool, worldCommandService });
    const req = text => ({ headers: { 'content-type': 'application/json', 'x-wisdo-siri-device': validId, authorization: `Bearer ${validToken}` }, body: { text } });
    const allowed = await invoke(routes, 'POST', '/api/siri/v1/command', req('check my trading status'));
    assert.equal(allowed.code, 200);
    assert.equal(allowed.payload.executed, false);
    assert.match(allowed.payload.spokenText, /Reporter is live/);
    const denied = await invoke(routes, 'POST', '/api/siri/v1/command', req('close all trades'));
    assert.equal(denied.payload.kind, 'APPROVAL_REQUIRED');
    assert.equal(denied.payload.executed, false);
    assert.equal(statusCalls, 1);
  } finally {
    if (original === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = original;
  }
});
