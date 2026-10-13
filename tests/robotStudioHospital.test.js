import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  analyzeHospitalSource, patchHospitalSource, getHospitalChanges,
  hospitalManifest, classifyHospitalSymbol
} from '../public/js/robot-studio-hospital-core.js';

const actualHighTower = fs.readFileSync(new URL('../mql4/HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4', import.meta.url),'utf8');

test('actual 803KB HIGHTOWER source produces substantive code-based anatomy, not EMA template', () => {
  assert.ok(actualHighTower.length > 500000);
  const a = analyzeHospitalSource(actualHighTower,'HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4');
  assert.equal(a.platform,'MT4');
  assert.ok(a.enums.length > 15, 'advanced enum types recognized');
  assert.ok(a.functions.length > 20, 'actual code function definitions recognized');
  assert.ok(a.inputs.length > 50, 'actual external inputs found');
  assert.ok(a.stats.editable > 30, 'safe scalar and enum input controls recognized');
  assert.ok(a.stats.references > 10, 'references to real in-file functions detected');
  const enums = a.inputs.filter(i=>i.hospitalKind==='enum');
  assert.ok(enums.length > 3, 'named HIGHTOWER preset options are mapped to dropdowns');
  assert.ok(enums.some(i=>i.isInternalDefault),'advanced internal state presets are discoverable without inventing their meaning');
  assert.ok(a.groups.find(g=>g.id==='sonic').inputs.some(i=>i.name==='DirectSonicNodesBetweenCores'));
  assert.ok(a.groups.find(g=>g.id==='protection').inputs.some(i=>i.name==='DirectStopLossMode'));
  assert.equal(patchHospitalSource(a),actualHighTower,'unchanged program must round-trip exactly');
  const report=hospitalManifest(a);
  assert.equal(report.compiled,false);
  assert.equal(report.backtested,false);
  assert.equal(report.equivalentToOriginal,'source-unchanged');
});

test('real HIGHTOWER SONIC and stop-risk adjustments map to exact original source offsets', () => {
  const a=analyzeHospitalSource(actualHighTower,'HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4');
  const sonic=a.inputs.find(i=>i.name==='DirectSonicNodesBetweenCores');
  const stop=a.inputs.find(i=>i.name==='DirectStopLossMode');
  const atr=a.inputs.find(i=>i.name==='DirectUseATRTrailingStop');
  assert.ok(sonic&&stop&&atr);
  assert.equal(sonic.hospitalKind,'integer');
  assert.ok(sonic.usedBy.length > 0, 'SONIC control references should be linked to real functions');
  assert.equal(stop.hospitalKind,'enum');
  assert.ok(stop.options.includes(stop.original));
  const other=stop.options.find(value=>value!==stop.original);
  assert.ok(other);
  const changes={
    [sonic.id]: 12,
    [stop.id]: other,
    [atr.id]: false
  };
  const edited=patchHospitalSource(a,changes);
  assert.equal(getHospitalChanges(a,changes).length,3);
  assert.equal(
    edited,
    actualHighTower
      .replace('DirectSonicNodesBetweenCores=24;', 'DirectSonicNodesBetweenCores=12;')
      .replace('DirectStopLossMode=DIRECT_STOP_ATR;', 'DirectStopLossMode='+other+';')
      .replace('DirectUseATRTrailingStop=true;', 'DirectUseATRTrailingStop=false;')
  );
  assert.equal(hospitalManifest(a,changes).equivalentToOriginal,'not-verified');
  assert.ok(edited.includes('HIGHTOWER UNITY'));
});

test('invalid enum names or injected MQL statements cannot modify an imported robot', () => {
  const a=analyzeHospitalSource(actualHighTower,'HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4');
  const stop=a.inputs.find(i=>i.name==='DirectStopLossMode');
  const sonic=a.inputs.find(i=>i.name==='DirectSonicNodesBetweenCores');
  assert.throws(()=>patchHospitalSource(a,{[stop.id]:'DIRECT_STOP_ATR; OrderClose(1);'}),/unknown enum member/);
  assert.throws(()=>patchHospitalSource(a,{[sonic.id]:'1; OrderSend()'}),/whole number/);
  assert.throws(()=>patchHospitalSource(a,{unknown:'evil'}),/Unknown mapped/);
});

