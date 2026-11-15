/**
 * Small repeating tangent-space detail normals for Genesis photo surfaces.
 * These are procedurally synthesized micro-relief (not scanned geometry or
 * physically measured PBR normal maps); used only in Cinematic quality mode.
 */
const SEEDS=Object.freeze({forest:3,marsh:7,titan:11,neon:17,crystal:23,aether:29});
const TAU=Math.PI*2;
const wrap=(v)=>((v%128)+128)%128;
const height=(x,y,id)=>{
 const p=SEEDS[id]||3,X=wrap(x)*TAU/128,Y=wrap(y)*TAU/128;
 return Math.sin(X*(p%3+2)+Y*2.0)*.42+
   Math.cos(Y*(p%4+3)-X*2)*.31+
   Math.sin((X+Y)*6+p)*.15+
   Math.cos(X*12-Y*10+p)*.08;
};
export function genesisMicroNormal(x,y,biome='forest'){
 const dx=(height(x+1,y,biome)-height(x-1,y,biome))*.92;
 const dy=(height(x,y+1,biome)-height(x,y-1,biome))*.92;
 const m=Math.hypot(dx,dy,1);
 const n=[-dx/m,-dy/m,1/m];
 return n.map(v=>Math.min(255,Math.max(0,Math.round((v*.5+.5)*255))));
}
export function genesisCreateMicroBump(scene,biome){
 if(!scene||!globalThis.BABYLON?.DynamicTexture)return null;
 const texture=new BABYLON.DynamicTexture('genesis-micro-normal-'+biome,
   {width:128,height:128},scene,false);
 const ctx=texture.getContext(),data=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const rgb=genesisMicroNormal(x,y,biome),at=(y*128+x)*4;
  data.data[at]=rgb[0];data.data[at+1]=rgb[1];
  data.data[at+2]=rgb[2];data.data[at+3]=255;
 }
 ctx.putImageData(data,0,0);
 texture.update();
 texture.wrapU=BABYLON.Texture.WRAP_ADDRESSMODE;
 texture.wrapV=BABYLON.Texture.WRAP_ADDRESSMODE;
 texture.anisotropicFilteringLevel=2;
 texture.level=.28;
 return texture;
}
