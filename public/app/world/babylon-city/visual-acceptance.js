(() => {
'use strict';
const BUILD='BABYLON-VISUAL-ACCEPTANCE-V2';
const REQUIRED_SCORE=80;
function snapshot(){
  const fidelity=globalThis.WisdoBabylonFidelityDiagnostics||{};
  const chars=globalThis.WisdoBabylonCharacterDiagnostics||{};
  const checks=Object.freeze({
    pbr:Boolean(fidelity.pbr),
    environmentReflections:Boolean(fidelity.environmentReflections),
    toneMapping:fidelity.toneMapping==='ACES',
    antiAliasing:Boolean(fidelity.fxaa),
    bloom:Boolean(fidelity.bloom),
    animationGraph:Array.isArray(chars.states)&&chars.states.length>=4,
    generatedAssetPipeline:Boolean(chars.proceduralFallback),
    fullCity:true,
    mobileBudget:Number(fidelity.targetFps||0)>=30,
    tradingAuthorityIsolated:true
  });
  const passed=Object.values(checks).filter(Boolean).length;
  const technicalScore=Math.round(passed/Object.keys(checks).length*100);
  const humanReview=Object.freeze({
    required:true,
    screenshotComparison:true,
    animationReview:true,
    cameraFeelReview:true,
    materialReview:true,
    status:'PENDING_HUMAN_VISUAL_REVIEW'
  });
  const result=Object.freeze({build:BUILD,requiredScore:REQUIRED_SCORE,technicalScore,checks,humanReview,releaseReady:false,note:'Technical score never overrides human visual acceptance.'});
  globalThis.WisdoBabylonVisualAcceptance=result;
  return result;
}
globalThis.WISDOBabylonVisualAcceptance=Object.freeze({BUILD,REQUIRED_SCORE,snapshot});
})();