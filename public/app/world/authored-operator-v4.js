import { AUTHORED_WORLD_ASSETS, GLTF_LOADER_MODULE_URL } from './authored-asset-manifest.js';
import { createOperatorAnimationGraph, normalizeLocomotionState } from './operator-animation-graph.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const damp=(current,target,lambda,dt)=>current+(target-current)*(1-Math.exp(-lambda*dt));
const now=()=>performance.now();

function publish(instanceId,patch={}){
  if(instanceId&&globalThis.WisdoWorldRenderInstance!==instanceId)return globalThis.WisdoOperatorDiagnostics||{};
  const next=Object.freeze({...(globalThis.WisdoOperatorDiagnostics||{}),...patch,instanceId,visualRuntime:'operator-v4',updatedAt:new Date().toISOString()});
  globalThis.WisdoOperatorDiagnostics=next;
  try{window.dispatchEvent(new CustomEvent('wisdo:operator-diagnostics',{detail:next}));}catch{}
  return next;
}

function prepareMaterials(root,renderer){
  const maxAnisotropy=renderer?.capabilities?.getMaxAnisotropy?.()||4;
  root.traverse((object)=>{
    if(!object.isMesh&&!object.isSkinnedMesh)return;
    object.castShadow=true;object.receiveShadow=true;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    for(const material of materials){
      if(!material)continue;
      const label=`${object.name||''} ${material.name||''}`.toLowerCase();
      const skin=/(skin|face|head|body)/.test(label);
      const eye=/(eye|cornea)/.test(label);
      const hair=/(hair|beard|brow)/.test(label);
      const metal=/(metal|gold|chain|watch|badge|zipper)/.test(label);
      if('roughness'in material){
        const base=Number(material.roughness??.5);
        material.roughness=clamp(base,metal?.16:eye?.08:skin?.38:hair?.5:.28,metal?.48:eye?.22:skin?.7:hair?.86:.82);
      }
      if('metalness'in material)material.metalness=clamp(Number(material.metalness??0),0,metal?1:.35);
      if('envMapIntensity'in material)material.envMapIntensity=metal?1.5:skin?.72:1.05;
      if(material.map)material.map.anisotropy=Math.max(4,Math.min(maxAnisotropy,8));
      if(material.normalMap)material.normalScale?.setScalar?.(skin?.55:1);
      material.needsUpdate=true;
    }
  });
}

function normalizeHumanScale(THREE,model,targetHeightMeters=1.82){
  model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),size=new THREE.Vector3();box.getSize(size);
  if(!Number.isFinite(size.y)||size.y<.25)throw new Error('Operator V4 asset has invalid human bounds.');
  const scale=targetHeightMeters/size.y;model.scale.multiplyScalar(scale);model.updateMatrixWorld(true);
  const finalBox=new THREE.Box3().setFromObject(model),center=new THREE.Vector3();finalBox.getCenter(center);
  model.position.x-=center.x;model.position.z-=center.z;model.position.y-=finalBox.min.y;model.updateMatrixWorld(true);return scale;
}

function collectBones(root){
  const result={head:null,neck:null,spine:null,hips:null};
  root.traverse((object)=>{if(!object.isBone)return;const n=String(object.name||'').toLowerCase();
    if(!result.head&&/(^|[_ .-])head($|[_ .-])/.test(` ${n} `))result.head=object;
    if(!result.neck&&n.includes('neck'))result.neck=object;
    if(!result.spine&&/(spine2|spine_02|chest|upperchest)/.test(n))result.spine=object;
    if(!result.hips&&/(hips|pelvis)/.test(n))result.hips=object;
  });
  return result;
}

async function loadAsset(GLTFLoader,url){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),45000);const started=now();
  try{
    const response=await fetch(url,{mode:'cors',credentials:'omit',cache:'force-cache',signal:controller.signal});
    if(!response.ok)throw new Error(`Operator V4 GLB HTTP ${response.status}`);
    const buffer=await response.arrayBuffer();const loader=new GLTFLoader();
    const absoluteUrl=new URL(url,globalThis.location?.href||'http://localhost/');const basePath=new URL('.',absoluteUrl).href;
    const gltf=loader.parseAsync?await loader.parseAsync(buffer,basePath):await new Promise((resolve,reject)=>loader.parse(buffer,basePath,resolve,reject));
    return{gltf,bytes:buffer.byteLength,loadMs:Math.round(now()-started)};
  }finally{clearTimeout(timer);}
}

