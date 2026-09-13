import { WORLD_CONFIG, WORLD_LOCATIONS } from './world-config.js';

const STEP_TO_DESTINATION=Object.freeze({tower:'trading-tower',marketplace:'marketplace','coach-center':'coach-center','bot-arena':'bot-arena','growth-chamber':'growth-chamber',academy:'academy',vault:'vault','vps-forge':'vps-forge','strategy-lab':'strategy-lab','culture-arena':'culture-arena','private-rooms':'private-rooms','war-room':'war-room'});
let player={x:0,z:WORLD_CONFIG.player.spawn[2],yaw:0};
let waypointId='trading-tower';
let stopped=false;

function currentScene(){return new URLSearchParams(location.search).get('scene')||'central';}
function destinationName(id){return id==='trading-tower'?'Trading Tower':id==='marketplace'?'Market District':id?.split('-').map((p)=>p[0]?.toUpperCase()+p.slice(1)).join(' ')||'WISDO Central';}
function missionWaypoint(){
  try{
    const game=globalThis.WisdoWorldGame;if(!game?.missions||!game?.state)return null;const snapshot=game.state;const mission=game.missions.find((m)=>m.id===snapshot.activeMission)||game.missions[0];const done=new Set(snapshot.progress?.[mission.id]||[]);const next=mission.steps.find(([id])=>!done.has(id));if(!next)return null;return STEP_TO_DESTINATION[next[0]]||null;
  }catch{return null;}
}
function ensureUi(){
  const stage=document.getElementById('worldStage');if(!stage||document.getElementById('wisdoProductionMap'))return;
  const wrap=document.createElement('aside');wrap.id='wisdoProductionMap';wrap.className='wisdo-production-map';wrap.setAttribute('aria-label','WISDO World minimap');wrap.innerHTML='<div class="wisdo-production-map-card"><canvas id="wisdoProductionMapCanvas" width="296" height="296"></canvas></div><div class="wisdo-production-waypoint"><span>ACTIVE WAYPOINT</span><strong id="wisdoWaypointName">TRADING TOWER</strong><em id="wisdoWaypointDistance">—</em></div>';stage.appendChild(wrap);
}
function sceneFlag(){document.documentElement.dataset.worldScene=currentScene();}
function worldToMap(x,z,size){const half=WORLD_CONFIG.world.halfSize||110;return{x:(x+half)/(half*2)*size,y:(half-z)/(half*2)*size};}
function draw(){
  if(stopped)return;ensureUi();sceneFlag();const canvas=document.getElementById('wisdoProductionMapCanvas');if(!canvas)return;const ctx=canvas.getContext('2d'),size=canvas.width;ctx.clearRect(0,0,size,size);
  ctx.fillStyle='rgba(16,28,32,.94)';ctx.fillRect(0,0,size,size);
  const scale=size/220;ctx.fillStyle='rgba(52,57,59,.9)';ctx.fillRect(size/2-17*scale,0,34*scale,size);ctx.fillRect(0,size/2-15*scale,size,30*scale);ctx.fillRect((52)*scale,0,20*scale,size*.72);
  ctx.strokeStyle='rgba(235,231,211,.38)';ctx.lineWidth=2;ctx.setLineDash([7,9]);ctx.beginPath();ctx.moveTo(size/2,0);ctx.lineTo(size/2,size);ctx.moveTo(0,size/2);ctx.lineTo(size,size/2);ctx.stroke();ctx.setLineDash([]);
  const central=worldToMap(38,-1,size);ctx.fillStyle='#d2ad62';ctx.beginPath();ctx.arc(central.x,central.y,5,0,Math.PI*2);ctx.fill();
  const important=['trading-tower','marketplace','academy','coach-center','bot-arena','growth-chamber'];for(const id of important){const loc=WORLD_LOCATIONS[id];if(!loc)continue;const p=worldToMap(loc.position[0],loc.position[2],size);ctx.fillStyle=id===waypointId?'#f0cf7a':'rgba(127,217,229,.8)';ctx.beginPath();ctx.arc(p.x,p.y,id===waypointId?6:4,0,Math.PI*2);ctx.fill();}
  const wp=WORLD_LOCATIONS[waypointId];if(wp){const a=worldToMap(player.x,player.z,size),b=worldToMap(wp.interaction[0],wp.interaction[2],size);ctx.strokeStyle='rgba(240,207,122,.72)';ctx.lineWidth=2;ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);}
  const p=worldToMap(player.x,player.z,size);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-player.yaw);ctx.fillStyle='#fff';ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(6,7);ctx.lineTo(0,4);ctx.lineTo(-6,7);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  const name=document.getElementById('wisdoWaypointName'),distance=document.getElementById('wisdoWaypointDistance');if(wp){const meters=Math.hypot(player.x-wp.interaction[0],player.z-wp.interaction[2]);if(name)name.textContent=destinationName(waypointId).toUpperCase();if(distance)distance.textContent=`${Math.round(meters)}m · WALK TO DESTINATION`;}else{if(name)name.textContent='EXPLORE WISDO CENTRAL';if(distance)distance.textContent='WORLD EXPLORATION';}
}
function updateWaypoint(){const mission=missionWaypoint();if(mission)waypointId=mission;draw();}
function playerEvent(event){const d=event.detail||{};player={x:Number(d.x)||0,z:Number(d.z)||0,yaw:Number(d.yaw)||0};draw();}
window.addEventListener('wisdo:world-player-state',playerEvent);window.addEventListener('wisdo:game-scene',updateWaypoint);window.addEventListener('wisdo:mission-step',updateWaypoint);window.addEventListener('popstate',draw);const timer=setInterval(updateWaypoint,900);ensureUi();sceneFlag();updateWaypoint();
window.addEventListener('pagehide',()=>{stopped=true;clearInterval(timer);window.removeEventListener('wisdo:world-player-state',playerEvent);},{once:true});
