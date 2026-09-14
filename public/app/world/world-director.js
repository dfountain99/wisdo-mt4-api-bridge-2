const unwrap = (event) => event?.detail?.detail ?? event?.detail ?? {};
const reporterId = (reporter) => String(reporter?.id ?? reporter?.accountId ?? reporter?.name ?? 'reporter');
const positionId = (position) => String(position?.ticket ?? `${position?.symbol || 'MARKET'}:${position?.openedAt || ''}:${position?.direction || ''}`);

export function startWorldDirector(){
  let stopped=false;
  let activeDestination=null;
  let activeSignal=null;
  let platformState=navigator.onLine?'connecting':'offline';
  let reporterKnown=false;
  let playerState='IDLE';
  let quality='auto';
  let streamerMode=localStorage.getItem('wisdo-streamer-mode')==='1';
  const reporters=new Map();
  const positions=new Map();
  const stage=document.getElementById('worldStage');
  const status=document.createElement('div');
  status.className='wisdo-director-status';
  status.hidden=true;
  status.style.cssText='position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top) + 82px);z-index:5300;padding:8px 14px;border:1px solid rgba(111,229,255,.26);border-radius:999px;background:rgba(4,10,16,.84);backdrop-filter:blur(10px);color:#dff8ff;font:700 10px/1 system-ui;letter-spacing:.09em;pointer-events:none;box-shadow:0 10px 32px rgba(0,0,0,.28)';
  stage?.appendChild(status);
  const listeners=[];
  const on=(name,fn)=>{window.addEventListener(name,fn);listeners.push([name,fn]);};

  function reporterConnected(){
    if(!reporterKnown)return null;
    return [...reporters.values()].some((reporter)=>reporter?.status==='live'||reporter?.terminalConnected===true);
  }
  function activeSymbols(){return [...new Set([...positions.values()].map((position)=>String(position?.symbol||'').toUpperCase()).filter(Boolean))];}
  function show(text,ms=2200){
    if(stopped||!status)return;
    status.textContent=text;status.hidden=false;clearTimeout(show.timer);show.timer=setTimeout(()=>{status.hidden=true;},ms);
  }
  function connectionLabel(prefix='WORLD'){
    const reporter=reporterConnected();
    if(platformState==='live')return reporter===true?`${prefix} LIVE · REPORTER CONNECTED`:reporter===false?`${prefix} LIVE · REPORTER OFFLINE`:`${prefix} LIVE`;
    if(platformState==='offline')return reporter===true?'WORLD LINK OFFLINE · REPORTER LAST STATE CONNECTED':'WORLD LINK OFFLINE · LIVE DATA MAY BE STALE';
    if(platformState==='degraded'||platformState==='reconnecting')return reporter===true?'PLATFORM DEGRADED · REPORTER CONNECTED':'PLATFORM DEGRADED · LIVE DATA MAY BE STALE';
    return `${prefix} ${String(platformState||'CONNECTING').toUpperCase()}`;
  }
  function snapshot(detail){
    const snap=detail?.snapshot||detail;
    const rows=snap?.worldData?.reporters||snap?.homeRuntime?.live?.reporters||[];
    reporters.clear();rows.forEach((reporter)=>reporters.set(reporterId(reporter),reporter));reporterKnown=true;
    positions.clear();for(const position of snap?.worldData?.positions||snap?.homeRuntime?.live?.positions||[])positions.set(positionId(position),position);
    platformState='live';
  }
  function entered(event){const detail=unwrap(event);activeDestination=detail?.id||null;show(`${String(detail?.name||activeDestination||'WISDO').toUpperCase()} · INTERIOR ACTIVE`);}
  function exited(){activeDestination=null;show('RETURNED TO WISDO CENTRAL');}
  function signal(event){const detail=unwrap(event);activeSignal={id:detail.eventId||detail.id||null,symbol:detail.symbol||detail.event?.symbol||'MARKET',direction:detail.direction||detail.event?.direction||'',expiresAt:detail.expiresAt||detail.event?.expiresAt||null};show(`WISDO SIGNAL · ${activeSignal.symbol} ${activeSignal.direction}`.trim(),3200);}
  function signalExpired(event){const detail=unwrap(event);if(!activeSignal||!detail?.eventId||detail.eventId===activeSignal.id)activeSignal=null;}
  function worldConnection(event){const detail=unwrap(event);platformState=detail?.state||'degraded';show(connectionLabel(),3500);}
  function browserConnection(){platformState=navigator.onLine?(platformState==='offline'?'reconnecting':platformState):'offline';show(connectionLabel(),3500);}
  function reporterOnline(event){const detail=unwrap(event);const reporter=detail?.reporter||detail;reporters.set(reporterId(reporter),{...reporter,status:'live'});reporterKnown=true;show(connectionLabel('REPORTER'),2600);}
  function reporterOffline(event){const detail=unwrap(event);const reporter=detail?.reporter||detail;const id=reporterId(reporter);reporters.set(id,{...(reporters.get(id)||{}),...reporter,status:'offline',terminalConnected:false});reporterKnown=true;show(connectionLabel('REPORTER'),2600);}
  function positionOpened(event){const position=unwrap(event)?.position;if(position)positions.set(positionId(position),position);}
  function positionUpdated(event){const position=unwrap(event)?.position;if(position)positions.set(positionId(position),position);}
  function positionClosed(event){const position=unwrap(event)?.position;if(position)positions.delete(positionId(position));}
  function player(event){const detail=unwrap(event);playerState=detail?.state||playerState;}
  function streamer(event){streamerMode=Boolean(unwrap(event)?.enabled);try{localStorage.setItem('wisdo-streamer-mode',streamerMode?'1':'0');}catch{}show(streamerMode?'STREAMER MODE · PRIVATE FINANCIALS HIDDEN':'STREAMER MODE OFF',1800);}

  on('wisdo:world.ready',(event)=>{snapshot(unwrap(event));show(connectionLabel(),2200);});
  on('wisdo:world-destination-entered',entered);on('wisdo:world-destination-exited',exited);
  on('wisdo:bot.signal.created',signal);on('wisdo:bot.signal.expired',signalExpired);
  on('wisdo:world.connection',worldConnection);on('online',browserConnection);on('offline',browserConnection);
  on('wisdo:reporter.online',reporterOnline);on('wisdo:reporter.offline',reporterOffline);
  on('wisdo:position.opened',positionOpened);on('wisdo:position.updated',positionUpdated);on('wisdo:position.closed',positionClosed);
  on('wisdo:world-player-state',player);on('wisdo:streamer-mode',streamer);

  const api=Object.freeze({
    version:'WISDO-WORLD-DIRECTOR-V2',
    worldTime:'BLUE_HOUR',
    announce:show,
    setStreamerMode(enabled){window.dispatchEvent(new CustomEvent('wisdo:streamer-mode',{detail:{enabled:Boolean(enabled)}}));},
    setCompanionSide(side){window.dispatchEvent(new CustomEvent('wisdo:companion-side',{detail:{side}}));},
    setQuality(next){quality=String(next||'auto');globalThis.WisdoWorldMasterProduction?.setQuality?.(quality);},
    get state(){return Object.freeze({activeDestination,activeSignal,online:navigator.onLine,platformState,reporterConnected:reporterConnected(),reporterCount:reporters.size,activeSymbols:activeSymbols(),openPositions:positions.size,playerState,quality,streamerMode,worldTime:'BLUE_HOUR'});},
  });
  globalThis.WisdoWorldDirector=api;
  return Object.freeze({
    stop(){
      if(stopped)return;stopped=true;clearTimeout(show.timer);listeners.forEach(([name,fn])=>window.removeEventListener(name,fn));status.remove();if(globalThis.WisdoWorldDirector===api)delete globalThis.WisdoWorldDirector;
    },
  });
}
