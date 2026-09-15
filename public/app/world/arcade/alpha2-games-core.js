export const ALPHA2_VERSION='2.0.0';

export const ALPHA2_GAME_DEFS=Object.freeze({
  'liquidity-ghosts':Object.freeze({
    id:'liquidity-ghosts',name:'Liquidity Ghosts',version:'2.0.0-liquidity',tickMs:135,maxTicks:720,minTicks:40,
    controls:'MOVE',objective:'Collect 24 liquidity nodes while surviving four market-behavior ghosts.',
    lessons:Object.freeze([
      Object.freeze({prompt:'What is the safer response after price sweeps an obvious high or low?',choices:Object.freeze(['Chase immediately','Wait for acceptance or rejection confirmation','Double size because liquidity moved']),lesson:'A sweep is information, not automatic permission. Wait for confirmation.'}),
      Object.freeze({prompt:'What does sudden spread expansion change first?',choices:Object.freeze(['Execution cost and fill quality','The higher-timeframe trend','Your account password']),lesson:'Spread is an execution cost. It can make an otherwise valid setup unattractive.'}),
      Object.freeze({prompt:'What is the FOMO ghost designed to punish?',choices:Object.freeze(['Waiting for confirmation','Chasing after price has already expanded','Using a predefined stop']),lesson:'Missing a move is cheaper than forcing a late entry.'}),
    ]),
  }),
  'breakout-breaker':Object.freeze({
    id:'breakout-breaker',name:'Breakout Breaker',version:'2.0.0-breakout',tickMs:55,maxTicks:1800,minTicks:80,
    controls:'PADDLE',objective:'Break structure bricks, protect the ball, and distinguish confirmed breaks from false breaks.',
    lessons:Object.freeze([
      Object.freeze({prompt:'What strengthens a breakout?',choices:Object.freeze(['A close beyond the level with acceptance','A single wick through the level','Entering before price reaches the level']),lesson:'A wick can be a sweep. Acceptance beyond structure is stronger evidence.'}),
      Object.freeze({prompt:'Why is a retest useful after a breakout?',choices:Object.freeze(['It proves every trade will win','It can show the broken level is accepting its new role','It removes all slippage']),lesson:'A retest can confirm that old resistance became support, or old support became resistance.'}),
      Object.freeze({prompt:'What is a false breakout?',choices:Object.freeze(['Price breaks and holds beyond structure','Price briefly breaches a level then returns inside','Any candle with a large body']),lesson:'Failed acceptance beyond a level is a core false-breakout clue.'}),
    ]),
  }),
  'risk-runner':Object.freeze({
    id:'risk-runner',name:'Risk Runner',version:'2.0.0-risk',tickMs:90,maxTicks:650,minTicks:60,
    controls:'LANES',objective:'Choose the survivable risk lane at each gate and protect account equity.',
    lessons:Object.freeze([
      Object.freeze({prompt:'For a small account, what usually improves survival?',choices:Object.freeze(['Consistent predefined risk','Random lot size increases','Using all available margin']),lesson:'Consistent predefined risk keeps one mistake from becoming an account-ending event.'}),
      Object.freeze({prompt:'If stop distance gets wider while risk dollars stay fixed, position size should usually…',choices:Object.freeze(['Increase','Decrease','Stay identical']),lesson:'Wider stops require smaller size when the amount at risk stays fixed.'}),
      Object.freeze({prompt:'What should determine position size?',choices:Object.freeze(['How badly you want the trade to win','Account risk and stop distance','The last trade result only']),lesson:'Position size should come from a risk model, not emotion or revenge.'}),
    ]),
  }),
  'fomo-frogger':Object.freeze({
    id:'fomo-frogger',name:'FOMO Frogger',version:'2.0.0-fomo',tickMs:120,maxTicks:1000,minTicks:60,
    controls:'CROSS',objective:'Cross three market roads without chasing into moving candle traffic.',
    lessons:Object.freeze([
      Object.freeze({prompt:'Price has already expanded far from your planned entry. What is the disciplined choice?',choices:Object.freeze(['Chase it immediately','Wait for a new setup or let it go','Triple size to make up the distance']),lesson:'A missed trade is not a loss. Chasing changes the original risk/reward.'}),
      Object.freeze({prompt:'What does confirmation help you avoid?',choices:Object.freeze(['Every losing trade','Entering directly into an unproven move','Using a trading plan']),lesson:'Confirmation reduces impulsive entries into moves that have not proven acceptance.'}),
      Object.freeze({prompt:'If the setup never returns, what should happen?',choices:Object.freeze(['Force a trade anyway','Accept no trade and wait for the next opportunity','Remove the stop loss']),lesson:'No trade is a valid outcome. Discipline includes doing nothing.'}),
    ]),
  }),
});

