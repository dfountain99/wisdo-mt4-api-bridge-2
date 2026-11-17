import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { checkLocalEndpoint, diagnoseLoopback } from '../scripts/diagnoseLoopback.js';

async function withLocalServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { return await run(server.address().port); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('distinguishes live /health from unready /ready without treating readiness as loopback failure', async () => {
  await withLocalServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = req.url === '/health' ? 200 : 503;
    res.end(JSON.stringify({ ok: req.url === '/health' }));
  }, async (port) => {
    const result = await diagnoseLoopback({ port });
    assert.equal(result.health.ok, true);
    assert.equal(result.ready.ok, false);
    assert.equal(result.ready.statusCode, 503);
    assert.equal(result.diagnosis, 'local-listener-alive-but-application-not-ready');
    assert.equal(result.exitCode, 2);
  });
});

test('reports a healthy local listener when both endpoints return 200', async () => {
  await withLocalServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  }, async (port) => {
    const result = await diagnoseLoopback({ port });
    assert.equal(result.ok, true);
    assert.equal(result.exitCode, 0);
    assert.equal(result.host, '127.0.0.1');
  });
});

test('classifies refused connections as local transport errors', async () => {
  const server = http.createServer((_req, res) => res.end('ok'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const result = await checkLocalEndpoint({ port, endpoint: '/health', timeoutMs: 250 });
  assert.equal(result.ok, false);
  assert.equal(result.category, 'transport');
  assert.equal(result.code, 'ECONNREFUSED');
});

test('classifies a stalled local endpoint as a timeout', async () => {
  await withLocalServer((_req, _res) => {}, async (port) => {
    const result = await checkLocalEndpoint({ port, endpoint: '/health', timeoutMs: 30 });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'ETIMEDOUT');
  });
});

test('rejects malformed ports and non-health endpoints without making requests', async () => {
  assert.throws(() => checkLocalEndpoint({ port: 0, endpoint: '/health' }), RangeError);
  assert.throws(() => checkLocalEndpoint({ port: 3000, endpoint: '/mt4-command-poll' }), RangeError);
  assert.throws(() => checkLocalEndpoint({ port: 3000, endpoint: '/health', timeoutMs: -1 }), RangeError);
});
