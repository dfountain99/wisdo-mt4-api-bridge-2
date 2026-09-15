import { THREE_MODULE_URL, chooseAutoQuality, getWorldCapabilities } from './world-config.js?v=2026.09.15.visual-fidelity-v3';
import { createAdaptiveQualityController } from './world-quality.js?v=2026.09.15.visual-fidelity-v3';
import { installProductionFidelity } from './production-fidelity-layer.js?v=2026.09.15.visual-fidelity-v3';
import { installAuthoredOperator } from './authored-operator.js?v=2026.09.15.visual-fidelity-v3';
import { AUTHORED_WORLD_ASSETS } from './authored-asset-manifest.js?v=2026.09.15.visual-fidelity-v3';
import { createWorldExperience as createCoreWorldExperience } from './world3d-production-core.js?v=2026.09.15.visual-fidelity-v3';

// Compatibility contract retained for the production rebuild regression suite.
const PRODUCTION_CITY_COMPATIBILITY = 'production-city-v1';
const WORLD_CLIENT_REVISION = '2026.09.15.visual-fidelity-v3';
globalThis.WisdoWorldClientRevision = WORLD_CLIENT_REVISION;

function publishQualityDiagnostics(patch={}){
  globalThis.WisdoQualityDiagnostics=Object.freeze({...(globalThis.WisdoQualityDiagnostics||{}),...patch,updatedAt:new Date().toISOString()});
  return globalThis.WisdoQualityDiagnostics;
}

function publishOperatorDiagnostics(instanceId,patch={}){
  if(instanceId&&globalThis.WisdoWorldRenderInstance!==instanceId)return globalThis.WisdoOperatorDiagnostics||{};
  const next=Object.freeze({...(globalThis.WisdoOperatorDiagnostics||{}),...patch,instanceId,updatedAt:new Date().toISOString()});
  globalThis.WisdoOperatorDiagnostics=next;
  try{window.dispatchEvent(new CustomEvent('wisdo:operator-diagnostics',{detail:next}));}catch{}
  return next;
}

function publishRenderContextDiagnostics(instanceId,patch={}){
  if(instanceId&&globalThis.WisdoWorldRenderInstance!==instanceId)return globalThis.WisdoRenderContextDiagnostics||{};
  const next=Object.freeze({...(globalThis.WisdoRenderContextDiagnostics||{}),...patch,instanceId,clientRevision:WORLD_CLIENT_REVISION,updatedAt:new Date().toISOString()});
  globalThis.WisdoRenderContextDiagnostics=next;
  try{window.dispatchEvent(new CustomEvent('wisdo:world-render-context',{detail:next}));}catch{}
  return next;
}

