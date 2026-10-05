import crypto from 'node:crypto';

const clean=(value,max=220)=>String(value??'').replace(/\u0000/g,'').trim().slice(0,max);
const obj=(value,fallback={})=>value&&typeof value==='object'&&!Array.isArray(value)?value:fallback;
const arr=(value)=>Array.isArray(value)?value:[];
const HIGH_RISK_ACTIONS=new Set(['unlock','open','open_cover','disarm','open_garage']);
const SETTINGS_SECTIONS=new Set(['presence','workstation','mt4','smart_home','voice_notifications','authority']);

const DEFAULTS=Object.freeze({
  presence:{enabled:true,roomId:'trading-room',wakeWorkstation:true,prepareWorkspace:true,arrivalSceneId:'',departureSceneId:'',edgeDeviceId:'',desktopDeviceId:''},
  workstation:{desktopDeviceId:'',mt4Exe:'',liveManagerUrl:''},
  mt4:{accountId:'',botId:'',campaignControlSymbol:'',campaignControlMagic:''},
  smart_home:{edgeDeviceId:'',provider:'home_assistant'},
  voice_notifications:{voiceAlerts:true,pushAlerts:true,commandReceipts:true},
  authority:{allowPresenceHighRisk:false},
});

function mergeDefaults(row={}){
  return Object.fromEntries(Object.entries(DEFAULTS).map(([key,value])=>[key,{...value,...obj(row[key])}]));
}

export class WisdoSettingsHubService{
  constructor({pool,commandBusService,universalControlService,mt4SyncService,logger=console}={}){
    this.pool=pool;this.commandBusService=commandBusService;this.universalControlService=universalControlService;this.mt4SyncService=mt4SyncService;this.logger=logger;
  }

  async settings(ownerUserId){
    const result=await this.pool.query('SELECT * FROM wisdo_user_runtime_settings WHERE owner_user_id=$1',[String(ownerUserId)]);
    return mergeDefaults(result.rows[0]||{});
  }

  async patch(ownerUserId,section,input={}){
    if(!SETTINGS_SECTIONS.has(section)){const e=new Error('Unknown settings section.');e.statusCode=404;throw e;}
    const next={...(await this.settings(ownerUserId))[section],...obj(input)};
    await this.pool.query(`INSERT INTO wisdo_user_runtime_settings(owner_user_id,${section},updated_at)
      VALUES($1,$2::jsonb,NOW()) ON CONFLICT(owner_user_id) DO UPDATE SET ${section}=EXCLUDED.${section},updated_at=NOW()`,
      [String(ownerUserId),JSON.stringify(next)]);
    return next;
  }

  async snapshot(ownerUserId){
    const owner=String(ownerUserId);
    const [settings,devices,components,rooms,bots,scenes,executions,accounts]=await Promise.all([
      this.settings(owner),
      this.pool.query(`SELECT device_id,device_name,device_type,status,capabilities,last_seen_at,
        (last_seen_at>NOW()-INTERVAL '90 seconds') AS online FROM wisdo_devices WHERE owner_user_id=$1 ORDER BY device_type,device_name`,[owner]),
      this.pool.query(`SELECT component_id,device_id,component_type,name,aliases,capabilities,state,metadata,status,last_seen_at,
        (last_seen_at>NOW()-INTERVAL '150 seconds') AS fresh FROM wisdo_components WHERE owner_user_id=$1 ORDER BY component_type,name`,[owner]),
      this.pool.query('SELECT room_id,occupied,face_count,lighting,active_devices,last_seen_at FROM wisdo_room_states WHERE owner_user_id=$1 ORDER BY updated_at DESC',[owner]),
      this.pool.query('SELECT bot_id,desktop_device_id,bot_name,account_id,terminal_name,status,capabilities,last_seen_at FROM wisdo_bots WHERE owner_user_id=$1 ORDER BY bot_name',[owner]),
      this.pool.query('SELECT * FROM wisdo_smart_home_scenes WHERE owner_user_id=$1 ORDER BY name',[owner]),
      this.pool.query(`SELECT e.execution_id,e.component_id,e.action,e.status,e.result,e.error,e.created_at,e.completed_at,c.name component_name
        FROM wisdo_control_executions e JOIN wisdo_components c ON c.component_id=e.component_id
        WHERE e.owner_user_id=$1 ORDER BY e.created_at DESC LIMIT 40`,[owner]),
      this.mt4SyncService?.repository?.getAccessibleMt4Accounts?this.mt4SyncService.repository.getAccessibleMt4Accounts(owner):[],
    ]);
    return {settings,devices:devices.rows,components:components.rows,rooms:rooms.rows,bots:bots.rows,scenes:scenes.rows,recentExecutions:executions.rows,
      accounts:(accounts||[]).map(a=>({accountId:String(a.accountId||a.id||''),nickname:a.nickname||a.accountName||'Trading Account',mt4Login:a.mt4Login||a.accountNumber||null,brokerServer:a.brokerServer||a.server||null,isPrimary:Boolean(a.isPrimary),lastSyncAt:a.lastSyncAt||null})),
      voiceExecutionMode:String(process.env.WISDO_VOICE_EXECUTION_MODE||'DISABLED').toUpperCase()};
  }

