import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Kernel Control previews against authenticated API and requires review before dispatch',()=>{
  const html=page('public/app/kernel-control/index.html');
  assert.match(html,/\/api\/kernel\/v1\/intents/);
  assert.match(html,/wisdo_device_token/);
  assert.match(html,/kernel\(false\)/);
  assert.match(html,/kernel\(true\)/);
  assert.match(html,/confirm\(/);
  assert.doesNotMatch(html,/Command captured\. Use an enrolled/);
});

test('Aether Lobby navigation and portal have destinations and session status comes from server',()=>{
  const html=page('public/app/world/aether-lobby/index.html');
  assert.match(html,/class="portal p2" href="\/app\/world\?scene=genesis"/);
  assert.match(html,/href="\/app\/world\/experiences\/">PLAY<\/a>/);
  assert.match(html,/href="\/app\/world\/experiences\/street-sprint\.html"/);
  assert.match(html,/fetch\('\/api\/world\/me'/);
  assert.match(html,/SIGN IN TO SAVE PROGRESS/);
  assert.doesNotMatch(html,/AETHER ID · ONLINE/);
});
