export const BULL_MAN_VERSION = '1.0.0';
export const BULL_MAN_TICK_MS = 150;
export const BULL_MAN_MAX_TICKS = 1200;

// # = wall, . = liquidity, P = power-up, space = open lane.
export const BULL_MAN_MAZE = Object.freeze([
  '###############',
  '#......#......P#',
  '#.###..#..###..#',
  '#.....###.....##',
  '###.#.....#.####',
  '#...#.###.#....#',
  '#.#...#.#...#..#',
  '#.#.###.###.#..#',
  '#...#.....#....#',
  '###.#.###.#.####',
  '#P..#.....#....#',
  '#.#####.#####..#',
  '#..............#',
  '#..###.....###P#',
  '###############',
]);

export const BULL_MAN_LESSONS = Object.freeze([
  Object.freeze({ id:'confirmation', prompt:'After price sweeps a level, what is the stronger next step?', choices:['Chase immediately','Wait for confirmation / reclaim','Double risk'], lesson:'A sweep alone is not confirmation. Wait for structure, reclaim, or your defined trigger.' }),
  Object.freeze({ id:'risk', prompt:'What should happen to position size when your stop distance becomes wider?', choices:['Usually reduce size','Always increase size','Ignore stop distance'], lesson:'Risk is controlled by the relationship between position size and stop distance.' }),
  Object.freeze({ id:'fomo', prompt:'A large candle already ran far from your planned entry. What is the disciplined response?', choices:['Enter because it is moving','Wait for a new valid setup','Remove the stop'], lesson:'Missing a move is cheaper than chasing an invalid entry.' }),
]);

const DIRS = Object.freeze({
  up:Object.freeze([0,-1]), down:Object.freeze([0,1]), left:Object.freeze([-1,0]), right:Object.freeze([1,0]), none:Object.freeze([0,0]),
});
const VALID_DIRECTIONS = new Set(Object.keys(DIRS));

function key(x,y){ return `${x},${y}`; }
function hash32(value){ let h=2166136261>>>0; for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);} return h>>>0; }
function mulberry32(seed){ let a=seed>>>0; return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}; }
function isWall(x,y){ return !BULL_MAN_MAZE[y] || BULL_MAN_MAZE[y][x] === '#'; }
function canMove(x,y,dir){ const [dx,dy]=DIRS[dir]||DIRS.none; return !isWall(x+dx,y+dy); }
function movePoint(point,dir){ const [dx,dy]=DIRS[dir]||DIRS.none; return {x:point.x+dx,y:point.y+dy}; }

function collectibleSets(){
  const liquidity=new Set(), powerUps=new Set();
  for(let y=0;y<BULL_MAN_MAZE.length;y+=1){
    for(let x=0;x<BULL_MAN_MAZE[y].length;x+=1){
      const tile=BULL_MAN_MAZE[y][x];
      if(tile==='.') liquidity.add(key(x,y));
      if(tile==='P') powerUps.add(key(x,y));
    }
  }
  return {liquidity,powerUps};
}

function ghostChoices(ghost,player){
  const candidates=['up','down','left','right'].filter((d)=>canMove(ghost.x,ghost.y,d));
  const distance=(d)=>{const p=movePoint(ghost,d);return Math.abs(p.x-player.x)+Math.abs(p.y-player.y);};
  return {candidates,distance};
}

function chooseGhostDirection(ghost,player,tick,seed){
  const {candidates,distance}=ghostChoices(ghost,player);
  if(!candidates.length)return 'none';
  const rng=mulberry32(hash32(`${seed}:${ghost.id}:${tick}`));
  if(ghost.kind==='STOP_HUNTER') return [...candidates].sort((a,b)=>distance(a)-distance(b)||a.localeCompare(b))[0];
  if(ghost.kind==='FOMO'){
    const target=tick%12<6?player:{x:7,y:7};
    const dist=(d)=>{const p=movePoint(ghost,d);return Math.abs(p.x-target.x)+Math.abs(p.y-target.y);};
    return [...candidates].sort((a,b)=>dist(a)-dist(b)||a.localeCompare(b))[0];
  }
  if(ghost.kind==='SPREAD_SPIKE') return candidates[Math.floor(rng()*candidates.length)] || candidates[0];
  // NEWS_SHOCK is deliberately bursty: it changes route pseudo-randomly but deterministically.
  return candidates[Math.floor(rng()*candidates.length)] || candidates[0];
}

