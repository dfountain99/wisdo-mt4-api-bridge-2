// Structural world meaning, independent of Babylon and Unreal geometry.
// A renderer must supply its own camera/visibility evidence before certification.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function evaluateWorldComposition(manifest){
 const ops=manifest.operations||manifest.forgeOperations||[],find=type=>ops.find(o=>o.type===type),
  land=find('CREATE_LANDMASS'),ocean=find('CREATE_OCEAN'),mountain=find('CREATE_MOUNTAIN_RANGE'),tower=find('CREATE_TOWER'),city=find('CREATE_CITY_ZONE'),forest=find('CREATE_FOREST'),portal=find('CREATE_PORTAL'),spawn=manifest.spawn;
 const distance=(a,b)=>a&&b?Math.hypot(a.x-b.x,a.z-b.z):Infinity;
 const within=(a,b)=>a&&b&&Math.abs(a.x-b.position.x)<b.dimensions.x/2&&Math.abs(a.z-b.position.z)<b.dimensions.z/2;
 const checks={
  landmass:Boolean(land?.dimensions?.x>1000&&land?.dimensions?.z>1000),
  oceanSurroundsIsland:Boolean(ocean&&land&&ocean.dimensions.x>land.dimensions.x*1.3&&ocean.dimensions.z>land.dimensions.z*1.3&&distance(ocean.position,land.position)<100),
  mountainPerimeter:Boolean(mountain?.region==='perimeter'&&land&&mountain.dimensions.x>=land.dimensions.x*.85&&mountain.dimensions.z>=land.dimensions.z*.85&&mountain.dimensions.y>=200),
  towerCentrality:Boolean(tower&&land&&distance(tower.position,land.position)<land.dimensions.x*.1&&tower.semanticRole==='hero_landmark'),
  towerProminence:Boolean(tower&&city&&tower.dimensions.y>city.dimensions.y*3),
  cityAroundTower:Boolean(city&&tower&&within(tower.position,city)),
  forestSeparate:Boolean(forest&&city&&distance(forest.position,city.position)>(forest.dimensions.x+city.dimensions.x)*.42),
  portalNearTower:Boolean(portal&&tower&&distance(portal.position,tower.position)<land?.dimensions?.x*.3),
  spawnOnLand:Boolean(spawn&&land&&['x','y','z'].every(k=>finite(spawn[k]))&&within(spawn,land)&&spawn.y>=1.8&&tower&&distance(spawn,tower.position)>tower.dimensions.x),
 };
 const failed=Object.entries(checks).filter(([,pass])=>!pass).map(([name])=>name);
 return {schema:'wisdo-world-composition-v2',checks,passed:Object.keys(checks).length-failed.length,total:Object.keys(checks).length,failed,
  status:failed.length?'FAIL':'STRUCTURAL_PASS_VISUAL_PENDING'};
}
