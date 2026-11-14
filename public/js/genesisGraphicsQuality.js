/** WISDO Genesis device-aware graphics levels with bounded chunk streaming. */
export const GENESIS_GRAPHICS_MODES=Object.freeze(['performance','balanced','cinematic']);
export function genesisGraphicsPreset(mode='balanced',mobile=false){
 const safe=GENESIS_GRAPHICS_MODES.includes(mode)?mode:'balanced';
 const specs={
   performance:{subdivisions:mobile?10:12,trees:mobile?4:8,decorations:mobile?22:42,scale:mobile?1.75:1.45,shadows:false},
   balanced:{subdivisions:mobile?14:20,trees:mobile?7:13,decorations:mobile?50:85,scale:mobile?1.35:1.14,shadows:!mobile},
   cinematic:{subdivisions:mobile?24:32,trees:mobile?16:24,decorations:mobile?110:175,scale:mobile?1.08:1,shadows:true},
 };
 return Object.freeze({...specs[safe],mode:safe,mobile:Boolean(mobile)});
}
