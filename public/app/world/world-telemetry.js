const ALLOWED = new Set(['scene','destination','missionId','step','source','quality','operatorRenderer','reason','fps','online','version']);
function sanitize(input={}){const out={};for(const [key,value] of Object.entries(input||{})){if(!ALLOWED.has(key))continue;if(['string','number','boolean'].includes(typeof value)||value==null)out[key]=value;}return out;}
export function startWorldTelemetry(){
  const capture=(name,detail={})=>{const payload=sanitize(detail);try{globalThis.posthog?.capture?.(`wisdo_world_${name}`,payload);}catch{} try{globalThis.WisdoWorldTelemetryBuffer ||= [];globalThis.WisdoWorldTelemetryBuffer.push({name,payload,at:Date.now()});if(globalThis.WisdoWorldTelemetryBuffer.length>100)globalThis.WisdoWorldTelemetryBuffer.shift();}catch{}};
  const handlers=[
    ['wisdo:world-destination-entered',(e)=>capture('destination_entered',{destination:e.detail?.id,source:e.detail?.source})],
    ['wisdo:world-destination-exited',(e)=>capture('destination_exited',{destination:e.detail?.id})],
    ['wisdo:mission-step',(e)=>capture('mission_step',{missionId:e.detail?.missionId,step:e.detail?.step,source:e.detail?.source})],
    ['wisdo:mission-completed',(e)=>capture('mission_completed',{missionId:e.detail?.missionId})],
    ['wisdo:game-scene',(e)=>capture('scene',{scene:e.detail?.scene})],
  ];
  handlers.forEach(([name,fn])=>window.addEventListener(name,fn));
  return Object.freeze({capture,stop(){handlers.forEach(([name,fn])=>window.removeEventListener(name,fn));}});
}
