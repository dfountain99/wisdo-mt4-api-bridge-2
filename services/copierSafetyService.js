import { SymbolResolver } from './symbolResolver.js';

function id(value) { return String(value || '').trim(); }
function roundDown(value, step) { const precision = Math.max(0, (String(step).split('.')[1] || '').length); return Number((Math.floor((Number(value) + Number.EPSILON) / step) * step).toFixed(precision)); }

export function assertSafeCopierGraph(routes = [], candidate = null) {
  const all = [...routes, ...(candidate ? [candidate] : [])].filter((route) => String(route.status || 'ACTIVE').toUpperCase() !== 'ARCHIVED');
  const edges = new Map(); const pairs = new Set();
  for (const route of all) {
    const from=id(route.masterAccountId || route.leaderAccountId), to=id(route.followerAccountId);
    if (!from || !to) throw Object.assign(new Error('Copier route requires stable master and follower account IDs.'),{code:'copier_accounts_required'});
    if (from === to) throw Object.assign(new Error('An account cannot copy itself.'),{code:'copier_self_route'});
    const pair=`${from}->${to}`; if(pairs.has(pair))throw Object.assign(new Error('Duplicate copier route.'),{code:'copier_duplicate_route'}); pairs.add(pair);
    edges.set(from,[...(edges.get(from)||[]),to]);
  }
  const visiting=new Set(),visited=new Set();
  const visit=(node)=>{if(visiting.has(node))throw Object.assign(new Error('Circular copier route detected.'),{code:'copier_cycle'});if(visited.has(node))return;visiting.add(node);for(const next of edges.get(node)||[])visit(next);visiting.delete(node);visited.add(node);};
  for(const node of edges.keys())visit(node); return true;
}

export function normalizeCopierLot({ mode='fixed', sourceLot=0, fixedLot=0.01, multiplier=1, masterBalance=0, followerBalance=0, masterEquity=0, followerEquity=0, allocationPercent=100, minLot=0.01, maxLot=100, lotStep=0.01 }={}) {
  const source=Number(sourceLot); let raw;
  if(mode==='fixed')raw=Number(fixedLot);else if(mode==='multiplier')raw=source*Number(multiplier);else if(mode==='balance_proportional')raw=source*(Number(followerBalance)/Math.max(Number(masterBalance),0.01));else if(mode==='equity_proportional')raw=source*(Number(followerEquity)/Math.max(Number(masterEquity),0.01));else if(mode==='allocation')raw=source*(Number(allocationPercent)/100);else raw=source;
  const bounded=Math.min(Number(maxLot),Math.max(Number(minLot),raw)); return {mode,sourceLot:source,rawLot:raw,lot:roundDown(bounded,Number(lotStep)),minLot:Number(minLot),maxLot:Number(maxLot),lotStep:Number(lotStep),capped:raw!==bounded};
}

export function simulateCopierEvent({ event, route, followerSnapshot, symbolResolver=new SymbolResolver() }={}) {
  assertSafeCopierGraph([],route);
  const resolution=symbolResolver.resolve(event?.symbol,followerSnapshot?.symbols||[],route?.symbolMap||{});
  const lot=normalizeCopierLot({sourceLot:event?.lots,...(route?.lotPolicy||{}),masterBalance:event?.masterBalance,followerBalance:followerSnapshot?.balance,masterEquity:event?.masterEquity,followerEquity:followerSnapshot?.equity});
  const reasons=[]; if(!resolution.ok)reasons.push(resolution.reason); if(route?.riskPolicy?.maxOpenPositions!==undefined&&Number(followerSnapshot?.openTradeCount||0)>=Number(route.riskPolicy.maxOpenPositions))reasons.push('max_open_positions'); if(route?.riskPolicy?.dailyLossLimit!==undefined&&Number(followerSnapshot?.dailyProfit||0)<=-Math.abs(Number(route.riskPolicy.dailyLossLimit)))reasons.push('daily_loss_guard');
  return {masterAccountId:id(route?.masterAccountId||route?.leaderAccountId),followerAccountId:id(route?.followerAccountId),sourceEventId:id(event?.sourceEventId||event?.eventId),sourceSymbol:id(event?.symbol),resolvedSymbol:resolution.resolvedSymbol||null,sourceLot:Number(event?.lots||0),calculatedLot:lot.lot,symbolResolution:resolution,riskChecks:{accepted:reasons.length===0,reasons},command:reasons.length?null:{accountId:id(route?.followerAccountId),action:event?.action||'OPEN_MARKET',symbol:resolution.resolvedSymbol,lots:lot.lot,sourceEventId:id(event?.sourceEventId||event?.eventId)},accepted:reasons.length===0};
}
