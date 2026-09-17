const DEFAULT_FADE = Object.freeze({ IDLE: 0.22, WALK: 0.18, RUN: 0.16, SPRINT: 0.14, JUMP: 0.10, FALL: 0.10, LAND: 0.16 });
const LOCOMOTION = Object.freeze(['IDLE','WALK','RUN','SPRINT','JUMP','FALL','LAND']);
const SEMANTIC = Object.freeze(['GREET','WAVE','POINT','SPEAK','THINK','INTERACT']);

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

function candidateMap(asset={}) {
  const clips=asset.clips||{};
  return Object.freeze({
    IDLE:[...names(clips.idle),'IDLE','Idle','idle'],
    WALK:[...names(clips.walk),'WALK_FORWARD','WALK','Walk','walk'],
    RUN:[...names(clips.run),'RUN','Run','run'],
    SPRINT:[...names(clips.sprint),'SPRINT','Sprint','sprint','RUN','Run'],
    JUMP:[...names(clips.jump),'JUMP','Jump','jump'],
    FALL:[...names(clips.fall),'FALL','Fall','fall','JUMP','Jump'],
    LAND:[...names(clips.land),'LAND','Land','land','IDLE','Idle'],
    GREET:[...names(clips.greet),'GREET','Wave','wave'],
    WAVE:[...names(clips.wave),'WAVE','Wave','wave'],
    POINT:[...names(clips.point),'POINT','Point','point'],
    SPEAK:[...names(clips.speak),'SPEAK','Talk','talk','Idle'],
    THINK:[...names(clips.think),'THINK','Think','think','Idle'],
    INTERACT:[...names(clips.interact),'INTERACT','Interact','interact','Wave'],
  });
}

export function createOperatorAnimationGraph({THREE,root,animations=[],asset={},debug=false}={}) {
  if(!THREE?.AnimationMixer||!root) throw new TypeError('Operator animation graph requires THREE and a rig root.');
  const clips=Array.isArray(animations)?animations:[];
  const mixer=new THREE.AnimationMixer(root);
  const candidates=candidateMap(asset);
  const actions={};
  const resolvedClips={};
  for(const state of [...LOCOMOTION,...SEMANTIC]){
    const clip=clipByNames(clips,candidates[state]);
    if(!clip) continue;
    const action=mixer.clipAction(clip);
    action.enabled=true;
    action.clampWhenFinished=SEMANTIC.includes(state)||state==='LAND';
    action.setLoop(action.clampWhenFinished?THREE.LoopOnce:THREE.LoopRepeat,action.clampWhenFinished?1:Infinity);
    actions[state]=action;
    resolvedClips[state]=clip.name;
  }

  let locomotion='IDLE';
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
    if(override) return locomotion;
    transition(locomotion,{timeScale:animationTimeScale(locomotion,speed)});
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
    transition(locomotion,{fade:.16,timeScale:1,reset:false});
  };
  mixer.addEventListener?.('finished',onFinished);
  transition('IDLE',{fade:0,reset:true});

  return Object.freeze({
    mixer,
    clips:Object.freeze(clips.map((clip)=>clip.name)),
    resolvedClips:Object.freeze({...resolvedClips}),
    get state(){return locomotion;},
    get override(){return override;},
    setLocomotion,
    playSemantic,
    update(dt){if(!destroyed)mixer.update(Math.min(.05,Math.max(.001,Number(dt)||.016)));},
    destroy(){if(destroyed)return;destroyed=true;try{mixer.removeEventListener?.('finished',onFinished);}catch{}mixer.stopAllAction();},
  });
}

export const OPERATOR_ANIMATION_STATES=Object.freeze({locomotion:LOCOMOTION,semantic:SEMANTIC});
