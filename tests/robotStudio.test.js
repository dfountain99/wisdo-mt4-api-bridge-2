import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createDraft,
  normalizeDraft,
  validateDraft,
  describeFlow,
  generateMql4,
  exportDraftJson
} from '../public/js/robot-studio-core.js';

test('robot studio default is valid and has useful safety defaults', () => {
  const d = createDraft();
  assert.deepEqual(validateDraft(d), []);
  assert.equal(d.riskPercent, 1);
  assert.equal(d.moneyMode, 'risk');
  assert.ok(d.stopPips > 0 && d.takePips > 0);
  assert.ok(d.magic >= 100000);
});

test('optional blocks appear only when enabled', () => {
  assert.equal(describeFlow(createDraft()).some((s) => s.title === 'RSI confirmation'), false);
  assert.equal(describeFlow({ ...createDraft(), rsiEnabled: true }).some((s) => s.title === 'RSI confirmation'), true);
  assert.equal(describeFlow({ ...createDraft(), sessionEnabled: true }).some((s) => s.title === 'Trading schedule'), true);
});

test('invalid parameters block source export', () => {
  const invalid = { ...createDraft(), fastEma: 100, slowEma: 20, riskPercent: 80 };
  assert.ok(validateDraft(invalid).length >= 2);
  assert.throws(() => generateMql4(invalid), /Fast EMA/);
  assert.throws(() => generateMql4({ ...createDraft(), sessionEnabled: true, sessionStart: 8, sessionEnd: 8 }), /different/);
});

test('generated MT4 EA is deterministic and has essential trading gates', () => {
  const d = { ...createDraft(), rsiEnabled: true, sessionEnabled: true, direction: 'buy', magic: 930777 };
  const source = generateMql4(d);
  assert.equal(source, generateMql4(d));
  for (const word of [
    '#property strict', 'MagicNumber = 930777', 'AllowBuy = true', 'AllowSell = false',
    'g_lastCandle', 'HasOwnOpenOrder()', 'MODE_STOPLEVEL', 'MaxSpreadPips', 'IsTradeAllowed()',
    'AccountFreeMarginCheck', 'NormalizeDouble', 'OrderSend(', 'MODE_TICKVALUE',
    'iMA(', 'iRSI(', 'SessionAllowsTrade()'
  ]) assert.ok(source.includes(word), 'Expected generated MQL4 to include ' + word);
  assert.doesNotMatch(source, /WebRequest|DllImport|ShellExecute|FileOpen/);
});

test('project round-trip preserves configuration without allowing MQL injection', () => {
  const source = { ...createDraft(), name: 'My"Robot;#include<script>', fastEma: 7 };
  const exported = JSON.parse(exportDraftJson(source));
  assert.equal(exported.generator, 'wisdo-robot-studio');
  assert.deepEqual(validateDraft(exported), []);
  assert.equal(normalizeDraft(exported).fastEma, 7);
  const generated = generateMql4(exported);
  assert.doesNotMatch(generated, /#include|<script>|My"Robot/);
});

test('studio is registered and navigation contains the intended route', () => {
  const routes = fs.readFileSync(new URL('../server/staticWorkspaceRoutes.js', import.meta.url), 'utf8');
  const portal = fs.readFileSync(new URL('../server/deadshotSite.js', import.meta.url), 'utf8');
  assert.match(routes, /slug: 'robot-studio'/);
  assert.match(portal, /'\x2fapp\x2frobot-studio', 'Robot Studio'/);
  assert.ok(fs.existsSync(new URL('../public/app/robot-studio/index.html', import.meta.url)));
});
