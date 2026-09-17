import { evaluateVisualFidelityRuntime } from './visual-fidelity-benchmark.js';

export function installVisualFidelityBenchmarkRuntime({intervalMs=2000}={}){
  let destroyed=false;
  const sample=()=>{
    if(destroyed)return null;
    const result=evaluateVisualFidelityRuntime({
      operator:globalThis.WisdoOperatorDiagnostics||{},
      v4:globalThis.WisdoVisualFidelityV4Diagnostics||{},
      render:globalThis.WisdoRenderDiagnostics||{},
      safety:globalThis.WisdoWorldSafetyDiagnostics||{},
    });
    globalThis.WisdoVisualAcceptance=Object.freeze({...result,sampledAt:new Date().toISOString()});
    try{window.dispatchEvent(new CustomEvent('wisdo:visual-fidelity-benchmark',{detail:globalThis.WisdoVisualAcceptance}));}catch{}
    return globalThis.WisdoVisualAcceptance;
  };
  const timer=setInterval(sample,Math.max(750,Number(intervalMs)||2000));sample();
  return Object.freeze({sample,get diagnostics(){return globalThis.WisdoVisualAcceptance||null;},destroy(){if(destroyed)return;destroyed=true;clearInterval(timer);delete globalThis.WisdoVisualAcceptance;}});
}