const DIRS=Object.freeze({up:[0,-1],down:[0,1],left:[-1,0],right:[1,0],hold:[0,0]});
const GHOST_KINDS=Object.freeze(['STOP_HUNTER','FOMO','SPREAD_SPIKE','NEWS_SHOCK']);

function seedNumber(seed){let h=2166136261>>>0;for(const ch of String(seed)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h||1;}
function rand(state){let t=(state.rng+=0x6D2B79F5)>>>0;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function normalize(input){const key=String(input||'hold').toLowerCase();return DIRS[key]?key:'hold';}
function same(a,b){return a.x===b.x&&a.y===b.y;}
function shuffled(state,values){const out=[...values];for(let i=out.length-1;i>0;i-=1){const j=Math.floor(rand(state)*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}

function createLiquidity(seed){
  const state={gameId:'liquidity-ghosts',rng:seedNumber(seed),ticks:0,status:'playing',score:0,lives:3,hits:0,mistakes:0,collected:0,total:24,spawned:0,shieldTicks:12,player:{x:7,y:5},orbs:[],ghosts:[],lastInput:'hold'};
  const starts=[[1,1],[13,1],[1,9],[13,9]];
  state.ghosts=GHOST_KINDS.map((kind,index)=>({kind,x:starts[index][0],y:starts[index][1]}));
  for(let i=0;i<7;i+=1)spawnLiquidity(state);
  return state;
}
function spawnLiquidity(state){
  if(state.spawned>=state.total)return;
  for(let tries=0;tries<30;tries+=1){const x=1+Math.floor(rand(state)*13),y=1+Math.floor(rand(state)*9);if((x===7&&y===5)||state.orbs.some((o)=>o.x===x&&o.y===y))continue;state.orbs.push({x,y,power:state.spawned>0&&state.spawned%7===0});state.spawned+=1;return;}
}
function moveGhost(state,ghost,index){
  let dx=0,dy=0;
  if(ghost.kind==='SPREAD_SPIKE'){const d=Object.values(DIRS)[Math.floor(rand(state)*4)];[dx,dy]=d;}
  else{
    const xGap=state.player.x-ghost.x,yGap=state.player.y-ghost.y;
    if(ghost.kind==='FOMO'&&state.lastInput!=='hold'){const d=DIRS[state.lastInput]||[0,0];dx=d[0];dy=d[1];}
    else if(Math.abs(xGap)>Math.abs(yGap)){dx=Math.sign(xGap);}else{dy=Math.sign(yGap);}
    if(ghost.kind==='NEWS_SHOCK'&&state.ticks%12===0){dx*=2;dy*=2;}
  }
  ghost.x=clamp(ghost.x+dx,0,14);ghost.y=clamp(ghost.y+dy,0,10);
  if(index===0&&state.ticks%9===0&&rand(state)<.35){ghost.x=clamp(ghost.x+Math.sign(state.player.x-ghost.x),0,14);}
}
function tickLiquidity(state,input){
  const action=normalize(input),d=DIRS[action];state.ticks+=1;state.lastInput=action;
  state.player.x=clamp(state.player.x+d[0],0,14);state.player.y=clamp(state.player.y+d[1],0,10);
  const orbIndex=state.orbs.findIndex((o)=>same(o,state.player));
  if(orbIndex>=0){const [orb]=state.orbs.splice(orbIndex,1);state.collected+=1;state.score+=orb.power?140:55;if(orb.power)state.shieldTicks=45;if(state.spawned<state.total)spawnLiquidity(state);}
  if(state.shieldTicks>0)state.shieldTicks-=1;
  state.ghosts.forEach((ghost,index)=>{const pace=ghost.kind==='NEWS_SHOCK'?2:ghost.kind==='SPREAD_SPIKE'?3:2;if(state.ticks%pace===0)moveGhost(state,ghost,index);});
  if(state.shieldTicks<=0&&state.ghosts.some((g)=>same(g,state.player))){state.hits+=1;state.lives-=1;state.score=Math.max(0,state.score-90);state.player={x:7,y:5};state.shieldTicks=14;}
  if(state.collected>=state.total)state.status='won';else if(state.lives<=0)state.status='lost';else if(state.ticks>=ALPHA2_GAME_DEFS['liquidity-ghosts'].maxTicks)state.status='timeout';
  return state;
}

function createBreakout(seed){
  const state={gameId:'breakout-breaker',rng:seedNumber(seed),ticks:0,status:'playing',score:0,lives:3,hits:0,mistakes:0,broken:0,confirmedBroken:0,falseBroken:0,paddleX:50,paddleWidth:22,ball:{x:50,y:78,vx:1.25,vy:-1.55},bricks:[]};
  for(let row=0;row<6;row+=1){for(let col=0;col<8;col+=1){state.bricks.push({x:6+col*11.2,y:7+row*6.5,w:9.5,h:4.4,confirmed:rand(state)>.24,broken:false});}}
  return state;
}
function resetBall(state){state.ball.x=state.paddleX;state.ball.y=78;state.ball.vx=(rand(state)>.5?1:-1)*(1.1+rand(state)*.55);state.ball.vy=-(1.45+rand(state)*.35);}
function tickBreakout(state,input){
  const action=normalize(input);state.ticks+=1;
  if(action==='left')state.paddleX=clamp(state.paddleX-2.8,state.paddleWidth/2,100-state.paddleWidth/2);
  if(action==='right')state.paddleX=clamp(state.paddleX+2.8,state.paddleWidth/2,100-state.paddleWidth/2);
  const b=state.ball;b.x+=b.vx;b.y+=b.vy;
  if(b.x<=1||b.x>=99){b.x=clamp(b.x,1,99);b.vx*=-1;}if(b.y<=1){b.y=1;b.vy=Math.abs(b.vy);}
  if(b.vy>0&&b.y>=84&&b.y<=88&&Math.abs(b.x-state.paddleX)<=state.paddleWidth/2){b.y=83.5;b.vy=-Math.abs(b.vy);b.vx=clamp(b.vx+(b.x-state.paddleX)*.035,-2.4,2.4);}
  const hit=state.bricks.find((brick)=>!brick.broken&&b.x>=brick.x&&b.x<=brick.x+brick.w&&b.y>=brick.y&&b.y<=brick.y+brick.h);
  if(hit){hit.broken=true;state.broken+=1;b.vy*=-1;if(hit.confirmed){state.confirmedBroken+=1;state.score+=65;}else{state.falseBroken+=1;state.mistakes+=1;state.score=Math.max(0,state.score-30);}}
  if(b.y>101){state.hits+=1;state.lives-=1;state.score=Math.max(0,state.score-75);resetBall(state);}
  if(state.broken>=state.bricks.length)state.status='won';else if(state.lives<=0)state.status='lost';else if(state.ticks>=ALPHA2_GAME_DEFS['breakout-breaker'].maxTicks)state.status='timeout';
  return state;
}

function newRiskGate(state){
  const safe=rand(state)>.5?1:2,medium=3+Math.floor(rand(state)*2),high=6+Math.floor(rand(state)*5);
  state.gate={choices:shuffled(state,[safe,medium,high]),age:0};
}
function createRisk(seed){const state={gameId:'risk-runner',rng:seedNumber(seed),ticks:0,status:'playing',score:0,lives:1,hits:0,mistakes:0,successes:0,gates:0,targetGates:18,lane:1,equity:100,gate:null};newRiskGate(state);return state;}
function tickRisk(state,input){
  const action=normalize(input);state.ticks+=1;if(action==='up')state.lane=clamp(state.lane-1,0,2);if(action==='down')state.lane=clamp(state.lane+1,0,2);state.gate.age+=1;
  if(state.gate.age>=30){const risk=state.gate.choices[state.lane];state.gates+=1;if(risk<=2){state.successes+=1;state.score+=110;state.equity=Math.min(100,state.equity+1.5);}else{state.hits+=1;state.mistakes+=1;state.equity=Math.max(0,state.equity-risk*1.8);state.score=Math.max(0,state.score-35);}if(state.gates>=state.targetGates)state.status='won';else if(state.equity<45)state.status='lost';else newRiskGate(state);}
  if(state.ticks>=ALPHA2_GAME_DEFS['risk-runner'].maxTicks&&state.status==='playing')state.status='timeout';return state;
}

function createFrogger(seed){
  const state={gameId:'fomo-frogger',rng:seedNumber(seed),ticks:0,status:'playing',score:0,lives:3,hits:0,mistakes:0,crossings:0,targetCrossings:3,player:{x:4,y:9},moveCooldown:0,shieldTicks:6,lanes:[]};
  for(let y=1;y<=8;y+=1){const dir=y%2===0?1:-1,period=2+Math.floor(rand(state)*4),cars=[];const start=Math.floor(rand(state)*9);for(let i=0;i<3;i+=1)cars.push((start+i*3)%9);state.lanes.push({y,dir,period,cars});}
  return state;
}
function frogCollision(state){const lane=state.lanes.find((l)=>l.y===state.player.y);return Boolean(lane&&lane.cars.includes(state.player.x));}
function tickFrogger(state,input){
  const action=normalize(input);state.ticks+=1;if(state.moveCooldown>0)state.moveCooldown-=1;if(state.shieldTicks>0)state.shieldTicks-=1;
  if(state.moveCooldown===0&&action!=='hold'){const d=DIRS[action];state.player.x=clamp(state.player.x+d[0],0,8);state.player.y=clamp(state.player.y+d[1],0,9);state.moveCooldown=2;}
  for(const lane of state.lanes){if(state.ticks%lane.period===0)lane.cars=lane.cars.map((x)=>(x+lane.dir+9)%9);}
  if(state.player.y===0){state.crossings+=1;state.score+=320;state.player={x:4,y:9};state.shieldTicks=5;if(state.crossings>=state.targetCrossings)state.status='won';}
  else if(state.shieldTicks<=0&&frogCollision(state)){state.hits+=1;state.mistakes+=1;state.lives-=1;state.score=Math.max(0,state.score-80);state.player={x:4,y:9};state.shieldTicks=7;}
  else if(action==='up'&&state.player.y<9)state.score+=2;
  if(state.lives<=0)state.status='lost';else if(state.ticks>=ALPHA2_GAME_DEFS['fomo-frogger'].maxTicks&&state.status==='playing')state.status='timeout';return state;
}

export function getAlpha2GameDef(gameId){return ALPHA2_GAME_DEFS[String(gameId||'')]||null;}
export function createAlpha2State(gameId,seed){switch(gameId){case'liquidity-ghosts':return createLiquidity(seed);case'breakout-breaker':return createBreakout(seed);case'risk-runner':return createRisk(seed);case'fomo-frogger':return createFrogger(seed);default:throw new Error('Unknown Alpha 2 arcade game.');}}
export function tickAlpha2Game(gameId,state,input='hold'){if(!state||state.status!=='playing')return state;switch(gameId){case'liquidity-ghosts':return tickLiquidity(state,input);case'breakout-breaker':return tickBreakout(state,input);case'risk-runner':return tickRisk(state,input);case'fomo-frogger':return tickFrogger(state,input);default:throw new Error('Unknown Alpha 2 arcade game.');}}
export function summarizeAlpha2(gameId,state){
  if(gameId==='liquidity-ghosts')return{gameId,status:state.status,ticks:state.ticks,score:state.score,lives:state.lives,hits:state.hits,mistakes:state.mistakes,successes:state.collected,completion:clamp(state.collected/state.total,0,1),collected:state.collected,total:state.total};
  if(gameId==='breakout-breaker')return{gameId,status:state.status,ticks:state.ticks,score:state.score,lives:state.lives,hits:state.hits,mistakes:state.mistakes,successes:state.confirmedBroken,completion:clamp(state.broken/state.bricks.length,0,1),broken:state.broken,confirmedBroken:state.confirmedBroken,falseBroken:state.falseBroken};
  if(gameId==='risk-runner')return{gameId,status:state.status,ticks:state.ticks,score:state.score,lives:state.equity>=45?1:0,hits:state.hits,mistakes:state.mistakes,successes:state.successes,completion:clamp(state.gates/state.targetGates,0,1),gates:state.gates,equity:Number(state.equity.toFixed(2))};
  if(gameId==='fomo-frogger')return{gameId,status:state.status,ticks:state.ticks,score:state.score,lives:state.lives,hits:state.hits,mistakes:state.mistakes,successes:state.crossings,completion:clamp(state.crossings/state.targetCrossings,0,1),crossings:state.crossings};
  throw new Error('Unknown Alpha 2 arcade game.');
}
export function replayAlpha2Game(gameId,seed,inputs=[]){const def=getAlpha2GameDef(gameId);if(!def)throw new Error('Unknown Alpha 2 arcade game.');const state=createAlpha2State(gameId,seed);for(const input of inputs.slice(0,def.maxTicks)){tickAlpha2Game(gameId,state,input);if(state.status!=='playing')break;}return summarizeAlpha2(gameId,state);}
