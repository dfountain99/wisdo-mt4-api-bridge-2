// A deliberate "Add one" in Rewire is operation 12 (manual SONIC), NOT op 18
// (Unity's conditional evaluation). Never alter the EA's broker-side risk checks.
export function resolveManualAddForEA(snapshot, requestedAction) {
  if (requestedAction !== 'ADD_IF_VALID') return {action:requestedAction,params:{}};
  const c=snapshot?.campaignControl;
  if (!c?.live || !c.enabled) throw Object.assign(new Error('No authenticated, enabled HIGHTOWER campaign receiver is live. Manual add was not queued.'),{statusCode:409,code:'ea_receiver_not_ready'});
  const version=Number(c.managerOpsVersion||0);
  if (version===1) return {action:requestedAction,params:{}}; // H620 full campaign receiver implements op 18.
  if (![0,12].includes(version)) throw Object.assign(new Error('Unknown EA manual-add protocol. No entry was requested.'),{statusCode:409,code:'add_protocol_unsupported'});
  const compatible=(snapshot.campaigns||[]).filter(row=>
    String(row.symbol||'').toUpperCase()===String(c.symbol||'').toUpperCase() &&
    Number(row.magicNumber)===Number(c.magic) &&
    Number(row.positionCount||row.positions?.length||0)>0);
  if (compatible.length!==1 || Number(c.phase)!==1) throw Object.assign(new Error('Select one active campaign matching the EA symbol and MagicNumber before adding a position.'),{statusCode:409,code:'add_campaign_scope'});
  const side=String(compatible[0].direction||'').toUpperCase();
  const direction=side==='BUY'?1:side==='SELL'?-1:0;
  if (!direction) throw Object.assign(new Error('The current campaign direction is not verified. Choose an explicitly scoped BUY or SELL command.'),{statusCode:409,code:'add_direction_unknown'});
  return {action:'ARM_SONIC',params:{burstCount:1,durationSeconds:30,requestedDirection:direction},source:'rewire_explicit_one_add',reason:'Rewire manual-entry operation 12, scoped to an existing campaign'};
}
