import { chooseAutoQuality, getWorldCapabilities } from './world-config.js?v=2026.09.15.visual-fidelity-v4';
import { createMarketBillboardManager } from './markets/market-billboard-manager.js?v=2026.09.15.visual-fidelity-v4';
import { installResilientCinematicWorldLayer } from './world-cinematic-recovery.js?v=2026.09.15.visual-fidelity-v4';
import { installResilientArcadeCityVerticalSlice } from './world-arcade-recovery.js?v=2026.09.15.visual-fidelity-v4';
import { installWisdoVisualFidelityV2 } from './world-visual-fidelity-v2.js?v=2026.09.15.visual-fidelity-v4';
import { installWisdoVisualFidelityV3 } from './world-visual-fidelity-v3.js?v=2026.09.15.visual-fidelity-v4';
import { installWisdoVisualFidelityV4 } from './world-visual-fidelity-v4.js?v=2026.09.15.visual-fidelity-v4';

const FIDELITY_CLIENT_REVISION='2026.09.15.visual-fidelity-v4';
globalThis.WisdoFidelityClientRevision=FIDELITY_CLIENT_REVISION;

function resolveQuality(){
  const quality=globalThis.WisdoQualityDiagnostics?.activeQuality||chooseAutoQuality();
  globalThis.WisdoQualityDiagnostics={...(globalThis.WisdoQualityDiagnostics||{}),initialQuality:globalThis.WisdoQualityDiagnostics?.initialQuality||quality,activeQuality:quality,fidelityQuality:quality,capabilities:getWorldCapabilities(),touchForcedLow:false};
  return quality;
}

function serializeError(error){
  return Object.freeze({name:String(error?.name||'Error'),message:String(error?.message||error||'Unknown visual runtime error'),stack:String(error?.stack||'').split('\n').slice(0,5).join(' | '),at:new Date().toISOString()});
}

function recordVisualError(system,error){
  const previous=globalThis.WisdoVisualRuntimeErrors||{};
  const next=Object.freeze({...previous,[system]:serializeError(error)});
  globalThis.WisdoVisualRuntimeErrors=next;
  try{window.dispatchEvent(new CustomEvent('wisdo:visual-runtime-error',{detail:{system,error:next[system]}}));}catch{}
  return next[system];
}

async function safeJson(url,{timeoutMs=4500}={}){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(new DOMException('Timed out','AbortError')),timeoutMs);
  try{const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:controller.signal});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||body.message||`Request failed: ${response.status}`);return body;}finally{clearTimeout(timer);}
}

