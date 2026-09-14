import { chooseAutoQuality, getWorldCapabilities } from './world-config.js';
import { createMarketBillboardManager } from './markets/market-billboard-manager.js';
import { installCinematicWorldLayer } from './world-cinematic-layer.js';

function resolveQuality(){
  const quality=globalThis.WisdoQualityDiagnostics?.activeQuality||chooseAutoQuality();
  globalThis.WisdoQualityDiagnostics={...(globalThis.WisdoQualityDiagnostics||{}),initialQuality:globalThis.WisdoQualityDiagnostics?.initialQuality||quality,activeQuality:quality,fidelityQuality:quality,capabilities:getWorldCapabilities(),touchForcedLow:false};
  return quality;
}

async function safeJson(url){
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store'});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||body.message||`Request failed: ${response.status}`);
  return body;
}

export async function installProductionFidelity({THREE,scene,camera,renderer,debug=false}={}){
  if(!THREE||!scene||!camera||!renderer)throw new TypeError('Production fidelity runtime requires the active Three.js scene.');
  const quality=resolveQuality();
  let cinematic=null;
  try{
    cinematic=installCinematicWorldLayer({THREE,scene,camera,renderer,quality,debug});
  }catch(error){
    console.warn('WISDO cinematic visual layer degraded; production city remains active.',error);
  }
  const marketManager=createMarketBillboardManager({THREE,scene,camera,qualityName:quality,onChanged:({markets,billboardCount,assignments=[]})=>{
    globalThis.WisdoWorldDiagnostics={...(globalThis.WisdoWorldDiagnostics||{}),activeSymbols:markets.map((m)=>m.symbol),authorizedParticipants:markets.reduce((sum,m)=>sum+Number(m.activeOperatorCount||0),0),activeBillboards:billboardCount,billboardAnchorAssignments:assignments,fidelityQuality:quality,fakeCandlesAllowed:false,visualArchitecture:cinematic?.diagnostics?.visualPass||'production-city-core',cinematicActive:Boolean(cinematic?.diagnostics?.active),executionFromVisualLayer:false};
  }});
  let refreshBusy=false,destroyed=false,last=performance.now(),elapsed=0,frameId=0;
  async function refreshMarkets(){
    if(refreshBusy||destroyed)return;refreshBusy=true;
    try{const payload=await safeJson('/api/world/markets/active');marketManager.setMarkets(Array.isArray(payload.markets)?payload.markets:[]);if(debug)console.debug('[WISDO WORLD MARKETS]',globalThis.WisdoWorldDiagnostics);}catch(error){if(debug&&!String(error.message).includes('Authentication'))console.debug('[WISDO WORLD MARKETS] unavailable',error.message);}finally{refreshBusy=false;}
  }
  await refreshMarkets().catch(()=>{});
  const timer=setInterval(refreshMarkets,5000);
  function frame(now){if(destroyed)return;frameId=requestAnimationFrame(frame);const dt=Math.min(.05,Math.max(.001,(now-last)/1000));last=now;elapsed+=dt;marketManager.update(dt,elapsed);}
  frameId=requestAnimationFrame(frame);
  return{quality,cinematic:cinematic?.diagnostics||null,diagnostics:globalThis.WisdoWorldDiagnostics,destroy(){destroyed=true;cancelAnimationFrame(frameId);clearInterval(timer);marketManager.destroy();cinematic?.destroy?.();}};
}
