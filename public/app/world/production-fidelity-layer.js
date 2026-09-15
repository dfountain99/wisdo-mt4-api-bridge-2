import { chooseAutoQuality, getWorldCapabilities } from './world-config.js';
import { createMarketBillboardManager } from './markets/market-billboard-manager.js';
import { installCinematicWorldLayer } from './world-cinematic-layer.js';
import { installArcadeCityVerticalSlice } from './world-arcade-plaza.js';

function resolveQuality(){
  const quality=globalThis.WisdoQualityDiagnostics?.activeQuality||chooseAutoQuality();
  globalThis.WisdoQualityDiagnostics={...(globalThis.WisdoQualityDiagnostics||{}),initialQuality:globalThis.WisdoQualityDiagnostics?.initialQuality||quality,activeQuality:quality,fidelityQuality:quality,capabilities:getWorldCapabilities(),touchForcedLow:false};
  return quality;
}

function serializeError(error){
  return Object.freeze({
    name:String(error?.name||'Error'),
    message:String(error?.message||error||'Unknown visual runtime error'),
    stack:String(error?.stack||'').split('\n').slice(0,5).join(' | '),
    at:new Date().toISOString(),
  });
}

function recordVisualError(system,error){
  const previous=globalThis.WisdoVisualRuntimeErrors||{};
  const next=Object.freeze({...previous,[system]:serializeError(error)});
  globalThis.WisdoVisualRuntimeErrors=next;
  try{window.dispatchEvent(new CustomEvent('wisdo:visual-runtime-error',{detail:{system,error:next[system]}}));}catch{}
  return next[system];
}

async function safeJson(url,{timeoutMs=4500}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new DOMException('Timed out','AbortError')),timeoutMs);
  try{
    const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body.error||body.message||`Request failed: ${response.status}`);
    return body;
  }finally{
    clearTimeout(timer);
  }
}

export async function installProductionFidelity({THREE,scene,camera,renderer,debug=false}={}){
  if(!THREE||!scene||!camera||!renderer)throw new TypeError('Production fidelity runtime requires the active Three.js scene.');
  const quality=resolveQuality();
  globalThis.WisdoWorldSafetyDiagnostics=Object.freeze({executionFromVisuals:false,authority:'WISDO_COMMAND_API',verifiedAt:new Date().toISOString()});

  let cinematic=null,arcadePlaza=null,marketManager=null;
  try{
    cinematic=installCinematicWorldLayer({THREE,scene,camera,renderer,quality,debug});
  }catch(error){
    recordVisualError('cinematic',error);
    console.warn('WISDO cinematic visual layer degraded; production city remains active.',error);
  }
  try{
    arcadePlaza=installArcadeCityVerticalSlice({THREE,scene,camera,renderer,quality,debug});
  }catch(error){
    recordVisualError('arcade-plaza',error);
    console.warn('WISDO Arcade Plaza vertical slice degraded; core World remains active.',error);
  }

  const publishDiagnostics=(patch={})=>{
    const previous=globalThis.WisdoWorldDiagnostics||{};
    const next=Object.freeze({
      ...previous,
      ...patch,
      fidelityQuality:quality,
      fakeCandlesAllowed:false,
      visualArchitecture:cinematic?.diagnostics?.visualPass||'production-city-core',
      cinematicActive:Boolean(cinematic?.diagnostics?.active),
      arcadePlazaActive:Boolean(arcadePlaza?.diagnostics?.active),
      arcadeBusinesses:arcadePlaza?.diagnostics?.businesses||[],
      npcCount:arcadePlaza?.diagnostics?.npcCount||0,
      palmCount:arcadePlaza?.diagnostics?.palmCount||0,
      executionFromVisualLayer:false,
      visualErrors:globalThis.WisdoVisualRuntimeErrors||{},
      updatedAt:new Date().toISOString(),
    });
    globalThis.WisdoWorldDiagnostics=next;
    return next;
  };
  publishDiagnostics();

  try{
    marketManager=createMarketBillboardManager({THREE,scene,camera,qualityName:quality,onChanged:({markets,billboardCount,assignments=[]})=>{
      publishDiagnostics({activeSymbols:markets.map((m)=>m.symbol),authorizedParticipants:markets.reduce((sum,m)=>sum+Number(m.activeOperatorCount||0),0),activeBillboards:billboardCount,billboardAnchorAssignments:assignments});
    }});
  }catch(error){
    recordVisualError('market-billboards',error);
    publishDiagnostics();
    console.warn('WISDO market billboard layer degraded; World remains active.',error);
  }

  let refreshBusy=false,destroyed=false,last=performance.now(),elapsed=0,frameId=0;
  async function refreshMarkets(){
    if(refreshBusy||destroyed||!marketManager)return;
    refreshBusy=true;
    try{
      const payload=await safeJson('/api/world/markets/active',{timeoutMs:4500});
      marketManager.setMarkets(Array.isArray(payload.markets)?payload.markets:[]);
      if(debug)console.debug('[WISDO WORLD MARKETS]',globalThis.WisdoWorldDiagnostics);
    }catch(error){
      if(error?.name!=='AbortError'&&debug&&!String(error?.message||'').includes('Authentication'))console.debug('[WISDO WORLD MARKETS] unavailable',error?.message||error);
    }finally{
      refreshBusy=false;
    }
  }

  // Never block the visual bootstrap or authored Operator on a market-data request.
  void refreshMarkets();
  const timer=setInterval(()=>{void refreshMarkets();},5000);
  function frame(now){
    if(destroyed)return;
    frameId=requestAnimationFrame(frame);
    const dt=Math.min(.05,Math.max(.001,(now-last)/1000));last=now;elapsed+=dt;
    try{marketManager?.update?.(dt,elapsed);}catch(error){recordVisualError('market-billboard-frame',error);}
  }
  frameId=requestAnimationFrame(frame);

  return{
    quality,
    cinematic:cinematic?.diagnostics||null,
    arcadePlaza:arcadePlaza?.diagnostics||null,
    diagnostics:globalThis.WisdoWorldDiagnostics,
    destroy(){
      destroyed=true;
      cancelAnimationFrame(frameId);
      clearInterval(timer);
      try{marketManager?.destroy?.();}catch{}
      try{arcadePlaza?.destroy?.();}catch{}
      try{cinematic?.destroy?.();}catch{}
    },
  };
}
