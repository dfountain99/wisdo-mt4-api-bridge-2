export const RANK_ORDER = Object.freeze(['UNRANKED','BRONZE','SILVER','GOLD','PLATINUM','DIAMOND','ELITE','CROWN','HIGHTOWER']);

export const RANK_ASCENSION = Object.freeze({
  UNRANKED:{title:'INITIATE',character:'VEIL',level:1,primary:'#55cfff',secondary:'#173d78',accent:'#b7f3ff',perks:['Core Access','Campaign Vision','Live Truth']},
  BRONZE:{title:'SCOUT',character:'PULSE',level:2,primary:'#48dcff',secondary:'#124f85',accent:'#b7f7ff',perks:['Signal Trace','Entry Orbit','Focus Theme']},
  SILVER:{title:'TRADER',character:'FORGE',level:3,primary:'#72cfff',secondary:'#c2d6e7',accent:'#f3fbff',perks:['Trade Orbit','Precision HUD','Silver Aura']},
  GOLD:{title:'SENTINEL',character:'AEGIS',level:4,primary:'#f1c85b',secondary:'#2d8fd3',accent:'#fff0a6',perks:['Protection Shield','Gold Graffiti','Sentinel Theme']},
  PLATINUM:{title:'APEX RUNNER',character:'NYX',level:5,primary:'#49cfff',secondary:'#f0bd43',accent:'#fff1a6',perks:['Apex Chamber','Advanced Protection','Elite Theme FX']},
  DIAMOND:{title:'SIGNAL MONARCH',character:'SOLACE',level:6,primary:'#9f8cff',secondary:'#f5cb62',accent:'#efeaff',perks:['Royal Signal Aura','Diamond Trails','Monarch Frame']},
  ELITE:{title:'VAULT WARDEN',character:'KAIRO',level:7,primary:'#4ce6bd',secondary:'#e8bd51',accent:'#baffea',perks:['Vault Shield','Elite Orbit','Warden Victory FX']},
  CROWN:{title:'CROWN OPERATOR',character:'ORION',level:8,primary:'#ffd86a',secondary:'#3aaeff',accent:'#fff6c7',perks:['Crown Halo','Royal Gold Rain','Crown Interface']},
  HIGHTOWER:{title:'CULTURE KING',character:'SOVEREIGN',level:9,primary:'#fff2b0',secondary:'#4fcaff',accent:'#ffffff',perks:['Sovereign Form','Hightower Aura','Legacy Ascension']}
});

export function rankVisual(key='UNRANKED'){ return RANK_ASCENSION[String(key||'UNRANKED').toUpperCase()] || RANK_ASCENSION.UNRANKED; }
export function rankIndex(key='UNRANKED'){ const i=RANK_ORDER.indexOf(String(key||'UNRANKED').toUpperCase()); return i < 0 ? 0 : i; }
export function rankEvolution(){ return RANK_ORDER.map(key=>({key,...rankVisual(key)})); }
