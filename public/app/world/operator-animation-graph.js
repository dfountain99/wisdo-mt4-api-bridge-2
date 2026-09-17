const DEFAULT_FADE = Object.freeze({ IDLE: 0.22, WALK: 0.18, RUN: 0.16, SPRINT: 0.14, JUMP: 0.10, FALL: 0.10, LAND: 0.16 });
const LOCOMOTION = Object.freeze(['IDLE','WALK','RUN','SPRINT','JUMP','FALL','LAND']);
const SEMANTIC = Object.freeze(['GREET','WAVE','POINT','SPEAK','THINK','INTERACT']);
const ONE_SHOT = new Set([...SEMANTIC,'LAND']);

const clamp = (value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const names = (value)=>Array.isArray(value)?value:[value].filter(Boolean);

export function normalizeLocomotionState(value='IDLE') {
  const state=String(value||'IDLE').trim().toUpperCase();
  return LOCOMOTION.includes(state)?state:'IDLE';
}

export function animationTimeScale(state,speed=0) {
  const s=Math.max(0,Number(speed)||0);
  if(state==='WALK') return clamp(s/3.2,.72,1.38);
  if(state==='RUN') return clamp(s/5.2,.78,1.48);
  if(state==='SPRINT') return clamp(s/7.5,.82,1.55);
  return 1;
}

function clipByNames(clips, candidates=[]) {
  for(const wanted of candidates){
    const exact=clips.find((clip)=>clip.name===wanted); if(exact) return exact;
    const lower=String(wanted||'').toLowerCase();
    const insensitive=clips.find((clip)=>String(clip.name||'').toLowerCase()===lower); if(insensitive) return insensitive;
  }
  return null;
}

function resolveClip(clips,{primary=[],fallback=[]}={}) {
  const exact=clipByNames(clips,primary);
  if(exact) return {clip:exact,fallback:false};
  const substitute=clipByNames(clips,fallback);
  return substitute?{clip:substitute,fallback:true}:null;
}

function candidateMap(asset={}) {
  const clips=asset.clips||{};
  return Object.freeze({
    IDLE:{primary:[...names(clips.idle),'IDLE','Idle','idle'],fallback:[]},
    WALK:{primary:[...names(clips.walk),'WALK_FORWARD','WALK','Walk','walk'],fallback:[]},
    RUN:{primary:[...names(clips.run),'RUN','Run','run'],fallback:[...names(clips.walk),'WALK','Walk']},
    SPRINT:{primary:[...names(clips.sprint),'SPRINT','Sprint','sprint'],fallback:[...names(clips.run),'RUN','Run']},
    JUMP:{primary:[...names(clips.jump),'JUMP','Jump','jump'],fallback:[...names(clips.idle),'IDLE','Idle']},
    FALL:{primary:[...names(clips.fall),'FALL','Fall','fall'],fallback:[...names(clips.jump),'JUMP','Jump',...names(clips.idle),'IDLE','Idle']},
    LAND:{primary:[...names(clips.land),'LAND','Land','land'],fallback:[...names(clips.idle),'IDLE','Idle']},
    GREET:{primary:[...names(clips.greet),'GREET','Greet','greet'],fallback:[...names(clips.wave),'WAVE','Wave','wave']},
    WAVE:{primary:[...names(clips.wave),'WAVE','Wave','wave'],fallback:[...names(clips.idle),'IDLE','Idle']},
    POINT:{primary:[...names(clips.point),'POINT','Point','point'],fallback:[...names(clips.idle),'IDLE','Idle']},
    SPEAK:{primary:[...names(clips.speak),'SPEAK','Talk','talk'],fallback:[...names(clips.idle),'IDLE','Idle']},
    THINK:{primary:[...names(clips.think),'THINK','Think','think'],fallback:[...names(clips.idle),'IDLE','Idle']},
    INTERACT:{primary:[...names(clips.interact),'INTERACT','Interact','interact'],fallback:[...names(clips.wave),'WAVE','Wave',...names(clips.idle),'IDLE','Idle']},
  });
}

function uniqueActionClip(clip,state,claimed) {
  const key=clip?.uuid||clip?.name||state;
  if(!claimed.has(key)){claimed.add(key);return clip;}
  if(typeof clip?.clone!=='function')return clip;
  const copy=clip.clone();
  copy.name=`${clip.name||'clip'}__WISDO_${state}`;
  return copy;
}

export function createOperatorAnimationGraph({THREE,root,animations=[],asset={},debug=false}={}) {
  if(!THREE?.AnimationMixer||!root) throw new TypeError('Operator animation graph requires THREE and a rig root.');
  const clips=Array.isArray(animations)?animations:[];
  const mixer=new THREE.AnimationMixer(root);
  const candidates=candidateMap(asset);
  const actions={};
  const resolvedClips={};
  const fallbackStates={};
  const missingStates=[];
  const claimedClipKeys=new Set();

  for(const state of [...LOCOMOTION,...SEMANTIC]){
    const resolved=resolveClip(clips,candidates[state]);
    if(!resolved){missingStates.push(state);continue;}
    const sourceClip=resolved.clip;
    const actionClip=uniqueActionClip(sourceClip,state,claimedClipKeys);
    const action=mixer.clipAction(actionClip);
    const oneShot=ONE_SHOT.has(state);
    action.enabled=true;
    action.clampWhenFinished=oneShot;
    action.setLoop(oneShot?THREE.LoopOnce:THREE.LoopRepeat,oneShot?1:Infinity);
    actions[state]=action;
    resolvedClips[state]=sourceClip.name;
    if(resolved.fallback)fallbackStates[state]=sourceClip.name;
  }

  let locomotion='IDLE';
  let locomotionSpeed=0;
  let current=null;
  let override=null;
  let destroyed=false;

  function fallbackFor(state){
    if(actions[state]) return state;
    if(state==='SPRINT'&&actions.RUN) return 'RUN';
    if((state==='JUMP'||state==='FALL'||state==='LAND')&&actions.IDLE) return 'IDLE';
    return actions.IDLE?'IDLE':actions.WALK?'WALK':actions.RUN?'RUN':Object.keys(actions)[0]||null;
  }

  function transition(state,{fade=DEFAULT_FADE[state]??DEFAULT_FADE.IDLE,timeScale=1,reset=false}={}){
    if(destroyed) return null;
    const resolved=fallbackFor(state); if(!resolved) return null;
    const next=actions[resolved];
    if(next===current&&!reset){next.timeScale=timeScale; return resolved;}
    next.enabled=true; next.timeScale=timeScale;
    if(reset) next.reset();
    next.play();
    if(current&&current!==next){
      try{current.crossFadeTo(next,Math.max(.05,fade),true);}catch{current.fadeOut(Math.max(.05,fade));next.fadeIn(Math.max(.05,fade));}
    } else next.fadeIn(Math.max(.01,fade));
    current=next;
    if(debug) console.debug('[WISDO OPERATOR ANIMATION]',{state,resolved,fade,timeScale});
    return resolved;
  }

  function setLocomotion(state,{speed=0}={}){
    locomotion=normalizeLocomotionState(state);
    locomotionSpeed=Math.max(0,Number(speed)||0);
    if(override) return locomotion;
    transition(locomotion,{timeScale:animationTimeScale(locomotion,locomotionSpeed)});
    return locomotion;
  }

  function playSemantic(actionName,{fade=.14}={}){
    const semantic=String(actionName||'').trim().toUpperCase();
    if(!SEMANTIC.includes(semantic)||!actions[semantic]) return false;
    override=semantic;
    transition(semantic,{fade,reset:true,timeScale:1});
    return true;
  }

  const onFinished=(event)=>{
    if(!override||event?.action!==actions[override]) return;
    override=null;
    transition(locomotion,{fade:.16,timeScale:animationTimeScale(locomotion,locomotionSpeed),reset:false});
  };
  mixer.addEventListener?.('finished',onFinished);
  transition('IDLE',{fade:0,reset:true});

  const exactLocomotion=LOCOMOTION.filter((state)=>actions[state]&&!fallbackStates[state]).length;
  const coreAnimationCoverage=LOCOMOTION.length?exactLocomotion/LOCOMOTION.length:0;

  return Object.freeze({
    mixer,
    clips:Object.freeze(clips.map((clip)=>clip.name)),
    resolvedClips:Object.freeze({...resolvedClips}),
    fallbackStates:Object.freeze({...fallbackStates}),
    missingStates:Object.freeze([...missingStates]),
    coreAnimationCoverage,
    get state(){return locomotion;},
    get override(){return override;},
    setLocomotion,
    playSemantic,
    update(dt){if(!destroyed)mixer.update(Math.min(.05,Math.max(.001,Number(dt)||.016)));},
    destroy(){if(destroyed)return;destroyed=true;try{mixer.removeEventListener?.('finished',onFinished);}catch{}mixer.stopAllAction();},
  });
}

export const OPERATOR_ANIMATION_STATES=Object.freeze({locomotion:LOCOMOTION,semantic:SEMANTIC});
