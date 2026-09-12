const STORAGE_KEY = 'wisdo-world-game-v1';
const VERSION = 2;
const MISSIONS = Object.freeze([
  Object.freeze({
    id:'first-shift', title:'FIRST SHIFT', rewardXp:150, reward:'Operator Orientation',
    steps:Object.freeze([
      ['home','Enter your WISDO Smart Home'],
      ['trading','Inspect the Trading Room'],
      ['mesh','Check Reporter Mesh'],
      ['command','Open Campaign Command'],
      ['central','Step outside into WISDO Central'],
      ['tower','Enter Trading Tower'],
      ['return-home','Return to your Smart Home'],
    ]),
  }),
  Object.freeze({
    id:'market-scout', title:'MARKET SCOUT', rewardXp:200, reward:'World Discovery',
    steps:Object.freeze([
      ['central','Enter WISDO Central'],
      ['tower','Enter Trading Tower'],
      ['market','Inspect authoritative World markets'],
      ['marketplace','Visit the Marketplace interior'],
      ['return-home','Return Home'],
    ]),
  }),
  Object.freeze({
    id:'systems-check', title:'SYSTEMS CHECK', rewardXp:250, reward:'Operator Systems Badge',
    steps:Object.freeze([
      ['mesh','Open Reporter Mesh'],
      ['command','Open Campaign Command'],
      ['coach-center','Visit Coach Center'],
      ['academy','Visit WISDO Academy'],
      ['return-home','Return Home'],
    ]),
  }),
]);

const safeParse = (raw, fallback) => { try { const value=JSON.parse(raw); return value && typeof value==='object' ? value : fallback; } catch { return fallback; } };
function clone(value){ return typeof globalThis.structuredClone === 'function' ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value)); }
function loadState(){
  const stored=safeParse(localStorage.getItem(STORAGE_KEY),{});
  return {
    version:VERSION,
    activeMission:stored.activeMission||'first-shift',
    progress:stored.progress||{},
    completed:Array.isArray(stored.completed)?stored.completed:[],
    worldXp:Number(stored.worldXp||0),
    discoveries:Array.isArray(stored.discoveries)?stored.discoveries:[],
    startedAt:stored.startedAt||Date.now(),
  };
}
function saveState(state){
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify({version:VERSION,activeMission:state.activeMission,progress:state.progress,completed:state.completed,worldXp:state.worldXp,discoveries:state.discoveries,startedAt:state.startedAt})); } catch {}
}
function currentMission(state){ return MISSIONS.find((m)=>m.id===state.activeMission) || MISSIONS[0]; }
function ensureStyles(){
  if(document.querySelector('style[data-world-game]')) return;
  const style=document.createElement('style'); style.dataset.worldGame='1'; style.textContent=`
.wisdo-game-hud{position:fixed;left:max(14px,env(safe-area-inset-left));top:clamp(220px,30vh,330px);z-index:5400;width:min(286px,calc(100vw - 28px));pointer-events:none;font:600 11px/1.45 Inter,system-ui;color:#eaf8ff}.wisdo-game-card{background:linear-gradient(145deg,rgba(4,10,16,.86),rgba(7,18,26,.76));border:1px solid rgba(201,166,93,.32);border-radius:16px;padding:13px 14px;backdrop-filter:blur(10px);box-shadow:0 18px 50px rgba(0,0,0,.24)}.wisdo-game-card span{display:block;color:#c9a65d;letter-spacing:.15em;font-size:9px}.wisdo-game-card strong{display:block;margin:4px 0 8px;letter-spacing:.08em}.wisdo-game-step{display:grid;grid-template-columns:18px 1fr;gap:7px;color:#9eb5c4;margin:4px 0}.wisdo-game-step.done{color:#72e8ff}.wisdo-game-step.current{color:#fff}.wisdo-game-meta{display:flex;justify-content:space-between;gap:12px;margin-top:8px;color:#7f99aa;font-size:9px}.wisdo-link-orb{position:fixed;right:max(14px,env(safe-area-inset-right));bottom:190px;z-index:5400;min-width:142px;max-width:230px;padding:10px 13px;border-radius:18px;background:rgba(5,12,18,.84);border:1px solid rgba(111,229,255,.3);color:#eaf9ff;font:600 10px/1.35 Inter,system-ui;backdrop-filter:blur(10px);pointer-events:none;transition:transform .2s ease,opacity .2s ease}.wisdo-link-orb span{display:block;color:#6ee7ff;letter-spacing:.14em;font-size:8px}.wisdo-link-orb strong{display:block;margin-top:3px}.wisdo-link-orb.pulse{animation:wisdoLinkPulse 1.1s ease}@keyframes wisdoLinkPulse{50%{transform:scale(1.04);box-shadow:0 0 28px rgba(80,220,255,.28)}}@media(max-width:700px){.wisdo-game-hud{top:215px;width:220px}.wisdo-game-card{padding:10px}.wisdo-link-orb{bottom:178px;right:10px;max-width:180px}}
`; document.head.appendChild(style);
}

