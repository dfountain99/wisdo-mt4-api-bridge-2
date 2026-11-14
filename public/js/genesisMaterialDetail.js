/**
 * Lightweight wood detail for the Babylon renderer.
 * Baked once per scene; visible grain and plank seams without network assets.
 */
export function applyGenesisWoodDetail(scene,mats){
 if(!scene||!globalThis.BABYLON||!mats?.wood)return null;
 const texture=new BABYLON.DynamicTexture('genesis-weathered-wood-grain',
   {width:256,height:256},scene,true);
 const ctx=texture.getContext();
 ctx.fillStyle='#bd9871';ctx.fillRect(0,0,256,256);
 let seed=9180;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
 // Three boards with narrow seams, knots and many fine grain fibers.
 for(let board=0;board<4;board++){
  const start=board*64;
  ctx.fillStyle=board%2?'#cda47e':'#b99067';
  ctx.fillRect(start+2,0,61,256);
  ctx.fillStyle='#493c31';ctx.fillRect(start,0,2,256);
  ctx.fillStyle='#e4c6a0';ctx.fillRect(start+3,0,2,256);
  for(let i=0;i<120;i++){
   const x=start+5+rnd()*55,y=rnd()*256;
   const len=15+rnd()*85;
   ctx.strokeStyle=rnd()>.45?'rgba(55,34,20,.22)':'rgba(255,220,169,.32)';
   ctx.lineWidth=.4+rnd()*.7;
   ctx.beginPath();ctx.moveTo(x,y);
   ctx.bezierCurveTo(x+2+rnd()*4,y+len*.25,x-2-rnd()*4,y+len*.66,x,y+len);
   ctx.stroke();
  }
  const cx=start+19+rnd()*28,cy=30+rnd()*190;
  ctx.strokeStyle='rgba(71,43,27,.48)';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.ellipse(cx,cy,6,13,.16,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='rgba(57,35,22,.35)';
  ctx.beginPath();ctx.ellipse(cx,cy,2.2,5,.16,0,Math.PI*2);ctx.fill();
 }
 texture.update();texture.wrapU=BABYLON.Texture.WRAP_ADDRESSMODE;
 texture.wrapV=BABYLON.Texture.WRAP_ADDRESSMODE;
 texture.anisotropicFilteringLevel=4;
 mats.wood.diffuseTexture=texture;
 mats.wood.diffuseColor=new BABYLON.Color3(.97,.91,.84);
 mats.wood.specularColor=new BABYLON.Color3(.06,.055,.04);
 mats.roof.diffuseTexture=texture;
 mats.roof.diffuseColor=new BABYLON.Color3(.68,.77,.81);
 mats.roof.specularColor=new BABYLON.Color3(.03,.035,.038);
 return texture;
}
