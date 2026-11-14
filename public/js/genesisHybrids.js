/**
 * WISDO Genesis hybrid fauna & PRISM resonance contract.
 * Shared by the authoritative server and browser renderer.
 * Creature IDs and spawn coordinates are immutable saved-game identifiers.
 */
export const HYBRID_POWER_KINDS=Object.freeze(['surge','ward','harvest','mining','insight']);
export const GENESIS_HYBRIDS=Object.freeze([
  {id:"thornwolf",name:"Thornwolf",biome:'forest',x:-92,z:80,hybrid:"wolf × stag × living vines",silhouette:'horned',description:"wolf × stag × living vines — Rootsprint resonance.",color:'#75dfa1',cost:{"wood":3,"moonleaf":1},bonus:{"speed":26,"agility":8},power:{id:'thornwolf-power',name:"Rootsprint",kind:'surge',durationMs:15000,cooldownMs:90000}},
  {id:"mossgriffin",name:"Mossgriffin",biome:'forest',x:145,z:-75,hybrid:"lynx × owl × forest moss",silhouette:'winged',description:"lynx × owl × forest moss — Canopy Sight resonance.",color:'#9bde8d',cost:{"wood":4,"crystal":1},bonus:{"intelligence":22,"agility":10},power:{id:'mossgriffin-power',name:"Canopy Sight",kind:'insight',durationMs:18000,cooldownMs:80000}},
  {id:"verdant-raptor",name:"Verdant Raptor",biome:'forest',x:245,z:155,hybrid:"raptor × hummingbird × thorn fern",silhouette:'raptor',description:"raptor × hummingbird × thorn fern — Life Bloom resonance.",color:'#4dda87',cost:{"wood":5,"stone":2},bonus:{"energy":16,"agility":16},power:{id:'verdant-raptor-power',name:"Life Bloom",kind:'harvest',durationMs:20000,cooldownMs:110000}},
  {id:"volt-manticore",name:"Volt Manticore",biome:'neon',x:760,z:-355,hybrid:"panther × scorpion × lightning ray",silhouette:'feline',description:"panther × scorpion × lightning ray — Volt Rush resonance.",color:'#61edff',cost:{"circuit":4,"iron":2},bonus:{"speed":27,"energy":12},power:{id:'volt-manticore-power',name:"Volt Rush",kind:'surge',durationMs:15000,cooldownMs:90000}},
  {id:"holo-jackal",name:"Holo Jackal",biome:'neon',x:960,z:-155,hybrid:"jackal × prism fox × hologram",silhouette:'horned',description:"jackal × prism fox × hologram — Signal Scan resonance.",color:'#8ea5ff',cost:{"circuit":5,"crystal":2},bonus:{"intelligence":26,"speed":11},power:{id:'holo-jackal-power',name:"Signal Scan",kind:'insight',durationMs:18000,cooldownMs:80000}},
  {id:"arc-serpent",name:"Arc Serpent",biome:'neon',x:1050,z:-355,hybrid:"serpent × eel × drone",silhouette:'serpent',description:"serpent × eel × drone — Ion Extraction resonance.",color:'#53d9ff',cost:{"circuit":5,"iron":3},bonus:{"energy":28,"intelligence":8},power:{id:'arc-serpent-power',name:"Ion Extraction",kind:'mining',durationMs:20000,cooldownMs:110000}},
  {id:"obsidian-basilisk",name:"Obsidian Basilisk",biome:'titan',x:740,z:900,hybrid:"basilisk × armadillo × volcanic rock",silhouette:'armored',description:"basilisk × armadillo × volcanic rock — Basalt Ward resonance.",color:'#ef9454',cost:{"obsidian":5,"iron":2},bonus:{"defense":28,"strength":14},power:{id:'obsidian-basilisk-power',name:"Basalt Ward",kind:'ward',durationMs:22000,cooldownMs:100000}},
  {id:"magma-beetle",name:"Magma Beetle",biome:'titan',x:650,z:810,hybrid:"rhinoceros beetle × tortoise × molten crystal",silhouette:'armored',description:"rhinoceros beetle × tortoise × molten crystal — Molten Drill resonance.",color:'#ff8053',cost:{"obsidian":5,"stone":6},bonus:{"strength":25,"defense":13},power:{id:'magma-beetle-power',name:"Molten Drill",kind:'mining',durationMs:20000,cooldownMs:110000}},
  {id:"cinderhorn",name:"Cinderhorn Behemoth",biome:'titan',x:930,z:800,hybrid:"bison × dragon × obsidian antlers",silhouette:'horned',description:"bison × dragon × obsidian antlers — Titan Charge resonance.",color:'#ffc06e',cost:{"stone":7,"obsidian":4},bonus:{"strength":30,"speed":13},power:{id:'cinderhorn-power',name:"Titan Charge",kind:'surge',durationMs:15000,cooldownMs:90000}},
  {id:"skydrift-chimera",name:"Skydrift Chimera",biome:'aether',x:-900,z:-500,hybrid:"griffin × manta ray × cloud stag",silhouette:'winged',description:"griffin × manta ray × cloud stag — Sky Drift resonance.",color:'#bbd3ff',cost:{"aether_shard":5,"crystal":2},bonus:{"agility":26,"speed":18},power:{id:'skydrift-chimera-power',name:"Sky Drift",kind:'surge',durationMs:15000,cooldownMs:90000}},
  {id:"cloud-seraph",name:"Cloud Seraph",biome:'aether',x:-690,z:-780,hybrid:"snow owl × jellyfish × aurora",silhouette:'winged',description:"snow owl × jellyfish × aurora — Aurora Shield resonance.",color:'#d1baff',cost:{"aether_shard":5,"moonleaf":2},bonus:{"defense":19,"energy":27},power:{id:'cloud-seraph-power',name:"Aurora Shield",kind:'ward',durationMs:22000,cooldownMs:100000}},
  {id:"storm-wyrm",name:"Storm Wyrm",biome:'aether',x:-1120,z:-820,hybrid:"dragon × eel × sky whale",silhouette:'serpent',description:"dragon × eel × sky whale — Tempest Sense resonance.",color:'#a6b5ff',cost:{"aether_shard":6,"crystal":3},bonus:{"energy":24,"intelligence":18},power:{id:'storm-wyrm-power',name:"Tempest Sense",kind:'insight',durationMs:18000,cooldownMs:80000}},
  {id:"prism-kitsune",name:"Prismatic Kitsune",biome:'crystal',x:-500,z:310,hybrid:"fox × crystal stag × butterfly",silhouette:'feline',description:"fox × crystal stag × butterfly — Prism Vision resonance.",color:'#78f9fa',cost:{"crystal":6,"aether_shard":2},bonus:{"intelligence":26,"agility":13},power:{id:'prism-kitsune-power',name:"Prism Vision",kind:'insight',durationMs:18000,cooldownMs:80000}},
  {id:"quartz-leviathan",name:"Quartz Leviathan",biome:'crystal',x:-700,z:600,hybrid:"sea dragon × manta ray × quartz",silhouette:'serpent',description:"sea dragon × manta ray × quartz — Crystal Harvest resonance.",color:'#8aefdf',cost:{"crystal":7,"iron":2},bonus:{"defense":16,"energy":24},power:{id:'quartz-leviathan-power',name:"Crystal Harvest",kind:'mining',durationMs:20000,cooldownMs:110000}},
  {id:"echo-moth",name:"Echo Moth",biome:'crystal',x:-460,z:570,hybrid:"moth × deer × glass-wing wasp",silhouette:'winged',description:"moth × deer × glass-wing wasp — Echo Renewal resonance.",color:'#9aeeff',cost:{"crystal":5,"moonleaf":3},bonus:{"intelligence":18,"energy":21},power:{id:'echo-moth-power',name:"Echo Renewal",kind:'harvest',durationMs:20000,cooldownMs:110000}},
  {id:"mire-hydra",name:"Mire Hydra",biome:'marsh',x:-430,z:1180,hybrid:"hydra × crocodile × mangrove",silhouette:'serpent',description:"hydra × crocodile × mangrove — Swamp Ward resonance.",color:'#78cca2',cost:{"moonleaf":6,"wood":4},bonus:{"defense":25,"agility":12},power:{id:'mire-hydra-power',name:"Swamp Ward",kind:'ward',durationMs:22000,cooldownMs:100000}},
  {id:"moonfang-otter",name:"Moonfang Otter",biome:'marsh',x:-600,z:1010,hybrid:"river otter × wolf × moonlit fern",silhouette:'feline',description:"river otter × wolf × moonlit fern — Moonleaf Bloom resonance.",color:'#acf3aa',cost:{"moonleaf":8,"wood":4},bonus:{"agility":22,"energy":17},power:{id:'moonfang-otter-power',name:"Moonleaf Bloom",kind:'harvest',durationMs:20000,cooldownMs:110000}},
  {id:"bog-phoenix",name:"Bog Phoenix",biome:'marsh',x:-320,z:980,hybrid:"heron × firefly × marsh phoenix",silhouette:'winged',description:"heron × firefly × marsh phoenix — Boglight Sense resonance.",color:'#b4ef78',cost:{"moonleaf":8,"crystal":3},bonus:{"energy":25,"intelligence":19},power:{id:'bog-phoenix-power',name:"Boglight Sense",kind:'insight',durationMs:18000,cooldownMs:80000}},
].map(entry=>Object.freeze({...entry,power:Object.freeze(entry.power)})));
export function hybridById(id){return GENESIS_HYBRIDS.find(entry=>entry.id===id)||null;}
export function activeResonance(profile,now=Date.now()){
 const active=profile?.activeResonance;
 if(!active||!Number.isFinite(active.expiresAt)||active.expiresAt<=now)return null;
 if(profile?.character?.equipped!==active.form)return null;
 const creature=hybridById(active.form);
 if(!creature||creature.power.kind!==active.kind)return null;
 return {...active,creature,power:creature.power};
}
export function resonanceHarvestBonus(profile,type,now=Date.now()){
 const active=activeResonance(profile,now);
 if(!active)return 0;
 const good=active.kind==='harvest'?['wood','moonleaf'].includes(type):
   active.kind==='mining'?['stone','iron','obsidian','crystal','circuit','aether_shard'].includes(type):false;
 return good?1:0;
}
export function resonanceScanDistance(profile,now=Date.now()){
 return activeResonance(profile,now)?.kind==='insight'?12:6;
}
export function resonanceStatBonus(profile,key,now=Date.now()){
 const active=activeResonance(profile,now);
 if(!active)return 0;
 if(active.kind==='surge')return key==='speed'?22:key==='agility'?8:0;
 if(active.kind==='ward')return key==='defense'?28:key==='energy'?7:0;
 return 0;
}
