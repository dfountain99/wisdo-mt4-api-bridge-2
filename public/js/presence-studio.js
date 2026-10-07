(() => {
  'use strict';
  const $=id=>document.getElementById('ps-'+id);
  if(!$('settings'))return;
  let snapshot=null,secret=null,mic=null,micContext=null,micTimer=null,camera=null,cameraTimer=null,recognition=null,audio=null,polling=false,knownNotices=null;
  const storageKey='wisdo.presence.devices.v1:'+String(window.WISDO_USER?.id||'');
  let choices={};try{choices=JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{}
  const status=text=>$('status').textContent=text;
  const run=fn=>async event=>{try{await fn(event);}catch(error){status(error.message||'Device operation failed.');}};
  async function api(path='',method='GET',body){
    const res=await fetch('/api/presence-studio'+path,{method,headers:{'Content-Type':'application/json','X-Wisdo-Intent':'presence-studio'},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await res.json();if(!res.ok)throw Error(data.error||'Presence request failed');return data;
  }
  function option(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}
  function stopMic(){if(mic)mic.getTracks().forEach(t=>t.stop());mic=null;clearInterval(micTimer);micContext?.close();micContext=null;$('level').value=0;$('mic-status').textContent='Microphone off.';}
  function stopCamera(){if(camera)camera.getTracks().forEach(t=>t.stop());camera=null;clearInterval(cameraTimer);$('video').srcObject=null;$('motion').textContent='Camera off.';}
  async function enumerate(){
    if(!navigator.mediaDevices?.enumerateDevices)throw Error('Device access requires HTTPS and a supported browser.');
    const devices=await navigator.mediaDevices.enumerateDevices();
    for(const [name,kind] of [['mic','audioinput'],['output','audiooutput'],['camera','videoinput']]){
      const select=$(name),value=select.value||choices[name]||'';select.replaceChildren();option(select,'','System default');
      devices.filter(x=>x.kind===kind&&x.deviceId!=='default').forEach((x,i)=>option(select,x.deviceId,x.label||`${name} ${i+1}`));
      if([...select.options].some(o=>o.value===value))select.value=value;
    }
  }
  $('discover').onclick=run(async()=>{const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop());await enumerate();status('Available audio devices refreshed.');});
  $('mic-test').onclick=run(async()=>{
    stopMic();mic=await navigator.mediaDevices.getUserMedia({audio:$('mic').value?{deviceId:{exact:$('mic').value}}:true});
    try{micContext=new AudioContext();await micContext.resume();const analyser=micContext.createAnalyser();micContext.createMediaStreamSource(mic).connect(analyser);const data=new Uint8Array(analyser.fftSize);micTimer=setInterval(()=>{analyser.getByteTimeDomainData(data);$('level').value=Math.min(100,Math.sqrt(data.reduce((s,x)=>s+(x-128)**2,0)/data.length)*4);},100);$('mic-status').textContent='Microphone active for local level test; audio is not uploaded.';}catch(e){stopMic();throw e;}
  });
  $('mic-stop').onclick=stopMic;
  $('speaker').onclick=run(async()=>{if(!navigator.mediaDevices?.selectAudioOutput){$('audio-status').textContent='Choose the output in system sound settings, or use the list if your browser supports it.';return;}const d=await navigator.mediaDevices.selectAudioOutput();await enumerate();option($('output'),d.deviceId,d.label||'Selected speaker');$('output').value=d.deviceId;});
  async function speak(text){
    audio?.pause();
    const res=await fetch('/api/presence-studio/speech',{method:'POST',headers:{'Content-Type':'application/json','X-Wisdo-Intent':'presence-studio'},body:JSON.stringify({text:text.slice(0,1500)})});
    if(!res.ok)throw Error('WISDO speech is unavailable. Your text remains visible.');
    const url=URL.createObjectURL(await res.blob());audio=new Audio(url);audio.onended=()=>URL.revokeObjectURL(url);
    try{if($('output').value){if(!audio.setSinkId)throw Error('This browser uses system audio output. Select System default and route audio in phone/computer settings.');await audio.setSinkId($('output').value);}await audio.play();$('audio-status').textContent='Playback started. Confirm you can hear it.';}catch(e){URL.revokeObjectURL(url);throw e;}
  }
  $('sound').onclick=run(()=>speak('WISDO is ready. Can you hear me through your selected speaker?'));
  $('local-save').onclick=run(()=>{choices={mic:$('mic').value,output:$('output').value,camera:$('camera').value};localStorage.setItem(storageKey,JSON.stringify(choices));status('Device choices saved on this browser.');});
  $('dictate').onclick=run(()=>{
    const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R)throw Error('Dictation is unavailable in this browser. Use your phone keyboard microphone or type.');
    stopMic();recognition?.abort();recognition=new R();recognition.lang='en-US';recognition.interimResults=false;recognition.onresult=e=>{$('message').value=e.results[0][0].transcript;$('dictation').textContent='Review your words and press Send.';};recognition.onerror=e=>$('dictation').textContent='Dictation stopped: '+e.error;recognition.onend=()=>{$('dictate').disabled=false;};recognition.start();$('dictate').disabled=true;$('dictation').textContent='Listening through your system-default microphone…';
  });
  $('send').onclick=run(async()=>{
    const message=$('message').value.trim();if(!message)return;
    $('send').disabled=true;
    try{const res=await fetch('/api/wisdo-ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,currentPage:location.pathname,selectedAccountId:''})});const data=await res.json();if(!res.ok)throw Error(data.error||'WISDO request failed.');$('answer').textContent=data.answer||'No response returned.';if($('read').checked&&data.answer)await speak(data.answer);}finally{$('send').disabled=false;}
  });
  $('camera-list').onclick=run(async()=>{const stream=await navigator.mediaDevices.getUserMedia({video:true});stream.getTracks().forEach(t=>t.stop());await enumerate();});
  $('camera-start').onclick=run(async()=>{
    stopCamera();camera=await navigator.mediaDevices.getUserMedia({video:$('camera').value?{deviceId:{exact:$('camera').value}}:true,audio:false});
    const video=$('video');video.srcObject=camera;
    try{await video.play();}catch(e){stopCamera();throw e;}
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=48;const ctx=canvas.getContext('2d',{willReadFrequently:true});let previous=null,lastMotion=0;
    cameraTimer=setInterval(()=>{
      if(video.readyState<2)return;ctx.drawImage(video,0,0,64,48);const frame=ctx.getImageData(0,0,64,48).data;
      if(previous){let difference=0;for(let i=0;i<frame.length;i+=4)difference+=Math.abs(frame[i]-previous[i]);if(difference/(64*48)>Number($('sensitivity').value))lastMotion=Date.now();}
      previous=new Uint8ClampedArray(frame);$('motion').textContent=Date.now()-lastMotion<3000?'Motion observed locally — identity unknown.':'No recent motion — occupancy remains unknown.';
    },500);
  });
  $('camera-stop').onclick=stopCamera;
  function showSettings(data){
    const s=data.settings;
    for(const [kind,id,key] of [['phone','phone-source','phoneSource'],['door','door-source','doorSource'],['occupancy','occupancy-source','occupancySource']]){const select=$(id);select.replaceChildren();option(select,'','Not configured');data.sources.filter(x=>x.kind===kind&&!x.revoked).forEach(x=>option(select,x.source_id,x.name));select.value=s[key];}
    $('room').value=s.room;$('greeting').value=s.greeting;$('arrival-enabled').checked=s.arrivalEnabled;$('require-door').checked=s.requireDoor;$('away-seconds').value=s.awaySeconds;$('away-action').value=s.awayAction;$('save').disabled=false;
  }
  function showEvidence(data){
    $('desk').textContent='Desk: '+(data.runtime.deskState||'unknown');$('sources').replaceChildren();
    for(const source of data.sources){const row=document.createElement('div');row.className='ps-source';const label=document.createElement('p');label.textContent=`${source.name} · ${source.kind} · ${source.revoked?'revoked':source.last_seen_at?`${source.state} reported ${new Date(source.last_seen_at).toLocaleString()}`:'waiting for first event'}`;row.append(label);if(!source.revoked){const b=document.createElement('button');b.className='btn';b.textContent='Revoke';b.onclick=run(async()=>{await api('/sources/'+source.source_id,'DELETE');await refresh(true);});row.append(b);}$('sources').append(row);}
    const notices=data.runtime.notices||[];$('notices').replaceChildren();
    for(const n of [...notices].reverse()){const p=document.createElement('p');p.textContent=`${new Date(n.at).toLocaleString()} — ${n.text}`;$('notices').append(p);}
    if(knownNotices&&$('read').checked){const n=notices.findLast(n=>!knownNotices.has(n.id)&&Date.now()-Date.parse(n.at)<30000);if(n)speak(n.text).catch(e=>status(e.message));}
    knownNotices=new Set(notices.map(n=>n.id));
  }
  async function refresh(forms=false){if(polling)return;polling=true;try{snapshot=await api();if(forms)showSettings(snapshot);showEvidence(snapshot);}finally{polling=false;}}
  $('settings').onsubmit=run(async e=>{e.preventDefault();await api('','PUT',{room:$('room').value,greeting:$('greeting').value,arrivalEnabled:$('arrival-enabled').checked,requireDoor:$('require-door').checked,awaySeconds:Number($('away-seconds').value),awayAction:$('away-action').value,phoneSource:$('phone-source').value,doorSource:$('door-source').value,occupancySource:$('occupancy-source').value});await refresh(true);status('Presence rules saved. Trading settings unchanged.');});
  $('source-form').onsubmit=run(async e=>{e.preventDefault();secret=await api('/sources','POST',{name:$('source-name').value,kind:$('source-kind').value});$('secret').hidden=false;$('connection').textContent=JSON.stringify({url:location.origin+'/api/presence-studio/events/'+secret.sourceId,method:'POST',headers:{Authorization:'Bearer '+secret.token,'Content-Type':'application/json'},body:{state:secret.kind==='phone'?'home':secret.kind==='door'?'open':'occupied',observedAt:'CURRENT_ISO_TIMESTAMP',eventId:'NEW_UUID_PER_EVENT'}},null,2);await refresh(true);status('Connection created. It is waiting for its first event.');});
  $('copy').onclick=run(()=>navigator.clipboard.writeText($('connection').textContent));
  $('clear-secret').onclick=()=>{secret=null;$('connection').textContent='';$('ha-yaml').textContent='Credential cleared. Create a new source if needed.';$('secret').hidden=true;};
  $('ha-generate').onclick=run(()=>{
    if(!secret)throw Error('Create a connection first; its secret is shown only once.');
    const entity=$('ha-entity').value.trim(),speaker=$('ha-speaker').value.trim(),tts=$('ha-tts').value.trim();
    if(!/^(person|device_tracker|binary_sensor|sensor)\.[a-z0-9_]+$/.test(entity))throw Error('Enter a valid Home Assistant entity ID.');
    if((speaker&&!/^media_player\.[a-z0-9_]+$/.test(speaker))||(tts&&!/^tts\.[a-z0-9_]+$/.test(tts)))throw Error('Enter valid speaker and TTS entity IDs.');
    const key='wisdo_presence_'+secret.sourceId.replaceAll('-','');
    const mapping=secret.kind==='phone'?"{'home':'home','not_home':'away','away':'away'}":secret.kind==='door'?"{'on':'open','off':'closed'}":"{'on':'occupied','off':'vacant'}";
    const url=location.origin+'/api/presence-studio/events/'+secret.sourceId;
    const heartbeat=secret.kind==='occupancy'?'\n      - platform: time_pattern\n        seconds: "/30"':'';
    // A package can be included through Home Assistant packages; tokens stay local to the owner.
    $('ha-yaml').textContent=`# Home Assistant package. Merge under homeassistant: packages: in your configuration.\nrest_command:\n  ${key}:\n    url: ${JSON.stringify(url)}\n    method: POST\n    headers:\n      Authorization: "Bearer ${secret.token}"\n    content_type: "application/json"\n    payload: >-\n      {{ {'state': ${mapping}.get(states('${entity}'), 'unknown'), 'observedAt': now().isoformat(), 'eventId': now().strftime('%Y%m%d%H%M%S%f')} | to_json }}\nautomation:\n  - alias: ${JSON.stringify('WISDO '+entity)}\n    mode: queued\n    trigger:\n      - platform: state\n        entity_id: ${entity}${heartbeat}\n    action:\n      - action: rest_command.${key}\n`;
    if(speaker&&tts&&secret.kind==='phone')$('ha-yaml').textContent+=`\n  # Optional local greeting: phone home transition only, independent of WISDO door rules.\n  - alias: WISDO local phone greeting\n    mode: single\n    trigger:\n      - platform: state\n        entity_id: ${entity}\n        from: "not_home"\n        to: "home"\n    action:\n      - action: tts.speak\n        target:\n          entity_id: ${tts}\n        data:\n          media_player_entity_id: ${speaker}\n          message: ${JSON.stringify($('greeting').value||'Welcome home.')}\n      - delay: "00:05:00"\n`;
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMic();stopCamera();recognition?.abort();audio?.pause();}else refresh().catch(e=>status(e.message));});
  window.addEventListener('pagehide',()=>{stopMic();stopCamera();recognition?.abort();audio?.pause();});
  if(!('setSinkId' in HTMLMediaElement.prototype))$('audio-status').textContent='This browser routes audio through system sound settings.';
  enumerate().catch(()=>{});
  refresh(true).then(()=>status('Ready. Enable only the devices you want to use.')).catch(e=>status(e.message));
  setInterval(()=>{if(!document.hidden)refresh().catch(e=>status(e.message));},5000);
})();
