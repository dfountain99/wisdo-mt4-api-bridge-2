import { THREE_MODULE_URL, chooseAutoQuality, getWorldCapabilities } from './world-config.js';
import { createAdaptiveQualityController } from './world-quality.js';
import { installProductionFidelity } from './production-fidelity-layer.js';
import { installAuthoredOperator } from './authored-operator.js';
import { installWorldMasterProduction } from './world-master-production-layer.js';
import { createWorldExperience as createCoreWorldExperience } from './world3d-production-core.js';

function publishQualityDiagnostics(patch={}){
  globalThis.WisdoQualityDiagnostics=Object.freeze({...(globalThis.WisdoQualityDiagnostics||{}),...patch,updatedAt:new Date().toISOString()});
  return globalThis.WisdoQualityDiagnostics;
}

export async function createWorldExperience(options={}){
  const THREE=await import(THREE_MODULE_URL);
  const instanceId=globalThis.crypto?.randomUUID?.()||`world-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  globalThis.WisdoWorldRenderInstance=instanceId;
  const isCurrent=()=>globalThis.WisdoWorldRenderInstance===instanceId;
  let capturedScene=null,capturedCamera=null,capturedRenderer=null,core=null,adaptive=null,destroyed=false;
  let fidelity=null,authoredOperator=null,masterLayer=null;
  const requestedQuality=options.preferences?.quality||'auto';
  const proto=THREE.WebGLRenderer.prototype,originalRender=proto.render;
  proto.render=function captureProductionWorld(scene,camera){capturedScene||=scene;capturedCamera||=camera;capturedRenderer||=this;return originalRender.call(this,scene,camera);};
  const telemetryProxy=(data={})=>{
    const operator=globalThis.WisdoOperatorDiagnostics||{},renderer=capturedRenderer;
    const enriched={...data,dpr:renderer?.getPixelRatio?.()??null,shadows:Boolean(renderer?.shadowMap?.enabled),rendererWidth:renderer?.domElement?.width||null,rendererHeight:renderer?.domElement?.height||null,operatorRenderer:operator.renderer||document.documentElement.dataset.wisdoOperator||'WISDO_HUMANOID_FALLBACK',operatorStatus:operator.status||'STARTING',qualityDecision:globalThis.WisdoQualityDiagnostics?.activeQuality||data.quality||null,visualArchitecture:'wisdo-world-master-v1'};
    if(isCurrent())globalThis.WisdoRenderDiagnostics=Object.freeze(enriched);
    adaptive?.sample(enriched);options.onTelemetry?.(enriched);
  };
  try{core=await createCoreWorldExperience({...options,onTelemetry:telemetryProxy});}finally{proto.render=originalRender;}
  const capabilities=getWorldCapabilities();
  const initialQuality=core?.quality||chooseAutoQuality();
  publishQualityDiagnostics({requestedQuality,initialQuality,activeQuality:initialQuality,adaptive:requestedQuality==='auto',capabilities,touchForcedLow:false,lastReason:'world-master-capability-policy'});
  adaptive=createAdaptiveQualityController({initialQuality,enabled:requestedQuality==='auto',setQuality:(quality)=>{core?.setQuality?.(quality);masterLayer?.setQuality?.(quality);},onChange:({quality,reason,sample})=>publishQualityDiagnostics({activeQuality:quality,lastReason:reason,lastFps:sample?.fps??null})});
  if(!capturedScene||!capturedCamera||!capturedRenderer){
    if(isCurrent()){document.documentElement.dataset.wisdoFidelity='degraded';globalThis.WisdoFidelityStatus=Object.freeze({active:false,reason:'renderer_capture_failed',installedAt:new Date().toISOString()});}
    console.warn('Production renderer capture failed; city core remains active.');return core;
  }
  const debug=new URLSearchParams(location.search).get('debug')==='1';
  try{
    masterLayer=await installWorldMasterProduction({THREE,scene:capturedScene,camera:capturedCamera,renderer:capturedRenderer,destinations:options.destinations||[],debug,instanceId});
    masterLayer?.setQuality?.(initialQuality);
    if(isCurrent())globalThis.WisdoMasterWorldStatus=Object.freeze({active:true,version:masterLayer?.version||'WISDO-WORLD-MASTER-V1',installedAt:new Date().toISOString(),instanceId});
  }catch(error){
    if(isCurrent())globalThis.WisdoMasterWorldStatus=Object.freeze({active:false,reason:error?.message||'master_layer_failed',installedAt:new Date().toISOString(),instanceId});
    console.warn('WISDO master production layer degraded; production city core remains active.',error);
  }
  try{
    fidelity=await installProductionFidelity({THREE,scene:capturedScene,camera:capturedCamera,renderer:capturedRenderer,destinations:options.destinations||[],debug});
    if(isCurrent()){document.documentElement.dataset.wisdoFidelity='active';globalThis.WisdoFidelityStatus=Object.freeze({active:true,quality:fidelity?.quality||null,installedAt:new Date().toISOString(),renderer:'production-city-live-systems',instanceId});}
  }catch(error){
    if(isCurrent()){document.documentElement.dataset.wisdoFidelity='degraded';globalThis.WisdoFidelityStatus=Object.freeze({active:false,reason:error?.message||'install_failed',installedAt:new Date().toISOString(),instanceId});}
    console.warn('Live market presentation degraded; city core remains active.',error);
  }
  if(isCurrent())document.documentElement.dataset.wisdoOperator='loading-authored-glb';
  const operatorTask=installAuthoredOperator({THREE,scene:capturedScene,debug,instanceId}).then((result)=>{
    if(destroyed||!isCurrent()){result?.destroy?.();return null;}authoredOperator=result;return result;
  }).catch((error)=>{
    if(!destroyed&&isCurrent()){
      document.documentElement.dataset.wisdoOperator='wisdo-humanoid-fallback';const existing=globalThis.WisdoOperatorDiagnostics||{};
      globalThis.WisdoOperatorDiagnostics=Object.freeze({...existing,renderer:'WISDO_HUMANOID_FALLBACK',active:false,status:existing.status?.includes?.('FAILED')?existing.status:'FAILED',failureReason:existing.failureReason||error?.message||'authored_operator_failed',instanceId,updatedAt:new Date().toISOString()});
    }
    console.warn('Authored Operator unavailable; keeping built-in humanoid fallback.',error);return null;
  });
  const baseDestroy=core?.destroy?.bind(core),baseSetPreferences=core?.setPreferences?.bind(core);
  return{
    ...core,
    visualPass:'wisdo-world-master-v1',
    fidelityQuality:fidelity?.quality||null,
    get operatorRenderer(){return authoredOperator?.active?'authored-glb':document.documentElement.dataset.wisdoOperator||'wisdo-humanoid-fallback';},
    setPreferences(next={}){
      baseSetPreferences?.(next);if(!Object.prototype.hasOwnProperty.call(next,'quality'))return;
      if(next.quality==='auto'){
        const automatic=chooseAutoQuality();core?.setQuality?.(automatic);masterLayer?.setQuality?.(automatic);adaptive?.reset?.(automatic);adaptive?.setEnabled?.(true);publishQualityDiagnostics({requestedQuality:'auto',activeQuality:automatic,adaptive:true,lastReason:'user-auto'});
      }else{
        masterLayer?.setQuality?.(next.quality);adaptive?.setEnabled?.(false);adaptive?.reset?.(next.quality);publishQualityDiagnostics({requestedQuality:next.quality,activeQuality:next.quality,adaptive:false,lastReason:'user-manual'});
      }
    },
    destroy(){
      destroyed=true;
      try{authoredOperator?.destroy?.();}catch(error){console.warn('Authored Operator cleanup degraded',error);}
      try{fidelity?.destroy?.();}catch(error){console.warn('Live market cleanup degraded',error);}
      try{masterLayer?.destroy?.();}catch(error){console.warn('Master World cleanup degraded',error);}
      baseDestroy?.();
      if(isCurrent()){
        delete document.documentElement.dataset.wisdoFidelity;delete document.documentElement.dataset.wisdoOperator;delete document.documentElement.dataset.wisdoMasterWorld;
        delete globalThis.WisdoMasterWorldStatus;delete globalThis.WisdoWorldRenderInstance;
      }
      operatorTask?.catch?.(()=>{});
    },
  };
}
