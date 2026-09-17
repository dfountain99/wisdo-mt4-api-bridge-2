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

const yes=(value)=>value===true?1:0;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

export function evaluateVisualFidelityRuntime({operator={},v4={},render={},safety={}}={}){
  const d=v4?.diagnostics||v4||{};
  const target=d.target||{};
  const fps=Number(render?.fps||0);
  const desktop=!(d.touchLike===true);
  const targetFps=desktop?60:30;
  const scores={
    character:VISUAL_FIDELITY_DIMENSIONS.character*clamp((yes(operator?.active)+yes(String(operator?.renderer||'').includes('V4')))/2,0,1),
    animation:VISUAL_FIDELITY_DIMENSIONS.animation*clamp((yes(operator?.animationGraph)+yes(operator?.secondaryMotion)+yes(operator?.lookAt))/3,0,1),
    environment:VISUAL_FIDELITY_DIMENSIONS.environment*clamp((yes(target.academyEntrance)+yes(target.masterChamberPortal)+yes(target.reflectiveCourt))/3,0,1),
    lighting:VISUAL_FIDELITY_DIMENSIONS.lighting*yes(d.environmentPbr),
    materials:VISUAL_FIDELITY_DIMENSIONS.materials*clamp((yes(d.environmentPbr)+yes(target.reflectiveCourt))/2,0,1),
    camera:VISUAL_FIDELITY_DIMENSIONS.camera*yes(render?.player),
    atmosphere:VISUAL_FIDELITY_DIMENSIONS.atmosphere*yes(Array.isArray(d.objects)&&d.objects.includes('WisdoV4AtmosphereParticles')),
    performance:VISUAL_FIDELITY_DIMENSIONS.performance*(fps>0?clamp(fps/targetFps,0,1):0),
    integration:VISUAL_FIDELITY_DIMENSIONS.integration*yes(safety?.executionFromVisuals===false),
  };
  const total=Math.round(Object.values(scores).reduce((sum,value)=>sum+value,0));
  return Object.freeze({
    total,
    threshold:VISUAL_FIDELITY_ACCEPTANCE_THRESHOLD,
    runtimeReady:total>=VISUAL_FIDELITY_ACCEPTANCE_THRESHOLD,
    scores:Object.freeze(Object.fromEntries(Object.entries(scores).map(([key,value])=>[key,Math.round(value)]))),
    note:'Runtime readiness is not a substitute for human screenshot/animation review against the WISDO visual target.',
  });
}
