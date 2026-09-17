(() => {
'use strict';
const BUILD='BABYLON-CHARACTER-RUNTIME-V2';
const STATES=Object.freeze({IDLE:'IDLE',WALK:'WALK',RUN:'RUN',SPRINT:'SPRINT'});
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
const damp=(current,target,lambda,dt)=>current+(target-current)*(1-Math.exp(-lambda*dt));
function stateFor(speed,sprint){if(speed<.15)return STATES.IDLE;if(sprint&&speed>8)return STATES.SPRINT;if(speed>5.2)return STATES.RUN;return STATES.WALK;}
function rigOf(node){return node?.metadata?.wisdoRig||null;}
function animateRig(node,{speed=0,sprint=false,dt=.016,phaseGain=1,attention=null}={}){
  const rig=rigOf(node);if(!rig)return stateFor(speed,sprint);
  const state=stateFor(speed,sprint),moving=state!==STATES.IDLE;
  rig.phase=(rig.phase||0)+dt*(state===STATES.SPRINT?11.2:state===STATES.RUN?8.4:state===STATES.WALK?5.4:1.1)*phaseGain;
  const amplitude=moving?clamp(speed/10,.22,.92):.025;
  const swing=Math.sin(rig.phase)*amplitude;
  const targetLean=state===STATES.SPRINT?.14:state===STATES.RUN?.07:0;
  if(rig.body){rig.body.rotation.x=damp(rig.body.rotation.x||0,targetLean,9,dt);rig.body.position.y=(rig.bodyBaseY||3.1)+(moving?Math.abs(Math.sin(rig.phase*2))*.055:Math.sin(rig.phase*.55)*.018);}
  for(let i=0;i<2;i++){
    const sign=i===0?1:-1,leg=rig.legs?.[i],arm=rig.arms?.[i];
    if(leg)leg.rotation.x=damp(leg.rotation.x||0,swing*sign,15,dt);
    if(arm)arm.rotation.x=damp(arm.rotation.x||0,-swing*sign*.72,15,dt);
  }
  if(rig.head&&attention){
    const dx=attention.x-node.position.x,dz=attention.z-node.position.z;
    const wanted=Math.atan2(dx,dz)-node.rotation.y;
    rig.head.rotation.y=damp(rig.head.rotation.y||0,clamp(wanted,-.65,.65),7,dt);
  }else if(rig.head){rig.head.rotation.y=damp(rig.head.rotation.y||0,0,5,dt);}
  node.metadata.wisdoAnimationState=state;
  return state;
}
function splitUrl(url){const clean=String(url||'').trim();const slash=clean.lastIndexOf('/');return slash>=0?{root:clean.slice(0,slash+1),file:clean.slice(slash+1)}:{root:'',file:clean};}
function selectGroup(groups,names=[]){for(const name of names){const exact=groups.find(g=>g.name===name);if(exact)return exact;const low=String(name).toLowerCase(),match=groups.find(g=>String(g.name||'').toLowerCase()===low);if(match)return match;}return null;}
function makeGroupController(groups=[],clips={}){
  const map={};
  for(const key of ['idle','walk','run','sprint','greet','speak','point','seated']){
    map[key]=selectGroup(groups,clips?.[key]||[key,key.toUpperCase()]);
  }
  let current=null;
  function play(key){
    const next=map[key]||map.idle||map.walk||groups[0];if(!next||next===current)return;
    try{current?.stop?.();next.start(true,1,next.from,next.to,false);current=next;}catch{}
  }
  play('idle');
  return {play,stop(){try{for(const g of groups)g.stop?.();}catch{}},available:Object.freeze(groups.map(g=>g.name))};
}
async function importGenerated({B,scene,asset,parent,fallback,label}){
  if(!asset?.url)return null;
  const {root,file}=splitUrl(asset.url);
  const result=await B.SceneLoader.ImportMeshAsync(null,root,file,scene);
  const mount=new B.TransformNode(label,scene);mount.parent=parent;
  const top=result.meshes.filter(m=>m&&m.parent==null);
  for(const mesh of top){if(mesh===scene.meshes?.[0])continue;mesh.parent=mount;mesh.receiveShadows=true;}
  const vectors=mount.getHierarchyBoundingVectors?.(true);
  const height=vectors?Math.max(.001,vectors.max.y-vectors.min.y):1;
  const target=Number(asset.targetHeightMeters||1.82),scale=target/height;
  mount.scaling.setAll(scale);
  if(fallback)fallback.setEnabled(false);
  const controller=makeGroupController(result.animationGroups||[],asset.clips||{});
  return {mount,controller,asset};
}
function publish(patch={}){
  const next=Object.freeze({...(globalThis.WisdoBabylonCharacterDiagnostics||{}),...patch,build:BUILD,updatedAt:new Date().toISOString()});
  globalThis.WisdoBabylonCharacterDiagnostics=next;return next;
}
function install({B,scene,playerRoot,playerFallback,masterFallback,low=false}={}){
  let playerGenerated=null,masterGenerated=null,destroyed=false,lastPlayerState=STATES.IDLE;
  const task=(async()=>{
    try{
      const registry=await import('/app/world/generated-asset-registry.js?v=2026.09.17.babylon-fidelity-v2');
      const playerAsset=registry.getGeneratedPlayerV2?.()||null;
      const masterAsset=registry.getGeneratedNpcAsset?.('og-master-wisdo')||registry.GENERATED_WORLD_ASSETS?.npcs?.['og-master-wisdo']||null;
      if(playerAsset)playerGenerated=await importGenerated({B,scene,asset:playerAsset,parent:playerRoot,fallback:playerFallback,label:'WISDOGeneratedOperator'});
      if(masterAsset&&masterFallback?.parent)masterGenerated=await importGenerated({B,scene,asset:masterAsset,parent:masterFallback.parent,fallback:masterFallback,label:'WISDOGeneratedOgMaster'});
      publish({active:true,playerAsset:Boolean(playerGenerated),masterAsset:Boolean(masterGenerated),playerClips:playerGenerated?.controller?.available||[],masterClips:masterGenerated?.controller?.available||[],proceduralFallback:true});
    }catch(error){publish({active:true,playerAsset:false,masterAsset:false,proceduralFallback:true,assetError:String(error?.message||error)});}
  })();
  publish({active:true,playerAsset:false,masterAsset:false,proceduralFallback:true,states:Object.values(STATES),quality:low?'MOBILE':'DESKTOP'});
  return Object.freeze({
    ready:task,
    updatePlayer({speed=0,sprinting=false,dt=.016}={}){
      if(destroyed)return;
      lastPlayerState=animateRig(playerFallback,{speed,sprint:sprinting,dt});
      const key=lastPlayerState===STATES.SPRINT?'sprint':lastPlayerState===STATES.RUN?'run':lastPlayerState===STATES.WALK?'walk':'idle';
      playerGenerated?.controller?.play(key);
    },
    updateCrowd(node,{speed=.5,dt=.016,phaseGain=1}={}){if(!destroyed)animateRig(node,{speed,sprint:false,dt,phaseGain});},
    updateMaster({playerPosition,dt=.016,action='seated'}={}){
      if(destroyed)return;
      animateRig(masterFallback,{speed:0,sprint:false,dt,attention:playerPosition});
      masterGenerated?.controller?.play(action||'seated');
    },
    get playerState(){return lastPlayerState;},
    destroy(){
      if(destroyed)return;destroyed=true;
      try{playerGenerated?.controller?.stop?.();playerGenerated?.mount?.dispose?.();}catch{}
      try{masterGenerated?.controller?.stop?.();masterGenerated?.mount?.dispose?.();}catch{}
      if(playerFallback)playerFallback.setEnabled(true);if(masterFallback)masterFallback.setEnabled(true);
      publish({active:false,status:'DESTROYED'});
    }
  });
}
globalThis.WISDOBabylonCharacters=Object.freeze({BUILD,STATES,install});
})();