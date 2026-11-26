// Resolve only the exact, fresh Hightower receiver watched by this account's Reporter.
export function receiverLaneId(control){
  if(control?.version!==1||control.lanePauseVersion!==1||typeof control.symbol!=='string'||!/^[A-Za-z0-9_.#-]{1,24}$/.test(control.symbol)||!Number.isInteger(control.magic)||control.magic<=0)return null;
  return control.symbol+':'+control.magic;
}
export function resolveLanePauseTarget(account,laneReference,now=Date.now()){
  const snapshot=account?.latestSnapshot?.snapshot||account?.snapshot||{},control=snapshot.campaignControl;
  const receiver=receiverLaneId(control);
  const age=(now-Date.parse(account?.latestSnapshot?.receivedAt||account?.lastSyncAt||''))/1000;
  if(!receiver||!control.enabled||snapshot.expertEnabled!==true||snapshot.terminalConnected===false||
     !Number.isFinite(age)||age<0||!Number.isFinite(control.ageSeconds)||control.ageSeconds<0||age+control.ageSeconds>30)
    throw new Error('A fresh compatible Hightower receiver is required. Check /bot-lanes and Reporter health.');
  const requested=String(laneReference??'').trim();
  if(requested!==receiver){
    const rows=Array.isArray(snapshot.bots)?snapshot.bots:Array.isArray(snapshot.lanes)?snapshot.lanes:[];
    const matches=rows.filter(row=>[row.laneId,row.laneKey,row.botId,row.id].some(id=>id!=null&&String(id)===requested));
    if(!requested||matches.length!==1||String(matches[0].symbol)!==control.symbol||Number(matches[0].magicNumber??matches[0].magic)!==control.magic)
      throw new Error('Lane not verified. Use exact watched lane ID '+receiver+'. No terminal-wide fallback.');
  }
  return {scope:'LANE',symbol:control.symbol,magicNumber:control.magic,laneId:receiver};
}
