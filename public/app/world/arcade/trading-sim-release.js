import * as core from './trading-sim-core.js';

export const TRADING_SIM_VERSION=core.TRADING_SIM_VERSION;
export const TRADING_SIM_TICK_MS=core.TRADING_SIM_TICK_MS;
export const TRADING_SIM_MAX_TICKS=core.TRADING_SIM_MAX_TICKS;
export const TRADING_BUILD_RANGE=core.TRADING_BUILD_RANGE;
export const TRADING_GAME_ROWS=core.TRADING_GAME_ROWS;
export const TRADING_GAME_DEFS=core.TRADING_GAME_DEFS;
export const createTradingState=core.createTradingState;
export const summarizeTradingState=core.summarizeTradingState;
export const getTradingGameDef=core.getTradingGameDef;
export const tradingGameIds=core.tradingGameIds;
export const tradingGameCatalog=core.tradingGameCatalog;

const CONTROL_ALIASES=Object.freeze({
  stoptight:'tight',
  stopatr:'atr',
  stopstructure:'structure',
  modemarket:'market',
  modelimit:'limit',
});

function canonical(input){return String(input||'hold').trim().toLowerCase();}

export function tickTradingGame(state,input='hold'){
  const action=canonical(input);
  const control=CONTROL_ALIASES[action];
  if(control){
    if(action.startsWith('stop'))state.stopMode=control;
    else state.executionMode=control;
    return core.tickTradingGame(state,'hold');
  }
  return core.tickTradingGame(state,action);
}

export function replayTradingGame(gameId,seed,inputs=[]){
  const state=core.createTradingState(gameId,seed);
  const list=Array.isArray(inputs)?inputs.slice(0,core.TRADING_SIM_MAX_TICKS):[];
  for(const input of list){
    if(state.status!=='playing')break;
    tickTradingGame(state,input);
  }
  return core.summarizeTradingState(state);
}

export function tradingSimulationCapabilities(){
  const base=core.tradingSimulationCapabilities();
  const actions=[...new Set(base.actions.flatMap((item)=>{const raw=String(item),lower=raw.toLowerCase();return raw===lower?[lower]:[lower,raw];}))];
  return Object.freeze({...base,actions:Object.freeze(actions),canonicalControls:Object.freeze(['stoptight','stopatr','stopstructure','modemarket','modelimit'])});
}
