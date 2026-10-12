import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  analyzeMqlSource,
  patchImportedSource,
  getSourceChanges,
  MAX_SOURCE_BYTES
} from '../public/js/robot-studio-import-core.js';

const sampleMql4 = [
  '// OrderSend(Symbol(), OP_SELL, 100); fake trade in comments',
  '/* input double FakeLots=1000.0; */',
  '#property strict',
  'extern double Lots = 0.01;',
  'input int FastEMA = 9;',
  'input int SlowEMA = 21;',
  'input bool OnlyLong = true;',
  'input string Label = "Hello world";',
  'input int CustomLookback=ComputeLength();',
  '#include <CustomTrade.mqh>',
  'void OnTick() {',
  '  double a=iMA(Symbol(),0,FastEMA,0,MODE_EMA,PRICE_CLOSE,1);',
  '  if(a>0 && OnlyLong) OrderSend(Symbol(),OP_BUY,Lots,Ask,3,0,0);',
  '}',
  ''
].join('\r\n');

const sampleMql5 = [
  '#property strict',
  '#include <Trade/Trade.mqh>',
  'CTrade trade;',
  'input group "Strategy"',
  'input(name="Maximum loss %") double RiskPct=1.5;',
  'sinput bool CloseOnOpposite=false;',
  'input ENUM_TIMEFRAMES SignalTimeframe=PERIOD_M15;',
  'input string CommentText="Call \\"me\\"";',
  'int OnInit(){return INIT_SUCCEEDED;}',
  'void OnTimer(){',
  '  double buffer[]; CopyBuffer(maHandle,0,0,2,buffer);',
  '  if(CloseOnOpposite) trade.PositionClose(_Symbol);',
  '  else trade.Buy(0.1);',
  '}'
].join('\n');

test('MQL4 source imports and identifies actual inputs/actions, excluding comments', () => {
  const a = analyzeMqlSource(sampleMql4, 'robot.mq4');
  assert.equal(a.platform, 'MT4');
  assert.equal(a.inputs.length, 6);
  assert.equal(a.stats.editableInputs, 5);
  assert.ok(a.nodes.some(x => x.category === 'event' && /OnTick/.test(x.label)));
  assert.ok(a.nodes.some(x => x.category === 'signal' && /EMA/.test(x.label)));
  assert.ok(a.nodes.some(x => x.category === 'execution' && /OrderSend/.test(x.label)));
  assert.ok(a.nodes.some(x => x.category === 'external' && /dependencies/.test(x.label)));
  assert.equal(a.inputs.some(x => x.name === 'FakeLots'), false);
  assert.equal(patchImportedSource(a), sampleMql4, 'unmodified import/export must be exact');
});

