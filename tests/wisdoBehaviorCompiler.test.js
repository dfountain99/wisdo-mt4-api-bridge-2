import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WisdoBehaviorCompilerService, extractBehaviorScope } from '../services/wisdoBehaviorCompilerService.js';

const compiler=new WisdoBehaviorCompilerService();

test('compiles WHEN, UNLESS and full-basket action into one deterministic behavior',()=>{const b=compiler.compile('When basket profit is above $100 close the full basket unless spread is above 30 points');assert.equal(b.validation.valid,true);assert.deepEqual(b.trigger,{type:'metric',metric:'basket_profit_money',operator:'>',value:100});assert.equal(b.unless[0].metric,'spread_points');assert.equal(b.actions[0].type,'close_full_basket');assert.equal(b.verification.receipt,'mt4_reporter');});

test('compiles EVERY plus IF into an interval trigger and independent guard',()=>{const b=compiler.compile('Every 15 minutes if drawdown is above 5 percent pause entries');assert.equal(b.validation.valid,true);assert.equal(b.trigger.type,'interval');assert.equal(b.trigger.interval_seconds,900);assert.equal(b.conditions[0].metric,'drawdown_percent');assert.equal(b.actions[0].type,'pause_entries');});
test('compiles ordered multi-action fallbacks',()=>{const b=compiler.compile('Every 15 minutes if drawdown is above 5 percent stop adding and alert me');assert.deepEqual(b.actions.map((action)=>action.type),['pause_entries','notify']);});

test('compiles exact bot, symbol, magic and campaign scope without guessing',()=>{const scope=extractBehaviorScope('On bot HIGHTOWER for XAUUSD magic 26080204 campaign alpha, when a new entry opens notify me');assert.equal(scope.bot_ref,'hightower');assert.equal(scope.symbol,'XAUUSD');assert.equal(scope.magic_number,26080204);assert.equal(scope.campaign_id,'alpha');assert.equal(scope.level,'campaign');});

test('ambiguous account mentions fail validation',()=>{const b=compiler.compile('When a new entry opens notify me on Demo One and Demo Two',{accounts:[{nickname:'Demo One'},{nickname:'Demo Two'}]});assert.equal(b.validation.valid,false);assert.match(b.validation.errors.join(' '),/More than one accounts scope/);});

test('unknown actions and unknown UNTIL clauses fail closed',()=>{assert.equal(compiler.compile('When profit is above $10 teleport the account').validation.valid,false);assert.equal(compiler.compile('When profit is above $10 close the full basket until I feel lucky').validation.valid,false);});
test('contradictory actions inside one sentence fail closed',()=>assert.equal(compiler.compile('Every 5 minutes pause entries and resume entries').validation.valid,false));

test('shadow mode evaluates but command contract remains separate',()=>{const b=compiler.compile('Simulate when basket profit is above $100 close the full basket');const result=compiler.evaluate(b,{openTrades:[{profit:70},{profit:40}]});assert.equal(b.mode,'shadow');assert.equal(result.wouldFire,true);assert.equal(result.mode,'shadow');assert.equal(compiler.commandFor(b.actions[0]).commandName,'CLOSE_ALL_TRADES');});
test('symbol words between new and entry still compile as a new-entry event',()=>{const b=compiler.compile('Simulate when a new XAUUSD entry opens notify me');assert.equal(b.trigger.type,'event');assert.equal(b.trigger.event,'new_entry');assert.equal(b.scope.symbol,'XAUUSD');});

test('UNLESS guard blocks a behavior in simulation',()=>{const b=compiler.compile('When basket profit is above $100 close the full basket unless spread is above 30 points');const result=compiler.evaluate(b,{spreadPoints:40,openTrades:[{profit:120}]});assert.equal(result.triggerMatched,true);assert.equal(result.unlessMatched,true);assert.equal(result.wouldFire,false);});

test('conflicting entry-state behaviors are rejected in the same scope',()=>{const pause=compiler.compile('Every 5 minutes pause entries',{account_id:'a1'});const resume=compiler.compile('Every 5 minutes resume entries',{account_id:'a1'});const conflicts=compiler.conflicts(resume,[{behavior_id:'pause-1',definition:pause}]);assert.equal(conflicts[0].severity,'blocking');});

test('different account scopes do not conflict',()=>{const pause=compiler.compile('Every 5 minutes pause entries',{account_id:'a1'});const resume=compiler.compile('Every 5 minutes resume entries',{account_id:'a2'});assert.equal(compiler.conflicts(resume,[{behavior_id:'pause-1',definition:pause}]).length,0);});

test('adaptive fabric v2 exposes lifecycle and simulation routes',()=>{const routes=fs.readFileSync(new URL('../server/adaptiveFabricRoutes.js',import.meta.url),'utf8');for(const path of ['/api/fabric/v2/behaviors/compile','/api/fabric/v2/behaviors/:behaviorId/transition','/api/fabric/v2/behaviors/:behaviorId/simulate'])assert.match(routes,new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));});
test('fabric API refuses direct active transition without bound confirmation',()=>{const routes=fs.readFileSync(new URL('../server/adaptiveFabricRoutes.js',import.meta.url),'utf8');assert.match(routes,/target==='active'.*requires a bound WISDO confirmation/);});