test('static X-ray conservatively preserves source and identifies only in-file call references', () => {
  const src=String.raw`#property strict
// false CallExternal() and OrderSend()
#include <Custom.mqh>
enum HT_BotMode { MODE_OFF=0, MODE_ACTIVE=1, MODE_AUTO=2 };
input HT_BotMode BotMode=MODE_ACTIVE;
HT_BotMode InternalDefault=MODE_AUTO;
input bool UseVault=true;
input int Example=2;
bool Condition() { return Example > 0; }
void CallTrade() { if(Condition()) OrderSend(Symbol(),OP_BUY,0.01,Ask,2,0,0); }
void OnTick() { if(BotMode==MODE_ACTIVE) CallTrade(); }
`;
  const a=analyzeHospitalSource(src,'studio.mq4');
  const mode=a.inputs.find(i=>i.name==='BotMode');
  assert.deepEqual(mode.options,['MODE_OFF','MODE_ACTIVE','MODE_AUTO']);
  assert.equal(mode.hospitalKind,'enum');
  const internal=a.inputs.find(i=>i.name==='InternalDefault');
  assert.ok(internal?.isInternalDefault);
  assert.equal(internal.hospitalKind,'enum');
  assert.equal(patchHospitalSource(a,{[internal.id]:'MODE_OFF'}),src.replace('InternalDefault=MODE_AUTO;','InternalDefault=MODE_OFF;'));
  const onTick=a.functions.find(f=>f.name==='OnTick');
  const callTrade=a.functions.find(f=>f.name==='CallTrade');
  assert.deepEqual(onTick.calls,['CallTrade']);
  assert.deepEqual(callTrade.calls,['Condition']);
  assert.equal(a.diagnostics.some(d=>d.title==='External include dependencies'),true);
  assert.equal(patchHospitalSource(a,{[mode.id]:'MODE_OFF'}),src.replace('BotMode=MODE_ACTIVE;','BotMode=MODE_OFF;'));
  assert.equal(patchHospitalSource(a),src);
  assert.equal(a.stats.references,2);
  assert.deepEqual(a.inputs.find(i=>i.name==='BotMode').usedBy,['OnTick']);
  assert.deepEqual(a.inputs.find(i=>i.name==='Example').usedBy,['Condition']);
  assert.deepEqual(getHospitalChanges(a,{[mode.id]:'MODE_OFF'})[0].referencedBy,['OnTick']);
});

test('symbol grouping is based on source names, not invented function semantics', () => {
  assert.equal(classifyHospitalSymbol('DirectSonicNodeSpacingR'),'sonic');
  assert.equal(classifyHospitalSymbol('DirectRiskPercentEveryTrade'),'risk');
  assert.equal(classifyHospitalSymbol('H620CollectCampaignProfit'),'campaign');
  assert.equal(classifyHospitalSymbol('ArbitraryOpaqueXYZ'),'custom');
});

test('hospital panel is linked into the V2 navigation, with native upload/export and clear no-live-trade warning', () => {
  const html=fs.readFileSync(new URL('../public/app/robot-studio/index.html',import.meta.url),'utf8');
  for(const id of ['mode-hospital-tab','bot-hospital','hosp-file','hosp-choose','hosp-example',
    'hosp-modules','hosp-functions','hosp-parameter-controls','hosp-function-inspect','hosp-diagnostics',
    'hosp-backup','hosp-export','hosp-report','hosp-source-preview']) assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(html,/bot-hospital\.css/);
  assert.match(html,/robot-studio-hospital-ui\.js/);
  assert.match(html,/No code is executed on this website/);
  const js=fs.readFileSync(new URL('../public/js/robot-studio-workspace.js',import.meta.url),'utf8');
  assert.match(js,/#bot-hospital/);
});
