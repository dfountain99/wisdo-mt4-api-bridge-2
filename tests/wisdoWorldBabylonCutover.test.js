import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('primary /app/world enters Babylon WISDO World and preserves legacy fallback',()=>{
 const primary=fs.readFileSync('public/app/world/index.html','utf8');
 const babylon=fs.readFileSync('public/app/world/babylon-city/index.html','utf8');
 const runtime=fs.readFileSync('public/app/world/babylon-city/world.js','utf8');
 assert.match(primary,/babylon-city/);
 assert.match(primary,/legacy\.html/);
 assert.match(babylon,/WISDO World/);
 assert.doesNotMatch(babylon,/WISDO CITY/);
 assert.match(runtime,/WISDO_WORLD/);
 assert.match(runtime,/THE COMMONS/);
});
