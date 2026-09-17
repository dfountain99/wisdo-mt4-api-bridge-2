(() => {
'use strict';
const BUILD='BABYLON-FIDELITY-V2';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
const damp=(current,target,lambda,dt)=>current+(target-current)*(1-Math.exp(-lambda*dt));
function publish(patch={}){
  const next=Object.freeze({...(globalThis.WisdoBabylonFidelityDiagnostics||{}),...patch,build:BUILD,updatedAt:new Date().toISOString()});
  globalThis.WisdoBabylonFidelityDiagnostics=next;
  try{window.dispatchEvent(new CustomEvent('wisdo:babylon-fidelity',{detail:next}));}catch{}
  return next;
}
function install({B,scene,engine,camera,low=false}={}){
  if(!B||!scene||!engine||!camera)throw new TypeError('WISDO Babylon fidelity requires engine, scene and camera.');
  let pipeline=null,ssao=null,environment=null,destroyed=false;
  const baseFov=camera.fov||0.8;
  scene.environmentIntensity=low ? .72:1.05;
  try{
    if(!scene.environmentTexture&&B.CubeTexture?.CreateFromPrefilteredData){
      environment=B.CubeTexture.CreateFromPrefilteredData('https://assets.babylonjs.com/environments/environmentSpecular.env',scene);
      scene.environmentTexture=environment;
    }
  }catch(error){console.warn('WISDO environment reflection map unavailable.',error);}
  try{
    if(B.DefaultRenderingPipeline){
      pipeline=new B.DefaultRenderingPipeline('wisdoProductionPipeline',true,scene,[camera]);
      pipeline.fxaaEnabled=true;
      pipeline.samples=low?1:4;
      pipeline.bloomEnabled=true;
      pipeline.bloomThreshold=low ? .88:.72;
      pipeline.bloomWeight=low ? .18:.28;
      pipeline.bloomKernel=low?32:64;
      pipeline.bloomScale=.5;
      pipeline.sharpenEnabled=!low;
      if(pipeline.sharpen){pipeline.sharpen.edgeAmount=.22;pipeline.sharpen.colorAmount=.82;}
      pipeline.chromaticAberrationEnabled=false;
      pipeline.grainEnabled=false;
      pipeline.depthOfFieldEnabled=false;
    }
  }catch(error){console.warn('WISDO post processing degraded.',error);pipeline=null;}
  try{
    if(!low&&B.SSAO2RenderingPipeline&&scene.postProcessRenderPipelineManager){
      ssao=new B.SSAO2RenderingPipeline('wisdoSSAO',scene,{ssaoRatio:.5,blurRatio:.5},[camera]);
      ssao.radius=1.6;ssao.totalStrength=.75;ssao.expensiveBlur=false;ssao.samples=8;
      scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline('wisdoSSAO',camera);
    }
  }catch(error){console.warn('WISDO SSAO unavailable; continuing without it.',error);ssao=null;}
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  scene.imageProcessingConfiguration.toneMappingType=B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure=low?1.02:1.12;
  scene.imageProcessingConfiguration.contrast=low?1.08:1.16;
  publish({
    active:true,
    engine:'babylonjs',
    environmentReflections:Boolean(scene.environmentTexture),
    pbr:true,
    fxaa:Boolean(pipeline),
    bloom:Boolean(pipeline?.bloomEnabled),
    ssao:Boolean(ssao),
    toneMapping:'ACES',
    quality:low?'MOBILE':'DESKTOP',
    targetFps:low?30:60,
    executionFromVisuals:false
  });
  return Object.freeze({
    update({dt=.016,speed=0,sprinting=false}={}){
      if(destroyed)return;
      const target=baseFov+(sprinting ? .085:speed>3 ? .035:0);
      camera.fov=damp(camera.fov||baseFov,target,sprinting?6.5:8.5,dt);
      if(scene.environmentIntensity!==undefined){
        const desired=sprinting?1.1:(low ? .72:1.05);
        scene.environmentIntensity=damp(scene.environmentIntensity,desired,2.5,dt);
      }
    },
    diagnostics:globalThis.WisdoBabylonFidelityDiagnostics,
    destroy(){
      if(destroyed)return;destroyed=true;
      try{pipeline?.dispose?.();}catch{}
      try{ssao?.dispose?.();}catch{}
      if(environment&&scene.environmentTexture===environment){try{environment.dispose?.();}catch{}scene.environmentTexture=null;}
      publish({active:false,status:'DESTROYED'});
    }
  });
}
globalThis.WISDOBabylonFidelity=Object.freeze({BUILD,install});
})();