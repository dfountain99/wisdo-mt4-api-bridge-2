const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

function findClip(clips,names=[]){for(const wanted of names){const exact=clips.find((clip)=>clip.name===wanted);if(exact)return exact;const insensitive=clips.find((clip)=>String(clip.name||'').toLowerCase()===String(wanted).toLowerCase());if(insensitive)return insensitive;}return null;}
function list(value){return Array.isArray(value)?value.filter(Boolean):value?[value]:[];}

export function createOperatorAnimationStateMachine(THREE,gltf,asset={}){
  const clips=Array.isArray(gltf?.animations)?gltf.animations:[];
  const mixer=new THREE.AnimationMixer(gltf.scene);
  const aliases={
    idle:[...list(asset.clips?.idle),'IDLE','Idle','idle'],
    walk:[...list(asset.clips?.walk),'WALK_FORWARD','Walk','walk'],
    walkBackward:[...list(asset.clips?.walkBackward),'WALK_BACKWARD','WalkBackward'],
    strafeLeft:[...list(asset.clips?.strafeLeft),'STRAFE_LEFT','StrafeLeft'],
    strafeRight:[...list(asset.clips?.strafeRight),'STRAFE_RIGHT','StrafeRight'],
    run:[...list(asset.clips?.run),'JOG','RUN','Run','run'],
    sprint:[...list(asset.clips?.sprint),'SPRINT','Sprint'],
    turnLeft:[...list(asset.clips?.turnLeft),'TURN_LEFT','TurnLeft'],
    turnRight:[...list(asset.clips?.turnRight),'TURN_RIGHT','TurnRight'],
    interact:[...list(asset.clips?.interact),'INTERACT','Interact'],
    terminalUse:[...list(asset.clips?.terminalUse),'TERMINAL_USE','TerminalUse','INTERACT'],
    wave:[...list(asset.clips?.wave),'WAVE','Wave','INTERACT'],
  };
  const actions={};
  for(const[name,names]of Object.entries(aliases)){
    const clip=findClip(clips,names);if(!clip)continue;
    const action=mixer.clipAction(clip);action.enabled=true;action.setEffectiveWeight(1);actions[name]=action;
  }
  let locomotion='idle',current=null,oneShot=null,returnState='idle';
  function fallback(name){if(actions[name])return name;if(name==='sprint'&&actions.run)return'run';if(['walkBackward','strafeLeft','strafeRight','turnLeft','turnRight'].includes(name)&&actions.walk)return'walk';return actions.idle?'idle':actions.walk?'walk':actions.run?'run':Object.keys(actions)[0]||null;}
  function crossFade(name,{fade=.2,timeScale=1,reset=false}={}){
    const resolved=fallback(name);if(!resolved)return null;const next=actions[resolved];
    if(next===current&&!reset){next.timeScale=timeScale;return resolved;}
    next.enabled=true;next.timeScale=timeScale;if(reset)next.reset();next.setLoop(THREE.LoopRepeat,Infinity);next.fadeIn(fade).play();
    if(current&&current!==next)current.fadeOut(fade);current=next;locomotion=resolved;return resolved;
  }
  function setLocomotion(name,{speed=0}={}){
    if(oneShot)return;
    const scales={idle:1,walk:clamp(speed/3.2,.78,1.3),walkBackward:clamp(speed/2.6,.75,1.2),strafeLeft:clamp(speed/2.8,.75,1.25),strafeRight:clamp(speed/2.8,.75,1.25),run:clamp(speed/5.2,.82,1.4),sprint:clamp(speed/7.5,.86,1.35),turnLeft:1,turnRight:1};
    crossFade(name,{fade:name==='idle'?.24:.16,timeScale:scales[name]||1});
  }
  function playOneShot(name,{fade=.14,returnTo=locomotion}={}){
    const resolved=fallback(name);const action=actions[resolved];if(!action)return false;
    returnState=returnTo||locomotion||'idle';oneShot=action;action.reset();action.enabled=true;action.clampWhenFinished=true;action.setLoop(THREE.LoopOnce,1);action.fadeIn(fade).play();if(current&&current!==action)current.fadeOut(fade);current=action;return true;
  }
  const onFinished=(event)=>{if(!oneShot||event.action!==oneShot)return;oneShot=null;current=null;crossFade(returnState,{fade:.18,reset:true});};
  mixer.addEventListener('finished',onFinished);
  crossFade('idle',{fade:0,reset:true});
  return Object.freeze({
    clips:Object.freeze(clips.map((clip)=>clip.name)),
    actions:Object.freeze({...actions}),
    setLocomotion,
    playOneShot,
    update(dt){mixer.update(dt);},
    destroy(){mixer.removeEventListener('finished',onFinished);mixer.stopAllAction();},
    get state(){return oneShot?'ACTION':locomotion;},
  });
}

export function locomotionFromMotion({state='IDLE',speed=0,localForward=1,localRight=0,turnDelta=0}={}){
  const upper=String(state||'IDLE').toUpperCase();
  if(upper==='SPRINT')return'sprint';
  if(upper==='RUN')return'run';
  if(Number(speed||0)>.15){if(localForward<-.35)return'walkBackward';if(localRight>.48)return'strafeRight';if(localRight<-.48)return'strafeLeft';return'walk';}
  if(turnDelta>.18)return'turnLeft';if(turnDelta<-.18)return'turnRight';return'idle';
}
