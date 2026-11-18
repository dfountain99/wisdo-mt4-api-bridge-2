/** WISDO Genesis device-aware graphics levels with bounded chunk streaming. */
export const GENESIS_GRAPHICS_MODES=Object.freeze(['performance','balanced','cinematic']);
export function genesisGraphicsPreset(mode='balanced',mobile=false){
 const safe=GENESIS_GRAPHICS_MODES.includes(mode)?mode:'balanced';
 const specs={
   performance:{subdivisions:mobile?10:12,trees:mobile?9:16,decorations:mobile?55:95,scale:mobile?1.75:1.45,shadows:false},
   balanced:{subdivisions:mobile?14:20,trees:mobile?15:27,decorations:mobile?115:195,scale:mobile?1.35:1.14,shadows:true},
   cinematic:{subdivisions:mobile?24:32,trees:mobile?24:42,decorations:mobile?210:340,scale:mobile?1.08:1,shadows:true},
 };
 return Object.freeze({...specs[safe],mode:safe,mobile:Boolean(mobile)});
}