export function createBullManState(seed='wisdo'){
  const {liquidity,powerUps}=collectibleSets();
  const totalLiquidity=liquidity.size;
  return {
    version:BULL_MAN_VERSION, seed:String(seed), tick:0, status:'playing', score:0, lives:3,
    player:{x:1,y:1,direction:'right'}, desiredDirection:'right',
    ghosts:[
      {id:'stop-hunter',kind:'STOP_HUNTER',x:13,y:12,spawnX:13,spawnY:12},
      {id:'fomo',kind:'FOMO',x:7,y:8,spawnX:7,spawnY:8},
      {id:'spread-spike',kind:'SPREAD_SPIKE',x:1,y:12,spawnX:1,spawnY:12},
      {id:'news-shock',kind:'NEWS_SHOCK',x:13,y:1,spawnX:13,spawnY:1},
    ],
    liquidity,powerUps,totalLiquidity,collected:0,powerCollected:0,shieldTicks:0,hits:0,
  };
}

function resetAfterHit(state){
  state.player={x:1,y:1,direction:'right'}; state.desiredDirection='right'; state.shieldTicks=0;
  for(const ghost of state.ghosts){ghost.x=ghost.spawnX;ghost.y=ghost.spawnY;}
}

function collide(state){
  const hit=state.ghosts.some((ghost)=>ghost.x===state.player.x&&ghost.y===state.player.y);
  if(!hit)return;
  if(state.shieldTicks>0){
    state.score+=75;
    for(const ghost of state.ghosts){if(ghost.x===state.player.x&&ghost.y===state.player.y){ghost.x=ghost.spawnX;ghost.y=ghost.spawnY;}}
    return;
  }
  state.hits+=1; state.lives-=1; state.score=Math.max(0,state.score-100);
  if(state.lives<=0){state.status='lost';return;}
  resetAfterHit(state);
}

export function tickBullMan(state,input='none'){
  if(!state||state.status!=='playing')return state;
  const requested=VALID_DIRECTIONS.has(input)?input:'none';
  state.tick+=1;
  if(requested!=='none')state.desiredDirection=requested;
  let direction=state.player.direction;
  if(canMove(state.player.x,state.player.y,state.desiredDirection))direction=state.desiredDirection;
  if(!canMove(state.player.x,state.player.y,direction))direction='none';
  if(direction!=='none')state.player={...movePoint(state.player,direction),direction};

  const playerKey=key(state.player.x,state.player.y);
  if(state.liquidity.delete(playerKey)){state.collected+=1;state.score+=10;}
  if(state.powerUps.delete(playerKey)){state.powerCollected+=1;state.shieldTicks=32;state.score+=50;}
  if(state.shieldTicks>0)state.shieldTicks-=1;

  collide(state);
  if(state.status!=='playing')return state;
  // Ghosts move every other tick so navigation remains playable on touch screens.
  if(state.tick%2===0){
    for(const ghost of state.ghosts){
      const dir=chooseGhostDirection(ghost,state.player,state.tick,state.seed);
      if(dir!=='none'){const next=movePoint(ghost,dir);ghost.x=next.x;ghost.y=next.y;}
    }
    collide(state);
  }
  if(state.collected>=state.totalLiquidity){state.status='won';state.score+=500;}
  if(state.tick>=BULL_MAN_MAX_TICKS&&state.status==='playing')state.status='timeout';
  return state;
}

export function summarizeBullMan(state){
  const completion=state.totalLiquidity?state.collected/state.totalLiquidity:0;
  return Object.freeze({
    version:state.version,status:state.status,score:state.score,ticks:state.tick,lives:state.lives,hits:state.hits,
    collected:state.collected,totalLiquidity:state.totalLiquidity,powerCollected:state.powerCollected,
    completion:Number(completion.toFixed(4)),
  });
}

export function replayBullMan(seed,inputs=[]){
  const state=createBullManState(seed);
  const safe=Array.isArray(inputs)?inputs.slice(0,BULL_MAN_MAX_TICKS):[];
  for(const input of safe){tickBullMan(state,String(input||'none').toLowerCase());if(state.status!=='playing')break;}
  return summarizeBullMan(state);
}