  async saveScene(ownerUserId,input={}){
    const owner=String(ownerUserId),name=clean(input.name,100),roomId=clean(input.roomId,100),actions=arr(input.actions).slice(0,40);
    if(!name||!actions.length){const e=new Error('Scene name and at least one action are required.');e.statusCode=400;throw e;}
    const ids=[...new Set(actions.map(a=>clean(a.componentId,200)).filter(Boolean))];
    const found=(await this.pool.query('SELECT component_id,capabilities FROM wisdo_components WHERE owner_user_id=$1 AND component_id=ANY($2::text[])',[owner,ids])).rows;
    if(found.length!==ids.length){const e=new Error('Every scene target must be one of your discovered smart-home components.');e.statusCode=409;throw e;}
    const byId=new Map(found.map(row=>[row.component_id,row]));
    const normalized=actions.map(action=>{
      const componentId=clean(action.componentId,200),verb=clean(action.action,80);
      const caps=obj(byId.get(componentId)?.capabilities);const allowed=arr(caps.actions);
      if(!allowed.includes(verb)){const e=new Error(`${componentId} does not advertise ${verb}.`);e.statusCode=409;throw e;}
      return {componentId,action:verb,parameters:obj(action.parameters)};
    });
    const sceneId=clean(input.sceneId,80)||crypto.randomUUID();
    const row=(await this.pool.query(`INSERT INTO wisdo_smart_home_scenes(scene_id,owner_user_id,name,room_id,actions,enabled,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5::jsonb,$6,NOW(),NOW())
      ON CONFLICT(owner_user_id,name) DO UPDATE SET room_id=EXCLUDED.room_id,actions=EXCLUDED.actions,enabled=EXCLUDED.enabled,updated_at=NOW() RETURNING *`,
      [sceneId,owner,name,roomId||null,JSON.stringify(normalized),input.enabled!==false])).rows[0];
    return row;
  }

  async deleteScene(ownerUserId,sceneId){
    const result=await this.pool.query('DELETE FROM wisdo_smart_home_scenes WHERE owner_user_id=$1 AND scene_id=$2 RETURNING scene_id',[String(ownerUserId),clean(sceneId,80)]);
    if(!result.rows[0]){const e=new Error('Scene not found.');e.statusCode=404;throw e;}return true;
  }

  async runScene(ownerUserId,sceneId,{issuedByDeviceId=null,presence=false}={}){
    const owner=String(ownerUserId);
    const scene=(await this.pool.query('SELECT * FROM wisdo_smart_home_scenes WHERE owner_user_id=$1 AND scene_id=$2 AND enabled=true',[owner,clean(sceneId,80)])).rows[0];
    if(!scene){const e=new Error('Enabled scene not found.');e.statusCode=404;throw e;}
    const settings=await this.settings(owner);
    const executions=[];
    for(const item of arr(scene.actions)){
      if(presence&&HIGH_RISK_ACTIONS.has(String(item.action))&&!settings.authority.allowPresenceHighRisk){
        executions.push({component_id:item.componentId,action:item.action,status:'blocked',reason:'Presence authority does not allow high-risk smart-home actions.'});continue;
      }
      const rows=await this.universalControlService.execute({owner_user_id:owner,device_id:issuedByDeviceId||null},{action:item.action,target:{id:item.componentId},parameters:obj(item.parameters),risk_level:HIGH_RISK_ACTIONS.has(String(item.action))?3:1});
      executions.push(...rows);
    }
    return {scene,executions};
  }

  async executeComponent(ownerUserId,input={}){
    const owner=String(ownerUserId),action=clean(input.action,80);
    if(HIGH_RISK_ACTIONS.has(action)&&input.confirmed!==true){const e=new Error('This smart-home action requires explicit confirmation.');e.statusCode=409;e.code='confirmation_required';throw e;}
    return this.universalControlService.execute({owner_user_id:owner,device_id:null},{action,target:{id:clean(input.componentId,200)},parameters:obj(input.parameters),risk_level:HIGH_RISK_ACTIONS.has(action)?3:1});
  }

