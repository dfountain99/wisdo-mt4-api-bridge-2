const clean=(value)=>String(value??'').trim().toLowerCase();

export const WISDO_DEVICE_CLASSES=Object.freeze({
  LIGHT:['turn_on','turn_off','set_brightness','set_color','set_color_temperature'],
  SWITCH:['turn_on','turn_off'],
  OUTLET:['turn_on','turn_off'],
  THERMOSTAT:['turn_on','turn_off','set_temperature','set_hvac_mode','set_fan_mode'],
  FAN:['turn_on','turn_off','set_percentage'],
  COVER:['open','close','stop','set_position'],
  GARAGE:['open','close','stop','set_position'],
  LOCK:['lock','unlock'],
  MEDIA:['turn_on','turn_off','play','pause','stop','set_volume','next','previous'],
  VACUUM:['start','pause','stop','dock'],
  HUMIDIFIER:['turn_on','turn_off','set_humidity'],
  WATER_HEATER:['set_temperature','set_operation_mode'],
  ALARM:['arm_away','arm_home','disarm'],
  SIREN:['turn_on','turn_off'],
  CAMERA:['turn_on','turn_off'],
  BUTTON:['press'],
  SCENE:['activate'],
  AUTOMATION:['activate'],
  SENSOR:[],
  SMOKE_CO:[],
  MOTION:[],
  CONTACT:[],
  LEAK:[],
  PERSON:[],
  TRACKER:[],
  WEATHER:[],
  IR_APPLIANCE:['turn_on','turn_off','set_temperature','set_fan_mode','press'],
  RF_APPLIANCE:['turn_on','turn_off','press'],
  RELAY:['turn_on','turn_off'],
  GENERIC:['turn_on','turn_off'],
});

export const WISDO_PROTOCOLS=Object.freeze([
  'matter','thread','z-wave','zigbee','wifi','ethernet','bluetooth','ble','mqtt',
  'home-assistant','smartthings','hubitat','lutron','hue','cloud-api','local-api',
  'modbus','bacnet','knx','ir','rf','relay','serial','gpio','unknown'
]);

export const WISDO_ADAPTERS=Object.freeze([
  {id:'home-assistant',name:'Home Assistant',kind:'hub',execution:'live',protocols:['matter','thread','z-wave','zigbee','wifi','ethernet','bluetooth','ble','mqtt','modbus','knx','cloud-api','local-api','ir','rf','relay'],covers:'Broad local/vendor integration surface'},
  {id:'matter-controller',name:'Matter controller',kind:'native',execution:'via_hub',protocols:['matter','thread','wifi','ethernet'],covers:'Matter devices through an approved controller/fabric'},
  {id:'z-wave-controller',name:'Z-Wave controller',kind:'radio',execution:'via_hub',protocols:['z-wave'],covers:'Legacy and current Z-Wave devices through an approved controller'},
  {id:'zigbee-controller',name:'Zigbee controller',kind:'radio',execution:'via_hub',protocols:['zigbee'],covers:'Zigbee devices through an approved coordinator'},
  {id:'smartthings-hub',name:'SmartThings',kind:'hub',execution:'via_home_assistant',protocols:['smartthings'],covers:'SmartThings-connected devices through an approved integration'},
  {id:'hubitat-hub',name:'Hubitat',kind:'hub',execution:'via_home_assistant',protocols:['hubitat','z-wave','zigbee'],covers:'Hubitat-connected Z-Wave/Zigbee/LAN devices through an approved integration'},
  {id:'hue-bridge',name:'Philips Hue',kind:'hub',execution:'via_home_assistant',protocols:['hue','zigbee'],covers:'Hue lights, switches and sensors through an approved bridge'},
  {id:'lutron-bridge',name:'Lutron',kind:'hub',execution:'via_home_assistant',protocols:['lutron'],covers:'Lutron lighting, shades and controls through an approved bridge'},
  {id:'mqtt-bridge',name:'MQTT bridge',kind:'local-bus',execution:'via_hub',protocols:['mqtt'],covers:'Local MQTT appliances, relays, sensors and custom hardware'},
  {id:'lan-api',name:'LAN/REST bridge',kind:'local-api',execution:'via_hub',protocols:['wifi','ethernet','local-api'],covers:'Devices with supported local APIs'},
  {id:'vendor-cloud',name:'Vendor cloud connector',kind:'cloud',execution:'via_hub',protocols:['cloud-api'],covers:'Devices only exposed through an approved vendor account'},
  {id:'ir-rf-bridge',name:'IR/RF legacy bridge',kind:'legacy',execution:'via_hub',protocols:['ir','rf'],covers:'Older TVs, fans, AC units, fireplaces and remotes through approved bridge hardware'},
  {id:'relay-bridge',name:'Relay/dry-contact bridge',kind:'legacy',execution:'via_hub',protocols:['relay','gpio'],covers:'Older electrical equipment when a safe purpose-built relay/controller exists'},
  {id:'building-automation',name:'Building automation bridge',kind:'commercial',execution:'via_hub',protocols:['modbus','bacnet','knx'],covers:'Commercial HVAC/building controls through a supervised gateway'},
]);

