import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const context = {};
runInNewContext(readFileSync('public/app/world/babylon-city/manifest-adapter.js', 'utf8'), context);
const {select} = context.WISDO_AETHER_MANIFEST;
const fixture = JSON.parse(readFileSync('public/app/world/fixtures/golden-world.json', 'utf8'));

test('golden fixture retains its operations despite its world dimensions field', () => {
  assert.ok(fixture.world && !fixture.world.operations);
  const manifest = select(fixture, 'golden fixture');
  assert.equal(manifest, fixture);
  assert.equal(manifest.operations.length, 17);
  for (const type of ['CREATE_LANDMASS', 'CREATE_OCEAN', 'CREATE_MOUNTAIN_RANGE',
    'CREATE_TOWER', 'CREATE_CITY_ZONE', 'CREATE_FOREST', 'CREATE_PORTAL'])
    assert.ok(manifest.operations.some(op => op.type === type), type);
  assert.deepEqual(manifest.spawn, {x:0, y:1.8, z:600});
});

test('authenticated personal-world response selects the Forge operation set', () => {
  const response = {ok:true, world:{...fixture, operations:undefined, forgeOperations:fixture.operations}};
  assert.equal(select(response, '/api/world/personal').forgeOperations.length, 17);
  assert.equal(select({ok:true, manifest:fixture}, 'manifest wrapper'), fixture);
});

test('empty or malformed operation sets fail closed with source diagnostics', () => {
  for (const response of [fixture.world, {world:{...fixture, operations:[]}}, {ok:true, world:{worldId:'broken'}}]) {
    assert.throws(() => select(response, '/api/world/personal'), error =>
      error.code === 'FORGE_OPERATION_SET_EMPTY' &&
      error.diagnostic.source === '/api/world/personal' && error.diagnostic.operationCount === 0);
  }
});
