import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WisdoVoiceBotAuthorityService } from '../services/wisdoVoiceBotAuthorityService.js';

const service = new WisdoVoiceBotAuthorityService({});
const currentFile = fileURLToPath(import.meta.url);
const renderRoot = path.resolve(path.dirname(currentFile), '..');

function read(relativePath) {
  return readFileSync(path.join(renderRoot, relativePath), 'utf8');
}

function resolveExternalRoot(envName, folderName) {
  const configured = String(process.env[envName] || '').trim();
  const candidates = [
    configured,
    path.resolve(renderRoot, folderName),
    path.resolve(renderRoot, '..', folderName),
    path.resolve(renderRoot, '..', '..', folderName),
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function assertMarkers(source, markers, label) {
  for (const marker of markers) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${label} is missing ${marker}`);
  }
}

test('voice compiler builds a symbol-scoped profit trail from natural speech', () => {
  const plan = service.analyze('Trail Deadshot on XAUUSD when I am up 20 percent by 8 pips for 2 hours');
  assert.equal(plan.action, 'trail_stop');
  assert.equal(plan.scope.bot_family, 'deadshot');
  assert.deepEqual(plan.scope.symbols, ['XAUUSD']);
  assert.equal(plan.parameters.start_profit_percent, 20);
  assert.equal(plan.parameters.trail_distance_pips, 8);
  assert.equal(plan.parameters.expires_in_seconds, 7200);
});

test('broker suffix symbols remain selectable', () => {
  const plan = service.analyze('Take profit on EURUSD.a at $125');
  assert.equal(plan.action, 'set_profit_target');
  assert.deepEqual(plan.scope.symbols, ['EURUSD.A']);
  assert.equal(plan.parameters.target_money, 125);
});

test('destructive voice commands require confirmation', () => {
  const plan = service.analyze('Close all trades on every bot');
  assert.equal(plan.action, 'close_all');
  assert.equal(plan.scope.all_bots, true);
  assert.equal(plan.requires_confirmation, true);
});

test('Pi, desktop, Render, and MT4 bridge share the final authority contract', () => {
  const manifest = JSON.parse(read('contracts/voice-bot-authority-v3.4.1.json'));
  assert.equal(manifest.contract, 'wisdo-voice-bot-authority');
  assert.equal(manifest.version, '3.4.1');

  const routes = read(manifest.components.render.route);
  const migration = read(manifest.components.render.migration);
  assertMarkers(routes, ['/health/voice-bot-authority'], 'Render voice routes');
  assertMarkers(migration, ['wisdo_voice_control_sessions'], 'PostgreSQL migration');

  const piRoot = resolveExternalRoot('WISDO_PI_EDGE_SOURCE', 'pi-edge');
  const desktopRoot = resolveExternalRoot('WISDO_DESKTOP_AGENT_SOURCE', 'desktop-agent');
  const adapterRoot = resolveExternalRoot('WISDO_REPORTER_ADAPTER_SOURCE', 'reporter-adapter');

  if (piRoot) {
    const pi = readFileSync(path.join(piRoot, manifest.components.pi_edge.entrypoint), 'utf8');
    assertMarkers(pi, manifest.components.pi_edge.required_markers, 'Pi Edge');
  } else {
    assert.deepEqual(manifest.components.pi_edge.required_markers, ['/api/kernel/v1/voice-control']);
  }

  if (desktopRoot) {
    const desktop = readFileSync(path.join(desktopRoot, manifest.components.desktop_agent.entrypoint), 'utf8');
    assertMarkers(desktop, manifest.components.desktop_agent.required_markers, 'Desktop Agent');
  } else {
    assert.ok(manifest.components.desktop_agent.required_markers.includes('trail_stop'));
    assert.ok(manifest.components.desktop_agent.required_markers.includes('undo_behavior'));
  }

  if (adapterRoot) {
    const bridge = readFileSync(path.join(adapterRoot, manifest.components.mt4_bridge.entrypoint), 'utf8');
    assertMarkers(bridge, manifest.components.mt4_bridge.required_markers, 'MT4 Bridge');
  } else {
    assert.ok(manifest.components.mt4_bridge.required_markers.includes('ApplyRuntimeRules'));
    assert.ok(manifest.components.mt4_bridge.required_markers.includes('set_profit_target'));
    assert.ok(manifest.components.mt4_bridge.required_markers.includes('undo_behavior'));
  }
});
