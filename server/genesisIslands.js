/**
 * Persistent archipelago registry. Each account owns one island; visiting never
 * changes ownership. Registry state is updated inside the repository transaction.
 * Coordinates remain local to an island, never global across separate instances.
 */
const ID=/^island-([1-9]\d{0,8})$/;
export function isGenesisIslandId(value){return typeof value==='string'&&ID.test(value);}
export function genesisIslandName(id){
  const match=ID.exec(String(id||''));
  return match?'Island '+Number(match[1]):'Unassigned island';
}
export function genesisIslandDirectory(state){
  const ids=new Set(Object.values(state.genesisProfilesByUserId||{})
    .map(profile=>profile?.homeIslandId).filter(isGenesisIslandId));
  return [...ids].sort((a,b)=>Number(a.slice(7))-Number(b.slice(7)))
    .map(id=>({id,name:genesisIslandName(id)}));
}
export function ensureGenesisIsland(state,profile){
  if(!isGenesisIslandId(profile.homeIslandId)){
    const assigned=new Set(genesisIslandDirectory(state).map(island=>island.id));
    let next=Math.max(1,Math.floor(Number(state.genesisNextIslandNumber)||1));
    while(assigned.has('island-'+next))next++;
    if(next>999999999)throw new Error('Genesis island identifier space exhausted.');
    profile.homeIslandId='island-'+next;
    state.genesisNextIslandNumber=next+1;
  }
  if(!isGenesisIslandId(profile.currentIslandId)||
     !genesisIslandDirectory(state).some(island=>island.id===profile.currentIslandId)){
    profile.currentIslandId=profile.homeIslandId;
  }
  return profile;
}
