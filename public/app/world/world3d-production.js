import { THREE_MODULE_URL, chooseAutoQuality, getWorldCapabilities } from './world-config.js?v=2026.09.17.visual-fidelity-v4';
import { createAdaptiveQualityController } from './world-quality.js?v=2026.09.17.visual-fidelity-v4';
import { installProductionFidelityV4 } from './production-fidelity-layer-v4.js?v=2026.09.25.city-phone-fix';
import { installAuthoredOperatorV4 } from './authored-operator-v4.js?v=2026.09.17.visual-fidelity-v4';
import { installAuthoredOperator as installLegacyAuthoredOperator } from './authored-operator.js?v=2026.09.17.visual-fidelity-v4';
import { AUTHORED_WORLD_ASSETS } from './authored-asset-manifest.js?v=2026.09.17.visual-fidelity-v4';
import { createWorldExperience as createCoreWorldExperience } from './world3d-production-core.js?v=2026.09.17.visual-fidelity-v4';

const WORLD_CLIENT_REVISION='2026.09.25.city-phone-fix';
const PRODUCTION_CITY_COMPATIBILITY='production-city-v1';
globalThis.WisdoWorldClientRevision=WORLD_CLIENT_REVISION;

function publish(name,instanceId,patch={}){
  if(instanceId&&globalThis.WisdoWorldRenderInstance!==instanceId)return globalThis[name]||{};
  const next=Object.freeze({...(globalThis[name]||{}),...patch,instanceId,clientRevision:WORLD_CLIENT_REVISION,updatedAt:new Date().toISOString()});
  globalThis[name]=next;return next;
}

