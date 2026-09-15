import {findBlender} from './blender_locator.mjs';

const found=findBlender();
if(!found){
  console.error(JSON.stringify({ok:false,error:'BLENDER_NOT_FOUND',message:'Install Blender, then rerun this detector. All later WISDO asset work is automated.'},null,2));
  process.exit(2);
}
console.log(JSON.stringify({ok:true,...found},null,2));
