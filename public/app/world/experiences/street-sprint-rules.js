export const RACE_MINUTES=Object.freeze([5,15]);
export const CHECKPOINT_CAPACITY=20;
export const COINS_PER_LAP=48;

export function raceDuration(minutes){
  const value=Number(minutes);
  if(!RACE_MINUTES.includes(value))throw new RangeError('Choose a five or fifteen minute race.');
  return value*60;
}

export function collectCoin(state,amount=1){
  const n=Math.max(0,Math.min(5,Math.floor(Number(amount)||0)));
  return {...state,carried:Math.max(0,state.carried||0)+n,collected:Math.max(0,state.collected||0)+n};
}

export function depositCheckpoint(state,checkpointId,capacity=CHECKPOINT_CAPACITY){
  if(checkpointId!==state.nextCheckpoint)return{...state,deposited:0};
  const deposited=Math.min(Math.max(0,state.carried||0),Math.max(0,capacity));
  return {...state,carried:(state.carried||0)-deposited,banked:(state.banked||0)+deposited,deposited,nextCheckpoint:(checkpointId+1)%4,checkpoints:(state.checkpoints||0)+1};
}

export function applyHit(state,{perfect=false}={}){
  const carried=Math.max(0,state.carried||0);
  const lost=perfect?carried:Math.min(carried,Math.max(1,Math.ceil(carried*.18)));
  return {...state,carried:carried-lost,lost,cleanSeconds:0};
}

export function rankByBanked(rows){
  return [...rows].sort((a,b)=>(b.banked||0)-(a.banked||0)||(b.checkpoints||0)-(a.checkpoints||0)||(b.carried||0)-(a.carried||0));
}

export function seededCoins(seed=84721,count=COINS_PER_LAP){
  let s=seed>>>0;
  const random=()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296};
  return Array.from({length:count},(_,i)=>({id:i,progress:(i+.35)/count,lane:(random()-.5)*15,value:random()<.15?3:1}));
}