export function startWorldGameRuntime(){
  ensureStyles(); const state=loadState(); let stopped=false; let lastScene=null;
  const hud=document.createElement('aside'); hud.className='wisdo-game-hud'; hud.setAttribute('aria-label','WISDO mission'); document.body.appendChild(hud);
  const link=document.createElement('aside'); link.className='wisdo-link-orb'; link.innerHTML='<span>WISDO LINK</span><strong>WORLD ONLINE</strong><small>Core Experience active</small>'; document.body.appendChild(link);

  function emit(name,detail={}){ window.dispatchEvent(new CustomEvent(name,{detail})); }
  function analytics(name,properties={}){try{globalThis.posthog?.capture?.(name,properties);}catch{}emit('wisdo:analytics',{name,properties});}
  function pulse(title,sub=''){ link.querySelector('strong').textContent=title; link.querySelector('small').textContent=sub; link.classList.add('pulse'); setTimeout(()=>link.classList.remove('pulse'),1200); }
  function render(){
    const mission=currentMission(state); const doneSet=new Set(state.progress[mission.id]||[]); const next=mission.steps.find(([id])=>!doneSet.has(id));
    hud.innerHTML=`<div class="wisdo-game-card"><span>ACTIVE MISSION</span><strong>${mission.title}</strong>${mission.steps.map(([id,label])=>`<div class="wisdo-game-step ${doneSet.has(id)?'done':next?.[0]===id?'current':''}"><b>${doneSet.has(id)?'✓':next?.[0]===id?'◆':'·'}</b><em>${label}</em></div>`).join('')}<div class="wisdo-game-meta"><span>REWARD · ${mission.rewardXp} XP</span><span>WORLD XP · ${state.worldXp}</span></div></div>`;
  }
  function advanceMission(mission){
    if(!state.completed.includes(mission.id)){state.completed.push(mission.id);state.worldXp+=Number(mission.rewardXp||0);}
    const index=MISSIONS.findIndex((m)=>m.id===mission.id); const next=MISSIONS[index+1]; if(next)state.activeMission=next.id;
    saveState(state); analytics('wisdo_world_mission_completed',{mission_id:mission.id,reward_xp:mission.rewardXp}); emit('wisdo:mission-completed',{missionId:mission.id,reward:mission.reward,worldXp:state.worldXp}); pulse(`${mission.title} COMPLETE`,`+${mission.rewardXp} WORLD XP`); render();
  }
  function completeStep(step,source='world'){
    const mission=currentMission(state); const valid=mission.steps.some(([id])=>id===step); if(!valid)return;
    const list=state.progress[mission.id] ||= []; if(list.includes(step))return; list.push(step); saveState(state); render();
    analytics('wisdo_world_mission_step',{mission_id:mission.id,step,source}); emit('wisdo:mission-step',{missionId:mission.id,step,source});
    if(mission.steps.every(([id])=>list.includes(id)))advanceMission(mission);
  }
  function discover(id){if(!id||state.discoveries.includes(id))return;state.discoveries.push(id);saveState(state);analytics('wisdo_world_discovery',{destination:id});}
  function sceneFromUrl(){ return new URL(location.href).searchParams.get('scene') || 'home'; }
  function inspectScene(){ const scene=sceneFromUrl(); if(scene===lastScene)return; const previous=lastScene; lastScene=scene; if(scene==='home'){ completeStep('home','scene'); if(previous&&previous!=='home')completeStep('return-home','scene'); } if(scene==='central')completeStep('central','scene'); emit('wisdo:game-scene',{scene,previous}); analytics('wisdo_world_scene',{scene}); }
  const sceneTimer=setInterval(inspectScene,500); inspectScene();

  function destinationEvent(event){ const id=event.detail?.id; if(!id)return; discover(id); if(id==='command')completeStep('command','destination'); else completeStep(id,'destination'); if(id==='trading-tower')completeStep('tower','destination'); }
  function marketEvent(){completeStep('market','market');pulse('WORLD MARKET','AUTHORIZED MARKET STATE');}
  window.addEventListener('wisdo:world-destination-entered',destinationEvent);
  window.addEventListener('wisdo:world-market-inspected',marketEvent);

  const modalBody=document.getElementById('modalBody');
  const observer=modalBody ? new MutationObserver(()=>{ const text=(modalBody.textContent||'').toUpperCase(); if(text.includes('TRADING ROOM'))completeStep('trading','home-station'); if(text.includes('REPORTER'))completeStep('mesh','home-station'); if(text.includes('COACH'))completeStep('coach-center','home-station'); }) : null;
  observer?.observe(modalBody,{childList:true,subtree:true,characterData:true});

  function signal(event){ const d=event.detail||{}; const symbol=d.symbol||d.event?.symbol||'MARKET'; const direction=d.direction||d.event?.direction||''; pulse(`${symbol} ${direction}`.trim(),'REAL WISDO SIGNAL EVENT'); emit('wisdo:mission-bonus',{type:'real-signal-observed',eventId:d.eventId||d.id||null}); analytics('wisdo_world_signal_observed',{symbol,direction}); }
  window.addEventListener('wisdo:bot.signal.created',signal); window.addEventListener('wisdo:signal.created',signal);
  render();
  globalThis.WisdoWorldGame=Object.freeze({version:VERSION,missions:MISSIONS,get state(){return clone(state);},completeStep});
  return Object.freeze({completeStep,get state(){return globalThis.WisdoWorldGame.state;},stop(){if(stopped)return;stopped=true;clearInterval(sceneTimer);observer?.disconnect();window.removeEventListener('wisdo:world-destination-entered',destinationEvent);window.removeEventListener('wisdo:world-market-inspected',marketEvent);window.removeEventListener('wisdo:bot.signal.created',signal);window.removeEventListener('wisdo:signal.created',signal);hud.remove();link.remove();delete globalThis.WisdoWorldGame;}});
}
