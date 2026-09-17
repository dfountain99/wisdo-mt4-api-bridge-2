export const VISUAL_FIDELITY_ACCEPTANCE_THRESHOLD=80;
export const VISUAL_FIDELITY_DIMENSIONS=Object.freeze({
  character:15,
  animation:15,
  environment:15,
  lighting:10,
  materials:10,
  camera:10,
  atmosphere:10,
  performance:10,
  integration:5,
});

const yes=(value)=>Boolean(value)?1:0;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const average=(values=[])=>values.length?values.reduce((sum,value)=>sum+Number(value||0),0)/values.length:0;

export function evaluateVisualFidelityRuntime({operator={},v4={},render={},safety={},review={}}={}){
  const d=v4?.diagnostics||v4||{};
  const target=d.target||{};
  const fps=Number(render?.fps||0);
  const desktop=!(d.touchLike===true);
  const targetFps=desktop?60:30;
  const productionAsset=yes(operator?.productionAsset);
  const animationCoverage=clamp(operator?.coreAnimationCoverage,0,1);
  const scores={
    character:VISUAL_FIDELITY_DIMENSIONS.character*clamp(average([yes(operator?.active),yes(String(operator?.renderer||'').includes('V4')),productionAsset]),0,1),
    animation:VISUAL_FIDELITY_DIMENSIONS.animation*clamp(average([yes(operator?.animationGraph),yes(operator?.secondaryMotion),yes(operator?.lookAt),animationCoverage]),0,1),
    environment:VISUAL_FIDELITY_DIMENSIONS.environment*clamp(average([yes(target.academyEntrance),yes(target.masterChamberPortal),yes(target.reflectiveCourt)]),0,1),
    lighting:VISUAL_FIDELITY_DIMENSIONS.lighting*yes(d.environmentPbr),
    materials:VISUAL_FIDELITY_DIMENSIONS.materials*clamp(average([yes(d.environmentPbr),yes(target.reflectiveCourt)]),0,1),
    camera:VISUAL_FIDELITY_DIMENSIONS.camera*yes(render?.player),
    atmosphere:VISUAL_FIDELITY_DIMENSIONS.atmosphere*yes(Array.isArray(d.objects)&&d.objects.includes('WisdoV4AtmosphereParticles')),
    performance:VISUAL_FIDELITY_DIMENSIONS.performance*(fps>0?clamp(fps/targetFps,0,1):0),
    integration:VISUAL_FIDELITY_DIMENSIONS.integration*yes(safety?.executionFromVisuals===false),
  };
  const total=Math.round(Object.values(scores).reduce((sum,value)=>sum+value,0));
  const runtimeReady=total>=VISUAL_FIDELITY_ACCEPTANCE_THRESHOLD;
  const screenshotApproved=review?.screenshotApproved===true;
  const animationApproved=review?.animationApproved===true;
  const humanReviewComplete=screenshotApproved&&animationApproved;
  return Object.freeze({
    total,
    threshold:VISUAL_FIDELITY_ACCEPTANCE_THRESHOLD,
    runtimeReady,
    releaseReady:runtimeReady&&humanReviewComplete,
    scores:Object.freeze(Object.fromEntries(Object.entries(scores).map(([key,value])=>[key,Math.round(value)]))),
    gates:Object.freeze({
      productionAsset:Boolean(productionAsset),
      animationCoverage:Number(animationCoverage.toFixed(3)),
      screenshotApproved,
      animationApproved,
      humanReviewComplete,
    }),
    note:'Runtime readiness is technical only. Release readiness requires human screenshot and animation review against the WISDO visual target.',
  });
}
