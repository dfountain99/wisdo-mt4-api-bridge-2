import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('api server delegates modern Kernel route registration to one module', () => {
  const source = readFileSync(new URL('../server/apiServer.js', import.meta.url), 'utf8');
  assert.match(source, /registerWisdoKernelRoutes/);
  assert.doesNotMatch(source, /registerCommandBusRoutes\(app/);
  assert.doesNotMatch(source, /registerPhaseTwoEightRoutes\(app/);
});

test('Kernel registry owns command, adaptive, Atlas, voice, control, Phase 2-8 and workspace modules', () => {
  const source = readFileSync(new URL('../server/kernelRouteRegistry.js', import.meta.url), 'utf8');
  for (const registration of [
    'registerCommandBusRoutes',
    'registerAdaptiveFabricRoutes',
    'registerAtlasRoutes',
    'registerVoiceRoutes',
    'registerVoiceCreatorRoutes',
    'registerUniversalControlRoutes',
    'registerPhaseTwoEightRoutes',
    'registerStaticWorkspaceRoutes',
  ]) {
    assert.match(source, new RegExp(`${registration}\\(`), `${registration} must be registered`);
  }
  assert.match(source, /\/health\/kernel/);
});
