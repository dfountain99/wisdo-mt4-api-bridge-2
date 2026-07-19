import crypto from 'node:crypto';

const now=()=>new Date().toISOString();
const id=p=>`${p}_${crypto.randomUUID()}`;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));

export function ensureLivingOsState(state={}){
  state.livingOs ||= { users:{}, version:1 };
  state.livingOs.users ||= {};
  return state;
}

export function getLivingUser(state,user={}){
  ensureLivingOsState(state);
  const userId=String(user.id||'');
  if(!userId) throw new Error('User identity required.');
  const existing=state.livingOs.users[userId];
  if(existing) return existing;
  const created={
    userId, createdAt:now(), updatedAt:now(), credits:0,
    missions:[
      {id:id('mission'),title:'Complete your Wisdo identity',category:'identity',status:'active',progress:0,target:1,rewardXp:150,rewardCredits:5,href:'/app/presence'},
      {id:id('mission'),title:'Connect your first trading account',category:'connection',status:'active',progress:0,target:1,rewardXp:300,rewardCredits:10,href:'/app/connect-account'},
      {id:id('mission'),title:'Complete one Academy lesson',category:'education',status:'active',progress:0,target:1,rewardXp:250,rewardCredits:10,href:'/app/education'},
    ],
    workspaces:[
      {id:id('workspace'),name:'Trading Command',icon:'⚡',path:'/app/dashboard',accountId:'',mode:'focus',isDefault:true,createdAt:now(),updatedAt:now()},
      {id:id('workspace'),name:'Copier Operations',icon:'⛓',path:'/app/copier-engine',accountId:'',mode:'build',isDefault:false,createdAt:now(),updatedAt:now()},
      {id:id('workspace'),name:'Learning Studio',icon:'◈',path:'/app/education',accountId:'',mode:'teach',isDefault:false,createdAt:now(),updatedAt:now()},
    ],
    timeline:[{id:id('event'),type:'system',title:'Living OS activated',detail:'Wisdo v7.0 initialized your personal operating layer.',at:now()}],
    automations:[],
    aiMemory:{observations:[],preferences:{},lastSummary:'Wisdo is beginning to learn your operating patterns.',updatedAt:now()},
    devices:[],
    score:{overall:70,health:75,discipline:70,consistency:65,learning:70,community:60,growth:75,updatedAt:now()},
  };
  state.livingOs.users[userId]=created;
  return created;
}

export function addTimeline(state,user,event={}){
  const row=getLivingUser(state,user);
  const item={id:id('event'),type:String(event.type||'activity').slice(0,40),title:String(event.title||'Activity').slice(0,140),detail:String(event.detail||'').slice(0,500),href:String(event.href||''),at:event.at||now(),metadata:event.metadata||{}};
  row.timeline.push(item); row.timeline=row.timeline.slice(-500); row.updatedAt=now(); return item;
}

export function createMission(state,user,input={}){
  const row=getLivingUser(state,user);
  const mission={id:id('mission'),title:String(input.title||'New mission').slice(0,140),description:String(input.description||'').slice(0,500),category:String(input.category||'personal').slice(0,40),status:'active',progress:0,target:Math.max(1,Number(input.target)||1),rewardXp:Math.max(0,Number(input.rewardXp)||100),rewardCredits:Math.max(0,Number(input.rewardCredits)||0),href:String(input.href||'/app/nexus'),createdAt:now(),updatedAt:now()};
  row.missions.push(mission); addTimeline(state,user,{type:'mission',title:`Mission created: ${mission.title}`}); return mission;
}

export function updateMission(state,user,missionId,input={}){
  const row=getLivingUser(state,user); const mission=row.missions.find(x=>x.id===missionId); if(!mission) throw new Error('Mission not found.');
  if(input.progress!==undefined) mission.progress=clamp(input.progress,0,mission.target);
  if(input.status) mission.status=['active','completed','paused','dismissed'].includes(input.status)?input.status:mission.status;
  if(mission.progress>=mission.target) mission.status='completed'; mission.updatedAt=now();
  if(mission.status==='completed'&&!mission.rewardedAt){ mission.rewardedAt=now(); row.credits+=mission.rewardCredits; addTimeline(state,user,{type:'mission_complete',title:`Mission completed: ${mission.title}`,detail:`Earned ${mission.rewardXp} XP and ${mission.rewardCredits} Culture Credits.`}); }
  return mission;
}

export function saveWorkspace(state,user,input={}){
  const row=getLivingUser(state,user); let workspace=input.id?row.workspaces.find(x=>x.id===input.id):null;
  if(!workspace){workspace={id:id('workspace'),createdAt:now()};row.workspaces.push(workspace);}
  Object.assign(workspace,{name:String(input.name||workspace.name||'My Workspace').slice(0,80),icon:String(input.icon||workspace.icon||'◫').slice(0,4),path:String(input.path||workspace.path||'/app/dashboard'),accountId:String(input.accountId??workspace.accountId??''),mode:String(input.mode||workspace.mode||'focus'),layout:input.layout||workspace.layout||{},updatedAt:now()});
  if(input.isDefault){row.workspaces.forEach(x=>x.isDefault=false);workspace.isDefault=true;}
  addTimeline(state,user,{type:'workspace',title:`Workspace saved: ${workspace.name}`,href:workspace.path}); return workspace;
}

