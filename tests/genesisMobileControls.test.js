import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 GENESIS_INPUT_DEFAULTS,genesisInputSettings,genesisStickInput,
 genesisLookDelta,genesisOrbitClamp,genesisGamepadFrame,
 } from '../public/js/genesisInputController.js';
import {genesisMicroNormal,genesisCreateMicroBump}
  from '../public/js/genesisMicroSurface.js';

test('mobile controls sanitize stored settings to predictable safe bounds',()=>{
 assert.deepEqual(genesisInputSettings(),GENESIS_INPUT_DEFAULTS);
 assert.equal(genesisInputSettings({sensitivity:500}).sensitivity,2.5);
 assert.equal(genesisInputSettings({sensitivity:-12}).sensitivity,.35);
 assert.equal(genesisInputSettings({cameraDistance:-2}).cameraDistance,8);
 assert.equal(genesisInputSettings({cameraDistance:200}).cameraDistance,28);
 assert.equal(genesisInputSettings({invertY:'false'}).invertY,false);
 assert.equal(genesisInputSettings({invertY:true}).invertY,true);
 assert.equal(genesisInputSettings({stickDeadZone:12}).stickDeadZone,.35);
});

test('left joystick dead zone is quiet and moving diagonals are bounded',()=>{
 assert.deepEqual(genesisStickInput(.04,-.04),{x:0,y:0,magnitude:0});
 for(const [x,y] of [[1,0],[0,-1],[1,1],[-.8,.2],[12,-3]]){
  const stick=genesisStickInput(x,y);
  assert.ok(Math.hypot(stick.x,stick.y)<=1+1e-9);
  assert.ok(stick.magnitude>=0&&stick.magnitude<=1);
 }
 const slow=genesisStickInput(.35,0);
 assert.ok(slow.x>0&&slow.x<.35,'a precision stick curve should keep small motions controlled');
 const full=genesisStickInput(1,0);
 assert.ok(Math.abs(full.x-1)<1e-9);
});

test('right thumb look respects sensitivity and invert and never flips camera',()=>{
 const base=genesisLookDelta(20,25);
 const fast=genesisLookDelta(20,25,{sensitivity:2});
 assert.equal(fast.alpha,base.alpha*2);
 assert.equal(fast.beta,base.beta*2);
 assert.equal(genesisLookDelta(0,25,{invertY:true}).beta,-base.beta);
 assert.equal(genesisOrbitClamp(2,0).beta,.42);
 assert.equal(genesisOrbitClamp(2,4).beta,1.46);
 assert.deepEqual(genesisOrbitClamp(NaN,NaN),{alpha:0,beta:1.14});
});

test('standard Bluetooth gamepad uses independent move and camera sticks',()=>{
 const pad={connected:true,axes:[.75,-.80,.50,-.70],
  buttons:Array.from({length:6},()=>({pressed:false}))};
 pad.buttons[0].pressed=true;pad.buttons[3].pressed=true;
 pad.buttons[5].pressed=true;
 const frame=genesisGamepadFrame(pad);
 assert.ok(frame.movement.x>0);
 assert.ok(frame.movement.y<0);
 assert.ok(frame.look.x>0);
 assert.ok(frame.look.y<0);
 assert.equal(frame.interact,true);
 assert.equal(frame.build,true);
 assert.equal(frame.power,true);
 assert.equal(frame.cancel,false);
 assert.equal(genesisGamepadFrame(null).interact,false);
});

test('mobile game HUD includes a real right-hand camera area, zoom and options',()=>{
 const html=readFileSync(new URL('../public/genesis.html',import.meta.url),'utf8');
 const world=readFileSync(new URL('../public/js/genesisWorld.js',import.meta.url),'utf8');
 for(const name of ['look-pad','look-sensitivity','look-invert-y','camera-center',
 'camera-zoom-in','camera-zoom-out','joystick','joystick-knob']){
  assert.match(html,new RegExp('id="'+name+'"'));
 }
 assert.match(html,/genesisWorld\.js\?v=8/);
 assert.match(world,/genesisInputController\.js\?v=8/);
 assert.match(world,/genesisGamepadFrame/);
 assert.match(world,/look\.setPointerCapture\(event\.pointerId\)/);
 assert.match(world,/removeByType\('ArcRotateCameraPointersInput'\)/);
 assert.match(world,/saveCameraSettings\(\)/);
 assert.match(world,/genesisStickInput\(joystick\.x,joystick\.y/);
 assert.match(world,/action\(\{action:'build',kind,/);
});

test('cinematic micro-normal surfaces tile seamlessly with bounded tangent normals',()=>{
 for(const biome of ['forest','marsh','titan','neon','crystal','aether']){
  const a=genesisMicroNormal(0,0,biome);
  assert.equal(a.length,3);
  assert.deepEqual(a,genesisMicroNormal(128,128,biome));
  assert.ok(a.every(channel=>Number.isInteger(channel)&&channel>=0&&channel<=255));
  assert.ok(a[2]>150);
 }
 assert.equal(genesisCreateMicroBump(null,'forest'),null);
 const terrain=readFileSync(new URL('../public/js/genesisTerrain.js',import.meta.url),'utf8');
 assert.match(terrain,/graphics\.mode==='cinematic'\?microBump/);
 assert.match(terrain,/m\.bumpTexture=/);
 assert.match(terrain,/texture\.dispose\(\)/);
});