  async configureHomeAssistant(ownerUserId,input={}){
    const owner=String(ownerUserId),deviceId=clean(input.deviceId,200),url=clean(input.url,500),token=String(input.token||'').trim();
    if(!/^https?:\/\//i.test(url)||!token){const e=new Error('A Home Assistant URL and long-lived access token are required.');e.statusCode=400;throw e;}
    const device=(await this.pool.query(`SELECT * FROM wisdo_devices WHERE owner_user_id=$1 AND device_id=$2 AND device_type='pi-edge' AND status='active'`,[owner,deviceId])).rows[0];
    if(!device){const e=new Error('Select an enrolled Pi edge device.');e.statusCode=409;throw e;}
    if(obj(device.capabilities).home_assistant_config!==true){const e=new Error('This Pi edge release cannot securely configure Home Assistant. Update the edge agent first.');e.statusCode=409;throw e;}
    const secret=await this.commandBusService.createDeviceSecret(owner,deviceId,'home_assistant',{url,token},120);
    const command=await this.commandBusService.issueSystemCommand(owner,{intent:'configure_home_assistant',source:'website-settings',target:{type:'device',deviceType:'pi-edge',id:deviceId},requiredCapability:'home_assistant_config',parameters:{secretId:secret.secretId},expiresInSeconds:180,priority:96});
    await this.patch(owner,'smart_home',{edgeDeviceId:deviceId,provider:'home_assistant'});
    return {commandId:command.command_id,deviceId,secretExpiresAt:secret.expiresAt};
  }

  async configureWorkstation(ownerUserId,input={}){
    const owner=String(ownerUserId),deviceId=clean(input.deviceId,200);
    const command=await this.commandBusService.issueSystemCommand(owner,{intent:'configure_workstation',source:'website-settings',target:{type:'desktop',id:deviceId},requiredCapability:'configure_workstation',parameters:{mt4Exe:clean(input.mt4Exe,500),liveManagerUrl:clean(input.liveManagerUrl,500)},expiresInSeconds:180,priority:90});
    await this.patch(owner,'workstation',{desktopDeviceId:deviceId,mt4Exe:clean(input.mt4Exe,500),liveManagerUrl:clean(input.liveManagerUrl,500)});
    return command;
  }

  async prepareWorkstation(ownerUserId,deviceId){
    return this.commandBusService.issueSystemCommand(String(ownerUserId),{intent:'prepare_trading_workspace',source:'website-settings',target:{type:'desktop',id:clean(deviceId,200)},requiredCapability:'prepare_trading_workspace',parameters:{},expiresInSeconds:180,priority:90});
  }

  async selectMt4Account(ownerUserId,accountId){
    if(!this.mt4SyncService?.repository?.setPrimaryMt4Account){const e=new Error('MT4 primary account selection is unavailable.');e.statusCode=409;throw e;}
    await this.mt4SyncService.repository.setPrimaryMt4Account(String(ownerUserId),clean(accountId,200));
    await this.patch(ownerUserId,'mt4',{accountId:clean(accountId,200)});
    return true;
  }

  async handlePresenceArrival({ownerUserId,roomId,sourceDevice}={}){
    const owner=String(ownerUserId),room=clean(roomId,100).toLowerCase(),settings=await this.settings(owner),actions=[];
    if(settings.presence.enabled===false)return actions;
    const configuredRoom=clean(settings.presence.roomId,100).toLowerCase();
    if(configuredRoom&&configuredRoom!==room)return actions;
    const queue=async(label,input)=>{try{const c=await this.commandBusService.issueSystemCommand(owner,input);actions.push({label,status:'queued',commandId:c.command_id});}catch(error){actions.push({label,status:'blocked',code:error.code||null,reason:error.message});}};
    if(settings.presence.wakeWorkstation!==false&&sourceDevice?.device_id)await queue('wake_trading_workstation',{intent:'wake_trading_workstation',source:'presence',target:{type:'device',deviceType:'pi-edge',id:sourceDevice.device_id},requiredCapability:'wake_trading_workstation',parameters:{roomId:room},expiresInSeconds:45,priority:95});
    const desktopId=clean(settings.presence.desktopDeviceId||settings.workstation.desktopDeviceId,200);
    if(settings.presence.prepareWorkspace!==false&&desktopId)await queue('prepare_trading_workspace',{intent:'prepare_trading_workspace',source:'presence',target:{type:'desktop',id:desktopId,allowOffline:true},requiredCapability:'prepare_trading_workspace',parameters:{roomId:room},expiresInSeconds:300,priority:90});
    if(settings.presence.arrivalSceneId){try{const result=await this.runScene(owner,settings.presence.arrivalSceneId,{issuedByDeviceId:sourceDevice?.device_id||null,presence:true});actions.push({label:'smart_home_scene',status:'queued',sceneId:result.scene.scene_id,executions:result.executions});}catch(error){actions.push({label:'smart_home_scene',status:'blocked',reason:error.message});}}
    return actions;
  }

  async handlePresenceDeparture({ownerUserId,roomId,sourceDevice}={}){
    const owner=String(ownerUserId),room=clean(roomId,100).toLowerCase(),settings=await this.settings(owner),actions=[];
    if(settings.presence.enabled===false)return actions;
    const configuredRoom=clean(settings.presence.roomId,100).toLowerCase();
    if(configuredRoom&&configuredRoom!==room)return actions;
    if(settings.presence.departureSceneId){
      try{const result=await this.runScene(owner,settings.presence.departureSceneId,{issuedByDeviceId:sourceDevice?.device_id||null,presence:true});actions.push({label:'smart_home_departure_scene',status:'queued',sceneId:result.scene.scene_id,executions:result.executions});}
      catch(error){actions.push({label:'smart_home_departure_scene',status:'blocked',reason:error.message});}
    }
    return actions;
  }

  async executeAmbient(ownerUserId,ambient={},meta={}){
    const owner=String(ownerUserId);
    if(ambient.sceneName){
      const scene=(await this.pool.query('SELECT scene_id FROM wisdo_smart_home_scenes WHERE owner_user_id=$1 AND lower(name)=lower($2) AND enabled=true',[owner,clean(ambient.sceneName,100)])).rows[0];
      if(!scene){const e=new Error(`No enabled scene named ${clean(ambient.sceneName,100)} was found.`);e.code='ambient_target_missing';throw e;}
      return this.runScene(owner,scene.scene_id,{issuedByDeviceId:meta.deviceId||null});
    }
    if(ambient.intent==='prepare_trading_workspace'){
      const settings=await this.settings(owner),deviceId=clean(ambient.deviceId||settings.workstation.desktopDeviceId,200);
      if(!deviceId){const e=new Error('No trading workstation is selected in Settings.');e.code='ambient_target_missing';throw e;}
      const command=await this.prepareWorkstation(owner,deviceId);return {commands:[command],executions:[]};
    }
    const components=(await this.pool.query(`SELECT * FROM wisdo_components WHERE owner_user_id=$1 AND status='online' AND last_seen_at>NOW()-INTERVAL '150 seconds' ORDER BY last_seen_at DESC`,[owner])).rows;
    const type=clean(ambient.componentType,60),room=clean(ambient.room,100).toLowerCase(),alias=clean(ambient.alias,160).toLowerCase();
    let candidates=components.filter(c=>(!type||c.component_type===type)&&(!room||String(c.metadata?.room||c.metadata?.area||'').toLowerCase()===room)&&(!alias||c.component_id.toLowerCase()===alias||c.name.toLowerCase().includes(alias)||arr(c.aliases).some(x=>String(x).toLowerCase()===alias)));
    if(!candidates.length&&type)candidates=components.filter(c=>c.component_type===type);
    if(!candidates.length){const e=new Error('No fresh discovered smart-home component matched that request.');e.code='ambient_target_missing';throw e;}
    const action=clean(ambient.action,80);if(HIGH_RISK_ACTIONS.has(action)&&meta.confirmed!==true){const e=new Error('This ambient action requires confirmation.');e.code='ambient_confirmation_required';e.statusCode=409;throw e;}
    const executions=[];
    for(const component of candidates.slice(0,25)){
      const allowed=arr(component.capabilities?.actions);if(!allowed.includes(action))continue;
      executions.push(...await this.universalControlService.execute({owner_user_id:owner,device_id:meta.deviceId||null},{action,target:{id:component.component_id},parameters:obj(ambient.parameters),risk_level:HIGH_RISK_ACTIONS.has(action)?3:1}));
    }
    if(!executions.length){const e=new Error('Matched devices do not advertise that action.');e.code='ambient_action_unsupported';throw e;}
    return {executions,commands:[]};
  }
}

export { HIGH_RISK_ACTIONS };
