/**
 * Cosmetic wildlife behavior for the Genesis client.
 * Interactions remain server-authoritative at the creature's fixed
 * world-space anchor. Render-only wander is capped at 1.65 meters.
 */
export function genesisWildlifePose(echo,nowMs,playerPosition=null,weather='Clear'){
 const id=String(echo?.id||'creature');
 let seed=0;
 for(let i=0;i<id.length;i++)seed=(Math.imul(seed,33)+id.charCodeAt(i))|0;
 const phase=(seed>>>0)%628/100;
 const cycle=nowMs/6500+phase;
 const storm=String(weather).includes('Storm');
 const isFlying=echo?.silhouette==='winged';
 const isSerpent=echo?.silhouette==='serpent';
 const trust=Math.min(3,Math.max(0,Number(echo?.trust)||0));
 const x=(Math.sin(cycle)*.85+Math.sin(cycle*.41+phase)*.48);
 const z=(Math.cos(cycle*.74+phase)*.88);
 const nearby=playerPosition?
   Math.hypot(playerPosition.x-(echo?.x||0),playerPosition.z-(echo?.z||0)):Infinity;
 const alert=nearby<9&&trust===0;
 const directionX=alert&&nearby>.001?
   ((echo.x-playerPosition.x)/nearby)*.26:0;
 const directionZ=alert&&nearby>.001?
   ((echo.z-playerPosition.z)/nearby)*.26:0;
 const dx=Math.max(-1.65,Math.min(1.65,x+directionX));
 const dz=Math.max(-1.65,Math.min(1.65,z+directionZ));
 const wake=Math.sin(nowMs/470+phase);
 const flap=isFlying?Math.sin(nowMs/(storm?200:370)+phase):0;
 const mood=trust>=2?'friendly':alert?'wary':storm?'sheltering':
   Math.sin(cycle*.53)>0?'foraging':'roaming';
 return {
   x:(echo?.x||0)+dx,z:(echo?.z||0)+dz,
   y:isFlying?(0.65+Math.sin(nowMs/700+phase)*.2):
     isSerpent?(0.11+Math.sin(nowMs/820+phase)*.10):Math.sin(nowMs/800+phase)*.055,
   facing:Math.atan2(Math.cos(cycle)*.85,Math.sin(cycle*.74+phase)*-.65),
   wingFlap:flap,tailSway:Math.sin(nowMs/380+phase),
   breath:.5+.5*wake,pulse:.5+.5*Math.sin(nowMs/440+phase),
   mood,
 };
}
