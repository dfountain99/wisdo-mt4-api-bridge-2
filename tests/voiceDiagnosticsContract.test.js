import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routes = readFileSync(new URL('../server/voiceRoutes.js', import.meta.url), 'utf8');

test('provider authentication failures are not mislabeled as device authentication failures', () => {
  assert.match(routes, /voice_provider_auth_failed/);
  assert.match(routes, /error\.statusCode = 502/);
  assert.doesNotMatch(routes, /error\.status = response\.status/);
});

test('voice diagnostics distinguish device authentication from provider reachability', () => {
  assert.match(routes, /\/api\/voice\/v1\/diagnostics/);
  assert.match(routes, /provider_probe/);
  assert.match(routes, /device:\s*\{[\s\S]*authenticated:\s*true/);
});
