const STATES=new Set(['PLANNED','PROVISIONING','ACTIVE','PARTIAL','REPAIRING','ARCHIVED','FAILED']);
function key(value){return String(value||'').trim();}

export function buildDeskPlan({guildId,ownerUserId,deskId,categoryName='WISDO Desks',channels=[],roles=[],archived=false}={}){
  if(!key(guildId)||!key(ownerUserId))throw Object.assign(new Error('guildId and ownerUserId are required.'),{code:'desk_identity_required'});
  return {deskId:key(deskId)||`desk:${guildId}:${ownerUserId}`,guildId:key(guildId),ownerUserId:key(ownerUserId),category:{name:key(categoryName),type:'category'},channels:channels.map((row)=>({name:key(row.name),type:row.type||'text',permissions:row.permissions||{}})).filter((row)=>row.name),roles:roles.map((row)=>({name:key(row.name),permissions:row.permissions||[]})).filter((row)=>row.name),state:archived?'ARCHIVED':'PLANNED'};
}

export function reconcileDesk(plan,actual={}){
  const operations=[];const existingChannels=new Map((actual.channels||[]).map((row)=>[`${row.type||'text'}:${key(row.name).toLowerCase()}`,row]));const existingRoles=new Map((actual.roles||[]).map((row)=>[key(row.name).toLowerCase(),row]));
  if(!actual.category)operations.push({type:'CREATE_CATEGORY',desired:plan.category});
  else if(key(actual.category.name)!==key(plan.category.name))operations.push({type:'UPDATE_CATEGORY',id:actual.category.id,desired:plan.category});
  for(const role of plan.roles){const found=existingRoles.get(role.name.toLowerCase());if(!found)operations.push({type:'CREATE_ROLE',desired:role});else if(JSON.stringify(found.permissions||[])!==JSON.stringify(role.permissions||[]))operations.push({type:'UPDATE_ROLE',id:found.id,desired:role});}
  for(const channel of plan.channels){const found=existingChannels.get(`${channel.type}:${channel.name.toLowerCase()}`);if(!found)operations.push({type:'CREATE_CHANNEL',desired:channel});else if(JSON.stringify(found.permissions||{})!==JSON.stringify(channel.permissions||{}))operations.push({type:'UPDATE_CHANNEL_PERMISSIONS',id:found.id,desired:channel});}
  return {...plan,state:operations.length?'PLANNED':'ACTIVE',operations,dryRun:true};
}

export class GuildProvisioningQueue{
  constructor(){this.tails=new Map();}
  run(guildId,task){const id=key(guildId);const previous=this.tails.get(id)||Promise.resolve();const current=previous.catch(()=>undefined).then(task).finally(()=>{if(this.tails.get(id)===current)this.tails.delete(id);});this.tails.set(id,current);return current;}
  size(){return this.tails.size;}
}

export function deskState(value){const state=key(value).toUpperCase();return STATES.has(state)?state:'FAILED';}