const DOMAIN_CLASS=Object.freeze({
  light:'LIGHT',switch:'SWITCH',input_boolean:'SWITCH',scene:'SCENE',script:'AUTOMATION',automation:'AUTOMATION',
  climate:'THERMOSTAT',fan:'FAN',cover:'COVER',lock:'LOCK',media_player:'MEDIA',vacuum:'VACUUM',
  humidifier:'HUMIDIFIER',water_heater:'WATER_HEATER',alarm_control_panel:'ALARM',siren:'SIREN',
  camera:'CAMERA',button:'BUTTON',sensor:'SENSOR',binary_sensor:'SENSOR',person:'PERSON',
  device_tracker:'TRACKER',weather:'WEATHER',number:'GENERIC',select:'GENERIC'
});

export function normalizeDeviceClass(componentType='',metadata={}){
  const type=clean(componentType);
  const deviceClass=clean(metadata.device_class||metadata.deviceClass);
  const name=clean(metadata.friendly_name||metadata.name);
  if(type==='cover'&&(deviceClass==='garage'||/garage/.test(name)))return 'GARAGE';
  if(type==='binary_sensor'){
    if(['smoke','carbon_monoxide','gas'].includes(deviceClass))return 'SMOKE_CO';
    if(['motion','occupancy','presence'].includes(deviceClass))return 'MOTION';
    if(['door','window','opening'].includes(deviceClass))return 'CONTACT';
    if(['moisture','water'].includes(deviceClass))return 'LEAK';
  }
  if(type==='switch'&&(deviceClass==='outlet'||/outlet|plug/.test(name)))return 'OUTLET';
  return DOMAIN_CLASS[type]||'GENERIC';
}

export function normalizeProtocols(input=[]){
  const values=(Array.isArray(input)?input:[input]).map(clean).filter(Boolean);
  return [...new Set(values.map((value)=>{
    if(value==='zwave'||value==='z_wave'||value==='z wave')return 'z-wave';
    if(value==='zig bee')return 'zigbee';
    if(value==='bt')return 'bluetooth';
    if(value==='ha')return 'home-assistant';
    return WISDO_PROTOCOLS.includes(value)?value:'unknown';
  }))];
}

export function compatibilityPlan(input={}){
  const protocols=normalizeProtocols(input.protocols||input.protocol||input.transport||'unknown');
  const deviceClass=String(input.deviceClass||input.device_class||'GENERIC').toUpperCase();
  let candidates=WISDO_ADAPTERS.filter((adapter)=>adapter.protocols.some((protocol)=>protocols.includes(protocol)));
  const unknown=protocols.length===0||protocols.every((protocol)=>protocol==='unknown');
  if(unknown)candidates=WISDO_ADAPTERS.filter((adapter)=>['home-assistant','lan-api','vendor-cloud','ir-rf-bridge','relay-bridge'].includes(adapter.id));
  const legacy=['ir','rf','relay','serial','gpio'].some((protocol)=>protocols.includes(protocol));
  return {
    deviceClass:WISDO_DEVICE_CLASSES[deviceClass]?deviceClass:'GENERIC',
    protocols,
    controllable:!unknown&&candidates.length>0,
    possibleWithAdapter:candidates.length>0,
    requiresBridge:!protocols.includes('home-assistant'),
    legacy,
    adapters:candidates,
    policy:{
      discoveryDoesNotAuthorize:true,
      proximityDoesNotAuthorize:true,
      approvalRequired:true,
      physicalSecurityRequiresConfirmation:true,
    }
  };
}

export function normalizeUniversalDevice(input={}){
  const metadata=input.metadata&&typeof input.metadata==='object'?input.metadata:{};
  const componentType=clean(input.component_type||input.componentType||metadata.domain||'generic');
  const deviceClass=String(input.wisdo_device_class||input.deviceClass||normalizeDeviceClass(componentType,{...metadata,name:input.name})).toUpperCase();
  const protocols=normalizeProtocols(input.protocols||metadata.protocols||metadata.protocol||metadata.transport||metadata.provider||'unknown');
  const adapterId=clean(input.adapter_id||input.adapterId||metadata.adapter_id||metadata.provider||'unknown');
  return {
    componentType,
    deviceClass:WISDO_DEVICE_CLASSES[deviceClass]?deviceClass:'GENERIC',
    protocols,
    adapterId,
    capabilities:{
      ...(input.capabilities&&typeof input.capabilities==='object'?input.capabilities:{}),
      normalizedActions:WISDO_DEVICE_CLASSES[deviceClass]||WISDO_DEVICE_CLASSES.GENERIC,
    },
    metadata:{
      ...metadata,
      wisdo_device_class:WISDO_DEVICE_CLASSES[deviceClass]?deviceClass:'GENERIC',
      protocols,
      adapter_id:adapterId,
      discovery_does_not_authorize:true,
    }
  };
}