export function createAutomation(state,user,input={}){
  const row=getLivingUser(state,user);
  const allowedTriggers=['reporter_offline','drawdown_above','profit_above','mission_completed','account_connected','daily_time'];
  const allowedActions=['notify_dashboard','notify_discord','notify_email','pause_copier','activate_harvest','set_mode','create_mission'];
  const trigger=allowedTriggers.includes(input.trigger)?input.trigger:'reporter_offline'; const action=allowedActions.includes(input.action)?input.action:'notify_dashboard';
  const rule={id:id('automation'),name:String(input.name||`${trigger} → ${action}`).slice(0,100),trigger,operator:String(input.operator||'gte'),value:input.value??'',action,actionValue:input.actionValue??'',enabled:input.enabled!==false,lastRunAt:null,runCount:0,createdAt:now(),updatedAt:now()};
  row.automations.push(rule); addTimeline(state,user,{type:'automation',title:`Automation created: ${rule.name}`}); return rule;
}

export function updateAutomation(state,user,ruleId,input={}){
  const row=getLivingUser(state,user); const rule=row.automations.find(x=>x.id===ruleId); if(!rule) throw new Error('Automation not found.');
  if(input.enabled!==undefined) rule.enabled=Boolean(input.enabled); if(input.name) rule.name=String(input.name).slice(0,100); rule.updatedAt=now(); return rule;
}

export function rememberAiObservation(state,user,input={}){
  const row=getLivingUser(state,user); const text=String(input.text||'').trim(); if(!text) throw new Error('Observation text required.');
  const observation={id:id('memory'),text:text.slice(0,400),category:String(input.category||'pattern').slice(0,40),confidence:clamp(input.confidence||70),createdAt:now()};
  row.aiMemory.observations.push(observation); row.aiMemory.observations=row.aiMemory.observations.slice(-100); row.aiMemory.lastSummary=text; row.aiMemory.updatedAt=now(); addTimeline(state,user,{type:'ai_memory',title:'Wisdo learned a new pattern',detail:text}); return observation;
}

export function pairDevice(state,user,input={}){
  const row=getLivingUser(state,user); const device={id:id('device'),name:String(input.name||'Culture Device').slice(0,80),type:String(input.type||'band').slice(0,40),status:'paired',battery:input.battery==null?null:clamp(input.battery),firmware:String(input.firmware||'prototype'),permissions:Array.isArray(input.permissions)?input.permissions.slice(0,20):[],pairedAt:now(),lastSyncAt:now()};
  row.devices.push(device); addTimeline(state,user,{type:'device',title:`Device paired: ${device.name}`}); return device;
}

export function calculateCultureScore(state,user,context={}){
  const row=getLivingUser(state,user); const completed=row.missions.filter(x=>x.status==='completed').length; const missionTotal=Math.max(1,row.missions.length);
  const learning=clamp(55+(completed/missionTotal)*35); const consistency=clamp(60+Math.min(25,row.timeline.length/5)); const health=clamp(context.healthScore??row.score.health); const discipline=clamp(context.discipline??row.score.discipline); const community=clamp(context.community??row.score.community); const growth=clamp((learning+consistency+discipline)/3);
  const overall=Math.round((health+discipline+consistency+learning+community+growth)/6); row.score={overall,health:Math.round(health),discipline:Math.round(discipline),consistency:Math.round(consistency),learning:Math.round(learning),community:Math.round(community),growth:Math.round(growth),updatedAt:now()}; return row.score;
}

export function buildBriefing(state,user,context={}){
  const row=getLivingUser(state,user); const score=calculateCultureScore(state,user,context); const active=row.missions.filter(x=>x.status==='active').slice(0,3); const alerts=[];
  if(context.offlineReporters>0) alerts.push(`${context.offlineReporters} reporter${context.offlineReporters===1?' is':'s are'} offline.`);
  if(context.drawdown>5) alerts.push(`Portfolio drawdown is ${Number(context.drawdown).toFixed(1)}%.`);
  const hour=new Date().getHours(); const greeting=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
  return {greeting,summary:alerts[0]||'Your operating environment is ready.',score,activeMissions:active,alerts,credits:row.credits,workspace:row.workspaces.find(x=>x.isDefault)||row.workspaces[0],aiSummary:row.aiMemory.lastSummary,devices:row.devices.length,timelineCount:row.timeline.length};
}

export function livingSnapshot(state,user,context={}){
  const row=getLivingUser(state,user); return {userId:row.userId,briefing:buildBriefing(state,user,context),missions:row.missions,workspaces:row.workspaces,timeline:[...row.timeline].reverse(),automations:row.automations,aiMemory:row.aiMemory,devices:row.devices,score:row.score,credits:row.credits};
}