export async function installAuthoredOperatorV4({THREE,scene,renderer,camera,debug=false,instanceId=null}={}){
  if(!THREE||!scene)throw new TypeError('Operator V4 requires the active Three.js scene.');
  const physicsRoot=scene.getObjectByName('WisdoOperator');if(!physicsRoot)throw new Error('WisdoOperator physics root is unavailable.');
  const asset=AUTHORED_WORLD_ASSETS.defaultOperator;publish(instanceId,{status:'V4_LOADING',active:false,assetId:asset.id,assetUrl:asset.url});
  const imported=await import(GLTF_LOADER_MODULE_URL);if(!imported.GLTFLoader)throw new Error('GLTFLoader export missing.');
  const {gltf,bytes,loadMs}=await loadAsset(imported.GLTFLoader,asset.url);if(!gltf?.scene)throw new Error('Operator V4 GLB has no scene.');
  if(instanceId&&globalThis.WisdoWorldRenderInstance!==instanceId)throw new Error('World instance changed during Operator V4 load.');

  const mount=new THREE.Group();mount.name='WISDOAuthoredOperatorV4Mount';const model=gltf.scene;model.name='WISDOAuthoredOperatorV4Model';
  model.rotation.y=asset.rotationY||0;prepareMaterials(model,renderer);const scale=normalizeHumanScale(THREE,model,asset.targetHeightMeters||1.82);mount.add(model);physicsRoot.add(mount);
  const previousVisibility=new Map();for(const child of physicsRoot.children){if(child===mount)continue;previousVisibility.set(child,child.visible);child.visible=false;}

  const animation=createOperatorAnimationGraph({THREE,root:model,animations:gltf.animations,asset,debug});const bones=collectBones(model);
  let state='IDLE',speed=0,grounded=true,targetLean=0,currentLean=0,lastYaw=physicsRoot.rotation.y,last=now(),destroyed=false,frameId=0;
  const baseRotations={head:bones.head?.rotation.clone(),neck:bones.neck?.rotation.clone(),spine:bones.spine?.rotation.clone()};

  const onPlayer=(event)=>{
    const detail=event?.detail||{};state=normalizeLocomotionState(detail.state);speed=Math.max(0,Number(detail.speed)||0);grounded=detail.grounded!==false;
    animation.setLocomotion(state,{speed});
  };
  const onAction=(event)=>{
    const detail=event?.detail||{};if(detail.operator!==true&&detail.target!=='operator')return;
    animation.playSemantic(detail.action||detail.name||'INTERACT');
  };
  window.addEventListener('wisdo:world-player-state',onPlayer);window.addEventListener('wisdo:operator-action',onAction);

  const lookTarget=new THREE.Vector3();const headWorld=new THREE.Vector3();
  function frame(t){
    if(destroyed)return;frameId=requestAnimationFrame(frame);const dt=Math.min(.05,Math.max(.001,(t-last)/1000));last=t;
    animation.update(dt);
    const yaw=physicsRoot.rotation.y;const yawDelta=Math.atan2(Math.sin(yaw-lastYaw),Math.cos(yaw-lastYaw));lastYaw=yaw;
    targetLean=clamp(-yawDelta/Math.max(dt,.001)*.018,-.12,.12);if(!grounded)targetLean*=.35;currentLean=damp(currentLean,targetLean,8,dt);
    mount.rotation.z=damp(mount.rotation.z,currentLean,9,dt);mount.rotation.x=damp(mount.rotation.x,state==='SPRINT'?.055:state==='RUN'?.028:0,8,dt);
    if(camera&&speed<.35&&grounded){
      const head=bones.head||bones.neck;if(head){head.getWorldPosition(headWorld);camera.getWorldPosition(lookTarget);const dx=lookTarget.x-headWorld.x,dz=lookTarget.z-headWorld.z;const desired=clamp(Math.atan2(dx,dz)-yaw,-.48,.48);head.rotation.y=damp(head.rotation.y,desired,4.5,dt);}
      if(bones.spine)bones.spine.rotation.y=damp(bones.spine.rotation.y,0,5,dt);
    }else{
      if(bones.head&&baseRotations.head)bones.head.rotation.y=damp(bones.head.rotation.y,baseRotations.head.y,5,dt);
      if(bones.neck&&baseRotations.neck)bones.neck.rotation.y=damp(bones.neck.rotation.y,baseRotations.neck.y,5,dt);
    }
  }
  frameId=requestAnimationFrame(frame);

  const productionAsset=String(asset.id||'')!=='wisdo-default-operator-v1';
  const diagnostics=publish(instanceId,{status:'V4_ACTIVE',active:true,renderer:'AUTHORED_GLTF_V4',assetId:asset.id,bytesLoaded:bytes,loadMs,scale,clips:animation.clips,resolvedClips:animation.resolvedClips,fallbackStates:animation.fallbackStates,missingStates:animation.missingStates,coreAnimationCoverage:animation.coreAnimationCoverage,productionAsset,bones:Object.freeze(Object.fromEntries(Object.entries(bones).map(([k,v])=>[k,v?.name||null]))),secondaryMotion:true,lookAt:true,animationGraph:true});
  if(debug)console.debug('[WISDO OPERATOR V4]',diagnostics);

  return Object.freeze({active:true,assetId:asset.id,diagnostics,animation,destroy(){if(destroyed)return;destroyed=true;cancelAnimationFrame(frameId);window.removeEventListener('wisdo:world-player-state',onPlayer);window.removeEventListener('wisdo:operator-action',onAction);animation.destroy();physicsRoot.remove(mount);mount.traverse((object)=>{object.geometry?.dispose?.();const mats=Array.isArray(object.material)?object.material:[object.material];for(const material of mats){if(!material)continue;for(const value of Object.values(material))if(value?.isTexture)value.dispose?.();material.dispose?.();}});for(const[child,visible]of previousVisibility)child.visible=visible;publish(instanceId,{status:'V4_DESTROYED',active:false});}});
}
