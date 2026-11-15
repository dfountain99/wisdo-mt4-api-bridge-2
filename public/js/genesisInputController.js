/**
 * Genesis V8 responsive input helpers.
 * Render and input settings are client-only; movement and actions remain
 * checked by the authoritative Genesis API.
 */
export const GENESIS_INPUT_DEFAULTS=Object.freeze({
 sensitivity:1,invertY:false,stickDeadZone:.12,stickCurve:1.25,cameraDistance:16,
});
export function genesisInputSettings(raw={}){
 const s=raw&&typeof raw==='object'?raw:{};
 const number=(key,fallback,min,max)=>{
  const n=Number(s[key]);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
 };
 return {
  sensitivity:number('sensitivity',1,.35,2.5),
  invertY:s.invertY===true,
  stickDeadZone:number('stickDeadZone',.12,0,.35),
  stickCurve:number('stickCurve',1.25,1,2),
  cameraDistance:number('cameraDistance',16,8,28),
 };
}
export function genesisStickInput(x,y,settings=GENESIS_INPUT_DEFAULTS){
 const input=genesisInputSettings(settings);
 const xx=Number.isFinite(x)?x:0,yy=Number.isFinite(y)?y:0;
 const mag=Math.hypot(xx,yy);
 if(mag<=input.stickDeadZone)return {x:0,y:0,magnitude:0};
 const normalized=Math.min(1,mag);
 const scaled=Math.pow((normalized-input.stickDeadZone)/(1-input.stickDeadZone),input.stickCurve);
 return {x:xx/mag*scaled,y:yy/mag*scaled,magnitude:scaled};
}
export function genesisLookDelta(deltaX,deltaY,settings=GENESIS_INPUT_DEFAULTS){
 const input=genesisInputSettings(settings);
 const scalar=.0045*input.sensitivity;
 return {
  alpha:-Number(deltaX||0)*scalar,
  beta:Number(deltaY||0)*scalar*(input.invertY?-1:1),
 };
}
export function genesisOrbitClamp(alpha,beta){
 return {
  alpha:Number.isFinite(alpha)?alpha:0,
  beta:Math.min(1.46,Math.max(.42,Number.isFinite(beta)?beta:1.14)),
 };
}
export function genesisGamepadFrame(pad,settings=GENESIS_INPUT_DEFAULTS){
 if(!pad||!pad.connected)return {movement:{x:0,y:0},look:{x:0,y:0},interact:false,build:false,cancel:false,power:false};
 const axes=pad.axes||[];
 const movement=genesisStickInput(Number(axes[0]||0),Number(axes[1]||0),settings);
 const look=genesisStickInput(Number(axes[2]||0),Number(axes[3]||0),settings);
 const buttons=pad.buttons||[];
 return {
  movement,look,interact:buttons[0]?.pressed===true,
  build:buttons[3]?.pressed===true,
  cancel:buttons[1]?.pressed===true,
  power:buttons[5]?.pressed===true,
 };
}
