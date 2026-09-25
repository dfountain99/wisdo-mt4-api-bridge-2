const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

function seeded(seed=1){
  let state=(seed>>>0)||1;
  return ()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
}

function makeCanvas(size=512){
  const canvas=document.createElement('canvas');
  canvas.width=size;canvas.height=size;
  return {canvas,ctx:canvas.getContext('2d',{alpha:false})};
}

function repeatTexture(THREE,canvas,repeatX,repeatY,{color=true,anisotropy=4}={}){
  const texture=new THREE.CanvasTexture(canvas);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(repeatX,repeatY);
  texture.anisotropy=anisotropy;
  if(color) texture.colorSpace=THREE.SRGBColorSpace;
  texture.needsUpdate=true;
  return texture;
}

function asphaltCanvas(size=512,seed=11){
  const {canvas,ctx}=makeCanvas(size);const rand=seeded(seed);
  ctx.fillStyle='#414b55';ctx.fillRect(0,0,size,size);
  const image=ctx.getImageData(0,0,size,size);const data=image.data;
  for(let i=0;i<data.length;i+=4){const n=(rand()-.5)*24;data[i]=clamp(data[i]+n,0,255);data[i+1]=clamp(data[i+1]+n,0,255);data[i+2]=clamp(data[i+2]+n,0,255);}
  ctx.putImageData(image,0,0);
  ctx.globalAlpha=.32;
  for(let i=0;i<1300;i+=1){const r=.3+rand()*1.9;ctx.fillStyle=rand()>.42?'#111417':'#6d7378';ctx.beginPath();ctx.arc(rand()*size,rand()*size,r,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=.26;ctx.strokeStyle='#101215';ctx.lineWidth=1;
  for(let i=0;i<9;i+=1){let x=rand()*size,y=rand()*size;ctx.beginPath();ctx.moveTo(x,y);for(let p=0;p<7;p+=1){x+=(-18+rand()*36);y+=8+rand()*24;ctx.lineTo(x,y);}ctx.stroke();}
  ctx.globalAlpha=1;return canvas;
}

function concreteCanvas(size=512,seed=23,tint='#aeb2b3'){
  const {canvas,ctx}=makeCanvas(size);const rand=seeded(seed);
  ctx.fillStyle=tint;ctx.fillRect(0,0,size,size);
  const image=ctx.getImageData(0,0,size,size);const data=image.data;
  for(let i=0;i<data.length;i+=4){const n=(rand()-.5)*18;data[i]=clamp(data[i]+n,0,255);data[i+1]=clamp(data[i+1]+n,0,255);data[i+2]=clamp(data[i+2]+n,0,255);}
  ctx.putImageData(image,0,0);
  ctx.globalAlpha=.18;ctx.fillStyle='#4b5154';
  for(let i=0;i<360;i+=1){const r=.2+rand()*2.1;ctx.beginPath();ctx.arc(rand()*size,rand()*size,r,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=.28;ctx.strokeStyle='#72787b';ctx.lineWidth=2;
  const step=size/4;for(let i=1;i<4;i+=1){ctx.beginPath();ctx.moveTo(i*step,0);ctx.lineTo(i*step,size);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*step);ctx.lineTo(size,i*step);ctx.stroke();}
  ctx.globalAlpha=1;return canvas;
}

function paverCanvas(size=512){
  const {canvas,ctx}=makeCanvas(size);
  ctx.fillStyle='#b7b2a7';ctx.fillRect(0,0,size,size);
  const w=96,h=48;
  for(let y=-h;y<size+h;y+=h){const row=Math.floor(y/h);for(let x=-w;x<size+w;x+=w){const px=x+(row%2?w/2:0);ctx.fillStyle=((row+Math.floor(x/w))%3===0)?'#aaa69d':'#b9b4aa';ctx.fillRect(px+2,y+2,w-4,h-4);ctx.strokeStyle='rgba(55,58,58,.34)';ctx.lineWidth=2;ctx.strokeRect(px+2,y+2,w-4,h-4);}}
  return canvas;
}

function facadeCanvas(size=512,seed=41,{base='#d7d0c2',accent='#bcae97'}={}){
  const {canvas,ctx}=makeCanvas(size);const rand=seeded(seed);
  ctx.fillStyle=base;ctx.fillRect(0,0,size,size);
  for(let y=0;y<size;y+=64){for(let x=0;x<size;x+=128){ctx.fillStyle=rand()>.55?base:accent;ctx.fillRect(x+3,y+3,122,58);ctx.strokeStyle='rgba(45,44,42,.18)';ctx.lineWidth=2;ctx.strokeRect(x+3,y+3,122,58);}}
  ctx.globalAlpha=.08;ctx.fillStyle='#111';for(let i=0;i<180;i+=1)ctx.fillRect(rand()*size,rand()*size,1+rand()*3,1+rand()*3);ctx.globalAlpha=1;
  return canvas;
}

function grassCanvas(size=512,seed=67){
  const {canvas,ctx}=makeCanvas(size);const rand=seeded(seed);ctx.fillStyle='#375a3a';ctx.fillRect(0,0,size,size);
  ctx.lineWidth=1;for(let i=0;i<4500;i+=1){const x=rand()*size,y=rand()*size,l=1+rand()*4;ctx.strokeStyle=rand()>.55?'rgba(120,155,91,.42)':'rgba(25,63,35,.48)';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rand()-.5)*2,y-l);ctx.stroke();}
  return canvas;
}

function grayscaleFrom(canvas,{contrast=1,bias=0}={}){
  const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;const ctx=out.getContext('2d',{alpha:false});ctx.drawImage(canvas,0,0);const image=ctx.getImageData(0,0,out.width,out.height);const d=image.data;
  for(let i=0;i<d.length;i+=4){let lum=(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722-128)*contrast+128+bias;lum=clamp(lum,0,255);d[i]=d[i+1]=d[i+2]=lum;d[i+3]=255;}ctx.putImageData(image,0,0);return out;
}

function surface(THREE,{canvas,repeat=[4,4],roughness=.7,metalness=0,bumpScale=.05,clearcoat=0,clearcoatRoughness=.5,anisotropy=4}){
  const map=repeatTexture(THREE,canvas,repeat[0],repeat[1],{anisotropy});
  const bump=repeatTexture(THREE,grayscaleFrom(canvas,{contrast:1.45}),repeat[0],repeat[1],{color:false,anisotropy});
  return new THREE.MeshPhysicalMaterial({map,roughness,metalness,bumpMap:bump,bumpScale,clearcoat,clearcoatRoughness});
}

export function createWorldPbrLibrary(THREE,renderer,{quality='medium'}={}){
  const anisotropy=Math.min(renderer?.capabilities?.getMaxAnisotropy?.()||4,quality==='high'?8:quality==='medium'?6:4);
  const asphalt=surface(THREE,{canvas:asphaltCanvas(),repeat:[5,18],roughness:.88,metalness:.02,bumpScale:.035,anisotropy});
  const sidewalk=surface(THREE,{canvas:paverCanvas(),repeat:[2.5,14],roughness:.78,metalness:.02,bumpScale:.028,anisotropy});
  const concrete=surface(THREE,{canvas:concreteCanvas(512,23,'#a8abad'),repeat:[4,4],roughness:.8,metalness:.03,bumpScale:.035,anisotropy});
  const concreteDark=surface(THREE,{canvas:concreteCanvas(512,29,'#555b60'),repeat:[4,4],roughness:.82,metalness:.05,bumpScale:.035,anisotropy});
  const stone=surface(THREE,{canvas:facadeCanvas(),repeat:[3,3],roughness:.64,metalness:.04,bumpScale:.045,clearcoat:.08,anisotropy});
  const grass=surface(THREE,{canvas:grassCanvas(),repeat:[18,18],roughness:1,metalness:0,bumpScale:.025,anisotropy});
  const facadeWarm=surface(THREE,{canvas:facadeCanvas(512,41,{base:'#c9c0ae',accent:'#a99881'}),repeat:[2,4],roughness:.65,metalness:.04,bumpScale:.032,anisotropy});
  const facadeCool=surface(THREE,{canvas:facadeCanvas(512,45,{base:'#91a5b1',accent:'#728894'}),repeat:[2,4],roughness:.59,metalness:.08,bumpScale:.028,anisotropy});
  const roadLine=new THREE.MeshStandardMaterial({color:0xf1e7c0,roughness:.74,metalness:0});
  const roadLineWhite=new THREE.MeshStandardMaterial({color:0xf5f5ef,roughness:.72,metalness:0});
  const blackMetal=new THREE.MeshStandardMaterial({color:0x171b1f,roughness:.32,metalness:.82});
  const brushedMetal=new THREE.MeshStandardMaterial({color:0x737a80,roughness:.28,metalness:.9});
  const gold=new THREE.MeshStandardMaterial({color:0xcaa65d,roughness:.28,metalness:.9});
  const glass=new THREE.MeshPhysicalMaterial({color:0x31596b,roughness:.08,metalness:.14,transmission:.16,transparent:true,opacity:.84,clearcoat:1,clearcoatRoughness:.08});
  const glassWarm=new THREE.MeshPhysicalMaterial({color:0x765b37,emissive:0x3d260b,emissiveIntensity:.42,roughness:.13,metalness:.08,transmission:.08,transparent:true,opacity:.88,clearcoat:.75});
  const windowCool=new THREE.MeshStandardMaterial({color:0x83c8db,emissive:0x287c9f,emissiveIntensity:1.15,roughness:.2,metalness:.16});
  const windowWarm=new THREE.MeshStandardMaterial({color:0xe4b978,emissive:0xb87427,emissiveIntensity:1.25,roughness:.24,metalness:.08});
  const foliage=new THREE.MeshStandardMaterial({color:0x438363,roughness:.92,metalness:0,side:THREE.DoubleSide});
  const foliageLight=new THREE.MeshStandardMaterial({color:0x7aa36a,roughness:.9,metalness:0,side:THREE.DoubleSide});
  const trunk=new THREE.MeshStandardMaterial({color:0x5f4734,roughness:.96,metalness:0});
  const roof=new THREE.MeshStandardMaterial({color:0x33383b,roughness:.72,metalness:.16});
  const emissiveCyan=new THREE.MeshStandardMaterial({color:0xb2f0ff,emissive:0x278fae,emissiveIntensity:1.7,roughness:.2,metalness:.24});
  const emissiveGold=new THREE.MeshStandardMaterial({color:0xffd991,emissive:0xb16c1e,emissiveIntensity:1.4,roughness:.24,metalness:.62});
  return Object.freeze({asphalt,sidewalk,concrete,concreteDark,stone,grass,facadeWarm,facadeCool,roadLine,roadLineWhite,blackMetal,brushedMetal,gold,glass,glassWarm,windowCool,windowWarm,foliage,foliageLight,trunk,roof,emissiveCyan,emissiveGold,dispose(){for(const value of Object.values(this)){if(value?.isMaterial){for(const item of Object.values(value))if(item?.isTexture)item.dispose?.();value.dispose?.();}}}});
}