test('Input changes patch only exact mapped defaults without losing custom code or line endings', () => {
  const a = analyzeMqlSource(sampleMql4, 'my_legacy_bot.MQ4');
  const map = Object.fromEntries(a.inputs.map(i => [i.name, i.id]));
  const patched = patchImportedSource(a, {
    [map.Lots]: 0.02,
    [map.FastEMA]: 12,
    [map.OnlyLong]: false,
    [map.Label]: 'Safe "trade"'
  });
  assert.match(patched, /extern double Lots = 0\.02;/);
  assert.match(patched, /input int FastEMA = 12;/);
  assert.match(patched, /input bool OnlyLong = false;/);
  assert.match(patched, /input string Label = "Safe \\"trade\\"";/);
  assert.match(patched, /if\(a>0 && OnlyLong\) OrderSend/);
  assert.match(patched, /#include <CustomTrade\.mqh>/);
  assert.equal(patched.split('\r\n').length, sampleMql4.split('\r\n').length);
  assert.equal(getSourceChanges(a, { [map.Lots]: 0.02 }).length, 1);
  assert.equal(patchImportedSource(a, { [map.Lots]: 0.01 }), sampleMql4);
});

test('Computed defaults cannot be modified and are preserved', () => {
  const a = analyzeMqlSource(sampleMql4, 'any.mq4');
  const variable = a.inputs.find(x => x.name === 'CustomLookback');
  assert.equal(variable.kind, 'readonly');
  assert.throws(() => patchImportedSource(a, { [variable.id]: 3 }), /read-only/);
});

test('MQL5 input group and named input are recognized; unknown enums stay intact', () => {
  const a = analyzeMqlSource(sampleMql5, 'another.mq5');
  assert.equal(a.platform, 'MT5');
  assert.equal(a.inputs.length, 4);
  const risk = a.inputs.find(x => x.name === 'RiskPct');
  assert.equal(risk.kind, 'decimal');
  const signal = a.inputs.find(x => x.name === 'SignalTimeframe');
  assert.equal(signal.kind, 'readonly');
  assert.ok(a.nodes.some(x => x.category === 'event' && /OnTimer/.test(x.label)));
  assert.ok(a.nodes.some(x => x.category === 'execution' && /CTrade Buy/.test(x.label)));
  assert.ok(a.nodes.some(x => x.category === 'signal' && /Indicator buffer/.test(x.label)));
  const newSource = patchImportedSource(a, { [risk.id]: 0.75 });
  assert.ok(newSource.includes('RiskPct=0.75;'));
  assert.ok(newSource.includes('input ENUM_TIMEFRAMES SignalTimeframe=PERIOD_M15;'));
  assert.equal(patchImportedSource(a), sampleMql5);
});

test('refuses non-source imports and code injection in scalar defaults', () => {
  assert.throws(() => analyzeMqlSource('abc', 'robot.ex4'), /SOURCE/);
  assert.throws(() => analyzeMqlSource('', 'robot.mq4'), /non-empty/);
  assert.throws(() => analyzeMqlSource('\0binary', 'robot.mq5'), /binary/);
  assert.throws(() => analyzeMqlSource('x'.repeat(MAX_SOURCE_BYTES + 1), 'big.mq5'), /limit/);
  const a = analyzeMqlSource(sampleMql4, 'robot.mq4');
  const lot = a.inputs.find(x => x.name === 'Lots');
  const label = a.inputs.find(x => x.name === 'Label');
  assert.throws(() => patchImportedSource(a, { [lot.id]: '0.1; OrderSend(Symbol(),OP_BUY,2,Ask,0,0,0)' }), /finite number/);
  assert.throws(() => patchImportedSource(a, { [label.id]: 'hello\nint X=2;' }), /one line/);
  assert.throws(() => patchImportedSource(a, { arbitrary: true }), /Unknown input block/);
});

test('simple numeric if conditions become editable blocks without touching adjacent logic', () => {
  const code = 'void OnTick() {\n  if (spread >= 2.5) return; // control spread\n  if (flag && ready) return;\n  if (volume < 100) Print("low");\n}\n';
  const analysis = analyzeMqlSource(code, 'logic.mq4');
  assert.equal(analysis.conditions.length, 2);
  assert.equal(analysis.stats.editableConditions, 2);
  const spread = analysis.conditions.find(c => c.lhs === 'spread');
  const volume = analysis.conditions.find(c => c.lhs === 'volume');
  assert.equal(patchImportedSource(analysis), code);
  const patched = patchImportedSource(analysis, {
    [spread.id]: { operator: '<', value: 3.75 },
    [volume.id]: { operator: '>=', value: 200 }
  });
  assert.match(patched, /if \(spread < 3\.75\) return;/);
  assert.match(patched, /if \(volume >= 200\) Print\("low"\)/);
  assert.match(patched, /if \(flag && ready\) return;/);
  assert.equal(getSourceChanges(analysis, { [spread.id]: { operator: '<', value: 3.75 } }).length, 1);
  assert.throws(() => patchImportedSource(analysis, { [spread.id]: { operator: '; OrderSend(', value: 2 } }), /Invalid comparison operator/);
  assert.throws(() => patchImportedSource(analysis, { [spread.id]: { operator: '>', value: '2; OrderSend(' } }), /finite comparison/);
});

test('browser UI has required workspace controls and source import script', () => {
  const html = fs.readFileSync(new URL('../public/app/robot-studio/index.html', import.meta.url), 'utf8');
  for (const id of ['reverse-file', 'reverse-dropzone', 'reverse-canvas', 'reverse-diff', 'reverse-download', 'reverse-source-preview']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /\/js\/robot-studio-import-ui\.js/);
});
