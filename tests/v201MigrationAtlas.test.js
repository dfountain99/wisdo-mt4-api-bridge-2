import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WisdoAtlasService } from '../services/wisdoAtlasService.js';

test('migration avoids reserved references column and includes Atlas tables',()=>{
  const sql=fs.readFileSync(new URL('../scripts/migratePostgres.js',import.meta.url),'utf8');
  assert.ok(sql.includes('reference_state JSONB'));
  assert.ok(!sql.includes('session_id TEXT NOT NULL, references JSONB'));
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS wisdo_broker_symbols'));
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS wisdo_symbol_aliases'));
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS wisdo_symbol_groups'));
});

test('Atlas canonicalizes broker suffixes and common aliases without CHFJPY hardcoding',()=>{
  const service=Object.create(WisdoAtlasService.prototype);
  assert.equal(service.canonicalize('EURUSD.a'),'EURUSD');
  assert.equal(service.canonicalize('XAUUSDm'),'XAUUSD');
  assert.equal(service.canonicalize('GOLD'),'XAUUSD');
  assert.equal(service.canonicalize('SPXUSD'),'SPX500');
  assert.equal(service.classify('BTCUSD'),'crypto');
  assert.equal(service.classify('US30'),'index');
});
