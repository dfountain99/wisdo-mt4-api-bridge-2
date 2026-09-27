// Course identity is driven by lap progress so visuals, handling and HUD share one route.
export const CITY_ZONES=Object.freeze([
  {id:'downtown',label:'DOWNTOWN SWEEP',from:0,to:.19,roadWidth:20,speed:1},
  {id:'office',label:'OFFICE SHORTCUT',from:.19,to:.34,roadWidth:17,speed:1.14},
  {id:'market',label:'MARKET DISTRICT',from:.34,to:.53,roadWidth:18,speed:.98},
  {id:'parking',label:'PARKING DECK',from:.53,to:.75,roadWidth:17,speed:1.03},
  {id:'tower',label:'WISDO TOWER STRAIGHT',from:.75,to:1,roadWidth:20,speed:1.08},
]);

export function cityZone(progress){
  const p=((Number(progress)||0)%1+1)%1;
  return CITY_ZONES.find(zone=>p>=zone.from&&p<zone.to)||CITY_ZONES[0];
}

// A browser result is display-only. A future match server must attest placement
// before awarding any XP or Culture Coin to an account.
export function localRaceResult(racers,durationSeconds){
  const placements=[...racers].sort((a,b)=>b.banked-a.banked||b.checkpoints-a.checkpoints||a.id.localeCompare(b.id));
  return {schema:'wisdo.streetSprint.result.v1',mode:'solo-local',durationSeconds,
    placements:placements.map((r,index)=>({place:index+1,id:r.id,banked:r.banked,checkpoints:r.checkpoints})),
    rewardStatus:'unverified',cultureCoinAwarded:0,xpAwarded:0};
}
