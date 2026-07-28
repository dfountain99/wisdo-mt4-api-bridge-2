import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const testsDirectory = path.dirname(currentFile);
const renderRoot = path.resolve(testsDirectory, '..');

const configuredPiRoot = String(
  process.env.WISDO_PI_EDGE_SOURCE || '',
).trim();

const piCandidates = [
  configuredPiRoot,
  path.resolve(renderRoot, 'pi-edge'),
  path.resolve(renderRoot, '..', 'pi-edge'),
  path.resolve(
    renderRoot,
    '..',
    'wisdo-v33-edge',
    'wisdo_v23_full',
    'pi-edge',
  ),
].filter(Boolean);

const piRoot = piCandidates.find((candidate) =>
  existsSync(path.join(candidate, 'install.sh'))
);

function readRender(relativePath) {
  return readFileSync(
    path.join(renderRoot, relativePath),
    'utf8',
  );
}

function readPi(relativePath) {
  assert.ok(
    piRoot,
    [
      'Pi Edge source folder was not found.',
      'Set WISDO_PI_EDGE_SOURCE to the extracted pi-edge folder.',
      'Checked:',
      piCandidates.join(', '),
    ].join(' '),
  );

  return readFileSync(
    path.join(piRoot, relativePath),
    'utf8',
  );
}

test(
  'Pi services cover presence discovery room state and cloud-only voice',
  () => {
    const install = readPi('install.sh');

    assert.match(install, /wisdo-presence/);
    assert.match(install, /wisdo-device-discovery/);
    assert.match(install, /wisdo-room-state/);
    assert.match(install, /wisdo-face-interaction/);

    const voiceEngine = readPi('voice_engine.py');

    assert.match(
      voiceEngine,
      /WISDO_TTS_REQUIRE_CLOUD/,
    );
  },
);

test(
  'Render exposes durable room intelligence routes and schema',
  () => {
    const routeSource = readRender(
      'server/roomStateRoutes.js',
    );

    const serviceSource = readRender(
      'services/wisdoRoomStateService.js',
    );

    const migrationSource = readRender(
      'scripts/migratePostgres.js',
    );

    assert.match(
      routeSource,
      /\/health\/room-intelligence/,
    );

    assert.match(
      routeSource,
      /\/api\/edge\/v1\/rooms\/:roomId\/state/,
    );

    assert.match(
      serviceSource,
      /wisdo_room_states/,
    );

    assert.match(
      migrationSource,
      /CREATE TABLE IF NOT EXISTS wisdo_room_states/,
    );
  },
);
