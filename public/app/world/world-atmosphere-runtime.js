const STORAGE_KEY='wisdo-world-atmosphere-v1';
const TIMES=new Set(['day','sunset','blue_hour','night','dawn']);
const WEATHER=new Set(['clear','cloudy','light_rain','fog']);
const WEATHER_VISIBILITY=Object.freeze({clear:1,cloudy:.82,light_rain:.72,fog:.52});
const WEATHER_EXPOSURE=Object.freeze({clear:1,cloudy:.92,light_rain:.9,fog:.86});
const WEATHER_SUN=Object.freeze({clear:1,cloudy:.64,light_rain:.48,fog:.38});
const WEATHER_NEAR=Object.freeze({clear:1,cloudy:1,light_rain:1,fog:.7});
const PRESETS=Object.freeze({
  day:{background:0x7898ac,fog:0x8aa3b1,exposure:1.22,hemiSky:0xaed2ea,hemiGround:0x5d5144,hemi:1.25,sun:0xffe4b8,sunIntensity:2.35},
  sunset:{background:0x53677c,fog:0x7c8290,exposure:1.18,hemiSky:0xa9bcd2,hemiGround:0x594238,hemi:1.1,sun:0xffb36d,sunIntensity:2.15},
  blue_hour:{background:0x142a40,fog:0x1e3447,exposure:1.12,hemiSky:0x6388aa,hemiGround:0x12171c,hemi:1,sun:0xe6b77d,sunIntensity:1.52},
  night:{background:0x06111d,fog:0x0b1824,exposure:.98,hemiSky:0x294867,hemiGround:0x07090d,hemi:.72,sun:0x7f9cc2,sunIntensity:.58},
  dawn:{background:0x3b5368,fog:0x596c79,exposure:1.12,hemiSky:0x8ca8c0,hemiGround:0x3d3230,hemi:.98,sun:0xf0b891,sunIntensity:1.65},
});
function saved(){try{const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');return{time:TIMES.has(v.time)?v.time:'blue_hour',weather:WEATHER.has(v.weather)?v.weather:'clear'};}catch{return{time:'blue_hour',weather:'clear'};}}
function save(state){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}}
export function startWorldAtmosphereRuntime(){
  let state=saved(),spatial=null,stopped=false,original=null;
  const onReady=()=>attach(globalThis.WisdoWorldSpatialContext||null);
  const onDestroyed=()=>{if(!globalThis.WisdoWorldSpatialContext)detach(false);};
  window.addEventListener('wisdo:spatial-context-ready',onReady);
  window.addEventListener('wisdo:spatial-context-destroyed',onDestroyed);
  function remember(){if(!spatial)return;const hemi=spatial.scene.children.find((o)=>o.isHemisphereLight),sun=spatial.scene.children.find((o)=>o.isDirectionalLight);original={background:spatial.scene.background?.clone?.()||null,fog:spatial.scene.fog?.color?.clone?.()||null,exposure:spatial.renderer.toneMappingExposure,hemi,hemiSky:hemi?.color?.clone?.(),hemiGround:hemi?.groundColor?.clone?.(),hemiIntensity:hemi?.intensity,sun,sunColor:sun?.color?.clone?.(),sunIntensity:sun?.intensity,fogNear:spatial.scene.fog?.near,fogFar:spatial.scene.fog?.far};}
  function apply(){if(!spatial||spatial.sceneId!=='central')return;const THREE=spatial.THREE,p=PRESETS[state.time]||PRESETS.blue_hour,visibility=WEATHER_VISIBILITY[state.weather]??1,exposure=WEATHER_EXPOSURE[state.weather]??1,sunFactor=WEATHER_SUN[state.weather]??1,nearFactor=WEATHER_NEAR[state.weather]??1;spatial.scene.background=new THREE.Color(p.background);if(spatial.scene.fog){spatial.scene.fog.color.setHex(p.fog);if(Number.isFinite(original?.fogFar))spatial.scene.fog.far=original.fogFar*visibility;if(Number.isFinite(original?.fogNear))spatial.scene.fog.near=original.fogNear*nearFactor;}spatial.renderer.toneMappingExposure=p.exposure*exposure;const hemi=spatial.scene.children.find((o)=>o.isHemisphereLight);if(hemi){hemi.color.setHex(p.hemiSky);hemi.groundColor.setHex(p.hemiGround);hemi.intensity=p.hemi;}const sun=spatial.scene.children.find((o)=>o.isDirectionalLight);if(sun){sun.color.setHex(p.sun);sun.intensity=p.sunIntensity*sunFactor;}document.documentElement.dataset.wisdoTime=state.time;document.documentElement.dataset.wisdoWeather=state.weather;window.dispatchEvent(new CustomEvent('wisdo:world-atmosphere',{detail:{...state,decorative:true,marketSession:false}}));}
  function restore(){if(!spatial||!original)return;if(original.background)spatial.scene.background=original.background;if(spatial.scene.fog&&original.fog){spatial.scene.fog.color.copy(original.fog);if(Number.isFinite(original.fogNear))spatial.scene.fog.near=original.fogNear;if(Number.isFinite(original.fogFar))spatial.scene.fog.far=original.fogFar;}spatial.renderer.toneMappingExposure=original.exposure;if(original.hemi){if(original.hemiSky)original.hemi.color.copy(original.hemiSky);if(original.hemiGround)original.hemi.groundColor.copy(original.hemiGround);original.hemi.intensity=original.hemiIntensity;}if(original.sun){if(original.sunColor)original.sun.color.copy(original.sunColor);original.sun.intensity=original.sunIntensity;}}
  function detach(restoreScene=true){if(restoreScene)restore();spatial=null;original=null;}
  function attach(next){detach();if(!next?.scene||!next?.renderer||next.sceneId!=='central'){spatial=next||null;return;}spatial=next;remember();apply();}
  function setTime(time){if(!TIMES.has(time))return false;state={...state,time};save(state);apply();return true;}
  function setWeather(weather){if(!WEATHER.has(weather))return false;state={...state,weather};save(state);apply();return true;}
  attach(globalThis.WisdoWorldSpatialContext||null);
  globalThis.WisdoWorldAtmosphere=Object.freeze({get time(){return state.time;},get weather(){return state.weather;},setTime,setWeather,presets:Object.freeze([...TIMES]),weatherModes:Object.freeze([...WEATHER]),marketSessionLinked:false});
  return Object.freeze({stop(){if(stopped)return;stopped=true;window.removeEventListener('wisdo:spatial-context-ready',onReady);window.removeEventListener('wisdo:spatial-context-destroyed',onDestroyed);detach();delete globalThis.WisdoWorldAtmosphere;delete document.documentElement.dataset.wisdoTime;delete document.documentElement.dataset.wisdoWeather;}});
}