export async function createWorldExperience(options={}){
  const THREE=await import(THREE_MODULE_URL);
  const instanceId=globalThis.crypto?.randomUUID?.()||`world-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  globalThis.WisdoWorldRenderInstance=instanceId;
  const isCurrent=()=>globalThis.WisdoWorldRenderInstance===instanceId;
  let capturedScene=null,capturedCamera=null,capturedRenderer=null,core=null,adaptive=null,destroyed=false;
  const requestedQuality=options.preferences?.quality||'auto';
  publishRenderContextDiagnostics(instanceId,{status:'WAITING',source:'CORE_CALLBACK',reason:null});
  const captureRenderContext=(context={})=>{
    if(!isCurrent())return;
    capturedScene=context.scene||null;
    capturedCamera=context.camera||null;
    capturedRenderer=context.renderer||null;
    const complete=Boolean(capturedScene&&capturedCamera&&capturedRenderer);
    publishRenderContextDiagnostics(instanceId,{status:complete?'CAPTURED':'INCOMPLETE',source:'CORE_CALLBACK',reason:complete?null:'Core callback did not provide scene, camera and renderer.'});
    try{options.onRenderContext?.(context);}catch(error){console.warn('External render-context observer degraded.',error);}
  };
  const telemetryProxy=(data={})=>{const operator=globalThis.WisdoOperatorDiagnostics||{},renderer=capturedRenderer;const enriched={...data,dpr:renderer?.getPixelRatio?.()??null,shadows:Boolean(renderer?.shadowMap?.enabled),rendererWidth:renderer?.domElement?.width||null,rendererHeight:renderer?.domElement?.height||null,operatorRenderer:operator.renderer||document.documentElement.dataset.wisdoOperator||'WISDO_HUMANOID_FALLBACK',operatorStatus:operator.status||'STARTING',qualityDecision:globalThis.WisdoQualityDiagnostics?.activeQuality||data.quality||null,visualArchitecture:globalThis.WisdoVisualFidelityV3Diagnostics?.artDirection||globalThis.WisdoVisualFidelityV2Diagnostics?.artDirection||globalThis.WisdoCinematicDiagnostics?.visualPass||'production-city-core',clientRevision:WORLD_CLIENT_REVISION};if(isCurrent())globalThis.WisdoRenderDiagnostics=Object.freeze(enriched);adaptive?.sample(enriched);options.onTelemetry?.(enriched);};
  core=await createCoreWorldExperience({...options,onTelemetry:telemetryProxy,onRenderContext:captureRenderContext});
  const capabilities=getWorldCapabilities();
  publishQualityDiagnostics({requestedQuality,initialQuality:core?.quality||chooseAutoQuality(),activeQuality:core?.quality||chooseAutoQuality(),adaptive:requestedQuality==='auto',capabilities,touchForcedLow:false,lastReason:'production-city-capability-policy'});
  adaptive=createAdaptiveQualityController({initialQuality:core?.quality||chooseAutoQuality(),enabled:requestedQuality==='auto',setQuality:(quality)=>core?.setQuality?.(quality),onChange:({quality,reason,sample})=>publishQualityDiagnostics({activeQuality:quality,lastReason:reason,lastFps:sample?.fps??null})});
  if(!capturedScene||!capturedCamera||!capturedRenderer){
    if(isCurrent()){
      document.documentElement.dataset.wisdoFidelity='degraded';
      globalThis.WisdoFidelityStatus=Object.freeze({active:false,reason:'render_context_callback_failed',installedAt:new Date().toISOString(),instanceId});
      publishRenderContextDiagnostics(instanceId,{status:'FAILED',source:'CORE_CALLBACK',reason:'Core renderer initialized without publishing a complete render context.'});
    }
    console.warn('Production render context unavailable; city core remains active.');
    return core;
  }
  if(isCurrent()){
    globalThis.WisdoWorldScene=capturedScene;
    globalThis.WisdoWorldSceneInstance=instanceId;
    globalThis.WisdoWorldSafetyDiagnostics=Object.freeze({executionFromVisuals:false,authority:'WISDO_COMMAND_API',verifiedAt:new Date().toISOString()});
    window.dispatchEvent(new CustomEvent('wisdo:world-renderer-ready',{detail:{instanceId,scene:'central',clientRevision:WORLD_CLIENT_REVISION}}));
  }

  const debug=new URLSearchParams(location.search).get('debug')==='1';
  let fidelity=null,authoredOperator=null;
  const asset=AUTHORED_WORLD_ASSETS.defaultOperator;
  if(isCurrent()){
    document.documentElement.dataset.wisdoOperator='loading-authored-glb';
    publishOperatorDiagnostics(instanceId,{renderer:'PROCEDURAL_FALLBACK',status:'QUEUED',active:false,assetId:asset.id,assetUrl:asset.url,source:asset.sourceRepository,sourceCommit:asset.sourceCommit,failureReason:null,clips:[]});
  }

  const operatorTask=installAuthoredOperator({THREE,scene:capturedScene,debug,instanceId}).then((result)=>{
    if(destroyed||!isCurrent()){result?.destroy?.();return null;}
    authoredOperator=result;
    return result;
  }).catch((error)=>{
    if(!destroyed&&isCurrent()){
      document.documentElement.dataset.wisdoOperator='wisdo-humanoid-fallback';
      const existing=globalThis.WisdoOperatorDiagnostics||{};
      publishOperatorDiagnostics(instanceId,{...existing,renderer:'WISDO_HUMANOID_FALLBACK',active:false,status:'FALLBACK_ACTIVE',assetId:existing.assetId||asset.id,assetUrl:existing.assetUrl||asset.url,failureReason:existing.failureReason||error?.message||'authored_operator_failed'});
    }
    console.warn('Authored Operator unavailable; keeping built-in humanoid fallback.',error);
    return null;
  });

  try{
    fidelity=await installProductionFidelity({THREE,scene:capturedScene,camera:capturedCamera,renderer:capturedRenderer,destinations:options.destinations||[],debug});
    if(isCurrent()){
      document.documentElement.dataset.wisdoFidelity='active';
      globalThis.WisdoFidelityStatus=Object.freeze({active:true,quality:fidelity?.quality||null,installedAt:new Date().toISOString(),renderer:'production-city-visual-fidelity-v3',instanceId});
    }
  }catch(error){
    if(isCurrent()){
      document.documentElement.dataset.wisdoFidelity='degraded';
      globalThis.WisdoFidelityStatus=Object.freeze({active:false,reason:error?.message||'install_failed',installedAt:new Date().toISOString(),instanceId});
    }
    console.warn('Visual fidelity presentation degraded; city core remains active.',error);
  }

  operatorTask.finally(()=>{
    if(!destroyed&&isCurrent()&&!globalThis.WisdoOperatorDiagnostics?.active&&globalThis.WisdoCinematicDiagnostics?.cinematicFallbackOperator){
      document.documentElement.dataset.wisdoOperator='cinematic-fallback';
      publishOperatorDiagnostics(instanceId,{renderer:'CINEMATIC_FALLBACK',status:'FALLBACK_ACTIVE',active:false,assetId:asset.id,assetUrl:asset.url,failureReason:globalThis.WisdoOperatorDiagnostics?.failureReason||'Authored asset unavailable; cinematic fallback active.'});
    }
  }).catch(()=>{});

  const baseDestroy=core?.destroy?.bind(core),baseSetPreferences=core?.setPreferences?.bind(core);
  return{...core,visualPass:'production-city-v4-visual-fidelity-v3',clientRevision:WORLD_CLIENT_REVISION,compatibilityMarker:PRODUCTION_CITY_COMPATIBILITY,fidelityQuality:fidelity?.quality||null,get operatorRenderer(){return authoredOperator?.active?'authored-glb':globalThis.WisdoOperatorDiagnostics?.renderer||document.documentElement.dataset.wisdoOperator||'wisdo-humanoid-fallback';},setPreferences(next={}){baseSetPreferences?.(next);if(!Object.prototype.hasOwnProperty.call(next,'quality'))return;if(next.quality==='auto'){const automatic=chooseAutoQuality();core?.setQuality?.(automatic);adaptive?.reset?.(automatic);adaptive?.setEnabled?.(true);publishQualityDiagnostics({requestedQuality:'auto',activeQuality:automatic,adaptive:true,lastReason:'user-auto'});}else{adaptive?.setEnabled?.(false);adaptive?.reset?.(next.quality);publishQualityDiagnostics({requestedQuality:next.quality,activeQuality:next.quality,adaptive:false,lastReason:'user-manual'});}},destroy(){destroyed=true;try{authoredOperator?.destroy?.();}catch(error){console.warn('Authored Operator cleanup degraded',error);}try{fidelity?.destroy?.();}catch(error){console.warn('Visual fidelity cleanup degraded',error);}baseDestroy?.();if(isCurrent()){delete document.documentElement.dataset.wisdoFidelity;delete document.documentElement.dataset.wisdoOperator;delete globalThis.WisdoWorldScene;delete globalThis.WisdoWorldSceneInstance;delete globalThis.WisdoWorldRenderInstance;delete globalThis.WisdoRenderContextDiagnostics;}operatorTask?.catch?.(()=>{});}};
}