export async function installProductionFidelity({THREE,scene,camera,renderer,debug=false}={}){
  if(!THREE||!scene||!camera||!renderer)throw new TypeError('Production fidelity runtime requires the active Three.js scene.');
  const quality=resolveQuality();
  globalThis.WisdoWorldSafetyDiagnostics=Object.freeze({executionFromVisuals:false,authority:'WISDO_COMMAND_API',verifiedAt:new Date().toISOString()});

  let cinematic=null,arcadePlaza=null,visualV2=null,visualV3=null,visualV4=null,marketManager=null;
  try{cinematic=installResilientCinematicWorldLayer({THREE,scene,camera,renderer,quality,debug});}catch(error){recordVisualError('cinematic',error);console.warn('WISDO cinematic visual layer degraded; production city remains active.',error);}
  try{arcadePlaza=installResilientArcadeCityVerticalSlice({THREE,scene,camera,renderer,quality,debug});}catch(error){recordVisualError('arcade-plaza',error);console.warn('WISDO Arcade Plaza vertical slice degraded; core World remains active.',error);}
  try{visualV2=installWisdoVisualFidelityV2({THREE,scene,camera,renderer,quality,debug});}catch(error){recordVisualError('visual-fidelity-v2',error);console.warn('WISDO Visual Fidelity V2 degraded; cinematic core remains active.',error);}
  try{visualV3=installWisdoVisualFidelityV3({THREE,scene,camera,renderer,quality,debug});}catch(error){recordVisualError('visual-fidelity-v3',error);console.warn('WISDO Visual Fidelity V3 degraded; V2 remains active.',error);}
  try{visualV4=installWisdoVisualFidelityV4({THREE,scene,camera,renderer,quality,debug});}catch(error){recordVisualError('visual-fidelity-v4',error);console.warn('WISDO Visual Fidelity V4 degraded; V3 remains active.',error);}

  const publishDiagnostics=(patch={})=>{
    const previous=globalThis.WisdoWorldDiagnostics||{};
    const next=Object.freeze({...previous,...patch,fidelityQuality:quality,clientRevision:FIDELITY_CLIENT_REVISION,fakeCandlesAllowed:false,
      visualArchitecture:visualV4?.diagnostics?.artDirection||visualV3?.diagnostics?.artDirection||visualV2?.diagnostics?.artDirection||cinematic?.diagnostics?.visualPass||'production-city-core',
      cinematicActive:Boolean(cinematic?.diagnostics?.active),arcadePlazaActive:Boolean(arcadePlaza?.diagnostics?.active),visualFidelityV2Active:Boolean(visualV2?.diagnostics?.active),visualFidelityV3Active:Boolean(visualV3?.diagnostics?.active),visualFidelityV4Active:Boolean(visualV4?.diagnostics?.active),
      visualFidelityV2Objects:visualV2?.diagnostics?.objects||[],visualFidelityV3Objects:visualV3?.diagnostics?.objects||[],visualFidelityV4Objects:visualV4?.diagnostics?.objects||[],
      v3CrowdCount:visualV3?.diagnostics?.crowdCount||0,v4CrowdCount:visualV4?.diagnostics?.crowdCount||0,v4PalmCount:visualV4?.diagnostics?.palmCount||0,v4StorefrontCount:visualV4?.diagnostics?.storefrontCount||0,v3TargetMobileFps:visualV3?.diagnostics?.targetMobileFps||30,
      arcadeBusinesses:arcadePlaza?.diagnostics?.businesses||[],npcCount:arcadePlaza?.diagnostics?.npcCount||0,palmCount:arcadePlaza?.diagnostics?.palmCount||0,executionFromVisualLayer:false,visualErrors:globalThis.WisdoVisualRuntimeErrors||{},updatedAt:new Date().toISOString()});
    globalThis.WisdoWorldDiagnostics=next;return next;
  };
  publishDiagnostics();

  try{marketManager=createMarketBillboardManager({THREE,scene,camera,qualityName:quality,onChanged:({markets,billboardCount,assignments=[]})=>{publishDiagnostics({activeSymbols:markets.map((m)=>m.symbol),authorizedParticipants:markets.reduce((sum,m)=>sum+Number(m.activeOperatorCount||0),0),activeBillboards:billboardCount,billboardAnchorAssignments:assignments});}});}catch(error){recordVisualError('market-billboards',error);publishDiagnostics();console.warn('WISDO market billboard layer degraded; World remains active.',error);}

  let refreshBusy=false,destroyed=false,last=performance.now(),elapsed=0,frameId=0;
  async function refreshMarkets(){if(refreshBusy||destroyed||!marketManager)return;refreshBusy=true;try{const payload=await safeJson('/api/world/markets/active',{timeoutMs:4500});marketManager.setMarkets(Array.isArray(payload.markets)?payload.markets:[]);if(debug)console.debug('[WISDO WORLD MARKETS]',globalThis.WisdoWorldDiagnostics);}catch(error){if(error?.name!=='AbortError'&&debug&&!String(error?.message||'').includes('Authentication'))console.debug('[WISDO WORLD MARKETS] unavailable',error?.message||error);}finally{refreshBusy=false;}}

  void refreshMarkets();const timer=setInterval(()=>{void refreshMarkets();},5000);
  function frame(now){if(destroyed)return;frameId=requestAnimationFrame(frame);const dt=Math.min(.05,Math.max(.001,(now-last)/1000));last=now;elapsed+=dt;try{marketManager?.update?.(dt,elapsed);}catch(error){recordVisualError('market-billboard-frame',error);}try{visualV2?.update?.(dt,elapsed);}catch(error){recordVisualError('visual-fidelity-v2-frame',error);}try{visualV3?.update?.(dt,elapsed);}catch(error){recordVisualError('visual-fidelity-v3-frame',error);}try{visualV4?.update?.(dt,elapsed);}catch(error){recordVisualError('visual-fidelity-v4-frame',error);}}
  frameId=requestAnimationFrame(frame);

  return{quality,clientRevision:FIDELITY_CLIENT_REVISION,cinematic:cinematic?.diagnostics||null,arcadePlaza:arcadePlaza?.diagnostics||null,visualV2:visualV2?.diagnostics||null,visualV3:visualV3?.diagnostics||null,visualV4:visualV4?.diagnostics||null,diagnostics:globalThis.WisdoWorldDiagnostics,destroy(){destroyed=true;cancelAnimationFrame(frameId);clearInterval(timer);try{marketManager?.destroy?.();}catch{}try{visualV4?.destroy?.();}catch{}try{visualV3?.destroy?.();}catch{}try{visualV2?.destroy?.();}catch{}try{arcadePlaza?.destroy?.();}catch{}try{cinematic?.destroy?.();}catch{}}};
}