export async function createWorldExperience(options={}){
  const THREE=await import(THREE_MODULE_URL);
  const instanceId=globalThis.crypto?.randomUUID?.()||`world-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  globalThis.WisdoWorldRenderInstance=instanceId;
  const isCurrent=()=>globalThis.WisdoWorldRenderInstance===instanceId;
  let scene=null,camera=null,renderer=null,core=null,adaptive=null,fidelity=null,operatorRuntime=null,destroyed=false;
  const requestedQuality=options.preferences?.quality||'auto';

  const capture=(context={})=>{
    if(!isCurrent())return;
    scene=context.scene||null;camera=context.camera||null;renderer=context.renderer||null;
    publish('WisdoRenderContextDiagnostics',instanceId,{status:scene&&camera&&renderer?'CAPTURED':'INCOMPLETE',source:'CORE_CALLBACK'});
    try{options.onRenderContext?.(context);}catch(error){console.warn('External WISDO render observer degraded.',error);}
  };
  const telemetry=(data={})=>{
    const enriched={...data,dpr:renderer?.getPixelRatio?.()??null,shadows:Boolean(renderer?.shadowMap?.enabled),rendererWidth:renderer?.domElement?.width||null,rendererHeight:renderer?.domElement?.height||null,operatorStatus:globalThis.WisdoOperatorDiagnostics?.status||'STARTING',operatorRenderer:globalThis.WisdoOperatorDiagnostics?.renderer||'FALLBACK',visualArchitecture:globalThis.WisdoVisualFidelityV4Diagnostics?.artDirection||globalThis.WisdoWorldDiagnostics?.visualArchitecture||'production-city-core',clientRevision:WORLD_CLIENT_REVISION};
    if(isCurrent())globalThis.WisdoRenderDiagnostics=Object.freeze(enriched);
    adaptive?.sample(enriched);options.onTelemetry?.(enriched);
  };

  core=await createCoreWorldExperience({...options,onRenderContext:capture,onTelemetry:telemetry});
  const activeQuality=core?.quality||chooseAutoQuality();
  publish('WisdoQualityDiagnostics',instanceId,{requestedQuality,activeQuality,initialQuality:activeQuality,adaptive:requestedQuality==='auto',capabilities:getWorldCapabilities(),lastReason:'v4-capability-policy'});
  adaptive=createAdaptiveQualityController({initialQuality:activeQuality,enabled:requestedQuality==='auto',setQuality:(quality)=>core?.setQuality?.(quality),onChange:({quality,reason,sample})=>publish('WisdoQualityDiagnostics',instanceId,{activeQuality:quality,lastReason:reason,lastFps:sample?.fps??null})});
  if(!scene||!camera||!renderer){publish('WisdoRenderContextDiagnostics',instanceId,{status:'FAILED',reason:'Core renderer did not expose scene/camera/renderer.'});return core;}

  globalThis.WisdoWorldScene=scene;globalThis.WisdoWorldSceneInstance=instanceId;
  globalThis.WisdoWorldSafetyDiagnostics=Object.freeze({executionFromVisuals:false,authority:'WISDO_COMMAND_API',verifiedAt:new Date().toISOString()});
  try{window.dispatchEvent(new CustomEvent('wisdo:world-renderer-ready',{detail:{instanceId,scene:'central',clientRevision:WORLD_CLIENT_REVISION}}));}catch{}

  const debug=new URLSearchParams(globalThis.location?.search||'').get('debug')==='1';const asset=AUTHORED_WORLD_ASSETS.defaultOperator;
  // The bundled CC0 suited model is a placeholder. On phones its face and idle pose
  // read as damaged; use the scene's animated WISDO operator until a reviewed asset lands.
  const useAuthoredOperator=asset.id!=='wisdo-default-operator-v1';
  document.documentElement.dataset.wisdoOperator=useAuthoredOperator?'loading-authored-glb':'city-stylized-operator';
  publish('WisdoOperatorDiagnostics',instanceId,{status:useAuthoredOperator?'V4_QUEUED':'STYLIZED_FALLBACK',active:false,renderer:'PROCEDURAL_FALLBACK',assetId:asset.id,assetUrl:asset.url});
  const operatorTask=(useAuthoredOperator?installAuthoredOperatorV4({THREE,scene,renderer,camera,debug,instanceId}):Promise.resolve(null)).catch(async(error)=>{
    if(destroyed||!isCurrent())return null;
    console.warn('Operator V4 unavailable; trying proven authored Operator fallback.',error);
    publish('WisdoOperatorDiagnostics',instanceId,{status:'V4_FALLBACK',failureReason:error?.message||String(error)});
    try{return await installLegacyAuthoredOperator({THREE,scene,debug,instanceId});}
    catch(legacyError){console.warn('Authored Operator fallback unavailable; built-in humanoid remains active.',legacyError);document.documentElement.dataset.wisdoOperator='wisdo-humanoid-fallback';publish('WisdoOperatorDiagnostics',instanceId,{status:'PROCEDURAL_FALLBACK_ACTIVE',active:false,renderer:'WISDO_HUMANOID_FALLBACK',failureReason:legacyError?.message||String(legacyError)});return null;}
  }).then((runtime)=>{if(destroyed){runtime?.destroy?.();return null;}operatorRuntime=runtime;if(isCurrent()&&runtime?.active)document.documentElement.dataset.wisdoOperator=runtime?.diagnostics?.renderer==='AUTHORED_GLTF_V4'?'authored-glb-v4':'authored-glb';return runtime;});

  try{
    fidelity=await installProductionFidelityV4({THREE,scene,camera,renderer,destinations:options.destinations||[],quality:activeQuality,debug});
    document.documentElement.dataset.wisdoFidelity='v4-active';
    globalThis.WisdoFidelityStatus=Object.freeze({active:true,renderer:'academy-cinematic-v4',quality:activeQuality,instanceId,installedAt:new Date().toISOString()});
  }catch(error){document.documentElement.dataset.wisdoFidelity='degraded';console.warn('V4 fidelity degraded; production city core remains active.',error);}

  const baseDestroy=core?.destroy?.bind(core),baseSetPreferences=core?.setPreferences?.bind(core);
  return {
    ...core,
    visualPass:'production-city-v5-visual-fidelity-v4',
    clientRevision:WORLD_CLIENT_REVISION,
    compatibilityMarker:PRODUCTION_CITY_COMPATIBILITY,
    get operatorRenderer(){return operatorRuntime?.active?'authored-v4':globalThis.WisdoOperatorDiagnostics?.renderer||'fallback';},
    setPreferences(next={}){
      baseSetPreferences?.(next);
      if(!Object.prototype.hasOwnProperty.call(next,'quality'))return;
      if(next.quality==='auto'){
        const q=chooseAutoQuality();core?.setQuality?.(q);adaptive?.reset?.(q);adaptive?.setEnabled?.(true);
        publish('WisdoQualityDiagnostics',instanceId,{requestedQuality:'auto',activeQuality:q,adaptive:true,lastReason:'user-auto'});
      }else{
        adaptive?.setEnabled?.(false);adaptive?.reset?.(next.quality);
        publish('WisdoQualityDiagnostics',instanceId,{requestedQuality:next.quality,activeQuality:next.quality,adaptive:false,lastReason:'user-manual'});
      }
    },
    destroy(){
      if(destroyed)return;destroyed=true;
      try{operatorRuntime?.destroy?.();}catch(error){console.warn('Operator V4 cleanup degraded.',error);}
      try{fidelity?.destroy?.();}catch(error){console.warn('Fidelity V4 cleanup degraded.',error);}
      operatorTask.catch(()=>{});baseDestroy?.();
      if(isCurrent()){
        delete document.documentElement.dataset.wisdoFidelity;
        delete document.documentElement.dataset.wisdoOperator;
        delete globalThis.WisdoWorldScene;delete globalThis.WisdoWorldSceneInstance;delete globalThis.WisdoWorldRenderInstance;
      }
    },
  };
}
