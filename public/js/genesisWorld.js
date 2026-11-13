/* WISDO Genesis v1 browser renderer: third-person Babylon world, no fake resources.
   All harvesting, crafting, construction and morph changes are validated by the server. */
(() => {
  'use strict';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const clean=(s)=>String(s||'').replace(/_/g,' ');
  let game=null,scene=null,engine=null,camera=null,player=null,prism=null,lighting=null;
  let mats={},prismPieces={},nodeMeshes=new Map(),structureMeshes=new Map(),echoMeshes=new Map();
  let ready=false,pending=false,movePromise=null,lastMoveAt=0,lastRefreshAt=0,lastHintAt=0,lastFrame=0,toastTimeout=0;
  const held=new Set(),joystick={x:0,y:0,active:false};
  let lookAt=null,stayAnchor=null;
  const panelNames=['journey','craft','build','echoes','prism'];
  const iconFor=(k)=>({wood:'🌲',stone:'🪨',iron:'⛏',crystal:'💎',planks:'🪵',pickaxe:'⚒',energy_core:'⚡'})[k]||'•';
  function announce(message,alert=false){
    $('message').textContent=message;
    $('toast').textContent=message;
    $('toast').style.borderColor=alert?'#e7a875':'#69cada';
    $('toast').classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout=setTimeout(()=>$('toast').classList.remove('show'),3400);
  }
  async function api(path,body){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
    try {
      const options={credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}};
      if(body){options.method='POST';options.headers['Content-Type']='application/json';options.headers['X-Wisdo-Genesis']='1';options.body=JSON.stringify(body);}
      const res=await fetch(path,options);
      const json=await res.json().catch(()=>({}));
      if(res.status===401){location.href='/login?returnTo=%2Fapp%2Fgenesis';throw Error('Login required.');}
      if(!res.ok||json.ok===false){const err=new Error(json.error||'World request failed.');err.position=json.position;throw err;}
      return json;
    } finally{clearTimeout(timer);}
  }
  function renderInventory(){
    const items=['wood','stone','iron','crystal','planks','pickaxe'];
    $('resources').innerHTML=items.map(k=>'<span>'+iconFor(k)+' '+esc(k)+' <b>'+Number(game.inventory[k]||0)+'</b></span>').join('');
  }
  function hasCost(cost){return Object.entries(cost||{}).every(([k,v])=>(game.inventory[k]||0)>=v);}
  function costText(cost){return Object.entries(cost||{}).map(([k,v])=>iconFor(k)+' '+esc(k)+' ×'+v).join(' · ');}
  function rebuildPanels(){
    $('craft-items').innerHTML=Object.entries(game.recipes).map(([id,r])=>`
      <div class="option"><div class="row"><strong>${esc(r.label)}</strong><button type="button" data-craft="${esc(id)}" ${hasCost(r.requires)?'':'disabled'}>Craft</button></div>
      <div class="cost">${costText(r.requires)}</div>${r.needs?'<small>Requires '+esc(r.needs)+'</small>':''}</div>`).join('');
    $('build-items').innerHTML=Object.entries(game.buildings).map(([id,b])=>`
      <div class="option"><div class="row"><strong>${esc(b.label)}</strong><button type="button" data-build="${esc(id)}" ${hasCost(b.cost)?'':'disabled'}>Place</button></div>
      <div class="cost">${costText(b.cost)}</div>${b.needs?'<small>Requires '+esc(b.needs)+'</small>':''}</div>`).join('');
    $('echo-items').innerHTML=game.echoes.map(e=>`
      <div class="option"><div class="row"><strong>${esc(e.name)}</strong><span class="pill">${e.bonded?'BONDED':e.discovered?'SCANNED':'WILD'}</span></div>
      <small>${esc(e.description)}</small><div class="cost">Resonance: ${costText(e.cost)}</div>
      ${e.bonded?'<button type="button" data-equip="'+esc(e.id)+'">'+(game.character.equipped===e.id?'Equipped':'Morph into '+esc(e.name))+'</button>':
      '<small>Find it in the world, scan it and offer its resonance materials.</small>'}</div>`).join('')+
      '<button type="button" data-equip="core">Return to PRISM Core</button>';
    $('points').textContent=game.statPoints+' point'+(game.statPoints===1?'':'s');
    $('stat-items').innerHTML=Object.entries(game.stats).map(([key,val])=>`
      <div class="stat"><span>${esc(key)}</span><div class="bar"><div style="width:${Math.min(100,Number(val))}%"></div></div>
      <b>${Number(val)}</b><button type="button" data-train="${esc(key)}" ${game.statPoints>0?'':'disabled'}>+</button></div>`).join('');
    $('goal').textContent=!game.inventory.pickaxe?'Gather wood and stone, then craft a stone pickaxe.':
      !game.structures.some(s=>s.kind==='hut')?'Build your first hut.':
      !game.echoes.some(e=>e.bonded)?'Find and bond your first Echoform.':
      'Build a Morph Station and keep evolving.';
    $('weather').textContent=game.world.timeOfDay+' · '+game.world.weather+(game.world.event!=='No regional event'?' · '+game.world.event:'');
    $('region').textContent='GENESIS FOREST · XP '+game.xp+' · '+game.structures.length+' BUILT';
    renderInventory();
  }
  function syncInputs(){
    $('prism-name').value=game.character.name;
    $('prism-color').value=game.character.color;
    $('prism-movement').value=game.character.movement;
  }
  function material(name,hex,emissive=false){
    const m=new BABYLON.StandardMaterial(name,scene);
    m.diffuseColor=BABYLON.Color3.FromHexString(hex);
    m.specularColor=BABYLON.Color3.FromHexString('#1a3443');
    if(emissive)m.emissiveColor=BABYLON.Color3.FromHexString(hex).scale(.35);
    mats[name]=m;
    return m;
  }
  function ball(parent,name,size,mat,x=0,y=0,z=0){
    const mesh=BABYLON.MeshBuilder.CreateSphere(name,{diameter:1,segments:10},scene);
    mesh.parent=parent;mesh.position.set(x,y,z);mesh.scaling.set(...size);mesh.material=mat;mesh.isPickable=false;return mesh;
  }
  function block(parent,name,size,mat,x=0,y=0,z=0){
    const mesh=BABYLON.MeshBuilder.CreateBox(name,{width:size[0],height:size[1],depth:size[2]},scene);
    mesh.parent=parent;mesh.position.set(x,y,z);mesh.material=mat;mesh.isPickable=false;return mesh;
  }
  function trunk(parent,mat,x,z,height=2){
    const mesh=BABYLON.MeshBuilder.CreateCylinder('tree-trunk',{height,diameterTop:.37,diameterBottom:.5,tessellation:6},scene);
    mesh.parent=parent;mesh.material=mat;mesh.position.set(x,height/2,z);mesh.isPickable=false;return mesh;
  }
  function rootAt(name,x,z){const root=new BABYLON.TransformNode(name,scene);root.position.set(x,0,z);return root;}
  function drawResource(node){
    const p=rootAt('resource:'+node.id,node.x,node.z);
    if(node.type==='wood'){
      trunk(p,mats.wood,0,0,2.9);
      ball(p,'canopy',[3.0,2.3,2.9],mats.leaves,0,3.3,0);
      ball(p,'canopy2',[1.8,1.4,2.1],mats.leavesLight,.7,4.05,.2);
    }else if(node.type==='stone'){
      ball(p,'stone',[2.35,1.55,1.9],mats.rock,0,.78,0);
      ball(p,'stone-detail',[.65,.4,.65],mats.rockLight,.5,1.43,.3);
    }else if(node.type==='iron'){
      ball(p,'ore-rock',[2.05,1.3,2.1],mats.rock,0,.65,0);
      for(const [x,z] of [[-.55,.3],[.4,.4],[.1,-.5]]){
        ball(p,'iron-ore',[.6,.65,.5],mats.iron,x,.95,z);
      }
    }else{
      for(const [x,z,h] of [[0,0,2.3],[.6,.4,1.4],[-.5,-.3,1.2]]){
        const c=BABYLON.MeshBuilder.CreateCylinder('energy-crystal',{height:h,diameterTop:0,diameterBottom:.8,tessellation:6},scene);
        c.material=mats.crystal;c.parent=p;c.position.set(x,h/2,z);c.isPickable=false;
      }
    }
    nodeMeshes.set(node.id,p);p.setEnabled(Boolean(node.ready));
  }
  function drawEcho(e){
    const p=rootAt('wild-echo:'+e.id,e.x,e.z);
    const body=material('echo-'+e.id,e.color,true);
    ball(p,'body',[1.3,.9,1.9],body,0,1.4,0);
    ball(p,'head',[1.15,1.1,1.0],body,0,1.9,1.0);
    ball(p,'muzzle',[.84,.63,.38],mats.dark,0,1.85,1.52);
    for(const x of [-.25,.25])ball(p,'eye',[.16,.18,.13],mats.eye,x,2.02,1.73);
    if(e.id==='voltfang'){
      for(const x of [-.35,.35])block(p,'ear',[.24,.75,.24],body,x,2.65,1.05);
      ball(p,'tail',[.45,.4,1.5],body,0,1.5,-1.4);
    }else if(e.id==='terrakron'){
      for(const x of [-.7,.7])ball(p,'rock-arm',[.8,1.05,.9],mats.rock,x,1.25,.15);
      for(const x of [-.44,.44])block(p,'horn',[.27,.7,.3],mats.iron,x,2.57,1.1);
    }else{
      for(const x of [-.65,.65])ball(p,'wing',[.7,1.7,.25],mats.echoWing,x,1.5,-.3);
      ball(p,'tail',[.3,.4,2],body,0,1.2,-1.25);
    }
    echoMeshes.set(e.id,p);
  }
  function drawBuilding(s){
    const p=rootAt('building:'+s.id,s.x,s.z);
    p.rotation.y=(s.rotation||0)*Math.PI/180;
    const k=s.kind;
    if(k==='hut'){
      block(p,'hut', [4,2.9,4],mats.wood,0,1.45,0);
      const roof=BABYLON.MeshBuilder.CreateCylinder('roof',{height:1.7,diameterTop:0,diameterBottom:5.7,tessellation:4},scene);
      roof.parent=p;roof.material=mats.roof;roof.position.y=3.45;roof.rotation.y=Math.PI/4;
      block(p,'door',[1.2,2.1,.09],mats.dark,0,1.05,2.06);
    } else if(k==='workbench'){
      block(p,'table',[2.5,.27,1.3],mats.wood,0,1.1,0);
      for(const x of [-.8,.8])for(const z of [-.43,.43])block(p,'leg',[.18,1,.18],mats.wood,x,.52,z);
    }else if(k==='campfire'){
      ball(p,'stone-firepit',[2,.35,2],mats.rock,0,.18,0);
      ball(p,'ember',[.9,1,.9],mats.flame,0,.63,0);
    }else if(k==='floor')block(p,'floor',[3,.27,3],mats.wood,0,.22,0);
    else if(k==='wall')block(p,'wall',[3,2.8,.25],mats.wood,0,1.5,0);
    else if(k==='morph_station'){
      block(p,'station',[3,.8,3],mats.iron,0,.48,0);
      block(p,'pillar',[.45,2,.45],mats.iron,0,1.8,0);
      ball(p,'resonance',[1.2,1.2,1.2],mats.crystal,0,2.9,0);
    }
    structureMeshes.set(s.id,p);
  }
  function makePlayer(){
    player=rootAt('player',game.position.x,game.position.z);
    block(player,'torso',[.85,1.3,.48],mats.armor,0,1.36,0);
    ball(player,'head',[.72,.76,.7],mats.skin,0,2.41,0);
    block(player,'visor',[.62,.2,.12],mats.eye,0,2.47,.36);
    for(const x of [-.59,.59])block(player,'arm',[.24,1.05,.32],mats.armor,x,1.34,0);
    for(const x of [-.23,.23])block(player,'leg',[.32,.78,.4],mats.dark,x,.40,0);
  }
  function makePrism(){
    prism=rootAt('prism',game.position.x-2,game.position.z-2);
    const body=material('prism-body',game.character.color,true);
    prismPieces.body=body;
    ball(prism,'bot-body',[.94,1.14,.8],body,0,1.17,0);
    ball(prism,'bot-head',[1.25,1.16,1.15],body,0,2.22,0);
    ball(prism,'bot-face',[.99,.65,.4],mats.dark,0,2.21,.52);
    for(const x of [-.31,.31])ball(prism,'bot-eye',[.19,.23,.10],mats.eye,x,2.33,.71);
    for(const x of [-.55,.55])ball(prism,'bot-hand',[.35,.7,.38],body,x,1.2,0);
    ball(prism,'bot-core',[.43,.44,.19],mats.eye,0,1.18,.43);
    trunk(prism,body,0,0,.28).position.set(0,2.94,0);
    ball(prism,'bot-antenna',[.22,.22,.22],mats.eye,0,3.18,0);
    prismPieces.ears=[];
    for(const x of [-.36,.36])prismPieces.ears.push(block(prism,'morph-ear',[.18,.45,.18],body,x,2.96,.12));
    prismPieces.wings=[];
    for(const x of [-.66,.66])prismPieces.wings.push(ball(prism,'morph-wing',[.46,1.18,.25],mats.echoWing,x,1.73,-.3));
    prismPieces.armor=[];
    for(const x of [-.64,.64])prismPieces.armor.push(ball(prism,'morph-armor',[.48,.68,.5],mats.rock,x,1.38,0));
    applyMorph();
  }
  function applyMorph(){
    if(!game||!prismPieces.body)return;
    const form=game.character.equipped;
    const echo=game.echoes.find(x=>x.id===form);
    prismPieces.body.diffuseColor=BABYLON.Color3.FromHexString(echo?.color||game.character.color);
    prismPieces.body.emissiveColor=prismPieces.body.diffuseColor.scale(.25);
    prismPieces.ears.forEach(x=>x.setEnabled(form==='voltfang'));
    prismPieces.wings.forEach(x=>x.setEnabled(form==='shadeveil'));
    prismPieces.armor.forEach(x=>x.setEnabled(form==='terrakron'));
    stayAnchor=null;
  }
  function drawTerrain(){
    const ground=BABYLON.MeshBuilder.CreateGround('genesis-ground',{width:82,height:82,subdivisions:1},scene);
    ground.material=mats.soil;ground.isPickable=false;
    const patch=(name,x,z,size,mat)=>{
      const p=BABYLON.MeshBuilder.CreateGround(name,{width:size,height:size},scene);
      p.position.set(x,.022,z);p.material=mat;p.isPickable=false;
    };
    patch('moss',-15,11,22,mats.moss);
    patch('mineral-ridge',22,-19,23,mats.gravel);
    patch('moonwood',-22,-22,19,mats.moon);
    patch('crystal-grove',19,24,19,mats.crystalGround);
    const beacon=rootAt('arrival-beacon',0,0);
    const pedestal=BABYLON.MeshBuilder.CreateCylinder('arrival',{height:.25,diameter:5.3,tessellation:24},scene);
    pedestal.parent=beacon;pedestal.material=mats.dark;pedestal.position.y=.10;
    const ring=BABYLON.MeshBuilder.CreateTorus('arrival-ring',{diameter:4.1,thickness:.16,tessellation:32},scene);
    ring.parent=beacon;ring.material=mats.crystal;ring.position.y=.26;
  }
  function setupScene(){
    if(!window.BABYLON){throw new Error('3D engine failed to load. Check internet or content restrictions.');}
    const canvas=$('renderCanvas');
    engine=new BABYLON.Engine(canvas,true,{antialias:true,preserveDrawingBuffer:false,stencil:false});
    if((window.devicePixelRatio||1)>1.7)engine.setHardwareScalingLevel(1.35);
    scene=new BABYLON.Scene(engine);
    scene.clearColor=new BABYLON.Color4(.05,.11,.18,1);
    scene.fogMode=BABYLON.Scene.FOGMODE_EXP2;scene.fogDensity=.007;
    scene.fogColor=new BABYLON.Color3(.09,.19,.24);
    lighting=new BABYLON.HemisphericLight('skylight',new BABYLON.Vector3(0,1,0),scene);
    lighting.intensity=.98;
    const sun=new BABYLON.DirectionalLight('sun',new BABYLON.Vector3(-.5,-1,.55),scene);
    sun.intensity=.5;
    material('soil','#315d4b');material('moss','#256c54');material('gravel','#5b5654');
    material('moon','#48416d');material('crystalGround','#294c61');
    material('wood','#7c543a');material('leaves','#1c8e70');material('leavesLight','#27aa80');
    material('rock','#737d82');material('rockLight','#a2b2b7');material('iron','#829dab',true);
    material('crystal','#68dcf4',true);material('dark','#142737');material('eye','#b5faff',true);
    material('armor','#2a7796');material('skin','#dfb993');material('roof','#3d6b79');
    material('flame','#ffa94b',true);material('echoWing','#805fc8',true);
    drawTerrain();
    game.resources.forEach(drawResource);
    game.echoes.forEach(drawEcho);
    game.structures.forEach(drawBuilding);
    makePlayer();makePrism();
    camera=new BABYLON.ArcRotateCamera('thirdperson',-Math.PI/2,1.14,16,
      new BABYLON.Vector3(player.position.x,1.5,player.position.z),scene);
    camera.lowerRadiusLimit=8;camera.upperRadiusLimit=28;camera.lowerBetaLimit=.38;camera.upperBetaLimit=1.48;
    camera.wheelDeltaPercentage=.018;camera.panningSensibility=0;
    camera.attachControl(canvas,true);
    canvas.style.touchAction='none';
    window.addEventListener('resize',()=>engine.resize());
    applyWeather();
    engine.runRenderLoop(tick);
  }
  function applyWeather(){
    if(!scene||!game)return;
    const dark=game.world.timeOfDay==='Night'||game.world.timeOfDay==='Dusk';
    lighting.intensity=dark ? .43 : .93;
    scene.clearColor=dark?new BABYLON.Color4(.025,.038,.11,1):new BABYLON.Color4(.075,.20,.27,1);
  }
  function syncScene(){
    for(const node of game.resources){
      const mesh=nodeMeshes.get(node.id);
      if(mesh)mesh.setEnabled(node.ready);
    }
    for(const s of game.structures)if(!structureMeshes.has(s.id))drawBuilding(s);
    if(prism)applyMorph();
    applyWeather();
  }
  function cameraForward(){
    return {x:-Math.cos(camera.alpha),z:-Math.sin(camera.alpha)};
  }
  function tick(){
    if(!ready||!engine||!scene)return;
    const now=performance.now(),dt=Math.min(.06,(now-lastFrame)/1000||0);
    lastFrame=now;
    let lateral=(held.has('d')||held.has('arrowright')?1:0)-(held.has('a')||held.has('arrowleft')?1:0)+joystick.x;
    let forward=(held.has('w')||held.has('arrowup')?1:0)-(held.has('s')||held.has('arrowdown')?1:0)-joystick.y;
    const mag=Math.hypot(lateral,forward);
    if(mag>.04){
      lateral/=Math.max(1,mag);forward/=Math.max(1,mag);
      const f=cameraForward();
      const dx=(f.x*forward+f.z*lateral)*game.speed*dt;
      const dz=(f.z*forward-f.x*lateral)*game.speed*dt;
      player.position.x=Math.max(-37,Math.min(37,player.position.x+dx));
      player.position.z=Math.max(-37,Math.min(37,player.position.z+dz));
      player.rotation.y=Math.atan2(dx,dz);
      if(now-lastMoveAt>880)sendPosition().catch(()=>{});
    }
    camera.target.set(player.position.x,1.45,player.position.z);
    const mode=game.character.movement;
    if(mode==='stay'&&!stayAnchor)stayAnchor={x:prism.position.x,z:prism.position.z};
    const target=mode==='stay'?stayAnchor:{x:player.position.x-1.8,z:player.position.z-1.7};
    prism.position.x+=(target.x-prism.position.x)*Math.min(1,dt*3.5);
    prism.position.z+=(target.z-prism.position.z)*Math.min(1,dt*3.5);
    prism.position.y=(mode==='hover'?.85:0)+Math.sin(now/440)*.09;
    prism.rotation.y=Math.atan2(player.position.x-prism.position.x,player.position.z-prism.position.z);
    for(const [id,mesh] of echoMeshes){
      mesh.position.y=Math.sin(now/540+id.length)*.12;
      mesh.rotation.y=Math.sin(now/2200+id.length)*.20;
    }
    if(now-lastHintAt>300){showNearest();lastHintAt=now;}
    if(now-lastRefreshAt>17000){lastRefreshAt=now;refreshWorld().catch(()=>{});}
    scene.render();
  }
  async function sendPosition(){
    if(movePromise)return movePromise;
    lastMoveAt=performance.now();
    movePromise=(async()=>{
      try{
        const response=await api('/api/genesis/move',{x:Number(player.position.x.toFixed(3)),z:Number(player.position.z.toFixed(3))});
        return response;
      }catch(error){
        if(error.position&&Number.isFinite(error.position.x)&&Number.isFinite(error.position.z)){
          player.position.x=error.position.x;player.position.z=error.position.z;
          announce('Movement recalibrated; try walking closer.',true);
        }
        throw error;
      }finally{movePromise=null;}
    })();
    return movePromise;
  }
  function getNearest(){
    const pos=player.position;
    const resource=game.resources.filter(n=>n.ready).map(n=>({...n,d:Math.hypot(n.x-pos.x,n.z-pos.z)}))
      .filter(n=>n.d<5).sort((a,b)=>a.d-b.d)[0];
    const echo=game.echoes.map(e=>({...e,d:Math.hypot(e.x-pos.x,e.z-pos.z)}))
      .filter(e=>e.d<6).sort((a,b)=>a.d-b.d)[0];
    if(echo&&(!resource||echo.d<resource.d))return {kind:'echo',item:echo};
    if(resource)return {kind:'resource',item:resource};
    return null;
  }
  function showNearest(){
    const near=getNearest();
    if(!near){$('nearest').textContent='Move near resources';$('interact').textContent='Explore';$('interact').disabled=true;return;}
    $('interact').disabled=false;
    if(near.kind==='resource'){
      $('nearest').textContent=near.item.type+' deposit';
      $('interact').textContent=(near.item.type==='wood'?'Harvest ':'Mine ')+near.item.type;
    } else {
      $('nearest').textContent='Wild '+near.item.name;
      $('interact').textContent=near.item.bonded?'Bonded':near.item.discovered?'Bond Echoform':'Scan Echoform';
      $('interact').disabled=near.item.bonded;
    }
  }
  async function action(body){
    if(pending)return;
    pending=true;
    try{
      if(player)await sendPosition().catch(()=>{});
      const outcome=await api('/api/genesis/action',body);
      game=outcome.snapshot;
      rebuildPanels();syncScene();
      announce(outcome.message);
    }catch(error){announce(error.message,true);}
    finally{pending=false;}
  }
  async function interact(){
    const near=getNearest();if(!near)return announce('Walk closer to a resource or Echoform.');
    if(near.kind==='resource')return action({action:'gather',nodeId:near.item.id});
    if(!near.item.bonded)return action({action:near.item.discovered?'bond':'scan',echoId:near.item.id});
    announce('Already bonded. Open EchoDex to equip this form.');
  }
  async function place(kind){
    const f=cameraForward();
    const x=Math.round((player.position.x+f.x*4)/2)*2;
    const z=Math.round((player.position.z+f.z*4)/2)*2;
    return action({action:'build',kind,x,z,rotation:0});
  }
  async function refreshWorld(){
    if(pending||!ready)return;
    try{
      const response=await api('/api/genesis/state');
      // Server persistence is authoritative for inventory and construction.
      game=response;
      rebuildPanels();syncScene();
    }catch(error){announce('Could not refresh world state: '+error.message,true);}
  }
  function setupUI(){
    document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{
      document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===button));
      for(const name of panelNames)$('panel-'+name).classList.toggle('active',name===button.dataset.tab);
    }));
    $('craft-items').addEventListener('click',event=>{
      const btn=event.target.closest('[data-craft]');if(btn)action({action:'craft',recipe:btn.dataset.craft});
    });
    $('build-items').addEventListener('click',event=>{
      const btn=event.target.closest('[data-build]');if(btn)place(btn.dataset.build);
    });
    $('echo-items').addEventListener('click',event=>{
      const btn=event.target.closest('[data-equip]');if(btn)action({action:'equip',form:btn.dataset.equip});
    });
    $('stat-items').addEventListener('click',event=>{
      const btn=event.target.closest('[data-train]');if(btn)action({action:'train',stat:btn.dataset.train});
    });
    $('save-prism').addEventListener('click',async()=>{
      await action({action:'customize',name:$('prism-name').value,color:$('prism-color').value,movement:$('prism-movement').value});
    });
    $('interact').addEventListener('click',interact);
    $('build-shortcut').addEventListener('click',()=>place('hut'));
    const fieldFocused=()=>['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);
    window.addEventListener('keydown',e=>{
      if(fieldFocused())return;
      const key=e.key.toLowerCase();
      if(['w','a','s','d','arrowup','arrowleft','arrowright','arrowdown'].includes(key)){
        held.add(key);e.preventDefault();
      }
      if(key==='e'&&!e.repeat){e.preventDefault();interact();}
      if(key==='b'&&!e.repeat){e.preventDefault();document.querySelector('[data-tab="build"]').click();}
    });
    window.addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));
    window.addEventListener('blur',()=>held.clear());
    const joy=$('joystick'),knob=$('joystick-knob');
    const center=()=>{joystick.x=0;joystick.y=0;joystick.active=false;knob.style.transform='translate(0,0)';};
    joy.addEventListener('pointerdown',e=>{joystick.active=true;joy.setPointerCapture(e.pointerId);moveJoy(e);});
    function moveJoy(e){
      if(!joystick.active)return;
      const box=joy.getBoundingClientRect(),x=e.clientX-(box.left+box.width/2),y=e.clientY-(box.top+box.height/2);
      const radius=box.width*.34,mag=Math.max(1,Math.hypot(x,y)),scale=Math.min(1,radius/mag);
      joystick.x=x*scale/radius;joystick.y=y*scale/radius;
      knob.style.transform='translate('+(x*scale)+'px,'+(y*scale)+'px)';
    }
    joy.addEventListener('pointermove',moveJoy);
    joy.addEventListener('pointerup',center);joy.addEventListener('pointercancel',center);
  }
  async function boot(){
    try{
      const result=await api('/api/genesis/state');
      game=result;
      rebuildPanels();syncInputs();
      setupScene();
      setupUI();
      ready=true;lastFrame=performance.now();lastMoveAt=performance.now();lastRefreshAt=performance.now();
      $('loading').style.display='none';
      announce(game.lastMessage||'Genesis Forest loaded. Begin exploring.');
    }catch(error){
      $('load-status').textContent=error.message;
      $('retry').hidden=false;
      $('retry').addEventListener('click',()=>location.reload(),{once:true});
    }
  }
  boot();
})();
